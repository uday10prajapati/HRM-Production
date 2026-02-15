import React, { useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";

export default function Payroll() {
    const [payroll, setPayroll] = useState([]);

    useEffect(() => {
        fetch('/api/payroll')
            .then((res) => res.json())
            .then((data) => setPayroll(data))
            .catch(console.error);
    }, []);

    return (
        
        <div>
            <Navbar />
            <Sidebar />
            <h2 className="text-2xl font-bold mb-4">Payroll & Compliance</h2>
            <table className="min-w-full bg-white rounded-xl shadow">
                <thead className="bg-blue-500 text-white">
                    <tr>
                        <th className="py-2 px-4">Employee</th>
                        <th className="py-2 px-4">Month</th>
                        <th className="py-2 px-4">Basic</th>
                        <th className="py-2 px-4">HRA</th>
                        <th className="py-2 px-4">Deductions</th>
                        <th className="py-2 px-4">Net Salary</th>
                    </tr>
                </thead>
                <tbody>
                    {payroll.map((p) => (
                        <tr key={p.id} className="border-b hover:bg-gray-100">
                            <td className="py-2 px-4">{p.employeeName}</td>
                            <td className="py-2 px-4">{p.month}</td>
                            <td className="py-2 px-4">{p.basic}</td>
                            <td className="py-2 px-4">{p.hra}</td>
                            <td className="py-2 px-4">{p.deductions}</td>
                            <td className="py-2 px-4">{p.netSalary}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}