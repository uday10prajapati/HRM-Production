import { pool } from './db.js';

async function check() {
  try {
    const roles = await pool.query("SELECT id, name, role FROM users");
    console.log("USERS:");
    console.log(roles.rows);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

check();
