import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const ETaReport = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [history, setHistory] = useState([]);
    const [fromDate, setFromDate] = useState(() => {
        const d = new Date();
        d.setDate(1);
        return d.toISOString().split('T')[0];
    });
    const [toDate, setToDate] = useState(() => {
        return new Date().toISOString().split('T')[0];
    });

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            const parsed = JSON.parse(storedUser);
            setUser(parsed);
            axios.defaults.headers.common['x-user-id'] = parsed.id;
            fetchHistory(parsed.id, fromDate, toDate);
        } else {
            navigate('/');
        }
    }, [navigate]);

    const fetchHistory = async (userId, start, end) => {
        try {
            const res = await axios.get(`/api/service-calls/ta-records?userId=${userId}&start=${start}&end=${end}`);
            if (res.data.success) {
                setHistory(res.data.records);
            }
        } catch (error) {
            console.error("Failed to fetch TA history:", error);
        }
    };

    const handleFilterDate = () => {
        if (user) {
            fetchHistory(user.id, fromDate, toDate);
        }
    };

    // Helper to determine status color
    const getStatusStyles = (status) => {
        const s = String(status).toLowerCase();
        if (s.includes('approved') && s.includes('pending')) return 'bg-orange-100 text-orange-700 border-orange-200';
        if (s === 'approved') return 'bg-green-100 text-green-700 border-green-200';
        if (s === 'rejected') return 'bg-red-100 text-red-700 border-red-200';
        return 'bg-blue-100 text-blue-700 border-blue-200';
    };

    return (
        <div className="min-h-screen bg-[#f4f7fa] flex flex-col font-sans pb-6">
            <div className="bg-white px-5 py-4 flex items-center shadow-sm sticky top-0 z-10">
                <button
                    onClick={() => navigate(-1)}
                    className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors mr-3"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6 text-gray-800">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                    </svg>
                </button>
                <h1 className="text-xl font-bold text-gray-900 tracking-tight flex-1">TA Voucher History</h1>
            </div>

            <div className="flex-1 px-4 py-5 flex flex-col gap-5">
                <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100">
                    <div className="p-5 border-b border-gray-100">
                        <h3 className="text-lg font-bold text-gray-800 mb-3">Custom Range Report</h3>

                        <div className="flex bg-[#3a3b3c] rounded-xl overflow-hidden shadow-sm">
                            <div className="flex-1 bg-transparent p-2.5 relative flex flex-col justify-center">
                                <span className="text-gray-400 text-[10px] font-bold uppercase mb-0.5 ml-1">From</span>
                                <input
                                    type="date"
                                    value={fromDate}
                                    onChange={(e) => setFromDate(e.target.value)}
                                    className="bg-transparent text-gray-50 text-xs font-medium outline-none w-full cursor-pointer 
                                    [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full"
                                />
                            </div>
                            <div className="w-[1px] bg-gray-600/50 my-2"></div>
                            <div className="flex-1 bg-transparent p-2.5 relative flex flex-col justify-center">
                                <span className="text-gray-400 text-[10px] font-bold uppercase mb-0.5 ml-1">To</span>
                                <input
                                    type="date"
                                    value={toDate}
                                    onChange={(e) => setToDate(e.target.value)}
                                    className="bg-transparent text-gray-50 text-xs font-medium outline-none w-full cursor-pointer 
                                    [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full"
                                />
                            </div>
                            <button onClick={handleFilterDate} className="bg-indigo-500 text-white px-4 font-bold text-sm hover:bg-indigo-600 transition-colors">
                                Filter
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-col p-3 gap-3">
                        {history.length > 0 ? (
                            history.map((record, index) => (
                                <div key={index} className="p-4 rounded-2xl border border-gray-100 flex flex-col bg-white shadow-sm gap-2 hover:shadow-md transition-shadow relative overflow-hidden group">
                                    <div className={`absolute top-0 left-0 w-1 h-full ${record.ta_status === 'Approved' ? 'bg-green-500' : 'bg-orange-400'}`}></div>
                                    <div className="flex justify-between items-start pl-2">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{record.ta_voucher_date}</span>
                                            <span className="text-base font-extrabold text-gray-800">{record.ta_voucher_number}</span>
                                            <span className="text-xs font-semibold text-indigo-600 flex items-center gap-1 mt-0.5">
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 011.875 1.875v11.25a1.875 1.875 0 01-1.875 1.875H5.625a1.875 1.875 0 01-1.875-1.875V6.375A1.875 1.875 0 015.625 4.5z" />
                                                </svg>
                                                {record.ta_call_type} • {record.ta_travel_mode}
                                            </span>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            <span className={`px-2 py-1 border rounded-lg text-[10px] font-bold max-w-[120px] text-center ${getStatusStyles(record.ta_status)}`}>
                                                {record.ta_status}
                                            </span>
                                            <span className="text-xs font-bold bg-gray-50 text-gray-600 px-2 py-0.5 rounded-lg border border-gray-200 shadow-sm mt-1">KM: {record.ta_revised_km || record.kms_traveled || 0}</span>
                                        </div>
                                    </div>
                                    {record.ta_revised_places && (
                                        <div className="mt-1 pl-2 text-xs text-gray-500 font-medium">
                                            <span className="font-bold text-gray-700">Places: </span>{record.ta_revised_places}
                                        </div>
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className="py-12 text-center flex flex-col items-center justify-center opacity-70">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-12 h-12 text-gray-300 mb-2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25M9 16.5v.75m3-3v3M15 12v5.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                                </svg>
                                <span className="text-gray-400 text-sm font-bold">No TA Vouchers found in this range.</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ETaReport;
