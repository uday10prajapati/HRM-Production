import express from 'express';
import { pool } from './db.js';

const router = express.Router();

// Ensure leaves table exists (safe startup helper)
(async function ensureLeavesTable() {
  try {
    await pool.query(`
      CREATE EXTENSION IF NOT EXISTS pgcrypto;
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
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_leaves_user_status ON leaves (user_id, status)`);
    // Ensure newer optional columns exist so queries used elsewhere don't fail
    try {
      await pool.query(`ALTER TABLE IF EXISTS leaves ADD COLUMN IF NOT EXISTS type TEXT`);
      await pool.query(`ALTER TABLE IF EXISTS leaves ADD COLUMN IF NOT EXISTS applied_at TIMESTAMP`);
      await pool.query(`ALTER TABLE IF EXISTS leaves ADD COLUMN IF NOT EXISTS approved_by TEXT`);
      await pool.query(`ALTER TABLE IF EXISTS leaves ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP`);
      await pool.query(`ALTER TABLE IF EXISTS leaves ADD COLUMN IF NOT EXISTS day_type TEXT`);
    } catch (e) {
      console.warn('Could not ensure optional leaves columns exist:', e?.message || e);
    }
    console.log('\u2705 Ensured leaves table exists');
  } catch (err) {
    console.warn('Could not ensure leaves table exists:', err?.message || err);
  }
})();

// POST /api/leave/apply
// body: { userId, startDate, endDate, reason, type, day_type }
router.post('/apply', async (req, res) => {
  const { userId, startDate, endDate, reason, type, day_type } = req.body;
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
      `INSERT INTO leaves (user_id, start_date, end_date, reason, type, day_type, status) VALUES ($1, $2, $3, $4, $5, $6, 'pending') RETURNING *`,
      [userId, startDate, endDate, reason || null, type || null, day_type || 'full']
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
  // Diagnostic log to help debug empty responses from clients
  try {
    console.log(`/api/leave called`, { query: req.query, headersPreview: { 'x-user-id': req.header('x-user-id') } });
  } catch (e) { /* ignore logging errors */ }
  // role-based: check requester header first
  const requester = req.header('x-user-id') || null;
  try {
    let isPrivileged = false;
    if (requester) {
      try {
        const ru = await pool.query('SELECT role FROM users WHERE id::text=$1 LIMIT 1', [String(requester)]);
        const role = ru.rows && ru.rows[0] ? (ru.rows[0].role || '').toLowerCase() : null;
        if (role === 'admin' || role === 'hr') isPrivileged = true;
      } catch (e) {
        console.warn('Could not lookup requester role for leaves:', e?.message || e);
      }
    }

    const conditions = [];
    const params = [];
    if (status) {
      params.push(status);
      conditions.push(`l.status = $${params.length}`);
    }
    // if userId provided in query and requester is privileged, allow; otherwise if requester present and not privileged, force their own id
    if (userId && isPrivileged) {
      params.push(String(userId));
      conditions.push(`l.user_id::text = $${params.length}`);
    } else if (requester && !isPrivileged) {
      params.push(String(requester));
      conditions.push(`l.user_id::text = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    // select explicit columns expected by frontend - NOW INCLUDES day_type
    const query = `SELECT l.id,
      to_char(l.created_at, 'YYYY-MM-DD HH24:MI:SS') AS created_at,
      l.type,
      l.day_type,
      l.reason,
      l.status,
      l.user_id,
      to_char(l.start_date, 'YYYY-MM-DD') AS start_date,
      to_char(l.end_date, 'YYYY-MM-DD') AS end_date,
      to_char(l.applied_at, 'YYYY-MM-DD HH24:MI:SS') AS applied_at,
      l.approved_by,
      to_char(l.approved_at, 'YYYY-MM-DD HH24:MI:SS') AS approved_at,
      u.name as user_name, u.email as user_email
    FROM leaves l
    LEFT JOIN users u ON u.id::text = l.user_id::text
    ${where}
    ORDER BY COALESCE(l.created_at, now()) DESC`;
    console.log('leave list SQL (preview):', { sqlWhere: where, params });
    let result;
    try {
      result = await pool.query(query, params);
    } catch (innerErr) {
      console.error('DB query failed (leaves list):', innerErr?.message || innerErr, innerErr?.stack || 'no stack');
      throw innerErr;
    }
    res.json({ success: true, leaves: result.rows });
  } catch (err) {
    console.error('Error fetching leaves:', err?.message || err, err?.stack || 'no stack');
    res.status(500).json({ success: false, message: 'Error fetching leaves', error: err?.message || String(err) });
  }
});

// PUT /api/leave/:id/approve
router.put('/:id/approve', async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    // check requester role
    const requester = req.header('x-user-id') || null;
    if (!requester) {
      client.release();
      return res.status(403).json({ success: false, message: 'Missing X-User-Id' });
    }
    const ru = await client.query('SELECT role FROM users WHERE id::text=$1 LIMIT 1', [String(requester)]);
    const role = ru.rows && ru.rows[0] ? (ru.rows[0].role || '').toLowerCase() : null;
    if (role !== 'admin' && role !== 'hr') {
      client.release();
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    await client.query('BEGIN');
    // Ensure we only approve a pending leave (prevent double deduction)
    const result = await client.query(`UPDATE leaves SET status='approved', updated_at=NOW(), approved_by=$2, approved_at=NOW() WHERE id::text=$1 AND status != 'approved' RETURNING id, user_id, type, day_type, reason, status, start_date, end_date, applied_at, approved_by, approved_at`, [String(id), String(requester)]);

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json({ success: false, message: 'Leave not found or already approved' });
    }
    const leave = result.rows[0];

    // Calculate duration to deduct
    const s = new Date(leave.start_date);
    const e = new Date(leave.end_date);
    const diffTime = Math.abs(e - s);
    let diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    if (diffDays === 1 && leave.day_type === 'half') {
      diffDays = 0.5;
    }

    // Deduct from user balance
    await client.query(`UPDATE users SET leave_balance = COALESCE(leave_balance, 20) - $1 WHERE id=$2`, [diffDays, leave.user_id]);

    await client.query('COMMIT');

    try {
      const u = await pool.query(`SELECT id, name, email FROM users WHERE id=$1 LIMIT 1`, [leave.user_id]);
      leave.user = u.rows && u.rows[0] ? u.rows[0] : null;
    } catch (e) { }

    client.release();
    res.json({ success: true, leave });
  } catch (err) {
    await client.query('ROLLBACK');
    client.release();
    console.error('Error approving leave:', err?.message || err, err?.stack || 'no stack');
    res.status(500).json({ success: false, message: 'Error approving leave', error: err?.message || String(err) });
  }
});

// PUT /api/leave/:id/reject
router.put('/:id/reject', async (req, res) => {
  const { id } = req.params;
  try {
    const requester = req.header('x-user-id') || null;
    if (!requester) return res.status(403).json({ success: false, message: 'Missing X-User-Id' });
    const ru = await pool.query('SELECT role FROM users WHERE id::text=$1 LIMIT 1', [String(requester)]);
    const role = ru.rows && ru.rows[0] ? (ru.rows[0].role || '').toLowerCase() : null;
    if (role !== 'admin' && role !== 'hr') return res.status(403).json({ success: false, message: 'Forbidden' });
    const result = await pool.query(`UPDATE leaves SET status='rejected', updated_at=NOW() WHERE id::text=$1 RETURNING id, user_id, type, day_type, reason, status, start_date, end_date, applied_at, approved_by, approved_at`, [String(id)]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Leave not found' });
    const leave = result.rows[0];
    try {
      const u = await pool.query(`SELECT id, name, email FROM users WHERE id=$1 LIMIT 1`, [leave.user_id]);
      leave.user = u.rows && u.rows[0] ? u.rows[0] : null;
    } catch (e) { }
    res.json({ success: true, leave });
  } catch (err) {
    console.error('Error rejecting leave:', err?.message || err, err?.stack || 'no stack');
    res.status(500).json({ success: false, message: 'Error rejecting leave', error: err?.message || String(err) });
  }
});

export default router;

// Debug endpoint - quick DB check and leaves column types
router.get('/_debug/db', async (req, res) => {
  try {
    // simple connectivity
    await pool.query('SELECT 1');
    // inspect leaves columns
    const cols = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='leaves'");
    res.json({ ok: true, columns: cols.rows });
  } catch (err) {
    console.error('Leave debug endpoint failed:', err?.message || err, err?.stack || 'no stack');
    res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
});

// Admin-only: fetch all leaves (raw) - useful for debugging and admin panel
router.get('/all', async (req, res) => {
  try {
    const requester = req.header('x-user-id') || null;
    if (!requester) return res.status(401).json({ success: false, message: 'Missing X-User-Id' });
    const ru = await pool.query('SELECT role FROM users WHERE id::text=$1 LIMIT 1', [String(requester)]);
    const role = ru.rows && ru.rows[0] ? (ru.rows[0].role || '').toLowerCase() : null;
    if (role !== 'admin' && role !== 'hr') return res.status(403).json({ success: false, message: 'Forbidden' });

    const q = `SELECT l.id,
      to_char(l.created_at, 'YYYY-MM-DD HH24:MI:SS') AS created_at,
      l.type,
      l.day_type,
      l.reason,
      l.status,
      l.user_id,
      to_char(l.start_date, 'YYYY-MM-DD') AS start_date,
      to_char(l.end_date, 'YYYY-MM-DD') AS end_date,
      to_char(l.applied_at, 'YYYY-MM-DD HH24:MI:SS') AS applied_at,
      l.approved_by,
      to_char(l.approved_at, 'YYYY-MM-DD HH24:MI:SS') AS approved_at,
      u.name as user_name, u.email as user_email
    FROM leaves l
    LEFT JOIN users u ON u.id::text = l.user_id::text
    ORDER BY COALESCE(l.created_at, now()) DESC LIMIT 2000`;
    const r = await pool.query(q);
    return res.json({ success: true, leaves: r.rows });
  } catch (err) {
    console.error('Error in /api/leave/all:', err?.message || err, err?.stack || 'no stack');
    return res.status(500).json({ success: false, message: 'Failed to fetch all leaves', error: err?.message || String(err) });
  }
});

// Admin-only: insert sample leave rows for testing (idempotent)
router.post('/_debug/seed', async (req, res) => {
  try {
    const requester = req.header('x-user-id') || null;
    if (!requester) return res.status(401).json({ success: false, message: 'Missing X-User-Id' });
    const ru = await pool.query('SELECT role FROM users WHERE id::text=$1 LIMIT 1', [String(requester)]);
    const role = ru.rows && ru.rows[0] ? (ru.rows[0].role || '').toLowerCase() : null;
    if (role !== 'admin' && role !== 'hr') return res.status(403).json({ success: false, message: 'Forbidden' });

    // check if sample rows already exist
    const chk = await pool.query("SELECT id FROM leaves WHERE reason LIKE '%[SAMPLE]%' LIMIT 1");
    if (chk.rowCount > 0) return res.json({ success: true, message: 'Sample rows already present' });

    // pick up to two users to attach sample leaves to
    const users = await pool.query('SELECT id FROM users LIMIT 2');
    const urows = users.rows || [];
    if (urows.length === 0) return res.status(400).json({ success: false, message: 'No users found to attach sample leaves' });

    const now = new Date();
    const user1 = urows[0].id;
    const user2 = urows[1] ? urows[1].id : urows[0].id;

    await pool.query(`INSERT INTO leaves (user_id, start_date, end_date, reason, type, day_type, status, applied_at) VALUES
      ($1, $2, $3, $4, $5, $6, 'pending', NOW()),
      ($7, $8, $9, $10, $11, $12, 'pending', NOW())`,
      [user1, now.toISOString().slice(0, 10), now.toISOString().slice(0, 10), '[SAMPLE] Short leave', 'Casual', 'full', user2, now.toISOString().slice(0, 10), now.toISOString().slice(0, 10), '[SAMPLE] Short leave 2', 'Casual', 'half']
    );

    return res.json({ success: true, message: 'Inserted sample leaves' });
  } catch (err) {
    console.error('Error seeding sample leaves:', err?.message || err, err?.stack || 'no stack');
    return res.status(500).json({ success: false, message: 'Failed to insert sample leaves', error: String(err?.message || err) });
  }
});