
import dotenv from 'dotenv';
import { pool, ensureDbConnection } from './db.js';
dotenv.config();

async function createTable() {
    await ensureDbConnection();
    try {
        console.log('Creating society master table...');
        await pool.query(`
      CREATE TABLE IF NOT EXISTS public.service_call_dairy_list (
        "SOCCD" numeric null,
        "SOCIETY" text null,
        "TALUKA NAME" text null
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
