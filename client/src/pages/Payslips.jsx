import React, { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import axios from 'axios';

export default function Payslips() {
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showPdfModal, setShowPdfModal] = useState(false);
    const [pdfUrl, setPdfUrl] = useState('');

    useEffect(() => {
        fetchRecords();
    }, []);

    async function fetchRecords() {
        setLoading(true);
        try {
            const res = await axios.get('/api/payroll/payslip-details');
            console.log('Fetched data:', res.data);
            setRecords(res.data.data || []);
        } catch (err) {
            console.error('Failed to fetch payslips:', err);
            setRecords([]);
        } finally {
            setLoading(false);
        }
    }

    async function viewSlip(slip) {
        if (slip?.pdf?.path) {
            // Use absolute URL with backend port
            setPdfUrl(`http://localhost:5000/api/payroll/view-pdf?path=${encodeURIComponent(slip.pdf.path)}`);
            setShowPdfModal(true);
        } else {
            alert('PDF not available for this payslip');
        }
    }

    return (
        <div className="flex flex-col h-screen">
            <Navbar />
            <div className="flex flex-1">
                <Sidebar />
                <main className="flex-1 p-6 bg-gray-100">
                    <h1 className="text-2xl font-semibold mb-4">Payslips</h1>
                    
                    {loading ? (
                        <div className="text-center py-4">Loading...</div>
                    ) : (
                        <div className="space-y-6">
                            {records.map((record) => (
                                <div key={record.user.id} className="bg-white rounded-lg shadow p-4">
                                    <div className="border-b pb-2 mb-4">
                                        <h2 className="text-lg font-semibold">{record.user.name}</h2>
                                        <p className="text-gray-600">{record.user.email}</p>
                                        <p className="text-gray-500">Role: {record.user.role}</p>
                                    </div>

                                    <div className="mb-4">
                                        <h3 className="font-medium mb-2">Salary Configuration</h3>
                                        <div className="grid grid-cols-2 gap-2 text-sm">
                                            <p>Basic: ₹{record.salary_config.basic}</p>
                                            <p>HRA: ₹{record.salary_config.hra}</p>
                                            <p>Mode: {record.salary_config.salary_mode}</p>
                                            {record.salary_config.hourly_rate && (
                                                <p>Hourly Rate: ₹{record.salary_config.hourly_rate}</p>
                                            )}
                                        </div>
                                    </div>

                                    {record.payslips && record.payslips.length > 0 ? (
                                        <table className="min-w-full text-sm">
                                            <thead>
                                                <tr className="border-b">
                                                    <th className="text-left py-2">Month/Year</th>
                                                    <th className="text-right">Basic</th>
                                                    <th className="text-right">HRA</th>
                                                    <th className="text-right">Net Pay</th>
                                                    <th className="text-right">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {record.payslips.map((slip) => (
                                                    <tr key={`${slip.year}-${slip.month}`} className="border-b">
                                                        <td className="py-2">{`${slip.month}/${slip.year}`}</td>
                                                        <td className="text-right">₹{slip.basic}</td>
                                                        <td className="text-right">₹{slip.hra}</td>
                                                        <td className="text-right">₹{slip.net_pay}</td>
                                                        <td className="text-right">
                                                            {slip.pdf?.has_pdf && (
                                                                <button
                                                                    onClick={() => viewSlip(slip)}
                                                                    className="px-3 py-1 bg-blue-600 text-white rounded"
                                                                >
                                                                    View PDF
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    ) : (
                                        <p className="text-gray-500 text-center py-4">No payslips available</p>
                                    )}
                                </div>
                            ))}

                            {records.length === 0 && !loading && (
                                <div className="text-center py-8 text-gray-500">
                                    No records found
                                </div>
                            )}
                        </div>
                    )}

                    {showPdfModal && (
                        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                            <div className="bg-white p-4 rounded-lg w-11/12 h-5/6 flex flex-col">
                                <div className="flex justify-between items-center mb-4">
                                    <h2 className="text-xl font-semibold">Payslip PDF</h2>
                                    <button 
                                        onClick={() => {
                                            setShowPdfModal(false);
                                            setPdfUrl('');
                                        }}
                                        className="text-gray-500 hover:text-gray-700"
                                    >
                                        ✕
                                    </button>
                                </div>
                                <div className="flex-1 bg-gray-100">
                                    <iframe 
                                        src={pdfUrl}
                                        className="w-full h-full"
                                        title="PDF Viewer"
                                        type="application/pdf"
                                        style={{ border: 'none' }}
                                        allow="fullscreen"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}
