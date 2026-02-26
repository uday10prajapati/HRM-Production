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
        <div className="min-h-screen bg-gray-50 flex flex-col justify-start items-center font-sans overflow-hidden sm:justify-center">
            {/* Mobile container - restricts width on larger screens to simulate mobile */}
            <div className="w-full max-w-md h-full min-h-screen sm:min-h-[850px] bg-white sm:rounded-3xl sm:shadow-2xl sm:my-8 relative overflow-hidden flex flex-col">

                {/* Top Blue section with wave */}
                {/* We use a large rounded container placed absolutely to create the curved wave effect at the bottom */}
                <div className="relative h-72 w-full bg-gradient-to-br from-blue-400 to-blue-600 rounded-b-[40px] shadow-sm flex flex-col items-center justify-center -z-0">
                    {/* Faint background pattern for visual flair like in the screenshot */}
                    <div className="absolute inset-0 opacity-10 pointer-events-none rounded-b-[40px]"
                        style={{ backgroundImage: 'radial-gradient(circle at 50% 10%, rgba(255,255,255,0.8) 0%, transparent 40%), repeating-linear-gradient(45deg, rgba(255,255,255,0.1) 0px, transparent 2px, transparent 100px)' }}>
                    </div>

                    <div className="relative z-10 flex flex-col items-center">
                        {/* Logo Icon Box */}
                        <div className="bg-white p-4 rounded-2xl shadow-lg mb-4 flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-12 h-12 text-[#4facfe]">
                                {/* Android robot body */}
                                <path d="M17.41 10.36L19 7.6a.6.6 0 00-.21-.83.6.6 0 00-.82.21L16.29 9.9c-1.31-.6-2.76-.94-4.29-.94s-2.98.34-4.29.94L6.03 6.98a.6.6 0 00-.82-.21.6.6 0 00-.21.83l1.59 2.76A9.457 9.457 0 003 18h18a9.457 9.457 0 00-3.59-7.64zM8.5 15.5c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm7 0c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z" />
                            </svg>
                        </div>
                        {/* HRM LOGIN title */}
                        <h1 className="text-white text-2xl font-bold tracking-wider mb-2">HRM LOGIN</h1>
                    </div>
                </div>

                {/* Content Section overlaying the curve slightly */}
                <div className="flex-1 bg-white px-8 pt-8 pb-12 rounded-t-[40px] -mt-10 relative z-10 flex flex-col justify-between">

                    <div>
                        <div className="text-center mb-10">
                            <p className="text-gray-500 text-sm mb-2 font-medium">Welcome back 👋</p>
                            <h2 className="text-gray-800 text-3xl font-bold mb-2">Log In</h2>
                            <p className="text-gray-400 text-sm">Please sign in to continue</p>
                        </div>

                        {error && (
                            <div className="mb-4 bg-red-50 text-red-600 text-sm p-3 rounded-lg text-center font-medium">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleLogin} className="space-y-5">
                            {/* Identifier Input */}
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-gray-400">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                                    </svg>
                                </div>
                                <input
                                    type="text"
                                    value={identifier}
                                    onChange={(e) => setIdentifier(e.target.value)}
                                    placeholder="Email or Mobile Number"
                                    className="w-full pl-11 pr-4 py-3.5 bg-white border border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-gray-700 font-medium placeholder:text-gray-400 placeholder:font-normal shadow-sm"
                                    required
                                />
                            </div>

                            {/* Password Input */}
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-gray-400">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                                    </svg>
                                </div>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Password"
                                    className="w-full pl-11 pr-12 py-3.5 bg-white border border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-gray-700 font-medium placeholder:text-gray-400 placeholder:font-normal shadow-sm"
                                    required
                                />
                                <div
                                    className="absolute inset-y-0 right-0 pr-4 flex items-center cursor-pointer text-gray-400 hover:text-gray-600 transition"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                    ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                                        </svg>
                                    )}
                                </div>
                            </div>

                            {/* Submit Button */}
                            <div className="pt-4">
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full py-3.5 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-xl transition-all shadow-md shadow-blue-200 active:scale-95 disabled:opacity-70 disabled:active:scale-100 flex justify-center items-center"
                                >
                                    {isLoading ? (
                                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white shadow-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                    ) : "Login"}
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* Footer - Forgot Password */}
                    <div className="text-center mt-8 pb-4">
                        <button
                            type="button"
                            className="text-blue-600 font-semibold hover:text-blue-700 text-sm focus:outline-none"
                            onClick={() => {
                                // Handle forgot password flow or navigate
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
