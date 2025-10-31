import React, { useEffect, useState } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import Navbar from '../../components/Navbar';
import Sidebar from '../../components/Sidebar';
import axios from 'axios';

export default function PayrollReports() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [records, setRecords] = useState([]);
  const [stat, setStat] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetchOverview(); fetchStat(); }, []);

  async function fetchOverview() {
    setLoading(true);
    try {
      const meRaw = localStorage.getItem('user');
      const me = meRaw ? JSON.parse(meRaw) : null;
      const headers = me ? { 'X-User-Id': me.id } : {};
      const res = await axios.get(`/api/payroll/overview/${year}/${month}`, { headers });
      setRecords(res.data.records || []);
    } catch (err) {
      console.error('Failed to fetch overview', err);
      setRecords([]);
    } finally { setLoading(false); }
  }

  async function fetchStat() {
    try {
      const meRaw = localStorage.getItem('user');
      const me = meRaw ? JSON.parse(meRaw) : null;
      const headers = me ? { 'X-User-Id': me.id } : {};
      const res = await axios.get(`/api/payroll/statutory/${year}`, { headers });
      setStat(res.data);
    } catch (err) {
      console.error('Failed to fetch statutory', err);
      setStat(null);
    }
  }

  function formatMoney(v) { return '₹' + (Number(v||0).toFixed(2)); }

  return (
    <ProtectedRoute role="hr">
      <div className="flex flex-col h-screen">
        <Navbar />
        <div className="flex flex-1">
          <Sidebar />
          <main className="flex-1 p-6 bg-gray-100">
            <h1 className="text-2xl font-semibold mb-4">Payroll & Compliance Reports</h1>

            <div className="mb-4 bg-white p-4 rounded shadow">
              <label className="block text-sm">Year</label>
              <input type="number" className="border p-2 w-32" value={year} onChange={e => setYear(Number(e.target.value))} />
              <label className="block text-sm mt-2">Month</label>
              <input type="number" className="border p-2 w-32" value={month} onChange={e => setMonth(Number(e.target.value))} />
              <div className="mt-2">
                <button onClick={fetchOverview} className="px-3 py-1 bg-indigo-600 text-white rounded mr-2">Load Overview</button>
                <button onClick={fetchStat} className="px-3 py-1 bg-gray-200 rounded">Refresh Statutory</button>
              </div>
            </div>

            <div className="bg-white rounded shadow p-4 mb-6">
              <h3 className="font-semibold mb-2">Monthly Payroll Overview</h3>
              {loading ? <div>Loading...</div> : (
                <table className="min-w-full text-sm">
                  <thead><tr><th className="px-2 py-1">Name</th><th className="px-2 py-1">Role</th><th className="px-2 py-1">Gross</th><th className="px-2 py-1">PF</th><th className="px-2 py-1">ESI</th><th className="px-2 py-1">TDS</th><th className="px-2 py-1">Net</th><th className="px-2 py-1">Actions</th></tr></thead>
                  <tbody>
                    {records.map(r => (
                      <tr key={r.id} className="border-t">
                        <td className="px-2 py-1">{r.name}</td>
                        <td className="px-2 py-1">{r.role}</td>
                        <td className="px-2 py-1">{formatMoney(r.gross)}</td>
                        <td className="px-2 py-1">{formatMoney(r.pf)}</td>
                        <td className="px-2 py-1">{formatMoney(r.esi_employee)}</td>
                        <td className="px-2 py-1">{formatMoney(r.tds)}</td>
                        <td className="px-2 py-1">{formatMoney(r.net_pay)}</td>
                        <td className="px-2 py-1">
                          <a className="text-indigo-600 hover:underline" href={`/api/payroll/slip/${r.user_id}/${year}/${month}`} target="_blank" rel="noreferrer">View Slip</a>
                          <button className="ml-2 px-2 py-1 bg-yellow-600 text-white rounded" onClick={async () => {
                            try { await axios.get(`/api/payroll/form16/${r.user_id}/${year}`); alert('Form16 generated (summary returned)'); } catch (err) { console.error(err); alert('Form16 generation failed'); }
                          }}>Form16</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="bg-white rounded shadow p-4">
              <h3 className="font-semibold mb-2">Statutory Aggregates (Year)</h3>
              {stat ? (
                <div>
                  <div>Total PF: {formatMoney(stat.total_pf)}</div>
                  <div>Total ESI (Employee): {formatMoney(stat.total_esi_employee)}</div>
                  <div>Total ESI (Employer): {formatMoney(stat.total_esi_employer)}</div>
                </div>
              ) : <div>No data</div>}
            </div>
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}