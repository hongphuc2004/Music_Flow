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
import MusicIcon from '@mui/icons-material/MusicNoteRounded';
import ClientLayout from '../../components/Layout/client/ClientLayout';
import { clientFavoritesApi } from '../../services/client/client.service';
import { useClientPlayerActions } from '../../components/Layout/client/ClientPlayerProvider';
import ClientSongMoreMenu from '../../components/Layout/client/ClientSongMoreMenu';
import HeartFavoriteButton from '../../components/common/ui/HeartFavoriteButton';
import PremiumBadge from '../../components/common/ui/PremiumBadge';

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
      setError(err.response?.data?.message || 'Không thể tải danh sách yêu thích.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFavorites();
  }, []);

  useEffect(() => {
    const handleFavoriteChanged = (e) => {
      const { songId, isFavorite } = e.detail || {};
      if (!songId) return;
      if (!isFavorite) {
        setFavorites((prev) => prev.filter((song) => song._id !== songId));
      } else {
        fetchFavorites();
      }
    };

    window.addEventListener('musicflow-favorite-changed', handleFavoriteChanged);
    return () => {
      window.removeEventListener('musicflow-favorite-changed', handleFavoriteChanged);
    };
  }, []);

  const handleRemove = async (songId) => {
    try {
      await clientFavoritesApi.remove(songId);
      setFavorites((prev) => prev.filter((song) => song._id !== songId));
      window.dispatchEvent(
        new CustomEvent('musicflow-favorite-changed', {
          detail: { songId, isFavorite: false },
        })
      );
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể xóa bài hát khỏi yêu thích.');
    }
  };

  return (
    <ClientLayout title="Bài hát yêu thích">
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
            <Typography fontWeight={700}>Danh sách bài hát yêu thích của bạn</Typography>
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
                      <Avatar src={song.imageUrl || undefined} variant="rounded" sx={{ width: 48, height: 48 }}>
                        <MusicIcon sx={{ fontSize: 24 }} />
                      </Avatar>
                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Stack direction="row" alignItems="center" spacing={0.8} sx={{ minWidth: 0 }}>
                          <Typography fontWeight={700} noWrap sx={{ minWidth: 0, flexShrink: 1 }}>{song.title}</Typography>
                          {Boolean(song.isPremium) && <PremiumBadge sx={{ flexShrink: 0 }} />}
                        </Stack>
                        <Typography variant="caption" color="text.secondary" noWrap>
                          {Array.isArray(song.artists)
                            ? song.artists.map((artist) => artist?.name).filter(Boolean).join(', ')
                            : 'Unknown artist'}
                        </Typography>
                      </Box>
                      <Button size="small" onClick={(event) => { event.stopPropagation(); playSong(song, { queue: favorites }); }}>
                        Play
                      </Button>
                      <ClientSongMoreMenu
                        song={song}
                        onFavoriteChange={(targetSongId, isFav) => {
                          if (!isFav) {
                            setFavorites((prev) => prev.filter((s) => s._id !== targetSongId));
                          }
                        }}
                      />
                      <HeartFavoriteButton
                        checked={true}
                        onChange={(event) => {
                          event.stopPropagation();
                          handleRemove(song._id);
                        }}
                        size={34}
                        color="#ff4e7c"
                        title="Bỏ bài hát khỏi yêu thích"
                      />
                    </Stack>
                  </Paper>
                ))}
                {!favorites.length && <Typography color="text.secondary">Bạn chưa có bài hát yêu thích nào.</Typography>}
              </Stack>
            )}
          </Paper>
        </Grid>
      </Grid>
    </ClientLayout>
  );
}

export default ClientFavorites;
