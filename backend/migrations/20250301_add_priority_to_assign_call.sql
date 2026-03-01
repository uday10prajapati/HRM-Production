-- Migration: Add priority column to assign_call table
-- Date: 2025-03-01
-- Description: Adds priority field (High, Medium, Low) to service call assignments

ALTER TABLE assign_call 
ADD COLUMN IF NOT EXISTS priority VARCHAR(10) DEFAULT 'Medium';

-- Add a constraint to ensure priority is one of: High, Medium, Low
ALTER TABLE assign_call 
ADD CONSTRAINT priority_check 
CHECK (priority IN ('High', 'Medium', 'Low'));

-- Create an index on priority for faster filtering
CREATE INDEX IF NOT EXISTS idx_assign_call_priority ON assign_call(priority);
