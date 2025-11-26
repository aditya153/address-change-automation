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
        
        c = canvas.Canvas(certificate_path, pagesize=A4)
        width, height = A4
        
        # Header: Government Logo Area
        c.setFillColorRGB(0.1, 0.2, 0.4)
        c.rect(0, height - 3*cm, width, 3*cm, fill=1)
        
        c.setFillColorRGB(1, 1, 1)
        c.setFont("Helvetica-Bold", 18)
        c.drawCentredString(width / 2, height - 1.5*cm, "BUNDESREPUBLIK DEUTSCHLAND")
        c.setFont("Helvetica", 12)
        c.drawCentredString(width / 2, height - 2.2*cm, "Amt für Meldewesen und Bürgerservice")
        
        # Title
        c.setFillColorRGB(0, 0, 0)
        c.setFont("Helvetica-Bold", 22)
        c.drawCentredString(width / 2, height - 5*cm, "MELDEBESCHEINIGUNG")
        
        c.setFont("Helvetica", 14)
        c.drawCentredString(width / 2, height - 6*cm, "Bestätigung der Adressänderung")
        
        # Reference line
        y = height - 7.5*cm
        c.setFont("Helvetica", 10)
        c.setFillColorRGB(0.4, 0.4, 0.4)
        c.drawString(3*cm, y, f"Referenz-Nr.: {input.case_id}")
        c.drawRightString(width - 3*cm, y, f"Ausstellungsdatum: {datetime.now().strftime('%d.%m.%Y')}")
        
        # Separator
        y -= 0.5*cm
        c.setStrokeColorRGB(0.7, 0.7, 0.7)
        c.setLineWidth(0.5)
        c.line(3*cm, y, width - 3*cm, y)
        
        # Main content
        y -= 1.5*cm
        c.setFillColorRGB(0, 0, 0)
        c.setFont("Helvetica", 11)
        c.drawString(3*cm, y, "Hiermit wird bescheinigt, dass die Adressänderung für die folgende Person")
        y -= 0.5*cm
        c.drawString(3*cm, y, "erfolgreich im Melderegister eingetragen wurde.")
        
        # Citizen details box
        y -= 1.5*cm
        box_height = 5*cm
        c.setFillColorRGB(0.95, 0.97, 1)
        c.roundRect(3*cm, y - box_height, width - 6*cm, box_height, 0.3*cm, fill=1, stroke=0)
        
        c.setFillColorRGB(0, 0, 0)
        y_box = y - 0.8*cm
        
        c.setFont("Helvetica-Bold", 11)
        c.drawString(4*cm, y_box, "Name:")
        c.setFont("Helvetica", 11)
        c.drawString(8*cm, y_box, input.citizen_name)
        
        y_box -= 0.8*cm
        c.setFont("Helvetica-Bold", 11)
        c.drawString(4*cm, y_box, "Geburtsdatum:")
        c.setFont("Helvetica", 11)
        try:
            dob_formatted = datetime.fromisoformat(input.dob).strftime('%d.%m.%Y')
        except:
            dob_formatted = input.dob
        c.drawString(8*cm, y_box, dob_formatted)
        
        y_box -= 0.8*cm
        c.setFont("Helvetica-Bold", 11)
        c.drawString(4*cm, y_box, "Neue Anschrift:")
        c.setFont("Helvetica", 11)
        address_text = input.new_address
        if len(address_text) > 50:
            c.drawString(8*cm, y_box, address_text[:50])
            y_box -= 0.5*cm
            c.drawString(8*cm, y_box, address_text[50:])
        else:
            c.drawString(8*cm, y_box, address_text)
        
        y_box -= 0.8*cm
        c.setFont("Helvetica-Bold", 11)
        c.drawString(4*cm, y_box, "Einzugsdatum:")
        c.setFont("Helvetica", 11)
        try:
            move_in_formatted = datetime.fromisoformat(input.move_in_date).strftime('%d.%m.%Y')
        except:
            move_in_formatted = input.move_in_date
        c.drawString(8*cm, y_box, move_in_formatted)
        
        # Official stamp
        y = y - box_height - 2*cm
        c.setFont("Helvetica-Oblique", 9)
        c.setFillColorRGB(0.3, 0.3, 0.3)
        c.drawCentredString(width / 2, y, "Diese Bescheinigung wurde maschinell erstellt und ist ohne Unterschrift gültig.")
        
        # Footer
        c.setFont("Helvetica", 8)
        c.setFillColorRGB(0.5, 0.5, 0.5)
        footer_y = 2*cm
        c.drawCentredString(width / 2, footer_y, "Bürgerservice der Bundesrepublik Deutschland")
        c.drawCentredString(width / 2, footer_y - 0.4*cm, "www.bundesverwaltung.de | service@buergeramt.de")
        
        c.save()
        print(f"Generated professional PDF certificate at {certificate_path}")
        
    except Exception as e:
        print(f"Error creating PDF certificate: {e}")
        import traceback
        traceback.print_exc()
        with open(certificate_path, "w") as f:
             f.write(f"Certificate (Fallback)\nCase: {input.case_id}\nName: {input.citizen_name}\nAddress: {input.new_address}")

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
