import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

function Engineer({ currentUser }) {
    const [activeModule, setActiveModule] = useState("dashboard");
    const [message, setMessage] = useState("");
    const [userRole, setUserRole] = useState("Engineer"); // Example role
    const navigate = useNavigate();
    const handleLogout = () => {
        // Optional: Clear user session or token here
        localStorage.removeItem("user"); // example if storing user info
        navigate("/login"); // Navigate to login page
    };


    // Dummy data
    const [tasks, setTasks] = useState([
        { id: 1, customer: "John Smith", address: "Bangalore", problem: "AC Repair", status: "Assigned" },
        { id: 2, customer: "Alice Kumar", address: "Chennai", problem: "Heater Installation", status: "On My Way" },
    ]);

    const [attendance, setAttendance] = useState([]);
    const [isPunchedIn, setIsPunchedIn] = useState(false);

    const [stock, setStock] = useState([
        { id: 1, item: "AC Filter", quantity: 10 },
        { id: 2, item: "Pipe", quantity: 5 },
    ]);

    const [leaves, setLeaves] = useState([
        // Example leave records
        { id: 1, type: "Casual Leave", date: "2025-10-10", status: "Approved" },
        { id: 2, type: "Sick Leave", date: "2025-10-12", status: "Pending" },
    ]);

    const [newLeave, setNewLeave] = useState({ type: "", date: "" });

    // Current Month
    const currentDate = new Date();
    const currentMonth = currentDate.toLocaleString("default", { month: "long" });
    const currentMonthAttendance = attendance.filter(
        (a) => new Date(a.date).getMonth() === currentDate.getMonth()
    );

    // Punch functions with location
    const handlePunchIn = () => {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const coords = { latitude: position.coords.latitude, longitude: position.coords.longitude };
                const now = new Date();
                const date = now.toISOString().split("T")[0];

                if (attendance.find((a) => a.date === date && a.punchIn)) {
                    setMessage("⚠️ You already punched in today!");
                    return;
                }

                const record = {
                    date,
                    punchIn: now.toLocaleTimeString(),
                    punchInLocation: coords,
                    punchOut: null,
                    punchOutLocation: null,
                    status: "Present",
                };

                setAttendance((prev) => [...prev, record]);
                setIsPunchedIn(true);
                setMessage("✅ Punched In Successfully!");
            },
            () => setMessage("⚠️ Unable to get your location.")
        );
    };

    const handlePunchOut = () => {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const coords = { latitude: position.coords.latitude, longitude: position.coords.longitude };
                const now = new Date();
                const date = now.toISOString().split("T")[0];

                setAttendance((prev) =>
                    prev.map((a) =>
                        a.date === date
                            ? { ...a, punchOut: now.toLocaleTimeString(), punchOutLocation: coords, status: "Present" }
                            : a
                    )
                );

                setIsPunchedIn(false);
                setMessage("✅ Punched Out Successfully!");
            },
            () => setMessage("⚠️ Unable to get your location.")
        );
    };

    const updateTaskStatus = (id, status) => {
        setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
    };

    // Leave functions
    const handleLeaveApply = () => {
        if (!newLeave.type || !newLeave.date) {
            setMessage("⚠️ Please fill in both leave type and date.");
            return;
        }

        const leaveRecord = {
            id: leaves.length + 1,
            type: newLeave.type,
            date: newLeave.date,
            status: "Pending",
        };

        setLeaves((prev) => [...prev, leaveRecord]);
        setNewLeave({ type: "", date: "" });
        setMessage("✅ Leave applied successfully!");
    };

    const renderContent = () => {
        switch (activeModule) {
            case "dashboard":
                return (
                    <div>
                        <h2 className="text-2xl font-bold mb-6">Engineer Dashboard</h2>
                        <p className="text-gray-700 mb-6">
                            Welcome, {currentUser ? currentUser.name : "Engineer"}! Here's a quick overview of your tasks, attendance, stock, and leaves.
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                            <div className="bg-blue-100 p-6 rounded-xl shadow text-center">
                                <h3 className="text-gray-700 font-semibold">Pending Tasks</h3>
                                <p className="text-2xl font-bold text-blue-700 mt-2">
                                    {tasks.filter(t => t.status !== "Completed").length}
                                </p>
                            </div>
                            <div className="bg-green-100 p-6 rounded-xl shadow text-center">
                                <h3 className="text-gray-700 font-semibold">Attendance Today</h3>
                                <p className="text-2xl font-bold text-green-700 mt-2">
                                    {isPunchedIn ? "Punched In ✅" : "Not Yet ⏰"}
                                </p>
                            </div>
                            <div className="bg-yellow-100 p-6 rounded-xl shadow text-center">
                                <h3 className="text-gray-700 font-semibold">Total Tasks</h3>
                                <p className="text-2xl font-bold text-yellow-700 mt-2">{tasks.length}</p>
                            </div>
                            <div className="bg-purple-100 p-6 rounded-xl shadow text-center">
                                <h3 className="text-gray-700 font-semibold">Stock Items</h3>
                                <p className="text-2xl font-bold text-purple-700 mt-2">{stock.length}</p>
                            </div>
                        </div>
                    </div>
                );

            case "tasks":
                return (
                    <div>
                        <h2 className="text-2xl font-bold mb-6">My Tasks</h2>
                        {tasks.length === 0 ? (
                            <p className="text-gray-600">No tasks assigned yet.</p>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                {tasks.map((task) => (
                                    <div
                                        key={task.id}
                                        className="bg-white p-6 rounded-xl shadow hover:shadow-lg transition-shadow duration-300"
                                    >
                                        <h3 className="text-lg font-semibold mb-2">{task.customer}</h3>
                                        <p className="text-gray-600 mb-1">
                                            <span className="font-medium">Address:</span> {task.address}
                                        </p>
                                        <p className="text-gray-600 mb-3">
                                            <span className="font-medium">Problem:</span> {task.problem}
                                        </p>
                                        <span
                                            className={`inline-block px-3 py-1 rounded-full text-white font-semibold mb-4 ${task.status === "Completed"
                                                ? "bg-green-500"
                                                : task.status === "On My Way"
                                                    ? "bg-blue-500"
                                                    : task.status === "In Progress"
                                                        ? "bg-yellow-500"
                                                        : "bg-gray-500"
                                                }`}
                                        >
                                            {task.status}
                                        </span>
                                        {["Assigned", "On My Way", "In Progress"].includes(task.status) && (
                                            <button
                                                className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
                                                onClick={() => updateTaskStatus(task.id, "Completed")}
                                            >
                                                Mark Completed
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );

            case "attendance":
                return (
                    <div>
                        <h2 className="text-2xl font-bold mb-4">Attendance</h2>

                        {message && (
                            <p className={`mb-4 font-medium ${message.includes("✅") ? "text-green-600" : "text-red-600"}`}>
                                {message}
                            </p>
                        )}

                        <div className="mb-6 flex gap-4">
                            {!isPunchedIn ? (
                                <button
                                    onClick={handlePunchIn}
                                    className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700"
                                >
                                    Punch In
                                </button>
                            ) : (
                                <button
                                    onClick={handlePunchOut}
                                    className="bg-red-600 text-white px-6 py-2 rounded hover:bg-red-700"
                                >
                                    Punch Out
                                </button>
                            )}
                        </div>

                        <h3 className="text-xl font-semibold mb-3">Attendance for {currentMonth}</h3>

                        {currentMonthAttendance.length === 0 ? (
                            <p>No attendance records this month.</p>
                        ) : (
                            <table className="min-w-full bg-white rounded-xl shadow">
                                <thead className="bg-blue-500 text-white">
                                    <tr>
                                        <th className="py-2 px-4 text-left">Date</th>
                                        <th className="py-2 px-4 text-left">Punch In</th>
                                        <th className="py-2 px-4 text-left">Punch Out</th>
                                        <th className="py-2 px-4 text-left">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {currentMonthAttendance
                                        .sort((a, b) => new Date(b.date) - new Date(a.date))
                                        .map((a, i) => (
                                            <tr key={i} className="border-b hover:bg-gray-100">
                                                <td className="py-2 px-4">{a.date}</td>
                                                <td className="py-2 px-4">{a.punchIn || "-"}</td>
                                                <td className="py-2 px-4">{a.punchOut || "-"}</td>
                                                <td className="py-2 px-4">{a.status}</td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                );

            case "stock":
                return (
                    <div>
                        <h2 className="text-2xl font-bold mb-6">My Stock</h2>
                        {stock.length === 0 ? (
                            <p className="text-gray-600">No stock assigned yet.</p>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                {stock.map((item) => (
                                    <div
                                        key={item.id}
                                        className="bg-white p-6 rounded-xl shadow hover:shadow-lg transition-shadow duration-300"
                                    >
                                        <h3 className="text-lg font-semibold mb-2">{item.item}</h3>
                                        <p className="text-gray-600 mb-2">Quantity Available</p>
                                        <span
                                            className={`inline-block px-3 py-1 rounded-full text-white font-semibold ${item.quantity > 5
                                                ? "bg-green-500"
                                                : item.quantity > 0
                                                    ? "bg-yellow-500"
                                                    : "bg-red-500"
                                                }`}
                                        >
                                            {item.quantity}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );

            case "leave":
                return (
                    <div>
                        <h2 className="text-2xl font-bold mb-6">Leave Application</h2>

                        {message && (
                            <p className={`mb-4 font-medium ${message.includes("✅") ? "text-green-600" : "text-red-600"}`}>
                                {message}
                            </p>
                        )}

                        {/* Leave Form */}
                        <div className="mb-6 bg-white p-6 rounded-xl shadow">
                            <h3 className="text-lg font-semibold mb-4">Apply for Leave</h3>
                            <div className="flex flex-col sm:flex-row gap-4">
                                <select
                                    className="border p-2 rounded w-full sm:w-1/3"
                                    value={newLeave.type}
                                    onChange={(e) => setNewLeave({ ...newLeave, type: e.target.value })}
                                >
                                    <option value="">Select Leave Type</option>
                                    <option value="Casual Leave">Casual Leave</option>
                                    <option value="Sick Leave">Sick Leave</option>
                                    <option value="Earned Leave">Earned Leave</option>
                                </select>
                                <input
                                    type="date"
                                    className="border p-2 rounded w-full sm:w-1/3"
                                    value={newLeave.date}
                                    onChange={(e) => setNewLeave({ ...newLeave, date: e.target.value })}
                                />
                                <button
                                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                                    onClick={handleLeaveApply}
                                >
                                    Apply
                                </button>
                            </div>
                        </div>

                        {/* Leave Table */}
                        <div className="bg-white p-6 rounded-xl shadow">
                            <h3 className="text-lg font-semibold mb-4">My Leave Records</h3>
                            {leaves.length === 0 ? (
                                <p className="text-gray-600">No leave records found.</p>
                            ) : (
                                <table className="min-w-full bg-white rounded-xl shadow">
                                    <thead className="bg-gray-700 text-white">
                                        <tr>
                                            <th className="py-2 px-4 text-left">Date</th>
                                            <th className="py-2 px-4 text-left">Type</th>
                                            <th className="py-2 px-4 text-left">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {leaves.map((leave) => (
                                            <tr key={leave.id} className="border-b hover:bg-gray-100">
                                                <td className="py-2 px-4">{leave.date}</td>
                                                <td className="py-2 px-4">{leave.type}</td>
                                                <td className="py-2 px-4">
                                                    <span
                                                        className={`inline-block px-3 py-1 rounded-full text-white font-semibold ${leave.status === "Approved"
                                                            ? "bg-green-500"
                                                            : leave.status === "Pending"
                                                                ? "bg-yellow-500"
                                                                : "bg-red-500"
                                                            }`}
                                                    >
                                                        {leave.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                );

            default:
                return <div>Select a module</div>;
        }
    };

    const modules = [
        { key: "dashboard", label: "Dashboard" },
        { key: "tasks", label: "My Tasks" },
        { key: "attendance", label: "Attendance" },
        { key: "stock", label: "My Stock" },
        { key: "leave", label: "Leave" },
    ];

    return (
        <div className="flex min-h-screen">
            {/* Sidebar */}
            <div className="w-1/5 bg-gray-700 text-white p-6 flex flex-col justify-between min-h-screen">
                <div className="flex flex-col space-y-4">
                    <h1 className="text-2xl font-bold mb-6">Engineer Panel</h1>
                    {modules.map((mod) => (
                        <button
                            key={mod.key}
                            onClick={() => setActiveModule(mod.key)}
                            className={`w-full py-2 text-left px-2 rounded hover:bg-gray-500 ${activeModule === mod.key ? "bg-white text-black" : ""
                                }`}
                        >
                            {mod.label}
                        </button>
                    ))}
                </div>

                {/* Logout Button */}
                <button
                    onClick={handleLogout}
                    className="w-full py-2 mt-6 rounded bg-red-600 hover:bg-red-700 text-white"
                >
                    Logout
                </button>

            </div>

            {/* Main Content */}
            <div className="w-4/5 p-8 bg-gray-100">
                {renderContent()}
            </div>
        </div>
    );
}

export default Engineer;