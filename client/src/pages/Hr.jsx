import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

function Hr() {
  const navigate = useNavigate();
  const [activeModule, setActiveModule] = useState("dashboard");
  const [message, setMessage] = useState("");

  // Dummy data placeholders
  const [employees, setEmployees] = useState([
    { id: 1, name: "John Smith", email: "john@example.com", role: "Engineer" },
    { id: 2, name: "Alice Kumar", email: "alice@example.com", role: "Employee" },
  ]);

  const [attendance, setAttendance] = useState([
    { id: 1, employee: "John Smith", date: "2025-10-15", status: "Present" },
    { id: 2, employee: "Alice Kumar", date: "2025-10-15", status: "Absent" },
  ]);

  const [leaves, setLeaves] = useState([
    { id: 1, employee: "John Smith", type: "Casual", from: "2025-10-10", to: "2025-10-12", status: "Approved" },
  ]);

  const [payroll, setPayroll] = useState([
    { id: 1, employee: "John Smith", month: "October", salary: 50000, deductions: 5000, net: 45000 },
  ]);

  const modules = [
    { key: "dashboard", label: "Dashboard" },
    { key: "employees", label: "Employees" },
    { key: "attendance", label: "Attendance" },
    { key: "leave", label: "Leave Management" },
    { key: "payroll", label: "Payroll" },
  ];

  const renderContent = () => {
    switch (activeModule) {
      case "dashboard":
        return (
          <div>
            <h2 className="text-2xl font-bold mb-6">HR Dashboard</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-blue-100 p-6 rounded-xl shadow text-center">
                <h3 className="font-semibold text-gray-700">Total Employees</h3>
                <p className="text-2xl font-bold text-blue-700 mt-2">{employees.length}</p>
              </div>
              <div className="bg-green-100 p-6 rounded-xl shadow text-center">
                <h3 className="font-semibold text-gray-700">Attendance Today</h3>
                <p className="text-2xl font-bold text-green-700 mt-2">
                  {attendance.filter(a => a.date === new Date().toISOString().split("T")[0] && a.status === "Present").length} Present
                </p>
              </div>
              <div className="bg-yellow-100 p-6 rounded-xl shadow text-center">
                <h3 className="font-semibold text-gray-700">Leaves Pending</h3>
                <p className="text-2xl font-bold text-yellow-700 mt-2">{leaves.filter(l => l.status === "Pending").length}</p>
              </div>
              <div className="bg-purple-100 p-6 rounded-xl shadow text-center">
                <h3 className="font-semibold text-gray-700">Payroll Records</h3>
                <p className="text-2xl font-bold text-purple-700 mt-2">{payroll.length}</p>
              </div>
            </div>
          </div>
        );

      case "employees":
        return (
          <div>
            <h2 className="text-2xl font-bold mb-4">Employee Database</h2>
            <table className="min-w-full bg-white rounded-xl shadow">
              <thead className="bg-gray-700 text-white">
                <tr>
                  <th className="py-2 px-4 text-left">Name</th>
                  <th className="py-2 px-4 text-left">Email</th>
                  <th className="py-2 px-4 text-left">Role</th>
                </tr>
              </thead>
              <tbody>
                {employees.map(emp => (
                  <tr key={emp.id} className="border-b hover:bg-gray-100">
                    <td className="py-2 px-4">{emp.name}</td>
                    <td className="py-2 px-4">{emp.email}</td>
                    <td className="py-2 px-4">{emp.role}</td>
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
              <thead className="bg-blue-500 text-white">
                <tr>
                  <th className="py-2 px-4 text-left">Employee</th>
                  <th className="py-2 px-4 text-left">Date</th>
                  <th className="py-2 px-4 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {attendance.map(a => (
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
                  <th className="py-2 px-4 text-left">Employee</th>
                  <th className="py-2 px-4 text-left">Type</th>
                  <th className="py-2 px-4 text-left">From</th>
                  <th className="py-2 px-4 text-left">To</th>
                  <th className="py-2 px-4 text-left">Status</th>
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

      case "payroll":
        return (
          <div>
            <h2 className="text-2xl font-bold mb-4">Payroll Management</h2>
            <table className="min-w-full bg-white rounded-xl shadow">
              <thead className="bg-purple-500 text-white">
                <tr>
                  <th className="py-2 px-4 text-left">Employee</th>
                  <th className="py-2 px-4 text-left">Month</th>
                  <th className="py-2 px-4 text-left">Salary</th>
                  <th className="py-2 px-4 text-left">Deductions</th>
                  <th className="py-2 px-4 text-left">Net Pay</th>
                </tr>
              </thead>
              <tbody>
                {payroll.map(p => (
                  <tr key={p.id} className="border-b hover:bg-gray-100">
                    <td className="py-2 px-4">{p.employee}</td>
                    <td className="py-2 px-4">{p.month}</td>
                    <td className="py-2 px-4">{p.salary}</td>
                    <td className="py-2 px-4">{p.deductions}</td>
                    <td className="py-2 px-4">{p.net}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );

      default:
        return <div>Select a module</div>;
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <div className="w-1/5 bg-gray-700 text-white p-6 flex flex-col justify-between min-h-screen">
        <div className="flex flex-col space-y-4">
          <h1 className="text-2xl font-bold mb-6">HR Panel</h1>
          {modules.map((mod) => (
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

        <button
          onClick={() => navigate("/login")}
          className="w-full py-2 mt-6 rounded bg-red-600 hover:bg-red-700 text-white"
        >
          Logout
        </button>
      </div>

      {/* Main content */}
      <div className="w-4/5 p-8 bg-gray-100">{renderContent()}</div>
    </div>
  );
}

export default Hr;
