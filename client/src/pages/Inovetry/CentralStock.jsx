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
    threshold: 5,
    engineerId: '',
    assignQuantity: 0
  });
  const [users, setUsers] = useState([]);
  const [submitMessage, setSubmitMessage] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    quantity: 0,
    threshold: 5
  });

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

      // Engineer assignment is mandatory
      if (!form.engineerId) {
        return alert('Please select an engineer to assign stock to');
      }
      const assignQty = Number(form.assignQuantity ?? 0);
      if (Number.isNaN(assignQty) || assignQty < 0 || assignQty === 0) {
        return alert('Assign Quantity must be a positive number');
      }

      // Use combined endpoint - engineer assignment is mandatory
      await axios.post('/api/stock/items-with-assign', {
        name: form.name,
        description: form.description,
        quantity: q,
        threshold: th,
        engineerId: form.engineerId,
        assignQuantity: assignQty
      });
      
      setSubmitMessage(`✓ Stock item created and assigned to engineer!`);

      // Reset form
      setForm({ 
        productName: '', 
        name: '', 
        description: '', 
        quantity: 0, 
        threshold: 5,
        engineerId: '',
        assignQuantity: 0
      });
      
      // Clear message and reload items
      setTimeout(() => setSubmitMessage(''), 3000);
      await fetchItems();
    } catch (err) {
      console.error(err);
      setSubmitMessage(`✗ Error: ${err.response?.data?.error || 'Failed to save'}`);
    }
  }

  async function handleEdit(item) {
    setEditingId(item.id);
    setEditForm({
      name: item.name,
      description: item.description,
      quantity: item.quantity,
      threshold: item.threshold
    });
  }

  async function handleSaveEdit() {
    try {
      const q = Number(editForm.quantity ?? 0);
      const th = Number(editForm.threshold ?? 0);
      if (Number.isNaN(q) || Number.isNaN(th) || q < 0 || th < 0) {
        return alert('Quantity and Threshold must be non-negative numbers');
      }
      
      await axios.put(`/api/stock/items/${editingId}`, {
        name: editForm.name,
        description: editForm.description,
        quantity: q,
        threshold: th
      });
      
      setSubmitMessage('✓ Stock item updated successfully');
      setTimeout(() => setSubmitMessage(''), 3000);
      setEditingId(null);
      await fetchItems();
    } catch (err) {
      console.error(err);
      alert(`Failed to update: ${err.response?.data?.error || 'Unknown error'}`);
    }
  }

  async function handleDelete(itemId) {
    if (window.confirm('Are you sure you want to delete this stock item? This action cannot be undone.')) {
      try {
        await axios.delete(`/api/stock/items/${itemId}`);
        setSubmitMessage('✓ Stock item deleted successfully');
        setTimeout(() => setSubmitMessage(''), 3000);
        await fetchItems();
      } catch (err) {
        console.error(err);
        alert(`Failed to delete: ${err.response?.data?.error || 'Unknown error'}`);
      }
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

            {/* Engineer Assignment Section - Mandatory */}
            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h3 className="text-sm font-semibold text-gray-800 mb-4">Assign to Engineer (Required)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Engineer <span className="text-red-500">*</span></label>
                  <select 
                    value={form.engineerId}
                    onChange={e => setForm(f => ({...f, engineerId: e.target.value}))}
                    className="w-full rounded-lg border border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 px-3 py-2"
                    required
                  >
                    <option value="">Choose engineer</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Quantity to Assign <span className="text-red-500">*</span></label>
                  <input 
                    type="number"
                    min="1"
                    value={form.assignQuantity}
                    onChange={e => setForm(f => ({...f, assignQuantity: Number(e.target.value)}))}
                    className="w-full rounded-lg border border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 px-3 py-2"
                    placeholder="Enter quantity for engineer"
                    required
                  />
                  <p className="mt-1 text-xs text-gray-500">Will be deducted from central stock</p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button 
                type="submit"
                className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Add Item
              </button>
              {submitMessage && (
                <div className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium ${
                  submitMessage.startsWith('✓') 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {submitMessage}
                </div>
              )}
            </div>
          </form>
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
                    <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
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
                      <td className="px-6 py-4 text-center">
                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={() => handleEdit(it)}
                            className="inline-flex items-center px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded transition-colors"
                          >
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(it.id)}
                            className="inline-flex items-center px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-xs rounded transition-colors"
                          >
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Edit Modal */}
        {editingId && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Edit Stock Item</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                  <input 
                    type="text"
                    value={editForm.name}
                    onChange={e => setEditForm(f => ({...f, name: e.target.value}))}
                    className="w-full rounded-lg border border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 px-3 py-2"
                    placeholder="Item name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <input 
                    type="text"
                    value={editForm.description}
                    onChange={e => setEditForm(f => ({...f, description: e.target.value}))}
                    className="w-full rounded-lg border border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 px-3 py-2"
                    placeholder="Item description"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Quantity</label>
                  <input 
                    type="number"
                    min="0"
                    value={editForm.quantity}
                    onChange={e => setEditForm(f => ({...f, quantity: Number(e.target.value)}))}
                    className="w-full rounded-lg border border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 px-3 py-2"
                    placeholder="Quantity"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Threshold</label>
                  <input 
                    type="number"
                    min="0"
                    value={editForm.threshold}
                    onChange={e => setEditForm(f => ({...f, threshold: Number(e.target.value)}))}
                    className="w-full rounded-lg border border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 px-3 py-2"
                    placeholder="Threshold"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setEditingId(null)}
                  className="flex-1 px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

