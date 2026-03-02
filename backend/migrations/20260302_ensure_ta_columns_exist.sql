-- Migration: Ensure all TA (Travel Allowance) columns exist
-- Purpose: Create missing TA-related columns for the approval workflow

BEGIN;

-- Add TA tracking columns (these may already exist)
ALTER TABLE assign_call ADD COLUMN IF NOT EXISTS ta_voucher_number TEXT;
ALTER TABLE assign_call ADD COLUMN IF NOT EXISTS ta_voucher_date DATE;
ALTER TABLE assign_call ADD COLUMN IF NOT EXISTS ta_call_type TEXT;
ALTER TABLE assign_call ADD COLUMN IF NOT EXISTS ta_travel_mode TEXT;
ALTER TABLE assign_call ADD COLUMN IF NOT EXISTS ta_status TEXT DEFAULT 'pending';
ALTER TABLE assign_call ADD COLUMN IF NOT EXISTS ta_receipt_url TEXT;
ALTER TABLE assign_call ADD COLUMN IF NOT EXISTS ta_revised_km NUMERIC;
ALTER TABLE assign_call ADD COLUMN IF NOT EXISTS ta_revised_places TEXT;

-- Add TA approval tracking columns
ALTER TABLE assign_call ADD COLUMN IF NOT EXISTS ta_approval_notes TEXT;
ALTER TABLE assign_call ADD COLUMN IF NOT EXISTS ta_approval_date TIMESTAMP;
ALTER TABLE assign_call ADD COLUMN IF NOT EXISTS ta_approved_by TEXT;

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_ta_status ON assign_call(ta_status) WHERE ta_voucher_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ta_voucher ON assign_call(ta_voucher_number) WHERE ta_voucher_number IS NOT NULL;

COMMIT;
