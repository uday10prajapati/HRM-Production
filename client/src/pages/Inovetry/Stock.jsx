import React from 'react';
import Navbar from '../../components/Navbar';
import Sidebar from '../../components/Sidebar';
import CentralStock from './CentralStock';
import LowStockAlerts from './LowStockAlerts';
import EngineerStockModal from '../../components/EngineerStockModal';
import { useMemo } from 'react';
import { useEffect, useState } from 'react';
import axios from 'axios';

export default function Stock() {
  // admin view – show central stock, alerts, and overview of engineer stocks
  // for now engineerId can be selected later; using placeholder null to show both
  const engineerId = null;
  const [allocations, setAllocations] = useState([]);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [modalEngineer, setModalEngineer] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
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
  }, []);

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
    a.download = `allocations_${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="flex flex-col h-screen">
      <Navbar />
      <div className="flex flex-1 min-h-screen">
        <Sidebar />
        <main className="p-6 bg-gray-100 flex-1 overflow-auto">
          <h1 className="text-2xl font-semibold mb-4">Inventory & Stock Management</h1>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <CentralStock />
            </div>
            <div>
              <LowStockAlerts engineerId={engineerId} />
            </div>
          </div>

          {/* engineer-facing stock UI is shown on engineer dashboard only */}

          <div className="mt-6 bg-white rounded shadow p-4">
            <h2 className="text-lg font-semibold mb-3">Engineer Allocations & Reports</h2>
            <div className="mb-3 flex gap-2">
              <button onClick={exportCsv} className="px-3 py-1 bg-green-600 text-white rounded">Export CSV</button>
            </div>
            {overviewLoading ? <div>Loading...</div> : (
              allocations.length === 0 ? <div className="text-gray-500">No allocations</div> : (
                <div className="overflow-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-2 py-2 text-left">Engineer</th>
                        <th className="px-2 py-2 text-left">Item</th>
                        <th className="px-2 py-2">Qty</th>
                        <th className="px-2 py-2">Threshold</th>
                        <th className="px-2 py-2">Last Reported</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allocations.map(a => (
                        <tr key={a.id} className={`border-t ${Number(a.quantity) <= Number(a.item_threshold || 0) ? 'bg-yellow-50' : ''}`}>
                          <td className="px-2 py-2">
                            <button onClick={() => openEngineerModal(a.engineer_id || a.engineer_name)} className="text-blue-600 underline">{a.engineer_name || a.engineer_id}</button>
                          </td>
                          <td className="px-2 py-2">{a.item_name || a.stock_item_id}</td>
                          <td className="px-2 py-2 text-center">{a.quantity}</td>
                          <td className="px-2 py-2 text-center">{a.item_threshold}</td>
                          <td className="px-2 py-2">{a.last_reported_at ? new Date(a.last_reported_at).toLocaleString() : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>
          {/* Low engineers summary */}
          <div className="mt-4 text-sm text-gray-700">Engineers with low stock: <strong>{lowEngineersCount}</strong></div>
          <EngineerStockModal engineerId={modalEngineer} open={modalOpen} onClose={() => setModalOpen(false)} />
        </main>
      </div>
    </div>
  );
}
