import api from './api';

const reportService = {
  getDashboardStats: () => api.get('/reports/dashboard').then((res) => res.data),
  getDashboardCharts: () => api.get('/reports/charts').then((res) => res.data),
  getTenantReport: (params) => api.get('/reports/tenants', { params }).then((res) => res.data),
  getHouseReport: (params) => api.get('/reports/houses', { params }).then((res) => res.data),
  getMovementReport: (params) => api.get('/reports/movement', { params }).then((res) => res.data),
  // CSV downloads go through the browser directly (not axios) so the
  // server's Content-Disposition header drives the save dialog.
  csvUrl: (report, params = {}) => {
    const base = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, '');
    const qs = new URLSearchParams({ ...params, format: 'csv' }).toString();
    return `${base}/reports/${report}?${qs}`;
  },
};

export default reportService;
