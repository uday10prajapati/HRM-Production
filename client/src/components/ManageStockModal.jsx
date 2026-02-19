import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function ManageStockModal({ isOpen, onClose, onUpdated }) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [editItem, setEditItem] = useState(null);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        quantity: 0,
        threshold: 5,
        dairy_name: '',
        notes: '',
        use_item: 0
    });

    // Product List (names) for dropdown
    const [products, setProducts] = useState([]);

    useEffect(() => {
        if (isOpen) {
            fetchItems();
            fetchProducts();
            setIsAdding(false);
            setEditItem(null);
            resetForm();
        }
    }, [isOpen]);

    async function fetchItems() {
        setLoading(true);
        try {
            const res = await axios.get('/api/stock/items');
            setItems(res.data || []);
        } catch (err) {
            console.error('Failed to load items', err);
        } finally {
            setLoading(false);
        }
    }

    async function fetchProducts() {
        try {
            const res = await axios.get('/api/stock/product-items');
            // product-items returns list of objects with "Product Name"
            const list = res.data.map(p => p["Product Name"]).filter(Boolean);
            setProducts(list);
        } catch (err) {
            console.error('Failed to load product names', err);
        }
    }

    function resetForm() {
        setFormData({
            name: '',
            description: '',
            quantity: 0,
            threshold: 5,
            dairy_name: '',
            notes: '',
            use_item: 0
        });
    }

    function startAdd() {
        setIsAdding(true);
        setEditItem(null);
        resetForm();
    }

    function startEdit(item) {
        setIsAdding(true);
        setEditItem(item);
        setFormData({
            name: item.name || '',
            description: item.description || '',
            quantity: item.quantity || 0,
            threshold: item.threshold || 5,
            dairy_name: item.dairy_name || '',
            notes: item.notes || '',
            use_item: item.use_item || 0
        });
    }

    async function handleSubmit(e) {
        e.preventDefault();
        try {
            if (editItem) {
                await axios.put(`/api/stock/items/${editItem.id}`, formData);
                alert('Item updated successfully');
            } else {
                await axios.post('/api/stock/items', formData);
                alert('Item created successfully');
            }
            setIsAdding(false);
            fetchItems();
            if (onUpdated) onUpdated();
        } catch (err) {
            console.error('Failed to save item', err);
            alert('Failed to save item');
        }
    }

    async function handleDelete(id) {
        if (!window.confirm('Are you sure you want to delete this item?')) return;
        try {
            await axios.delete(`/api/stock/items/${id}`);
            fetchItems();
            if (onUpdated) onUpdated();
        } catch (err) {
            console.error('Failed to delete item', err);
            alert('Failed to delete item');
        }
    }

    async function handleAddProductName() {
        const newName = prompt("Enter new Product Name:");
        if (!newName) return;
        try {
            await axios.post('/api/stock/product-items', { name: newName });
            fetchProducts();
            setFormData({ ...formData, name: newName });
        } catch (e) {
            alert('Failed to add product name');
        }
    }

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 bg-opacity-50 overflow-y-auto">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl m-4 flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
                    <h2 className="text-xl font-bold text-gray-800">Manage Stock Items</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">

                    {isAdding ? (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-semibold text-gray-700">{editItem ? 'Edit Item' : 'Add New Item'}</h3>
                                <button onClick={() => setIsAdding(false)} className="text-sm text-blue-600 hover:text-blue-800">
                                    &larr; Back to List
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="col-span-2 md:col-span-1">
                                    <label className="block text-sm font-medium text-gray-700">Name</label>
                                    <div className="flex space-x-2">
                                        <select
                                            value={formData.name}
                                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2"
                                            required
                                        >
                                            <option value="">Select Product...</option>
                                            {products.map((p, i) => <option key={i} value={p}>{p}</option>)}
                                        </select>
                                        <button type="button" onClick={handleAddProductName} className="mt-1 px-3 py-2 bg-gray-200 rounded text-gray-700 hover:bg-gray-300">+</button>
                                    </div>
                                    {/* Fallback text input if needed, or if user wants custom name not in list? user said 'can add a stock name'. assuming list management. */}
                                </div>

                                <div className="col-span-2 md:col-span-1">
                                    <label className="block text-sm font-medium text-gray-700">Dairy Name (Optional)</label>
                                    <input type="text" value={formData.dairy_name} onChange={e => setFormData({ ...formData, dairy_name: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2" />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Quantity</label>
                                    <input type="number" value={formData.quantity} onChange={e => setFormData({ ...formData, quantity: Number(e.target.value) })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2" required />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Threshold (Low Stock Alert)</label>
                                    <input type="number" value={formData.threshold} onChange={e => setFormData({ ...formData, threshold: Number(e.target.value) })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2" required />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Use Item (Consumption Rate?)</label>
                                    <input type="number" step="0.01" value={formData.use_item} onChange={e => setFormData({ ...formData, use_item: Number(e.target.value) })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2" />
                                </div>

                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-700">Description</label>
                                    <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2" rows="2"></textarea>
                                </div>

                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-700">Notes</label>
                                    <textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2" rows="2"></textarea>
                                </div>

                                <div className="col-span-2 flex justify-end space-x-3 pt-4 border-t">
                                    <button type="button" onClick={() => setIsAdding(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200">Cancel</button>
                                    <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Save Item</button>
                                </div>
                            </form>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center mb-4">
                                <p className="text-sm text-gray-600">Current Stock Items: {items.length}</p>
                                <button onClick={startAdd} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center">
                                    <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                                    New Item
                                </button>
                            </div>

                            {loading ? (
                                <div className="text-center py-8">Loading...</div>
                            ) : (
                                <div className="overflow-x-auto border rounded-lg">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Threshold</th>
                                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {items.map(item => (
                                                <tr key={item.id} className="hover:bg-gray-50">
                                                    <td className="px-4 py-3 text-sm text-gray-900 font-medium">{item.name}</td>
                                                    <td className="px-4 py-3 text-sm text-gray-900">{item.quantity}</td>
                                                    <td className="px-4 py-3 text-sm text-gray-500">{item.threshold}</td>
                                                    <td className="px-4 py-3 text-right text-sm font-medium space-x-2">
                                                        <button onClick={() => startEdit(item)} className="text-blue-600 hover:text-blue-900">Edit</button>
                                                        <button onClick={() => handleDelete(item.id)} className="text-red-600 hover:text-red-900">Delete</button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {items.length === 0 && (
                                                <tr><td colSpan="4" className="px-4 py-8 text-center text-gray-500">No items found.</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
