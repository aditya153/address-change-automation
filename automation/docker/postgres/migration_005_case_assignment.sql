-- Migration 005: Add assigned_to column for case assignment to employees
-- This enables random case distribution to employees

-- Add assigned_to column to cases table
ALTER TABLE cases ADD COLUMN IF NOT EXISTS assigned_to INTEGER REFERENCES users(id);

-- Add index for fast lookups by assigned employee
CREATE INDEX IF NOT EXISTS idx_cases_assigned_to ON cases(assigned_to);

-- Add assigned_at timestamp to track when case was assigned
ALTER TABLE cases ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;
