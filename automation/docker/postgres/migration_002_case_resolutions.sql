-- Migration 002: Case Resolutions for Agent Memory System
-- Stores HITL corrections so agents can learn from past decisions
-- NO HARDCODED DATA - System learns purely from HITL corrections

CREATE TABLE IF NOT EXISTS case_resolutions (
    id                SERIAL PRIMARY KEY,
    original_pattern  TEXT NOT NULL,          -- e.g., "KL", "Str.", "67655 KL"
    corrected_value   TEXT NOT NULL,          -- e.g., "Kaiserslautern", "Straße"
    resolution_type   TEXT NOT NULL,          -- "city_abbreviation", "street_abbreviation", "full_address"
    frequency         INTEGER DEFAULT 1,      -- how often this correction was applied
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    last_used_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast pattern lookups
CREATE INDEX IF NOT EXISTS idx_resolutions_pattern ON case_resolutions(original_pattern);
CREATE INDEX IF NOT EXISTS idx_resolutions_type ON case_resolutions(resolution_type);

-- NO SEED DATA: The system learns everything from real HITL corrections
-- When an admin corrects an address, the diff is automatically stored here
-- Next time a similar pattern appears, it will be auto-corrected without HITL
