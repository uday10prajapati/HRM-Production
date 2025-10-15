import express from "express";
import bcrypt from "bcryptjs";
import { pool } from "./db.js";

const router = express.Router();

// Signup
router.post("/signup", async (req, res) => {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password || !role) {
        return res.json({ success: false, message: "All fields required" });
    }
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const query = "INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING *";
        const values = [name, email, hashedPassword, role];
        const result = await pool.query(query, values);
        res.json({ success: true, user: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.json({ success: false, message: "Signup failed" });
    }
});

// Login
router.post("/login", async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.json({ success: false, message: "All fields required" });
    }

    try {
        const query = "SELECT * FROM users WHERE email = $1";
        const result = await pool.query(query, [email]);

        if (result.rows.length === 0) {
            return res.json({ success: false, message: "User not found" });
        }

        const user = result.rows[0];
        const match = await bcrypt.compare(password, user.password);

        if (!match) {
            return res.json({ success: false, message: "Invalid password" });
        }

        // ✅ successful login
        res.json({ success: true, role: user.role });
    } catch (err) {
        console.error("Login Error:", err);
        res.status(500).json({ success: false, message: "Login failed" });
    }
});


export default router;
