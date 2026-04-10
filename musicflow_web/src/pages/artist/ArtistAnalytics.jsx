import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Card,
  CardContent,
  CircularProgress,
  Grid,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import {
  FavoriteRounded as FavoriteIcon,
  HeadphonesRounded as HeadphonesIcon,
  QueryStatsRounded as StatsIcon,
  TimerRounded as TimerIcon,
} from '@mui/icons-material';
import ArtistLayout from '../../components/Layout/artist/ArtistLayout';
import { artistApi } from '../../services/api';
import { calculateArtistAnalytics, formatDurationLabel } from '../../utils/artistProfile';

function ArtistAnalytics() {
  const [artist, setArtist] = useState(null);
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      const meResponse = await artistApi.getMe();
      const currentArtist = meResponse.data.artist;
      const songsResponse = await artistApi.getSongsByArtist({ artistId: currentArtist._id, page: 1, limit: 100 });
      const profileResponse = await artistApi.getProfile({ id: currentArtist._id });

      setArtist({
        ...currentArtist,
        followers: profileResponse.data.artist?.followers || 0,
        monthlyListeners: profileResponse.data.artist?.monthlyListeners || 0,
        totalSongs: profileResponse.data.artist?.totalSongs || 0,
      });
      setSongs(songsResponse.data.songs || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load analytics.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const analytics = useMemo(() => calculateArtistAnalytics(artist, songs), [artist, songs]);
  const maxTopSongLikes = Math.max(...analytics.topSongs.map((song) => Number(song.likeCount) || 0), 1);
  const maxMonthReleases = Math.max(...analytics.releasesByMonth.map((item) => item.value), 1);

  const highlights = [
    { label: 'Average likes / song', value: analytics.averageLikes, icon: <FavoriteIcon />, accent: '#ef4444' },
    { label: 'Average plays / song', value: analytics.averagePlays, icon: <HeadphonesIcon />, accent: '#10b981' },
    { label: 'Catalog runtime', value: formatDurationLabel(analytics.totalDuration), icon: <TimerIcon />, accent: '#8b5cf6' },
    { label: 'Catalog size', value: analytics.totalSongs, icon: <StatsIcon />, accent: '#0ea5e9' },
  ];

  return (
    <ArtistLayout title="Artist Analytics">
      {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>{error}</Alert>}

      {loading ? (
        <Box sx={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CircularProgress />
        </Box>
      ) : (
        <Box sx={{ display: 'grid', gap: 3 }}>
          <Grid container spacing={3}>
            {highlights.map((item) => (
              <Grid key={item.label} size={{ xs: 12, sm: 6, xl: 3 }}>
                <Card elevation={0} sx={{ borderRadius: 5, border: '1px solid rgba(15,23,42,0.08)' }}>
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ width: 48, height: 48, display: 'grid', placeItems: 'center', borderRadius: 3, mb: 2, color: item.accent, backgroundColor: `${item.accent}18` }}>
                      {item.icon}
                    </Box>
                    <Typography variant="body2" color="text.secondary">{item.label}</Typography>
                    <Typography variant="h4" fontWeight={800} sx={{ mt: 1 }}>{item.value}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          <Grid container spacing={3}>
            <Grid size={{ xs: 12, lg: 7 }}>
              <Card elevation={0} sx={{ borderRadius: 5, border: '1px solid rgba(15,23,42,0.08)', height: '100%' }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="h6" fontWeight={800}>Top songs by likes</Typography>
                  <Typography color="text.secondary" sx={{ mb: 3 }}>
                    Quick snapshot of which releases are earning the strongest fan response.
                  </Typography>
                  {analytics.topSongs.length === 0 ? (
                    <Typography color="text.secondary">No song data available yet.</Typography>
                  ) : (
                    <Stack spacing={2}>
                      {analytics.topSongs.map((song) => {
                        const likes = Number(song.likeCount) || 0;
                        return (
                          <Box key={song._id}>
                            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.75 }}>
                              <Typography fontWeight={700}>{song.title}</Typography>
                              <Typography variant="body2" color="text.secondary">{likes} likes</Typography>
                            </Stack>
                            <LinearProgress
                              variant="determinate"
                              value={(likes / maxTopSongLikes) * 100}
                              sx={{ height: 10, borderRadius: 999, backgroundColor: '#e2e8f0' }}
                            />
                          </Box>
                        );
                      })}
                    </Stack>
                  )}
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, lg: 5 }}>
              <Card elevation={0} sx={{ borderRadius: 5, border: '1px solid rgba(15,23,42,0.08)', height: '100%' }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="h6" fontWeight={800}>Release momentum</Typography>
                  <Typography color="text.secondary" sx={{ mb: 3 }}>
                    Songs published per month based on your recent release history.
                  </Typography>
                  {analytics.releasesByMonth.length === 0 ? (
                    <Typography color="text.secondary">No release timeline yet.</Typography>
                  ) : (
                    <Stack spacing={1.75}>
                      {analytics.releasesByMonth.map((item) => (
                        <Box key={item.label}>
                          <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.75 }}>
                            <Typography fontWeight={600}>{item.label}</Typography>
                            <Typography variant="body2" color="text.secondary">{item.value} songs</Typography>
                          </Stack>
                          <LinearProgress
                            variant="determinate"
                            value={(item.value / maxMonthReleases) * 100}
                            sx={{ height: 10, borderRadius: 999, backgroundColor: '#e2e8f0' }}
                            color="secondary"
                          />
                        </Box>
                      ))}
                    </Stack>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      )}
    </ArtistLayout>
  );
}

export default ArtistAnalytics;
