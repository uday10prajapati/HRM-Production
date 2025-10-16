import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

// Use individual environment variables for cloud/db connection
export const pool = new Pool({
  user: process.env.DB_USER,           // postgres
  password: process.env.DB_PASSWORD,   // your password
  host: process.env.DB_HOST,           // db.jsntgyzzggfihqszxjer.supabase.co
  port: Number(process.env.DB_PORT),   // 5432
  database: process.env.DB_NAME,       // postgres
  ssl: { rejectUnauthorized: false },  // Required for most cloud Postgres providers
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
