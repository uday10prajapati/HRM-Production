import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";
import Login from "./pages/LogIn";
import ELogin from "./engineer/ELogin";
import EDashboard from "./engineer/EDashboard";
import EProfile from "./engineer/EProfile";
import EAttandance from "./engineer/EAttandance";
import EAttandanceReport from "./engineer/EAttandanceReport";
import ETaReport from "./engineer/ETaReport";
import EStock from "./engineer/EStock";
import ELeave from "./engineer/ELeave";
import EAssignCall from "./engineer/EAssignCall";
import EForgetPassword from "./engineer/EForgetPassword";
import Admin from "./pages/Admin/AdminDashboard";
import HrDashboard from "./pages/HR/HrDashboard"
import AttendancePage from "./pages/Attendance";
import Profile from "./pages/Profile";
import ApplyLeave from "./pages/ApplyLeave";
import Payslips from "./pages/Payslips";
import Documents from "./pages/Documents";
import PayrollAdmin from "./pages/payroll/Payroll";
import ProtectedRoute from "./components/ProtectedRoute";
import LeaveManagement from "./pages/LeaveManagement";
import AllUsers from "./pages/AllUsers"
import Stock from "./pages/Inovetry/Stock";
import PayrollReports from "./pages/reports/PayrollReports";
import MapView from "./pages/MapView";
import AssignCalls from "./pages/AssignCalls";
import EngineerTasks from "./pages/EngineerTasks";
import AssignedCalls from './pages/AssignCalls';
import PendingTasks from './pages/PendingTasks';
import AttendanceCorrectionPage from "./pages/AttReport";
import LiveTracker from "./components/LiveTracker";
import TAApproval from "./pages/TAApproval";
import { resumeLocationTrackingIfNeeded } from "./services/backgroundLocationService";
import 'leaflet/dist/leaflet.css';

/**
 * Pre-initialize background geolocation plugin on app startup
 * NOTE: Plugin is loaded lazily during location tracking, not at app startup
 * This avoids build-time module resolution issues with native-only plugins
 */
async function preInitializeBackgroundGeolocation() {
    if (!Capacitor.isNativePlatform()) {
        console.log('[init] Not a native platform, skipping background geolocation init');
        return;
    }

    try {
        console.log('[init] 🔧 Background geolocation plugin will be loaded on demand during location tracking...');
        
        // Plugin is now loaded lazily in backgroundLocationService when punch-in occurs
        // This avoids Vite build-time module resolution issues
        if (false) {
            console.warn('[init] ⚠️ BackgroundGeolocation not found in module');
            return;
        }

        console.log('[init] ✅ Background geolocation plugin loaded and ready');
        
        // Don't start it here - just ensure it's loaded
        // It will be configured and started on punch in
    } catch (error) {
        console.error('[init] ❌ Error pre-initializing background geolocation:', error);
    }
}

function App() {
  React.useEffect(() => {
    // Initialize app and request permissions
    const initializeApp = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          console.log('[APP] 🚀 Initializing app on native platform...');
          
          // Pre-initialize background geolocation first
          await preInitializeBackgroundGeolocation();
          
          // Request location permissions on app startup
          console.log('[APP] 🔐 Requesting initial location permissions on app startup...');
          const permResult = await Geolocation.requestPermissions({
            permissions: ['coarseLocation', 'fineLocation']
          });
          console.log('[APP] 📍 Initial permission result:', permResult);

          // Auto-resume background location tracking
          console.log('[APP] 📍 Attempting to resume background location tracking if needed...');
          resumeLocationTrackingIfNeeded().catch(err => console.error('[APP] Failed to resume location tracking:', err));
          
          console.log('[APP] ✅ App initialization complete');
        } catch (error) {
          console.error('[APP] ❌ App initialization error:', error);
        }
      }
    };

    initializeApp();
  }, []);
  return (
    <Router>
      {Capacitor.isNativePlatform() && <LiveTracker />}
      <Routes>
        <Route path="/" element={Capacitor.isNativePlatform() ? <ELogin /> : <Login />} />
        <Route path="/login" element={Capacitor.isNativePlatform() ? <ELogin /> : <Login />} />
        {/* Signup route removed - signup disabled */}
        <Route path="/all-users" element={<AllUsers />} />

        {/* Admin Routes */}
        <Route path="/admin-dashboard" element={<ProtectedRoute role="admin"><Admin /></ProtectedRoute>} />

        {/* Hr Routes */}
        <Route path="/hr-dashboard" element={<ProtectedRoute role="hr"><HrDashboard /></ProtectedRoute>} />

        {/* Engineer/App Routes: removed web portal access — only valid via Capacitor Native Mobile UI */}
        <Route path="/engineer-dashboard" element={Capacitor.isNativePlatform() ? <EDashboard /> : <Navigate to="/" />} />
        <Route path="/engineer-profile" element={Capacitor.isNativePlatform() ? <EProfile /> : <Navigate to="/" />} />
        <Route path="/engineer-attendance" element={Capacitor.isNativePlatform() ? <EAttandance /> : <Navigate to="/" />} />
        <Route path="/engineer-attendance-report" element={Capacitor.isNativePlatform() ? <EAttandanceReport /> : <Navigate to="/" />} />
        <Route path="/engineer-ta-report" element={Capacitor.isNativePlatform() ? <ETaReport /> : <Navigate to="/" />} />
        <Route path="/engineer-stock" element={Capacitor.isNativePlatform() ? <EStock /> : <Navigate to="/" />} />
        <Route path="/engineer-leave" element={Capacitor.isNativePlatform() ? <ELeave /> : <Navigate to="/" />} />
        <Route path="/engineer-assign-call" element={Capacitor.isNativePlatform() ? <EAssignCall /> : <Navigate to="/" />} />
        <Route path="/engineer-forgot-password" element={Capacitor.isNativePlatform() ? <EForgetPassword /> : <Navigate to="/" />} />

        {/* Employee Routes: restrict access to admin/hr only (portal no longer accessible to employee/engineer) */}
        <Route path="/attendance" element={<ProtectedRoute><AttendancePage /></ProtectedRoute>} />
        <Route path="/inventory" element={<ProtectedRoute><Stock /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/apply-leave" element={<ProtectedRoute><ApplyLeave /></ProtectedRoute>} />
        <Route path="/payslips" element={<ProtectedRoute><Payslips /></ProtectedRoute>} />
        <Route path="/documents" element={<ProtectedRoute><Documents /></ProtectedRoute>} />
        <Route path="/payroll" element={<ProtectedRoute><PayrollAdmin /></ProtectedRoute>} />
        <Route path="/reports/payroll" element={<ProtectedRoute role="hr"><PayrollReports /></ProtectedRoute>} />
        <Route path="/leave-management" element={<LeaveManagement />} />
        <Route path="/map" element={<MapView />} />
        <Route path="/assign-call" element={<AssignCalls />} />
        <Route path="/assigned-calls" element={<AssignedCalls />} />
        <Route path="/tasks/pending" element={<PendingTasks />} />
        <Route path="/corrections" element={<AttendanceCorrectionPage />} />
        <Route path="/ta-approval" element={<ProtectedRoute><TAApproval /></ProtectedRoute>} />
      </Routes>
    </Router>
  );
}

export default App;