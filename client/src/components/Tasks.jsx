import React, { useEffect, useState } from "react";

export default function Tasks() {
    const [tasks, setTasks] = useState([]);

    useEffect(() => {
        fetch("http://localhost:5000/api/tasks")
            .then((res) => res.json())
            .then((data) => setTasks(data))
            .catch(console.error);
    }, []);

    return (
        <div>
            <h2 className="text-2xl font-bold mb-4">Field Tasks</h2>
            <table className="min-w-full bg-white rounded-xl shadow">
                <thead className="bg-blue-500 text-white">
                    <tr>
                        <th className="py-2 px-4">Task</th>
                        <th className="py-2 px-4">Engineer</th>
                        <th className="py-2 px-4">Status</th>
                        <th className="py-2 px-4">Customer</th>
                    </tr>
                </thead>
                <tbody>
                    {tasks.map((t) => (
                        <tr key={t.id} className="border-b hover:bg-gray-100">
                            <td className="py-2 px-4">{t.taskName}</td>
                            <td className="py-2 px-4">{t.engineer}</td>
                            <td className="py-2 px-4">{t.status}</td>
                            <td className="py-2 px-4">{t.customer}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
