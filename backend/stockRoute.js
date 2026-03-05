import express from 'express';
import { pool } from './db.js';
import { sendNotification } from './notify.js';

const router = express.Router();

// Create tables if not exist
async function ensureTables() {
  await pool.query(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
    CREATE TABLE IF NOT EXISTS stock_items (
      id serial NOT NULL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      quantity INTEGER NOT NULL DEFAULT 0,
      threshold INTEGER NOT NULL DEFAULT 5,
      created_at TIMESTAMP DEFAULT now(),
      dairy_name TEXT,
      notes TEXT,
      use_item NUMERIC
    );

    CREATE TABLE IF NOT EXISTS engineer_stock (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      engineer_id UUID NOT NULL,
      stock_item_id INTEGER NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
      quantity INTEGER NOT NULL DEFAULT 0,
      assigned_at TIMESTAMP DEFAULT now(),
      last_reported_at TIMESTAMP,
      last_reported_by TEXT,
      UNIQUE(engineer_id, stock_item_id)
    );

    CREATE TABLE IF NOT EXISTS stock_consumption (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      engineer_id UUID,
      stock_item_id INTEGER REFERENCES stock_items(id) ON DELETE SET NULL,
      quantity INTEGER NOT NULL,
      note TEXT,
      consumed_at TIMESTAMP DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS wastage_stock (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      engineer_id UUID NOT NULL,
      stock_item_id INTEGER NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
      quantity INTEGER NOT NULL,
      reason TEXT,
      reported_at TIMESTAMP DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS product_items (
      "Product Name" text null
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

// Get engineer's current stock for a specific product
router.get('/engineer-stock/:engineerId/:productName', async (req, res) => {
  try {
    const { engineerId, productName } = req.params;

    // Query to find the stock quantity for the engineer for the specific product
    const result = await pool.query(
      `SELECT COALESCE(es.quantity, 0) as quantity
       FROM stock_items si
       LEFT JOIN engineer_stock es ON si.id = es.stock_item_id AND es.engineer_id = $1
       WHERE si.name = $2
       LIMIT 1`,
      [engineerId, decodeURIComponent(productName)]
    );

    if (result.rows.length === 0) {
      return res.json({ quantity: 0 });
    }

    res.json({ quantity: result.rows[0].quantity || 0 });
  } catch (err) {
    console.error('Error fetching engineer stock:', err);
    res.status(500).json({ error: 'Failed to fetch engineer stock', quantity: 0 });
  }
});

// Create or update item
router.post('/items', async (req, res) => {
  try {
    const { name, description, quantity, threshold, dairy_name, notes, use_item } = req.body;
    const result = await pool.query(
      `
      INSERT INTO stock_items (
        name,
        description,
        quantity,
        threshold,
        dairy_name,
        notes,
        use_item
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `,
      [name, description, quantity, threshold, dairy_name, notes, use_item]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error creating stock item:', err);
    res.status(500).json({ error: 'Failed to create stock item' });
  }
});

// Create stock item and optionally assign to engineer in one operation
router.post('/items-with-assign', async (req, res) => {
  const { name, description, quantity, threshold, dairy_name, notes, use_item, engineerId, assignQuantity } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { name, description, quantity, threshold, dairy_name, notes, use_item, engineerId, assignQuantity } = req.body;

    // 1. Create stock item
    const itemResult = await client.query(
      `
      INSERT INTO stock_items (
        name,
        description,
        quantity,
        threshold,
        dairy_name,
        notes,
        use_item
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `,
      [name, description, Number(quantity || 0), threshold || 1, dairy_name || null, notes || null, use_item || null]
    );

    let finalItem = itemResult.rows[0];
    let assignedToEngineer = null;

    // 2. Optionally assign to engineer
    if (engineerId && assignQuantity) {
      const assignResult = await client.query(
        `INSERT INTO engineer_stock (engineer_id, stock_item_id, quantity) VALUES ($1, $2, $3)
         ON CONFLICT (engineer_id, stock_item_id) DO UPDATE SET quantity = engineer_stock.quantity + EXCLUDED.quantity, assigned_at = now()
         RETURNING *`,
        [String(engineerId), String(finalItem.id), Number(assignQuantity || 0)]
      );
      assignedToEngineer = assignResult.rows[0];
      console.log(`✅ Assigned ${assignQuantity} units to engineer ${engineerId}. Central stock remains: ${finalItem.quantity}`);
    }

    await client.query('COMMIT');

    res.json({
      item: finalItem,
      assigned: assignedToEngineer,
      message: assignedToEngineer
        ? `Stock item created with ${quantity} units. Assigned ${assignQuantity} to engineer.`
        : `Stock item created with ${quantity} units.`,
      summary: assignedToEngineer ? {
        central_stock: finalItem.quantity,
        engineer_stock: assignQuantity,
        total_inventory: (finalItem.quantity + assignQuantity),
        note: 'Central stock unchanged. Only engineer_stock updated.'
      } : null
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => null);
    console.error('Error creating stock item with assignment:', err);
    res.status(500).json({ error: 'Failed to create stock item: ' + err.message });
  } finally {
    client.release();
  }
});

// Assign stock item to engineer (create or upsert)
router.post('/assign', async (req, res) => {
  const { engineerId, stockItemId, quantity = 0 } = req.body;
  if (!engineerId || !stockItemId) return res.status(400).json({ error: 'engineerId and stockItemId required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Only assign to engineer_stock using UPSERT
    // DO NOT modify central stock (stock_items.quantity)
    const assignResult = await client.query(
      `INSERT INTO engineer_stock (engineer_id, stock_item_id, quantity) 
       VALUES ($1, $2, $3)
       ON CONFLICT (engineer_id, stock_item_id) 
       DO UPDATE SET quantity = EXCLUDED.quantity, assigned_at = now()
       RETURNING *`,
      [String(engineerId), String(stockItemId), Number(quantity || 0)]
    );

    const getItem = await client.query(
      'SELECT quantity FROM stock_items WHERE id = $1',
      [String(stockItemId)]
    );

    if (getItem.rows.length === 0) {
      throw new Error(`Stock item ${stockItemId} not found`);
    }

    const centralQty = getItem.rows[0].quantity;
    const engineerQty = assignResult.rows[0].quantity;

    await client.query('COMMIT');

    console.log(`✅ Assigned ${quantity} units to engineer ${engineerId}. Central stock: ${centralQty}, Engineer stock: ${engineerQty}`);

    res.json({
      engineer_stock: assignResult.rows[0],
      central_stock_quantity: centralQty,
      message: `${quantity} units assigned to engineer ${engineerId}`,
      summary: {
        central_stock: centralQty,
        engineer_stock: engineerQty,
        total_inventory: (centralQty + engineerQty),
        note: 'Central stock unchanged. Only engineer_stock updated.'
      }
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => null);
    console.error('❌ Error assigning stock:', err);
    res.status(500).json({ error: 'Failed to assign stock: ' + err.message });
  } finally {
    client.release();
  }
});

// Get engineer stock
router.get('/engineer/:id', async (req, res) => {
  const id = req.params.id;
  try {
    // Accept both UUID and legacy integer-like engineer IDs by comparing as text.
    const q = await pool.query(
      `SELECT 
        es.id as engineer_stock_id, 
        es.engineer_id, 
        es.quantity as engineer_quantity,
        es.stock_item_id,
        si.id,
        si.name,
        si.sku,
        si.description,
        si.quantity,
        si.threshold,
        si.created_at
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

// Consume stock (engineer uses part). This will deduct from engineer_stock and ALSO from central stock.
router.post('/consume', async (req, res) => {
  const { engineerId, stockItemId, quantity = 1, note } = req.body;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const numQty = Number(quantity);
    if (isNaN(numQty) || numQty <= 0) {
      throw new Error("Quantity must be a positive number");
    }

    // 1️⃣ Get engineer stock (lock it for transaction safety)
    const es = await client.query(
      `SELECT * FROM engineer_stock 
       WHERE engineer_id::text = $1 AND stock_item_id::text = $2
       FOR UPDATE`,
      [String(engineerId), String(stockItemId)]
    );

    if (es.rowCount === 0) {
      throw new Error("Engineer does not have this item");
    }

    const currentEngineerQty = es.rows[0].quantity;
    if (currentEngineerQty < numQty) {
      throw new Error(`Not enough engineer stock. Has: ${currentEngineerQty}, Requested: ${numQty}`);
    }

    // 2️⃣ Deduct from engineer stock
    const engineerUpdate = await client.query(
      `UPDATE engineer_stock 
       SET quantity = GREATEST(quantity - $1, 0)
       WHERE engineer_id::text = $2 AND stock_item_id::text = $3
       RETURNING quantity`,
      [numQty, String(engineerId), String(stockItemId)]
    );

    // 3️⃣ Deduct from central stock
    const centralUpdate = await client.query(
      `UPDATE stock_items 
       SET quantity = GREATEST(quantity - $1::int, 0)
       WHERE id = $2::int
       RETURNING id, quantity, name`,
      [parseInt(numQty, 10), parseInt(stockItemId, 10)]
    );

    if (centralUpdate.rowCount === 0) {
      throw new Error(`Stock item ${stockItemId} not found in central inventory`);
    }

    // 4️⃣ Record consumption
    const consumption = await client.query(
      `INSERT INTO stock_consumption
      (engineer_id, stock_item_id, quantity, note)
      VALUES ($1,$2,$3,$4)
      RETURNING *`,
      [String(engineerId), String(stockItemId), numQty, note || null]
    );

    await client.query('COMMIT');

    const finalEngineerQty = engineerUpdate.rows[0].quantity;
    const finalCentralQty = centralUpdate.rows[0].quantity;

    console.log(`✅ Stock consumed: ${numQty} units`);
    console.log(`   Engineer stock remaining: ${finalEngineerQty}`);
    console.log(`   Central stock remaining: ${finalCentralQty}`);

    res.json({
      success: true,
      consumed: consumption.rows[0],
      item: centralUpdate.rows[0],
      summary: {
        quantity_used: numQty,
        engineer_stock_remaining: finalEngineerQty,
        central_stock_remaining: finalCentralQty,
        total_inventory_remaining: (finalEngineerQty + finalCentralQty),
        note: 'Both engineer and central stock were deducted'
      }
    });

  } catch (err) {
    await client.query('ROLLBACK').catch(() => null);
    console.error('❌ Error consuming stock:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Revert stock consumption (engineer deletes used part from a call). This will add back back to engineer_stock and central stock.
router.post('/revert-consume', async (req, res) => {
  const { engineerId, stockItemId, quantity = 1, note } = req.body;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const numQty = Number(quantity);
    if (isNaN(numQty) || numQty <= 0) {
      throw new Error("Quantity must be a positive number");
    }

    // 1️⃣ Add back to engineer stock
    const engineerUpdate = await client.query(
      `UPDATE engineer_stock 
       SET quantity = quantity + $1::int
       WHERE engineer_id::text = $2 AND stock_item_id::text = $3
       RETURNING quantity`,
      [parseInt(numQty, 10), String(engineerId), String(stockItemId)]
    );

    if (engineerUpdate.rowCount === 0) {
      throw new Error(`Engineer does not have this item to revert`);
    }

    // 2️⃣ Add back to central stock
    const centralUpdate = await client.query(
      `UPDATE stock_items 
       SET quantity = quantity + $1::int
       WHERE id = $2::int
       RETURNING id, quantity, name`,
      [parseInt(numQty, 10), parseInt(stockItemId, 10)]
    );

    if (centralUpdate.rowCount === 0) {
      throw new Error(`Stock item ${stockItemId} not found in central inventory`);
    }

    // 3️⃣ Optionally record the revert or just ignore (since consumption log is just for tracking, reverting might mean we insert negative consumption or leave it. Since we just want simple stock balance, adding back is sufficient).
    // Let's insert a negative consumption or specific note.
    const consumption = await client.query(
      `INSERT INTO stock_consumption
      (engineer_id, stock_item_id, quantity, note)
      VALUES ($1,$2,$3,$4)
      RETURNING *`,
      [String(engineerId), String(stockItemId), -numQty, note || "Reverted consumption"]
    );

    await client.query('COMMIT');

    const finalEngineerQty = engineerUpdate.rows[0].quantity;
    const finalCentralQty = centralUpdate.rows[0].quantity;

    console.log(`✅ Stock reverted: ${numQty} units`);
    console.log(`   Engineer stock restore: ${finalEngineerQty}`);
    console.log(`   Central stock restore: ${finalCentralQty}`);

    res.json({
      success: true,
      reverted: consumption.rows[0],
      item: centralUpdate.rows[0],
      summary: {
        quantity_reverted: numQty,
        engineer_stock_remaining: finalEngineerQty,
        central_stock_remaining: finalCentralQty
      }
    });

  } catch (err) {
    await client.query('ROLLBACK').catch(() => null);
    console.error('❌ Error reverting stock consumption:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Low stock alerts for central and optional engineer
router.get('/alerts', async (req, res) => {
  const { engineerId } = req.query;
  try {
    const central = await pool.query('SELECT id, name, quantity, threshold FROM stock_items WHERE quantity <= threshold ORDER BY quantity');
    let engineer = [];
    if (engineerId) {
      engineer = await pool.query(`SELECT es.engineer_id, es.quantity, si.id as stock_item_id, si.name, si.threshold
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

// Detailed stock deduction summary - Shows central stock vs engineer allocations with deductions
router.get('/deduction-summary', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        si.id,
        si.sku,
        si.name,
        si.quantity as central_quantity,
        si.threshold,
        si.created_at,
        COALESCE(SUM(es.quantity), 0)::int as total_engineer_allocation,
        COUNT(DISTINCT es.engineer_id)::int as engineer_count,
        (si.quantity + COALESCE(SUM(es.quantity), 0))::int as total_created,
        json_agg(json_build_object(
          'engineer_id', es.engineer_id, 
          'engineer_stock_id', es.id,
          'quantity', es.quantity,
          'assigned_at', es.assigned_at
        )) FILTER (WHERE es.id IS NOT NULL) as engineer_allocations
      FROM stock_items si
      LEFT JOIN engineer_stock es ON si.id = es.stock_item_id
      GROUP BY si.id, si.sku, si.name, si.quantity, si.threshold, si.created_at
      ORDER BY si.name
    `);

    // Format response to show deductions clearly
    const summary = result.rows.map(item => ({
      id: item.id,
      sku: item.sku,
      name: item.name,
      threshold: item.threshold,
      created_at: item.created_at,
      stock_status: {
        central_stock: item.central_quantity,
        total_engineer_allocations: item.total_engineer_allocation,
        total_created_initially: item.total_created,
        engineers_count: item.engineer_count
      },
      deduction_breakdown: {
        assigned_to_engineers: item.total_engineer_allocation,
        remaining_in_central: item.central_quantity,
        total_verified: item.total_created
      },
      engineer_allocations: item.engineer_allocations || []
    }));

    res.json(summary);
  } catch (err) {
    console.error('Stock deduction summary error:', err);
    res.status(500).json({ error: 'Failed to fetch deduction summary' });
  }
});

// Detailed stock status for specific engineer - Shows what they have and what they used
router.get('/engineer-status/:engineerId', async (req, res) => {
  try {
    const { engineerId } = req.params;

    const result = await pool.query(`
      SELECT 
        es.id as engineer_stock_id,
        es.engineer_id,
        es.quantity as current_allocated,
        es.assigned_at,
        si.id as stock_item_id,
        si.name,
        si.sku,
        si.quantity as central_quantity,
        si.threshold,
        COALESCE(SUM(sc.quantity), 0)::int as total_consumed,
        (es.quantity + COALESCE(SUM(sc.quantity), 0))::int as originally_assigned
      FROM engineer_stock es
      JOIN stock_items si ON si.id = es.stock_item_id
      LEFT JOIN stock_consumption sc ON sc.engineer_id::text = es.engineer_id::text 
        AND sc.stock_item_id = si.id
      WHERE es.engineer_id::text = $1
      GROUP BY es.id, es.engineer_id, es.quantity, es.assigned_at, 
               si.id, si.name, si.sku, si.quantity, si.threshold
      ORDER BY si.name
    `, [String(engineerId)]);

    // Get engineer name
    const engineerInfo = await pool.query(
      'SELECT id, name, mobile_number FROM users WHERE id::text = $1 LIMIT 1',
      [String(engineerId)]
    );

    const engineer = engineerInfo.rows[0];

    const statusSummary = result.rows.map(item => ({
      stock_item_id: item.stock_item_id,
      stock_name: item.name,
      sku: item.sku,
      allocation_status: {
        originally_assigned: item.originally_assigned,
        currently_allocated: item.current_allocated,
        total_consumed: item.total_consumed,
        assigned_date: item.assigned_at
      },
      deduction_details: {
        assigned_to_engineer: item.originally_assigned,
        engineer_used: item.total_consumed,
        engineer_remaining: item.current_allocated,
        central_stock_remaining: item.central_quantity
      },
      threshold: item.threshold,
      status: item.current_allocated <= item.threshold ? 'Low Stock' : 'In Stock'
    }));

    res.json({
      engineer: {
        id: engineer?.id,
        name: engineer?.name,
        mobile_number: engineer?.mobile_number
      },
      stock_status: statusSummary,
      summary: {
        total_items_allocated: statusSummary.length,
        total_consumed: statusSummary.reduce((sum, item) => sum + item.allocation_status.total_consumed, 0),
        total_remaining: statusSummary.reduce((sum, item) => sum + item.allocation_status.currently_allocated, 0)
      }
    });
  } catch (err) {
    console.error('Engineer status error:', err);
    res.status(500).json({ error: 'Failed to fetch engineer status' });
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
; (async function ensureColumns() {
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

// List all product items
router.get('/product-items', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT "Product Name", unit
      FROM product_items 
      ORDER BY "Product Name" ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching product items:', err);
    res.status(500).json({ error: 'Failed to fetch product items' });
  }
});

// Report wastage (engineer reports damaged/lost stock)
router.post('/wastage', async (req, res) => {
  const { engineerId, stockItemId, quantity = 1, reason } = req.body;
  if (!stockItemId || !quantity || !engineerId) return res.status(400).json({ error: 'engineerId, stockItemId and quantity required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Deduct from engineer stock similar to consumption
    const es = await client.query(
      'SELECT * FROM engineer_stock WHERE engineer_id::text = $1 AND stock_item_id::text = $2 FOR UPDATE',
      [String(engineerId), String(stockItemId)]
    );

    if (es.rowCount > 0 && es.rows[0].quantity >= quantity) {
      await client.query('UPDATE engineer_stock SET quantity = quantity - $1 WHERE id = $2', [quantity, es.rows[0].id]);
    } else {
      // If not enough engineer stock, we can either error or just deduct what is possible and record wastage.
      // For now, let's treat it ensuring data integrity: if they report wastage, they should have it.
      // But adhering to 'consume' logic: fail if not enough? 
      // The consume logic falls back to central stock. Wastage usually implies the item was in possession.
      // Let's just deduct what we can from engineer stock, and if 0, maybe it was already accounted for or central?
      // Actually, let's just proceed to record wastage, and update engineer stock if it exists.
      if (es.rowCount > 0 && es.rows[0].quantity > 0) {
        const toDeduct = Math.min(es.rows[0].quantity, quantity);
        await client.query('UPDATE engineer_stock SET quantity = GREATEST(quantity - $1, 0) WHERE id = $2', [toDeduct, es.rows[0].id]);
      }
    }

    // 2. Insert into wastage_stock
    const ins = await client.query(
      'INSERT INTO wastage_stock (engineer_id, stock_item_id, quantity, reason) VALUES ($1,$2,$3,$4) RETURNING *',
      [String(engineerId), String(stockItemId), Number(quantity), reason || null]
    );

    await client.query('COMMIT');
    res.json(ins.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Failed to report wastage:', err);
    res.status(500).json({ error: 'Failed to report wastage' });
  } finally {
    client.release();
  }
});

// Get all wastage (Admin/HR view)
router.get('/wastage', async (req, res) => {
  try {
    const q = await pool.query(`
      SELECT w.*, u.name as engineer_name, si.name as item_name, si.sku
      FROM wastage_stock w
      JOIN users u ON u.id::text = w.engineer_id::text
      JOIN stock_items si ON si.id = w.stock_item_id
      ORDER BY w.reported_at DESC
    `);
    res.json(q.rows);
  } catch (err) {
    console.error('Failed to fetch wastage:', err);
    res.status(500).json({ error: 'Failed to fetch wastage records' });
  }
});

// Get wastage for specific engineer
router.get('/wastage/engineer/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const q = await pool.query(`
      SELECT w.*, si.name as item_name, si.sku
      FROM wastage_stock w
      JOIN stock_items si ON si.id = w.stock_item_id
      WHERE w.engineer_id::text = $1
      ORDER BY w.reported_at DESC
    `, [String(id)]);
    res.json(q.rows);
  } catch (err) {
    console.error('Failed to fetch engineer wastage:', err);
    res.status(500).json({ error: 'Failed to fetch engineer wastage' });
  }
});

// Update stock item
router.put('/items/:id', async (req, res) => {
  const { id } = req.params;
  const { name, description, quantity, threshold, dairy_name, notes, use_item } = req.body;

  try {
    const q = await pool.query(
      `UPDATE stock_items SET 
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        quantity = COALESCE($3, quantity), 
        threshold = COALESCE($4, threshold),
        dairy_name = COALESCE($5, dairy_name),
        notes = COALESCE($6, notes),
        use_item = COALESCE($7, use_item)
       WHERE id = $8 RETURNING *`,
      [name, description, quantity, threshold, dairy_name, notes, use_item, id]
    );

    if (q.rowCount === 0) return res.status(404).json({ error: 'Item not found' });
    res.json(q.rows[0]);
  } catch (err) {
    console.error('Failed to update item:', err);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

// Delete stock item
router.delete('/items/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const q = await pool.query('DELETE FROM stock_items WHERE id = $1 RETURNING *', [id]);
    if (q.rowCount === 0) return res.status(404).json({ error: 'Item not found' });
    res.json({ message: 'Item deleted', item: q.rows[0] });
  } catch (err) {
    console.error('Failed to delete item:', err);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

// Add new product item (name) to standard list
router.post('/product-items', async (req, res) => {
  const { name, unit } = req.body; // Expecting { "name": "Product Name", "unit": "NOS|METER|KG|LITER|PAIR" }
  if (!name) return res.status(400).json({ error: 'Product Name is required' });
  try {
    const unitValue = unit || 'NOS';
    const q = await pool.query('INSERT INTO product_items ("Product Name", unit) VALUES ($1, $2) RETURNING *', [name, unitValue]);
    res.json(q.rows[0]);
  } catch (err) {
    console.error('Failed to add product item:', err);
    res.status(500).json({ error: 'Failed to add product item' });
  }
});

// Delete product item from standard list
router.delete('/product-items/:name', async (req, res) => {
  const { name } = req.params;
  try {
    const q = await pool.query('DELETE FROM product_items WHERE "Product Name" = $1 RETURNING *', [name]);
    if (q.rowCount === 0) return res.status(404).json({ error: 'Product name not found' });
    res.json({ message: 'Product name deleted', item: q.rows[0] });
  } catch (err) {
    console.error('Failed to delete product item:', err);
    res.status(500).json({ error: 'Failed to delete product item' });
  }
});

// Bulk assign items to engineer
router.post('/bulk-assign', async (req, res) => {
  try {
    const { itemIds, engineerId, quantity } = req.body;

    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      return res.status(400).json({ error: 'Invalid itemIds array' });
    }
    if (!engineerId) {
      return res.status(400).json({ error: 'Missing engineerId' });
    }
    if (typeof quantity !== 'number' || quantity < 1) {
      return res.status(400).json({ error: 'Quantity must be a positive number' });
    }

    let assignedCount = 0;
    let failedCount = 0;

    for (const itemId of itemIds) {
      try {
        // Check if stock item exists
        const itemCheck = await pool.query('SELECT id, quantity FROM stock_items WHERE id = $1', [itemId]);
        if (itemCheck.rows.length === 0) {
          failedCount++;
          continue;
        }

        const itemQty = itemCheck.rows[0].quantity;
        const assignQty = Math.min(quantity, itemQty);

        if (assignQty > 0) {
          // Insert or update engineer_stock
          await pool.query(
            `INSERT INTO engineer_stock (engineer_id, stock_item_id, quantity)
             VALUES ($1, $2, $3)
             ON CONFLICT (engineer_id, stock_item_id) DO UPDATE SET quantity = quantity + $3`,
            [engineerId, itemId, assignQty]
          );

          // Deduct from central stock
          await pool.query(
            'UPDATE stock_items SET quantity = GREATEST(quantity - $1, 0) WHERE id = $2',
            [assignQty, itemId]
          );

          assignedCount++;
        } else {
          failedCount++;
        }
      } catch (itemErr) {
        console.error('Error assigning item:', itemErr);
        failedCount++;
      }
    }

    res.json({
      success: true,
      message: `Assigned ${assignedCount} items, ${failedCount} failed`,
      assigned: assignedCount,
      failed: failedCount
    });
  } catch (err) {
    console.error('Bulk assign error:', err);
    res.status(500).json({ error: 'Failed to bulk assign items', details: err.message });
  }
});

// Bulk delete items
router.post('/bulk-delete', async (req, res) => {
  try {
    const { itemIds } = req.body;

    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      return res.status(400).json({ error: 'Invalid itemIds array' });
    }

    let deletedCount = 0;
    let failedCount = 0;

    for (const itemId of itemIds) {
      try {
        // Delete associated engineer_stock records first
        await pool.query('DELETE FROM engineer_stock WHERE stock_item_id = $1', [itemId]);

        // Delete the stock item
        const deleteResult = await pool.query('DELETE FROM stock_items WHERE id = $1', [itemId]);

        if (deleteResult.rowCount > 0) {
          deletedCount++;
        } else {
          failedCount++;
        }
      } catch (itemErr) {
        console.error('Error deleting item:', itemErr);
        failedCount++;
      }
    }

    res.json({
      success: true,
      message: `Deleted ${deletedCount} items, ${failedCount} failed`,
      deleted: deletedCount,
      failed: failedCount
    });
  } catch (err) {
    console.error('Bulk delete error:', err);
    res.status(500).json({ error: 'Failed to bulk delete items', details: err.message });
  }
});

export default router;
