import express from "express";
import { pool } from "./db.js";

const router = express.Router();

// Ensure overtime table
(async function ensureOvertimeTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS overtime_records (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        date DATE NOT NULL,
        worked_seconds INTEGER DEFAULT 0,
        overtime_seconds INTEGER DEFAULT 0,
        shift_id INTEGER,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, date)
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_overtime_user_date ON overtime_records (user_id, date);`);
    console.log("✅ ensured overtime_records table");
  } catch (err) {
    console.error("overtimeRoute startup error:", err?.message ?? err);
  }
})();

// Helper: parse time string 'HH:MM' to seconds from midnight
function timeStrToSeconds(t) {
  if (!t) return null;
  const parts = t.split(":");
  if (parts.length < 2) return null;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 3600 + m * 60;
}

// Compute overtime for a given user and date (YYYY-MM-DD). Returns the upserted record.
export async function computeOvertimeFor(userId, dateStr) {
  try {
    if (!userId || !dateStr) return null;
    // fetch punches for the day
    const attQ = `SELECT MIN(created_at) FILTER (WHERE type='in') AS punch_in, MAX(created_at) FILTER (WHERE type='out') AS punch_out FROM attendances WHERE user_id=$1 AND created_at::date = $2`;
    const attRes = await pool.query(attQ, [Number(userId), dateStr]);
    const row = attRes.rows[0] ?? {};
    const punchIn = row.punch_in ? new Date(row.punch_in) : null;
    const punchOut = row.punch_out ? new Date(row.punch_out) : null;

    let workedSeconds = 0;
    if (punchIn && punchOut && punchOut > punchIn) {
      workedSeconds = Math.max(0, Math.floor((punchOut - punchIn) / 1000));
    }

    // determine shift for user/date
    let shiftId = null;
    let thresholdSeconds = 8 * 3600; // default 8 hours
    try {
      const saQ = `SELECT sa.shift_id, s.start_time, s.end_time FROM shift_assignments sa JOIN shifts s ON sa.shift_id = s.id WHERE sa.user_id=$1 AND sa.date=$2 LIMIT 1`;
      const saRes = await pool.query(saQ, [Number(userId), dateStr]);
      if (saRes.rows && saRes.rows.length) {
        const srow = saRes.rows[0];
        shiftId = srow.shift_id;
        const st = timeStrToSeconds(srow.start_time && srow.start_time.slice(0,5));
        const et = timeStrToSeconds(srow.end_time && srow.end_time.slice(0,5));
        if (st != null && et != null) {
          // handle overnight shift
          thresholdSeconds = et >= st ? (et - st) : (24*3600 - st + et);
        }
      }
    } catch (e) {
      // ignore and use default
      console.warn('computeOvertimeFor: could not fetch shift assignment', e?.message ?? e);
    }

    const overtimeSeconds = Math.max(0, workedSeconds - thresholdSeconds);

    // upsert into overtime_records
    const q = `
      INSERT INTO overtime_records (user_id, date, worked_seconds, overtime_seconds, shift_id)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id, date) DO UPDATE SET worked_seconds = EXCLUDED.worked_seconds, overtime_seconds = EXCLUDED.overtime_seconds, shift_id = EXCLUDED.shift_id, created_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;
    const r = await pool.query(q, [Number(userId), dateStr, Number(workedSeconds), Number(overtimeSeconds), shiftId]);
    return r.rows && r.rows[0] ? r.rows[0] : null;
  } catch (err) {
    console.error('computeOvertimeFor error', err?.message ?? err);
    return null;
  }
}

// GET /api/overtime?userId=&start=&end=
router.get("/", async (req, res) => {
  try {
    const userId = req.query.userId ?? null;
    const now = new Date();
    const defaultStart = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
    const defaultEnd = new Date(now.getFullYear(), now.getMonth()+1, 0).toISOString().slice(0,10);
    const start = req.query.start ?? defaultStart;
    const end = req.query.end ?? defaultEnd;

    const vals = [start, end];
    let where = `WHERE date BETWEEN $1 AND $2`;
    if (userId) { vals.push(Number(userId)); where += ` AND user_id = $${vals.length}`; }

    const q = `SELECT o.*, u.name AS user_name FROM overtime_records o LEFT JOIN users u ON u.id = o.user_id ${where} ORDER BY o.date ASC`;
    const result = await pool.query(q, vals);
    return res.json(result.rows);
  } catch (err) {
    console.error('GET /api/overtime error', err);
    return res.status(500).json({ success: false, message: 'Error fetching overtime', error: err?.message ?? String(err) });
  }
});

// POST /api/overtime/recompute  body: { userId, date }
router.post('/recompute', async (req, res) => {
  try {
    const { userId, date } = req.body || {};
    if (!userId || !date) return res.status(400).json({ success: false, message: 'userId and date required' });
    const rec = await computeOvertimeFor(Number(userId), date);
    return res.json({ success: true, record: rec });
  } catch (err) {
    console.error('/overtime/recompute error', err);
    return res.status(500).json({ success: false, message: 'Error recomputing overtime', error: err?.message ?? String(err) });
  }
});

export default router;
