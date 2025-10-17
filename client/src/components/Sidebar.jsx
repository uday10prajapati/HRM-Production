import React, { useState, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";

const Sidebar = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    } else {
      const exampleUser = {
        id: null,
        name: "Uday",
        email: "uday@gmail.com",
        role: "admin",
      };
      setUser(exampleUser);
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("user");
    navigate("/login");
  };

  // Role-based menu items
  const menuItems = [
    { to: "/admin-dashboard", label: "Dashboard", roles: ["admin"] },
    { to: "/hr-dashboard", label: "HR Dashboard", roles: ["hr"] },
    { to: "/employee-dashboard", label: "Employee Dashboard", roles: ["employee"] },
    { to: "/engineer", label: "Engineer Dashboard", roles: ["engineer"] },
    { to: "/all-users", label: "All Users", roles: ["admin", "hr"] },
    { to: "/leave-management", label: "Leave Requests", roles: ["admin", "hr"] },
    // Removed Attendance, Leave, Reports for employees
  ];

  // Employee-only quick links
  const employeeLinks = [
    { to: "/profile", label: "Profile" },
    { to: "/apply-leave", label: "Apply for Leave" },
    { to: "/payslips", label: "Payslips" },
  ];

  // Determine which menu to render
  const filteredMenu = (() => {
    if (!user) return [];
    const role = (user.role || "").toLowerCase();

    if (role === "employee") {
      // Employees only see employeeLinks, not the main menu
      return [];
    }

    // Other roles see filtered menuItems
    return menuItems.filter((item) => item.roles.includes(role));
  })();

  return (
    <div className="min-h-screen w-64 bg-gray-900 text-white flex flex-col p-4 flex-shrink-0">
      {/* Navigation Links for non-employees */}
      <ul className="space-y-4">
        {filteredMenu.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              className={({ isActive }) =>
                isActive ? "text-yellow-400 font-bold" : "hover:text-yellow-400"
              }
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>

      {/* Employee quick links */}
      {user && (user.role || "").toLowerCase() === "employee" && (
        <ul className="mt-2 space-y-2">
          {employeeLinks.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  isActive ? "text-yellow-400 font-bold" : "hover:text-yellow-400"
                }
              >
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      )}

      {/* Profile Section */}
      {user && (
        <div className="relative border-t border-gray-700 pt-4 mt-auto">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-gray-800 transition"
          >
            <div>
              <p className="font-semibold">{user.name}</p>
              <p className="text-sm text-gray-400 capitalize">{user.role}</p>
            </div>
            <span className="text-lg">{dropdownOpen ? "▲" : "▼"}</span>
          </button>

          {dropdownOpen && (
            <div className="absolute bottom-14 left-0 w-full bg-gray-800 rounded-lg shadow-lg z-10">
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2 hover:bg-gray-700 text-red-400"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Sidebar;
