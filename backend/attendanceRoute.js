import express from "express";
import { pool } from "./db.js";

const router = express.Router();

// ensure attendances table exists (safe startup)
(async function ensureAttendancesTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS attendances (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        type VARCHAR(16) NOT NULL,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_attendances_user_created_at ON attendances (user_id, created_at);`);
    console.log("attendanceRoute: ensured attendances table exists");
  } catch (err) {
    console.error("attendanceRoute startup error:", err?.message ?? err);
  }
})();

// POST /api/attendance/punch
// body: { userId, type: 'in'|'out', notes? }
// stores timestamp in created_at
router.post("/punch", async (req, res) => {
  try {
    const body = req.body || {};
    const userId = body.userId ?? body.user_id ?? null;
    const typeRaw = (body.type ?? "").toString().toLowerCase();
    if (!userId) return res.status(400).json({ success: false, message: "Missing userId" });

    const type = typeRaw === "in" || typeRaw === "punch_in" ? "in"
               : typeRaw === "out" || typeRaw === "punch_out" ? "out"
               : null;
    if (!type) return res.status(400).json({ success: false, message: "Invalid punch type, expected 'in' or 'out'" });

    const q = `INSERT INTO attendances (user_id, type, notes) VALUES ($1,$2,$3) RETURNING *;`;
    const result = await pool.query(q, [Number(userId), type, body.notes ?? null]);
    if (!result || !result.rows || result.rows.length === 0) {
      console.error('attendanceRoute /punch: insert returned no rows', { userId, type, notes: body.notes });
      return res.status(500).json({ success: false, message: 'Failed to save attendance' });
    }

    // recompute overtime for the date of the punch (best-effort)
    try {
      const { computeOvertimeFor } = await import("./overtimeRoute.js");
      const created = result.rows[0]?.created_at;
      if (created) {
        const date = new Date(created).toISOString().slice(0,10);
        // fire-and-forget
        computeOvertimeFor(Number(userId), date).catch(e => console.warn('computeOvertimeFor failed', e));
      }
    } catch (e) {
      console.warn('Could not import overtime recompute:', e?.message ?? e);
    }

    return res.json({ success: true, message: "Attendance saved", attendance: result.rows[0] });
  } catch (err) {
    console.error("attendanceRoute /punch error:", err?.message ?? err);
    return res.status(500).json({ success: false, message: "Error saving attendance", error: err?.message ?? String(err) });
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
      const asNum = Number(userIdRaw);
      if (Number.isNaN(asNum)) {
        return res.status(400).json({ success: false, message: 'Invalid userId' });
      }
      vals.push(asNum);
      where.push(`user_id = $${vals.length}`);
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
        FROM attendances
        ${whereClause}
        GROUP BY user_id, created_at::date
      ) per
      LEFT JOIN users u ON u.id = per.user_id
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
      FROM attendances
      WHERE user_id=$1 AND type='in' AND created_at::date BETWEEN $2 AND $3
    `;
    const workedRes = await pool.query(workedQ, [Number(userId), start, end]);
    const workedDays = Number(workedRes.rows[0]?.worked_days ?? 0);

    // leave days: sum of overlapping days in leaves table
    const leaveQ = `
      SELECT COALESCE(SUM(
        GREATEST(0,
          (LEAST(end_date::date, $3::date) - GREATEST(start_date::date, $2::date)) + 1
        )
      ),0) AS leave_days
      FROM leaves
      WHERE user_id=$1 AND NOT (end_date::date < $2::date OR start_date::date > $3::date)
    `;
    const leaveRes = await pool.query(leaveQ, [Number(userId), start, end]);
    const leaveDays = Number(leaveRes.rows[0]?.leave_days ?? 0);

    return res.json({ success: true, userId: Number(userId), month, start, end, workedDays, leaveDays });
  } catch (err) {
    console.error("attendanceRoute /summary error:", err?.message ?? err);
    return res.status(500).json({ success: false, message: "Error generating summary", error: err?.message ?? String(err) });
  }
});

export default router;

// GET /api/attendance/summary/all?start=YYYY-MM-DD&end=YYYY-MM-DD
// returns for each user: user_id, name, role, workedDays, leaveDays, today_punch_in, today_punch_out, present_today(boolean)
router.get('/summary/all', async (req, res) => {
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
        FROM attendances
        WHERE type='in' AND created_at::date BETWEEN $1 AND $2
        GROUP BY user_id
      ) att ON att.user_id = u.id
      LEFT JOIN (
        SELECT user_id, COALESCE(SUM(GREATEST(0, (LEAST(end_date::date, $2::date) - GREATEST(start_date::date, $1::date)) + 1)),0) AS leave_days
        FROM leaves
        WHERE NOT (end_date::date < $1::date OR start_date::date > $2::date)
        GROUP BY user_id
      ) l ON l.user_id = u.id
      LEFT JOIN (
        SELECT user_id,
          to_char(MIN(created_at) FILTER (WHERE type='in'), 'YYYY-MM-DD HH24:MI:SS') AS punch_in,
          to_char(MAX(created_at) FILTER (WHERE type='out'), 'YYYY-MM-DD HH24:MI:SS') AS punch_out
        FROM attendances
        WHERE created_at::date = $3
        GROUP BY user_id
      ) td ON td.user_id = u.id
      ORDER BY u.name ASC;
    `;

    const today = new Date().toISOString().slice(0,10);
    const result = await pool.query(q, [start, end, today]);
    return res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('/attendance/summary/all error', err);
    return res.status(500).json({ success: false, message: 'Error fetching attendance summary', error: err?.message ?? String(err) });
  }
});
