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
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-8">
          <div className="max-w-7xl mx-auto space-y-8">
            {/* Header Section */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-800">Inventory & Stock Management</h1>
                <p className="mt-2 text-gray-600">Overview of central stock, low-stock alerts and engineer allocations</p>
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => setManageModalOpen(true)}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Manage Stock
                </button>
                <button
                  onClick={exportCsv}
                  className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export CSV
                </button>
              </div>
            </div>

            {/* Main Grid Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <CentralStock />
              </div>
              <div>
                <LowStockAlerts engineerId={engineerId} />
              </div>
            </div>

            {/* Wastage Section (New) */}
            <WastageList />

            {/* Engineer Allocations Section */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-800">Engineer Allocations & Reports</h2>
                  <div className="flex items-center space-x-2">
                    <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span className="text-sm font-medium text-gray-600">
                      Engineers with low-stock: <span className="text-yellow-600">{lowEngineersCount}</span>
                    </span>
                  </div>
                </div>
              </div>

              {overviewLoading ? (
                <div className="p-8 text-center">
                  <div className="inline-flex items-center space-x-3">
                    <svg className="animate-spin h-5 w-5 text-blue-500" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span className="text-gray-600">Loading allocations...</span>
                  </div>
                </div>
              ) : allocations.length === 0 ? (
                <div className="p-8 text-center">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No allocations found</h3>
                  <p className="mt-1 text-sm text-gray-500">Start by assigning stock items to engineers.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  {allocations.some(a => Number(a.quantity) <= Number(a.item_threshold || 0)) && (
                    <div className="m-6 p-4 rounded-lg bg-yellow-50 border border-yellow-200">
                      <div className="flex items-center">
                        <svg className="w-5 h-5 text-yellow-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <p className="text-sm text-yellow-800">
                          Some stock items are running low. Please review and refill as needed.
                        </p>
                      </div>
                    </div>
                  )}

                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Engineer</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                        <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                        <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Threshold</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Reported</th>
                        <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {allocations.map(a => {
                        const isLow = Number(a.quantity) <= Number(a.item_threshold || 0);
                        return (
                          <tr key={a.id || Math.random()} className={`hover:bg-gray-50 ${isLow ? 'bg-yellow-50' : ''}`}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <button
                                onClick={() => openEngineerModal(a.engineer_id || a.engineer_name)}
                                className="text-blue-600 hover:text-blue-800 font-medium"
                              >
                                {a.engineer_name || a.engineer_id}
                              </button>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{a.item_name || a.stock_item_id}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <span className={`px-2 py-1 text-sm rounded-full ${isLow ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
                                {a.quantity}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">{a.item_threshold}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {a.last_reported_at ? new Date(a.last_reported_at).toLocaleString() : '—'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              {isLow ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                  Low Stock
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  Healthy
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
              // Close modal or refresh related data if separate from internal modal state
              // CentralStock usually fetches on mount or specific signal, but here we can just close
              // The main page might not reflect immediately without a refresh since CentralStock components encapsulate their own fetching.
              // We could lift CentralState higher, but for now just close.
            }}
          />
        </main>
      </div>
    </div>
  );
}
