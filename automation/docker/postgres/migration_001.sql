-- Migration: Add columns for file upload and admin approval workflow
-- Run this manually or add to init.sql

ALTER TABLE cases 
ADD COLUMN IF NOT EXISTS pdf_landlord_path VARCHAR(500),
ADD COLUMN IF NOT EXISTS pdf_address_change_path VARCHAR(500),
ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS approved_by VARCHAR(100);

-- Update existing cases to have submitted_at = created_at
UPDATE cases SET submitted_at = created_at WHERE submitted_at IS NULL;

-- Add index for faster queries on status
CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
