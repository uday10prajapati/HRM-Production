import express from "express";
import { pool } from "./db.js";

const router = express.Router();

// POST /api/attendance/punch
// body: { userId, type: 'in'|'out', latitude?, longitude?, notes? }
router.post('/punch', async (req, res) => {
  const { userId, type, latitude, longitude, notes } = req.body;
  if (!userId || !type) {
    return res.status(400).json({ success: false, message: 'userId and type are required' });
  }
  if (type !== 'in' && type !== 'out') {
    return res.status(400).json({ success: false, message: 'type must be "in" or "out"' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO attendances (user_id, type, latitude, longitude, notes) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [userId, type, latitude || null, longitude || null, notes || null]
    );

    // Optionally update users.attendance_status for quick UI display
    try {
      await pool.query(`UPDATE users SET attendance_status=$1 WHERE id=$2`, [type, userId]);
    } catch (e) {
      console.warn('Failed to update users.attendance_status:', e.message || e);
    }

    res.json({ success: true, attendance: result.rows[0] });
  } catch (err) {
    console.error('Error saving attendance:', err);
    res.status(500).json({ success: false, message: 'Error saving attendance' });
  }
});

// GET /api/attendance/my/:userId
router.get('/my/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const result = await pool.query(`SELECT * FROM attendances WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100`, [userId]);
    res.json({ success: true, attendances: result.rows });
  } catch (err) {
    console.error('Error fetching attendances:', err);
    res.status(500).json({ success: false, message: 'Error fetching attendances' });
  }
});

// GET aggregated attendance report
// Query params: start=YYYY-MM-DD, end=YYYY-MM-DD, group=day|week|month
router.get('/report', async (req, res) => {
  const { start, end, group } = req.query;
  // default group by day
  const grp = (group || 'day').toLowerCase();
  let timeBucket;
  if (grp === 'day') timeBucket = "to_char(created_at, 'YYYY-MM-DD')";
  else if (grp === 'week') timeBucket = "to_char(date_trunc('week', created_at), 'IYYY-IW')"; // ISO year-week
  else if (grp === 'month') timeBucket = "to_char(created_at, 'YYYY-MM')";
  else return res.status(400).json({ success: false, message: 'Invalid group param' });

  try {
    let params = [];
    let where = '';
    if (start) {
      params.push(start);
      where += ` AND created_at >= $${params.length}`;
    }
    if (end) {
      params.push(end + ' 23:59:59');
      where += ` AND created_at <= $${params.length}`;
    }

    const query = `SELECT ${timeBucket} as bucket, type, COUNT(*) as count FROM attendances WHERE 1=1 ${where} GROUP BY bucket, type ORDER BY bucket DESC`;

    const result = await pool.query(query, params);

    // Transform rows into { bucket: { in: n, out: m } }
    const buckets = {};
    for (const r of result.rows) {
      const b = r.bucket;
      if (!buckets[b]) buckets[b] = { in: 0, out: 0 };
      buckets[b][r.type] = Number(r.count);
    }

    res.json({ success: true, report: buckets });
  } catch (err) {
    console.error('Error generating report:', err);
    res.status(500).json({ success: false, message: 'Error generating report' });
  }
});

export default router;
