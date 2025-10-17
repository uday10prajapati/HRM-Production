import React, { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';

export default function LeaveManagement() {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(false);
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  const fetchLeaves = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/leave?status=pending`);
      const data = await res.json();
      if (data.success) setLeaves(data.leaves || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLeaves(); }, []);

  const takeAction = async (id, action) => {
    try {
      const res = await fetch(`${API_URL}/api/leave/${id}/${action}`, { method: 'PUT' });
      const data = await res.json();
      if (data.success) fetchLeaves();
    } catch (err) { console.error(err); }
  };

  return (
    <div className="flex flex-col h-screen">
      <Navbar />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 p-6 bg-gray-100">
          <h1 className="text-2xl font-semibold mb-4">Leave Requests</h1>
          <div className="bg-white rounded shadow p-4">
            {loading ? <div>Loading...</div> : (
              <table className="min-w-full">
                <thead>
                  <tr>
                    <th className="px-4 py-2 text-left">User</th>
                    <th className="px-4 py-2 text-left">From</th>
                    <th className="px-4 py-2 text-left">To</th>
                    <th className="px-4 py-2 text-left">Reason</th>
                    <th className="px-4 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {leaves.length === 0 ? (
                    <tr><td className="p-4 text-gray-500" colSpan={5}>No pending requests</td></tr>
                  ) : (
                    leaves.map(l => (
                      <tr key={l.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2">{l.user_name ?? l.user?.name ?? l.user_id}</td>
                        <td className="px-4 py-2">{l.start_date}</td>
                        <td className="px-4 py-2">{l.end_date}</td>
                        <td className="px-4 py-2">{l.reason}</td>
                        <td className="px-4 py-2 flex gap-2">
                          <button onClick={() => takeAction(l.id, 'approve')} className="px-2 py-1 bg-green-600 text-white rounded">Approve</button>
                          <button onClick={() => takeAction(l.id, 'reject')} className="px-2 py-1 bg-red-600 text-white rounded">Reject</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
