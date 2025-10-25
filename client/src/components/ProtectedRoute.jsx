import React from 'react';
import { Navigate } from 'react-router-dom';
import { getCurrentUser } from '../utils/auth';

export default function ProtectedRoute({ children, role }) {
  const user = getCurrentUser();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  // If a specific role is requested, enforce it.
  if (role && (''+user.role).toLowerCase() !== (''+role).toLowerCase()) {
    // if role mismatch, redirect to user's dashboard
    const r = (''+user.role).toLowerCase();
    if (r === 'admin') return <Navigate to="/admin-dashboard" replace />;
    if (r === 'hr') return <Navigate to="/hr-dashboard" replace />;
    if (r === 'engineer') return <Navigate to="/engineer" replace />;
    return <Navigate to="/employee" replace />;
  }
  // If no role prop is provided, restrict access to only admin and hr
  if (!role) {
    const r = (''+user.role).toLowerCase();
    if (r !== 'admin' && r !== 'hr') {
      // For other roles, redirect to login (deny access to this portal)
      return <Navigate to="/login" replace />;
    }
  }
  return children;
}
