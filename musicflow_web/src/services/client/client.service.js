import api, { cachedGet, API_BASE_URL } from '../api';

// Client Auth API
export const clientAuthApi = {
  profile: () => api.get('/auth/profile'),
};

// Client Songs API
export const clientSongsApi = {
  getSongById: (songId) => api.get(`/songs/${songId}`),
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
  getSimilar: (songId, params = {}, options = {}) => api.get(`/songs/${songId}/similar`, { params, ...options }),
  trackPlay: (songId) => api.post(`/songs/${songId}/play`),
  updatePlayFeedback: (songId, eventId, payload) => api.patch(`/songs/${songId}/play-events/${eventId}`, payload),

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
  deleteSong: (songId) => api.delete(`/songs/${songId}`),
  getPlaybackTicket: (songId, quality) => api.get(`/songs/${songId}/ticket`, { params: { quality } }),
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
  getRandomCovers: () => api.get('/playlists/random-covers'),
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

export const clientAssistantApi = {
  getQuota: () => api.get('/ai/assistant/quota'),
  getConversations: (params) => api.get('/ai/assistant/conversations', { params }),

  getConversation: (id) => api.get(`/ai/assistant/conversations/${id}`),
  sendMessage: (payload) => api.post('/ai/assistant/messages', payload),
  deleteConversation: (id) => api.delete(`/ai/assistant/conversations/${id}`),
  confirmAction: (actionId) => api.post(`/ai/assistant/actions/${actionId}/confirm`),
};

// Client User API
export const clientUserApi = {
  getMe: () => api.get('/users/me'),
  updateMe: (payload) => api.put('/users/update', payload, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
};

// Client Plans API
export const clientPlansApi = {
  getActive: () => api.get('/plans'),
};

// Client Subscription API
export const clientSubscriptionApi = {
  checkout: (payload) => api.post('/subscriptions/checkout', payload),
  mockConfirm: (payload) => api.post('/subscriptions/mock-confirm', payload),
  vnpayReturn: (params) => api.get('/subscriptions/vnpay-return', { params }),
  getStatus: (ref) => api.get(`/subscriptions/transactions/${ref}/status`),
  getCurrent: () => api.get('/subscriptions/current'),
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

// Client Notifications API
export const clientNotificationsApi = {
  getAll: () => api.get('/notifications'),
  markAsRead: (id) => api.put(`/notifications/${id}/read`),
  markAllAsRead: () => api.put('/notifications/read-all'),
};

// Song stream url resolver
export const resolveSongStreamUrl = (songId) => `${API_BASE_URL}/songs/${songId}/stream`;
