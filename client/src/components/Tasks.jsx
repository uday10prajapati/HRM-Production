import React, { useEffect, useState } from "react";
import axios from "axios";

export default function Tasks() {
    const [tasks, setTasks] = useState([]);

    useEffect(() => {
        let mounted = true;
        axios.get('/api/tasks')
            .then((res) => {
                // accept either { tasks: [...] } or raw array
                const payload = res.data.tasks || res.data;
                if (mounted) setTasks(payload || []);
            })
            .catch(console.error);
        return () => { mounted = false; };
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
                            <td className="py-2 px-4">{t.taskName || t.title || t.task}</td>
                            <td className="py-2 px-4">{t.engineer || t.assigned_to || t.assignedBy}</td>
                            <td className="py-2 px-4">{t.status}</td>
                            <td className="py-2 px-4">{t.customer}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
