# src/automation/api.py

from datetime import date, datetime
from typing import Any, Dict, List, Optional
import asyncio

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr

from .main import run_address_change_workflow
from .db import get_audit_entries, get_conn
from .document_validator import validate_case_data
from .ocr_service import extract_text_from_pdf


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

# CORS – configure for production and development
# CORS – configure for production and development
import os

# Default to known Vercel URL and Localhost
DEFAULT_ORIGINS = "http://localhost:5173,http://localhost:3000"
raw_frontend_url = os.getenv("FRONTEND_URL", DEFAULT_ORIGINS)

# Explicitly listed origins for production and dev
# This is safer and more reliable than wildcards or regex for credentials
allowed_origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "https://address-change-automation.vercel.app",
    "https://address-change-automation.vercel.app/" 
]

# Just in case FRONTEND_URL is set in backend env, add it too
if raw_frontend_url and raw_frontend_url != DEFAULT_ORIGINS:
    for origin in raw_frontend_url.split(","):
        clean = origin.strip().rstrip("/")
        if clean and clean not in allowed_origins:
            allowed_origins.append(clean)
            allowed_origins.append(f"{clean}/") 

print(f"🚀 CORS Configured. Allowed origins: {allowed_origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True, # Essential for cookies/auth headers
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    """Diagnostic endpoint to verify CORS and backend status."""
    return {
        "status": "healthy",
        "frontend_url": os.getenv("FRONTEND_URL"),
        "allowed_origins": allowed_origins,
        "vercel_regex": ALLOWED_ORIGIN_REGEX
    }


# =======================
# LOG STREAMING SETUP
# =======================
from .log_manager import log_manager
from fastapi.responses import StreamingResponse

@app.on_event("startup")
async def startup_event():
    import asyncio
    # Start the log broadcaster in the background
    asyncio.create_task(log_manager.stream_logs_to_clients())

@app.get("/stream-logs")
async def stream_logs():
    """
    Server-Sent Events (SSE) endpoint for real-time logs.
    """
    queue = await log_manager.connect()
    
    async def event_generator():
        try:
            while True:
                # Wait for new log message
                data = await queue.get()
                yield data
        except asyncio.CancelledError:
            log_manager.disconnect(queue)
            
    return StreamingResponse(event_generator(), media_type="text/event-stream")


# =======================
# Routes
# =======================

@app.get("/health")
def health_check() -> Dict[str, str]:
    """
    Simple health endpoint to check that the backend is running.
    """
    return {"status": "ok", "service": "address-change-backend"}


# =======================
# AUTHENTICATION ENDPOINTS
# =======================

from fastapi import Header, Depends
from .auth import (
    verify_google_token, 
    get_or_create_user, 
    create_jwt_token, 
    verify_jwt_token,
    get_user_from_token
)

class GoogleLoginRequest(BaseModel):
    """Request body for Google login."""
    credential: str  # Google ID token


class LoginResponse(BaseModel):
    """Response for successful login."""
    success: bool
    token: str
    user: Dict[str, Any]


def get_current_user(authorization: str = Header(None)) -> Optional[Dict]:
    """Dependency to get current user from JWT token."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.replace("Bearer ", "")
    return get_user_from_token(token)


def require_auth(authorization: str = Header(...)) -> Dict:
    """Dependency that requires authentication."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    token = authorization.replace("Bearer ", "")
    user = get_user_from_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return user


def require_admin(user: Dict = Depends(require_auth)) -> Dict:
    """Dependency that requires admin role."""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


@app.post("/auth/google")
async def google_login(request: GoogleLoginRequest):
    """
    Authenticate user with Google OAuth token.
    
    1. Receives Google ID token from frontend
    2. Verifies token with Google
    3. Creates or updates user in database
    4. Returns JWT session token
    """
    # Verify Google token
    google_user = verify_google_token(request.credential)
    
    if not google_user:
        raise HTTPException(status_code=401, detail="Invalid Google token")
    
    # Get or create user in database
    user = get_or_create_user(
        email=google_user["email"],
        name=google_user["name"],
        picture=google_user["picture"],
        google_id=google_user["google_id"]
    )
    
    # Create JWT token
    token = create_jwt_token(user)
    
    return {
        "success": True,
        "token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "picture": user.get("picture"),
            "role": user["role"]
        }
    }


@app.get("/auth/me")
async def get_current_user_info(user: Dict = Depends(require_auth)):
    """Get current authenticated user info."""
    return {
        "id": user["id"],
        "email": user["email"],
        "name": user["name"],
        "picture": user.get("picture"),
        "role": user["role"]
    }


@app.post("/auth/logout")
async def logout():
    """
    Logout endpoint.
    Since we use stateless JWTs, logout is handled client-side by deleting the token.
    This endpoint is provided for completeness.
    """
    return {"success": True, "message": "Logged out successfully"}


@app.post("/auth/set-admin")
async def set_user_as_admin(email: str, user: Dict = Depends(require_admin)):
    """
    Admin-only endpoint to promote a user to admin role.
    """
    from .db import get_conn
    
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            "UPDATE users SET role = 'admin' WHERE email = %s RETURNING id, email, role;",
            (email,)
        )
        updated = cur.fetchone()
        
    if not updated:
        raise HTTPException(status_code=404, detail=f"User not found: {email}")
    
    return {"success": True, "user": dict(updated)}


@app.get("/admin/users")
async def get_all_users_admin(user: Dict = Depends(require_admin)):
    """
    Admin-only endpoint to list all users.
    """
    from .auth import get_all_users
    users = get_all_users()
    return {"users": users}


class UserInviteRequest(BaseModel):
    email: EmailStr
    name: str
    role: str = "admin"


@app.post("/admin/users/invite")
async def invite_user_admin(payload: UserInviteRequest, user: Dict = Depends(require_admin)):
    """
    Admin-only endpoint to pre-authorize a new user.
    """
    from .auth import invite_user
    try:
        invited_user = invite_user(
            email=payload.email,
            name=payload.name,
            role=payload.role
        )
        return {"success": True, "user": invited_user}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class UpdateRoleRequest(BaseModel):
    role: str

@app.put("/admin/users/{user_id}/role")
async def update_user_role_admin(user_id: int, payload: UpdateRoleRequest, user: Dict = Depends(require_admin)):
    """
    Admin-only endpoint to update a user's role.
    """
    if payload.role not in ["admin", "user"]:
        raise HTTPException(status_code=400, detail="Invalid role")
        
    from .auth import update_user_role
    updated_user = update_user_role(user_id, payload.role)
    
    if not updated_user:
        raise HTTPException(status_code=404, detail=f"User {user_id} not found")
        
    return {"success": True, "user": updated_user}


@app.delete("/admin/users/{user_id}")
async def delete_user_admin(user_id: int, user: Dict = Depends(require_admin)):
    """
    Admin-only endpoint to delete a user.
    Prevents admins from deleting themselves.
    """
    from .auth import delete_user
    
    # Self-deletion protection
    if user_id == user.get("id"):
        raise HTTPException(status_code=400, detail="You cannot delete your own account")
        
    success = delete_user(user_id)
    if not success:
        raise HTTPException(status_code=404, detail="User not found")
        
    return {"success": True, "message": "User deleted successfully"}


# =======================
# CASE ASSIGNMENT ENDPOINTS
# =======================

@app.get("/admin/my-cases")
async def get_my_cases(user: Dict = Depends(require_auth)):
    """
    Get cases assigned to the current user.
    """
    from .auth import get_cases_for_employee
    
    user_id = user.get("id")
    if not user_id:
        raise HTTPException(status_code=400, detail="Invalid user")
    
    cases = get_cases_for_employee(user_id)
    
    # Format dates for JSON
    for case in cases:
        if case.get("submitted_at"):
            case["submitted_at"] = case["submitted_at"].isoformat()
        if case.get("created_at"):
            case["created_at"] = case["created_at"].isoformat()
        if case.get("assigned_at"):
            case["assigned_at"] = case["assigned_at"].isoformat()
    
    return {"cases": cases, "count": len(cases)}


@app.put("/admin/cases/{case_id}/assign")
async def assign_case(case_id: str, employee_id: int, user: Dict = Depends(require_admin)):
    """
    Admin-only endpoint to manually assign a case to an employee.
    """
    from .auth import assign_case_to_employee, get_user_by_email
    
    success = assign_case_to_employee(case_id, employee_id)
    if not success:
        raise HTTPException(status_code=404, detail="Case not found")
    
    return {"success": True, "message": f"Case {case_id} assigned to employee {employee_id}"}


# =======================
# ANALYTICS ENDPOINTS
# =======================

@app.get("/admin/analytics/kpis")
async def get_analytics_kpis(user: Dict = Depends(require_admin)):
    """
    Get key performance indicators for the dashboard.
    """
    with get_conn() as conn, conn.cursor() as cur:
        # Total cases
        cur.execute("SELECT COUNT(*) as total FROM cases;")
        total_cases = cur.fetchone()["total"]
        
        # Cases by status
        cur.execute("""
            SELECT status, COUNT(*) as count 
            FROM cases 
            GROUP BY status;
        """)
        status_counts = {row["status"]: row["count"] for row in cur.fetchall()}
        
        # Cases today
        cur.execute("""
            SELECT COUNT(*) as count 
            FROM cases 
            WHERE DATE(submitted_at) = CURRENT_DATE;
        """)
        cases_today = cur.fetchone()["count"]
        
        # Cases this week
        cur.execute("""
            SELECT COUNT(*) as count 
            FROM cases 
            WHERE submitted_at >= CURRENT_DATE - INTERVAL '7 days';
        """)
        cases_this_week = cur.fetchone()["count"]
        
        # Average processing time (for completed cases)
        cur.execute("""
            SELECT AVG(EXTRACT(EPOCH FROM (updated_at - submitted_at))) as avg_time
            FROM cases 
            WHERE status = 'CLOSED';
        """)
        avg_time_row = cur.fetchone()
        avg_processing_seconds = avg_time_row["avg_time"] if avg_time_row["avg_time"] else 0
        
        # Cases per employee (only admins, not regular users)
        cur.execute("""
            SELECT u.name, COUNT(c.id) as case_count
            FROM users u
            LEFT JOIN cases c ON u.id = c.assigned_to
            WHERE u.role = 'admin'
            GROUP BY u.id, u.name
            ORDER BY case_count DESC;
        """)
        cases_per_employee = [{"name": row["name"] or "Unassigned", "count": row["case_count"]} for row in cur.fetchall()]
        
    return {
        "total_cases": total_cases,
        "cases_today": cases_today,
        "cases_this_week": cases_this_week,
        "status_breakdown": status_counts,
        "avg_processing_seconds": round(avg_processing_seconds, 2),
        "cases_per_employee": cases_per_employee
    }


@app.get("/admin/analytics/comparison")
async def get_analytics_comparison(period: str = "week", user: Dict = Depends(require_admin)):
    """
    Compare metrics across time periods (this week vs last week, etc.).
    """
    with get_conn() as conn, conn.cursor() as cur:
        if period == "week":
            # This week
            cur.execute("""
                SELECT COUNT(*) as count 
                FROM cases 
                WHERE submitted_at >= CURRENT_DATE - INTERVAL '7 days';
            """)
            current_count = cur.fetchone()["count"]
            
            # Last week
            cur.execute("""
                SELECT COUNT(*) as count 
                FROM cases 
                WHERE submitted_at >= CURRENT_DATE - INTERVAL '14 days'
                AND submitted_at < CURRENT_DATE - INTERVAL '7 days';
            """)
            previous_count = cur.fetchone()["count"]
            
            label_current = "This Week"
            label_previous = "Last Week"
        else:
            # This month
            cur.execute("""
                SELECT COUNT(*) as count 
                FROM cases 
                WHERE submitted_at >= DATE_TRUNC('month', CURRENT_DATE);
            """)
            current_count = cur.fetchone()["count"]
            
            # Last month
            cur.execute("""
                SELECT COUNT(*) as count 
                FROM cases 
                WHERE submitted_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month'
                AND submitted_at < DATE_TRUNC('month', CURRENT_DATE);
            """)
            previous_count = cur.fetchone()["count"]
            
            label_current = "This Month"
            label_previous = "Last Month"
        
        # Calculate change percentage
        if previous_count > 0:
            change_percent = round(((current_count - previous_count) / previous_count) * 100, 1)
        else:
            change_percent = 100 if current_count > 0 else 0
    
    return {
        "period": period,
        "current": {"label": label_current, "count": current_count},
        "previous": {"label": label_previous, "count": previous_count},
        "change_percent": change_percent
    }


@app.get("/admin/reports/export")
async def export_reports(format: str = "csv", user: Dict = Depends(require_admin)):
    """
    Export case data as CSV or JSON.
    PDF export would require additional libraries.
    """
    from fastapi.responses import StreamingResponse
    import io
    import csv
    
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute("""
            SELECT c.case_id, c.citizen_name, c.email, c.status, 
                   c.old_address_raw, c.new_address_raw, 
                   c.submitted_at, c.updated_at,
                   u.name as assigned_to_name
            FROM cases c
            LEFT JOIN users u ON c.assigned_to = u.id
            ORDER BY c.submitted_at DESC;
        """)
        rows = cur.fetchall()
    
    if format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Header
        writer.writerow(["Case ID", "Citizen Name", "Email", "Status", 
                        "Old Address", "New Address", "Submitted At", 
                        "Updated At", "Assigned To"])
        
        # Data rows
        for row in rows:
            writer.writerow([
                row["case_id"],
                row["citizen_name"],
                row["email"],
                row["status"],
                row["old_address_raw"],
                row["new_address_raw"],
                row["submitted_at"].isoformat() if row["submitted_at"] else "",
                row["updated_at"].isoformat() if row["updated_at"] else "",
                row["assigned_to_name"] or "Unassigned"
            ])
        
        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=cases_report.csv"}
        )
    else:
        # JSON format
        data = []
        for row in rows:
            data.append({
                "case_id": row["case_id"],
                "citizen_name": row["citizen_name"],
                "email": row["email"],
                "status": row["status"],
                "old_address": row["old_address_raw"],
                "new_address": row["new_address_raw"],
                "submitted_at": row["submitted_at"].isoformat() if row["submitted_at"] else None,
                "assigned_to": row["assigned_to_name"] or "Unassigned"
            })
        return {"cases": data, "count": len(data)}


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


def pre_validate_case(citizen_data: dict) -> tuple:
    """
    Check if case has all required data and is clean enough for auto-processing.
    Returns (is_clean: bool, issues: list[str])
    """
    issues = []
    
    # Check required fields
    required_fields = ['citizen_name', 'dob', 'old_address_raw', 'new_address_raw', 'move_in_date_raw']
    for field in required_fields:
        value = citizen_data.get(field, '')
        if not value or value == 'Unknown' or value == '':
            issues.append(f"Missing or invalid {field}")
    
    # Check address quality (basic checks)
    new_addr = citizen_data.get('new_address_raw', '')
    if len(new_addr) < 10:
        issues.append("New address too short")
    if not any(c.isdigit() for c in new_addr):
        issues.append("New address missing house number or postal code")
    
    old_addr = citizen_data.get('old_address_raw', '')
    if len(old_addr) < 10:
        issues.append("Old address too short")
    
    # Check citizen name
    name = citizen_data.get('citizen_name', '')
    if len(name) < 3 or name in ['Unknown', 'OCR Fallback User']:
        issues.append("Invalid citizen name")
    
    is_clean = len(issues) == 0
    return (is_clean, issues)


@app.post("/submit-case")
async def submit_case(
    email: str =Form(...),
    landlord_pdf: UploadFile = File(...),
    address_pdf: UploadFile = File(...),
    source: str = Form("portal")  # 'portal' (default) or 'email'
):
    """
    User submission endpoint - accepts email and 2 PDFs
    Clean cases auto-process, problematic cases go to PENDING_REVIEW
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
        
        # Extract OCR text for validation
        print(f"Extracting OCR text for validation...")
        landlord_text = extract_text_from_pdf(str(landlord_path))
        address_text = extract_text_from_pdf(str(address_path))
        
        # Run OCR + GPT parsing
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

        # DOCUMENT VALIDATION - Check if documents are valid before creating case
        print(f"🔍 Validating documents...")
        validation_result = validate_case_data(landlord_text, address_text, citizen_data)
        
        if not validation_result.get("valid"):
            # Documents are invalid - reject immediately
            error_messages = validation_result.get("errors", ["Documents could not be validated"])
            print(f"❌ Document validation failed: {error_messages}")
            
            # Send rejection email to the user
            try:
                import smtplib
                from email.mime.text import MIMEText
                from email.mime.multipart import MIMEMultipart
                import os
                
                EMAIL_ADDRESS = os.getenv("EMAIL_ADDRESS")
                EMAIL_APP_PASSWORD = os.getenv("EMAIL_APP_PASSWORD")
                
                if EMAIL_ADDRESS and EMAIL_APP_PASSWORD:
                    msg = MIMEMultipart('alternative')
                    msg['Subject'] = 'Address Change Request - Documents Could Not Be Processed'
                    msg['From'] = EMAIL_ADDRESS
                    msg['To'] = email
                    
                    # Create error list
                    error_list = "\n".join([f"• {err}" for err in error_messages])
                    
                    html_content = f"""
                    <html>
                    <body style="font-family: Arial, sans-serif; padding: 20px;">
                        <h2 style="color: #dc3545;">Documents Could Not Be Processed</h2>
                        <p>Dear Citizen,</p>
                        <p>Thank you for submitting your address change request.</p>
                        <p>Unfortunately, we could not process your documents because:</p>
                        <div style="background: #f8d7da; padding: 15px; border-radius: 5px; margin: 15px 0;">
                            <pre style="margin: 0; white-space: pre-wrap;">{error_list}</pre>
                        </div>
                        <h3>What documents do you need?</h3>
                        <ol>
                            <li><strong>Wohnungsgeberbestätigung</strong> (Landlord Confirmation)</li>
                            <li><strong>Meldebescheinigung</strong> (Address Registration Certificate)</li>
                        </ol>
                        <p>Please ensure both documents are valid German address change documents and resubmit.</p>
                        <p>If you need help, use our AI chatbot on the submission page.</p>
                        <hr>
                        <p style="color: #666; font-size: 12px;">Automated message from Address Change Automation System</p>
                    </body>
                    </html>
                    """
                    
                    msg.attach(MIMEText(html_content, 'html'))
                    
                    with smtplib.SMTP('smtp.gmail.com', 587, timeout=30) as smtp:
                        smtp.starttls()
                        smtp.login(EMAIL_ADDRESS, EMAIL_APP_PASSWORD)
                        smtp.sendmail(EMAIL_ADDRESS, email, msg.as_string())
                    
                    print(f"✅ Rejection email sent to {email}")
                else:
                    print("⚠️ Email credentials not configured, skipping rejection email")
                    
            except Exception as email_error:
                print(f"⚠️ Could not send rejection email: {email_error}")
            
            return JSONResponse(
                status_code=400,
                content={
                    "status": "error",
                    "message": "Invalid documents uploaded",
                    "errors": error_messages,
                    "help": "Please ensure you upload: 1) Wohnungsgeberbestätigung (Landlord Confirmation) and 2) Anmeldeformular (Address Registration Form). Use the chatbot for assistance."
                }
            )
        
        print(f"✅ Documents validated successfully")
        
        # Pre-validate case to determine if it can auto-process
        is_clean, validation_issues = pre_validate_case(citizen_data)
        
        if is_clean:
            initial_status = "PROCESSING"
            print(f"✅ Clean case detected - will auto-process")
        else:
            initial_status = "PENDING_REVIEW"
            print(f"⚠️ Case needs review. Issues: {validation_issues}")

        # Create case in database
        from .db import get_conn
        case_id = None
        
        with get_conn() as conn:
            with conn.cursor() as cur:
                # Get next case ID
                cur.execute("SELECT COALESCE(MAX(id), 0) + 1 as new_id FROM cases")
                row = cur.fetchone()
                # RealDictCursor returns a dict, so we access by key 'new_id'
                next_id = row['new_id'] if row else 1
                case_id = f"Case ID: {next_id}"
                
                # Store validation issues as JSON string if any
                import json
                validation_notes = json.dumps(validation_issues) if validation_issues else None
                
                cur.execute(
                    """
                    INSERT INTO cases (
                        case_id, citizen_name, dob, email, 
                        old_address_raw, new_address_raw, move_in_date_raw,
                        landlord_name, status, source,
                        pdf_landlord_path, pdf_address_change_path,
                        submitted_at
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
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
                        initial_status,
                        source,  # Source from form parameter ('portal' or 'email')
                        str(landlord_path),
                        str(address_path),
                        dt.now()
                    )
                )
        
        # Auto-process clean cases in background thread
        if is_clean and case_id:
            import threading
            
            def run_auto_workflow():
                try:
                    print(f"🚀 Auto-processing clean case {case_id}...")
                    
                    from .crew import AddressChangeMain
                    from .db import add_audit_entry
                    
                    # Add audit entry for auto-processing
                    add_audit_entry(case_id, "Case auto-processing started (clean case - no admin approval required)")
                    
                    inputs = {
                        "citizen_data": {
                            "case_id": case_id,
                            "email": email,
                            "citizen_name": citizen_data.get("citizen_name"),
                            "dob": citizen_data.get("dob"),
                            "old_address_raw": citizen_data.get("old_address_raw"),
                            "new_address_raw": citizen_data.get("new_address_raw"),
                            "move_in_date_raw": citizen_data.get("move_in_date_raw"),
                            "landlord_name": citizen_data.get("landlord_name"),
                        }
                    }
                    
                    AddressChangeMain().crew().kickoff(inputs=inputs)
                    
                    # Check final status
                    with get_conn() as conn, conn.cursor() as cur:
                        cur.execute("SELECT status FROM cases WHERE case_id = %s", (case_id,))
                        status_row = cur.fetchone()
                        
                        if status_row and status_row["status"] == "WAITING_FOR_HUMAN":
                            print(f"✋ HITL triggered for auto-processed case {case_id}")
                            add_audit_entry(case_id, "Low confidence detected during auto-processing - requires human review")
                        elif status_row and status_row["status"] == "CLOSED":
                            print(f"✅ Auto-processing completed successfully for {case_id}")
                            add_audit_entry(case_id, "Case auto-processed and completed successfully")
                        else:
                            print(f"✅ Workflow completed for {case_id}")
                            
                except Exception as e:
                    print(f"Auto-processing Error for {case_id}: {e}")
                    import traceback
                    traceback.print_exc()
                    # Update status to ERROR
                    with get_conn() as conn, conn.cursor() as cur:
                        cur.execute(
                            "UPDATE cases SET status = 'ERROR' WHERE case_id = %s",
                            (case_id,)
                        )
                        conn.commit()
            
            # Start workflow in background
            thread = threading.Thread(target=run_auto_workflow)
            thread.start()
        
        # Return response
        if is_clean:
            message = "Your request has been submitted and is being processed automatically! You will receive an email shortly."
        else:
            message = "Your request has been submitted and is pending review. An administrator will process it soon."
        
        return JSONResponse({
            "status": "success",
            "message": message,
            "email": email,
            "auto_processing": is_clean,
            "extracted_data": citizen_data
        })
        
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"SUBMISSION ERROR: {error_details}")
        raise HTTPException(status_code=500, detail=f"Submission error: {str(e) if str(e) else 'Unknown error - check logs'}")


@app.get("/admin/pending-cases")
async def get_pending_cases():
    """
    Admin endpoint - list all cases needing review (PENDING_REVIEW status)
    """
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT case_id, email, submitted_at, status, 
                   pdf_landlord_path, pdf_address_change_path,
                   citizen_name, new_address_raw
            FROM cases 
            WHERE status = 'PENDING_REVIEW'
            ORDER BY submitted_at DESC
            """
        )
        rows = cur.fetchall()
        
    return {"cases": rows}


@app.get("/admin/processing-cases")
async def get_processing_cases():
    """
    Admin endpoint - list all cases currently being auto-processed
    """
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT case_id, email, submitted_at, status,
                   pdf_landlord_path, pdf_address_change_path,
                   citizen_name, new_address_raw
            FROM cases
            WHERE status = 'PROCESSING'
            ORDER BY submitted_at DESC
            """
        )
        rows = cur.fetchall()
    return {"cases": rows}


@app.get("/admin/completed-cases")
async def get_completed_cases():
    """
    Admin endpoint - list all completed (CLOSED) cases including auto-processed ones.
    """
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT case_id, email, submitted_at, status,
                   pdf_landlord_path, pdf_address_change_path,
                   citizen_name, old_address_raw, new_address_raw, canonical_address,
                   landlord_name, move_in_date_raw, registry_exists, dob, ai_analysis
            FROM cases
            WHERE status = 'CLOSED'
            ORDER BY submitted_at DESC
            """
        )
        rows = cur.fetchall()
    return {"cases": rows}


@app.get("/admin/analytics")
async def get_analytics(period: str = "week"):
    """
    Admin endpoint - get aggregated analytics for the dashboard.
    Returns real statistics based on case data, filtered by period.
    
    Args:
        period: 'week' or 'month' - filters all data by the selected period
    """
    # Define the date filter based on period
    if period == "month":
        date_filter = "submitted_at >= DATE_TRUNC('month', CURRENT_DATE)"
        date_filter_closed = "updated_at >= DATE_TRUNC('month', CURRENT_DATE)"
    else:  # week (default)
        date_filter = "submitted_at >= CURRENT_DATE - INTERVAL '7 days'"
        date_filter_closed = "updated_at >= CURRENT_DATE - INTERVAL '7 days'"
    
    with get_conn() as conn, conn.cursor() as cur:
        # Total cases count (all time)
        cur.execute("SELECT COUNT(*) as total FROM cases;")
        total_cases = cur.fetchone()["total"]
        
        # Cases this period
        cur.execute(f"""
            SELECT COUNT(*) as count
            FROM cases
            WHERE {date_filter};
        """)
        cases_this_period = cur.fetchone()["count"]
        
        # Source breakdown (portal vs email) - FILTERED BY PERIOD
        cur.execute(f"""
            SELECT 
                COALESCE(source, 'portal') as source,
                COUNT(*) as count 
            FROM cases 
            WHERE {date_filter}
            GROUP BY COALESCE(source, 'portal');
        """)
        source_breakdown = {row["source"]: row["count"] for row in cur.fetchall()}
        
        # HITL breakdown - FILTERED BY PERIOD
        cur.execute(f"""
            SELECT 
                COALESCE(had_hitl, FALSE) as had_hitl,
                COUNT(*) as count 
            FROM cases 
            WHERE status = 'CLOSED' AND {date_filter_closed}
            GROUP BY COALESCE(had_hitl, FALSE);
        """)
        hitl_breakdown = {}
        for row in cur.fetchall():
            key = "manual" if row["had_hitl"] else "auto"
            hitl_breakdown[key] = row["count"]
        
        # Status breakdown - FILTERED BY PERIOD
        cur.execute(f"""
            SELECT status, COUNT(*) as count 
            FROM cases 
            WHERE {date_filter}
            GROUP BY status;
        """)
        status_breakdown = {row["status"]: row["count"] for row in cur.fetchall()}
        
        # Learned patterns count (all time)
        cur.execute("SELECT COUNT(*) as total FROM case_resolutions;")
        learned_patterns = cur.fetchone()["total"]
        
        # Average processing time for completed cases in this period (in minutes)
        cur.execute(f"""
            SELECT AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 60) as avg_minutes
            FROM cases
            WHERE status = 'CLOSED' AND {date_filter_closed};
        """)
        avg_time_row = cur.fetchone()
        avg_processing_time = round(avg_time_row["avg_minutes"] or 0, 1)
        
        # Cases this week (for backward compatibility)
        cur.execute("""
            SELECT COUNT(*) as count
            FROM cases
            WHERE submitted_at >= CURRENT_DATE - INTERVAL '7 days';
        """)
        cases_this_week = cur.fetchone()["count"]
        
        # Cases this month
        cur.execute("""
            SELECT COUNT(*) as count
            FROM cases
            WHERE submitted_at >= DATE_TRUNC('month', CURRENT_DATE);
        """)
        cases_this_month = cur.fetchone()["count"]
        
    # Calculate automation rate
    auto_count = hitl_breakdown.get("auto", 0)
    manual_count = hitl_breakdown.get("manual", 0)
    completed_total = auto_count + manual_count
    automation_rate = round((auto_count / max(completed_total, 1)) * 100)
    
    return {
        "total_cases": total_cases,
        "cases_this_period": cases_this_period,
        "cases_this_week": cases_this_week,
        "cases_this_month": cases_this_month,
        "source_breakdown": source_breakdown,
        "hitl_breakdown": hitl_breakdown,
        "status_breakdown": status_breakdown,
        "automation_rate": automation_rate,
        "avg_processing_time_minutes": avg_processing_time,
        "learned_patterns": learned_patterns,
        "period": period,
    }



@app.get("/admin/learned-patterns")
async def get_learned_patterns():
    """
    Get all learned patterns from the memory system (case_resolutions table).
    """
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute("""
            SELECT original_pattern, corrected_value, resolution_type, frequency, last_used_at
            FROM case_resolutions
            ORDER BY frequency DESC, last_used_at DESC
            LIMIT 50;
        """)
        rows = cur.fetchall()
    
    patterns = [
        {
            "original": row["original_pattern"],
            "corrected": row["corrected_value"],
            "type": row["resolution_type"],
            "frequency": row["frequency"],
            "last_used": row["last_used_at"].isoformat() if row["last_used_at"] else None
        }
        for row in rows
    ]
    
    return {"patterns": patterns}


@app.get("/admin/hitl-cases")
def get_hitl_cases():
    """
    Get all cases that need human review (WAITING_FOR_HUMAN status)
    """
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT case_id, email, citizen_name, new_address_raw, canonical_address,
                   submitted_at, updated_at, status
            FROM cases
            WHERE status = 'WAITING_FOR_HUMAN'
            ORDER BY submitted_at DESC
            """
        )
        rows = cur.fetchall()
    return {"cases": rows}


@app.get("/case/{case_id}/ai-analysis")
async def get_ai_analysis(case_id: str):
    """
    Get AI-powered analysis and correction suggestions for a HITL case.
    Uses OpenAI GPT to analyze extracted data, explain errors, and suggest corrections.
    """
    import openai
    import os
    
    # Fetch case data
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT case_id, citizen_name, dob, email, 
                   old_address_raw, new_address_raw, move_in_date_raw,
                   landlord_name, status, submitted_at
            FROM cases
            WHERE case_id = %s
            """,
            (case_id,)
        )
        row = cur.fetchone()
    
    if not row:
        raise HTTPException(status_code=404, detail=f"Case {case_id} not found")
    
    # Prepare data for analysis
    case_data = {
        "citizen_name": row["citizen_name"],
        "dob": str(row["dob"]) if row["dob"] else None,
        "email": row["email"],
        "old_address": row["old_address_raw"],
        "new_address": row["new_address_raw"],
        "move_in_date": row["move_in_date_raw"],
        "landlord_name": row["landlord_name"]
    }
    
    # Use GPT to analyze and suggest corrections
    try:
        client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        
        prompt = f"""You are an expert German address validation assistant for a government registration office.

Analyze this address change case data and:
1. Identify what is wrong, incomplete, or incorrectly formatted
2. Explain why this case requires human review
3. Suggest the corrected address in proper German format

Case Data:
- Citizen Name: {case_data.get('citizen_name', 'Unknown')}
- Date of Birth: {case_data.get('dob', 'Unknown')}
- Old Address: {case_data.get('old_address', 'Unknown')}
- New Address: {case_data.get('new_address', 'Unknown')}
- Move-in Date: {case_data.get('move_in_date', 'Unknown')}
- Landlord Name: {case_data.get('landlord_name', 'Unknown')}

German address format should be: "Straßenname Hausnummer, PLZ Stadt, Deutschland"
Example: "Musterstraße 12A, 67655 Kaiserslautern, Deutschland"

Respond in this exact JSON format:
{{
    "error_explanation": "A clear explanation of what's wrong with the data (1-2 sentences)",
    "issues_found": ["list", "of", "specific", "issues"],
    "original_address": "the original new address from the case",
    "suggested_address": "the corrected address in proper German format",
    "confidence": "high/medium/low",
    "additional_notes": "any other observations or recommendations"
}}

IMPORTANT: 
- If postal code looks wrong (e.g., 12345), try to identify the correct one based on the city name
- Common German postal codes: Kaiserslautern (67655-67663), Berlin (10115-14199), Munich (80331-81929)
- Abbreviations to fix: Str→Straße, KL→Kaiserslautern, Muc→München, Ffm→Frankfurt am Main
- If data is marked as "Unknown", note it as an issue
"""

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a German address validation assistant. Always respond with valid JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=800
        )
        
        ai_response = response.choices[0].message.content.strip()
        
        # Parse the JSON response
        import json
        # Remove markdown code blocks if present
        if ai_response.startswith("```"):
            ai_response = ai_response.split("```")[1]
            if ai_response.startswith("json"):
                ai_response = ai_response[4:]
            ai_response = ai_response.strip()
        
        analysis = json.loads(ai_response)
        
        # Add case metadata
        analysis["case_id"] = case_id
        analysis["status"] = row["status"]
        analysis["submitted_at"] = str(row["submitted_at"])
        analysis["citizen_name"] = case_data.get("citizen_name")
        analysis["dob"] = case_data.get("dob")
        analysis["email"] = case_data.get("email")
        analysis["landlord_name"] = case_data.get("landlord_name")
        analysis["move_in_date"] = case_data.get("move_in_date")
        analysis["old_address"] = case_data.get("old_address")
        
        return analysis
        
    except Exception as e:
        # Fallback if AI fails
        print(f"AI Analysis Error: {e}")
        return {
            "case_id": case_id,
            "error_explanation": "Unable to perform AI analysis. Please review manually.",
            "issues_found": ["AI analysis unavailable"],
            "original_address": case_data.get("new_address", "Unknown"),
            "suggested_address": case_data.get("new_address", ""),
            "confidence": "low",
            "additional_notes": f"Error: {str(e)}",
            "status": row["status"],
            "submitted_at": str(row["submitted_at"]),
            "citizen_name": case_data.get("citizen_name"),
            "dob": case_data.get("dob"),
            "email": case_data.get("email"),
            "landlord_name": case_data.get("landlord_name"),
            "move_in_date": case_data.get("move_in_date"),
            "old_address": case_data.get("old_address")
        }


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
        from .db import set_canonical_address, update_case_status, add_audit_entry, store_resolution
        
        original_address = row["new_address_raw"]
        set_canonical_address(case_id, corrected_address)
        update_case_status(case_id, "QUALITY_OK")
        add_audit_entry(
            case_id,
            f"HITL resolved: Admin corrected address to '{corrected_address}'"
        )
        
        # ===== MEMORY SYSTEM: Automatic Diff-Based Learning =====
        # Compare original and corrected addresses, find differences, store automatically
        try:
            import re
            from difflib import SequenceMatcher
            
            def tokenize_address(address: str) -> list:
                """Split address into tokens (words, numbers, punctuation)."""
                # Remove common punctuation and split
                tokens = re.findall(r'[\w]+', address)
                return tokens
            
            def similarity(a: str, b: str) -> float:
                """Calculate string similarity ratio (0.0 to 1.0)."""
                return SequenceMatcher(None, a.lower(), b.lower()).ratio()
            
            def determine_pattern_type(original: str, corrected: str) -> str:
                """Determine the type of pattern based on content."""
                # City abbreviations: short uppercase → longer word
                if original.isupper() and len(original) <= 3 and len(corrected) > 3:
                    return "city_abbreviation"
                # Street abbreviations: ends in 'str' → ends in 'straße/strasse'
                if original.lower().endswith('str') and ('straße' in corrected.lower() or 'strasse' in corrected.lower()):
                    return "street_abbreviation"
                # Postal/number patterns
                if original.isdigit() or corrected.isdigit():
                    return "number_correction"
                # Default
                return "word_correction"
            
            # Tokenize both addresses
            original_tokens = tokenize_address(original_address)
            corrected_tokens = tokenize_address(corrected_address)
            
            add_audit_entry(case_id, f"Comparing addresses - Original: {original_tokens}, Corrected: {corrected_tokens}")
            
            # Find matching pairs and differences
            used_corrected = set()
            patterns_learned = []
            
            for orig_token in original_tokens:
                best_match = None
                best_similarity = 0.0
                
                for i, corr_token in enumerate(corrected_tokens):
                    if i in used_corrected:
                        continue
                    
                    sim = similarity(orig_token, corr_token)
                    
                    # If tokens are similar but not identical, it's likely a correction
                    if sim > best_similarity:
                        best_similarity = sim
                        best_match = (i, corr_token)
                
                if best_match:
                    idx, corr_token = best_match
                    used_corrected.add(idx)
                    
                    # If tokens are different (not identical), store the pattern
                    if orig_token.lower() != corr_token.lower():
                        # Only store if there's meaningful similarity (not random word replacement)
                        # OR if it's a clear abbreviation expansion
                        is_abbreviation = len(orig_token) < len(corr_token) and best_similarity > 0.3
                        is_similar = best_similarity > 0.5
                        
                        # SPECIAL CASE: Very short tokens (2-3 chars) expanding to much longer words
                        # These are likely city abbreviations (KL→Kaiserslautern, FFM→Frankfurt)
                        # They have low string similarity but are valid abbreviations
                        is_short_abbreviation = (
                            len(orig_token) <= 3 and 
                            len(corr_token) >= 5 and 
                            orig_token.isupper()  # City abbreviations are usually uppercase
                        )
                        
                        if is_abbreviation or is_similar or is_short_abbreviation:
                            pattern_type = determine_pattern_type(orig_token, corr_token)
                            
                            # Skip numbers and very short tokens (but allow 2-char city abbreviations)
                            min_length = 2 if is_short_abbreviation else 2
                            if pattern_type != "number_correction" and len(orig_token) >= min_length:
                                store_resolution(orig_token, corr_token, pattern_type)
                                patterns_learned.append(f"'{orig_token}' → '{corr_token}' ({pattern_type})")
            
            # Log what was learned
            if patterns_learned:
                for pattern in patterns_learned:
                    add_audit_entry(case_id, f"Memory learned: {pattern}")
                add_audit_entry(case_id, f"Total patterns learned: {len(patterns_learned)}")
            else:
                add_audit_entry(case_id, "No new patterns to learn (addresses were similar)")
                
        except Exception as mem_error:
            print(f"Memory storage error (non-critical): {mem_error}")
            add_audit_entry(case_id, f"Memory learning error: {mem_error}")
            # Non-critical error - continue with workflow

        
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
# DOCUMENT PREVIEW ENDPOINT
# =======================

from fastapi.responses import FileResponse

@app.get("/uploads/{filename:path}")
async def get_uploaded_file(filename: str):
    """
    Serve uploaded PDF files for admin preview.
    """
    file_path = UPLOAD_DIR / filename
    
    # Security: ensure the file is within UPLOAD_DIR
    try:
        file_path = file_path.resolve()
        upload_dir_resolved = UPLOAD_DIR.resolve()
        if not str(file_path).startswith(str(upload_dir_resolved)):
            raise HTTPException(status_code=403, detail="Access denied")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid file path")
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    # Determine content type
    content_type = "application/pdf"
    if filename.lower().endswith(('.png', '.jpg', '.jpeg')):
        content_type = f"image/{filename.split('.')[-1].lower()}"
    
    return FileResponse(
        path=str(file_path),
        media_type=content_type,
        headers={"Content-Disposition": f"inline; filename={file_path.name}"}
    )


# =======================
# CHATBOT ENDPOINT
# =======================

from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel as PydanticBaseModel

# Mount static files for document previews
STATIC_DIR = Path("/app/static")
STATIC_DIR.mkdir(exist_ok=True)
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


class ChatRequest(PydanticBaseModel):
    message: str


class ChatResponse(PydanticBaseModel):
    reply: str
    has_document_preview: bool = False
    document_type: Optional[str] = None
    document_name: Optional[str] = None
    document_url: Optional[str] = None
    document_url2: Optional[str] = None


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Chatbot endpoint - uses OpenAI to answer address change questions.
    Can also return document previews when asked.
    """
    try:
        from .chatbot_service import get_chatbot
        
        chatbot = get_chatbot()
        response = chatbot.get_response(request.message)
        
        return ChatResponse(
            reply=response["reply"],
            has_document_preview=response.get("has_document_preview", False),
            document_type=response.get("document_type"),
            document_name=response.get("document_name"),
            document_url=response.get("document_url"),
            document_url2=response.get("document_url2")
        )
    except Exception as e:
        print(f"Chat error: {e}")
        return ChatResponse(
            reply="I'm sorry, I'm having trouble right now. Please try again.",
            has_document_preview=False
        )


@app.post("/chat/reset")
async def reset_chat():
    """Reset the chatbot conversation history."""
    try:
        from .chatbot_service import get_chatbot
        chatbot = get_chatbot()
        chatbot.reset_conversation()
        return {"status": "ok", "message": "Conversation reset"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


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
