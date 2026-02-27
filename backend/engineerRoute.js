import express from "express";
import { pool } from "./db.js";

const router = express.Router();

router.post("/login", async (req, res) => {
    const { email, mobile_number, password } = req.body;

    if ((!email && !mobile_number) || !password) {
        return res.status(400).json({ success: false, message: "Email or Mobile Number and Password are required." });
    }

    try {
        let query, values;

        if (email) {
            query = "SELECT * FROM public.users WHERE email = $1";
            values = [email];
        } else {
            query = "SELECT * FROM public.users WHERE mobile_number = $1";
            values = [mobile_number];
        }

        // NOTE: If using numeric type for mobile_number, parameterization might need casting if passed as string
        // Here we'll just pass the string and let pg handle mapping to numeric if needed, 
        // but a cast '$1::numeric' might be necessary if type is strict numeric.

        const result = await pool.query(query, values);

        if (result.rows.length === 0) {
            console.warn('Engineer login attempt for unknown user:', email || mobile_number);
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const user = result.rows[0];

        // Ensure password from request is a string
        if (typeof password !== "string") {
            return res.status(400).json({ success: false, message: "Invalid password input" });
        }

        // Role check to ensure only engineers (or employees acting as engineers) can log in via this route? 
        // The prompt just says engineer login.
        // If you want strict role checking: 
        // if (user.role !== 'engineer' && user.role !== 'Engineer') {
        //  return res.status(403).json({ success: false, message: "Access denied: Not an engineer account." });
        // }

        // Password comparison is plain-text as requested/implied in codebase
        const match = password === user.password;

        if (!match) {
            console.warn('Invalid password attempt for engineer:', user.email || user.mobile_number);
            return res.status(401).json({ success: false, message: "Invalid password" });
        }

        // Successful login
        res.json({
            success: true,
            role: user.role,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                mobile_number: user.mobile_number,
                role: user.role,
                leave_balance: user.leave_balance,
            },
        });
    } catch (err) {
        console.error("Engineer Login Error:", err);
        res.status(500).json({ success: false, message: "Login failed due to a server error." });
    }
});

// Change Password Route
router.post("/reset-password", async (req, res) => {
    const { identifier, newPassword, userId } = req.body;

    if (!newPassword) {
        return res.status(400).json({ success: false, message: "New password is required." });
    }

    try {
        let query, values;

        if (userId) {
            query = "UPDATE public.users SET password = $1 WHERE id = $2 RETURNING id";
            values = [newPassword, userId];
        } else if (identifier) {
            const isEmail = identifier.includes("@");
            if (isEmail) {
                query = "UPDATE public.users SET password = $1 WHERE email = $2 RETURNING id";
            } else {
                query = "UPDATE public.users SET password = $1 WHERE mobile_number = $2 RETURNING id";
            }
            values = [newPassword, identifier.trim()];
        } else {
            return res.status(400).json({ success: false, message: "Identifier or User ID is required." });
        }

        const result = await pool.query(query, values);

        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: "User not found or updating failed." });
        }

        res.json({ success: true, message: "Password updated successfully." });
    } catch (err) {
        console.error("Change Password Error:", err);
        res.status(500).json({ success: false, message: "Failed to update password." });
    }
});

export default router;
