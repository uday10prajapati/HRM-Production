import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';

const TAApproval = () => {
    const navigate = useNavigate();
    const [taRecords, setTaRecords] = useState([]);
    const [filteredRecords, setFilteredRecords] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [userRole, setUserRole] = useState('');
    
    // Filters
    const [filterStatus, setFilterStatus] = useState('all');
    const [searchEngineer, setSearchEngineer] = useState('');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    
    // Approval modal
    const [showModal, setShowModal] = useState(false);
    const [selectedTA, setSelectedTA] = useState(null);
    const [approvalNotes, setApprovalNotes] = useState('');
    const [approvalAction, setApprovalAction] = useState('approve');

    useEffect(() => {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        setUserRole(user.role || '');
        if (!user.role || !['admin', 'hr'].includes(user.role.toLowerCase())) {
            navigate('/');
        }
    }, [navigate]);

    const fetchTARecords = async () => {
        try {
            setLoading(true);
            setError(null);
            // Use 'pending' as default if filterStatus is empty, otherwise use the filterStatus value
            const statusParam = filterStatus === '' ? 'all' : filterStatus;
            const res = await axios.get('/api/service-calls/ta-approvals', {
                params: { status: statusParam }
            });
            if (res.data.success) {
                setTaRecords(res.data.data || []);
            } else {
                setError(res.data.message || 'Failed to fetch TA records');
            }
        } catch (err) {
            console.error('Error fetching TA records:', err);
            setError(err.response?.data?.message || err.message || 'Failed to fetch TA records');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTARecords();
    }, []);

    useEffect(() => {
        // Apply filters on data change, not on filter change
        let filtered = [...taRecords];

        // Filter by status
        if (filterStatus && filterStatus !== 'all') {
            filtered = filtered.filter(ta => {
                const statusLower = (ta.ta_status || '').toLowerCase();
                if (filterStatus === 'pending') return statusLower.includes('pending');
                if (filterStatus === 'approved') return statusLower.includes('approved');
                if (filterStatus === 'rejected') return statusLower.includes('reject');
                return true;
            });
        }

        if (searchEngineer) {
            filtered = filtered.filter(ta => 
                ta.name?.toLowerCase().includes(searchEngineer.toLowerCase()) ||
                ta.dairy_name?.toLowerCase().includes(searchEngineer.toLowerCase())
            );
        }

        if (fromDate) {
            filtered = filtered.filter(ta => 
                new Date(ta.ta_voucher_date) >= new Date(fromDate)
            );
        }

        if (toDate) {
            filtered = filtered.filter(ta => 
                new Date(ta.ta_voucher_date) <= new Date(toDate)
            );
        }

        setFilteredRecords(filtered);
    }, [taRecords, filterStatus, searchEngineer, fromDate, toDate]);



    const handleOpenModal = (ta) => {
        setSelectedTA(ta);
        setApprovalNotes('');
        setApprovalAction('approve');
        setShowModal(true);
    };

    const handleSubmitApproval = async () => {
        if (!selectedTA) return;

        try {
            const res = await axios.post('/api/service-calls/ta-approval-action', {
                call_id: selectedTA.call_id,
                action: approvalAction,
                notes: approvalNotes
            });

            if (res.data.success) {
                alert(`TA ${approvalAction}d successfully!`);
                setShowModal(false);
                fetchTARecords();
            } else {
                alert(res.data.message || 'Failed to process approval');
            }
        } catch (err) {
            console.error('Error processing approval:', err);
            alert(err.response?.data?.message || 'Failed to process approval');
        }
    };

    const getStatusColor = (status) => {
        const statusLower = (status || '').toLowerCase();
        if (statusLower.includes('reject')) return 'bg-red-100 text-red-800 border-red-200';
        if (statusLower.includes('approved')) return 'bg-green-100 text-green-800 border-green-200';
        if (statusLower.includes('pending')) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
        return 'bg-gray-100 text-gray-800 border-gray-200';
    };

    const getSimpleStatus = (status) => {
        const statusLower = (status || '').toLowerCase();
        if (statusLower.includes('reject')) return 'Rejected';
        if (statusLower.includes('approved')) return 'Approved';
        if (statusLower.includes('pending')) return 'Pending';
        return status || 'Unknown';
    };

    const isPending = (status) => {
        const statusLower = (status || '').toLowerCase();
        return statusLower.includes('pending') || statusLower === 'pending';
    };

    return (
        <div className="min-h-screen bg-[#f8fafc] flex flex-col">
            <Navbar />
            <div className="flex flex-1">
                <Sidebar />
                <div className="flex-1 p-6">
                    {/* Header */}
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-slate-900 mb-2">TA Approval Management</h1>
                        <p className="text-slate-600">Review and approve Travel Allowance (TA) vouchers from engineers</p>
                    </div>

                    {/* Filters */}
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 mb-6">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Status</label>
                                <select 
                                    value={filterStatus}
                                    onChange={(e) => setFilterStatus(e.target.value)}
                                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="pending">Pending</option>
                                    <option value="approved">Approved</option>
                                    <option value="rejected">Rejected</option>
                                    <option value="all">All</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Engineer/Dairy</label>
                                <input 
                                    type="text"
                                    placeholder="Search engineer or dairy..."
                                    value={searchEngineer}
                                    onChange={(e) => setSearchEngineer(e.target.value)}
                                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">From Date</label>
                                <input 
                                    type="date"
                                    value={fromDate}
                                    onChange={(e) => setFromDate(e.target.value)}
                                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">To Date</label>
                                <input 
                                    type="date"
                                    value={toDate}
                                    onChange={(e) => setToDate(e.target.value)}
                                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
                            {error}
                        </div>
                    )}

                    {/* Table */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                        {loading ? (
                            <div className="p-12 text-center">
                                <div className="inline-block animate-spin">
                                    <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                </div>
                                <p className="mt-3 text-slate-600">Loading TA records...</p>
                            </div>
                        ) : filteredRecords.length === 0 ? (
                            <div className="p-12 text-center">
                                <svg className="w-12 h-12 text-slate-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <p className="text-slate-600 font-medium">No TA records found</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-100">
                                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Call ID</th>
                                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Engineer</th>
                                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Dairy</th>
                                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Voucher #</th>
                                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Date</th>
                                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">KM</th>
                                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Mode</th>
                                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Status</th>
                                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredRecords.map((ta, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <span className="font-bold text-blue-600">{ta.formatted_call_id || ta.call_id}</span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="font-semibold text-slate-900">{ta.name}</div>
                                                    <div className="text-xs text-slate-500">{ta.mobile_number || 'N/A'}</div>
                                                </td>
                                                <td className="px-6 py-4 text-slate-700">{ta.dairy_name}</td>
                                                <td className="px-6 py-4 font-medium text-slate-900">{ta.ta_voucher_number}</td>
                                                <td className="px-6 py-4 text-slate-600">
                                                    {new Date(ta.ta_voucher_date).toLocaleDateString('en-GB')}
                                                </td>
                                                <td className="px-6 py-4 font-semibold text-slate-900">{ta.ta_revised_km || 'N/A'}</td>
                                                <td className="px-6 py-4">
                                                    <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium">
                                                        {ta.ta_travel_mode || 'N/A'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-3 py-1.5 rounded-full text-xs font-bold border ${getStatusColor(ta.ta_status)}`}>
                                                        {getSimpleStatus(ta.ta_status)}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {isPending(ta.ta_status) ? (
                                                        <button
                                                            onClick={() => handleOpenModal(ta)}
                                                            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors"
                                                        >
                                                            Review
                                                        </button>
                                                    ) : (
                                                        <span className="text-slate-400 text-sm">Processed</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Results Summary */}
                    <div className="mt-4 text-sm text-slate-600">
                        Showing {filteredRecords.length} of {taRecords.length} TA records
                    </div>
                </div>
            </div>

            {/* Approval Modal */}
            {showModal && selectedTA && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                    <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-8">
                        <h2 className="text-2xl font-bold text-slate-900 mb-6">Review TA Voucher</h2>

                        {/* TA Details */}
                        <div className="bg-slate-50 rounded-lg p-4 mb-6 space-y-3">
                            <div className="flex justify-between">
                                <span className="text-slate-600 font-medium">Call ID:</span>
                                <span className="font-bold text-slate-900">{selectedTA.formatted_call_id || selectedTA.call_id}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-600 font-medium">Engineer:</span>
                                <span className="font-semibold text-slate-900">{selectedTA.name}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-600 font-medium">Dairy:</span>
                                <span className="text-slate-900">{selectedTA.dairy_name}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-600 font-medium">Voucher #:</span>
                                <span className="font-mono text-slate-900">{selectedTA.ta_voucher_number}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-600 font-medium">KM Traveled:</span>
                                <span className="font-bold text-blue-600">{selectedTA.ta_revised_km || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-600 font-medium">Travel Mode:</span>
                                <span className="text-slate-900">{selectedTA.ta_travel_mode || 'N/A'}</span>
                            </div>
                        </div>

                        {/* Action Selection */}
                        <div className="mb-6">
                            <label className="block text-sm font-semibold text-slate-700 mb-3">Action</label>
                            <div className="flex gap-3">
                                <label className="flex items-center cursor-pointer">
                                    <input 
                                        type="radio"
                                        value="approve"
                                        checked={approvalAction === 'approve'}
                                        onChange={(e) => setApprovalAction(e.target.value)}
                                        className="mr-2"
                                    />
                                    <span className="text-sm font-medium text-slate-700">Approve</span>
                                </label>
                                <label className="flex items-center cursor-pointer">
                                    <input 
                                        type="radio"
                                        value="reject"
                                        checked={approvalAction === 'reject'}
                                        onChange={(e) => setApprovalAction(e.target.value)}
                                        className="mr-2"
                                    />
                                    <span className="text-sm font-medium text-slate-700">Reject</span>
                                </label>
                            </div>
                        </div>

                        {/* Notes */}
                        <div className="mb-6">
                            <label className="block text-sm font-semibold text-slate-700 mb-2">Notes (Optional)</label>
                            <textarea
                                value={approvalNotes}
                                onChange={(e) => setApprovalNotes(e.target.value)}
                                placeholder="Add any comments or notes..."
                                className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                rows={4}
                            />
                        </div>

                        {/* Buttons */}
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowModal(false)}
                                className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg font-semibold hover:bg-slate-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSubmitApproval}
                                className={`flex-1 px-4 py-2 text-white rounded-lg font-semibold transition-colors ${
                                    approvalAction === 'approve' 
                                        ? 'bg-green-600 hover:bg-green-700' 
                                        : 'bg-red-600 hover:bg-red-700'
                                }`}
                            >
                                {approvalAction === 'approve' ? 'Approve TA' : 'Reject TA'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TAApproval;
