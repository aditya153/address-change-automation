from typing import Optional, List, Dict
from datetime import datetime
from mcp.server.fastmcp import FastMCP
from pydantic import BaseModel, Field

server = FastMCP(name="mcp_server")

from src.automation.db import (
    create_case,
    update_case_status,
    set_canonical_address,
    set_registry_exists,
    add_audit_entry,
    get_audit_entries,
    get_canonical_address,
)


# ====== MODELS ======

class IngestCaseInput(BaseModel):
    citizen_name: str
    dob: str
    email: str
    old_address_raw: str
    new_address_raw: str
    move_in_date_raw: str
    landlord_name: Optional[str] = None
    case_id: Optional[str] = None


class IngestCaseOutput(BaseModel):
    case_id: str
    extracted_data: Dict
    status: str


class VerifyIdentityInput(BaseModel):
    case_id: str
    citizen_name: str
    dob: str


class VerifyIdentityOutput(BaseModel):
    case_id: str
    exists: bool
    reasons: List[str]


class AssessQualityInput(BaseModel):
    case_id: str
    new_address_raw: str


class AssessQualityOutput(BaseModel):
    case_id: str
    canonical_address: str
    confidence: float
    needs_hitl: bool
    hitl_task_id: Optional[str] = None


class BusinessRulesInput(BaseModel):
    case_id: str
    move_in_date_raw: str
    canonical_address: str
    documents_ok: bool = True


class BusinessRulesOutput(BaseModel):
    case_id: str
    overall_status: str
    needs_hitl: bool
    rule_results: Dict[str, str]
    hitl_task_id: Optional[str] = None


class UpdateRegistryInput(BaseModel):
    case_id: str
    citizen_id: str = Field(default="CIT-DEMO-001")
    new_address: str


class UpdateRegistryOutput(BaseModel):
    case_id: str
    citizen_id: str
    update_status: str
    message: str


class GenerateCertificateInput(BaseModel):
    case_id: str
    email: str
    citizen_name: str
    dob: str
    move_in_date: str
    new_address: str


class GenerateCertificateOutput(BaseModel):
    case_id: str
    certificate_path: str
    email_status: str
    case_status: str


class GetAuditLogInput(BaseModel):
    case_id: str


class GetAuditLogOutput(BaseModel):
    case_id: str
    entries: List[str]


# ====== TOOLS ======

@server.tool()
def ingest_case(input: IngestCaseInput) -> IngestCaseOutput:
    """
    Create a new case row in Postgres and return the case_id + extracted data.
    If case_id is provided, it uses the existing case instead of creating a new one.
    """
    # In future, this is where real OCR would fill more fields.
    extracted = {
        "citizen_name": input.citizen_name,
        "dob": input.dob,
        "email": input.email,
        "old_address_raw": input.old_address_raw,
        "new_address_raw": input.new_address_raw,
        "move_in_date_raw": input.move_in_date_raw,
        "landlord_name": input.landlord_name,
    }

    if input.case_id:
        # Use existing case
        case_id = input.case_id
        # Optionally update the case with extracted data if needed
        # For now, we assume api.py already updated it
        add_audit_entry(case_id, "Case processing started (using existing case).")
    else:
        # Create case in DB, get case_id like "Case ID: 1"
        case_id = create_case(extracted)
        # Add first audit entry
        add_audit_entry(case_id, "Case ingested & OCR simulated.")

    return IngestCaseOutput(
        case_id=case_id,
        extracted_data=extracted,
        status="INGESTED",
    )


@server.tool()
def verify_identity(input: VerifyIdentityInput) -> VerifyIdentityOutput:
    reasons: List[str] = []
    exists = not input.citizen_name.lower().startswith("test")

    if exists:
        reasons.append("Citizen found in demo registry (stub).")
    else:
        reasons.append("Citizen not found; name looks like a test entry.")

    # store exists flag & audit in DB
    set_registry_exists(input.case_id, exists)
    add_audit_entry(
        input.case_id,
        f"Identity verification run. exists={exists}",
    )

    return VerifyIdentityOutput(
        case_id=input.case_id,
        exists=exists,
        reasons=reasons,
    )


@server.tool()
def assess_quality(input: AssessQualityInput) -> AssessQualityOutput:
    raw = input.new_address_raw.strip()
    canonical = raw.title()

    # Quality checks
    has_comma = "," in canonical
    has_digit = any(ch.isdigit() for ch in canonical)
    
    # Check for abbreviated city names (2-3 uppercase letters like "KL", "DL")
    # This is a strong indicator of low quality
    import re
    has_abbreviation = bool(re.search(r'\b[A-Z]{2,3}\b', raw))
    
    # Check if it has a proper postal code (5 digits for Germany)
    has_postal_code = bool(re.search(r'\b\d{5}\b', raw))
    
    # Check for minimum length (proper addresses should be reasonably long)
    min_length = len(raw) > 20
    
    # Calculate confidence score
    if has_abbreviation:
        # If we detect abbreviations like "KL" or "DL", confidence is low
        confidence = 0.4
    elif has_comma and has_digit and has_postal_code and min_length:
        # Well-formatted address with all components
        confidence = 0.95
    elif has_comma and has_digit:
        # Has basic structure but might be incomplete
        confidence = 0.7
    else:
        # Missing basic components
        confidence = 0.5

    needs_hitl = confidence < 0.8
    hitl_task_id = None

    if needs_hitl:
        hitl_task_id = f"HITL-{input.case_id}"
        update_case_status(input.case_id, "WAITING_FOR_HUMAN")
        add_audit_entry(
            input.case_id,
            f"HITL required for address quality. confidence={confidence} (reason: {'abbreviation detected' if has_abbreviation else 'incomplete address format'})",
        )
    else:
        update_case_status(input.case_id, "QUALITY_OK")
        add_audit_entry(
            input.case_id,
            f"Address quality OK. confidence={confidence}",
        )

    # store canonical address
    set_canonical_address(input.case_id, canonical)

    return AssessQualityOutput(
        case_id=input.case_id,
        canonical_address=canonical,
        confidence=confidence,
        needs_hitl=needs_hitl,
        hitl_task_id=hitl_task_id,
    )


@server.tool()
def check_business_rules(input: BusinessRulesInput) -> BusinessRulesOutput:
    """
    Check if HITL is needed first - if case is WAITING_FOR_HUMAN, skip and return early
    """
    # Check if case is waiting for HITL
    from ..db import fetch_case_by_id
    from datetime import datetime # Moved up for consistency

    case_row = fetch_case_by_id(input.case_id)
    
    if case_row and case_row.get("status") == "WAITING_FOR_HUMAN":
        # Case is waiting for human correction - skip business rules check
        add_audit_entry(
            input.case_id,
            "Business rules check skipped - case waiting for HITL address correction"
        )
        return BusinessRulesOutput(
            case_id=input.case_id,
            overall_status="paused",
            needs_hitl=True,
            hitl_task_id=f"HITL-{input.case_id}",
            rule_results={
                "HITL_PENDING": "Waiting for human to correct address before validating business rules"
            },
        )
    
    # Original business rules logic continues...
    rule_results: Dict[str, str] = {}
    needs_hitl = False

    # --- Rule 1: move-in date validity (very naive) ---
    try:
        move_date = datetime.fromisoformat(input.move_in_date_raw)
        now = datetime.utcnow()
        delta_days = (move_date - now).days
        if -365 <= delta_days <= 30:
            rule_results["move_in_date"] = "ok"
        else:
            rule_results["move_in_date"] = "suspicious"
            needs_hitl = True
    except Exception:
        rule_results["move_in_date"] = "invalid_format"
        needs_hitl = True

    # --- Rule 2: address format compliance (uses canonical_address) ---
    canonical_address = get_canonical_address(input.case_id)
    addr = canonical_address or ""
    has_comma = "," in addr
    has_digit = any(ch.isdigit() for ch in addr)

    if has_comma and has_digit:
        rule_results["address_format_compliance"] = "passed"
    else:
        rule_results["address_format_compliance"] = "failed"
        needs_hitl = True

    # --- Rule 3: documents presence ---
    if input.documents_ok:
        rule_results["documents"] = "ok"
    else:
        rule_results["documents"] = "missing_or_invalid"
        needs_hitl = True

    overall_status = "passed" if not needs_hitl else "failed"
    hitl_task_id = None

    if needs_hitl:
        hitl_task_id = f"HITL-RULES-{input.case_id}"
        update_case_status(input.case_id, "WAITING_FOR_HUMAN")
        add_audit_entry(
            input.case_id,
            f"HITL required for business rules. status={overall_status}, "
            f"rule_results={rule_results}"
        )
    else:
        update_case_status(input.case_id, "RULES_PASSED")
        add_audit_entry(
            input.case_id,
            f"Business rules passed. rule_results={rule_results}"
        )

    return BusinessRulesOutput(
        case_id=input.case_id,
        overall_status=overall_status,
        needs_hitl=needs_hitl,
        rule_results=rule_results,
        hitl_task_id=hitl_task_id,
    )


@server.tool()
def update_registry(input: UpdateRegistryInput) -> UpdateRegistryOutput:
    """
    Skip if case is waiting for HITL
    """
    # Check if case is waiting for HITL
    from ..db import fetch_case_by_id
    case_row = fetch_case_by_id(input.case_id)
    
    if case_row and case_row.get("status") in ["WAITING_FOR_HUMAN", "paused"]:
        add_audit_entry(
            input.case_id,
            "Registry update skipped - case waiting for HITL"
        )
        return UpdateRegistryOutput(
            case_id=input.case_id,
            citizen_id=input.citizen_id,
            new_address=input.new_address,
            update_status="skipped_hitl_pending",
            message="Registry update paused - waiting for HITL address correction",
        )
    
    """
    Dummy registry update using Postgres.
    Marks the case as UPDATED and logs the canonical address used.
    """
    # mark status
    update_case_status(input.case_id, "UPDATED")

    # optional: store the canonical new address again if you want
    # (can also be done only in assess_quality, your choice)
    set_canonical_address(input.case_id, input.new_address)

    add_audit_entry(
        input.case_id,
        f"Registry updated (demo) for citizen_id={input.citizen_id} "
        f"with new_address='{input.new_address}'."
    )

    return UpdateRegistryOutput(
        case_id=input.case_id,
        citizen_id=input.citizen_id,
        update_status="success",
        message="Registry updated in Postgres (demo).",
    )


from src.automation.email_service import send_certificate_email

@server.tool()
def generate_certificate(input: GenerateCertificateInput) -> GenerateCertificateOutput:
    """
    Skip if case is waiting for HITL
    """
    # Check if case is waiting for HITL
    from ..db import fetch_case_by_id
    case_row = fetch_case_by_id(input.case_id)
    
    if case_row and case_row.get("status") in ["WAITING_FOR_HUMAN", "paused"]:
        add_audit_entry(
            input.case_id,
            "Certificate generation skipped - case waiting for HITL"
        )
        return GenerateCertificateOutput(
            case_id=input.case_id,
            certificate_path="skipped_hitl_pending",
            email_status="skipped",
            case_status="WAITING_FOR_HUMAN",
            message="Certificate generation paused - waiting for HITL address correction",
        )
    
    """
    Generate a professional PDF certificate in official government style.
    """
    filename = f"{input.case_id.replace(' ', '_')}_certificate.pdf"
    certificate_path = f"/app/uploads/{filename}"
    
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.pdfgen import canvas
        from reportlab.lib.units import cm
        from reportlab.lib import colors
        
        c = canvas.Canvas(certificate_path, pagesize=A4)
        width, height = A4
        
        # --- BACKGROUND & BORDER ---
        # Decorative border
        c.setStrokeColorRGB(0.1, 0.1, 0.1)
        c.setLineWidth(3)
        c.rect(1.5*cm, 1.5*cm, width - 3*cm, height - 3*cm)
        c.setLineWidth(1)
        c.rect(1.6*cm, 1.6*cm, width - 3.2*cm, height - 3.2*cm)
        
        # --- HEADER ---
        # "Bundesadler" stylized placeholder (circle with eagle text representation)
        c.setStrokeColorRGB(0, 0, 0)
        c.setLineWidth(1)
        c.circle(width/2, height - 3.5*cm, 1.2*cm)
        c.setFont("Times-Bold", 14)
        c.drawCentredString(width/2, height - 3.5*cm - 2, "§")  # Stylized symbol
        
        # Official Title
        c.setFillColorRGB(0, 0, 0)
        c.setFont("Times-Bold", 24)
        c.drawCentredString(width/2, height - 5.5*cm, "BUNDESREPUBLIK DEUTSCHLAND")
        
        c.setFont("Helvetica", 14)
        c.drawCentredString(width/2, height - 6.5*cm, "MELDEBESCHEINIGUNG")
        c.setFont("Helvetica-Oblique", 10)
        c.drawCentredString(width/2, height - 7*cm, "gemäß § 18 Bundesmeldegesetz (BMG)")
        
        # --- AUTHORITY INFO (Top Right) ---
        c.setFont("Helvetica", 9)
        c.drawRightString(width - 2.5*cm, height - 9*cm, "Datum: " + datetime.now().strftime('%d.%m.%Y'))
        c.drawRightString(width - 2.5*cm, height - 9.5*cm, f"Vorgangs-Nr.: {input.case_id}")
        c.drawRightString(width - 2.5*cm, height - 10*cm, "Sachbearbeiter: System")
        
        # --- MAIN CONTENT ---
        y = height - 11*cm
        
        # Intro text
        c.setFont("Times-Roman", 12)
        c.drawString(2.5*cm, y, "Hiermit wird amtlich bescheinigt, dass für die folgende Person:")
        y -= 0.8*cm
        
        # Data Box
        box_top = y
        c.setStrokeColorRGB(0.7, 0.7, 0.7)
        c.setLineWidth(0.5)
        
        # Field 1: Name
        y -= 0.8*cm
        c.setFont("Helvetica-Bold", 10)
        c.drawString(3*cm, y, "Familienname, Vorname(n):")
        c.setFont("Helvetica", 12)
        c.drawString(8.5*cm, y, input.citizen_name)
        
        # Field 2: DOB
        y -= 1.2*cm
        c.setFont("Helvetica-Bold", 10)
        c.drawString(3*cm, y, "Geburtsdatum:")
        c.setFont("Helvetica", 12)
        try:
            dob_fmt = datetime.fromisoformat(input.dob).strftime('%d.%m.%Y')
        except:
            dob_fmt = input.dob
        c.drawString(8.5*cm, y, dob_fmt)
        
        # Field 3: New Address
        y -= 1.2*cm
        c.setFont("Helvetica-Bold", 10)
        c.drawString(3*cm, y, "Neue Anschrift:")
        c.setFont("Helvetica", 12)
        
        addr_lines = input.new_address.split(',')
        if len(addr_lines) > 1:
            c.drawString(8.5*cm, y + 0.2*cm, addr_lines[0].strip())
            c.drawString(8.5*cm, y - 0.4*cm, ",".join(addr_lines[1:]).strip())
        else:
             c.drawString(8.5*cm, y, input.new_address)
             
        # Field 4: Move-in Date
        y -= 1.2*cm
        c.setFont("Helvetica-Bold", 10)
        c.drawString(3*cm, y, "Einzugsdatum:")
        c.setFont("Helvetica", 12)
        try:
            mid_fmt = datetime.fromisoformat(input.move_in_date).strftime('%d.%m.%Y')
        except:
            mid_fmt = input.move_in_date
        c.drawString(8.5*cm, y, mid_fmt)
        
        # Field 5: Registration Type
        y -= 1.2*cm
        c.setFont("Helvetica-Bold", 10)
        c.drawString(3*cm, y, "Melderechtsstatus:")
        c.setFont("Helvetica", 12)
        c.drawString(8.5*cm, y, "Hauptwohnsitz")

        y -= 1.0*cm
        
        # Draw Box around data
        box_bottom = y
        c.rect(2.5*cm, box_bottom, width - 5*cm, box_top - box_bottom)
        
        
        # --- CONFIRMATION STATEMENT ---
        y -= 1.5*cm
        c.setFont("Times-Roman", 11)
        c.drawString(2.5*cm, y, "Die Daten wurden in das Melderegister übernommen.")
        y -= 0.5*cm
        c.drawString(2.5*cm, y, "Diese Bescheinigung dient zur Vorlage bei Behörden und Sozialversicherungsträgern.")
        
        # --- OFFICIAL STAMP & SIGNATURE ---
        y -= 3*cm
        
        # Stylized Stamp (Amtliches Siegel)
        errors = 0.5 # displacement
        stamp_center_x = width - 6*cm
        stamp_center_y = y
        c.setStrokeColorRGB(0.1, 0.1, 0.4) # Blue stamp ink color
        c.setLineWidth(1.5)
        c.circle(stamp_center_x, stamp_center_y, 1.8*cm)
        c.setLineWidth(0.5)
        c.circle(stamp_center_x, stamp_center_y, 1.6*cm)
        
        c.setFont("Helvetica-Bold", 8)
        c.setFillColorRGB(0.1, 0.1, 0.4)
        
        # Text around stamp (simplified visual approximation)
        c.drawCentredString(stamp_center_x, stamp_center_y + 1.2*cm, "STADTVERWALTUNG")
        c.drawCentredString(stamp_center_x, stamp_center_y - 1.3*cm, "BÜRGERAMT")
        
        c.setFont("Times-Bold", 20)
        c.drawCentredString(stamp_center_x, stamp_center_y - 0.2*cm, "Amtlich")
        
        # Signature Line
        c.setStrokeColorRGB(0, 0, 0)
        c.setLineWidth(1)
        c.line(2.5*cm, y, 9*cm, y)
        c.setFont("Helvetica", 8)
        c.setFillColorRGB(0, 0, 0)
        c.drawString(2.5*cm, y - 0.4*cm, "Im Auftrag")
        # Use ZapfChancery-MediumItalic for script-like signature if available, else Helvetica-Oblique
        try:
            c.setFont("ZapfChancery-MediumItalic", 14)
            c.drawString(5*cm, y - 0.5*cm, "M. Müller")
        except:
             c.setFont("Helvetica-Oblique", 14)
             c.drawString(5*cm, y - 0.5*cm, "M. Müller")
        
        # --- FOOTER ---
        footer_y = 2.5*cm
        c.setFont("Helvetica", 7)
        c.setFillColorRGB(0.5, 0.5, 0.5)
        c.drawCentredString(width/2, footer_y, "Dieses Dokument wurde maschinell erstellt und ist ohne Unterschrift gültig.")
        c.drawCentredString(width/2, footer_y - 0.4*cm, "Bundesmeldegesetz (BMG) vom 3. Mai 2013 | BGBl. I S. 1084")
        
        c.save()
        print(f"Generated official German PDF certificate at {certificate_path}")
        
    except Exception as e:
        print(f"Error creating PDF certificate: {e}")
        import traceback
        traceback.print_exc()
        try:
            # Fallback: Generate a simple valid PDF with the error
            from reportlab.pdfgen import canvas
            c = canvas.Canvas(certificate_path)
            c.drawString(100, 700, "Error generating certificate.")
            c.drawString(100, 680, f"Case: {input.case_id}")
            c.save()
        except:
            # Last resort if even ReportLab fails
             with open(certificate_path, "w") as f:
                 f.write(f"Certificate-Error.txt") # This will still look corrupt as .pdf but prevents 0-byte

    email_sent = send_certificate_email(input.email, certificate_path, input.case_id, input.citizen_name)
    email_status_msg = "sent" if email_sent else "failed"

    update_case_status(input.case_id, "CLOSED")
    add_audit_entry(
        input.case_id,
        f"Official PDF certificate generated at {certificate_path}. Email to {input.email}: {email_status_msg}."
    )

    return GenerateCertificateOutput(
        case_id=input.case_id,
        certificate_path=certificate_path,
        email_status=f"{email_status_msg} to {input.email}",
        case_status="CLOSED",
    )

@server.tool()
def get_audit_log(input: GetAuditLogInput) -> GetAuditLogOutput:
    rows = get_audit_entries(input.case_id)
    if rows:
        entries = [
            f"{row['timestamp'].isoformat()} - {row['message']}"
            for row in rows
        ]
    else:
        entries = [f"{datetime.utcnow().isoformat()} - No case found for {input.case_id}"]

    return GetAuditLogOutput(
        case_id=input.case_id,
        entries=entries,
    )


if __name__ == "__main__":
    server.run()
