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
  const [stockDetails, setStockDetails] = useState([]);
  const [chartData, setChartData] = useState({
    data: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map(m => ({ month: m, val: 0 })),
    scaleMax: 120
  });
  const [attendanceOverview, setAttendanceOverview] = useState({ present: 0, absent: 0, late: 0, permission: 0, total: 0 });
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [assignedCalls, setAssignedCalls] = useState([]);
  const [assignedCallsOverview, setAssignedCallsOverview] = useState({ pending: 0, completed: 0, total: 0 });


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
        const calls = response.data.calls || [];
        setAssignedCallsCount(calls.length);
        setAssignedCalls(calls);

        let pending = 0;
        let completed = 0;

        calls.forEach(c => {
          const st = (c.status || '').toLowerCase();
          if (st === 'completed' || st === 'resolved') {
            completed++;
          } else {
            pending++;
          }
        });

        setResolvedCallsCount(completed);
        setAssignedCallsOverview({ pending, completed, total: calls.length });
      }
    } catch (err) {
      console.error("Failed to fetch assigned calls", err);
    }
  };

  const fetchStockOverview = async () => {
    try {
      const res = await axios.get('/api/stock/overview/full');
      const allocations = res.data.allocations || [];
      setStockDetails(allocations);

      const monthlyData = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map(m => ({ month: m, val: 0 }));
      let maxVal = 0;

      allocations.forEach(alloc => {
        if (alloc.assigned_at) {
          const mIdx = new Date(alloc.assigned_at).getMonth();
          if (mIdx >= 0 && mIdx < 12) {
            monthlyData[mIdx].val += Number(alloc.quantity || 0);
          }
        }
      });

      maxVal = Math.max(...monthlyData.map(d => d.val));
      const computedScale = maxVal > 100 ? (Math.ceil(maxVal / 20) * 20) : (maxVal > 0 ? (Math.ceil(maxVal / 10) * 10) + 20 : 120);

      setChartData({ data: monthlyData, scaleMax: computedScale });
    } catch (err) {
      console.warn("Failed to fetch stock overview", err);
    }
  };

  const fetchAttendanceToday = async () => {
    try {
      const d = new Date();
      const start = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      const res = await axios.get(`/api/attendance/summary/all?start=${start}&end=${start}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      if (res.data.success) {
        let records = res.data.data || [];
        // Optional: only show people who have punched in or relevant records
        setAttendanceRecords(records);

        let presentCount = records.filter(r => r.present_today).length;
        const total = records.length;
        const absent = total - presentCount;

        let lateCount = 0;
        records.forEach(r => {
          if (r.present_today && r.punch_in && r.punch_in !== '-') {
            // Assuming "YYYY-MM-DD HH:MM:SS"
            const timeMatch = r.punch_in.match(/(\d{2}):(\d{2}):(\d{2})/);
            if (timeMatch) {
              const hour = parseInt(timeMatch[1], 10);
              const min = parseInt(timeMatch[2], 10);
              if (hour > 10 || (hour === 10 && min > 0)) { // Late if strictly after 10:00 AM
                lateCount++;
              }
            }
          }
        });
        setAttendanceOverview({
          present: Math.max(0, presentCount - lateCount),
          absent,
          late: lateCount,
          permission: 0,
          total
        });
      }
    } catch (err) {
      console.warn("Failed to fetch attendance for today", err);
    }
  };

  useEffect(() => {
    fetchData();
    fetchAssignedCalls();
    fetchStockOverview();
    fetchAttendanceToday();
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
            <div className="bg-white rounded border border-gray-200 p-6 flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full overflow-hidden border border-gray-100 bg-orange-50 flex items-center justify-center">
                  <span className="text-2xl font-bold text-orange-600">{user?.name?.[0]?.toUpperCase() || 'A'}</span>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    Welcome Back, {user?.name || 'Admin'} <span className="text-xl">👋</span>
                  </h1>

                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => navigate('/all-users')}
                  className="inline-flex items-center px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded text-sm font-medium transition-colors shadow-sm"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                  Add User
                </button>
              </div>
            </div>

            {/* Statistics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Card 1: Total Users */}
              <div className="bg-white rounded border border-gray-200 p-5 flex flex-col hover:shadow-sm transition-all group">
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-orange-50 mb-3 group-hover:bg-orange-100 transition-colors">
                  <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Total Users</h3>
                <div className="text-xl font-bold text-gray-900 mb-3">
                  {totalUsers}
                </div>
                <div className="mt-auto pt-3 border-t border-gray-100 w-full">
                  <a href="/all-users" className="text-xs text-gray-500 hover:text-orange-500 font-medium tracking-wide">View Details</a>
                </div>
              </div>

              {/* Card 2: Pending Tasks */}
              <div className="bg-white rounded border border-gray-200 p-5 flex flex-col hover:shadow-sm transition-all group">
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-blue-900 mb-3 group-hover:bg-blue-800 transition-colors">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Pending Tasks</h3>
                <div className="text-xl font-bold text-gray-900 mb-3">
                  {totalPendingTasks}
                </div>
                <div className="mt-auto pt-3 border-t border-gray-100 w-full">
                  <a href="/tasks/pending" className="text-xs text-gray-500 hover:text-orange-500 font-medium tracking-wide">View All</a>
                </div>
              </div>

              {/* Card 3: Assigned Calls */}
              <div className="bg-white rounded border border-gray-200 p-5 flex flex-col hover:shadow-sm transition-all group">
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-blue-500 mb-3 group-hover:bg-blue-600 transition-colors">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h1.28a2 2 0 011.94 1.47l.7 2.49a2 2 0 01-.57 2.01l-1.1 1.1a16 16 0 006.58 6.58l1.1-1.1a2 2 0 012.01-.57l2.49.7A2 2 0 0121 17.72V19a2 2 0 01-2 2h-1C9.82 21 3 14.18 3 6V5z" />
                  </svg>
                </div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Assigned Calls</h3>
                <div className="text-xl font-bold text-gray-900 mb-3">
                  {assignedCallsCount}
                </div>
                <div className="mt-auto pt-3 border-t border-gray-100 w-full">
                  <a href="/assign-call" className="text-xs text-gray-500 hover:text-orange-500 font-medium tracking-wide">View All</a>
                </div>
              </div>

              {/* Card 4: Resolved Calls */}
              <div className="bg-white rounded border border-gray-200 p-5 flex flex-col hover:shadow-sm transition-all group">
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-pink-500 mb-3 group-hover:bg-pink-600 transition-colors">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Resolved Calls</h3>
                <div className="text-xl font-bold text-gray-900 mb-3">
                  {resolvedCallsCount}
                </div>
                <div className="mt-auto pt-3 border-t border-gray-100 w-full">
                  <a href="/assign-call" className="text-xs text-gray-500 hover:text-orange-500 font-medium tracking-wide">View All</a>
                </div>
              </div>

              {/* Card 5: Engineers */}
              <div className="bg-white rounded border border-gray-200 p-5 flex flex-col hover:shadow-sm transition-all group">
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-purple-500 mb-3 group-hover:bg-purple-600 transition-colors">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Engineers</h3>
                <div className="text-xl font-bold text-gray-900 mb-3">
                  {totalEngineers}
                </div>
                <div className="mt-auto pt-3 border-t border-gray-100 w-full">
                  <a href="/all-users" className="text-xs text-gray-500 hover:text-orange-500 font-medium tracking-wide">View All</a>
                </div>
              </div>
            </div>

            {/* Database Real-Time Stock Chart and Engineer Allocations */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Stock Overview Chart */}
              <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col relative w-full overflow-hidden">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-lg font-bold text-gray-800">Stock Overview</h2>
                  <div className="flex gap-2">
                    <select className="bg-gray-50 border border-gray-200 text-gray-600 text-sm rounded px-3 py-1 outline-none">
                      <option>All Departments</option>
                    </select>
                    <button className="bg-white border border-gray-200 text-gray-600 text-sm rounded px-3 py-1 flex items-center gap-1 shadow-sm">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      This Year
                    </button>
                  </div>
                </div>

                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-orange-500"></span>
                      <span className="text-sm font-medium text-gray-600">Stock Assigned</span>
                    </div>
                  </div>
                  <span className="text-sm text-gray-400 font-medium hidden sm:block">Real-time DB Data</span>
                </div>

                {/* CSS Bar Chart */}
                <div className="relative h-64 mt-4 w-full flex items-end justify-between pl-8 pt-4 pb-6 overflow-hidden">
                  {/* Grid Lines */}
                  <div className="absolute inset-0 pl-8 flex flex-col justify-between pointer-events-none pb-6">
                    {[1, 0.8, 0.6, 0.4, 0.2, 0].map((ratio, i) => {
                      const val = Math.round(chartData.scaleMax * ratio);
                      return (
                        <div key={i} className="flex border-b border-gray-100/80 w-full h-0 relative">
                          <span className="absolute -left-8 -top-2.5 text-xs text-gray-400 font-medium w-6 text-right">{val}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Bars */}
                  {chartData.data.map((data, index) => {
                    const heightPct = chartData.scaleMax === 0 ? 0 : Math.min((data.val / chartData.scaleMax) * 100, 100);
                    return (
                      <div key={index} className="relative flex flex-col justify-end items-center h-full w-[6%] z-10 group" title={`Quantity: ${data.val}`}>
                        <div
                          style={{ height: `${heightPct}%` }}
                          className="w-full bg-orange-500 rounded-t shadow-sm hover:opacity-90 transition-all cursor-pointer"
                        ></div>
                        <span className="absolute -bottom-6 text-xs text-gray-500 font-medium">{data.month}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Engineer Stock Right Panel */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden max-h-[420px]">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center flex-shrink-0">
                  <h2 className="text-lg font-bold text-gray-800">Engineer Stock</h2>
                  <div className="flex gap-2">
                    <button className="bg-white border border-gray-200 text-gray-600 text-[13px] rounded px-3 py-1 flex items-center gap-1 shadow-sm">
                      View All
                    </button>
                  </div>
                </div>
                <div className="flex-1 p-0 overflow-y-auto custom-scrollbar flex flex-col">
                  {stockDetails.length === 0 ? (
                    <div className="p-8 text-center text-sm text-gray-400 flex flex-col items-center">
                      <svg className="w-8 h-8 text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                      No stock assigned yet.
                    </div>
                  ) : (
                    stockDetails.map((stock, idx) => (
                      <div key={idx} className="px-5 py-3.5 flex items-center justify-between border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-3 w-2/3">
                          <div className="w-9 h-9 rounded-full bg-orange-100 flex-shrink-0 flex items-center justify-center overflow-hidden">
                            <img src={`https://ui-avatars.com/api/?name=${(stock.engineer_name || 'E').charAt(0)}&background=random`} alt="avatar" className="w-full h-full object-cover" />
                          </div>
                          <div className="truncate w-full pr-2">
                            <p className="text-[13.5px] font-semibold text-gray-800 truncate" title={stock.engineer_name || 'Unknown'}>{stock.engineer_name || 'Unknown'}</p>
                            <p className="text-[11px] text-gray-500 truncate mt-0.5" title={stock.item_name || 'Stock Item'}>{stock.item_name || 'Stock Item'}</p>
                          </div>
                        </div>
                        <div className="text-right flex flex-col items-end flex-shrink-0">
                          <p className="text-[10px] text-gray-400">Qty Assigned</p>
                          <p className="text-[14px] font-bold text-gray-800 tracking-tight">{stock.quantity}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                {stockDetails.length > 0 && (
                  <div className="p-3 text-center mt-auto border-t border-gray-100 flex-shrink-0">
                    <button className="text-[13px] font-semibold text-gray-800 hover:text-orange-500 transition-colors tracking-wide">
                      View All Allocations
                    </button>
                  </div>
                )}
              </div>
            </div>



            {/* Bottom Section: Clock-in List & Attendance Graph */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Clock-In/Out List (Left Panel) */}
              <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white rounded-t-xl z-10 sticky top-0">
                  <h2 className="text-lg font-bold text-gray-800">Clock-In/Out</h2>
                  <div className="flex gap-2">
                    <select className="bg-gray-50 border border-gray-200 text-gray-600 text-[13px] rounded px-2 py-1 outline-none">
                      <option>All Departments</option>
                    </select>
                    <button className="bg-white border border-gray-200 text-gray-600 text-[13px] rounded px-2 py-1 flex items-center gap-1 shadow-sm">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      Today
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar md:max-h-[440px]">
                  {attendanceRecords.length === 0 ? (
                    <div className="p-8 text-center text-sm text-gray-400">Loading attendance data...</div>
                  ) : (
                    attendanceRecords.slice(0, 15).map((record, idx) => {
                      let punchInTime = '--:--';
                      let punchOutTime = '--:--';
                      let hrsWorked = '--';

                      if (record.punch_in && record.punch_in !== '-') {
                        const inD = new Date(record.punch_in);
                        if (!isNaN(inD)) punchInTime = inD.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      }
                      if (record.punch_out && record.punch_out !== '-') {
                        const outD = new Date(record.punch_out);
                        if (!isNaN(outD)) punchOutTime = outD.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      }
                      if (punchInTime !== '--:--' && punchOutTime !== '--:--' && record.punch_in !== record.punch_out) {
                        const hrs = Math.abs(new Date(record.punch_out) - new Date(record.punch_in)) / 3600000;
                        if (hrs > 0) hrsWorked = hrs.toFixed(2) + ' Hrs';
                      }

                      return (
                        <div key={idx} className="px-6 py-4 border-b border-gray-50 hover:bg-gray-50 transition-colors">
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center overflow-hidden flex-shrink-0 border border-blue-100">
                                <img src={`https://ui-avatars.com/api/?name=${record.name.charAt(0)}&background=random`} alt="avatar" className="w-full h-full object-cover" />
                              </div>
                              <div>
                                <p className="text-[14px] font-bold text-gray-800 leading-tight">{record.name}</p>
                                <p className="text-[12px] text-gray-500 capitalize">{record.role}</p>
                              </div>
                            </div>
                            <div>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border capitalize tracking-wide ${record.present_today ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${record.present_today ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                {record.present_today ? 'Present' : 'Absent'}
                              </span>
                            </div>
                          </div>
                          <div className="mt-2 grid grid-cols-3 gap-4 text-center items-center">
                            <div>
                              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5 flex items-center justify-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Clock In
                              </p>
                              <p className="text-[13px] font-semibold text-gray-800">{punchInTime}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5 flex items-center justify-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span> Clock Out
                              </p>
                              <p className="text-[13px] font-semibold text-gray-800">{punchOutTime}</p>
                            </div>
                            <div className="bg-gray-50 rounded py-1 px-2 border border-gray-100">
                              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Production</p>
                              <p className="text-[13px] font-bold text-gray-800">{hrsWorked}</p>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
                <div className="p-3 text-center border-t border-gray-100 bg-gray-50/50 rounded-b-xl">
                  <button onClick={() => navigate('/attendance')} className="text-[13px] font-semibold text-gray-800 hover:text-orange-500 transition-colors tracking-wide bg-white border border-gray-200 px-4 py-1.5 rounded shadow-sm">
                    View All Attendance
                  </button>
                </div>
              </div>

              {/* Attendance Overview Chart (Right Panel) */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col relative w-full p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-lg font-bold text-gray-800">Attendance Overview</h2>
                  <button className="bg-white border border-gray-200 text-gray-600 text-sm rounded px-3 py-1 flex items-center gap-1 shadow-sm">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    Today
                  </button>
                </div>

                {/* Gauge Chart SVG */}
                <div className="relative w-full flex justify-center mt-2 mb-2">
                  <svg viewBox="0 0 100 55" className="w-[85%] h-auto drop-shadow-sm overflow-visible">
                    {/* Background Track */}
                    <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#f3f4f6" strokeWidth="16" strokeLinecap="round" />

                    {attendanceOverview.total > 0 && (() => {
                      const C = 125.66; // Half circle length for r=40
                      const L_present = (attendanceOverview.present / attendanceOverview.total) * C;
                      const L_late = (attendanceOverview.late / attendanceOverview.total) * C;
                      const L_permission = (attendanceOverview.permission / attendanceOverview.total) * C;
                      const L_absent = (attendanceOverview.absent / attendanceOverview.total) * C;

                      return (
                        <>
                          <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#047857" strokeWidth="16" strokeLinecap="round" strokeDasharray={`${L_present} ${C}`} strokeDashoffset="0" />
                          <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#0f172a" strokeWidth="16" strokeDasharray={`${L_late} ${C}`} strokeDashoffset={`${-L_present}`} />
                          <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#fbbf24" strokeWidth="16" strokeDasharray={`${L_permission} ${C}`} strokeDashoffset={`${-(L_present + L_late)}`} />
                          <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#dc2626" strokeWidth="16" strokeLinecap="round" strokeDasharray={`${L_absent} ${C}`} strokeDashoffset={`${-(L_present + L_late + L_permission)}`} />
                        </>
                      );
                    })()}
                  </svg>
                  <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-center">
                    <p className="text-[11px] text-gray-500 font-bold uppercase tracking-wider whitespace-nowrap">Total</p>
                    <p className="text-[28px] leading-tight font-extrabold text-gray-800">{attendanceOverview.total}</p>
                  </div>
                </div>

                <div className="mt-8 space-y-3.5 mb-6">
                  <h3 className="text-[13px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2">Status</h3>

                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2.5">
                      <span className="w-3 h-3 rounded-full bg-emerald-600 shadow-sm"></span>
                      <span className="text-gray-700 font-semibold">Present</span>
                    </div>
                    <span className="font-bold text-gray-900 bg-gray-50 px-2 rounded">
                      {attendanceOverview.total > 0 ? Math.round((attendanceOverview.present / attendanceOverview.total) * 100) : 0}%
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2.5">
                      <span className="w-3 h-3 rounded-full bg-slate-900 shadow-sm"></span>
                      <span className="text-gray-700 font-semibold">Late</span>
                    </div>
                    <span className="font-bold text-gray-900 bg-gray-50 px-2 rounded">
                      {attendanceOverview.total > 0 ? Math.round((attendanceOverview.late / attendanceOverview.total) * 100) : 0}%
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2.5">
                      <span className="w-3 h-3 rounded-full bg-amber-400 shadow-sm"></span>
                      <span className="text-gray-700 font-semibold">Permission</span>
                    </div>
                    <span className="font-bold text-gray-900 bg-gray-50 px-2 rounded">
                      {attendanceOverview.total > 0 ? Math.round((attendanceOverview.permission / attendanceOverview.total) * 100) : 0}%
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2.5">
                      <span className="w-3 h-3 rounded-full bg-red-600 shadow-sm"></span>
                      <span className="text-gray-700 font-semibold">Absent</span>
                    </div>
                    <span className="font-bold text-gray-900 bg-gray-50 px-2 rounded">
                      {attendanceOverview.total > 0 ? Math.round((attendanceOverview.absent / attendanceOverview.total) * 100) : 0}%
                    </span>
                  </div>
                </div>

                <div className="mt-auto pt-5 border-t border-gray-100 flex items-center justify-between bg-white">
                  <div className="flex items-center gap-3">
                    <span className="text-[13px] font-semibold text-gray-800">Total Absentees</span>
                    <div className="flex -space-x-2">
                      <div className="w-6 h-6 rounded-full bg-red-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-red-600">{(attendanceOverview.absent || 0)}</div>
                    </div>
                  </div>
                  <a href="/attendance" className="text-[13px] font-bold text-orange-500 hover:text-orange-600 transition-colors">View Details</a>
                </div>
              </div>
            </div>
            {/* Assigned Calls & Statistics Graph Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Call Statistics Overview Chart (Opposite side / Left Panel) */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col relative w-full p-6 lg:col-span-1">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-lg font-bold text-gray-800">Tasks Statistics</h2>
                  <button className="bg-white border border-gray-200 text-gray-600 text-sm rounded px-3 py-1 flex items-center gap-1 shadow-sm">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    All Time
                  </button>
                </div>

                {/* Gauge Chart SVG */}
                <div className="relative w-full flex justify-center mt-2 mb-2">
                  <svg viewBox="0 0 100 55" className="w-[90%] h-auto drop-shadow-sm overflow-visible">
                    {/* Background Track */}
                    <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#f3f4f6" strokeWidth="16" strokeLinecap="round" />

                    {assignedCallsOverview.total > 0 && (() => {
                      const C = 125.66; // Half circle length for r=40
                      const L_pending = (assignedCallsOverview.pending / assignedCallsOverview.total) * C;
                      const L_completed = (assignedCallsOverview.completed / assignedCallsOverview.total) * C;

                      return (
                        <>
                          <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#f59e0b" strokeWidth="16" strokeLinecap="round" strokeDasharray={`${L_pending} ${C}`} strokeDashoffset="0" />
                          <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#10b981" strokeWidth="16" strokeLinecap="round" strokeDasharray={`${L_completed} ${C}`} strokeDashoffset={`${-L_pending}`} />
                        </>
                      );
                    })()}
                  </svg>
                  <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-center">
                    <p className="text-[11px] text-gray-500 font-bold uppercase tracking-wider whitespace-nowrap">Total Tasks</p>
                    <p className="text-[28px] leading-tight font-extrabold text-gray-800">{assignedCallsOverview.total}</p>
                  </div>
                </div>

                <div className="mt-8 space-y-3.5 mb-6">
                  <h3 className="text-[13px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2">Task Status</h3>

                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2.5">
                      <span className="w-3 h-3 rounded-full bg-amber-500 shadow-sm"></span>
                      <span className="text-gray-700 font-semibold">Pending / Ongoing</span>
                    </div>
                    <span className="font-bold text-gray-900 bg-gray-50 px-2 rounded">
                      {assignedCallsOverview.total > 0 ? Math.round((assignedCallsOverview.pending / assignedCallsOverview.total) * 100) : 0}%
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2.5">
                      <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm"></span>
                      <span className="text-gray-700 font-semibold">Completed</span>
                    </div>
                    <span className="font-bold text-gray-900 bg-gray-50 px-2 rounded">
                      {assignedCallsOverview.total > 0 ? Math.round((assignedCallsOverview.completed / assignedCallsOverview.total) * 100) : 0}%
                    </span>
                  </div>
                </div>

                <div className="mt-auto p-4 bg-gray-800 text-white rounded flex items-center justify-between">
                  <div>
                    <p className="text-xl font-bold text-emerald-400">{assignedCallsOverview.completed} / {assignedCallsOverview.total}</p>
                    <p className="text-[11px] font-medium text-gray-300">Total Calls Completed</p>
                  </div>
                </div>
              </div>

              {/* Projects/Assign Calls List (Right Panel) */}
              <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white rounded-t-xl z-10 sticky top-0">
                  <h2 className="text-lg font-bold text-gray-800">Assigned Calls (Projects)</h2>
                  <button className="bg-white border border-gray-200 text-gray-600 text-[13px] rounded px-2 py-1 flex items-center gap-1 shadow-sm">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    Latest
                  </button>
                </div>
                <div className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar md:max-h-[440px]">
                  {assignedCalls.length === 0 ? (
                    <div className="p-8 text-center text-sm text-gray-400">Loading call data...</div>
                  ) : (
                    <table className="min-w-full divide-y divide-gray-100">
                      <thead className="bg-white sticky top-0 z-10 hidden md:table-header-group">
                        <tr>
                          <th className="px-6 py-3 text-left text-[12px] font-bold text-gray-400 uppercase tracking-wider">ID</th>
                          <th className="px-6 py-3 text-left text-[12px] font-bold text-gray-400 uppercase tracking-wider">Dairy / Problem</th>
                          <th className="px-6 py-3 text-left text-[12px] font-bold text-gray-400 uppercase tracking-wider">Engineer</th>
                          <th className="px-6 py-3 text-left text-[12px] font-bold text-gray-400 uppercase tracking-wider">Date</th>
                          <th className="px-6 py-3 text-left text-[12px] font-bold text-gray-400 uppercase tracking-wider">Status</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-50 text-[13px]">
                        {assignedCalls.slice(0, 15).map((call, idx) => (
                          <tr key={idx} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-500">#{call.call_id || idx + 1}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <p className="font-bold text-gray-800">{call.dairy_name || 'N/A'}</p>
                              <p className="text-gray-500 text-[11px] truncate max-w-[200px]" title={call.problem}>{call.problem}</p>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-blue-800 uppercase">
                                  {(call.engineer_name || call.name || 'E').charAt(0)}
                                </div>
                                <span className="font-semibold text-gray-700">{call.engineer_name || call.name || 'Unassigned'}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                              {call.created_at ? new Date(call.created_at).toLocaleDateString() : 'N/A'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${(call.status || '').toLowerCase() === 'completed' || (call.status || '').toLowerCase() === 'resolved'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-amber-100 text-amber-700'
                                }`}>
                                {call.status || 'Pending'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
                <div className="p-3 text-center border-t border-gray-100 bg-gray-50/50 rounded-b-xl">
                  <button onClick={() => navigate('/assign-call')} className="text-[13px] font-semibold text-gray-800 hover:text-orange-500 transition-colors tracking-wide bg-white border border-gray-200 px-4 py-1.5 rounded shadow-sm">
                    View All Calls
                  </button>
                </div>
              </div>
            </div>

          </div>
        </main>
      </div>
      <SocietyMasterModal isOpen={isSocietyMasterOpen} onClose={() => setIsSocietyMasterOpen(false)} />
    </div>
  );
};

export default Admin;
