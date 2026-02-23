import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function ManageStockModal({ isOpen, onClose }) {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [newItemName, setNewItemName] = useState('');
    const [isAdding, setIsAdding] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchProducts();
            setIsAdding(false);
            setNewItemName('');
        }
    }, [isOpen]);

    async function fetchProducts() {
        setLoading(true);
        try {
            const res = await axios.get('/api/stock/product-items');
            // product-items returns list of objects with "Product Name"
            const list = res.data.map(p => p["Product Name"]).filter(Boolean);
            setProducts(list);
        } catch (err) {
            console.error('Failed to load product names', err);
        } finally {
            setLoading(false);
        }
    }

    async function handleAdd(e) {
        e.preventDefault();
        if (!newItemName.trim()) return;
        try {
            await axios.post('/api/stock/product-items', { name: newItemName.trim() });
            setNewItemName('');
            setIsAdding(false);
            fetchProducts();
        } catch (err) {
            console.error('Failed to add product name', err);
            alert('Failed to add new asset identity.');
        }
    }

    async function handleDelete(name) {
        if (!window.confirm(`Are you sure you want to permanently delete "${name}" from the systemic list?`)) return;
        try {
            // Need to pass the name properly. encodeURIComponent helps if there are spaces.
            await axios.delete(`/api/stock/product-items/${encodeURIComponent(name)}`);
            fetchProducts();
        } catch (err) {
            console.error('Failed to delete product item', err);
            alert('Failed to delete asset identity.');
        }
    }

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm overflow-y-auto p-4 sm:p-6 animate-[fadeIn_0.2s_ease-out]">
            <div className="bg-white rounded-3xl shadow-[0_8px_32px_-8px_rgba(0,0,0,0.15)] w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden border border-slate-100 animate-[slideIn_0.2s_ease-out_forwards]">

                {/* Header */}
                <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center relative">
                    <div className="absolute inset-x-0 top-0 h-full bg-gradient-to-b from-indigo-50/50 to-transparent pointer-events-none" />
                    <div className="flex items-center gap-3 relative z-10">
                        <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                            <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Systemic Asset Dictionary</h2>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-0.5">Global Nomenclature Catalog</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors relative z-10">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-50/20 custom-scrollbar">
                    {isAdding ? (
                        <div className="bg-white p-6 rounded-2xl border border-indigo-100 shadow-lg shadow-indigo-100/50">
                            <div className="flex justify-between items-center mb-6 border-b border-slate-50 pb-4">
                                <h3 className="text-lg font-bold text-slate-800">Register New Identity</h3>
                                <button onClick={() => setIsAdding(false)} className="text-xs font-bold text-slate-400 hover:text-indigo-600 transition-colors uppercase tracking-widest">
                                    &larr; Cancel Provision
                                </button>
                            </div>

                            <form onSubmit={handleAdd} className="space-y-6">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Asset Identity (Name)</label>
                                    <input
                                        type="text"
                                        autoFocus
                                        value={newItemName}
                                        onChange={e => setNewItemName(e.target.value)}
                                        placeholder="e.g. Ethernet Cable 10m"
                                        className="w-full rounded-xl border-slate-200 shadow-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 placeholder-slate-300 font-medium text-slate-900 transition-all px-4 py-3"
                                        required
                                    />
                                </div>
                                <div className="flex justify-end gap-3 pt-2">
                                    <button type="button" onClick={() => setIsAdding(false)} className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition-colors">
                                        Abort
                                    </button>
                                    <button type="submit" className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-md shadow-indigo-500/20 hover:shadow-lg hover:shadow-indigo-500/40 hover:-translate-y-0.5">
                                        Commit Identity
                                    </button>
                                </div>
                            </form>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest bg-white px-3 py-1 rounded-full border border-slate-200 shadow-sm">
                                    Total Registered: <span className="text-indigo-600 ml-1">{products.length}</span>
                                </span>
                                <button onClick={() => setIsAdding(true)} className="px-5 py-2.5 bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-500 hover:text-white font-bold rounded-xl transition-all shadow-sm shadow-emerald-500/10 flex items-center gap-2 group">
                                    <svg className="w-5 h-5 transition-transform group-hover:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
                                    Register Stock
                                </button>
                            </div>

                            {loading ? (
                                <div className="p-16 text-center flex flex-col items-center justify-center">
                                    <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mb-4">
                                        <svg className="animate-spin h-8 w-8 text-indigo-500" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                    </div>
                                    <span className="text-sm font-bold text-slate-500 uppercase tracking-widest">Scanning Dictionary...</span>
                                </div>
                            ) : (
                                <div className="bg-white border text-left border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead className="bg-slate-50/50 border-b border-slate-100">
                                                <tr>
                                                    <th className="px-6 py-4 text-xs font-bold text-slate-400 text-left uppercase tracking-wider">Asset Identity Structure</th>
                                                    <th className="px-6 py-4 text-right text-xs font-bold text-slate-400 uppercase tracking-wider">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {products.length === 0 ? (
                                                    <tr>
                                                        <td colSpan="2" className="px-6 py-12 text-center">
                                                            <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3 border border-slate-200">
                                                                <svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4" /></svg>
                                                            </div>
                                                            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Dictionary is empty</p>
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    products.map((item, idx) => (
                                                        <tr key={idx} className="hover:bg-indigo-50/30 transition-colors group">
                                                            <td className="px-6 py-4 whitespace-nowrap">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
                                                                        {idx + 1}
                                                                    </div>
                                                                    <span className="text-sm font-bold text-slate-800">{item}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                                                <button
                                                                    onClick={() => handleDelete(item)}
                                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-500 hover:text-white text-xs font-bold rounded-lg transition-all shadow-sm"
                                                                >
                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                                    Delete
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
