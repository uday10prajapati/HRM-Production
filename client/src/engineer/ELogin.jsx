import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const ELogin = () => {
    const [identifier, setIdentifier] = useState(''); // Can be email or mobile_number
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const navigate = useNavigate();

    // Check if user is already logged in on initial load
    React.useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            navigate('/engineer-dashboard', { replace: true });
        }
    }, [navigate]);

    const handleLogin = async (e) => {
        e.preventDefault();
        if (!identifier || !password) {
            setError("Please fill in all fields");
            return;
        }

        setIsLoading(true);
        setError(null);

        // Basic check to see if the input is an email or mobile number
        const isEmail = identifier.includes('@');
        const payload = isEmail
            ? { email: identifier.trim(), password }
            : { mobile_number: identifier.trim(), password };

        try {
            // Adjust the endpoint to match the backend implementation for engineers
            const response = await axios.post('/api/engineer/login', payload);
            const data = response.data;

            if (data.success || response.status === 200) {
                // Assuming response structure has token and user
                const userData = {
                    id: data.user?.id || data.user?._id,
                    name: data.user?.name || "",
                    email: data.user?.email || payload.email,
                    mobile_number: data.user?.mobile_number || payload.mobile_number,
                    role: data.role || 'engineer', // Force role to engineer for this view if needed
                };

                // Store user and token
                localStorage.setItem("user", JSON.stringify(userData));
                localStorage.setItem("token", data.token || "authenticated"); // Provide dummy token if backend skipped JWT
                axios.defaults.headers.common['x-user-id'] = String(userData.id);
                if (data.token) {
                    axios.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
                }

                // Redirect to engineer dashboard
                navigate("/engineer-dashboard"); // Update with actual route
            } else {
                setError("Invalid credentials");
            }
        } catch (err) {
            console.error("Login failed:", err);
            setError(err.response?.data?.message || "Login failed. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex flex-col justify-start items-center font-sans overflow-hidden sm:justify-center relative">
            {/* Background decorative elements */}
            <div className="absolute top-0 right-0 -m-32 w-[600px] h-[600px] bg-blue-600/20 rounded-full blur-3xl opacity-50 mix-blend-screen pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 -m-32 w-[600px] h-[600px] bg-indigo-600/20 rounded-full blur-3xl opacity-50 mix-blend-screen pointer-events-none"></div>

            {/* Mobile container */}
            <div className="w-full max-w-md h-full min-h-screen sm:min-h-[800px] bg-white sm:rounded-[40px] shadow-2xl sm:my-8 relative overflow-hidden flex flex-col z-10 border border-white/20">

                {/* Top vibrant section */}
                <div className="relative h-72 w-full bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-500 flex flex-col items-center justify-center overflow-hidden">
                    {/* Glassmorphism overlays */}
                    <div className="absolute inset-0 bg-white/5 backdrop-blur-[2px]"></div>
                    <div className="absolute -top-24 -left-20 w-64 h-64 bg-white/10 rounded-full blur-2xl"></div>
                    <div className="absolute -bottom-24 -right-20 w-64 h-64 bg-cyan-400/20 rounded-full blur-2xl"></div>

                    <div className="relative z-10 flex flex-col items-center mt-8">
                        {/* Logo Circle */}
                        <div className="w-20 h-20 bg-white/20 backdrop-blur-md border border-white/40 p-4 rounded-3xl shadow-[0_8px_32px_0_rgba(31,38,135,0.37)] mb-5 flex items-center justify-center transform transition-transform hover:scale-105">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 text-white drop-shadow-md">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.83-5.83m0 0l2.35-2.35a2.121 2.121 0 000-3l-2.12-2.12a2.121 2.121 0 00-3 0l-2.35 2.35m4.12 4.12l-4.12-4.12M15.17 11.42l-5.83-5.83A2.652 2.652 0 003 6.75l5.83 5.83m0 0l-2.35 2.35a2.121 2.121 0 000 3l2.12 2.12a2.121 2.121 0 003 0l2.35-2.35m-4.12-4.12l4.12 4.12" />
                            </svg>
                        </div>
                        {/* CRM LOGIN title */}
                        <div className="flex flex-col items-center">
                            <div className="bg-white/20 backdrop-blur-sm border border-white/30 px-3 py-1 rounded-full mb-2">
                                <span className="text-white text-xs font-semibold tracking-widest text-white/90 uppercase">Service Portal</span>
                            </div>
                            <h1 className="text-white text-4xl font-extrabold tracking-tight drop-shadow-lg">CRM</h1>
                        </div>
                    </div>

                    {/* Curved wave transition at the bottom of the header */}
                    <div className="absolute bottom-0 left-0 w-full overflow-hidden leading-none">
                        <svg className="relative block w-full h-[50px]" data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 120" preserveAspectRatio="none">
                            <path d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V120H0V95.8C59.71,118.08,130.83,121.22,200.41,111.41C242.04,105.4,283.47,84.09,321.39,56.44Z" className="fill-white"></path>
                        </svg>
                    </div>
                </div>

                {/* Content Section */}
                <div className="flex-1 bg-white px-8 pt-4 pb-12 relative z-10 flex flex-col justify-between">

                    <div>
                        <div className="mb-10 mt-2">
                            <h2 className="text-slate-800 text-3xl font-extrabold mb-2 tracking-tight">Welcome Back</h2>
                            <p className="text-slate-500 text-sm font-medium">Please sign in to your account</p>
                        </div>

                        {error && (
                            <div className="mb-6 bg-red-50/80 border border-red-100 text-red-600 text-sm p-4 rounded-2xl text-center font-semibold shadow-sm animate-pulse flex items-center justify-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" /></svg>
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleLogin} className="space-y-5">
                            {/* Identifier Input */}
                            <div className="group relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-transform group-focus-within:scale-110 group-focus-within:text-indigo-500">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                                    </svg>
                                </div>
                                <input
                                    type="text"
                                    value={identifier}
                                    onChange={(e) => setIdentifier(e.target.value)}
                                    placeholder="Email or Mobile Number"
                                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all text-slate-800 font-semibold placeholder:text-slate-400 placeholder:font-medium shadow-sm"
                                    required
                                />
                            </div>

                            {/* Password Input */}
                            <div className="group relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-transform group-focus-within:scale-110 group-focus-within:text-indigo-500">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                                    </svg>
                                </div>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Password"
                                    className="w-full pl-12 pr-12 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all text-slate-800 font-semibold placeholder:text-slate-400 placeholder:font-medium shadow-sm"
                                    required
                                />
                                <div
                                    className="absolute inset-y-0 right-0 pr-4 flex items-center cursor-pointer text-slate-400 hover:text-indigo-600 transition"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                                        </svg>
                                    ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                    )}
                                </div>
                            </div>

                            {/* Submit Button */}
                            <div className="pt-6">
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full py-4 bg-gradient-to-r from-indigo-600 to-blue-500 hover:from-indigo-500 hover:to-blue-400 text-white font-bold text-lg rounded-2xl transition-all shadow-lg shadow-indigo-500/30 active:scale-95 disabled:opacity-70 disabled:active:scale-100 flex justify-center items-center overflow-hidden relative group"
                                >
                                    {/* Shimmer effect */}
                                    <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>

                                    {isLoading ? (
                                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white shadow-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                    ) : "Sign in to Dashboard"}
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* Footer - Forgot Password */}
                    <div className="text-center mt-6">
                        <button
                            type="button"
                            className="text-slate-500 font-semibold hover:text-indigo-600 text-sm focus:outline-none transition-colors"
                            onClick={() => {
                                navigate('/engineer-forgot-password')
                            }}
                        >
                            Forgot Password?
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default ELogin;
