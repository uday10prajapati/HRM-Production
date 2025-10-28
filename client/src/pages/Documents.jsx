import React, { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import axios from 'axios';

export default function Documents() {
  const [counts, setCounts] = useState([]);

  useEffect(() => { fetchCounts(); }, []);

  async function fetchCounts() {
    try {
      const res = await axios.get('/api/documents/counts');
      setCounts(res.data.counts || []);
    } catch (err) {
      console.error('Failed to fetch document counts', err);
      setCounts([]);
    }
  }

  return (
    <div className="flex flex-col h-screen">
      <Navbar />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 p-6 bg-gray-100">
          <h1 className="text-2xl font-semibold mb-4">Documents</h1>
          <div className="bg-white rounded shadow p-4">
            {counts.length === 0 ? <div className="text-gray-500">No documents</div> : (
              <table className="min-w-full">
                <thead><tr><th className="px-2 py-1">User ID</th><th className="px-2 py-1">Count</th></tr></thead>
                <tbody>
                  {counts.map(c => (
                    <tr key={c.user_id}><td className="px-2 py-1">{c.user_id}</td><td className="px-2 py-1">{c.count}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}