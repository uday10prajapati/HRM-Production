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
        <div className="min-h-screen flex flex-col bg-slate-50/50">
            <div className="fixed top-0 w-full z-50"><Navbar /></div>
            <div className="flex flex-1 pt-16 overflow-hidden">
                <div className="fixed left-0 h-full w-64 hidden md:block"><Sidebar /></div>

                <main className="flex-1 md:ml-64 p-4 sm:p-8 relative overflow-y-auto w-full custom-scrollbar">

                    {/* Background Pattern */}
                    <div className="absolute inset-x-0 top-0 h-96 bg-gradient-to-b from-indigo-50/80 to-transparent pointer-events-none -z-10" />

                    <div className="max-w-7xl mx-auto space-y-8">
                        {/* Header Section */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2 mb-8">
                            <div>
                                <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Payroll Management</h1>
                                <p className="text-sm font-medium text-slate-500 mt-2">Configure and manage employee salary constructs and slips.</p>
                            </div>
                        </div>

                        {/* Configuration Card */}
                        <div className="bg-white rounded-3xl shadow-[0_2px_24px_-4px_rgba(0,0,0,0.05)] border border-slate-100 mb-8 animate-[fadeIn_0.3s_ease-out]">
                            <div className="p-6 sm:p-8 border-b border-slate-100 bg-slate-50/50">
                                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                    <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    Salary Configuration
                                </h2>
                            </div>
                            <div className="p-6 sm:p-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Select Employee</label>
                                        <select
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-700 rounded-xl focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all cursor-pointer shadow-sm"
                                            value={selectedUser?.id || selectedUser || ''}
                                            onChange={e => setSelectedUser(users.find(u => u.id === e.target.value) || e.target.value)}
                                        >
                                            <option value="">-- Choose Profile --</option>
                                            {users.map(u => (
                                                <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Basic Salary</label>
                                        <input
                                            type="number"
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-700 rounded-xl focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all shadow-sm placeholder-slate-400"
                                            value={config.basic}
                                            onChange={e => setConfig(c => ({ ...c, basic: e.target.value }))}
                                            placeholder="₹ Enter amount"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">HRA</label>
                                        <input
                                            type="number"
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-700 rounded-xl focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all shadow-sm placeholder-slate-400"
                                            value={config.hra}
                                            onChange={e => setConfig(c => ({ ...c, hra: e.target.value }))}
                                            placeholder="₹ Enter amount"
                                        />
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-4 border-t border-slate-100 pt-6">
                                    <button
                                        onClick={saveConfig}
                                        className="inline-flex items-center px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-md shadow-indigo-500/20 hover:shadow-lg hover:shadow-indigo-500/40 hover:-translate-y-0.5"
                                    >
                                        <svg className="w-5 h-5 mr-2 -ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                                        </svg>
                                        Commit Configuration
                                    </button>
                                    <button
                                        onClick={runPayroll}
                                        disabled={generatingAll}
                                        className="inline-flex items-center px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl transition-all shadow-md shadow-emerald-500/20 hover:shadow-lg hover:shadow-emerald-500/40 hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-md"
                                    >
                                        <svg className="w-5 h-5 mr-2 -ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                        </svg>
                                        {generatingAll ? 'Running Scripts...' : 'Execute Run (All)'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Employees Table Card */}
                        <div className="bg-white rounded-3xl shadow-[0_2px_24px_-4px_rgba(0,0,0,0.05)] border border-slate-100 overflow-hidden animate-[fadeIn_0.4s_ease-out]">
                            <div className="p-6 sm:p-8 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                    <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                    </svg>
                                    Employee Registry
                                </h2>

                                <div className="flex items-center gap-4 bg-white p-2 sm:p-3 rounded-2xl border border-slate-200 shadow-sm">
                                    <div className="px-2">
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Year</label>
                                        <input
                                            type="number"
                                            className="w-24 bg-transparent border-0 text-sm font-bold text-slate-700 p-0 focus:ring-0"
                                            value={year}
                                            onChange={e => setYear(e.target.value)}
                                        />
                                    </div>
                                    <div className="w-px h-8 bg-slate-200"></div>
                                    <div className="px-2">
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Month</label>
                                        <select
                                            className="w-32 bg-transparent border-0 text-sm font-bold text-slate-700 p-0 focus:ring-0 cursor-pointer"
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

                            {loading ? (
                                <div className="p-16 text-center flex flex-col items-center justify-center">
                                    <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mb-4">
                                        <svg className="animate-spin h-8 w-8 text-indigo-500" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                    </div>
                                    <span className="text-sm font-bold text-slate-500 uppercase tracking-widest">Compiling Assets...</span>
                                </div>
                            ) : (
                                <div className="overflow-x-auto custom-scrollbar">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Employee Identity</th>
                                                <th className="px-6 py-4 text-right text-xs font-bold text-slate-400 uppercase tracking-wider">Account Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {users.map(u => (
                                                <tr key={u.id} className="hover:bg-indigo-50/30 transition-colors group">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-4">
                                                            <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center group-hover:bg-indigo-600 transition-colors">
                                                                <span className="text-indigo-600 font-bold group-hover:text-white transition-colors">{u.name[0]?.toUpperCase()}</span>
                                                            </div>
                                                            <div>
                                                                <div className="text-sm font-bold text-slate-900">{u.name}</div>
                                                                <div className="text-xs font-medium text-slate-500">{u.email}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <button
                                                                onClick={() => viewSlip(u)}
                                                                className="px-3 py-1.5 bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-indigo-600 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                                                            >
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                                </svg>
                                                                View
                                                            </button>
                                                            <button
                                                                onClick={() => downloadSlip(u)}
                                                                className="px-3 py-1.5 bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-indigo-600 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                                                            >
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                                                </svg>
                                                                Print
                                                            </button>
                                                            <div className="w-px h-5 bg-slate-200 mx-1"></div>
                                                            <button
                                                                onClick={() => generatePayslipForUser(u)}
                                                                disabled={!!generatingMap[u.id]}
                                                                className="px-3 py-1.5 bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-500 hover:text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                                                            >
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                                </svg>
                                                                {generatingMap[u.id] ? 'Generating...' : 'Form Slip'}
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

