import React, { useEffect, useState } from "react";
import Navbar from "../../components/Navbar";
import Sidebar from "../../components/Sidebar";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const EmployeeDashboard = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [attendanceLoading, setAttendanceLoading] = useState(false);

  // Fetch employee data
  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await axios.get("/api/users/me");
      setProfile(res.data.user || res.data);
    } catch (err) {
      console.error("Failed to load profile:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  // Handle punch-in / punch-out (no location)
  const handlePunch = async (type) => {
    setAttendanceLoading(true);
    try {
      await axios.post("/api/attendance/punch", {
        userId: profile?.id,
        type,
      });

      alert(`Successfully punched ${type.toUpperCase()}`);
    } catch (err) {
      console.error("Punch error:", err);
      alert("Error while punching attendance.");
    } finally {
      setAttendanceLoading(false);
    }
  };

  if (loading) return <div>Loading employee dashboard...</div>;

  return (
    <div className="flex flex-col h-screen">
      <Navbar />
      <div className="flex flex-1 min-h-screen">
        {/* Sidebar for employee */}
        <Sidebar>
          <ul className="space-y-3 text-sm">
            <li>
              <button
                onClick={() => navigate("/employee/profile")}
                className="w-full text-left text-gray-700 hover:text-indigo-600"
              >
                My Profile
              </button>
            </li>
            <li>
              <button
                onClick={() => navigate("/employee/leave")}
                className="w-full text-left text-gray-700 hover:text-indigo-600"
              >
                Apply Leave
              </button>
            </li>
            <li>
              <button
                onClick={() => navigate("/employee/payslips")}
                className="w-full text-left text-gray-700 hover:text-indigo-600"
              >
                View Payslips
              </button>
            </li>
          </ul>
        </Sidebar>

        {/* Main Content */}
        <main className="flex-1 p-6 bg-gray-100 overflow-auto">
          <h1 className="text-2xl font-semibold mb-6">
            Welcome, {profile?.name || "Employee"}
          </h1>

          {/* Profile Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="p-4 bg-white rounded shadow">
              <div className="text-sm text-gray-500">Employee ID</div>
              <div className="text-2xl font-semibold">{profile?.id}</div>
            </div>

            <div className="p-4 bg-white rounded shadow">
              <div className="text-sm text-gray-500">Department</div>
              <div className="text-2xl font-semibold">{profile?.department || "-"}</div>
            </div>

            <div className="p-4 bg-white rounded shadow">
              <div className="text-sm text-gray-500">Role</div>
              <div className="text-2xl font-semibold capitalize">{profile?.role}</div>
            </div>

            <div className="p-4 bg-white rounded shadow">
              <div className="text-sm text-gray-500">Status</div>
              <div className="text-2xl font-semibold text-green-600">Active</div>
            </div>
          </div>

          {/* Quick access cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-white rounded shadow">
              <h3 className="font-semibold mb-2">Profile</h3>
              <p className="text-sm text-gray-600 mb-3">
                View or edit your personal information.
              </p>
              <button
                onClick={() => navigate("/employee/profile")}
                className="px-3 py-1 bg-indigo-600 text-white rounded text-sm"
              >
                View Profile
              </button>
            </div>

            <div className="p-4 bg-white rounded shadow">
              <h3 className="font-semibold mb-2">Leave Management</h3>
              <p className="text-sm text-gray-600 mb-3">
                Apply for leave and track approval status.
              </p>
              <button
                onClick={() => navigate("/employee/leave")}
                className="px-3 py-1 bg-green-600 text-white rounded text-sm"
              >
                Apply Leave
              </button>
            </div>

            <div className="p-4 bg-white rounded shadow">
              <h3 className="font-semibold mb-2">Payslips</h3>
              <p className="text-sm text-gray-600 mb-3">
                Access and download your monthly payslips.
              </p>
              <button
                onClick={() => navigate("/employee/payslips")}
                className="px-3 py-1 bg-yellow-600 text-white rounded text-sm"
              >
                View Payslips
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default EmployeeDashboard;
