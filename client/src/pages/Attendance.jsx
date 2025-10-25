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
    <div className="flex flex-col h-screen">
      <Navbar />
      <div className="flex flex-1 min-h-screen">
        <Sidebar />
        <main className="flex-1 p-6 bg-gray-100 overflow-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-semibold">Attendance Reports</h1>
            <div className="flex gap-2">
              <button
                onClick={() => handlePunch('in')}
                disabled={punchLoading}
                className="px-3 py-1 bg-green-600 text-white rounded"
              >
                Punch In
              </button>
              <button
                onClick={() => handlePunch('out')}
                disabled={punchLoading}
                className="px-3 py-1 bg-red-600 text-white rounded"
              >
                Punch Out
              </button>
              {(() => {
                try {
                  const raw = localStorage.getItem('user') || localStorage.getItem('currentUser');
                  if (raw) {
                    const p = JSON.parse(raw);
                    const u = p?.user ?? p?.data ?? p;
                    const role = (u?.role || '').toString().toLowerCase();
                    if (role === 'hr' || role === 'admin') {
                      return <div className="text-xs text-gray-500 self-center">(Your punches will not include location)</div>;
                    }
                  }
                } catch (e) {}
                return null;
              })()}
               <select value={group} onChange={(e) => setGroup(e.target.value)} className="px-3 py-2 rounded border">
                 <option value="day">Daily</option>
                 <option value="week">Weekly</option>
                 <option value="month">Monthly</option>
               </select>
             </div>
           </div>

           <div className="bg-white rounded shadow p-4 mb-4">
             <div className="flex gap-2 items-center">
               <label className="text-sm">Start:</label>
               <input className="border px-2 py-1 rounded" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
               <label className="text-sm">End:</label>
               <input className="border px-2 py-1 rounded" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
               <button onClick={fetchReport} className="px-3 py-1 bg-indigo-600 text-white rounded">Refresh</button>
             </div>
           </div>

           

          {/* Today's punch times */}
          <div className="mt-6 bg-white rounded-2xl shadow-md p-5 border border-gray-100">
  <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
    <span className="inline-block w-2 h-2 bg-green-500 rounded-full"></span>
    Today’s Attendance
  </h3>

  {latestPunch ? (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-gray-700">
      <div className="p-3 bg-green-50 rounded-lg border border-green-100">
        <div className="text-xs text-gray-500 uppercase">Punch In</div>
        <div className="text-base font-semibold text-green-700 mt-1">
          {latestPunch.punch_in ?? latestPunch.punchIn ?? latestPunch.in ?? "-"}
        </div>
      </div>

      <div className="p-3 bg-red-50 rounded-lg border border-red-100">
        <div className="text-xs text-gray-500 uppercase">Punch Out</div>
        <div className="text-base font-semibold text-red-700 mt-1">
          {latestPunch.punch_out ?? latestPunch.punchOut ?? latestPunch.out ?? "-"}
        </div>
      </div>

      <div className="col-span-full mt-2 text-xs text-gray-500 text-right">
          Date: {latestPunch.day ?? latestPunch.date ?? new Date().toISOString().slice(0, 10)}
        </div>
    </div>
  ) : (
    <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg border border-dashed border-gray-200 text-center">
      No punches recorded for today.
    </div>
  )}
</div>

          {/* Report table */}
          <div className="mt-6 bg-white rounded shadow p-4">
            <h2 className="text-lg font-semibold mb-3">Attendance Report</h2>
            <div className="mb-3 flex gap-2 items-center">
              <button onClick={() => { setShowRaw(v => !v); if (!showRaw) fetchRawRecords(); }} className="px-3 py-1 bg-gray-200 rounded">{showRaw ? 'Hide' : 'Show'} Raw Records</button>
            </div>
            {loading ? (
              <div className="text-gray-500">Loading...</div>
            ) : !report || report.length === 0 ? (
              <div className="text-gray-500">No records</div>
            ) : (
              <>
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="py-2 px-3 text-left">User</th>
                      <th className="py-2 px-3 text-left">Role</th>
                      <th className="py-2 px-3 text-left">Work Days</th>
                      <th className="py-2 px-3 text-left">Leave Days</th>
                      <th className="py-2 px-3 text-left">Present Today</th>
                      <th className="py-2 px-3 text-left">Today Punch In</th>
                      <th className="py-2 px-3 text-left">Today Punch Out</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.isArray(report) && report.map((r) => (
                      <tr key={r.user_id} className="border-t hover:bg-gray-50">
                        <td className="py-2 px-3">{r.name ?? 'User ' + r.user_id}</td>
                        <td className="py-2 px-3">{r.role ?? '-'}</td>
                        <td className="py-2 px-3">{r.worked_days ?? 0}</td>
                        <td className="py-2 px-3">{r.leave_days ?? 0}</td>
                        <td className="py-2 px-3">{r.present_today ? 'Yes' : 'No'}</td>
                        <td className="py-2 px-3">{r.today_punch_in ?? '-'}</td>
                        <td className="py-2 px-3">{r.today_punch_out ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {showRaw && (
                <div className="mt-6 bg-white rounded shadow p-4">
                  <h3 className="text-md font-semibold mb-2">Raw Attendance Records</h3>
                  {rawRecords.length === 0 ? (
                    <div className="text-gray-500">No records</div>
                  ) : (
                    <div className="overflow-auto max-h-96">
                      <table className="min-w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="py-2 px-3">When</th>
                            <th className="py-2 px-3">User</th>
                            <th className="py-2 px-3">Role</th>
                            <th className="py-2 px-3">Type</th>
                            <th className="py-2 px-3">Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rawRecords.map(r => (
                            <tr key={r.id} className="border-t hover:bg-gray-50">
                              <td className="py-2 px-3">{r.created_at}</td>
                              <td className="py-2 px-3">{r.user_name ?? r.user_id}</td>
                              <td className="py-2 px-3">{r.user_role ?? ''}</td>
                              <td className="py-2 px-3">{r.type}</td>
                              <td className="py-2 px-3">{r.notes ?? ''}</td>
                              <td className="py-2 px-3">
                                {r.latitude && r.longitude ? (
                                  <button
                                    onClick={() => window.open(`https://www.google.com/maps?q=${r.latitude},${r.longitude}`, '_blank')}
                                    className="px-2 py-1 bg-blue-600 text-white rounded text-xs"
                                  >
                                    View Map
                                  </button>
                                ) : (
                                  <span className="text-xs text-gray-400">No location</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
              </>
            )}
          </div>

         </main>
       </div>
     </div>
   );
 }

 export default AttendancePage;
