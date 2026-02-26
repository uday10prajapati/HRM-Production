import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const EDashboard = () => {
    const [activeTab, setActiveTab] = useState('pending');
    // Initialize with dummy dates matching your screenshot roughly or current
    const [fromDate, setFromDate] = useState('2026-02-01');
    const [toDate, setToDate] = useState('2026-02-26');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [user, setUser] = useState({ name: 'Engineer Name', email: 'engineer@example.com' });
    const navigate = useNavigate();

    useEffect(() => {
        try {
            const storedUser = localStorage.getItem('user');
            if (storedUser) setUser(JSON.parse(storedUser));
        } catch (e) {
            console.error('Failed to parse stored user', e);
        }
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        navigate('/');
    };

    // Dummy data modeled after your screenshot
    const pendingCalls = [
        {
            id: 1,
            date: '25/02/2026',
            dairyName: 'SHERDI B.C.U.',
            problem: 't yo j',
            complaint: 'vg',
            solution: 'h',
            notes: 'vy',
            assignedTo: 'ud',
            phone: '1234512345',
            status: 'pending'
        }
    ];

    const resolvedCalls = [];

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
                    {/* Stock */}
                    <button onClick={() => navigate('/engineer-stock')} className="w-full text-left px-5 py-3 text-gray-800 font-bold transition-all flex items-center gap-4 rounded-xl group hover:bg-gray-50 cursor-pointer">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-[20px] h-[20px] text-gray-500 group-hover:text-gray-900">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                        </svg>
                        Stock
                    </button>
                    {/* Leave */}
                    <button onClick={() => navigate('/engineer-leave')} className="w-full text-left px-5 py-3 text-gray-800 font-bold transition-all flex items-center gap-4 rounded-xl group hover:bg-gray-50 mb-4 cursor-pointer">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-[20px] h-[20px] text-gray-500 group-hover:text-gray-900">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0l4.179 2.25L12 21.75 2.25 16.5l4.179-2.25m11.142 0l-5.571 3-5.571-3" />
                        </svg>
                        Leave
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
                <h1 className="text-xl font-medium tracking-wide flex-1 text-center pr-10">Dashboard</h1>
            </div>

            {/* Tabs */}
            <div className="flex bg-white shadow-sm font-medium z-0">
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

                {/* Premium Cards List */}
                <div className="flex flex-col gap-4 mt-1">
                    {(activeTab === 'pending' ? pendingCalls : resolvedCalls).map(call => (
                        <div key={call.id} className="bg-white rounded-2xl p-5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-gray-100/80 flex flex-col gap-4 relative overflow-hidden group">
                            {/* Premium Accent line top */}
                            <div className={`absolute top-0 left-0 right-0 h-1.5 ${call.status === 'pending' ? 'bg-amber-400' : 'bg-emerald-400'}`}></div>

                            <div className="flex justify-between items-start mt-1">
                                <div className="flex flex-col gap-0.5">
                                    <h3 className="text-[17px] font-bold text-gray-800 leading-tight">{call.dairyName}</h3>
                                    <p className="text-[15px] font-medium text-gray-500">{call.problem}</p>
                                </div>
                                <div className="text-xs font-semibold text-gray-400 flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded-md">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5 px-0">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                                    </svg>
                                    {call.date}
                                </div>
                            </div>

                            {/* Data Grid */}
                            <div className="grid grid-cols-2 gap-y-4 gap-x-6 mt-1 bg-blue-50/40 p-4 rounded-xl border border-blue-50/50">
                                <div className="flex flex-col">
                                    <span className="text-[11px] text-gray-400 font-bold uppercase tracking-wider mb-1">Complaint</span>
                                    <span className="text-sm text-gray-700 font-medium">{call.complaint}</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[11px] text-gray-400 font-bold uppercase tracking-wider mb-1">Solution</span>
                                    <span className="text-sm text-gray-700 font-medium">{call.solution}</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[11px] text-gray-400 font-bold uppercase tracking-wider mb-1">Notes</span>
                                    <span className="text-sm text-gray-700 font-medium">{call.notes}</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[11px] text-gray-400 font-bold uppercase tracking-wider mb-1">Assigned To</span>
                                    <span className="text-sm text-gray-700 font-medium flex items-center gap-1.5">
                                        <div className="w-5 h-5 rounded-full bg-blue-200 text-blue-700 flex items-center justify-center text-xs font-bold">
                                            {call.assignedTo.substring(0, 2).toUpperCase()}
                                        </div>
                                        {call.assignedTo}
                                    </span>
                                </div>
                            </div>

                            {/* Footer Actions */}
                            <div className="flex items-center justify-between mt-1">
                                {/* Phone Chip */}
                                <div className="bg-[#4facfe] text-white px-3.5 py-2 rounded-lg font-bold text-sm tracking-wide flex items-center gap-2 shadow-sm shadow-blue-200 hover:bg-[#3d98f0] transition-colors cursor-pointer active:scale-95">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                        <path fillRule="evenodd" d="M2 3.5A1.5 1.5 0 013.5 2h1.148a1.5 1.5 0 011.465 1.175l.716 3.223a1.5 1.5 0 01-1.052 1.767l-.933.267c-.41.117-.643.555-.48.95a11.542 11.542 0 006.254 6.254c.395.163.833-.07.95-.48l.267-.933a1.5 1.5 0 011.767-1.052l3.223.716A1.5 1.5 0 0118 15.352V16.5a1.5 1.5 0 01-1.5 1.5H15c-1.149 0-2.263-.15-3.326-.43A13.022 13.022 0 012.43 8.326 13.019 13.019 0 012 5V3.5z" clipRule="evenodd" />
                                    </svg>
                                    {call.phone}
                                </div>

                                {/* Status Dropdown Indicator */}
                                <button className="flex items-center gap-2 bg-gray-50 border border-gray-200 pl-3 pr-2 py-1.5 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-100 transition-colors">
                                    <div className={`w-2 h-2 rounded-full ${call.status === 'pending' ? 'bg-amber-500' : 'bg-emerald-500'}`}></div>
                                    {call.status.charAt(0).toUpperCase() + call.status.slice(1)}
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-gray-400">
                                        <path fillRule="evenodd" d="M12.53 16.28a.75.75 0 01-1.06 0l-7.5-7.5a.75.75 0 011.06-1.06L12 14.69l6.97-6.97a.75.75 0 111.06 1.06l-7.5 7.5z" clipRule="evenodd" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    ))}

                    {(activeTab === 'pending' ? pendingCalls : resolvedCalls).length === 0 && (
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
