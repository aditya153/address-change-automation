CREATE TABLE IF NOT EXISTS cases (
    id                SERIAL PRIMARY KEY,
    case_id           TEXT UNIQUE,          -- e.g. "Case ID: 1"
    citizen_name      TEXT NOT NULL,
    dob               DATE NOT NULL,
    email             TEXT NOT NULL,
    old_address_raw   TEXT NOT NULL,
    new_address_raw   TEXT NOT NULL,
    move_in_date_raw  TEXT NOT NULL,        -- keep as text for now, parse in tools
    landlord_name     TEXT,
    canonical_address TEXT,                 -- from assess_quality
    registry_exists   BOOLEAN,              -- from verify_identity
    status            TEXT NOT NULL,        -- "INGESTED", "WAITING_FOR_HUMAN", etc.
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id         SERIAL PRIMARY KEY,
    case_id    TEXT NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
    timestamp  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    message    TEXT NOT NULL
);
