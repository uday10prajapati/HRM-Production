import express from 'express';
import dotenv from 'dotenv';
import { pool } from './db.js';

dotenv.config();
const router = express.Router();

// ✅ Get only pending tasks
router.get('/pending', async (req, res) => {
  try {
    const query = `
      SELECT 
        id,
        title,
        description,
        status,
        customer_name,
        customer_mobile,
        customer_address,
        assigned_to,
        assigned_by,
        due_date,
        created_at
      FROM tasks
      WHERE status = $1
      ORDER BY due_date ASC
    `;

    const values = ['pending']; // PostgreSQL uses $1, $2, etc.

    const { rows } = await pool.query(query, values);

    res.status(200).json({
      success: true,
      count: rows.length,
      tasks: rows,
    });
  } catch (error) {
    console.error('❌ Error fetching pending tasks:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending tasks',
      error: error.message,
    });
  }
});

export default router;
