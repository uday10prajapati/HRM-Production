import React, { useEffect, useState } from 'react';
import axios from 'axios';

export default function EngineerStockModal({ engineerId, open, onClose }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    if (!open || !engineerId) return;
    let mounted = true;
    async function load() {
      setLoading(true);
      setMessage({ type: '', text: '' });
      try {
        const res = await axios.get(`/api/stock/engineer/${engineerId}`);
        if (!mounted) return;
        setItems(res.data || []);
      } catch (err) {
        console.error('Failed to load engineer stock for modal', err);
        if (mounted) setItems([]);
        if (mounted) setMessage({ type: 'error', text: 'Failed to load engineer stock' });
      } finally { if (mounted) setLoading(false); }
    }
    load();
    return () => { mounted = false; };
  }, [open, engineerId]);

  const handleDelete = async (stockItemId) => {
    if (!window.confirm('Are you sure you want to remove this stock allocation? The quantity will be returned to central stock.')) {
      return;
    }

    setDeleting(stockItemId);
    try {
      const response = await axios.delete(`/api/stock/engineer/${engineerId}/item/${stockItemId}`);
      setMessage({ type: 'success', text: response.data.message });
      
      // Refresh the list after successful deletion
      const res = await axios.get(`/api/stock/engineer/${engineerId}`);
      setItems(res.data || []);
    } catch (err) {
      console.error('Failed to delete engineer stock:', err);
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to delete stock allocation' });
    } finally {
      setDeleting(null);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 overflow-y-auto">
      <div className="absolute inset-0 bg-black opacity-40 z-40" onClick={onClose}></div>
      <div className="relative z-50 bg-white rounded shadow-lg w-11/12 md:w-2/3 lg:w-1/2 p-4 max-h-[80vh] flex flex-col my-8">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Engineer Stock — {engineerId}</h3>
          <button onClick={onClose} className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300">Close</button>
        </div>

        {message.text && (
          <div className={`p-2 rounded mb-3 text-sm ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {message.text}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="text-gray-500">Loading...</div>
          </div>
        ) : (
          <div className="overflow-y-auto flex-1">
            {items.length === 0 ? (
              <div className="text-gray-500 py-8 text-center">No items assigned</div>
            ) : (
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-gray-100">
                  <tr className="bg-gray-50 border-b">
                    <th className="px-3 py-2 text-left font-semibold">Item</th>
                    <th className="px-3 py-2 text-center font-semibold">Qty</th>
                    <th className="px-3 py-2 text-center font-semibold">Threshold</th>
                    <th className="px-3 py-2 text-center font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(it => (
                    <tr key={it.engineer_stock_id} className="border-t hover:bg-gray-50">
                      <td className="px-3 py-2">{it.name}</td>
                      <td className="px-3 py-2 text-center">{it.engineer_quantity}</td>
                      <td className="px-3 py-2 text-center">{it.threshold}</td>
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={() => handleDelete(it.stock_item_id)}
                          disabled={deleting === it.stock_item_id}
                          className="px-3 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
                        >
                          {deleting === it.stock_item_id ? 'Deleting...' : 'Delete'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
