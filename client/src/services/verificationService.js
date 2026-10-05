import api from './api';

const verificationService = {
  listPending: (params) => api.get('/verifications/pending', { params }).then((res) => res.data),
  getById: (id) => api.get(`/verifications/${id}`).then((res) => res.data),
  approve: (id) => api.post(`/verifications/${id}/approve`).then((res) => res.data),
  reject: (id, reason) => api.post(`/verifications/${id}/reject`, { reason }).then((res) => res.data),
  requestCorrection: (id, notes) => api.post(`/verifications/${id}/correction`, { notes }).then((res) => res.data),
};

export default verificationService;
