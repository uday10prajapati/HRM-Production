import React, { useState, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import axios from 'axios';
import SocietyMasterModal from "./modals/SocietyMasterModal";

const Sidebar = () => {
  const [user, setUser] = useState(null);
  const [openDropdowns, setOpenDropdowns] = useState({});
  const [isSocietyMasterOpen, setIsSocietyMasterOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const role = user?.role ? user.role.toString().toLowerCase() : "";

  const toggleDropdown = (label) => {
    setOpenDropdowns((prev) => ({
      ...prev,
      [label]: !prev[label],
    }));
  };

  // Grouped Menu Definition
  const menuSections = [
    {
      title: "Main",
      items: [
        {
          to: role === "admin" ? "/admin-dashboard" : "/hr-dashboard",
          label: "Dashboard",
          roles: ["admin", "hr", "engineer", "employee"],
          icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
        },
        {
          label: "Society Master",
          roles: ["admin", "hr"],
          action: "OPEN_SOCIETY_MASTER",
          icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
        }
      ]
    },
    {
      title: "Applications",
      items: [
        {
          label: "Core HR Management",
          roles: ["admin", "hr"],
          icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
          children: [
            { to: "/all-users", label: "Employees" },
            { to: "/documents", label: "Assign Calls Details" }
          ]
        },
        {
          label: "Field Service (FSM)",
          roles: ["admin", "hr", "engineer"],
          icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h1.28a2 2 0 011.94 1.47l.7 2.49a2 2 0 01-.57 2.01l-1.1 1.1a16 16 0 006.58 6.58l1.1-1.1a2 2 0 012.01-.57l2.49.7A2 2 0 0121 17.72V19a2 2 0 01-2 2h-1C9.82 21 3 14.18 3 6V5z" /></svg>,
          children: [
            { to: "/assign-call", label: "Assign Calls" },
            { to: "/map", label: "Live Map" }
          ]
        },
        {
          label: "Operations",
          roles: ["admin", "hr", "employee", "engineer"],
          icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3h8m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
          children: [
            { to: "/attendance", label: "Time & Attendance" },
            { to: "/leave-management", label: "Leave Management" },
            { to: "/inventory", label: "Inventory & Stock" }
          ]
        },
        {
          label: "Payroll & Compliance",
          roles: ["admin", "hr", "employee", "engineer"],
          icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
          children: [
            { to: "/payroll", label: "Payroll" },
            { to: "/reports/payroll", label: "Compliance" }
          ]
        }
      ]
    }
  ];

  return (
    <div className="w-64 bg-slate-900 flex flex-col hidden sm:flex shrink-0 h-[calc(100vh-4rem)] sticky top-16 overflow-y-auto custom-scrollbar shadow-xl border-r border-slate-800">
      <div className="py-4">
        {menuSections.map((section, sIdx) => {
          // Filter out items not accessible to the current role
          const filteredItems = section.items.filter(item => item.roles.includes(role));
          if (filteredItems.length === 0) return null;

          return (
            <div key={sIdx} className="mb-6">
              {/* Section Header */}
              <div className="px-6 mb-2">
                <span className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">{section.title}</span>
              </div>

              {/* Section Items */}
              <ul className="space-y-1 bg-slate-900 border-none m-0 p-0">
                {filteredItems.map((item, iIdx) => {

                  // DIRECT ACTION ITEM (e.g. Society Master Modal)
                  if (item.action) {
                    return (
                      <li key={iIdx}>
                        <div
                          onClick={() => {
                            if (item.action === "OPEN_SOCIETY_MASTER") setIsSocietyMasterOpen(true);
                          }}
                          className={`cursor-pointer group flex items-center px-6 py-2.5 text-[14px] font-medium transition-all duration-200 text-slate-400 hover:text-white hover:bg-slate-800 border-l-4 border-transparent`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="text-slate-400 group-hover:text-slate-300">
                              {item.icon}
                            </div>
                            <span>{item.label}</span>
                          </div>
                        </div>
                      </li>
                    );
                  }

                  // DROPDOWN ACCORDION ITEM (Contains children routes)
                  if (item.children) {
                    const isOpen = openDropdowns[item.label];
                    return (
                      <li key={iIdx}>
                        <div
                          onClick={() => toggleDropdown(item.label)}
                          className={`cursor-pointer group flex items-center justify-between px-6 py-2.5 text-[14px] font-medium transition-all duration-200 ${isOpen ? 'bg-slate-800 text-white border-l-4 border-orange-500' : 'text-slate-400 hover:text-white hover:bg-slate-800 border-l-4 border-transparent'}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`${isOpen ? 'text-orange-500' : 'text-slate-400 group-hover:text-slate-300'}`}>
                              {item.icon}
                            </div>
                            <span className={`${isOpen ? 'text-white font-semibold' : ''}`}>{item.label}</span>
                          </div>
                          <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-orange-500' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                        </div>
                        {/* Sub Menu Dropdown Area */}
                        {isOpen && (
                          <div className="bg-slate-900/40 py-1.5 overflow-hidden">
                            <ul className="space-y-1">
                              {item.children.map((child, cIdx) => (
                                <li key={cIdx}>
                                  <NavLink
                                    to={child.to}
                                    className={({ isActive }) => `
                                      block px-12 py-2 text-[13.5px] font-medium transition-all flex items-center gap-3
                                      ${isActive ? 'text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}
                                    `}
                                  >
                                    {({ isActive }) => (
                                      <>
                                        <span className={`w-1.5 h-1.5 rounded-full transition-colors ${isActive ? 'bg-orange-500' : 'bg-slate-500 group-hover:bg-slate-400'}`}></span>
                                        {child.label}
                                      </>
                                    )}
                                  </NavLink>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </li>
                    );
                  }

                  // NORMAL NAVLINK ITEM (e.g. Dashboard)
                  return (
                    <li key={iIdx}>
                      <NavLink
                        to={item.to}
                        className={({ isActive }) => `
                          group flex items-center px-6 py-2.5 text-[14px] font-medium transition-all duration-200
                          ${isActive
                            ? 'bg-slate-800 text-white border-l-4 border-orange-500'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800 border-l-4 border-transparent'
                          }
                        `}
                      >
                        {({ isActive }) => (
                          <div className="flex items-center gap-3">
                            <div className={`${isActive ? 'text-orange-500' : 'text-slate-400 group-hover:text-slate-300'}`}>
                              {item.icon}
                            </div>
                            <span className={`${isActive ? 'text-white font-semibold' : ''}`}>{item.label}</span>
                          </div>
                        )}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
      <SocietyMasterModal isOpen={isSocietyMasterOpen} onClose={() => setIsSocietyMasterOpen(false)} />
    </div>
  );
};

export default Sidebar;
