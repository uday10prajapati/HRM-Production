import React, { useEffect, useState } from 'react';
import axios from 'axios';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export default function Payroll() {
	const [users, setUsers] = useState([]);
	const [loading, setLoading] = useState(false);
	const [selectedUser, setSelectedUser] = useState(null);
	const [config, setConfig] = useState({ basic: '', hra: '', allowances: {}, deductions: {} });
	const [year, setYear] = useState(new Date().getFullYear());
	const [month, setMonth] = useState(new Date().getMonth() + 1);

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

	async function saveConfig() {
		if (!selectedUser) return alert('Select a user');
		try {
			const payload = { userId: selectedUser.id || selectedUser, basic: Number(config.basic||0), hra: Number(config.hra||0), allowances: config.allowances, deductions: config.deductions };
			const meRaw = localStorage.getItem('user');
			const me = meRaw ? JSON.parse(meRaw) : null;
			const headers = me ? { 'X-User-Id': me.id } : {};
			await axios.post('/api/payroll/config', payload, { headers });
			alert('Saved');
		} catch (err) {
			console.error('Failed to save config', err);
			alert('Failed to save');
		}
	}

	async function runPayroll() {
		try {
				const meRaw = localStorage.getItem('user');
				const me = meRaw ? JSON.parse(meRaw) : null;
				const headers = me ? { 'X-User-Id': me.id } : {};
				const res = await axios.post('/api/payroll/run', { year: Number(year), month: Number(month) }, { headers });
			alert(`Payroll run for ${res.data.month}/${res.data.year}, records: ${res.data.count}`);
		} catch (err) {
			console.error('Payroll run failed', err);
			alert('Payroll run failed');
		}
	}

	async function downloadSlip(user) {
		try {
			const meRaw = localStorage.getItem('user');
			const me = meRaw ? JSON.parse(meRaw) : null;
			const headers = me ? { 'X-User-Id': me.id } : {};
			const res = await axios.get(`/api/payroll/slip/${user.id}/${year}/${month}`, { headers });
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
			doc.save(`salary_slip_${user.id}_${year}_${month}.pdf`);
		} catch (err) {
			console.error('Failed to fetch slip', err);
			alert('Slip not available');
		}
	}

	return (
		<div className="p-6">
			<h1 className="text-2xl font-semibold mb-4">Payroll</h1>
			<div className="bg-white rounded shadow p-4">
				<div className="mb-3">
					<label className="block text-sm">Select User</label>
					<select className="border p-2 w-full" value={selectedUser?.id || selectedUser || ''} onChange={e => setSelectedUser(users.find(u => String(u.id) === String(e.target.value)) || e.target.value)}>
						<option value="">-- select --</option>
						{users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
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
					<button onClick={runPayroll} className="px-3 py-1 bg-green-600 text-white rounded">Run Payroll</button>
				</div>

				<div className="mt-4">
					<h3 className="font-semibold">Users</h3>
					{loading ? <div>Loading...</div> : (
						<table className="min-w-full text-sm">
							<thead><tr><th className="px-2 py-1">Name</th><th className="px-2 py-1">Email</th><th className="px-2 py-1">Actions</th></tr></thead>
							<tbody>
								{users.map(u => (
									<tr key={u.id} className="border-t">
										<td className="px-2 py-1">{u.name}</td>
										<td className="px-2 py-1">{u.email}</td>
										<td className="px-2 py-1"><button onClick={() => downloadSlip(u)} className="px-2 py-1 bg-indigo-600 text-white rounded">Download Slip</button></td>
									</tr>
								))}
							</tbody>
						</table>
					)}
				</div>
			</div>
		</div>
	);
}

