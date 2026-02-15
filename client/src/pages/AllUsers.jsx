import React, { useEffect, useState } from "react";
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
      }

      setUsers(allUsers);
      setLoading(false);
    } catch (err) {
      // Log full axios response (status + body) when available to aid debugging
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
  // ensure mobile is present in state
  setTaskData(prev => ({ ...prev, customerMobile: "" }));
    setTaskModalOpen(true);
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    try {
      const dataToSend = {
        ...formData,
        leave_balance: Number(formData.leave_balance) || 20,
      };
      const createRes = await axios.post("/api/users/create", dataToSend);
      const createdUser = createRes.data?.user || createRes.data;

      // If files were attached, upload them to documents endpoint
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
          // Continue, user is created — backend can retry or admin can re-upload
        }
      }

      setAddModalOpen(false);
      fetchUsers();
    } catch (err) {
      console.error("Add user failed", err);
      alert("Failed to add user. Please check console.");
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
      alert("Failed to update user. Please check console.");
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
        tasks: [taskData], // <--- send an array of tasks
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
  setSelectedUser(user); // make sure we know which user’s tasks to show
  setTaskStatusModalOpen(true);
};



  // ---------- RENDER ----------
  if (!user) return null;
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
            />
          )}
{isDocumentsModalOpen && selectedUser && (
  <DocumentsModal 
    userId={selectedUser.id} // Changed from currentUserId to selectedUser.id
    onClose={() => setDocumentsModalOpen(false)} 
  />
)}
          {isEditModalOpen && (
            <EditUserModal
              formData={formData}
              setFormData={setFormData}
              onSubmit={handleEditSubmit}
              onClose={() => setEditModalOpen(false)}
            />
          )}
          {isDeleteModalOpen && (
            <DeleteUserModal
              selectedUser={selectedUser}
              onDelete={handleDeleteSubmit}
              onClose={() => setDeleteModalOpen(false)}
            />
          )}
          {isTaskModalOpen && (
            <GiveTaskModal
              selectedUser={selectedUser}
              taskData={taskData}
              setTaskData={setTaskData}
              onSubmit={handleTaskSubmit}
              onClose={() => setTaskModalOpen(false)}
            />
          )}

          {isTaskStatusModalOpen && selectedUser && (
  <TaskStatusModal
    selectedUser={selectedUser}
    onClose={() => setTaskStatusModalOpen(false)}
  />
)}

          <div className="max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-3xl font-bold text-gray-800">All Users</h2>
                <p className="text-gray-500 mt-1">Manage your organization's users</p>
              </div>
              <button
                onClick={openAddModal}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg shadow-sm flex items-center gap-2 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                Add User
              </button>
            </div>

            {users.length === 0 ? (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No users found</h3>
                <p className="mt-1 text-sm text-gray-500">Get started by creating a new user.</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Leave Balance</th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tasks</th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {users.map((u) => (
                        <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="h-10 w-10 flex-shrink-0">
                                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                                  <span className="text-blue-600 font-medium text-sm">
                                    {u.name.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900">{u.name}</div>
                                <div className="text-sm text-gray-500">{u.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800 capitalize">
                              {u.role}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {u.leave_balance ?? "N/A"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {((user?.role || '').toString().toLowerCase() === 'hr' || 
                              (user?.role || '').toString().toLowerCase() === 'admin') ? (
                              <button
                                onClick={() => openTaskStatusModal(u)}
                                className="text-blue-600 hover:text-blue-900 font-medium"
                              >
                                View Tasks
                              </button>
                            ) : (
                              <span className="text-gray-500">
                                {(u.tasks && u.tasks.length > 0) ? 
                                  `${u.tasks.length} task${u.tasks.length > 1 ? 's' : ''}` : 
                                  'No tasks'}
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <div className="flex items-center gap-4">
                              <button
                                onClick={() => openEditModal(u)}
                                className="text-gray-600 hover:text-blue-600 transition-colors"
                              >
                                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => openDeleteModal(u)}
                                className="text-gray-600 hover:text-red-600 transition-colors"
                              >
                                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                              {(((user?.role || '').toString().toLowerCase() === 'hr') || 
                                ((user?.role || '').toString().toLowerCase() === 'admin')) && 
                                ((u.role || '').toString().toLowerCase() === 'engineer') && (
                                <button
                                  onClick={() => openTaskModal(u)}
                                  className="text-gray-600 hover:text-indigo-600 transition-colors"
                                >
                                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                                  </svg>
                                </button>
                              )}
                              {(user?.role || '').toString().toLowerCase() === 'admin' && (
                                <button
                                  onClick={() => openDocumentsModal(u)}
                                  className="text-gray-600 hover:text-yellow-600 transition-colors"
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
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AllUsers;
