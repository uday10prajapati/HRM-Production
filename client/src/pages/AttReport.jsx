import React, { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import axios from "axios";

function AttReports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

  useEffect(() => {
    fetchReports();
  }, []);

  const getAuthHeaders = () => {
    const raw = localStorage.getItem("user");
    if (!raw) return {};
    try {
      const user = JSON.parse(raw);
      const id = user?.id || user?.userId;
      return { "x-user-id": id };
    } catch {
      return {};
    }
  };

  const fetchReports = async () => {
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      const res = await axios.get(`${API_URL}/api/corrections`, { headers });

      const data = res.data?.rows || res.data || [];
      setReports(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("❌ Failed to load reports:", err);
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Navbar />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 p-8">
          <div className="max-w-6xl mx-auto">
            <h1 className="text-2xl font-bold mb-6 text-gray-800">
              Attendance Correction Reports
            </h1>

            {loading ? (
              <div className="text-center py-10 text-gray-600">
                Loading reports...
              </div>
            ) : reports.length === 0 ? (
              <div className="text-center py-10 text-gray-600">
                No correction reports found.
              </div>
            ) : (
              <div className="bg-white shadow rounded-xl border border-gray-200 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        User ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Report Text
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {reports.map((r) => (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm text-gray-700">{r.id}</td>
                        <td className="px-6 py-4 text-sm text-gray-700">{r.user_id}</td>
                        <td className="px-6 py-4 text-sm text-gray-700">
                          {r.name || "—"}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700 max-w-xs break-words">
                          {r.report_text}
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
}

export default AttReports;
