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
    <div>
      <h2 className="text-lg font-semibold mb-4">Engineer Stock</h2>
      <div className="bg-white rounded shadow p-3">
        {loading ? <div>Loading...</div> : (
          items.length === 0 ? <div className="text-gray-500">No items assigned</div> : (
            <table className="min-w-full text-sm">
              <thead><tr><th className="text-left">Name</th><th>Qty</th></tr></thead>
              <tbody>
                {items.map(it => (
                  <tr key={it.engineer_stock_id} className="border-t">
                    <td className="py-2 px-2">{it.name}</td>
                    <td className="py-2 px-2">{it.engineer_quantity}</td>
                    <td className="py-2 px-2">
                      <ReportRemaining engineerId={engineerId} itemId={it.id} current={it.engineer_quantity} onReported={(newQty) => handleReported(it.id, newQty)} />
                    </td>
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

function ReportRemaining({ engineerId, itemId, current = 0, onReported = () => {} }) {
  const [val, setVal] = React.useState(current);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => setVal(current), [current]);

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
    <div className="flex items-center gap-2">
      <input type="number" value={val} onChange={e => setVal(Number(e.target.value))} className="border p-1 w-20" />
      <button onClick={handleReport} disabled={saving} className="px-2 py-1 bg-blue-600 text-white rounded">{saving ? '...' : 'Report'}</button>
    </div>
  );
}
