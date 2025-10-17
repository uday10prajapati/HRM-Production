import React from 'react';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';

export default function Payslips() {
  // Placeholder list; integrate with backend for real payslips
  const slips = [
    { id: 1, month: '2025-01', net: '₹50,000' },
    { id: 2, month: '2025-02', net: '₹50,000' },
  ];

  return (
    <div className="flex flex-col h-screen">
      <Navbar />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 p-6 bg-gray-100">
          <h1 className="text-2xl font-semibold mb-4">Payslips</h1>
          <div className="bg-white rounded shadow p-4">
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left">Month</th>
                  <th className="px-4 py-2 text-left">Net Pay</th>
                  <th className="px-4 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {slips.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2">{s.month}</td>
                    <td className="px-4 py-2">{s.net}</td>
                    <td className="px-4 py-2"><button className="px-2 py-1 bg-indigo-600 text-white rounded">Download</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </div>
  );
}
