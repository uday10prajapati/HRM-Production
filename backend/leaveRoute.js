import express from 'express';
import { pool } from './db.js';

const router = express.Router();

// Ensure notifications table exists
(async function ensureNotificationsTable() {
  try {
      await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto').catch(() => {});
      await pool.query(`
        CREATE TABLE IF NOT EXISTS notifications (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          recipient_id TEXT NOT NULL,
          notification_type VARCHAR(50) NOT NULL,
          title VARCHAR(255) NOT NULL,
          message TEXT,
          related_id TEXT,
          is_read BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          read_at TIMESTAMP
        );
      `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread ON notifications(recipient_id, is_read)`);
    console.log('\u2705 Ensured notifications table exists');
  } catch (err) {
    console.warn('Could not ensure notifications table exists:', err?.message || err);
  }
})();

// Ensure leaves table exists (safe startup helper)
(async function ensureLeavesTable() {
  try {
    await pool.query(`
      CREATE EXTENSION IF NOT EXISTS pgcrypto;
      CREATE TABLE IF NOT EXISTS leaves (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        reason TEXT,
        status VARCHAR(16) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_leaves_user_status ON leaves (user_id, status)`);
    // Ensure newer optional columns exist so queries used elsewhere don't fail
    try {
      await pool.query(`ALTER TABLE IF EXISTS leaves ADD COLUMN IF NOT EXISTS type TEXT`);
      await pool.query(`ALTER TABLE IF EXISTS leaves ADD COLUMN IF NOT EXISTS applied_at TIMESTAMP`);
      await pool.query(`ALTER TABLE IF EXISTS leaves ADD COLUMN IF NOT EXISTS approved_by TEXT`);
      await pool.query(`ALTER TABLE IF EXISTS leaves ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP`);
      await pool.query(`ALTER TABLE IF EXISTS leaves ADD COLUMN IF NOT EXISTS day_type TEXT`);
    } catch (e) {
      console.warn('Could not ensure optional leaves columns exist:', e?.message || e);
    }
    console.log('\u2705 Ensured leaves table exists');
  } catch (err) {
    console.warn('Could not ensure leaves table exists:', err?.message || err);
  }
})();

// POST /api/leave/apply
// body: { userId, startDate, endDate, reason, type, day_type }
router.post('/apply', async (req, res) => {
  const { userId, startDate, endDate, reason, type, day_type } = req.body;
  if (!userId || !startDate || !endDate) {
    return res.status(400).json({ success: false, message: 'userId, startDate and endDate are required' });
  }
  // basic date validation
  const s = new Date(startDate);
  const e = new Date(endDate);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) {
    return res.status(400).json({ success: false, message: 'Invalid date format' });
  }
  if (e < s) {
    return res.status(400).json({ success: false, message: 'endDate must be on or after startDate' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO leaves (user_id, start_date, end_date, reason, type, day_type, status) VALUES ($1, $2, $3, $4, $5, $6, 'pending') RETURNING *`,
      [userId, startDate, endDate, reason || null, type || null, day_type || 'full']
    );
    // fetch with user info
    const leave = result.rows[0];
    try {
      const u = await pool.query(`SELECT id, name, email, role FROM users WHERE id=$1 LIMIT 1`, [leave.user_id]);
      leave.user = u.rows && u.rows[0] ? u.rows[0] : null;
    } catch (e) {
      // ignore user fetch errors
    }

    // Create notifications for HR/Admin users
    try {
      const fs = await import('fs');
      fs.appendFileSync('debug.txt', `\n--- NEW APPLY ---\nUser: ${userId}\n`);
      const hrAdminResult = await pool.query(
        `SELECT id, role FROM users WHERE LOWER(TRIM(role)) IN ('hr', 'admin') AND id::text != $1`,
        [userId]
      );
      const hrAdminUsers = hrAdminResult.rows || [];
      fs.appendFileSync('debug.txt', `HR/Admins found: ${hrAdminUsers.length}\n`);
      console.log(`[DEBUG] /apply called by userId: ${userId}`);
      console.log(`[DEBUG] Found ${hrAdminUsers.length} HR/Admin users matching query:`, hrAdminUsers);
      console.log(`✉️ Creating notifications for ${hrAdminUsers.length} HR/Admin users`);
      
      if (hrAdminUsers.length > 0) {
        const engineerName = leave.user?.name || 'An engineer';
        const startD = new Date(startDate).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
        const endD = new Date(endDate).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
        
        // Insert notification for each HR/Admin user
        for (const hrAdmin of hrAdminUsers) {
          try {
            const notifResult = await pool.query(
              `INSERT INTO notifications (recipient_id, notification_type, title, message, related_id, is_read) VALUES ($1, $2, $3, $4, $5, FALSE) RETURNING id`,
              [
                String(hrAdmin.id),
                'leave_applied',
                `Leave Application from ${engineerName}`,
                `${engineerName} has applied for leave from ${startD} to ${endD}. Reason: ${reason || 'Not specified'}`,
                String(leave.id)
              ]
            );
            fs.appendFileSync('debug.txt', `SUCCESS NS: ${notifResult.rows?.[0]?.id}\n`);
            console.log(`✅ Notification created for HR user ${hrAdmin.id}: ${notifResult.rows?.[0]?.id || 'unknown'}`);
          } catch (notifErr) {
            fs.appendFileSync('debug.txt', `FAIL NS: ${notifErr}\n`);
            console.warn(`❌ Failed to create notification for HR user ${hrAdmin.id}:`, notifErr?.message || notifErr);
          }
        }
      } else {
        fs.appendFileSync('debug.txt', `SKIPPED NS: No HR Admins\n`);
        console.log('⚠️ No HR/Admin users found to notify');
      }
    } catch (notifErr) {
      const fs = await import('fs');
      fs.appendFileSync('debug.txt', `FAIL MAIN: ${notifErr}\n`);
      console.warn('Error creating notifications for leave application:', notifErr?.message || notifErr);
    }

    res.json({ success: true, leave });
  } catch (err) {
    console.error('Error applying leave:', err?.message || err);
    res.status(500).json({ success: false, message: 'Error applying leave', error: err?.message || String(err) });
  }
});

// GET /api/leave/ - list leaves; optional query: status=pending|approved|rejected, userId (to filter by user)
router.get('/', async (req, res) => {
  const { status, userId } = req.query;
  // Diagnostic log to help debug empty responses from clients
  try {
    console.log(`/api/leave called`, { query: req.query, headersPreview: { 'x-user-id': req.header('x-user-id') } });
  } catch (e) { /* ignore logging errors */ }
  // role-based: check requester header first
  const requester = req.header('x-user-id') || null;
  try {
    let isPrivileged = false;
    if (requester) {
      try {
        const ru = await pool.query('SELECT role FROM users WHERE id::text=$1 LIMIT 1', [String(requester)]);
        const role = ru.rows && ru.rows[0] ? (ru.rows[0].role || '').toLowerCase() : null;
        if (role === 'admin' || role === 'hr') isPrivileged = true;
      } catch (e) {
        console.warn('Could not lookup requester role for leaves:', e?.message || e);
      }
    }

    const conditions = [];
    const params = [];
    if (status) {
      params.push(status);
      conditions.push(`l.status = $${params.length}`);
    }
    // if userId provided in query and requester is privileged, allow; otherwise if requester present and not privileged, force their own id
    if (userId && isPrivileged) {
      params.push(String(userId));
      conditions.push(`l.user_id::text = $${params.length}`);
    } else if (requester && !isPrivileged) {
      params.push(String(requester));
      conditions.push(`l.user_id::text = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    // select explicit columns expected by frontend - NOW INCLUDES day_type
    const query = `SELECT l.id,
      to_char(l.created_at, 'YYYY-MM-DD HH24:MI:SS') AS created_at,
      l.type,
      l.day_type,
      l.reason,
      l.status,
      l.user_id,
      to_char(l.start_date, 'YYYY-MM-DD') AS start_date,
      to_char(l.end_date, 'YYYY-MM-DD') AS end_date,
      to_char(l.applied_at, 'YYYY-MM-DD HH24:MI:SS') AS applied_at,
      l.approved_by,
      to_char(l.approved_at, 'YYYY-MM-DD HH24:MI:SS') AS approved_at,
      u.name as user_name, u.email as user_email
    FROM leaves l
    LEFT JOIN users u ON u.id::text = l.user_id::text
    ${where}
    ORDER BY COALESCE(l.created_at, now()) DESC`;
    console.log('leave list SQL (preview):', { sqlWhere: where, params });
    let result;
    try {
      result = await pool.query(query, params);
    } catch (innerErr) {
      console.error('DB query failed (leaves list):', innerErr?.message || innerErr, innerErr?.stack || 'no stack');
      throw innerErr;
    }
    res.json({ success: true, leaves: result.rows });
  } catch (err) {
    console.error('Error fetching leaves:', err?.message || err, err?.stack || 'no stack');
    res.status(500).json({ success: false, message: 'Error fetching leaves', error: err?.message || String(err) });
  }
});

// PUT /api/leave/:id/approve
router.put('/:id/approve', async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    // check requester role
    const requester = req.header('x-user-id') || null;
    if (!requester) {
      client.release();
      return res.status(403).json({ success: false, message: 'Missing X-User-Id' });
    }
    const ru = await client.query('SELECT role FROM users WHERE id::text=$1 LIMIT 1', [String(requester)]);
    const role = ru.rows && ru.rows[0] ? (ru.rows[0].role || '').toLowerCase() : null;
    if (role !== 'admin' && role !== 'hr') {
      client.release();
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    await client.query('BEGIN');
    // Ensure we only approve a pending leave (prevent double deduction)
    const result = await client.query(`UPDATE leaves SET status='approved', updated_at=NOW(), approved_by=$2, approved_at=NOW() WHERE id::text=$1 AND status != 'approved' RETURNING id, user_id, type, day_type, reason, status, start_date, end_date, applied_at, approved_by, approved_at`, [String(id), String(requester)]);

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json({ success: false, message: 'Leave not found or already approved' });
    }
    const leave = result.rows[0];

    // Calculate duration to deduct
    const s = new Date(leave.start_date);
    const e = new Date(leave.end_date);
    const diffTime = Math.abs(e - s);
    let diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    if (diffDays === 1 && leave.day_type === 'half') {
      diffDays = 0.5;
    }

    // Deduct from user balance
    await client.query(`UPDATE users SET leave_balance = COALESCE(leave_balance, 20) - $1 WHERE id=$2`, [diffDays, leave.user_id]);

    await client.query('COMMIT');

    try {
      const u = await pool.query(`SELECT id, name, email FROM users WHERE id=$1 LIMIT 1`, [leave.user_id]);
      leave.user = u.rows && u.rows[0] ? u.rows[0] : null;
    } catch (e) { }

    client.release();
    res.json({ success: true, leave });
  } catch (err) {
    await client.query('ROLLBACK');
    client.release();
    console.error('Error approving leave:', err?.message || err, err?.stack || 'no stack');
    res.status(500).json({ success: false, message: 'Error approving leave', error: err?.message || String(err) });
  }
});

// PUT /api/leave/:id/reject
router.put('/:id/reject', async (req, res) => {
  const { id } = req.params;
  try {
    const requester = req.header('x-user-id') || null;
    if (!requester) return res.status(403).json({ success: false, message: 'Missing X-User-Id' });
    const ru = await pool.query('SELECT role FROM users WHERE id::text=$1 LIMIT 1', [String(requester)]);
    const role = ru.rows && ru.rows[0] ? (ru.rows[0].role || '').toLowerCase() : null;
    if (role !== 'admin' && role !== 'hr') return res.status(403).json({ success: false, message: 'Forbidden' });
    const result = await pool.query(`UPDATE leaves SET status='rejected', updated_at=NOW() WHERE id::text=$1 RETURNING id, user_id, type, day_type, reason, status, start_date, end_date, applied_at, approved_by, approved_at`, [String(id)]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Leave not found' });
    const leave = result.rows[0];
    try {
      const u = await pool.query(`SELECT id, name, email FROM users WHERE id=$1 LIMIT 1`, [leave.user_id]);
      leave.user = u.rows && u.rows[0] ? u.rows[0] : null;
    } catch (e) { }
    res.json({ success: true, leave });
  } catch (err) {
    console.error('Error rejecting leave:', err?.message || err, err?.stack || 'no stack');
    res.status(500).json({ success: false, message: 'Error rejecting leave', error: err?.message || String(err) });
  }
});

// Notification endpoints

// GET /api/leave/notifications/unread - Get unread notifications for current user
router.get('/notifications/unread', async (req, res) => {
  try {
    const userId = req.header('x-user-id') || null;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Missing X-User-Id' });
    }

    const result = await pool.query(
      `SELECT id, notification_type, title, message, related_id, created_at
       FROM notifications 
       WHERE recipient_id::text = $1 AND is_read = FALSE
       ORDER BY created_at DESC
       LIMIT 50`,
      [String(userId)]
    );

    res.json({ success: true, notifications: result.rows || [] });
  } catch (err) {
    console.error('Error fetching unread notifications:', err?.message || err);
    res.status(500).json({ success: false, message: 'Error fetching notifications', error: err?.message || String(err) });
  }
});

// GET /api/leave/notifications/count - Get count of unread notifications
router.get('/notifications/count', async (req, res) => {
  try {
    const userId = req.header('x-user-id') || null;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Missing X-User-Id' });
    }

    const result = await pool.query(
      `SELECT COUNT(*) as count FROM notifications 
       WHERE recipient_id::text = $1 AND is_read = FALSE`,
      [String(userId)]
    );

    const count = result.rows[0]?.count || 0;
    console.log(`[DEBUG] /notifications/count for user ${userId} => count: ${count}`);
    res.json({ success: true, count: parseInt(count, 10) });
  } catch (err) {
    console.error('Error counting unread notifications:', err?.message || err);
    res.status(500).json({ success: false, message: 'Error counting notifications', error: err?.message || String(err) });
  }
});

// PUT /api/leave/notifications/:id/read - Mark notification as read
router.put('/notifications/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.header('x-user-id') || null;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Missing X-User-Id' });
    }

    const result = await pool.query(
      `UPDATE notifications 
       SET is_read = TRUE, read_at = NOW()
       WHERE id::text = $1 AND recipient_id::text = $2
       RETURNING *`,
      [String(id), String(userId)]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    res.json({ success: true, notification: result.rows[0] });
  } catch (err) {
    console.error('Error marking notification as read:', err?.message || err);
    res.status(500).json({ success: false, message: 'Error updating notification', error: err?.message || String(err) });
  }
});

// DEBUG: Check notifications for a user
router.get('/_debug/notifications', async (req, res) => {
  try {
    const userId = req.header('x-user-id');
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Missing X-User-Id' });
    }

    // Check all notifications for user
    const result = await pool.query(
      `SELECT id, recipient_id, notification_type, title, message, is_read, created_at, read_at 
       FROM notifications 
       WHERE recipient_id::text = $1 
       ORDER BY created_at DESC 
       LIMIT 50`,
      [String(userId)]
    );

    // Also count unread
    const countResult = await pool.query(
      `SELECT COUNT(*) as unread_count FROM notifications WHERE recipient_id::text = $1 AND is_read = FALSE`,
      [String(userId)]
    );

    console.log(`📊 DEBUG: Notifications for user ${userId}: ${result.rows.length} total, ${countResult.rows[0]?.unread_count || 0} unread`);

    res.json({
      success: true,
      userId,
      totalNotifications: result.rows.length,
      unreadCount: parseInt(countResult.rows[0]?.unread_count || 0),
      notifications: result.rows
    });
  } catch (err) {
    console.error('Error in notifications debug endpoint:', err?.message || err);
    res.status(500).json({ success: false, error: err?.message || String(err) });
  }
});

// DEBUG ENDPOINT TO VERIFY STATE
router.get('/_debug_verify', async (req, res) => {
  try {
    const diagnostics = { status: 'ok', logs: [] };
    
    // 1. Check if notifications table exists
    try {
      const tb = await pool.query("SELECT to_regclass('public.notifications') as exists");
      diagnostics.logs.push(`Notif table exists: ${tb.rows[0].exists}`);
    } catch(e) { diagnostics.logs.push(`Notif table err: ${e.message}`); }

    // 2. Check roles available
    try {
      const roles = await pool.query("SELECT id, role FROM users WHERE LOWER(TRIM(role)) IN ('hr', 'admin')");
      diagnostics.logs.push(`Found admins: ${JSON.stringify(roles.rows)}`);
    } catch(e) { diagnostics.logs.push(`Roles err: ${e.message}`); }

    // 3. Check notifications inserted
    try {
      const notifs = await pool.query("SELECT * FROM notifications ORDER BY created_at DESC LIMIT 5");
      diagnostics.logs.push(`Recent notifs: ${notifs.rows.length}`);
    } catch(e) { diagnostics.logs.push(`Notifs read err: ${e.message}`); }

    // 4. Test forceful insert to see exact PG error
    try {
      const hrAdmins = await pool.query("SELECT id FROM users WHERE LOWER(TRIM(role)) IN ('hr', 'admin') LIMIT 1");
      if (hrAdmins.rows.length > 0) {
        const testId = String(hrAdmins.rows[0].id);
        const relatedId = '00000000-0000-0000-0000-000000000000'; // dummy uuid
        
        await pool.query('BEGIN');
        const notifResult = await pool.query(
          `INSERT INTO notifications (recipient_id, notification_type, title, message, related_id, is_read) VALUES ($1, $2, $3, $4, $5, FALSE) RETURNING id`,
          [testId, 'test', 'Test', 'Test Notif', relatedId]
        );
        diagnostics.logs.push(`Insert SUCCESS! id: ${notifResult.rows[0].id}`);
        await pool.query('ROLLBACK');
      } else {
        diagnostics.logs.push(`Insert SKIPPED: no hr params`);
      }
    } catch (insertErr) {
      diagnostics.logs.push(`INSERT ERROR: ${insertErr.message} (Detail: ${insertErr.detail})`);
      await pool.query('ROLLBACK').catch(()=>{});
    }

    res.json(diagnostics);
  } catch (err) {
    res.json({ error: String(err) });
  }
});

export default router;
