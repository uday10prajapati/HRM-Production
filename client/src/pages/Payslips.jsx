import React, { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import axios from 'axios';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export default function Payslips() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);

  // Determine current user from localStorage (app stores user object there)
  const stored = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
  const user = stored ? JSON.parse(stored) : null;
  const userId = user?.id;

  useEffect(() => { if (userId) fetchRecords(); }, [userId]);

  async function fetchRecords() {
    setLoading(true);
    try {
      const headers = { 'X-User-Id': userId };
      const res = await axios.get(`/api/payroll/records/${userId}`, { headers });
      setRecords(res.data.records || []);
    } catch (err) {
      console.error('Failed to fetch payslips', err);
      setRecords([]);
    } finally { setLoading(false); }
  }

  async function downloadSlip(rec) {
    try {
  const headers = { 'X-User-Id': userId };
  const res = await axios.get(`/api/payroll/slip/${userId}/${rec.year}/${rec.month}`, { headers });
      const slip = res.data;
      const doc = new jsPDF();
      doc.setFontSize(12);
      doc.text(`Salary Slip - ${rec.month}/${rec.year}`, 14, 20);
      doc.text(`Employee: ${user?.name || ''} (${user?.email || ''})`, 14, 30);
      doc.text(`Basic: ₹${slip.basic}`, 14, 40);
      doc.text(`HRA: ₹${slip.hra}`, 14, 48);
      doc.text(`Gross: ₹${slip.gross}`, 14, 56);
      doc.text(`Deductions:`, 14, 66);
      const deductions = [
        ['PF', slip.pf || 0],
        ['ESI (Employee)', slip.esi_employee || 0],
        ['Professional Tax', slip.professional_tax || 0],
        ['TDS', slip.tds || 0]
      ];
      doc.autoTable({ startY: 72, head: [['Deduction', 'Amount']], body: deductions });
      doc.text(`Net Pay: ₹${slip.net_pay}`, 14, doc.lastAutoTable ? doc.lastAutoTable.finalY + 10 : 120);
      doc.save(`salary_slip_${userId}_${rec.year}_${rec.month}.pdf`);
    } catch (err) {
      console.error('Failed to download slip', err);
      alert('Slip not available');
    }
  }

  if (!userId) return (
    <div className="p-6">
      <h3 className="text-lg font-semibold">Not signed in</h3>
      <p>Please login to view your payslips.</p>
    </div>
  );

  return (
    <div className="flex flex-col h-screen">
      <Navbar />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 p-6 bg-gray-100">
          <h1 className="text-2xl font-semibold mb-4">Payslips</h1>
          <div className="bg-white rounded shadow p-4">
            {loading ? <div>Loading...</div> : (
              <table className="min-w-full text-sm">
                <thead>
                  <tr>
                    <th className="px-2 py-1">Year</th>
                    <th className="px-2 py-1">Month</th>
                    <th className="px-2 py-1">Gross</th>
                    <th className="px-2 py-1">Net Pay</th>
                    <th className="px-2 py-1">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {records.length === 0 && <tr><td colSpan={5} className="p-4">No payslips found</td></tr>}
                  {records.map(r => (
                    <tr key={`${r.year}-${r.month}`} className="border-t">
                      <td className="px-2 py-1">{r.year}</td>
                      <td className="px-2 py-1">{r.month}</td>
                      <td className="px-2 py-1">₹{r.gross}</td>
                      <td className="px-2 py-1">₹{r.net_pay}</td>
                      <td className="px-2 py-1"><button onClick={() => downloadSlip(r)} className="px-2 py-1 bg-indigo-600 text-white rounded">Download</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
