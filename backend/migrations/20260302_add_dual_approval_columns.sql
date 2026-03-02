-- Add separate HR and Admin approval tracking columns
ALTER TABLE assign_call ADD COLUMN IF NOT EXISTS ta_hr_approved BOOLEAN DEFAULT FALSE;
ALTER TABLE assign_call ADD COLUMN IF NOT EXISTS ta_admin_approved BOOLEAN DEFAULT FALSE;
ALTER TABLE assign_call ADD COLUMN IF NOT EXISTS ta_hr_approval_date TIMESTAMP;
ALTER TABLE assign_call ADD COLUMN IF NOT EXISTS ta_admin_approval_date TIMESTAMP;
ALTER TABLE assign_call ADD COLUMN IF NOT EXISTS ta_hr_approval_notes TEXT;
ALTER TABLE assign_call ADD COLUMN IF NOT EXISTS ta_admin_approval_notes TEXT;
ALTER TABLE assign_call ADD COLUMN IF NOT EXISTS ta_rejection_notes TEXT;
ALTER TABLE assign_call ADD COLUMN IF NOT EXISTS ta_rejected_by TEXT;
