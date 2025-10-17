import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Sidebar from "../../components/Sidebar";
import Navbar from "../../components/Navbar";
import ProfileModal from "../../components/modals/ProfileModal";

// ✅ Setup backend base URL from .env
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
axios.defaults.baseURL = API_BASE_URL;

const EngineerDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [savingTask, setSavingTask] = useState(null);

  // ✅ Fetch user and tasks from backend
  const fetchUser = useCallback(async (userId) => {
    if (!userId) return;
    try {
      setLoading(true);
      setError(null);

      console.log("Fetching engineer:", userId);
      const res = await axios.get(`/api/users/${userId}`);
      console.log("Backend response:", res.data);

      const payload = res.data.user || res.data;
      setUserData(payload);
    } catch (err) {
      console.error("Failed to fetch engineer data:", err);
      setError("Failed to load your data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  // ✅ Initial setup and polling
  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (!stored) {
      navigate("/login");
      return;
    }

  const parsed = JSON.parse(stored);
  setUser(parsed);
  const normalizedId = parsed.id || parsed._id || parsed.userId || null;
  setUserId(normalizedId);

    // Normalize id (backend might return id or _id)
    const userId = parsed.id || parsed._id || parsed.userId || null;

    if (!parsed.role || parsed.role.toLowerCase() !== "engineer") {
      navigate("/login");
      return;
    }

    if (!normalizedId) {
      // missing id — force re-login
      console.warn("EngineerDashboard: missing user id in localStorage user", parsed);
      setLoading(false);
      navigate("/login");
      return;
    }

    fetchUser(normalizedId);
    const interval = setInterval(() => fetchUser(normalizedId), 15000); // refresh every 15s
    return () => clearInterval(interval);
  }, [navigate, fetchUser]);

  // ✅ Update task status
  const toggleTaskStatus = async (taskId, newStatus) => {
    if (!user || !userData) return;
    setSavingTask(taskId);

    const optimistic = (userData.tasks || []).map((t) =>
      t.id === taskId || t.id === Number(taskId)
        ? { ...t, status: newStatus }
        : t
    );
    setUserData({ ...userData, tasks: optimistic });

    try {
      const res = await axios.put(`/api/users/tasks/${taskId}`, { status: newStatus });
      // If server returned updated user, use it to sync immediately
      if (res.data && res.data.user) {
        setUserData(res.data.user);
      } else {
        const idToFetch = userId || user.id || user._id;
        await fetchUser(idToFetch);
      }
    } catch (err) {
      console.error("Failed to update task:", err);
      const serverMsg = err?.response?.data?.message || err?.response?.data?.error || err.message;
      alert(`Could not update task: ${serverMsg}`);
      const idToFetch = userId || user.id || user._id;
      await fetchUser(idToFetch);
    } finally {
      setSavingTask(null);
    }
  };

  if (!user) return null;

  return (
    <div className="flex flex-col h-screen">
      {/* Navbar spans full width on top */}
      <Navbar />

      <div className="flex flex-1 min-h-screen">
        {/* Sidebar on the left (below navbar) */}
        <Sidebar />

        {/* Main content area on the right */}
        <main className="p-6 bg-gray-100 flex-1 overflow-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-semibold text-gray-800">
                Hello, {user.name}
              </h1>
              <p className="text-sm text-gray-600">
                Welcome to your engineer dashboard
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setIsProfileOpen(true)}
                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
              >
                My Profile
              </button>
            </div>
          </div>

          {/* Profile Modal */}
          {isProfileOpen && (
            <ProfileModal
              user={user}
              userData={userData}
              onClose={() => setIsProfileOpen(false)}
            />
          )}

          {/* Loading / Error Handling */}
          {loading ? (
            <div className="text-gray-600">Loading...</div>
          ) : (
            <>
              {error && (
                <div className="text-sm text-red-600 mb-4">{error}</div>
              )}

              {/* User Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                <div className="p-4 bg-white rounded shadow flex flex-col">
                  <span className="text-sm text-gray-500">Pending Tasks</span>
                  <div className="mt-2 text-2xl font-semibold text-gray-800">
                    {((userData?.tasks || []).filter(t => (t.status || '').toLowerCase() !== 'completed')).length}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Tasks awaiting completion
                  </div>
                </div>

                <div className="p-4 bg-white rounded shadow flex flex-col">
                  <span className="text-sm text-gray-500">Leave Balance</span>
                  <div className="mt-2 text-2xl font-semibold text-gray-800">
                    {userData?.leave_balance ?? "N/A"}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Remaining leave days
                  </div>
                </div>

                <div className="p-4 bg-white rounded shadow flex flex-col">
                  <span className="text-sm text-gray-500">Attendance</span>
                  <div className="mt-2 text-2xl font-semibold text-gray-800">
                    {userData?.attendance_status ?? "N/A"}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Today's attendance status
                  </div>
                </div>
              </div>

              {/* Task Overview */}
              <div className="bg-white rounded shadow p-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">
                    Tasks
                  </h2>
                  <div className="text-sm text-gray-600">
                    {((userData?.tasks || []).filter(t => (t.status || '').toLowerCase() !== 'completed')).length} pending • {(userData?.tasks || []).length} total
                  </div>
                </div>
                <div>
                  <button
                    onClick={() => navigate("/engineer/tasks")}
                    className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                  >
                    View Tasks
                  </button>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  onClick={() =>
                    alert("Feature: Update Attendance (coming soon)")
                  }
                  className="w-full p-3 bg-white rounded shadow hover:shadow-md text-left"
                >
                  <div className="font-medium">Update Attendance</div>
                  <div className="text-sm text-gray-500 mt-1">
                    Mark your attendance for today
                  </div>
                </button>

                <button
                  onClick={() => navigate("/leave")}
                  className="w-full p-3 bg-white rounded shadow hover:shadow-md text-left"
                >
                  <div className="font-medium">Request Leave</div>
                  <div className="text-sm text-gray-500 mt-1">
                    Submit a new leave request
                  </div>
                </button>

                <button
                  onClick={() => navigate("/engineer/tasks")}
                  className="w-full p-3 bg-white rounded shadow hover:shadow-md text-left"
                >
                  <div className="font-medium">My Tasks</div>
                  <div className="text-sm text-gray-500 mt-1">
                    View and manage your assigned tasks
                  </div>
                </button>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default EngineerDashboard;
