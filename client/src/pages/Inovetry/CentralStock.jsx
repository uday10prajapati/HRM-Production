import React, { useEffect, useState } from 'react';
import axios from 'axios';

export default function CentralStock() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ sku: '', name: '', description: '', quantity: 0, threshold: 5 });
  const [users, setUsers] = useState([]);
  const [assign, setAssign] = useState({ engineerId: '', stockItemId: '', quantity: 1 });

  async function fetchItems() {
    setLoading(true);
    try {
      const res = await axios.get('/api/stock/items');
      setItems(res.data || []);
    } catch (err) {
      console.error('Failed to load stock items', err);
      setItems([]);
    } finally { setLoading(false); }
  }

  useEffect(() => { fetchItems(); }, []);

  useEffect(() => { // fetch users for assignment
    (async () => {
      try {
        const r = await axios.get('/api/users');
        const u = r.data?.users || r.data || [];
        setUsers(u.filter(x => (x.role || '').toLowerCase() === 'engineer'));
      } catch (e) { setUsers([]); }
    })();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      await axios.post('/api/stock/items', form);
      setForm({ sku: '', name: '', description: '', quantity: 0, threshold: 5 });
      await fetchItems();
      alert('Saved');
    } catch (err) {
      console.error(err);
      alert('Failed to save');
    }
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Central Stock</h2>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <input value={form.sku} onChange={e => setForm(f => ({...f, sku: e.target.value}))} placeholder="SKU" className="border p-2" />
        <input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="Name" className="border p-2" />
        <input value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} placeholder="Description" className="border p-2" />
        <input type="number" value={form.quantity} onChange={e => setForm(f => ({...f, quantity: Number(e.target.value)}))} placeholder="Quantity" className="border p-2" />
        <input type="number" value={form.threshold} onChange={e => setForm(f => ({...f, threshold: Number(e.target.value)}))} placeholder="Threshold" className="border p-2" />
        <div className="col-span-2">
          <button className="px-3 py-2 bg-blue-600 text-white rounded">Save Item</button>
        </div>
      </form>

      <div className="bg-white rounded shadow p-3 mt-4">
        <h3 className="font-medium mb-2">Assign to Engineer</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <select value={assign.engineerId} onChange={e => setAssign(a => ({...a, engineerId: e.target.value}))} className="border p-2">
            <option value="">Select engineer</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.id})</option>)}
          </select>
          <select value={assign.stockItemId} onChange={e => setAssign(a => ({...a, stockItemId: e.target.value}))} className="border p-2">
            <option value="">Select item</option>
            {items.map(it => <option key={it.id} value={it.id}>{it.name} ({it.quantity})</option>)}
          </select>
          <input type="number" value={assign.quantity} onChange={e => setAssign(a => ({...a, quantity: Number(e.target.value)}))} className="border p-2" />
        </div>
        <div className="mt-2">
          <button onClick={async () => {
            if (!assign.engineerId || !assign.stockItemId) return alert('select engineer and item');
            try {
              await axios.post('/api/stock/assign', { engineerId: Number(assign.engineerId), stockItemId: Number(assign.stockItemId), quantity: Number(assign.quantity) });
              alert('Assigned');
            } catch (err) { console.error(err); alert('Failed to assign'); }
          }} className="px-3 py-2 bg-green-600 text-white rounded">Assign</button>
        </div>
      </div>

      <div className="bg-white rounded shadow p-3">
        <h3 className="font-medium mb-2">Items</h3>
        {loading ? <div>Loading...</div> : (
          <table className="min-w-full text-sm">
            <thead><tr><th className="text-left">SKU</th><th className="text-left">Name</th><th>Qty</th><th>Thresh</th></tr></thead>
            <tbody>
              {items.map(it => (
                <tr key={it.id} className="border-t"><td className="py-2 px-2">{it.sku}</td><td className="py-2 px-2">{it.name}</td><td className="py-2 px-2">{it.quantity}</td><td className="py-2 px-2">{it.threshold}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

