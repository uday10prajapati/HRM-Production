import express from "express";
import { pool } from "./db.js";
import bcrypt from 'bcryptjs';

const router = express.Router();

// Ensure tasks table has expected columns (safe on startup)
(async function ensureTaskColumns() {
  try {
    await pool.query(`ALTER TABLE IF EXISTS tasks ADD COLUMN IF NOT EXISTS status VARCHAR(32) DEFAULT 'pending'`);
    await pool.query(`ALTER TABLE IF EXISTS tasks ADD COLUMN IF NOT EXISTS assigned_by VARCHAR(128)`);
    console.log('✅ Ensured tasks table columns: status, assigned_by');
  } catch (err) {
    console.warn('Could not ensure tasks columns:', err.message || err);
  }
})();

// Create tasks table if it doesn't exist (safe startup helper)
(async function createTasksTableIfMissing() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT,
        status VARCHAR(32) DEFAULT 'pending',
        assigned_by VARCHAR(128),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Ensured tasks table exists');
  } catch (err) {
    console.warn('Could not create tasks table:', err.message || err);
  }
})();

// GET all users
router.get("/", async (req, res) => {
  try {
    // Fetch users with their tasks
    const result = await pool.query(`
      SELECT 
        u.id AS id,
        u.name,
        u.email,
        u.role,
        u.leave_balance,
        u.attendance_status,
        json_agg(
          json_build_object(
            'id', t.id,
            'title', t.title,
            'description', t.description,
            'status', t.status,
            'assignedBy', t.assigned_by,
            'created_at', t.created_at
          )
        ) FILTER (WHERE t.id IS NOT NULL) AS tasks
      FROM users u
      LEFT JOIN tasks t ON u.id = t.user_id
      GROUP BY u.id
      ORDER BY u.id ASC
    `);

    res.json({ success: true, users: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error fetching users" });
  }
});

// GET single user by ID (including tasks)
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(`
      SELECT 
        u.id AS id,
        u.name,
        u.email,
        u.role,
        u.leave_balance,
        u.attendance_status,
        json_agg(
          json_build_object(
            'id', t.id,
            'title', t.title,
            'description', t.description,
            'status', t.status,
            'assignedBy', t.assigned_by,
            'created_at', t.created_at
          )
        ) FILTER (WHERE t.id IS NOT NULL) AS tasks
      FROM users u
      LEFT JOIN tasks t ON u.id = t.user_id
      WHERE u.id = $1
      GROUP BY u.id
      LIMIT 1
    `, [id]);

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error fetching user" });
  }
});


// POST create new user
router.post("/create", async (req, res) => {
  const { name, email, role, password, leaveBalance, attendanceStatus } = req.body;
  if (!password) {
    return res.status(400).json({ success: false, message: "Password is required" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    const result = await pool.query(
      `INSERT INTO users (name, email, role, leave_balance, attendance_status, password)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, email, role, leaveBalance, attendanceStatus, hashedPassword]
    );
    res.status(201).json({ success: true, user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error creating user" });
  }
});

// PUT update a user by ID
router.put("/update/:id", async (req, res) => {
  const { id } = req.params;
  const { name, email, role, leaveBalance, attendanceStatus } = req.body;
  try {
    const result = await pool.query(
      `UPDATE users SET name=$1, email=$2, role=$3, leave_balance=$4, attendance_status=$5
       WHERE id=$6 RETURNING *`,
      [name, email, role, leaveBalance, attendanceStatus, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error updating user" });
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
    res.status(500).json({ success: false, message: "Error deleting user" });
  }
});

// POST assign a task to a user
router.post("/assign-task", async (req, res) => {
  const { userId } = req.body;

  // normalize tasks: accept either tasks array or single title/description
  let tasks = req.body.tasks;
  if (!tasks || !Array.isArray(tasks)) {
    if (req.body.title && req.body.description) {
      tasks = [{ title: req.body.title, description: req.body.description }];
    } else {
      tasks = [];
    }
  }

  // Validate userId
  if (!userId) {
    return res.status(400).json({ success: false, message: "User ID is required" });
  }

  // Ensure tasks is an array
  if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
    return res.status(400).json({ success: false, message: "At least one task is required" });
  }

  try {
    const queryText = "INSERT INTO tasks (user_id, title, description, status, assigned_by) VALUES ($1, $2, $3, $4, $5)";

    const promises = tasks.map((task) => {
      if (!task.title || !task.description) {
        throw new Error("Task title and description are required");
      }
      const status = task.status || 'pending';
      const assignedBy = task.assignedBy || task.assigned_by || null;
      return pool.query(queryText, [userId, task.title, task.description, status, assignedBy]);
    });

    await Promise.all(promises);

    res.json({ success: true, message: "Tasks assigned successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error assigning tasks", error: err.message });
  }
});

// PUT update a task's status
router.put('/tasks/:taskId', async (req, res) => {
  const { taskId } = req.params;
  const { status } = req.body;
  console.log(`PUT /api/users/tasks/${taskId} payload:`, req.body);

  if (!status) {
    return res.status(400).json({ success: false, message: 'Status is required' });
  }

  try {
    const result = await pool.query(
      `UPDATE tasks SET status=$1 WHERE id=$2 RETURNING *`,
      [status, taskId]
    );

    if (result.rows.length === 0) {
      console.log(`Task ${taskId} not found`);
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    console.log('Updated task:', result.rows[0]);

    // Fetch and return the owning user's up-to-date data so frontend can sync immediately
    const updatedTask = result.rows[0];
    try {
      const userRes = await pool.query(`
        SELECT 
          u.id AS id,
          u.name,
          u.email,
          u.role,
          u.leave_balance,
          u.attendance_status,
          json_agg(
            json_build_object(
              'id', t.id,
              'title', t.title,
              'description', t.description,
              'status', t.status,
              'assignedBy', t.assigned_by,
              'created_at', t.created_at
            )
          ) FILTER (WHERE t.id IS NOT NULL) AS tasks
        FROM users u
        LEFT JOIN tasks t ON u.id = t.user_id
        WHERE u.id = $1
        GROUP BY u.id
        LIMIT 1
      `, [updatedTask.user_id]);

      const userPayload = userRes.rows && userRes.rows[0] ? userRes.rows[0] : null;
      return res.json({ success: true, task: updatedTask, user: userPayload });
    } catch (err2) {
      console.error('Error fetching user after task update:', err2);
      return res.json({ success: true, task: updatedTask });
    }
  } catch (err) {
    console.error('Error updating task:', err);
    res.status(500).json({ success: false, message: 'Error updating task', error: err.message });
  }
});

export default router;
