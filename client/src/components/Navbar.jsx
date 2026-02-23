import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from 'axios';

const Navbar = () => {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.clear();
    // remove axios auth fallback header
    try { delete axios.defaults.headers.common['x-user-id']; } catch (e) { }
    navigate("/login");
  };

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.log(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
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
    <nav className="bg-white border-b border-gray-200/80 sticky top-0 z-50">
      <div className="w-full">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Title Section */}
          <div className="flex items-center lg:w-64 pl-6">
            <div className="flex-shrink-0 flex items-center gap-2">
              <div className="text-orange-500 rounded-full bg-orange-50 p-1.5 flex items-center justify-center shadow-sm">
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14.5c-2.49 0-4.5-2.01-4.5-4.5S9.51 7.5 12 7.5s4.5 2.01 4.5 4.5-2.01 4.5-4.5 4.5zm0-7.5c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
                </svg>
              </div>
              <h1 className="text-xl font-bold text-gray-800 tracking-tight hidden sm:block">
                {title}
              </h1>
            </div>
          </div>

          <div className="flex-1 px-4 flex justify-between items-center sm:ml-4">
            {/* Search Input Section */}
            <div className="flex-1 flex hidden md:block">
              <div className="relative w-full max-w-md">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Search in HRMS"
                  className="block w-full pl-10 pr-16 py-1.5 border border-transparent hover:border-gray-200 rounded-full leading-5 bg-gray-50 placeholder-gray-400 focus:outline-none focus:bg-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500 sm:text-sm transition duration-150 ease-in-out"
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <span className="text-gray-400 text-xs font-semibold">CTRL + /</span>
                </div>
              </div>
            </div>

            {/* Right Section Icons */}
            <div className="flex items-center gap-1 sm:gap-2 pr-2">

              {/* Fullscreen Button */}
              <button onClick={toggleFullScreen} className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-full transition-colors hidden sm:block">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
              </button>

              {/* Chat/Messages Button */}
              <button className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-full transition-colors hidden sm:block">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                </svg>
              </button>

              {/* Notifications Button */}
              <button className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-full transition-colors relative">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <span className="absolute top-1 right-1.5 block h-1.5 w-1.5 rounded-full bg-red-500 ring-2 ring-white"></span>
              </button>

              {/* Email Button */}
              <button className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-full transition-colors hidden sm:block relative">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </button>

              {/* Profile Dropdown */}
              <div className="relative ml-2">
                <button
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                  className="flex items-center space-x-2 p-1 rounded-full hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-200"
                >
                  <div className="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center border border-orange-200 shadow-sm">
                    <span className="text-orange-600 font-semibold text-sm">{name?.[0]?.toUpperCase()}</span>
                  </div>
                  <svg
                    className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isProfileOpen ? 'rotate-180' : ''
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
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-50">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="text-sm font-semibold text-gray-900 truncate">{name}</p>
                      <p className="text-xs text-gray-500 capitalize mt-0.5">{role} Administrator</p>
                    </div>
                    <button
                      onClick={() => navigate('/profile')}
                      className="w-full flex items-center px-4 py-2 mt-1 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-600 transition-colors"
                    >
                      <svg className="h-4 w-4 mr-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      My Profile
                    </button>
                    <button
                      onClick={() => navigate('/settings')}
                      className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-600 transition-colors"
                    >
                      <svg className="h-4 w-4 mr-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Settings
                    </button>
                    <div className="border-t border-gray-100 my-1"></div>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <svg className="h-4 w-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
      </div>
    </nav>
  );
};

export default Navbar;