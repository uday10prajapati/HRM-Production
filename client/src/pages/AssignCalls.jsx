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

    const handleAssign = (engineer) => {
        setSelectedEngineer(engineer);
        setShowPopup(true);
        setDairyName('');
        setProblem('');
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
            `${API_URL}/api/service-calls/assign-call`,
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
            const response = await axios.get(`${API_URL}/api/service-calls/assigned-calls`, {
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
                `${API_URL}/api/service-calls/update-status/${callId}`,
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
            const response = await axios.put(`${API_URL}/api/service-calls/assign-call/${callId}/letterhead`, { action: 'receive' });
            if (response.data.success) fetchAssignedCalls();
        } catch (err) {
            console.error('Error marking letterhead received:', err);
            alert(err.response?.data?.message || 'Failed to mark letterhead received');
        }
    };

    const markLetterheadSubmitted = async (callId) => {
        try {
            const response = await axios.put(`${API_URL}/api/service-calls/assign-call/${callId}/letterhead`, { action: 'submit' });
            if (response.data.success) fetchAssignedCalls();
        } catch (err) {
            console.error('Error marking letterhead submitted:', err);
            alert(err.response?.data?.message || 'Failed to mark letterhead submitted');
        }
    };

    return (
        <div className="min-h-screen flex flex-col bg-gray-50">
            <div className="fixed top-0 w-full z-50"><Navbar /></div>
            <div className="flex flex-1 pt-16">
                <div className="fixed left-0 h-full w-64"><Sidebar /></div>
                <main className="flex-1 ml-64 p-8">
                    <div className="max-w-7xl mx-auto">
                        {/* Header Section */}
                        <div className="mb-8">
                            <h1 className="text-3xl font-bold text-gray-800">Service Calls</h1>
                            <p className="text-gray-600 mt-1">Assign and manage service calls to engineers</p>
                        </div>

                        {/* Search Section */}
                        <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
                            <h2 className="text-xl font-semibold mb-4 text-gray-800">Search Societies</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">SOCCD</label>
                                    <input
                                        type="text"
                                        value={soccd}
                                        onChange={(e) => setSoccd(e.target.value)}
                                        placeholder="Enter SOCCD"
                                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                    />
                                </div>
                                <div>
                                    <div className="relative">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Society Name
                                        </label>
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
                                                    // 👇 NEW LOGIC
                                                    // If user enters code + name → search using both
                                                    // If only enters name → search using name only
                                                    const searchPayload = soccd
                                                        ? { soccd: soccd, society: value }
                                                        : { society: value };

                                                    const res = await axios.post(`${API_URL}/api/service-calls/search`, searchPayload);

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
                                                        console.error("Error fetching suggestions on focus:", err);
                                                    }
                                                }
                                            }}
                                            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                            placeholder="Enter Society Name"
                                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                        />

                                        {/* Suggestion dropdown */}
                                        {showSuggestions && societySuggestions.length > 0 && (
                                            <ul className="absolute z-10 bg-white border border-gray-200 rounded-lg shadow-md mt-1 w-full max-h-48 overflow-y-auto">
                                                {societySuggestions.map((item, idx) => (
                                                    <li
                                                        key={idx}
                                                        className="p-2 hover:bg-blue-50 cursor-pointer text-sm text-gray-700"
                                                        onClick={() => {
                                                            setSociety(item.society);
                                                            setShowSuggestions(false);
                                                        }}
                                                    >
                                                        {item.society}{" "}
                                                        <span className="text-gray-400 text-xs">({item.taluka})</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>

                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={handleApply}
                                    disabled={loading}
                                    className={`px-6 py-3 rounded-lg ${loading
                                        ? 'bg-gray-400 cursor-not-allowed'
                                        : 'bg-blue-600 hover:bg-blue-700'} text-white font-medium transition-colors flex items-center gap-2`}
                                >
                                    {loading ? (
                                        <>
                                            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Searching...
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                            </svg>
                                            Search
                                        </>
                                    )}
                                </button>
                            </div>
                            {error && (
                                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                                    {error}
                                </div>
                            )}
                        </div>

                        {/* Results Grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {/* Societies Section */}
                            <div className="lg:col-span-2">
                                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                                    <div className="p-6 border-b border-gray-200">
                                        <h2 className="text-xl font-semibold text-gray-800">Found Societies</h2>
                                    </div>
                                    {societies.length > 0 ? (
                                        <div className="overflow-x-auto">
                                            <table className="w-full">
                                                <thead>
                                                    <tr className="bg-gray-50">
                                                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                                                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Society</th>
                                                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Taluka</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-200">
                                                    {societies.map((row, idx) => (
                                                        <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.code}</td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.society}</td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.taluka}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <div className="p-8 text-center">
                                            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
                                            </svg>
                                            <h3 className="mt-2 text-sm font-medium text-gray-900">No societies found</h3>
                                            <p className="mt-1 text-sm text-gray-500">Use the search above to find societies.</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Engineers Section */}
                            <div className="lg:col-span-1">
                                <div className="bg-white rounded-xl shadow-sm p-6">
                                    <h2 className="text-xl font-semibold text-gray-800 mb-4">Available Engineers</h2>
                                    <div className="space-y-4">
                                        {engineers.length === 0 ? (
                                            <div className="text-center py-8">
                                                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                                </svg>
                                                <h3 className="mt-2 text-sm font-medium text-gray-900">No engineers available</h3>
                                            </div>
                                        ) : (
                                            engineers.map((engineer) => (
                                                <div key={engineer.id}
                                                    className="p-4 rounded-lg border border-gray-200 hover:border-blue-500 hover:shadow-md transition-all">
                                                    <div className="flex items-start justify-between">
                                                        <div>
                                                            <h3 className="font-medium text-gray-900">{engineer.name}</h3>
                                                            <p className="text-sm text-gray-500">{engineer.email}</p>
                                                            <p className="text-sm text-gray-500">{engineer.mobile_number}</p>
                                                        </div>
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                            {engineer.role}
                                                        </span>
                                                    </div>
                                                    <button
                                                        onClick={() => handleAssign(engineer)}
                                                        className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                                    >
                                                        Assign Call
                                                    </button>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Assigned Calls Section */}
                        <div className="mt-8 bg-white rounded-xl shadow-sm overflow-hidden">
                            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                                <h2 className="text-xl font-semibold text-gray-800">Assigned Calls</h2>
                                <button
                                    onClick={() => setShowAssignedCalls(!showAssignedCalls)}
                                    className="flex items-center gap-2 text-blue-600 hover:text-blue-700"
                                >
                                    {showAssignedCalls ? (
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                        </svg>
                                    ) : (
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                        </svg>
                                    )}
                                    {showAssignedCalls ? 'Hide' : 'Show'} Calls
                                </button>
                            </div>

                            {showAssignedCalls && (
                                <div className="p-6">
                                    <div className="grid gap-4">
                                        {assignedCalls.length === 0 ? (
                                            <div className="text-center py-8">
                                                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                                                </svg>
                                                <h3 className="mt-2 text-sm font-medium text-gray-900">No assigned calls</h3>
                                                <p className="mt-1 text-sm text-gray-500">Assign a call to an engineer to get started.</p>
                                            </div>
                                        ) : (
                                            assignedCalls.map(call => (
                                                <div key={call.id}
                                                    className="bg-white rounded-lg border border-gray-200 hover:border-blue-200 transition-all p-6">
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <h3 className="text-lg font-medium text-gray-900">{call.dairy_name}</h3>
                                                            <div className="mt-1 space-y-1">
                                                                <p className="text-sm text-gray-600">
                                                                    <span className="font-medium">Engineer:</span> {call.name}
                                                                </p>
                                                                <p className="text-sm text-gray-600">
                                                                    <span className="font-medium">Problem:</span> {call.problem}
                                                                </p>
                                                                <p className="text-xs text-gray-500">
                                                                    Created: {new Date(call.created_at).toLocaleString()}
                                                                </p>
                                                                <p className="text-sm text-gray-600">
                                                                    <span className="font-medium">Dairy Name:</span> {call.dairy_name}
                                                                </p>
                                                                <p className="text-sm text-gray-600">
                                                                    <span className="font-medium">Description:</span> {call.description}
                                                                </p>
                                                                <p className="text-sm text-gray-600">
                                                                    <span className="font-medium">Part Used:</span> {call.part_used || 'N/A'}
                                                                </p>
                                                                <p className="text-sm text-gray-600">
                                                                    <span className="font-medium">Quantity Used:</span> {call.quantity_used || 'N/A'}
                                                                </p>

                                                            </div>
                                                        </div>
                                                        <div className="flex flex-col items-end gap-2">
                                                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${call.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                                                call.status === 'completed' ? 'bg-green-100 text-green-800' :
                                                                    'bg-blue-100 text-blue-800'
                                                                }`}>
                                                                {call.status}
                                                            </span>
                                                            {!isHrOrAdmin(userRole) && (
                                                                <select
                                                                    className="mt-2 border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                                    value={call.status}
                                                                    onChange={(e) => updateCallStatus(call.call_id || call.id, e.target.value)}
                                                                >
                                                                    <option value="pending">Pending</option>
                                                                    <option value="in_progress">In Progress</option>
                                                                    <option value="completed">Completed</option>
                                                                </select>
                                                            )}

                                                            {/* Letterhead status & actions */}
                                                            <div className="mt-2 text-right space-y-2">
                                                                {call.letterhead_received ? (
                                                                    <div className="text-sm text-green-700 bg-green-50 inline-block px-3 py-1 rounded">Letterhead received by engineer</div>
                                                                ) : (
                                                                    // show receive button to engineers only
                                                                    userRole?.toLowerCase() === 'engineer' && (
                                                                        <button
                                                                            onClick={() => markLetterheadReceived(call.call_id || call.id)}
                                                                            className="mt-2 px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                                                                        >
                                                                            Mark Letterhead Received
                                                                        </button>
                                                                    )
                                                                )}

                                                                {call.letterhead_submitted ? (
                                                                    <div className="text-sm text-blue-700 bg-blue-50 inline-block px-3 py-1 rounded">Letterhead received by HR/Admin</div>
                                                                ) : (
                                                                    // show submit button to HR/Admin when engineer has received it
                                                                    isHrOrAdmin(userRole) && call.letterhead_received && (
                                                                        <button
                                                                            onClick={() => markLetterheadSubmitted(call.call_id || call.id)}
                                                                            className="mt-2 px-3 py-1 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700"
                                                                        >
                                                                            Mark Given to HR/Admin
                                                                        </button>
                                                                    )
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </main>
            </div>

            {/* Assignment Modal */}
            {showPopup && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md m-4">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-semibold text-gray-900">Assign Service Call</h3>
                            <button
                                onClick={() => setShowPopup(false)}
                                className="text-gray-400 hover:text-gray-500 transition-colors"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="mb-6">
                            <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-lg">
                                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                                    <span className="text-xl font-medium text-blue-600">
                                        {selectedEngineer?.name[0]}
                                    </span>
                                </div>
                                <div>
                                    <h4 className="font-medium text-gray-900">{selectedEngineer?.name}</h4>
                                    <p className="text-sm text-gray-500">{selectedEngineer?.role}</p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <div className="relative">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Dairy Name
                                    </label>
                                    <input
                                        type="text"
                                        value={dairyName}
                                        onChange={(e) => {
                                            setDairyName(e.target.value);
                                            setShowDairySuggestions(true);
                                        }}
                                        onFocus={() => setShowDairySuggestions(true)}
                                        onBlur={() => setTimeout(() => setShowDairySuggestions(false), 200)}
                                        placeholder="Select Dairy (from found societies)"
                                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                    />

                                    {showDairySuggestions && foundSocieties && foundSocieties.length > 0 && (
                                        <ul className="absolute z-10 bg-white border border-gray-200 rounded-lg shadow-md mt-1 w-full max-h-48 overflow-y-auto">
                                            {foundSocieties
                                                .filter((item) =>
                                                    item.society
                                                        ?.toLowerCase()
                                                        .includes(dairyName.toLowerCase())
                                                )
                                                .map((item, idx) => (
                                                    <li
                                                        key={idx}
                                                        className="p-2 hover:bg-blue-50 cursor-pointer text-sm text-gray-700"
                                                        onClick={() => {
                                                            setDairyName(item.society);
                                                            setShowDairySuggestions(false);
                                                        }}
                                                    >
                                                        {item.society}{" "}
                                                        <span className="text-gray-400 text-xs">({item.taluka})</span>
                                                    </li>
                                                ))}
                                        </ul>
                                    )}
                                </div>



                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Problem Description
                                </label>
                                <textarea
                                    value={problem}
                                    onChange={(e) => setProblem(e.target.value)}
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="Describe the problem"
                                    rows="3"
                                />
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                onClick={() => setShowPopup(false)}
                                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSubmitAssignment}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                Assign Call
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AssignCalls;