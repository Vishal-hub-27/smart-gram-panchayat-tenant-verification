import api from './api';

// Thin wrapper around the auth endpoints. Components/context call these
// instead of hitting `api` directly, keeping the API shape in one place.
const authService = {
  register: (data) => api.post('/auth/register', data).then((res) => res.data),
  sendOtp: (phone) => api.post('/auth/send-otp', { phone }).then((res) => res.data),
  verifyOtp: (phone, otp) => api.post('/auth/verify-otp', { phone, otp }).then((res) => res.data),
  login: (phone, password) => api.post('/auth/login', { phone, password }).then((res) => res.data),
  getMe: () => api.get('/auth/me').then((res) => res.data),
};

export default authService;
