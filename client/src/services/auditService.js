import api from './api';

const auditService = {
  list: (params) => api.get('/audit-logs', { params }).then((res) => res.data),
};

export default auditService;
