import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Signup from "./pages/SignUp";
import Admin from "./pages/Admin/AdminDashboard";
import AllUsers from "./pages/Admin/AllUsers";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} /> {/* Default route */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/admin-dashboard" element={<Admin />} />
        <Route path="/all-users" element={<AllUsers />} />
      </Routes>
    </Router>
  );
}

export default App;
