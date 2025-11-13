// backend/attendanceCorrectionRoute.js
import express from "express";
import { pool } from "./db.js"; // make sure this points to your PostgreSQL pool

const router = express.Router();

// ✅ GET all correction reports
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, user_id, name, report_text FROM attendance_reports ORDER BY id DESC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching correction reports:", err);
    res.status(500).json({ error: "Failed to fetch correction reports" });
  }
});

export default router;
