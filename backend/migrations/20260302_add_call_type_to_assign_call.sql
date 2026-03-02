-- Migration: Add call_type column to assign_call table
-- Description: Add call_type field to distinguish between Service Call and PM Call

ALTER TABLE assign_call 
ADD COLUMN IF NOT EXISTS call_type VARCHAR(50) DEFAULT 'Service Call';

-- Add NOT NULL constraint after setting default values
ALTER TABLE assign_call 
ALTER COLUMN call_type SET NOT NULL;

-- Create index on call_type for faster queries
CREATE INDEX IF NOT EXISTS idx_assign_call_type ON assign_call(call_type);
