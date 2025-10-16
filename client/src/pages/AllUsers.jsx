import React, { useEffect, useState } from "react";
import axios from "axios";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import { useNavigate } from "react-router-dom";

const API_BASE_URL = import.meta.env.VITE_API_URL;
axios.defaults.baseURL = API_BASE_URL;

const AllUsers = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null); // Logged-in user

  // Modal state
  const [isAddModalOpen, setAddModalOpen] = useState(false);
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    role: "",
    leaveBalance: 20,
    attendanceStatus: "",
    password: "",
  });

  // Check for logged-in user
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
    } else {
      navigate("/login");
    }
  }, [navigate]);

  // Fetch users with role-based filtering
  const fetchUsers = async () => {
    try {
      const response = await axios.get("/api/users/");
      let allUsers = response.data.users || response.data;

      // Apply role-based filter
      if (user.role.toLowerCase() === "hr") {
        allUsers = allUsers.filter(
          (u) =>
            u.role.toLowerCase() === "engineer" ||
            u.role.toLowerCase() === "employee"
        );
      }

      setUsers(allUsers);
      setLoading(false);
    } catch (err) {
      setError("Failed to load users");
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchUsers();
  }, [user]);

  // Modal handlers
  const handleAddUser = () => {
    setFormData({
      name: "",
      email: "",
      role: "",
      leaveBalance: 20,
      attendanceStatus: "",
      password: "",
    });
    setAddModalOpen(true);
  };

  const handleEditUser = (user) => {
    setSelectedUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      role: user.role,
      leaveBalance: user.leaveBalance ?? "",
      attendanceStatus: user.attendanceStatus ?? "",
    });
    setEditModalOpen(true);
  };

  const handleDeleteUser = (user) => {
    setSelectedUser(user);
    setDeleteModalOpen(true);
  };

  const handleAddSubmit = async () => {
    try {
      const dataToSend = {
        ...formData,
        leaveBalance: Number(formData.leaveBalance) || 20,
      };
      await axios.post("/api/users/create", dataToSend);
      setAddModalOpen(false);
      fetchUsers();
    } catch (err) {
      console.error("Add user failed", err);
    }
  };

  const handleEditSubmit = async () => {
    try {
      await axios.put(`/api/users/update/${selectedUser.id}`, formData);
      setEditModalOpen(false);
      fetchUsers();
    } catch (err) {
      console.error("Edit user failed", err);
    }
  };

  const handleDeleteSubmit = async () => {
    try {
      await axios.delete(`/api/users/delete/${selectedUser.id}`);
      setDeleteModalOpen(false);
      fetchUsers();
    } catch (err) {
      console.error("Delete user failed", err);
    }
  };

  // --- Modal Components ---
  const AddUserModal = () => (
    <div className="fixed inset-0 bg-black/40 bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
        <h3 className="text-xl font-semibold mb-4">Add User</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAddSubmit();
          }}
          className="space-y-4"
        >
          <input
            type="text"
            placeholder="Name"
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
           <input
            type="password"
            placeholder="Password"
            className="w-full border px-3 py-2 rounded"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            required
          />
          <select
  className="w-full border px-3 py-2 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
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
            value={formData.leaveBalance}
            onChange={(e) => setFormData({ ...formData, leaveBalance: e.target.value })}
          />
          <input
            type="text"
            placeholder="Attendance Status"
            className="w-full border px-3 py-2 rounded"
            value={formData.attendanceStatus}
            onChange={(e) => setFormData({ ...formData, attendanceStatus: e.target.value })}
          />
         
          <div className="flex justify-end gap-2 mt-4">
            <button
              type="button"
              className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
              onClick={() => setAddModalOpen(false)}
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
      </div>
    </div>
  );

  const EditUserModal = () => (
    <div className="fixed inset-0 bg-black/40 bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
        <h3 className="text-xl font-semibold mb-4">Edit User</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleEditSubmit();
          }}
          className="space-y-4"
        >
          <input
            type="text"
            placeholder="Name"
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
          <input
            type="text"
            placeholder="Role"
            className="w-full border px-3 py-2 rounded"
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            required
          />
          <input
            type="number"
            placeholder="Leave Balance"
            className="w-full border px-3 py-2 rounded"
            value={formData.leaveBalance}
            onChange={(e) => setFormData({ ...formData, leaveBalance: e.target.value })}
          />
          <input
            type="text"
            placeholder="Attendance Status"
            className="w-full border px-3 py-2 rounded"
            value={formData.attendanceStatus}
            onChange={(e) => setFormData({ ...formData, attendanceStatus: e.target.value })}
          />
          <div className="flex justify-end gap-2 mt-4">
            <button
              type="button"
              className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
              onClick={() => setEditModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  const DeleteUserModal = () => (
    <div className="fixed inset-0 bg-black/40 bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-sm">
        <h3 className="text-xl font-semibold mb-4">Delete User</h3>
        <p>
          Are you sure you want to delete{" "}
          <span className="font-bold">{selectedUser?.name}</span>?
        </p>
        <div className="flex justify-end gap-2 mt-6">
          <button
            type="button"
            className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
            onClick={() => setDeleteModalOpen(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            onClick={handleDeleteSubmit}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );

  if (!user) return null; // Prevent rendering before redirect
  if (loading) return <div className="p-6">Loading users...</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="flex flex-1 bg-gray-50">
        <Sidebar />
        <main className="flex-1 p-6">
          {/* Modals */}
          {isAddModalOpen && <AddUserModal />}
          {isEditModalOpen && <EditUserModal />}
          {isDeleteModalOpen && <DeleteUserModal />}

          <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-semibold text-gray-800">All Users</h2>
            <button
              onClick={handleAddUser}
              className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-md shadow"
            >
              Add User
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
                      "Actions",
                    ].map((header) => (
                      <th
                        key={header}
                        className="whitespace-nowrap px-6 py-3 text-left text-sm font-semibold text-gray-700"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">{user.id}</td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">{user.name}</td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">{user.email}</td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">{user.role}</td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">{user.leave_balance ?? "N/A"}</td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">{user.attendanceStatus ?? "N/A"}</td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                        <button
                          onClick={() => handleEditUser(user)}
                          className="mr-3 text-blue-600 hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user)}
                          className="text-red-600 hover:underline"
                        >
                          Delete
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
