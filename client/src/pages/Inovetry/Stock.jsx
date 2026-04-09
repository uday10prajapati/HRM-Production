import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
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
                <Link
                  to="/stock-history"
                  className="px-5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl transition-all flex items-center gap-2 border border-indigo-200 shadow-sm hover:-translate-y-0.5"
                >
                  <svg className="w-5 h-5 -ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                  Track History
                </Link>
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
            <div className="grid grid-cols-1 gap-6">
              <div>
                <div className="bg-white rounded-3xl shadow-[0_2px_24px_-4px_rgba(0,0,0,0.05)] border border-slate-100 overflow-hidden h-full">
                  <div className="p-6">
                    <CentralStock />
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
