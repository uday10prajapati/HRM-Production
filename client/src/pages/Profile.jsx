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
        <main className="flex-1 p-8 bg-gray-100">
          <div className="max-w-4xl mx-auto">
            {/* Header Section */}
            

            {/* Profile Card */}
            <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
              <div className="flex items-center gap-6 mb-6">
                <div className="w-24 h-24 bg-blue-600 rounded-full flex items-center justify-center">
                  <span className="text-3xl font-bold text-white">
                    {user?.name?.[0]?.toUpperCase() ?? 'U'}
                  </span>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">{user?.name ?? 'User Name'}</h2>
                  <p className="text-gray-500">{user?.email ?? 'email@example.com'}</p>
                  <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium mt-2 capitalize">
                    {user?.role ?? 'Role'}
                  </span>
                </div>
              </div>

             

              {/* Details Section */}
              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Personal Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <div className="text-sm text-gray-500 mb-1">Full Name</div>
                    <div className="font-medium text-gray-800">{user?.name ?? '-'}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500 mb-1">Email Address</div>
                    <div className="font-medium text-gray-800">{user?.email ?? '-'}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500 mb-1">Role</div>
                    <div className="font-medium text-gray-800 capitalize">{user?.role ?? '-'}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500 mb-1">Department</div>
                    <div className="font-medium text-gray-800">Human Resources</div>
                  </div>
                </div>
              </div>
            </div>

           
            
          </div>
        </main>
      </div>
    </div>
  );
}
