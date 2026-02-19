import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Compute repository root (directory above backend/) so uploads path is stable
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

// Use UPLOADS_DIR env var when provided, otherwise default to <repo_root>/storage/uploads
const UPLOADS_BASE = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(REPO_ROOT, 'storage', 'uploads');
// ensure directory exists
try { fs.mkdirSync(UPLOADS_BASE, { recursive: true }); } catch (e) { /* ignore */ }
import dotenv from "dotenv";
import { ensureDbConnection } from './db.js';

// We'll dynamically import route modules after DB is confirmed to avoid many
// parallel startup queries that can exhaust the DB connection pool.
let authRoutes, usersRoutes, documentsRoutes, attendanceRoutes, leaveRoutes, shiftsRoute, overtimeRoute, stockRoute, payrollRoute, liveLocationsRoute, serviceCallsRoute, taskRoute, attendanceCorrectionRoute;


dotenv.config();
const app = express();

// Enable CORS with allowed origins
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://hrms.sandjglobaltech.com',
  'https://hrms.sandjglobaltech.com'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id', 'x-token'],
  optionsSuccessStatus: 200
}));

// Parse JSON bodies
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve uploaded files (documents, user files) from UPLOADS_BASE (defaults to <repo>/storage/uploads)
// Client requests to /uploads/... will be served by Express, not the React router.
app.use('/uploads', express.static(UPLOADS_BASE));

// Add static middleware for payslips
app.use('/payslips', express.static(path.join(__dirname, 'storage', 'uploads', 'payslips')));

// Quiet startup: suppress noisy console logs from startup helpers and routes.
// By default we show only the two lines the user asked for. Set SHOW_STARTUP_LOGS=true
// in the environment to see all logs again.
const _origLog = console.log.bind(console);
const _origInfo = console.info ? console.info.bind(console) : _origLog;
const _origWarn = console.warn ? console.warn.bind(console) : _origLog;
const SHOW_STARTUP_LOGS = true; // FORCE TRUE FOR DEBUGGING

function _shouldAllowStartupMessage(args) {
  return true; // ALLOW ALL LOGS
}

console.log = (...args) => {
  _origLog(...args);
};
console.info = (...args) => {
  _origInfo(...args);
};
console.warn = (...args) => {
  _origWarn(...args);
};

async function startServer() {
  // ensure DB connection first
  await ensureDbConnection();

  // now dynamically import route modules so their startup helpers run serially
  authRoutes = (await import('./authRoutes.js')).default;
  usersRoutes = (await import('./usersRoute.js')).default;
  documentsRoutes = (await import('./documentsRoute.js')).default;
  attendanceRoutes = (await import('./attendanceRoute.js')).default;
  leaveRoutes = (await import('./leaveRoute.js')).default;
  shiftsRoute = (await import('./shiftsRoute.js')).default;
  overtimeRoute = (await import('./overtimeRoute.js')).default;
  stockRoute = (await import('./stockRoute.js')).default;
  payrollRoute = (await import('./payrollRoute.js')).default;
  liveLocationsRoute = (await import('./liveLocationsRoute.js')).default;
  serviceCallsRoute = (await import('./serviceCallsRoute.js')).default;
  taskRoute = (await import('./taskRoute.js')).default;
  attendanceCorrectionRoute = (await import('./attendanceCorrectionRoute.js')).default;
  const societyMasterRoute = (await import('./societyMasterRoute.js')).default;


  // mount task routes

  // start assignment listener which listens to Postgres NOTIFY events
  // The listener sends SMS/FCM notifications when a service_call is assigned
  try {
    const { default: startAssignmentListener } = await import('./assignmentListener.js');
    startAssignmentListener().catch((e) => console.warn('assignmentListener failed to start:', e?.message || e));
  } catch (e) {
    console.warn('Could not import assignmentListener:', e?.message || e);
  }

  // mount routes
  app.use('/api/auth', authRoutes);
  app.use('/api/users', usersRoutes);
  app.use('/api/documents', documentsRoutes);
  app.use('/api/attendance', attendanceRoutes);
  app.use('/api/leave', leaveRoutes);
  app.use('/api/shifts', shiftsRoute);
  app.use('/api/overtime', overtimeRoute);
  app.use('/api/stock', stockRoute);
  app.use('/api/payroll', payrollRoute);
  app.use('/api/live_locations', liveLocationsRoute);
  app.use('/api/service-calls', serviceCallsRoute);
  app.use('/api/tasks', taskRoute);
  app.use('/api/corrections', attendanceCorrectionRoute);
  app.use('/api/society-master', societyMasterRoute);


  // --- Payroll scheduler: daily check, run on configured day of month ---
  const PAYROLL_RUN_DAY = Number(process.env.PAYROLL_RUN_DAY || 1); // day of month to run (1-28/29/30/31)
  const PAYROLL_RUN_HOUR = Number(process.env.PAYROLL_RUN_HOUR || 0); // hour (0-23)
  const PAYROLL_RUN_MIN = Number(process.env.PAYROLL_RUN_MIN || 5); // minute
  let _lastPayrollKey = null;

  async function maybeRunPayrollScheduler() {
    try {
      const now = new Date();
      if (now.getDate() !== PAYROLL_RUN_DAY) return;
      if (now.getHours() !== PAYROLL_RUN_HOUR) return;
      if (now.getMinutes() < PAYROLL_RUN_MIN) return; // allow minute threshold
      const key = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
      if (_lastPayrollKey === key) return; // already ran today
      // import the generator and run
      try {
        const mod = await import('./payrollRoute.js');
        if (typeof mod.generatePayslipsForAll === 'function') {
          console.log(`Running payroll generator for ${now.getFullYear()}-${now.getMonth() + 1}`);
          const res = await mod.generatePayslipsForAll(now.getFullYear(), now.getMonth() + 1, { savePdf: true });
          console.log('Payroll run result:', res);
        } else {
          console.warn('Payroll generator not available');
        }
      } catch (e) {
        console.error('Payroll scheduler error:', e?.message || e);
      }
      _lastPayrollKey = key;
    } catch (e) {
      console.error('Payroll scheduler unexpected error:', e?.message || e);
    }
  }

  // run once at startup (if matches day/hour/min) and then every minute
  maybeRunPayrollScheduler().catch(() => { });
  setInterval(maybeRunPayrollScheduler, 60 * 1000);
  // --- end payroll scheduler ---

  app.listen(process.env.PORT || 5001, () => console.log(`✅ Server running on port ${process.env.PORT || 5001}`));
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});