import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
import "jspdf-autotable";

function Employee() {
    const navigate = useNavigate();
    const [activeModule, setActiveModule] = useState("dashboard");

    // Attendance state
    const [isPunchedIn, setIsPunchedIn] = useState(false);
    const [attendance, setAttendance] = useState([]);

    // Leave state
    const [leaveRequests, setLeaveRequests] = useState([]);
    const [leaveForm, setLeaveForm] = useState({
        startDate: "",
        endDate: "",
        type: "Casual Leave",
        reason: "",
    });

    // Payslip data (temporary dummy)
    const [payslips, setPayslips] = useState([
        {
            id: 1,
            month: "September 2025",
            basic: 25000,
            hra: 10000,
            allowance: 5000,
            deductions: 3000,
        },
        {
            id: 2,
            month: "August 2025",
            basic: 25000,
            hra: 10000,
            allowance: 4000,
            deductions: 2000,
        },
    ]);

    const [message, setMessage] = useState("");

    const modules = [
        { key: "dashboard", label: "Dashboard" },
        { key: "profile", label: "My Profile" },
        { key: "attendance", label: "Attendance" },
        { key: "leave", label: "Leave" },
        { key: "payslips", label: "Payslips" },
    ];


    // Punch In / Out functions with location
    const handlePunchIn = () => {
        if (!navigator.geolocation) {
            setMessage("⚠️ Geolocation is not supported by your browser.");
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;

                const now = new Date();
                const date = now.toISOString().split("T")[0];
                const time = now.toLocaleTimeString();

                const existing = attendance.find((a) => a.date === date);
                if (existing && existing.punchIn) {
                    setMessage("⚠️ You already punched in today!");
                    return;
                }

                const record = {
                    date,
                    punchIn: time,
                    punchOut: null,
                    status: "Present",
                    punchInLocation: { latitude, longitude } // Save location
                };

                setAttendance((prev) => [...prev, record]);
                setIsPunchedIn(true);
                setMessage("✅ Punched In Successfully!");
            },
            (error) => {
                setMessage("⚠️ Unable to get location. Please allow location access.");
            }
        );
    };

    const handlePunchOut = () => {
        if (!navigator.geolocation) {
            setMessage("⚠️ Geolocation is not supported by your browser.");
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;

                const now = new Date();
                const date = now.toISOString().split("T")[0];
                const time = now.toLocaleTimeString();

                setAttendance((prev) =>
                    prev.map((a) =>
                        a.date === date
                            ? {
                                ...a,
                                punchOut: time,
                                status: "Present",
                                punchOutLocation: { latitude, longitude } // Save location
                            }
                            : a
                    )
                );
                setIsPunchedIn(false);
                setMessage("✅ Punched Out Successfully!");
            },
            (error) => {
                setMessage("⚠️ Unable to get location. Please allow location access.");
            }
        );
    };


    // Leave functions
    const handleLeaveSubmit = (e) => {
        e.preventDefault();

        if (!leaveForm.startDate || !leaveForm.endDate || !leaveForm.reason) {
            setMessage("⚠️ Please fill all leave fields.");
            return;
        }

        const newLeave = {
            ...leaveForm,
            status: "Pending",
            id: Date.now(),
        };

        setLeaveRequests((prev) => [...prev, newLeave]);

        // Add leave dates to attendance
        const start = new Date(leaveForm.startDate);
        const end = new Date(leaveForm.endDate);
        const dates = [];
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const formatted = d.toISOString().split("T")[0];
            dates.push(formatted);
        }

        const leaveRecords = dates.map((date) => ({
            date,
            punchIn: null,
            punchOut: null,
            status: `Leave (${leaveForm.type})`,
        }));

        setAttendance((prev) => [...prev, ...leaveRecords]);

        setLeaveForm({ startDate: "", endDate: "", type: "Casual Leave", reason: "" });
        setMessage("✅ Leave request submitted successfully!");
    };

    // Payslip PDF download
    const generatePayslipPDF = (payslip) => {
        const doc = new jsPDF();

        doc.setFontSize(18);
        doc.text("Employee Payslip", 14, 20);
        doc.setFontSize(12);
        doc.text(`Month: ${payslip.month}`, 14, 30);

        const tableData = [
            ["Basic Salary", `₹${payslip.basic}`],
            ["HRA", `₹${payslip.hra}`],
            ["Allowance", `₹${payslip.allowance}`],
            ["Deductions", `₹${payslip.deductions}`],
            ["Net Salary", `₹${payslip.basic + payslip.hra + payslip.allowance - payslip.deductions}`],
        ];

        doc.autoTable({
            startY: 40,
            head: [["Description", "Amount"]],
            body: tableData,
        });

        doc.text("This is a system-generated payslip.", 14, doc.lastAutoTable.finalY + 15);
        doc.save(`Payslip_${payslip.month.replace(" ", "_")}.pdf`);
    };

    const currentDate = new Date();
    const currentMonth = currentDate.toLocaleString("default", { month: "long" });
    const currentMonthAttendance = attendance.filter(
        (a) => new Date(a.date).getMonth() === currentDate.getMonth()
    );

    const renderContent = () => {
        switch (activeModule) {
            case "dashboard":
                return (
                    <div>
                        {/* Welcome Header */}
                        <h2 className="text-2xl font-bold mb-2">Welcome, John Doe 👋</h2>
                        <p className="text-gray-600 mb-6">
                            Today is{" "}
                            {new Date().toLocaleDateString("en-US", {
                                weekday: "long",
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                            })}
                        </p>

                        {/* Summary Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                            <div className="bg-blue-100 p-4 rounded-xl shadow text-center">
                                <h3 className="text-gray-700 font-semibold">Today's Attendance</h3>
                                <p className="text-xl font-bold text-blue-700 mt-2">
                                    {isPunchedIn ? "Punched In ✅" : "Not Yet Punched In ⏰"}
                                </p>
                            </div>
                            <div className="bg-yellow-100 p-4 rounded-xl shadow text-center">
                                <h3 className="text-gray-700 font-semibold">Pending Leaves</h3>
                                <p className="text-xl font-bold text-yellow-700 mt-2">
                                    {leaveRequests.filter((l) => l.status === "Pending").length}
                                </p>
                            </div>
                            <div className="bg-green-100 p-4 rounded-xl shadow text-center">
                                <h3 className="text-gray-700 font-semibold">Days Present</h3>
                                <p className="text-xl font-bold text-green-700 mt-2">
                                    {attendance.filter((a) => a.status.includes("Present")).length}
                                </p>
                            </div>
                            <div className="bg-purple-100 p-4 rounded-xl shadow text-center">
                                <h3 className="text-gray-700 font-semibold">Latest Payslip</h3>
                                <p className="text-xl font-bold text-purple-700 mt-2">
                                    {payslips.length > 0 ? payslips[0].month : "No Payslip Yet"}
                                </p>
                            </div>
                        </div>

                        {/* Recent Attendance Table */}
                        <div className="bg-white p-6 rounded-xl shadow mb-8">
                            <h3 className="text-xl font-semibold mb-4">Recent Attendance</h3>
                            {attendance.length === 0 ? (
                                <p>No attendance data yet.</p>
                            ) : (
                                <table className="min-w-full border rounded-lg overflow-hidden">
                                    Attendance
                                </table>
                            )}
                        </div>

                        {/* Leave Summary */}
                        <div className="bg-white p-6 rounded-xl shadow mb-8">
                            <h3 className="text-xl font-semibold mb-4">Leave Balance</h3>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="bg-blue-50 p-4 rounded-lg text-center">
                                    <p className="font-medium text-gray-600">Casual Leave</p>
                                    <p className="text-2xl font-bold text-blue-700">2</p>
                                </div>
                                <div className="bg-green-50 p-4 rounded-lg text-center">
                                    <p className="font-medium text-gray-600">Sick Leave</p>
                                    <p className="text-2xl font-bold text-green-700">4</p>
                                </div>
                                <div className="bg-purple-50 p-4 rounded-lg text-center">
                                    <p className="font-medium text-gray-600">Earned Leave</p>
                                    <p className="text-2xl font-bold text-purple-700">6</p>
                                </div>
                            </div>
                        </div>

                        {/* Upcoming Holidays */}
                        <div className="bg-white p-6 rounded-xl shadow">
                            <h3 className="text-xl font-semibold mb-3">Upcoming Holidays 🎉</h3>
                            <ul className="list-disc ml-6 text-gray-700">
                                <li>Diwali – 29 Oct 2025</li>
                                <li>Christmas – 25 Dec 2025</li>
                                <li>New Year – 1 Jan 2026</li>
                            </ul>
                        </div>
                    </div>
                );

                return (
                    <div>
                        <h2 className="text-2xl font-bold mb-4">Employee Dashboard</h2>
                        <p>Welcome! Manage your attendance, leaves, and payslips here.</p>
                    </div>
                );

            case "profile":
                return (
                    <div className="bg-white p-6 rounded-lg shadow">
                        <h2 className="text-2xl font-bold mb-6">My Profile</h2>

                        {/* Profile Header */}
                        <div className="flex items-center space-x-6 mb-6">
                            <img
                                src="https://i.pravatar.cc/150?img=8"
                                alt="Profile"
                                className="w-32 h-32 rounded-full border-4 border-gray-300 shadow"
                            />
                            <div>
                                <h3 className="text-xl font-semibold">John Doe</h3>
                                <p className="text-gray-600">Field Engineer</p>
                                <p className="text-gray-600">Department: Maintenance</p>
                            </div>
                        </div>

                        {/* Profile Details */}
                        <div className="grid grid-cols-2 gap-6 text-gray-700">
                            <div>
                                <p><strong>Employee ID:</strong> EMP123</p>
                                <p><strong>Email:</strong> john.doe@example.com</p>
                                <p><strong>Phone:</strong> +91 9876543210</p>
                                <p><strong>Joining Date:</strong> 2023-05-10</p>
                            </div>
                            <div>
                                <p><strong>Location:</strong> Bangalore, India</p>
                                <p><strong>Gender:</strong> Male</p>
                                <p><strong>Date of Birth:</strong> 1995-07-15</p>
                                <p><strong>Blood Group:</strong> B+</p>
                            </div>
                        </div>

                        {/* Company Info */}
                        <div className="mt-6">
                            <h3 className="text-lg font-semibold mb-2">Company Information</h3>
                            <p><strong>Reporting Manager:</strong> Sarah Johnson</p>
                            <p><strong>Employment Type:</strong> Full-Time</p>
                            <p><strong>Work Shift:</strong> 9:00 AM - 6:00 PM</p>
                        </div>
                    </div>
                );




            case "attendance":
                return (
                    <div>
                        <h2 className="text-2xl font-bold mb-4">Attendance</h2>
                        {message && (
                            <p
                                className={`mb-4 font-medium ${message.includes("✅") ? "text-green-600" : "text-red-600"
                                    }`}
                            >
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

                        <h3 className="text-xl font-semibold mb-3">
                            Attendance for {currentMonth}
                        </h3>

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

            case "leave":
                return (
                    <div>
                        <h2 className="text-2xl font-bold mb-4">Leave Request</h2>

                        <form
                            onSubmit={handleLeaveSubmit}
                            className="bg-white p-6 rounded-xl shadow mb-8"
                        >
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="block mb-1 font-semibold">Start Date</label>
                                    <input
                                        type="date"
                                        name="startDate"
                                        value={leaveForm.startDate}
                                        onChange={(e) =>
                                            setLeaveForm({ ...leaveForm, startDate: e.target.value })
                                        }
                                        className="w-full border px-3 py-2 rounded"
                                    />
                                </div>

                                <div>
                                    <label className="block mb-1 font-semibold">End Date</label>
                                    <input
                                        type="date"
                                        name="endDate"
                                        value={leaveForm.endDate}
                                        onChange={(e) =>
                                            setLeaveForm({ ...leaveForm, endDate: e.target.value })
                                        }
                                        className="w-full border px-3 py-2 rounded"
                                    />
                                </div>
                            </div>

                            <div className="mb-4">
                                <label className="block mb-1 font-semibold">Leave Type</label>
                                <select
                                    name="type"
                                    value={leaveForm.type}
                                    onChange={(e) =>
                                        setLeaveForm({ ...leaveForm, type: e.target.value })
                                    }
                                    className="w-full border px-3 py-2 rounded"
                                >
                                    <option>Casual Leave</option>
                                    <option>Sick Leave</option>
                                    <option>Earned Leave</option>
                                    <option>Unpaid Leave</option>
                                </select>
                            </div>

                            <div className="mb-4">
                                <label className="block mb-1 font-semibold">Reason</label>
                                <textarea
                                    name="reason"
                                    value={leaveForm.reason}
                                    onChange={(e) =>
                                        setLeaveForm({ ...leaveForm, reason: e.target.value })
                                    }
                                    className="w-full border px-3 py-2 rounded"
                                    rows="3"
                                ></textarea>
                            </div>

                            <button
                                type="submit"
                                className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
                            >
                                Submit Leave Request
                            </button>
                        </form>

                        <h3 className="text-xl font-semibold mb-3">My Leave Requests</h3>
                        {leaveRequests.length === 0 ? (
                            <p>No leave requests yet.</p>
                        ) : (
                            <table className="min-w-full bg-white rounded-xl shadow">
                                <thead className="bg-gray-700 text-white">
                                    <tr>
                                        <th className="py-2 px-4 text-left">Dates</th>
                                        <th className="py-2 px-4 text-left">Type</th>
                                        <th className="py-2 px-4 text-left">Reason</th>
                                        <th className="py-2 px-4 text-left">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {leaveRequests.map((l) => (
                                        <tr key={l.id} className="border-b hover:bg-gray-100">
                                            <td className="py-2 px-4">
                                                {l.startDate} → {l.endDate}
                                            </td>
                                            <td className="py-2 px-4">{l.type}</td>
                                            <td className="py-2 px-4">{l.reason}</td>
                                            <td className="py-2 px-4">{l.status}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                );

            case "payslips":
                return (
                    <div>
                        <h2 className="text-2xl font-bold mb-4">My Payslips</h2>
                        {payslips.length === 0 ? (
                            <p>No payslips available yet.</p>
                        ) : (
                            <table className="min-w-full bg-white rounded-xl shadow">
                                <thead className="bg-gray-700 text-white">
                                    <tr>
                                        <th className="py-2 px-4 text-left">Month</th>
                                        <th className="py-2 px-4 text-left">Basic</th>
                                        <th className="py-2 px-4 text-left">HRA</th>
                                        <th className="py-2 px-4 text-left">Allowances</th>
                                        <th className="py-2 px-4 text-left">Deductions</th>
                                        <th className="py-2 px-4 text-left">Net Salary</th>
                                        <th className="py-2 px-4 text-left">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {payslips.map((p) => (
                                        <tr key={p.id} className="border-b hover:bg-gray-100">
                                            <td className="py-2 px-4">{p.month}</td>
                                            <td className="py-2 px-4">₹{p.basic}</td>
                                            <td className="py-2 px-4">₹{p.hra}</td>
                                            <td className="py-2 px-4">₹{p.allowance}</td>
                                            <td className="py-2 px-4">₹{p.deductions}</td>
                                            <td className="py-2 px-4 font-semibold">
                                                ₹{p.basic + p.hra + p.allowance - p.deductions}
                                            </td>
                                            <td className="py-2 px-4">
                                                <button
                                                    onClick={() => generatePayslipPDF(p)}
                                                    className="bg-blue-600 text-white px-4 py-1 rounded hover:bg-blue-700"
                                                >
                                                    Download PDF
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                );



            default:
                return <div>Select a module</div>;
        }
    };

    return (
        <div className="flex min-h-screen">
            {/* Sidebar */}
            <div className="w-1/5 bg-gray-700 text-white p-6 flex flex-col justify-between min-h-screen">
                <div className="flex flex-col space-y-4">
                    <h1 className="text-2xl font-bold mb-6">Employee Panel</h1>
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

                <button
                    onClick={() => navigate("/login")}
                    className="w-full py-2 mt-6 rounded bg-red-600 hover:bg-red-700 text-white"
                >
                    Logout
                </button>
            </div>

            {/* Main Content */}
            <div className="w-4/5 p-8 bg-gray-100">{renderContent()}</div>
        </div>
    );
}

export default Employee;
