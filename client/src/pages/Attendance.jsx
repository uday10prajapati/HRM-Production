import React, { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import { useNavigate } from "react-router-dom";

import axios from 'axios';

// Note: the project already has Navbar and Sidebar components at client/src/components

function AttendancePage() {
  const [group, setGroup] = useState('day');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [report, setReport] = useState({});
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  const navigate = useNavigate();


  // punch state
  const [punchLoading, setPunchLoading] = useState(false);
  const [latestPunch, setLatestPunch] = useState(null);

  // Requests modal state
  const [showRequestsModal, setShowRequestsModal] = useState(false);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [editingTime, setEditingTime] = useState({});

  // Use relative API paths (requests target /api/...)

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
        const month = s ? s.slice(0, 7) : new Date().toISOString().slice(0, 7);
        const { id, headers } = getAuthHeaders();
        if (!id) console.warn('fetchReport: no user id found in localStorage');
        // ensure the server can also accept ?userId as a fallback
        const reqParams = { userId: params.userId, month };
        if (!headers || !headers['x-user-id']) reqParams.userId = params.userId;
        console.debug('fetchReport: calling summary with', { params: reqParams, headers });
        res = await axios.get('/api/attendance/summary', { params: reqParams, headers });
        const data = res.data;
        if (data.success) {
          // normalize to an array shape compatible with table (one row)
          setReport([{
            user_id: data.userId,
            name: currentUser?.name ?? 'You',
            role: currentUser?.role ?? '',
            worked_days: data.workedDays,
            leave_days: data.leaveDays,
            punch_in: data.punch_in ?? '-',
            punch_out: data.punch_out ?? '-',
            present_today: data.present_today ?? false,
            status: data.present_today ? 'Present' : 'Absent'
          }]);
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
        res = await axios.get('/api/attendance/summary/all', { params: reqParams, headers });
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
        // Map backend response fields to frontend display fields
        rows = rows.map(r => ({
          ...r,
          punch_in: r.punch_in ?? '-',
          punch_out: r.punch_out ?? '-',
          status: r.status ?? (r.present_today ? 'Present' : 'Absent')
        }));
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
      const res = await axios.get('/api/attendance/records', { params: reqParams, headers });
      setRawRecords(res.data.rows || []);
    } catch (err) {
      console.error('Failed to fetch raw attendance records', err?.response?.data ?? err);
      setRawRecords([]);
    }
  };

  const fetchRequests = async () => {
    try {
      const { id, headers } = getAuthHeaders();
      const res = await axios.get('/api/attendance/requests', { headers });
      setPendingRequests(res.data.rows || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (showRequestsModal) fetchRequests();
  }, [showRequestsModal]);

  const handleResolveRequest = async (reqId, action) => {
    try {
      const { headers } = getAuthHeaders();
      const payload = { action };
      if (action === 'approve' && editingTime[reqId]) {
        // use specific time if HR edited it
        const reqObj = pendingRequests.find(r => r.id === reqId);
        // build ISO from reqObj.raw_created_at date part + editingTime[reqId]
        if (reqObj) {
          const ymd = new Date(reqObj.raw_created_at || reqObj.requested_time).toISOString().split('T')[0];
          payload.edited_time = new Date(`${ymd}T${editingTime[reqId]}`).toISOString();
        }
      }

      const res = await axios.post(`/api/attendance/requests/${reqId}/resolve`, payload, { headers });
      if (res.data.success) {
        alert(`Request ${action}d successfully`);
        fetchRequests();
      }
    } catch (err) {
      console.error(err);
      alert('Failed to resolve request');
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
      const res = await axios.get('/api/attendance/report', { params: reqParams, headers });
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
    
    // Validation: Check if already punched in/out today
    if (latestPunch) {
      if (type === 'in' && latestPunch.punch_in) {
        alert('You have already punched in today. Only one punch in per day is allowed.');
        return;
      }
      if (type === 'out' && latestPunch.punch_out) {
        alert('You have already punched out today. Only one punch out per day is allowed.');
        return;
      }
      if (type === 'out' && !latestPunch.punch_in) {
        alert('You must punch in first before punching out.');
        return;
      }
    }
    
    setPunchLoading(true);

    // optimistic UI update using client timestamp for immediate feedback
    const now = new Date();
    // approximate IST offset (+5:30) for optimistic rendering
    const istTime = new Date(now.getTime() + (330 + now.getTimezoneOffset()) * 60000);
    const hours = istTime.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    const nowIso = istTime.getFullYear() + "-" +
      String(istTime.getMonth() + 1).padStart(2, '0') + "-" +
      String(istTime.getDate()).padStart(2, '0') + " " +
      String(hours12).padStart(2, '0') + ":" +
      String(istTime.getMinutes()).padStart(2, '0') + ":" +
      String(istTime.getSeconds()).padStart(2, '0') + " " + ampm;
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

      const payload = { userId, type, punch_type: type };
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
      const res = await axios.post('/api/attendance/punch', payload, { headers });
      const att = res?.data?.attendance ?? res?.data;

      // if backend returned created_at and type, use it to reconcile exact server time
      if (att && att.created_at_ist) {
        setLatestPunch((prev) => {
          const created = att.created_at_ist;
          if (!prev) {
            return type === "in"
              ? { date: created.slice(0, 10), punch_in: created, punch_out: null }
              : { date: created.slice(0, 10), punch_in: null, punch_out: created };
          }
          return { ...prev, ...(att.punch_type === "in" || type === "in" ? { punch_in: created } : { punch_out: created }) };
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
    <div className="min-h-screen flex flex-col bg-slate-50/50">
      <div className="fixed top-0 w-full z-50"><Navbar /></div>
      <div className="flex flex-1 pt-16 overflow-hidden">
        <div className="fixed left-0 h-full w-64 hidden md:block"><Sidebar /></div>

        <main className="flex-1 md:ml-64 p-4 sm:p-8 relative overflow-y-auto w-full custom-scrollbar">

          {/* Background Pattern */}
          <div className="absolute inset-x-0 top-0 h-96 bg-gradient-to-b from-indigo-50/80 to-transparent pointer-events-none -z-10" />

          <div className="max-w-7xl mx-auto space-y-8 animate-[fadeIn_0.3s_ease-out]">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2 mb-8">
              <div>
                <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Attendance Dashboard</h1>
                <p className="text-sm font-medium text-slate-500 mt-2">Track and manage daily attendance records and shifts.</p>
              </div>
              <div className="mt-4 md:mt-0 flex flex-wrap items-center gap-3">
                <button
                  onClick={() => handlePunch('in')}
                  disabled={punchLoading || (latestPunch && latestPunch.punch_in)}
                  title={latestPunch && latestPunch.punch_in ? 'Already punched in today' : ''}
                  className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl transition-all flex items-center gap-2 shadow-md shadow-emerald-500/20 hover:shadow-lg hover:shadow-emerald-500/40 hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-md"
                >
                  <svg className="w-5 h-5 -ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                  Punch In
                </button>
                <button
                  onClick={() => handlePunch('out')}
                  disabled={punchLoading || (latestPunch && latestPunch.punch_out) || !latestPunch || !latestPunch.punch_in}
                  title={latestPunch && latestPunch.punch_out ? 'Already punched out today' : !latestPunch || !latestPunch.punch_in ? 'Punch in first' : ''}
                  className="px-5 py-2.5 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl transition-all flex items-center gap-2 shadow-md shadow-rose-500/20 hover:shadow-lg hover:shadow-rose-500/40 hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-md"
                >
                  <svg className="w-5 h-5 -ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 16l4-4m0 0l4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Punch Out
                </button>
                <button
                  onClick={() => setShowRequestsModal(true)}
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl transition-all flex items-center gap-2 shadow-md shadow-amber-500/20 hover:shadow-lg hover:shadow-amber-500/40 hover:-translate-y-0.5"
                >
                  <svg className="w-5 h-5 -ml-1" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                  Reports
                </button>
              </div>
            </div>

            {/* Controls Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Date Range Card */}
              <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-[0_2px_24px_-4px_rgba(0,0,0,0.05)] border border-slate-100 flex flex-col justify-center">
                <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                  Date Range
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Start Date</label>
                    <input
                      type="date"
                      value={start}
                      onChange={(e) => setStart(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-700 rounded-xl focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all cursor-pointer shadow-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">End Date</label>
                    <input
                      type="date"
                      value={end}
                      onChange={(e) => setEnd(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-700 rounded-xl focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all cursor-pointer shadow-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Generation Options Card */}
              <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-[0_2px_24px_-4px_rgba(0,0,0,0.05)] border border-slate-100 flex flex-col justify-center">
                <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"></path></svg>
                  View Options
                </h2>
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Group By</label>
                    <select
                      value={group}
                      onChange={(e) => setGroup(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-700 rounded-xl focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all cursor-pointer shadow-sm"
                    >
                      <option value="day">Daily</option>
                      <option value="week">Weekly</option>
                      <option value="month">Monthly</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={fetchReport}
                      className="w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-md shadow-indigo-500/20 hover:shadow-lg hover:shadow-indigo-500/40 hover:-translate-y-0.5"
                    >
                      Generate Report
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Today's Punch Status Container */}
            <div className="bg-white rounded-3xl shadow-[0_2px_24px_-4px_rgba(0,0,0,0.05)] border border-slate-100 overflow-hidden relative">
              <div className="p-6 sm:p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                  </div>
                  <h2 className="text-lg font-bold text-slate-800">Today's Pulse</h2>
                </div>
                {latestPunch ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/30 p-5 rounded-2xl border border-emerald-100 relative overflow-hidden group">
                      <div className="absolute -right-4 -bottom-4 opacity-10 text-emerald-600 group-hover:scale-110 transition-transform">
                        <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.2 3.2.8-1.3-4.5-2.7V7z" /></svg>
                      </div>
                      <div className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" /></svg>
                        Punch In Time
                      </div>
                      <div className="text-2xl font-black text-emerald-900 mt-1">
                        {latestPunch.punch_in ?? '--:--'}
                      </div>
                    </div>
                    <div className="bg-gradient-to-br from-rose-50 to-rose-100/30 p-5 rounded-2xl border border-rose-100 relative overflow-hidden group">
                      <div className="absolute -right-4 -bottom-4 opacity-10 text-rose-600 group-hover:scale-110 transition-transform">
                        <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.2 3.2.8-1.3-4.5-2.7V7z" /></svg>
                      </div>
                      <div className="text-xs font-bold text-rose-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 16l4-4m0 0l4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                        Punch Out Time
                      </div>
                      <div className="text-2xl font-black text-rose-900 mt-1">
                        {latestPunch.punch_out ?? '--:--'}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-10 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm text-slate-400">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    </div>
                    <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">No pulse records yet today.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Attendance Report Card */}
            <div className="bg-white rounded-3xl shadow-[0_2px_24px_-4px_rgba(0,0,0,0.05)] border border-slate-100 overflow-hidden">
              <div className="p-6 sm:p-8 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                  Attendance Summary
                </h2>
                <button
                  onClick={() => { setShowRaw(v => !v); if (!showRaw) fetchRawRecords(); }}
                  className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 hover:text-indigo-600 rounded-lg text-slate-600 text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                  {showRaw ? 'Hide Logs' : 'View Deep Logs'}
                </button>
              </div>

              {loading ? (
                <div className="p-16 text-center flex flex-col items-center justify-center">
                  <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mb-4">
                    <svg className="animate-spin h-8 w-8 text-indigo-500" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  </div>
                  <span className="text-sm font-bold text-slate-500 uppercase tracking-widest">Aggregating Data...</span>
                </div>
              ) : !report || report.length === 0 ? (
                <div className="p-16 text-center flex flex-col items-center justify-center bg-slate-50/50 m-6 rounded-2xl border border-dashed border-slate-200">
                  <svg className="w-12 h-12 text-slate-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
                  <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No attendance records found</p>
                </div>
              ) : (
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50 border-b border-slate-100">
                        <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">User Identity</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Designation</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Work Days</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Leave Days</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Punch In</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Punch Out</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {Array.isArray(report) && report.map((r, i) => (
                        <tr key={r.user_id || i} className="hover:bg-indigo-50/30 transition-colors group">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-4">
                              <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center group-hover:bg-indigo-600 transition-colors">
                                <span className="text-indigo-600 font-bold group-hover:text-white transition-colors">
                                  {(r.name?.[0] || 'U').toUpperCase()}
                                </span>
                              </div>
                              <div>
                                <div className="text-sm font-bold text-slate-900">{r.name}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-3 py-1 inline-flex text-xs leading-5 font-bold rounded-lg bg-slate-100 text-slate-600 border border-slate-200">
                              {r.role || 'Personnel'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-700">{r.worked_days ?? 0}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-700">{r.leave_days ?? 0}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-700">{r.punch_in ?? '-'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-700">{r.punch_out ?? '-'}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className={`px-3 py-1 inline-flex text-xs leading-5 font-bold rounded-lg border ${r.status === 'Present'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-slate-50 text-slate-600 border-slate-200'
                                }`}>
                                {r.status ?? 'Absent'}
                              </span>
                              {r.is_half_day && (
                                <span className="px-3 py-1 inline-flex text-xs leading-5 font-bold rounded-lg border bg-orange-50 text-orange-700 border-orange-200">
                                  Half Day
                                </span>
                              )}
                              {r.delay_time && (
                                <span className="px-3 py-1 inline-flex text-[10px] leading-5 font-bold rounded-lg border bg-red-50 text-red-600 border-red-200 truncate max-w-[120px]" title={r.delay_time}>
                                  {r.delay_time}
                                </span>
                              )}
                            </div>
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

      {/* Missed Punch Requests Modal */}
      {showRequestsModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex justify-center items-center px-4 overflow-y-auto">
          <div className="bg-white max-w-3xl w-full rounded-3xl p-6 md:p-8 shadow-2xl relative my-8">
            <button onClick={() => setShowRequestsModal(false)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 p-2 rounded-full transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>

            <h2 className="text-2xl font-bold text-slate-800 mb-2 flex items-center gap-2">
              <svg className="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
              Pending Missed Punch Reports
            </h2>
            <p className="text-sm font-medium text-slate-500 mb-6">Review and resolve forgotten punch-in requests from personnel.</p>

            <div className="flex flex-col gap-4 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
              {pendingRequests.length === 0 ? (
                <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <p className="text-slate-400 font-bold">No pending reports found.</p>
                </div>
              ) : pendingRequests.map(req => {
                // Extract time for edit input
                const reqTimeIso = new Date(req.raw_created_at || req.requested_time).toISOString();
                const defaultTimeStr = reqTimeIso.substring(11, 16);

                return (
                  <div key={req.id} className="bg-white border text-sm border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-indigo-100 text-indigo-600 rounded-full font-bold flex items-center justify-center">
                          {(req.user_name?.[0] || 'U').toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-slate-800">{req.user_name}</div>
                          <div className="text-xs text-slate-500 font-semibold uppercase">{req.role}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-1 text-[11px] font-extrabold uppercase rounded-lg ${req.punch_type === 'in' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                          PUNCH {req.punch_type}
                        </span>
                        <span className="text-slate-400 font-medium text-xs">
                          {new Date(req.raw_created_at || req.requested_time).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <div className="bg-slate-50 rounded-xl p-4 mb-4 border border-slate-100">
                      <div className="mb-3">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Reason/Note</div>
                        <div className="text-slate-700 italic font-medium text-sm">"{req.notes}"</div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Requested Time:</div>
                        <input
                          type="time"
                          value={editingTime[req.id] !== undefined ? editingTime[req.id] : defaultTimeStr}
                          onChange={(e) => setEditingTime({ ...editingTime, [req.id]: e.target.value })}
                          className="bg-white border border-slate-200 text-slate-800 text-xs font-bold rounded-lg px-3 py-1.5 focus:border-indigo-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 justify-end">
                      <button onClick={() => handleResolveRequest(req.id, 'reject')} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors text-xs">
                        Reject
                      </button>
                      <button onClick={() => handleResolveRequest(req.id, 'approve')} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl transition-colors text-xs shadow-md shadow-emerald-500/20">
                        Approve Punch
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default AttendancePage;
