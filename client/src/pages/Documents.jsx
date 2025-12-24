import React, { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import axios from 'axios';

axios.defaults.baseURL = 'https://hrm-production.onrender.com';

export default function ViewAssignedCalls() {
  const [assignedCalls, setAssignedCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCall, setSelectedCall] = useState(null);

  useEffect(() => {
    fetchAssignedCalls();
  }, []);

  const fetchAssignedCalls = async () => {
    try {
      setLoading(true);

      const response = await axios.get('/api/service-calls/assigned-calls', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.data.success) {
        setAssignedCalls(response.data.calls);
      } else {
        setError('Failed to fetch assigned calls');
      }
    } catch (error) {
      console.error('Error fetching assigned calls:', error);
      setError(error.response?.data?.message || 'Failed to fetch assigned calls');
    } finally {
      setLoading(false);
    }
  };

  const filteredCalls = assignedCalls.filter(call =>
    call.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    call.dairy_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    call.problem?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    call.status?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <Navbar />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 p-8">
          <div className="max-w-7xl mx-auto">

            {/* Header */}
            <div className="flex justify-between items-center mb-8">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Assigned Service Calls</h1>
                <p className="mt-1 text-sm text-gray-500">
                  View and manage all assigned service calls
                </p>
              </div>
              <div className="flex items-center gap-4">
                <input
                  type="text"
                  placeholder="Search calls..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg"
                />
                <button
                  onClick={fetchAssignedCalls}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Refresh
                </button>
              </div>
            </div>

            {/* Content */}
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
              </div>
            ) : error ? (
              <div className="text-center py-12 bg-white rounded-lg shadow">
                <h3 className="text-lg font-medium text-gray-900">Error</h3>
                <p className="mt-1 text-sm text-red-500">{error}</p>
              </div>
            ) : assignedCalls.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg shadow">
                <h3 className="text-lg font-medium text-gray-900">No Assigned Calls</h3>
                <p className="mt-1 text-sm text-gray-500">No calls assigned yet.</p>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Engineer</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dairy Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Problem</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredCalls.map((call) => (
                      <tr key={call.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm text-gray-900">{call.name}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{call.dairy_name}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{call.problem}</td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded-full ${
                              call.status === 'completed'
                                ? 'bg-green-100 text-green-800'
                                : call.status === 'in_progress'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {call.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm font-medium">
                          <button
                            onClick={() => setSelectedCall(call)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            View
                          </button>
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

      {/* View Details Modal */}
      {selectedCall && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Call Details</h2>

            <p><strong>Engineer:</strong> {selectedCall.name}</p>
            <p><strong>Dairy:</strong> {selectedCall.dairy_name}</p>
            <p><strong>Problem:</strong> {selectedCall.problem}</p>
            <p><strong>Description:</strong> {selectedCall.description}</p>
            <p><strong>Status:</strong> {selectedCall.status}</p>
            <p><strong>Created:</strong> {new Date(selectedCall.created_at).toLocaleString()}</p>

            <div className="text-right mt-6">
              <button
                onClick={() => setSelectedCall(null)}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
