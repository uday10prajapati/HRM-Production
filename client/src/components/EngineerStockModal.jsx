import React, { useEffect, useState } from 'react';
import axios from 'axios';

export default function EngineerStockModal({ engineerId, open, onClose }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !engineerId) return;
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const res = await axios.get(`/api/stock/engineer/${engineerId}`);
        if (!mounted) return;
        setItems(res.data || []);
      } catch (err) {
        console.error('Failed to load engineer stock for modal', err);
        if (mounted) setItems([]);
      } finally { if (mounted) setLoading(false); }
    }
    load();
    return () => { mounted = false; };
  }, [open, engineerId]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center">
      <div className="absolute inset-0 bg-black opacity-40" onClick={onClose}></div>
      <div className="relative bg-white rounded shadow-lg w-11/12 md:w-2/3 lg:w-1/2 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Engineer Stock — {engineerId}</h3>
          <button onClick={onClose} className="px-2 py-1 bg-gray-200 rounded">Close</button>
        </div>
        {loading ? <div>Loading...</div> : (
          items.length === 0 ? <div className="text-gray-500">No items assigned</div> : (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50"><th className="px-2 py-1 text-left">Item</th><th className="px-2 py-1">Qty</th><th className="px-2 py-1">Threshold</th></tr>
              </thead>
              <tbody>
                {items.map(it => (
                  <tr key={it.engineer_stock_id} className="border-t">
                    <td className="px-2 py-1">{it.name}</td>
                    <td className="px-2 py-1 text-center">{it.engineer_quantity}</td>
                    <td className="px-2 py-1 text-center">{it.threshold}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
      </div>
    </div>
  );
}
