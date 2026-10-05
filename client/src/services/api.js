import axios from 'axios';

// Single Axios instance used across the whole app. Every service module
// (Phase 2+: authService, houseService, tenantService, etc.) should import
// this instead of creating its own axios instance.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT token (set during login in Phase 2) to every outgoing request.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('gp_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Centralized handling for expired/invalid sessions.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('gp_token');
      localStorage.removeItem('gp_user');
      // Redirect handled by ProtectedRoute / AuthContext in Phase 2,
      // not forced here, so this stays a pure API layer.
    }
    return Promise.reject(error);
  }
);

export default api;
