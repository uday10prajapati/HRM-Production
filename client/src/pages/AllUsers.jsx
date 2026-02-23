import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import ModalWrapper from "../components/modals/ModalWrapper";
import AddUserModal from "../components/modals/AddUserModal";
import EditUserModal from "../components/modals/EditUserModal";
import DeleteUserModal from "../components/modals/DeleteUserModal";
import GiveTaskModal from "../components/modals/GiveTaskModal";
import TaskStatusModal from "../components/modals/TaskStatusModal";
import DocumentsModal from "../components/modals/DocumentsModal";
import { useNavigate } from "react-router-dom";
import { API_CONFIG } from "../utils/api.config";

// Set axios baseURL to domain only (endpoints include /api/)
axios.defaults.baseURL = API_CONFIG.BASE_URL;

// Modals are now in separate files under components/modals/



// ---------- MAIN COMPONENT ----------
const AllUsers = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal states
  const [isAddModalOpen, setAddModalOpen] = useState(false);
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
  const [isTaskModalOpen, setTaskModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isTaskStatusModalOpen, setTaskStatusModalOpen] = useState(false);
  const [isDocumentsModalOpen, setDocumentsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);

  // Form data
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    role: "",
    leave_balance: 20,
    password: "",
    mobile_number: "",
  });

  const [taskData, setTaskData] = useState({
    title: "",
    description: "",
  });

  // Fetch logged-in user
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (!storedUser) navigate("/login");
    else setUser(JSON.parse(storedUser));
  }, [navigate]);

  // Fetch all users
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await axios.get("/api/users/");
      let allUsers = res.data.users || res.data;

      if (user && user.role?.toLowerCase() === "hr") {
        allUsers = allUsers.filter(
          (u) =>
            u.role?.toLowerCase() === "employee" ||
            u.role?.toLowerCase() === "engineer"
        );
      } else if (user && user.role?.toLowerCase() === "admin") {
        allUsers = allUsers.filter(
          (u) => u.role?.toLowerCase() !== "admin"
        );
      }

      setUsers(allUsers);
      setLoading(false);
    } catch (err) {
      console.error('GET /api/users failed:', err.response?.status, err.response?.data || err.message);
      setError(`Failed to load users (${err.response?.status || 'network error'})`);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchUsers();
  }, [user]);

  // ---------- HANDLERS ----------
  const openAddModal = () => {
    setFormData({
      name: "",
      email: "",
      role: "",
      leave_balance: 20,
      password: "",
      mobile_number: "",
    });
    setAddModalOpen(true);
  };

  const openEditModal = (user) => {
    setSelectedUser(user);
    setFormData({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      leave_balance: user.leave_balance || 20,
      password: "",
      mobile_number: user.mobile_number || user.mobile || "",
    });
    setEditModalOpen(true);
  };

  const openDeleteModal = (user) => {
    setSelectedUser(user);
    setDeleteModalOpen(true);
  };

  const openDocumentsModal = (user) => {
    setSelectedUser(user);
    setDocumentsModalOpen(true);
  };

  const openTaskModal = (user) => {
    setSelectedUser(user);
    setTaskData({ title: "", description: "", customerName: "", customerAddress: "" });
    setTaskData(prev => ({ ...prev, customerMobile: "" }));
    setTaskModalOpen(true);
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    try {
      const lb = Number(formData.leave_balance);
      const dataToSend = {
        ...formData,
        leave_balance: isNaN(lb) ? 20 : lb,
      };
      const createRes = await axios.post("/api/users/create", dataToSend);
      const createdUser = createRes.data?.user || createRes.data;

      const form = new FormData();
      if (formData.contractFile) form.append('contract', formData.contractFile);
      if (formData.idProofFile) form.append('idProof', formData.idProofFile);
      if (formData.certificateFile) form.append('certificate', formData.certificateFile);

      if ((formData.contractFile || formData.idProofFile || formData.certificateFile) && createdUser?.id) {
        try {
          await axios.post(`/api/documents/${createdUser.id}/documents`, form, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
        } catch (err) {
          console.warn('Document upload failed', err);
        }
      }

      setAddModalOpen(false);
      fetchUsers();
    } catch (err) {
      console.error("Add user failed", err);
      if (err.response) {
        console.log("Server Response:", err.response.data);
      }
      const msg = err.response?.data?.message || err.message;
      const detailed = err.response?.data?.error || '';
      alert(`Failed to add user: ${msg}\n${detailed}`);
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`/api/users/update/${selectedUser.id}`, formData);
      setEditModalOpen(false);
      fetchUsers();
    } catch (err) {
      console.error("Edit user failed", err);
      if (err.response) {
        console.log("Server Response:", err.response.data);
      }
      const msg = err.response?.data?.message || err.message;
      alert(`Failed to update user: ${msg}`);
    }
  };

  const handleDeleteSubmit = async () => {
    try {
      await axios.delete(`/api/users/delete/${selectedUser.id}`);
      setDeleteModalOpen(false);
      fetchUsers();
    } catch (err) {
      console.error("Delete user failed", err);
      alert("Failed to delete user. Please check console.");
    }
  };

  const handleTaskSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`/api/users/assign-task`, {
        userId: selectedUser.id,
        tasks: [taskData],
      });
      alert(`Task assigned to ${selectedUser.name}`);
      setTaskModalOpen(false);
      setTaskData({ title: "", description: "", customerName: "", customerAddress: "", customerMobile: "" });
    } catch (err) {
      console.error("Assign task failed", err);
      alert("Failed to assign task. Please check console.");
    }
  };

  const openTaskStatusModal = (user) => {
    setSelectedUser(user);
    setTaskStatusModalOpen(true);
  };

  // ---------- RENDER ----------
  if (loading) return <div className="p-6 text-gray-600">Loading users...</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="flex flex-1 bg-gray-50">
        <Sidebar />
        <main className="flex-1 p-8">
          {isAddModalOpen && (
            <AddUserModal
              formData={formData}
              setFormData={setFormData}
              onSubmit={handleAddSubmit}
              onClose={() => setAddModalOpen(false)}
              loading={isSubmitting}
            />
          )
          }
          {
            isDocumentsModalOpen && selectedUser && (
              <DocumentsModal
                userId={selectedUser.id} // Changed from currentUserId to selectedUser.id
                onClose={() => setDocumentsModalOpen(false)}
              />
            )
          }
          {
            isEditModalOpen && (
              <EditUserModal
                formData={formData}
                setFormData={setFormData}
                onSubmit={handleEditSubmit}
                onClose={() => setEditModalOpen(false)}
              />
            )
          }
          {
            isDeleteModalOpen && (
              <DeleteUserModal
                selectedUser={selectedUser}
                onDelete={handleDeleteSubmit}
                onClose={() => setDeleteModalOpen(false)}
              />
            )
          }
          {
            isTaskModalOpen && (
              <GiveTaskModal
                selectedUser={selectedUser}
                taskData={taskData}
                setTaskData={setTaskData}
                onSubmit={handleTaskSubmit}
                onClose={() => setTaskModalOpen(false)}
              />
            )
          }

          {
            isTaskStatusModalOpen && selectedUser && (
              <TaskStatusModal
                selectedUser={selectedUser}
                onClose={() => setTaskStatusModalOpen(false)}
              />
            )
          }

          <div className="max-w-7xl mx-auto animate-fade-in-up">
            {/* Page Header */}
            <div className="bg-white rounded-2xl p-6 mb-8 shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-4">
                <div className="bg-gradient-to-br from-blue-500 to-indigo-600 w-12 h-12 rounded-xl flex items-center justify-center shadow-md shadow-indigo-200">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-800 tracking-tight">User Management</h2>
                  <p className="text-gray-500 text-sm mt-0.5">View, manage, and assign roles to your team members</p>
                </div>
              </div>
              <button
                onClick={openAddModal}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg shadow-sm shadow-indigo-200 flex items-center gap-2 transition-all font-medium text-sm"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                Add User
              </button>
            </div>

            {/* Tools Bar (Search filtering) */}
            <div className="mb-6 flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="relative w-full sm:w-96">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Search users by name, email, or role..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-xl leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm shadow-sm transition-all"
                />
              </div>
              <div className="text-sm text-gray-500 bg-white px-4 py-2 border border-gray-200 rounded-lg shadow-sm">
                Total Users: <span className="font-semibold text-gray-700">{users.length}</span>
              </div>
            </div>

            {(() => {
              const filteredUsers = users.filter((u) => {
                const search = searchQuery.toLowerCase();
                return (
                  (u.name && u.name.toLowerCase().includes(search)) ||
                  (u.email && u.email.toLowerCase().includes(search)) ||
                  (u.role && u.role.toLowerCase().includes(search)) ||
                  (u.mobile_number && u.mobile_number.includes(search)) ||
                  (u.mobile && u.mobile.includes(search))
                );
              });

              if (filteredUsers.length === 0) {
                return (
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 text-center py-16">
                    <svg className="mx-auto h-16 w-16 text-indigo-200 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <h3 className="text-lg font-semibold text-gray-900">No users found</h3>
                    <p className="mt-1 flex justify-center text-sm text-gray-500">
                      {users.length === 0
                        ? "Get started by creating a new user."
                        : "No users matched your search criteria."}
                    </p>
                  </div>
                );
              }

              return (
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-100">
                      <thead>
                        <tr className="bg-gray-50/50">
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">User Profile</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">System Role</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Leave Bal.</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Mobile Number</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredUsers.map((u, i) => (
                          <tr key={u.id} className="hover:bg-indigo-50/40 transition-colors duration-200">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-4">
                                <div className={`h-10 w-10 flex-shrink-0 rounded-full flex items-center justify-center shadow-sm ${i % 4 === 0 ? 'bg-indigo-100 text-indigo-700' :
                                    i % 4 === 1 ? 'bg-emerald-100 text-emerald-700' :
                                      i % 4 === 2 ? 'bg-amber-100 text-amber-700' :
                                        'bg-rose-100 text-rose-700'
                                  }`}>
                                  <span className="font-bold text-sm">
                                    {u.name.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                                <div>
                                  <div className="text-sm font-semibold text-gray-900">{u.name}</div>
                                  <div className="text-xs text-gray-500 tracking-wide mt-0.5">{u.email}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide capitalize ${u.role?.toLowerCase() === 'admin' ? 'bg-purple-100 text-purple-700 border border-purple-200' :
                                  u.role?.toLowerCase() === 'hr' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                                    u.role?.toLowerCase() === 'engineer' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                                      'bg-gray-100 text-gray-700 border border-gray-200'
                                }`}>
                                {u.role}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-medium tracking-tight">
                              {u.leave_balance ?? "N/A"}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-medium tracking-tight">
                              {u.mobile_number || u.mobile || "N/A"}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              <div className="flex items-center gap-3">
                                {user?.id !== u.id && (
                                  <button
                                    onClick={() => openEditModal(u)}
                                    title="Edit User"
                                    className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                  >
                                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                  </button>
                                )}
                                <button
                                  onClick={() => openDeleteModal(u)}
                                  title="Delete User"
                                  className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                >
                                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                                {(((user?.role || '').toString().toLowerCase() === 'hr') ||
                                  ((user?.role || '').toString().toLowerCase() === 'admin')) &&
                                  ((u.role || '').toString().toLowerCase() === 'engineer') && (
                                    <button
                                      onClick={() => openTaskStatusModal(u)}
                                      title="View Pending Calls"
                                      className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                                    >
                                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                                      </svg>
                                    </button>
                                  )}
                                {(user?.role || '').toString().toLowerCase() === 'admin' && (
                                  <button
                                    onClick={() => openDocumentsModal(u)}
                                    title="View Documents"
                                    className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                                  >
                                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AllUsers;
