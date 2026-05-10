import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Grid,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { ArrowBackRounded as ArrowBackIcon, PlayArrowRounded as PlayIcon } from '@mui/icons-material';
import ClientLayout from '../../components/Layout/client/ClientLayout';
import { clientPlaylistsApi } from '../../services/api';
import { useClientPlayer } from '../../components/Layout/client/ClientPlayerProvider';
import SongMoreMenu from '../../components/Layout/client/SongMoreMenu';

function ClientPlaylist() {
  const navigate = useNavigate();
  const { playlistId } = useParams();
  const { playSong } = useClientPlayer();

  const [playlist, setPlaylist] = useState(null);
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchPlaylist = async () => {
      try {
        setLoading(true);
        setError('');

        const response = await clientPlaylistsApi.getById(playlistId);
        const playlistData = response.data?.playlist || null;
        setPlaylist(playlistData);
        setSongs(Array.isArray(playlistData?.songs) ? playlistData.songs : []);
      } catch (err) {
        setError(err.response?.data?.message || 'Không thể tải dữ liệu playlist.');
      } finally {
        setLoading(false);
      }
    };

    if (playlistId) fetchPlaylist();
  }, [playlistId]);

  return (
    <ClientLayout title="Playlist của bạn">
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12 }}>
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>
            Quay lai
          </Button>
        </Grid>

        <Grid size={{ xs: 12 }}>
          <Paper sx={{ p: 2.5, borderRadius: 3, border: '1px solid #e2e8f0' }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Avatar
                src={playlist?.coverImage || ''}
                variant="rounded"
                sx={{ width: 64, height: 64, bgcolor: '#14b8a6', fontSize: 28 }}
              >
                {(playlist?.name || 'Playlist').charAt(0)}
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="h5" sx={{ fontWeight: 800 }} noWrap>
                  {playlist?.name || 'Untitled playlist'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {songs.length} bài hát
                </Typography>
              </Box>
            </Stack>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12 }}>
          <Paper sx={{ p: 2.5, borderRadius: 3, border: '1px solid #e2e8f0', minHeight: 280 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>
              Danh sach bai hat
            </Typography>

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress size={28} />
              </Box>
            ) : (
              <Stack spacing={1.25}>
                {songs.map((song) => (
                  <Paper
                    key={song._id}
                    variant="outlined"
                    onClick={() => playSong(song)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        playSong(song);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    sx={{
                      p: 1.25,
                      borderRadius: 2.5,
                      border: '1px solid #e2e8f0',
                      cursor: 'pointer',
                      transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease, background-color 0.2s ease',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        borderColor: '#14b8a6',
                        backgroundColor: '#f0fdfa',
                        boxShadow: '0 14px 28px -24px rgba(13, 95, 89, 0.7)',
                      },
                    }}
                  >
                    <Stack direction="row" spacing={1.25} alignItems="center">
                      <Avatar src={song.imageUrl} variant="rounded" sx={{ width: 46, height: 46 }}>
                        {song.title?.charAt(0)}
                      </Avatar>
                      <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                        <Typography fontWeight={700} noWrap>{song.title}</Typography>
                        <Typography variant="caption" color="text.secondary" noWrap>
                          {(song.artists || []).map((artist) => artist?.name).filter(Boolean).join(', ') || 'Unknown artist'}
                        </Typography>
                      </Box>
                      <Button
                        size="small"
                        startIcon={<PlayIcon />}
                        onClick={(event) => {
                          event.stopPropagation();
                          playSong(song);
                        }}
                        sx={{ color: '#0f766e', '&:hover': { backgroundColor: 'rgba(20, 184, 166, 0.14)' } }}
                      >
                        Play
                      </Button>
                      <SongMoreMenu song={song} buttonSx={{ color: '#0f766e', '&:hover': { backgroundColor: 'rgba(20, 184, 166, 0.14)' } }} />
                    </Stack>
                  </Paper>
                ))}

                {!songs.length && <Typography color="text.secondary">Playlist này chưa có bài hát.</Typography>}
              </Stack>
            )}
          </Paper>
        </Grid>
      </Grid>
    </ClientLayout>
  );
}

export default ClientPlaylist;

