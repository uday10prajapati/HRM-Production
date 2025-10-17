-- Migration: 001_add_task_status.sql
-- Adds a status column and an optional assigned_by column to tasks
-- Run this with psql or your DB migration tooling against the project's database.

BEGIN;

-- Add status column if it does not exist
ALTER TABLE IF EXISTS tasks
  ADD COLUMN IF NOT EXISTS status VARCHAR(32) DEFAULT 'pending';

-- Add assigned_by column (optional, nullable)
ALTER TABLE IF EXISTS tasks
  ADD COLUMN IF NOT EXISTS assigned_by VARCHAR(128);

COMMIT;

-- Notes:
-- Execute: psql "postgres://user:password@host:port/dbname" -f backend/migrations/001_add_task_status.sql
-- Or use your preferred migration tool to run the SQL.
