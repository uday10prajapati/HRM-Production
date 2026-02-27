import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const EAttandanceReport = () => {
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
            const res = await axios.get(`/api/attendance/records?userId=${userId}&start=${start}&end=${end}`);
            if (res.data.success) {
                setHistory(res.data.rows);
            }
        } catch (error) {
            console.error("Failed to fetch history:", error);
        }
    };

    const handleFilterDate = () => {
        if (user) {
            fetchHistory(user.id, fromDate, toDate);
        }
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
                <h1 className="text-xl font-bold text-gray-900 tracking-tight flex-1">Attendance Report</h1>
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
                            <button onClick={handleFilterDate} className="bg-blue-500 text-white px-4 font-bold text-sm hover:bg-blue-600 transition-colors">
                                Filter
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-col">
                        {history.length > 0 ? (
                            history.map(record => (
                                <div key={record.id} className="p-4 border-b border-gray-50 flex justify-between items-center bg-white hover:bg-gray-50">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-2">
                                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide ${record.type === 'in' || record.type === 'punch_in' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                                {record.type === 'in' || record.type === 'punch_in' ? 'Punch In' : 'Punch Out'}
                                            </span>
                                            {record.is_half_day && (
                                                <span className="px-2 py-0.5 rounded-md text-[10px] bg-orange-100 text-orange-700 font-extrabold uppercase tracking-wide">
                                                    Half Day
                                                </span>
                                            )}
                                            <span className="text-xs text-gray-400 font-bold">{record.created_at.split(' ')[0]}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[15px] font-bold text-gray-800">{record.created_at.split(' ')[1]} {record.created_at.split(' ')[2]}</span>
                                            {record.delay_time && (
                                                <span className="text-[11px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded-md">
                                                    Delayed: {record.delay_time}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-right flex flex-col items-end gap-1">
                                        <span className="text-xs font-bold text-gray-400 flex items-center gap-1">
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                                                <path fillRule="evenodd" d="M9.69 18.933l.003.001C9.89 19.02 10 19 10 19s.11 0 .308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 00.281-.14c.186-.096.446-.24.757-.433.62-.384 1.445-.966 2.274-1.765C15.302 14.988 17 12.493 17 9A7 7 0 103 9c0 3.492 1.698 5.988 3.355 7.584a13.731 13.731 0 002.273 1.765 11.842 11.842 0 00.976.544l.062.029.018.008.006.003zM10 11.25a2.25 2.25 0 100-4.5 2.25 2.25 0 000 4.5z" clipRule="evenodd" />
                                            </svg>
                                            Location Secured
                                        </span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="p-8 text-center text-gray-400 text-sm font-medium">
                                No records found for these dates.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EAttandanceReport;
