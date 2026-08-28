import axios from 'axios';
import { clearArtistSession } from '../utils/artistSession';

export const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

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

export const cachedGet = (url, config = {}, ttlMs = 30000) => {
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

const isTokenExpired = (token) => {
  if (!token) return true;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (!payload.exp) return false;
    const now = Math.floor(Date.now() / 1000);
    return payload.exp - 10 < now; // 10-second buffer
  } catch {
    return true;
  }
};

export const refreshAccessToken = async (forceRefresh = false) => {
  const isExpired = isTokenExpired(accessToken);
  if (accessToken && !isExpired && !forceRefresh) {
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
        if (token) {
          localStorage.setItem('accessToken', token);
        } else {
          localStorage.removeItem('accessToken');
        }
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
        window.location.href = '/artist/dashboard?auth=login';
      } else if (currentRole === 'admin') {
        window.location.href = '/adminlogin';
      } else {
        window.location.href = '/?auth=login';
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

// Re-export services for backwards compatibility
export { authApi, statsApi, accountsApi, songsApi, playlistsApi, topicsApi } from './admin/admin.service';
export { artistApi } from './artist/artist.service';
export {
  clientAuthApi,
  clientSongsApi,
  clientFavoritesApi,
  clientPlaylistsApi,
  clientTopicsApi,
  clientArtistApi,
  clientAiApi,
  clientAssistantApi,
  clientUserApi,
  clientCommentsApi,
  resolveSongStreamUrl
} from './client/client.service';

export default api;

