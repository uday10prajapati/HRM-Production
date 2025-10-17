import React, { useState } from "react";
import { useNavigate } from "react-router-dom"; // <-- Add this import
import bg from "../assets/bg.png";

function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [message, setMessage] = useState("");
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!email || !password) {
            setMessage("⚠️ Please fill in all fields");
            return;
        }

        try {
            const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

            const response = await fetch(`${API_URL}/api/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (data.success && data.user && data.role) {
                setMessage("✅ Login successful!");

                // Prepare the user object
                const userData = {
                    // backend may return id as 'id' or '_id'
                    id: data.user.id || data.user._id || null,
                    name: data.user.name || "",
                    email: data.user.email || email,
                    role: data.role,
                };

                // Store user details in localStorage and log for debugging
                localStorage.setItem("user", JSON.stringify(userData));
                console.log("Stored user:", localStorage.getItem("user"));

                setTimeout(() => {
                    if (data.role === "admin") navigate("/admin-dashboard");
                    else if (data.role === "hr" || data.role=== "Hr") navigate("/hr-dashboard");
                    else if (data.role === "engineer") navigate("/engineer");
                    else navigate("/employee");
                }, 1000);
            } else {
                setMessage("❌ Invalid email or password");
            }
        } catch (error) {
            console.error(error);
            setMessage("⚠️ Server error");
        }
    };

    return (
        <div className="min-h-screen flex">
            {/* Left: Form Section */}
            <div className="w-full md:w-1/2 flex items-center justify-center bg-white/50 p-8">
                <div className="w-full max-w-md">
                    <h2 className="text-3xl font-bold text-center mb-6">
                        Welcome Back 👋
                    </h2>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Email */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Email
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Enter your email"
                                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                required
                            />
                        </div>

                        {/* Password */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Password
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter your password"
                                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                required
                            />
                        </div>

                        {/* Login Button */}
                        <button
                            type="submit"
                            className="w-full py-2 bg-blue-400 text-white font-medium rounded-xl hover:bg-blue-500 transition cursor-pointer"
                        >
                            Log In
                        </button>
                    </form>

                    <p className="text-sm text-gray-800 text-center mt-4">
                        Don’t have an account?{" "}
                        <a href="/signup" className="text-blue-500 hover:underline">
                            Sign up
                        </a>
                    </p>

                    {message && (
                        <p
                            className={`mt-4 text-center text-lg ${
                                message.includes("✅")
                                    ? "text-green-600"
                                    : "text-red-600"
                            }`}
                        >
                            {message}
                        </p>
                    )}
                </div>
            </div>

            {/* Right: Image Section */}
            <div
                className="hidden md:flex w-1/2 bg-cover bg-center"
                style={{ backgroundImage: `url(${bg})` }}
            ></div>
        </div>
    );
}

export default Login;
