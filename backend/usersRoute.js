import express from "express";
import { pool } from "./db.js";
// bcrypt removed - storing plain-text passwords (INSECURE)
import requireAuth from './authMiddleware.js';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY; // Prefer service role for admin actions
const supabase = (supabaseUrl && supabaseServiceKey) ? createClient(supabaseUrl, supabaseServiceKey) : null;
if (supabase && (!supabase.auth || !supabase.auth.admin)) {
  console.error("⚠️ Supabase client initialized, but auth.admin is missing. Ensure SUPABASE_SERVICE_ROLE_KEY is used, not the anon key.");
}

const router = express.Router();

// Ensure tasks table has expected columns (safe on startup)
(async function ensureTaskColumns() {
  try {
    await pool.query(`
      CREATE EXTENSION IF NOT EXISTS pgcrypto;
      ALTER TABLE IF EXISTS tasks ADD COLUMN IF NOT EXISTS status VARCHAR(32) DEFAULT 'pending';
      ALTER TABLE IF EXISTS tasks ADD COLUMN IF NOT EXISTS assigned_by VARCHAR(128);
    `);
    console.log("✅ Ensured tasks table columns: status, assigned_by");
  } catch (err) {
    console.warn("Could not ensure tasks columns:", err.message || err);
  }
})();

// Ensure users table has mobile_number column (safe on startup)
(async function ensureUsersMobileColumn() {
  try {
    await pool.query(`ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS mobile_number VARCHAR(32)`);
    console.log('✅ Ensured users.mobile_number column exists (or table missing)');
  } catch (err) {
    console.warn('Could not ensure users.mobile_number column:', err?.message || err);
  }
})();

// Ensure pgcrypto extension exists so gen_random_uuid() is available for inserts
(async function ensurePgcrypto() {
  try {
    await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
    // also ensure users.id default exists where possible (safe no-op if table missing)
    await pool.query("ALTER TABLE IF EXISTS users ALTER COLUMN id SET DEFAULT gen_random_uuid();").catch(() => null);
  } catch (err) {
    // do not block startup - just warn
    console.warn('Could not ensure pgcrypto extension or id default:', err?.message || err);
  }
})();

// Create tasks table if it doesn't exist (safe startup helper)
(async function createTasksTableIfMissing() {
  try {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS tasks (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          description TEXT,
          status VARCHAR(32) DEFAULT 'pending',
          assigned_by VARCHAR(128),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
    console.log("✅ Ensured tasks table exists");
  } catch (err) {
    console.warn("Could not create tasks table:", err.message || err);
  }
})();

// GET all users
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        u.id AS id,
        u.name,
        u.mobile_number,
        u.email,
        u.role,
        u.leave_balance,
        
        COALESCE(
          json_agg(
            json_build_object(
              'id', t.id,
              'title', t.title,
              'description', t.description,
              'status', t.status,
              'assignedBy', t.assigned_by,
              'assignedTo', t.assigned_to,
              'customerName', t.customer_name,
              'customerAddress', t.customer_address,
              'customerMobile', t.customer_mobile,
              'created_at', t.created_at
            )
          ) FILTER (WHERE t.id IS NOT NULL),
          '[]'
        ) AS tasks
      FROM users u
  LEFT JOIN tasks t ON u.id::text = t.user_id::text
      GROUP BY u.id
      ORDER BY u.id ASC
    `);
    res.json({ success: true, users: result.rows });
  } catch (err) {
    console.error('GET /api/users query error:', err?.message || err);
    // If tasks or other joined table is missing (e.g., migrations didn't run or extension unavailable),
    // fall back to a simpler users-only query so the frontend can still load a user list.
    if (/relation \"tasks\" does not exist/i.test(String(err?.message || '')) || /does not exist/i.test(String(err?.message || ''))) {
      try {
        const fallback = await pool.query('SELECT id, name, email, role, leave_balance FROM users ORDER BY id ASC');
        return res.json({ success: true, users: fallback.rows });
      } catch (err2) {
        console.error('Fallback users query failed:', err2?.message || err2);
      }
    }

    res.status(500).json({ success: false, message: "Error fetching users", error: err.message });
  }
});

// NEW: GET current user (client should send X-User-Id header or ?userId=)
// Place before /:id so "me" does not get treated as an id
router.get("/me", async (req, res) => {
  try {
    const authId = req.user?.id ?? null;
    const headerId = req.header("x-user-id") ?? req.query.userId ?? null;
    const id = authId ?? headerId;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Missing user id (set X-User-Id header or use auth middleware)",
      });
    }

    // Accept both UUID and legacy integer-like ids. We'll compare as text
    // so Postgres doesn't error when comparing uuid = integer.
    const result = await pool.query(
      `
      SELECT 
        u.id AS id,
        u.name,
        u.mobile_number,
        u.email,
        u.role,
        u.leave_balance,
        
        COALESCE(
          json_agg(
            json_build_object(
              'id', t.id,
              'title', t.title,
              'description', t.description,
              'status', t.status,
              'assignedBy', t.assigned_by,
              'assignedTo', t.assigned_to,
              'customerName', t.customer_name,
              'customerAddress', t.customer_address,
              'customerMobile', t.customer_mobile,
              'created_at', t.created_at
            )
          ) FILTER (WHERE t.id IS NOT NULL),
          '[]'
        ) AS tasks
      FROM users u
  LEFT JOIN tasks t ON u.id::text = t.user_id::text
  WHERE u.id::text = $1
      GROUP BY u.id
      LIMIT 1
    `,
      [id]
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    console.error("GET /users/me error:", err);
    return res.status(500).json({ success: false, message: "Error fetching user", error: err.message });
  }
});

// GET single user by ID (including tasks) - validate id inside handler
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    // Accept both UUID and legacy integer-like ids. Compare as text to avoid
    // uuid = integer operator errors.
    const result = await pool.query(
      `
      SELECT 
        u.id AS id,
        u.name,
        u.mobile_number,
        u.email,
        u.role,
        u.leave_balance,
        
        COALESCE(
          json_agg(
            json_build_object(
              'id', t.id,
              'title', t.title,
              'description', t.description,
              'status', t.status,
              'assignedBy', t.assigned_by,
              'customerName', t.customer_name,
              'customerAddress', t.customer_address,
              'customerMobile', t.customer_mobile,
              'created_at', t.created_at
            )
          ) FILTER (WHERE t.id IS NOT NULL),
          '[]'
        ) AS tasks
      FROM users u
  LEFT JOIN tasks t ON u.id::text = t.user_id::text
  WHERE u.id::text = $1
      GROUP BY u.id
      LIMIT 1
    `,
      [id]
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error fetching user", error: err.message });
  }
});

// POST create new user
// POST /create - create a user. Only admin may create users via the API.
router.post("/create", requireAuth, async (req, res) => {
  // only admin allowed
  const roleRequester = req.user?.role ?? null;
  if (roleRequester !== 'admin') return res.status(403).json({ success: false, message: 'Forbidden: only admin may create users' });
  const {
    name,
    email,
    role,
    password,
    leave_balance,
    leaveBalance,
    attendanceStatus,
    mobile_number,
  } = req.body;

  const leaveBal = Number(leave_balance ?? leaveBalance ?? 20);
  const attendanceStat = attendanceStatus ?? "";

  if (!password) {
    return res.status(400).json({ success: false, message: "Password is required" });
  }

  // store plain password directly (INSECURE)
  const hashedPassword = password;

  try {
    console.error("[DEBUG] Starting user creation for:", email);
    let newUserId = null;
    let supabaseError = null;

    // 1. Create in Supabase Auth if credentials available
    if (supabase) {
      if (!supabase.auth || !supabase.auth.admin) {
        console.error("[DEBUG] Supabase skipped: auth.admin not available.");
      } else {
        console.error("[DEBUG] Attempting Supabase creation...");
        const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { name, role, mobile_number }
        });

        if (authErr) {
          console.error('[DEBUG] Supabase Auth createUser failed:', authErr.message);
          supabaseError = authErr.message;
        } else if (authData && authData.user) {
          console.error('[DEBUG] Created user in Supabase Auth:', authData.user.id);
          newUserId = authData.user.id;
        }
      }
    } else {
      console.error('[DEBUG] Supabase client not initialized, skipping.');
    }

    // 2. Create in Local DB
    // Use the Supabase ID if we have it, otherwise generate one locally
    const finalId = newUserId || crypto.randomUUID();

    const result = await pool.query(
      `INSERT INTO users (id, name, email, role, leave_balance, password, mobile_number)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [finalId, name, email, role, leaveBal, hashedPassword, mobile_number]
    );

    res.status(201).json({
      success: true,
      user: result.rows[0],
      supabaseSync: !!newUserId,
      supabaseError
    });
  } catch (err) {
    console.error("[DEBUG] Create User Error Stack:", err.stack);
    res.status(500).json({ success: false, message: "Error creating user", error: err.message });
  }
});

// PUT update a user by ID
router.put("/update/:id", async (req, res) => {
  const { id } = req.params;
  const {
    name,
    email,
    role,
    leave_balance,
    leaveBalance,

    attendanceStatus,
    mobile_number,
  } = req.body;

  const leaveBal = Number(leave_balance ?? leaveBalance ?? null);
  const attendanceStat = attendanceStatus ?? null;

  try {
    const result = await pool.query(
      `UPDATE users SET name=$1, email=$2, role=$3, leave_balance=$4, mobile_number=$5
       WHERE id=$6 RETURNING *`,
      [name, email, role, leaveBal, mobile_number, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error updating user", error: err.message });
  }
});

// DELETE a user by ID
router.delete("/delete/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query("DELETE FROM users WHERE id=$1 RETURNING *", [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    res.json({ success: true, message: "User deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error deleting user", error: err.message });
  }
});

// POST /api/users/fcm-token - set the caller's FCM token (or admin can set for a user)
router.post('/fcm-token', requireAuth, async (req, res) => {
  try {
    const requesterId = req.user?.id;
    const requesterRole = req.user?.role;
    const { fcm_token, userId } = req.body;
    // allow admins to set for any user, otherwise set for requester only
    const targetId = (requesterRole && requesterRole.toString().toLowerCase() === 'admin' && userId) ? userId : requesterId;
    if (!targetId) return res.status(400).json({ success: false, message: 'Missing user id' });
    await pool.query('ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS fcm_token TEXT');
    const r = await pool.query('UPDATE users SET fcm_token=$1 WHERE id::text=$2 RETURNING id, fcm_token', [fcm_token || null, String(targetId)]);
    if (!r.rows || r.rows.length === 0) return res.status(404).json({ success: false, message: 'User not found' });
    return res.json({ success: true, message: 'FCM token updated', user: r.rows[0] });
  } catch (err) {
    console.error('/users/fcm-token error', err);
    return res.status(500).json({ success: false, message: 'Error updating fcm token', error: err?.message || String(err) });
  }
});

// POST assign a task to a user
router.post("/assign-task", async (req, res) => {
  // Accept either userId or userEmail to identify the target engineer/user
  const { userId, userEmail } = req.body;

  let tasks = req.body.tasks;
  if (!tasks || !Array.isArray(tasks)) {
    if (req.body.title && req.body.description) {
      tasks = [{ title: req.body.title, description: req.body.description }];
    } else {
      tasks = [];
    }
  }

  if (!userId && !userEmail) {
    return res.status(400).json({ success: false, message: "userId or userEmail is required" });
  }

  if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
    return res.status(400).json({ success: false, message: "At least one task is required" });
  }

  try {
    // Ensure tasks table exists and has the expected columns (safe guard for environments
    // where migrations did not run or startup helpers failed due to pool issues).
    await pool.query(`
      CREATE EXTENSION IF NOT EXISTS pgcrypto;
      CREATE TABLE IF NOT EXISTS tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT,
        status VARCHAR(32) DEFAULT 'pending',
        assigned_by VARCHAR(128),
        assigned_to TEXT,
        customer_name TEXT,
    customer_address TEXT,
    customer_mobile TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // make sure columns exist
    await pool.query(`ALTER TABLE IF EXISTS tasks ADD COLUMN IF NOT EXISTS status VARCHAR(32) DEFAULT 'pending'`);
    await pool.query(`ALTER TABLE IF EXISTS tasks ADD COLUMN IF NOT EXISTS assigned_by VARCHAR(128)`);
    await pool.query(`ALTER TABLE IF EXISTS tasks ADD COLUMN IF NOT EXISTS assigned_to TEXT`);
    await pool.query(`ALTER TABLE IF EXISTS tasks ADD COLUMN IF NOT EXISTS customer_name TEXT`);
    await pool.query(`ALTER TABLE IF EXISTS tasks ADD COLUMN IF NOT EXISTS customer_address TEXT`);
    await pool.query(`ALTER TABLE IF EXISTS tasks ADD COLUMN IF NOT EXISTS customer_mobile TEXT`);

    const queryText =
      "INSERT INTO tasks (user_id, title, description, status, assigned_by, assigned_to, customer_name, customer_address, customer_mobile) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)";

    // Resolve target user either by email or id (accept integer-like legacy ids)
    let targetUserId = null;
    let targetEmail = null;
    if (userEmail) {
      const r = await pool.query('SELECT id, email FROM users WHERE LOWER(email)=LOWER($1) LIMIT 1', [String(userEmail)]);
      if (!r.rows || r.rows.length === 0) return res.status(404).json({ success: false, message: 'Target user not found by email' });
      targetUserId = r.rows[0].id;
      targetEmail = r.rows[0].email;
    } else {
      const resolved = await pool.query('SELECT id, email FROM users WHERE id::text = $1 LIMIT 1', [String(userId)]);
      if (!resolved.rows || resolved.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Target user not found' });
      }
      targetUserId = resolved.rows[0].id;
      targetEmail = resolved.rows[0].email;
    }

    // Inspect tasks table column types so we insert values matching existing schema
    const cols = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='tasks' AND column_name IN ('user_id','assigned_by')");
    const colMap = {};
    for (const r of cols.rows) colMap[r.column_name] = r.data_type;

    // If tasks.user_id is integer in existing schema, convert resolved id to integer (if possible)
    if (colMap['user_id'] && colMap['user_id'].toLowerCase().includes('int')) {
      // If the existing tasks.user_id column is integer, convert it to TEXT so it can accept UUIDs
      try {
        // drop foreign key if present
        await pool.query("ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_user_id_fkey");
      } catch (e) {
        // ignore
      }
      try {
        await pool.query("ALTER TABLE tasks ALTER COLUMN user_id TYPE TEXT USING user_id::text");
        // update local map
        colMap['user_id'] = 'text';
      } catch (e) {
        console.warn('Could not alter tasks.user_id to text:', e?.message || e);
      }
    }

    // Use requester header as assigned_by if client didn't provide one
    const requester = req.header('x-user-id') || null;

    const promises = tasks.map(async (task) => {
      if (!task.title || !task.description) {
        throw new Error("Task title and description are required");
      }
      const status = task.status || "pending";
      let assignedBy = task.assignedBy || task.assigned_by || requester || null;
      // If assigned_by column exists and is integer, convert column to text to accept UUIDs
      if (assignedBy != null && colMap['assigned_by'] && colMap['assigned_by'].toLowerCase().includes('int')) {
        try {
          await pool.query("ALTER TABLE tasks ALTER COLUMN assigned_by TYPE TEXT USING assigned_by::text");
          colMap['assigned_by'] = 'text';
        } catch (e) {
          // ignore and fall back to null
          assignedBy = null;
        }
      }
      const customerName = task.customer_name || task.customerName || null;
      const customerAddress = task.customer_address || task.customerAddress || null;
      const customerMobile = task.customer_mobile || task.customerMobile || null;
      return pool.query(queryText, [targetUserId, task.title, task.description, status, assignedBy, targetEmail, customerName, customerAddress, customerMobile]);
    });

    await Promise.all(promises);

    res.json({ success: true, message: "Tasks assigned successfully" });
  } catch (err) {
    console.error('Error in /assign-task:', err?.message || err, err?.stack || '');
    // reply with a clearer message for clients (but do not leak stack in prod)
    return res.status(500).json({ success: false, message: 'Error assigning tasks', error: String(err?.message || err) });
  }
});

// PUT update a task's status
router.put("/tasks/:taskId", async (req, res) => {
  const { taskId } = req.params;
  const { status } = req.body;
  console.log(`PUT /api/users/tasks/${taskId} payload:`, req.body);

  if (!status) {
    return res.status(400).json({ success: false, message: "Status is required" });
  }

  try {
    const result = await pool.query(`UPDATE tasks SET status=$1 WHERE id=$2 RETURNING *`, [status, taskId]);

    if (result.rows.length === 0) {
      console.log(`Task ${taskId} not found`);
      return res.status(404).json({ success: false, message: "Task not found" });
    }

    console.log("Updated task:", result.rows[0]);

    const updatedTask = result.rows[0];
    try {
      const userRes = await pool.query(
        `
        SELECT 
          u.id AS id,
          u.name,
          u.email,
          u.role,
          u.leave_balance,

          COALESCE(
            json_agg(
              json_build_object(
                'id', t.id,
                'title', t.title,
                'description', t.description,
                'status', t.status,
                'assignedBy', t.assigned_by,
                'customerName', t.customer_name,
                'customerAddress', t.customer_address,
                'created_at', t.created_at
              )
            ) FILTER (WHERE t.id IS NOT NULL),
            '[]'
          ) AS tasks
        FROM users u
  LEFT JOIN tasks t ON u.id::text = t.user_id::text
        WHERE u.id = $1
        GROUP BY u.id
        LIMIT 1
      `,
        [updatedTask.user_id]
      );

      const userPayload = userRes.rows && userRes.rows[0] ? userRes.rows[0] : null;
      return res.json({ success: true, task: updatedTask, user: userPayload });
    } catch (err2) {
      console.error("Error fetching user after task update:", err2);
      return res.json({ success: true, task: updatedTask });
    }
  } catch (err) {
    console.error("Error updating task:", err);
    res.status(500).json({ success: false, message: "Error updating task", error: err.message });
  }
});

// Get all engineers
router.get('/engineers', async (req, res) => {
  try {
    const result = await pool.query(`
            SELECT 
                id,
                name,
                email,
                mobile_number,
                role
            FROM users 
            WHERE LOWER(role) = 'engineer'
            ORDER BY name ASC
        `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching engineers:', err);
    res.status(500).json({ error: 'Failed to fetch engineers' });
  }
});

export default router;

// Simple helper endpoint: GET /api/tasks/by-email?email=...
// Returns tasks assigned to the user with that email.
router.get('/tasks/by-email', async (req, res) => {
  const email = req.query.email;
  if (!email) return res.status(400).json({ success: false, message: 'email query param required' });
  try {
    const userR = await pool.query('SELECT id, name, email FROM users WHERE LOWER(email)=LOWER($1) LIMIT 1', [String(email)]);
    if (!userR.rows || userR.rows.length === 0) return res.status(404).json({ success: false, message: 'User not found' });
    const uid = userR.rows[0].id;
    const tasksR = await pool.query('SELECT id, user_id, title, description, status, assigned_by, created_at FROM tasks WHERE user_id::text = $1 ORDER BY created_at DESC', [String(uid)]);
    return res.json({ success: true, tasks: tasksR.rows });
  } catch (err) {
    console.error('Failed to fetch tasks by email', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch tasks', error: String(err?.message || err) });
  }
});

// Simple listing of recent tasks (used by mobile app)
router.get('/tasks', async (req, res) => {
  try {
    const q = await pool.query(`SELECT id, user_id, title, description, status, assigned_by, assigned_to, created_at FROM tasks ORDER BY created_at DESC LIMIT 200`);
    return res.json({ success: true, tasks: q.rows });
  } catch (err) {
    console.error('Failed to list tasks', err);
    return res.status(500).json({ success: false, message: 'Failed to list tasks', error: String(err?.message || err) });
  }
});