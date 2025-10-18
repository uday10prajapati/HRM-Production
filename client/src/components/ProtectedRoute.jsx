import React from 'react';
import { Navigate } from 'react-router-dom';
import { getCurrentUser } from '../utils/auth';

export default function ProtectedRoute({ children, role }) {
  const user = getCurrentUser();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (role && (''+user.role).toLowerCase() !== (''+role).toLowerCase()) {
    // if role mismatch, redirect to user's dashboard
    const r = (''+user.role).toLowerCase();
    if (r === 'admin') return <Navigate to="/admin-dashboard" replace />;
    if (r === 'hr') return <Navigate to="/hr-dashboard" replace />;
    if (r === 'engineer') return <Navigate to="/engineer" replace />;
    return <Navigate to="/employee" replace />;
  }
  return children;
}
