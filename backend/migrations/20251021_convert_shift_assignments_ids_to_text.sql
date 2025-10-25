-- Idempotent migration: convert shift_assignments.user_id and shift_assignments.shift_id to TEXT
-- Run this as a DB admin if your runtime can't ALTER due to privileges.
DO $$
BEGIN
  -- convert user_id
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shift_assignments' AND column_name = 'user_id' AND data_type <> 'text'
  ) THEN
    ALTER TABLE shift_assignments ALTER COLUMN user_id TYPE text USING user_id::text;
  END IF;

  -- convert shift_id
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shift_assignments' AND column_name = 'shift_id' AND data_type <> 'text'
  ) THEN
    ALTER TABLE shift_assignments ALTER COLUMN shift_id TYPE text USING shift_id::text;
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Migration to convert shift_assignments ids to text failed: %', SQLERRM;
END$$;
