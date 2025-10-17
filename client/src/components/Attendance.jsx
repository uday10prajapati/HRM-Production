import React, { useEffect, useState } from "react";
import axios from "axios";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";

export default function Attendance() {
    const [records, setRecords] = useState([]);

    useEffect(() => {
        fetch("http://localhost:5000/api/attendance")
            .then((res) => res.json())
            .then((data) => setRecords(data))
            .catch(console.error);
    }, []);

    return (
        <div>
            <h2 className="text-2xl font-bold mb-4">Attendance Records</h2>
            <table className="min-w-full bg-white rounded-xl shadow">
                <thead className="bg-blue-500 text-white">
                    <tr>
                        <th className="py-2 px-4">Employee</th>
                        <th className="py-2 px-4">Date</th>
                        <th className="py-2 px-4">Punch In</th>
                        <th className="py-2 px-4">Punch Out</th>
                    </tr>
                </thead>
                <tbody>
                    {records.map((r) => (
                        <tr key={r.id} className="border-b hover:bg-gray-100">
                            <td className="py-2 px-4">{r.employeeName}</td>
                            <td className="py-2 px-4">{r.date}</td>
                            <td className="py-2 px-4">{r.punchIn}</td>
                            <td className="py-2 px-4">{r.punchOut}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
