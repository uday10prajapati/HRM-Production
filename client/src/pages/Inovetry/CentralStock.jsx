import React, { useEffect, useState } from 'react';
import axios from 'axios';
import EngineerStock from './EngineerStock';

export default function CentralStock() {
  const [items, setItems] = useState([]);
  const [productItems, setProductItems] = useState([]); // New state for product items
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ 
    productName: '', // Changed from productId to productName
    name: '', 
    description: '', 
    quantity: 0, 
    threshold: 5 
  });
  const [users, setUsers] = useState([]);
  const [assign, setAssign] = useState({ engineerId: '', stockItemId: '', quantity: 1 });

  // Fetch product items from database
  useEffect(() => {
    async function fetchProductItems() {
      try {
        const response = await axios.get('/api/stock/product-items');
        setProductItems(response.data || []);
      } catch (err) {
        console.error('Failed to load product items', err);
        setProductItems([]);
      }
    }
    fetchProductItems();
  }, []);

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
      const q = Number(form.quantity ?? 0);
      const th = Number(form.threshold ?? 0);
      if (Number.isNaN(q) || Number.isNaN(th) || q < 0 || th < 0) {
        return alert('Quantity and Threshold must be non-negative numbers');
      }
      if (th > q) {
        const ok = window.confirm('Threshold is greater than Quantity — this item is already low. Do you want to continue saving?');
        if (!ok) return;
      }

      await axios.post('/api/stock/items', form);
      setForm({ productName: '', name: '', description: '', quantity: 0, threshold: 5 });
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
        <div>
          <label className="block text-sm text-gray-700 mb-1">Product</label>
          <select 
            value={form.productName} 
            onChange={e => {
              setForm(f => ({
                ...f, 
                productName: e.target.value,
                name: e.target.value // Auto-fill name with selected product name
              }));
            }} 
            className="border p-2 w-full"
          >
            <option value="">Select Product</option>
            {productItems.map(product => (
              <option key={product['Product Name']} value={product['Product Name']}>
                {product['Product Name']}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-700 mb-1">Name</label>
          <input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="Name" className="border p-2 w-full" />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm text-gray-700 mb-1">Description</label>
          <input value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} placeholder="Description" className="border p-2 w-full" />
        </div>

        <div>
          <label className="block text-sm text-gray-700 mb-1">Quantity (current stock)</label>
          <input type="number" min="0" value={form.quantity} onChange={e => setForm(f => ({...f, quantity: Number(e.target.value)}))} placeholder="e.g. 12" className="border p-2 w-full" />
          <div className="text-xs text-gray-400 mt-1">Enter the available quantity in stock</div>
        </div>

        <div>
          <label className="block text-sm text-gray-700 mb-1">Threshold (reorder level)</label>
          <input type="number" min="0" value={form.threshold} onChange={e => setForm(f => ({...f, threshold: Number(e.target.value)}))} placeholder="e.g. 5" className="border p-2 w-full" />
          <div className="text-xs text-gray-400 mt-1">If quantity &le; threshold, the item is considered low</div>
        </div>

        <div className="col-span-2">
          <button type="submit" className="px-3 py-2 bg-blue-600 text-white rounded">Save Item</button>
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
            {items.map(it => <option key={it.id} value={it.id}>{it.name} — Qty: {it.quantity} | Th: {it.threshold}</option>)}
          </select>
          <input type="number" value={assign.quantity} onChange={e => setAssign(a => ({...a, quantity: Number(e.target.value)}))} className="border p-2" />
        </div>
          <div className="mt-2">
          <button onClick={async () => {
            if (!assign.engineerId || !assign.stockItemId) return alert('select engineer and item');
            try {
              // send IDs as-is (strings). Avoid coercing to Number() which breaks UUIDs.
              await axios.post('/api/stock/assign', { engineerId: assign.engineerId, stockItemId: assign.stockItemId, quantity: Number(assign.quantity) });
              alert('Assigned');
            } catch (err) { console.error(err); alert('Failed to assign'); }
          }} className="px-3 py-2 bg-green-600 text-white rounded">Assign</button>
        </div>
      </div>

      {/* Show selected engineer's stock */}
      {assign.engineerId ? (
        <div className="bg-white rounded shadow p-3 mt-4">
          <h3 className="font-medium mb-2">Engineer Allocations</h3>
          <EngineerStock engineerId={assign.engineerId} />
        </div>
      ) : null}

      <div className="bg-white rounded shadow p-3">
        <h3 className="font-medium mb-2">Items</h3>
        {loading ? <div>Loading...</div> : (
          <table className="min-w-full text-sm">
            <thead>
              <tr>
                <th className="text-left">SKU</th>
                <th className="text-left">Name</th>
                <th className="text-center">Quantity</th>
                <th className="text-center">Threshold</th>
              </tr>
            </thead>
            <tbody>
              {items.map(it => (
                <tr key={it.id} className="border-t">
                  <td className="py-2 px-2">{it.sku}</td>
                  <td className="py-2 px-2">{it.name}
                    <div className="text-xs text-gray-500">Qty: {it.quantity} • Th: {it.threshold}</div>
                  </td>
                  <td className="py-2 px-2 text-center">{it.quantity}</td>
                  <td className="py-2 px-2 text-center">{it.threshold}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

