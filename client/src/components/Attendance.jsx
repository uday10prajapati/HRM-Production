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
    <div className="flex flex-col h-screen">
      <Navbar />
      <div className="flex flex-1 min-h-screen">
        <Sidebar />
        <main className="flex-1 p-6 bg-gray-100 overflow-auto">
          <h2 className="text-2xl font-bold mb-4">Attendance Records</h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="p-4 bg-white rounded shadow">
              <div className="text-sm text-gray-500">Work Days (this month)</div>
              <div className="text-2xl font-semibold">{summary.workedDays}</div>
            </div>
            <div className="p-4 bg-white rounded shadow">
              <div className="text-sm text-gray-500">Leave Days (this month)</div>
              <div className="text-2xl font-semibold">{summary.leaveDays}</div>
            </div>
            <div className="p-4 bg-white rounded shadow flex items-center justify-center">
              <div className="space-x-2">
                <button onClick={() => handlePunch("in")} className="px-4 py-2 bg-green-600 text-white rounded">Punch In</button>
                <button onClick={() => handlePunch("out")} className="px-4 py-2 bg-red-600 text-white rounded">Punch Out</button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow overflow-auto">
            <table className="min-w-full">
              <thead className="bg-blue-500 text-white">
                <tr>
                  <th className="py-2 px-4 text-left">Date</th>
                  <th className="py-2 px-4 text-left">Punch In</th>
                  <th className="py-2 px-4 text-left">Punch Out</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={3} className="p-4 text-center">Loading...</td></tr>
                ) : records.length === 0 ? (
                  <tr><td colSpan={3} className="p-4 text-center">No records</td></tr>
                ) : records.map((r) => (
                  <tr key={`${r.user_id}-${r.day}`} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-4">{r.day}</td>
                    <td className="py-2 px-4">{r.punch_in ?? "-"}</td>
                    <td className="py-2 px-4">{r.punch_out ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </div>
  );
}
