import dotenv from "dotenv";
import { Pool } from "pg";
dotenv.config();

const connectionString = process.env.DATABASE_URL || process.env.PG_CONNECTION_STRING || null;
const host = process.env.DB_HOST || process.env.PGHOST || "";
const port = Number(process.env.DB_PORT || process.env.PGPORT || 5432);
const user = process.env.DB_USER || process.env.PGUSER || "";
const password = process.env.DB_PASSWORD || process.env.PGPASSWORD || "";
const database = process.env.DB_NAME || process.env.PGDATABASE || "";

// detect if we should enable SSL (common for Supabase/managed PG)
const shouldUseSsl =
  process.env.DB_SSL === "true" ||
  Boolean(connectionString) ||
  /supabase|amazonaws|rds|heroku|render.com/i.test(host);

const poolConfig = connectionString
  ? { connectionString, max: Number(process.env.DB_MAX_POOL || 10) }
  : {
      host,
      port,
      user,
      password,
      database,
      max: Number(process.env.DB_MAX_POOL || 10),
      idleTimeoutMillis: Number(process.env.DB_IDLE_MS || 30000),
      connectionTimeoutMillis: Number(process.env.DB_CONN_TIMEOUT_MS || 20000), // longer timeout
    };

// attach ssl if required
if (shouldUseSsl) {
  // the pg library accepts ssl: { rejectUnauthorized: false } for many managed DBs
  poolConfig.ssl = { rejectUnauthorized: false };
}

export const pool = new Pool(poolConfig);

// avoid uncaught pool errors
pool.on("error", (err) => {
  console.error("Unexpected Postgres client error (pool):", err?.message || err);
});

// startup connection test with retries
async function testConnection(retries = 6, delayMs = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      const client = await pool.connect();
      client.release();
      console.log("✅ PostgreSQL connected successfully!");
      return;
    } catch (err) {
      console.error(`DB connect attempt ${i + 1} failed:`, err?.message || err);
      if (i === retries - 1) {
        console.error("❌ Unable to connect to Postgres after retries. Exiting.");
        process.exit(1);
      }
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

testConnection().catch((err) => {
  console.error("DB startup test failed:", err?.message || err);
  process.exit(1);
});
