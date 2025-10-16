import React from 'react';
import Navbar from '../../components/Navbar'; // Make sure Navbar is in the same directory or update path accordingly
import Sidebar from '../../components/Sidebar';

const Admin = () => {
  return (
    <>
      <Navbar />
      <Sidebar />
      <div className="p-6">
        Admin Page
      </div>
    </>
  );
};

export default Admin;
