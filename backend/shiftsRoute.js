import express from "express";
import { pool } from "./db.js";

const router = express.Router();

// Ensure shifts + assignments tables
(async function ensureShiftsTables() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS shifts (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS shift_assignments (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        shift_id INTEGER NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (user_id, date)
      );
    `);
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
    const result = await pool.query(`SELECT * FROM shifts ORDER BY id ASC`);
    res.json(result.rows);
  } catch (err) {
    console.error("List shifts error:", err);
    res.status(500).json({ success: false, message: "Error listing shifts", error: err.message });
  }
});

// Assign a shift to a user for a date (defaults allowed client-side)
// POST /api/shifts/assign
// body: { userId, shiftId, date: "YYYY-MM-DD" }
router.post("/assign", async (req, res) => {
  try {
    const { userId, shiftId, date } = req.body;
    if (!userId || !shiftId || !date) return res.status(400).json({ success: false, message: "userId, shiftId and date are required" });

    // upsert: if user already has assignment for date, replace
    const q = `
      INSERT INTO shift_assignments (user_id, shift_id, date)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id, date) DO UPDATE SET shift_id = EXCLUDED.shift_id, created_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;
    const result = await pool.query(q, [Number(userId), Number(shiftId), date]);
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

    const where = [];
    const vals = [];
    if (date) { vals.push(date); where.push(`sa.date = $${vals.length}`); }
    if (userId) { vals.push(Number(userId)); where.push(`sa.user_id = $${vals.length}`); }

    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const q = `
      SELECT sa.*, s.name AS shift_name, s.start_time, s.end_time, u.name AS user_name, u.email
      FROM shift_assignments sa
      JOIN shifts s ON sa.shift_id = s.id
      LEFT JOIN users u ON sa.user_id = u.id
      ${whereClause}
      ORDER BY sa.date, sa.user_id;
    `;
    const result = await pool.query(q, vals);
    res.json(result.rows);
  } catch (err) {
    console.error("Get assignments error:", err);
    res.status(500).json({ success: false, message: "Error fetching assignments", error: err.message });
  }
});

export default router;