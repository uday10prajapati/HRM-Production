import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Geolocation } from '@capacitor/geolocation';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const EAttandance = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(false);
    const [punchState, setPunchState] = useState('in'); // 'in' means ready to punch in, 'out' means ready to punch out
    const [history, setHistory] = useState([]);
    const [delayMessage, setDelayMessage] = useState('');

    // Missed punch modal state
    const [showMissedPunch, setShowMissedPunch] = useState(false);
    const [missedForm, setMissedForm] = useState({ date: '', time: '', type: 'in', reason: '' });

    // Confirm punch modal state
    const [showConfirmPunch, setShowConfirmPunch] = useState(false);

    // Default dates for filter
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

            // Set user auth header specifically for the backend's middleware
            axios.defaults.headers.common['x-user-id'] = parsed.id;

            fetchTodayStatus(parsed.id);
            fetchHistory(parsed.id, fromDate, toDate);
        } else {
            navigate('/');
        }
    }, [navigate]);

    const fetchTodayStatus = async (userId) => {
        try {
            const res = await axios.get(`/api/attendance/latest?userId=${userId}`);
            if (res.data.success) {
                const { punch_in, punch_out } = res.data.data;
                if (punch_in && !punch_out) {
                    setPunchState('out'); // Need to punch out
                } else {
                    setPunchState('in'); // Default ready to punch in
                }
            }
        } catch (error) {
            console.error("Failed to fetch today's status:", error);
        }
    };

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

    const calculateDelay = () => {
        const now = new Date();
        const target = new Date();
        target.setHours(10, 0, 0, 0); // 10:00 AM

        if (now > target) {
            const diffMs = now - target;
            const diffMins = Math.floor(diffMs / 60000);
            const hours = Math.floor(diffMins / 60);
            const mins = diffMins % 60;
            if (hours > 0) {
                return `Delayed by ${hours} hr ${mins} min`;
            } else {
                return `Delayed by ${mins} min`;
            }
        }
        return 'On Time';
    };

    const handlePunchClick = () => {
        if (!user || loading) return;
        setShowConfirmPunch(true);
    };

    const confirmPunch = async () => {
        setShowConfirmPunch(false);
        if (!user) return;
        setLoading(true);

        try {
            // Check permissions & get location
            let permission = await Geolocation.checkPermissions();
            if (permission.location !== 'granted') {
                permission = await Geolocation.requestPermissions();
                if (permission.location !== 'granted') {
                    toast.error("Location permission heavily required for attendance!");
                    setLoading(false);
                    return;
                }
            }

            toast.info("Acquiring GPS Location...", { autoClose: 2000 });
            const coordinates = await Geolocation.getCurrentPosition({
                enableHighAccuracy: true,
                timeout: 10000
            });

            const currentType = punchState; // 'in' or 'out'

            let computedDelay = null;
            let isHalfDay = false;
            if (currentType === 'in') {
                const now = new Date();
                const d = calculateDelay();
                if (d !== 'On Time') computedDelay = d;
                if (now.getHours() >= 12) isHalfDay = true;
            }

            const payload = {
                userId: user.id,
                punch_type: currentType,
                type: currentType, // backend uses both slightly interchangably
                latitude: coordinates.coords.latitude,
                longitude: coordinates.coords.longitude,
                notes: 'Mobile App Punch',
                delay_time: computedDelay,
                is_half_day: isHalfDay
            };

            const res = await axios.post('/api/attendance/punch', payload);
            if (res.data.success) {
                toast.success(`Successfully Punched ${currentType === 'in' ? 'In' : 'Out'}!`);

                if (currentType === 'in') {
                    if (computedDelay) {
                        setDelayMessage(computedDelay);
                        toast.warning(isHalfDay ? `Half Day Marked. ${computedDelay}` : `You are ${computedDelay}`);
                    } else {
                        setDelayMessage('');
                        if (isHalfDay) toast.warning('Half Day Marked.');
                    }
                    setPunchState('out'); // Now require punch out
                } else {
                    setPunchState('in'); // Reset state if they punched out
                }

                // Refresh history and status
                fetchHistory(user.id, fromDate, toDate);
            } else {
                toast.error(res.data.message || "Failed to record attendance.");
            }
        } catch (error) {
            console.error("Punch Error:", error);
            toast.error("Error connecting to location or server services. Ensure GPS is ON.");
        } finally {
            setLoading(false);
        }
    };

    const handleFilterDate = () => {
        if (user) {
            fetchHistory(user.id, fromDate, toDate);
        }
    };

    const submitMissedPunch = async () => {
        if (!missedForm.date || !missedForm.time || !missedForm.reason) {
            toast.error("Please fill all fields.");
            return;
        }
        try {
            setLoading(true);
            const punchTimeIso = new Date(`${missedForm.date}T${missedForm.time}`).toISOString();
            const payload = {
                userId: user.id,
                type: missedForm.type,
                punch_time: punchTimeIso,
                notes: missedForm.reason
            };
            const res = await axios.post('/api/attendance/request', payload);
            if (res.data.success) {
                toast.success("Missed punch report sent to HR/Admin!");
                setShowMissedPunch(false);
                setMissedForm({ date: '', time: '', type: 'in', reason: '' });
            }
        } catch (err) {
            console.error(err);
            toast.error("Failed to submit report.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#f4f7fa] flex flex-col font-sans pb-6">
            <ToastContainer position="top-center" limit={2} />

            {/* Header */}
            <div className="bg-white px-5 py-4 flex items-center shadow-sm sticky top-0 z-10">
                <button
                    onClick={() => navigate(-1)}
                    className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors mr-3"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6 text-gray-800">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                    </svg>
                </button>
                <h1 className="text-xl font-bold text-gray-900 tracking-tight flex-1">Attendance</h1>
            </div>

            <div className="flex-1 px-4 py-5 flex flex-col gap-5">

                {/* Punch Card Section */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col items-center relative overflow-hidden">
                    <div className="absolute top-0 w-full h-1.5 bg-blue-500 left-0"></div>

                    <h2 className="text-xl font-bold text-gray-800 mb-1">Mark Attendance</h2>
                    <p className="text-sm text-gray-500 mb-6 text-center">Standard Hours: 10:00 AM - 7:00 PM<br />Location must be enabled.</p>

                    {delayMessage && punchState === 'out' && (
                        <div className="bg-red-50 text-red-600 px-4 py-2 rounded-xl text-sm font-bold mb-5 flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z" clipRule="evenodd" />
                            </svg>
                            {delayMessage}
                        </div>
                    )}

                    <button
                        onClick={handlePunchClick}
                        disabled={loading}
                        className={`w-40 h-40 rounded-full flex flex-col items-center justify-center font-bold text-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] transition-all active:scale-95 ${loading ? 'bg-gray-200 text-gray-400 border-4 border-gray-100' : (punchState === 'in' ? 'bg-emerald-50 text-emerald-600 border-[6px] border-emerald-100 hover:bg-emerald-100' : 'bg-rose-50 text-rose-600 border-[6px] border-rose-100 hover:bg-rose-100')}`}
                    >
                        {loading ? (
                            <span className="animate-pulse">Tracking...</span>
                        ) : (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-10 h-10 mb-2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zm-7.518-.267A8.25 8.25 0 1120.25 10.5M8.288 14.212A5.25 5.25 0 1117.25 10.5" />
                                </svg>
                                {punchState === 'in' ? 'Punch In' : 'Punch Out'}
                            </>
                        )}
                    </button>
                    {punchState === 'out' && <p className="text-xs font-semibold text-gray-400 mt-5">You are currently checked in.</p>}

                    <button
                        onClick={() => setShowMissedPunch(true)}
                        className="mt-6 text-sm font-semibold text-blue-500 underline decoration-blue-200 underline-offset-4 hover:text-blue-600 transition-colors"
                    >
                        Forgot to punch in/out? Send Report
                    </button>
                </div>

                {/* History Section */}
                <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100">
                    <div className="p-5 border-b border-gray-100">
                        <h3 className="text-lg font-bold text-gray-800 mb-3">Attendance History</h3>

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

            {/* Missed Punch Modal */}
            {showMissedPunch && (
                <div className="fixed inset-0 bg-black/50 z-50 flex justify-center items-center px-4 overflow-hidden">
                    <div className="bg-white max-w-sm w-full rounded-3xl p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
                        <h3 className="text-xl font-bold text-gray-800 mb-2">Missed Punch</h3>
                        <p className="text-xs text-gray-500 mb-5">Submit a request to Admin/HR if you forgot to log your attendance.</p>

                        <div className="flex flex-col gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1">Punch Type</label>
                                <div className="flex bg-gray-100 rounded-lg p-1 w-full">
                                    <button
                                        className={`flex-1 py-1.5 text-sm font-bold rounded-md transition-colors ${missedForm.type === 'in' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}
                                        onClick={() => setMissedForm({ ...missedForm, type: 'in' })}
                                    >In</button>
                                    <button
                                        className={`flex-1 py-1.5 text-sm font-bold rounded-md transition-colors ${missedForm.type === 'out' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}
                                        onClick={() => setMissedForm({ ...missedForm, type: 'out' })}
                                    >Out</button>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <div className="flex-1">
                                    <label className="block text-xs font-bold text-gray-600 mb-1">Date</label>
                                    <input type="date" value={missedForm.date} onChange={e => setMissedForm({ ...missedForm, date: e.target.value })} className="w-full bg-gray-50 border border-gray-200 text-sm font-medium rounded-xl p-2.5 outline-none focus:border-blue-400" />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs font-bold text-gray-600 mb-1">Time</label>
                                    <input type="time" value={missedForm.time} onChange={e => setMissedForm({ ...missedForm, time: e.target.value })} className="w-full bg-gray-50 border border-gray-200 text-sm font-medium rounded-xl p-2.5 outline-none focus:border-blue-400" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1">Reason</label>
                                <textarea value={missedForm.reason} onChange={e => setMissedForm({ ...missedForm, reason: e.target.value })} placeholder="e.g., Phone died, network issue" className="w-full bg-gray-50 border border-gray-200 text-sm font-medium rounded-xl p-3 h-20 outline-none focus:border-blue-400 resize-none"></textarea>
                            </div>

                            <div className="flex gap-3 mt-2">
                                <button onClick={() => setShowMissedPunch(false)} className="flex-1 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl active:scale-95 transition-all text-sm">Cancel</button>
                                <button onClick={submitMissedPunch} disabled={loading} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl active:scale-95 transition-all shadow-md shadow-blue-500/30 disabled:opacity-50 text-sm">Submit</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirm Punch Modal */}
            {showConfirmPunch && (
                <div className="fixed inset-0 bg-black/50 z-50 flex justify-center items-center px-4 animate-fadeIn">
                    <div className="bg-white max-w-sm w-full rounded-3xl p-6 shadow-2xl text-center">
                        <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4 ${punchState === 'in' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-8 h-8">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zm-7.518-.267A8.25 8.25 0 1120.25 10.5M8.288 14.212A5.25 5.25 0 1117.25 10.5" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-bold text-gray-800 mb-2">Confirm {punchState === 'in' ? 'Punch In' : 'Punch Out'}</h3>
                        <p className="text-sm text-gray-500 mb-6">Are you sure you want to mark your attendance ({punchState === 'in' ? 'Punch In' : 'Punch Out'}) right now?</p>
                        <div className="flex gap-3">
                            <button onClick={() => setShowConfirmPunch(false)} className="flex-1 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl active:scale-95 transition-all text-sm">Cancel</button>
                            <button onClick={confirmPunch} className={`flex-1 py-3.5 text-white font-bold rounded-xl active:scale-95 transition-all shadow-md text-sm ${punchState === 'in' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-rose-500 hover:bg-rose-600'}`}>Yes, {punchState === 'in' ? 'Punch In' : 'Punch Out'}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EAttandance;
