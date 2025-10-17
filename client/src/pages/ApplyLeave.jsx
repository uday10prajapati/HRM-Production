import React, { useState } from 'react';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';

export default function ApplyLeave() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const stored = localStorage.getItem('user');
    const user = stored ? JSON.parse(stored) : null;
    if (!user || !user.id) {
      setMessage('You must be logged in to apply for leave');
      return;
    }

    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${API_URL}/api/leave/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, startDate: from, endDate: to, reason }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage('Leave request submitted');
        setFrom(''); setTo(''); setReason('');
      } else {
        setMessage(data.message || 'Failed to submit leave request');
      }
    } catch (err) {
      console.error(err);
      setMessage('Server error while submitting leave request');
    }
  };

  return (
    <div className="flex flex-col h-screen">
      <Navbar />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 p-6 bg-gray-100">
          <h1 className="text-2xl font-semibold mb-4">Apply for Leave</h1>
          <div className="bg-white rounded shadow p-4 max-w-lg">
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-sm">From</label>
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-full border rounded px-2 py-1" />
              </div>
              <div>
                <label className="text-sm">To</label>
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-full border rounded px-2 py-1" />
              </div>
              <div>
                <label className="text-sm">Reason</label>
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} className="w-full border rounded px-2 py-1" />
              </div>
              <div>
                <button className="px-3 py-1 bg-green-600 text-white rounded">Submit</button>
              </div>
              {message && <div className="text-sm text-gray-600">{message}</div>}
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}
