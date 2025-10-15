import express from "express";
import { pool } from "./db.js"; // Make sure you have db.js configured

const router = express.Router();

// GET all users
router.get("/", async (req, res) => {
    try {
        const result = await pool.query("SELECT id, name, email, role, created_at FROM users ORDER BY id ASC");
        res.json({ success: true, users: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Error fetching users" });
    }
});

export default router;
