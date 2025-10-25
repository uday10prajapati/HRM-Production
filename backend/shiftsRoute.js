import express from "express";
import { pool } from "./db.js";

const router = express.Router();

// Ensure shifts + assignments tables
(async function ensureShiftsTables() {
  try {
    await pool.query(`
      CREATE EXTENSION IF NOT EXISTS pgcrypto;
      CREATE TABLE IF NOT EXISTS shifts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS shift_assignments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
        user_role TEXT,
        date DATE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (user_id, date)
      );
    `);
    // Ensure user_role column exists for older databases that don't have it
    try {
      await pool.query(`ALTER TABLE IF EXISTS shift_assignments ADD COLUMN IF NOT EXISTS user_role TEXT`);
    } catch (e) {
      console.warn('Could not ensure shift_assignments.user_role column exists:', e?.message || e);
    }
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_shift_assignments_user_date ON shift_assignments (user_id, date);`);
    console.log("✅ ensured shifts and shift_assignments tables");
  } catch (err) {
    console.error("shiftsRoute startup error:", err.message || err);
  }
})();

// Create a shift
// POST /api/shifts
// body: { name, start_time: "HH:MM", end_time: "HH:MM" }
router.post("/", async (req, res) => {
  try {
    const { name, start_time, end_time } = req.body;
    if (!name || !start_time || !end_time) return res.status(400).json({ success: false, message: "name, start_time and end_time required" });

    const q = `INSERT INTO shifts (name, start_time, end_time) VALUES ($1, $2, $3) RETURNING *`;
    const result = await pool.query(q, [name, start_time, end_time]);
    res.status(201).json({ success: true, shift: result.rows[0] });
  } catch (err) {
    console.error("Create shift error:", err);
    res.status(500).json({ success: false, message: "Error creating shift", error: err.message });
  }
});

// List shifts
// GET /api/shifts
router.get("/", async (req, res) => {
  try {
    const q = `SELECT * FROM shifts ORDER BY id ASC`;
    console.log('GET /api/shifts executing:', q);
    const result = await pool.query(q);
    return res.json(result.rows);
  } catch (err) {
    console.error("List shifts error:", err?.message || err);
    if (err && err.stack) console.error(err.stack);
    // If table/extension is missing, try to create them and retry once
    try {
      console.log('Attempting to ensure shifts table and retry...');
      await pool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto; CREATE TABLE IF NOT EXISTS shifts ( id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL, start_time TIME NOT NULL, end_time TIME NOT NULL, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP );`);
      const retry = await pool.query(`SELECT * FROM shifts ORDER BY id ASC`);
      return res.json(retry.rows);
    } catch (err2) {
      console.error('Retry after ensuring table failed:', err2?.message || err2);
      if (err2 && err2.stack) console.error(err2.stack);
      return res.status(500).json({ success: false, message: "Error listing shifts", error: err2?.message ?? String(err2) });
    }
  }
});

// Assign a shift to a user for a date (defaults allowed client-side)
// POST /api/shifts/assign
// body: { userId, shiftId, date: "YYYY-MM-DD" }
router.post("/assign", async (req, res) => {
  try {
    const { userId, shiftId, date } = req.body;
    if (!userId || !shiftId || !date) return res.status(400).json({ success: false, message: "userId, shiftId and date are required" });

    // Before inserting, attempt to make the assignment table tolerant to mixed id types.
    // Some deployments still use integer user/shift ids while newer rows are UUIDs.
    // If the existing columns are not TEXT, try to ALTER them to TEXT using "USING col::text".
    // This is best-effort: if the DB user lacks ALTER privileges this will fail and we fall back to
    // running the insert with string params (which will still fail if the column is integer).
    try {
      const cols = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'shift_assignments' AND column_name IN ('user_id','shift_id')`);
      for (const r of cols.rows) {
        const col = r.column_name;
        const dt = r.data_type;
        if (dt !== 'text') {
          // If this is shift_id and there's a FK to shifts(id), altering the column type will fail.
          if (col === 'shift_id') {
            try {
              const fk = await pool.query(`
                SELECT tc.constraint_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
                WHERE tc.table_name = 'shift_assignments' AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'shift_id'
                LIMIT 1
              `);
              if (fk.rows && fk.rows.length > 0) {
                console.log(`Skipping ALTER of shift_assignments.shift_id because foreign key constraint ${fk.rows[0].constraint_name} exists`);
                continue; // skip altering this column
              }
            } catch (fkErr) {
              console.warn('Could not determine FK existence for shift_assignments.shift_id:', fkErr?.message || fkErr);
              // fallthrough to attempt alter
            }
          }

          try {
            console.log(`Attempting to ALTER shift_assignments.${col} to TEXT (was ${dt})...`);
            await pool.query(`ALTER TABLE shift_assignments ALTER COLUMN ${col} TYPE TEXT USING ${col}::text;`);
            console.log(`✅ altered shift_assignments.${col} to TEXT`);
          } catch (alterErr) {
            // Log but don't crash — we will still try the insert and return a helpful error if it fails.
            console.warn(`Could not ALTER shift_assignments.${col} to TEXT:`, alterErr?.message || alterErr);
          }
        }
      }
    } catch (colErr) {
      console.warn('Could not inspect shift_assignments columns:', colErr?.message || colErr);
    }

    // Validate provided shift exists (avoid FK error and return a helpful 400)
    try {
      const shiftCheck = await pool.query('SELECT id FROM shifts WHERE id::text = $1 LIMIT 1', [String(shiftId)]);
      if (!shiftCheck.rows || shiftCheck.rows.length === 0) {
        // provide helpful debug info back to client: available shifts
        try {
          const allShifts = await pool.query('SELECT id, name, start_time, end_time FROM shifts ORDER BY id ASC LIMIT 200');
          return res.status(400).json({ success: false, message: 'Invalid shiftId: shift not found', availableShifts: allShifts.rows });
        } catch (listErr) {
          console.warn('Could not fetch shifts list for debugging:', listErr?.message || listErr);
          return res.status(400).json({ success: false, message: 'Invalid shiftId: shift not found' });
        }
      }
    } catch (shiftCheckErr) {
      console.warn('Could not validate shift existence before assignment:', shiftCheckErr?.message || shiftCheckErr);
      // proceed — will surface DB error if constraint fails
    }

    // Resolve user's role so we can store it alongside the assignment
    let userRole = null;
    try {
      const r = await pool.query('SELECT role FROM users WHERE id::text = $1 LIMIT 1', [String(userId)]);
      if (r.rows && r.rows[0]) userRole = r.rows[0].role ?? null;
    } catch (roleErr) {
      console.warn('Could not resolve user role for shift assignment:', roleErr?.message || roleErr);
    }

    // upsert: if user already has assignment for date, replace and update stored role
    const q = `
      INSERT INTO shift_assignments (user_id, shift_id, date, user_role)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id, date) DO UPDATE SET shift_id = EXCLUDED.shift_id, user_role = EXCLUDED.user_role, created_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;

    // Use stringified params to avoid type mismatch when id columns are TEXT
    const result = await pool.query(q, [String(userId), String(shiftId), date, userRole]);
    res.json({ success: true, assignment: result.rows[0] });
  } catch (err) {
    console.error("Assign shift error:", err);
    res.status(500).json({ success: false, message: "Error assigning shift", error: err.message });
  }
});

// Get assignments (by date or user)
// GET /api/shifts/assignments?date=YYYY-MM-DD&userId=...
router.get("/assignments", async (req, res) => {
  try {
    const date = req.query.date ?? null;
    const userId = req.query.userId ?? null;

    // validate date if provided (YYYY-MM-DD) to avoid Postgres date parsing errors
    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    if (date && !dateRe.test(String(date))) {
      return res.status(400).json({ success: false, message: 'Invalid date format, expected YYYY-MM-DD' });
    }

    const where = [];
    const vals = [];
    if (date) { vals.push(date); where.push(`sa.date = $${vals.length}`); }
    if (userId) {
      // Accept both UUID and legacy integer-like user IDs from clients.
      // Compare user_id as text to avoid Postgres type-mismatch errors when DB contains UUIDs
      // but the incoming value is an integer string (or vice-versa).
      vals.push(String(userId));
      where.push(`sa.user_id::text = $${vals.length}`);
    }

    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const q = `
      SELECT sa.*, s.name AS shift_name, s.start_time, s.end_time, u.name AS user_name, u.email
      FROM shift_assignments sa
      JOIN shifts s ON sa.shift_id::text = s.id::text
      LEFT JOIN users u ON sa.user_id::text = u.id::text
      ${whereClause}
      ORDER BY sa.date, sa.user_id;
    `;
    // debug: log incoming params and the final query for easier debugging of 500s
    console.log('GET /api/shifts/assignments called with', { date, userId });
    console.log('shifts assignments SQL:', q);
    console.log('shifts assignments vals:', vals);
    const result = await pool.query(q, vals);
    res.json(result.rows);
  } catch (err) {
    console.error("Get assignments error:", err?.message || err);
    // print stack if available for debugging
    if (err && err.stack) console.error(err.stack);
    res.status(500).json({ success: false, message: "Error fetching assignments", error: err?.message ?? String(err) });
  }
});

export default router;