import React, { useEffect, useState } from "react";
import Sidebar from "../../components/Sidebar"; 
import Navbar from "../../components/Navbar";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const HrDashboard = () => {
  const navigate = useNavigate();
  const [shifts, setShifts] = useState([]);
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [form, setForm] = useState({ name: "", start_time: "09:00", end_time: "17:00" });
  const [assignForm, setAssignForm] = useState({ userId: "", shiftId: "", date: "" });
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [adjustForm, setAdjustForm] = useState({ userId: "", leave_balance: "" });

  useEffect(() => {
    const storedUser = localStorage.getItem("user");

    if (storedUser) {
      const user = JSON.parse(storedUser);
      // store current user to show personalized greeting
      setCurrentUser?.(user);

      // Optional: redirect if role is not HR
      if ((user.role || '').toLowerCase() !== "hr") {
        navigate("/login"); // or another page
      }
    } else {
      navigate("/login"); // redirect if no user found
    }

    // ensure default shifts exist, then load lists
    (async () => {
      try {
        await ensureDefaultShifts();
      } catch (e) {
        console.error("ensureDefaultShifts error:", e);
      } finally {
        fetchShifts();
        fetchUsers();
        fetchTomorrowAssignments();
      }
    })();
  }, [navigate]);

  // create default shifts if missing
  async function ensureDefaultShifts() {
    try {
      const res = await axios.get("/api/shifts");
      const existing = Array.isArray(res.data) ? res.data : [];
      const names = existing.map((s) => (s.name || "").toLowerCase());

      const defaults = [
        { name: "First", start_time: "09:00", end_time: "18:00" },
        { name: "Second", start_time: "13:00", end_time: "21:00" },
        { name: "Night", start_time: "21:00", end_time: "05:00" },
      ];

      for (const d of defaults) {
        if (!names.includes(d.name.toLowerCase())) {
          try {
            await axios.post("/api/shifts", d);
            console.log(`Created default shift: ${d.name}`);
          } catch (err) {
            console.warn(`Failed to create shift ${d.name}:`, err?.response?.data ?? err.message ?? err);
          }
        }
      }
    } catch (err) {
      console.error("Could not fetch shifts for ensureDefaultShifts:", err);
    }
  }

  function tomorrowDate() {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }
  
  async function fetchShifts() {
    try {
      const res = await axios.get("/api/shifts");
      setShifts(res.data || []);
    } catch (e) { console.error(e); }
  }
  async function fetchUsers() {
    try {
      const res = await axios.get("/api/users");
      let all = res.data?.users ?? [];
      // If current user is HR, do not include admin users for leave adjustments
      try {
        const stored = localStorage.getItem('user');
        const cu = stored ? JSON.parse(stored) : null;
        if (cu && (cu.role || '').toLowerCase() === 'hr') {
          all = all.filter(u => (u.role || '').toLowerCase() !== 'admin');
        }
      } catch (e) {
        // ignore parse errors
      }
      setUsers(all);
    } catch (e) { console.error(e); }
  }

  async function handleOpenAdjust(user) {
    setAdjustForm({ userId: user.id, leave_balance: user.leave_balance ?? user.leaveBalance ?? "" });
    setIsAdjustOpen(true);
  }

  async function handleAdjustSubmit(e) {
    e.preventDefault();
    try {
      const id = adjustForm.userId;
      const payload = { leave_balance: Number(adjustForm.leave_balance) };
      await axios.put(`/api/users/update/${id}`, payload);
      setIsAdjustOpen(false);
      setAdjustForm({ userId: "", leave_balance: "" });
      await fetchUsers();
      alert('Leave balance updated');
    } catch (err) {
      console.error('Could not update leave balance', err);
      alert('Could not update leave balance');
    }
  }
  async function fetchTomorrowAssignments() {
    try {
      const date = tomorrowDate();
      const res = await axios.get(`/api/shifts/assignments?date=${date}`);
      setAssignments(res.data || []);
    } catch (e) { console.error(e); }
  }

  async function handleCreateShift(e) {
    e.preventDefault();
    try {
      await axios.post("/api/shifts", form);
      setIsCreateOpen(false);
      setForm({ name: "", start_time: "09:00", end_time: "17:00" });
      await fetchShifts();
    } catch (err) { console.error(err); alert("Could not create shift"); }
  }

  async function handleAssign(e) {
    e.preventDefault();
    try {
      const payload = { userId: assignForm.userId, shiftId: assignForm.shiftId, date: assignForm.date || tomorrowDate() };
      const res = await axios.post("/api/shifts/assign", payload);

      // update local assignments immediately so HR sees the new assignment on the dashboard
      const newAssignment = res?.data?.assignment ?? null;
      if (newAssignment) {
        setAssignments((prev) => {
          // avoid duplicates for same user+date
          const filtered = (prev || []).filter(a => !(a.user_id === newAssignment.user_id && a.date === newAssignment.date));
          return [newAssignment, ...filtered];
        });
      } else {
        // fallback: re-fetch assignments for tomorrow
        await fetchTomorrowAssignments();
      }

      setIsAssignOpen(false);
      setAssignForm({ userId: "", shiftId: "", date: "" });
      // show quick confirmation
      alert("Shift assigned successfully");
    } catch (err) {
      console.error(err);
      alert("Could not assign shift");
    }
  }

  return (
    <div className="flex flex-col h-screen">
      <Navbar />
      <div className="flex flex-1 min-h-screen">
        <Sidebar />
        <div className="p-6 bg-gray-100 flex-1">
          <h2 className="text-2xl font-semibold mb-4">Hi {(() => {
            try { const s = localStorage.getItem('user'); return s ? JSON.parse(s).name : 'HR'; } catch (e) { return 'HR'; }
          })()}!</h2>
           <div className="flex gap-2 mb-4">
            <button onClick={() => setIsCreateOpen(true)} className="px-3 py-2 bg-green-600 text-white rounded">Create Shift</button>
            <button onClick={() => { setAssignForm(f => ({...f, date: tomorrowDate()})); setIsAssignOpen(true); }} className="px-3 py-2 bg-blue-600 text-white rounded">Assign Shift (tomorrow)</button>
          </div>

          <div className="mb-4">
            <h3 className="font-semibold">Tomorrow's Assignments</h3>
            <div className="bg-white rounded shadow mt-2 p-3">
              {assignments.length === 0 ? <div className="text-sm text-gray-500">No assignments for tomorrow.</div> :
                <ul className="space-y-2">
                  {assignments.map(a => (
                    <li key={a.id} className="flex justify-between items-center">
                      <div>
                        <div className="font-medium">{a.user_name ?? a.user_id}</div>
                        <div className="text-sm text-gray-600">{a.shift_name} • {a.start_time} - {a.end_time}</div>
                      </div>
                      <div className="text-xs text-gray-500">{a.date}</div>
                    </li>
                  ))}
                </ul>
              }
            </div>
          </div>

          <div className="mb-6">
            <h3 className="font-semibold">Manage Users</h3>
            <div className="bg-white rounded shadow mt-2 p-3">
              {users.length === 0 ? <div className="text-sm text-gray-500">No users found.</div> :
                <ul className="space-y-2">
                  {users.map(u => (
                    <li key={u.id} className="flex justify-between items-center">
                      <div>
                        <div className="font-medium">{u.name} <span className="text-xs text-gray-500">({u.role})</span></div>
                        <div className="text-sm text-gray-600">Leave balance: {u.leave_balance ?? u.leaveBalance ?? 'N/A'}</div>
                      </div>
                      <div className="flex gap-2">
                        {((u.role || '').toLowerCase() !== 'admin') ? (
                          <button onClick={() => handleOpenAdjust(u)} className="px-3 py-1 bg-yellow-500 text-white rounded text-sm">Adjust Leave</button>
                        ) : (
                          <span className="text-xs text-gray-400 px-2 py-1">Admin (no adjustments)</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              }
            </div>
          </div>

          <p>
            Welcome to your dashboard. Here you can manage users, attendance, leave, and reports.
          </p>
        </div>
      </div>

      {/* Create shift modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <form onSubmit={handleCreateShift} className="bg-white p-6 rounded shadow w-full max-w-md">
            <h3 className="text-lg font-semibold mb-3">Create Shift</h3>
            <input className="mb-2 w-full border p-2" placeholder="Shift name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
            <div className="flex gap-2 mb-2">
              <input type="time" className="w-1/2 border p-2" value={form.start_time} onChange={e => setForm({...form, start_time: e.target.value})} />
              <input type="time" className="w-1/2 border p-2" value={form.end_time} onChange={e => setForm({...form, end_time: e.target.value})} />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setIsCreateOpen(false)} className="px-3 py-1 border rounded">Cancel</button>
              <button type="submit" className="px-3 py-1 bg-green-600 text-white rounded">Create</button>
            </div>
          </form>
        </div>
      )}

      {/* Assign shift modal */}
      {isAssignOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <form onSubmit={handleAssign} className="bg-white p-6 rounded shadow w-full max-w-md">
            <h3 className="text-lg font-semibold mb-3">Assign Shift</h3>
            <select className="mb-2 w-full border p-2" value={assignForm.userId} onChange={e => setAssignForm({...assignForm, userId: e.target.value})}>
              <option value="">Select user</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
            </select>
            <select className="mb-2 w-full border p-2" value={assignForm.shiftId} onChange={e => setAssignForm({...assignForm, shiftId: e.target.value})}>
              <option value="">Select shift</option>
              {shifts.map(s => <option key={s.id} value={s.id}>{s.name} — {s.start_time}–{s.end_time}</option>)}
            </select>
            <input type="date" className="mb-2 w-full border p-2" value={assignForm.date} onChange={e => setAssignForm({...assignForm, date: e.target.value})} />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setIsAssignOpen(false)} className="px-3 py-1 border rounded">Cancel</button>
              <button type="submit" className="px-3 py-1 bg-blue-600 text-white rounded">Assign</button>
            </div>
          </form>
        </div>
      )}
      {/* Adjust leave modal */}
      {isAdjustOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <form onSubmit={handleAdjustSubmit} className="bg-white p-6 rounded shadow w-full max-w-md">
            <h3 className="text-lg font-semibold mb-3">Adjust Leave Balance</h3>
            <div className="mb-2">Selected user ID: {adjustForm.userId}</div>
            <input type="number" className="mb-2 w-full border p-2" placeholder="Leave balance" value={adjustForm.leave_balance} onChange={e => setAdjustForm({...adjustForm, leave_balance: e.target.value})} />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setIsAdjustOpen(false)} className="px-3 py-1 border rounded">Cancel</button>
              <button type="submit" className="px-3 py-1 bg-yellow-500 text-white rounded">Save</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default HrDashboard;
