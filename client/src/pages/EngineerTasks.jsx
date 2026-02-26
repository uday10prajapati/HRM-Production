import React, { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import axios from 'axios';

export default function EngineerTasks() {
  const [calls, setCalls] = useState([]);
  const [engineers, setEngineers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const [callsRes, usersRes] = await Promise.all([
        axios.get('/api/assign_call'),
        axios.get('/api/users')
      ]);
      const allCalls = callsRes.data.calls || [];
      // show only unassigned open calls
      const unassigned = (allCalls || []).filter(c => !c.engineer_id);
      setCalls(unassigned);

      const allUsers = usersRes.data.users || [];
      const engs = (allUsers || []).filter(u => (u.role || '').toString().toLowerCase() === 'engineer');
      setEngineers(engs);
    } catch (err) {
      console.error('Failed to load calls or users', err?.response?.data ?? err);
      setCalls([]);
      setEngineers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function assign(callId, engineerId) {
    setAssigning(callId);
    try {
      const res = await axios.put(`/api/assign_call/${callId}/assign`, { engineerId });
      // update local list: remove assigned call
      setCalls(curr => curr.filter(c => String(c.id) !== String(callId)));
    } catch (err) {
      console.error('Failed to assign engineer', err?.response?.data ?? err);
      alert('Failed to assign engineer');
    } finally {
      setAssigning(null);
    }
  }

  return (
    <div className="flex flex-col h-screen">
      <Navbar />
      <div className="flex flex-1 min-h-screen">
        <Sidebar />
        <main className="flex-1 p-6 bg-gray-100 overflow-auto">
          <div className="bg-white rounded shadow p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Assign Service Calls</h2>
              <div className="text-sm text-gray-500">Unassigned open calls</div>
            </div>

            {loading ? (
              <div>Loading...</div>
            ) : calls.length === 0 ? (
              <div className="text-gray-600">No unassigned calls</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500">
                      <th className="py-2 px-2">Title</th>
                      <th className="py-2 px-2">Customer</th>
                      <th className="py-2 px-2">Scheduled</th>
                      <th className="py-2 px-2">Assign</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calls.map(c => (
                      <tr key={c.id} className="border-t">
                        <td className="py-2 px-2">{c.title}</td>
                        <td className="py-2 px-2">{c.customer_name || c.customer_id}</td>
                        <td className="py-2 px-2">{c.scheduled_at ? new Date(c.scheduled_at).toLocaleString() : '-'}</td>
                        <td className="py-2 px-2">
                          <div className="flex gap-2 items-center">
                            <select defaultValue="" className="border px-2 py-1 text-sm" id={`sel-${c.id}`}>
                              <option value="">Select engineer</option>
                              {engineers.map(e => (
                                <option key={e.id} value={e.id}>{e.name} ({e.email})</option>
                              ))}
                            </select>
                            <button
                              className="px-3 py-1 bg-indigo-600 text-white rounded text-sm"
                              onClick={() => {
                                const sel = document.getElementById(`sel-${c.id}`);
                                const engId = sel?.value;
                                if (!engId) { alert('Select an engineer'); return; }
                                assign(c.id, engId);
                              }}
                              disabled={Boolean(assigning)}
                            >
                              {assigning === c.id ? 'Assigning...' : 'Assign'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
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
