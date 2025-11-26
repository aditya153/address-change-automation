# src/automation/db.py
import os
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime

DB_DSN = os.getenv("DATABASE_URL", "postgresql://app_user:app_pass@db:5432/address_db")

def get_conn():
    return psycopg2.connect(DB_DSN, cursor_factory=RealDictCursor)

def normalize_case_id(case_id: str) -> str:
    """
    Normalize case_id to ensure it's in the format 'Case ID: N'.
    
    Handles cases where agents might pass just the number (e.g., "11" instead of "Case ID: 11").
    
    Args:
        case_id: Either "Case ID: N" or just "N"
    
    Returns:
        Normalized case_id in format "Case ID: N"
    """
    case_id = case_id.strip()
    
    # If it already starts with "Case ID:", return as-is
    if case_id.startswith("Case ID:"):
        return case_id
    
    # If it's just a number, format it properly
    if case_id.isdigit():
        return f"Case ID: {case_id}"
    
    # If it looks like "Case ID N" (missing colon), add it
    if case_id.lower().startswith("case id"):
        parts = case_id.split()
        if len(parts) >= 3:
            return f"Case ID: {parts[-1]}"
    
    # Otherwise, return as-is and let the database handle it
    return case_id

def create_case(data: dict) -> str:
    """Insert a new case and return case_id like 'Case ID: 1'."""
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO cases (
                citizen_name, dob, email,
                old_address_raw, new_address_raw,
                move_in_date_raw, landlord_name,
                status
            )
            VALUES (%(citizen_name)s, %(dob)s, %(email)s,
                    %(old_address_raw)s, %(new_address_raw)s,
                    %(move_in_date_raw)s, %(landlord_name)s,
                    'INGESTED')
            RETURNING id;
            """,
            data,
        )
        row = cur.fetchone()
        numeric_id = row["id"]
        case_id = f"Case ID: {numeric_id}"

        # store human-readable case_id as well
        cur.execute(
            "UPDATE cases SET case_id = %s, updated_at = %s WHERE id = %s;",
            (case_id, datetime.utcnow(), numeric_id),
        )

    return case_id

def update_case_status(case_id: str, status: str):
    case_id = normalize_case_id(case_id)
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            "UPDATE cases SET status = %s, updated_at = %s WHERE case_id = %s;",
            (status, datetime.utcnow(), case_id),
        )

def set_canonical_address(case_id: str, canonical_address: str):
    case_id = normalize_case_id(case_id)
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            "UPDATE cases SET canonical_address = %s, updated_at = %s WHERE case_id = %s;",
            (canonical_address, datetime.utcnow(), case_id),
        )

def set_registry_exists(case_id: str, exists: bool):
    case_id = normalize_case_id(case_id)
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            "UPDATE cases SET registry_exists = %s, updated_at = %s WHERE case_id = %s;",
            (exists, datetime.utcnow(), case_id),
        )

def get_canonical_address(case_id: str) -> str:
    """Retrieve the canonical address for a given case."""
    case_id = normalize_case_id(case_id)
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT canonical_address FROM cases WHERE case_id = %s;",
            (case_id,),
        )
        row = cur.fetchone()
        return row["canonical_address"] if row else None

def fetch_case_by_id(case_id: str) -> dict:
    """
    Fetch complete case details by case_id.
    Returns a dictionary with all case fields, or None if not found.
    """
    case_id = normalize_case_id(case_id)
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT * FROM cases WHERE case_id = %s;",
            (case_id,),
        )
        row = cur.fetchone()
        return dict(row) if row else None

def add_audit_entry(case_id: str, message: str):
    case_id = normalize_case_id(case_id)
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO audit_logs (case_id, message)
            VALUES (%s, %s);
            """,
            (case_id, message),
        )

def get_audit_entries(case_id: str):
    case_id = normalize_case_id(case_id)
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT timestamp, message
            FROM audit_logs
            WHERE case_id = %s
            ORDER BY timestamp ASC;
            """,
            (case_id,),
        )
        rows = cur.fetchall()
    return rows
