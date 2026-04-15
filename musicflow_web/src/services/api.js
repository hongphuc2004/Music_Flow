import axios from 'axios';
import { clearArtistSession } from '../utils/artistSession';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

let refreshPromise = null;
let accessToken = null;

export const setAccessToken = (token) => {
  accessToken = token || null;
};

const refreshAccessToken = async () => {
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

    if (
      status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !requestUrl.includes('/auth/refresh')
    ) {
      originalRequest._retry = true;

      try {
        const newToken = await refreshAccessToken();
        if (newToken) {
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        }
      } catch (_) {
      }
    }

    if (status === 401) {
      const currentRole = localStorage.getItem('role');
      accessToken = null;
      localStorage.removeItem('role');
      if (currentRole === 'artist') {
        clearArtistSession();
        window.location.href = '/artistlogin';
      } else {
        window.location.href = '/accountlogin';
      }
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
  getAllPublic: () => api.get('/songs'),
  getRecommended: (params) => api.get('/songs/recommended', { params }),
  search: (params) => api.get('/songs/search', { params }),
  getLyrics: (songId) => api.get(`/songs/${songId}/lyrics`),
};

export const clientFavoritesApi = {
  getAll: () => api.get('/favorites'),
  toggle: (songId) => api.post(`/favorites/toggle/${songId}`),
  check: (songId) => api.get(`/favorites/check/${songId}`),
  remove: (songId) => api.delete(`/favorites/remove/${songId}`),
};

export const clientPlaylistsApi = {
  getMine: () => api.get('/playlists'),
  getSystem: (params) => api.get('/playlists/system', { params }),
};

export const clientTopicsApi = {
  getAll: () => api.get('/topics'),
  getSongsByTopic: (topicId) => api.get(`/topics/${topicId}/songs`),
};

export const clientUserApi = {
  getMe: () => api.get('/users/me'),
  updateMe: (payload) => api.put('/users/update', payload, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
};

export const resolveSongStreamUrl = (songId) => `${API_BASE_URL}/songs/${songId}/stream`;

export default api;
