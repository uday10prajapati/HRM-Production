import { pool } from './db.js';

async function check() {
  try {
    const res = await pool.query('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 5');
    console.log("NOTIFICATIONS:");
    console.log(JSON.stringify(res.rows, null, 2));

    const roles = await pool.query('SELECT DISTINCT role FROM users');
    console.log("ROLES:");
    console.log(roles.rows);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

check();
