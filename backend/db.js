import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

// Create a new pool using environment variables
export const pool = new Pool({
  user: process.env.DB_USER,           // postgres
  host: process.env.DB_HOST,           // Supabase host
  database: process.env.DB_NAME,       // postgres
  password: process.env.DB_PASSWORD,   // your password
  port: process.env.DB_PORT,           // 5432
  ssl: { rejectUnauthorized: false },  // Required for Supabase
});

// Test the database connection
pool.connect()
  .then(client => {
    console.log("✅ PostgreSQL connected successfully!");
    client.release();
  })
  .catch(err => {
    console.error("❌ PostgreSQL connection error:", err);
  });
