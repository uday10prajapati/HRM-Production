import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';

// Add a base URL constant
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

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
            const res = await axios.post('http://localhost:5000/api/service-calls/search', {}, {
                timeout: 5000 // Add timeout
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

            const response = await axios.post(`${API_URL}/api/service-calls/search`, {
                soccd: soccd || undefined,
                society: society || undefined
            });

            if (response.data.success) {
                setSocieties(response.data.data.societies || []);
                // update engineers if backend returns them as well
                if (response.data.data.engineers) setEngineers(response.data.data.engineers);
                // If no societies returned, keep societies as empty array and
                // show the friendly message in the societies area rather than
                // setting a red error banner.
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
                'http://localhost:5000/api/service-calls/assign-call',
                assignData,
                {
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (response.data.success) {
                alert('Call assigned successfully!');
                setDairyName('');
                setProblem('');
                setSelectedEngineer(null);
                fetchAssignedCalls(); // Refresh the list
            }
        } catch (err) {
            console.error('Assignment error:', err);
            alert(err.response?.data?.message || 'Failed to assign call');
        }
    };

    const fetchAssignedCalls = async () => {
        try {
            const response = await axios.get('http://localhost:5000/api/service-calls/assigned-calls', {
                timeout: 5000 // Add timeout
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
                `http://localhost:5000/api/service-calls/update-status/${callId}`,
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

    return (
        <div className="min-h-screen flex flex-col">
            <div className="fixed top-0 w-full z-50"><Navbar /></div>
            <div className="flex flex-1 pt-16">
                <div className="fixed left-0 h-full w-64"><Sidebar /></div>
                <main className="flex-1 ml-64 p-6">
                    <div className="container mx-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h1 className="text-2xl font-semibold">Search Societies</h1>
                        </div>

                        {/* Search Fields */}
                        <div className="bg-white p-4 rounded shadow mb-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <input
                                    type="text"
                                    value={soccd}
                                    onChange={(e) => setSoccd(e.target.value)}
                                    placeholder="Enter SOCCD"
                                    className="p-2 border rounded shadow-sm w-full"
                                />
                                <input
                                    type="text"
                                    value={society}
                                    onChange={(e) => setSociety(e.target.value)}
                                    placeholder="Enter Society Name"
                                    className="p-2 border rounded shadow-sm w-full"
                                />
                            </div>

                            <button
                                onClick={handleApply}
                                disabled={loading}
                                className={`px-4 py-2 rounded ${loading ? 'bg-gray-400' : 'bg-blue-500 hover:bg-blue-600'} text-white`}
                            >
                                {loading ? 'Searching...' : 'Search'}
                            </button>

                            {error && <div className="text-red-500 mt-2">{error}</div>}
                        </div>

                        {/* Societies - Always visible */}
                        <div className="bg-white p-4 rounded shadow mb-8">
                            <h2 className="text-xl font-semibold mb-3"></h2>
                            {societies.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full bg-white border rounded-lg">
                                        <thead>
                                            <tr className="bg-gray-50">
                                                <th className="p-3 text-left border">Code</th>
                                                <th className="p-3 text-left border">Society</th>
                                                <th className="p-3 text-left border">Taluka</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {societies.map((row, idx) => (
                                                <tr key={idx} className="hover:bg-gray-50">
                                                    <td className="p-3 border">{row.code}</td>
                                                    <td className="p-3 border">{row.society}</td>
                                                    <td className="p-3 border">{row.taluka}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="text-gray-500 p-4 text-center bg-gray-50 rounded">
                                    {loading ? 'Searching societies...' : 'No societies found. Use the search above to find societies.'}
                                </div>
                            )}
                        </div>

                        {/* Engineers cards - Always visible */}
                        <div className="bg-white p-4 rounded shadow">
                            <h2 className="text-xl font-semibold mb-4">Available Engineers</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                {engineers.length === 0 ? (
                                    <div className="col-span-full text-center text-gray-500 p-4 bg-gray-50 rounded">
                                        Loading engineers...
                                    </div>
                                ) : (
                                    engineers.map((engineer) => (
                                        <div key={engineer.id} className="bg-gray-50 p-4 rounded-lg shadow hover:shadow-md transition-shadow">
                                            <div className="flex items-center justify-between mb-2">
                                                <h3 className="font-semibold text-lg">{engineer.name}</h3>
                                                <span className="text-sm text-gray-500">{engineer.role}</span>
                                            </div>
                                            <div className="text-gray-600 text-sm mb-2">{engineer.email}</div>
                                            <div className="text-gray-600 text-sm mb-3">{engineer.mobile_number}</div>
                                            <button
                                                className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded"
                                                onClick={() => handleAssign(engineer)}
                                            >
                                                Assign Call
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Assigned Calls Section */}
                        <div className="bg-white p-4 rounded shadow mt-8">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-xl font-semibold">Assigned Calls</h2>
                                <button
                                    onClick={() => setShowAssignedCalls(!showAssignedCalls)}
                                    className="text-blue-500 hover:text-blue-600"
                                >
                                    {showAssignedCalls ? 'Hide' : 'Show'} Assigned Calls
                                </button>
                            </div>

                            {showAssignedCalls && (
                                <div className="grid gap-4">
                                    {assignedCalls.length === 0 ? (
                                        <div className="text-center text-gray-500 p-4">
                                            No assigned calls found
                                        </div>
                                    ) : (
                                        assignedCalls.map(call => (
                                            <div key={call.id} 
                                                 className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                                                <div className="flex justify-between">
                                                    <div>
                                                        <h3 className="font-medium text-lg">
                                                            {call.dairy_name}
                                                        </h3>
                                                        <p className="text-sm text-gray-600">
                                                            Engineer: {call.name}
                                                        </p>
                                                        <p className="text-sm text-gray-600">
                                                            Problem: {call.problem}
                                                        </p>
                                                        <p className="text-xs text-gray-500 mt-1">
                                                            Created: {new Date(call.created_at).toLocaleString()}
                                                        </p>
                                                    </div>
                                                    <div className="flex flex-col items-end">
                                                        <span className={`px-2 py-1 rounded text-sm ${
                                                            call.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                                            call.status === 'completed' ? 'bg-green-100 text-green-800' :
                                                            'bg-blue-100 text-blue-800'
                                                        }`}>
                                                            {call.status}
                                                        </span>
                                                        {!isHrOrAdmin(userRole) && (
                                                            <select 
                                                                className="mt-2 border rounded p-1 text-sm"
                                                                value={call.status}
                                                                onChange={(e) => updateCallStatus(call.id, e.target.value)}
                                                            >
                                                                <option value="pending">Pending</option>
                                                                <option value="in_progress">In Progress</option>
                                                                <option value="completed">Completed</option>
                                                            </select>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </main>
            </div>

            {/* Popup Card */}
            {showPopup && (
                <div className="fixed inset-0 bg-black/40 bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-96 shadow-xl">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-semibold">Assign Call</h3>
                            <button 
                                onClick={() => setShowPopup(false)}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                ✕
                            </button>
                        </div>
                        
                        <div className="mb-4">
                            <p className="text-gray-600 mb-2">
                                Assigning to: <span className="font-semibold">{selectedEngineer?.name}</span>
                            </p>
                        </div>

                        <div className="mb-4">
                            <label className="block text-gray-700 text-sm font-bold mb-2">
                                Dairy Name
                            </label>
                            <input
                                type="text"
                                value={dairyName}
                                onChange={(e) => setDairyName(e.target.value)}
                                className="w-full p-2 border rounded focus:outline-none focus:border-blue-500"
                                placeholder="Enter dairy name"
                            />
                        </div>

                        <div className="mb-6">
                            <label className="block text-gray-700 text-sm font-bold mb-2">
                                Problem Description
                            </label>
                            <textarea
                                value={problem}
                                onChange={(e) => setProblem(e.target.value)}
                                className="w-full p-2 border rounded focus:outline-none focus:border-blue-500"
                                placeholder="Describe the problem"
                                rows="3"
                            />
                        </div>

                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setShowPopup(false)}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSubmitAssignment}
                                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
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