import express from "express";
import { pool, getConnection } from "./db.js";
import requireAuth from './authMiddleware.js';

const router = express.Router();

// ensure attendance table exists (safe startup)
(async function ensureAttendanceTable() {
  try {
    await pool.query(`
      CREATE EXTENSION IF NOT EXISTS pgcrypto;
      CREATE TABLE IF NOT EXISTS attendance (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        type VARCHAR(16) NOT NULL,
        notes TEXT,
        latitude DOUBLE PRECISION,
        longitude DOUBLE PRECISION,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_attendance_user_created_at ON attendance (user_id, created_at);`);
    // Ensure optional/legacy columns exist for older DBs
    try {
      await pool.query(`ALTER TABLE IF EXISTS attendance ADD COLUMN IF NOT EXISTS type VARCHAR(16)`);
      await pool.query(`ALTER TABLE IF EXISTS attendance ADD COLUMN IF NOT EXISTS notes TEXT`);
      await pool.query(`ALTER TABLE IF EXISTS attendance ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION`);
      await pool.query(`ALTER TABLE IF EXISTS attendance ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION`);
      await pool.query(`ALTER TABLE IF EXISTS attendance ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`);
    } catch (e) {
      console.warn('Could not ensure attendance optional columns exist:', e?.message || e);
    }
    console.log("attendanceRoute: ensured attendance table exists");
  } catch (err) {
    console.error("attendanceRoute startup error:", err?.message ?? err);
  }
})();

// POST /api/attendance/punch
// body: { userId, type: 'in'|'out', notes? }
// stores timestamp in created_at
// Use pool for simple queries
router.get("/", async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM attendance ORDER BY date DESC");
        res.json(result.rows);
    } catch (err) {
        console.error("Error fetching attendance:", err);
        res.status(500).json({ error: "Failed to fetch attendance" });
    }
});

// Use getConnection for transactions or multiple queries
router.post("/", async (req, res) => {
    let client = null;
    try {
        client = await getConnection();
        await client.query('BEGIN');
        
        // Your transaction queries here
        
        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err) {
        if (client) await client.query('ROLLBACK');
        console.error("Error creating attendance:", err);
        res.status(500).json({ error: "Failed to create attendance" });
    } finally {
        if (client) client.release();
    }
});
router.post("/punch", requireAuth, async (req, res) => {
  try {
    const { userId, punchType, latitude, longitude, notes } = req.body;
    
    // Insert attendance record
    const attendanceQuery = `
      INSERT INTO attendance 
      (user_id, punch_type, latitude, longitude, notes)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, created_at
    `;
    
    const attendanceResult = await pool.query(attendanceQuery, 
      [userId, punchType, latitude, longitude, notes]
    );

    // Also record location in live_locations table
    const locationQuery = `
      INSERT INTO live_locations 
      (user_id, latitude, longitude)
      VALUES ($1, $2, $3)
    `;
    
    await pool.query(locationQuery, [userId, latitude, longitude]);

    res.json({
      success: true,
      data: attendanceResult.rows[0]
    });

  } catch (err) {
    console.error('Attendance recording error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to record attendance'
    });
  }
});

// GET /api/attendance/report?userId=...&start=YYYY-MM-DD&end=YYYY-MM-DD
// returns per-day punch_in and punch_out (strings)
router.get("/report", async (req, res) => {
  try {
    const userIdRaw = req.query.userId ?? null;
    const now = new Date();
    const defaultStart = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-01`;
    const defaultEnd = new Date(now.getFullYear(), now.getMonth()+1, 0).toISOString().slice(0,10);
    const start = req.query.start ?? defaultStart;
    const end = req.query.end ?? defaultEnd;

    // validate date format YYYY-MM-DD to avoid SQL issues
    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRe.test(start) || !dateRe.test(end)) {
      return res.status(400).json({ success: false, message: 'Invalid start or end date format, expected YYYY-MM-DD' });
    }

    const vals = [];
    const where = [];
    if (userIdRaw != null && String(userIdRaw).trim() !== "") {
      // Accept both UUID and legacy integer-like user IDs. Compare user_id as text
      // to avoid Postgres uuid = integer type-mismatch errors when clients send
      // numeric ids but DB uses UUIDs (or vice-versa).
      vals.push(String(userIdRaw));
      where.push(`user_id::text = $${vals.length}`);
    }
    // date params
    vals.push(start);
    where.push(`created_at::date >= $${vals.length}`);
    vals.push(end);
    where.push(`created_at::date <= $${vals.length}`);

    const whereClause = `WHERE ${where.join(" AND ")}`;

    const q = `
      SELECT per.user_id, u.name AS user_name, u.role AS user_role,
             to_char(per.day, 'YYYY-MM-DD') AS day,
             to_char(per.punch_in, 'YYYY-MM-DD HH24:MI:SS') AS punch_in,
             to_char(per.punch_out, 'YYYY-MM-DD HH24:MI:SS') AS punch_out
      FROM (
        SELECT user_id,
               created_at::date AS day,
               MIN(created_at) FILTER (WHERE type = 'in') AS punch_in,
               MAX(created_at) FILTER (WHERE type = 'out') AS punch_out
  FROM attendance
        ${whereClause}
        GROUP BY user_id, created_at::date
      ) per
  LEFT JOIN users u ON u.id::text = per.user_id::text
      ORDER BY u.name NULLS LAST, per.user_id, per.day;
    `;

    // log query for debugging
    // console.log('attendance report query:', q, 'vals:', vals);
    const result = await pool.query(q, vals);
    return res.json(result.rows);
  } catch (err) {
    console.error("attendanceRoute /report error:", err?.message ?? err);
    // include stack in dev mode
    return res.status(500).json({ success: false, message: "Error generating attendance report", error: err?.message ?? String(err) });
  }
});

// GET /api/attendance/summary?userId=...&month=YYYY-MM (optional)
// returns workedDays (distinct days with punch_in) and leaveDays (sum overlap with leaves)
router.get("/summary", async (req, res) => {
  try {
    const userId = req.query.userId ?? null;
    if (!userId) return res.status(400).json({ success: false, message: "Missing userId" });

    const month = req.query.month ?? (() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    })();

    const [year, mon] = month.split("-").map(Number);
    const start = `${year}-${String(mon).padStart(2,"0")}-01`;
    const end = new Date(year, mon, 0).toISOString().slice(0,10); // last day of month

    // worked days: count distinct date with at least one 'in'
    const workedQ = `
  SELECT COUNT(DISTINCT (created_at::date)) AS worked_days
  FROM attendance
  WHERE user_id::text=$1 AND type='in' AND created_at::date BETWEEN $2 AND $3
    `;
  const workedRes = await pool.query(workedQ, [userId, start, end]);
  const workedDays = Number(workedRes.rows[0]?.worked_days ?? 0);

    // leave days: sum of overlapping days in leaves table
    const leaveQ = `
      SELECT COALESCE(SUM(
        GREATEST(0,
          (LEAST(end_date::date, $3::date) - GREATEST(start_date::date, $2::date)) + 1
        )
      ),0) AS leave_days
      FROM leaves
      WHERE user_id::text=$1 AND NOT (end_date::date < $2::date OR start_date::date > $3::date)
    `;
  const leaveRes = await pool.query(leaveQ, [userId, start, end]);
  const leaveDays = Number(leaveRes.rows[0]?.leave_days ?? 0);

  return res.json({ success: true, userId: userId, month, start, end, workedDays, leaveDays });
  } catch (err) {
    console.error("attendanceRoute /summary error:", err?.message ?? err);
    return res.status(500).json({ success: false, message: "Error generating summary", error: err?.message ?? String(err) });
  }
});

// GET /api/attendance/summary/all?start=YYYY-MM-DD&end=YYYY-MM-DD
// returns for each user: user_id, name, role, workedDays, leaveDays, today_punch_in, today_punch_out, present_today(boolean)
router.get('/summary/all', requireAuth, async (req, res) => {
  try {
    const now = new Date();
    const defaultStart = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
    const defaultEnd = new Date(now.getFullYear(), now.getMonth()+1, 0).toISOString().slice(0,10);
    const start = req.query.start ?? defaultStart;
    const end = req.query.end ?? defaultEnd;

    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRe.test(start) || !dateRe.test(end)) {
      return res.status(400).json({ success: false, message: 'Invalid start or end date format' });
    }

    // For each user, compute workedDays and leaveDays in the range
    const q = `
      SELECT u.id AS user_id, u.name, u.role,
        COALESCE(att.worked_days, 0) AS worked_days,
        COALESCE(l.leave_days, 0) AS leave_days,
        td.punch_in AS today_punch_in,
        td.punch_out AS today_punch_out,
        (td.punch_in IS NOT NULL) AS present_today
      FROM users u
      LEFT JOIN (
        SELECT user_id, COUNT(DISTINCT (created_at::date)) AS worked_days
  FROM attendance
        WHERE type='in' AND created_at::date BETWEEN $1 AND $2
        GROUP BY user_id
      ) att ON att.user_id::text = u.id::text
      LEFT JOIN (
        SELECT user_id, COALESCE(SUM(GREATEST(0, (LEAST(end_date::date, $2::date) - GREATEST(start_date::date, $1::date)) + 1)),0) AS leave_days
        FROM leaves
        WHERE NOT (end_date::date < $1::date OR start_date::date > $2::date)
        GROUP BY user_id
      ) l ON l.user_id::text = u.id::text
      LEFT JOIN (
        SELECT user_id,
          to_char(MIN(created_at) FILTER (WHERE type='in'), 'YYYY-MM-DD HH24:MI:SS') AS punch_in,
          to_char(MAX(created_at) FILTER (WHERE type='out'), 'YYYY-MM-DD HH24:MI:SS') AS punch_out
  FROM attendance
        WHERE created_at::date = $3
        GROUP BY user_id
      ) td ON td.user_id::text = u.id::text
      ORDER BY u.name ASC;
    `;

    const today = new Date().toISOString().slice(0,10);
    const result = await pool.query(q, [start, end, today]);
    let rows = result.rows || [];
    const requesterRole = req.user?.role ?? null;
    const requesterId = req.user?.id ?? null;

    if (requesterRole === 'hr') {
      rows = rows.filter(r => ((r.role||'').toString().toLowerCase() === 'engineer' || (r.role||'').toString().toLowerCase() === 'employee'));
    } else if (requesterRole === 'admin') {
      // admin sees everything
    } else {
      // other roles only see their own row
      rows = rows.filter(r => String(r.user_id) === String(requesterId));
    }

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('/attendance/summary/all error', err);
    return res.status(500).json({ success: false, message: 'Error fetching attendance summary', error: err?.message ?? String(err) });
  }
});

  // GET /api/attendance/records?start=YYYY-MM-DD&end=YYYY-MM-DD&userId=...
  // Returns raw attendance rows (id, user_id, user_name, type, notes, created_at)
  router.get('/records', requireAuth, async (req, res) => {
    try {
      const now = new Date();
      const defaultStart = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
      const defaultEnd = new Date(now.getFullYear(), now.getMonth()+1, 0).toISOString().slice(0,10);
      const start = req.query.start ?? defaultStart;
      const end = req.query.end ?? defaultEnd;

      const dateRe = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRe.test(start) || !dateRe.test(end)) {
        return res.status(400).json({ success: false, message: 'Invalid start or end date format' });
      }

      const requesterRole = req.user?.role ?? null;
      const requesterId = req.user?.id ?? null;

      const vals = [start, end];
      let where = `created_at::date BETWEEN $1 AND $2`;

      if (req.query.userId) {
        // Only admin or hr may query arbitrary userId; others must not
        if (requesterRole !== 'admin' && requesterRole !== 'hr') {
          // non privileged can't query others
          if (String(req.query.userId) !== String(requesterId)) {
            return res.status(403).json({ success: false, message: 'Forbidden' });
          }
        }
        vals.push(String(req.query.userId));
        where += ` AND user_id::text = $${vals.length}`;
      } else {
        // no userId passed: admin sees all, hr will see all then be filtered by role, others only their own
        if (requesterRole === 'admin') {
          // no extra where
        } else if (requesterRole === 'hr') {
          // hr sees all rows initially, we'll filter by role after query
        } else {
          // restrict to self
          vals.push(String(requesterId));
          where += ` AND user_id::text = $${vals.length}`;
        }
      }

      const q = `
        SELECT a.id, a.user_id, u.name AS user_name, u.role AS user_role, a.notes,
               a.latitude, a.longitude,
               to_char(a.created_at, 'YYYY-MM-DD HH24:MI:SS') AS created_at
  FROM attendance a
        LEFT JOIN users u ON u.id::text = a.user_id::text
        WHERE ${where}
        ORDER BY a.created_at DESC
        LIMIT 1000
      `;

      const result = await pool.query(q, vals);
      let rows = result.rows || [];
      if (requesterRole === 'hr') {
        rows = rows.filter(r => ((r.user_role||'').toString().toLowerCase() === 'engineer' || (r.user_role||'').toString().toLowerCase() === 'employee'));
      }

      return res.json({ success: true, rows });
    } catch (err) {
      console.error('/attendance/records error', err);
      return res.status(500).json({ success: false, message: 'Error fetching attendance records', error: err?.message ?? String(err) });
    }
  });

// GET /api/attendance/latest?userId=...
router.get('/latest', async (req, res) => {
  try {
    const { userId } = req.query;
    
    const query = `
      SELECT 
        type,
        location[0] as latitude,
        location[1] as longitude,
        created_at
      FROM attendance
      WHERE user_id = $1 
      AND DATE(created_at) = CURRENT_DATE
      AND location IS NOT NULL
      ORDER BY created_at ASC
    `;
    
    const result = await pool.query(query, [userId]);
    const locations = result.rows;

    // Group locations by type
    const punchIn = locations.find(loc => loc.type === 'in');
    const punchOut = locations.find(loc => loc.type === 'out');

    res.json({
      success: true,
      data: {
        punch_in: punchIn ? {
          latitude: punchIn.latitude,
          longitude: punchIn.longitude,
          time: punchIn.created_at
        } : null,
        punch_out: punchOut ? {
          latitude: punchOut.latitude,
          longitude: punchOut.longitude,
          time: punchOut.created_at
        } : null,
        all_locations: locations
      }
    });
  } catch (err) {
    console.error("Error fetching attendance:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Add this new route after other routes
router.get('/engineers', async (req, res) => {
  try {
    const query = await pool.query(`
      SELECT 
        u.id, 
        u.name, 
        u.role,
        (
          WITH last_attendance AS (
            SELECT 
              type,
              latitude,
              longitude,
              created_at,
              ROW_NUMBER() OVER (
                PARTITION BY type 
                ORDER BY created_at DESC
              ) as rn
            FROM attendance
            WHERE user_id = u.id 
              AND latitude IS NOT NULL 
              AND longitude IS NOT NULL
              AND type IN ('punch_in', 'punch_out')  -- ✅ Only punch_in / punch_out records
          )
          SELECT json_build_object(
            'punch_in', (
              SELECT json_build_object(
                'latitude', latitude,
                'longitude', longitude,
                'created_at', created_at
              )
              FROM last_attendance
              WHERE type = 'punch_in' AND rn = 1
            ),
            'punch_out', (
              SELECT json_build_object(
                'latitude', latitude,
                'longitude', longitude,
                'created_at', created_at
              )
              FROM last_attendance
              WHERE type = 'punch_out' AND rn = 1
            )
          )
        ) as locations
      FROM users u
      WHERE u.role IN ('engineer', 'employee')
      ORDER BY u.name;
    `);

    console.log('Engineers with last punch_in/punch_out locations:', JSON.stringify(query.rows, null, 2));
    res.json(query.rows);
  } catch (err) {
    console.error('Error fetching engineers:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch engineers',
      error: err.message 
    });
  }
});

// Get attendance summary for all users
router.get('/summary/all', async (req, res) => {
    let client = null;
    try {
        const { start, end } = req.query;
        client = await getConnection();
        
        const result = await client.query(`
            SELECT 
                u.id,
                u.name,
                COUNT(a.id) as total_days,
                SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present_days
            FROM users u
            LEFT JOIN attendance a ON u.id = a.user_id 
                AND a.date BETWEEN $1 AND $2
            GROUP BY u.id, u.name
            ORDER BY u.name
        `, [start, end]);

        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching attendance summary:', err);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        if (client) client.release();
    }
});

// Get attendance report for specific user
router.get('/report', async (req, res) => {
    let client = null;
    try {
        const { userId, start, end } = req.query;
        client = await getConnection();
        
        const result = await client.query(`
            SELECT 
                id,
                date,
                punch_in,
                punch_out,
                status,
                notes
            FROM attendance
            WHERE user_id = $1 
            AND date BETWEEN $2 AND $3
            ORDER BY date DESC
        `, [userId, start, end]);

        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching attendance report:', err);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        if (client) client.release();
    }
});

// Get raw attendance records
router.get('/records', async (req, res) => {
    let client = null;
    try {
        const { start, end } = req.query;
        client = await getConnection();
        
        const result = await client.query(`
            SELECT 
                a.id,
                a.date,
                a.punch_in,
                a.punch_out,
                a.status,
                a.notes,
                u.name as user_name,
                u.id as user_id
            FROM attendance a
            JOIN users u ON a.user_id = u.id
            WHERE a.date BETWEEN $1 AND $2
            ORDER BY a.date DESC, u.name
        `, [start, end]);

        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching attendance records:', err);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        if (client) client.release();
    }
});

router.get('/timeline/:userId', requireAuth, async (req, res) => {
    try {
        const { userId } = req.params;
        const { date } = req.query;

        const query = `
            SELECT 
                id,
                punch_type,
                created_at,
                latitude,
                longitude,
                notes
            FROM attendance
            WHERE user_id = $1 
            AND DATE(created_at) = $2::date
            AND punch_type IN ('in', 'out')
            ORDER BY created_at;
        `;

        const result = await pool.query(query, [userId, date]);

        // Format the data for the frontend
        const timeline = result.rows.map(record => ({
            id: record.id,
            latitude: Number(record.latitude),
            longitude: Number(record.longitude),
            updated_at: record.created_at,
            point_type: record.punch_type === 'in' ? 'START' : 'END',
            notes: record.notes
        }));

        res.json({
            success: true,
            timeline
        });

    } catch (err) {
        console.error('Timeline fetch error:', err);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch timeline data'
        });
    }
});

export default router;