import React from "react";
import { NavLink } from "react-router-dom";

const Sidebar = () => {
  return (
    <div className="h-screen w-64 bg-gray-900 text-white p-4">
      <ul className="space-y-4">
        <li>
          <NavLink 
            to="/admin-dashboard" 
            className={({ isActive }) => 
              isActive ? "text-yellow-400 font-bold" : "hover:text-yellow-400"
            }
          >
            Dashboard
          </NavLink>
        </li>
        <li>
          <NavLink 
            to="/all-users" 
            className={({ isActive }) =>
              isActive ? "text-yellow-400 font-bold" : "hover:text-yellow-400"
            }
          >
            All Users
          </NavLink>
        </li>
        <li>
          <NavLink 
            to="/attendance" 
            className={({ isActive }) =>
              isActive ? "text-yellow-400 font-bold" : "hover:text-yellow-400"
            }
          >
            Attendance
          </NavLink>
        </li>
        <li>
          <NavLink 
            to="/leave" 
            className={({ isActive }) =>
              isActive ? "text-yellow-400 font-bold" : "hover:text-yellow-400"
            }
          >
            Leave Management
          </NavLink>
        </li>
        <li>
          <NavLink 
            to="/reports" 
            className={({ isActive }) =>
              isActive ? "text-yellow-400 font-bold" : "hover:text-yellow-400"
            }
          >
            Reports
          </NavLink>
        </li>
      </ul>
    </div>
  );
};

export default Sidebar;
