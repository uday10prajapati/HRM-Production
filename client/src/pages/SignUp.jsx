import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import bg from "../assets/bg.png"

function Signup() {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [role, setRole] = useState(""); // New role state
    const [message, setMessage] = useState("");
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!name || !email || !password || !confirmPassword || !role) {
            setMessage("⚠️ Please fill in all fields");
            return;
        }

        if (password !== confirmPassword) {
            setMessage("⚠️ Passwords do not match");
            return;
        }

        try {
            const response = await fetch("http://localhost:5000/api/auth/signup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, email, password, role }),
            });

            const data = await response.json();

            if (data.success) {
                setMessage("✅ Signup successful!");
                setTimeout(() => {
                    setMessage("");
                    navigate("/login");
                }, 1500);
            } else {
                setMessage("❌ Signup failed: " + data.message);
                setTimeout(() => setMessage(""), 3000);
            }
        } catch (error) {
            console.error(error);
            setMessage("⚠️ Server error");
            setTimeout(() => setMessage(""), 3000);
        }
    };

    return (
        <div className="min-h-screen flex">
            {/* Left: Form Section */}
            <div className="w-full md:w-1/2 flex items-center justify-center bg-white/50 p-8">
                <div className="w-full max-w-md">
                    <h2 className="text-2xl font-bold text-center mb-6">Sign Up</h2>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Name */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Enter your name"
                                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                required
                            />
                        </div>

                        {/* Email */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
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
                            <label className="block text-sm font-medium text-gray-600 mb-1">Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter your password"
                                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                required
                            />
                        </div>

                        {/* Confirm Password */}
                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-1">Confirm Password</label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Confirm your password"
                                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                required
                            />
                        </div>

                        {/* Role Selection */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                            <select
                                value={role}
                                onChange={(e) => setRole(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                required
                            >
                                <option value="" disabled>Select your role</option>
                                <option value="hr">HR</option>
                                <option value="engineer">Engineer</option>
                                <option value="employee">Employee</option>
                            </select>
                        </div>

                        {/* Signup Button */}
                        <button
                            type="submit"
                            className="w-full py-2 bg-blue-400 text-white font-medium rounded-xl hover:bg-blue-500 transition cursor-pointer"
                        >
                            Sign Up
                        </button>
                    </form>

                    <p className="text-sm text-gray-800 text-center mt-4">
                        Already have an account?{" "}
                        <a href="/login" className="text-blue-500 hover:underline">Log in</a>
                    </p>

                    {message && (
                        <p className={`mt-4 text-center text-lg ${message.includes("✅") ? "text-green-600" : "text-red-600"}`}>
                            {message}
                        </p>
                    )}
                </div>
            </div>

            {/* Right: Image Section */}
            <div className="hidden md:flex w-1/2 bg-cover bg-center" style={{ backgroundImage: `url(${bg})` }}>
                {/* You can replace the URL with your own image */}
            </div>
        </div>
    );
}

export default Signup;
