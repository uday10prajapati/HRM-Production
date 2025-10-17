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

const API_BASE_URL = import.meta.env.VITE_API_URL;
axios.defaults.baseURL = API_BASE_URL;

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
    attendance_status: "",
    password: "",
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
      console.error(err);
      setError("Failed to load users");
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
      attendance_status: "",
      password: "",
    });
    setAddModalOpen(true);
  };

  const openEditModal = (user) => {
    setSelectedUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      role: user.role,
      leave_balance: user.leave_balance || 20,
      attendance_status: user.attendance_status || "",
      password: "",
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
    setTaskData({ title: "", description: "" });
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
      setTaskData({ title: "", description: "" });
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
      <div className="flex flex-1 bg-gray-50 min-h-screen">
        <Sidebar />
        <main className="flex-1 p-6">
          {isAddModalOpen && (
            <AddUserModal
              formData={formData}
              setFormData={setFormData}
              onSubmit={handleAddSubmit}
              onClose={() => setAddModalOpen(false)}
            />
          )}
          {isDocumentsModalOpen && selectedUser && (
            <DocumentsModal userId={selectedUser.id} onClose={() => setDocumentsModalOpen(false)} />
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

          <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-semibold text-gray-800">All Users</h2>
            <button
              onClick={openAddModal}
              className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-md shadow"
            >
              + Add User
            </button>
          </div>

          {users.length === 0 ? (
            <div className="text-center text-gray-500 mt-20 text-lg font-medium">
              No users found.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-300 bg-white shadow">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-100">
                  <tr>
                    {[
                      "ID",
                      "Name",
                      "Email",
                      "Role",
                      "Leave Balance",
                      "Attendance Status",
                      "Tasks",
                      "Actions",
                    ].map((header) => (
                      <th
                        key={header}
                        className="px-6 py-3 text-left text-sm font-semibold text-gray-700"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900">{u.id}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{u.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{u.email}</td>
                      <td className="px-6 py-4 text-sm text-gray-900 capitalize">
                        {u.role}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {u.leave_balance ?? "N/A"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {u.attendance_status ?? "N/A"}
                      </td>
       <td className="px-6 py-4 text-sm text-gray-900">
  {u.tasks && u.tasks.length > 0 ? (
    <button
      onClick={() => openTaskStatusModal(u)}
      className="text-indigo-600 hover:underline"
    >
      View Tasks
    </button>
  ) : (
    "No tasks"
  )}
</td>


                      <td className="px-6 py-4 text-sm flex gap-2">
                        <button
                          onClick={() => openEditModal(u)}
                          className="text-blue-600 hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => openDeleteModal(u)}
                          className="text-red-600 hover:underline"
                        >
                          Delete
                        </button>
                        { (u.role || '').toString().toLowerCase() !== 'admin' && (
                          <button
                            onClick={() => openTaskModal(u)}
                            className="text-indigo-600 hover:underline"
                          >
                            Give Task
                          </button>
                        )}
                        {/* Documents (admin only) */}
                        { (user?.role || '').toString().toLowerCase() === 'admin' && (
                          <button onClick={() => openDocumentsModal(u)} className="text-gray-700 hover:underline">Documents</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default AllUsers;
