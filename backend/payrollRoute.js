import express from 'express';
import { pool, getConnection } from './db.js';
import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';
import { requireAuth } from './middleware/auth.js';

const router = express.Router();

// Financial constants
const PF_RATE = Number(process.env.PF_RATE || 0.12);
const ESI_EMP_RATE = Number(process.env.ESI_EMP_RATE || 0.0075);
const ESI_EMPLOYER_RATE = Number(process.env.ESI_EMPLOYER_RATE || 0.0325);
const TDS_RATE = Number(process.env.TDS_RATE || 0.05);
const PROFESSIONAL_TAX = Number(process.env.PROFESSIONAL_TAX || 200);
const HOURLY_RATE = Number(process.env.HOURLY_RATE || 72.12);
const DEFAULT_HOURS_PER_DAY = Number(process.env.HOURS_PER_WORKING_DAY || 8);


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

  // Rule 1: Total working days = total days in the month (INCLUDING weekends/Sundays)
  const totalWorkingDays = new Date(year, month, 0).getDate();

  const userId = cfg.user_id || cfg.userId || null;
  let workedDays = 0;
  let totalAttendanceSeconds = 0;

  const wdQ = `SELECT COUNT(DISTINCT (created_at::date)) AS worked_days FROM attendance WHERE user_id::text=$1 AND type='in' AND created_at::date BETWEEN $2 AND $3`;
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
    const [wdR, attR] = await Promise.all([
      pool.query(wdQ, [userId, start, end]),
      pool.query(attQ, [userId, start, end]).catch(() => ({ rows: [{ worked_seconds: 0 }] })),
    ]);
    workedDays = Number(wdR.rows[0]?.worked_days ?? 0);
    totalAttendanceSeconds = Number(attR.rows[0]?.worked_seconds ?? 0);
  } catch (err) {
    throw err;
  }

  const attendanceHours = Number((totalAttendanceSeconds / 3600) || 0);
  const useHourly = (cfg.salary_mode && String(cfg.salary_mode).toLowerCase() === 'hourly') || cfg.hourly === true;
  
  // Rule 5: Salary Mode
  let monthlyGross = basic + hra + allowancesSum;
  if (useHourly) monthlyGross = Number((attendanceHours * (Number(cfg.hourly_rate || HOURLY_RATE))).toFixed(2));

  // Rule 2 & 3: Get leaves with day_type (full=1, half=0.5)
  // Updated to use day_type instead of leave_type
  const leaveQuery = `
    SELECT 
      day_type,
      COUNT(*) as count,
      SUM(
        CASE 
          WHEN LOWER(day_type) IN ('half', 'half day') THEN 0.5
          ELSE 1
        END
      ) as total_days
    FROM (
      SELECT 
        CASE 
          WHEN LOWER(day_type) IN ('half', 'half day') THEN 'half'
          ELSE 'full'
        END as day_type,
        generate_series(start_date::date, end_date::date, '1 day'::interval)::date as leave_date
      FROM leaves 
      WHERE user_id::text = $1 
        AND LOWER(status) = 'approved'
        AND NOT (end_date::date < $2::date OR start_date::date > $3::date)
    ) as expanded_leaves
    GROUP BY day_type
  `;

  let leave_full_days = 0;
  let leave_half_days = 0;

  try {
    const leaveResult = await pool.query(leaveQuery, [userId, start, end]);
    
    leaveResult.rows.forEach(row => {
      if (row.day_type === 'full') {
        leave_full_days = Number(row.total_days || 0);
      } else if (row.day_type === 'half') {
        leave_half_days = Number(row.total_days || 0);
      }
    });
  } catch (err) {
    console.error('Error calculating leaves:', err);
    throw err;
  }

  // Rule 3: Free Leave Policy
  const FREE_FULL_DAY = 1;
  const FREE_HALF_DAY = 1;

  const chargeable_full_days = Math.max(0, leave_full_days - FREE_FULL_DAY);
  const chargeable_half_days = Math.max(0, leave_half_days - FREE_HALF_DAY);

  // Rule 4: Leave Deduction Calculation
  const per_day_salary = Number((monthlyGross / totalWorkingDays).toFixed(2));
  const leave_deduction = Number(
    (chargeable_full_days * per_day_salary) + (chargeable_half_days * (per_day_salary / 2))
  ).toFixed(2);

  // Deductions
  const pf = Number((basic * PF_RATE).toFixed(2));
  const esi_employee = Number((monthlyGross * ESI_EMP_RATE).toFixed(2));
  const esi_employer = Number((monthlyGross * ESI_EMPLOYER_RATE).toFixed(2));
  const professional_tax = Number(PROFESSIONAL_TAX);
  const tds = Number((monthlyGross * TDS_RATE).toFixed(2));
  const otherDeductions = cfg.deductions || {};
  const otherSum = Object.values(otherDeductions).reduce((s, v) => s + Number(v || 0), 0);

  // Rule 7: Net Pay Calculation
  const gross_pay = monthlyGross;
  const net_pay = Number(
    (gross_pay - (pf + esi_employee + professional_tax + tds + otherSum + Number(leave_deduction)))
  ).toFixed(2);

  // Rule 8: Return object with all required fields
  return {
    // Rule 1: Total working days
    total_working_days: totalWorkingDays,
    
    // Rule 2 & 3: Leave breakdown
    leave_full_days: Number(leave_full_days.toFixed(2)),
    leave_half_days: Number(leave_half_days.toFixed(2)),
    chargeable_full_days: Number(chargeable_full_days.toFixed(2)),
    chargeable_half_days: Number(chargeable_half_days.toFixed(2)),
    
    // Rule 4: Leave deduction
    leave_deduction: Number(leave_deduction),
    per_day_salary: per_day_salary,
    
    // Attendance
    worked_days: workedDays,
    attendance_hours: Number(attendanceHours.toFixed(2)),
    
    // Rule 5: Earnings
    basic: basic,
    hra: hra,
    allowances: allowances,
    allowancesSum: allowancesSum,
    gross_pay: Number(gross_pay.toFixed(2)),
    
    // Deductions
    pf: pf,
    esi_employee: esi_employee,
    esi_employer: esi_employer,
    professional_tax: professional_tax,
    tds: tds,
    other_deductions: otherDeductions,
    otherSum: otherSum,
    
    // Rule 7: Net Pay
    net_pay: Number(net_pay),
    
    // Additional fields for compatibility
    gross: Number(gross_pay.toFixed(2)),
    overtime_hours: 0,
    overtime_pay: 0,
    month: month,
    year: year
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
    try { const qc = await pool.query('SELECT * FROM payroll_records WHERE user_id::text=$1 LIMIT 1', [dbUserId]); cfg = qc.rows[0] || null; } catch (e) { /* continue */ }
    if (!cfg) {
      const ures = await pool.query('SELECT role FROM users WHERE id=$1 LIMIT 1', [dbUserId]);
      const role = (ures.rows[0]?.role || '').toString().toLowerCase();
      
      // Adjusted salaries to achieve net pay of ~10000 after deductions
      let basicSalary = 6000;  // Default
      let hraSalary = 2400;    // Default
      let otherAllowance = 1600;  // Default
      
      if (role === 'engineer') {
          basicSalary = 6000;  // 60% of gross
          hraSalary = 2400;    // 24% of gross
          otherAllowance = 1600;  // 16% of gross
      } else if (role === 'hr') {
          basicSalary = 7500;  // 60% of gross
          hraSalary = 3000;    // 24% of gross
          otherAllowance = 2000;  // 16% of gross
      } else if (role === 'admin') {
          basicSalary = 9000;  // 60% of gross
          hraSalary = 3600;    // 24% of gross
          otherAllowance = 2400;  // 16% of gross
      }
      
      const basic = Number(basicSalary.toFixed(2));
      const hra = Number(hraSalary.toFixed(2));
      const allowances = { other: Number(otherAllowance.toFixed(2)) };
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
  try {
    const { userId, year, month } = req.params;
    const requester = req.header('x-user-id') || req.query.requesterId || null;

    const rr = await pool.query('SELECT role FROM users WHERE id::text=$1 OR email=$1 LIMIT 1', [String(requester || '')]);
    const requesterRole = (rr.rows[0]?.role || '').toString().toLowerCase();
    const tr = await pool.query('SELECT role FROM users WHERE id::text=$1 OR email=$1 LIMIT 1', [String(userId || '')]);
    const targetRole = (tr.rows[0]?.role || '').toString().toLowerCase();
    const isSelf = String(requester) === String(userId);
    
    if (requesterRole !== 'admin' && !(requesterRole === 'hr' && targetRole !== 'admin') && !isSelf) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

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
        if (!dbUserId) {
            return res.status(404).json({ error: 'user not found' });
        }

        // Get salary config
        let cfg = null;
        try {
            const qc = await pool.query('SELECT * FROM payroll_records WHERE user_id::text=$1 LIMIT 1', [dbUserId]);
            cfg = qc.rows[0] || null;
        } catch (e) {
            console.warn('Could not fetch salary config:', e?.message);
        }

        // Use default config if not found
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

        // Compute payroll with updated logic
        const slip = await computePayrollFromConfig(cfg, { year: Number(year), month: Number(month) });

        // Get user details
        const userQuery = await pool.query('SELECT name, email FROM users WHERE id=$1', [dbUserId]);
        const userName = userQuery.rows[0]?.name || 'Employee';

        // Create PDF document
        const doc = new PDFDocument({ size: 'A4', margin: 40 });

        // Set response headers
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="payslip_${dbUserId}_${year}_${month}.pdf"`);

        // Pipe the PDF document directly to the response
        doc.pipe(res);

        // PDF Header
        doc.fontSize(16).text('SALARY SLIP', { align: 'center' });
        doc.moveDown();
        doc.fontSize(10);
        doc.text(`Month: ${month}/${year}`, { align: 'left' });
        doc.text(`Employee ID: ${dbUserId}`);
        doc.text(`Employee Name: ${userName}`);
        doc.moveDown(0.5);

        // Attendance & Leave Section
        doc.fontSize(12).text('ATTENDANCE & LEAVE', { underline: true });
        doc.fontSize(10);
        doc.text(`Total Working Days (Calendar): ${slip.total_working_days} days`);
        doc.text(`Worked Days: ${slip.worked_days} days`);
        doc.text(`Leave - Full Days: ${slip.leave_full_days} days`);
        doc.text(`Leave - Half Days: ${slip.leave_half_days} days`);
        doc.text(`Free Full Day: 1 day`);
        doc.text(`Free Half Day: 1 day`);
        doc.text(`Chargeable Full Days: ${slip.chargeable_full_days} days`);
        doc.text(`Chargeable Half Days: ${slip.chargeable_half_days} days`);
        doc.moveDown();

        // Earnings Section
        doc.fontSize(12).text('EARNINGS', { underline: true });
        doc.fontSize(10);
        doc.text(`Basic Salary: ₹${slip.basic.toFixed(2)}`);
        doc.text(`HRA: ₹${slip.hra.toFixed(2)}`);
        
        if (slip.allowancesSum > 0) {
            Object.entries(slip.allowances).forEach(([key, value]) => {
                doc.text(`${key}: ₹${Number(value).toFixed(2)}`);
            });
        }
        doc.moveDown(0.5);

        // Leave Deduction Section
        if (slip.leave_deduction > 0) {
            doc.fontSize(12).text('LEAVE DEDUCTION', { underline: true });
            doc.fontSize(10);
            doc.text(`Per Day Salary: ₹${slip.per_day_salary.toFixed(2)}`);
            doc.text(`Chargeable Full Days: ${slip.chargeable_full_days} × ₹${slip.per_day_salary.toFixed(2)} = ₹${(slip.chargeable_full_days * slip.per_day_salary).toFixed(2)}`);
            doc.text(`Chargeable Half Days: ${slip.chargeable_half_days} × ₹${(slip.per_day_salary / 2).toFixed(2)} = ₹${(slip.chargeable_half_days * (slip.per_day_salary / 2)).toFixed(2)}`);
            doc.text(`Total Leave Deduction: ₹${slip.leave_deduction.toFixed(2)}`);
            doc.moveDown(0.5);
        }

        // Deductions Section
        doc.fontSize(12).text('STATUTORY DEDUCTIONS', { underline: true });
        doc.fontSize(10);
        doc.text(`PF (12%): ₹${slip.pf.toFixed(2)}`);
        doc.text(`ESI (Employee): ₹${slip.esi_employee.toFixed(2)}`);
        doc.text(`Professional Tax: ₹${slip.professional_tax.toFixed(2)}`);
        doc.text(`TDS: ₹${slip.tds.toFixed(2)}`);
        
        if (slip.otherSum > 0) {
            Object.entries(slip.other_deductions).forEach(([key, value]) => {
                doc.text(`${key}: ₹${Number(value).toFixed(2)}`);
            });
        }
        doc.moveDown(0.5);

        // Summary Section
        const totalStatutoryDeductions = slip.pf + slip.esi_employee + slip.professional_tax + slip.tds + slip.otherSum;
        const totalDeductions = totalStatutoryDeductions + Number(slip.leave_deduction);

        doc.fontSize(12).text('SUMMARY', { underline: true });
        doc.fontSize(10);
        doc.text(`Gross Salary: ₹${slip.gross_pay.toFixed(2)}`);
        doc.text(`Statutory Deductions: ₹${totalStatutoryDeductions.toFixed(2)}`);
        doc.text(`Leave Deductions: ₹${slip.leave_deduction.toFixed(2)}`);
        doc.text(`Total Deductions: ₹${totalDeductions.toFixed(2)}`);
        doc.moveDown(0.3);
        doc.fontSize(12).text(`NET PAY: ₹${slip.net_pay.toFixed(2)}`, { align: 'center' });
        
        doc.moveDown();
        doc.fontSize(8);
        doc.text('This is a computer-generated payslip and does not require signature.', {
            align: 'center',
            italics: true
        });

        // End the document
        doc.end();

    } catch (err) {
        console.error('Error generating PDF:', err);
        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                message: 'Failed to generate PDF',
                error: err.message
            });
        }
    }
});

// POST /generate-payslip/:userId/:year/:month - admin or self: generate payslip for specific user
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

// Add this function near the top of the file, after the imports and before the routes
async function generatePayslipForUser(identifier, year, month, opts = { savePdf: true }) {
    if (!identifier) {
        throw new Error('Identifier (email or UUID) is required');
    }

    const dbUserId = await resolveDbUserId(identifier);
    if (!dbUserId) {
        throw new Error(`User not found with identifier: ${identifier}`);
    }

    // Get salary config
    let cfg = null;
    try {
        const qc = await pool.query('SELECT * FROM payroll_records WHERE user_id::text=$1 LIMIT 1', [dbUserId]);
        cfg = qc.rows[0] || null;
    } catch (e) {
        console.warn('Could not fetch salary config:', e?.message);
    }

    // Use default config if not found - ADJUSTED FOR NET PAY OF 10000
    if (!cfg) {
        const ures = await pool.query('SELECT role FROM users WHERE id=$1 LIMIT 1', [dbUserId]);
        const role = (ures.rows[0]?.role || '').toString().toLowerCase();
        
        // Adjusted salaries to achieve net pay of ~10000 after deductions
        let basicSalary = 6000;  // Default
        let hraSalary = 2400;    // Default
        let otherAllowance = 1600;  // Default
        
        if (role === 'engineer') {
            basicSalary = 6000;  // 60% of gross
            hraSalary = 2400;    // 24% of gross
            otherAllowance = 1600;  // 16% of gross
            // Gross: 10000, Deductions: ~1000, Net: ~9000
        } else if (role === 'hr') {
            basicSalary = 7500;  // 60% of gross
            hraSalary = 3000;    // 24% of gross
            otherAllowance = 2000;  // 16% of gross
            // Gross: 12500, Deductions: ~1250, Net: ~11250
        } else if (role === 'admin') {
            basicSalary = 9000;  // 60% of gross
            hraSalary = 3600;    // 24% of gross
            otherAllowance = 2400;  // 16% of gross
            // Gross: 15000, Deductions: ~1500, Net: ~13500
        }
        
        const basic = Number(basicSalary.toFixed(2));
        const hra = Number(hraSalary.toFixed(2));
        const allowances = { other: Number(otherAllowance.toFixed(2)) };
        cfg = { user_id: dbUserId, basic, hra, allowances, deductions: {} };
    }

    // Compute payroll with updated logic
    const slip = await computePayrollFromConfig(cfg, { year: Number(year), month: Number(month) });

    // Get user details
    const userQuery = await pool.query('SELECT name, email FROM users WHERE id=$1', [dbUserId]);
    const userName = userQuery.rows[0]?.name || 'Employee';

    // Generate PDF if requested
    let savedPath = null;
    let fileName = null;

    if (opts.savePdf) {
        try {
            const uploadsBase = process.env.UPLOADS_DIR
                ? path.resolve(process.env.UPLOADS_DIR)
                : path.join(process.cwd(), 'storage', 'uploads');
            const destDir = path.join(uploadsBase, 'payslips', `${year}-${String(month).padStart(2, '0')}`);
            await fs.promises.mkdir(destDir, { recursive: true });
            fileName = `payslip_${dbUserId}_${year}_${month}.pdf`;
            const filePath = path.join(destDir, fileName);
            savedPath = filePath;

            const doc = new PDFDocument({ size: 'A4', margin: 40 });
            const writeStream = fs.createWriteStream(filePath);

            const streamFinished = new Promise((resolve, reject) => {
                writeStream.on('finish', resolve);
                writeStream.on('error', reject);
            });

            doc.pipe(writeStream);

            // PDF Header
            doc.fontSize(16).text('SALARY SLIP', { align: 'center' });
            doc.moveDown();
            doc.fontSize(10);
            doc.text(`Month: ${month}/${year}`, { align: 'left' });
            doc.text(`Employee ID: ${dbUserId}`);
            doc.text(`Employee Name: ${userName}`);
            doc.moveDown(0.5);

            // Attendance & Leave Section
            doc.fontSize(12).text('ATTENDANCE & LEAVE', { underline: true });
            doc.fontSize(10);
            doc.text(`Total Working Days (Calendar): ${slip.total_working_days} days`);
            doc.text(`Worked Days: ${slip.worked_days} days`);
            doc.text(`Leave - Full Days: ${slip.leave_full_days} days`);
            doc.text(`Leave - Half Days: ${slip.leave_half_days} days`);
            doc.text(`Free Full Day: 1 day`);
            doc.text(`Free Half Day: 1 day`);
            doc.text(`Chargeable Full Days: ${slip.chargeable_full_days} days`);
            doc.text(`Chargeable Half Days: ${slip.chargeable_half_days} days`);
            doc.moveDown();

            // Earnings Section
            doc.fontSize(12).text('EARNINGS', { underline: true });
            doc.fontSize(10);
            doc.text(`Basic Salary: ₹${slip.basic.toFixed(2)}`);
            doc.text(`HRA: ₹${slip.hra.toFixed(2)}`);
            
            if (slip.allowancesSum > 0) {
                Object.entries(slip.allowances).forEach(([key, value]) => {
                    doc.text(`${key}: ₹${Number(value).toFixed(2)}`);
                });
            }
            doc.moveDown(0.5);

            // Leave Deduction Section
            if (slip.leave_deduction > 0) {
                doc.fontSize(12).text('LEAVE DEDUCTION', { underline: true });
                doc.fontSize(10);
                doc.text(`Per Day Salary: ₹${slip.per_day_salary.toFixed(2)}`);
                doc.text(`Chargeable Full Days: ${slip.chargeable_full_days} × ₹${slip.per_day_salary.toFixed(2)} = ₹${(slip.chargeable_full_days * slip.per_day_salary).toFixed(2)}`);
                doc.text(`Chargeable Half Days: ${slip.chargeable_half_days} × ₹${(slip.per_day_salary / 2).toFixed(2)} = ₹${(slip.chargeable_half_days * (slip.per_day_salary / 2)).toFixed(2)}`);
                doc.text(`Total Leave Deduction: ₹${slip.leave_deduction.toFixed(2)}`);
                doc.moveDown(0.5);
            }

            // Statutory Deductions Section
            doc.fontSize(12).text('STATUTORY DEDUCTIONS', { underline: true });
            doc.fontSize(10);
            doc.text(`PF (12%): ₹${slip.pf.toFixed(2)}`);
            doc.text(`ESI (Employee): ₹${slip.esi_employee.toFixed(2)}`);
            doc.text(`Professional Tax: ₹${slip.professional_tax.toFixed(2)}`);
            doc.text(`TDS: ₹${slip.tds.toFixed(2)}`);
            
            if (slip.otherSum > 0) {
                Object.entries(slip.other_deductions).forEach(([key, value]) => {
                    doc.text(`${key}: ₹${Number(value).toFixed(2)}`);
                });
            }
            doc.moveDown(0.5);

            // Summary Section
            const totalStatutoryDeductions = slip.pf + slip.esi_employee + slip.professional_tax + slip.tds + slip.otherSum;
            const totalDeductions = totalStatutoryDeductions + Number(slip.leave_deduction);

            doc.fontSize(12).text('SUMMARY', { underline: true });
            doc.fontSize(10);
            doc.text(`Gross Salary: ₹${slip.gross_pay.toFixed(2)}`);
            doc.text(`Statutory Deductions: ₹${totalStatutoryDeductions.toFixed(2)}`);
            doc.text(`Leave Deductions: ₹${slip.leave_deduction.toFixed(2)}`);
            doc.text(`Total Deductions: ₹${totalDeductions.toFixed(2)}`);
            doc.moveDown(0.3);
            doc.fontSize(12).text(`NET PAY: ₹${slip.net_pay.toFixed(2)}`, { align: 'center' });
            
            doc.moveDown();
            doc.fontSize(8);
            doc.text('This is a computer-generated payslip and does not require signature.', {
                align: 'center',
                italics: true
            });

            doc.end();
            await streamFinished;

            // Save to database
            const existingRecord = await pool.query(`
                SELECT id FROM payroll_records
                WHERE user_id = $1 AND year = $2 AND month = $3
            `, [dbUserId, Number(year), Number(month)]);

            if (existingRecord.rows.length > 0) {
                await pool.query(`
                    UPDATE payroll_records 
                    SET 
                        basic = $4,
                        hra = $5,
                        allowances = $6::jsonb,
                        pf = $7,
                        esi_employee = $8,
                        professional_tax = $9,
                        tds = $10,
                        deductions = $11::jsonb,
                        gross = $12,
                        net_pay = $13,
                        leave_full_days = $14,
                        leave_half_days = $15,
                        chargeable_full_days = $16,
                        chargeable_half_days = $17,
                        leave_deduction = $18,
                        pdf_path = $19,
                        file_name = $20,
                        updated_at = NOW()
                    WHERE user_id = $1 
                    AND year = $2 
                    AND month = $3
                `, [
                    dbUserId, Number(year), Number(month),
                    slip.basic, slip.hra, JSON.stringify(slip.allowances),
                    slip.pf, slip.esi_employee, slip.professional_tax, slip.tds,
                    JSON.stringify(slip.other_deductions),
                    slip.gross_pay, slip.net_pay,
                    slip.leave_full_days, slip.leave_half_days,
                    slip.chargeable_full_days, slip.chargeable_half_days,
                    slip.leave_deduction,
                    savedPath, fileName
                ]);
            } else {
                await pool.query(`
                    INSERT INTO payroll_records (
                        user_id, year, month,
                        basic, hra, allowances, pf, esi_employee,
                        professional_tax, tds, deductions,
                        gross, net_pay,
                        leave_full_days, leave_half_days,
                        chargeable_full_days, chargeable_half_days,
                        leave_deduction,
                        pdf_path, file_name,
                        created_at, updated_at
                    )
                    VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11::jsonb, $12, $13, $14, $15, $16, $17, $18, $19, $20, NOW(), NOW())
                `, [
                    dbUserId, Number(year), Number(month),
                    slip.basic, slip.hra, JSON.stringify(slip.allowances),
                    slip.pf, slip.esi_employee, slip.professional_tax, slip.tds,
                    JSON.stringify(slip.other_deductions),
                    slip.gross_pay, slip.net_pay,
                    slip.leave_full_days, slip.leave_half_days,
                    slip.chargeable_full_days, slip.chargeable_half_days,
                    slip.leave_deduction,
                    savedPath, fileName
                ]);
            }

        } catch (e) {
            console.error('Failed to save PDF:', e);
            throw new Error(`Failed to generate PDF: ${e.message}`);
        }
    }

    return {
        ok: true,
        user_id: dbUserId,
        year: Number(year),
        month: Number(month),
        path: savedPath,
        fileName: fileName,
        slip: slip
    };
}


// Create payslips table if not exists
async function ensurePayslipsTable() {
    let client = null;
    try {
        client = await getConnection();
        await client.query(`
            CREATE TABLE IF NOT EXISTS payroll_records (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id),
                month INTEGER NOT NULL,
                year INTEGER NOT NULL,
                basic DECIMAL(10,2),
                allowances DECIMAL(10,2),
                deductions DECIMAL(10,2),
                net_salary DECIMAL(10,2),
                status VARCHAR(20) DEFAULT 'pending',
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, month, year)
            );
        `);
        console.log("✅ Ensured payslips table exists");
    } catch (err) {
        console.error("Failed to create payslips table:", err);
    } finally {
        if (client) client.release();
    }
}

// Ensure table exists on startup
ensurePayslipsTable();

// Get payslip details
router.get('/payslip-details', async (req, res) => {
    let client = null;
    try {
        client = await getConnection();
        const result = await client.query(`
            SELECT 
                p.id,
                p.month,
                p.year,
                p.basic,
                p.allowances,
                p.deductions,
                p.net_salary,
                p.status,
                p.created_at,
                u.name as employee_name,
                u.email as employee_email
            FROM payroll_records p
            JOIN users u ON p.user_id = u.id
            ORDER BY p.year DESC, p.month DESC, u.name ASC
        `);
        
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching payslip details:', err);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        if (client) client.release();
    }
});

// Add this route to serve PDF files
router.get('/pdf-file/:userId/:year/:month', async (req, res) => {
    try {
        const { userId, year, month } = req.params;
        
        // First get the file path
        const query = `
            SELECT pdf_path, file_name
            FROM payroll_records 
            WHERE user_id = $1 
            AND year = $2 
            AND month = $3
            ORDER BY created_at DESC 
            LIMIT 1
        `;
        
        const result = await pool.query(query, [userId, year, month]);
        
        if (!result.rows[0]?.pdf_path) {
            return res.status(404).json({
                success: false,
                message: 'PDF not found'
            });
        }

        const pdfPath = result.rows[0].pdf_path;

        // Check if file exists
        if (!fs.existsSync(pdfPath)) {
            return res.status(404).json({
                success: false,
                message: 'PDF file not found on server'
            });
        }

        // Set headers for PDF
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${result.rows[0].file_name || 'payslip.pdf'}"`);

        // Stream the file
        const fileStream = fs.createReadStream(pdfPath);
        fileStream.on('error', (error) => {
            console.error('Error streaming file:', error);
            // Only send error if headers haven't been sent
            if (!res.headersSent) {
                res.status(500).json({
                    success: false,
                    message: 'Error streaming file'
                });
            }
        });

        // Pipe the file stream to response
        fileStream.pipe(res);

    } catch (err) {
        console.error('Error serving PDF file:', err);
        // Only send error if headers haven't been sent
        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                message: 'Failed to serve PDF file',
                error: err.message
            });
        }
    }
});
router.get('/download/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(__dirname, 'storage', 'uploads', 'payslips', filename);

    // Security check to prevent directory traversal
    if (!filePath.startsWith(path.join(__dirname, 'storage', 'uploads', 'payslips'))) {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied' 
      });
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ 
        success: false, 
        message: 'File not found' 
      });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

  } catch (err) {
    console.error('Error serving payslip:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to serve payslip' 
    });
  }
});

// Add this new route handler
router.get('/get-path/:userId/:year/:month', requireAuth, async (req, res) => {
    try {
        const { userId, year, month } = req.params;

        const query = `
            SELECT pdf_path, file_name
            FROM payroll_records
            WHERE user_id = $1 
            AND year = $2 
            AND month = $3
            ORDER BY created_at DESC
            LIMIT 1
        `;

        const result = await pool.query(query, [userId, year, month]);

        if (!result.rows.length) {
            return res.status(404).json({
                success: false,
                message: 'Payslip not found'
            });
        }

        res.json({
            success: true,
            pdf_path: result.rows[0].pdf_path
        });

    } catch (err) {
        console.error('Error fetching payslip path:', err);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch payslip path'
        });
    }
});

// Fix applied here: Calculate deductions properly in viewSlip
async function viewSlip(user) {
    try {
        const headers = getRequesterHeaders();
        const yearMonthPath = `${year}/${month}`;

        // Step 1: Check if payslip exists
        let checkRes;
        try {
            checkRes = await axios.get(`/api/payroll/pdf-file/${user.id}/${yearMonthPath}`, { headers });
            console.log("Payslip metadata:", checkRes.data);
        } catch (checkErr) {
            const status = checkErr.response?.status;
            if (status === 404) {
                const confirmGenerate = window.confirm("Payslip not found. Would you like to generate it?");
                if (confirmGenerate) {
                    await generatePayslipForUser(user);
                    // Wait a bit longer for file creation
                    setTimeout(() => viewSlip(user), 3000);
                }
                return;
            }
            if (status === 401) {
                toast.error("Unauthorized — please log in again.");
                return;
            }
            throw checkErr;
        }

        // Step 2: Fetch slip data for calculations
        let slipData = null;
        try {
            const slipRes = await axios.get(`/api/payroll/slip/${user.id}/${year}/${month}`, { headers });
            slipData = slipRes.data;
            console.log("Slip data:", slipData);
        } catch (slipErr) {
            console.warn("Could not fetch slip data, using defaults from PDF");
        }

        // Step 3: Fetch PDF
        const pdfResponse = await axios.get(`/api/payroll/pdf/${user.id}/${yearMonthPath}`, {
            headers: { ...headers, Accept: 'application/pdf' },
            responseType: 'blob'
        });

        // Step 4: Create enhanced PDF with proper calculations
        const doc = new jsPDF();
        doc.setFontSize(12);
        doc.text(`Salary Slip - ${month}/${year}`, 14, 20);
        doc.text(`Employee: ${user.name} (${user.email})`, 14, 30);
        
        let y = 40;
        
        // Use fetched slip data if available, otherwise use default values
        const slip = slipData || {
            total_working_days: 0,
            worked_days: 0,
            leave_full_days: 0,
            leave_half_days: 0,
            chargeable_full_days: 0,
            chargeable_half_days: 0,
            basic: 0,
            hra: 0,
            allowancesSum: 0,
            gross_pay: 0,
            per_day_salary: 0,
            pf: 0,
            esi_employee: 0,
            professional_tax: 0,
            tds: 0,
            otherSum: 0,
            leave_deduction: 0,
            net_pay: 0
        };

        // Attendance & Leave Section
        doc.setFontSize(10);
        doc.text('ATTENDANCE & LEAVE:', 14, y);
        y += 6;
        doc.setFontSize(9);
        doc.text(`Total Working Days: ${slip.total_working_days || 0}`, 14, y);
        y += 5;
        doc.text(`Leave - Full Days: ${slip.leave_full_days || 0}`, 14, y);
        y += 5;
        doc.text(`Leave - Half Days: ${slip.leave_half_days || 0}`, 14, y);
        y += 5;
        doc.text(`Chargeable Full Days: ${slip.chargeable_full_days || 0}`, 14, y);
        y += 5;
        doc.text(`Chargeable Half Days: ${slip.chargeable_half_days || 0}`, 14, y);
        y += 8;

        // Earnings Section
        doc.setFontSize(10);
        doc.text('EARNINGS:', 14, y);
        y += 6;
        const earningData = [
            ['Basic', `₹${Number(slip.basic || 0).toFixed(2)}`],
            ['HRA', `₹${Number(slip.hra || 0).toFixed(2)}`],
            ['Allowances', `₹${Number(slip.allowancesSum || 0).toFixed(2)}`],
        ];
        doc.autoTable({ 
            startY: y, 
            head: [['Earning', 'Amount']], 
            body: earningData,
            theme: 'grid',
            headStyles: { fillColor: [220, 220, 220], textColor: [0, 0, 0] },
            columnStyles: { 0: { cellWidth: 100 }, 1: { cellWidth: 50, halign: 'right' } }
        });

        y = doc.lastAutoTable.finalY + 8;
        doc.setFontSize(10);
        doc.text(`Gross Salary: ₹${Number(slip.gross_pay || slip.gross || 0).toFixed(2)}`, 14, y);
        y += 8;

        // Leave Deduction Section
        if (Number(slip.leave_deduction || 0) > 0) {
            doc.setFontSize(10);
            doc.text('LEAVE DEDUCTION:', 14, y);
            y += 6;
            const leaveData = [
                [`Per Day Salary`, `₹${Number(slip.per_day_salary || 0).toFixed(2)}`],
                [`Chargeable Full (${Number(slip.chargeable_full_days || 0)} × ₹${Number(slip.per_day_salary || 0).toFixed(2)})`, `₹${(Number(slip.chargeable_full_days || 0) * Number(slip.per_day_salary || 0)).toFixed(2)}`],
                [`Chargeable Half (${Number(slip.chargeable_half_days || 0)} × ₹${(Number(slip.per_day_salary || 0) / 2).toFixed(2)})`, `₹${(Number(slip.chargeable_half_days || 0) * (Number(slip.per_day_salary || 0) / 2)).toFixed(2)}`],
            ];
            doc.autoTable({
                startY: y,
                head: [['Description', 'Amount']],
                body: leaveData,
                theme: 'grid',
                headStyles: { fillColor: [255, 200, 124], textColor: [0, 0, 0] },
                columnStyles: { 0: { cellWidth: 100 }, 1: { cellWidth: 50, halign: 'right' } }
            });
            y = doc.lastAutoTable.finalY + 8;
            doc.setFontSize(10);
            doc.text(`Total Leave Deduction: ₹${Number(slip.leave_deduction || 0).toFixed(2)}`, 14, y);
            y += 8;
        }

        // Deductions Section
        doc.setFontSize(10);
        doc.text('STATUTORY DEDUCTIONS:', 14, y);
        y += 6;
        const deductions = [
            ['PF (12%)', `₹${Number(slip.pf || 0).toFixed(2)}`],
            ['ESI (Employee)', `₹${Number(slip.esi_employee || 0).toFixed(2)}`],
            ['Professional Tax', `₹${Number(slip.professional_tax || 0).toFixed(2)}`],
            ['TDS', `₹${Number(slip.tds || 0).toFixed(2)}`],
        ];

        doc.autoTable({ 
            startY: y, 
            head: [['Deduction', 'Amount']], 
            body: deductions,
            theme: 'grid',
            headStyles: { fillColor: [220, 220, 220], textColor: [0, 0, 0] },
            columnStyles: { 0: { cellWidth: 100 }, 1: { cellWidth: 50, halign: 'right' } }
        });

        y = doc.lastAutoTable.finalY + 10;
        
        // Summary with proper calculations
        const pf = Number(slip.pf || 0);
        const esi = Number(slip.esi_employee || 0);
        const pt = Number(slip.professional_tax || 0);
        const tds = Number(slip.tds || 0);
        const otherDed = Number(slip.otherSum || 0);
        const leaveDed = Number(slip.leave_deduction || 0);
        
        const totalStatutoryDeductions = pf + esi + pt + tds + otherDed;
        const totalDeductions = totalStatutoryDeductions + leaveDed;
        const grossSalary = Number(slip.gross_pay || slip.gross || 0);
        const netPay = grossSalary - totalDeductions;
        
        doc.setFontSize(10);
        doc.text('SUMMARY:', 14, y);
        y += 6;
        doc.text(`Gross Salary: ₹${grossSalary.toFixed(2)}`, 14, y);
        y += 5;
        doc.text(`Statutory Deductions: ₹${totalStatutoryDeductions.toFixed(2)}`, 14, y);
        y += 5;
        doc.text(`Leave Deductions: ₹${leaveDed.toFixed(2)}`, 14, y);
        y += 5;
        doc.text(`Total Deductions: ₹${totalDeductions.toFixed(2)}`, 14, y);
        y += 8;
        
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text(`NET PAY: ₹${netPay.toFixed(2)}`, 14, y);
        
        doc.setFont(undefined, 'normal');
        doc.setFontSize(8);
        doc.text('This is a computer-generated payslip and does not require signature.', 14, doc.internal.pageSize.height - 10, { align: 'left' });

        // Display PDF
        const blob = new Blob([pdfResponse.data], { type: 'application/pdf' });
        const blobUrl = window.URL.createObjectURL(blob);
        setPdfUrl(blobUrl);
        setShowPdfModal(true);
        toast.success(`Opened payslip for ${user.name}`);

    } catch (err) {
        console.error("ViewSlip Error:", err);
        const status = err.response?.status;

        if (status === 401) {
            toast.error("Session expired or invalid token. Please log in again.");
        } else if (status === 404) {
            toast.warn("Payslip not found. Generate it first.");
        } else {
            toast.error("Error viewing payslip: " + (err.message || "Unknown error"));
        }
    }
}

// GET /slip/:userId/:year/:month - fetch saved slip data from database
router.get('/slip/:userId/:year/:month', async (req, res) => {
  try {
    const { userId, year, month } = req.params;
    const requester = req.header('x-user-id') || req.query.requesterId || null;

    const rr = await pool.query('SELECT role FROM users WHERE id::text=$1 OR email=$1 LIMIT 1', [String(requester || '')]);
    const requesterRole = (rr.rows[0]?.role || '').toString().toLowerCase();
    const tr = await pool.query('SELECT role FROM users WHERE id::text=$1 OR email=$1 LIMIT 1', [String(userId || '')]);
    const targetRole = (tr.rows[0]?.role || '').toString().toLowerCase();
    const isSelf = String(requester) === String(userId);
    
    if (requesterRole !== 'admin' && !(requesterRole === 'hr' && targetRole !== 'admin') && !isSelf) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const dbUserId = await resolveDbUserId(userId);
    if (!dbUserId) return res.status(404).json({ error: 'user not found' });

    // Fetch saved payroll record from database
    const result = await pool.query(`
      SELECT 
        user_id, year, month,
        basic, hra, allowances, pf, esi_employee,
        professional_tax, tds, deductions,
        gross, net_pay,
        leave_full_days, leave_half_days,
        chargeable_full_days, chargeable_half_days,
        leave_deduction, per_day_salary,
        pdf_path, file_name
      FROM payroll_records
      WHERE user_id::text = $1 
      AND year = $2 
      AND month = $3
      LIMIT 1
    `, [dbUserId, Number(year), Number(month)]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Payslip not found' });
    }

    const record = result.rows[0];
    const slip = {
      basic: Number(record.basic || 0),
      hra: Number(record.hra || 0),
      allowances: record.allowances || {},
      allowancesSum: Object.values(record.allowances || {}).reduce((s, v) => s + Number(v || 0), 0),
      pf: Number(record.pf || 0),
      esi_employee: Number(record.esi_employee || 0),
      professional_tax: Number(record.professional_tax || 0),
      tds: Number(record.tds || 0),
      other_deductions: record.deductions || {},
      otherSum: Object.values(record.deductions || {}).reduce((s, v) => s + Number(v || 0), 0),
      gross_pay: Number(record.gross || 0),
      net_pay: Number(record.net_pay || 0),
      leave_full_days: Number(record.leave_full_days || 0),
      leave_half_days: Number(record.leave_half_days || 0),
      chargeable_full_days: Number(record.chargeable_full_days || 0),
      chargeable_half_days: Number(record.chargeable_half_days || 0),
      leave_deduction: Number(record.leave_deduction || 0),
      per_day_salary: Number(record.per_day_salary || 0),
      total_working_days: 30, // Assuming 30 days per month
      worked_days: 0 // Would need to calculate from attendance
    };

    return res.json({
      success: true,
      slip: slip
    });

  } catch (err) {
    console.error('Error fetching slip:', err);
    return res.status(500).json({
      error: 'Failed to fetch payslip',
      message: err.message
    });
  }
});

export default router;