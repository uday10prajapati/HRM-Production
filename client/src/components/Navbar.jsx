import React from "react";
import { useNavigate } from "react-router-dom";
import axios from 'axios';

const Navbar = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.clear();
    // remove axios auth fallback header
    try { delete axios.defaults.headers.common['x-user-id']; } catch(e) {}
    navigate("/login");
  };

  // Read user from localStorage to customize title
  let stored = null;
  try {
    stored = localStorage.getItem("user");
  } catch (e) {
    stored = null;
  }

  const parsed = stored ? JSON.parse(stored) : null;
  const role = parsed?.role ? parsed.role.toString().toLowerCase() : null;
  const name = parsed?.name || parsed?.user?.name || parsed?.username || null;

  let title = "HRMS";
  if (role === "admin") title = "HRMS Admin";
  else if (role === "engineer") title = "HRMS Engineer";
  else if (role === "hr") title = "HRMS HR";
  else if (role === "employee") title = "HRMS Employee";
  else title = "HRMS";

  return (
    <nav className="bg-gray-800 text-white flex items-center justify-between px-6 py-4">
      <div className="flex items-center gap-4">
        <div className="text-2xl font-bold">{title}</div>
      </div>

      <div className="flex items-center gap-4">
        <button className="px-3 py-1 rounded bg-red-600 hover:bg-red-700 text-white text-sm" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </nav>
  );
};

export default Navbar;
