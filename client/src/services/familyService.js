import api from './api';

const familyService = {
  checkDuplicate: (phone) => api.get('/families/duplicate-check', { params: { phone } }).then((res) => res.data),

  // Existing family claim flow
  lookup: (familyId) => api.get(`/families/lookup/${familyId}`).then((res) => res.data),
  sendHeadOtp: (familyId) => api.post(`/families/lookup/${familyId}/send-otp`).then((res) => res.data),
  verifyHeadOtp: (familyId, otp) => api.post(`/families/lookup/${familyId}/verify-otp`, { otp }).then((res) => res.data),
  updateResidence: (familyId, data) => api.put(`/families/${familyId}/residence`, data).then((res) => res.data),

  // New family creation
  create: (formData) =>
    api
      .post('/families', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then((res) => res.data),

  list: (params) => api.get('/families', { params }).then((res) => res.data),
  getById: (id) => api.get(`/families/${id}`).then((res) => res.data),
  resubmit: (id, formData) =>
    api
      .put(`/families/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then((res) => res.data),
  getHistory: (id) => api.get(`/families/${id}/history`).then((res) => res.data),
};

export default familyService;
