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
            // Use relative API path so same-origin is used
            setPdfUrl(`/api/payroll/view-pdf?path=${encodeURIComponent(slip.pdf.path)}`);
            setShowPdfModal(true);
        } else {
            alert('PDF not available for this payslip');
        }
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <Navbar />
            <div className="flex">
                <Sidebar />
                <main className="flex-1 p-8">
                    <div className="max-w-7xl mx-auto">
                        {/* Header */}
                        <div className="mb-8">
                            <h1 className="text-3xl font-bold text-gray-800">Payslips</h1>
                            <p className="mt-2 text-gray-600">View and manage employee payslips</p>
                        </div>

                        {loading ? (
                            <div className="flex items-center justify-center h-64">
                                <div className="flex items-center space-x-3">
                                    <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
                                    <span className="text-gray-600">Loading payslips...</span>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-8">
                                {records.map((record) => (
                                    <div key={record.user.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                        {/* Employee Header */}
                                        <div className="p-6 border-b border-gray-200">
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-center">
                                                    <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                                                        <span className="text-lg font-semibold text-blue-600">
                                                            {record.user.name[0].toUpperCase()}
                                                        </span>
                                                    </div>
                                                    <div className="ml-4">
                                                        <h2 className="text-xl font-semibold text-gray-800">{record.user.name}</h2>
                                                        <p className="text-gray-500">{record.user.email}</p>
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mt-1">
                                                            {record.user.role}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Salary Configuration */}
                                        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                                            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">
                                                Salary Configuration
                                            </h3>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                <div className="bg-white p-3 rounded-lg border border-gray-200">
                                                    <div className="text-sm text-gray-500">Basic Salary</div>
                                                    <div className="text-lg font-semibold text-gray-900">₹{record.salary_config.basic}</div>
                                                </div>
                                                <div className="bg-white p-3 rounded-lg border border-gray-200">
                                                    <div className="text-sm text-gray-500">HRA</div>
                                                    <div className="text-lg font-semibold text-gray-900">₹{record.salary_config.hra}</div>
                                                </div>
                                                <div className="bg-white p-3 rounded-lg border border-gray-200">
                                                    <div className="text-sm text-gray-500">Mode</div>
                                                    <div className="text-lg font-semibold text-gray-900 capitalize">{record.salary_config.salary_mode}</div>
                                                </div>
                                                {record.salary_config.hourly_rate && (
                                                    <div className="bg-white p-3 rounded-lg border border-gray-200">
                                                        <div className="text-sm text-gray-500">Hourly Rate</div>
                                                        <div className="text-lg font-semibold text-gray-900">₹{record.salary_config.hourly_rate}</div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Payslips Table */}
                                        <div className="px-6 py-4">
                                            {record.payslips && record.payslips.length > 0 ? (
                                                <div className="overflow-x-auto">
                                                    <table className="min-w-full divide-y divide-gray-200">
                                                        <thead>
                                                            <tr>
                                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Month/Year</th>
                                                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Basic</th>
                                                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">HRA</th>
                                                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Net Pay</th>
                                                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-200">
                                                            {record.payslips.map((slip) => (
                                                                <tr key={`${slip.year}-${slip.month}`} className="hover:bg-gray-50">
                                                                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{`${slip.month}/${slip.year}`}</td>
                                                                    <td className="px-4 py-3 text-sm text-gray-900 text-right">₹{slip.basic}</td>
                                                                    <td className="px-4 py-3 text-sm text-gray-900 text-right">₹{slip.hra}</td>
                                                                    <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">₹{slip.net_pay}</td>
                                                                    <td className="px-4 py-3 text-right">
                                                                        {slip.pdf?.has_pdf && (
                                                                            <button
                                                                                onClick={() => viewSlip(slip)}
                                                                                className="inline-flex items-center px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-sm font-medium transition-colors"
                                                                            >
                                                                                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                                                </svg>
                                                                                View
                                                                            </button>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            ) : (
                                                <div className="text-center py-8">
                                                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                    </svg>
                                                    <h3 className="mt-2 text-sm font-medium text-gray-900">No payslips</h3>
                                                    <p className="mt-1 text-sm text-gray-500">No payslips have been generated yet.</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                {records.length === 0 && (
                                    <div className="text-center py-12">
                                        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                                        </svg>
                                        <h3 className="mt-2 text-sm font-medium text-gray-900">No records found</h3>
                                        <p className="mt-1 text-sm text-gray-500">Get started by adding employee salary configurations.</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* PDF Modal */}
                    {showPdfModal && (
                        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                            <div className="bg-white rounded-xl shadow-xl w-11/12 h-5/6 flex flex-col">
                                <div className="flex items-center justify-between p-4 border-b border-gray-200">
                                    <h2 className="text-lg font-semibold text-gray-800">Payslip PDF</h2>
                                    <button 
                                        onClick={() => {
                                            setShowPdfModal(false);
                                            setPdfUrl('');
                                        }}
                                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                                    >
                                        <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                                <div className="flex-1 bg-gray-100 p-4">
                                    <iframe 
                                        src={pdfUrl}
                                        className="w-full h-full rounded-lg shadow-sm"
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