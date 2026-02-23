import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';

const SocietyMasterModal = ({ isOpen, onClose }) => {
    const [societies, setSocieties] = useState([]);
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({ SOCCD: '', SOCIETY: '', TALUKA_NAME: '' });
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (isOpen) {
            fetchSocieties();
        }
    }, [isOpen]);

    const fetchSocieties = async () => {
        try {
            setLoading(true);
            const res = await axios.get('/api/society-master');
            if (res.data.success) {
                setSocieties(res.data.data);
            }
        } catch (err) {
            console.error('Error fetching societies:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!form.SOCCD || !form.SOCIETY) {
            alert('SOCCD and Society Name are required');
            return;
        }
        try {
            const res = await axios.post('/api/society-master', form);
            if (res.data.success) {
                setForm({ SOCCD: '', SOCIETY: '', TALUKA_NAME: '' });
                // Refresh list from server to ensure data consistency
                await fetchSocieties();
                alert('Society added successfully');
            }
        } catch (err) {
            console.error('Error adding society:', err);
            alert('Failed to add society. Check console for details.');
        }
    };

    const handleDelete = async (id, soccd) => {
        if (!window.confirm(`Are you sure you want to delete society with code ${soccd}?`)) return;

        try {
            const res = await axios.delete(`/api/society-master/${id}`);
            if (res.data.success) {
                // Refresh list from server to ensure data consistency
                await fetchSocieties();
                alert('Society deleted successfully');
            }
        } catch (err) {
            console.error('Error deleting society:', err);
            alert('Failed to delete society');
        }
    };

    const filteredSocieties = societies.filter(s =>
        (s.SOCIETY || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s['TALUKA NAME'] || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(s.SOCCD).includes(searchTerm)
    );

    if (!isOpen) return null;

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 text-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in-up">
                {/* Header */}
                <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-700 flex justify-between items-center shrink-0">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        Society Master
                    </h2>
                    <button onClick={onClose} className="text-white/80 hover:text-white transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-grow bg-gray-50 flex flex-col gap-6">

                    {/* Add New Form */}
                    <div className="bg-white p-4 rounded-lg shadow border border-gray-100 shrink-0">
                        <h3 className="text-md font-semibold text-gray-700 mb-3">Add New Society</h3>
                        <form onSubmit={handleAdd} className="flex flex-col md:flex-row gap-3 items-end">
                            <div className="flex-1 w-full">
                                <label className="text-xs font-medium text-gray-500 mb-1 block">SOCCD (Code)</label>
                                <input
                                    type="number"
                                    className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                                    placeholder="e.g. 101"
                                    value={form.SOCCD}
                                    onChange={e => setForm({ ...form, SOCCD: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="flex-[2] w-full">
                                <label className="text-xs font-medium text-gray-500 mb-1 block">Society Name</label>
                                <input
                                    type="text"
                                    className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                                    placeholder="Enter society name"
                                    value={form.SOCIETY}
                                    onChange={e => setForm({ ...form, SOCIETY: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="flex-1 w-full">
                                <label className="text-xs font-medium text-gray-500 mb-1 block">Taluka</label>
                                <input
                                    type="text"
                                    className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                                    placeholder="Taluka"
                                    value={form.TALUKA_NAME}
                                    onChange={e => setForm({ ...form, TALUKA_NAME: e.target.value })}
                                />
                            </div>
                            <button
                                type="submit"
                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2 rounded transition-colors flex items-center gap-1 h-[38px] min-w-[80px] justify-center"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                                </svg>
                                Add
                            </button>
                        </form>
                    </div>

                    {/* List */}
                    <div className="bg-white rounded-lg shadow border border-gray-100 flex flex-col flex-grow min-h-[300px]">
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center gap-4">
                            <div className="flex items-center gap-2">
                                <h3 className="text-md font-semibold text-gray-700">All Societies ({filteredSocieties.length})</h3>
                                <button
                                    onClick={fetchSocieties}
                                    title="Refresh List"
                                    className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-all"
                                >
                                    <svg className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                </button>
                            </div>
                            <input
                                type="text"
                                placeholder="Search society..."
                                className="border border-gray-300 rounded px-3 py-1.5 text-sm w-64 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <div className="overflow-auto flex-grow">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-gray-50 sticky top-0 z-10">
                                    <tr>
                                        <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider border-b">SOCCD</th>
                                        <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Society Name</th>
                                        <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Taluka</th>
                                        <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider border-b text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {loading ? (
                                        <tr>
                                            <td colSpan="4" className="text-center py-8 text-gray-500">Loading...</td>
                                        </tr>
                                    ) : filteredSocieties.length === 0 ? (
                                        <tr>
                                            <td colSpan="4" className="text-center py-8 text-gray-500">No data found.</td>
                                        </tr>
                                    ) : (
                                        filteredSocieties.map((item, idx) => (
                                            <tr key={item.id || idx} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-6 py-3 text-gray-700 font-mono text-sm">{item.SOCCD}</td>
                                                <td className="px-6 py-3 text-gray-900 font-medium">{item.SOCIETY}</td>
                                                <td className="px-6 py-3 text-gray-600">{item['TALUKA NAME']}</td>
                                                <td className="px-6 py-3 text-right">
                                                    <button
                                                        onClick={() => handleDelete(item.id, item.SOCCD)}
                                                        className="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1 rounded text-xs font-medium transition-colors"
                                                    >
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
                </div>

                {/* Footer */}
                <div className="bg-gray-50 px-6 py-3 border-t border-gray-200 flex justify-end shrink-0">
                    <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors">
                        Close
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default SocietyMasterModal;
