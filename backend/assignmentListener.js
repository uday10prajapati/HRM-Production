import { pool } from './db.js';

// This module listens for Postgres NOTIFY events on the 'service_call_assigned' channel.
// When a payload arrives, it sends best-effort SMS and FCM notifications to the assigned engineer.
// It uses the same environment variables as serviceCallsRoute for Twilio and FCM.

async function sendSmsViaTwilio(toNumber, message) {
  try {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_FROM;
    if (!sid || !token || !from) {
      console.log('assignmentListener: TWILIO not configured, skipping SMS');
      return;
    }

    if (typeof fetch !== 'function') {
      console.warn('assignmentListener: global fetch not available - cannot send SMS');
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
      console.warn('assignmentListener: Twilio SMS failed:', res.status, text);
    } else {
      console.log('assignmentListener: Twilio SMS sent to', toNumber);
    }
  } catch (err) {
    console.error('assignmentListener: sendSmsViaTwilio error', err?.message || err);
  }
}

async function sendFcmPush(fcmToken, title, bodyText, data = {}) {
  try {
    const serverKey = process.env.FCM_SERVER_KEY;
    if (!serverKey) {
      console.log('assignmentListener: FCM_SERVER_KEY not configured, skipping push');
      return;
    }
    if (!fcmToken) {
      console.log('assignmentListener: missing fcmToken, skipping push');
      return;
    }

    if (typeof fetch !== 'function') {
      console.warn('assignmentListener: global fetch not available - cannot send push');
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
      console.warn('assignmentListener: FCM push failed:', res.status, text);
    } else {
      console.log('assignmentListener: FCM push sent to token');
    }
  } catch (err) {
    console.error('assignmentListener: sendFcmPush error', err?.message || err);
  }
}

let listeningClient = null;

export default async function startAssignmentListener() {
  try {
    // Use a dedicated client for LISTEN/NOTIFY
    const client = await pool.connect();
    listeningClient = client;

    // If pg library exposes 'on' for notifications via the client, use that.
    client.on('notification', async (msg) => {
      try {
        if (!msg || !msg.channel) return;
        if (msg.channel !== 'service_call_assigned') return;

        let payload = null;
        try {
          payload = JSON.parse(msg.payload);
        } catch (e) {
          console.warn('assignmentListener: invalid payload', msg.payload);
          return;
        }

        const { call_id: callId, engineer_id: engineerId } = payload;
        if (!callId || !engineerId) return;

        // Fetch call and engineer info
        const callR = await pool.query('SELECT id, title, customer_id FROM assign_call WHERE id::text = $1 LIMIT 1', [String(callId)]);
        const call = callR.rows && callR.rows[0] ? callR.rows[0] : null;
        const engR = await pool.query('SELECT id, name, mobile_number, fcm_token, email FROM users WHERE id::text = $1 LIMIT 1', [String(engineerId)]);
        const eng = engR.rows && engR.rows[0] ? engR.rows[0] : null;

        if (!call || !eng) {
          console.warn('assignmentListener: call or engineer missing for payload', payload);
          return;
        }

        // Attempt to fetch customer name (best-effort)
        let customerName = null;
        try {
          const custR = await pool.query('SELECT id, name FROM users WHERE id::text = $1 LIMIT 1', [String(call.customer_id)]).catch(() => null);
          customerName = custR && custR.rows && custR.rows[0] ? custR.rows[0].name : null;
        } catch (e) {
          customerName = null;
        }

        const smsMessage = `New service call assigned: ${call.title}${customerName ? ' for ' + customerName : ''}. Please check your app.`;

        // Fire-and-forget notifications
        sendSmsViaTwilio(eng.mobile_number, smsMessage).catch((e) => console.warn('assignmentListener: SMS send error (ignored):', e));
        sendFcmPush(eng.fcm_token, 'New Service Call Assigned', smsMessage, { callId: call.id }).catch((e) => console.warn('assignmentListener: FCM send error (ignored):', e));

      } catch (err) {
        console.error('assignmentListener: notification handler error', err?.message || err);
      }
    });

    // Start listening
    await client.query('LISTEN service_call_assigned');
    console.log('assignmentListener: listening for service_call_assigned notifications');

    // Handle client errors and reconnect logic if needed
    client.on('error', (err) => {
      console.error('assignmentListener: pg client error', err?.message || err);
    });

    // Keep the client alive; do not release it
  } catch (err) {
    console.error('assignmentListener: failed to start', err?.message || err);
  }
}
