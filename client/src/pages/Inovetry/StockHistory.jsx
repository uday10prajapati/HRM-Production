import React, { useState, useEffect } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import Navbar from '../../components/Navbar';
import Sidebar from '../../components/Sidebar';

const StockHistory = () => {
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [engineers, setEngineers] = useState([]);
  const [filters, setFilters] = useState({
    engineerId: '',
    date: '',
    month: '',
    year: new Date().getFullYear().toString()
  });

  const months = [
    { value: '', label: 'All Months' },
    { value: '1', label: 'January' },
    { value: '2', label: 'February' },
    { value: '3', label: 'March' },
    { value: '4', label: 'April' },
    { value: '5', label: 'May' },
    { value: '6', label: 'June' },
    { value: '7', label: 'July' },
    { value: '8', label: 'August' },
    { value: '9', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' }
  ];

  useEffect(() => {
    const fetchEngineers = async () => {
      try {
        const res = await axios.get('/api/users');
        const users = res.data?.users || res.data || [];
        setEngineers(users.filter(u => (u.role || '').toLowerCase() === 'engineer'));
      } catch (err) {
        console.error('Failed to fetch engineers', err);
      }
    };
    fetchEngineers();
    fetchReport();
  }, []);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const { engineerId, date, month, year } = filters;
      const params = new URLSearchParams();
      if (engineerId) params.append('engineerId', engineerId);
      if (date) params.append('date', date);
      if (month) params.append('month', month);
      if (year) params.append('year', year);

      const res = await axios.get(`/api/stock/history-report?${params.toString()}`);
      setReportData(res.data || []);
    } catch (err) {
      console.error('Failed to fetch report', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const downloadExcel = () => {
    if (reportData.length === 0) return alert('No data to download');

    // Group by Engineer and Item Name
    const aggregations = reportData.reduce((acc, item) => {
      const key = `${item.engineer_name} || ${item.item_name}`;
      if (!acc[key]) {
        acc[key] = { 
          engineer: item.engineer_name, 
          item: item.item_name, 
          assigned: 0, 
          used: 0 
        };
      }
      
      const qty = Number(item.quantity || 0);
      if (item.type === 'Assignment') {
        acc[key].assigned += qty;
      } else if (item.type === 'Consumption') {
        acc[key].used += qty;
      }
      
      return acc;
    }, {});

    // Prepare summary rows for each assigned item
    const itemSummaryRows = Object.values(aggregations).map(agg => ({
      'Date': 'ITEM SUMMARY',
      'Type': agg.item,
      'Engineer Name': agg.engineer,
      'Stock Item': 'Assigned: ' + agg.assigned,
      'Quantity': 'Used: ' + agg.used,
      'Processed By / Note': 'Balance: ' + (agg.assigned - agg.used)
    }));

    const historyData = reportData.map(item => ({
      'Date': new Date(item.date).toLocaleDateString(),
      'Type': item.type,
      'Engineer Name': item.engineer_name,
      'Stock Item': item.item_name,
      'Quantity': item.quantity,
      'Processed By / Note': item.type === 'Assignment' ? (item.processed_by || 'Admin') : (item.note || 'N/A')
    }));

    const worksheet = XLSX.utils.json_to_sheet([
      { 'Date': 'STOCK SUMMARY BY ITEM', 'Type': '', 'Engineer Name': '', 'Stock Item': '', 'Quantity': '', 'Processed By / Note': '' },
      ...itemSummaryRows,
      { 'Date': '', 'Type': '', 'Engineer Name': '', 'Stock Item': '', 'Quantity': '', 'Processed By / Note': '' }, // Spacer
      { 'Date': 'DETAILED TRANSACTION HISTORY', 'Type': '', 'Engineer Name': '', 'Stock Item': '', 'Quantity': '', 'Processed By / Note': '' },
      ...historyData
    ]);

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Stock History');
    XLSX.writeFile(workbook, `Stock_History_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Calculate totals
  const summary = reportData.reduce((acc, item) => {
    const qty = Number(item.quantity || 0);
    if (item.type === 'Assignment') {
      acc.totalAssigned += qty;
    } else if (item.type === 'Consumption') {
      acc.totalUsed += qty;
    }
    return acc;
  }, { totalAssigned: 0, totalUsed: 0 });

  const currentStock = summary.totalAssigned - summary.totalUsed;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/50">
      <div className="fixed top-0 w-full z-50"><Navbar /></div>
      <div className="flex flex-1 pt-16 overflow-hidden">
        <div className="fixed left-0 h-full w-64 hidden md:block"><Sidebar /></div>
        <main className="flex-1 md:ml-64 p-4 sm:p-8 relative overflow-y-auto w-full custom-scrollbar">
          <div className="max-w-7xl mx-auto">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
              <div>
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Stock Movement History</h1>
                <p className="text-slate-500 mt-1">Detailed report of stock assignments and usage by engineers</p>
              </div>
              <button
                onClick={downloadExcel}
                className="inline-flex items-center px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-sm transition-all duration-200 transform hover:scale-105 active:scale-95 gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download Excel
              </button>
            </div>

            {/* Filters Section */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-8">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2 uppercase tracking-wider">Select Engineer</label>
                  <select
                    name="engineerId"
                    value={filters.engineerId}
                    onChange={handleFilterChange}
                    className="w-full rounded-xl border-slate-200 bg-slate-50 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all py-2.5"
                  >
                    <option value="">All Engineers</option>
                    {engineers.map(eng => (
                      <option key={eng.id} value={eng.id}>{eng.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2 uppercase tracking-wider">Specific Date</label>
                  <input
                    type="date"
                    name="date"
                    value={filters.date}
                    onChange={handleFilterChange}
                    className="w-full rounded-xl border-slate-200 bg-slate-50 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all py-2.5"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2 uppercase tracking-wider">Month</label>
                  <select
                    name="month"
                    value={filters.month}
                    onChange={handleFilterChange}
                    className="w-full rounded-xl border-slate-200 bg-slate-50 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all py-2.5"
                  >
                    {months.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={fetchReport}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-xl shadow-lg transition-all active:scale-95"
                  >
                    Apply Filters
                  </button>
                </div>
              </div>
            </div>

            {/* Table Section */}
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Date</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Type</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Engineer</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Stock Item</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Quantity</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Processed By / Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      <tr>
                        <td colSpan="6" className="px-6 py-12 text-center text-slate-400">
                          <div className="flex items-center justify-center gap-3">
                            <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                            Fetching records...
                          </div>
                        </td>
                      </tr>
                    ) : reportData.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="px-6 py-12 text-center text-slate-400 italic">
                          No records found matching the filters
                        </td>
                      </tr>
                    ) : (
                      reportData.map((item, idx) => (
                        <tr key={item.entry_id} className="hover:bg-indigo-50/50 transition-colors group">
                          <td className="px-6 py-4 text-sm text-slate-600 font-medium">
                            {new Date(item.date).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
                            <div className="text-[10px] text-slate-400 font-normal">
                              {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide shadow-sm ${item.type === 'Assignment'
                              ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-100 text-amber-700 border border-amber-200'
                              }`}>
                              {item.type}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm font-semibold text-slate-800">
                            {item.engineer_name}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-700">
                            <div className="font-medium">{item.item_name}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className={`text-sm font-bold ${item.type === 'Assignment' ? 'text-emerald-600' : 'text-amber-600'}`}>
                              {item.type === 'Assignment' ? '+' : '-'}{item.quantity}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-500 italic">
                            {item.type === 'Assignment' ? (
                              <span className="flex items-center gap-1.5 not-italic text-slate-600">
                                <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                                {item.processed_by || 'Admin'}
                              </span>
                            ) : (
                              item.note || 'No notes'
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default StockHistory;
