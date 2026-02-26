import dotenv from 'dotenv';
import { pool, ensureDbConnection } from './db.js';
dotenv.config();

// This script will create the commonly used tables for the HRMS app if they do not exist.
// Run: node backend/createTables.js
// It is idempotent (uses IF NOT EXISTS) and safe to re-run.

async function createAll() {
  await ensureDbConnection();

  try {
    console.log('Starting schema creation...');

    await pool.query(`
      CREATE EXTENSION IF NOT EXISTS pgcrypto;

      -- users
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255),
        role VARCHAR(50) NOT NULL,
        mobile_number VARCHAR(32),
        fcm_token TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- tasks table (includes due_date)
      CREATE TABLE IF NOT EXISTS tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT,
        status VARCHAR(32) DEFAULT 'pending',
        assigned_by VARCHAR(128),
        assigned_to TEXT,
        customer_name TEXT,
        customer_address TEXT,
        customer_mobile TEXT,
        due_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- documents
      CREATE TABLE IF NOT EXISTS documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(64) NOT NULL,
        filename TEXT NOT NULL,
        path TEXT NOT NULL,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- attendance
      CREATE TABLE IF NOT EXISTS attendance (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(16) NOT NULL,
        latitude DOUBLE PRECISION,
        longitude DOUBLE PRECISION,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- leaves
      CREATE TABLE IF NOT EXISTS leaves (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        reason TEXT,
        status VARCHAR(16) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- employees / engineers helper tables
      CREATE TABLE IF NOT EXISTS employees (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        department TEXT,
        designation TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS engineers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        specialization TEXT,
        level TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- shifts and assignments
      CREATE TABLE IF NOT EXISTS shifts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS shift_assignments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        shift_id UUID REFERENCES shifts(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        user_role VARCHAR(64),
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- live locations
      CREATE TABLE IF NOT EXISTS live_locations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        latitude DOUBLE PRECISION,
        longitude DOUBLE PRECISION,
        accuracy DOUBLE PRECISION,
        provider TEXT,
        recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- stock tables
      CREATE TABLE IF NOT EXISTS stock_items (
        id SERIAL PRIMARY KEY,
        sku TEXT UNIQUE,
        name TEXT NOT NULL,
        description TEXT,
        quantity INTEGER NOT NULL DEFAULT 0,
        threshold INTEGER NOT NULL DEFAULT 5,
        created_at TIMESTAMP DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS engineer_stock (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        engineer_id UUID NOT NULL,
        stock_item_id INTEGER NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
        quantity INTEGER NOT NULL DEFAULT 0,
        assigned_at TIMESTAMP DEFAULT now(),
        last_reported_at TIMESTAMP,
        last_reported_by TEXT,
        UNIQUE(engineer_id, stock_item_id)
      );

      CREATE TABLE IF NOT EXISTS stock_consumption (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        engineer_id UUID,
        stock_item_id INTEGER REFERENCES stock_items(id) ON DELETE SET NULL,
        quantity INTEGER NOT NULL,
        note TEXT,
        consumed_at TIMESTAMP DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS wastage_stock (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        engineer_id UUID NOT NULL,
        stock_item_id INTEGER NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
        quantity INTEGER NOT NULL,
        reason TEXT,
        reported_at TIMESTAMP DEFAULT now()
      );

      -- overtime / payroll (basic)
      CREATE TABLE IF NOT EXISTS overtime_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        -- legacy 'hours' kept for compatibility; prefer storing seconds explicitly
        hours NUMERIC,
        date DATE,
        notes TEXT,
        created_at TIMESTAMP DEFAULT now()
      );
      -- Ensure new payroll-specific columns exist for overtime_records
      ALTER TABLE overtime_records ADD COLUMN IF NOT EXISTS worked_seconds BIGINT;
      ALTER TABLE overtime_records ADD COLUMN IF NOT EXISTS overtime_seconds BIGINT;
      ALTER TABLE overtime_records ADD COLUMN IF NOT EXISTS shift_id UUID;
      -- employee salary config stores per-employee breakdown and mode (monthly/hourly)
      CREATE TABLE IF NOT EXISTS employee_salary_config (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        basic NUMERIC DEFAULT 0,
        hra NUMERIC DEFAULT 0,
        allowances JSONB DEFAULT '{}'::jsonb,
        deductions JSONB DEFAULT '{}'::jsonb,
        salary_mode VARCHAR(16) DEFAULT 'monthly', -- 'monthly' or 'hourly'
        hourly_rate NUMERIC DEFAULT 72.12,
        created_at TIMESTAMP DEFAULT now(),
        updated_at TIMESTAMP DEFAULT now()
      );

      -- payroll_records stores computed/stored payroll for a month (or custom period)
      CREATE TABLE IF NOT EXISTS payroll_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        year INTEGER NOT NULL,
        month INTEGER NOT NULL,
        period_start DATE,
        period_end DATE,
        basic NUMERIC DEFAULT 0,
        hra NUMERIC DEFAULT 0,
        allowances JSONB DEFAULT '{}'::jsonb,
        deductions JSONB DEFAULT '{}'::jsonb,
        per_day_salary NUMERIC DEFAULT 0,
        total_working_days INTEGER DEFAULT 0,
        worked_days INTEGER DEFAULT 0,
        leave_days INTEGER DEFAULT 0,
        attendance_hours NUMERIC DEFAULT 0,
        overtime_hours NUMERIC DEFAULT 0,
        overtime_pay NUMERIC DEFAULT 0,
        gross NUMERIC DEFAULT 0,
        pf NUMERIC DEFAULT 0,
        esi_employee NUMERIC DEFAULT 0,
        esi_employer NUMERIC DEFAULT 0,
        professional_tax NUMERIC DEFAULT 0,
        tds NUMERIC DEFAULT 0,
        other_deductions JSONB DEFAULT '{}'::jsonb,
        net_pay NUMERIC DEFAULT 0,
        created_at TIMESTAMP DEFAULT now(),
        updated_at TIMESTAMP DEFAULT now(),
        UNIQUE(user_id, year, month)
      );
      -- canonical payslip table as requested by the user
      CREATE TABLE IF NOT EXISTS payslip (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        year INTEGER,
        month INTEGER,
        basic NUMERIC DEFAULT 0,
        hra NUMERIC DEFAULT 0,
        allowances JSONB DEFAULT '{}'::jsonb,
        deductions JSONB DEFAULT '{}'::jsonb,
        path TEXT,
        file_name TEXT,
        created_at TIMESTAMP DEFAULT now()
      );

      -- keep legacy payslip_files table for metadata created by older code
      CREATE TABLE IF NOT EXISTS payslip_files (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        year INTEGER NOT NULL,
        month INTEGER NOT NULL,
        path TEXT NOT NULL,
        file_name TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT now(),
        UNIQUE(user_id, year, month)
      );

      -- Society Master table
      CREATE TABLE IF NOT EXISTS public.service_call_dairy_list (
        "SOCCD" numeric null,
        "SOCIETY" text null,
        "TALUKA NAME" text null
      ) TABLESPACE pg_default;

      CREATE TABLE IF NOT EXISTS public.product_items (
        "Product Name" text null
      ) TABLESPACE pg_default;

    `);

    console.log('Schema creation complete.');
  } catch (err) {
    console.error('Failed to create schema:', err?.message || err);
    process.exit(1);
  } finally {
    await pool.end().catch(() => null);
  }
}

createAll().then(() => process.exit(0)).catch((e) => {
  console.error('createAll failed', e?.message || e);
  process.exit(1);
});
