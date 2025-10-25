import express from 'express';
import { pool } from './db.js';
import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// Financial constants
const PF_RATE = Number(process.env.PF_RATE || 0.12);
const ESI_EMP_RATE = Number(process.env.ESI_EMP_RATE || 0.0075);
const ESI_EMPLOYER_RATE = Number(process.env.ESI_EMPLOYER_RATE || 0.0325);
const TDS_RATE = Number(process.env.TDS_RATE || 0.05);
const PROFESSIONAL_TAX = Number(process.env.PROFESSIONAL_TAX || 200);
const HOURLY_RATE = Number(process.env.HOURLY_RATE || 72.12);
const DEFAULT_HOURS_PER_DAY = Number(process.env.HOURS_PER_WORKING_DAY || 8);
const OVERTIME_MULTIPLIER = Number(process.env.OVERTIME_MULTIPLIER || 1.5);

// Helper: resolve identifier (id or email) to DB id
async function resolveDbUserId(identifier) {
    if (!identifier) {
        console.error('Missing identifier');
        return null;
    }

    const idStr = String(identifier).trim();
    console.log('Looking up user with identifier:', idStr);

    try {
        // Try UUID first
        const uuidQuery = await pool.query(`
            SELECT id, email 
            FROM users 
            WHERE id::text = $1
            LIMIT 1
        `, [idStr]);

        if (uuidQuery.rows[0]) {
            console.log('Found user by UUID');
            return uuidQuery.rows[0].id;
        }

        // If not UUID, try email
        const emailQuery = await pool.query(`
            SELECT id, email 
            FROM users 
            WHERE LOWER(email) = LOWER($1)
            LIMIT 1
        `, [idStr]);

        if (emailQuery.rows[0]) {
            console.log('Found user by email');
            return emailQuery.rows[0].id;
        }

        console.error('No user found with identifier:', idStr);
        return null;
    } catch (err) {
        console.error('Database error looking up user:', err);
        return null;
    }
}

function handlePgError(err, res, ctx = '') {
  if (err && err.code === '22P02') {
    console.error(ctx, 'Postgres invalid input (22P02):', err.message);
    return res.status(400).json({ error: 'Invalid input syntax for numeric field' });
  }
  console.error(ctx, err);
  return res.status(500).json({ error: 'Internal server error' });
}

// Core compute function (no DB writes)
async function computePayrollFromConfig(cfg, ctx = {}) {
  const basic = Number(cfg.basic || 0);
  const hra = Number(cfg.hra || 0);
  const allowances = cfg.allowances || {};
  const allowancesSum = Object.values(allowances).reduce((s, v) => s + Number(v || 0), 0);

  const year = Number(ctx.year || new Date().getFullYear());
  const month = Number(ctx.month || (new Date().getMonth() + 1));
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const end = new Date(year, month, 0).toISOString().slice(0, 10);

  let totalWorkingDays = 0;
  for (let d = new Date(start); d <= new Date(end); d.setDate(d.getDate() + 1)) {
    if (d.getDay() !== 0) totalWorkingDays++;
  }

  const userId = cfg.user_id || cfg.userId || null;
  let workedDays = 0, leaveDays = 0, totalOvertimeSeconds = 0, totalAttendanceSeconds = 0;
  const wdQ = `SELECT COUNT(DISTINCT (created_at::date)) AS worked_days FROM attendance WHERE user_id::text=$1 AND type='in' AND created_at::date BETWEEN $2 AND $3`;
  const lvQ = `SELECT COALESCE(SUM(GREATEST(0, (LEAST(end_date::date, $3::date) - GREATEST(start_date::date, $2::date)) + 1)),0) AS leave_days FROM leaves WHERE user_id::text=$1 AND NOT (end_date::date < $2::date OR start_date::date > $3::date)`;
  const otQ = `SELECT COALESCE(SUM(overtime_seconds),0) AS overtime_seconds, COALESCE(SUM(hours),0) AS overtime_hours FROM overtime_records WHERE user_id::text=$1 AND date BETWEEN $2 AND $3`;
  const attQ = `
    SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (p.punch_out - p.punch_in))),0) AS worked_seconds
    FROM (
      SELECT MIN(created_at) FILTER (WHERE type='in') AS punch_in, MAX(created_at) FILTER (WHERE type='out') AS punch_out
      FROM attendance
      WHERE user_id::text=$1 AND created_at::date BETWEEN $2 AND $3
      GROUP BY created_at::date
    ) p
    WHERE p.punch_in IS NOT NULL AND p.punch_out IS NOT NULL
  `;
  try {
    const [wdR, lvR, otR, attR] = await Promise.all([
      pool.query(wdQ, [userId, start, end]),
      pool.query(lvQ, [userId, start, end]),
      pool.query(otQ, [userId, start, end]).catch(() => ({ rows: [{ overtime_hours: 0 }] })),
      pool.query(attQ, [userId, start, end]).catch(() => ({ rows: [{ worked_seconds: 0 }] })),
    ]);
    workedDays = Number(wdR.rows[0]?.worked_days ?? 0);
    leaveDays = Number(lvR.rows[0]?.leave_days ?? 0);
    const otRow = otR.rows[0] || {};
    if (otRow.overtime_seconds !== undefined && otRow.overtime_seconds !== null && Number(otRow.overtime_seconds) > 0) {
      totalOvertimeSeconds = Number(otRow.overtime_seconds || 0);
    } else {
      totalOvertimeSeconds = Number((otRow.overtime_hours || 0)) * 3600;
    }
    totalAttendanceSeconds = Number(attR.rows[0]?.worked_seconds ?? 0);
  } catch (err) {
    throw err;
  }

  const attendanceHours = Number((totalAttendanceSeconds / 3600) || 0);
  const useHourly = (cfg.salary_mode && String(cfg.salary_mode).toLowerCase() === 'hourly') || cfg.hourly === true;
  let monthlyGross = basic + hra + allowancesSum;
  if (useHourly) monthlyGross = Number((attendanceHours * (Number(cfg.hourly_rate || HOURLY_RATE))).toFixed(2));

  const perDaySalary = totalWorkingDays > 0 ? Number((monthlyGross / totalWorkingDays).toFixed(2)) : 0;
  const leaveDeduction = Number((perDaySalary * leaveDays).toFixed(2));

  const hourlyRate = useHourly ? Number(cfg.hourly_rate || HOURLY_RATE) : (totalWorkingDays * DEFAULT_HOURS_PER_DAY > 0 ? (monthlyGross / (totalWorkingDays * DEFAULT_HOURS_PER_DAY)) : 0);
  const overtimeHours = totalOvertimeSeconds / 3600;
  const overtimePay = Number((hourlyRate * overtimeHours * OVERTIME_MULTIPLIER).toFixed(2));

  const proratedGross = Number((monthlyGross - leaveDeduction + overtimePay).toFixed(2));
  const pf = Number((basic * PF_RATE).toFixed(2));
  const esi_employee = Number((proratedGross * ESI_EMP_RATE).toFixed(2));
  const esi_employer = Number((proratedGross * ESI_EMPLOYER_RATE).toFixed(2));
  const professional_tax = Number(PROFESSIONAL_TAX);
  const tds = Number((proratedGross * TDS_RATE).toFixed(2));
  const otherDeductions = cfg.deductions || {};
  const otherSum = Object.values(otherDeductions).reduce((s, v) => s + Number(v || 0), 0);
  const net = Number((proratedGross - (pf + esi_employee + professional_tax + tds + otherSum)).toFixed(2));

  return {
    basic,
    per_day_salary: perDaySalary,
    total_working_days: totalWorkingDays,
    worked_days: workedDays,
    leave_days: leaveDays,
    overtime_hours: Number(overtimeHours.toFixed(2)),
    attendance_hours: Number(attendanceHours.toFixed(2)),
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

// GET /compute/:userId/:year/:month - compute on the fly (no DB writes)
router.get('/compute/:userId/:year/:month', async (req, res) => {
  const { userId, year, month } = req.params;
  const requester = req.header('x-user-id') || req.query.requesterId || null;
  try {
    const rr = await pool.query('SELECT role FROM users WHERE id::text=$1 OR email=$1 LIMIT 1', [String(requester || '')]);
    const requesterRole = (rr.rows[0]?.role || '').toString().toLowerCase();
    const tr = await pool.query('SELECT role FROM users WHERE id::text=$1 OR email=$1 LIMIT 1', [String(userId || '')]);
    const targetRole = (tr.rows[0]?.role || '').toString().toLowerCase();
    const isSelf = String(requester) === String(userId);
    if (requesterRole !== 'admin' && !(requesterRole === 'hr' && targetRole !== 'admin') && !isSelf) return res.status(403).json({ error: 'Unauthorized' });

    const dbUserId = await resolveDbUserId(userId);
    if (!dbUserId) return res.status(404).json({ error: 'user not found' });

    let cfg = null;
    try { const qc = await pool.query('SELECT * FROM employee_salary_config WHERE user_id::text=$1 LIMIT 1', [dbUserId]); cfg = qc.rows[0] || null; } catch (e) { /* continue */ }
    if (!cfg) {
      const ures = await pool.query('SELECT role FROM users WHERE id=$1 LIMIT 1', [dbUserId]);
      const role = (ures.rows[0]?.role || '').toString().toLowerCase();
      let monthlyGross = Number(process.env.DEFAULT_SALARY_OTHER || 25000);
      if (role === 'engineer') monthlyGross = 40000;
      else if (role === 'hr') monthlyGross = 50000;
      else if (role === 'admin') monthlyGross = 60000;
      const basic = Number((monthlyGross * 0.5).toFixed(2));
      const hra = Number((monthlyGross * 0.2).toFixed(2));
      const allowances = { other: Number((monthlyGross * 0.3).toFixed(2)) };
      cfg = { user_id: dbUserId, basic, hra, allowances, deductions: {} };
    }
    if ((req.query.mode || '').toString().toLowerCase() === 'hourly') cfg.hourly = true;
    const slip = await computePayrollFromConfig(cfg, { year: Number(year), month: Number(month) });
    return res.json({ success: true, computed: true, year: Number(year), month: Number(month), slip });
  } catch (err) {
    return handlePgError(err, res, '/payroll/compute');
  }
});

// POST /config - save or update salary config for a user
router.post('/config', async (req, res) => {
  const payload = req.body || {};
  const requester = req.header('x-user-id') || req.query.requesterId || null;
  try {
    const rr = await pool.query('SELECT role FROM users WHERE id::text=$1 OR email=$1 LIMIT 1', [String(requester || '')]);
    const requesterRole = (rr.rows[0]?.role || '').toString().toLowerCase();
    const targetUserIdRaw = payload.userId || payload.user_id;
    if (!targetUserIdRaw) return res.status(400).json({ error: 'missing userId in payload' });
    const dbUserId = await resolveDbUserId(targetUserIdRaw);
    if (!dbUserId) return res.status(404).json({ error: 'user not found' });
    const isSelf = String(requester) === String(targetUserIdRaw) || String(requester) === String(dbUserId);
    if (requesterRole !== 'admin' && requesterRole !== 'hr' && !isSelf) return res.status(403).json({ error: 'Unauthorized' });

    const basic = Number(payload.basic || 0);
    const hra = Number(payload.hra || 0);
    const allowances = payload.allowances || {};
    const deductions = payload.deductions || {};
    const salary_mode = payload.salary_mode || (payload.hourly ? 'hourly' : 'monthly');
    const hourly_rate = Number(payload.hourly_rate || payload.rate || payload.hourlyRate || process.env.HOURLY_RATE || 72.12);

    await pool.query(`
      INSERT INTO employee_salary_config (user_id, basic, hra, allowances, deductions, salary_mode, hourly_rate)
      VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7)
      ON CONFLICT (user_id) DO UPDATE SET basic=EXCLUDED.basic, hra=EXCLUDED.hra, allowances=EXCLUDED.allowances, deductions=EXCLUDED.deductions, salary_mode=EXCLUDED.salary_mode, hourly_rate=EXCLUDED.hourly_rate
    `, [dbUserId, basic, hra, JSON.stringify(allowances), JSON.stringify(deductions), salary_mode, hourly_rate]);

    return res.json({ success: true, user_id: dbUserId });
  } catch (err) {
    return handlePgError(err, res, '/payroll/config-post');
  }
});

// GET /config/:userId - fetch saved salary config
router.get('/config/:userId', async (req, res) => {
  const raw = req.params.userId;
  const requester = req.header('x-user-id') || req.query.requesterId || null;
  try {
    const dbUserId = await resolveDbUserId(raw);
    if (!dbUserId) return res.status(404).json({ error: 'user not found' });
    const rr = await pool.query('SELECT role FROM users WHERE id::text=$1 OR email=$1 LIMIT 1', [String(requester || '')]);
    const requesterRole = (rr.rows[0]?.role || '').toString().toLowerCase();
    const tr = await pool.query('SELECT role FROM users WHERE id::text=$1 OR email=$1 LIMIT 1', [String(raw || '')]);
    const targetRole = (tr.rows[0]?.role || '').toString().toLowerCase();
    const isSelf = String(requester) === String(raw) || String(requester) === String(dbUserId);
    if (requesterRole !== 'admin' && !(requesterRole === 'hr' && targetRole !== 'admin') && !isSelf) return res.status(403).json({ error: 'Unauthorized' });

    const q = await pool.query('SELECT * FROM employee_salary_config WHERE user_id::text=$1 LIMIT 1', [dbUserId]);
    if (q.rows.length === 0) return res.status(404).json({ error: 'config not found' });
    res.json({ config: q.rows[0] });
  } catch (err) {
    return handlePgError(err, res, '/payroll/config-get');
  }
});

// GET /slip/:userId/:year/:month - return stored payroll record if present
router.get('/slip/:userId/:year/:month', async (req, res) => {
  const { userId, year, month } = req.params;
  const requester = req.header('x-user-id') || req.query.requesterId || null;
  try {
    const rr = await pool.query('SELECT role FROM users WHERE id::text=$1 OR email=$1 LIMIT 1', [String(requester || '')]);
    const requesterRole = (rr.rows[0]?.role || '').toString().toLowerCase();
    const tr = await pool.query('SELECT role FROM users WHERE id::text=$1 OR email=$1 LIMIT 1', [String(userId || '')]);
    const targetRole = (tr.rows[0]?.role || '').toString().toLowerCase();
    const isSelf = String(requester) === String(userId);
    if (requesterRole !== 'admin' && !(requesterRole === 'hr' && targetRole !== 'admin') && !isSelf) return res.status(403).json({ error: 'Unauthorized' });

    const dbUserId = await resolveDbUserId(userId);
    if (!dbUserId) return res.status(404).json({ error: 'user not found' });
    const q = await pool.query('SELECT * FROM payroll_records WHERE user_id::text=$1 AND year=$2 AND month=$3 LIMIT 1', [dbUserId, Number(year), Number(month)]);
    if (q.rows.length === 0) return res.status(404).json({ error: 'Payroll not found' });
    res.json(q.rows[0]);
  } catch (err) {
    return handlePgError(err, res, '/payroll/slip');
  }
});

// GET /records/:userId - list stored payroll records for a user
router.get('/records/:userId', async (req, res) => {
  const userId = req.params.userId;
  const requester = req.header('x-user-id') || req.query.requesterId || null;
  try {
    const rr = await pool.query('SELECT role FROM users WHERE id::text=$1 OR email=$1 LIMIT 1', [String(requester || '')]);
    const requesterRole = (rr.rows[0]?.role || '').toString().toLowerCase();
    const tr = await pool.query('SELECT role FROM users WHERE id::text=$1 OR email=$1 LIMIT 1', [String(userId || '')]);
    const targetRole = (tr.rows[0]?.role || '').toString().toLowerCase();
    if (requesterRole !== 'admin' && !(requesterRole === 'hr' && targetRole !== 'admin') && String(requester) !== String(userId)) return res.status(403).json({ error: 'Unauthorized' });

    const dbUserId = await resolveDbUserId(userId);
    if (!dbUserId) return res.status(404).json({ error: 'user not found' });
    const q = await pool.query('SELECT id, year, month, gross, net_pay, created_at FROM payroll_records WHERE user_id::text=$1 ORDER BY year DESC, month DESC', [dbUserId]);
    res.json({ records: q.rows });
  } catch (err) {
    return handlePgError(err, res, '/payroll/records');
  }
});

// GET /pdf/:userId/:year/:month - compute and stream PDF (no save)
router.get('/pdf/:userId/:year/:month', async (req, res) => {
  try {
    const { userId, year, month } = req.params;
    const dbUserId = await resolveDbUserId(userId);
    if (!dbUserId) return res.status(404).json({ error: 'user not found' });

    // compute slip (prefer saved config)
    let cfg = null;
    try { const qc = await pool.query('SELECT * FROM employee_salary_config WHERE user_id::text=$1 LIMIT 1', [dbUserId]); cfg = qc.rows[0] || null; } catch (e) { /* continue */ }
    if (!cfg) {
      const ures = await pool.query('SELECT role FROM users WHERE id=$1 LIMIT 1', [dbUserId]);
      const role = (ures.rows[0]?.role || '').toString().toLowerCase();
      let monthlyGross = Number(process.env.DEFAULT_SALARY_OTHER || 25000);
      if (role === 'engineer') monthlyGross = 40000;
      else if (role === 'hr') monthlyGross = 50000;
      else if (role === 'admin') monthlyGross = 60000;
      const basic = Number((monthlyGross * 0.5).toFixed(2));
      const hra = Number((monthlyGross * 0.2).toFixed(2));
      const allowances = { other: Number((monthlyGross * 0.3).toFixed(2)) };
      cfg = { user_id: dbUserId, basic, hra, allowances, deductions: {} };
    }
    const slip = await computePayrollFromConfig(cfg, { year: Number(year), month: Number(month) });

    // stream simple PDF (compute-only; do not persist)
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="payslip_${dbUserId}_${year}_${month}.pdf"`);
    doc.pipe(res);
    doc.fontSize(16).text('Salary Slip', { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).text(`Month: ${month}/${year}`);
    doc.text(`Employee ID: ${dbUserId}`);
    doc.moveDown(0.5);

    doc.fontSize(12).text('Earnings', { underline: true });
    doc.text(`Basic: ₹${Number(slip.basic || 0).toFixed(2)}`);
    doc.text(`HRA: ₹${Number(slip.hra || 0).toFixed(2)}`);
    doc.text(`Allowances: ₹${Number(slip.allowancesSum || 0).toFixed(2)}`);
    doc.text(`Overtime Pay: ₹${Number(slip.overtime_pay || 0).toFixed(2)}`);
    doc.moveDown(0.5);

    doc.fontSize(12).text('Deductions', { underline: true });
    doc.text(`PF: ₹${Number(slip.pf || 0).toFixed(2)}`);
    doc.text(`ESI (Employee): ₹${Number(slip.esi_employee || 0).toFixed(2)}`);
    doc.text(`Professional Tax: ₹${Number(slip.professional_tax || 0).toFixed(2)}`);
    doc.text(`TDS: ₹${Number(slip.tds || 0).toFixed(2)}`);
    doc.moveDown(0.5);

    doc.fontSize(12).text('Summary', { underline: true });
    doc.text(`Gross: ₹${Number(slip.gross || 0).toFixed(2)}`);
    doc.text(`Net Pay: ₹${Number(slip.net_pay || 0).toFixed(2)}`);
    doc.end();
  } catch (err) {
    return handlePgError(err, res, '/payroll/pdf');
  }
});

// GET /form16/:userId/:year/pdf - stream form16 summary (read-only)
router.get('/form16/:userId/:year/pdf', async (req, res) => {
  try {
    const { userId, year } = req.params;
    const dbUserId = await resolveDbUserId(userId);
    if (!dbUserId) return res.status(404).json({ error: 'user not found' });

    const q = await pool.query('SELECT * FROM payroll_records WHERE user_id::text=$1 AND year=$2', [dbUserId, Number(year)]);
    const rows = q.rows || [];
    const summary = rows.reduce((acc, r) => {
      acc.gross += Number(r.gross || 0);
      acc.pf += Number(r.pf || 0);
      acc.esi_employee += Number(r.esi_employee || 0);
      acc.tds += Number(r.tds || 0);
      acc.net += Number(r.net_pay || 0);
      return acc;
    }, { gross: 0, pf: 0, esi_employee: 0, tds: 0, net: 0 });

    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="form16_${dbUserId}_${year}.pdf"`);
    doc.pipe(res);
    doc.fontSize(16).text('Form 16 - Summary', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Employee ID: ${dbUserId}`);
    doc.text(`Year: ${year}`);
    doc.moveDown();
    doc.text(`Total Gross (year): ₹${Number(summary.gross).toFixed(2)}`);
    doc.text(`Total PF (year): ₹${Number(summary.pf).toFixed(2)}`);
    doc.text(`Total ESI (employee) (year): ₹${Number(summary.esi_employee).toFixed(2)}`);
    doc.text(`Total TDS (year): ₹${Number(summary.tds).toFixed(2)}`);
    doc.text(`Net Paid (year): ₹${Number(summary.net).toFixed(2)}`);
    doc.end();
  } catch (err) {
    return handlePgError(err, res, '/payroll/form16');
  }
});

// GET /overview/:year/:month - monthly overview (read-only)
router.get('/overview/:year/:month', async (req, res) => {
  const year = Number(req.params.year || new Date().getFullYear());
  const month = Number(req.params.month || (new Date().getMonth() + 1));
  const requester = req.header('x-user-id') || req.query.requesterId || null;
  try {
    const rr = await pool.query('SELECT role FROM users WHERE id::text=$1 OR email=$1 LIMIT 1', [String(requester || '')]);
    const requesterRole = (rr.rows[0]?.role || '').toString().toLowerCase();
    if (requesterRole === 'admin') {
      const q = await pool.query('SELECT pr.*, u.name, u.email, u.role FROM payroll_records pr LEFT JOIN users u ON u.id::text = pr.user_id::text WHERE pr.year=$1 AND pr.month=$2 ORDER BY u.role, u.id', [year, month]);
      return res.json({ year, month, records: q.rows });
    }
    if (requesterRole === 'hr') {
      const q = await pool.query("SELECT pr.*, u.name, u.email, u.role FROM payroll_records pr LEFT JOIN users u ON u.id::text = pr.user_id::text WHERE pr.year=$1 AND pr.month=$2 AND (u.role IS NULL OR LOWER(u.role) <> 'admin') ORDER BY u.role, u.id", [year, month]);
      return res.json({ year, month, records: q.rows });
    }
    const q = await pool.query('SELECT pr.*, u.name, u.email, u.role FROM payroll_records pr LEFT JOIN users u ON u.id::text = pr.user_id::text WHERE pr.year=$1 AND pr.month=$2 AND pr.user_id::text=$3 ORDER BY u.role, u.id', [year, month, String(requester || '')]);
    res.json({ year, month, records: q.rows });
  } catch (err) {
    return handlePgError(err, res, '/payroll/overview');
  }
});

// GET /configs - list salary configs
router.get('/configs', async (req, res) => {
  try {
    const q = await pool.query('SELECT * FROM employee_salary_config ORDER BY user_id');
    res.json({ configs: q.rows });
  } catch (err) {
    return handlePgError(err, res, '/payroll/configs');
  }
});

// GET /statutory/:year - aggregate statutory totals
router.get('/statutory/:year', async (req, res) => {
  const year = Number(req.params.year || new Date().getFullYear());
  try {
    const q = await pool.query('SELECT COALESCE(SUM(pf),0) as total_pf, COALESCE(SUM(esi_employee),0) as total_esi_employee, COALESCE(SUM(esi_employer),0) as total_esi_employer, COALESCE(SUM(overtime_pay),0) as total_overtime_pay, COALESCE(SUM(gross),0) as total_gross FROM payroll_records WHERE year=$1', [year]);
    res.json(q.rows[0] || { total_pf: 0, total_esi_employee: 0, total_esi_employer: 0, total_overtime_pay: 0, total_gross: 0 });
  } catch (err) {
    return handlePgError(err, res, '/payroll/statutory');
  }
});


// Helper: generate and save a PDF payslip and upsert payroll_records + payslip metadata
async function generatePayslipForUser(identifier, year, month, opts = { savePdf: true }) {
    if (!identifier) {
        throw new Error('Identifier (email or UUID) is required');
    }

    const dbUserId = await resolveDbUserId(identifier);
    if (!dbUserId) {
        throw new Error(`User not found with identifier: ${identifier}`);
    }

    // Get existing salary config
    let cfg = null;
    try {
        const qc = await pool.query('SELECT * FROM employee_salary_config WHERE user_id = $1', [dbUserId]);
        cfg = qc.rows[0];
    } catch (e) {
        console.warn('Failed to fetch salary config:', e);
    }

    // If no config exists, create default
    if (!cfg) {
        const userRes = await pool.query('SELECT role FROM users WHERE id = $1', [dbUserId]);
        const role = (userRes.rows[0]?.role || '').toString().toLowerCase();
        let monthlyGross = Number(process.env.DEFAULT_SALARY_OTHER || 25000);
        
        switch(role) {
            case 'engineer': monthlyGross = 40000; break;
            case 'hr': monthlyGross = 50000; break;
            case 'admin': monthlyGross = 60000; break;
        }

        cfg = {
            user_id: dbUserId,
            basic: monthlyGross * 0.5,
            hra: monthlyGross * 0.2,
            allowances: { other: monthlyGross * 0.3 },
            deductions: {},
            salary_mode: 'monthly',
            hourly_rate: Number(process.env.HOURLY_RATE || 72.12)
        };
    }

    // Compute slip without validation
    const slip = await computePayrollFromConfig(cfg, { year: Number(year), month: Number(month) });

    // Save to payroll_records
    try {
        await pool.query(`
            INSERT INTO payroll_records 
            (user_id, year, month, basic, hra, gross, pf, esi_employee, esi_employer, 
             professional_tax, tds, net_pay, overtime_pay, created_at)
            VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, now())
            ON CONFLICT (user_id, year, month) 
            DO UPDATE SET 
                basic = EXCLUDED.basic,
                hra = EXCLUDED.hra,
                gross = EXCLUDED.gross,
                pf = EXCLUDED.pf,
                esi_employee = EXCLUDED.esi_employee,
                esi_employer = EXCLUDED.esi_employer,
                professional_tax = EXCLUDED.professional_tax,
                tds = EXCLUDED.tds,
                net_pay = EXCLUDED.net_pay,
                overtime_pay = EXCLUDED.overtime_pay,
                created_at = now()
        `, [
            dbUserId,
            Number(year),
            Number(month),
            slip.basic,
            slip.hra,
            slip.gross,
            slip.pf,
            slip.esi_employee,
            slip.esi_employer,
            slip.professional_tax,
            slip.tds,
            slip.net_pay,
            slip.overtime_pay
        ]);
    } catch (e) {
        console.error('Failed to upsert payroll_records:', e?.message || e);
        throw e;
    }

    // Save PDF if requested
    let savedPath = null;
    if (opts.savePdf !== false) {
        try {
            const uploadsBase = process.env.UPLOADS_DIR
                ? path.resolve(process.env.UPLOADS_DIR)
                : path.join(process.cwd(), 'storage', 'uploads');
            const destDir = path.join(uploadsBase, 'payslips', `${year}-${String(month).padStart(2, '0')}`);
            fs.mkdirSync(destDir, { recursive: true });
            const fileName = `payslip_${dbUserId}_${year}_${month}.pdf`;
            const filePath = path.join(destDir, fileName);
            
            const doc = new PDFDocument({ size: 'A4', margin: 40 });
            const ws = fs.createWriteStream(filePath);
            doc.pipe(ws);
            
            // Generate PDF content
            doc.fontSize(16).text('Salary Slip', { align: 'center' });
            doc.moveDown();
            doc.fontSize(10).text(`Month: ${month}/${year}`);
            doc.text(`Employee ID: ${dbUserId}`);
            doc.moveDown(0.5);
            doc.fontSize(12).text('Earnings', { underline: true });
            doc.text(`Basic: ₹${Number(slip.basic || 0).toFixed(2)}`);
            doc.text(`HRA: ₹${Number(slip.hra || 0).toFixed(2)}`);
            doc.text(`Allowances: ₹${Number(slip.allowancesSum || 0).toFixed(2)}`);
            doc.text(`Overtime Pay: ₹${Number(slip.overtime_pay || 0).toFixed(2)}`);
            doc.moveDown(0.5);
            doc.fontSize(12).text('Deductions', { underline: true });
            doc.text(`PF: ₹${Number(slip.pf || 0).toFixed(2)}`);
            doc.text(`ESI (Employee): ₹${Number(slip.esi_employee || 0).toFixed(2)}`);
            doc.text(`Professional Tax: ₹${Number(slip.professional_tax || 0).toFixed(2)}`);
            doc.text(`TDS: ₹${Number(slip.tds || 0).toFixed(2)}`);
            doc.moveDown(0.5);
            doc.fontSize(12).text('Summary', { underline: true });
            doc.text(`Gross: ₹${Number(slip.gross || 0).toFixed(2)}`);
            doc.text(`Net Pay: ₹${Number(slip.net_pay || 0).toFixed(2)}`);
            doc.end();
            
            await new Promise((resolve, reject) => {
                ws.on('finish', resolve);
                ws.on('error', reject);
            });
            savedPath = filePath;

            // Save metadata
            await pool.query(`
                INSERT INTO payslip (user_id, month, year, basic, hra, allowances, deductions, path, file_name, created_at)
                VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9,now())
                ON CONFLICT (user_id, year, month) DO UPDATE SET 
                    path=EXCLUDED.path, 
                    file_name=EXCLUDED.file_name, 
                    created_at=now()
            `, [
                dbUserId,
                Number(month),
                Number(year),
                slip.basic,
                slip.hra,
                JSON.stringify(slip.allowances || {}),
                JSON.stringify(slip.other_deductions || {}),
                savedPath,
                path.basename(savedPath)
            ]);
        } catch (e) {
            console.error('Failed to save PDF:', e?.message || e);
            // Continue even if PDF save fails
        }
    }

    return { ok: true, user_id: dbUserId, year: Number(year), month: Number(month), path: savedPath, slip };
}

// Generate payslips for all active users for given year/month. Returns summary.
async function generatePayslipsForAll(year, month, opts = { savePdf: true }) {
  const out = { generated: 0, failed: 0, errors: [] };
  // fetch users list (you may filter active employees here)
  const q = await pool.query('SELECT id FROM users WHERE (role IS NULL OR LOWER(role) <> \'service\')'); // example filter
  const rows = q.rows || [];
  for (const r of rows) {
    try {
      await generatePayslipForUser(r.id, year, month, opts);
      out.generated++;
    } catch (e) {
      out.failed++;
      out.errors.push({ user_id: r.id, error: e?.message || String(e) });
    }
  }
  return out;
}

// export named generator for server scheduler
export { generatePayslipsForAll };

// --- end added ---

router.post('/generate-payslip/:userId/:year/:month', async (req, res) => {
  const requester = req.header('x-user-id') || req.query.requesterId || null;
  try {
    const rr = await pool.query('SELECT role FROM users WHERE id::text=$1 OR email=$1 LIMIT 1', [String(requester || '')]);
    const requesterRole = (rr.rows[0]?.role || '').toString().toLowerCase();
    if (requesterRole !== 'admin' && requesterRole !== 'hr' && String(requester) !== String(req.params.userId)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const dbUserId = await resolveDbUserId(req.params.userId);
    if (!dbUserId) return res.status(404).json({ error: 'user not found' });

    const year = Number(req.params.year);
    const month = Number(req.params.month);
    const result = await generatePayslipForUser(dbUserId, year, month, { savePdf: true });
    return res.json({ success: true, result });
  } catch (err) {
    return handlePgError(err, res, '/payroll/generate-payslip');
  }
});

// POST /run - admin-only: generate payslips for all users for given year/month (body optional)
router.post('/run', async (req, res) => {
  const payload = req.body || {};
  const requester = req.header('x-user-id') || req.query.requesterId || null;
  try {
    const rr = await pool.query('SELECT role FROM users WHERE id::text=$1 OR email=$1 LIMIT 1', [String(requester || '')]);
    const requesterRole = (rr.rows[0]?.role || '').toString().toLowerCase();
    if (requesterRole !== 'admin') return res.status(403).json({ error: 'Unauthorized' });

    const year = Number(payload.year || payload.y || (new Date()).getFullYear());
    const month = Number(payload.month || payload.m || (new Date()).getMonth() + 1);
    const savePdf = payload.savePdf !== undefined ? !!payload.savePdf : true;

    const summary = await generatePayslipsForAll(year, month, { savePdf });
    return res.json({ success: true, year, month, summary });
  } catch (err) {
    return handlePgError(err, res, '/payroll/run');
  }
});

// GET /payslips/:userId - fetch all payslips and salary config for a user
router.get('/payslips/:userId', async (req, res) => {
    const { userId } = req.params;
    const requester = req.header('x-user-id') || req.query.requesterId || null;
    
    try {
        // Check authorization
        const rr = await pool.query('SELECT role FROM users WHERE id::text=$1 OR email=$1 LIMIT 1', [String(requester || '')]);
        const requesterRole = (rr.rows[0]?.role || '').toString().toLowerCase();
        const isSelf = String(requester) === String(userId);
        
        // Only allow admin, HR, or self to view payslips
        if (requesterRole !== 'admin' && requesterRole !== 'hr' && !isSelf) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const dbUserId = await resolveDbUserId(userId);
        if (!dbUserId) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Fetch salary configuration
        const configQuery = await pool.query(`
            SELECT 
                esc.*,
                u.name as employee_name,
                u.email as employee_email,
                u.role as employee_role
            FROM employee_salary_config esc
            LEFT JOIN users u ON u.id = esc.user_id
            WHERE esc.user_id = $1
            LIMIT 1
        `, [dbUserId]);

        // Fetch payslips with user details and payroll records
        const payslipsQuery = await pool.query(`
            SELECT 
                p.*,
                u.name as employee_name,
                u.email as employee_email,
                u.role as employee_role,
                pr.gross,
                pr.net_pay,
                pr.pf,
                pr.esi_employee,
                pr.professional_tax,
                pr.tds,
                pr.overtime_pay
            FROM payslip p
            LEFT JOIN users u ON u.id = p.user_id
            LEFT JOIN payroll_records pr ON pr.user_id = p.user_id 
                AND pr.year = p.year 
                AND pr.month = p.month
            WHERE p.user_id = $1
            ORDER BY p.year DESC, p.month DESC
        `, [dbUserId]);

        const salaryConfig = configQuery.rows[0] ? {
            ...configQuery.rows[0],
            basic: Number(configQuery.rows[0].basic || 0).toFixed(2),
            hra: Number(configQuery.rows[0].hra || 0).toFixed(2),
            hourly_rate: Number(configQuery.rows[0].hourly_rate || 0).toFixed(2),
            allowances: typeof configQuery.rows[0].allowances === 'string' 
                ? JSON.parse(configQuery.rows[0].allowances) 
                : (configQuery.rows[0].allowances || {}),
            deductions: typeof configQuery.rows[0].deductions === 'string' 
                ? JSON.parse(configQuery.rows[0].deductions) 
                : (configQuery.rows[0].deductions || {})
        } : null;

        res.json({
            success: true,
            employee: {
                id: dbUserId,
                name: payslipsQuery.rows[0]?.employee_name,
                email: payslipsQuery.rows[0]?.employee_email,
                role: payslipsQuery.rows[0]?.employee_role
            },
            salary_config: salaryConfig,
            payslips: payslipsQuery.rows.map(row => ({
                id: row.id,
                year: row.year,
                month: row.month,
                month_year: `${row.month}/${row.year}`,
                gross: Number(row.gross || 0).toFixed(2),
                net_pay: Number(row.net_pay || 0).toFixed(2),
                basic: Number(row.basic || 0).toFixed(2),
                hra: Number(row.hra || 0).toFixed(2),
                pf: Number(row.pf || 0).toFixed(2),
                esi_employee: Number(row.esi_employee || 0).toFixed(2),
                professional_tax: Number(row.professional_tax || 0).toFixed(2),
                tds: Number(row.tds || 0).toFixed(2),
                overtime_pay: Number(row.overtime_pay || 0).toFixed(2),
                created_at: new Date(row.created_at).toISOString(),
                path: row.path,
                has_pdf: !!row.path,
                allowances: typeof row.allowances === 'string' 
                    ? JSON.parse(row.allowances) 
                    : (row.allowances || {}),
                deductions: typeof row.deductions === 'string' 
                    ? JSON.parse(row.deductions) 
                    : (row.deductions || {})
            }))
        });
    } catch (err) {
        return handlePgError(err, res, '/payroll/payslips');
    }
});

// GET /payslip-details/:userId - fetch merged payslip and salary config data
router.get('/payslip-details/:userId', async (req, res) => {
    const { userId } = req.params;
    const requester = req.header('x-user-id') || req.query.requesterId || null;
    
    try {
        // Check authorization
        const rr = await pool.query('SELECT role FROM users WHERE id::text=$1 OR email=$1 LIMIT 1', [String(requester || '')]);
        const requesterRole = (rr.rows[0]?.role || '').toString().toLowerCase();
        const isSelf = String(requester) === String(userId);
        
        if (requesterRole !== 'admin' && requesterRole !== 'hr' && !isSelf) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const dbUserId = await resolveDbUserId(userId);
        if (!dbUserId) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Fetch merged data from all tables
        const query = await pool.query(`
            SELECT 
                u.id as user_id,
                u.name,
                u.email,
                u.role,
                esc.basic as config_basic,
                esc.hra as config_hra,
                esc.allowances as config_allowances,
                esc.deductions as config_deductions,
                esc.salary_mode,
                esc.hourly_rate,
                p.year,
                p.month,
                p.path as pdf_path,
                p.file_name,
                p.created_at,
                pr.basic as payroll_basic,
                pr.hra as payroll_hra,
                pr.gross,
                pr.net_pay,
                pr.pf,
                pr.esi_employee,
                pr.esi_employer,
                pr.professional_tax,
                pr.tds,
                pr.overtime_pay
            FROM users u
            LEFT JOIN employee_salary_config esc ON u.id = esc.user_id
            LEFT JOIN payslip p ON u.id = p.user_id
            LEFT JOIN payroll_records pr ON u.id = pr.user_id 
                AND pr.year = p.year 
                AND pr.month = p.month
            WHERE u.id = $1
            ORDER BY p.year DESC, p.month DESC
        `, [dbUserId]);

        // Format the response
        const payslips = query.rows.map(row => ({
            // User Details
            user: {
                id: row.user_id,
                name: row.name,
                email: row.email,
                role: row.role
            },
            // Salary Config
            salary_config: {
                basic: Number(row.config_basic || 0).toFixed(2),
                hra: Number(row.config_hra || 0).toFixed(2),
                allowances: typeof row.config_allowances === 'string' 
                    ? JSON.parse(row.config_allowances) 
                    : (row.config_allowances || {}),
                deductions: typeof row.config_deductions === 'string' 
                    ? JSON.parse(row.config_deductions) 
                    : (row.config_deductions || {}),
                salary_mode: row.salary_mode,
                hourly_rate: Number(row.hourly_rate || 0).toFixed(2)
            },
            // Payroll Details
            payroll: {
                year: row.year,
                month: row.month,
                basic: Number(row.payroll_basic || 0).toFixed(2),
                hra: Number(row.payroll_hra || 0).toFixed(2),
                gross: Number(row.gross || 0).toFixed(2),
                net_pay: Number(row.net_pay || 0).toFixed(2),
                pf: Number(row.pf || 0).toFixed(2),
                esi_employee: Number(row.esi_employee || 0).toFixed(2),
                esi_employer: Number(row.esi_employer || 0).toFixed(2),
                professional_tax: Number(row.professional_tax || 0).toFixed(2),
                tds: Number(row.tds || 0).toFixed(2),
                overtime_pay: Number(row.overtime_pay || 0).toFixed(2)
            },
            // PDF Details
            pdf: {
                path: row.pdf_path,
                file_name: row.file_name,
                has_pdf: !!row.pdf_path
            },
            created_at: row.created_at ? new Date(row.created_at).toISOString() : null
        }));

        res.json({
            success: true,
            data: payslips
        });

    } catch (err) {
        return handlePgError(err, res, '/payroll/payslip-details');
    }
});

// New route to fetch merged payslip and salary config data for all users (admin only)
router.get('/payslip-details', async (req, res) => {
    try {
        // Fetch merged data for all users
        const query = await pool.query(`
            SELECT 
                u.id as user_id,
                u.name,
                u.email,
                u.role,
                esc.basic as config_basic,
                esc.hra as config_hra,
                esc.allowances as config_allowances,
                esc.deductions as config_deductions,
                esc.salary_mode,
                esc.hourly_rate,
                p.year,
                p.month,
                p.path as pdf_path,
                p.file_name,
                p.created_at,
                pr.basic as payroll_basic,
                pr.hra as payroll_hra,
                pr.gross,
                pr.net_pay,
                pr.pf,
                pr.esi_employee,
                pr.esi_employer,
                pr.professional_tax,
                pr.tds,
                pr.overtime_pay
            FROM users u
            LEFT JOIN employee_salary_config esc ON u.id = esc.user_id
            LEFT JOIN payslip p ON u.id = p.user_id
            LEFT JOIN payroll_records pr ON u.id = pr.user_id 
                AND pr.year = p.year 
                AND pr.month = p.month
            WHERE u.role != 'admin'
            ORDER BY u.name, p.year DESC, p.month DESC
        `);

        // Group data by user
        const usersMap = query.rows.reduce((acc, row) => {
            if (!acc[row.user_id]) {
                acc[row.user_id] = {
                    user: {
                        id: row.user_id,
                        name: row.name,
                        email: row.email,
                        role: row.role
                    },
                    salary_config: {
                        basic: Number(row.config_basic || 0).toFixed(2),
                        hra: Number(row.config_hra || 0).toFixed(2),
                        allowances: typeof row.config_allowances === 'string' 
                            ? JSON.parse(row.config_allowances) 
                            : (row.config_allowances || {}),
                        deductions: typeof row.config_deductions === 'string' 
                            ? JSON.parse(row.config_deductions) 
                            : (row.config_deductions || {}),
                        salary_mode: row.salary_mode,
                        hourly_rate: Number(row.hourly_rate || 0).toFixed(2)
                    },
                    payslips: []
                };
            }

            if (row.year && row.month) {
                acc[row.user_id].payslips.push({
                    year: row.year,
                    month: row.month,
                    basic: Number(row.payroll_basic || 0).toFixed(2),
                    hra: Number(row.payroll_hra || 0).toFixed(2),
                    gross: Number(row.gross || 0).toFixed(2),
                    net_pay: Number(row.net_pay || 0).toFixed(2),
                    pf: Number(row.pf || 0).toFixed(2),
                    esi_employee: Number(row.esi_employee || 0).toFixed(2),
                    esi_employer: Number(row.esi_employer || 0).toFixed(2),
                    professional_tax: Number(row.professional_tax || 0).toFixed(2),
                    tds: Number(row.tds || 0).toFixed(2),
                    overtime_pay: Number(row.overtime_pay || 0).toFixed(2),
                    pdf: {
                        path: row.pdf_path,
                        file_name: row.file_name,
                        has_pdf: !!row.pdf_path
                    },
                    created_at: row.created_at ? new Date(row.created_at).toISOString() : null
                });
            }

            return acc;
        }, {});

        res.json({
            success: true,
            data: Object.values(usersMap)
        });

    } catch (err) {
        return handlePgError(err, res, '/payroll/payslip-details');
    }
});

// Add this function to get payslip path
async function getPayslipPath(userId, year, month) {
    try {
        const query = await pool.query(`
            SELECT path 
            FROM payslip 
            WHERE user_id = $1 
            AND year = $2 
            AND month = $3 
            LIMIT 1
        `, [userId, year, month]);
        
        return query.rows[0]?.path || null;
    } catch (err) {
        console.error('Error fetching payslip path:', err);
        return null;
    }
}

// Update the viewSlip function in the frontend
async function viewSlip(user) {
    try {
        const headers = getRequesterHeaders();
        const res = await axios.get(`/api/payroll/slip/${encodeURIComponent(user.email)}/${year}/${month}`, { headers });
        
        // Get path from payslip table
        const pathRes = await axios.get(`/api/payroll/get-path/${encodeURIComponent(user.email)}/${year}/${month}`, { headers });
        
        if (pathRes.data.path) {
            // Open PDF in new window
            window.open(`/api/payroll/view-pdf?path=${encodeURIComponent(pathRes.data.path)}`, '_blank');
        } else {
            alert('PDF not found. Generate the payslip first.');
        }
    } catch (err) {
        console.error('Failed to fetch slip', err);
        alert('Slip not available');
    }
}

// Add new route to get payslip path
router.get('/get-path/:userId/:year/:month', async (req, res) => {
    const { userId, year, month } = req.params;
    try {
        const dbUserId = await resolveDbUserId(userId);
        if (!dbUserId) {
            return res.status(404).json({ error: 'User not found' });
        }

        const path = await getPayslipPath(dbUserId, Number(year), Number(month));
        if (!path) {
            return res.status(404).json({ error: 'Payslip not found' });
        }

        res.json({ path });
    } catch (err) {
        return handlePgError(err, res, '/payroll/get-path');
    }
});

// Add this route to handle PDF viewing
router.get('/view-pdf', async (req, res) => {
    try {
        const filePath = req.query.path;
        if (!filePath) {
            return res.status(400).send('No file path provided');
        }

        // Basic security check to prevent directory traversal
        const normalizedPath = path.normalize(filePath);
        if (normalizedPath.includes('..')) {
            return res.status(403).send('Invalid file path');
        }

        // Check if file exists
        if (!fs.existsSync(normalizedPath)) {
            return res.status(404).send('File not found');
        }

        // Set correct headers for PDF
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline; filename=payslip.pdf');

        // Stream the file
        const fileStream = fs.createReadStream(normalizedPath);
        fileStream.pipe(res);
    } catch (err) {
        console.error('Error serving PDF:', err);
        res.status(500).send('Error serving PDF file');
    }
});

export default router;
