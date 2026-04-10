export function createArtistProfileForm(artist) {
  return {
    name: artist?.name || '',
    email: artist?.email || '',
    bio: artist?.bio || '',
    avatarUrl: artist?.avatar || '',
  };
}

export function buildArtistProfilePayload(form, avatarFile) {
  const payload = new FormData();
  payload.append('name', form.name.trim());
  payload.append('email', form.email.trim());
  payload.append('bio', form.bio.trim());
  payload.append('avatarUrl', form.avatarUrl.trim());
  if (avatarFile) {
    payload.append('avatarFile', avatarFile);
  }
  return payload;
}

export function calculateArtistAnalytics(artist, songs = []) {
  const totalLikes = songs.reduce((sum, song) => sum + (Number(song.likeCount) || 0), 0);
  const totalPlays = songs.reduce((sum, song) => sum + (Number(song.playCount) || 0), 0);
  const totalDuration = songs.reduce((sum, song) => sum + (Number(song.duration) || 0), 0);
  const averageLikes = songs.length ? Math.round(totalLikes / songs.length) : 0;
  const averagePlays = songs.length ? Math.round(totalPlays / songs.length) : 0;

  const topSongs = [...songs]
    .sort((a, b) => (Number(b.likeCount) || 0) - (Number(a.likeCount) || 0))
    .slice(0, 5);

  const releasesByMonthMap = songs.reduce((acc, song) => {
    const date = song.createdAt ? new Date(song.createdAt) : null;
    if (!date || Number.isNaN(date.getTime())) return acc;

    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const releasesByMonth = Object.entries(releasesByMonthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([key, value]) => ({
      label: key,
      value,
    }));

  return {
    followers: artist?.followers || 0,
    monthlyListeners: artist?.monthlyListeners || 0,
    totalSongs: artist?.totalSongs || songs.length,
    totalLikes,
    totalPlays,
    totalDuration,
    averageLikes,
    averagePlays,
    topSongs,
    releasesByMonth,
  };
}

export function formatDurationLabel(seconds) {
  if (!seconds) return '0m';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
