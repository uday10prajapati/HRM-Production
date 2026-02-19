
import dotenv from 'dotenv';
import { pool, ensureDbConnection } from './db.js';
dotenv.config();

async function addIdToSocietyTable() {
    await ensureDbConnection();
    try {
        console.log('Adding ID column to society master table...');

        // Add UUID extension if not exists (usually already there)
        await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');

        // Add ID column if it doesn't exist
        await pool.query(`
      ALTER TABLE public.service_call_dairy_list 
      ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid() PRIMARY KEY;
    `);

        console.log('ID column added successfully!');
    } catch (err) {
        console.error('Failed to add ID column:', err);
    } finally {
        await pool.end();
    }
}

addIdToSocietyTable();
