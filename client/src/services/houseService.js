import api from './api';

const houseService = {
  list: (params) => api.get('/houses', { params }).then((res) => res.data),
  getById: (houseId) => api.get(`/houses/${houseId}`).then((res) => res.data),
  create: (formData) =>
    api
      .post('/houses', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then((res) => res.data),
  update: (houseId, formData) =>
    api
      .put(`/houses/${houseId}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then((res) => res.data),
};

export default houseService;
