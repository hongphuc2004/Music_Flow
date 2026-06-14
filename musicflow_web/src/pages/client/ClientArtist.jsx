import { useEffect, useMemo, useState } from 'react';
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
import {
  ArrowBackRounded as ArrowBackIcon,
  PlayArrowRounded as PlayIcon,
  MusicNoteRounded as MusicIcon,
} from '@mui/icons-material';
import ClientLayout from '../../components/Layout/client/ClientLayout';
import { clientSongsApi } from '../../services/api';
import { useClientPlayerActions } from '../../components/Layout/client/ClientPlayerProvider';
import SongMoreMenu from '../../components/Layout/client/SongMoreMenu';

function ClientArtist() {
  const navigate = useNavigate();
  const { artistId } = useParams();
  const { playSong } = useClientPlayerActions();

  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchArtistSongs = async () => {
      try {
        setLoading(true);
        setError('');

        const response = await clientSongsApi.getAllPublic();
        const allSongs = Array.isArray(response.data) ? response.data : [];
        const filteredSongs = allSongs.filter((song) =>
          Array.isArray(song.artists) && song.artists.some((artist) => artist?._id === artistId)
        );

        setSongs(filteredSongs);
      } catch (err) {
        setError(err.response?.data?.message || 'Không thể tải dữ liệu nghệ sĩ.');
      } finally {
        setLoading(false);
      }
    };

    fetchArtistSongs();
  }, [artistId]);

  const artistInfo = useMemo(() => {
    const firstSong = songs[0];
    if (!firstSong?.artists) {
      return {
        name: 'Unknown artist',
        avatar: '',
      };
    }

    const matchedArtist = firstSong.artists.find((artist) => artist?._id === artistId);

    return {
      name: matchedArtist?.name || 'Unknown artist',
      avatar: matchedArtist?.avatar || '',
    };
  }, [songs, artistId]);

  return (
    <ClientLayout title="Chi tiết Nghệ sĩ">
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12 }}>
          <Button 
            startIcon={<ArrowBackIcon />} 
            onClick={() => navigate(-1)}
            sx={{ color: (theme) => theme.palette.mode === 'dark' ? '#22d3ee' : '#0f766e' }}
          >
            Quay lại
          </Button>
        </Grid>

        <Grid size={{ xs: 12 }}>
          <Paper 
            sx={{ 
              p: 3, 
              borderRadius: 4, 
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.paper'
            }}
          >
            <Stack direction="row" spacing={2} alignItems="center">
              <Avatar src={artistInfo.avatar} sx={{ width: 72, height: 72, bgcolor: '#14b8a6', fontSize: 28, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                {artistInfo.name.charAt(0)}
              </Avatar>
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: -0.5 }}>{artistInfo.name}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {songs.length} bài hát
                </Typography>
              </Box>
            </Stack>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12 }}>
          <Paper 
            sx={{ 
              p: 3, 
              borderRadius: 4, 
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.paper',
              minHeight: 280 
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>
              Danh sách bài hát
            </Typography>

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress size={28} sx={{ color: '#14b8a6' }} />
              </Box>
            ) : (
              <Stack spacing={1.5}>
                {songs.map((song) => (
                  <Paper
                    key={song._id}
                    variant="outlined"
                    onClick={() => playSong(song, { queue: songs })}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        playSong(song, { queue: songs });
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    sx={{
                      p: 1.75,
                      borderRadius: 3,
                      border: '1px solid',
                      borderColor: 'divider',
                      bgcolor: 'background.paper',
                      cursor: 'pointer',
                      transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                      '&:hover': {
                        transform: 'translateY(-2.5px)',
                        borderColor: '#14b8a6',
                        bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(20, 184, 166, 0.08)' : '#f0fdfa',
                        boxShadow: '0 8px 20px rgba(0,0,0,0.05)',
                      },
                    }}
                  >
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Avatar
                        src={song.imageUrl || undefined}
                        variant="rounded"
                        sx={{
                          width: 46,
                          height: 46,
                          boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                          bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(20, 184, 166, 0.08)' : 'rgba(20, 184, 166, 0.04)',
                          color: '#14b8a6',
                        }}
                      >
                        <MusicIcon sx={{ fontSize: 24 }} />
                      </Avatar>
                      <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                        <Typography fontWeight={700} noWrap>{song.title}</Typography>
                        <Typography variant="caption" color="text.secondary" noWrap>
                          {artistInfo.name}
                        </Typography>
                      </Box>
                      <Button
                        size="small"
                        startIcon={<PlayIcon />}
                        onClick={(event) => {
                          event.stopPropagation();
                          playSong(song, { queue: songs });
                        }}
                        sx={{
                          color: (theme) => theme.palette.mode === 'dark' ? '#22d3ee' : '#0f766e',
                          '&:hover': { backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(34, 211, 238, 0.12)' : 'rgba(20, 184, 166, 0.14)' }
                        }}
                      >
                        Play
                      </Button>
                      <SongMoreMenu 
                        song={song} 
                        buttonSx={{
                          color: (theme) => theme.palette.mode === 'dark' ? '#22d3ee' : '#0f766e',
                          '&:hover': { backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(34, 211, 238, 0.12)' : 'rgba(20, 184, 166, 0.14)' }
                        }} 
                      />
                    </Stack>
                  </Paper>
                ))}

                {!songs.length && <Typography color="text.secondary">Nghệ sĩ này chưa có bài hát.</Typography>}
              </Stack>
            )}
          </Paper>
        </Grid>
      </Grid>
    </ClientLayout>
  );
}

export default ClientArtist;
