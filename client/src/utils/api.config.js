/**
 * Centralized API Configuration
 * Used across all routes to ensure consistent API URL handling
 */
import { Capacitor } from "@capacitor/core";

const getApiUrl = () => {
  // Priority: 1. Native Mobile > 2. env var > 3. localhost dev > 4. production domain
  if (Capacitor.isNativePlatform()) {
    return 'https://hrms.sandjglobaltech.com';
  }

  if (import.meta?.env?.VITE_API_URL) {
    let url = import.meta.env.VITE_API_URL;
    // Remove /api suffix if present (endpoints include it)
    url = url.replace(/\/api\/?$/, '');
    return url || 'http://localhost:5001';
  }

  // Development
  if (import.meta?.env?.MODE === 'development' || !import.meta?.env?.PROD) {
    return 'http://localhost:5001';
  }

  // Production: Web Use current page's protocol (http or https)
  const protocol = typeof window !== 'undefined' ? window.location.protocol : 'https:';
  return `${protocol}//hrms.sandjglobaltech.com`;
};

export const API_CONFIG = {
  BASE_URL: getApiUrl(),
  TIMEOUT: 30000,
  HEADERS: {
    'Content-Type': 'application/json',
  },
};

// Common API endpoints
export const API_ENDPOINTS = {
  // Auth
  LOGIN: '/api/auth/login',
  LOGOUT: '/api/auth/logout',

  // Users
  USERS: '/api/users',

  // Leave
  LEAVE: '/api/leave',
  LEAVE_APPLY: '/api/leave/apply',

  // Attendance
  ATTENDANCE: '/api/attendance',

  // Documents
  DOCUMENTS: '/api/documents',

  // Tasks
  TASKS: '/api/tasks',

  // Service Calls
  SERVICE_CALLS: '/api/service-calls',
  ASSIGNED_CALLS: '/api/service-calls/assigned-calls',

  // Payroll
  PAYROLL: '/api/payroll',

  // Shifts
  SHIFTS: '/api/shifts',

  // Stock
  STOCK: '/api/stock',
};

/**
 * Helper to construct full API URLs
 * @param {string} endpoint - The API endpoint path
 * @returns {string} - Full API URL
 */
export const getFullApiUrl = (endpoint) => {
  return `${API_CONFIG.BASE_URL}${endpoint}`;
};

/**
 * Default fetch config with headers and timeout
 */
export const getFetchConfig = (method = 'GET', body = null, customHeaders = {}) => {
  const config = {
    method,
    headers: {
      ...API_CONFIG.HEADERS,
      ...customHeaders,
    },
  };

  if (body) {
    config.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  return config;
};

export default API_CONFIG;
