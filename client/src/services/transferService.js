import api from './api';

const transferService = {
  create: (data) => api.post('/transfers', data).then((res) => res.data),
  list: (params) => api.get('/transfers', { params }).then((res) => res.data),
  approve: (id) => api.post(`/transfers/${id}/approve`).then((res) => res.data),
  reject: (id, reason) => api.post(`/transfers/${id}/reject`, { reason }).then((res) => res.data),
};

export default transferService;
