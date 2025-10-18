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
  const [todayPunch, setTodayPunch] = useState({ punch_in: null, punch_out: null });

  // leave state + modal
  const [leaves, setLeaves] = useState([]);
  const [leavesLoading, setLeavesLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  const [isOpen, setIsOpen] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  // new: monthly stats
  const [totalWorkDays, setTotalWorkDays] = useState(0);
  const [totalLeaveDays, setTotalLeaveDays] = useState(0);
  const [statsLoading, setStatsLoading] = useState(false);
  const [monthlyOvertimeSeconds, setMonthlyOvertimeSeconds] = useState(0);
  const [assignedShiftTomorrow, setAssignedShiftTomorrow] = useState(null);

  // Fetch employee data
  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await axios.get("/api/users/me");
      // normalize name if API returns different shape
      const raw = res.data?.user ?? res.data;
      const normalized = {
        ...raw,
        name:
          raw?.name ??
          raw?.fullName ??
          raw?.full_name ??
          raw?.username ??
          raw?.user_name ??
          raw?.firstName ??
          raw?.first_name ??
          raw?.email ??
          "Employee",
      };
      setProfile(normalized);
    } catch (err) {
      console.error("Failed to load profile:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) {
      try {
        const u = JSON.parse(stored);
        setProfile((p) => p ?? { ...u, name: u.name ?? u.fullName ?? u.username });
      } catch (e) {
        // ignore
      }
    }
  }, []);

  useEffect(() => {
    if (profile?.id) {
      // restore optimistic attendance if available (survive accidental refresh)
      try {
        const saved = localStorage.getItem(`att_today_${profile.id}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          // only restore if date matches today
          const today = new Date().toISOString().slice(0,10);
          if (parsed?.date === today) setTodayPunch({ punch_in: parsed.punch_in ?? null, punch_out: parsed.punch_out ?? null });
        }
        const savedWork = localStorage.getItem(`att_workdays_${profile.id}`);
        if (savedWork) setTotalWorkDays(Number(savedWork));
      } catch (err) {
        // ignore parse errors
      }

      fetchLeaves();
      fetchMonthlyStats();
      fetchMonthlyOvertime();
      fetchTodayAttendance();
      fetchAssignedShiftTomorrow();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  async function fetchLeaves() {
    setLeavesLoading(true);
    setFetchError(null);
    try {
      const res = await axios.get(
        `/api/leave${profile?.id ? `?userId=${encodeURIComponent(profile.id)}` : ""}`
      );
      const list =
        Array.isArray(res.data) && res.data.length > 0
          ? res.data
          : res.data?.leaves ?? res.data?.data ?? [];
      setLeaves(list);
    } catch (err) {
      console.error("Failed to fetch leaves:", err);
      setFetchError("Failed to load leave records");
    } finally {
      setLeavesLoading(false);
    }
  }

  // compute start/end of current month (YYYY-MM-DD)
  function monthRangeForDate(d = new Date()) {
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const fmt = (dt) => dt.toISOString().slice(0, 10);
    return { start: fmt(start), end: fmt(end) };
  }

  // count overlapping days between two inclusive date ranges
  function countOverlapDays(aStart, aEnd, bStart, bEnd) {
    const s = new Date(Math.max(new Date(aStart), new Date(bStart)));
    const e = new Date(Math.min(new Date(aEnd), new Date(bEnd)));
    if (e < s) return 0;
    return Math.floor((e - s) / (1000 * 60 * 60 * 24)) + 1;
  }

  // format an ISO timestamp to local time string e.g. 09:10 AM
  function formatTime(ts) {
    if (!ts) return "—";
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return String(ts);
    }
  }

  // fetch attendance records for month and compute unique worked days
  async function fetchMonthlyStats() {
    if (!profile?.id) return;
    setStatsLoading(true);
    try {
      const { start, end } = monthRangeForDate();
      // get attendance report for this user in range (report returns per-day punch_in/punch_out)
      const attRes = await axios.get(`/api/attendance/report`, { params: { userId: profile.id, start, end } });
      const attList = Array.isArray(attRes.data) ? attRes.data : attRes.data?.rows ?? [];

      // worked day if there's a punch_in value
      const workedCount = Array.isArray(attList)
        ? attList.filter((r) => (r.punch_in ?? r.punchIn ?? r.in)).length
        : 0;

      // leaves overlapping month
      const leaveRes = await axios.get(`/api/leave`, { params: { userId: profile.id } });
      const leaveList = Array.isArray(leaveRes.data) ? leaveRes.data : leaveRes.data?.leaves ?? leaveRes.data?.data ?? [];

      let leaveDays = 0;
      leaveList.forEach((lv) => {
        const lStart = lv.startDate ?? lv.start_date ?? lv.start;
        const lEnd = lv.endDate ?? lv.end_date ?? lv.end;
        if (!lStart || !lEnd) return;
        leaveDays += countOverlapDays(lStart, lEnd, start, end);
      });

      setTotalWorkDays(workedCount);
      setTotalLeaveDays(leaveDays);
    } catch (err) {
      console.error("Failed to fetch monthly stats:", err);
      setTotalWorkDays(0);
      setTotalLeaveDays(0);
    } finally {
      setStatsLoading(false);
    }
  }

  // fetch today's punch in/out for this user
  async function fetchTodayAttendance() {
    try {
      if (!profile?.id) return;
      const today = new Date().toISOString().slice(0, 10);
      const res = await axios.get(`/api/attendance/report?userId=${profile.id}&start=${today}&end=${today}`);
      const row = Array.isArray(res.data) && res.data.length > 0 ? res.data[0] : null;
      setTodayPunch({ punch_in: row?.punch_in ?? null, punch_out: row?.punch_out ?? null });
    } catch (err) {
      console.error("Failed to fetch today's attendance:", err);
      setTodayPunch({ punch_in: null, punch_out: null });
    }
  }

  async function fetchMonthlyOvertime() {
    if (!profile?.id) return;
    try {
      const { start, end } = monthRangeForDate();
      const res = await axios.get('/api/overtime', { params: { userId: profile.id, start, end } });
      const rows = Array.isArray(res.data) ? res.data : res.data?.rows ?? res.data;
      const sum = (rows || []).reduce((acc, r) => acc + (Number(r.overtime_seconds || 0)), 0);
      setMonthlyOvertimeSeconds(sum);
    } catch (err) {
      console.error('Failed to fetch monthly overtime', err);
      setMonthlyOvertimeSeconds(0);
    }
  }

  async function fetchAssignedShiftTomorrow() {
    try {
      if (!profile?.id) return;
      const d = new Date();
      d.setDate(d.getDate() + 1);
      const date = d.toISOString().slice(0, 10);
      const res = await axios.get(`/api/shifts/assignments?date=${encodeURIComponent(date)}&userId=${encodeURIComponent(profile.id)}`);
      setAssignedShiftTomorrow(Array.isArray(res.data) && res.data.length ? res.data[0] : null);
    } catch (err) {
      console.error("Failed to fetch tomorrow's assigned shift:", err?.response?.data ?? err);
      setAssignedShiftTomorrow(null);
    }
  }

  // Handle punch-in / punch-out - no location, only record type/time
  const handlePunch = async (type) => {
    const uid =
      profile?.id ??
      (() => {
        try {
          const raw = localStorage.getItem("user") || localStorage.getItem("currentUser");
          if (!raw) return null;
          const p = JSON.parse(raw);
          const u = p?.user ?? p?.data ?? p;
          return u?.id ?? u?.userId ?? null;
        } catch {
          return null;
        }
      })();

    if (!uid) {
      alert("User not found. Please login.");
      return;
    }

    // guard: one punch-in and one punch-out per day
    if (type === "in" && todayPunch?.punch_in) {
      alert("You have already punched IN for today.");
      return;
    }
    if (type === "out") {
      if (!todayPunch?.punch_in) {
        alert("You must punch IN before punching OUT.");
        return;
      }
      if (todayPunch?.punch_out) {
        alert("You have already punched OUT for today.");
        return;
      }
    }

    // optimistic UI: update today's punch and work days immediately
    const wasPunchedIn = Boolean(todayPunch?.punch_in);
    const nowIso = new Date().toISOString().replace("T", " ").split(".")[0];
    const newToday = { ...(todayPunch || {}), ...(type === "in" ? { punch_in: nowIso } : { punch_out: nowIso }) };
    setTodayPunch(newToday);
    // persist optimistic state so a reload doesn't lose it
    try { localStorage.setItem(`att_today_${uid}`, JSON.stringify({ date: new Date().toISOString().slice(0,10), ...newToday })); } catch {}
    if (type === "in" && !wasPunchedIn) {
      setTotalWorkDays((s) => {
        const next = Number(s || 0) + 1;
        try { localStorage.setItem(`att_workdays_${uid}`, String(next)); } catch {}
        return next;
      });
    }

    setAttendanceLoading(true);
    try {
      const res = await axios.post("/api/attendance/punch", { userId: uid, type });
      // if server returned created time, reconcile exact timestamp
      const att = res?.data?.attendance ?? res?.data;
      if (att && att.created_at) {
        setTodayPunch((prev) => ({
          ...prev,
          ...(type === "in" ? { punch_in: att.created_at } : { punch_out: att.created_at }),
        }));
      }
      // reconcile canonical server state
      await fetchMonthlyStats();
      await fetchLeaves();
      await fetchTodayAttendance();
      // on success remove optimistic saved snapshot
      try { localStorage.removeItem(`att_today_${uid}`); localStorage.removeItem(`att_workdays_${uid}`); } catch {}
      alert(res?.data?.message ?? "Punch saved");
    } catch (err) {
      // improved error extraction and logging
      console.error("Punch error full:", err);
      const serverData = err?.response?.data;
      const serverMsg = serverData?.error ?? serverData?.message ?? serverData;
      const finalMsg = typeof serverMsg === "string" ? serverMsg : JSON.stringify(serverMsg ?? err?.message ?? "Punch failed");
      alert(finalMsg);
      // revert optimistic work days increment if server failed
      if (type === "in" && !wasPunchedIn) {
        setTotalWorkDays((s) => {
          const next = Math.max(0, Number(s || 0) - 1);
          try { localStorage.setItem(`att_workdays_${uid}`, String(next)); } catch {}
          return next;
        });
      }
      // re-fetch canonical data
      await fetchMonthlyStats();
      await fetchLeaves();
      await fetchTodayAttendance();
    } finally {
      setAttendanceLoading(false);
    }
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setMessage("");
    try {
      if (!profile?.id) {
        setMessage("User not found. Please login.");
        return;
      }
      if (!from || !to) {
        setMessage("Please select start and end dates");
        return;
      }
      if (new Date(to) < new Date(from)) {
        setMessage("End date must be same or after start date");
        return;
      }

      const payload = {
        userId: profile.id,
        startDate: from,
        endDate: to,
        reason,
      };

      const res = await axios.post("/api/leave/apply", payload);
      // success
      setMessage("Leave request submitted");
      setIsOpen(false);
      setFrom("");
      setTo("");
      setReason("");
      await fetchLeaves();
      await fetchMonthlyStats();
    } catch (err) {
      console.error("Submit leave error:", err);
      setMessage(
        err?.response?.data?.error ||
          err.message ||
          "Server error while submitting leave request"
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div>Loading employee dashboard...</div>;

  return (
    <div className="flex flex-col h-screen">
      <Navbar />
      <div className="flex flex-1 min-h-screen">
        {/* Sidebar for employee - child buttons will open modal instead of navigating */}
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
                onClick={() => {
                  setMessage("");
                  setIsOpen(true);
                }}
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

          {/* Stats cards: total work days and leave days in month */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="p-4 bg-white rounded shadow">
              <div className="text-sm text-gray-500">Employee ID</div>
              <div className="text-2xl font-semibold">{profile?.id}</div>
            </div>

            <div className="p-4 bg-white rounded shadow">
              <div className="text-sm text-gray-500">Work Days (this month)</div>
              <div className="text-2xl font-semibold">{totalWorkDays}</div>
            </div>

            <div className="p-4 bg-white rounded shadow">
              <div className="text-sm text-gray-500">Leave Days (this month)</div>
              <div className="text-2xl font-semibold">{totalLeaveDays}</div>
            </div>

            <div className="p-4 bg-white rounded shadow">
              <div className="text-sm text-gray-500">Role</div>
              <div className="text-2xl font-semibold capitalize">{profile?.role}</div>
            </div>
            <div className="p-4 bg-white rounded shadow">
              <div className="text-sm text-gray-500">Overtime (this month)</div>
              <div className="text-2xl font-semibold">{Math.floor(monthlyOvertimeSeconds/3600)}h {Math.floor((monthlyOvertimeSeconds%3600)/60)}m</div>
            </div>
            <div className="p-4 bg-white rounded shadow">
              <div className="text-sm text-gray-500">Assigned Shift (Tomorrow)</div>
              <div className="text-2xl font-semibold">
                {assignedShiftTomorrow ? `${assignedShiftTomorrow.shift_name} (${assignedShiftTomorrow.start_time} - ${assignedShiftTomorrow.end_time})` : "No shift assigned"}
              </div>
              <div className="text-xs text-gray-500 mt-1">{assignedShiftTomorrow ? `Assigned for ${assignedShiftTomorrow.date}` : ""}</div>
            </div>
          </div>

          {/* Quick access cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
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
                onClick={() => {
                  setMessage("");
                  setIsOpen(true);
                }}
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

          {/* Attendance punch buttons */}
          <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-white rounded shadow flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-500">Attendance</div>
                <div className="text-lg font-semibold">Punch In / Punch Out</div>
                <div className="text-sm text-gray-600 mt-1">
                  Today: <span className="font-medium">{todayPunch.punch_in ?? "-"}</span> / <span className="font-medium">{todayPunch.punch_out ?? "-"}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handlePunch("in")}
                  disabled={attendanceLoading}
                  className="px-4 py-2 bg-green-600 text-white rounded"
                >
                  Punch In
                </button>
                <button
                  onClick={() => handlePunch("out")}
                  disabled={attendanceLoading}
                  className="px-4 py-2 bg-red-600 text-white rounded"
                >
                  Punch Out
                </button>
              </div>
            </div>

            <div className="p-4 bg-white rounded shadow">
              <div className="text-sm text-gray-500">Monthly Summary</div>
              <div className="mt-2">
                <div className="text-sm">Worked days: <span className="font-semibold">{totalWorkDays}</span></div>
                <div className="text-sm">Leave days: <span className="font-semibold">{totalLeaveDays}</span></div>
              </div>
            </div>
          </div>

            

            {/* Leave list */}
          <div className="bg-white rounded shadow p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">My Leave Requests</h2>
              <button
                onClick={() => {
                  setMessage("");
                  setIsOpen(true);
                }}
                className="px-3 py-1 bg-blue-600 text-white rounded text-sm"
              >
                New Request
              </button>
            </div>

            {leavesLoading ? (
              <div className="text-center py-6 text-gray-500">Loading...</div>
            ) : fetchError ? (
              <div className="text-red-600 py-4">{fetchError}</div>
            ) : leaves.length === 0 ? (
              <div className="text-gray-500 py-4">No leave records found.</div>
            ) : (
              <div className="overflow-auto">
                <table className="min-w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left py-2 px-3">Type</th>
                      <th className="text-left py-2 px-3">Start</th>
                      <th className="text-left py-2 px-3">End</th>
                      <th className="text-left py-2 px-3">Status</th>
                      <th className="text-left py-2 px-3">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaves.map((l) => (
                      <tr
                        key={l.id ?? `${l.user_id}-${l.start_date ?? l.startDate}`}
                        className="border-t hover:bg-gray-50"
                      >
                        <td className="py-2 px-3 capitalize">
                          {l.type ?? l.leave_type ?? "—"}
                        </td>
                        <td className="py-2 px-3">
                          {l.startDate ?? l.start_date ?? l.start}
                        </td>
                        <td className="py-2 px-3">
                          {l.endDate ?? l.end_date ?? l.end}
                        </td>
                        <td className="py-2 px-3 capitalize">
                          {l.status ?? "pending"}
                        </td>
                        <td className="py-2 px-3">
                          {l.reason ?? l.notes ?? ""}
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

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Apply for Leave</h3>
              <button
                onClick={() => {
                  setIsOpen(false);
                  setMessage("");
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  From
                </label>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="mt-1 block w-full border rounded px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  To
                </label>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="mt-1 block w-full border rounded px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Reason
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  className="mt-1 block w-full border rounded px-3 py-2"
                />
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 rounded border hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-60"
                >
                  {submitting ? "Submitting..." : "Submit Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeDashboard;
