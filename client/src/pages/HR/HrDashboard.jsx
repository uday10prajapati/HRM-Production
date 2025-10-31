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
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [locLoading, setLocLoading] = useState(false);
  const [isAssignCallOpen, setIsAssignCallOpen] = useState(false);
  const [engineers, setEngineers] = useState([]);
  const [assignCallForm, setAssignCallForm] = useState({
    engineerId: "",
    dairyName: "",
    problem: "",
    description: ""
  });

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
        fetchEngineers();
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

  const fetchEngineers = async () => {
    try {
      const res = await axios.get("/api/users", {
        params: { role: 'engineer' }
      });
      setEngineers(res.data?.users?.filter(u => u.role === 'engineer') || []);
    } catch (err) {
      console.error('Error fetching engineers:', err);
    }
  };

  // fetch latest attendance row for a user that contains latitude/longitude
  async function fetchUserLocation(user) {
    try {
      setLocLoading(true);
      const today = new Date().toISOString().slice(0,10);
      // request a wide range; the endpoint will filter and we pick the latest row with coords
      const params = { userId: user.id, start: '1970-01-01', end: today };
      // include x-user-id header if present for auth fallback
      let headers = {};
      try {
        const raw = localStorage.getItem('user') || localStorage.getItem('currentUser');
        if (raw) {
          const p = JSON.parse(raw);
          const u = p?.user ?? p?.data ?? p;
          const id = u?.id ?? u?.userId ?? null;
          if (id) headers['x-user-id'] = String(id);
        }
      } catch (e) {}

      const res = await axios.get(`/api/attendance/records`, { params, headers });
      const rows = res?.data?.rows ?? [];
      // find most recent row that has both latitude and longitude
      const withCoords = (rows || []).filter(r => r.latitude != null && r.longitude != null);
      if (!withCoords || withCoords.length === 0) {
        alert('No recent location found for this user');
        return;
      }
      // sort by created_at descending
      withCoords.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
      const latest = withCoords[0];
      setSelectedLocation({ user, latitude: latest.latitude, longitude: latest.longitude, when: latest.created_at });
    } catch (err) {
      console.error('Could not fetch user location', err?.response?.data ?? err);
      alert('Failed to fetch user location');
    } finally {
      setLocLoading(false);
    }
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

  const handleAssignCall = async (e) => {
    e.preventDefault();
    try {
      const selectedEngineer = engineers.find(eng => eng.id === assignCallForm.engineerId);
      if (!selectedEngineer) {
        alert('Please select an engineer');
        return;
      }

      const response = await axios.post('/api/service-calls/assign-call', {
        id: selectedEngineer.id,
        name: selectedEngineer.name,
        role: selectedEngineer.role,
        mobile_number: selectedEngineer.mobile_number,
        dairy_name: assignCallForm.dairyName,
        problem: assignCallForm.problem,
        description: assignCallForm.description
      });

      if (response.data?.success) {
        alert('Call assigned successfully!');
        setIsAssignCallOpen(false);
        setAssignCallForm({
          engineerId: "",
          dairyName: "",
          problem: "",
          description: ""
        });
      }
    } catch (err) {
      console.error('Error assigning call:', err);
      alert('Failed to assign call');
    }
  };

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
            <button onClick={() => setIsAssignCallOpen(true)} className="px-3 py-2 bg-purple-600 text-white rounded">Assign Service Call</button>
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
                        <button onClick={() => fetchUserLocation(u)} className="px-3 py-1 bg-blue-500 text-white rounded text-sm">Location</button>
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
      {/* Assign service call modal */}
      {isAssignCallOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <form onSubmit={handleAssignCall} className="bg-white p-6 rounded shadow w-full max-w-md">
            <h3 className="text-lg font-semibold mb-3">Assign Service Call</h3>
            <select className="mb-2 w-full border p-2" value={assignCallForm.engineerId} onChange={e => setAssignCallForm({...assignCallForm, engineerId: e.target.value})}>
              <option value="">Select engineer</option>
              {engineers.map(eng => <option key={eng.id} value={eng.id}>{eng.name} ({eng.role})</option>)}
            </select>
            <input className="mb-2 w-full border p-2" placeholder="Dairy name" value={assignCallForm.dairyName} onChange={e => setAssignCallForm({...assignCallForm, dairyName: e.target.value})} />
            <input className="mb-2 w-full border p-2" placeholder="Problem" value={assignCallForm.problem} onChange={e => setAssignCallForm({...assignCallForm, problem: e.target.value})} />
            <textarea className="mb-2 w-full border p-2" placeholder="Description" value={assignCallForm.description} onChange={e => setAssignCallForm({...assignCallForm, description: e.target.value})} />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setIsAssignCallOpen(false)} className="px-3 py-1 border rounded">Cancel</button>
              <button type="submit" className="px-3 py-1 bg-purple-600 text-white rounded">Assign Call</button>
            </div>
          </form>
        </div>
      )}
      {/* Location modal */}
      {selectedLocation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white p-6 rounded shadow w-full max-w-md">
            <h3 className="text-lg font-semibold mb-2">Last Known Location for {selectedLocation.user?.name}</h3>
            <div className="mb-2 text-sm text-gray-700">When: {selectedLocation.when}</div>
            <div className="mb-4">
              <div className="text-sm">Latitude: <span className="font-mono">{selectedLocation.latitude}</span></div>
              <div className="text-sm">Longitude: <span className="font-mono">{selectedLocation.longitude}</span></div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setSelectedLocation(null)} className="px-3 py-1 border rounded">Close</button>
              <button onClick={() => window.open(`https://www.google.com/maps?q=${selectedLocation.latitude},${selectedLocation.longitude}`, '_blank')} className="px-3 py-1 bg-blue-600 text-white rounded">View on Google Maps</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HrDashboard;
