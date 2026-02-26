import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const EProfile = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState({
        name: '',
        email: '',
        mobile_number: '',
        role: '',
        leave_balance: 0
    });

    useEffect(() => {
        try {
            const storedUser = localStorage.getItem('user');
            if (storedUser) {
                setUser(JSON.parse(storedUser));
            } else {
                // If no user found, redirect to login
                navigate('/');
            }
        } catch (e) {
            console.error('Failed to parse stored user', e);
        }
    }, [navigate]);

    return (
        <div className="min-h-screen bg-[#f4f7fa] flex flex-col font-sans">
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
                <h1 className="text-xl font-bold text-gray-900 tracking-tight flex-1">Profile</h1>
            </div>

            {/* Profile Content */}
            <div className="flex-1 p-5 flex flex-col items-center">

                {/* Avatar Section */}
                <div className="mt-6 mb-8 flex flex-col items-center">
                    <div className="w-28 h-28 rounded-full bg-[#1b253d] flex items-center justify-center overflow-hidden mb-4 shadow-xl border-4 border-white relative">
                        {/* Dynamic Avatar mimicking the image */}
                        <div className="w-[72px] h-[72px] bg-yellow-400 rounded-full flex flex-col items-center justify-center border-[3px] border-white relative mt-3 shadow-[inset_0_-6px_0_rgba(0,0,0,0.1)]">
                            <div className="w-10 h-3.5 bg-yellow-500 rounded-t-xl absolute -top-3"></div>
                            <div className="flex gap-2">
                                <div className="w-2.5 h-2.5 bg-black rounded-full"></div>
                                <div className="w-2.5 h-2.5 bg-black rounded-full"></div>
                            </div>
                            <div className="w-7 h-1.5 bg-black mt-3 rounded-full"></div>
                        </div>
                    </div>
                    <h2 className="text-2xl font-extrabold text-gray-900">{user.name}</h2>
                    <div className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold mt-2 uppercase tracking-wide">
                        {user.role}
                    </div>
                </div>

                {/* Details Cards */}
                <div className="w-full bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col gap-5">

                    {/* Email Info */}
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-500">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                            </svg>
                        </div>
                        <div className="flex flex-col flex-1 overflow-hidden">
                            <span className="text-xs text-gray-400 font-bold uppercase">Email Address</span>
                            <span className="text-gray-800 font-medium truncate text-[15px]">{user.email || 'Not provided'}</span>
                        </div>
                    </div>

                    <div className="h-px bg-gray-100 w-full"></div>

                    {/* Phone Info */}
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-500">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
                            </svg>
                        </div>
                        <div className="flex flex-col flex-1 overflow-hidden">
                            <span className="text-xs text-gray-400 font-bold uppercase">Mobile Number</span>
                            <span className="text-gray-800 font-medium truncate text-[15px]">{user.mobile_number || 'Not provided'}</span>
                        </div>
                    </div>

                    <div className="h-px bg-gray-100 w-full"></div>

                    {/* Leave Balance Info */}
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-500">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                            </svg>
                        </div>
                        <div className="flex flex-col flex-1 overflow-hidden">
                            <span className="text-xs text-amber-500/80 font-bold uppercase">Leave Balance</span>
                            <span className="text-gray-800 font-bold text-[17px]">{user.leave_balance ?? 0} Days</span>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default EProfile;
