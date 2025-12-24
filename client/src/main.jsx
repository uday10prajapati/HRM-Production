import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../index.css";
import App from "./App.jsx";
import axios from 'axios';

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

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
