import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Signup from "./pages/SignUp";
import Admin from "./pages/Admin/AdminDashboard";
import HrDashboard from "./pages/HR/HrDashboard" 

import AllUsers from "./pages/AllUsers"

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


      </Routes>
    </Router>
  );
}

export default App;
