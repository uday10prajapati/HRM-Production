import express from 'express';
import { pool } from './db.js';

const router = express.Router();

// Ensure leaves table exists (safe startup helper)
(async function ensureLeavesTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS leaves (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        reason TEXT,
        status VARCHAR(16) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_leaves_user_status ON leaves (user_id, status)`);
    console.log('\u2705 Ensured leaves table exists');
  } catch (err) {
    console.warn('Could not ensure leaves table exists:', err?.message || err);
  }
})();

// POST /api/leave/apply
// body: { userId, startDate, endDate, reason }
router.post('/apply', async (req, res) => {
  const { userId, startDate, endDate, reason } = req.body;
  if (!userId || !startDate || !endDate) {
    return res.status(400).json({ success: false, message: 'userId, startDate and endDate are required' });
  }
  // basic date validation
  const s = new Date(startDate);
  const e = new Date(endDate);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) {
    return res.status(400).json({ success: false, message: 'Invalid date format' });
  }
  if (e < s) {
    return res.status(400).json({ success: false, message: 'endDate must be on or after startDate' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO leaves (user_id, start_date, end_date, reason, status) VALUES ($1, $2, $3, $4, 'pending') RETURNING *`,
      [userId, startDate, endDate, reason || null]
    );
    // fetch with user info
    const leave = result.rows[0];
    try {
      const u = await pool.query(`SELECT id, name, email FROM users WHERE id=$1 LIMIT 1`, [leave.user_id]);
      leave.user = u.rows && u.rows[0] ? u.rows[0] : null;
    } catch (e) {
      // ignore user fetch errors
    }
    res.json({ success: true, leave });
  } catch (err) {
    console.error('Error applying leave:', err?.message || err);
    res.status(500).json({ success: false, message: 'Error applying leave', error: err?.message || String(err) });
  }
});

// GET /api/leave/ - list leaves; optional query: status=pending|approved|rejected, userId (to filter by user)
router.get('/', async (req, res) => {
  const { status, userId } = req.query;
  try {
    const conditions = [];
    const params = [];
    if (status) {
      params.push(status);
      conditions.push(`l.status = $${params.length}`);
    }
    if (userId) {
      params.push(userId);
      conditions.push(`l.user_id = $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const query = `SELECT l.*, u.name as user_name, u.email as user_email FROM leaves l LEFT JOIN users u ON u.id = l.user_id ${where} ORDER BY l.created_at DESC`;
    const result = await pool.query(query, params);
    res.json({ success: true, leaves: result.rows });
  } catch (err) {
    console.error('Error fetching leaves:', err?.message || err);
    res.status(500).json({ success: false, message: 'Error fetching leaves', error: err?.message || String(err) });
  }
});

// PUT /api/leave/:id/approve
router.put('/:id/approve', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(`UPDATE leaves SET status='approved', updated_at=NOW() WHERE id=$1 RETURNING *`, [id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Leave not found' });
    const leave = result.rows[0];
    try {
      const u = await pool.query(`SELECT id, name, email FROM users WHERE id=$1 LIMIT 1`, [leave.user_id]);
      leave.user = u.rows && u.rows[0] ? u.rows[0] : null;
    } catch (e) {}
    res.json({ success: true, leave });
  } catch (err) {
    console.error('Error approving leave:', err?.message || err);
    res.status(500).json({ success: false, message: 'Error approving leave', error: err?.message || String(err) });
  }
});

// PUT /api/leave/:id/reject
router.put('/:id/reject', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(`UPDATE leaves SET status='rejected', updated_at=NOW() WHERE id=$1 RETURNING *`, [id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Leave not found' });
    const leave = result.rows[0];
    try {
      const u = await pool.query(`SELECT id, name, email FROM users WHERE id=$1 LIMIT 1`, [leave.user_id]);
      leave.user = u.rows && u.rows[0] ? u.rows[0] : null;
    } catch (e) {}
    res.json({ success: true, leave });
  } catch (err) {
    console.error('Error rejecting leave:', err?.message || err);
    res.status(500).json({ success: false, message: 'Error rejecting leave', error: err?.message || String(err) });
  }
});

export default router;
