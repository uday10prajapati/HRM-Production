-- Migration: add customer fields to tasks
-- Date: 2025-10-21
-- Adds customer_name and customer_address columns to the tasks table.
-- This migration is idempotent (uses IF NOT EXISTS). Rollback snippet provided in comments.

BEGIN;

-- Ensure pgcrypto present (not strictly required for ALTER, but keeps migration consistent)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE IF EXISTS tasks ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE IF EXISTS tasks ADD COLUMN IF NOT EXISTS customer_address TEXT;
ALTER TABLE IF EXISTS tasks ADD COLUMN IF NOT EXISTS customer_mobile TEXT;

COMMIT;

-- Rollback (manual):
-- BEGIN;
-- ALTER TABLE IF EXISTS tasks DROP COLUMN IF EXISTS customer_address;
-- ALTER TABLE IF EXISTS tasks DROP COLUMN IF EXISTS customer_name;
-- COMMIT;
