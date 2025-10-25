import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';

export default function LeaveManagement() {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  const getCurrentUser = () => {
    try {
      const raw = localStorage.getItem('user');
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  };

  const fetchLeaves = async () => {
    setLoading(true);
    setError(null);
    try {
      const user = getCurrentUser();
      const headers = {};
      if (user && user.id) headers['x-user-id'] = user.id;

      const res = await axios.get(`${API_URL}/api/leave`, { params: { status: 'pending' }, headers });
      const data = res.data;
      if (data && data.success) {
        const leavesArr = data.leaves || [];
        setLeaves(leavesArr);
        // If HR/Admin and no pending rows returned, try admin "all" endpoint to help debugging
          if ((canAct) && (!leavesArr || leavesArr.length === 0)) {
          try {
            const allRes = await axios.get(`${API_URL}/api/leave/all`, { headers });
            if (allRes?.data?.success) {
              setLeaves(allRes.data.leaves || []);
              // fallback to admin view: don't show a message to the user
            }
          } catch (e) {
            console.warn('Fallback to /api/leave/all failed:', e?.response ?? e);
          }
        }
      } else {
        setLeaves([]);
        setError(data?.message || 'Failed to fetch leaves');
      }
    } catch (err) {
      console.error('fetchLeaves error', err?.response ?? err);
      const msg = err?.response?.data?.message || err.message || String(err);
      setError(msg);
      setLeaves([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLeaves(); }, []);

  const takeAction = async (id, action) => {
    try {
      const user = getCurrentUser();
      const headers = {};
      if (user && user.id) headers['x-user-id'] = user.id;

      const res = await axios.put(`${API_URL}/api/leave/${id}/${action}`, null, { headers });
      const data = res.data;
      if (data && data.success) {
        await fetchLeaves();
      } else {
        alert('Action failed: ' + (data?.message || JSON.stringify(data)));
      }
    } catch (err) {
      console.error('takeAction error', err?.response ?? err);
      const msg = err?.response?.data?.message || err.message || String(err);
      alert('Action failed: ' + msg);
    }
  };

  // Note: seed button removed to avoid confusion. Use server debug endpoints directly if needed.

  const user = getCurrentUser();
  const canAct = user && (String(user.role || '').toLowerCase() === 'admin' || String(user.role || '').toLowerCase() === 'hr');

  return (
    <div className="flex flex-col h-screen">
      <Navbar />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 p-6 bg-gray-100">
          <h1 className="text-2xl font-semibold mb-4">Leave Requests</h1>

          <div className="mb-4 flex gap-2">
            <button onClick={fetchLeaves} className="px-3 py-1 bg-indigo-600 text-white rounded">Refresh</button>
          </div>

          {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>}

          <div className="bg-white rounded shadow p-4">
            {loading ? <div>Loading...</div> : (
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr>
                      <th className="px-3 py-2 text-left">ID</th>
                      <th className="px-3 py-2 text-left">Type</th>
                      <th className="px-3 py-2 text-left">User</th>
                      <th className="px-3 py-2 text-left">Start Date</th>
                      <th className="px-3 py-2 text-left">End Date</th>
                      <th className="px-3 py-2 text-left">Status</th>
                      <th className="px-3 py-2 text-left">Reason</th>
                      <th className="px-3 py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(!leaves || leaves.length === 0) ? (
                      <tr><td className="p-4 text-gray-500" colSpan={11}>No pending requests</td></tr>
                    ) : (
                      leaves.map(l => (
                        <tr key={l.id} className="hover:bg-gray-50 align-top">
                          <td className="py-2 px-3 font-mono text-xs">{l.id}</td>
                          <td className="py-2 px-3">{l.type ?? '-'}</td>
                          <td className="py-2 px-3">{l.user_name ?? l.user_id}</td>
                          <td className="py-2 px-3">{l.start_date ?? '-'}</td>
                          <td className="py-2 px-3">{l.end_date ?? '-'}</td>
                          <td className="py-2 px-3">{(l.status || '').toString()}</td>
                          <td className="py-2 px-3 max-w-xs truncate">{l.reason ?? '-'}</td>
                          <td className="py-2 px-3 flex gap-2">
                            {canAct && (l.status || '').toLowerCase() === 'pending' ? (
                              <>
                                <button onClick={() => takeAction(l.id, 'approve')} className="px-2 py-1 bg-green-600 text-white rounded">Approve</button>
                                <button onClick={() => takeAction(l.id, 'reject')} className="px-2 py-1 bg-red-600 text-white rounded">Reject</button>
                              </>
                            ) : (
                              <span className="text-xs text-gray-500">{canAct ? 'No actions' : 'Read-only'}</span>
                            )}
                          </td>
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
