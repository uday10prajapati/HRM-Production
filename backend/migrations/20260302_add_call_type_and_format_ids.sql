-- Migration: Add call_type and formatted_call_id columns
-- Description: Safer approach - keeps call_id as numeric, adds new formatted_call_id for display

BEGIN;

-- Add call_type column if it doesn't exist
ALTER TABLE assign_call 
ADD COLUMN IF NOT EXISTS call_type VARCHAR(50) DEFAULT 'Service Call';

-- Add new formatted_call_id column for the display ID (S-220226/1, P-220226/1)
ALTER TABLE assign_call
ADD COLUMN IF NOT EXISTS formatted_call_id VARCHAR(50);

-- Add NOT NULL constraints
ALTER TABLE assign_call 
ALTER COLUMN call_type SET NOT NULL;

-- Make formatted_call_id unique since it will be the business identifier
CREATE UNIQUE INDEX IF NOT EXISTS idx_formatted_call_id ON assign_call(formatted_call_id) 
WHERE formatted_call_id IS NOT NULL;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_assign_call_type ON assign_call(call_type);
CREATE INDEX IF NOT EXISTS idx_assign_call_created_at ON assign_call(created_at);

COMMIT;
