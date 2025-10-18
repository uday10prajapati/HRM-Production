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
import LeaveManagement from "./pages/LeaveManagement";
import AllUsers from "./pages/AllUsers"
import Stock from "./pages/Inovetry/Stock";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/all-users" element={<AllUsers />} />
       
       {/* Admin Routes */}
        <Route path="/admin-dashboard" element={<Admin />} />

        {/* Hr Routes */}
        <Route path="/hr-dashboard" element={<HrDashboard />} />
       
        {/* Engineer Routes */}
  <Route path="/engineer-dashboard" element={<EngineerDashboard />} />
  <Route path="/engineer" element={<EngineerDashboard />} />
  <Route path="/engineer/tasks" element={<EngineerTasks />} />
        {/* Employee Routes */}
  <Route path="/employee-dashboard" element={<EmployeeDashboard />} />
  <Route path="/employee" element={<EmployeeDashboard />} />
  <Route path="/attendance" element={<AttendancePage />} />
  <Route path="/inventory" element={<Stock />} />
  <Route path="/profile" element={<Profile />} />
  <Route path="/apply-leave" element={<ApplyLeave />} />
  <Route path="/payslips" element={<Payslips />} />
  <Route path="/documents" element={<Documents />} />
  <Route path="/payroll" element={<PayrollAdmin />} />
  <Route path="/leave-management" element={<LeaveManagement />} />

      </Routes>
    </Router>
  );
}

export default App;
