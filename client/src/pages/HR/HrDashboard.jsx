import React, { useEffect, useState } from "react";
import Sidebar from "../../components/Sidebar";
import Navbar from "../../components/Navbar";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import SocietyMasterModal from '../../components/modals/SocietyMasterModal';

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
    problem: "",
    description: ""
  });
  const [assignedCallsCount, setAssignedCallsCount] = useState(0);
  const [dairySuggestions, setDairySuggestions] = useState([]);
  const [showDairySuggestions, setShowDairySuggestions] = useState(false);
  const [isSocietyMasterOpen, setIsSocietyMasterOpen] = useState(false);

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
        fetchUsers();
        fetchTomorrowAssignments();
        fetchEngineers();
        fetchAssignedCalls();
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

  const [resolvedCallsCount, setResolvedCallsCount] = useState(0);
  const [pendingCallsCount, setPendingCallsCount] = useState(0);

  const fetchAssignedCalls = async () => {
    try {
      const response = await axios.get("/api/service-calls/assigned-calls", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (response.data.success) {
        const calls = response.data.calls || [];
        setAssignedCallsCount(calls.length);
        setResolvedCallsCount(calls.filter(c => (c.status || '').toLowerCase() === 'completed' || (c.status || '').toLowerCase() === 'resolved').length);
        setPendingCallsCount(calls.filter(c => (c.status || '').toLowerCase() === 'pending').length);
      }
    } catch (err) {
      console.error("Failed to fetch assigned calls", err);
    }
  };

  // fetch latest attendance row for a user that contains latitude/longitude
  async function fetchUserLocation(user) {
    try {
      setLocLoading(true);
      const today = new Date().toISOString().slice(0, 10);
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
      } catch (e) { }

      const res = await axios.get(`/api/attendance/records`, { params, headers });
      const rows = res?.data?.rows ?? [];
      // find most recent row that has both latitude and longitude
      const withCoords = (rows || []).filter(r => r.latitude != null && r.longitude != null);
      if (!withCoords || withCoords.length === 0) {
        alert('No recent location found for this user');
        return;
      }
      // sort by created_at descending
      withCoords.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
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
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-8">
          <div className="max-w-7xl mx-auto space-y-8">
            {/* Header & Actions (Welcome Banner) */}
            <div className="bg-white rounded border border-gray-200 p-6 flex flex-col md:flex-row justify-between items-center gap-4 mb-2">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full overflow-hidden border border-gray-100 bg-orange-50 flex items-center justify-center">
                  <span className="text-2xl font-bold text-orange-600">{currentUser?.name?.[0]?.toUpperCase() || 'H'}</span>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    Welcome Back, {currentUser?.name || 'HR Team'} <span className="text-xl">👋</span>
                  </h1>
                  <p className="mt-1 text-sm text-gray-500">
                    Overview of workforce and assignments. <span className="text-orange-500 font-medium">{pendingCallsCount}</span> Pending Calls.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => navigate('/assign-call')}
                  className="inline-flex items-center px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded text-sm font-medium transition-colors shadow-sm"
                >
                  <svg className="w-4 h-4 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  Assign Call
                </button>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
              {/* Total Employees */}
              <div className="bg-white rounded border border-gray-200 p-5 flex flex-col hover:shadow-sm transition-all group">
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-orange-50 mb-3 group-hover:bg-orange-100 transition-colors">
                  <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Total Employees</h3>
                <div className="text-xl font-bold text-gray-900 mb-3">{users.length}</div>
                <div className="mt-auto pt-3 border-t border-gray-100 w-full">
                  <a href="/all-users" className="text-xs text-gray-500 hover:text-orange-500 font-medium tracking-wide">View Details</a>
                </div>
              </div>

              {/* Active Engineers */}
              <div className="bg-white rounded border border-gray-200 p-5 flex flex-col hover:shadow-sm transition-all group">
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-blue-900 mb-3 group-hover:bg-blue-800 transition-colors">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Active Engineers</h3>
                <div className="text-xl font-bold text-gray-900 mb-3">{engineers.length}</div>
                <div className="mt-auto pt-3 border-t border-gray-100 w-full">
                  <a href="/all-users" className="text-xs text-gray-500 hover:text-orange-500 font-medium tracking-wide">View All</a>
                </div>
              </div>

              {/* Assigned Calls */}
              <div className="bg-white rounded border border-gray-200 p-5 flex flex-col hover:shadow-sm transition-all group">
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-blue-500 mb-3 group-hover:bg-blue-600 transition-colors">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h1.28a2 2 0 011.94 1.47l.7 2.49a2 2 0 01-.57 2.01l-1.1 1.1a16 16 0 006.58 6.58l1.1-1.1a2 2 0 012.01-.57l2.49.7A2 2 0 0121 17.72V19a2 2 0 01-2 2h-1C9.82 21 3 14.18 3 6V5z" />
                  </svg>
                </div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Assigned Calls</h3>
                <div className="text-xl font-bold text-gray-900 mb-3">{assignedCallsCount}</div>
                <div className="mt-auto pt-3 border-t border-gray-100 w-full">
                  <a href="/assign-call" className="text-xs text-gray-500 hover:text-orange-500 font-medium tracking-wide">View All</a>
                </div>
              </div>

              {/* Resolved Calls */}
              <div className="bg-white rounded border border-gray-200 p-5 flex flex-col hover:shadow-sm transition-all group">
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-pink-500 mb-3 group-hover:bg-pink-600 transition-colors">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Resolved Calls</h3>
                <div className="text-xl font-bold text-gray-900 mb-3">{resolvedCallsCount}</div>
                <div className="mt-auto pt-3 border-t border-gray-100 w-full">
                  <a href="/assign-call" className="text-xs text-gray-500 hover:text-orange-500 font-medium tracking-wide">View All</a>
                </div>
              </div>

              {/* Pending Calls */}
              <div className="bg-white rounded border border-gray-200 p-5 flex flex-col hover:shadow-sm transition-all group">
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-purple-500 mb-3 group-hover:bg-purple-600 transition-colors">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Pending Calls</h3>
                <div className="text-xl font-bold text-gray-900 mb-3">{pendingCallsCount}</div>
                <div className="mt-auto pt-3 border-t border-gray-100 w-full">
                  <a href="/assign-call" className="text-xs text-gray-500 hover:text-orange-500 font-medium tracking-wide">View All</a>
                </div>
              </div>
            </div>

            {/* Main Modules Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

              {/* Society Master Card */}
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 hover:shadow-md transition-all group">
                <div className="flex items-center mb-4">
                  <div className="p-3 bg-red-50 rounded-lg group-hover:scale-110 transition-transform">
                    <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <h3 className="ml-4 text-lg font-semibold text-gray-900">Society Master</h3>
                </div>
                <p className="text-sm text-gray-600 mb-4">View and manage society database.</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setIsSocietyMasterOpen(true)}
                    className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm font-medium"
                  >
                    Manage Societies
                  </button>
                </div>
              </div>

              {/* Field Service Management (FSM) Module */}
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 hover:shadow-md transition-all group">
                <div className="flex items-center mb-4">
                  <div className="p-3 bg-indigo-50 rounded-lg group-hover:scale-110 transition-transform">
                    <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="ml-4 text-lg font-semibold text-gray-900">Field Service Management (FSM)</h3>
                </div>
                <p className="text-sm text-gray-600 mb-4">Call assignment, live tracking, task lifecycle management.</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => navigate('/assign-call')}
                    className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-sm font-medium"
                  >
                    Assign Calls
                  </button>
                  <button
                    onClick={() => navigate('/map')}
                    className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors text-sm font-medium"
                  >
                    Live Map
                  </button>
                </div>
              </div>

              {/* User Management Module */}
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 hover:shadow-md transition-all group">
                <div className="flex items-center mb-4">
                  <div className="p-3 bg-green-50 rounded-lg group-hover:scale-110 transition-transform">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </div>
                  <h3 className="ml-4 text-lg font-semibold text-gray-900">User Management</h3>
                </div>
                <p className="text-sm text-gray-600 mb-4">Create, edit, and manage employee profiles and access.</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => navigate('/all-users')}
                    className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm font-medium"
                  >
                    Manage Employees
                  </button>
                </div>
              </div>
            </div>

            {/* Tomorrow's Assignments Section - Commented out as requested
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-800">Tomorrow's Assignments</h2>
                  <button
                    onClick={() => { setAssignForm(f => ({ ...f, date: tomorrowDate() })); setIsAssignOpen(true); }}
                    className="inline-flex items-center px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Assign Shift
                  </button>
                </div>
              </div>

              <div className="p-6">
                {assignments.length === 0 ? (
                  <div className="text-center py-6">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No assignments</h3>
                    <p className="mt-1 text-sm text-gray-500">Get started by assigning shifts for tomorrow.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {assignments.map(a => (
                      <div key={a.id} className="py-4 flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                            <span className="text-blue-600 font-medium">{(a.user_name || '')[0]?.toUpperCase()}</span>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{a.user_name}</div>
                            <div className="text-sm text-gray-500">{a.shift_name}</div>
                          </div>
                        </div>
                        <div className="flex items-center">
                          <span className="px-2.5 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                            {a.start_time} - {a.end_time}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            */}

            {/* Rest of the existing modals with enhanced styling... */}
          </div>
        </main>
      </div >

      {/* Create shift modal */}
      {
        isCreateOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <form onSubmit={handleCreateShift} className="bg-white p-6 rounded shadow w-full max-w-md">
              <h3 className="text-lg font-semibold mb-3">Create Shift</h3>
              <input className="mb-2 w-full border p-2" placeholder="Shift name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              <div className="flex gap-2 mb-2">
                <input type="time" className="w-1/2 border p-2" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} />
                <input type="time" className="w-1/2 border p-2" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setIsCreateOpen(false)} className="px-3 py-1 border rounded">Cancel</button>
                <button type="submit" className="px-3 py-1 bg-green-600 text-white rounded">Create</button>
              </div>
            </form>
          </div>
        )
      }

      {/* Assign shift modal */}
      {
        isAssignOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <form onSubmit={handleAssign} className="bg-white p-6 rounded shadow w-full max-w-md">
              <h3 className="text-lg font-semibold mb-3">Assign Shift</h3>
              <select className="mb-2 w-full border p-2" value={assignForm.userId} onChange={e => setAssignForm({ ...assignForm, userId: e.target.value })}>
                <option value="">Select user</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
              </select>
              <select className="mb-2 w-full border p-2" value={assignForm.shiftId} onChange={e => setAssignForm({ ...assignForm, shiftId: e.target.value })}>
                <option value="">Select shift</option>
                {shifts.map(s => <option key={s.id} value={s.id}>{s.name} — {s.start_time}–{s.end_time}</option>)}
              </select>
              <input type="date" className="mb-2 w-full border p-2" value={assignForm.date} onChange={e => setAssignForm({ ...assignForm, date: e.target.value })} />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setIsAssignOpen(false)} className="px-3 py-1 border rounded">Cancel</button>
                <button type="submit" className="px-3 py-1 bg-blue-600 text-white rounded">Assign</button>
              </div>
            </form>
          </div>
        )
      }
      {/* Adjust leave modal */}
      {
        isAdjustOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <form onSubmit={handleAdjustSubmit} className="bg-white p-6 rounded shadow w-full max-w-md">
              <h3 className="text-lg font-semibold mb-3">Adjust Leave Balance</h3>
              <div className="mb-2">Selected user ID: {adjustForm.userId}</div>
              <input type="number" className="mb-2 w-full border p-2" placeholder="Leave balance" value={adjustForm.leave_balance} onChange={e => setAdjustForm({ ...adjustForm, leave_balance: e.target.value })} />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setIsAdjustOpen(false)} className="px-3 py-1 border rounded">Cancel</button>
                <button type="submit" className="px-3 py-1 bg-yellow-500 text-white rounded">Save</button>
              </div>
            </form>
          </div>
        )
      }
      {/* Assign service call modal */}
      {
        isAssignCallOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <form onSubmit={handleAssignCall} className="bg-white p-6 rounded shadow w-full max-w-md">
              <h3 className="text-lg font-semibold mb-3">Assign Service Call</h3>
              <select className="mb-2 w-full border p-2" value={assignCallForm.engineerId} onChange={e => setAssignCallForm({ ...assignCallForm, engineerId: e.target.value })}>
                <option value="">Select engineer</option>
                {engineers.map(eng => <option key={eng.id} value={eng.id}>{eng.name} ({eng.role})</option>)}
              </select>


              <div className="relative mb-2">
                <input
                  className="w-full border p-2"
                  placeholder="Dairy name / Society"
                  value={assignCallForm.dairyName}
                  onChange={async (e) => {
                    const val = e.target.value;
                    setAssignCallForm({ ...assignCallForm, dairyName: val });

                    if (val.length > 0) {
                      try {
                        const res = await axios.post('/api/service-calls/search', { society: val });
                        if (res.data.success) {
                          setDairySuggestions(res.data.data.societies || []);
                          setShowDairySuggestions(true);
                        } else {
                          setDairySuggestions([]);
                        }
                      } catch (err) {
                        console.error("Error fetching suggestions:", err);
                        setDairySuggestions([]);
                      }
                    } else {
                      setDairySuggestions([]);
                      setShowDairySuggestions(false);
                    }
                  }}
                  onFocus={() => {
                    if (assignCallForm.dairyName) setShowDairySuggestions(true);
                  }}
                  onBlur={() => setTimeout(() => setShowDairySuggestions(false), 200)}
                />
                {showDairySuggestions && dairySuggestions.length > 0 && (
                  <ul className="absolute z-10 bg-white border border-gray-200 rounded shadow-md mt-1 w-full max-h-48 overflow-y-auto">
                    {dairySuggestions.map((item, idx) => (
                      <li
                        key={idx}
                        className="p-2 hover:bg-blue-50 cursor-pointer text-sm text-gray-700"
                        onMouseDown={() => {
                          setAssignCallForm(prev => ({ ...prev, dairyName: item.society }));
                          setShowDairySuggestions(false);
                        }}
                      >
                        {item.society} <span className="text-gray-400 text-xs">({item.taluka})</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <input className="mb-2 w-full border p-2" placeholder="Problem" value={assignCallForm.problem} onChange={e => setAssignCallForm({ ...assignCallForm, problem: e.target.value })} />
              <textarea className="mb-2 w-full border p-2" placeholder="Description" value={assignCallForm.description} onChange={e => setAssignCallForm({ ...assignCallForm, description: e.target.value })} />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setIsAssignCallOpen(false)} className="px-3 py-1 border rounded">Cancel</button>
                <button type="submit" className="px-3 py-1 bg-purple-600 text-white rounded">Assign Call</button>
              </div>
            </form>
          </div>
        )
      }
      {/* Location modal */}
      {
        selectedLocation && (
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
        )
      }
      <SocietyMasterModal isOpen={isSocietyMasterOpen} onClose={() => setIsSocietyMasterOpen(false)} />
    </div >
  );
};

export default HrDashboard;
