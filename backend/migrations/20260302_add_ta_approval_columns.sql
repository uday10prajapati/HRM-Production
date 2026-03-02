-- Add TA approval tracking columns to assign_call table
ALTER TABLE assign_call ADD COLUMN IF NOT EXISTS ta_approval_notes TEXT;
ALTER TABLE assign_call ADD COLUMN IF NOT EXISTS ta_approval_date TIMESTAMP;
ALTER TABLE assign_call ADD COLUMN IF NOT EXISTS ta_approved_by TEXT;
