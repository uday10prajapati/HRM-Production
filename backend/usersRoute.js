import express from "express";
import { pool } from "./db.js";
import bcrypt from 'bcryptjs';

const router = express.Router();

// GET all users
router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT id, name, email, role, leave_balance, attendance_status FROM users ORDER BY id ASC");
    res.json({ success: true, users: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error fetching users" });
  }
});

// POST create new user
router.post("/create", async (req, res) => {
  const { name, email, role, password, leaveBalance, attendanceStatus } = req.body;
  if (!password) {
    return res.status(400).json({ success: false, message: "Password is required" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    const result = await pool.query(
      `INSERT INTO users (name, email, role, leave_balance, attendance_status, password)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, email, role, leaveBalance, attendanceStatus, hashedPassword]
    );
    res.status(201).json({ success: true, user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error creating user" });
  }
});

// PUT update a user by ID
router.put("/update/:id", async (req, res) => {
  const { id } = req.params;
  const { name, email, role, leaveBalance, attendanceStatus } = req.body;
  try {
    const result = await pool.query(
      `UPDATE users SET name=$1, email=$2, role=$3, leave_balance=$4, attendance_status=$5
       WHERE id=$6 RETURNING *`,
      [name, email, role, leaveBalance, attendanceStatus, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error updating user" });
  }
});

// DELETE a user by ID
router.delete("/delete/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query("DELETE FROM users WHERE id=$1 RETURNING *", [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    res.json({ success: true, message: "User deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error deleting user" });
  }
});

export default router;
