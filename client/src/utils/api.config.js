/**
 * Centralized API Configuration
 * Used across all routes to ensure consistent API URL handling
 */
import { Capacitor } from "@capacitor/core";

const getApiUrl = () => {
  // 1. Native Mobile App (Capacitor)
  if (Capacitor.isNativePlatform()) {
    return 'https://hrms.sandjglobaltech.com';
  }

  if (typeof window !== 'undefined') {
    // 2. Local development on user's PC (e.g., npm run dev from browser)
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://localhost:5001';
    }

    // 3. Web application (Live server in standard browsers)
    // This dynamically returns exactly what the browser sees (e.g., https://hrms.sandjglobaltech.com)
    return window.location.origin;
  }

  return 'https://hrms.sandjglobaltech.com';
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
  assign_call: '/api/service-calls',
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
