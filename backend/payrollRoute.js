import express from 'express';
import { pool } from './db.js';

const router = express.Router();

const PF_RATE = Number(process.env.PF_RATE || 0.12); // employee contribution (default 12% of basic)
const ESI_EMP_RATE = Number(process.env.ESI_EMP_RATE || 0.0075); // employee ESI default 0.75%
const ESI_EMPLOYER_RATE = Number(process.env.ESI_EMPLOYER_RATE || 0.0325); // employer portion default 3.25%
const TDS_RATE = Number(process.env.TDS_RATE || 0.05); // simplified flat monthly TDS rate (configurable)
const PROFESSIONAL_TAX = Number(process.env.PROFESSIONAL_TAX || 200); // monthly default

async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS employee_salary_config (
      id SERIAL PRIMARY KEY,
      user_id INTEGER UNIQUE NOT NULL,
      basic NUMERIC NOT NULL DEFAULT 0,
      hra NUMERIC DEFAULT 0,
      allowances JSONB DEFAULT '{}'::jsonb,
      deductions JSONB DEFAULT '{}'::jsonb,
      updated_at TIMESTAMP DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS payroll_records (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      basic NUMERIC NOT NULL DEFAULT 0,
      hra NUMERIC DEFAULT 0,
      allowances JSONB DEFAULT '{}'::jsonb,
      gross NUMERIC DEFAULT 0,
      pf NUMERIC DEFAULT 0,
      esi_employee NUMERIC DEFAULT 0,
      esi_employer NUMERIC DEFAULT 0,
      professional_tax NUMERIC DEFAULT 0,
      tds NUMERIC DEFAULT 0,
      other_deductions JSONB DEFAULT '{}'::jsonb,
      net_pay NUMERIC DEFAULT 0,
      created_at TIMESTAMP DEFAULT now(),
      UNIQUE(user_id, year, month)
    );
  `);
}

ensureTables().catch(err => console.error('Failed to ensure payroll tables:', err));

function computePayrollFromConfig(cfg) {
  // cfg: { basic, hra, allowances (object), deductions (object) }
  const basic = Number(cfg.basic || 0);
  const hra = Number(cfg.hra || 0);
  const allowances = cfg.allowances || {};
  const allowancesSum = Object.values(allowances).reduce((s, v) => s + Number(v || 0), 0);
  const gross = basic + hra + allowancesSum;

  const pf = Number((basic * PF_RATE).toFixed(2));
  const esi_employee = Number((gross * ESI_EMP_RATE).toFixed(2));
  const esi_employer = Number((gross * ESI_EMPLOYER_RATE).toFixed(2));
  const professional_tax = Number(PROFESSIONAL_TAX);

  // Simplified TDS: monthly TDS as flat percentage of gross. For production, replace with slab logic.
  const tds = Number((gross * TDS_RATE).toFixed(2));

  const otherDeductions = cfg.deductions || {};
  const otherSum = Object.values(otherDeductions).reduce((s, v) => s + Number(v || 0), 0);

  const totalDeductions = pf + esi_employee + professional_tax + tds + otherSum;
  const net = Number((gross - totalDeductions).toFixed(2));

  return {
    basic, hra, allowances, allowancesSum, gross,
    pf, esi_employee, esi_employer, professional_tax, tds,
    other_deductions: otherDeductions, net_pay: net
  };
}

// Admin: set salary config for a user
router.post('/config', async (req, res) => {
  const { userId, basic = 0, hra = 0, allowances = {}, deductions = {} } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId required' });
  try {
    const up = await pool.query(
      `INSERT INTO employee_salary_config (user_id, basic, hra, allowances, deductions) VALUES ($1,$2,$3,$4::jsonb,$5::jsonb)
       ON CONFLICT (user_id) DO UPDATE SET basic=EXCLUDED.basic, hra=EXCLUDED.hra, allowances=EXCLUDED.allowances, deductions=EXCLUDED.deductions, updated_at=now()
       RETURNING *`,
      [Number(userId), Number(basic), Number(hra), JSON.stringify(allowances), JSON.stringify(deductions)]
    );
    res.json({ success: true, config: up.rows[0] });
  } catch (err) {
    console.error('Failed to set salary config', err);
    res.status(500).json({ error: 'Failed to set config' });
  }
});

router.get('/config/:userId', async (req, res) => {
  try {
    const q = await pool.query('SELECT * FROM employee_salary_config WHERE user_id=$1 LIMIT 1', [Number(req.params.userId)]);
    res.json(q.rows[0] || null);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to fetch config' }); }
});

// Run payroll for a given year/month (admin). If user has no config, skipped.
router.post('/run', async (req, res) => {
  const { year, month } = req.body;
  const y = Number(year || new Date().getFullYear());
  const m = Number(month || (new Date().getMonth() + 1));
  try {
    const configs = await pool.query('SELECT * FROM employee_salary_config');
    const inserted = [];
    for (const cfg of configs.rows) {
      const payroll = computePayrollFromConfig(cfg);
      try {
        const up = await pool.query(
          `INSERT INTO payroll_records (user_id, year, month, basic, hra, allowances, gross, pf, esi_employee, esi_employer, professional_tax, tds, other_deductions, net_pay)
           VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12,$13::jsonb,$14)
           ON CONFLICT (user_id, year, month) DO UPDATE SET basic=EXCLUDED.basic, hra=EXCLUDED.hra, allowances=EXCLUDED.allowances, gross=EXCLUDED.gross, pf=EXCLUDED.pf, esi_employee=EXCLUDED.esi_employee, esi_employer=EXCLUDED.esi_employer, professional_tax=EXCLUDED.professional_tax, tds=EXCLUDED.tds, other_deductions=EXCLUDED.other_deductions, net_pay=EXCLUDED.net_pay, created_at=now()
           RETURNING *`,
          [cfg.user_id, y, m, payroll.basic, payroll.hra, JSON.stringify(payroll.allowances || {}), payroll.gross, payroll.pf, payroll.esi_employee, payroll.esi_employer, payroll.professional_tax, payroll.tds, JSON.stringify(payroll.other_deductions || {}), payroll.net_pay]
        );
        inserted.push(up.rows[0]);
      } catch (err) {
        console.error('Failed to insert payroll for user', cfg.user_id, err);
      }
    }
    res.json({ success: true, year: y, month: m, count: inserted.length, records: inserted });
  } catch (err) {
    console.error('Payroll run failed', err);
    res.status(500).json({ error: 'Payroll run failed' });
  }
});

// Get payroll slip data for user/month
router.get('/slip/:userId/:year/:month', async (req, res) => {
  const { userId, year, month } = req.params;
  try {
    const q = await pool.query('SELECT * FROM payroll_records WHERE user_id=$1 AND year=$2 AND month=$3 LIMIT 1', [Number(userId), Number(year), Number(month)]);
    if (q.rows.length === 0) return res.status(404).json({ error: 'Payroll not found' });
    res.json(q.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to fetch slip' }); }
});

// List payroll records for a user (summary) - used by frontend to show available slips
router.get('/records/:userId', async (req, res) => {
  const userId = Number(req.params.userId);
  if (!userId) return res.status(400).json({ error: 'userId required' });
  try {
    const q = await pool.query('SELECT id, year, month, gross, net_pay, created_at FROM payroll_records WHERE user_id=$1 ORDER BY year DESC, month DESC', [userId]);
    res.json({ records: q.rows });
  } catch (err) {
    console.error('Failed to list payroll records for user', userId, err);
    res.status(500).json({ error: 'Failed to list records' });
  }
});

// Form 16 summary for a year
router.get('/form16/:userId/:year', async (req, res) => {
  const { userId, year } = req.params;
  try {
    const q = await pool.query('SELECT * FROM payroll_records WHERE user_id=$1 AND year=$2', [Number(userId), Number(year)]);
    const rows = q.rows || [];
    const summary = rows.reduce((acc, r) => {
      acc.gross += Number(r.gross || 0);
      acc.pf += Number(r.pf || 0);
      acc.esi_employee += Number(r.esi_employee || 0);
      acc.tds += Number(r.tds || 0);
      acc.net += Number(r.net_pay || 0);
      return acc;
    }, { gross: 0, pf: 0, esi_employee: 0, tds: 0, net: 0 });
    res.json({ userId: Number(userId), year: Number(year), summary });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to generate form16' }); }
});

// Statutory aggregated report (PF/ESI) for year
router.get('/statutory/:year', async (req, res) => {
  const year = Number(req.params.year || new Date().getFullYear());
  try {
    const q = await pool.query('SELECT SUM(pf) as total_pf, SUM(esi_employee) as total_esi_employee, SUM(esi_employer) as total_esi_employer FROM payroll_records WHERE year=$1', [year]);
    res.json(q.rows[0] || { total_pf: 0, total_esi_employee: 0, total_esi_employer: 0 });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to fetch statutory report' }); }
});

// List all salary configs (admin helper)
router.get('/configs', async (req, res) => {
  try {
    const q = await pool.query('SELECT * FROM employee_salary_config ORDER BY user_id');
    res.json({ configs: q.rows });
  } catch (err) {
    console.error('Failed to list salary configs', err);
    res.status(500).json({ error: 'Failed to list configs' });
  }
});

// Monthly overview: list payroll records for a given year/month
router.get('/overview/:year/:month', async (req, res) => {
  const year = Number(req.params.year || new Date().getFullYear());
  const month = Number(req.params.month || (new Date().getMonth() + 1));
  try {
    const q = await pool.query('SELECT pr.*, u.name, u.email, u.role FROM payroll_records pr LEFT JOIN users u ON u.id = pr.user_id WHERE pr.year=$1 AND pr.month=$2 ORDER BY u.role, u.id', [year, month]);
    res.json({ year, month, records: q.rows });
  } catch (err) {
    console.error('Failed to fetch payroll overview', err);
    res.status(500).json({ error: 'Failed to fetch overview' });
  }
});

export default router;
