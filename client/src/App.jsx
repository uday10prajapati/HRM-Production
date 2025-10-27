import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Login from "./pages/LogIn";
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
import EngineerTasks from "./pages/EngineerTasks";
import 'leaflet/dist/leaflet.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
  {/* Signup route removed - signup disabled */}
        <Route path="/all-users" element={<AllUsers />} />
       
  {/* Admin Routes */}
  <Route path="/admin-dashboard" element={<ProtectedRoute role="admin"><Admin /></ProtectedRoute>} />

  {/* Hr Routes */}
  <Route path="/hr-dashboard" element={<ProtectedRoute role="hr"><HrDashboard /></ProtectedRoute>} />
       
        {/* Engineer Routes: removed — portal restricted to admin and hr */}

        {/* Employee Routes: restrict access to admin/hr only (portal no longer accessible to employee/engineer) */}
    <Route path="/attendance" element={<ProtectedRoute><AttendancePage /></ProtectedRoute>} />
  <Route path="/inventory" element={<ProtectedRoute><Stock /></ProtectedRoute>} />
  <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
  <Route path="/apply-leave" element={<ProtectedRoute><ApplyLeave /></ProtectedRoute>} />
  <Route path="/payslips" element={<ProtectedRoute><Payslips /></ProtectedRoute>} />
  <Route path="/documents" element={<ProtectedRoute role="admin"><Documents /></ProtectedRoute>} />
  <Route path="/payroll" element={<ProtectedRoute><PayrollAdmin /></ProtectedRoute>} />
  <Route path="/reports/payroll" element={<ProtectedRoute role="hr"><PayrollReports /></ProtectedRoute>} />
  <Route path="/leave-management" element={<LeaveManagement />} />
  <Route path="/map" element={<MapView />} />
  <Route path="/engineer/tasks" element={<ProtectedRoute><EngineerTasks /></ProtectedRoute>} />

      </Routes>
    </Router>
  );
}

export default App;