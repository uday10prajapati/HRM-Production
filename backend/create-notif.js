import { pool } from './db.js';

async function fix() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        recipient_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        notification_type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT,
        related_id UUID,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        read_at TIMESTAMP
      );
    `);
    console.log("Notifications table ensured without pgcrypto");
    const count = await pool.query('SELECT count(*) FROM notifications');
    console.log("Count:", count.rows);
  } catch (e) {
    console.log("ERROR:", e.message);
  } finally {
    process.exit(0);
  }
}
fix();
