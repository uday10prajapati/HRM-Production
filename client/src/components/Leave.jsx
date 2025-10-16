import React, { useEffect, useState } from "react";

export default function Leave() {
    const [leaves, setLeaves] = useState([]);

    useEffect(() => {
        fetch("http://localhost:5000/api/leaves")
            .then((res) => res.json())
            .then((data) => setLeaves(data))
            .catch(console.error);
    }, []);

    return (
        <div>
            <h2 className="text-2xl font-bold mb-4">Leave Management</h2>
            <table className="min-w-full bg-white rounded-xl shadow">
                <thead className="bg-blue-500 text-white">
                    <tr>
                        <th className="py-2 px-4">Employee</th>
                        <th className="py-2 px-4">Leave Type</th>
                        <th className="py-2 px-4">Start Date</th>
                        <th className="py-2 px-4">End Date</th>
                        <th className="py-2 px-4">Status</th>
                    </tr>
                </thead>
                <tbody>
                    {leaves.map((l) => (
                        <tr key={l.id} className="border-b hover:bg-gray-100">
                            <td className="py-2 px-4">{l.employeeName}</td>
                            <td className="py-2 px-4">{l.type}</td>
                            <td className="py-2 px-4">{l.startDate}</td>
                            <td className="py-2 px-4">{l.endDate}</td>
                            <td className="py-2 px-4">{l.status}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
