import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Update PdfModal to be outside the main component or use useCallback for better performance
function PdfModal({ url, onClose }) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        // Cleanup function: revoke the object URL to prevent memory leaks
        return () => {
            if (url?.startsWith('blob:')) {
                window.URL.revokeObjectURL(url);
            }
        };
    }, [url]);

    if (!url) return null;

    return (
        <div className="fixed inset-0 bg-black/40 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-4 rounded-lg w-11/12 h-5/6 flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold">Payslip PDF</h2>
                    <button 
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <div className="flex-1 bg-gray-100 relative">
                    {loading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-90">
                            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
                        </div>
                    )}
                    {error ? (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-red-600">{error}</div>
                        </div>
                    ) : (
                        <iframe
                            src={url}
                            type="application/pdf"
                            className="w-full h-full"
                            onLoad={() => setLoading(false)}
                            onError={(e) => {
                                setError('Failed to load PDF');
                                setLoading(false);
                            }}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

export default function Payroll() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [config, setConfig] = useState({ basic: '', hra: '', allowances: {}, deductions: {} });
    const [year, setYear] = useState(new Date().getFullYear());
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [generatingMap, setGeneratingMap] = useState({}); // userId -> bool
    const [generatingAll, setGeneratingAll] = useState(false);
    const [showPdfModal, setShowPdfModal] = useState(false);
    const [pdfUrl, setPdfUrl] = useState('');

    const getRequesterHeaders = useCallback(() => {
        const meRaw = localStorage.getItem('user');
        const me = meRaw ? JSON.parse(meRaw) : null;
        const token = localStorage.getItem('token');
        // Support both token-based & userId-based auth
        const headers = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        if (me?.email) headers['X-User-Id'] = me.email;
        headers['Content-Type'] = 'application/json';
        return headers;
    }, []);

    async function fetchUsers() {
        setLoading(true);
        try {
            const res = await axios.get('/api/users');
            setUsers(res.data.users || res.data || []);
        } catch (err) {
            console.error('Failed to fetch users', err);
            setUsers([]);
            toast.error('Failed to load employee list.');
        } finally { setLoading(false); }
    }

    useEffect(() => { fetchUsers(); }, []);

    async function saveConfig() {
        if (!selectedUser) return toast.warn('Select an employee first.');
        try {
            const payload = { 
                userId: selectedUser.email || selectedUser,
                basic: Number(config.basic || 0),
                hra: Number(config.hra || 0),
                allowances: config.allowances,
                deductions: config.deductions
            };
            const headers = getRequesterHeaders();
            await axios.post('/api/payroll/config', payload, { headers });
            toast.success('Configuration saved successfully!');
        } catch (err) {
            console.error('Failed to save config', err);
            toast.error('Failed to save configuration.');
        }
    }

    async function runPayroll() {
        try {
            setGeneratingAll(true);
            const headers = getRequesterHeaders();
            const res = await axios.post('/api/payroll/run', { year: Number(year), month: Number(month) }, { headers });
            const summary = res.data.summary || res.data;
            toast.success(`Payroll run completed. Generated: ${summary.generated || 0}, Failed: ${summary.failed || 0}`);
        } catch (err) {
            console.error('Payroll run failed', err);
            toast.error('Payroll run failed.');
        } finally {
            setGeneratingAll(false);
        }
    }

    async function generatePayslipForUser(user) {
        const userId = user?.id || user;
        if (!userId) return toast.warn('Invalid employee');
        console.log('Generating payslip for:', userId);
        setGeneratingMap(m => ({ ...m, [userId]: true }));
        try {
            const headers = getRequesterHeaders();
            await axios.post(`/api/payroll/generate-payslip/${userId}/${year}/${month}`, {}, { headers });
            toast.success(`Payslip generated for ${user.name || userId}`);
        } catch (err) {
            console.error('Failed to generate payslip:', err.response?.data || err.message);
            toast.error(`Failed to generate payslip: ${err.response?.data?.error || err.message}`);
        } finally {
            setGeneratingMap(m => ({ ...m, [userId]: false }));
        }
    }

    async function downloadSlip(user) {
        try {
            const headers = getRequesterHeaders();
            const res = await axios.get(`/api/payroll/slip/${user.id}/${year}/${month}`, { headers });
            const slip = res.data;

            if (!slip) {
                toast.error('No payslip data found for this user.');
                return;
            }

            const doc = new jsPDF();
            doc.setFontSize(12);
            doc.text(`Salary Slip - ${month}/${year}`, 14, 20);
            doc.text(`Employee: ${user.name} (${user.email})`, 14, 30);
            
            let y = 40;
            
            // Attendance & Leave Section
            doc.setFontSize(10);
            doc.text('ATTENDANCE & LEAVE:', 14, y);
            y += 6;
            doc.setFontSize(9);
            doc.text(`Total Working Days: ${slip.total_working_days || 0}`, 14, y);
            y += 5;
            doc.text(`Leave - Full Days: ${slip.leave_full_days || 0}`, 14, y);
            y += 5;
            doc.text(`Leave - Half Days: ${slip.leave_half_days || 0}`, 14, y);
            y += 5;
            doc.text(`Chargeable Full Days: ${slip.chargeable_full_days || 0}`, 14, y);
            y += 5;
            doc.text(`Chargeable Half Days: ${slip.chargeable_half_days || 0}`, 14, y);
            y += 8;

            // Earnings Section
            doc.setFontSize(10);
            doc.text('EARNINGS:', 14, y);
            y += 6;
            const earningData = [
                ['Basic', `₹${slip.basic || 0}`],
                ['HRA', `₹${slip.hra || 0}`],
                ['Allowances', `₹${slip.allowancesSum || 0}`],
            ];
            doc.autoTable({ 
                startY: y, 
                head: [['Earning', 'Amount']], 
                body: earningData,
                theme: 'grid',
                headStyles: { fillColor: [220, 220, 220], textColor: [0, 0, 0] },
                columnStyles: { 0: { cellWidth: 100 }, 1: { cellWidth: 50, halign: 'right' } }
            });

            y = doc.lastAutoTable.finalY + 8;
            doc.setFontSize(10);
            doc.text(`Gross Salary: ₹${slip.gross_pay || slip.gross || 0}`, 14, y);
            y += 8;

            // Leave Deduction Section
            if (slip.leave_deduction > 0) {
                doc.setFontSize(10);
                doc.text('LEAVE DEDUCTION:', 14, y);
                y += 6;
                const leaveData = [
                    [`Per Day Salary`, `₹${slip.per_day_salary || 0}`],
                    [`Chargeable Full (${slip.chargeable_full_days || 0} × ₹${slip.per_day_salary || 0})`, `₹${(slip.chargeable_full_days * slip.per_day_salary) || 0}`],
                    [`Chargeable Half (${slip.chargeable_half_days || 0} × ₹${(slip.per_day_salary / 2) || 0})`, `₹${(slip.chargeable_half_days * (slip.per_day_salary / 2)) || 0}`],
                ];
                doc.autoTable({
                    startY: y,
                    head: [['Description', 'Amount']],
                    body: leaveData,
                    theme: 'grid',
                    headStyles: { fillColor: [255, 200, 124], textColor: [0, 0, 0] },
                    columnStyles: { 0: { cellWidth: 100 }, 1: { cellWidth: 50, halign: 'right' } }
                });
                y = doc.lastAutoTable.finalY + 8;
                doc.setFontSize(10);
                doc.text(`Total Leave Deduction: ₹${slip.leave_deduction || 0}`, 14, y);
                y += 8;
            }

            // Deductions Section
            doc.setFontSize(10);
            doc.text('STATUTORY DEDUCTIONS:', 14, y);
            y += 6;
            const deductions = [
                ['PF (12%)', `₹${slip.pf || 0}`],
                ['ESI (Employee)', `₹${slip.esi_employee || 0}`],
                ['Professional Tax', `₹${slip.professional_tax || 0}`],
                ['TDS', `₹${slip.tds || 0}`],
            ];

            doc.autoTable({ 
                startY: y, 
                head: [['Deduction', 'Amount']], 
                body: deductions,
                theme: 'grid',
                headStyles: { fillColor: [220, 220, 220], textColor: [0, 0, 0] },
                columnStyles: { 0: { cellWidth: 100 }, 1: { cellWidth: 50, halign: 'right' } }
            });

            y = doc.lastAutoTable.finalY + 10;
            
            // Summary
            const totalStatutoryDeductions = (slip.pf || 0) + (slip.esi_employee || 0) + (slip.professional_tax || 0) + (slip.tds || 0) + (slip.otherSum || 0);
            const totalDeductions = totalStatutoryDeductions + (slip.leave_deduction || 0);
            
            doc.setFontSize(10);
            doc.text('SUMMARY:', 14, y);
            y += 6;
            doc.text(`Gross Salary: ₹${slip.gross_pay || slip.gross || 0}`, 14, y);
            y += 5;
            doc.text(`Statutory Deductions: ₹${totalStatutoryDeductions}`, 14, y);
            y += 5;
            doc.text(`Leave Deductions: ₹${slip.leave_deduction || 0}`, 14, y);
            y += 5;
            doc.text(`Total Deductions: ₹${totalDeductions}`, 14, y);
            y += 8;
            
            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.text(`NET PAY: ₹${slip.net_pay || 0}`, 14, y);
            
            doc.setFont(undefined, 'normal');
            doc.setFontSize(8);
            doc.text('This is a computer-generated payslip and does not require signature.', 14, doc.internal.pageSize.height - 10, { align: 'left' });

            doc.save(`salary_slip_${user.email}_${year}_${month}.pdf`);
            toast.info(`Payslip download started for ${user.name}.`);
        } catch (err) {
            console.error('Failed to fetch slip', err.response?.data || err.message);
            toast.error('Slip not available for this period or failed to fetch.');
        }
    }


    // Fix applied here: Use getRequesterHeaders() instead of getAuthHeaders()
    async function viewSlip(user) {
        try {
            const headers = getRequesterHeaders();
            const yearMonthPath = `${year}/${month}`;

            // Step 1: Check if payslip exists
            let checkRes;
            try {
                checkRes = await axios.get(`/api/payroll/pdf-file/${user.id}/${yearMonthPath}`, { headers });
                console.log("Payslip metadata:", checkRes.data);
            } catch (checkErr) {
                const status = checkErr.response?.status;
                if (status === 404) {
                    const confirmGenerate = window.confirm("Payslip not found. Would you like to generate it?");
                    if (confirmGenerate) {
                        await generatePayslipForUser(user);
                        // Wait a bit longer for file creation
                        setTimeout(() => viewSlip(user), 3000);
                    }
                    return;
                }
                if (status === 401) {
                    toast.error("Unauthorized — please log in again.");
                    return;
                }
                throw checkErr;
            }

            // Step 2: Fetch PDF
            const pdfResponse = await axios.get(`/api/payroll/pdf/${user.id}/${yearMonthPath}`, {
                headers: { ...headers, Accept: 'application/pdf' },
                responseType: 'blob'
            });

            // Step 3: Display PDF
            const blob = new Blob([pdfResponse.data], { type: 'application/pdf' });
            const blobUrl = window.URL.createObjectURL(blob);
            setPdfUrl(blobUrl);
            setShowPdfModal(true);
            toast.success(`Opened payslip for ${user.name}`);

        } catch (err) {
            console.error("ViewSlip Error:", err);
            const status = err.response?.status;

            if (status === 401) {
                toast.error("Session expired or invalid token. Please log in again.");
            } else if (status === 404) {
                toast.warn("Payslip not found. Generate it first.");
            } else {
                toast.error("Error viewing payslip: " + (err.message || "Unknown error"));
            }
        }
    }

    // Add email validation - still useful
    function isValidEmail(email) {
        return email && typeof email === 'string' && email.includes('@');
    }

    // Note: The PayslipList component is incomplete and has a placeholder PayslipModal.
    // I will keep the existing structure as it seems unused in the main render.
    const PayslipList = ({ payslips }) => {
        const [selectedPayslip, setSelectedPayslip] = useState(null);

        // Placeholder for PayslipModal if needed
        function PayslipModal({ payslipPath, onClose }) { return null; }

        return (
            <div>
                {/* ...existing code... */}
                
                {/* Placeholder mapping */}
                {payslips?.map(payslip => (
                    <button
                        key={payslip.id}
                        onClick={() => setSelectedPayslip(payslip.path)}
                        className="w-full text-left px-4 py-3 hover:bg-gray-50"
                    >
                        {/* ...existing payslip item content... */}
                    </button>
                ))}

                {selectedPayslip && (
                    <PayslipModal
                        payslipPath={selectedPayslip}
                        onClose={() => setSelectedPayslip(null)}
                    />
                )}
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <Navbar />
            <div className="flex">
                <Sidebar />
                <main className="flex-1 p-8">
                    <div className="max-w-7xl mx-auto">
                        {/* Header Section */}
                        <div className="mb-8">
                            <h1 className="text-3xl font-bold text-gray-800">Payroll Management</h1>
                            <p className="mt-2 text-gray-600">Configure and manage employee payroll settings</p>
                        </div>

                        {/* Configuration Card */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-8">
                            <div className="p-6 border-b border-gray-200">
                                <h2 className="text-lg font-semibold text-gray-800">Salary Configuration</h2>
                            </div>
                            <div className="p-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Select Employee</label>
                                        <select 
                                            className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                            value={selectedUser?.id || selectedUser || ''} 
                                            onChange={e => setSelectedUser(users.find(u => u.id === e.target.value) || e.target.value)}
                                        >
                                            <option value="">-- Select Employee --</option>
                                            {users.map(u => (
                                                <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Basic Salary</label>
                                        <input 
                                            type="number"
                                            className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                            value={config.basic} 
                                            onChange={e => setConfig(c => ({...c, basic: e.target.value}))}
                                            placeholder="Enter basic salary"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">HRA</label>
                                        <input 
                                            type="number"
                                            className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                            value={config.hra} 
                                            onChange={e => setConfig(c => ({...c, hra: e.target.value}))}
                                            placeholder="Enter HRA amount"
                                        />
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-4">
                                    <button 
                                        onClick={saveConfig}
                                        className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                                    >
                                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                                        </svg>
                                        Save Configuration
                                    </button>
                                    <button 
                                        onClick={runPayroll}
                                        disabled={generatingAll}
                                        className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
                                    >
                                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 003-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                                        </svg>
                                        {generatingAll ? 'Processing...' : 'Run Payroll (All)'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Employees Table */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="p-6 border-b border-gray-200">
                                <div className="flex justify-between items-center">
                                    <h2 className="text-lg font-semibold text-gray-800">Employee Payslips</h2>
                                    <div className="flex items-center gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                                            <input
                                                type="number"
                                                className="w-24 rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                                value={year}
                                                onChange={e => setYear(e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
                                            <select
                                                className="w-32 rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                                value={month}
                                                onChange={e => setMonth(e.target.value)}
                                            >
                                                {Array.from({ length: 12 }, (_, i) => (
                                                    <option key={i + 1} value={i + 1}>
                                                        {new Date(2000, i).toLocaleString('default', { month: 'long' })}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {loading ? (
                                <div className="p-8 text-center">
                                    <div className="inline-flex items-center">
                                        <svg className="animate-spin h-5 w-5 text-blue-500 mr-3" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                                        </svg>
                                        <span className="text-gray-600">Loading employees...</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {users.map(u => (
                                                <tr key={u.id} className="hover:bg-gray-50">
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="flex items-center">
                                                            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                                                                <span className="text-blue-600 font-medium">{u.name[0]}</span>
                                                            </div>
                                                            <div className="ml-4">
                                                                <div className="text-sm font-medium text-gray-900">{u.name}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="text-sm text-gray-500">{u.email}</div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                                        <button 
                                                            onClick={() => viewSlip(u)}
                                                            className="inline-flex items-center px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-sm font-medium transition-colors mr-2"
                                                        >
                                                            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                            </svg>
                                                            View
                                                        </button>
                                                        <button 
                                                            onClick={() => downloadSlip(u)}
                                                            className="inline-flex items-center px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-sm font-medium transition-colors mr-2"
                                                        >
                                                            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                                            </svg>
                                                            Download
                                                        </button>
                                                        <button 
                                                            onClick={() => generatePayslipForUser(u)}
                                                            disabled={!!generatingMap[u.id]}
                                                            className="inline-flex items-center px-3 py-1.5 bg-orange-50 text-orange-700 hover:bg-orange-100 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                                                        >
                                                            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                            </svg>
                                                            {generatingMap[u.id] ? 'Generating...' : 'Generate'}
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </main>
            </div>

            {/* PDF Modal */}
            <PdfModal 
                url={pdfUrl} 
                onClose={() => {
                    setShowPdfModal(false);
                    setPdfUrl('');
                }} 
            />
            <ToastContainer position="bottom-right" autoClose={5000} hideProgressBar={false} newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover />
        </div>
    );
}

