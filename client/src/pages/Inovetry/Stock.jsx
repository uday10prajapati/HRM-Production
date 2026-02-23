import React, { useEffect, useState, useMemo } from 'react';
import Navbar from '../../components/Navbar';
import Sidebar from '../../components/Sidebar';
import CentralStock from './CentralStock';
import LowStockAlerts from './LowStockAlerts';
import EngineerStockModal from '../../components/EngineerStockModal';
import EngineerStock from './EngineerStock';
import WastageList from './WastageList';
import ManageStockModal from '../../components/ManageStockModal';
import axios from 'axios';

export default function Stock() {
  const [user, setUser] = useState(null);
  const [allocations, setAllocations] = useState([]);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [modalEngineer, setModalEngineer] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [manageModalOpen, setManageModalOpen] = useState(false);

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem('user'));
      setUser(u);
    } catch (e) { console.error('Failed to parse user', e); }
  }, []);

  const isEngineer = user?.role === 'engineer';
  const engineerId = null;

  useEffect(() => {
    if (isEngineer) return; // Don't load admin data if engineer
    let mounted = true;
    async function load() {
      setOverviewLoading(true);
      try {
        const res = await axios.get('/api/stock/overview/full');
        if (!mounted) return;
        setAllocations(res.data.allocations || []);
      } catch (err) {
        console.error('Failed to load allocations', err);
        if (mounted) setAllocations([]);
      } finally {
        if (mounted) setOverviewLoading(false);
      }
    }
    load();
    // polling every 30s
    const id = setInterval(load, 30_000);
    return () => { mounted = false; clearInterval(id); };
  }, [isEngineer]);

  const lowEngineersCount = useMemo(() => {
    try {
      const map = new Set();
      (allocations || []).forEach(a => {
        if (Number(a.quantity) <= Number(a.item_threshold || 0)) map.add(String(a.engineer_id || a.engineer_name));
      });
      return map.size;
    } catch { return 0; }
  }, [allocations]);

  function openEngineerModal(engineerId) {
    setModalEngineer(engineerId);
    setModalOpen(true);
  }

  function exportCsv() {
    if (!allocations || allocations.length === 0) return alert('No data to export');
    const rows = allocations.map(a => ({ Engineer: a.engineer_name || a.engineer_id, Item: a.item_name || a.stock_item_id, Quantity: a.quantity, Threshold: a.item_threshold, LastReported: a.last_reported_at || '' }));
    const header = Object.keys(rows[0]);
    const csv = [header.join(','), ...rows.map(r => header.map(h => `"${String(r[h] ?? '')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `allocations_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (isEngineer) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-8">
            <div className="max-w-7xl mx-auto">
              <h1 className="text-3xl font-bold text-gray-800 mb-6">My Inventory</h1>
              <EngineerStock engineerId={user.id} />
              <div className="mt-8">
                <h2 className="text-xl font-bold text-gray-800 mb-4">My Wastage Reports</h2>
                <WastageList />
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/50">
      <div className="fixed top-0 w-full z-50"><Navbar /></div>
      <div className="flex flex-1 pt-16 overflow-hidden">
        <div className="fixed left-0 h-full w-64 hidden md:block"><Sidebar /></div>
        <main className="flex-1 md:ml-64 p-4 sm:p-8 relative overflow-y-auto w-full custom-scrollbar">

          {/* Background Pattern */}
          <div className="absolute inset-x-0 top-0 h-96 bg-gradient-to-b from-indigo-50/80 to-transparent pointer-events-none -z-10" />

          <div className="max-w-7xl mx-auto space-y-8 animate-[fadeIn_0.3s_ease-out]">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2 mb-8">
              <div>
                <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Systemic Assets & Supply Flow</h1>
                <p className="text-sm font-medium text-slate-500 mt-2">Comprehensive monitoring of centralized supply lines and personnel allocations.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-4 md:mt-0">
                <button
                  onClick={() => setManageModalOpen(true)}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all flex items-center gap-2 shadow-md shadow-indigo-500/20 hover:shadow-lg hover:shadow-indigo-500/40 hover:-translate-y-0.5"
                >
                  <svg className="w-5 h-5 -ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Provision Equipment
                </button>
                <button
                  onClick={exportCsv}
                  className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl transition-all flex items-center gap-2 shadow-md shadow-emerald-500/20 hover:shadow-lg hover:shadow-emerald-500/40 hover:-translate-y-0.5"
                >
                  <svg className="w-5 h-5 -ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Extract Dataset
                </button>
              </div>
            </div>

            {/* Main Grid Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <div className="bg-white rounded-3xl shadow-[0_2px_24px_-4px_rgba(0,0,0,0.05)] border border-slate-100 overflow-hidden h-full">
                  <div className="p-6">
                    <CentralStock />
                  </div>
                </div>
              </div>
              <div>
                <div className="bg-white rounded-3xl shadow-[0_2px_24px_-4px_rgba(0,0,0,0.05)] border border-slate-100 overflow-hidden h-full">
                  <div className="p-6">
                    <LowStockAlerts engineerId={engineerId} />
                  </div>
                </div>
              </div>
            </div>

            {/* Wastage Section (New) */}
            <div className="bg-white rounded-3xl shadow-[0_2px_24px_-4px_rgba(0,0,0,0.05)] border border-slate-100 overflow-hidden">
              <div className="p-6">
                <WastageList />
              </div>
            </div>

            {/* Personnel Allocations Section */}
            <div className="bg-white rounded-3xl shadow-[0_2px_24px_-4px_rgba(0,0,0,0.05)] border border-slate-100 overflow-hidden">
              <div className="p-6 sm:p-8 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                  <h2 className="text-lg font-bold text-slate-800">Personnel Supply Matrix</h2>
                </div>
                <div className="flex items-center space-x-2 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
                  <div className="relative flex h-3 w-3">
                    {lowEngineersCount > 0 && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>}
                    <span className={`relative inline-flex rounded-full h-3 w-3 ${lowEngineersCount > 0 ? 'bg-amber-500' : 'bg-slate-300'}`}></span>
                  </div>
                  <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">
                    Low Supply Nodes: <span className={lowEngineersCount > 0 ? 'text-amber-600' : 'text-slate-400'}>{lowEngineersCount}</span>
                  </span>
                </div>
              </div>

              {overviewLoading ? (
                <div className="p-16 text-center flex flex-col items-center justify-center">
                  <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mb-4">
                    <svg className="animate-spin h-8 w-8 text-indigo-500" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  </div>
                  <span className="text-sm font-bold text-slate-500 uppercase tracking-widest">Scanning Allocations...</span>
                </div>
              ) : allocations.length === 0 ? (
                <div className="p-16 text-center flex flex-col items-center justify-center bg-slate-50/50 m-6 rounded-2xl border border-dashed border-slate-200">
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-200/50">
                    <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                  </div>
                  <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-1">Matrix Empty</h3>
                  <p className="text-xs font-medium text-slate-400">Initiate supply provisions to personnel nodes.</p>
                </div>
              ) : (
                <div className="overflow-x-auto custom-scrollbar">
                  {allocations.some(a => Number(a.quantity) <= Number(a.item_threshold || 0)) && (
                    <div className="m-6 p-4 rounded-xl bg-amber-50/80 border border-amber-200 flex items-center text-amber-800 font-bold text-sm shadow-sm">
                      <svg className="w-5 h-5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      Attention: Certain supply nodes require immediate replenishment.
                    </div>
                  )}

                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50 border-b border-slate-100">
                        <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Node Identity</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Asset Hash</th>
                        <th className="px-6 py-4 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">Current Volume</th>
                        <th className="px-6 py-4 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">Warning Floor</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Telemetry Timestamp</th>
                        <th className="px-6 py-4 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">System State</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {allocations.map(a => {
                        const isLow = Number(a.quantity) <= Number(a.item_threshold || 0);
                        return (
                          <tr key={a.id || Math.random()} className={`hover:bg-indigo-50/30 transition-colors group ${isLow ? 'bg-rose-50/20' : ''}`}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <button
                                onClick={() => openEngineerModal(a.engineer_id || a.engineer_name)}
                                className="flex items-center gap-3 text-left w-full group/btn"
                              >
                                <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center group-hover/btn:bg-indigo-600 transition-colors">
                                  <span className="text-indigo-600 font-bold text-xs group-hover/btn:text-white transition-colors">
                                    {((a.engineer_name || a.engineer_id)?.[0] || 'N').toUpperCase()}
                                  </span>
                                </div>
                                <span className="text-sm font-bold text-indigo-600 group-hover/btn:text-indigo-800 transition-colors">
                                  {a.engineer_name || a.engineer_id}
                                </span>
                              </button>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="px-3 py-1 inline-flex text-xs font-bold rounded-lg bg-slate-100 text-slate-600 border border-slate-200">
                                {a.item_name || a.stock_item_id}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <span className={`px-3 py-1 inline-flex text-xs font-black rounded-lg border ${isLow ? 'bg-rose-100 text-rose-800 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                }`}>
                                {a.quantity}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-bold text-slate-400">{a.item_threshold}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-slate-500">
                              {a.last_reported_at ? new Date(a.last_reported_at).toLocaleString() : '—'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              {isLow ? (
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-black bg-rose-50 text-rose-600 border border-rose-200 uppercase tracking-widest shadow-sm">
                                  Critical Drop
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-600 border border-emerald-200 uppercase tracking-widest shadow-sm">
                                  Optimal
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <EngineerStockModal
            engineerId={modalEngineer}
            open={modalOpen}
            onClose={() => setModalOpen(false)}
          />
          <ManageStockModal
            isOpen={manageModalOpen}
            onClose={() => setManageModalOpen(false)}
            onUpdated={() => {
              // Internal modal updates parent by remounting or user refresh
            }}
          />
        </main>
      </div>
    </div>
  );
}
