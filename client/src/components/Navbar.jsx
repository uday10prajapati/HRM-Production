import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from 'axios';

const Navbar = () => {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
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
    <nav className="bg-gradient-to-r from-gray-900 to-gray-800 text-white border-b border-gray-700/50">
      <div className="w-full">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Title Section - Added pl-6 for left padding */}
          <div className="flex items-start pl-6">
            <div className="flex-shrink-0">
              <div className="h-10 w-10 bg-gradient-to-r from-blue-500 to-indigo-500 flex items-center justify-center">
                <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
            </div>
            <div className="ml-4">
              <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                {title}
              </h1>
              {role && (
                <p className="text-sm text-gray-400 capitalize">
                  {role} Dashboard
                </p>
              )}
            </div>
          </div>

          {/* Right Section - remains unchanged */}
          <div className="flex items-center">
            {/* Notifications Button */}
            <button className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </button>

            {/* Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex items-center space-x-3 px-3 py-2 hover:bg-gray-700 transition-colors"
              >
                <div className="h-8 w-8 rounded-full bg-gradient-to-r from-blue-400 to-indigo-400 flex items-center justify-center">
                  <span className="text-white font-medium">{name?.[0]?.toUpperCase()}</span>
                </div>
                <span className="text-sm font-medium hidden sm:block">{name}</span>
                <svg 
                  className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${
                    isProfileOpen ? 'rotate-180' : ''
                  }`}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown Menu */}
              {isProfileOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-gray-800 rounded-lg shadow-xl border border-gray-700/50 py-1">
                  <button
                    onClick={() => navigate('/profile')}
                    className="w-full flex items-center px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
                  >
                    <svg className="h-5 w-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    View Profile
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center px-4 py-2 text-sm text-red-400 hover:bg-gray-700 transition-colors"
                  >
                    <svg className="h-5 w-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;