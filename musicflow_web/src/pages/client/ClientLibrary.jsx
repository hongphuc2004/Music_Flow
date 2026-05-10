import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import ClientLayout from '../../components/Layout/client/ClientLayout';
import { clientPlaylistsApi, clientSongsApi } from '../../services/api';
import { useClientPlayer } from '../../components/Layout/client/ClientPlayerProvider';
import SongMoreMenu from '../../components/Layout/client/SongMoreMenu';

function ClientLibrary() {
  const navigate = useNavigate();
  const { playSong } = useClientPlayer();
  const [playlists, setPlaylists] = useState([]);
  const [uploads, setUploads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const interactiveCardSx = {
    p: 1.25,
    borderRadius: 2.5,
    border: '1px solid #e2e8f0',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease, background-color 0.2s ease',
    '&:hover': {
      transform: 'translateY(-2px)',
      borderColor: '#14b8a6',
      backgroundColor: '#f0fdfa',
      boxShadow: '0 14px 28px -24px rgba(13, 95, 89, 0.7)',
    },
  };

  useEffect(() => {
    const fetchLibrary = async () => {
      try {
        setLoading(true);
        setError('');

        const [playlistsRes, uploadsRes] = await Promise.all([
          clientPlaylistsApi.getMine(),
          clientSongsApi.search({}),
        ]);

        setPlaylists(playlistsRes.data?.playlists || []);
        setUploads(Array.isArray(uploadsRes.data) ? uploadsRes.data.slice(0, 8) : []);
      } catch (err) {
        setError(err.response?.data?.message || 'Không thể tải thư viện.');
      } finally {
        setLoading(false);
      }
    };

    fetchLibrary();
  }, []);

  return (
    <ClientLayout title="Thư viện của bạn">
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Paper sx={{ p: 2.5, borderRadius: 3, border: '1px solid #e2e8f0' }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>
              Playlist của bạn
            </Typography>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
                <CircularProgress size={28} />
              </Box>
            ) : (
              <Stack spacing={1.25}>
                {playlists.map((playlist) => (
                  <Paper
                    key={playlist._id}
                    variant="outlined"
                    onClick={() => navigate(`/client/playlists/${playlist._id}`)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        navigate(`/client/playlists/${playlist._id}`);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    sx={{ ...interactiveCardSx, cursor: 'pointer' }}
                  >
                    <Stack direction="row" spacing={1.25} alignItems="center">
                      <Avatar
                        src={playlist.coverImage || ''}
                        variant="rounded"
                        sx={{ width: 52, height: 52, bgcolor: '#14b8a6' }}
                      >
                        {(playlist.name || 'P').charAt(0)}
                      </Avatar>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography fontWeight={700} noWrap>
                          {playlist.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {playlist.songCount || playlist.songs?.length || 0} bài hát
                        </Typography>
                      </Box>
                    </Stack>
                  </Paper>
                ))}
                {!playlists.length && <Typography color="text.secondary">Bạn chưa tạo playlist nào.</Typography>}
              </Stack>
            )}
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <Paper sx={{ p: 2.5, borderRadius: 3, border: '1px solid #e2e8f0', minHeight: 260 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>
              Mới nghe gần đây
            </Typography>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
                <CircularProgress size={24} />
              </Box>
            ) : (
              <Stack spacing={1.25}>
                {uploads.map((song) => (
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
                    sx={{ ...interactiveCardSx, cursor: 'pointer' }}
                  >
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Avatar src={song.imageUrl} variant="rounded" sx={{ width: 36, height: 36 }} />
                      <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                        <Typography variant="body2" noWrap>{song.title}</Typography>
                      </Box>
                      <Button
                        size="small"
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
                {!uploads.length && <Typography color="text.secondary">Bạn chưa có dữ liệu nghe gần đây.</Typography>}
              </Stack>
            )}
          </Paper>
        </Grid>
      </Grid>
    </ClientLayout>
  );
}

export default ClientLibrary;
