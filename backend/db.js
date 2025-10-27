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

// Many hosted Postgres providers (Neon, Supabase in certain modes) limit
// concurrent session clients — keep the default small unless overridden.
const DEFAULT_POOL = Number(process.env.DB_MAX_POOL || 5);

function makePoolConfig() {
  const base = connectionString
    ? { connectionString, max: DEFAULT_POOL }
    : {
        host,
        port,
        user,
        password,
        database,
        max: DEFAULT_POOL,
        idleTimeoutMillis: Number(process.env.DB_IDLE_MS || 30000),
        connectionTimeoutMillis: Number(process.env.DB_CONN_TIMEOUT_MS || 30000), // longer timeout
      };
  if (shouldUseSsl) base.ssl = { rejectUnauthorized: false };
  return base;
}

export let pool = null;

function createPool() {
  const p = new Pool(makePoolConfig());
  p.on('error', (err) => {
    console.error('Unexpected Postgres client error (pool):', err?.message || err);
    // Attempt to gracefully recreate the pool after a short delay
    setTimeout(() => {
      try {
        p.end().catch(() => null);
      } catch (e) {}
      console.log('Attempting to recreate Postgres pool...');
      pool = createPool();
    }, 2000);
  });
  return p;
}

// initialize pool
pool = createPool();

// Exported helper to ensure DB connection is ready before starting route startup routines.
export async function ensureDbConnection(retries = 6, delayMs = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      // use a simple query which borrows a client and returns it
      await pool.query('SELECT 1');
      console.log('✅ PostgreSQL connected successfully!');
      return;
    } catch (err) {
      console.error(`DB connect attempt ${i + 1} failed:`, err?.message || err);
      if (i === retries - 1) {
        console.error('❌ Unable to connect to Postgres after retries. Exiting.');
        process.exit(1);
      }
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}