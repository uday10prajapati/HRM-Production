import express from 'express';
import { pool } from './db.js';
import requireAuth from './authMiddleware.js';

const router = express.Router();




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
function isManagerOrAdmin(role) {
  if (!role) return false;
  const r = role.toString().toLowerCase();
  return r === 'admin' || r === 'manager' || r === 'hr';
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

    const q = `INSERT INTO service_calls (title, description, customer_id, engineer_id, scheduled_at) VALUES ($1,$2,$3,$4,$5) RETURNING *`;
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
    console.error('/service_calls POST error', err);
    return res.status(500).json({ success: false, message: 'Error creating service call', error: err?.message ?? String(err) });
  }
});

// GET /api/service_calls
// optional query: engineerId, customerId
router.get('/', requireAuth, async (req, res) => {
  try {
    const engineerId = req.query.engineerId ?? req.query.engineer_id ?? null;
    const customerId = req.query.customerId ?? req.query.customer_id ?? null;

    const vals = [];
    const where = [];
    if (engineerId) { vals.push(String(engineerId)); where.push(`engineer_id::text = $${vals.length}`); }
    if (customerId) { vals.push(String(customerId)); where.push(`customer_id::text = $${vals.length}`); }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const q = `SELECT sc.*, u_e.name AS engineer_name, u_c.name AS customer_name FROM service_calls sc LEFT JOIN users u_e ON u_e.id::text = sc.engineer_id::text LEFT JOIN users u_c ON u_c.id::text = sc.customer_id::text ${whereClause} ORDER BY sc.created_at DESC LIMIT 1000`;
    const result = await pool.query(q, vals);
    return res.json({ success: true, calls: result.rows || [] });
  } catch (err) {
    console.error('/service_calls GET error', err);
    return res.status(500).json({ success: false, message: 'Error fetching service calls', error: err?.message ?? String(err) });
  }
});

// GET /api/service_calls/:id
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const q = `SELECT sc.*, u_e.name AS engineer_name, u_c.name AS customer_name FROM service_calls sc LEFT JOIN users u_e ON u_e.id::text = sc.engineer_id::text LEFT JOIN users u_c ON u_c.id::text = sc.customer_id::text WHERE sc.id::text = $1`;
    const result = await pool.query(q, [String(id)]);
    const row = result.rows[0] ?? null;
    if (!row) return res.status(404).json({ success: false, message: 'Not found' });
    return res.json({ success: true, call: row });
  } catch (err) {
    console.error('/service_calls/:id GET error', err);
    return res.status(500).json({ success: false, message: 'Error fetching service call', error: err?.message ?? String(err) });
  }
});

// PUT /api/service_calls/:id/assign
// Body: { engineerId }
router.put('/:id/assign', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const body = req.body || {};
    const engineerId = body.engineerId ?? body.engineer_id ?? null;
    if (!engineerId) return res.status(400).json({ success: false, message: 'Missing engineerId' });

    const requesterRole = req.user?.role ?? null;
    if (!isManagerOrAdmin(requesterRole)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const q = `UPDATE service_calls SET engineer_id=$1, updated_at=now() WHERE id::text=$2 RETURNING *`;
    const result = await pool.query(q, [String(engineerId), String(id)]);
    if (!result.rows || result.rows.length === 0) return res.status(404).json({ success: false, message: 'Not found' });
    const updatedCall = result.rows[0];

    // Fetch engineer contact info (non-blocking best-effort notification)
    (async () => {
      try {
        const engR = await pool.query('SELECT id, name, mobile_number, fcm_token, email FROM users WHERE id::text = $1 LIMIT 1', [String(engineerId)]);
        const eng = engR.rows && engR.rows[0] ? engR.rows[0] : null;
        if (!eng) {
          console.warn('Assigned engineer not found for notifications:', engineerId);
          return;
        }

        const customerR = await pool.query('SELECT id, name FROM users WHERE id::text = $1 LIMIT 1', [String(updatedCall.customer_id)]).catch(() => null);
        const customerName = customerR && customerR.rows && customerR.rows[0] ? customerR.rows[0].name : null;

        const smsMessage = `New service call assigned: ${updatedCall.title}${customerName ? ' for ' + customerName : ''}. Please check your app.`;

        // Fire-and-forget notifications; they log their own errors and won't affect API response
        sendSmsViaTwilio(eng.mobile_number, smsMessage).catch((e) => console.warn('SMS send error (ignored):', e));
        sendFcmPush(eng.fcm_token, 'New Service Call Assigned', smsMessage, { callId: updatedCall.id }).catch((e) => console.warn('FCM send error (ignored):', e));
      } catch (notifyErr) {
        console.error('Notification worker error (ignored):', notifyErr?.message || notifyErr);
      }
    })();

    return res.json({ success: true, call: updatedCall });
  } catch (err) {
    console.error('/service_calls/:id/assign PUT error', err);
    return res.status(500).json({ success: false, message: 'Error assigning engineer', error: err?.message ?? String(err) });
  }
});

// Move this route to the top of your routes (before any :id routes)
router.post('/search', async (req, res) => {
    let client = null;
    try {
        const { soccd, society } = req.body;
        console.log('Search params:', { soccd, society });
        
        client = await pool.connect();
        
        // Query for societies
        const societyQuery = `
            SELECT * FROM (
                SELECT 
                    UPPER('Tapi') as SOURCE,
                    "SOCCD" as SOCCD,
                    UPPER("SOCIETY") as SOCIETY,
                    UPPER("TALUKA NAME") as TALUKA
                FROM service_call_tapi 
                WHERE ($1::numeric IS NULL OR "SOCCD" = $1::numeric)
                    AND ($2::text IS NULL OR UPPER("SOCIETY") LIKE UPPER($2 || '%'))
                UNION ALL
                SELECT 
                    UPPER('Surat') as SOURCE,
                    "SOCCD" as SOCCD,
                    UPPER("SOCIETY") as SOCIETY,
                    UPPER("TALUKA NAME") as TALUKA
                FROM service_call_surat 
                WHERE ($1::numeric IS NULL OR "SOCCD" = $1::numeric)
                    AND ($2::text IS NULL OR UPPER("SOCIETY") LIKE UPPER($2 || '%'))
                UNION ALL
                SELECT 
                    UPPER('Dairy') as SOURCE,
                    "SOCCD" as SOCCD,
                    UPPER("SOCIETY") as SOCIETY,
                    UPPER("TALUKA NAME") as TALUKA
                FROM service_call_dairy_list 
                WHERE ($1::numeric IS NULL OR "SOCCD" = $1::numeric)
                    AND ($2::text IS NULL OR UPPER("SOCIETY") LIKE UPPER($2 || '%'))
            ) combined_results
            ORDER BY SOURCE, SOCIETY
            LIMIT 2000
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