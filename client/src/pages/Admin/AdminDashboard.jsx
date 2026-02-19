import React, { useEffect, useState } from 'react';
import Navbar from '../../components/Navbar';
import Sidebar from '../../components/Sidebar';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import SocietyMasterModal from '../../components/modals/SocietyMasterModal';

const Admin = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [docsCount, setDocsCount] = useState(0);
  const [user, setUser] = useState(null);
  const [assignedCallsCount, setAssignedCallsCount] = useState(0);
  const [resolvedCallsCount, setResolvedCallsCount] = useState(0);
  const [isSocietyMasterOpen, setIsSocietyMasterOpen] = useState(false);


  // Fetch logged-in user
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (!storedUser) navigate("/login");
    else setUser(JSON.parse(storedUser));
  }, [navigate]);


  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/users/');
      // Safely extract users array from response
      const all = Array.isArray(res.data?.users) ? res.data.users : (Array.isArray(res.data) ? res.data : []);
      setUsers(all);

      // documents count (KEEPING THIS — no removal)
      try {
        const c = await axios.get('/api/documents/counts');
        const counts = Array.isArray(c.data?.counts) ? c.data.counts : [];
        const totalDocs = counts.reduce((acc, r) => acc + Number(r.count || 0), 0);
        setDocsCount(totalDocs);
      } catch (err) {
        console.warn('Failed to fetch documents count', err);
      }

    } catch (err) {
      console.error('Failed to load admin data', err);
      setUsers([]); // Ensure users is always an array
    } finally {
      setLoading(false);
    }
  };

  // NEW: Fetch assigned calls
  const fetchAssignedCalls = async () => {
    try {
      const response = await axios.get("/api/service-calls/assigned-calls", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (response.data.success) {
        setAssignedCallsCount(response.data.calls.length);
        const resolved = response.data.calls.filter(c =>
          (c.status || '').toLowerCase() === 'completed' ||
          (c.status || '').toLowerCase() === 'resolved'
        ).length;
        setResolvedCallsCount(resolved);
      }
    } catch (err) {
      console.error("Failed to fetch assigned calls", err);
    }
  };

  useEffect(() => {
    fetchData();
    fetchAssignedCalls();
  }, []);

  const totalUsers = users.length;
  const totalEngineers = users.filter(u => (u.role || '').toLowerCase() === 'engineer').length;
  const totalPendingTasks = users.reduce((acc, u) => acc + ((u.tasks || []).filter(t => (t.status || '').toLowerCase() !== 'completed').length), 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-8">
          <div className="max-w-7xl mx-auto space-y-8">
            {/* Welcome Banner */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl shadow-lg p-8 text-white">
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-3xl font-bold">Welcome back, {user?.name || 'Admin'}</h1>
                  <p className="mt-2 text-blue-100">Here's what's happening in your organization today</p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => navigate('/all-users')}
                    className="inline-flex items-center px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg backdrop-blur-sm transition-all"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    Manage Users
                  </button>

                </div>
              </div>
            </div>

            {/* Statistics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Total Users Card */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all group">
                <div className="flex items-center">
                  <div className="p-3 bg-blue-50 rounded-lg group-hover:scale-110 transition-transform">
                    <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </div>
                  <div className="ml-4 flex-1">
                    <h3 className="text-sm font-medium text-gray-500">Total Users</h3>
                    <div className="mt-2 flex items-baseline">
                      <div className="text-2xl font-bold text-gray-900">{totalUsers}</div>
                      <div className="ml-2 text-sm text-green-600">+12%</div>
                    </div>
                  </div>
                </div>
                <div className="mt-4 border-t border-gray-100 pt-4">
                  <a href="/all-users" className="text-sm text-blue-600 hover:text-blue-800 font-medium">View all users →</a>
                </div>
              </div>

              {/* Total Pending Tasks Card */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all group">
                <div className="flex items-center">
                  <div className="p-3 bg-yellow-50 rounded-lg group-hover:scale-110 transition-transform">
                    <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                  </div>
                  <div className="ml-4 flex-1">
                    <h3 className="text-sm font-medium text-gray-500">Pending Tasks</h3>
                    <div className="mt-2 flex items-baseline">
                      <div className="text-2xl font-bold text-gray-900">{totalPendingTasks}</div>
                      <div className="ml-2 text-sm text-red-600">-3%</div>
                    </div>
                  </div>
                </div>
                <div className="mt-4 border-t border-gray-100 pt-4">
                  <a href="/tasks/pending" className="text-sm text-blue-600 hover:text-blue-800 font-medium">View pending tasks →</a>
                </div>
              </div>

              {/* Total Documents Card */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all group">
                <div className="flex items-center">
                  <div className="p-3 bg-green-50 rounded-lg group-hover:scale-110 transition-transform">
                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M3 5a2 2 0 012-2h1.28a2 2 0 011.94 1.47l.7 2.49a2 2 0 01-.57 2.01l-1.1 1.1a16 16 0 006.58 6.58l1.1-1.1a2 2 0 012.01-.57l2.49.7A2 2 0 0121 17.72V19a2 2 0 01-2 2h-1C9.82 21 3 14.18 3 6V5z"
                      />
                    </svg>
                  </div>
                  <div className="ml-4 flex-1">
                    <h3 className="text-sm font-medium text-gray-500">Assigned Calls</h3>
                    <div className="mt-2 flex items-baseline">
                      <div className="text-2xl font-bold text-gray-900">{assignedCallsCount}</div>
                      <div className="ml-2 text-sm text-green-600">+8%</div>
                    </div>
                  </div>
                </div>
                <div className="mt-4 border-t border-gray-100 pt-4">
                  <a href="/assign-call" className="text-sm text-blue-600 hover:text-blue-800 font-medium">View all Assigned Calls →</a>
                </div>
              </div>

              {/* Resolved Calls Card */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all group">
                <div className="flex items-center">
                  <div className="p-3 bg-green-50 rounded-lg group-hover:scale-110 transition-transform">
                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="ml-4 flex-1">
                    <h3 className="text-sm font-medium text-gray-500">Resolved Calls</h3>
                    <div className="mt-2 flex items-baseline">
                      <div className="text-2xl font-bold text-gray-900">{resolvedCallsCount}</div>
                    </div>
                  </div>
                </div>
                <div className="mt-4 border-t border-gray-100 pt-4">
                  <a href="/assign-call" className="text-sm text-blue-600 hover:text-blue-800 font-medium">View detailed report →</a>
                </div>
              </div>

              {/* Total Engineers Card */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all group">
                <div className="flex items-center">
                  <div className="p-3 bg-purple-50 rounded-lg group-hover:scale-110 transition-transform">
                    <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div className="ml-4 flex-1">
                    <h3 className="text-sm font-medium text-gray-500">Engineers</h3>
                    <div className="mt-2 flex items-baseline">
                      <div className="text-2xl font-bold text-gray-900">{totalEngineers}</div>
                      <div className="ml-2 text-sm text-green-600">+5%</div>
                    </div>
                  </div>
                </div>
                <div className="mt-4 border-t border-gray-100 pt-4">
                  <a href="/all-users" className="text-sm text-blue-600 hover:text-blue-800 font-medium">View all engineers →</a>
                </div>
              </div>
            </div>

            {/* Main Modules Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

              {/* Society Master Card */}
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 hover:shadow-md transition-all group">
                <div className="flex items-center mb-4">
                  <div className="p-3 bg-red-50 rounded-lg group-hover:scale-110 transition-transform">
                    <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <h3 className="ml-4 text-lg font-semibold text-gray-900">Society Master</h3>
                </div>
                <p className="text-sm text-gray-600 mb-4">Manage society list, add new societies, and maintain master data.</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setIsSocietyMasterOpen(true)}
                    className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm font-medium"
                  >
                    Manage Societies
                  </button>
                </div>
              </div>
              {/* Core HR Management */}
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 hover:shadow-md transition-all">
                <div className="flex items-center mb-4">
                  <div className="p-3 bg-green-50 rounded-lg">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <h3 className="ml-4 text-lg font-semibold text-gray-900">Core HR Management</h3>
                </div>
                <p className="text-sm text-gray-600 mb-4">Employee database, onboarding/offboarding, document management.</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => navigate('/all-users')}
                    className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm font-medium"
                  >
                    Employees
                  </button>
                  <button
                    onClick={() => navigate('/documents')}
                    className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors text-sm font-medium"
                  >
                    Documents
                  </button>
                </div>
              </div>

              {/* Field Service Management (FSM) */}
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 hover:shadow-md transition-all">
                <div className="flex items-center mb-4">
                  <div className="p-3 bg-indigo-50 rounded-lg">
                    <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="ml-4 text-lg font-semibold text-gray-900">Field Service Management (FSM)</h3>
                </div>
                <p className="text-sm text-gray-600 mb-4">Call assignment, live tracking, task lifecycle management.</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => navigate('/assign-call')}
                    className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-sm font-medium"
                  >
                    Assign Calls
                  </button>
                  <button
                    onClick={() => navigate('/map')}
                    className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors text-sm font-medium"
                  >
                    Live Map
                  </button>
                </div>
              </div>

              {/* Payroll & Compliance */}
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 hover:shadow-md transition-all">
                <div className="flex items-center mb-4">
                  <div className="p-3 bg-yellow-50 rounded-lg">
                    <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m7-3a9.978 9.978 0 01-2.528 6.364M4.636 4.636A9.978 9.978 0 0112 2a9.978 9.978 0 016.364 2.636M4.636 19.364A9.978 9.978 0 012 12c0-2.21.735-4.24 2.036-5.636M19.364 4.636A9.978 9.978 0 0122 12c0 2.21-.735 4.24-2.036 5.636" />
                    </svg>
                  </div>
                  <h3 className="ml-4 text-lg font-semibold text-gray-900">Payroll & Compliance</h3>
                </div>
                <p className="text-sm text-gray-600 mb-4">Salary slips, statutory reports, Form16 generation.</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => navigate('/payroll')}
                    className="flex-1 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors text-sm font-medium"
                  >
                    Payroll
                  </button>
                  <button
                    onClick={() => navigate('/reports/payroll')}
                    className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors text-sm font-medium"
                  >
                    Compliance
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Access Modules Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* Time & Attendance Card */}
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 hover:shadow-md transition-all group">
                <div className="flex items-center mb-4">
                  <div className="p-3 bg-purple-50 rounded-lg group-hover:scale-110 transition-transform">
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h4 className="ml-4 font-semibold text-gray-900">Time & Attendance</h4>
                </div>
                <p className="text-sm text-gray-600 mb-4">Track employee attendance, manage shifts, and monitor overtime efficiently.</p>
                <button
                  onClick={() => navigate('/attendance')}
                  className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors text-sm font-medium inline-flex items-center justify-center"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  View Attendance
                </button>
              </div>

              {/* Leave Management Card */}
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 hover:shadow-md transition-all group">
                <div className="flex items-center mb-4">
                  <div className="p-3 bg-green-50 rounded-lg group-hover:scale-110 transition-transform">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h4 className="ml-4 font-semibold text-gray-900">Leave Management</h4>
                </div>
                <p className="text-sm text-gray-600 mb-4">Streamline leave applications, approvals, and balance tracking.</p>
                <button
                  onClick={() => navigate('/leave-management')}
                  className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm font-medium inline-flex items-center justify-center"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Manage Leaves
                </button>
              </div>

              {/* Inventory & Stock Card */}
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 hover:shadow-md transition-all group">
                <div className="flex items-center mb-4">
                  <div className="p-3 bg-blue-50 rounded-lg group-hover:scale-110 transition-transform">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                  <h4 className="ml-4 font-semibold text-gray-900">Inventory & Stock</h4>
                </div>
                <p className="text-sm text-gray-600 mb-4">Monitor stock levels, track usage, and manage inventory alerts.</p>
                <button
                  onClick={() => navigate('/inventory')}
                  className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium inline-flex items-center justify-center"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  View Inventory
                </button>
              </div>

              {/* Roles & Permissions Card */}
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 hover:shadow-md transition-all group">
                <div className="flex items-center mb-4">
                  <div className="p-3 bg-amber-50 rounded-lg group-hover:scale-110 transition-transform">
                    <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                  </div>
                  <h4 className="ml-4 font-semibold text-gray-900">Roles & Permissions</h4>
                </div>
                <p className="text-sm text-gray-600 mb-4">Configure user roles, access levels, and security settings.</p>
                <button
                  onClick={() => navigate('/roles')}
                  className="w-full px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors text-sm font-medium inline-flex items-center justify-center"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Manage Roles
                </button>
              </div>
            </div>



            {/* Recent Users Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-800">Recent Users</h2>
                    <p className="mt-1 text-sm text-gray-600">Latest user activities and updates</p>
                  </div>
                  <button
                    onClick={() => navigate('/all-users')}
                    className="inline-flex items-center px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors text-sm font-medium"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    View All Users
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="p-8 text-center">
                  <div className="inline-flex items-center">
                    <svg className="animate-spin h-5 w-5 text-blue-500 mr-3" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span className="text-gray-600">Loading users...</span>
                  </div>
                </div>
              ) : users.length === 0 ? (
                <div className="text-gray-500">No users</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">ID</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Name</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Email</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Role</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Tasks</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {users.slice(0, 10).map(u => (
                        <tr key={u.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm">{u.id}</td>
                          <td className="px-4 py-2 text-sm">{u.name}</td>
                          <td className="px-4 py-2 text-sm">{u.email}</td>
                          <td className="px-4 py-2 text-sm capitalize">{u.role}</td>
                          <td className="px-4 py-2 text-sm">{(u.tasks || []).length}</td>
                          <td className="px-4 py-2 text-sm flex gap-2">
                            <button onClick={() => navigate('/all-users')} className="text-indigo-600 hover:underline">Edit</button>
                            <button onClick={() => navigate('/all-users')} className="text-red-600 hover:underline">Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
      <SocietyMasterModal isOpen={isSocietyMasterOpen} onClose={() => setIsSocietyMasterOpen(false)} />
    </div>
  );
};

export default Admin;
