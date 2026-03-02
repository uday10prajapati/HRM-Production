-- Migration: Add call_type column and ensure call_id supports formatted IDs
-- Description: Adds call_type column for Service Call vs PM Call distinction

-- Add call_type column if it doesn't exist
ALTER TABLE assign_call 
ADD COLUMN IF NOT EXISTS call_type VARCHAR(50) DEFAULT 'Service Call';

-- Set NOT NULL constraint on call_type
ALTER TABLE assign_call 
ALTER COLUMN call_type SET NOT NULL;

-- Ensure call_id is VARCHAR and large enough for formatted IDs (e.g., "S-220226" or "P-220226")
-- First, try to convert the column if it's currently numeric
DO $$
BEGIN
    -- Check if call_id is numeric and convert it to VARCHAR
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'assign_call' 
        AND column_name = 'call_id' 
        AND data_type IN ('integer', 'bigint', 'smallint')
    ) THEN
        -- Drop the identity constraint if exists
        ALTER TABLE assign_call ALTER COLUMN call_id DROP IDENTITY IF EXISTS;
        -- Change the column type to VARCHAR
        ALTER TABLE assign_call ALTER COLUMN call_id TYPE VARCHAR(50);
    END IF;
END $$;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_assign_call_type ON assign_call(call_type);
CREATE INDEX IF NOT EXISTS idx_assign_call_id ON assign_call(call_id);
