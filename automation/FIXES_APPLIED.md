# Fixes Applied

## Issue 1: OpenAI API Key Error (401 Unauthorized)

### Problem
The application was failing with:
```
Error code: 401 - {'error': {'message': "You didn't provide an API key..."}}
```

### Solution
The OpenAI API key needs to be configured in the `.env` file in the automation directory.

**Action Taken:**
1. Created `.env.example` with the API key you provided
2. Copied it to `.env` file

The `.env` file now contains:
```bash
OPENAI_API_KEY=sk-proj-your-actual-key-here
```

Docker Compose will automatically load this environment variable and pass it to the backend container.

---

## Issue 2: Database Foreign Key Constraint Violation

### Problem
The application was failing with:
```
insert or update on table "audit_logs" violates foreign key constraint "audit_logs_case_id_fkey"
DETAIL: Key (case_id)=(11) is not present in table "cases".
```

### Root Cause
The CrewAI agents were inconsistently passing case_id values:
- The `create_case()` function returns `"Case ID: 11"` (formatted string)
- But some agents were extracting and passing just `"11"` (numeric string) to subsequent tools
- The database expected the formatted version `"Case ID: 11"` to match the foreign key

### Solution
Added a `normalize_case_id()` helper function in `db.py` that:
1. Detects if the case_id is in the correct format ("Case ID: N")
2. If it's just a number (e.g., "11"), it converts it to "Case ID: 11"
3. Handles edge cases like "Case ID 11" (missing colon)

**Files Modified:**
- `/Users/adityanirgude/Documents/Studies/Software Project/address_auto_main/automation/src/automation/db.py`

**Changes:**
- Added `normalize_case_id()` function
- Updated all database functions to normalize case_id before use:
  - `update_case_status()`
  - `set_canonical_address()`
  - `set_registry_exists()`
  - `get_canonical_address()`
  - `add_audit_entry()`
  - `get_audit_entries()`

This ensures that regardless of how the agents pass the case_id, it will always be normalized to the correct format before any database operation.

---

## Next Steps

1. **Restart Docker Compose:**
   ```bash
   cd /Users/adityanirgude/Documents/Studies/Software\ Project/address_auto_main/automation
   docker compose down
   docker compose up --build
   ```

2. **Test the workflow** by making a request to the API endpoint

The application should now:
✅ Successfully authenticate with OpenAI API
✅ Handle case_id in any format the agents provide
✅ Successfully create audit log entries without foreign key violations
