import React, { useEffect, useState } from "react";
import axios from "axios";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";

export default function Attendance() {
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState({ workedDays: 0, leaveDays: 0 });
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState(null);

  const getAuthHeaders = () => {
    try {
      const raw = localStorage.getItem('user') || localStorage.getItem('currentUser');
      if (!raw) return {};
      const p = JSON.parse(raw);
      const u = p?.user ?? p?.data ?? p;
      const id = u?.id ?? u?.userId ?? null;
      if (!id) return {};
      return { id: String(id), headers: { 'x-user-id': String(id) } };
    } catch {
      return {};
    }
  };

  useEffect(() => {
    // try to get logged user id from localStorage
    try {
      const raw = localStorage.getItem("user") || localStorage.getItem("currentUser");
      if (raw) {
        const p = JSON.parse(raw);
        const u = p?.user ?? p?.data ?? p;
        setUserId(u?.id ?? u?.userId ?? null);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (userId) fetchReport();
  }, [userId]);

  async function fetchReport() {
    setLoading(true);
    try {
      const now = new Date();
      const start = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-01`;
      const end = new Date(now.getFullYear(), now.getMonth()+1, 0).toISOString().slice(0,10);

  const { id, headers } = getAuthHeaders();
  if (!id) console.warn('fetchReport(component): no user id in storage');
  const reqParams = { userId, start, end };
  if (!headers || !headers['x-user-id']) reqParams.userId = userId;
  console.debug('fetchReport(component): calling report', { params: reqParams, headers });
  const r = await axios.get(`/api/attendance/report`, { params: reqParams, headers });
  setRecords(Array.isArray(r.data) ? r.data : []);
  const s = await axios.get(`/api/attendance/summary`, { params: { userId, month: `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}` }, ...(headers) });
      if (s?.data?.success) setSummary({ workedDays: s.data.workedDays, leaveDays: s.data.leaveDays });
    } catch (err) {
      console.error("Failed fetching attendance report/summary:", err?.response?.data ?? err);
    } finally {
      setLoading(false);
    }
  }

  async function handlePunch(type) {
    if (!userId) {
      alert("User not found. Please login.");
      return;
    }
    try {
      // attempt to fetch geolocation, but don't block if unavailable
      const getLoc = (timeoutMs = 4000) => new Promise((resolve) => {
        if (!navigator?.geolocation) return resolve(null);
        let done = false;
        navigator.geolocation.getCurrentPosition((p) => { if (!done) { done = true; resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude }); } }, () => { if (!done) { done = true; resolve(null); } }, { timeout: timeoutMs });
        setTimeout(() => { if (!done) { done = true; resolve(null); } }, timeoutMs + 100);
      });
      const loc = await getLoc(4000);
      const payload = { userId, type };
      if (loc) { payload.latitude = loc.latitude; payload.longitude = loc.longitude; }
  const { id, headers } = getAuthHeaders();
  if (!id) console.warn('handlePunch(component): no user id in storage');
  console.debug('handlePunch(component): sending punch', { payload, headers });
  await axios.post("/api/attendance/punch", payload, { headers });
      await fetchReport();
      alert(`Punched ${type}`);
    } catch (err) {
      console.error("Punch failed:", err?.response?.data ?? err);
      alert(err?.response?.data?.message ?? err.message ?? "Punch failed");
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-8">
          <div className="max-w-7xl mx-auto space-y-8">
            {/* Header Section */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl shadow-lg p-8 text-white">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div>
                  <h1 className="text-3xl font-bold">Attendance Tracker</h1>
                  <p className="mt-2 text-blue-100">Track your daily attendance and work hours</p>
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => handlePunch("in")} 
                    className="inline-flex items-center px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                    </svg>
                    Punch In
                  </button>
                  <button 
                    onClick={() => handlePunch("out")} 
                    className="inline-flex items-center px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Punch Out
                  </button>
                </div>
              </div>
            </div>

            {/* Statistics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
                <div className="flex items-center">
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-sm font-medium text-gray-500">Work Days</h3>
                    <div className="mt-1 flex items-baseline">
                      <div className="text-2xl font-semibold text-gray-900">{summary.workedDays}</div>
                      <div className="ml-2 text-sm text-gray-600">this month</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
                <div className="flex items-center">
                  <div className="p-3 bg-green-50 rounded-lg">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-sm font-medium text-gray-500">Leave Days</h3>
                    <div className="mt-1 flex items-baseline">
                      <div className="text-2xl font-semibold text-gray-900">{summary.leaveDays}</div>
                      <div className="ml-2 text-sm text-gray-600">this month</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Attendance Records Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-800">Attendance Records</h3>
              </div>

              {loading ? (
                <div className="p-8 text-center">
                  <div className="inline-flex items-center">
                    <svg className="animate-spin h-5 w-5 text-blue-500 mr-3" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                    </svg>
                    <span className="text-gray-600">Loading records...</span>
                  </div>
                </div>
              ) : records.length === 0 ? (
                <div className="p-8 text-center">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No records found</h3>
                  <p className="mt-1 text-sm text-gray-500">Start tracking your attendance by punching in.</p>
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Punch In</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Punch Out</th>
                      <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {records.map((r) => (
                      <tr key={`${r.user_id}-${r.day}`} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{r.day}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {r.punch_in ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              {r.punch_in}
                            </span>
                          ) : "-"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {r.punch_out ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {r.punch_out}
                            </span>
                          ) : "-"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          {r.punch_in && r.punch_out ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Complete
                            </span>
                          ) : r.punch_in ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              In Progress
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              Absent
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}