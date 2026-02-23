import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';

export default function LeaveManagement() {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // Use relative API paths so frontend and backend share same origin
  // All requests should target `/api/...`

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

      const res = await axios.get('/api/leave', { params: { status: 'pending' }, headers });
      const data = res.data;
      if (data && data.success) {
        const leavesArr = data.leaves || [];
        setLeaves(leavesArr);
        // If HR/Admin and no pending rows returned, try admin "all" endpoint to help debugging
        const canAct = user && (String(user.role || '').toLowerCase() === 'admin' || String(user.role || '').toLowerCase() === 'hr');
        if ((canAct) && (!leavesArr || leavesArr.length === 0)) {
          try {
            const allRes = await axios.get('/api/leave/all', { headers });
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

      const res = await axios.put(`/api/leave/${id}/${action}`, null, { headers });
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

  // Helper function to format day_type display
  const formatDayType = (dayType) => {
    if (!dayType) return '-';
    const type = String(dayType).toLowerCase();
    if (type === 'half' || type === 'half day') {
      return 'Half Day';
    } else if (type === 'full' || type === 'full day') {
      return 'Full Day';
    }
    return dayType;
  };

  // Helper function to get day_type badge color
  const getDayTypeBadgeClass = (dayType) => {
    if (!dayType) return 'bg-gray-100 text-gray-800';
    const type = String(dayType).toLowerCase();
    if (type === 'half' || type === 'half day') {
      return 'bg-orange-100 text-orange-800';
    } else if (type === 'full' || type === 'full day') {
      return 'bg-purple-100 text-purple-800';
    }
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/50">
      <div className="fixed top-0 w-full z-50"><Navbar /></div>
      <div className="flex flex-1 pt-16 overflow-hidden">
        <div className="fixed left-0 h-full w-64 hidden md:block"><Sidebar /></div>
        <main className="flex-1 md:ml-64 p-4 sm:p-8 relative overflow-y-auto w-full custom-scrollbar">

          {/* Background Pattern */}
          <div className="absolute inset-x-0 top-0 h-96 bg-gradient-to-b from-indigo-50/80 to-transparent pointer-events-none -z-10" />

          <div className="max-w-7xl mx-auto space-y-8 animate-[fadeIn_0.3s_ease-out]">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2 mb-8">
              <div>
                <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Leave Requests</h1>
                <p className="text-sm font-medium text-slate-500 mt-2">Manage and monitor employee absence Leaves.</p>
              </div>
              <button
                onClick={fetchLeaves}
                className="inline-flex items-center px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-md shadow-indigo-500/20 hover:shadow-lg hover:shadow-indigo-500/40 hover:-translate-y-0.5"
              >
                <svg className="w-5 h-5 mr-2 -ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Sync Data
              </button>
            </div>

            {error && (
              <div className="bg-red-50/80 border border-red-200 p-4 rounded-xl flex items-center text-red-700 font-bold text-sm shadow-sm animate-pulse">
                <svg className="w-5 h-5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                {error}
              </div>
            )}

            <div className="bg-white rounded-3xl shadow-[0_2px_24px_-4px_rgba(0,0,0,0.05)] border border-slate-100 overflow-hidden">
              <div className="p-6 sm:p-8 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
                <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                <h2 className="text-lg font-bold text-slate-800">Pending Leaves</h2>
              </div>

              {loading ? (
                <div className="p-16 text-center flex flex-col items-center justify-center">
                  <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mb-4">
                    <svg className="animate-spin h-8 w-8 text-indigo-500" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  </div>
                  <span className="text-sm font-bold text-slate-500 uppercase tracking-widest">Compiling Requests...</span>
                </div>
              ) : (
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50 border-b border-slate-100">
                        <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">User Identity</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Type</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Day Type</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Duration</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Reason</th>
                        {canAct && <th className="px-6 py-4 text-right text-xs font-bold text-slate-400 uppercase tracking-wider">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {(!leaves || leaves.length === 0) ? (
                        <tr>
                          <td colSpan={canAct ? 7 : 6} className="px-6 py-16 text-center text-slate-400">
                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-200/50">
                              <svg className="w-8 h-8 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                            </div>
                            <p className="text-sm font-bold uppercase tracking-widest">No pending leave requests</p>
                          </td>
                        </tr>
                      ) : (
                        leaves.map(l => (
                          <tr key={l.id} className="hover:bg-indigo-50/30 transition-colors group">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center group-hover:bg-indigo-600 transition-colors">
                                  <span className="text-indigo-600 font-bold group-hover:text-white transition-colors">
                                    {(l.user_name?.[0] || 'U').toUpperCase()}
                                  </span>
                                </div>
                                <div className="ml-4">
                                  <div className="text-sm font-bold text-slate-900">{l.user_name}</div>
                                  <div className="text-xs font-medium text-slate-500">ID: {l.user_id}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="px-3 py-1 inline-flex text-xs font-bold rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100">
                                {l.type || 'N/A'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-3 py-1 inline-flex text-xs font-bold rounded-lg border 
                                ${String(l.day_type).toLowerCase().includes('half') ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200'}`}>
                                {formatDayType(l.day_type)}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex flex-col gap-1 text-sm font-bold text-slate-700">
                                <div>{l.start_date || '-'}</div>
                                <div className="text-[10px] text-slate-400 uppercase tracking-wider">UNTIL</div>
                                <div>{l.end_date || '-'}</div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-3 py-1 inline-flex text-xs font-bold rounded-lg border
                                ${l.status?.toLowerCase() === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                  l.status?.toLowerCase() === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                    l.status?.toLowerCase() === 'rejected' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                                      'bg-slate-50 text-slate-600 border-slate-200'}`}>
                                {(l.status || 'Unknown').toUpperCase()}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm font-medium text-slate-600 max-w-[200px] truncate" title={l.reason || ''}>
                                {l.reason || '-'}
                              </div>
                            </td>
                            {canAct && (
                              <td className="px-6 py-4 whitespace-nowrap text-right">
                                {(l.status || '').toLowerCase() === 'pending' ? (
                                  <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                      onClick={() => takeAction(l.id, 'approve')}
                                      className="inline-flex items-center px-3 py-1.5 bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-500 hover:text-white text-xs font-bold rounded-lg transition-all shadow-sm"
                                    >
                                      Approve
                                    </button>
                                    <button
                                      onClick={() => takeAction(l.id, 'reject')}
                                      className="inline-flex items-center px-3 py-1.5 bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-500 hover:text-white text-xs font-bold rounded-lg transition-all shadow-sm"
                                    >
                                      Deny
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-xs font-bold text-slate-400 italic">LOCKED</span>
                                )}
                              </td>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}