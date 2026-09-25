export function syncArtistSession(artist) {
  if (!artist) return;

  if (artist._id) localStorage.setItem('artistId', artist._id);
  localStorage.setItem('artistName', artist.name || 'Artist');
  localStorage.setItem('artistAvatar', artist.avatar || '');
  localStorage.setItem('artistEmail', artist.email || '');

  const isPro = Boolean(artist.isPro && artist.proExpiry && new Date(artist.proExpiry) > new Date());
  localStorage.setItem('artistIsPro', isPro ? 'true' : 'false');
  if (artist.proExpiry) {
    localStorage.setItem('artistProExpiry', artist.proExpiry);
  } else {
    localStorage.removeItem('artistProExpiry');
  }

  window.dispatchEvent(new Event('artist-profile-updated'));
}

export function clearArtistSession() {
  localStorage.removeItem('artistId');
  localStorage.removeItem('artistName');
  localStorage.removeItem('artistAvatar');
  localStorage.removeItem('artistEmail');
  localStorage.removeItem('artistIsPro');
  localStorage.removeItem('artistProExpiry');
}
