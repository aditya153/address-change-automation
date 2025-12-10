-- Migration 002: Case Resolutions for Agent Memory System
-- Stores HITL corrections so agents can learn from past decisions

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

-- Common German address corrections (seed data)
INSERT INTO case_resolutions (original_pattern, corrected_value, resolution_type, frequency) VALUES
    -- City abbreviations
    ('KL', 'Kaiserslautern', 'city_abbreviation', 5),
    ('FFM', 'Frankfurt am Main', 'city_abbreviation', 5),
    ('M', 'München', 'city_abbreviation', 5),
    ('B', 'Berlin', 'city_abbreviation', 5),
    ('HH', 'Hamburg', 'city_abbreviation', 5),
    ('K', 'Köln', 'city_abbreviation', 5),
    ('D', 'Düsseldorf', 'city_abbreviation', 5),
    ('S', 'Stuttgart', 'city_abbreviation', 5),
    -- Street abbreviations with period
    ('Str.', 'Straße', 'street_abbreviation', 10),
    ('str.', 'straße', 'street_abbreviation', 10),
    ('Pl.', 'Platz', 'street_abbreviation', 5),
    ('Weg.', 'Weg', 'street_abbreviation', 5),
    -- Street abbreviations without period (common in OCR)
    ('str', 'straße', 'street_abbreviation', 10),
    ('Str', 'Straße', 'street_abbreviation', 10),
    ('strasse', 'straße', 'street_abbreviation', 10),
    ('Strasse', 'Straße', 'street_abbreviation', 10)
ON CONFLICT DO NOTHING;
