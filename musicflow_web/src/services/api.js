import axios from 'axios';
import { clearArtistSession } from '../utils/artistSession';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

let refreshPromise = null;
let accessToken = localStorage.getItem('accessToken') || null;

const apiCache = new Map();

export const clearApiCache = () => {
  apiCache.clear();
};

const cachedGet = (url, config = {}, ttlMs = 30000) => {
  const cacheKey = JSON.stringify({ url, params: config.params || {} });
  const cached = apiCache.get(cacheKey);
  const now = Date.now();

  if (cached && now - cached.timestamp < ttlMs) {
    return cached.promise;
  }

  const promise = api.get(url, config).catch((error) => {
    apiCache.delete(cacheKey);
    return Promise.reject(error);
  });

  apiCache.set(cacheKey, { timestamp: now, promise });
  return promise;
};

export const setAccessToken = (token) => {
  accessToken = token || null;
  if (token) {
    localStorage.setItem('accessToken', token);
  } else {
    localStorage.removeItem('accessToken');
  }
  apiCache.clear();
};

export const logout = async () => {
  try {
    await api.post('/auth/logout');
  } catch (err) {
    console.warn('Logout API error:', err);
  } finally {
    accessToken = null;
    localStorage.removeItem('accessToken');
    apiCache.clear();
    localStorage.removeItem('role');
    localStorage.removeItem('userName');
    localStorage.removeItem('email');
    localStorage.removeItem('userId');
    localStorage.removeItem('userAvatar');
    clearArtistSession();
    window.dispatchEvent(new Event('musicflow-client-session-changed'));
    window.dispatchEvent(new Event('artist-profile-updated'));
  }
};

export const refreshAccessToken = async (forceRefresh = false) => {
  if (accessToken && !forceRefresh) {
    return accessToken;
  }
  if (!refreshPromise) {
    refreshPromise = axios
      .post(
        `${API_BASE_URL}/auth/refresh`,
        {},
        {
          withCredentials: true,
          headers: { 'Content-Type': 'application/json' },
        }
      )
      .then((res) => {
        const token = res?.data?.token;
        const role = res?.data?.user?.role;
        accessToken = token || null;
        if (role) {
          localStorage.setItem('role', role);
        }
        return token;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
};

// Request interceptor for adding auth token
api.interceptors.request.use(
  (config) => {
    if (config.data instanceof FormData) {
      // Let browser/axios set multipart boundary automatically.
      if (config.headers) {
        delete config.headers['Content-Type'];
        delete config.headers['content-type'];
      }
    }
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for handling errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;
    const requestUrl = originalRequest?.url || '';
    const requestToken = originalRequest?.headers?.Authorization?.split(' ')[1];

    const handleSessionExpiry = () => {
      const currentRole = localStorage.getItem('role');
      accessToken = null;
      localStorage.removeItem('accessToken');
      apiCache.clear();
      localStorage.removeItem('role');
      if (currentRole === 'artist') {
        clearArtistSession();
        window.location.href = '/artistlogin';
      } else if (currentRole === 'admin') {
        window.location.href = '/adminlogin';
      } else {
        window.location.href = '/client/home?auth=login';
      }
    };

    if (
      status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !requestUrl.includes('/auth/refresh')
    ) {
      originalRequest._retry = true;

      // If the access token has already been updated in memory by another parallel request,
      // just retry the original request immediately with the new token.
      if (accessToken && accessToken !== requestToken) {
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      }

      try {
        const newToken = await refreshAccessToken(true);
        if (newToken) {
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        }
      } catch {
        // The final 401 handler below decides whether a logged-in session should be redirected.
      }
    }

    const isAuthRoute =
      requestUrl.endsWith('/login') ||
      requestUrl.endsWith('/register') ||
      requestUrl.endsWith('/google') ||
      requestUrl.includes('/auth/login') ||
      requestUrl.includes('/auth/register') ||
      requestUrl.includes('/auth/google') ||
      requestUrl.includes('/artist/login') ||
      requestUrl.includes('/artist/google');

    const isMeRoute =
      requestUrl.includes('/artist/me') ||
      requestUrl.includes('/users/me') ||
      requestUrl.includes('/auth/profile');

    if (status === 401 && !isAuthRoute) {
      handleSessionExpiry();
    } else if (status === 404 && isMeRoute) {
      handleSessionExpiry();
    }

    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: (credentials) => api.post('/admin/auth/login', credentials),
};

export const clientAuthApi = {
  profile: () => api.get('/auth/profile'),
};

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

export const clientFavoritesApi = {
  getAll: () => api.get('/favorites'),
  toggle: (songId) => api.post(`/favorites/toggle/${songId}`),
  check: (songId) => api.get(`/favorites/check/${songId}`),
  remove: (songId) => api.delete(`/favorites/remove/${songId}`),
};

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

export const clientTopicsApi = {
  getAll: () => cachedGet('/topics', {}, 30000),
  getSongsByTopic: (topicId, params = { page: 1, limit: 50 }) =>
    api.get(`/topics/${topicId}/songs`, { params }),
};

export const clientArtistApi = {
  getProfile: (id) => cachedGet('/artist/profile', { params: { id } }, 20000),
  getFollowStatus: (id) => cachedGet(`/artist/${id}/follow-status`, {}, 20000),
  toggleFollow: (id) => api.post(`/artist/${id}/follow`),
  getBatchFollowStatus: (artistIds) => api.post('/artist/follow-statuses', { artistIds }),
};

export const clientAiApi = {
  getHistory: () => api.get('/ai/mood/history'),
  getConversation: (id) => api.get(`/ai/mood/conversations/${id}`),
  sendPrompt: (payload) => api.post('/ai/playlist', payload),
  deleteConversation: (id) => api.delete(`/ai/mood/conversations/${id}`),
};

export const clientUserApi = {
  getMe: () => api.get('/users/me'),
  updateMe: (payload) => api.put('/users/update', payload, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
};

export const clientCommentsApi = {
  getSongComments: (songId, params) => api.get(`/comments/song/${songId}`, { params }),
  create: (payload) => api.post('/comments', payload),
  update: (id, payload) => api.put(`/comments/${id}`, payload),
  delete: (id) => api.delete(`/comments/${id}`),
  react: (id) => api.put(`/comments/${id}/reactions`, { type: 'like' }),
  unreact: (id) => api.delete(`/comments/${id}/reactions`),
};

export const resolveSongStreamUrl = (songId) => `${API_BASE_URL}/songs/${songId}/stream`;

export default api;

