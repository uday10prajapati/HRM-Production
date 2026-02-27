import express from 'express';
import { pool } from './db.js';
import requireAuth from './authMiddleware.js';
import multer from 'multer';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
const supabase = (supabaseUrl && supabaseServiceKey) ? createClient(supabaseUrl, supabaseServiceKey) : null;

const upload = multer({ storage: multer.memoryStorage() });

const router = express.Router();

// (removed simple engineers-only /search route)

// Add route for assigned calls
router.get('/assigned-calls', requireAuth, async (req, res) => {
  try {
    const query = `
            SELECT ac.*, u.name as engineer_name
            FROM assign_call ac
            LEFT JOIN users u ON ac.id = u.id
            ORDER BY ac.created_at DESC
        `;
    const result = await pool.query(query);

    res.json({
      success: true,
      calls: result.rows
    });
  } catch (err) {
    console.error('Fetch assigned calls error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch assigned calls'
    });
  }
});

// Route to create new assign call
router.post('/assign', requireAuth, async (req, res) => {
  try {
    const {
      id,
      name,
      role,
      mobile_number,
      dairy_name,
      problem,
      description
    } = req.body;

    const query = `
            INSERT INTO assign_call (
                id,
                name,
                role,
                mobile_number,
                dairy_name,
                problem,
                description,
                status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'new')
            RETURNING *
        `;

    const values = [
      id,
      name,
      role,
      mobile_number,
      dairy_name,
      problem,
      description
    ];

    const result = await pool.query(query, values);

    res.json({
      success: true,
      message: 'Call assigned successfully',
      data: result.rows[0]
    });

  } catch (err) {
    console.error('Error assigning call:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to assign call'
    });
  }
});

// Add assign-call route
router.post('/assign-call', requireAuth, async (req, res) => {
  try {
    const {
      id,
      name,
      role,
      mobile_number,
      dairy_name,
      problem,
      description
    } = req.body;

    // Validate required fields
    if (!dairy_name || !problem) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    const query = `
            INSERT INTO assign_call (
                id,
                name,
                role,
                mobile_number,
                dairy_name,
                problem,
                description,
                status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'new')
            RETURNING *
        `;

    const result = await pool.query(query, [
      id,
      name,
      role,
      mobile_number,
      dairy_name,
      problem,
      description
    ]);

    res.json({
      success: true,
      message: 'Call assigned successfully',
      data: result.rows[0]
    });

  } catch (err) {
    console.error('Error assigning call:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to assign call'
    });
  }
});

// Ensure users table has optional fcm_token column (safe on startup)
(async function ensureUsersFcmColumn() {
  try {
    await pool.query(`ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS fcm_token TEXT`);
    console.log('serviceCallsRoute: ensured users.fcm_token column exists (if users table present)');
  } catch (err) {
    console.warn('serviceCallsRoute: could not ensure users.fcm_token column:', err?.message || err);
  }
})();

// Notification helpers (safe: only run when env vars/config present)
async function sendSmsViaTwilio(toNumber, message) {
  try {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_FROM;
    if (!sid || !token || !from) {
      console.log('sendSmsViaTwilio: TWILIO not configured, skipping SMS');
      return;
    }

    // Use fetch if available
    if (typeof fetch !== 'function') {
      console.warn('sendSmsViaTwilio: global fetch not available - cannot send SMS');
      return;
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
    const body = new URLSearchParams({ From: from, To: toNumber, Body: message });
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });
    if (!res.ok) {
      const text = await res.text();
      console.warn('Twilio SMS failed:', res.status, text);
    } else {
      console.log('Twilio SMS sent to', toNumber);
    }
  } catch (err) {
    console.error('sendSmsViaTwilio error', err?.message || err);
  }
}

async function sendFcmPush(fcmToken, title, bodyText, data = {}) {
  try {
    const serverKey = process.env.FCM_SERVER_KEY;
    if (!serverKey) {
      console.log('sendFcmPush: FCM_SERVER_KEY not configured, skipping push');
      return;
    }
    if (!fcmToken) {
      console.log('sendFcmPush: missing fcmToken, skipping push');
      return;
    }

    if (typeof fetch !== 'function') {
      console.warn('sendFcmPush: global fetch not available - cannot send push');
      return;
    }

    const url = 'https://fcm.googleapis.com/fcm/send';
    const payload = {
      to: fcmToken,
      notification: { title: title, body: bodyText },
      data: data,
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `key=${serverKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text();
      console.warn('FCM push failed:', res.status, text);
    } else {
      console.log('FCM push sent to token');
    }
  } catch (err) {
    console.error('sendFcmPush error', err?.message || err);
  }
}

// Helper: ensure role is admin or manager
function isHrOrAdmin(role) {
  if (!role) return false;
  const r = role.toString().toLowerCase();
  return r === 'admin' || r === 'hr';
}

// POST /api/assign_call
// Body: { title, description, customerId, engineerId?, scheduled_at? }
// Only admin/manager/hr may assign engineer; others cannot set engineer_id
router.post('/', requireAuth, async (req, res) => {
  try {
    const body = req.body || {};
    const title = body.title ?? null;
    const description = body.description ?? null;
    const customerId = body.customerId ?? body.customer_id ?? null;
    let engineerId = body.engineerId ?? body.engineer_id ?? null;
    const scheduledAt = body.scheduled_at ?? body.scheduledAt ?? null;

    if (!title) return res.status(400).json({ success: false, message: 'Missing title' });
    if (!customerId) return res.status(400).json({ success: false, message: 'Missing customerId' });

    const requesterRole = req.user?.role ?? null;
    const requesterId = req.user?.id ?? null;

    // Only manager/admin/hr can assign engineer on create
    if (engineerId && !isManagerOrAdmin(requesterRole)) {
      return res.status(403).json({ success: false, message: 'Forbidden to assign engineer' });
    }

    const q = `INSERT INTO service-calls (title, description, customer_id, engineer_id, scheduled_at) VALUES ($1,$2,$3,$4,$5) RETURNING *`;
    const vals = [title, description, customerId, engineerId, scheduledAt];
    const result = await pool.query(q, vals);
    const createdCall = result.rows[0];

    // If an engineer was assigned on create, trigger best-effort notifications (non-blocking)
    if (engineerId) {
      (async () => {
        try {
          const engR = await pool.query('SELECT id, name, mobile_number, fcm_token, email FROM users WHERE id::text = $1 LIMIT 1', [String(engineerId)]);
          const eng = engR.rows && engR.rows[0] ? engR.rows[0] : null;
          if (!eng) {
            console.warn('Assigned engineer not found for notifications on create:', engineerId);
            return;
          }

          const customerR = await pool.query('SELECT id, name FROM users WHERE id::text = $1 LIMIT 1', [String(createdCall.customer_id)]).catch(() => null);
          const customerName = customerR && customerR.rows && customerR.rows[0] ? customerR.rows[0].name : null;

          const smsMessage = `New service call assigned: ${createdCall.title}${customerName ? ' for ' + customerName : ''}. Please check your app.`;

          sendSmsViaTwilio(eng.mobile_number, smsMessage).catch((e) => console.warn('SMS send error (ignored):', e));
          sendFcmPush(eng.fcm_token, 'New Service Call Assigned', smsMessage, { callId: createdCall.id }).catch((e) => console.warn('FCM send error (ignored):', e));
        } catch (notifyErr) {
          console.error('Notification worker error (ignored) on create:', notifyErr?.message || notifyErr);
        }
      })();
    }

    return res.json({ success: true, call: createdCall });
  } catch (err) {
    console.error('/service-calls POST error', err);
    return res.status(500).json({ success: false, message: 'Error creating service call', error: err?.message ?? String(err) });
  }
});

// GET /api/assign_call/:id
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;

    // ✅ Corrected SQL syntax and table name
    const q = `
      SELECT 
        sc.*, 
        u_e.name AS engineer_name, 
        u_c.name AS customer_name
      FROM assign_call sc
      LEFT JOIN users u_e ON u_e.id::text = sc.engineer_id::text
      LEFT JOIN users u_c ON u_c.id::text = sc.customer_id::text
      WHERE sc.id::text = $1
    `;

    const result = await pool.query(q, [String(id)]);
    const row = result.rows[0] ?? null;

    if (!row) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }

    return res.json({ success: true, call: row });
  } catch (err) {
    console.error('/assign_call/:id GET error', err);
    return res.status(500).json({
      success: false,
      message: 'Error fetching service call',
      error: err?.message ?? String(err)
    });
  }
});


// PUT /api/assign_call/:id/assign
// Body: { engineerId }
router.put('/:id/assign', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const body = req.body || {};
    const engineerId = body.engineerId ?? body.engineer_id ?? null;

    if (!engineerId) {
      return res.status(400).json({ success: false, message: 'Missing engineerId' });
    }

    const requesterRole = req.user?.role ?? null;
    if (!isManagerOrAdmin(requesterRole)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    // ✅ Corrected SQL update query
    const q = `
      UPDATE assign_call 
      SET engineer_id = $1, updated_at = NOW()
      WHERE id::text = $2 
      RETURNING *
    `;

    const result = await pool.query(q, [String(engineerId), String(id)]);
    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }

    const updatedCall = result.rows[0];

    // ✅ Notification handling
    (async () => {
      try {
        const engR = await pool.query(
          'SELECT id, name, mobile_number, fcm_token, email FROM users WHERE id::text = $1 LIMIT 1',
          [String(engineerId)]
        );

        const eng = engR.rows && engR.rows[0] ? engR.rows[0] : null;
        if (!eng) {
          console.warn('Assigned engineer not found for notifications:', engineerId);
          return;
        }

        const customerR = await pool.query(
          'SELECT id, name FROM users WHERE id::text = $1 LIMIT 1',
          [String(updatedCall.customer_id)]
        ).catch(() => null);

        const customerName =
          customerR && customerR.rows && customerR.rows[0]
            ? customerR.rows[0].name
            : null;

        // ✅ Fixed template literal
        const smsMessage = `New service call assigned: ${updatedCall.title}${customerName ? ' for ' + customerName : ''
          }. Please check your app.`;

        // Fire-and-forget notifications
        sendSmsViaTwilio(eng.mobile_number, smsMessage).catch((e) =>
          console.warn('SMS send error (ignored):', e)
        );
        sendFcmPush(
          eng.fcm_token,
          'New Service Call Assigned',
          smsMessage,
          { callId: updatedCall.id }
        ).catch((e) => console.warn('FCM send error (ignored):', e));
      } catch (notifyErr) {
        console.error('Notification worker error (ignored):', notifyErr?.message || notifyErr);
      }
    })();

    return res.json({ success: true, call: updatedCall });
  } catch (err) {
    console.error('/assign_call/:id/assign PUT error', err);
    return res.status(500).json({
      success: false,
      message: 'Error assigning engineer',
      error: err?.message ?? String(err)
    });
  }
});

// Move this route to the top of your routes (before any :id routes)
router.post('/search', async (req, res) => {
  try {
    const { soccd, society } = req.body || {};
    console.log('=== SEARCH ROUTE CALLED ===');
    console.log('Search params:', { soccd, society });

    // Query for engineers - this is the main query
    const engineerQuery = `
            SELECT 
                id,
                name,
                email,
                mobile_number,
                role
            FROM users 
            WHERE LOWER(role) = 'engineer'
            ORDER BY name ASC
        `;

    try {
      console.log('Executing engineer query...');
      const engineerResult = await pool.query(engineerQuery);
      console.log('✓ Engineer query successful, found:', engineerResult.rows.length, 'engineers');

      // Try to query societies if needed
      let societyResult = { rows: [] };
      try {
        if (soccd || society) {
          const societyQuery = `
                      SELECT 
                        'Dairy'::text AS source,
                        "SOCCD"::text AS code,
                        "SOCIETY"::text AS society,
                        "TALUKA NAME"::text AS taluka
                      FROM service_call_dairy_list
                      WHERE ($1::text IS NULL OR "SOCCD"::text = $1::text)
                        AND ($2::text IS NULL OR UPPER("SOCIETY") LIKE UPPER($2 || '%'))
                      ORDER BY society
                      LIMIT 200000
                    `;

          console.log('Executing society query...');
          societyResult = await pool.query(societyQuery, [
            soccd ? String(soccd).trim() : null,
            society ? String(society).trim().toUpperCase() : null
          ]);
          console.log('✓ Society query successful, found:', societyResult.rows.length, 'societies');
        }
      } catch (tableErr) {
        console.warn('⚠ Society table query failed (this is ok):', tableErr.message);
      }

      console.log('✓ Returning response with', engineerResult.rows.length, 'engineers and', societyResult.rows.length, 'societies');

      return res.json({
        success: true,
        data: {
          societies: societyResult.rows || [],
          engineers: engineerResult.rows || []
        }
      });
    } catch (queryErr) {
      console.error('✗ Query execution error:', queryErr.message);
      throw queryErr;
    }

  } catch (err) {
    console.error('✗ Search route error:', err.message);
    console.error('Error details:', err);
    return res.status(500).json({
      success: false,
      error: 'Search failed',
      message: err.message
    });
  }
});

// Add this new route
router.post('/send-sms', async (req, res) => {
  try {
    const { mobileNumber, message } = req.body;

    if (!mobileNumber || !message) {
      return res.status(400).json({
        success: false,
        message: 'Mobile number and message are required'
      });
    }

    // Use your SMS service here (Twilio, etc.)
    // For example with Twilio:
    const messageResponse = await sendSmsViaTwilio(mobileNumber, message);

    res.json({
      success: true,
      message: 'SMS sent successfully'
    });
  } catch (err) {
    console.error('SMS error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to send SMS'
    });
  }
});

export default router;

// --- New endpoints: update status and letterhead workflow ---

// Delete call
router.delete('/assign-call/:callId', requireAuth, async (req, res) => {
  try {
    const callId = req.params.callId;
    const requesterRole = req.user?.role ?? '';

    // Only HR and Admin can delete calls
    if (!isHrOrAdmin(requesterRole)) {
      return res.status(403).json({ success: false, message: 'Only HR/Admin can delete calls' });
    }

    const q = `DELETE FROM assign_call WHERE call_id::text = $1 RETURNING *`;
    const result = await pool.query(q, [String(callId)]);

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Call not found' });
    }

    return res.json({ success: true, message: 'Call deleted successfully', call: result.rows[0] });
  } catch (err) {
    console.error('delete call error', err);
    return res.status(500).json({ success: false, message: 'Failed to delete call' });
  }
});

// Update call status (used by client)
router.put('/update-status/:callId', requireAuth, async (req, res) => {
  try {
    const callId = req.params.callId;
    const body = req.body;

    if (!body.status) return res.status(400).json({ success: false, message: 'Missing status' });

    let fields = [];
    let values = [];
    let idx = 1;

    const allowedFields = [
      'status', 'appointment_date', 'visit_start_date', 'visit_end_date',
      'visit_start_time', 'visit_end_time',
      'places_visited', 'kms_traveled', 'return_to_home', 'return_place',
      'return_km', 'problem1', 'problem2', 'solutions', 'part_used',
      'quantity_used', 'serial_number', 'remarks', 'under_warranty',
      'return_part_name', 'return_serial_number', 'letterhead_received',
      'letterhead_url'
    ];

    for (const key of allowedFields) {
      if (body[key] !== undefined) {
        fields.push(`${key} = $${idx++}`);
        values.push(body[key]);
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    values.push(String(callId));
    const q = `UPDATE assign_call SET ${fields.join(', ')} WHERE call_id::text = $${idx} RETURNING *`;

    const result = await pool.query(q, values);
    if (!result.rows || result.rows.length === 0) return res.status(404).json({ success: false, message: 'Not found' });

    return res.json({ success: true, call: result.rows[0] });
  } catch (err) {
    console.error('update-status error', err);
    return res.status(500).json({ success: false, message: 'Failed to update status' });
  }
});

router.post('/upload-attachment', requireAuth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
  if (!supabase) return res.status(500).json({ success: false, message: 'Supabase storage not configured' });

  try {
    const fileExt = req.file.originalname.split('.').pop();
    const fileName = `${crypto.randomUUID()}-${Date.now()}.${fileExt}`;
    const filePath = `engineer-attachments/${fileName}`;

    const { data, error } = await supabase.storage
      .from('attachments')
      .upload(filePath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false
      });

    if (error) {
      console.error('Supabase upload error:', error);
      return res.status(500).json({ success: false, message: 'Upload failed', error: error.message });
    }

    const { data: publicUrlData } = supabase.storage.from('attachments').getPublicUrl(filePath);

    res.json({ success: true, url: publicUrlData.publicUrl });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ success: false, message: 'Server upload error' });
  }
});

// Ensure assign_call table has resolution columns
(async function ensureAssignCallColumns() {
  try {
    const queries = [
      `ALTER TABLE assign_call ADD COLUMN IF NOT EXISTS problem1 TEXT`,
      `ALTER TABLE assign_call ADD COLUMN IF NOT EXISTS problem2 TEXT`,
      `ALTER TABLE assign_call ADD COLUMN IF NOT EXISTS solutions TEXT`,
      `ALTER TABLE assign_call ADD COLUMN IF NOT EXISTS part_used TEXT`,
      `ALTER TABLE assign_call ADD COLUMN IF NOT EXISTS quantity_used TEXT`,
      `ALTER TABLE assign_call ADD COLUMN IF NOT EXISTS appointment_date DATE`,
      `ALTER TABLE assign_call ADD COLUMN IF NOT EXISTS return_place TEXT`,
      `ALTER TABLE assign_call ADD COLUMN IF NOT EXISTS return_km NUMERIC`,
      `ALTER TABLE assign_call ADD COLUMN IF NOT EXISTS serial_number TEXT`,
      `ALTER TABLE assign_call ADD COLUMN IF NOT EXISTS remarks TEXT`,
      `ALTER TABLE assign_call ADD COLUMN IF NOT EXISTS under_warranty TEXT`,
      `ALTER TABLE assign_call ADD COLUMN IF NOT EXISTS return_part_name TEXT`,
      `ALTER TABLE assign_call ADD COLUMN IF NOT EXISTS return_serial_number TEXT`,
      `ALTER TABLE assign_call ADD COLUMN IF NOT EXISTS letterhead_url TEXT`,
      `ALTER TABLE assign_call ADD COLUMN IF NOT EXISTS visit_start_time TIME`,
      `ALTER TABLE assign_call ADD COLUMN IF NOT EXISTS visit_end_time TIME`
    ];
    for (const q of queries) {
      await pool.query(q);
    }
    console.log('serviceCallsRoute: ensured assign_call resolution columns exist');
  } catch (err) {
    console.warn('serviceCallsRoute: could not ensure assign_call columns:', err?.message || err);
  }
})();

// Update resolved details (problem1, problem2, solutions)
router.put('/assign-call/:callId/resolved-details', requireAuth, async (req, res) => {
  try {
    const callId = req.params.callId;
    const { problem1, problem2, solutions, status } = req.body;

    // Build dynamic update query
    let fields = [];
    let values = [];
    let idx = 1;

    if (problem1 !== undefined) { fields.push(`problem1 = $${idx++}`); values.push(problem1); }
    if (problem2 !== undefined) { fields.push(`problem2 = $${idx++}`); values.push(problem2); }
    if (solutions !== undefined) { fields.push(`solutions = $${idx++}`); values.push(solutions); }
    if (status !== undefined) { fields.push(`status = $${idx++}`); values.push(status); }

    if (fields.length === 0) {
      return res.status(400).json({ success: false, message: "No fields to update" });
    }

    values.push(String(callId));
    const q = `UPDATE assign_call SET ${fields.join(', ')} WHERE call_id::text = $${idx} RETURNING *`;

    const result = await pool.query(q, values);

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Call not found' });
    }

    res.json({ success: true, call: result.rows[0] });

  } catch (err) {
    console.error('Error updating resolved details:', err);
    res.status(500).json({ success: false, message: 'Failed to update call details' });
  }
});

// Mark letterhead received by engineer, or submitted to HR/admin
router.put('/assign-call/:callId/letterhead', requireAuth, async (req, res) => {
  try {
    const callId = req.params.callId;
    const action = (req.body.action || '').toString(); // 'receive' or 'submit'
    const requesterRole = req.user?.role ?? '';

    if (!action) return res.status(400).json({ success: false, message: 'Missing action' });

    if (action === 'receive') {
      // Allow engineers to mark letterhead received
      if ((requesterRole || '').toString().toLowerCase() !== 'engineer') {
        return res.status(403).json({ success: false, message: 'Only engineers can mark letterhead received' });
      }

      const q = `UPDATE assign_call SET letterhead_received = true WHERE call_id::text = $1 RETURNING *`;
      const result = await pool.query(q, [String(callId)]);
      if (!result.rows || result.rows.length === 0) return res.status(404).json({ success: false, message: 'Not found' });
      return res.json({ success: true, call: result.rows[0] });
    }

    if (action === 'submit') {
      // Only HR/Admin can mark submitted/received by HR
      if (!isHrOrAdmin(requesterRole)) {
        return res.status(403).json({ success: false, message: 'Only HR/Admin can mark letterhead submitted' });
      }

      const q = `UPDATE assign_call SET letterhead_submitted = true, status = $1 WHERE call_id::text = $2 RETURNING *`;
      const newStatus = 'letterhead_received_by_hr';
      const result = await pool.query(q, [newStatus, String(callId)]);
      if (!result.rows || result.rows.length === 0) return res.status(404).json({ success: false, message: 'Not found' });
      return res.json({ success: true, call: result.rows[0] });
    }

    return res.status(400).json({ success: false, message: 'Unsupported action' });
  } catch (err) {
    console.error('letterhead update error', err);
    return res.status(500).json({ success: false, message: 'Failed to update letterhead status' });
  }
});