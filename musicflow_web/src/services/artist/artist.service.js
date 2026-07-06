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
};
