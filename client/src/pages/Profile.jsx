import React from 'react';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';

export default function Profile() {
  const stored = localStorage.getItem('user');
  const user = stored ? JSON.parse(stored) : null;

  return (
    <div className="flex flex-col h-screen">
      <Navbar />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 p-6 bg-gray-100">
          <h1 className="text-2xl font-semibold mb-4">My Profile</h1>
          <div className="bg-white rounded shadow p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-500">Name</div>
                <div className="font-medium">{user?.name ?? '-'}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Email</div>
                <div className="font-medium">{user?.email ?? '-'}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Role</div>
                <div className="font-medium capitalize">{user?.role ?? '-'}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Attendance Status</div>
                <div className="font-medium">{user?.attendance_status ?? '-'}</div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
