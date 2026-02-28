import { pool } from './db.js';

// Simple auth middleware that resolves requester from X-User-Id header or ?userId
// Attaches req.user = { id, role }
export default async function requireAuth(req, res, next) {
  try {
    let headerId = req.header('x-user-id') || req.query.userId || null;

    // Legacy support for older Mobile App builds that hardcoded 'admin' into the tracking requests
    if (headerId === 'admin' && req.body && req.body.userId) {
      headerId = req.body.userId;
    }

    if (!headerId) {
      return res.status(401).json({ success: false, message: 'Missing X-User-Id header or userId query param' });
    }
    // Try to resolve header as id first (works for UUID or legacy ints)
    let r = await pool.query('SELECT id, role FROM users WHERE id::text = $1 LIMIT 1', [String(headerId)]);
    if (!r.rows || r.rows.length === 0) {
      // If header looks like an email, try resolving by email
      if (String(headerId).includes('@')) {
        try {
          r = await pool.query('SELECT id, role FROM users WHERE LOWER(email)=LOWER($1) LIMIT 1', [String(headerId)]);
        } catch (emailErr) {
          console.warn('authMiddleware email lookup failed', emailErr?.message ?? emailErr);
        }
      }
    }

    if (!r.rows || r.rows.length === 0) {
      console.warn('authMiddleware: could not resolve user for header:', headerId);
      return res.status(401).json({ success: false, message: 'Invalid user id or email' });
    }
    req.user = { id: r.rows[0].id, role: (r.rows[0].role || '').toString().toLowerCase() };
    return next();
  } catch (err) {
    console.error('authMiddleware error', err?.message ?? err);
    return res.status(500).json({ success: false, message: 'Auth error', error: String(err?.message || err) });
  }
}
