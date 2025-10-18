import React, { useEffect, useState } from "react";
import axios from "axios";

export default function AttendanceReport({ userId }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  // new states for filtering
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  useEffect(() => {
    fetchReport();
  }, [userId]);

  async function fetchReport() {
    setLoading(true);
    try {
      const q = userId ? `?userId=${encodeURIComponent(userId)}` : "";
      const res = await axios.get(`/api/attendance/report${q}`);
      let data = Array.isArray(res.data) ? res.data : [];

      // ✅ client-side date filtering
      if (start && end) {
        const startDate = new Date(start);
        const endDate = new Date(end);
        data = data.filter((r) => {
          const date = new Date(r.day || r.date || r.created_at);
          return date >= startDate && date <= endDate;
        });
      }

      setRows(data);
    } catch (err) {
      console.error("Failed to load attendance report:", err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h3 className="text-lg font-semibold mb-2">Attendance Report</h3>

      {/* 🔍 Date filter UI */}
      <div className="bg-white rounded shadow p-4 mb-4 flex flex-wrap items-center gap-3">
        <label className="text-sm">Start:</label>
        <input
          type="date"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          className="border px-2 py-1 rounded"
        />
        <label className="text-sm">End:</label>
        <input
          type="date"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          className="border px-2 py-1 rounded"
        />
        <button
          onClick={fetchReport}
          className="px-3 py-1 bg-indigo-600 text-white rounded"
        >
          Refresh
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded shadow overflow-auto">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="py-2 px-3 text-left">Day</th>
              <th className="py-2 px-3 text-left">Punch In</th>
              <th className="py-2 px-3 text-left">Punch Out</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={3} className="p-4 text-center">
                  Loading...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="p-4 text-center text-gray-500">
                  No records found
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr
                  key={`${r.user_id}-${r.day}`}
                  className="border-t hover:bg-gray-50 transition"
                >
                  <td className="py-2 px-3">{r.day}</td>
                  <td className="py-2 px-3">{r.punch_in ?? "-"}</td>
                  <td className="py-2 px-3">{r.punch_out ?? "-"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
