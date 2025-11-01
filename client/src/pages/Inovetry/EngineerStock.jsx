import React, { useEffect, useState } from 'react';
import axios from 'axios';

export default function EngineerStock({ engineerId }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  async function fetchItems() {
    setLoading(true);
    try {
      const res = await axios.get(`/api/stock/engineer/${engineerId}`);
      setItems(res.data || []);
    } catch (err) {
      console.error('Failed to load engineer stock', err);
      setItems([]);
    } finally { setLoading(false); }
  }

  useEffect(() => { if (engineerId) fetchItems(); }, [engineerId]);

  // optimistic update handler: if child reports a new quantity, update local items immediately
  function handleReported(itemId, reportedQty) {
  // compare ids as strings (avoid Number coercion which fails for UUIDs)
  setItems(prev => prev.map(it => (String(it.id) === String(itemId) ? { ...it, engineer_quantity: Number(reportedQty) } : it)));
    // also re-fetch in background to reconcile
    fetchItems();
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800">Engineer Stock Management</h2>
        <button 
          onClick={fetchItems}
          className="inline-flex items-center px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh Stock
        </button>
      </div>

      {/* Stock Items Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="inline-flex items-center space-x-2">
              <svg className="animate-spin h-5 w-5 text-blue-500" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
              </svg>
              <span className="text-gray-600">Loading stock items...</span>
            </div>
          </div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No items assigned</h3>
            <p className="mt-1 text-sm text-gray-500">This engineer has no items in their inventory.</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item Name</th>
                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {items.map(it => (
                <tr key={it.engineer_stock_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center">
                        <span className="text-blue-600 font-medium">{it.name[0].toUpperCase()}</span>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{it.name}</div>
                        <div className="text-sm text-gray-500">ID: {it.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className="px-2 py-1 text-sm rounded-full bg-blue-100 text-blue-800">
                      {it.engineer_quantity} units
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <ReportRemaining 
                      engineerId={engineerId} 
                      itemId={it.id} 
                      current={it.engineer_quantity} 
                      onReported={(newQty) => handleReported(it.id, newQty)} 
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function ReportRemaining({ engineerId, itemId, current = 0, onReported = () => {} }) {
  const [val, setVal] = useState(current);
  const [saving, setSaving] = useState(false);

  useEffect(() => setVal(current), [current]);

  async function handleReport() {
    setSaving(true);
    try {
      // try to include current user id as header for auditing
      let userId = null;
  try {
        const u = JSON.parse(localStorage.getItem('user'));
        if (u && u.id) userId = u.id;
      } catch (e) { /* ignore */ }
      if (!userId) userId = engineerId;
  await axios.put(`/api/stock/engineer/${engineerId}/item/${itemId}`, { quantity: Number(val), reportedBy: userId }, { headers: { 'X-User-Id': userId } });
  // optimistic UI: inform parent of new quantity
  onReported(Number(val));
  alert('Reported');
    } catch (err) {
      console.error(err);
      alert('Failed to report');
    } finally { setSaving(false); }
  }

  return (
    <div className="flex items-center justify-end space-x-2">
      <input 
        type="number"
        min="0"
        value={val}
        onChange={e => setVal(Number(e.target.value))}
        className="w-20 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      />
      <button
        onClick={handleReport}
        disabled={saving}
        className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
      >
        {saving ? (
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
          </svg>
        ) : (
          <>
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
            Report
          </>
        )}
      </button>
    </div>
  );
}
