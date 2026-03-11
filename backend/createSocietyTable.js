
import dotenv from 'dotenv';
import { pool, ensureDbConnection } from './db.js';
dotenv.config();

async function createTable() {
    await ensureDbConnection();
    try {
        console.log('Creating society master table...');
        await pool.query(`
      CREATE TABLE IF NOT EXISTS public.service_call_dairy_list (
        "MACHINECD" text null,
        "MACHINEDESCCD" text null,
        "MACHINEDESC" text null,
        "SOCCD" numeric null,
        "SOCIETY" text null,
        "TALUKANAME" text null,
        "COMPANY" text null,
        "MACHINESRNO" text null,
        "CTYPECD" text null,
        "PARENTSOCCD" numeric null,
        id uuid not null default gen_random_uuid (),
        constraint service_call_dairy_list_pkey primary key (id)
      ) TABLESPACE pg_default;
    `);
        console.log('Table created successfully!');
    } catch (err) {
        console.error('Failed to create table:', err);
    } finally {
        await pool.end();
    }
}

createTable();
