import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Sidebar from "../../components/Sidebar";
import Navbar from "../../components/Navbar";
import ProfileModal from "../../components/modals/ProfileModal";
const EngineerStock = React.lazy(() => import('../Inovetry/EngineerStock'));

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
    // --- Fix missing states ---
  const [todayPunch, setTodayPunch] = useState({ punch_in: null, punch_out: null });
  const [attendanceLoading, setAttendanceLoading] = useState(false);

  const [leaves, setLeaves] = useState([]);
  const [leavesLoading, setLeavesLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);


  // --- NEW: leave modal state for engineer to apply for leave ---
  const [isLeaveOpen, setIsLeaveOpen] = useState(false);
  const [leaveFrom, setLeaveFrom] = useState("");
  const [leaveTo, setLeaveTo] = useState("");
  const [leaveType, setLeaveType] = useState("annual");
  const [leaveReason, setLeaveReason] = useState("");
  const [leaveSubmitting, setLeaveSubmitting] = useState(false);
  const [leaveMessage, setLeaveMessage] = useState("");

  const [assignedShift, setAssignedShift] = useState(null);
  const [assignedShiftTomorrow, setAssignedShiftTomorrow] = useState(null);
  // leave list state (for displaying user's leave requests)
  const [totalWorkDays, setTotalWorkDays] = useState(0);
  const [totalLeaveDays, setTotalLeaveDays] = useState(0);
  const [monthlyOvertimeSeconds, setMonthlyOvertimeSeconds] = useState(0);

  function getStoredUserId() {
    try {
      const raw = localStorage.getItem("user") || localStorage.getItem("currentUser");
      if (!raw) return null;
      const p = JSON.parse(raw);
      const u = p?.user ?? p?.data ?? p;
      return u?.id ?? u?.userId ?? u?._id ?? null;
    } catch { return null; }
  }

  async function fetchAssignedShiftFor(dateIso = null, idParam = null) {
    const id = idParam ?? userId ?? getStoredUserId();
    const date = dateIso ?? new Date().toISOString().slice(0, 10);
    // decide which state to update (today vs tomorrow)
    const targetIsTomorrow = Boolean(dateIso);
    if (!id) {
      if (targetIsTomorrow) setAssignedShiftTomorrow(null); else setAssignedShift(null);
      return;
    }
    try {
      const res = await axios.get(`/api/shifts/assignments?date=${encodeURIComponent(date)}&userId=${encodeURIComponent(id)}`);
      const data = Array.isArray(res.data) && res.data.length ? res.data[0] : null;
      if (targetIsTomorrow) setAssignedShiftTomorrow(data); else setAssignedShift(data);
    } catch (err) {
      console.error("Failed to fetch assigned shift:", err?.response?.data ?? err);
      if (targetIsTomorrow) setAssignedShiftTomorrow(null); else setAssignedShift(null);
    }
  }

  function tomorrowDate() {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }

  // fetch leave records for this engineer
  async function fetchLeaves() {
    const id = userId ?? getStoredUserId();
    if (!id) return;
    setLeavesLoading(true);
    setFetchError(null);
    try {
      const res = await axios.get(`/api/leave`, { params: { userId: id } });
      const list = Array.isArray(res.data) && res.data.length ? res.data : res.data?.leaves ?? res.data?.data ?? [];
      setLeaves(list);
    } catch (err) {
      console.error('Failed to fetch leaves (engineer):', err);
      setFetchError('Failed to load leave records');
      setLeaves([]);
    } finally {
      setLeavesLoading(false);
    }
  }

  // attendance helpers
  function monthRangeForDate(d = new Date()) {
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const fmt = (dt) => dt.toISOString().slice(0, 10);
    return { start: fmt(start), end: fmt(end) };
  }

  function countOverlapDays(aStart, aEnd, bStart, bEnd) {
    const s = new Date(Math.max(new Date(aStart), new Date(bStart)));
    const e = new Date(Math.min(new Date(aEnd), new Date(bEnd)));
    if (e < s) return 0;
    return Math.floor((e - s) / (1000 * 60 * 60 * 24)) + 1;
  }

  function formatTime(ts) {
    if (!ts) return "—";
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return String(ts);
    }
  }

  async function fetchMonthlyStats() {
    const id = userId ?? getStoredUserId();
    if (!id) return;
    try {
      const { start, end } = monthRangeForDate();
      const attRes = await axios.get(`/api/attendance/report`, { params: { userId: id, start, end } });
      const attList = Array.isArray(attRes.data) ? attRes.data : attRes.data?.rows ?? [];
      const workedCount = Array.isArray(attList) ? attList.filter(r => r.punch_in).length : 0;

      const leaveRes = await axios.get(`/api/leave`, { params: { userId: id } });
      const leaveList = Array.isArray(leaveRes.data) ? leaveRes.data : leaveRes.data?.leaves ?? leaveRes.data?.data ?? [];

      let leaveDays = 0;
      leaveList.forEach(lv => {
        const lStart = lv.startDate ?? lv.start_date ?? lv.start;
        const lEnd = lv.endDate ?? lv.end_date ?? lv.end;
        if (!lStart || !lEnd) return;
        leaveDays += countOverlapDays(lStart, lEnd, start, end);
      });

      setTotalWorkDays(workedCount);
      setTotalLeaveDays(leaveDays);
    } catch (err) {
      console.error("Failed to fetch engineer monthly stats:", err);
    }
  }

  async function fetchMonthlyOvertime() {
    const id = userId ?? getStoredUserId();
    if (!id) return;
    try {
      const { start, end } = monthRangeForDate();
      const res = await axios.get('/api/overtime', { params: { userId: id, start, end } });
      const rows = Array.isArray(res.data) ? res.data : res.data?.rows ?? res.data;
      const sum = (rows || []).reduce((acc, r) => acc + (Number(r.overtime_seconds || 0)), 0);
      setMonthlyOvertimeSeconds(sum);
    } catch (err) {
      console.error('Failed to fetch monthly overtime', err);
      setMonthlyOvertimeSeconds(0);
    }
  }

  async function fetchTodayAttendance() {
    const id = userId ?? getStoredUserId();
    if (!id) return;
    try {
      const today = new Date().toISOString().slice(0, 10);
      const res = await axios.get(`/api/attendance/report`, { params: { userId: id, start: today, end: today } });
      const rows = Array.isArray(res.data) ? res.data : res.data?.rows ?? [];
      const r = rows[0] ?? null;
      setTodayPunch({ punch_in: r?.punch_in ?? null, punch_out: r?.punch_out ?? null });
    } catch (err) {
      console.error("Failed to fetch today's attendance (engineer)", err);
    }
  }

  const handlePunch = async (type) => {
    const id = userId ?? getStoredUserId();
    if (!id) { alert('User not found'); return; }
    if (type === 'in' && todayPunch?.punch_in) { alert('Already punched in'); return; }
    if (type === 'out' && !todayPunch?.punch_in) { alert('Punch in first'); return; }
    // optimistic UI: set today's punch and increment work days on punch-in
    const wasPunchedIn = Boolean(todayPunch?.punch_in);
    const nowIso = new Date().toISOString().replace('T', ' ').split('.')[0];
    const newToday = { ...(todayPunch || {}), ...(type === 'in' ? { punch_in: nowIso } : { punch_out: nowIso }) };
    setTodayPunch(newToday);
    try { localStorage.setItem(`att_today_${id}`, JSON.stringify({ date: new Date().toISOString().slice(0,10), ...newToday })); } catch {}
    if (type === 'in' && !wasPunchedIn) {
      setTotalWorkDays(s => {
        const next = Number(s || 0) + 1;
        try { localStorage.setItem(`att_workdays_${id}`, String(next)); } catch {}
        return next;
      });
    }

    setAttendanceLoading(true);
    try {
      const res = await axios.post('/api/attendance/punch', { userId: id, type });
      const att = res?.data?.attendance ?? res?.data;
      if (att && att.created_at) {
        setTodayPunch(prev => ({ ...prev, ...(type === 'in' ? { punch_in: att.created_at } : { punch_out: att.created_at }) }));
      }
      // reconcile canonical state
      await fetchTodayAttendance();
      await fetchMonthlyStats();
  await fetchMonthlyOvertime();
      await fetchLeaves();
      alert(res?.data?.message ?? 'Saved');
    } catch (err) {
      console.error('Engineer punch error', err);
      alert(err?.response?.data?.message ?? err.message ?? 'Punch failed');
      // revert optimistic increment if needed
      if (type === 'in' && !wasPunchedIn) setTotalWorkDays(s => {
        const next = Math.max(0, Number(s || 0) - 1);
        try { localStorage.setItem(`att_workdays_${id}`, String(next)); } catch {}
        return next;
      });
      // re-sync
      await fetchTodayAttendance();
      await fetchMonthlyStats();
  await fetchMonthlyOvertime();
      await fetchLeaves();
    } finally { setAttendanceLoading(false); }
  };

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
      // improved error message for network vs server error
      const serverMsg = err?.response?.data?.message ?? err?.message ?? "Network error";
      setError(String(serverMsg));
      // optionally fallback to localStorage if available
      try {
        const raw = localStorage.getItem("user");
        if (raw && !userData) {
          const parsed = JSON.parse(raw);
          const normalizedId = parsed.id || parsed._id || parsed.userId || null;
          if (String(normalizedId) === String(userId)) {
            setUserData(parsed);
          }
        }
      } catch (e) {
        // ignore
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // removed: fetchToday'sAttendanceEngineer

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

    if (!parsed.role || parsed.role.toLowerCase() !== "engineer") {
      navigate("/login");
      return;
    }

    if (!normalizedId) {
      console.warn("EngineerDashboard: missing user id in localStorage user", parsed);
      setLoading(false);
      navigate("/login");
      return;
    }

    // first attempt to fetch; on network error, user will see message + can retry
    fetchUser(normalizedId);
    // explicitly fetch assignments using the resolved normalizedId (avoid race with state updates)
    fetchAssignedShiftFor(null, normalizedId); // today's assignment
    fetchAssignedShiftFor(tomorrowDate(), normalizedId); // tomorrow's assignment
    // restore optimistic attendance state if present
    try {
      const saved = localStorage.getItem(`att_today_${normalizedId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        const today = new Date().toISOString().slice(0,10);
        if (parsed?.date === today) setTodayPunch({ punch_in: parsed.punch_in ?? null, punch_out: parsed.punch_out ?? null });
      }
      const savedWork = localStorage.getItem(`att_workdays_${normalizedId}`);
      if (savedWork) setTotalWorkDays(Number(savedWork));
    } catch (e) {
      // ignore
    }

    // fetch attendance & leave related stats for engineer
    fetchLeaves();
    fetchMonthlyStats();
    fetchMonthlyOvertime();
    fetchTodayAttendance();
    const interval = setInterval(() => fetchUser(normalizedId), 15000);
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

  // NEW: submit leave request
  const handleLeaveSubmit = async (e) => {
    e.preventDefault();
    setLeaveMessage("");
    if (!userId && !user?.id) {
      setLeaveMessage("User not found. Please login.");
      return;
    }
    if (!leaveFrom || !leaveTo) {
      setLeaveMessage("Please select from and to dates.");
      return;
    }
    if (new Date(leaveTo) < new Date(leaveFrom)) {
      setLeaveMessage("End date must be same or after start date.");
      return;
    }

    setLeaveSubmitting(true);
    try {
      const payload = {
        userId: userId ?? user?.id ?? user?.userId,
        startDate: leaveFrom,
        endDate: leaveTo,
        type: leaveType,
        reason: leaveReason,
      };

      const res = await axios.post("/api/leave/apply", payload);
      setLeaveMessage(res?.data?.message ?? "Leave request submitted.");
      setIsLeaveOpen(false);
      setLeaveFrom("");
      setLeaveTo("");
      setLeaveType("annual");
      setLeaveReason("");
      // refresh user data (leave balance / tasks) if API provides it
      const idToFetch = userId ?? user?.id ?? user?.userId;
      if (idToFetch) await fetchUser(idToFetch);
      alert("Leave request submitted");
      // punch refresh removed
    } catch (err) {
      console.error("Leave submit error:", err?.response?.data ?? err);
      const serverMsg = err?.response?.data?.message ?? err?.message ?? "Failed to submit leave";
      setLeaveMessage(String(serverMsg));
      alert(serverMsg);
    } finally {
      setLeaveSubmitting(false);
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

          {/* --- NEW: Leave modal (engineer can apply here) --- */}
          {isLeaveOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
              <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Apply for Leave</h3>
                  <button
                    onClick={() => {
                      setIsLeaveOpen(false);
                      setLeaveMessage("");
                    }}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleLeaveSubmit} className="space-y-4">
                  {leaveMessage && <div className="text-sm text-red-600">{leaveMessage}</div>}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Type</label>
                    <select value={leaveType} onChange={(e) => setLeaveType(e.target.value)} className="mt-1 block w-full border rounded px-3 py-2">
                      <option value="annual">Annual</option>
                      <option value="sick">Sick</option>
                      <option value="unpaid">Unpaid</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">From</label>
                      <input type="date" value={leaveFrom} onChange={(e) => setLeaveFrom(e.target.value)} className="mt-1 block w-full border rounded px-3 py-2" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">To</label>
                      <input type="date" value={leaveTo} onChange={(e) => setLeaveTo(e.target.value)} className="mt-1 block w-full border rounded px-3 py-2" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Reason</label>
                    <textarea value={leaveReason} onChange={(e) => setLeaveReason(e.target.value)} rows={3} className="mt-1 block w-full border rounded px-3 py-2" />
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <button type="button" onClick={() => setIsLeaveOpen(false)} className="px-4 py-2 rounded border hover:bg-gray-50">
                      Cancel
                    </button>
                    <button type="submit" disabled={leaveSubmitting} className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-60">
                      {leaveSubmitting ? "Submitting..." : "Submit Request"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
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

              

              <div className="p-4 bg-white rounded shadow flex flex-col mt-4">
                <span className="text-sm text-gray-500">Assigned Shift (Tomorrow)</span>
                <div className="mt-2 text-lg font-semibold text-gray-800">
                  {assignedShiftTomorrow ? `${assignedShiftTomorrow.shift_name} (${assignedShiftTomorrow.start_time} - ${assignedShiftTomorrow.end_time})` : "+no assing shift+"}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {assignedShiftTomorrow ? `Assigned for ${assignedShiftTomorrow.date}` : "+no assing shift+"}
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
                  onClick={() => setIsLeaveOpen(true)}
                  className="w-full p-3 bg-white rounded shadow hover:shadow-md text-left"
                >
                  <div className="font-medium">Request Leave</div>
                  <div className="text-sm text-gray-500 mt-1">
                    Submit a new leave request (to HR/Admin)
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

              {/* Today's Punches */}
              <div className="mt-6">
                <div className="p-4 bg-white rounded shadow">
                  <h3 className="text-lg font-medium mb-3">Today's Punches</h3>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-gray-500">Date</div>
                      <div className="text-base">{new Date().toLocaleDateString()}</div>
                    </div>

                    <div className="text-center">
                      <div className="text-sm text-gray-500">Punch In</div>
                      <div className="text-xl font-semibold">{formatTime(todayPunch?.punch_in)}</div>
                    </div>

                    <div className="text-center">
                      <div className="text-sm text-gray-500">Punch Out</div>
                      <div className="text-xl font-semibold">{formatTime(todayPunch?.punch_out)}</div>
                    </div>

                    <div className="flex gap-2">
                      <button onClick={() => handlePunch('in')} disabled={attendanceLoading} className="px-3 py-1 bg-green-600 text-white rounded">Punch In</button>
                      <button onClick={() => handlePunch('out')} disabled={attendanceLoading} className="px-3 py-1 bg-red-600 text-white rounded">Punch Out</button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Monthly work/leave summary */}
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-white rounded shadow">
                  <div className="text-sm text-gray-500">Work Days (this month)</div>
                  <div className="text-2xl font-semibold">{totalWorkDays}</div>
                </div>
                <div className="p-4 bg-white rounded shadow">
                  <div className="text-sm text-gray-500">Leave Days (this month)</div>
                  <div className="text-2xl font-semibold">{totalLeaveDays}</div>
                </div>
                <div className="p-4 bg-white rounded shadow">
                  <div className="text-sm text-gray-500">Overtime (this month)</div>
                  <div className="text-2xl font-semibold">{Math.floor(monthlyOvertimeSeconds/3600)}h {Math.floor((monthlyOvertimeSeconds%3600)/60)}m</div>
                </div>
              </div>

              {/* Engineer Stock (view only) */}
              <div className="mt-6">
                <React.Suspense fallback={<div>Loading engineer stock...</div>}>
                  <EngineerStock engineerId={userId} />
                </React.Suspense>
              </div>

              
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default EngineerDashboard;
