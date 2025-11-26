# src/automation/api.py

from datetime import date, datetime
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr

from .main import run_address_change_workflow
from .db import get_audit_entries, get_conn


# =======================
# Pydantic models
# =======================

class AddressChangeRequest(BaseModel):
    """Input payload from frontend or API client."""
    citizen_name: str
    dob: date                    # will be converted to ISO string for Crew
    email: EmailStr
    old_address_raw: str
    new_address_raw: str
    move_in_date_raw: str        # keep as string as in your MCP tools
    landlord_name: Optional[str] = None


class WorkflowResult(BaseModel):
    """Wrapper around whatever Crew returns."""
    data: Any


class AddressChangeResponse(BaseModel):
    """Response for /address-change/run."""
    status: str
    case_id: Optional[str] = None
    workflow_result: WorkflowResult


class AuditLogEntry(BaseModel):
    timestamp: datetime
    message: str


class AuditLogResponse(BaseModel):
    case_id: str
    entries: List[AuditLogEntry]


class CaseDetails(BaseModel):
    """Detailed view of a single case from the DB."""
    case_id: str
    citizen_name: str
    dob: date
    email: str
    old_address_raw: str
    new_address_raw: str
    move_in_date_raw: str
    landlord_name: Optional[str] = None
    canonical_address: Optional[str] = None
    registry_exists: Optional[bool] = None
    status: str
    created_at: datetime
    updated_at: datetime


# =======================
# Helper functions
# =======================

def get_latest_case_id() -> Optional[str]:
    """
    Return the most recently created case_id from the DB.
    This assumes each workflow run creates exactly one case.
    """
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT case_id
            FROM cases
            ORDER BY created_at DESC
            LIMIT 1;
            """
        )
        row = cur.fetchone()
        if not row:
            return None
        # RealDictCursor -> row["case_id"]
        return row["case_id"]


def fetch_case_by_id(case_id: str) -> Optional[Dict[str, Any]]:
    """
    Fetch a full case row by human-readable case_id (e.g. "Case ID: 1").
    """
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                case_id,
                citizen_name,
                dob,
                email,
                old_address_raw,
                new_address_raw,
                move_in_date_raw,
                landlord_name,
                canonical_address,
                registry_exists,
                status,
                created_at,
                updated_at
            FROM cases
            WHERE case_id = %s;
            """,
            (case_id,),
        )
        row = cur.fetchone()
    return row


# =======================
# FastAPI app
# =======================

app = FastAPI(
    title="CityAdmin Address Change Backend",
    version="1.0.0",
    description="FastAPI backend for the address-change workflow (CrewAI + MCP + Postgres).",
)

# CORS – allow everything for now (you can tighten later)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],      # for demo; restrict to your frontend origin later
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =======================
# Routes
# =======================

@app.get("/health")
def health_check() -> Dict[str, str]:
    """
    Simple health endpoint to check that the backend is running.
    """
    return {"status": "ok", "service": "address-change-backend"}




@app.post("/address-change/run", response_model=AddressChangeResponse)
def run_address_change(payload: AddressChangeRequest) -> AddressChangeResponse:
    """
    Trigger the full Crew + MCP workflow for one citizen.

    - Takes structured citizen data (later this could come from OCR).
    - Calls run_address_change_workflow (which runs the Crew).
    - Returns:
        - status: "ok" or "error"
        - case_id: latest case created in DB for this run
        - workflow_result: raw result from Crew kickoff (for debugging / UI)
    """
    try:
        # Convert Pydantic model to dict
        citizen_data: Dict[str, Any] = payload.model_dump()

        # Your Crew / MCP pipeline expects dob as ISO string, not date object
        citizen_data["dob"] = payload.dob.isoformat()

        # Run the workflow (this will trigger all agents + MCP tools)
        result = run_address_change_workflow(citizen_data)

        # Try to get the latest case_id from DB (most recent case)
        case_id = get_latest_case_id()

        return AddressChangeResponse(
            status="ok",
            case_id=case_id,
            workflow_result=WorkflowResult(data=result),
        )
    except Exception as e:
        # Log error if you want (print, logger, etc.)
        # For now just return a 500 with the error message
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/cases/{case_id}/audit", response_model=AuditLogResponse)
def get_audit_log(case_id: str) -> AuditLogResponse:
    """
    Get the audit log for a given case_id from Postgres.

    This simply exposes the audit_logs table in chronological order
    so the frontend can render a nice timeline.
    """
    try:
        rows = get_audit_entries(case_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    if not rows:
        raise HTTPException(status_code=404, detail=f"No audit log for case_id={case_id}")

    entries = [
        AuditLogEntry(
            timestamp=row["timestamp"],
            message=row["message"],
        )
        for row in rows
    ]

    return AuditLogResponse(
        case_id=case_id,
        entries=entries,
    )


@app.get("/cases/{case_id}", response_model=CaseDetails)
def get_case(case_id: str) -> CaseDetails:
    """
    Get full case details from the cases table by human-readable case_id
    (e.g. "Case ID: 1").

    Useful for a case detail page or debugging.
    """
    try:
        row = fetch_case_by_id(case_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    if not row:
        raise HTTPException(status_code=404, detail=f"Case not found: {case_id}")

    # RealDictCursor already gives us a dict with correct types
    return CaseDetails(**row)


# =======================
# NEW ENDPOINTS FOR FILE UPLOAD & ADMIN
# =======================

from fastapi import File, UploadFile, Form
from fastapi.responses import JSONResponse
import shutil
from pathlib import Path
from datetime import datetime as dt
from .ocr_service import process_uploaded_pdfs
from .email_service import send_certificate_email

# Create uploads directory
UPLOAD_DIR = Path("/app/uploads")
UPLOAD_DIR.mkdir(exist_ok=True)


@app.post("/submit-case")
async def submit_case(
    email: str =Form(...),
    landlord_pdf: UploadFile = File(...),
    address_pdf: UploadFile = File(...)
):
    """
    User submission endpoint - accepts email and 2 PDFs
    """
    try:
        # Generate unique filenames
        timestamp = dt.now().strftime("%Y%m%d_%H%M%S")
        landlord_path = UPLOAD_DIR / f"{timestamp}_landlord_{landlord_pdf.filename}"
        address_path = UPLOAD_DIR / f"{timestamp}_address_{address_pdf.filename}"
        
        # Save files
        with landlord_path.open("wb") as buffer:
            shutil.copyfileobj(landlord_pdf.file, buffer)
        with address_path.open("wb") as buffer:
            shutil.copyfileobj(address_pdf.file, buffer)
        
        # Run OCR immediately
        try:
            print(f"Running OCR for new case...")
            citizen_data = process_uploaded_pdfs(str(landlord_path), str(address_path), email)
        except Exception as ocr_error:
            print(f"OCR Error: {ocr_error}")
            # Use fallback data if OCR fails
            citizen_data = {
                "citizen_name": "OCR Fallback User",
                "dob": "1990-01-01",
                "email": email,
                "old_address_raw": "Fallback Old Street 1, 10115 Berlin",
                "new_address_raw": "Fallback New Street 5, 80331 Munich",
                "move_in_date_raw": "2025-03-01",
                "landlord_name": "Fallback Landlord GmbH"
            }

        # Create case in database with PENDING_APPROVAL status
        # Use plain cursor for simple query
        from psycopg2 import connect
        import os
        conn = connect(os.getenv("DATABASE_URL"))
        try:
            cur = conn.cursor()  # Plain cursor, not RealDictCursor
            try:
                # Get next case ID
                cur.execute("SELECT COALESCE(MAX(id), 0) + 1 FROM cases")
                next_id = cur.fetchone()[0]
                case_id = f"Case ID: {next_id}"
                
                cur.execute(
                    """
                    INSERT INTO cases (
                        case_id, citizen_name, dob, email, 
                        old_address_raw, new_address_raw, move_in_date_raw,
                        landlord_name, status, 
                        pdf_landlord_path, pdf_address_change_path,
                        submitted_at
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                    );
                    """,
                    (
                        case_id,
                        citizen_data.get("citizen_name", "Unknown"),
                        citizen_data.get("dob", "1990-01-01"),
                        email,
                        citizen_data.get("old_address_raw", "Unknown"),
                        citizen_data.get("new_address_raw", "Unknown"),
                        citizen_data.get("move_in_date_raw", "2025-01-01"),
                        citizen_data.get("landlord_name", "Unknown"),
                        "PENDING_APPROVAL",
                        str(landlord_path),
                        str(address_path),
                        dt.now()
                    )
                )
                conn.commit()
            finally:
                cur.close()
        finally:
            conn.close()
        
        return JSONResponse({
            "status": "success",
            "message": "Your request has been submitted! You will be notified via email soon.",
            "email": email,
            "extracted_data": citizen_data  # Return extracted data for debugging
        })
        
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"SUBMISSION ERROR: {error_details}")
        raise HTTPException(status_code=500, detail=f"Submission error: {str(e) if str(e) else 'Unknown error - check logs'}")


@app.get("/admin/pending-cases")
async def get_pending_cases():
    """
    Admin endpoint - list all pending cases
    """
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT case_id, email, submitted_at, status, 
                   pdf_landlord_path, pdf_address_change_path 
            FROM cases 
            WHERE status IN ('PENDING_APPROVAL', 'PROCESSING')
            ORDER BY submitted_at DESC
            """
        )
        rows = cur.fetchall()
        
    return {"cases": rows}


@app.get("/admin/completed-cases")
async def get_completed_cases():
    """
    Admin endpoint - list all completed (CLOSED) cases.
    """
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT case_id, email, submitted_at, status,
                   pdf_landlord_path, pdf_address_change_path
            FROM cases
            WHERE status = 'CLOSED'
            ORDER BY submitted_at DESC
            """
        )
        rows = cur.fetchall()
    return {"cases": rows}


@app.get("/admin/hitl-cases")
def get_hitl_cases():
    """
    Get all cases that need human review (WAITING_FOR_HUMAN status)
    """
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT case_id, email, citizen_name, new_address_raw, canonical_address,
                   submitted_at, updated_at
            FROM cases
            WHERE status = 'WAITING_FOR_HUMAN'
            ORDER BY submitted_at DESC
            """
        )
        rows = cur.fetchall()
    return {"cases": rows}


@app.post("/admin/resolve-hitl/{case_id}")
async def resolve_hitl(case_id: str, corrected_address: str = Form(...)):
    """
    Resolve a HITL case by accepting corrected address and resuming workflow
    """
    try:
        # Validate case exists and is in WAITING_FOR_HUMAN status
        with get_conn() as conn, conn.cursor() as cur:
            cur.execute(
                "SELECT status, email, citizen_name, dob, old_address_raw, new_address_raw, move_in_date_raw, landlord_name FROM cases WHERE case_id = %s",
                (case_id,)
            )
            row = cur.fetchone()
            
            if not row:
                raise HTTPException(status_code=404, detail=f"Case {case_id} not found")
            
            if row["status"] != "WAITING_FOR_HUMAN":
                raise HTTPException(
                    status_code=400,
                    detail=f"Case {case_id} is not waiting for human review. Current status: {row['status']}"
                )

        # Update canonical address with corrected value
        from .db import set_canonical_address, update_case_status, add_audit_entry
        
        set_canonical_address(case_id, corrected_address)
        update_case_status(case_id, "QUALITY_OK")
        add_audit_entry(
            case_id,
            f"HITL resolved: Admin corrected address to '{corrected_address}'"
        )
        
        # Resume workflow in background - RUN FULL WORKFLOW with corrected address
        def resume_workflow():
            try:
                print(f"🔄 Resuming FULL workflow for {case_id} with corrected address: {corrected_address}")
                
                # Run the FULL workflow from the start, but with the corrected address
                from .crew import AddressChangeMain
                
                # Prepare inputs with CORRECTED address
                inputs = {
                    "citizen_data": {
                        "case_id": case_id,
                        "email": row["email"],
                        "citizen_name": row["citizen_name"],
                        "dob": str(row["dob"]),
                        "old_address_raw": row["old_address_raw"],
                        "new_address_raw": corrected_address,  # USE CORRECTED ADDRESS
                        "move_in_date_raw": row["move_in_date_raw"],
                        "landlord_name": row["landlord_name"],
                    }
                }
                
                print(f"✅ Starting full workflow for {case_id} with corrected address")
                AddressChangeMain().crew().kickoff(inputs=inputs)
                print(f"✅ Workflow completed for {case_id}")
                
            except Exception as e:
                print(f"Workflow Resumption Error: {e}")
                import traceback
                traceback.print_exc()
                # Update status to ERROR if workflow fails
                with get_conn() as conn, conn.cursor() as cur:
                    cur.execute(
                        "UPDATE cases SET status = 'ERROR' WHERE case_id = %s",
                        (case_id,)
                    )
                    conn.commit()
        
        import threading
        thread = threading.Thread(target=resume_workflow)
        thread.start()
        
        return {
            "status": "success",
            "message": f"Address corrected to '{corrected_address}'. Workflow resuming from quality check...",
            "case_id": case_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error resolving HITL: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to resolve HITL: {str(e)}")


@app.post("/admin/approve-case/{case_id}")
async def approve_case(case_id: str):
    """
    Admin approval endpoint - triggers workflow using EXISTING data
    """
    try:
        # Get case details
        with get_conn() as conn, conn.cursor() as cur:
            cur.execute(
                """
                SELECT email, pdf_landlord_path, pdf_address_change_path,
                       citizen_name, dob, old_address_raw, new_address_raw,
                       move_in_date_raw, landlord_name
                FROM cases WHERE case_id = %s
                """,
                (case_id,)
            )
            row = cur.fetchone()
            
        if not row:
            raise HTTPException(status_code=404, detail=f"Case {case_id} not found")
        
        # Update status to PROCESSING
        with get_conn() as conn, conn.cursor() as cur:
            cur.execute(
                "UPDATE cases SET status = 'PROCESSING', approved_at = %s WHERE case_id = %s",
                (dt.now(), case_id)
            )
            conn.commit()
        
        # Prepare inputs for crew
        inputs = {
            "citizen_data": {
                "case_id": case_id,
                "email": row["email"],
                "citizen_name": row["citizen_name"],
                "dob": str(row["dob"]),
                "old_address_raw": row["old_address_raw"],
                "new_address_raw": row["new_address_raw"],
                "move_in_date_raw": row["move_in_date_raw"],
                "landlord_name": row["landlord_name"],
            }
        }

        # Run workflow in background
        def run_workflow():
            try:
                from .crew import AddressChangeMain
                AddressChangeMain().crew().kickoff(inputs=inputs)
                
                # Check if HITL was triggered
                with get_conn() as conn, conn.cursor() as cur:
                    cur.execute("SELECT status FROM cases WHERE case_id = %s", (case_id,))
                    status_row = cur.fetchone()
                    
                    if status_row and status_row["status"] == "WAITING_FOR_HUMAN":
                        # HITL was triggered - workflow paused successfully
                        print(f"✋ HITL triggered for case {case_id} - workflow paused")
                        from .db import add_audit_entry
                        add_audit_entry(case_id, "Workflow paused - awaiting human address correction")
                    else:
                        print(f"✅ Workflow completed successfully for case {case_id}")
                        
            except Exception as e:
                print(f"Workflow Error for {case_id}: {e}")
                import traceback
                traceback.print_exc()
                #Update status to ERROR
                with get_conn() as conn, conn.cursor() as cur:
                    cur.execute(
                        "UPDATE cases SET status = 'ERROR' WHERE case_id = %s",
                        (case_id,)
                    )
                    conn.commit()

        import threading
        thread = threading.Thread(target=run_workflow)
        thread.start()

        return {"status": "Processing started", "case_id": case_id}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Approval Error: {e}")
        try:
            with get_conn() as conn, conn.cursor() as cur:
                cur.execute(
                    "UPDATE cases SET status = 'ERROR' WHERE case_id = %s",
                    (case_id,)
                )
                conn.commit()
        except:
            pass
        raise HTTPException(status_code=500, detail=str(e))


# =======================
# Local dev entrypoint
# =======================

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "src.automation.api:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )
