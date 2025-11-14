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
        const canAct = user && (String(user.role || '').toLowerCase() === 'admin' || String(user.role || '').toLowerCase() === 'hr');
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
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-8">
          <div className="max-w-7xl mx-auto">
            {/* Header Section */}
            <div className="flex justify-between items-center mb-8">
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Leave Requests</h1>
                <p className="mt-1 text-gray-600">Manage and approve employee leave requests</p>
              </div>
              <button 
                onClick={fetchLeaves} 
                className="inline-flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center text-red-700">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {error}
                </div>
              </div>
            )}

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              {loading ? (
                <div className="p-8 text-center">
                  <div className="inline-flex items-center">
                    <svg className="animate-spin h-5 w-5 text-indigo-600 mr-2" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                    </svg>
                    Loading leave requests...
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Day Type</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                        {canAct && <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {(!leaves || leaves.length === 0) ? (
                        <tr>
                          <td colSpan={canAct ? 7 : 6} className="px-6 py-8 text-center text-gray-500">
                            <p className="text-base">No pending leave requests</p>
                          </td>
                        </tr>
                      ) : (
                        leaves.map(l => (
                          <tr key={l.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center">
                                  <span className="text-indigo-600 font-medium">
                                    {(l.user_name?.[0] || 'U').toUpperCase()}
                                  </span>
                                </div>
                                <div className="ml-3">
                                  <div className="text-sm font-medium text-gray-900">{l.user_name}</div>
                                  <div className="text-xs text-gray-500">ID: {l.user_id}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                {l.type || 'N/A'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getDayTypeBadgeClass(l.day_type)}`}>
                                {formatDayType(l.day_type)}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              <div>{l.start_date || '-'}</div>
                              <div className="text-xs text-gray-400">to</div>
                              <div>{l.end_date || '-'}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                                ${l.status?.toLowerCase() === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                  l.status?.toLowerCase() === 'approved' ? 'bg-green-100 text-green-800' :
                                  l.status?.toLowerCase() === 'rejected' ? 'bg-red-100 text-red-800' :
                                  'bg-gray-100 text-gray-800'}`}>
                                {l.status || 'Unknown'}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-gray-900 max-w-xs truncate">
                                {l.reason || '-'}
                              </div>
                            </td>
                            {canAct && (
                              <td className="px-6 py-4 whitespace-nowrap text-right">
                                {(l.status || '').toLowerCase() === 'pending' ? (
                                  <div className="flex justify-end gap-2">
                                    <button
                                      onClick={() => takeAction(l.id, 'approve')}
                                      className="inline-flex items-center px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-md transition-colors"
                                    >
                                      Approve
                                    </button>
                                    <button
                                      onClick={() => takeAction(l.id, 'reject')}
                                      className="inline-flex items-center px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-md transition-colors"
                                    >
                                      Reject
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-xs text-gray-500">No actions available</span>
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