import express from "express";
import { pool } from "./db.js";

const router = express.Router();

// Create users table if not exists
const createUsersTable = async () => {
  const query = `
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255),
      role VARCHAR(50) NOT NULL,
      mobile_number VARCHAR(32),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
  try {
    await pool.query(query);
    // Ensure password column exists for older DBs that may lack it
    try {
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password VARCHAR(255);`);
      console.log('Ensured users.password column exists');
    } catch (colErr) {
      console.warn('Could not ensure users.password column:', colErr?.message || colErr);
    }
    try {
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS mobile_number VARCHAR(32);`);
      console.log('Ensured users.mobile_number column exists');
    } catch (colErr) {
      console.warn('Could not ensure users.mobile_number column:', colErr?.message || colErr);
    }
    console.log("✅ Users table is ready.");
  } catch (err) {
    console.error("Error creating users table:", err);
  }
};

// Call the function once when module loads
createUsersTable();

// Signup route removed - signup disabled. Create users via admin UI or direct DB migration.


// Login
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
      console.warn('Login attempt for unknown email:', email);
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const user = result.rows[0];

    // Ensure user.password is a string
    if (typeof user.password !== "string") {
      console.error("Stored password is not a string for user:", user.email, user.password);
      return res.status(500).json({ success: false, message: "Login failed: invalid password stored" });
    }

    // Ensure password from request is also a string
    if (typeof password !== "string") {
      return res.status(400).json({ success: false, message: "Invalid password input" });
    }

    // NOTE: password comparison is plain-text (INSECURE). This intentionally
    // removes bcrypt hashing so the app will compare the supplied password
    // directly with the stored password. Only use in trusted/dev environments.
    const match = password === user.password;

    if (!match) {
      console.warn('Invalid password attempt for user:', user.email);
      return res.status(401).json({ success: false, message: "Invalid password" });
    }

    // Successful login
    res.json({
      success: true,
      role: user.role,
      user: {
        id: user.id || user.user_id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ success: false, message: "Login failed" });
  }
});



export default router;
