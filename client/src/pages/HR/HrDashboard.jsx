import React, { useEffect } from "react";
import Sidebar from "../../components/Sidebar"; 
import Navbar from "../../components/Navbar";
import { useNavigate } from "react-router-dom";

const HrDashboard = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const storedUser = localStorage.getItem("user");

    if (storedUser) {
      const user = JSON.parse(storedUser);

      // Optional: redirect if role is not HR
      if (user.role.toLowerCase() !== "hr") {
        navigate("/login"); // or another page
      }
    } else {
      navigate("/login"); // redirect if no user found
    }
  }, [navigate]);

  return (
    <div className="flex flex-col h-screen">
      <Navbar />
      <div className="flex flex-1 min-h-screen">
        <Sidebar />
        <div className="p-6 bg-gray-100 flex-1">
          <h2 className="text-2xl font-semibold mb-4">Hi HR!</h2>
          <p>
            Welcome to your dashboard. Here you can manage users, attendance, leave, and reports.
          </p>
        </div>
      </div>
    </div>
  );
};

export default HrDashboard;
