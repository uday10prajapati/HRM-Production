-- Migration: Fix assign_call table schema
-- Description: Add missing columns and create proper structure for call assignment

BEGIN;

-- Add call_id as unique identifier if it doesn't exist
ALTER TABLE assign_call ADD COLUMN IF NOT EXISTS call_id VARCHAR(100) UNIQUE;

-- Add engineer_id to store the assigned engineer
ALTER TABLE assign_call ADD COLUMN IF NOT EXISTS engineer_id VARCHAR(100);

-- Add call tracking columns
ALTER TABLE assign_call ADD COLUMN IF NOT EXISTS call_type VARCHAR(50) DEFAULT 'Service Call';
ALTER TABLE assign_call ADD COLUMN IF NOT EXISTS formatted_call_id VARCHAR(50);
ALTER TABLE assign_call ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'new';
ALTER TABLE assign_call ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Add resolution columns
ALTER TABLE assign_call ADD COLUMN IF NOT EXISTS problem TEXT;
ALTER TABLE assign_call ADD COLUMN IF NOT EXISTS problem1 TEXT;
ALTER TABLE assign_call ADD COLUMN IF NOT EXISTS problem2 TEXT;
ALTER TABLE assign_call ADD COLUMN IF NOT EXISTS solutions TEXT;

-- Add stock columns
ALTER TABLE assign_call ADD COLUMN IF NOT EXISTS part_used TEXT;
ALTER TABLE assign_call ADD COLUMN IF NOT EXISTS quantity_used TEXT;
ALTER TABLE assign_call ADD COLUMN IF NOT EXISTS stock_items TEXT;
ALTER TABLE assign_call ADD COLUMN IF NOT EXISTS serial_number TEXT;
ALTER TABLE assign_call ADD COLUMN IF NOT EXISTS remarks TEXT;
ALTER TABLE assign_call ADD COLUMN IF NOT EXISTS under_warranty TEXT;
ALTER TABLE assign_call ADD COLUMN IF NOT EXISTS return_part_name TEXT;
ALTER TABLE assign_call ADD COLUMN IF NOT EXISTS return_serial_number TEXT;

-- Add visit columns
ALTER TABLE assign_call ADD COLUMN IF NOT EXISTS appointment_date DATE;
ALTER TABLE assign_call ADD COLUMN IF NOT EXISTS visit_start_date DATE;
ALTER TABLE assign_call ADD COLUMN IF NOT EXISTS visit_end_date DATE;
ALTER TABLE assign_call ADD COLUMN IF NOT EXISTS visit_start_time TIME;
ALTER TABLE assign_call ADD COLUMN IF NOT EXISTS visit_end_time TIME;
ALTER TABLE assign_call ADD COLUMN IF NOT EXISTS places_visited TEXT;
ALTER TABLE assign_call ADD COLUMN IF NOT EXISTS kms_traveled NUMERIC;
ALTER TABLE assign_call ADD COLUMN IF NOT EXISTS return_to_home BOOLEAN;
ALTER TABLE assign_call ADD COLUMN IF NOT EXISTS return_place TEXT;
ALTER TABLE assign_call ADD COLUMN IF NOT EXISTS return_km NUMERIC;

-- Add letterhead columns
ALTER TABLE assign_call ADD COLUMN IF NOT EXISTS letterhead_url TEXT;
ALTER TABLE assign_call ADD COLUMN IF NOT EXISTS letterhead_received BOOLEAN DEFAULT FALSE;

-- Add TA columns
ALTER TABLE assign_call ADD COLUMN IF NOT EXISTS ta_voucher_number TEXT;
ALTER TABLE assign_call ADD COLUMN IF NOT EXISTS ta_voucher_date DATE;
ALTER TABLE assign_call ADD COLUMN IF NOT EXISTS ta_call_type TEXT;
ALTER TABLE assign_call ADD COLUMN IF NOT EXISTS ta_travel_mode TEXT;
ALTER TABLE assign_call ADD COLUMN IF NOT EXISTS ta_status TEXT;
ALTER TABLE assign_call ADD COLUMN IF NOT EXISTS ta_receipt_url TEXT;
ALTER TABLE assign_call ADD COLUMN IF NOT EXISTS ta_revised_km NUMERIC;
ALTER TABLE assign_call ADD COLUMN IF NOT EXISTS ta_revised_places TEXT;
ALTER TABLE assign_call ADD COLUMN IF NOT EXISTS ta_approval_notes TEXT;
ALTER TABLE assign_call ADD COLUMN IF NOT EXISTS ta_approval_date TIMESTAMP;
ALTER TABLE assign_call ADD COLUMN IF NOT EXISTS ta_approved_by TEXT;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_assign_call_call_id ON assign_call(call_id);
CREATE INDEX IF NOT EXISTS idx_assign_call_engineer_id ON assign_call(engineer_id);
CREATE INDEX IF NOT EXISTS idx_assign_call_status ON assign_call(status);
CREATE INDEX IF NOT EXISTS idx_assign_call_formatted_id ON assign_call(formatted_call_id);
CREATE INDEX IF NOT EXISTS idx_assign_call_created_at ON assign_call(created_at);

COMMIT;
