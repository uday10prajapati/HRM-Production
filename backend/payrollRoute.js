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
const OVERTIME_MULTIPLIER = Number(process.env.OVERTIME_MULTIPLIER || 1.5);
const LEAVE_DEDUCTION_AMOUNT = 572.76;

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

  // Add leave deduction calculation
  const DAILY_SALARY_DEDUCTION = 576.96;
  let leaveDeductionAmount = 0;
  let totalLeaveDays = 0;

  // Get current month's start and end dates
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1; // JavaScript months are 0-based
  const currentYear = currentDate.getFullYear();

  // Calculate leaves for current month only
  const leaveQuery = `
      SELECT COUNT(*) as total_leave_days
      FROM (
          SELECT generate_series(
              start_date::date,
              LEAST(
                  end_date::date,
                  (date_trunc('month', CURRENT_DATE) + interval '1 month - 1 day')::date
              ),
              '1 day'::interval
          )::date as leave_date
          FROM leaves 
          WHERE user_id = $1 
          AND status = 'approved'
          AND EXTRACT(MONTH FROM start_date) = $2
          AND EXTRACT(YEAR FROM start_date) = $3
          AND start_date <= CURRENT_DATE
      ) as leave_dates
      WHERE leave_date <= CURRENT_DATE`;

  try {
      const leaveResult = await pool.query(leaveQuery, [
          userId, 
          currentMonth,
          currentYear
      ]);

      totalLeaveDays = parseInt(leaveResult.rows[0]?.total_leave_days || 0);
      leaveDeductionAmount = totalLeaveDays * DAILY_SALARY_DEDUCTION;

      console.log(`Leave calculation for ${currentMonth}/${currentYear}:`, {
          totalLeaveDays,
          leaveDeductionAmount
      });

  } catch (err) {
      console.error('Error calculating leave deductions:', err);
      throw err;
  }

  // Calculate final net pay with current month's leave deductions
  const finalNetPay = Number((proratedGross - (
      pf + 
      esi_employee + 
      professional_tax + 
      tds + 
      otherSum + 
      leaveDeductionAmount
  )).toFixed(2));

  return {
    basic,
    per_day_salary: perDaySalary,
    total_working_days: totalWorkingDays,
    worked_days: workedDays,
    leave_days: totalLeaveDays,
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
    net_pay: finalNetPay,
    gross_pay: proratedGross,
    leave_deduction: Number(leaveDeductionAmount.toFixed(2)),
    month: currentMonth,
    year: currentYear
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

    // Add initial logging
  
    // Get approved leaves count with proper date filtering
    const leaveQuery = `
      SELECT COUNT(*) as approved_leaves 
      FROM leaves 
      WHERE user_id = $1 
      AND status = 'approved'  
      AND EXTRACT(MONTH FROM start_date) = $2
      AND EXTRACT(YEAR FROM start_date) = $3`;

    // Log the query and parameters
    console.log('Leave Query:', {
      query: leaveQuery,
      parameters: [dbUserId, Number(month), Number(year)]
    });

    const leaveResult = await pool.query(leaveQuery, [
      dbUserId, 
      Number(month),
      Number(year)
    ]);

    // Log raw leave result
    console.log('Leave Query Result:', {
      rawResult: leaveResult.rows[0],
      approved_leaves: leaveResult.rows[0]?.approved_leaves
    });

    const approvedLeaves = parseInt(leaveResult.rows[0]?.approved_leaves || 0);
    const totalLeaveDeduction = approvedLeaves * LEAVE_DEDUCTION_AMOUNT;

    // Log calculated values
    console.log('Leave Calculations:', {
      approvedLeaves,
      LEAVE_DEDUCTION_AMOUNT,
      totalLeaveDeduction
    });

    // Get payroll record with logging
    console.log('Fetching payroll record...');
    const payrollRecord = await pool.query(`
      SELECT pr.*, u.name as employee_name
      FROM payroll_records pr
      JOIN users u ON u.id = pr.user_id
      WHERE pr.user_id = $1 AND pr.year = $2 AND pr.month = $3
    `, [dbUserId, Number(year), Number(month)]);

    // Log payroll record result
    console.log('Payroll Record Result:', {
      found: payrollRecord.rows.length > 0,
      record: payrollRecord.rows[0]
    });

    const slip = payrollRecord.rows[0] || {
      basic: 0,
      hra: 0,
      allowancesSum: 0,
      overtime_pay: 0,
      pf: 0,
      esi_employee: 0,
      professional_tax: 0,
      tds: 0,
      leave_days: approvedLeaves,
      leave_deduction: totalLeaveDeduction,
      gross: 0,
      net_pay: 0,
      employee_name: 'Not Found'
    };

    // Log final slip data
    console.log('Final Slip Data:', {
      leave_days: slip.leave_days,
      leave_deduction: slip.leave_deduction,
      net_pay_before: slip.net_pay
    });

    // Adjust net pay for leave deductions
    slip.net_pay = Number(slip.net_pay || 0) - totalLeaveDeduction;

    console.log('Final Net Pay:', {
      net_pay_after: slip.net_pay,
      deduction_applied: totalLeaveDeduction
    });

    // Generate PDF with updated leave information
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="payslip_${dbUserId}_${year}_${month}.pdf"`);
    doc.pipe(res);

    // PDF Header
    doc.fontSize(16).text('Salary Slip', { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).text(`Month: ${month}/${year}`);
    doc.text(`Employee ID: ${dbUserId}`);
    doc.text(`Employee Name: ${slip.employee_name}`);
    doc.moveDown(0.5);

    // Attendance & Leave Section
    doc.fontSize(12).text('Attendance & Leave', { underline: true });
    doc.fontSize(10);
    doc.text(`Total Approved Leaves: ${approvedLeaves} days`);
    doc.text(`Leave Deduction Rate: ₹${LEAVE_DEDUCTION_AMOUNT} per day`);
    doc.text(`Total Leave Deduction: ₹${totalLeaveDeduction.toFixed(2)}`);
    doc.moveDown();

    // Earnings Section
    doc.fontSize(12).text('Earnings', { underline: true });
    doc.fontSize(10);
    doc.text(`Basic: ₹${Number(slip.basic).toFixed(2)}`);
    doc.text(`HRA: ₹${Number(slip.hra).toFixed(2)}`);
    
    // Display Allowances if present
    if (slip.allowances) {
        const allowances = typeof slip.allowances === 'string' 
            ? JSON.parse(slip.allowances) 
            : slip.allowances;
        Object.entries(allowances).forEach(([key, value]) => {
            doc.text(`${key}: ₹${Number(value).toFixed(2)}`);
        });
    }
    doc.text(`Overtime Pay: ₹${Number(slip.overtime_pay || 0).toFixed(2)}`);
    doc.moveDown(0.5);

    // Deductions Section
    doc.fontSize(12).text('Deductions', { underline: true });
    doc.fontSize(10);
    doc.text(`PF: ₹${Number(slip.pf).toFixed(2)}`);
    doc.text(`ESI (Employee): ₹${Number(slip.esi_employee).toFixed(2)}`);
    doc.text(`Professional Tax: ₹${Number(slip.professional_tax).toFixed(2)}`);
    doc.text(`TDS: ₹${Number(slip.tds).toFixed(2)}`);
    doc.text(`Leave Deduction: ₹${totalLeaveDeduction.toFixed(2)}`);
    doc.moveDown(0.5);

    // Calculate total deductions including leave deductions
    const totalDeductions = Number(slip.pf || 0) +
        Number(slip.esi_employee || 0) +
        Number(slip.professional_tax || 0) +
        Number(slip.tds || 0) +
        totalLeaveDeduction;

    // Display total deductions
    doc.moveDown(0.5);
    doc.fontSize(12).text('Total Deductions', { underline: true });
    doc.fontSize(10);
    doc.text(`Statutory Deductions: ₹${(Number(slip.pf || 0) + 
        Number(slip.esi_employee || 0) + 
        Number(slip.professional_tax || 0) + 
        Number(slip.tds || 0)).toFixed(2)}`);
    doc.text(`Leave Deductions: ₹${totalLeaveDeduction.toFixed(2)}`);
    doc.text(`Total Deductions: ₹${totalDeductions.toFixed(2)}`);
    doc.moveDown(0.5);

    // Summary Section
    doc.fontSize(12).text('Summary', { underline: true });
    doc.fontSize(10);
    doc.text(`Gross Salary: ₹${Number(slip.gross).toFixed(2)}`);
    doc.text(`Total Deductions: ₹${totalDeductions.toFixed(2)}`);
    doc.text(`Net Payable: ₹${(Number(slip.gross) - totalDeductions).toFixed(2)}`);

    // Footer
    doc.moveDown();
    doc.fontSize(8);
    doc.text('This is a computer generated payslip and does not require signature.', {
        align: 'center',
        italics: true
    });

    doc.end();
    
    await new Promise((resolve, reject) => {
        ws.on('finish', resolve);
        ws.on('error', reject);
    });
    savedPath = filePath;

        } catch (e) {
            console.error('Failed to save PDF:', e?.message || e);
            throw e;
        }
    

    return { 
        ok: true, 
        user_id: dbUserId, 
        year: Number(year), 
        month: Number(month), 
        path: savedPath,
        slip
    };

})

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

// Add this function near the top of the file, after the imports and before the routes
async function generatePayslipForUser(identifier, year, month, opts = { savePdf: true }) {
    if (!identifier) {
        throw new Error('Identifier (email or UUID) is required');
    }

    const dbUserId = await resolveDbUserId(identifier);
    if (!dbUserId) {
        throw new Error(`User not found with identifier: ${identifier}`);
    }

    // Get approved leaves count with proper date filtering
    const leaveQuery = `
        SELECT COUNT(*) as approved_leaves 
        FROM leaves 
        WHERE user_id = $1 
        AND status = 'approved'  
        AND EXTRACT(MONTH FROM start_date) = $2
        AND EXTRACT(YEAR FROM start_date) = $3`;

    const leaveResult = await pool.query(leaveQuery, [
        dbUserId, 
        Number(month),
        Number(year)
    ]);

    const approvedLeaves = parseInt(leaveResult.rows[0]?.approved_leaves || 0);
    const totalLeaveDeduction = approvedLeaves * LEAVE_DEDUCTION_AMOUNT;

    // Get payroll record
    const payrollRecord = await pool.query(`
        SELECT 
            pr.*,
            u.name as employee_name,
            u.email as employee_email
        FROM payroll_records pr
        JOIN users u ON u.id = pr.user_id
        WHERE pr.user_id = $1 AND pr.year = $2 AND pr.month = $3
    `, [dbUserId, Number(year), Number(month)]);

    // Use actual record or create default
    const slip = payrollRecord.rows[0] || {
        basic: 0,
        hra: 0,
        allowances: {},
        deductions: {},
        overtime_pay: 0,
        pf: 0,
        esi_employee: 0,
        professional_tax: 0,
        tds: 0,
        leave_days: approvedLeaves,
        leave_deduction: totalLeaveDeduction,
        gross: 0,
        net_pay: 0
    };

    // Adjust net pay for leave deductions
    slip.net_pay = Number(slip.net_pay || 0) - totalLeaveDeduction;

    // Generate PDF if requested
    let savedPath = null;
    if (opts.savePdf) {
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
            doc.fontSize(20).text('Company Name', { align: 'center' });
            doc.moveDown(0.5);
            doc.fontSize(16).text('Salary Slip', { align: 'center' });
            doc.moveDown();

            // Employee Details
            doc.fontSize(10);
            doc.text(`Month: ${month}/${year}`);
            doc.text(`Employee ID: ${dbUserId}`);
            doc.text(`Employee Name: ${slip.employee_name}`);
            doc.moveDown();

            // Leave Details
            doc.fontSize(12).text('Leave Details', { underline: true });
            doc.fontSize(10);
            doc.text(`Approved Leaves: ${approvedLeaves} days`);
            doc.text(`Leave Deduction Rate: ₹${LEAVE_DEDUCTION_AMOUNT} per day`);
            doc.text(`Total Leave Deduction: ₹${totalLeaveDeduction.toFixed(2)}`);
            doc.moveDown();

            // Earnings Section
            doc.fontSize(12).text('Earnings', { underline: true });
            doc.fontSize(10);
            doc.text(`Basic: ₹${Number(slip.basic).toFixed(2)}`);
            doc.text(`HRA: ₹${Number(slip.hra).toFixed(2)}`);
            
            // Display Allowances if present
            if (slip.allowances) {
                const allowances = typeof slip.allowances === 'string' 
                    ? JSON.parse(slip.allowances) 
                    : slip.allowances;
                Object.entries(allowances).forEach(([key, value]) => {
                    doc.text(`${key}: ₹${Number(value).toFixed(2)}`);
                });
            }
            doc.text(`Overtime Pay: ₹${Number(slip.overtime_pay || 0).toFixed(2)}`);
            doc.moveDown(0.5);

            // Deductions Section
            doc.fontSize(12).text('Deductions', { underline: true });
            doc.fontSize(10);
            doc.text(`PF: ₹${Number(slip.pf).toFixed(2)}`);
            doc.text(`ESI (Employee): ₹${Number(slip.esi_employee).toFixed(2)}`);
            doc.text(`Professional Tax: ₹${Number(slip.professional_tax).toFixed(2)}`);
            doc.text(`TDS: ₹${Number(slip.tds).toFixed(2)}`);
            doc.text(`Leave Deduction: ₹${totalLeaveDeduction.toFixed(2)}`);
            doc.moveDown(0.5);

            // Calculate total deductions including leave deductions
            const totalDeductions = Number(slip.pf || 0) +
                Number(slip.esi_employee || 0) +
                Number(slip.professional_tax || 0) +
                Number(slip.tds || 0) +
                totalLeaveDeduction;

            // Display total deductions
            doc.moveDown(0.5);
            doc.fontSize(12).text('Total Deductions', { underline: true });
            doc.fontSize(10);
            doc.text(`Statutory Deductions: ₹${(Number(slip.pf || 0) + 
                Number(slip.esi_employee || 0) + 
                Number(slip.professional_tax || 0) + 
                Number(slip.tds || 0)).toFixed(2)}`);
            doc.text(`Leave Deductions: ₹${totalLeaveDeduction.toFixed(2)}`);
            doc.text(`Total Deductions: ₹${totalDeductions.toFixed(2)}`);
            doc.moveDown(0.5);

            // Summary Section
            doc.fontSize(12).text('Summary', { underline: true });
            doc.fontSize(10);
            doc.text(`Gross Salary: ₹${Number(slip.gross).toFixed(2)}`);
            doc.text(`Total Deductions: ₹${totalDeductions.toFixed(2)}`);
            doc.text(`Net Payable: ₹${(Number(slip.gross) - totalDeductions).toFixed(2)}`);

            // Footer
            doc.moveDown();
            doc.fontSize(8);
            doc.text('This is a computer generated payslip and does not require signature.', {
                align: 'center',
                italics: true
            });

            doc.end();
            
            await new Promise((resolve, reject) => {
                ws.on('finish', resolve);
                ws.on('error', reject);
            });
            savedPath = filePath;

            // Update payroll_records with the PDF path
            await pool.query(`
                UPDATE payroll_records 
                SET pdf_path = $1, 
                    file_name = $2,
                    leave_days = $3,
                    leave_deduction = $4
                WHERE user_id = $5 
                AND year = $6 
                AND month = $7
            `, [
                savedPath,
                fileName,
                approvedLeaves,
                totalLeaveDeduction,
                dbUserId,
                Number(year),
                Number(month)
            ]);

            console.log('Updated payroll record with PDF path:', {
                userId: dbUserId,
                year,
                month,
                path: savedPath,
                fileName
            });

        } catch (e) {
            console.error('Failed to save PDF:', e);
            throw e;
        }
    }

    return {
        ok: true,
        user_id: dbUserId,
        year: Number(year),
        month: Number(month),
        path: savedPath,
        slip: {
            ...slip,
            leave_days: approvedLeaves,
            leave_deduction: totalLeaveDeduction
        }
    };
}

// Create payslips table if not exists
async function ensurePayslipsTable() {
    let client = null;
    try {
        client = await getConnection();
        await client.query(`
            CREATE TABLE IF NOT EXISTS payslips (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id),
                month INTEGER NOT NULL,
                year INTEGER NOT NULL,
                basic_salary DECIMAL(10,2),
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
                p.basic_salary,
                p.allowances,
                p.deductions,
                p.net_salary,
                p.status,
                p.created_at,
                u.name as employee_name,
                u.email as employee_email
            FROM payslips p
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
router.get('/pdf-file/:userId/:year/:month',  async (req, res) => {
    try {
        const { userId, year, month } = req.params;
        
        // First get the file path
        const query = `
            SELECT pdf_path
            FROM payslips 
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
        res.setHeader('Content-Disposition', 'inline; filename=payslip.pdf');

        // Stream the file
        const fileStream = fs.createReadStream(pdfPath);
        fileStream.pipe(res);

    } catch (err) {
        console.error('Error serving PDF file:', err);
        res.status(500).json({
            success: false,
            message: 'Failed to serve PDF file'
        });
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
            SELECT pdf_path
            FROM payslips
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

export default router;