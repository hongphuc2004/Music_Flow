import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  CircularProgress,
  Grid,
  Paper,
  Stack,
  Typography,
  Button,
} from '@mui/material';
import { EqualizerRounded as EqualizerIcon } from '@mui/icons-material';
import ClientLayout from '../../components/Layout/client/ClientLayout';
import { clientSongsApi } from '../../services/api';
import { useClientPlayer } from '../../components/Layout/client/ClientPlayerProvider';
import SongMoreMenu from '../../components/Layout/client/SongMoreMenu';

function ClientRankings() {
  const { playSong } = useClientPlayer();
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await clientSongsApi.getAllPublic();
        setSongs(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        setError(err.response?.data?.message || 'Khong the tai bang xep hang.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const rankedSongs = useMemo(() => {
    return [...songs]
      .sort((a, b) => (b.playCount || 0) - (a.playCount || 0))
      .slice(0, 30);
  }, [songs]);

  return (
    <ClientLayout title="Bang Xep Hang">
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12 }}>
          <Paper sx={{ p: 2.5, borderRadius: 3, border: '1px solid #e2e8f0' }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
              <EqualizerIcon sx={{ color: '#0f766e' }} />
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Top bai hat theo luot nghe
              </Typography>
            </Stack>

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
                <CircularProgress size={28} />
              </Box>
            ) : (
              <Stack spacing={1.25}>
                {rankedSongs.map((song, index) => (
                  <Paper key={song._id} variant="outlined" sx={{ p: 1.25, borderRadius: 2.5 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography sx={{ width: 28, fontWeight: 700, color: '#0f766e' }}>
                        #{index + 1}
                      </Typography>
                      <Avatar src={song.imageUrl} variant="rounded" sx={{ width: 40, height: 40 }} />
                      <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                        <Typography variant="body2" noWrap sx={{ fontWeight: 700 }}>{song.title}</Typography>
                        <Typography variant="caption" color="text.secondary" noWrap>
                          {Array.isArray(song.artists)
                            ? song.artists.map((artist) => artist?.name).filter(Boolean).join(', ')
                            : 'Unknown artist'}
                        </Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary" sx={{ minWidth: 70, textAlign: 'right' }}>
                        {song.playCount || 0} plays
                      </Typography>
                      <Button size="small" onClick={() => playSong(song)}>Play</Button>
                      <SongMoreMenu song={song} />
                    </Stack>
                  </Paper>
                ))}
                {!rankedSongs.length && <Typography color="text.secondary">Chua co du lieu xep hang.</Typography>}
              </Stack>
            )}
          </Paper>
        </Grid>
      </Grid>
    </ClientLayout>
  );
}

export default ClientRankings;
