import React, { useState, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";

const Sidebar = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    // Load user from localStorage
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    } else {
      // Example user for development/testing
      const exampleUser = {
        id: null,
        name: "Uday",
        email: "uday@gmail.com",
        role: "admin", // role: admin/hr/employee
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
    { to: "/all-users", label: "All Users", roles: ["admin", "hr"] },
    { to: "/attendance", label: "Attendance", roles: ["admin", "hr", "employee"] },
    { to: "/leave", label: "Leave Management", roles: ["admin", "hr", "employee"] },
    { to: "/reports", label: "Reports", roles: ["admin", "hr", "employee"] },
  ];

  const filteredMenu = user
    ? menuItems.filter((item) => item.roles.includes(user.role))
    : [];

  return (
    <div className="h-screen w-64 bg-gray-900 text-white flex flex-col justify-between p-4">
      {/* Navigation Links */}
      <ul className="space-y-4">
        {filteredMenu.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              className={({ isActive }) =>
                isActive
                  ? "text-yellow-400 font-bold"
                  : "hover:text-yellow-400"
              }
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>

      {/* Profile Section */}
      {user && (
        <div className="relative border-t border-gray-700 pt-4 mt-4">
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

          {/* Dropdown Menu */}
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
