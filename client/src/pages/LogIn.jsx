import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [message, setMessage] = useState("");
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            const API_URL = import.meta.env.VITE_API_URL;

            // ✅ Axios POST request
            const { data } = await axios.post(`${API_URL}/api/auth/login`, {
                email,
                password
            });

            if (data.success) {
                setMessage("✅ Login successful!");

                setTimeout(() => {
                    const role = data.role; // role from backend

                    if (role === "admin") navigate("/admin");
                    else if (role === "hr") navigate("/hr");
                    else if (role === "engineer") navigate("/engineer");
                    else navigate("/employee");
                }, 1000);
            } else {
                setMessage("❌ Invalid email or password");
            }
        } catch (err) {
            console.error("Login error:", err);
            setMessage("⚠️ Server error. Please try again later.");
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-blue-100 to-blue-300">
            <div className="w-full max-w-md bg-white/80 backdrop-blur-lg p-8 rounded-2xl shadow-xl">
                <h2 className="text-3xl font-bold text-center text-blue-600 mb-6">
                    Welcome Back 👋
                </h2>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-gray-700 font-medium mb-1">
                            Email
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Enter your email"
                            required
                            className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                    </div>

                    <div>
                        <label className="block text-gray-700 font-medium mb-1">
                            Password
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter your password"
                            required
                            className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                    </div>

                    <button
                        type="submit"
                        className="w-full py-2 bg-blue-500 text-white font-semibold rounded-xl hover:bg-blue-600 transition"
                    >
                        Log In
                    </button>
                </form>

                {message && (
                    <p
                        className={`mt-4 text-center font-medium ${
                            message.includes("✅")
                                ? "text-green-600"
                                : "text-red-600"
                        }`}
                    >
                        {message}
                    </p>
                )}

                <p className="text-sm text-gray-700 text-center mt-4">
                    Don’t have an account?{" "}
                    <a
                        href="/signup"
                        className="text-blue-600 font-medium hover:underline"
                    >
                        Sign up
                    </a>
                </p>
            </div>
        </div>
    );
}

export default Login;
