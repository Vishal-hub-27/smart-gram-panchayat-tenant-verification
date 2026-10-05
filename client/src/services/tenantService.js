import api from './api';

const tenantService = {
  checkDuplicate: (phone) => api.get('/tenants/duplicate-check', { params: { phone } }).then((res) => res.data),
  create: (formData) =>
    api
      .post('/tenants', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then((res) => res.data),
  list: (params) => api.get('/tenants', { params }).then((res) => res.data),
  getById: (id) => api.get(`/tenants/${id}`).then((res) => res.data),
  resubmit: (id, formData) =>
    api
      .put(`/tenants/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then((res) => res.data),
  getHistory: (id) => api.get(`/tenants/${id}/history`).then((res) => res.data),
};

export default tenantService;
