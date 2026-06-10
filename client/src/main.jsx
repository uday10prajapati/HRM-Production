import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../index.css";
import App from "./App.jsx";
import axios from 'axios';
import { API_CONFIG } from './utils/api.config';

// Set axios baseURL to API domain (no /api/ suffix - endpoints include it)
axios.defaults.baseURL = API_CONFIG.BASE_URL;

// Setup axios with auth token
const token = localStorage.getItem('token');
if (token) {
  axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}

// If a user is stored in localStorage (from login), include their id as a fallback
// auth header for server endpoints that accept X-User-Id for dev auth.
try {
  const stored = localStorage.getItem('user');
  if (stored) {
    const parsed = JSON.parse(stored);
    if (parsed && parsed.id) {
      axios.defaults.headers.common['x-user-id'] = String(parsed.id);
    }
  }
} catch (e) {
  // ignore JSON parse errors
}

// Response interceptor to catch auto-logout if blocked
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 403 && error.response.data && error.response.data.isBlocked) {
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      delete axios.defaults.headers.common['x-user-id'];
      delete axios.defaults.headers.common['Authorization'];
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
