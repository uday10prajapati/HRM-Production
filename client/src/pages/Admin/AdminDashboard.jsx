import React, { useEffect, useState } from 'react';
import Navbar from '../../components/Navbar';
import Sidebar from '../../components/Sidebar';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const Admin = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [docsCount, setDocsCount] = useState(0);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/users/');
      const all = res.data.users || res.data || [];
      setUsers(all);

      // documents count (simple approach: fetch all users' documents counts)
      try {
        let totalDocs = 0;
        for (const u of all) {
          const d = await axios.get(`/api/documents/user/${u.id}`);
          totalDocs += (d.data.documents || []).length;
        }
        setDocsCount(totalDocs);
      } catch (err) {
        console.warn('Failed to fetch documents count', err);
      }
    } catch (err) {
      console.error('Failed to load admin data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalUsers = users.length;
  const totalEngineers = users.filter(u => (u.role || '').toLowerCase() === 'engineer').length;
  const totalPendingTasks = users.reduce((acc, u) => acc + ((u.tasks || []).filter(t => (t.status || '').toLowerCase() !== 'completed').length), 0);

  return (
    <div className="flex flex-col h-screen">
      <Navbar />
      <div className="flex flex-1 min-h-screen">
        <Sidebar />
        <main className="flex-1 p-6 bg-gray-100 overflow-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
            <div className="flex gap-2">
              <button onClick={() => navigate('/all-users')} className="px-3 py-2 bg-green-600 text-white rounded">Manage Users</button>
              <button onClick={() => navigate('/reports')} className="px-3 py-2 bg-indigo-600 text-white rounded">Reports</button>
            </div>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="p-4 bg-white rounded shadow">
              <div className="text-sm text-gray-500">Total users</div>
              <div className="text-2xl font-semibold">{totalUsers}</div>
            </div>

            <div className="p-4 bg-white rounded shadow">
              <div className="text-sm text-gray-500">Pending tasks</div>
              <div className="text-2xl font-semibold">{totalPendingTasks}</div>
            </div>

            <div className="p-4 bg-white rounded shadow">
              <div className="text-sm text-gray-500">Documents</div>
              <div className="text-2xl font-semibold">{docsCount}</div>
            </div>

            <div className="p-4 bg-white rounded shadow">
              <div className="text-sm text-gray-500">Engineers</div>
              <div className="text-2xl font-semibold">{totalEngineers}</div>
            </div>
          </div>

          {/* Recent users table */}
          {/* Modules overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="p-4 bg-white rounded shadow">
              <h3 className="font-semibold mb-2">Core HR Management</h3>
              <p className="text-sm text-gray-600 mb-3">Employee database, onboarding/offboarding, document management.</p>
              <div className="flex gap-2">
                <button onClick={() => navigate('/all-users')} className="px-3 py-1 bg-green-600 text-white rounded text-sm">Employees</button>
                <button onClick={() => navigate('/documents')} className="px-3 py-1 bg-gray-200 rounded text-sm">Documents</button>
              </div>
            </div>

            <div className="p-4 bg-white rounded shadow">
              <h3 className="font-semibold mb-2">Field Service Management (FSM)</h3>
              <p className="text-sm text-gray-600 mb-3">Call assignment, live tracking, task lifecycle management.</p>
              <div className="flex gap-2">
                <button onClick={() => navigate('/engineer/tasks')} className="px-3 py-1 bg-indigo-600 text-white rounded text-sm">Assign Calls</button>
                <button onClick={() => navigate('/map')} className="px-3 py-1 bg-gray-200 rounded text-sm">Live Map</button>
              </div>
            </div>

            <div className="p-4 bg-white rounded shadow">
              <h3 className="font-semibold mb-2">Payroll & Compliance</h3>
              <p className="text-sm text-gray-600 mb-3">Salary slips, statutory reports, Form16 generation.</p>
              <div className="flex gap-2">
                <button onClick={() => navigate('/payroll')} className="px-3 py-1 bg-yellow-600 text-white rounded text-sm">Payroll</button>
                <button onClick={() => navigate('/reports/payroll')} className="px-3 py-1 bg-gray-200 rounded text-sm">Compliance</button>
              </div>
            </div>
          </div>

          {/* Secondary modules */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="p-4 bg-white rounded shadow">
              <h4 className="font-medium">Time & Attendance</h4>
              <p className="text-xs text-gray-500">Punch-in/out, shift management, overtime.</p>
              <div className="mt-2">
                <button onClick={() => navigate('/attendance')} className="px-2 py-1 bg-indigo-600 text-white rounded text-sm">Attendance</button>
              </div>
            </div>

            <div className="p-4 bg-white rounded shadow">
              <h4 className="font-medium">Leave Management</h4>
              <p className="text-xs text-gray-500">Apply/approve leaves, balance tracking.</p>
              <div className="mt-2">
                <button onClick={() => navigate('/leave')} className="px-2 py-1 bg-green-600 text-white rounded text-sm">Manage Leaves</button>
              </div>
            </div>

            <div className="p-4 bg-white rounded shadow">
              <h4 className="font-medium">Inventory & Stock</h4>
              <p className="text-xs text-gray-500">Central and engineer stock, consumption, alerts.</p>
              <div className="mt-2">
                <button onClick={() => navigate('/inventory')} className="px-2 py-1 bg-gray-700 text-white rounded text-sm">Inventory</button>
              </div>
            </div>

            <div className="p-4 bg-white rounded shadow">
              <h4 className="font-medium">Roles & Permissions</h4>
              <p className="text-xs text-gray-500">Manage user roles and access control.</p>
              <div className="mt-2">
                <button onClick={() => navigate('/roles')} className="px-2 py-1 bg-gray-200 rounded text-sm">Manage Roles</button>
              </div>
            </div>
          </div>
          <div className="bg-white rounded shadow p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-medium">Recent users</h2>
              <button onClick={() => navigate('/all-users')} className="text-sm text-indigo-600 hover:underline">View all</button>
            </div>

            {loading ? (
              <div>Loading...</div>
            ) : users.length === 0 ? (
              <div className="text-gray-500">No users</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">ID</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Name</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Email</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Role</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Tasks</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {users.slice(0, 10).map(u => (
                      <tr key={u.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-sm">{u.id}</td>
                        <td className="px-4 py-2 text-sm">{u.name}</td>
                        <td className="px-4 py-2 text-sm">{u.email}</td>
                        <td className="px-4 py-2 text-sm capitalize">{u.role}</td>
                        <td className="px-4 py-2 text-sm">{(u.tasks || []).length}</td>
                        <td className="px-4 py-2 text-sm flex gap-2">
                          <button onClick={() => navigate('/all-users')} className="text-indigo-600 hover:underline">Edit</button>
                          <button onClick={() => navigate('/all-users')} className="text-red-600 hover:underline">Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Admin;
