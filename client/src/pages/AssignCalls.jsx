import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';

// Use relative API paths; endpoints are under /api/

const AssignCalls = () => {
    const [soccd, setSoccd] = useState('');
    const [society, setSociety] = useState('');
    const [societies, setSocieties] = useState([]);
    const [engineers, setEngineers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showPopup, setShowPopup] = useState(false);
    const [selectedEngineer, setSelectedEngineer] = useState(null);
    const [dairyName, setDairyName] = useState('');
    const [problem, setProblem] = useState('');
    const [assignedCalls, setAssignedCalls] = useState([]);
    const [showAssignedCalls, setShowAssignedCalls] = useState(false);  // Add this line
    const [userRole, setUserRole] = useState(''); // Add this line
    const [societySuggestions, setSocietySuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [dairySuggestions, setDairySuggestions] = useState([]);
    const [showDairySuggestions, setShowDairySuggestions] = useState(false);
    const [foundSocieties, setFoundSocieties] = useState([]);
    const [showSocietySuggestions, setShowSocietySuggestions] = useState(false);
    const [showResolvedEditModal, setShowResolvedEditModal] = useState(false);
    const [editingCall, setEditingCall] = useState(null);
    const [editProblem1, setEditProblem1] = useState('');
    const [editProblem2, setEditProblem2] = useState('');
    const [editSolutions, setEditSolutions] = useState('');

    // Add this helper function at the top of your component
    const isHrOrAdmin = (userRole) => {
        if (!userRole) return false;
        const role = userRole.toLowerCase();
        return role === 'admin' || role === 'hr';
    };

    useEffect(() => {
        // Fetch engineers on mount so they always show
        fetchEngineers();
    }, []);

    useEffect(() => {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        setUserRole(user.role || '');
    }, []);

    const fetchEngineers = async () => {
        try {
            setLoading(true);
            const res = await axios.post('/api/service-calls/search', {}, {
                // Add timeout
            });

            if (res.data?.success) {
                setEngineers(res.data.data.engineers || []);
            }
        } catch (err) {
            console.error('fetchEngineers error', err);
            if (err.code === 'ERR_NETWORK') {
                setError('Cannot connect to server. Please make sure the server is running.');
            } else {
                setError(err.message || 'Failed to fetch engineers');
            }
            setEngineers([]);
        } finally {
            setLoading(false);
        }
    };

    const handleApply = async () => {
        try {
            setLoading(true);
            setError(null);

            if (!soccd && !society) {
                setError('Please enter either SOCCD or Society Name');
                setLoading(false);
                return;
            }

            const response = await axios.post('/api/service-calls/search', {
                soccd: soccd || undefined,
                society: society || undefined
            });

            if (response.data.success) {
                const result = response.data.data.societies || [];
                setSocieties(result);
                setFoundSocieties(result); // ✅ Add this line
                if (response.data.data.engineers) setEngineers(response.data.data.engineers);
            } else {
                throw new Error(response.data.message || 'Search failed');
            }
        } catch (err) {
            console.error('Search error:', err);
            setError(err.response?.data?.message || 'Failed to search. Please try again.');
            setSocieties([]);
        } finally {
            setLoading(false);
        }
    };



    // Update handleSubmitAssignment function
    const handleSubmitAssignment = async () => {
        try {
            if (!selectedEngineer || !dairyName || !problem) {
                alert('Please fill in all required fields');
                return;
            }

            const assignData = {
                id: selectedEngineer.id,
                name: selectedEngineer.name,
                role: selectedEngineer.role,
                mobile_number: selectedEngineer.mobile_number,
                dairy_name: dairyName,
                problem: problem,
                description: problem
            };

            const response = await axios.post(
                '/api/service-calls/assign-call',
                assignData,
                { headers: { 'Content-Type': 'application/json' } }
            );

            if (response.data.success) {
                // ✅ CLOSE CARD AUTOMATICALLY
                setShowPopup(false);

                // ✅ RESET FORM
                setSelectedEngineer(null);
                setDairyName('');
                setProblem('');

                // ✅ REFRESH ASSIGNED CALLS
                fetchAssignedCalls();

                alert('Call assigned successfully!');
            }
        } catch (err) {
            console.error('Assignment error:', err);
            alert(err.response?.data?.message || 'Failed to assign call');
        }
    };


    const fetchAssignedCalls = async () => {
        try {
            const response = await axios.get('/api/service-calls/assigned-calls', {
                // Add timeout
            });

            if (response.data?.success) {
                setAssignedCalls(response.data.calls);
            }
        } catch (err) {
            console.error('Error fetching assigned calls:', err);
            if (err.code === 'ERR_NETWORK') {
                setError('Cannot connect to server. Please make sure the server is running.');
            } else {
                setError(err.message || 'Failed to fetch assigned calls');
            }
        }
    };

    useEffect(() => {
        fetchAssignedCalls();
        // Refresh assigned calls every 5 minutes
        const interval = setInterval(fetchAssignedCalls, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    const updateCallStatus = async (callId, newStatus) => {
        try {
            const response = await axios.put(
                `/api/service-calls/update-status/${callId}`,
                { status: newStatus }
            );
            if (response.data.success) {
                fetchAssignedCalls();
            }
        } catch (err) {
            console.error('Error updating status:', err);
            alert('Failed to update call status');
        }
    };

    const markLetterheadReceived = async (callId) => {
        try {
            const response = await axios.put(`/api/service-calls/assign-call/${callId}/letterhead`, { action: 'receive' });
            if (response.data.success) fetchAssignedCalls();
        } catch (err) {
            console.error('Error marking letterhead received:', err);
            alert(err.response?.data?.message || 'Failed to mark letterhead received');
        }
    };

    const markLetterheadSubmitted = async (callId) => {
        try {
            const response = await axios.put(`/api/service-calls/assign-call/${callId}/letterhead`, { action: 'submit' });
            if (response.data.success) fetchAssignedCalls();
        } catch (err) {
            console.error('Error marking letterhead submitted:', err);
            alert(err.response?.data?.message || 'Failed to mark letterhead submitted');
        }
    };

    const handleDeleteCall = async (callId) => {
        if (!window.confirm("Are you sure you want to delete this assigned call? This action cannot be undone.")) return;

        try {
            const response = await axios.delete(`/api/service-calls/assign-call/${callId}`);
            if (response.data.success) {
                fetchAssignedCalls();
            }
        } catch (err) {
            console.error('Error deleting call:', err);
            alert(err.response?.data?.message || 'Failed to delete call');
        }
    };

    const openResolvedEditModal = (call) => {
        setEditingCall(call);
        setEditProblem1(call.problem1 || '');
        setEditProblem2(call.problem2 || '');
        setEditSolutions(call.solutions || '');
        setShowResolvedEditModal(true);
    };

    const handleUpdateResolvedCallDetails = async () => {
        try {
            if (!editingCall) return;

            const response = await axios.put(
                `/api/service-calls/assign-call/${editingCall.call_id || editingCall.id}/resolved-details`,
                {
                    problem1: editProblem1,
                    problem2: editProblem2,
                    solutions: editSolutions,
                    status: 'resolved' // Ensure status is set to resolved
                }
            );

            if (response.data.success) {
                setShowResolvedEditModal(false);
                setEditingCall(null);
                setEditProblem1('');
                setEditProblem2('');
                setEditSolutions('');
                fetchAssignedCalls();
                alert('Call details updated successfully!');
            }
        } catch (err) {
            console.error('Error updating call details:', err);
            alert(err.response?.data?.message || 'Failed to update call details');
        }
    };

    return (
        <div className="min-h-screen flex flex-col bg-slate-50/50">
            <div className="fixed top-0 w-full z-50"><Navbar /></div>
            <div className="flex flex-1 pt-16 overflow-hidden">
                <div className="fixed left-0 h-full w-64 hidden md:block"><Sidebar /></div>

                <main className="flex-1 md:ml-64 p-4 sm:p-8 relative overflow-y-auto w-full custom-scrollbar">

                    {/* Background Pattern */}
                    <div className="absolute inset-x-0 top-0 h-96 bg-gradient-to-b from-indigo-50/80 to-transparent pointer-events-none -z-10" />

                    <div className="max-w-7xl mx-auto space-y-8">

                        {/* Header Section */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2 mb-8">
                            <div>
                                <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Assign Service Calls</h1>
                                <p className="text-sm font-medium text-slate-500 mt-2">Search societies and dispatch engineers</p>
                            </div>
                        </div>

                        {/* Search Section */}
                        <div className="bg-white rounded-3xl shadow-[0_2px_24px_-4px_rgba(0,0,0,0.05)] border border-slate-100 p-8 mb-8 transition-all">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0l1.414 1.414A9.953 9.953 0 0121 21z" />
                                    </svg>
                                </div>
                                <h2 className="text-xl font-bold text-slate-800">Search Dairy / Society</h2>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 ml-1">SOCCD Code</label>
                                    <input
                                        type="text"
                                        value={soccd}
                                        onChange={(e) => setSoccd(e.target.value)}
                                        placeholder="Enter unique code..."
                                        className="w-full px-5 py-3.5 bg-slate-50/50 border border-slate-200 text-sm font-medium rounded-2xl focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all placeholder:text-slate-400 placeholder:font-normal"
                                    />
                                </div>
                                <div className="relative">
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 ml-1">Society Name</label>
                                    <input
                                        type="text"
                                        value={society}
                                        onChange={async (e) => {
                                            const value = e.target.value;
                                            setSociety(value);

                                            if (value.length < 1) {
                                                setSocietySuggestions([]);
                                                return;
                                            }

                                            try {
                                                const searchPayload = soccd
                                                    ? { soccd: soccd, society: value }
                                                    : { society: value };

                                                const res = await axios.post('/api/service-calls/search', searchPayload);

                                                if (res.data.success) {
                                                    setSocietySuggestions(res.data.data.societies || []);
                                                    setShowSuggestions(true);
                                                } else {
                                                    setSocietySuggestions([]);
                                                }
                                            } catch (err) {
                                                console.error("Suggestion fetch error:", err);
                                                setSocietySuggestions([]);
                                            }
                                        }}
                                        onFocus={async () => {
                                            if (soccd) {
                                                try {
                                                    const res = await axios.post('/api/service-calls/search', {
                                                        soccd: soccd,
                                                    });
                                                    if (res.data.success) {
                                                        setSocietySuggestions(res.data.data.societies || []);
                                                        setShowSuggestions(true);
                                                    }
                                                } catch (err) {
                                                    console.error("Error fetching suggestions:", err);
                                                }
                                            }
                                        }}
                                        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                        placeholder="Type society name..."
                                        className="w-full px-5 py-3.5 bg-slate-50/50 border border-slate-200 text-sm font-medium rounded-2xl focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all placeholder:text-slate-400 placeholder:font-normal"
                                    />

                                    {showSuggestions && societySuggestions.length > 0 && (
                                        <ul className="absolute z-20 bg-white border border-slate-100 rounded-2xl shadow-xl mt-2 w-full max-h-56 overflow-y-auto divide-y divide-slate-50 ring-1 ring-slate-900/5 custom-scrollbar pb-1 pt-1">
                                            {societySuggestions.map((item, idx) => (
                                                <li
                                                    key={idx}
                                                    className="px-5 py-3 hover:bg-slate-50 cursor-pointer text-sm font-semibold text-slate-800 transition-colors"
                                                    onMouseDown={() => {
                                                        setSociety(item.society);
                                                        setShowSuggestions(false);
                                                    }}
                                                >
                                                    {item.society}
                                                    <span className="ml-2 px-2 py-0.5 rounded-md bg-slate-100 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                                                        {item.taluka}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center">
                                <button
                                    onClick={handleApply}
                                    disabled={loading}
                                    className={`px-8 py-3.5 rounded-2xl shadow-sm hover:shadow-md transition-all font-bold text-sm tracking-wide flex items-center justify-center gap-2 ${loading
                                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
                                        : 'bg-indigo-600 hover:bg-indigo-700 text-white border-b-4 border-indigo-800 active:border-b-0 active:translate-y-[4px]'}`}
                                >
                                    {loading ? (
                                        <>
                                            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Searching...
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                            </svg>
                                            Search Database
                                        </>
                                    )}
                                </button>
                            </div>

                            {error && (
                                <div className="mt-6 p-4 bg-red-50/80 border border-red-100 rounded-xl text-red-600 text-sm font-medium flex items-center gap-2">
                                    <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                    {error}
                                </div>
                            )}
                        </div>

                        {/* Search Results */}
                        <div className="bg-white rounded-3xl shadow-[0_2px_24px_-4px_rgba(0,0,0,0.05)] border border-slate-100 overflow-hidden relative">
                            {societies.length > 0 && (
                                <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                                    <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500">Matching Results</h2>
                                </div>
                            )}

                            {societies.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="bg-white border-b border-slate-100">
                                                <th className="px-8 py-5 text-[0.7rem] font-bold text-slate-400 uppercase tracking-wider">Society Name</th>
                                                <th className="px-8 py-5 text-[0.7rem] font-bold text-slate-400 uppercase tracking-wider">SOCCD Code</th>
                                                <th className="px-8 py-5 text-[0.7rem] font-bold text-slate-400 uppercase tracking-wider">Taluka</th>
                                                <th className="px-8 py-5 text-[0.7rem] font-bold text-slate-400 uppercase tracking-wider text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {societies.map((row, idx) => (
                                                <tr key={idx} className="hover:bg-slate-50/80 transition-colors group">
                                                    <td className="px-8 py-5">
                                                        <span className="font-bold text-slate-800">{row.society}</span>
                                                    </td>
                                                    <td className="px-8 py-5">
                                                        <span className="inline-flex bg-slate-100 text-slate-600 text-xs font-bold px-2.5 py-1 rounded-md">{row.code}</span>
                                                    </td>
                                                    <td className="px-8 py-5">
                                                        <span className="text-sm font-medium text-slate-500">{row.taluka}</span>
                                                    </td>
                                                    <td className="px-8 py-5 text-right">
                                                        <button
                                                            onClick={() => {
                                                                setSelectedEngineer('');
                                                                setDairyName(row.society || '');
                                                                setProblem('');
                                                                setShowPopup(true);
                                                            }}
                                                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white rounded-xl font-bold text-xs uppercase tracking-wide transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                                                            Dispatch
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="p-16 text-center">
                                    <div className="w-20 h-20 bg-slate-50 rounded-full flex flex-col items-center justify-center mx-auto mb-4 border border-slate-100">
                                        <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 7h6M9 11h6" />
                                        </svg>
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-800">No active search</h3>
                                    <p className="mt-2 text-sm font-medium text-slate-400">Search for a society alias or ID to assign engineers.</p>
                                </div>
                            )}
                        </div>

                        {/* Recent Calls Toggle & List */}
                        <div className="bg-transparent mb-12">
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-900">Manage Dispatch Queue</h2>
                                    <p className="text-sm font-medium text-slate-500 mt-1">Review recently assigned tasks and open tickets.</p>
                                </div>
                                <button
                                    onClick={() => setShowAssignedCalls(!showAssignedCalls)}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 shadow-sm rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all"
                                >
                                    {showAssignedCalls ? 'Collapse Queue' : 'Expand Database'}
                                    <svg className={`w-4 h-4 text-slate-400 transition-transform ${showAssignedCalls ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>
                            </div>

                            {showAssignedCalls && (
                                <div className="space-y-4 animate-[fadeIn_0.3s_ease-out]">
                                    {assignedCalls.length === 0 ? (
                                        <div className="text-center py-16 bg-white border border-slate-100 rounded-3xl shadow-sm">
                                            <div className="w-16 h-16 bg-slate-50 rounded-full flex flex-col items-center justify-center mx-auto mb-4">
                                                <svg className="w-6 h-6 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                                </svg>
                                            </div>
                                            <h3 className="text-lg font-bold text-slate-900">Queue Empty</h3>
                                            <p className="mt-1 text-sm text-slate-500">All assigning tasks are cleared.</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                            {assignedCalls.map(call => (
                                                <div key={call.id} className="bg-white rounded-3xl border border-slate-100 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] p-6 hover:shadow-md transition-all group overflow-hidden relative">

                                                    {call.status === 'pending' && <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-400" />}
                                                    {call.status === 'in_progress' && <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500" />}
                                                    {call.status === 'resolved' && <div className="absolute top-0 left-0 w-1.5 h-full bg-fuchsia-500" />}
                                                    {call.status === 'completed' && <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500" />}

                                                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                                                        <div className="flex-1 space-y-4 w-full">
                                                            <div>
                                                                <div className="flex items-center gap-3 mb-1">
                                                                    <div className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-md text-[10px] uppercase font-bold tracking-wider">Case #{call.id || call.call_id}</div>
                                                                    <span className="text-xs font-semibold text-slate-400">{new Date(call.created_at).toLocaleString()}</span>
                                                                </div>
                                                                <h3 className="text-xl font-bold text-slate-900 leading-tight">{call.dairy_name}</h3>
                                                            </div>

                                                            <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-50">
                                                                <div>
                                                                    <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">Engineer</p>
                                                                    <p className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                                                                        <span className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-[9px] text-indigo-700">{String(call.name)[0]}</span>
                                                                        {call.name}
                                                                    </p>
                                                                </div>
                                                                <div>
                                                                    <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">Active Status</p>
                                                                    <select
                                                                        className="w-full sm:w-auto mt-0.5 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold bg-slate-50 text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-colors uppercase tracking-wide cursor-pointer"
                                                                        value={call.status}
                                                                        onChange={(e) => updateCallStatus(call.call_id || call.id, e.target.value)}
                                                                    >
                                                                        <option value="pending">PENDING</option>
                                                                        <option value="in_progress">IN PROGRESS</option>
                                                                        <option value="completed">COMPLETED</option>
                                                                        <option value="resolved">RESOLVED</option>
                                                                    </select>
                                                                </div>
                                                            </div>

                                                            <div>
                                                                <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">Issue Reported</p>
                                                                <p className="text-sm font-semibold text-slate-700">{call.problem}</p>
                                                                {call.description && call.description !== call.problem && (
                                                                    <p className="text-sm font-medium text-slate-500 mt-1 line-clamp-2">{call.description}</p>
                                                                )}
                                                            </div>

                                                            {call.status === 'resolved' && (call.problem1 || call.solutions) && (
                                                                <div className="bg-fuchsia-50/50 border border-fuchsia-100 p-3 rounded-xl mt-3">
                                                                    <p className="text-[10px] uppercase tracking-widest font-bold text-fuchsia-900/50 mb-1">Resolution Summary</p>
                                                                    {call.problem1 && <p className="text-xs font-medium text-fuchsia-800 mb-1"><span className="font-bold">Prob 1:</span> {call.problem1}</p>}
                                                                    {call.solutions && <p className="text-xs font-medium text-fuchsia-800"><span className="font-bold">Sol:</span> {call.solutions}</p>}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Action Column */}
                                                        <div className="flex flex-col items-end gap-3 w-full sm:w-[160px] shrink-0 border-t sm:border-t-0 sm:border-l border-slate-50 pt-4 sm:pt-0 sm:pl-4">

                                                            {/* Removed Edit Resolves / Add Post-Mortem button */}

                                                            <div className="w-full space-y-2 mt-auto">
                                                                {call.letterhead_received ? (
                                                                    <div className="w-full text-center text-[10px] uppercase tracking-wider font-bold text-emerald-600 bg-emerald-50 px-2 py-1.5 rounded-lg border border-emerald-100 flex items-center justify-center gap-1">
                                                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg> Eng. Received
                                                                    </div>
                                                                ) : (
                                                                    userRole?.toLowerCase() === 'engineer' && (
                                                                        <button
                                                                            onClick={() => markLetterheadReceived(call.call_id || call.id)}
                                                                            className="w-full py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 shadow-sm"
                                                                        >
                                                                            Confirm Receipt
                                                                        </button>
                                                                    )
                                                                )}

                                                                {call.letterhead_submitted ? (
                                                                    <div className="w-full text-center text-[10px] uppercase tracking-wider font-bold text-indigo-600 bg-indigo-50 px-2 py-1.5 rounded-lg border border-indigo-100 flex items-center justify-center gap-1">
                                                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg> Admin Synced
                                                                    </div>
                                                                ) : (
                                                                    isHrOrAdmin(userRole) && call.letterhead_received && (
                                                                        <button
                                                                            onClick={() => markLetterheadSubmitted(call.call_id || call.id)}
                                                                            className="w-full py-1.5 bg-slate-800 text-white text-xs font-bold rounded-lg hover:bg-slate-900 shadow-sm"
                                                                        >
                                                                            Mark Verified
                                                                        </button>
                                                                    )
                                                                )}
                                                            </div>

                                                            {(isHrOrAdmin(userRole)) && (
                                                                <button
                                                                    onClick={() => handleDeleteCall(call.call_id || call.id)}
                                                                    className="w-full text-center px-3 py-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg text-[10px] uppercase font-bold tracking-wider transition-colors mt-1"
                                                                >
                                                                    Terminate Call
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </main>
            </div>

            {/* Assignment Form Modal */}
            {showPopup && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={() => setShowPopup(false)}></div>
                    <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-[fadeIn_0.2s_ease-out]">

                        <div className="px-8 pt-8 pb-6 border-b border-slate-100">
                            <h3 className="text-2xl font-bold text-slate-900">Dispatch Engineer</h3>
                            <p className="text-sm font-medium text-slate-500 mt-1">Assign an operator to <span className="text-indigo-600 font-bold">{dairyName}</span></p>
                        </div>

                        <div className="p-8 space-y-6">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 ml-1">
                                    Operator / Engineer
                                </label>
                                <div className="relative">
                                    <select
                                        className="appearance-none w-full px-5 py-3.5 bg-slate-50/50 border border-slate-200 text-sm font-bold text-slate-800 rounded-2xl focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all cursor-pointer"
                                        value={selectedEngineer?.id || ''}
                                        onChange={(e) => {
                                            const eng = engineers.find(eng => String(eng.id) === e.target.value);
                                            setSelectedEngineer(eng || null);
                                        }}
                                    >
                                        <option value="" disabled>-- Select an Engineer --</option>
                                        {engineers.map(e => (
                                            <option key={e.id} value={e.id}>{e.name} ({e.role})</option>
                                        ))}
                                    </select>
                                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                                        <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 ml-1">
                                    Issue Description
                                </label>
                                <textarea
                                    value={problem}
                                    onChange={(e) => setProblem(e.target.value)}
                                    className="w-full px-5 py-4 bg-slate-50/50 border border-slate-200 text-sm font-medium rounded-2xl focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all placeholder:text-slate-400 placeholder:font-normal resize-none"
                                    placeholder="Briefly describe the hardware or software problem..."
                                    rows="4"
                                />
                            </div>
                        </div>

                        <div className="px-8 py-5 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row justify-end gap-3">
                            <button
                                onClick={() => setShowPopup(false)}
                                className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 font-bold text-sm rounded-xl hover:bg-slate-50 focus:ring-4 focus:ring-slate-100 transition-all w-full sm:w-auto"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSubmitAssignment}
                                className="px-8 py-2.5 bg-indigo-600 text-white font-bold text-sm rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 focus:ring-4 focus:ring-indigo-600/20 transition-all w-full sm:w-auto border-b-2 border-indigo-800 active:border-b-0 active:translate-y-[2px]"
                            >
                                Confirm Dispatch
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Resolved Call Details Edit Modal */}
            {showResolvedEditModal && editingCall && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => { setShowResolvedEditModal(false); setEditingCall(null); }}></div>

                    <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-[fadeIn_0.2s_ease-out]">
                        <div className="px-8 pt-8 pb-4 border-b border-slate-100 flex justify-between items-start">
                            <div>
                                <h3 className="text-2xl font-bold text-slate-900">Post-Mortem Details</h3>
                                <p className="text-sm font-medium text-slate-500 mt-1">Log resolutions for <span className="text-fuchsia-600 font-bold">{editingCall.dairy_name}</span></p>
                            </div>
                            <button onClick={() => { setShowResolvedEditModal(false); setEditingCall(null); }} className="p-2 text-slate-400 hover:text-slate-600 bg-slate-50 rounded-full transition-colors mt-1">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <div className="p-8 space-y-5">
                            <div className="bg-fuchsia-50 p-4 rounded-xl border border-fuchsia-100">
                                <p className="text-xs font-bold uppercase tracking-wider text-fuchsia-900/50 mb-1">Original Issue Handled</p>
                                <p className="text-sm font-medium text-fuchsia-900">{editingCall.problem}</p>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 ml-1">Problem Node 1</label>
                                    <textarea
                                        value={editProblem1}
                                        onChange={(e) => setEditProblem1(e.target.value)}
                                        className="w-full px-5 py-3 bg-slate-50/50 border border-slate-200 text-sm font-medium rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-fuchsia-500/20 focus:border-fuchsia-500 transition-all resize-none"
                                        placeholder="Specific diagnostic issue 1..."
                                        rows="2"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 ml-1">Problem Node 2</label>
                                    <textarea
                                        value={editProblem2}
                                        onChange={(e) => setEditProblem2(e.target.value)}
                                        className="w-full px-5 py-3 bg-slate-50/50 border border-slate-200 text-sm font-medium rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-fuchsia-500/20 focus:border-fuchsia-500 transition-all resize-none"
                                        placeholder="Specific diagnostic issue 2..."
                                        rows="2"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 ml-1">Implemented Solution</label>
                                    <textarea
                                        value={editSolutions}
                                        onChange={(e) => setEditSolutions(e.target.value)}
                                        className="w-full px-5 py-3 bg-slate-50/50 border border-slate-200 text-sm font-medium rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-fuchsia-500/20 focus:border-fuchsia-500 transition-all resize-none"
                                        placeholder="Detail the steps taken to resolve the issues..."
                                        rows="3"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="px-8 py-5 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row justify-end gap-3">
                            <button
                                onClick={() => { setShowResolvedEditModal(false); setEditingCall(null); }}
                                className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 font-bold text-sm rounded-xl hover:bg-slate-50 focus:ring-4 focus:ring-slate-100 transition-all w-full sm:w-auto"
                            >
                                Discard
                            </button>
                            <button
                                onClick={handleUpdateResolvedCallDetails}
                                className="px-8 py-2.5 bg-fuchsia-600 text-white font-bold text-sm rounded-xl hover:bg-fuchsia-700 shadow-lg shadow-fuchsia-600/20 focus:ring-4 focus:ring-fuchsia-600/20 transition-all w-full sm:w-auto border-b-2 border-fuchsia-800 active:border-b-0 active:translate-y-[2px]"
                            >
                                Save Post-Mortem
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AssignCalls;