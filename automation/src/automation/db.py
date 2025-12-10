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


# ========================
# MEMORY SYSTEM FUNCTIONS
# ========================

def store_resolution(original_pattern: str, corrected_value: str, resolution_type: str) -> int:
    """
    Store a HITL correction for future reference.
    If the pattern already exists, update the corrected value and increment frequency.
    
    Args:
        original_pattern: The original text that needed correction (e.g., "KL")
        corrected_value: The corrected text (e.g., "Kaiserslautern")
        resolution_type: Type of correction ("city_abbreviation", "street_abbreviation", "full_address")
    
    Returns:
        The resolution ID
    """
    with get_conn() as conn, conn.cursor() as cur:
        # Check if pattern already exists
        cur.execute(
            """
            SELECT id, frequency FROM case_resolutions 
            WHERE original_pattern = %s AND resolution_type = %s;
            """,
            (original_pattern, resolution_type),
        )
        existing = cur.fetchone()
        
        if existing:
            # Update existing resolution
            cur.execute(
                """
                UPDATE case_resolutions 
                SET corrected_value = %s, frequency = frequency + 1, last_used_at = NOW()
                WHERE id = %s
                RETURNING id;
                """,
                (corrected_value, existing["id"]),
            )
            result_id = cur.fetchone()["id"]
        else:
            # Insert new resolution
            cur.execute(
                """
                INSERT INTO case_resolutions (original_pattern, corrected_value, resolution_type)
                VALUES (%s, %s, %s)
                RETURNING id;
                """,
                (original_pattern, corrected_value, resolution_type),
            )
            result_id = cur.fetchone()["id"]
        
        conn.commit()
        return result_id


def lookup_similar_resolution(pattern: str, resolution_type: str = None) -> dict:
    """
    Look up if we have a correction for a given pattern from past HITL resolutions.
    
    Args:
        pattern: The pattern to look up (e.g., "KL", "Str.")
        resolution_type: Optional filter by type
    
    Returns:
        Dictionary with corrected_value and confidence, or None if not found
    """
    with get_conn() as conn, conn.cursor() as cur:
        if resolution_type:
            cur.execute(
                """
                SELECT corrected_value, frequency, resolution_type
                FROM case_resolutions
                WHERE original_pattern ILIKE %s AND resolution_type = %s
                ORDER BY frequency DESC
                LIMIT 1;
                """,
                (pattern, resolution_type),
            )
        else:
            cur.execute(
                """
                SELECT corrected_value, frequency, resolution_type
                FROM case_resolutions
                WHERE original_pattern ILIKE %s
                ORDER BY frequency DESC
                LIMIT 1;
                """,
                (pattern,),
            )
        
        row = cur.fetchone()
        
        if row:
            # Calculate confidence based on frequency (more uses = higher confidence)
            frequency = row["frequency"]
            confidence = min(0.95, 0.6 + (frequency * 0.05))  # 0.6 base, +0.05 per use, max 0.95
            return {
                "corrected_value": row["corrected_value"],
                "frequency": frequency,
                "resolution_type": row["resolution_type"],
                "confidence": confidence
            }
        
        return None


def apply_learned_corrections(address: str) -> tuple:
    """
    Apply all known corrections to an address based on learned patterns.
    
    Args:
        address: The raw address to correct
    
    Returns:
        Tuple of (corrected_address, list_of_corrections_applied)
    """
    corrected = address
    corrections_applied = []
    
    with get_conn() as conn, conn.cursor() as cur:
        # Get all known patterns, ordered by pattern length (longest first to avoid partial matches)
        cur.execute(
            """
            SELECT original_pattern, corrected_value, resolution_type
            FROM case_resolutions
            ORDER BY LENGTH(original_pattern) DESC, frequency DESC;
            """
        )
        patterns = cur.fetchall()
    
    import re
    for pattern in patterns:
        original = pattern["original_pattern"]
        replacement = pattern["corrected_value"]
        
        # Use word boundary matching to avoid partial replacements
        regex_pattern = r'\b' + re.escape(original) + r'\b'
        
        if re.search(regex_pattern, corrected, re.IGNORECASE):
            corrected = re.sub(regex_pattern, replacement, corrected, flags=re.IGNORECASE)
            corrections_applied.append({
                "original": original,
                "corrected": replacement,
                "type": pattern["resolution_type"]
            })
            
            # Update last_used_at for this pattern
            with get_conn() as conn, conn.cursor() as cur:
                cur.execute(
                    "UPDATE case_resolutions SET last_used_at = NOW() WHERE original_pattern = %s;",
                    (original,),
                )
                conn.commit()
    
    return corrected, corrections_applied


def get_resolution_stats() -> dict:
    """
    Get statistics about the memory system.
    
    Returns:
        Dictionary with total patterns, most used patterns, etc.
    """
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) as total FROM case_resolutions;")
        total = cur.fetchone()["total"]
        
        cur.execute(
            """
            SELECT original_pattern, corrected_value, frequency 
            FROM case_resolutions 
            ORDER BY frequency DESC 
            LIMIT 5;
            """
        )
        top_patterns = cur.fetchall()
        
    return {
        "total_patterns": total,
        "top_patterns": [dict(p) for p in top_patterns]
    }

