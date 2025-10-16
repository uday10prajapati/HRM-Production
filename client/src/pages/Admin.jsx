import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

function AdminPage() {
  const navigate = useNavigate();
  const [activeModule, setActiveModule] = useState("dashboard");
  const [message, setMessage] = useState("");

  // Dummy data placeholders
  const [users, setUsers] = useState([
    { id: 1, name: "John Smith", email: "john@example.com", role: "Engineer" },
    { id: 2, name: "Alice Kumar", email: "alice@example.com", role: "HR" },
    { id: 3, name: "Rajesh Sharma", email: "rajesh@example.com", role: "Employee" },
  ]);

  const [attendanceRecords, setAttendanceRecords] = useState([
    { id: 1, employee: "John Smith", date: "2025-10-15", status: "Present" },
    { id: 2, employee: "Alice Kumar", date: "2025-10-15", status: "Absent" },
  ]);

  const [tasks, setTasks] = useState([
    { id: 1, customer: "Acme Corp", engineer: "John Smith", status: "Assigned" },
  ]);

  const [stock, setStock] = useState([
    { id: 1, item: "AC Filter", quantity: 10 },
    { id: 2, item: "Pipe", quantity: 5 },
  ]);

  const [leaves, setLeaves] = useState([
    { id: 1, employee: "John Smith", type: "Casual", from: "2025-10-10", to: "2025-10-12", status: "Pending" },
  ]);

  const modules = [
    { key: "dashboard", label: "Dashboard" },
    { key: "users", label: "Users & Roles" },
    { key: "attendance", label: "Attendance" },
    { key: "leave", label: "Leave Management" },
    { key: "tasks", label: "Field Tasks" },
    { key: "stock", label: "Inventory & Stock" },
    { key: "payroll", label: "Payroll" },
  ];

  const renderContent = () => {
    switch (activeModule) {
      case "dashboard":
        return (
          <div>
            <h2 className="text-2xl font-bold mb-6">Admin Dashboard</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-blue-100 p-6 rounded-xl shadow text-center">
                <h3 className="font-semibold text-gray-700">Total Users</h3>
                <p className="text-2xl font-bold text-blue-700 mt-2">{users.length}</p>
              </div>
              <div className="bg-green-100 p-6 rounded-xl shadow text-center">
                <h3 className="font-semibold text-gray-700">Today Attendance</h3>
                <p className="text-2xl font-bold text-green-700 mt-2">
                  {attendanceRecords.filter(a => a.date === new Date().toISOString().split("T")[0] && a.status === "Present").length} Present
                </p>
              </div>
              <div className="bg-yellow-100 p-6 rounded-xl shadow text-center">
                <h3 className="font-semibold text-gray-700">Pending Leaves</h3>
                <p className="text-2xl font-bold text-yellow-700 mt-2">{leaves.filter(l => l.status === "Pending").length}</p>
              </div>
              <div className="bg-purple-100 p-6 rounded-xl shadow text-center">
                <h3 className="font-semibold text-gray-700">Open Tasks</h3>
                <p className="text-2xl font-bold text-purple-700 mt-2">{tasks.length}</p>
              </div>
            </div>
          </div>
        );

      case "users":
        return (
          <div>
            <h2 className="text-2xl font-bold mb-4">User Management</h2>
            <table className="min-w-full bg-white rounded-xl shadow">
              <thead className="bg-blue-500 text-white">
                <tr>
                  <th className="py-2 px-4">Name</th>
                  <th className="py-2 px-4">Email</th>
                  <th className="py-2 px-4">Role</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id} className="border-b hover:bg-gray-100">
                    <td className="py-2 px-4">{user.name}</td>
                    <td className="py-2 px-4">{user.email}</td>
                    <td className="py-2 px-4">{user.role}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );

      case "attendance":
        return (
          <div>
            <h2 className="text-2xl font-bold mb-4">Attendance Records</h2>
            <table className="min-w-full bg-white rounded-xl shadow">
              <thead className="bg-green-500 text-white">
                <tr>
                  <th className="py-2 px-4">Employee</th>
                  <th className="py-2 px-4">Date</th>
                  <th className="py-2 px-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {attendanceRecords.map(a => (
                  <tr key={a.id} className="border-b hover:bg-gray-100">
                    <td className="py-2 px-4">{a.employee}</td>
                    <td className="py-2 px-4">{a.date}</td>
                    <td className="py-2 px-4">{a.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );

      case "leave":
        return (
          <div>
            <h2 className="text-2xl font-bold mb-4">Leave Management</h2>
            <table className="min-w-full bg-white rounded-xl shadow">
              <thead className="bg-yellow-500 text-white">
                <tr>
                  <th className="py-2 px-4">Employee</th>
                  <th className="py-2 px-4">Type</th>
                  <th className="py-2 px-4">From</th>
                  <th className="py-2 px-4">To</th>
                  <th className="py-2 px-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {leaves.map(l => (
                  <tr key={l.id} className="border-b hover:bg-gray-100">
                    <td className="py-2 px-4">{l.employee}</td>
                    <td className="py-2 px-4">{l.type}</td>
                    <td className="py-2 px-4">{l.from}</td>
                    <td className="py-2 px-4">{l.to}</td>
                    <td className="py-2 px-4">{l.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );

      case "tasks":
        return (
          <div>
            <h2 className="text-2xl font-bold mb-4">Field Tasks / Service Calls</h2>
            <table className="min-w-full bg-white rounded-xl shadow">
              <thead className="bg-purple-500 text-white">
                <tr>
                  <th className="py-2 px-4">Customer</th>
                  <th className="py-2 px-4">Assigned Engineer</th>
                  <th className="py-2 px-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map(task => (
                  <tr key={task.id} className="border-b hover:bg-gray-100">
                    <td className="py-2 px-4">{task.customer}</td>
                    <td className="py-2 px-4">{task.engineer}</td>
                    <td className="py-2 px-4">{task.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );

      case "stock":
        return (
          <div>
            <h2 className="text-2xl font-bold mb-4">Inventory & Stock</h2>
            <table className="min-w-full bg-white rounded-xl shadow">
              <thead className="bg-indigo-500 text-white">
                <tr>
                  <th className="py-2 px-4">Item</th>
                  <th className="py-2 px-4">Quantity</th>
                </tr>
              </thead>
              <tbody>
                {stock.map(item => (
                  <tr key={item.id} className="border-b hover:bg-gray-100">
                    <td className="py-2 px-4">{item.item}</td>
                    <td className="py-2 px-4">{item.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );

      case "payroll":
        return (
          <div>
            <h2 className="text-2xl font-bold mb-4">Payroll & Compliance</h2>
            <p>Generate salary slips, Form 16, PF/ESI reports.</p>
            <ul className="list-disc ml-5 mt-2">
              <li>Total Employees: {users.length}</li>
              <li>Pending Payroll Calculations: {users.length}</li>
            </ul>
          </div>
        );

      default:
        return <div>Select a module</div>;
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <div className="w-1/5 bg-gray-600 text-white p-6 flex flex-col justify-between min-h-screen">
        <div className="flex flex-col space-y-4">
          <h1 className="text-2xl font-bold mb-6">Admin Panel</h1>
          {modules.map(mod => (
            <button
              key={mod.key}
              onClick={() => setActiveModule(mod.key)}
              className={`w-full py-2 text-left px-2 rounded hover:bg-gray-500 ${
                activeModule === mod.key ? "bg-white text-black" : ""
              }`}
            >
              {mod.label}
            </button>
          ))}
        </div>

        {/* Logout Button */}
        <button
          onClick={() => navigate("/login")}
          className="w-full py-2 mt-6 rounded bg-red-600 hover:bg-red-700 text-white"
        >
          Logout
        </button>
      </div>

      {/* Main Content */}
      <div className="w-4/5 p-8 bg-gray-100">
        {message && (
          <p className={`mb-4 ${message.includes("✅") ? "text-green-600" : "text-red-600"}`}>
            {message}
          </p>
        )}
        {renderContent()}
      </div>
    </div>
  );
}

export default AdminPage;
