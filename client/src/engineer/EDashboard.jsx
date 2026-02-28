import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const EDashboard = () => {
    const [activeTab, setActiveTab] = useState('new');

    // Set default dates to current month to be useful
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);

    const [fromDate, setFromDate] = useState(firstDay.toISOString().split('T')[0]);
    const [toDate, setToDate] = useState(today.toISOString().split('T')[0]);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [user, setUser] = useState({});
    const [allCalls, setAllCalls] = useState([]);
    const navigate = useNavigate();

    useEffect(() => {
        try {
            const storedUser = localStorage.getItem('user');
            if (storedUser) setUser(JSON.parse(storedUser));
        } catch (e) {
            console.error('Failed to parse stored user', e);
        }
    }, []);

    const fetchCalls = async () => {
        if (!user.id) return;
        try {
            const res = await axios.get('/api/service-calls/assigned-calls');
            if (res.data.success) {
                // Calculate DDMMYY/sequence for ALL calls before filtering
                const sorted = [...res.data.calls].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
                const dateCounts = {};
                const callsWithId = sorted.map(c => {
                    const d = new Date(c.created_at);
                    const dd = String(d.getDate()).padStart(2, '0');
                    const mm = String(d.getMonth() + 1).padStart(2, '0');
                    const yy = String(d.getFullYear()).slice(-2);
                    const dateKey = `${dd}${mm}${yy}`;

                    if (!dateCounts[dateKey]) dateCounts[dateKey] = 0;
                    dateCounts[dateKey]++;
                    return { ...c, sequence_id: `${dateKey}/${dateCounts[dateKey]}` };
                });

                const engineerCalls = callsWithId.filter(c => String(c.id) === String(user.id));
                setAllCalls(engineerCalls);
            }
        } catch (err) {
            console.error('Error fetching assigned calls:', err);
        }
    };

    useEffect(() => {
        if (user.id) {
            // Fetch immediately
            fetchCalls();

            // Poll every 10 seconds to auto-refresh when they leave the app open or reopen it
            const interval = setInterval(fetchCalls, 10000);
            return () => clearInterval(interval);
        }
    }, [user.id]);

    const handleLogout = () => {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        navigate('/');
    };

    const formattedCalls = allCalls.filter(call => {
        const callDate = new Date(call.created_at);
        const from = new Date(fromDate);
        const to = new Date(toDate);
        to.setHours(23, 59, 59, 999);
        return callDate >= from && callDate <= to;
    }).map(call => ({
        id: call.call_id,
        rawCall: call,
        sequenceId: call.sequence_id,
        date: new Date(call.created_at).toLocaleDateString('en-GB'),
        dairyName: call.dairy_name || 'Unknown',
        problem: call.problem || 'N/A',
        complaint: call.description || 'N/A',
        solution: call.solutions || 'N/A',
        phone: call.mobile_number || 'N/A',
        notes: call.part_used ? `Used ${call.quantity_used || 0}x ${call.part_used}` : 'No parts used',
        assignedTo: call.engineer_name || user.name || 'Unknown',
        status: (call.status || 'new').toLowerCase(),
    }));

    const newCalls = formattedCalls.filter(c => c.status === 'new');
    const pendingCalls = formattedCalls.filter(c => c.status === 'pending');
    const resolvedCalls = formattedCalls.filter(c => c.status === 'resolved');

    const handleStatusChange = async (callId, newStatus) => {
        // Optimistically update
        setAllCalls(prevCalls => prevCalls.map(c => c.call_id === callId ? { ...c, status: newStatus } : c));
        try {
            const res = await axios.put(`/api/service-calls/update-status/${callId}`, { status: newStatus });
            if (res.data.success) {
                fetchCalls(); // Re-fetch to confirm
            }
        } catch (err) {
            console.error('Error updating status:', err);
            fetchCalls(); // Revert on failure
        }
    };

    const handleMenuToggle = () => {
        setIsSidebarOpen(!isSidebarOpen);
    };

    return (
        <div className="min-h-screen bg-[#f4f7fa] flex flex-col font-sans relative">

            {/* Sidebar Overlay (Mocked) */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-20 transition-opacity"
                    onClick={() => setIsSidebarOpen(false)}
                ></div>
            )}

            {/* Sidebar */}
            <div className={`fixed inset-y-0 left-0 w-[280px] bg-white z-40 transform transition-transform duration-300 ease-in-out flex flex-col shadow-[4px_0_24px_rgba(0,0,0,0.15)] rounded-r-[2rem] overflow-hidden ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>

                {/* Profile Section */}
                <div className="px-8 pt-16 pb-6 relative z-10">
                    <div className="w-16 h-16 rounded-full bg-[#1b253d] flex items-center justify-center overflow-hidden mb-5 shadow-md">
                        {/* Dynamic Avatar mimicking the image */}
                        <div className="w-11 h-11 bg-yellow-400 rounded-full flex flex-col items-center justify-center border-2 border-white relative mt-2 shadow-[inset_0_-4px_0_rgba(0,0,0,0.1)]">
                            <div className="w-6 h-2 bg-yellow-500 rounded-t-lg absolute -top-2"></div>
                            <div className="flex gap-[6px]">
                                <div className="w-1.5 h-1.5 bg-black rounded-full"></div>
                                <div className="w-1.5 h-1.5 bg-black rounded-full"></div>
                            </div>
                            <div className="w-[18px] h-[3px] bg-black mt-2 rounded-full"></div>
                        </div>
                    </div>
                    <h2 className="text-[22px] font-bold text-gray-900 leading-tight tracking-tight">{user.name}</h2>
                    <p className="text-[13px] font-medium text-gray-400 mt-1 truncate">{user.email}</p>
                </div>

                <div className="px-8 mb-4">
                    <div className="h-px bg-gray-100"></div>
                </div>

                {/* Menu Items */}
                <div className="flex-1 px-4 py-2 flex flex-col gap-1 overflow-y-auto">
                    {/* Dashboard */}
                    <button className="w-full text-left px-5 py-3 text-gray-800 font-bold transition-all flex items-center gap-4 rounded-xl group hover:bg-gray-50">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-[20px] h-[20px] text-gray-500 group-hover:text-gray-900">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                        </svg>
                        Dashboard
                    </button>
                    {/* Profile */}
                    <button onClick={() => navigate('/engineer-profile')} className="w-full text-left px-5 py-3 text-gray-800 font-bold transition-all flex items-center gap-4 rounded-xl group hover:bg-gray-50 cursor-pointer">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-[20px] h-[20px] text-gray-500 group-hover:text-gray-900">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                        </svg>
                        Profile
                    </button>
                    {/* Attendance */}
                    <button onClick={() => navigate('/engineer-attendance')} className="w-full text-left px-5 py-3 text-gray-800 font-bold transition-all flex items-center gap-4 rounded-xl group hover:bg-gray-50 cursor-pointer">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-[20px] h-[20px] text-gray-500 group-hover:text-gray-900">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z" />
                        </svg>
                        Attendance
                    </button>
                    {/* TA Entry */}
                    <button onClick={() => navigate('/engineer-attendance?tab=ta')} className="w-full text-left px-5 py-3 text-gray-800 font-bold transition-all flex items-center gap-4 rounded-xl group hover:bg-gray-50 cursor-pointer">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-[20px] h-[20px] text-gray-500 group-hover:text-gray-900">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25M9 16.5v.75m3-3v3M15 12v5.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                        </svg>
                        TA Entry
                    </button>
                    {/* Stock */}
                    <button onClick={() => navigate('/engineer-stock')} className="w-full text-left px-5 py-3 text-gray-800 font-bold transition-all flex items-center gap-4 rounded-xl group hover:bg-gray-50 cursor-pointer">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-[20px] h-[20px] text-gray-500 group-hover:text-gray-900">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                        </svg>
                        Stock
                    </button>
                    {/* Leave */}
                    <button onClick={() => navigate('/engineer-leave')} className="w-full text-left px-5 py-3 text-gray-800 font-bold transition-all flex items-center gap-4 rounded-xl group hover:bg-gray-50 cursor-pointer">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-[20px] h-[20px] text-gray-500 group-hover:text-gray-900">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0l4.179 2.25L12 21.75 2.25 16.5l4.179-2.25m11.142 0l-5.571 3-5.571-3" />
                        </svg>
                        Leave
                    </button>
                    {/* Settings */}
                    <button onClick={() => navigate('/engineer-forgot-password')} className="w-full text-left px-5 py-3 text-gray-800 font-bold transition-all flex items-center gap-4 rounded-xl group hover:bg-gray-50 mb-4 cursor-pointer">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-[20px] h-[20px] text-gray-500 group-hover:text-gray-900">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Settings
                    </button>
                </div>

                {/* Sign Out Button */}
                <div className="px-8 mt-auto mb-10 w-full relative">
                    <button
                        onClick={handleLogout}
                        className="w-full py-[14px] bg-[#f2f4f7] text-gray-800 font-bold rounded-[18px] hover:bg-gray-200 transition-colors flex justify-center items-center cursor-pointer shadow-sm active:scale-95 text-[15px]"
                    >
                        Sign out
                    </button>
                </div>
            </div>

            {/* Topbar */}
            <div className="bg-[#2a8bf2] text-white flex items-center justify-between px-4 py-3 shadow-md sticky top-0 z-10">
                <button
                    onClick={handleMenuToggle}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                    </svg>
                </button>
                <h1 className="text-xl font-medium tracking-wide flex-1 text-center">Dashboard</h1>
                {/* Refresh Button */}
                <button
                    onClick={() => fetchCalls()}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors cursor-pointer active:scale-95"
                    title="Refresh Calls"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                    </svg>
                </button>
            </div>

            {/* Tabs */}
            <div className="flex bg-white shadow-sm font-medium z-0">
                <button
                    onClick={() => setActiveTab('new')}
                    className={`flex-1 py-3.5 text-center transition-all duration-200 border-b-2 relative ${activeTab === 'new' ? 'text-[#2a8bf2] border-[#2a8bf2]' : 'text-gray-500 border-transparent hover:text-gray-700'}`}
                >
                    New ({newCalls.length})
                </button>
                <button
                    onClick={() => setActiveTab('pending')}
                    className={`flex-1 py-3.5 text-center transition-all duration-200 border-b-2 relative ${activeTab === 'pending' ? 'text-[#2a8bf2] border-[#2a8bf2]' : 'text-gray-500 border-transparent hover:text-gray-700'}`}
                >
                    Pending ({pendingCalls.length})
                </button>
                <button
                    onClick={() => setActiveTab('resolved')}
                    className={`flex-1 py-3.5 text-center transition-all duration-200 border-b-2 ${activeTab === 'resolved' ? 'text-[#2a8bf2] border-[#2a8bf2]' : 'text-gray-500 border-transparent hover:text-gray-700'}`}
                >
                    Resolved ({resolvedCalls.length})
                </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 p-4 flex flex-col gap-4">
                {/* Date Filters - Match screenshot styling but modernised */}
                <div className="flex gap-1 bg-[#3a3b3c] rounded-xl overflow-hidden shadow-md">
                    <div className="flex-1 bg-transparent p-3 relative flex items-center">
                        <div className="flex flex-col w-full">
                            <span className="text-gray-400 text-xs font-medium mb-0.5">From</span>
                            <div className="flex items-center justify-between w-full">
                                <input
                                    type="date"
                                    value={fromDate}
                                    onChange={(e) => setFromDate(e.target.value)}
                                    className="bg-transparent text-gray-200 text-sm outline-none w-full cursor-pointer 
                  [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full"
                                />
                            </div>
                        </div>
                        {/* Custom Icon Overlay */}
                        <div className="absolute right-3 pointer-events-none text-[#5ea3f4]">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                                <path d="M12.75 12.75a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM7.5 15.375a.75.75 0 100 1.5.75.75 0 000-1.5zM12 15.375a.75.75 0 100 1.5.75.75 0 000-1.5zM16.5 15.375a.75.75 0 100 1.5.75.75 0 000-1.5z" />
                                <path fillRule="evenodd" d="M6.75 2.25A.75.75 0 017.5 3v1.5h9V3A.75.75 0 0118 3v1.5h.75a3 3 0 013 3v11.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V7.5a3 3 0 013-3H6V3a.75.75 0 01.75-.75zm13.5 9a1.5 1.5 0 00-1.5-1.5H5.25a1.5 1.5 0 00-1.5 1.5v7.5a1.5 1.5 0 001.5 1.5h13.5a1.5 1.5 0 001.5-1.5v-7.5z" clipRule="evenodd" />
                            </svg>
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="w-[1px] bg-gray-600/50 my-2"></div>

                    <div className="flex-1 bg-transparent p-3 relative flex items-center">
                        <div className="flex flex-col w-full">
                            <span className="text-gray-400 text-xs font-medium mb-0.5">To</span>
                            <div className="flex items-center justify-between w-full">
                                <input
                                    type="date"
                                    value={toDate}
                                    onChange={(e) => setToDate(e.target.value)}
                                    className="bg-transparent text-gray-200 text-sm outline-none w-full cursor-pointer 
                  [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full"
                                />
                            </div>
                        </div>
                        {/* Custom Icon Overlay */}
                        <div className="absolute right-3 pointer-events-none text-[#5ea3f4]">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                                <path d="M12.75 12.75a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM7.5 15.375a.75.75 0 100 1.5.75.75 0 000-1.5zM12 15.375a.75.75 0 100 1.5.75.75 0 000-1.5zM16.5 15.375a.75.75 0 100 1.5.75.75 0 000-1.5z" />
                                <path fillRule="evenodd" d="M6.75 2.25A.75.75 0 017.5 3v1.5h9V3A.75.75 0 0118 3v1.5h.75a3 3 0 013 3v11.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V7.5a3 3 0 013-3H6V3a.75.75 0 01.75-.75zm13.5 9a1.5 1.5 0 00-1.5-1.5H5.25a1.5 1.5 0 00-1.5 1.5v7.5a1.5 1.5 0 001.5 1.5h13.5a1.5 1.5 0 001.5-1.5v-7.5z" clipRule="evenodd" />
                            </svg>
                        </div>
                    </div>
                </div>

                {/* Basic List View */}
                <div className="flex flex-col gap-4 mt-1">
                    {(activeTab === 'new' ? newCalls : activeTab === 'pending' ? pendingCalls : resolvedCalls).map(call => (
                        <div key={call.id} onClick={() => navigate('/engineer-assign-call', { state: { call: call.rawCall } })} className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 flex flex-col gap-3 group relative overflow-hidden cursor-pointer hover:shadow-md transition-shadow">
                            <div className={`absolute top-0 left-0 right-0 h-1 md:h-1.5 ${call.status === 'new' ? 'bg-blue-400' : call.status === 'pending' ? 'bg-yellow-400' : 'bg-green-500'}`}></div>

                            <div className="flex justify-between items-start mt-1">
                                <div>
                                    <h3 className="text-lg font-bold text-gray-800 tracking-tight">{call.dairyName}</h3>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <p className="text-sm font-bold text-[#2a8bf2]">ID: {call.sequenceId}</p>
                                        <span className="text-gray-300">•</span>
                                        <p className="text-sm text-gray-500">{call.date}</p>
                                    </div>
                                </div>
                                <div
                                    className={`px-3 py-1.5 text-xs font-bold rounded-md border uppercase ${call.status === 'new' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                                        call.status === 'pending' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                                            'bg-green-100 text-green-800 border-green-200'
                                        }`}
                                >
                                    {call.status}
                                </div>
                            </div>

                            <div className="text-[14px] text-gray-600 flex flex-col gap-2 bg-slate-50/80 rounded-xl p-4 border border-slate-100 mt-2">
                                <p className="flex gap-2">
                                    <span className="font-semibold text-gray-800 min-w-[80px]">Problem:</span>
                                    <span>{call.problem}</span>
                                </p>
                                <p className="flex gap-2">
                                    <span className="font-semibold text-gray-800 min-w-[80px]">Details:</span>
                                    <span>{call.complaint}</span>
                                </p>
                                {call.status === 'resolved' && (
                                    <>
                                        <p className="flex gap-2">
                                            <span className="font-semibold text-gray-800 min-w-[80px]">Solution:</span>
                                            <span className="text-green-700 font-medium">{call.solution}</span>
                                        </p>
                                        <p className="flex gap-2">
                                            <span className="font-semibold text-gray-800 min-w-[80px]">Parts:</span>
                                            <span>{call.notes}</span>
                                        </p>
                                    </>
                                )}
                            </div>

                            <div className="mt-2 text-xs font-medium text-gray-400 uppercase tracking-wide flex flex-col gap-1">
                                <span>Phone: <a href={`tel:${call.phone}`} className="text-[#2a8bf2] hover:underline normal-case text-sm font-bold ml-1">{call.phone}</a></span>
                                <span>Assigned To: <span className="text-gray-600 font-bold ml-1">{call.assignedTo}</span></span>
                            </div>
                        </div>
                    ))}

                    {(activeTab === 'new' ? newCalls : activeTab === 'pending' ? pendingCalls : resolvedCalls).length === 0 && (
                        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                            <div className="bg-gray-100 p-4 rounded-full mb-4">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 text-gray-300">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m8.9-4.414c.376.023.75.05 1.124.08 1.131.094 1.976 1.057 1.976 2.192V16.5A2.25 2.25 0 0118 18.75h-2.25m-7.5-10.5H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V18.75m-7.5-10.5h6.375c.621 0 1.125.504 1.125 1.125v9.375m-8.25-3h2.25m-2.25-3h2.25" />
                                </svg>
                            </div>
                            <p className="font-medium text-gray-500">No {activeTab} calls found</p>
                            <p className="text-sm mt-1">Try adjusting your date filters</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default EDashboard;
