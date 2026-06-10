import { useEffect, useState } from 'react';
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
import FavoriteIcon from '@mui/icons-material/Favorite';
import ClientLayout from '../../components/Layout/client/ClientLayout';
import { clientFavoritesApi } from '../../services/api';
import { useClientPlayerActions } from '../../components/Layout/client/ClientPlayerProvider';
import SongMoreMenu from '../../components/Layout/client/SongMoreMenu';

function ClientFavorites() {
  const { playSong } = useClientPlayerActions();
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchFavorites = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await clientFavoritesApi.getAll();
      setFavorites(response.data?.favorites || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Khong the tai danh sach yeu thich.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFavorites();
  }, []);

  const handleRemove = async (songId) => {
    try {
      await clientFavoritesApi.remove(songId);
      setFavorites((prev) => prev.filter((song) => song._id !== songId));
    } catch (err) {
      setError(err.response?.data?.message || 'Khong the xoa bai hat khoi yeu thich.');
    }
  };

  return (
    <ClientLayout title="Bai hat yeu thich">
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12 }}>
          <Paper
            sx={{
              p: 2.5,
              borderRadius: 3,
              border: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
            }}
          >
            <FavoriteIcon sx={{ color: '#ef4444' }} />
            <Typography fontWeight={700}>Danh sach bai hat yeu thich cua ban</Typography>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12 }}>
          <Paper sx={{ p: 2.5, borderRadius: 3, border: '1px solid #e2e8f0', minHeight: 280 }}>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
                <CircularProgress size={28} />
              </Box>
            ) : (
              <Stack spacing={1.25}>
                {favorites.map((song) => (
                  <Paper
                    key={song._id}
                    variant="outlined"
                    onClick={() => playSong(song, { queue: favorites })}
                    role="button"
                    tabIndex={0}
                    sx={{ p: 1.5, borderRadius: 2.5, border: '1px solid #e2e8f0', cursor: 'pointer' }}
                  >
                    <Stack direction="row" spacing={1.25} alignItems="center">
                      <Avatar src={song.imageUrl} variant="rounded" sx={{ width: 48, height: 48 }}>
                        {song.title?.charAt(0)}
                      </Avatar>
                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Typography fontWeight={700} noWrap>{song.title}</Typography>
                        <Typography variant="caption" color="text.secondary" noWrap>
                          {Array.isArray(song.artists)
                            ? song.artists.map((artist) => artist?.name).filter(Boolean).join(', ')
                            : 'Unknown artist'}
                        </Typography>
                      </Box>
                      <Button size="small" onClick={(event) => { event.stopPropagation(); playSong(song, { queue: favorites }); }}>
                        Play
                      </Button>
                      <SongMoreMenu song={song} />
                      <Button
                        size="small"
                        color="error"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleRemove(song._id);
                        }}
                      >
                        Xoa
                      </Button>
                    </Stack>
                  </Paper>
                ))}
                {!favorites.length && <Typography color="text.secondary">Ban chua co bai hat yeu thich nao.</Typography>}
              </Stack>
            )}
          </Paper>
        </Grid>
      </Grid>
    </ClientLayout>
  );
}

export default ClientFavorites;
