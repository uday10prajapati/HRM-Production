import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

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

    useEffect(() => { fetchUsers(); }, []);

    async function fetchUsers() {
        setLoading(true);
        try {
            const res = await axios.get('/api/users');
            setUsers(res.data.users || res.data || []);
        } catch (err) {
            console.error('Failed to fetch users', err);
            setUsers([]);
        } finally { setLoading(false); }
    }

    function getRequesterHeaders() {
        const meRaw = localStorage.getItem('user');
        const me = meRaw ? JSON.parse(meRaw) : null;
        return me ? { 'X-User-Id': me.email } : {}; // Changed to use email
    }

    async function saveConfig() {
        if (!selectedUser) return alert('Select a user');
        try {
            const payload = { 
                userId: selectedUser.email || selectedUser, // Changed to use email
                basic: Number(config.basic||0), 
                hra: Number(config.hra||0), 
                allowances: config.allowances, 
                deductions: config.deductions 
            };
            const headers = getRequesterHeaders();
            await axios.post('/api/payroll/config', payload, { headers });
            alert('Saved');
        } catch (err) {
            console.error('Failed to save config', err);
            alert('Failed to save');
        }
    }

    // existing runPayroll kept, improved feedback
    async function runPayroll() {
        try {
            setGeneratingAll(true);
            const headers = getRequesterHeaders();
            const res = await axios.post('/api/payroll/run', { year: Number(year), month: Number(month) }, { headers });
            const summary = res.data.summary || res.data;
            alert(`Payroll run completed. Generated: ${summary.generated || 0}, Failed: ${summary.failed || 0}`);
        } catch (err) {
            console.error('Payroll run failed', err);
            alert('Payroll run failed');
        } finally {
            setGeneratingAll(false);
        }
    }

    // NEW: generate & save payslip for a single user (calls backend POST /api/payroll/generate-payslip/:userId/:year/:month)
    async function generatePayslipForUser(user) {
        const email = user?.email || user;
        if (!email) return alert('Invalid user');
        console.log('Generating payslip for:', email); // Debug log
        setGeneratingMap(m => ({ ...m, [email]: true }));
        try {
            const headers = getRequesterHeaders();
            console.log('Request headers:', headers); // Debug log
            const res = await axios.post(`/api/payroll/generate-payslip/${encodeURIComponent(email)}/${year}/${month}`, {}, { headers });
            alert(`Payslip generated for ${user.name || email}`);
        } catch (err) {
            console.error('Failed to generate payslip:', err.response?.data || err.message);
            alert(`Failed to generate payslip: ${err.response?.data?.error || err.message}`);
        } finally {
            setGeneratingMap(m => ({ ...m, [email]: false }));
        }
    }

    // modified downloadSlip to use email
    async function downloadSlip(user) {
        try {
            const headers = getRequesterHeaders();
            const res = await axios.get(`/api/payroll/slip/${encodeURIComponent(user.email)}/${year}/${month}`, { headers });
            const slip = res.data;
            const doc = new jsPDF();
            doc.setFontSize(12);
            doc.text(`Salary Slip - ${month}/${year}`, 14, 20);
            doc.text(`Employee: ${user.name} (${user.email})`, 14, 30);
            doc.text(`Basic: ₹${slip.basic}`, 14, 40);
            doc.text(`HRA: ₹${slip.hra}`, 14, 48);
            doc.text(`Gross: ₹${slip.gross}`, 14, 56);
            doc.text(`Deductions:`, 14, 66);
            const deductions = [
                ['PF', slip.pf || 0],
                ['ESI (Employee)', slip.esi_employee || 0],
                ['Professional Tax', slip.professional_tax || 0],
                ['TDS', slip.tds || 0]
            ];
            // add deductions table
            doc.autoTable({ startY: 72, head: [['Deduction', 'Amount']], body: deductions });
            doc.text(`Net Pay: ₹${slip.net_pay}`, 14, doc.lastAutoTable ? doc.lastAutoTable.finalY + 10 : 120);
            doc.save(`salary_slip_${user.email}_${year}_${month}.pdf`);
        } catch (err) {
            console.error('Failed to fetch slip', err);
            alert('Slip not available');
        }
    }

    // Update the viewSlip function
    async function viewSlip(user) {
        try {
            const headers = getRequesterHeaders();
            const pathRes = await axios.get(`/api/payroll/get-path/${encodeURIComponent(user.email)}/${year}/${month}`, { headers });
            
            if (pathRes.data?.path) {
                setPdfUrl(`http://localhost:5000/api/payroll/view-pdf?path=${encodeURIComponent(pathRes.data.path)}`);
                setShowPdfModal(true);
            } else {
                alert('Please generate the payslip first before viewing.');
            }
        } catch (err) {
            console.error('Failed to fetch/view slip:', err?.response?.data || err);
            alert('Payslip not found. Please generate it first.');
        }
    }

    // Add email validation
    function isValidEmail(email) {
        return email && typeof email === 'string' && email.includes('@');
    }

    // Add PDF Modal component
    function PdfModal({ url, onClose }) {
        if (!showPdfModal) return null;

        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white p-4 rounded-lg w-11/12 h-5/6 flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-semibold">Payslip PDF</h2>
                        <button 
                            onClick={onClose}
                            className="text-gray-500 hover:text-gray-700"
                        >
                            ✕
                        </button>
                    </div>
                    <div className="flex-1 bg-gray-100">
                        <iframe 
                            src={url}
                            className="w-full h-full"
                            title="PDF Viewer"
                        />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen flex-col">
            <Navbar />
            <div className="flex flex-1 bg-gray-50 min-h-screen">
                <Sidebar />
                <main className="flex-1 p-6">
                    <h1 className="text-2xl font-semibold mb-4">Payroll</h1>
                    <div className="bg-white rounded shadow p-4">
                        <div className="mb-3">
                            <label className="block text-sm">Select User</label>
                            <select 
                                className="border p-2 w-full" 
                                value={selectedUser?.email || selectedUser || ''} 
                                onChange={e => setSelectedUser(users.find(u => u.email === e.target.value) || e.target.value)}
                            >
                                <option value="">-- select --</option>
                                {users.map(u => (
                                    <option key={u.email} value={u.email}>{u.name} ({u.email})</option>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mb-3">
                            <div>
                                <label className="block text-sm">Basic</label>
                                <input className="border p-2 w-full" value={config.basic} onChange={e => setConfig(c => ({...c, basic: e.target.value}))} />
                            </div>
                            <div>
                                <label className="block text-sm">HRA</label>
                                <input className="border p-2 w-full" value={config.hra} onChange={e => setConfig(c => ({...c, hra: e.target.value}))} />
                            </div>
                        </div>

                        <div className="flex gap-2 mb-3">
                            <button onClick={saveConfig} className="px-3 py-1 bg-blue-600 text-white rounded">Save Config</button>
                            <button onClick={runPayroll} className="px-3 py-1 bg-green-600 text-white rounded" disabled={generatingAll}>
                                {generatingAll ? 'Running...' : 'Run Payroll (All)'}
                            </button>
                            {/* NEW: generate for selected user */}
                            <button 
                                onClick={() => {
                                    if (!selectedUser?.email || !isValidEmail(selectedUser.email)) {
                                        return alert('Please select a valid user with email');
                                    }
                                    generatePayslipForUser(selectedUser);
                                }} 
                                className="px-3 py-1 bg-yellow-600 text-white rounded"
                                disabled={!selectedUser?.email}
                            >
                                Generate Payslip (Selected)
                            </button>
                        </div>

                        <div className="mt-4">
                            <h3 className="font-semibold">Users</h3>
                            {loading ? <div>Loading...</div> : (
                                <table className="min-w-full text-sm">
                                    <thead><tr><th className="px-2 py-1">Name</th><th className="px-2 py-1">Email</th><th className="px-2 py-1">Actions</th></tr></thead>
                                    <tbody>
                                        {users.map(u => (
                                            <tr key={u.email} className="border-t">
                                                <td className="px-2 py-1">{u.name}</td>
                                                <td className="px-2 py-1">{u.email}</td>
                                                <td className="px-2 py-1 space-x-2">
                                                    <button 
                                                        onClick={() => viewSlip(u)} 
                                                        className="px-2 py-1 bg-blue-600 text-white rounded"
                                                    >
                                                        View PDF
                                                    </button>
                                                    <button 
                                                        onClick={() => downloadSlip(u)} 
                                                        className="px-2 py-1 bg-indigo-600 text-white rounded"
                                                    >
                                                        Download
                                                    </button>
                                                    <button 
                                                        onClick={() => generatePayslipForUser(u)} 
                                                        className="px-2 py-1 bg-orange-600 text-white rounded" 
                                                        disabled={!!generatingMap[u.email]}
                                                    >
                                                        {generatingMap[u.email] ? 'Generating...' : 'Generate'}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </main>
            </div>
            <PdfModal 
                url={pdfUrl} 
                onClose={() => {
                    setShowPdfModal(false);
                    setPdfUrl('');
                }} 
            />
        </div>
    );
}

