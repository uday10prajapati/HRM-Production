import React, { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';

export default function ApplyLeave() {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  // modal/form state
  const [isOpen, setIsOpen] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const API_URL = (import.meta && import.meta.env && import.meta.env.VITE_API_URL) || 'https://hrm-production.onrender.com';

  function getUserFromStorage() {
    const keys = ['user', 'currentUser', 'auth', 'current_user'];
    for (const k of keys) {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      try {
        const p = JSON.parse(raw);
        const user = p?.user ?? p?.data ?? p?.currentUser ?? p;
        if (user) {
          return {
            id: user.id ?? user.userId ?? user._id ?? null,
            name: user.name ?? user.fullName ?? user.username ?? null,
            role: (user.role ?? user.userRole ?? '').toString().toLowerCase() || null,
          };
        }
      } catch (e) {
        // ignore non-json
      }
    }
    return null;
  }

  useEffect(() => {
    fetchLeaves();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchLeaves() {
    setLoading(true);
    setFetchError(null);
    try {
      const user = getUserFromStorage();
      const userIdParam = user?.id ? `?userId=${encodeURIComponent(user.id)}` : '';
      const res = await fetch(`${API_URL}/api/leave${userIdParam}`);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to fetch leaves: ${res.status} ${text}`);
      }
      const data = await res.json();
      const list = Array.isArray(data) ? data : data?.leaves ?? data?.data ?? [];
      setLeaves(list);
    } catch (err) {
      console.error(err);
      setFetchError(err.message || 'Failed to load leaves');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setMessage('');
    try {
      const user = getUserFromStorage();
      if (!user || !user.id) {
        setMessage('You must be logged in to apply for leave');
        return;
      }
      if (!from || !to) {
        setMessage('Please select start and end dates');
        return;
      }
      if (new Date(to) < new Date(from)) {
        setMessage('End date must be same or after start date');
        return;
      }

      const payload = {
        userId: user.id,
        startDate: from,
        endDate: to,
        reason,
      };

      const res = await fetch(`${API_URL}/api/leave/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error || body?.message || `Server returned ${res.status}`);
      }

      setMessage('Leave request submitted');
      setIsOpen(false);
      setFrom('');
      setTo('');
      setReason('');
      await fetchLeaves();
    } catch (err) {
      console.error(err);
      setMessage(err.message || 'Server error while submitting leave request');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col h-screen">
      <Navbar />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 p-6 bg-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-semibold">Leave Requests</h1>
            <div>
              <button
                onClick={() => {
                  setMessage('');
                  setIsOpen(true);
                }}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                New Leave
              </button>
            </div>
          </div>

          {message && <div className="mb-4 text-sm text-gray-700">{message}</div>}

          <div className="bg-white rounded shadow p-4">
            {loading ? (
              <div className="text-center py-6 text-gray-500">Loading...</div>
            ) : fetchError ? (
              <div className="text-red-600 py-4">{fetchError}</div>
            ) : leaves.length === 0 ? (
              <div className="text-gray-500 py-4">No leave records found.</div>
            ) : (
              <div className="overflow-auto">
                <table className="min-w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left py-2 px-3">Employee</th>
                      <th className="text-left py-2 px-3">Type</th>
                      <th className="text-left py-2 px-3">Start</th>
                      <th className="text-left py-2 px-3">End</th>
                      <th className="text-left py-2 px-3">Status</th>
                      <th className="text-left py-2 px-3">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaves.map((l) => (
                      <tr key={l.id ?? `${l.user_id}-${l.start_date ?? l.startDate}`} className="border-t hover:bg-gray-50">
                        <td className="py-2 px-3">{l.user_name ?? l.name ?? l.employeeName ?? `#${l.user_id ?? l.userId}`}</td>
                        <td className="py-2 px-3 capitalize">{l.type ?? l.leave_type ?? '—'}</td>
                        <td className="py-2 px-3">{l.startDate ?? l.start_date ?? l.start}</td>
                        <td className="py-2 px-3">{l.endDate ?? l.end_date ?? l.end}</td>
                        <td className="py-2 px-3 capitalize">{l.status ?? 'pending'}</td>
                        <td className="py-2 px-3">{l.reason ?? l.notes ?? ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Modal */}
          {isOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 bg-opacity-40">
              <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Apply for Leave</h3>
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      setMessage('');
                    }}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">From</label>
                    <input
                      type="date"
                      value={from}
                      onChange={(e) => setFrom(e.target.value)}
                      className="mt-1 block w-full border rounded px-3 py-2"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">To</label>
                    <input
                      type="date"
                      value={to}
                      onChange={(e) => setTo(e.target.value)}
                      className="mt-1 block w-full border rounded px-3 py-2"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Reason</label>
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      rows={3}
                      className="mt-1 block w-full border rounded px-3 py-2"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <button type="button" onClick={() => setIsOpen(false)} className="px-4 py-2 rounded border hover:bg-gray-50">
                      Cancel
                    </button>
                    <button type="submit" disabled={submitting} className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-60">
                      {submitting ? 'Submitting...' : 'Submit Request'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
