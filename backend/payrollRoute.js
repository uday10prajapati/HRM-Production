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
        per_day_salary NUMERIC DEFAULT 0,
        total_working_days INTEGER DEFAULT 0,
        worked_days INTEGER DEFAULT 0,
        leave_days INTEGER DEFAULT 0,
      hra NUMERIC DEFAULT 0,
      allowances JSONB DEFAULT '{}'::jsonb,
      gross NUMERIC DEFAULT 0,
        overtime_pay NUMERIC DEFAULT 0,
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

/**
 * Compute payroll for a given user config and month/year.
 * This function will consult attendance/leaves/overtime tables to prorate salary.
 * Returns an object with detailed breakdown.
 *
 * Parameters:
 * - cfg: salary config row (must include basic/hra/allowances/deductions/user_id)
 * - ctx: { year, month }
 */
async function computePayrollFromConfig(cfg, ctx = {}) {
  const basic = Number(cfg.basic || 0);
  const hra = Number(cfg.hra || 0);
  const allowances = cfg.allowances || {};
  const allowancesSum = Object.values(allowances).reduce((s, v) => s + Number(v || 0), 0);

  const year = Number(ctx.year || new Date().getFullYear());
  const month = Number(ctx.month || (new Date().getMonth() + 1));

  // compute month date range
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const end = new Date(year, month, 0).toISOString().slice(0,10);

  // compute total working days in month excluding Sundays
  // count days between start and end where dayOfWeek != 0 (Sunday)
  const startDate = new Date(start);
  const endDate = new Date(end);
  let totalWorkingDays = 0;
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dow = d.getDay(); // 0 = Sunday
    if (dow !== 0) totalWorkingDays++;
  }

  // fetch workedDays (distinct days with punch_in) and leaveDays and overtime seconds from DB
  const userId = Number(cfg.user_id || cfg.userId || cfg.user_id === 0 ? cfg.user_id : cfg.userId);
  let workedDays = 0;
  let leaveDays = 0;
  let totalOvertimeSeconds = 0;
  try {
    const wdQ = `SELECT COUNT(DISTINCT (created_at::date)) AS worked_days FROM attendances WHERE user_id=$1 AND type='in' AND created_at::date BETWEEN $2 AND $3`;
    const wdR = await pool.query(wdQ, [userId, start, end]);
    workedDays = Number(wdR.rows[0]?.worked_days ?? 0);

    const lvQ = `SELECT COALESCE(SUM(GREATEST(0, (LEAST(end_date::date, $3::date) - GREATEST(start_date::date, $2::date)) + 1)),0) AS leave_days FROM leaves WHERE user_id=$1 AND NOT (end_date::date < $2::date OR start_date::date > $3::date)`;
    const lvR = await pool.query(lvQ, [userId, start, end]);
    leaveDays = Number(lvR.rows[0]?.leave_days ?? 0);

    const otQ = `SELECT COALESCE(SUM(overtime_seconds),0) AS overtime_seconds FROM overtime_records WHERE user_id=$1 AND date BETWEEN $2 AND $3`;
    const otR = await pool.query(otQ, [userId, start, end]);
    totalOvertimeSeconds = Number(otR.rows[0]?.overtime_seconds ?? 0);
  } catch (e) {
    console.warn('computePayrollFromConfig: failed to fetch attendance/leave/overtime', e?.message ?? e);
  }

  // basic monthly gross before prorate
  const monthlyGross = basic + hra + allowancesSum;

  // per-day salary based on totalWorkingDays (exclude Sundays)
  const perDaySalary = totalWorkingDays > 0 ? Number((monthlyGross / totalWorkingDays).toFixed(2)) : 0;

  // deduction for leave days = perDaySalary * leaveDays
  const leaveDeduction = Number((perDaySalary * leaveDays).toFixed(2));

  // overtime pay: default rate = hourlyRate * 1.5 (OT multiplier configurable if needed)
  // hourlyRate approximated from 1 working day = 8 hours -> totalWorkingDays * 8 * hourlyRate = monthlyGross
  const hoursPerWorkingDay = Number(process.env.HOURS_PER_WORKING_DAY || 8);
  const overtimeMultiplier = Number(process.env.OVERTIME_MULTIPLIER || 1.5);
  const hourlyRate = totalWorkingDays * hoursPerWorkingDay > 0 ? (monthlyGross / (totalWorkingDays * hoursPerWorkingDay)) : 0;
  const overtimeHours = totalOvertimeSeconds / 3600;
  const overtimePay = Number((hourlyRate * overtimeHours * overtimeMultiplier).toFixed(2));

  // prorated gross = monthlyGross - leaveDeduction + overtimePay (we pay overtime on top)
  const proratedGross = Number((monthlyGross - leaveDeduction + overtimePay).toFixed(2));

  const pf = Number((basic * PF_RATE).toFixed(2));
  const esi_employee = Number((proratedGross * ESI_EMP_RATE).toFixed(2));
  const esi_employer = Number((proratedGross * ESI_EMPLOYER_RATE).toFixed(2));
  const professional_tax = Number(PROFESSIONAL_TAX);

  // Simplified TDS: monthly TDS as flat percentage of prorated gross. For production, replace with slab logic.
  const tds = Number((proratedGross * TDS_RATE).toFixed(2));

  const otherDeductions = cfg.deductions || {};
  const otherSum = Object.values(otherDeductions).reduce((s, v) => s + Number(v || 0), 0);

  const totalDeductions = pf + esi_employee + professional_tax + tds + otherSum;
  const net = Number((proratedGross - totalDeductions).toFixed(2));

  return {
    basic,
    per_day_salary: perDaySalary,
    total_working_days: totalWorkingDays,
    worked_days: workedDays,
    leave_days: leaveDays,
    overtime_hours: Number(overtimeHours.toFixed(2)),
    overtime_pay: overtimePay,
    hra,
    allowances,
    allowancesSum,
    gross: proratedGross,
    pf,
    esi_employee,
    esi_employer,
    professional_tax,
    tds,
    other_deductions: otherDeductions,
    net_pay: net
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
  // requester must be admin
  try {
    const requesterId = Number(req.header('x-user-id') || req.query.requesterId || 0);
    const r = await pool.query('SELECT role FROM users WHERE id=$1 LIMIT 1', [requesterId]);
    const requesterRole = (r.rows[0]?.role || '').toString().toLowerCase();
    if (requesterRole !== 'admin') {
      return res.status(403).json({ error: 'Only admin may run payroll' });
    }
  } catch (e) {
    console.warn('/payroll/run: could not verify requester role', e?.message ?? e);
    return res.status(403).json({ error: 'Unauthorized' });
  }
  try {
    // fetch all users and any existing salary configs
    const usersRes = await pool.query('SELECT id, name, email, role FROM users');
    const configsRes = await pool.query('SELECT * FROM employee_salary_config');
    const cfgMap = {};
    for (const c of configsRes.rows) cfgMap[Number(c.user_id)] = c;

    const inserted = [];
    for (const u of usersRes.rows) {
      // determine salary config: use existing config or fallback to role defaults
      const existing = cfgMap[Number(u.id)];
      let cfg = null;
      if (existing) {
        cfg = existing;
      } else {
        // role-based defaults (assumptions): provided numbers are monthly gross
        const role = (u.role || '').toString().toLowerCase();
        let monthlyGross = Number(process.env.DEFAULT_SALARY_OTHER || 25000);
        if (role === 'engineer') monthlyGross = 40000;
        else if (role === 'hr' || role === 'human resources') monthlyGross = 50000;
        else if (role === 'admin' || role === 'administrator') monthlyGross = 60000;

        // split gross into basic/hra/allowances (reasonable default split)
        const basic = Number((monthlyGross * 0.5).toFixed(2));
        const hra = Number((monthlyGross * 0.2).toFixed(2));
        const allowances = { other: Number((monthlyGross * 0.3).toFixed(2)) };
        cfg = { user_id: u.id, basic, hra, allowances, deductions: {} };
      }

      let payroll = null;
      try {
        payroll = await computePayrollFromConfig(cfg, { year: y, month: m });
      } catch (e) {
        console.error('computePayrollFromConfig failed for user', u.id, e?.message ?? e);
        continue;
      }

      try {
        const up = await pool.query(
          `INSERT INTO payroll_records (user_id, year, month, basic, per_day_salary, total_working_days, worked_days, leave_days, hra, allowances, gross, overtime_pay, pf, esi_employee, esi_employer, professional_tax, tds, other_deductions, net_pay)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13,$14,$15,$16,$17,$18::jsonb,$19)
           ON CONFLICT (user_id, year, month) DO UPDATE SET basic=EXCLUDED.basic, per_day_salary=EXCLUDED.per_day_salary, total_working_days=EXCLUDED.total_working_days, worked_days=EXCLUDED.worked_days, leave_days=EXCLUDED.leave_days, hra=EXCLUDED.hra, allowances=EXCLUDED.allowances, gross=EXCLUDED.gross, overtime_pay=EXCLUDED.overtime_pay, pf=EXCLUDED.pf, esi_employee=EXCLUDED.esi_employee, esi_employer=EXCLUDED.esi_employer, professional_tax=EXCLUDED.professional_tax, tds=EXCLUDED.tds, other_deductions=EXCLUDED.other_deductions, net_pay=EXCLUDED.net_pay, created_at=now()
           RETURNING *`,
          [u.id, y, m, payroll.basic, payroll.per_day_salary, payroll.total_working_days, payroll.worked_days, payroll.leave_days, payroll.hra, JSON.stringify(payroll.allowances || {}), payroll.gross, payroll.overtime_pay, payroll.pf, payroll.esi_employee, payroll.esi_employer, payroll.professional_tax, payroll.tds, JSON.stringify(payroll.other_deductions || {}), payroll.net_pay]
        );
        inserted.push(up.rows[0]);
      } catch (err) {
        console.error('Failed to insert payroll for user', u.id, err);
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
  const requesterId = Number(req.header('x-user-id') || req.query.requesterId || 0);
  try {
    // Authorization: admin can fetch any slip; HR can fetch slips for non-admins; user can fetch own slip
    const rr = await pool.query('SELECT role FROM users WHERE id=$1 LIMIT 1', [requesterId]);
    const requesterRole = (rr.rows[0]?.role || '').toString().toLowerCase();
    const targetRow = await pool.query('SELECT role FROM users WHERE id=$1 LIMIT 1', [Number(userId)]);
    const targetRole = (targetRow.rows[0]?.role || '').toString().toLowerCase();
    const isSelf = requesterId === Number(userId);
    if (requesterRole !== 'admin' && !(requesterRole === 'hr' && targetRole !== 'admin') && !isSelf) {
      return res.status(403).json({ error: 'Unauthorized to view this slip' });
    }

    const q = await pool.query('SELECT * FROM payroll_records WHERE user_id=$1 AND year=$2 AND month=$3 LIMIT 1', [Number(userId), Number(year), Number(month)]);
    if (q.rows.length === 0) return res.status(404).json({ error: 'Payroll not found' });
    res.json(q.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to fetch slip' }); }
});

// List payroll records for a user (summary) - used by frontend to show available slips
router.get('/records/:userId', async (req, res) => {
  const userId = Number(req.params.userId);
  if (!userId) return res.status(400).json({ error: 'userId required' });
  const requesterId = Number(req.header('x-user-id') || req.query.requesterId || 0);
  try {
    const rr = await pool.query('SELECT role FROM users WHERE id=$1 LIMIT 1', [requesterId]);
    const requesterRole = (rr.rows[0]?.role || '').toString().toLowerCase();
    const target = await pool.query('SELECT role FROM users WHERE id=$1 LIMIT 1', [userId]);
    const targetRole = (target.rows[0]?.role || '').toString().toLowerCase();
    if (requesterRole !== 'admin' && !(requesterRole === 'hr' && targetRole !== 'admin') && requesterId !== userId) {
      return res.status(403).json({ error: 'Unauthorized to list records for this user' });
    }
  } catch (e) {
    console.warn('/payroll/records: auth check failed', e?.message ?? e);
    return res.status(403).json({ error: 'Unauthorized' });
  }
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
      acc.per_day_salary += Number(r.per_day_salary || 0);
      acc.pf += Number(r.pf || 0);
      acc.esi_employee += Number(r.esi_employee || 0);
      acc.tds += Number(r.tds || 0);
      acc.net += Number(r.net_pay || 0);
      return acc;
    }, { gross: 0, per_day_salary: 0, pf: 0, esi_employee: 0, tds: 0, net: 0 });
    res.json({ userId: Number(userId), year: Number(year), summary });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to generate form16' }); }
});

// Statutory aggregated report (PF/ESI) for year
router.get('/statutory/:year', async (req, res) => {
  const year = Number(req.params.year || new Date().getFullYear());
  try {
  const q = await pool.query('SELECT SUM(pf) as total_pf, SUM(esi_employee) as total_esi_employee, SUM(esi_employer) as total_esi_employer, SUM(overtime_pay) as total_overtime_pay, SUM(gross) as total_gross FROM payroll_records WHERE year=$1', [year]);
  res.json(q.rows[0] || { total_pf: 0, total_esi_employee: 0, total_esi_employer: 0, total_overtime_pay: 0, total_gross: 0 });
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
  const requesterId = Number(req.header('x-user-id') || req.query.requesterId || 0);
  try {
    const rr = await pool.query('SELECT role FROM users WHERE id=$1 LIMIT 1', [requesterId]);
    const requesterRole = (rr.rows[0]?.role || '').toString().toLowerCase();

    if (requesterRole === 'admin') {
      const q = await pool.query('SELECT pr.*, u.name, u.email, u.role FROM payroll_records pr LEFT JOIN users u ON u.id = pr.user_id WHERE pr.year=$1 AND pr.month=$2 ORDER BY u.role, u.id', [year, month]);
      return res.json({ year, month, records: q.rows });
    }

    if (requesterRole === 'hr') {
      // HR should not see admin payroll rows
      const q = await pool.query("SELECT pr.*, u.name, u.email, u.role FROM payroll_records pr LEFT JOIN users u ON u.id = pr.user_id WHERE pr.year=$1 AND pr.month=$2 AND (u.role IS NULL OR LOWER(u.role) <> 'admin') ORDER BY u.role, u.id", [year, month]);
      return res.json({ year, month, records: q.rows });
    }

    // other roles: only allow viewing own payroll record
    const q = await pool.query('SELECT pr.*, u.name, u.email, u.role FROM payroll_records pr LEFT JOIN users u ON u.id = pr.user_id WHERE pr.year=$1 AND pr.month=$2 AND pr.user_id=$3 ORDER BY u.role, u.id', [year, month, requesterId]);
    res.json({ year, month, records: q.rows });
  } catch (err) {
    console.error('Failed to fetch payroll overview', err);
    res.status(500).json({ error: 'Failed to fetch overview' });
  }
});

export default router;
