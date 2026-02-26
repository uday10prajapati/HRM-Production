import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const ELeave = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [leaves, setLeaves] = useState([]);
    const [loading, setLoading] = useState(true);

    // Leave Apply Form State
    const [showLeaveForm, setShowLeaveForm] = useState(false);
    const [leaveForm, setLeaveForm] = useState({
        startDate: '',
        endDate: '',
        type: 'Casual',
        day_type: 'full',
        reason: ''
    });
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        const storedUser = localStorage.getItem("user");
        if (storedUser) {
            const parsedUser = JSON.parse(storedUser);
            setUser(parsedUser);
            fetchUserWithBalance(parsedUser.id);
            fetchLeaves(parsedUser.id);
        } else {
            navigate('/');
        }
    }, [navigate]);

    const fetchUserWithBalance = async (userId) => {
        try {
            const { data } = await axios.get('/api/users/me', { headers: { 'x-user-id': userId } });
            if (data.success && data.user) {
                // Update local storage and state to get fresh leave_balance
                setUser(data.user);
                localStorage.setItem("user", JSON.stringify(data.user));
            }
        } catch (err) {
            console.error("Failed to fetch fresh user data:", err);
        }
    };

    const fetchLeaves = async (userId) => {
        try {
            setLoading(true);
            const { data } = await axios.get('/api/leave', { headers: { 'x-user-id': userId } });
            if (data.success) {
                setLeaves(data.leaves);
            }
        } catch (err) {
            console.error('Failed to fetch leaves:', err);
            toast.error('Failed to load your leave history.');
        } finally {
            setLoading(false);
        }
    };

    const handleApplyLeave = async () => {
        if (!leaveForm.startDate || !leaveForm.endDate || !leaveForm.reason) {
            toast.error("Please fill all required fields.");
            return;
        }

        const start = new Date(leaveForm.startDate);
        const end = new Date(leaveForm.endDate);
        if (end < start) {
            toast.error("End Date cannot be before Start Date.");
            return;
        }

        try {
            setSubmitting(true);
            const payload = {
                userId: user.id,
                startDate: leaveForm.startDate,
                endDate: leaveForm.endDate,
                type: leaveForm.type,
                day_type: leaveForm.day_type,
                reason: leaveForm.reason
            };
            const { data } = await axios.post('/api/leave/apply', payload);

            if (data.success) {
                toast.success("Leave application submitted successfully!");
                setShowLeaveForm(false);
                setLeaveForm({ startDate: '', endDate: '', type: 'Casual', day_type: 'full', reason: '' });
                fetchLeaves(user.id);
            }
        } catch (err) {
            console.error(err);
            toast.error(err?.response?.data?.message || 'Failed to submit leave application.');
        } finally {
            setSubmitting(false);
        }
    };

    // Calculate duration display helper
    const getDurationText = (start, end, dayType) => {
        const s = new Date(start);
        const e = new Date(end);
        const diffTime = Math.abs(e - s);
        let diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

        if (diffDays === 1 && dayType === 'half') {
            return '0.5 Day';
        }
        return `${diffDays} Day${diffDays > 1 ? 's' : ''}`;
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
                <div>
                    <h1 className="text-xl font-bold text-gray-900 tracking-tight">Leave Management</h1>
                    <p className="text-xs font-semibold text-gray-400">Balance & History</p>
                </div>
            </div>

            {/* Content */}
            <div className="p-4 sm:p-5 flex-1 max-w-lg w-full mx-auto space-y-5">

                {/* Balance Card */}
                <div className="bg-gradient-to-br from-indigo-500 to-blue-600 rounded-3xl p-6 shadow-lg shadow-blue-500/20 text-white relative overflow-hidden">
                    <svg className="absolute top-0 right-0 w-32 h-32 text-white opacity-10 -mr-6 -mt-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" /></svg>

                    <div className="flex justify-between items-center mb-2 relative">
                        <h2 className="text-sm font-bold text-blue-100 uppercase tracking-widest">Available Balance</h2>
                    </div>

                    <div className="flex items-end gap-2 relative">
                        <span className="text-5xl font-black tracking-tight">{Number(user?.leave_balance || 0).toFixed(1)}</span>
                        <span className="text-sm font-bold text-blue-100 mb-1.5 opacity-80">Days</span>
                    </div>

                    <p className="text-xs text-blue-100 mt-4 opacity-90 leading-relaxed font-medium">
                        You accrue 1.5 days per month (1 full, 1 half). <br />
                        <span className="opacity-75 italic">*Negative balances represent extra leaves deducted from salary.</span>
                    </p>
                </div>

                {/* Actions */}
                <button
                    onClick={() => setShowLeaveForm(true)}
                    className="w-full py-4 bg-white border border-gray-100 text-indigo-600 font-extrabold rounded-2xl shadow-sm hover:shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"></path></svg>
                    Apply for Leave
                </button>

                {/* History Section */}
                <div>
                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-3 mt-2 pl-1">Leave History</h3>

                    {loading ? (
                        <div className="flex justify-center items-center py-10">
                            <div className="animate-spin text-indigo-500">
                                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            </div>
                        </div>
                    ) : leaves.length === 0 ? (
                        <div className="bg-white rounded-3xl p-8 text-center border border-gray-100 shadow-sm">
                            <p className="text-sm text-gray-400 font-bold tracking-wide">No leave history found.</p>
                        </div>
                    ) : (
                        <div className="space-y-3 custom-scrollbar">
                            {leaves.map(leave => (
                                <div key={leave.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-4 relative overflow-hidden">
                                    {/* Left Accent Bar depending on status */}
                                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${leave.status === 'approved' ? 'bg-emerald-400' :
                                            leave.status === 'rejected' ? 'bg-rose-400' :
                                                'bg-amber-400'
                                        }`}></div>

                                    <div className="flex-1 pl-1">
                                        <div className="flex justify-between items-start mb-1">
                                            <h4 className="font-extrabold text-slate-800 tracking-tight text-sm">
                                                {new Date(leave.start_date).toLocaleDateString("en-GB", { day: 'numeric', month: 'short' })}
                                                {leave.start_date !== leave.end_date && ` - ${new Date(leave.end_date).toLocaleDateString("en-GB", { day: 'numeric', month: 'short' })}`}
                                            </h4>

                                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${leave.status === 'approved' ? 'bg-emerald-50 text-emerald-600' :
                                                    leave.status === 'rejected' ? 'bg-rose-50 text-rose-600' :
                                                        'bg-amber-50 text-amber-600'
                                                }`}>
                                                {leave.status}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-2 mb-2 mt-1.5">
                                            <span className="text-[10px] bg-slate-100 text-slate-500 font-bold px-1.5 py-0.5 rounded uppercase">{leave.type}</span>
                                            <span className="text-[10px] bg-indigo-50 text-indigo-500 font-bold px-1.5 py-0.5 rounded uppercase">{leave.day_type}</span>
                                            <span className="text-[10px] text-slate-400 font-bold flex items-center justify-center ml-1">
                                                <svg className="w-3 h-3 mr-0.5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                                {getDurationText(leave.start_date, leave.end_date, leave.day_type)}
                                            </span>
                                        </div>

                                        <p className="text-xs text-slate-500 italic line-clamp-2 mt-1">"{leave.reason}"</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Leave Apply Modal */}
            {showLeaveForm && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-center px-4 overflow-hidden animate-[fadeIn_0.2s_ease-out]">
                    <div className="bg-white max-w-sm w-full rounded-[2rem] p-6 shadow-2xl relative">
                        <h3 className="text-xl font-extrabold text-gray-800 mb-1">Apply Leave</h3>
                        <p className="text-xs font-semibold text-gray-400 mb-5">Submit your leave request to HR.</p>

                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Start Date</label>
                                    <input
                                        type="date"
                                        value={leaveForm.startDate}
                                        onChange={e => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 text-sm font-bold text-slate-700 rounded-xl p-2.5 outline-none focus:border-indigo-400 transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">End Date</label>
                                    <input
                                        type="date"
                                        value={leaveForm.endDate}
                                        onChange={e => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 text-sm font-bold text-slate-700 rounded-xl p-2.5 outline-none focus:border-indigo-400 transition-colors"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Duration</label>
                                    <select
                                        value={leaveForm.day_type}
                                        onChange={e => setLeaveForm({ ...leaveForm, day_type: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 text-sm font-bold text-slate-700 rounded-xl p-2.5 outline-none focus:border-indigo-400 transition-colors"
                                    >
                                        <option value="full">Full Day</option>
                                        <option value="half">Half Day</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Type</label>
                                    <select
                                        value={leaveForm.type}
                                        onChange={e => setLeaveForm({ ...leaveForm, type: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 text-sm font-bold text-slate-700 rounded-xl p-2.5 outline-none focus:border-indigo-400 transition-colors"
                                    >
                                        <option value="Casual">Casual</option>
                                        <option value="Sick">Sick</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Reason</label>
                                <textarea
                                    value={leaveForm.reason}
                                    onChange={e => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                                    placeholder="Explain why you need this leave..."
                                    className="w-full bg-slate-50 border border-slate-200 text-sm font-medium text-slate-700 rounded-xl p-3 h-20 outline-none focus:border-indigo-400 transition-colors resize-none placeholder-slate-400"
                                ></textarea>
                            </div>

                            <div className="flex gap-3 mt-4 pt-2">
                                <button
                                    onClick={() => setShowLeaveForm(false)}
                                    className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold rounded-xl active:scale-95 transition-all text-sm"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleApplyLeave}
                                    disabled={submitting}
                                    className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl active:scale-95 transition-all shadow-lg shadow-indigo-600/30 disabled:opacity-50 text-sm flex items-center justify-center"
                                >
                                    {submitting ? 'Sending...' : 'Submit Leave'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ELeave;
