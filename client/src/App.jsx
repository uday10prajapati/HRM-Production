import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Login from "./pages/LogIn";
import Signup from "./pages/SignUp";
import Admin from "./pages/Admin/AdminDashboard";
import HrDashboard from "./pages/HR/HrDashboard" 
import EngineerDashboard from "./pages/Engineer/EngineerDashboard"
import EngineerTasks from "./pages/Engineer/task"
import EmployeeDashboard from "./pages/Employee/EmployeeDashboard";
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

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/all-users" element={<AllUsers />} />
       
  {/* Admin Routes */}
  <Route path="/admin-dashboard" element={<ProtectedRoute role="admin"><Admin /></ProtectedRoute>} />

  {/* Hr Routes */}
  <Route path="/hr-dashboard" element={<ProtectedRoute role="hr"><HrDashboard /></ProtectedRoute>} />
       
        {/* Engineer Routes */}
  <Route path="/engineer-dashboard" element={<ProtectedRoute role="engineer"><EngineerDashboard /></ProtectedRoute>} />
  <Route path="/engineer" element={<ProtectedRoute role="engineer"><EngineerDashboard /></ProtectedRoute>} />
  <Route path="/engineer/tasks" element={<EngineerTasks />} />
        {/* Employee Routes */}
  <Route path="/employee-dashboard" element={<ProtectedRoute><EmployeeDashboard /></ProtectedRoute>} />
  <Route path="/employee" element={<ProtectedRoute><EmployeeDashboard /></ProtectedRoute>} />
  <Route path="/attendance" element={<AttendancePage />} />
  <Route path="/inventory" element={<ProtectedRoute><Stock /></ProtectedRoute>} />
  <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
  <Route path="/apply-leave" element={<ProtectedRoute><ApplyLeave /></ProtectedRoute>} />
  <Route path="/payslips" element={<ProtectedRoute><Payslips /></ProtectedRoute>} />
  <Route path="/documents" element={<ProtectedRoute role="admin"><Documents /></ProtectedRoute>} />
  <Route path="/payroll" element={<ProtectedRoute role="hr"><PayrollAdmin /></ProtectedRoute>} />
  <Route path="/reports/payroll" element={<ProtectedRoute role="hr"><PayrollReports /></ProtectedRoute>} />
  <Route path="/leave-management" element={<LeaveManagement />} />

      </Routes>
    </Router>
  );
}

export default App;
