import React from "react";
import { useNavigate } from "react-router-dom";

const Navbar = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.clear(); // Clear all local storage data
    navigate("/login"); // Redirect to login page
  };

  return (
    <nav className="bg-gray-800 text-white flex items-center justify-between px-6 py-4">
      <div className="text-2xl font-bold">HRMS Admin</div>
      <div>
        <button className="hover:text-yellow-400" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </nav>
  );
};

export default Navbar;
