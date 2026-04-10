export function syncArtistSession(artist) {
  if (!artist) return;

  if (artist._id) localStorage.setItem('artistId', artist._id);
  localStorage.setItem('artistName', artist.name || 'Artist');
  localStorage.setItem('artistAvatar', artist.avatar || '');
  localStorage.setItem('artistEmail', artist.email || '');
  window.dispatchEvent(new Event('artist-profile-updated'));
}

export function clearArtistSession() {
  localStorage.removeItem('artistId');
  localStorage.removeItem('artistName');
  localStorage.removeItem('artistAvatar');
  localStorage.removeItem('artistEmail');
}
