import React, { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import axios from 'axios';

// Note: the project already has Navbar and Sidebar components at client/src/components

function AttendancePage() {
  const [group, setGroup] = useState('day');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [report, setReport] = useState({});
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  // punch state
  const [punchLoading, setPunchLoading] = useState(false);
  const [latestPunch, setLatestPunch] = useState(null);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  const getAuthHeaders = () => {
    try {
      const raw = localStorage.getItem('user') || localStorage.getItem('currentUser');
      if (!raw) return { id: null, headers: {} };
      const p = JSON.parse(raw);
      const u = p?.user ?? p?.data ?? p;
      const id = u?.id ?? u?.userId ?? null;
      if (!id) return { id: null, headers: {} };
      return { id: String(id), headers: { 'x-user-id': String(id) } };
    } catch {
      return { id: null, headers: {} };
    }
  };

  const fetchReport = async () => {
  setLoading(true);
  try {
    // Fetch per-user summary (workedDays, leaveDays, present today)
    const params = {};
    // if current user is employee/engineer, show only their own report
    try {
      const raw = localStorage.getItem('user');
      if (raw) {
        const u = JSON.parse(raw);
        setCurrentUser(u);
        const role = (u.role || '').toLowerCase();
        if (role === 'employee' || role === 'engineer') params.userId = u.id;
      }
    } catch (e) {
      // ignore
    }
    if (start) params.start = start;
    if (end) params.end = end;
    // choose endpoint: for single-user summary use /summary, else use summary/all
    let res;
      if (params.userId) {
      // fetch per-user summary for the month range
      const s = params.start;
      const e = params.end;
      // call /api/attendance/summary?userId=...&month=YYYY-MM
      // derive month from start
      const month = s ? s.slice(0,7) : new Date().toISOString().slice(0,7);
  const { id, headers } = getAuthHeaders();
  if (!id) console.warn('fetchReport: no user id found in localStorage');
  // ensure the server can also accept ?userId as a fallback
  const reqParams = { userId: params.userId, month };
  if (!headers || !headers['x-user-id']) reqParams.userId = params.userId;
  console.debug('fetchReport: calling summary with', { params: reqParams, headers });
  res = await axios.get(`${API_URL}/api/attendance/summary`, { params: reqParams, headers });
  const data = res.data;
      if (data.success) {
        // normalize to an array shape compatible with table (one row)
        setReport([{ user_id: data.userId, name: currentUser?.name ?? 'You', role: currentUser?.role ?? '', worked_days: data.workedDays, leave_days: data.leaveDays, present_today: null, today_punch_in: null, today_punch_out: null }]);
      } else {
        setReport([]);
      }
      setLoading(false);
      return;
    } else {
      const { id, headers } = getAuthHeaders();
      if (!id) console.warn('fetchReport: no user id found in localStorage');
      const reqParams = { ...params };
      // attach userId fallback when header missing
      if (!headers || !headers['x-user-id']) reqParams.userId = reqParams.userId ?? id;
  console.debug('fetchReport: calling summary/all with', { params: reqParams, headers });
  res = await axios.get(`${API_URL}/api/attendance/summary/all`, { params: reqParams, headers });
    }
    const data = res.data;
    if (data.success) {
      let rows = data.data || [];
      try {
        // if current user is HR, hide admin rows
        const raw = localStorage.getItem('user');
        if (raw) {
          const u = JSON.parse(raw);
          if ((u.role || '').toString().toLowerCase() === 'hr') {
            rows = (rows || []).filter(r => (r.role || '').toString().toLowerCase() !== 'admin');
          }
        }
      } catch (e) {
        // ignore parse errors
      }
      setReport(rows);
    } else {
      setReport([]);
    }
  } catch (err) {
    console.error(err);
  } finally {
    setLoading(false);
  }
};

  // Fetch raw attendance records (admin/HR) for the selected range and optional user
  const [rawRecords, setRawRecords] = useState([]);
  const [showRaw, setShowRaw] = useState(false);

  const fetchRawRecords = async () => {
    try {
      const params = {};
      if (start) params.start = start;
      if (end) params.end = end;
      // if user selected a specific user (current user), include userId
      const stored = localStorage.getItem('user');
      if (stored) {
        const u = JSON.parse(stored);
        if ((u.role || '').toLowerCase() === 'admin' || (u.role || '').toLowerCase() === 'hr') {
          // admin/HR can fetch all; optionally filter by a selected user
        } else {
          params.userId = u.id;
        }
      }
      const { id, headers } = getAuthHeaders();
      if (!id) console.warn('fetchRawRecords: no user id found in localStorage');
      const reqParams = { ...params };
      if (!headers || !headers['x-user-id']) reqParams.userId = reqParams.userId ?? id;
  console.debug('fetchRawRecords: calling records with', { params: reqParams, headers });
  const res = await axios.get(`${API_URL}/api/attendance/records`, { params: reqParams, headers });
      setRawRecords(res.data.rows || []);
    } catch (err) {
      console.error('Failed to fetch raw attendance records', err?.response?.data ?? err);
      setRawRecords([]);
    }
  };


  function getStoredUserId() {
    try {
      const raw = localStorage.getItem("user") || localStorage.getItem("currentUser");
      if (!raw) return null;
      const p = JSON.parse(raw);
      const u = p?.user ?? p?.data ?? p;
      return u?.id ?? u?.userId ?? u?._id ?? null;
    } catch {
      return null;
    }
  }

  async function fetchLatestPunch(forDate = null) {
    const userId = getStoredUserId();
    if (!userId) { setLatestPunch(null); return; }
    const date = forDate ?? new Date().toISOString().slice(0, 10);
    try {
      const { id, headers } = getAuthHeaders();
      const reqParams = { userId, start: date, end: date };
      if (!headers || !headers['x-user-id']) reqParams.userId = userId;
  console.debug('fetchLatestPunch: calling report with', { params: reqParams, headers });
  const res = await axios.get(`${API_URL}/api/attendance/report`, { params: reqParams, headers });
      const data = res.data;
      let row = null;
      // handle different response shapes defensively
      if (Array.isArray(data) && data.length) row = data[0];
      else if (data && Array.isArray(data.rows) && data.rows.length) row = data.rows[0];
      else if (data && typeof data === "object") row = data;
      setLatestPunch(row);
    } catch (err) {
      console.error("Failed to fetch latest punch:", err?.response?.data ?? err);
      setLatestPunch(null);
    }
  }

  async function handlePunch(type) {
    const userId = getStoredUserId();
    if (!userId) { alert("User not found. Please login."); return; }
    setPunchLoading(true);

    // optimistic UI update using client timestamp for immediate feedback
    const nowIso = new Date().toISOString().replace("T", " ").split(".")[0]; // "YYYY-MM-DD HH:MM:SS"
    setLatestPunch((prev) => {
      const day = nowIso.slice(0, 10);
      if (!prev) {
        return type === "in"
          ? { day, punch_in: nowIso, punch_out: null }
          : { day, punch_in: null, punch_out: nowIso };
      }
      return { ...prev, ...(type === "in" ? { punch_in: nowIso } : { punch_out: nowIso }) };
    });

    try {
      // Determine current user's role. For HR/Admin we intentionally DO NOT include location.
      let role = null;
      try {
        const raw = localStorage.getItem('user') || localStorage.getItem('currentUser');
        if (raw) {
          const p = JSON.parse(raw);
          const u = p?.user ?? p?.data ?? p;
          role = (u?.role || '').toString().toLowerCase();
        }
      } catch (e) {
        // ignore parse errors
      }

      const payload = { userId, type };
      if (role !== 'hr' && role !== 'admin') {
        // try to get current location (graceful, non-blocking if denied) only for non-HR/admin
        const getCurrentLocation = (timeoutMs = 5000) => new Promise((resolve) => {
          if (!navigator?.geolocation) return resolve(null);
          let resolved = false;
          const onSuccess = (pos) => { if (!resolved) { resolved = true; resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }); } };
          const onError = () => { if (!resolved) { resolved = true; resolve(null); } };
          navigator.geolocation.getCurrentPosition(onSuccess, onError, { timeout: timeoutMs });
          // fallback timeout
          setTimeout(() => { if (!resolved) { resolved = true; resolve(null); } }, timeoutMs + 200);
        });

        const loc = await getCurrentLocation(5000);
        if (loc) { payload.latitude = loc.latitude; payload.longitude = loc.longitude; }
      }
  const { id, headers } = getAuthHeaders();
  if (!id) console.warn('handlePunch: no user id found in localStorage');
  console.debug('handlePunch: sending punch', { payload, headers });
  const res = await axios.post(`${API_URL}/api/attendance/punch`, payload, { headers });
      const att = res?.data?.attendance ?? res?.data;

      // if backend returned created_at and type, use it to reconcile exact server time
      if (att && att.created_at) {
        setLatestPunch((prev) => {
          const created = att.created_at;
          if (!prev) {
            return type === "in"
              ? { day: created.slice(0, 10), punch_in: created, punch_out: null }
              : { day: created.slice(0, 10), punch_in: null, punch_out: created };
          }
          return { ...prev, ...(att.type === "in" || type === "in" ? { punch_in: created } : { punch_out: created }) };
        });
      } else {
        // fallback: re-fetch canonical data for today
        await fetchLatestPunch();
      }

      await fetchReport();
      alert(res?.data?.message ?? "Punch saved");
    } catch (err) {
      console.error("Punch error:", err?.response?.data ?? err);
      const msg = err?.response?.data?.message ?? err?.message ?? "Punch failed";
      alert(msg);
      // revert optimistic update by reloading from server
      await fetchLatestPunch();
    } finally {
      setPunchLoading(false);
    }
  }

  useEffect(() => {
    // default to last 7 days
    const d = new Date();
    const dd = new Date(d.getTime() - 6 * 24 * 60 * 60 * 1000);
    const toISO = (dt) => dt.toISOString().slice(0, 10);
    setStart(toISO(dd));
    setEnd(toISO(d));
    // fetch today's latest punch after dates set
    // small timeout so start/end update first
    setTimeout(() => fetchLatestPunch(), 200);
  }, []);

  useEffect(() => {
    if (start && end) fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, end, group]);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Navbar />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 p-8">
          <div className="max-w-7xl mx-auto">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8">
              <div>
                <h1 className="text-3xl font-bold text-gray-800">Attendance Dashboard</h1>
                <p className="mt-1 text-gray-600">Track and manage attendance records</p>
              </div>
              <div className="mt-4 md:mt-0 flex flex-wrap items-center gap-3">
                <button
                  onClick={() => handlePunch('in')}
                  disabled={punchLoading}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                  Punch In
                </button>
                <button
                  onClick={() => handlePunch('out')}
                  disabled={punchLoading}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Punch Out
                </button>
              </div>
            </div>

            {/* Date Range & Controls */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">Date Range</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Start Date</label>
                    <input 
                      type="date" 
                      value={start} 
                      onChange={(e) => setStart(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">End Date</label>
                    <input 
                      type="date" 
                      value={end} 
                      onChange={(e) => setEnd(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">View Options</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Group By</label>
                    <select 
                      value={group} 
                      onChange={(e) => setGroup(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="day">Daily</option>
                      <option value="week">Weekly</option>
                      <option value="month">Monthly</option>
                    </select>
                  </div>
                  <button 
                    onClick={fetchReport}
                    className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                  >
                    Generate Report
                  </button>
                </div>
              </div>
            </div>

            {/* Today's Punch Status */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-2 w-2 rounded-full bg-green-500"></div>
                <h2 className="text-lg font-semibold text-gray-800">Today's Status</h2>
              </div>
              {latestPunch ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-green-50 rounded-lg p-4 border border-green-100">
                    <div className="text-sm text-gray-600 mb-1">Punch In Time</div>
                    <div className="text-xl font-semibold text-gray-800">
                      {latestPunch.punch_in ?? '-'}
                    </div>
                  </div>
                  <div className="bg-red-50 rounded-lg p-4 border border-red-100">
                    <div className="text-sm text-gray-600 mb-1">Punch Out Time</div>
                    <div className="text-xl font-semibold text-gray-800">
                      {latestPunch.punch_out ?? '-'}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No punch records for today
                </div>
              )}
            </div>

            {/* Attendance Report */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-semibold text-gray-800">Attendance Report</h2>
                  <button 
                    onClick={() => { setShowRaw(v => !v); if (!showRaw) fetchRawRecords(); }}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 text-sm font-medium transition-colors"
                  >
                    {showRaw ? 'Hide' : 'Show'} Raw Records
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
                  <p className="mt-4 text-gray-600">Loading report...</p>
                </div>
              ) : !report || report.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-gray-500">No attendance records found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Work Days</th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Leave Days</th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {Array.isArray(report) && report.map((r) => (
                        <tr key={r.user_id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                                <span className="text-blue-600 font-medium">
                                  {(r.name?.[0] || 'U').toUpperCase()
                                }</span>
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900">{r.name}</div>
                                <div className="text-sm text-gray-500">ID: {r.user_id}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                              {r.role}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{r.worked_days}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{r.leave_days}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              r.present_today 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {r.present_today ? 'Present' : 'Absent'}
                            </span>
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
    </div>
   );
 }

 export default AttendancePage;
