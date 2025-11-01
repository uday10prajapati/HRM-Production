import express from 'express';
import { pool } from './db.js';
import requireAuth from './authMiddleware.js';

const router = express.Router();

// ensure live_locations table exists
(async function ensureLiveLocationsTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS live_locations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        latitude DOUBLE PRECISION,
        longitude DOUBLE PRECISION,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_live_locations_user_updated_at ON live_locations (user_id, updated_at);`);
    console.log('liveLocationsRoute: ensured live_locations table exists');
  } catch (err) {
    console.error('liveLocationsRoute startup error:', err?.message ?? err);
  }
})();

// GET /api/live_locations/latest?userId=...
// Returns the most recent live_locations row for the given user (if any)
router.get('/latest', requireAuth, async (req, res) => {
  try {
    const userId = req.query.userId ?? null;
    if (!userId) return res.status(400).json({ success: false, message: 'Missing userId' });

    // authorization: admin/hr can query any; others only self
    const requesterRole = req.user?.role ?? null;
    const requesterId = req.user?.id ?? null;
    if (requesterRole !== 'admin' && requesterRole !== 'hr') {
      if (String(userId) !== String(requesterId)) return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const q = `SELECT user_id, latitude, longitude, to_char(updated_at, 'YYYY-MM-DD HH24:MI:SS') AS updated_at
               FROM live_locations
               WHERE user_id::text = $1
               ORDER BY updated_at DESC
               LIMIT 1`;
    const result = await pool.query(q, [String(userId)]);
    const row = result.rows[0] ?? null;
    if (!row) return res.json({ success: true, location: null });
    return res.json({ success: true, location: row });
  } catch (err) {
    console.error('/live_locations/latest error', err);
    return res.status(500).json({ success: false, message: 'Error fetching latest live location', error: err?.message ?? String(err) });
  }
});

// GET /api/live_locations?userId=...&limit=...
// Returns recent live location rows for a user
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.query.userId ?? null;
    if (!userId) return res.status(400).json({ success: false, message: 'Missing userId' });
    const limit = Number(req.query.limit ?? 50);

    const requesterRole = req.user?.role ?? null;
    const requesterId = req.user?.id ?? null;
    if (requesterRole !== 'admin' && requesterRole !== 'hr') {
      if (String(userId) !== String(requesterId)) return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const q = `SELECT id, user_id, latitude, longitude, to_char(updated_at, 'YYYY-MM-DD HH24:MI:SS') AS updated_at
               FROM live_locations
               WHERE user_id::text = $1
               ORDER BY updated_at DESC
               LIMIT $2`;
    const result = await pool.query(q, [String(userId), limit]);
    return res.json({ success: true, rows: result.rows || [] });
  } catch (err) {
    console.error('/live_locations error', err);
    return res.status(500).json({ success: false, message: 'Error fetching live locations', error: err?.message ?? String(err) });
  }
});

// POST /api/live_locations/upsert
// Body: { userId, latitude, longitude }
// Inserts a new live location row (keeps history). Admin/hr can upsert for any user; others only for themselves.
router.post('/upsert', requireAuth, async (req, res) => {
  try {
    const body = req.body || {};
    const userId = body.userId ?? body.user_id ?? null;
    const lat = body.latitude ?? null;
    const lng = body.longitude ?? null;
    if (!userId) return res.status(400).json({ success: false, message: 'Missing userId' });
    if (lat == null || lng == null) return res.status(400).json({ success: false, message: 'Missing latitude or longitude' });

    const requesterRole = req.user?.role ?? null;
    const requesterId = req.user?.id ?? null;
    if (requesterRole !== 'admin' && requesterRole !== 'hr') {
      if (String(userId) !== String(requesterId)) return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const q = `INSERT INTO live_locations (user_id, latitude, longitude, updated_at) VALUES ($1,$2,$3,now()) RETURNING user_id, latitude, longitude, to_char(updated_at, 'YYYY-MM-DD HH24:MI:SS') AS updated_at`;
    const result = await pool.query(q, [String(userId), Number(lat), Number(lng)]);
    return res.json({ success: true, location: result.rows[0] });
  } catch (err) {
    console.error('/live_locations/upsert error', err);
    return res.status(500).json({ success: false, message: 'Error inserting live location', error: err?.message ?? String(err) });
  }
});

// POST /api/live_locations/upload-location
// Body: [{ userId, latitude, longitude, timestamp }, ...]
// Inserts or updates multiple live location rows. Each request processes an array of location objects.
router.post('/upload-location', async (req, res) => {
  try {
    // Validate input
    const locations = req.body;
    if (!Array.isArray(locations)) {
      return res.status(400).json({
        status: 'error',
        message: 'Input must be an array of location points'
      });
    }

    // Validate each location object
    for (const loc of locations) {
      if (!loc.userId || !loc.latitude || !loc.longitude || !loc.timestamp) {
        return res.status(400).json({
          status: 'error',
          message: 'Each location must have userId, latitude, longitude, and timestamp'
        });
      }
    }

    // Get database connection
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Process each location
      for (const loc of locations) {
        const query = `
                    INSERT INTO live_locations 
                        (user_id, latitude, longitude, updated_at)
                    VALUES 
                        ($1, $2, $3, $4)
                    ON CONFLICT (user_id, updated_at) 
                    DO UPDATE SET
                        latitude = EXCLUDED.latitude,
                        longitude = EXCLUDED.longitude
                `;

        await client.query(query, [
          loc.userId,
          loc.latitude,
          loc.longitude,
          loc.timestamp
        ]);
      }

      await client.query('COMMIT');

      res.json({
        status: 'success',
        message: 'Location data updated successfully'
      });

    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

  } catch (err) {
    console.error('Error processing location data:', err);
    res.status(500).json({
      status: 'error',
      message: 'Failed to process location data'
    });
  }
});

// Update the timeline route to use live_locations table
router.get('/timeline/:userId', requireAuth, async (req, res) => {
    try {
        const { userId } = req.params;
        const { date } = req.query;

        console.log('Timeline request:', { userId, date });

        const query = `
            WITH daily_points AS (
                SELECT 
                    user_id,
                    latitude,
                    longitude,
                    updated_at,
                    ROW_NUMBER() OVER (PARTITION BY DATE(updated_at) ORDER BY updated_at) as first_point,
                    ROW_NUMBER() OVER (PARTITION BY DATE(updated_at) ORDER BY updated_at DESC) as last_point,
                    COUNT(*) OVER (PARTITION BY DATE(updated_at)) as total_points
                FROM live_locations
                WHERE user_id = $1
                AND DATE(updated_at) = $2::date
            )
            SELECT 
                user_id,
                latitude,
                longitude,
                updated_at,
                CASE 
                    WHEN first_point = 1 THEN 'START'
                    WHEN last_point = 1 THEN 'END'
                    ELSE 'MOVEMENT'
                END as point_type
            FROM daily_points
            ORDER BY updated_at ASC;
        `;

        const result = await pool.query(query, [userId, date]);

        console.log('Query results:', result.rows);

        if (result.rows.length === 0) {
            return res.json({
                success: true,
                timeline: [],
                message: 'No locations found for this date'
            });
        }

        // Format the data
        const timeline = result.rows.map(row => ({
            latitude: Number(row.latitude),
            longitude: Number(row.longitude),
            updated_at: row.updated_at,
            point_type: row.point_type
        }));

        console.log('Formatted timeline:', timeline);

        res.json({
            success: true,
            timeline: timeline
        });

    } catch (err) {
        console.error('Error fetching timeline:', err);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch timeline',
            error: err.message
        });
    }
});

// Helper function to calculate distance between two points
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in kilometers
}

export default router;