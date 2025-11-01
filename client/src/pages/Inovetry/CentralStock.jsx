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
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Central Stock Management</h1>
          <p className="mt-2 text-gray-600">Manage and track inventory items across the organization</p>
        </div>

        {/* Add New Item Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-8">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800">Add New Stock Item</h2>
          </div>
          <form onSubmit={handleSubmit} className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Product</label>
                <select 
                  value={form.productName}
                  onChange={e => {
                    setForm(f => ({
                      ...f,
                      productName: e.target.value,
                      name: e.target.value
                    }));
                  }}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500"
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
                <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                <input 
                  value={form.name}
                  onChange={e => setForm(f => ({...f, name: e.target.value}))}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter item name"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <input 
                  value={form.description}
                  onChange={e => setForm(f => ({...f, description: e.target.value}))}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter item description"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Quantity</label>
                <input 
                  type="number"
                  min="0"
                  value={form.quantity}
                  onChange={e => setForm(f => ({...f, quantity: Number(e.target.value)}))}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter quantity"
                />
                <p className="mt-1 text-sm text-gray-500">Current stock level</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Threshold</label>
                <input 
                  type="number"
                  min="0"
                  value={form.threshold}
                  onChange={e => setForm(f => ({...f, threshold: Number(e.target.value)}))}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter threshold"
                />
                <p className="mt-1 text-sm text-gray-500">Minimum stock level before reorder</p>
              </div>
            </div>

            <div className="mt-6">
              <button 
                type="submit"
                className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Add Item
              </button>
            </div>
          </form>
        </div>

        {/* Engineer Assignment Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-8">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800">Assign to Engineer</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Engineer</label>
                <select 
                  value={assign.engineerId}
                  onChange={e => setAssign(a => ({...a, engineerId: e.target.value}))}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Choose engineer</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Item</label>
                <select 
                  value={assign.stockItemId}
                  onChange={e => setAssign(a => ({...a, stockItemId: e.target.value}))}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Choose item</option>
                  {items.map(it => (
                    <option key={it.id} value={it.id}>
                      {it.name} (Stock: {it.quantity})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Quantity</label>
                <input 
                  type="number"
                  min="1"
                  value={assign.quantity}
                  onChange={e => setAssign(a => ({...a, quantity: Number(e.target.value)}))}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="mt-6">
              <button
                onClick={async () => {
                  if (!assign.engineerId || !assign.stockItemId) return alert('Please select both engineer and item');
                  try {
                    await axios.post('/api/stock/assign', {
                      engineerId: assign.engineerId,
                      stockItemId: assign.stockItemId,
                      quantity: Number(assign.quantity)
                    });
                    alert('Successfully assigned');
                  } catch (err) {
                    console.error(err);
                    alert('Failed to assign');
                  }
                }}
                className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                Assign Stock
              </button>
            </div>
          </div>
        </div>

        {/* Stock Items Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800">Current Stock Items</h2>
          </div>
          
          {loading ? (
            <div className="p-8 text-center">
              <div className="inline-flex items-center">
                <svg className="animate-spin h-5 w-5 text-blue-500 mr-3" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
                <span className="text-gray-600">Loading stock items...</span>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item Details</th>
                    <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Current Stock</th>
                    <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {items.map(it => (
                    <tr key={it.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{it.name}</div>
                        <div className="text-sm text-gray-500">{it.description}</div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-sm font-medium text-gray-900">{it.quantity}</span>
                        <div className="text-xs text-gray-500">Threshold: {it.threshold}</div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                          ${it.quantity <= it.threshold 
                            ? 'bg-red-100 text-red-800' 
                            : 'bg-green-100 text-green-800'}`}>
                          {it.quantity <= it.threshold ? 'Low Stock' : 'In Stock'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Engineer Stock View */}
        {assign.engineerId && (
          <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-800">Engineer's Current Stock</h2>
            </div>
            <div className="p-6">
              <EngineerStock engineerId={assign.engineerId} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

