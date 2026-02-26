import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const EStock = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [stocks, setStocks] = useState([]);
    const [loading, setLoading] = useState(true);

    // Wastage modal state
    const [showWastageForm, setShowWastageForm] = useState(false);
    const [selectedStock, setSelectedStock] = useState(null);
    const [wastageForm, setWastageForm] = useState({ quantity: '', reason: '' });
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        const storedUser = localStorage.getItem("user");
        if (storedUser) {
            const parsedUser = JSON.parse(storedUser);
            setUser(parsedUser);
            fetchStocks(parsedUser.id);
        } else {
            navigate('/');
        }
    }, [navigate]);

    const fetchStocks = async (engineerId) => {
        try {
            setLoading(true);
            const { data } = await axios.get(`/api/stock/engineer/${engineerId}`);
            setStocks(data);
        } catch (err) {
            console.error('Failed to fetch stock:', err);
            toast.error('Failed to load your stock inventory.');
        } finally {
            setLoading(false);
        }
    };

    const openWastageModal = (stock) => {
        setSelectedStock(stock);
        setWastageForm({ quantity: '', reason: '' });
        setShowWastageForm(true);
    };

    const handleReportWastage = async () => {
        const qty = parseInt(wastageForm.quantity, 10);
        if (!qty || qty <= 0) {
            toast.error("Please enter a valid quantity.");
            return;
        }
        if (qty > selectedStock.engineer_quantity) {
            toast.error("Wastage quantity cannot exceed your assigned inventory.");
            return;
        }
        if (!wastageForm.reason.trim()) {
            toast.error("Please provide a reason for the wastage.");
            return;
        }

        try {
            setSubmitting(true);
            const payload = {
                engineerId: user.id,
                stockItemId: selectedStock.id,
                quantity: qty,
                reason: wastageForm.reason.trim()
            };
            await axios.post('/api/stock/wastage', payload);

            toast.success("Wastage report submitted to Admin successfully!");
            setShowWastageForm(false);
            setWastageForm({ quantity: '', reason: '' });
            setSelectedStock(null);
            fetchStocks(user.id); // Refresh inventory
        } catch (err) {
            console.error(err);
            toast.error(err?.response?.data?.error || 'Failed to submit wastage report.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#f4f7fa] flex flex-col font-sans pb-6">
            <ToastContainer position="top-center" limit={2} />

            {/* Header */}
            <div className="bg-white px-5 py-4 flex items-center shadow-sm sticky top-0 z-10">
                <button
                    onClick={() => navigate(-1)}
                    className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors mr-3"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6 text-gray-800">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                    </svg>
                </button>
                <div>
                    <h1 className="text-xl font-bold text-gray-900 tracking-tight">My Inventory & Stock</h1>
                    <p className="text-xs font-semibold text-gray-400">Manage assigned tools and materials</p>
                </div>
            </div>

            {/* Content */}
            <div className="p-4 sm:p-5 flex-1 max-w-lg w-full mx-auto">
                <div className="flex items-center justify-between mb-5">
                    <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest">Assigned Items</h2>
                    <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                        {stocks.length} Items
                    </span>
                </div>

                {loading ? (
                    <div className="flex justify-center items-center py-20">
                        <div className="animate-spin text-blue-500">
                            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        </div>
                    </div>
                ) : stocks.length === 0 ? (
                    <div className="bg-white rounded-3xl p-8 text-center shadow-sm border border-gray-100">
                        <div className="w-16 h-16 bg-blue-50 text-blue-400 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-bold text-gray-700 mb-1">No Stock Assigned</h3>
                        <p className="text-sm text-gray-400 font-medium">You currently have no tools or materials actively assigned to you.</p>
                    </div>
                ) : (
                    <div className="grid gap-4 custom-scrollbar">
                        {stocks.map(stock => (
                            <div key={stock.engineer_stock_id} className="bg-white rounded-2xl p-5 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] border border-gray-100 flex flex-col relative overflow-hidden">
                                {/* Border Left Accent */}
                                <div className={`absolute top-0 left-0 bottom-0 w-1.5 ${stock.engineer_quantity > 0 ? 'bg-blue-500' : 'bg-red-400'}`}></div>

                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <h3 className="text-lg font-extrabold text-gray-800">{stock.name}</h3>
                                        {stock.dairy_name && (
                                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">{stock.dairy_name}</p>
                                        )}
                                    </div>
                                    <div className="text-right">
                                        <div className="text-3xl font-black text-blue-600 tracking-tight leading-none">
                                            {stock.engineer_quantity}
                                        </div>
                                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-1">
                                            Qty Assigned
                                        </div>
                                    </div>
                                </div>

                                {stock.description && (
                                    <p className="text-sm text-slate-500 italic mb-4 line-clamp-2">"{stock.description}"</p>
                                )}

                                <div className="mt-auto pt-4 border-t border-gray-100 flex justify-end">
                                    <button
                                        onClick={() => openWastageModal(stock)}
                                        disabled={stock.engineer_quantity === 0}
                                        className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors flex items-center gap-2 ${stock.engineer_quantity === 0
                                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                : 'bg-rose-50 text-rose-600 hover:bg-rose-100'
                                            }`}
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                                        Report Wastage
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Wastage Report Modal */}
            {showWastageForm && selectedStock && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-center px-4 overflow-hidden animate-[fadeIn_0.2s_ease-out]">
                    <div className="bg-white max-w-sm w-full rounded-[2rem] p-6 shadow-2xl relative">
                        <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mb-4 absolute -top-5 -right-2 border-4 border-[#f4f7fa] shadow-sm">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                        </div>

                        <h3 className="text-xl font-extrabold text-gray-800 mb-1">Report Wastage</h3>
                        <p className="text-xs font-semibold text-gray-400 mb-6">Damaged, missing, or wasted inventory for: <span className="text-blue-600 font-bold">{selectedStock.name}</span></p>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1">Wastage Quantity</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        min="1"
                                        max={selectedStock.engineer_quantity}
                                        value={wastageForm.quantity}
                                        onChange={e => setWastageForm({ ...wastageForm, quantity: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 text-lg font-bold text-slate-800 rounded-xl p-3 outline-none focus:border-rose-400 focus:bg-white transition-colors pl-14"
                                    />
                                    <div className="absolute top-0 bottom-0 left-0 bg-slate-100 border-r border-slate-200 rounded-l-xl px-4 flex items-center justify-center text-sm font-bold text-slate-400">
                                        Qty
                                    </div>
                                    <p className="text-[10px] font-bold text-right text-gray-400 mt-1">Available to report: {selectedStock.engineer_quantity}</p>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1">Reason for Wastage</label>
                                <textarea
                                    value={wastageForm.reason}
                                    onChange={e => setWastageForm({ ...wastageForm, reason: e.target.value })}
                                    placeholder="Briefly explain what happened..."
                                    className="w-full bg-slate-50 border border-slate-200 text-sm font-medium text-slate-800 rounded-xl p-3 h-24 outline-none focus:border-rose-400 focus:bg-white transition-colors resize-none placeholder-slate-400"
                                ></textarea>
                            </div>

                            <div className="flex gap-3 mt-4 pt-2">
                                <button
                                    onClick={() => setShowWastageForm(false)}
                                    className="flex-1 py-3.5 bg-gray-100 text-gray-600 font-bold rounded-xl active:scale-95 transition-all text-sm"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleReportWastage}
                                    disabled={submitting}
                                    className="flex-1 py-3.5 bg-rose-600 text-white font-bold rounded-xl active:scale-95 transition-all shadow-lg shadow-rose-600/30 disabled:opacity-50 text-sm flex items-center justify-center gap-2"
                                >
                                    {submitting ? 'Submitting...' : 'Submit Report'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EStock;
