import api from '../api';

export const artistApi = {
  getMe: () => api.get('/artist/me'),
  getProfile: (params) => api.get('/artist/profile', { params }),
  updateProfile: (payload) => {
    if (payload instanceof FormData) {
      return api.put('/artist/profile', payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    }
    return api.put('/artist/profile', payload);
  },
  getSongsByArtist: (params) => api.get('/songs/by-artist', { params }),

  // 📊 Analytics Module
  getAnalyticsSummary: (params) => api.get('/artist/analytics/summary', { params }),
  getAnalyticsTimeseries: (params) => api.get('/artist/analytics/timeseries', { params }),
  getTopSongs: (params) => api.get('/artist/analytics/top-songs', { params }),
  getDiscoverySources: (params) => api.get('/artist/analytics/discovery-sources', { params }),

  // 📝 Lyrics & LRC Management Module
  getSongLyrics: (songId) => api.get(`/artist/songs/${songId}/lyrics`),
  saveDraftLyrics: (songId, payload) => api.put(`/artist/songs/${songId}/lyrics/draft`, payload),
  publishLyrics: (songId, payload) => api.post(`/artist/songs/${songId}/lyrics/publish`, payload),
  unpublishLyrics: (songId) => api.post(`/artist/songs/${songId}/lyrics/unpublish`),
};
