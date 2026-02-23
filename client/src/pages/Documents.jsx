import React, { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import axios from 'axios';
import { API_CONFIG } from '../utils/api.config';

axios.defaults.baseURL = API_CONFIG.BASE_URL;

export default function ViewAssignedCalls() {
  const [assignedCalls, setAssignedCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCall, setSelectedCall] = useState(null);
  const [selectedEngineer, setSelectedEngineer] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  useEffect(() => {
    fetchAssignedCalls();
  }, []);

  const fetchAssignedCalls = async () => {
    try {
      setLoading(true);

      const response = await axios.get('/api/service-calls/assigned-calls', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.data.success) {
        setAssignedCalls(response.data.calls);
      } else {
        setError('Failed to fetch assigned calls');
      }
    } catch (error) {
      console.error('Error fetching assigned calls:', error);
      setError(error.response?.data?.message || 'Failed to fetch assigned calls');
    } finally {
      setLoading(false);
    }
  };

  const uniqueEngineers = [...new Set(assignedCalls.map(c => (c.name || '').trim()).filter(Boolean))].sort();

  const filteredCalls = assignedCalls.filter(call => {
    // Search Term
    const searchLower = (searchTerm || '').toLowerCase().trim();
    const callsName = (call.name || '').toLowerCase();
    const callsDairy = (call.dairy_name || '').toLowerCase();
    const callsProblem = (call.problem || '').toLowerCase();
    const callsStatus = (call.status || '').toLowerCase();

    const matchesSearch = !searchLower || (
      callsName.includes(searchLower) ||
      callsDairy.includes(searchLower) ||
      callsProblem.includes(searchLower) ||
      callsStatus.includes(searchLower)
    );

    // Engineer
    const callEngineer = String(call.name || '').trim().toLowerCase();
    const selectEng = String(selectedEngineer || '').trim().toLowerCase();
    const matchesEngineer = selectEng ? (callEngineer === selectEng) : true;

    // Status
    const rawCallStatus = String(call.status || '').trim().toLowerCase();
    const rawSelectStatus = String(selectedStatus || '').trim().toLowerCase();
    const matchesStatus = rawSelectStatus ? (rawCallStatus === rawSelectStatus) : true;

    // Date
    let matchesDate = true;
    if (selectedDate) {
      if (call.created_at) {
        try {
          // Normalize API date to YYYY-MM-DD local time
          const d = new Date(call.created_at);
          if (!isNaN(d.getTime())) {
            const tzOffset = d.getTimezoneOffset() * 60000;
            const localISOTime = new Date(d.getTime() - tzOffset).toISOString().split('T')[0];
            matchesDate = (localISOTime === selectedDate);
          } else {
            matchesDate = false;
          }
        } catch (e) {
          matchesDate = false;
        }
      } else {
        matchesDate = false; // Filter explicitly checks this date
      }
    }

    return matchesSearch && matchesEngineer && matchesStatus && matchesDate;
  });

  return (
    <div className="flex flex-col h-screen bg-slate-50/50">
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar className="hidden md:block" />
        <main className="flex-1 overflow-y-auto w-full relative">

          {/* Subtle Background Pattern */}
          <div className="absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-indigo-50/80 to-transparent pointer-events-none -z-10" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

            {/* Header Area */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Assigned Service Calls</h1>
                <p className="mt-2 text-sm text-slate-500">
                  Track and manage engineer deployments across dairy sites
                </p>
              </div>
              <div className="flex items-center gap-3 bg-white px-4 py-2.5 rounded-2xl shadow-sm border border-slate-100">
                <div className="p-2 bg-indigo-50 rounded-lg">
                  <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Calls</p>
                  <p className="text-lg font-bold text-slate-900 leading-none">{assignedCalls.length}</p>
                </div>
              </div>
            </div>

            {/* Smart Filters */}
            <div className="bg-white rounded-2xl shadow-[0_2px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-100 p-5 transition-all">
              <div className="flex flex-wrap items-center gap-4">

                {/* Search */}
                <div className="relative flex-1 min-w-[240px]">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <svg className="h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    placeholder="Search dairies, engineers, problems..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50/50 border border-slate-200 text-sm rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400"
                  />
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative">
                    <select
                      value={selectedEngineer}
                      onChange={(e) => setSelectedEngineer(e.target.value)}
                      className="appearance-none pl-4 pr-10 py-2.5 bg-slate-50/50 border border-slate-200 text-sm font-medium text-slate-700 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
                    >
                      <option value="">Engineers (All)</option>
                      {uniqueEngineers.map(name => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                      <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>

                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="pl-4 pr-4 py-2.5 bg-slate-50/50 border border-slate-200 text-sm font-medium text-slate-700 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
                  />

                  <div className="relative">
                    <select
                      value={selectedStatus}
                      onChange={(e) => setSelectedStatus(e.target.value)}
                      className="appearance-none pl-4 pr-10 py-2.5 bg-slate-50/50 border border-slate-200 text-sm font-medium text-slate-700 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
                    >
                      <option value="">Status (All)</option>
                      <option value="pending">Pending</option>
                      <option value="resolved">Resolved</option>
                      <option value="completed">Completed</option>
                      <option value="in_progress">In Progress</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                      <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Main Content Area */}
            {loading ? (
              <div className="flex flex-col justify-center items-center h-64 bg-white/50 rounded-2xl border border-slate-100 backdrop-blur-sm">
                <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-200 border-t-indigo-600 mb-4" />
                <p className="text-slate-500 font-medium text-sm">Loading service calls...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col justify-center items-center h-64 bg-red-50/50 rounded-2xl border border-red-100">
                <div className="p-3 bg-red-100 rounded-full mb-3">
                  <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-red-900">Connection Error</h3>
                <p className="mt-1 text-sm text-red-600 text-center max-w-sm">{error}</p>
              </div>
            ) : filteredCalls.length === 0 ? (
              <div className="flex flex-col justify-center items-center py-20 bg-white rounded-2xl shadow-sm border border-slate-100 transition-all">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-10 h-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-slate-900">No calls found</h3>
                <p className="mt-2 text-sm text-slate-500 max-w-sm text-center">
                  {assignedCalls.length === 0
                    ? "There are currently no service calls assigned into the system."
                    : "We couldn't find any calls matching your current filters."}
                </p>
                {assignedCalls.length > 0 && (
                  <button
                    onClick={() => {
                      setSearchTerm('');
                      setSelectedEngineer('');
                      setSelectedDate('');
                      setSelectedStatus('');
                    }}
                    className="mt-6 px-5 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-xl hover:bg-slate-800 transition-all shadow-md shadow-slate-900/10 focus:ring-4 focus:ring-slate-900/10"
                  >
                    Clear All Filters
                  </button>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-[0_4px_24px_-8px_rgba(0,0,0,0.06)] border border-slate-100 overflow-hidden relative">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-100">
                        <th className="px-6 py-4 text-[0.7rem] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Engineer</th>
                        <th className="px-6 py-4 text-[0.7rem] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Date</th>
                        <th className="px-6 py-4 text-[0.7rem] font-bold text-slate-400 uppercase tracking-wider">Dairy Name</th>
                        <th className="px-6 py-4 text-[0.7rem] font-bold text-slate-400 uppercase tracking-wider">Problem</th>
                        <th className="px-6 py-4 text-[0.7rem] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-4 text-[0.7rem] font-bold text-slate-400 uppercase tracking-wider text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 border-t border-slate-100">
                      {filteredCalls.map((call, idx) => {
                        const uniqueKey = call.call_id ? `call-${call.call_id}` : (call.id ? `id-${call.id}` : `idx-${idx}`);

                        // Create initials for avatar
                        const initials = String(call.name || 'U').substring(0, 2).toUpperCase();

                        // Status styling logic
                        const statusStyles = {
                          completed: 'bg-emerald-50 text-emerald-600 border-emerald-100',
                          in_progress: 'bg-indigo-50 text-indigo-600 border-indigo-100',
                          resolved: 'bg-fuchsia-50 text-fuchsia-600 border-fuchsia-100',
                          pending: 'bg-amber-50 text-amber-600 border-amber-100',
                          default: 'bg-slate-50 text-slate-600 border-slate-200'
                        };
                        const activeStyle = statusStyles[call.status] || statusStyles.default;

                        return (
                          <tr key={uniqueKey} className="hover:bg-slate-50/70 transition-colors group">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold shrink-0">
                                  {initials}
                                </div>
                                <span className="text-sm font-semibold text-slate-700">{call.name}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-1.5 text-sm text-slate-500 font-medium">
                                <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                {call.created_at ? new Date(call.created_at).toLocaleDateString() : 'N/A'}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-sm font-semibold text-slate-800 line-clamp-1">{call.dairy_name}</span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-sm text-slate-500 line-clamp-1 max-w-[200px]" title={call.problem}>{call.problem}</span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${activeStyle}`}>
                                <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${call.status === 'completed' ? 'bg-emerald-500' :
                                    call.status === 'in_progress' ? 'bg-indigo-500' :
                                      call.status === 'resolved' ? 'bg-fuchsia-500' :
                                        call.status === 'pending' ? 'bg-amber-500' : 'bg-slate-400'
                                  }`}></span>
                                <span className="capitalize">{call.status.replace('_', ' ')}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right whitespace-nowrap">
                              <button
                                onClick={() => setSelectedCall(call)}
                                className="inline-flex items-center justify-center h-8 px-3 text-xs font-semibold text-indigo-600 bg-indigo-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-indigo-100 focus:opacity-100"
                              >
                                View Details
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Modern Slide-Up / Fade Modal Overlay */}
      {selectedCall && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
            onClick={() => setSelectedCall(null)}
          ></div>

          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-full animate-[fadeIn_0.2s_ease-out]">

            {/* Modal Header */}
            <div className="px-6 pt-6 pb-4 border-b border-slate-100 shrink-0">
              <div className="flex justify-between items-start gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">{selectedCall.dairy_name}</h2>
                  <p className="text-sm text-slate-500 mt-1 font-medium">Details & Resolution Report</p>
                </div>
                <button
                  onClick={() => setSelectedCall(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-6 overflow-y-auto custom-scrollbar">
              <div className="space-y-6">

                {/* Meta Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                    <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">Assigned To</p>
                    <p className="text-sm font-semibold text-slate-800">{selectedCall.name}</p>
                  </div>
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                    <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">Created Date</p>
                    <p className="text-sm font-semibold text-slate-800">{new Date(selectedCall.created_at).toLocaleDateString()}</p>
                  </div>
                </div>

                {/* Core Details */}
                <div>
                  <h3 className="text-xs uppercase tracking-widest font-bold text-slate-400 mb-3 ml-1">Problem Information</h3>
                  <div className="bg-white border text-sm text-slate-600 border-slate-200 rounded-2xl p-4 space-y-3">
                    <div className="flex gap-3">
                      <svg className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <div>
                        <p className="font-semibold text-slate-900">{selectedCall.problem}</p>
                        {selectedCall.description && <p className="mt-1 text-slate-500 leading-relaxed">{selectedCall.description}</p>}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Hardware Used - Conditional */}
                {(selectedCall.part_used || selectedCall.quantity_used) && (
                  <div>
                    <h3 className="text-xs uppercase tracking-widest font-bold text-slate-400 mb-3 ml-1">Hardware Consumed</h3>
                    <div className="bg-white border text-sm text-slate-600 border-slate-200 rounded-2xl p-4 flex gap-4">
                      <div className="p-2.5 bg-indigo-50 rounded-xl text-indigo-600 shrink-0 h-fit">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                      <div>
                        {selectedCall.part_used && <p><span className="font-semibold text-slate-800">Part:</span> <span className="text-slate-600">{selectedCall.part_used}</span></p>}
                        {selectedCall.quantity_used && <p className="mt-0.5"><span className="font-semibold text-slate-800">Quantity:</span> <span className="text-slate-600">{selectedCall.quantity_used}</span></p>}
                      </div>
                    </div>
                  </div>
                )}

                {/* Resolution Details */}
                {selectedCall.status === 'resolved' && (
                  <div>
                    <h3 className="text-xs uppercase tracking-widest font-bold text-slate-400 mb-3 ml-1">Resolution Summary</h3>
                    <div className="bg-fuchsia-50/50 border text-sm border-fuchsia-100 rounded-2xl p-4 space-y-3">
                      {selectedCall.problem1 && (
                        <div>
                          <p className="font-semibold text-fuchsia-900 text-xs uppercase">Issue 1</p>
                          <p className="text-fuchsia-800 mt-1 leading-relaxed">{selectedCall.problem1}</p>
                        </div>
                      )}
                      {selectedCall.problem2 && (
                        <div>
                          <p className="font-semibold text-fuchsia-900 text-xs uppercase mt-3 pt-3 border-t border-fuchsia-200/50">Issue 2</p>
                          <p className="text-fuchsia-800 mt-1 leading-relaxed">{selectedCall.problem2}</p>
                        </div>
                      )}
                      {selectedCall.solutions && (
                        <div>
                          <p className="font-semibold text-emerald-800 text-xs uppercase mt-3 pt-3 border-t border-fuchsia-200/50">Applied Solution</p>
                          <p className="text-emerald-700 mt-1 font-medium leading-relaxed">{selectedCall.solutions}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Logistics */}
                <div>
                  <h3 className="text-xs uppercase tracking-widest font-bold text-slate-400 mb-3 ml-1">Document Logistics</h3>
                  <div className="bg-white border text-sm text-slate-600 border-slate-200 rounded-2xl p-4 divide-y divide-slate-100">
                    <div className="flex items-center justify-between pb-3">
                      <span className="font-medium text-slate-700">Engineer Letterhead</span>
                      {selectedCall.letterhead_received
                        ? <span className="inline-flex items-center bg-emerald-50 text-emerald-600 text-[10px] font-bold px-2 py-1 rounded border border-emerald-100"><svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>Received</span>
                        : <span className="inline-flex items-center bg-red-50 text-red-600 text-[10px] font-bold px-2 py-1 rounded border border-red-100">Pending</span>
                      }
                    </div>
                    <div className="flex items-center justify-between pt-3">
                      <span className="font-medium text-slate-700">Manager Submission</span>
                      {selectedCall.letterhead_submitted
                        ? <span className="inline-flex items-center bg-emerald-50 text-emerald-600 text-[10px] font-bold px-2 py-1 rounded border border-emerald-100"><svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>Received</span>
                        : <span className="inline-flex items-center bg-red-50 text-red-600 text-[10px] font-bold px-2 py-1 rounded border border-red-100">Pending</span>
                      }
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 shrink-0">
              <button
                onClick={() => setSelectedCall(null)}
                className="w-full py-3 bg-white border border-slate-200 shadow-sm text-slate-700 font-bold rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all focus:ring-4 focus:ring-slate-100"
              >
                Close Details
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
