import api, { cachedGet, API_BASE_URL } from '../api';

// Client Auth API
export const clientAuthApi = {
  profile: () => api.get('/auth/profile'),
};

// Client Songs API
export const clientSongsApi = {
  getAllPublic: (params = { page: 1, limit: 50 }) => cachedGet('/songs', { params }, 30000),
  getRecommended: (params = {}) => {
    if (String(params.refresh || '').toLowerCase() === 'true') {
      return api.get('/songs/recommended', { params });
    }
    return cachedGet('/songs/recommended', { params }, 15000);
  },
  getRankings: (period) =>
    cachedGet('/songs/rankings', { params: { period } }, 30000),
  search: (params) => api.get('/songs/search', { params }),
  getLyrics: (songId) => api.get(`/songs/${songId}/lyrics`),
  trackPlay: (songId) => api.post(`/songs/${songId}/play`),
  getMyUploads: () => api.get('/songs/my-uploads'),
  getMyDownloadHistory: (params) => api.get('/songs/download-history', { params }),
  removeFromDownloadHistory: (songId) => api.delete(`/songs/download-history/${songId}`),
  requestDownload: (songId) => api.post(`/songs/${songId}/download`),
  uploadSong: (formData) => api.post('/songs', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  updateSong: (songId, formData) => api.put(`/songs/${songId}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
};

// Client Favorites API
export const clientFavoritesApi = {
  getAll: () => api.get('/favorites'),
  toggle: (songId) => api.post(`/favorites/toggle/${songId}`),
  check: (songId) => api.get(`/favorites/check/${songId}`),
  remove: (songId) => api.delete(`/favorites/remove/${songId}`),
};

// Client Playlists API
export const clientPlaylistsApi = {
  getMine: () => api.get('/playlists'),
  getSystem: (params) => cachedGet('/playlists/system', { params }, 30000),
  getSystemById: (id) => api.get(`/playlists/system/${id}`),
  getById: (id) => api.get(`/playlists/${id}`),
  create: (payload) => api.post('/playlists', payload),
  update: (id, payload) => api.put(`/playlists/${id}`, payload),
  delete: (id) => api.delete(`/playlists/${id}`),
  addSong: (id, songId) => api.post(`/playlists/${id}/songs`, { songId }),
  removeSong: (id, songId) => api.delete(`/playlists/${id}/songs/${songId}`),
};

// Client Topics API
export const clientTopicsApi = {
  getAll: () => cachedGet('/topics', {}, 30000),
  getSongsByTopic: (topicId, params = { page: 1, limit: 50 }) =>
    api.get(`/topics/${topicId}/songs`, { params }),
};

// Client Artist API
export const clientArtistApi = {
  getProfile: (id) => cachedGet('/artist/profile', { params: { id } }, 20000),
  getFollowStatus: (id) => cachedGet(`/artist/${id}/follow-status`, {}, 20000),
  toggleFollow: (id) => api.post(`/artist/${id}/follow`),
  getBatchFollowStatus: (artistIds) => api.post('/artist/follow-statuses', { artistIds }),
};

// Client AI API
export const clientAiApi = {
  getHistory: () => api.get('/ai/mood/history'),
  getConversation: (id) => api.get(`/ai/mood/conversations/${id}`),
  sendPrompt: (payload) => api.post('/ai/playlist', payload),
  deleteConversation: (id) => api.delete(`/ai/mood/conversations/${id}`),
};

// Client User API
export const clientUserApi = {
  getMe: () => api.get('/users/me'),
  updateMe: (payload) => api.put('/users/update', payload, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
};

// Client Comments API
export const clientCommentsApi = {
  getSongComments: (songId, params) => api.get(`/comments/song/${songId}`, { params }),
  create: (payload) => api.post('/comments', payload),
  update: (id, payload) => api.put(`/comments/${id}`, payload),
  delete: (id) => api.delete(`/comments/${id}`),
  react: (id) => api.put(`/comments/${id}/reactions`, { type: 'like' }),
  unreact: (id) => api.delete(`/comments/${id}/reactions`),
};

// Song stream url resolver
export const resolveSongStreamUrl = (songId) => `${API_BASE_URL}/songs/${songId}/stream`;
