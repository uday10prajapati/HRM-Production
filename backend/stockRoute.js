import express from 'express';
import { pool } from './db.js';
import { sendNotification } from './notify.js';

const router = express.Router();

// Create tables if not exist
async function ensureTables() {
  await pool.query(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
    CREATE TABLE IF NOT EXISTS stock_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      sku TEXT UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      quantity INTEGER NOT NULL DEFAULT 0,
      threshold INTEGER NOT NULL DEFAULT 5,
      created_at TIMESTAMP DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS engineer_stock (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      engineer_id UUID NOT NULL,
      stock_item_id UUID NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
      quantity INTEGER NOT NULL DEFAULT 0,
      assigned_at TIMESTAMP DEFAULT now(),
      last_reported_at TIMESTAMP,
      last_reported_by TEXT,
      UNIQUE(engineer_id, stock_item_id)
    );

    CREATE TABLE IF NOT EXISTS stock_consumption (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      engineer_id UUID,
      stock_item_id UUID REFERENCES stock_items(id) ON DELETE SET NULL,
      quantity INTEGER NOT NULL,
      note TEXT,
      consumed_at TIMESTAMP DEFAULT now()
    );
  `);
}

// ensure on import
ensureTables().catch((err) => console.error('Failed to ensure stock tables:', err));

// List central stock items
router.get('/items', async (req, res) => {
  try {
    const q = await pool.query('SELECT * FROM stock_items ORDER BY name');
    res.json(q.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch stock items' });
  }
});

// Create or update item
router.post('/items', async (req, res) => {
  const { sku, name, description, quantity = 0, threshold = 5 } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  try {
    const insert = await pool.query(
      `INSERT INTO stock_items (sku,name,description,quantity,threshold) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (sku) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description, quantity=EXCLUDED.quantity, threshold=EXCLUDED.threshold
       RETURNING *`,
      [sku || null, name, description || null, Number(quantity || 0), Number(threshold || 5)]
    );
    res.json({ item: insert.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create/update item' });
  }
});

// Assign stock item to engineer (create or upsert)
router.post('/assign', async (req, res) => {
  const { engineerId, stockItemId, quantity = 0 } = req.body;
  if (!engineerId || !stockItemId) return res.status(400).json({ error: 'engineerId and stockItemId required' });
  try {
    // Ensure existing schema can accept UUID/text values: if columns are integer type
    // convert them to TEXT so UUID strings won't break.
    try {
      const colRes = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='engineer_stock' AND column_name IN ('engineer_id','stock_item_id')");
      const colMap = {};
      for (const r of colRes.rows) colMap[r.column_name] = r.data_type;
      if (colMap['engineer_id'] && colMap['engineer_id'].toLowerCase().includes('int')) {
        try {
          await pool.query("ALTER TABLE engineer_stock ALTER COLUMN engineer_id TYPE TEXT USING engineer_id::text");
          console.log('Converted engineer_stock.engineer_id to TEXT');
        } catch (e) {
          console.warn('Could not convert engineer_id to TEXT', e?.message || e);
        }
      }
      if (colMap['stock_item_id'] && colMap['stock_item_id'].toLowerCase().includes('int')) {
        try {
          await pool.query("ALTER TABLE engineer_stock ALTER COLUMN stock_item_id TYPE TEXT USING stock_item_id::text");
          console.log('Converted engineer_stock.stock_item_id to TEXT');
        } catch (e) {
          console.warn('Could not convert stock_item_id to TEXT', e?.message || e);
        }
      }
    } catch (colErr) {
      // ignore schema check errors and proceed
      console.warn('Could not inspect engineer_stock columns', colErr?.message || colErr);
    }

    const up = await pool.query(
      `INSERT INTO engineer_stock (engineer_id, stock_item_id, quantity) VALUES ($1,$2,$3)
       ON CONFLICT (engineer_id, stock_item_id) DO UPDATE SET quantity = engineer_stock.quantity + EXCLUDED.quantity, assigned_at = now()
       RETURNING *`,
      [String(engineerId), String(stockItemId), Number(quantity || 0)]
    );
    res.json({ assigned: up.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to assign stock' });
  }
});

// Get engineer stock
router.get('/engineer/:id', async (req, res) => {
  const id = req.params.id;
  try {
    // Accept both UUID and legacy integer-like engineer IDs by comparing as text.
    const q = await pool.query(
      `SELECT es.id as engineer_stock_id, es.engineer_id, es.quantity as engineer_quantity, si.*
       FROM engineer_stock es
       JOIN stock_items si ON si.id = es.stock_item_id
       WHERE es.engineer_id::text = $1
       ORDER BY si.name`,
      [String(id)]
    );
    res.json(q.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch engineer stock' });
  }
});

// Consume stock (engineer uses part). This will deduct from engineer_stock if exists, otherwise from central stock.
router.post('/consume', async (req, res) => {
  const { engineerId, stockItemId, quantity = 1, note } = req.body;
  if (!stockItemId || !quantity) return res.status(400).json({ error: 'stockItemId and quantity required' });
  const q = await pool.query('BEGIN').catch(() => null);
  try {
    // Prefer deducting from engineer stock
    const es = await pool.query(
      'SELECT * FROM engineer_stock WHERE engineer_id::text = $1 AND stock_item_id::text = $2 FOR UPDATE',
      [engineerId != null ? String(engineerId) : null, stockItemId != null ? String(stockItemId) : null]
    );
    if (es.rowCount > 0 && es.rows[0].quantity >= quantity) {
      await pool.query('UPDATE engineer_stock SET quantity = quantity - $1 WHERE id = $2', [quantity, es.rows[0].id]);
    } else {
      // deduct from central stock
      await pool.query('UPDATE stock_items SET quantity = GREATEST(quantity - $1, 0) WHERE id = $2', [quantity, stockItemId]);
      // if engineer had some, reduce as much as possible
      if (es.rowCount > 0 && es.rows[0].quantity > 0) {
        const toDeduct = Math.min(es.rows[0].quantity, quantity);
        await pool.query('UPDATE engineer_stock SET quantity = GREATEST(quantity - $1, 0) WHERE id = $2', [toDeduct, es.rows[0].id]);
      }
    }

    // record consumption
    const ins = await pool.query(
      'INSERT INTO stock_consumption (engineer_id, stock_item_id, quantity, note) VALUES ($1,$2,$3,$4) RETURNING *',
      [engineerId || null, stockItemId, Number(quantity), note || null]
    );

    await pool.query('COMMIT');
    res.json({ consumed: ins.rows[0] });
  } catch (err) {
    await pool.query('ROLLBACK').catch(() => null);
    console.error(err);
    res.status(500).json({ error: 'Failed to consume stock' });
  }
});

// Low stock alerts for central and optional engineer
router.get('/alerts', async (req, res) => {
  const { engineerId } = req.query;
  try {
    const central = await pool.query('SELECT id, sku, name, quantity, threshold FROM stock_items WHERE quantity <= threshold ORDER BY quantity');
    let engineer = [];
      if (engineerId) {
      engineer = await pool.query(`SELECT es.engineer_id, es.quantity, si.id as stock_item_id, si.sku, si.name, si.threshold
        FROM engineer_stock es JOIN stock_items si ON si.id = es.stock_item_id
        WHERE es.engineer_id::text = $1 AND es.quantity <= si.threshold ORDER BY es.quantity`, [String(engineerId)]);
    }
    res.json({ central: central.rows, engineer: engineer.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// Admin: get central stock with engineer allocations
router.get('/overview', async (req, res) => {
  try {
    const items = await pool.query('SELECT * FROM stock_items ORDER BY name');
    const allocations = await pool.query('SELECT * FROM engineer_stock');
    res.json({ items: items.rows, allocations: allocations.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch overview' });
  }
});

// PUT set engineer's remaining quantity for a specific item (engineer reports remaining)
router.put('/engineer/:engineerId/item/:itemId', async (req, res) => {
  const { engineerId, itemId } = req.params;
  const { quantity } = req.body;
  // Accept both UUID and legacy numeric IDs. We avoid strict regex checks so
  // clients that still send integer-like ids don't get rejected. Postgres will
  // be able to compare text representations when necessary.
  const qQty = Number(quantity);
  if (!Number.isFinite(qQty) || qQty < 0) return res.status(400).json({ error: 'quantity must be a non-negative number' });
  try {
    // upsert engineer_stock with exact quantity and record reporter
    const reporter = req.header('x-user-id') || req.body.reportedBy || null;
    console.log(`PUT /api/stock/engineer/${engineerId}/item/${itemId} called with quantity=${qQty} reporter=${reporter}`);
    const up = await pool.query(
      `INSERT INTO engineer_stock (engineer_id, stock_item_id, quantity, last_reported_at, last_reported_by) VALUES ($1,$2,$3, now(), $4)
       ON CONFLICT (engineer_id, stock_item_id) DO UPDATE SET quantity = EXCLUDED.quantity, last_reported_at = now(), last_reported_by = EXCLUDED.last_reported_by
       RETURNING *`,
      [engineerId, itemId, qQty, reporter]
    );

    // Check threshold and optionally notify via webhook
    try {
  const it = await pool.query('SELECT threshold, name FROM stock_items WHERE id=$1 LIMIT 1', [itemId]);
      const threshold = it.rows && it.rows[0] ? Number(it.rows[0].threshold || 0) : null;
      const itemName = it.rows && it.rows[0] ? it.rows[0].name : null;
      if (threshold !== null && qQty <= threshold) {
        // send webhook if configured (or fallback to stub)
        const webhook = process.env.STOCK_WEBHOOK_URL || null;
        try {
          await sendNotification({ webhookUrl: webhook, subject: 'low_stock_report', payload: { event: 'low_stock_report', engineerId, itemId, itemName, quantity: qQty, threshold, reportedBy: reporter, reportedAt: new Date().toISOString() } });
        } catch (fw) {
          console.warn('Failed to call stock webhook', fw?.message || fw);
        }
      }
    } catch (checkErr) {
      console.warn('Could not check threshold or send webhook', checkErr?.message || checkErr);
    }

    res.json({ success: true, updated: up.rows[0] });
  } catch (err) {
    console.error('Failed to set engineer stock quantity', err);
    res.status(500).json({ error: 'Failed to set quantity' });
  }
});

// Ensure schema changes are applied on startup (add columns if missing)
;(async function ensureColumns() {
  try {
    await pool.query(`ALTER TABLE engineer_stock ADD COLUMN IF NOT EXISTS last_reported_at TIMESTAMP`);
    await pool.query(`ALTER TABLE engineer_stock ADD COLUMN IF NOT EXISTS last_reported_by TEXT`);
    console.log('✅ Ensured engineer_stock report columns');
  } catch (err) {
    console.warn('Could not ensure engineer_stock columns:', err?.message || err);
  }
})();

// Enhanced overview: include engineer allocations with last_reported fields and engineer name
router.get('/overview/full', async (req, res) => {
  try {
    const items = await pool.query('SELECT * FROM stock_items ORDER BY name');
    const allocations = await pool.query(`
      SELECT es.*, u.name as engineer_name, si.name as item_name, si.threshold as item_threshold
      FROM engineer_stock es
  LEFT JOIN users u ON u.id::text = es.engineer_id::text
  LEFT JOIN stock_items si ON si.id::text = es.stock_item_id::text
      ORDER BY u.name, si.name
    `);
    res.json({ items: items.rows, allocations: allocations.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch full overview' });
  }
});

export default router;
