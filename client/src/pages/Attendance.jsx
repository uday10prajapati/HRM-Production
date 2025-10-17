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

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = {};
      if (start) params.start = start;
      if (end) params.end = end;
      if (group) params.group = group;

      const res = await fetch(`${API_URL}/api/attendance/report?` + new URLSearchParams(params));
      const data = await res.json();
      if (data.success) {
        setReport(data.report || {});
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // default to last 7 days
    const d = new Date();
    const dd = new Date(d.getTime() - 6 * 24 * 60 * 60 * 1000);
    const toISO = (dt) => dt.toISOString().slice(0, 10);
    setStart(toISO(dd));
    setEnd(toISO(d));
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

          <div className="bg-white rounded shadow p-4">
            <h2 className="font-medium mb-3">Report ({group})</h2>
            {loading ? (
              <div>Loading...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Bucket</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Punched In</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Punched Out</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {Object.keys(report).length === 0 ? (
                      <tr><td className="p-4 text-gray-500" colSpan={3}>No data</td></tr>
                    ) : (
                      Object.entries(report).map(([bucket, vals]) => (
                        <tr key={bucket} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm">{bucket}</td>
                          <td className="px-4 py-2 text-sm">{vals.in ?? 0}</td>
                          <td className="px-4 py-2 text-sm">{vals.out ?? 0}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default AttendancePage;
