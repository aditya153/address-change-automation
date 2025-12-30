CREATE TABLE IF NOT EXISTS cases (
    id                     SERIAL PRIMARY KEY,
    case_id                TEXT UNIQUE,          -- e.g. "Case ID: 1"
    citizen_name           TEXT NOT NULL,
    dob                    DATE NOT NULL,
    email                  TEXT NOT NULL,
    old_address_raw        TEXT NOT NULL,
    new_address_raw        TEXT NOT NULL,
    move_in_date_raw       TEXT NOT NULL,        -- keep as text for now, parse in tools
    landlord_name          TEXT,
    canonical_address      TEXT,                 -- from assess_quality
    registry_exists        BOOLEAN,              -- from verify_identity
    status                 TEXT NOT NULL,        -- "INGESTED", "WAITING_FOR_HUMAN", etc.
    source                 TEXT DEFAULT 'portal', -- 'portal' or 'email'
    had_hitl               BOOLEAN DEFAULT FALSE, -- whether case required human intervention
    pdf_landlord_path      TEXT,                 -- path to landlord confirmation PDF
    pdf_address_change_path TEXT,                -- path to address change PDF
    ai_analysis            TEXT,                 -- AI analysis result
    assigned_to            INTEGER,              -- employee user ID assigned to this case
    assigned_at            TIMESTAMPTZ,          -- when case was assigned
    submitted_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id         SERIAL PRIMARY KEY,
    case_id    TEXT NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
    timestamp  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    message    TEXT NOT NULL
);

-- Memory system: Store learned patterns from HITL corrections
CREATE TABLE IF NOT EXISTS case_resolutions (
    id               SERIAL PRIMARY KEY,
    original_pattern TEXT NOT NULL,
    corrected_value  TEXT NOT NULL,
    resolution_type  TEXT NOT NULL,  -- 'city_abbreviation', 'street_abbreviation', 'word_correction'
    frequency        INTEGER DEFAULT 1,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(original_pattern, resolution_type)
);

-- Index for fast pattern lookups
CREATE INDEX IF NOT EXISTS idx_case_resolutions_pattern ON case_resolutions(original_pattern);
CREATE INDEX IF NOT EXISTS idx_case_resolutions_type ON case_resolutions(resolution_type);

-- NO SEED DATA: System learns everything from HITL corrections
-- When admin corrects an address, the diff is automatically stored here
-- Next time a similar pattern appears, it will be auto-corrected without HITL

