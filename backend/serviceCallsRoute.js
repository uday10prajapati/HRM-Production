import express from 'express';
import { pool } from './db.js';
import requireAuth from './authMiddleware.js';

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
                description
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
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
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
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

// POST /api/service_calls
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

// GET /api/service_calls/:id
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;

    // ✅ Corrected SQL syntax and table name
    const q = `
      SELECT 
        sc.*, 
        u_e.name AS engineer_name, 
        u_c.name AS customer_name
      FROM service_calls sc
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
    console.error('/service_calls/:id GET error', err);
    return res.status(500).json({
      success: false,
      message: 'Error fetching service call',
      error: err?.message ?? String(err)
    });
  }
});


// PUT /api/service_calls/:id/assign
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
      UPDATE service_calls 
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
        const smsMessage = `New service call assigned: ${updatedCall.title}${
          customerName ? ' for ' + customerName : ''
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
    console.error('/service_calls/:id/assign PUT error', err);
    return res.status(500).json({
      success: false,
      message: 'Error assigning engineer',
      error: err?.message ?? String(err)
    });
  }
});

// Move this route to the top of your routes (before any :id routes)
router.post('/search', async (req, res) => {
    let client = null;
    try {
        const { soccd, society } = req.body;
        console.log('Search params:', { soccd, society });
        
        client = await pool.connect();
        
    // Query for societies: combine three source tables and return unified
    // columns named `code`, `society`, `taluka` so the frontend can render
    // a single table. Keep a SOURCE column to know origin if needed.
    const societyQuery = `
      SELECT * FROM (
        SELECT 
          'Tapi'::text AS source,
          "SOCCD"::text AS code,
          "SOCIETY"::text AS society,
          "TALUKA NAME"::text AS taluka
        FROM service_call_tapi
        WHERE ($1::text IS NULL OR "SOCCD"::text = $1::text)
          AND ($2::text IS NULL OR UPPER("SOCIETY") LIKE UPPER($2 || '%'))
        UNION ALL
        SELECT 
          'Surat'::text AS source,
          "SOCCD"::text AS code,
          "SOCIETY"::text AS society,
          "TALUKA NAME"::text AS taluka
        FROM service_call_surat
        WHERE ($1::text IS NULL OR "SOCCD"::text = $1::text)
          AND ($2::text IS NULL OR UPPER("SOCIETY") LIKE UPPER($2 || '%'))
        UNION ALL
        SELECT 
          'Dairy'::text AS source,
          "SOCCD"::text AS code,
          "SOCIETY"::text AS society,
          "TALUKA NAME"::text AS taluka
        FROM service_call_dairy_list
        WHERE ($1::text IS NULL OR "SOCCD"::text = $1::text)
          AND ($2::text IS NULL OR UPPER("SOCIETY") LIKE UPPER($2 || '%'))
      ) combined_results
      ORDER BY source, society
      LIMIT 200000
    `;

        // Query for engineers
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

        // Execute both queries
        const [societyResult, engineerResult] = await Promise.all([
            client.query(societyQuery, [
                soccd ? Number(soccd.trim()) : null,
                society ? society.trim().toUpperCase() : null
            ]),
            client.query(engineerQuery)
        ]);
        
        console.log('Query results - Societies:', societyResult.rows.length);
        console.log('Query results - Engineers:', engineerResult.rows.length);
        
        res.json({
            success: true,
            data: {
                societies: societyResult.rows,
                engineers: engineerResult.rows
            }
        });
        
    } catch (err) {
        console.error('Search error:', err);
        res.status(500).json({
            success: false,
            error: 'Search failed',
            message: err.message
        });
    } finally {
        if (client) {
            client.release();
        }
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