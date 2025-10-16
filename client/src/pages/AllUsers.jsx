import React, { useEffect, useState } from "react";
import axios from "axios";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import { useNavigate } from "react-router-dom";

const API_BASE_URL = import.meta.env.VITE_API_URL;
axios.defaults.baseURL = API_BASE_URL;

// ---------- Reusable Modal Wrapper ----------
const ModalWrapper = ({ children }) => (
  <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
    <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md relative">
      {children}
    </div>
  </div>
);

// ---------- Add User Modal ----------
const AddUserModal = ({ formData, setFormData, onSubmit, onClose }) => (
  <ModalWrapper>
    <h3 className="text-xl font-semibold mb-4 text-gray-800">Add User</h3>
    <form onSubmit={onSubmit} className="space-y-4">
      <input
        type="text"
        placeholder="Full Name"
        className="w-full border px-3 py-2 rounded"
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        required
      />
      <input
        type="email"
        placeholder="Email Address"
        className="w-full border px-3 py-2 rounded"
        value={formData.email}
        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
        required
      />
      <input
        type="password"
        placeholder="Password"
        className="w-full border px-3 py-2 rounded"
        value={formData.password}
        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
        required
      />
      <select
        className="w-full border px-3 py-2 rounded"
        value={formData.role}
        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
        required
      >
        <option value="">Select Role</option>
        <option value="hr">HR</option>
        <option value="engineer">Engineer</option>
        <option value="employee">Employee</option>
      </select>
      <input
        type="number"
        placeholder="Leave Balance"
        className="w-full border px-3 py-2 rounded"
        value={formData.leave_balance}
        onChange={(e) =>
          setFormData({ ...formData, leave_balance: e.target.value })
        }
      />
      <input
        type="text"
        placeholder="Attendance Status"
        className="w-full border px-3 py-2 rounded"
        value={formData.attendance_status}
        onChange={(e) =>
          setFormData({ ...formData, attendance_status: e.target.value })
        }
      />

      <div className="flex justify-end gap-2 mt-4">
        <button
          type="button"
          className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          Add
        </button>
      </div>
    </form>
  </ModalWrapper>
);

// ---------- Edit User Modal ----------
const EditUserModal = ({ formData, setFormData, onSubmit, onClose }) => (
  <ModalWrapper>
    <h3 className="text-xl font-semibold mb-4 text-gray-800">Edit User</h3>
    <form onSubmit={onSubmit} className="space-y-4">
      <input
        type="text"
        placeholder="Full Name"
        className="w-full border px-3 py-2 rounded"
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        required
      />
      <input
        type="email"
        placeholder="Email"
        className="w-full border px-3 py-2 rounded"
        value={formData.email}
        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
        required
      />
      <select
        className="w-full border px-3 py-2 rounded"
        value={formData.role}
        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
        required
      >
        <option value="">Select Role</option>
        <option value="hr">HR</option>
        <option value="engineer">Engineer</option>
        <option value="employee">Employee</option>
      </select>
      <input
        type="number"
        placeholder="Leave Balance"
        className="w-full border px-3 py-2 rounded"
        value={formData.leave_balance}
        onChange={(e) =>
          setFormData({ ...formData, leave_balance: e.target.value })
        }
      />
      <input
        type="text"
        placeholder="Attendance Status"
        className="w-full border px-3 py-2 rounded"
        value={formData.attendance_status}
        onChange={(e) =>
          setFormData({ ...formData, attendance_status: e.target.value })
        }
      />

      <div className="flex justify-end gap-2 mt-4">
        <button
          type="button"
          className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Save Changes
        </button>
      </div>
    </form>
  </ModalWrapper>
);

// ---------- Delete User Modal ----------
const DeleteUserModal = ({ selectedUser, onDelete, onClose }) => (
  <ModalWrapper>
    <h3 className="text-xl font-semibold mb-4 text-gray-800">Delete User</h3>
    <p className="text-gray-600 mb-6">
      Are you sure you want to delete{" "}
      <span className="font-bold">{selectedUser?.name}</span>?
    </p>
    <div className="flex justify-end gap-2">
      <button
        className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
        onClick={onClose}
      >
        Cancel
      </button>
      <button
        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        onClick={onDelete}
      >
        Delete
      </button>
    </div>
  </ModalWrapper>
);

// ---------- Give Task Modal ----------
const GiveTaskModal = ({ selectedUser, taskData, setTaskData, onSubmit, onClose }) => (
  <ModalWrapper>
    <h3 className="text-xl font-semibold mb-4 text-gray-800">
      Assign Task to {selectedUser?.name}
    </h3>
    <form onSubmit={onSubmit} className="space-y-4">
      <input
        type="text"
        placeholder="Task Title"
        className="w-full border px-3 py-2 rounded"
        value={taskData.title}
        onChange={(e) => setTaskData({ ...taskData, title: e.target.value })}
        required
      />
      <textarea
        placeholder="Task Description"
        className="w-full border px-3 py-2 rounded"
        rows="4"
        value={taskData.description}
        onChange={(e) => setTaskData({ ...taskData, description: e.target.value })}
        required
      />

      <div className="flex justify-end gap-2">
        <button
          type="button"
          className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
        >
          Assign Task
        </button>
      </div>
    </form>
  </ModalWrapper>
);

const TaskStatusModal = ({ selectedUser, onClose }) => (
  <ModalWrapper>
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center border-b pb-3 mb-4">
        <h3 className="text-2xl font-semibold text-gray-800">
          Tasks for {selectedUser?.name}
        </h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-xl font-bold"
        >
          &times;
        </button>
      </div>

      {/* Task List */}
      {selectedUser?.tasks && selectedUser.tasks.length > 0 ? (
        <div className="space-y-3 max-h-72 overflow-y-auto pr-2">
          {selectedUser.tasks.map((task) => (
            <div
              key={task.id}
              className="p-4 border rounded-lg shadow-sm hover:shadow-md transition flex justify-between items-start bg-gray-50"
            >
              <div>
                <p className="font-semibold text-gray-800">{task.title}</p>
                <p className="text-gray-600 mt-1 text-sm">{task.description}</p>
              </div>
              <span
                className={`text-sm font-medium px-2 py-1 rounded-full ${
                  task.status?.toLowerCase() === "completed"
                    ? "bg-green-100 text-green-800"
                    : task.status?.toLowerCase() === "in progress"
                    ? "bg-yellow-100 text-yellow-800"
                    : "bg-gray-100 text-gray-800"
                }`}
              >
                {task.status || "Pending"}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-500 text-center mt-6">No tasks assigned.</p>
      )}

      {/* Footer */}
      <div className="flex justify-end mt-6">
        <button
          onClick={onClose}
          className="px-5 py-2 bg-gray-300 rounded hover:bg-gray-400 font-medium"
        >
          Close
        </button>
      </div>
    </div>
  </ModalWrapper>
);



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
      await axios.post("/api/users/create", dataToSend);
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
      <div className="flex flex-1 bg-gray-50">
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
                        <button
                          onClick={() => openTaskModal(u)}
                          className="text-indigo-600 hover:underline"
                        >
                          Give Task
                        </button>
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
