import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

// Convert DB_SSL env variable to boolean
const useSSL = process.env.DB_SSL === "true";

export const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  ssl: useSSL ? { rejectUnauthorized: false } : false,
  idleTimeoutMillis: 30000,       // 30 seconds idle timeout
  connectionTimeoutMillis: 5000,  // 5 seconds to connect
});

// Test the database connection
(async () => {
  try {
    const client = await pool.connect();
    console.log("✅ PostgreSQL connected successfully!");
    client.release();
  } catch (err) {
    console.error("❌ PostgreSQL connection error:", err);
  }
})();

// Handle unexpected errors on idle clients (do not crash app)
pool.on("error", (err, client) => {
  if (err.code === "XX000" || err.message.includes("client_termination")) {
    console.warn("⚠️ Idle client terminated by server (safe to ignore).");
  } else {
    console.error("❌ Unexpected error on idle client:", err);
  }
});
