import api from '../api';

// Auth API
export const authApi = {
  login: (credentials) => api.post('/admin/auth/login', credentials),
};

// Dashboard Stats API
export const statsApi = {
  getDashboard: () => api.get('/admin/stats/dashboard'),
  cleanCache: () => api.post('/admin/system/clean-cache'),
  backupDb: () => api.post('/admin/system/backup'),
  regenAi: () => api.post('/admin/system/regen-ai'),
  getCloudinaryUsage: () => api.get('/admin/system/cloudinary-usage'),
};

// Accounts API (users + artists)
export const accountsApi = {
  getAll: () => api.get('/admin/accounts'),
  create: (payload) => api.post('/admin/accounts', payload),
  update: (id, payload) => api.put(`/admin/accounts/${id}`, payload),
  delete: (id) => api.delete(`/admin/accounts/${id}`),
};

// Songs API
export const songsApi = {
  getAll: (params) => api.get('/admin/songs', { params }),
  create: (formData) => api.post('/admin/songs', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  update: (id, formData) => api.put(`/admin/songs/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  delete: (id) => api.delete(`/admin/songs/${id}`),
  updateVisibility: (id, isPublic) => api.patch(`/admin/songs/${id}/visibility`, { isPublic }),
};

// Playlists API
export const playlistsApi = {
  getAll: (params) => api.get('/admin/playlists', { params }),
  getById: (id) => api.get(`/admin/playlists/${id}`),
  create: (payload) => {
    if (payload instanceof FormData) {
      return api.post('/admin/playlists', payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    }
    return api.post('/admin/playlists', payload);
  },
  update: (id, payload) => {
    if (payload instanceof FormData) {
      return api.put(`/admin/playlists/${id}`, payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    }
    return api.put(`/admin/playlists/${id}`, payload);
  },
  delete: (id) => api.delete(`/admin/playlists/${id}`),
};

// Topics API
export const topicsApi = {
  getAll: (params) => api.get('/admin/topics', { params }),
  create: (formData) => api.post('/admin/topics', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  update: (id, formData) => api.put(`/admin/topics/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  delete: (id) => api.delete(`/admin/topics/${id}`),
  getSongsByTopic: (id) => api.get(`/admin/topics/${id}/songs`),
};
