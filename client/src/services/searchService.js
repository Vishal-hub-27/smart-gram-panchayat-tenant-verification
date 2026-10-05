import api from './api';

const searchService = {
  search: (q) => api.get('/search', { params: { q } }).then((res) => res.data),
};

export default searchService;
