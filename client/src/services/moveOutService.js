import api from './api';

const moveOutService = {
  createForTenant: (tenantId, data) => api.post(`/tenants/${tenantId}/move-out`, data).then((res) => res.data),
  createForFamily: (familyId, data) => api.post(`/families/${familyId}/move-out`, data).then((res) => res.data),
  list: (params) => api.get('/move-outs', { params }).then((res) => res.data),
  approve: (id) => api.post(`/move-outs/${id}/approve`).then((res) => res.data),
  reject: (id, reason) => api.post(`/move-outs/${id}/reject`, { reason }).then((res) => res.data),
};

export default moveOutService;
