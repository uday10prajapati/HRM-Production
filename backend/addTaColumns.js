import { pool } from './db.js';

async function run() {
    try {
        console.log('Adding TA columns to assign_call...');
        await pool.query(`
      ALTER TABLE assign_call
      ADD COLUMN IF NOT EXISTS ta_voucher_number text,
      ADD COLUMN IF NOT EXISTS ta_voucher_date date,
      ADD COLUMN IF NOT EXISTS ta_call_type text,
      ADD COLUMN IF NOT EXISTS ta_travel_mode text,
      ADD COLUMN IF NOT EXISTS ta_status text;
    `);
        console.log('Successfully added columns!');
    } catch (err) {
        console.error('Failed to add columns:', err);
    } finally {
        await pool.end();
    }
}

run();
