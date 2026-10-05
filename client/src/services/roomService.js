import api from './api';

const roomService = {
  listByHouse: (houseId) => api.get('/rooms', { params: { houseId } }).then((res) => res.data),
  create: (data) => api.post('/rooms', data).then((res) => res.data),
  update: (roomId, data) => api.put(`/rooms/${roomId}`, data).then((res) => res.data),
};

export default roomService;
