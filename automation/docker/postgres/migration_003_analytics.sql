-- Migration: Add source and had_hitl tracking columns
-- This enables analytics on case submission sources and HITL intervention

-- Add source column to track where case came from (portal or email)
ALTER TABLE cases ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'portal';

-- Add had_hitl column to track if case required human intervention
ALTER TABLE cases ADD COLUMN IF NOT EXISTS had_hitl BOOLEAN DEFAULT FALSE;

-- Update existing cases: assume all existing completed cases were auto-processed
-- Cases with status 'WAITING_FOR_HUMAN' or 'HITL_RESOLVED' had HITL
UPDATE cases SET had_hitl = TRUE WHERE status IN ('WAITING_FOR_HUMAN', 'HITL_RESOLVED');
UPDATE cases SET had_hitl = FALSE WHERE status NOT IN ('WAITING_FOR_HUMAN', 'HITL_RESOLVED') AND had_hitl IS NULL;

-- Create index for analytics queries
CREATE INDEX IF NOT EXISTS idx_cases_source ON cases(source);
CREATE INDEX IF NOT EXISTS idx_cases_had_hitl ON cases(had_hitl);
