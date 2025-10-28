import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';

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

    useEffect(() => {
        // Fetch engineers on mount so they always show
        fetchEngineers();
    }, []);

    const fetchEngineers = async () => {
        try {
            const res = await axios.post('http://localhost:5000/api/service-calls/search', {}); // empty body returns engineers
            if (res.data?.success) {
                setEngineers(res.data.data.engineers || []);
            }
        } catch (err) {
            console.error('fetchEngineers error', err);
            setEngineers([]);
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

            const response = await axios.post('http://localhost:5000/api/service-calls/search', {
                soccd: soccd || undefined,
                society: society || undefined
            });

            if (response.data.success) {
                setSocieties(response.data.data.societies || []);
                // update engineers if backend returns them as well
                if (response.data.data.engineers) setEngineers(response.data.data.engineers);
                if ((response.data.data.societies || []).length === 0) {
                    setError('No societies found');
                }
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

    const handleSubmitAssignment = async () => {
        try {
            if (!dairyName || !problem) {
                alert('Please fill in all fields');
                return;
            }

            // Send SMS API call
            const response = await axios.post('http://localhost:5000/api/service_calls/send-sms', {
                mobileNumber: selectedEngineer.mobile_number,
                message: `Dairy Name: ${dairyName}\nProblem: ${problem}`
            });

            if (response.data.success) {
                alert('Assignment successful and SMS sent!');
                setShowPopup(false);
                setSelectedEngineer(null);
                setDairyName('');
                setProblem('');
            }
        } catch (err) {
            console.error('Assignment error:', err);
            alert('Failed to send assignment. Please try again.');
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
                                                <th className="p-3 text-left border">SOCCD</th>
                                                <th className="p-3 text-left border">Society</th>
                                                <th className="p-3 text-left border">Taluka</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {societies.map((row, idx) => (
                                                <tr key={idx} className="hover:bg-gray-50">
                                                    <td className="p-3 border">{row.soccd}</td>
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