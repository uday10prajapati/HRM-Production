import React, { useState, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import axios from 'axios';

const Sidebar = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("user");
    try { delete axios.defaults.headers.common['x-user-id']; } catch (e) {}
    navigate("/login");
  };

  // Enhanced menu items with icons
  const menuItems = [
    { 
      to: "/admin-dashboard", 
      label: "Dashboard", 
      roles: ["admin"],
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      )
    },
    { 
      to: "/hr-dashboard", 
      label: "HR Dashboard", 
      roles: ["hr"],
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      )
    },
    { to: "/all-users", label: "All Users", roles: ["admin", "hr"], icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg> },
    { to: "/inventory", label: "Inventory", roles: ["admin", "hr"], icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h18v18H3V3z" />
        </svg> },
    { to: "/leave-management", label: "Leave Requests", roles: ["admin", "hr"], icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3H6v4H2v2h4v4h2V9h4V7H8z" />
        </svg> },
    { to: "/profile", label: "Profile", roles: ["admin", "hr"], icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-3.31 0-10 1.67-10 5v2h20v-2c0-3.33-6.69-5-10-5z" />
        </svg> },
    { to: "/payslips", label: "Payslips", roles: ["admin", "hr"], icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h18v18H3V3z" />
        </svg> },
    { to: "/attendance", label: "Attendance", roles: ["admin", "hr"], icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3H6v4H2v2h4v4h2V9h4V7H8z" />
        </svg> },
  ];

  // Determine which menu to render
  const filteredMenu = (() => {
    if (!user) return [];
    const role = (user.role || "").toLowerCase();
    // Show items that include the user's role
    return menuItems.filter((item) => item.roles.includes(role));
  })();

  return (
    <div className="min-h-screen w-56 bg-gradient-to-b from-gray-900 to-gray-800 text-white flex flex-col">
      {/* Logo Section */}
      <div className="p-3 border-b border-gray-700/50">
        <h1 className="text-lg font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
          HRM System
        </h1>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {filteredMenu.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center px-4 py-3 rounded-lg transition-all ${
                    isActive 
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' 
                      : 'text-gray-300 hover:bg-gray-800/50'
                  }`
                }
              >
                {item.icon}
                <span className="ml-3">{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Profile Section */}
      {user && (
        <div className="border-t border-gray-700/50 p-4">
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="w-full flex items-center p-3 rounded-lg hover:bg-gray-800/50 transition-all"
            >
              <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-400 to-indigo-400 flex items-center justify-center">
                <span className="text-white font-medium">{user.name[0].toUpperCase()}</span>
              </div>
              <div className="ml-3 flex-1">
                <p className="font-medium text-white">{user.name}</p>
                <p className="text-sm text-gray-400 capitalize">{user.role}</p>
              </div>
              <svg 
                className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${
                  dropdownOpen ? 'rotate-180' : ''
                }`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown Menu */}
            {dropdownOpen && (
              <div className="absolute bottom-full left-0 w-full mb-2 bg-gray-800 rounded-lg shadow-xl border border-gray-700/50 overflow-hidden">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center px-4 py-3 text-red-400 hover:bg-gray-700/50 transition-colors"
                >
                  <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;
