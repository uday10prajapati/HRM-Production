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
    const [submitting, setSubmitting] = useState(false);

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
            
            // Get user from localStorage
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            const userId = user?.id;
            
            console.log('Fetching TA records with user:', { userId, userName: user?.name });
            
            if (!userId) {
                setError('User not logged in');
                setLoading(false);
                return;
            }
            
            // Use 'pending' as default if filterStatus is empty, otherwise use the filterStatus value
            const statusParam = filterStatus === '' ? 'all' : filterStatus;
            const res = await axios.get('/api/service-calls/ta-approvals', {
                params: { status: statusParam },
                headers: {
                    'x-user-id': userId
                }
            });
            
            console.log('TA Records response:', res.data);
            
            if (res.data.success) {
                const records = res.data.data || [];
                console.log('Records loaded - check final_ta_status:', records.map(r => ({
                    call_id: r.call_id,
                    ta_rejected_by: r.ta_rejected_by,
                    ta_hr_approved: r.ta_hr_approved,
                    ta_admin_approved: r.ta_admin_approved,
                    final_ta_status: r.final_ta_status
                })));
                setTaRecords(records);
                setError(null);
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
                const status = getSimpleStatus(ta);
                if (filterStatus === 'pending') return status === 'Pending';
                if (filterStatus === 'approved') return status === 'Approved';
                if (filterStatus === 'rejected') return status === 'Rejected';
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
        setApprovalNotes(ta.ta_hr_approval_notes || ta.ta_admin_approval_notes || '');
        
        // Always default to 'approve' - user can manually change to 'reject' if needed
        setApprovalAction('approve');
        
        setShowModal(true);
    };

    const handleSubmitApproval = async () => {
        if (!selectedTA || submitting) return;

        setSubmitting(true);
        try {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            const userId = user.id;
            
            const res = await axios.post('/api/service-calls/ta-approval-action', {
                call_id: selectedTA.call_id,
                id: selectedTA.id,
                action: approvalAction,
                notes: approvalNotes
            }, {
                headers: userId ? {
                    'x-user-id': String(userId)
                } : {}
            });

            if (res.data.success) {
                alert(`TA ${approvalAction}d successfully!`);
                setShowModal(false);
                setSubmitting(false);
                setFilterStatus('all'); // Reset filter to show all records
                
                // Force a complete page refresh to ensure database changes are picked up
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            } else {
                alert(res.data.message || 'Failed to process approval');
                setSubmitting(false);
            }
        } catch (err) {
            console.error('Error processing approval:', err);
            alert(err.response?.data?.message || 'Failed to process approval');
            setSubmitting(false);
        }
    };

    const getStatusColor = (status) => {
        const statusLower = (status || '').toLowerCase();
        if (statusLower.includes('reject')) return 'bg-red-100 text-red-800 border-red-200';
        if (statusLower === 'approved') return 'bg-green-100 text-green-800 border-green-200';
        if (statusLower === 'pending') return 'bg-yellow-100 text-yellow-800 border-yellow-200';
        return 'bg-gray-100 text-gray-800 border-gray-200';
    };

    const getSimpleStatus = (ta) => {
        // Use final_ta_status from backend if available
        if (ta.final_ta_status) {
            return ta.final_ta_status;
        }
        // Fallback: calculate locally
        if (ta.ta_rejected_by) return 'Rejected';
        if (ta.ta_hr_approved || ta.ta_admin_approved) return 'Approved';
        return 'Pending';
    };
    const getApprovalDetails = (ta) => {
        const hr = ta.ta_hr_approved ? '✓ HR' : '○ HR';
        const admin = ta.ta_admin_approved ? '✓ Admin' : '○ Admin';
        return `${hr} | ${admin}`;
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
                                                    <div>
                                                        <span className={`px-3 py-1.5 rounded-full text-xs font-bold border ${getStatusColor(getSimpleStatus(ta))}`}>
                                                            {getSimpleStatus(ta)}
                                                        </span>
                                                        <div className="text-xs text-slate-500 mt-1">{getApprovalDetails(ta)}</div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex gap-2">
                                                        {getSimpleStatus(ta) === 'Pending' ? (
                                                            <button
                                                                onClick={() => handleOpenModal(ta)}
                                                                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors"
                                                            >
                                                                Review
                                                            </button>
                                                        ) : (
                                                            <>
                                                                <button
                                                                    onClick={() => handleOpenModal(ta)}
                                                                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors"
                                                                >
                                                                    Edit
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
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
                    <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-8 max-h-screen overflow-y-auto">
                        <h2 className="text-2xl font-bold text-slate-900 mb-6">
                            {getSimpleStatus(selectedTA) === 'Pending' ? 'Review TA Voucher' : 'Edit TA Approval'}
                        </h2>

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
                            <div className="border-t border-slate-200 pt-3 mt-3">
                                <div className="text-sm font-semibold text-slate-700 mb-2">Approval Status:</div>
                                
                                {/* Show rejection status if rejected */}
                                {selectedTA.ta_rejected_by && (
                                    <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded">
                                        <p className="text-xs font-semibold text-red-800">🔴 REJECTED</p>
                                        <p className="text-xs text-red-700">Rejected by: {selectedTA.ta_rejected_by}</p>
                                        {selectedTA.ta_rejection_notes && (
                                            <p className="text-xs text-red-600 mt-1">Reason: {selectedTA.ta_rejection_notes}</p>
                                        )}
                                    </div>
                                )}
                                
                                <div className="flex gap-4 text-sm">
                                    <div className={`px-3 py-1 rounded ${selectedTA.ta_hr_approved ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                                        {selectedTA.ta_hr_approved ? '✓' : '○'} HR {selectedTA.ta_hr_approved ? 'Approved' : 'Pending'}
                                    </div>
                                    <div className={`px-3 py-1 rounded ${selectedTA.ta_admin_approved ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                                        {selectedTA.ta_admin_approved ? '✓' : '○'} Admin {selectedTA.ta_admin_approved ? 'Approved' : 'Pending'}
                                    </div>
                                </div>
                                <div className="mt-2 text-xs text-slate-500">Either HR or Admin approval required for final approval</div>
                            </div>
                        </div>

                        {/* Action Selection */}
                        <div className="mb-6">
                            {selectedTA.ta_rejected_by && (
                                <div className="p-3 mb-3 bg-orange-50 border border-orange-200 rounded-lg">
                                    <p className="text-xs font-semibold text-orange-800">⚠️ This TA was previously rejected</p>
                                    <p className="text-xs text-orange-700 mt-1">You can change this decision by selecting Approve below</p>
                                </div>
                            )}
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
                                Close
                            </button>
                            <button
                                onClick={handleSubmitApproval}
                                disabled={submitting}
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
