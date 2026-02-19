import React, { useEffect, useState } from 'react';
import axios from 'axios';

export default function WastageList() {
    const [wastage, setWastage] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchWastage();
    }, []);

    async function fetchWastage() {
        setLoading(true);
        try {
            const res = await axios.get('/api/stock/wastage');
            setWastage(res.data || []);
        } catch (err) {
            console.error('Failed to load wastage records', err);
        } finally {
            setLoading(false);
        }
    }

    if (loading) return <div className="text-center p-4">Loading wastage records...</div>;

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mt-6">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-800">Wastage Reports</h2>
                <button
                    onClick={fetchWastage}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                    Refresh
                </button>
            </div>

            {wastage.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                    No wastage records found.
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Engineer</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {wastage.map((w) => (
                                <tr key={w.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {new Date(w.reported_at).toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                        {w.engineer_name}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {w.item_name} <span className="text-gray-400 text-xs">({w.sku})</span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-red-600 font-medium">
                                        {w.quantity}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                                        {w.reason || '-'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
