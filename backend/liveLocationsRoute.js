import express from 'express';
import { pool } from './db.js';
import requireAuth from './authMiddleware.js';

const router = express.Router();

// ensure live_locations table exists
(async function ensureLiveLocationsTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS live_locations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        latitude DOUBLE PRECISION,
        longitude DOUBLE PRECISION,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_live_locations_user_updated_at ON live_locations (user_id, updated_at);`);
    console.log('liveLocationsRoute: ensured live_locations table exists');
  } catch (err) {
    console.error('liveLocationsRoute startup error:', err?.message ?? err);
  }
})();

// GET /api/live_locations/latest?userId=...
// Returns the most recent live_locations row for the given user (if any)
router.get('/latest', requireAuth, async (req, res) => {
  try {
    const userId = req.query.userId ?? null;
    if (!userId) return res.status(400).json({ success: false, message: 'Missing userId' });

    // authorization: admin/hr can query any; others only self
    const requesterRole = req.user?.role ?? null;
    const requesterId = req.user?.id ?? null;
    if (requesterRole !== 'admin' && requesterRole !== 'hr') {
      if (String(userId) !== String(requesterId)) return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const q = `SELECT user_id, latitude, longitude, to_char(updated_at, 'YYYY-MM-DD HH24:MI:SS') AS updated_at
               FROM live_locations
               WHERE user_id::text = $1
               ORDER BY updated_at DESC
               LIMIT 1`;
    const result = await pool.query(q, [String(userId)]);
    const row = result.rows[0] ?? null;
    if (!row) return res.json({ success: true, location: null });
    return res.json({ success: true, location: row });
  } catch (err) {
    console.error('/live_locations/latest error', err);
    return res.status(500).json({ success: false, message: 'Error fetching latest live location', error: err?.message ?? String(err) });
  }
});

// GET /api/live_locations?userId=...&limit=...
// Returns recent live location rows for a user
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.query.userId ?? null;
    if (!userId) return res.status(400).json({ success: false, message: 'Missing userId' });
    const limit = Number(req.query.limit ?? 50);

    const requesterRole = req.user?.role ?? null;
    const requesterId = req.user?.id ?? null;
    if (requesterRole !== 'admin' && requesterRole !== 'hr') {
      if (String(userId) !== String(requesterId)) return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const q = `SELECT id, user_id, latitude, longitude, to_char(updated_at, 'YYYY-MM-DD HH24:MI:SS') AS updated_at
               FROM live_locations
               WHERE user_id::text = $1
               ORDER BY updated_at DESC
               LIMIT $2`;
    const result = await pool.query(q, [String(userId), limit]);
    return res.json({ success: true, rows: result.rows || [] });
  } catch (err) {
    console.error('/live_locations error', err);
    return res.status(500).json({ success: false, message: 'Error fetching live locations', error: err?.message ?? String(err) });
  }
});

export default router;

// POST /api/live_locations/upsert
// Body: { userId, latitude, longitude }
// Inserts a new live location row (keeps history). Admin/hr can upsert for any user; others only for themselves.
router.post('/upsert', requireAuth, async (req, res) => {
  try {
    const body = req.body || {};
    const userId = body.userId ?? body.user_id ?? null;
    const lat = body.latitude ?? null;
    const lng = body.longitude ?? null;
    if (!userId) return res.status(400).json({ success: false, message: 'Missing userId' });
    if (lat == null || lng == null) return res.status(400).json({ success: false, message: 'Missing latitude or longitude' });

    const requesterRole = req.user?.role ?? null;
    const requesterId = req.user?.id ?? null;
    if (requesterRole !== 'admin' && requesterRole !== 'hr') {
      if (String(userId) !== String(requesterId)) return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const q = `INSERT INTO live_locations (user_id, latitude, longitude, updated_at) VALUES ($1,$2,$3,now()) RETURNING user_id, latitude, longitude, to_char(updated_at, 'YYYY-MM-DD HH24:MI:SS') AS updated_at`;
    const result = await pool.query(q, [String(userId), Number(lat), Number(lng)]);
    return res.json({ success: true, location: result.rows[0] });
  } catch (err) {
    console.error('/live_locations/upsert error', err);
    return res.status(500).json({ success: false, message: 'Error inserting live location', error: err?.message ?? String(err) });
  }
});
