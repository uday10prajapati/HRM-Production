import { pool } from "./db.js";

const seedUser = async () => {
    try {
        const email = "admin@example.com";
        const password = "password123"; // INSECURE: Storing plain text as per current app logic
        const name = "Admin User";
        const role = "admin";
        const mobile = "1234567890";

        console.log("Checking if admin user exists...");

        // Check if user exists
        const checkQuery = "SELECT * FROM users WHERE email = $1";
        const checkResult = await pool.query(checkQuery, [email]);

        if (checkResult.rows.length > 0) {
            console.log("⚠️ User already exists. Skipping seed.");
        } else {
            // Create table if not exists (just in case)
            await pool.query(`
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
        `);

            const insertQuery = `
        INSERT INTO users (name, email, password, role, mobile_number)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *;
      `;
            const res = await pool.query(insertQuery, [name, email, password, role, mobile]);
            console.log("✅ Admin user seeded successfully:");
            console.log("Email:", email);
            console.log("Password:", password);
        }
    } catch (err) {
        console.error("❌ Error seeding user:", err);
    } finally {
        // Close the pool to allow the script to exit
        await pool.end();
    }
};

seedUser();
