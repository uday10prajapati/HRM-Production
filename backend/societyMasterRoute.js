
import express from 'express';
import { pool } from './db.js';

const router = express.Router();

// GET all societies
router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM public.service_call_dairy_list ORDER BY "SOCCD" ASC');
        res.json({ success: true, count: result.rows.length, data: result.rows });
    } catch (err) {
        console.error('Error fetching society data:', err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// ADD a new society
router.post('/', async (req, res) => {
    const { SOCCD, SOCIETY, TALUKA_NAME } = req.body;
    // Note: Frontend should send "TALUKA_NAME" or "TALUKA NAME". Let's handle both.
    const taluka = TALUKA_NAME || req.body['TALUKA NAME'];

    if (!SOCCD || !SOCIETY) {
        return res.status(400).json({ success: false, message: 'SOCCD and SOCIETY are required' });
    }

    try {
        const query = `
      INSERT INTO public.service_call_dairy_list ("SOCCD", "SOCIETY", "TALUKA NAME")
      VALUES ($1, $2, $3)
      RETURNING *
    `;
        const values = [SOCCD, SOCIETY, taluka];
        const result = await pool.query(query, values);
        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error('Error adding society:', err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// DELETE a society
router.delete('/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const query = 'DELETE FROM public.service_call_dairy_list WHERE id = $1 RETURNING *';
        const result = await pool.query(query, [id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Society not found' });
        }

        res.json({ success: true, message: 'Society deleted successfully', data: result.rows[0] });
    } catch (err) {
        console.error('Error deleting society:', err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

export default router;
