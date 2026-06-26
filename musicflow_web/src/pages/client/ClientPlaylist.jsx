import { useEffect, useState, useMemo } from 'react';
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
  Chip,
  IconButton,
  Tooltip,
  Divider,
} from '@mui/material';
import {
  ArrowBackRounded as ArrowBackIcon,
  PlayArrowRounded as PlayIcon,
  MusicNoteRounded as MusicIcon,
  FeaturedPlayListRounded as PlaylistCategoryIcon,
  HeadphonesRounded as PlayCountIcon,
} from '@mui/icons-material';
import ClientLayout from '../../components/Layout/client/ClientLayout';
import { clientPlaylistsApi } from '../../services/api';
import { useClientPlayerActions } from '../../components/Layout/client/ClientPlayerProvider';
import SongMoreMenu from '../../components/Layout/client/SongMoreMenu';

function ClientPlaylist() {
  const navigate = useNavigate();
  const { playlistId } = useParams();
  const { playSong } = useClientPlayerActions();

  const [playlist, setPlaylist] = useState(null);
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchPlaylist = async () => {
      try {
        setLoading(true);
        setError('');

        const isLoggedIn = localStorage.getItem('role') === 'user';
        const response = isLoggedIn
          ? await clientPlaylistsApi.getById(playlistId)
          : await clientPlaylistsApi.getSystemById(playlistId);
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

  const totalPlays = useMemo(() => {
    return songs.reduce((sum, s) => sum + (s.playCount || 0), 0);
  }, [songs]);

  const playAll = () => {
    if (!songs.length) return;
    playSong(songs[0], { queue: songs });
  };

  return (
    <ClientLayout title="Chi tiết Playlist">
      {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 3 }}>{error}</Alert>}

      <Stack spacing={3.5}>
        {/* Navigation Actions */}
        <Box>
          <Button 
            startIcon={<ArrowBackIcon />} 
            onClick={() => navigate(-1)}
            sx={{ 
              color: 'text.primary', 
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 3.5,
              px: 2.5,
              py: 0.75,
              boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
              '&:hover': { 
                bgcolor: 'action.hover',
                transform: 'translateX(-4px)',
              },
              transition: 'all 0.2s ease'
            }}
          >
            Quay lại
          </Button>
        </Box>

        {/* Dynamic Premium Header Banner */}
        <Box 
          sx={{ 
            position: 'relative', 
            borderRadius: 6, 
            overflow: 'hidden',
            border: '1px solid',
            borderColor: 'divider',
            boxShadow: '0 10px 30px rgba(0,0,0,0.02)',
          }}
        >
          {/* Blurred Background Cover */}
          {playlist?.coverImage && (
            <Box 
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundImage: `url(${playlist.coverImage})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                filter: 'blur(30px) brightness(0.55)',
                opacity: (theme) => theme.palette.mode === 'dark' ? 0.35 : 0.18,
                zIndex: 0,
                transform: 'scale(1.15)',
              }}
            />
          )}

          {/* Banner Contents */}
          <Box 
            sx={{ 
              position: 'relative', 
              zIndex: 1, 
              p: { xs: 4, md: 5.5 }, 
              background: (theme) => theme.palette.mode === 'dark' 
                ? 'linear-gradient(to bottom, rgba(17,24,39,0.3) 0%, rgba(17,24,39,0.85) 100%)' 
                : 'linear-gradient(to bottom, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.9) 100%)'
            }}
          >
            <Stack 
              direction={{ xs: 'column', md: 'row' }} 
              spacing={{ xs: 3, md: 4 }} 
              alignItems="center" 
              justifyContent="space-between"
            >
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} alignItems="center" sx={{ textAlign: { xs: 'center', sm: 'left' }, minWidth: 0, width: '100%' }}>
                <Avatar 
                  src={playlist?.coverImage || ''} 
                  variant="rounded"
                  sx={{ 
                    width: { xs: 110, md: 140 }, 
                    height: { xs: 110, md: 140 }, 
                    bgcolor: 'primary.main', 
                    fontSize: { xs: 44, md: 56 }, 
                    fontWeight: 900,
                    borderRadius: 5,
                    boxShadow: '0 8px 30px rgba(108,99,255,0.22)',
                    border: '4px solid',
                    borderColor: 'background.paper'
                  }}
                >
                  {(playlist?.name || 'P').charAt(0)}
                </Avatar>
                
                <Box sx={{ minWidth: 0 }}>
                  <Chip 
                    icon={<PlaylistCategoryIcon style={{ fontSize: 12, color: '#fff' }} />}
                    label="PLAYLIST" 
                    size="small" 
                    sx={{ 
                      bgcolor: '#6c63ff', 
                      color: '#fff', 
                      fontWeight: 800, 
                      fontSize: 10,
                      letterSpacing: 1.5,
                      px: 0.5,
                      mb: 1.5
                    }} 
                  />
                  <Typography 
                    variant="h2" 
                    fontWeight={900} 
                    noWrap
                    sx={{ 
                      fontSize: { xs: 26, sm: 34, md: 40 }, 
                      letterSpacing: '-1px', 
                      lineHeight: 1.2,
                      mb: 1
                    }}
                  >
                    {playlist?.name || 'Untitled playlist'}
                  </Typography>

                  {playlist?.description && (
                    <Typography 
                      variant="body2" 
                      color="text.secondary" 
                      sx={{ 
                        fontWeight: 500, 
                        mb: 1.5, 
                        maxWidth: 600,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {playlist.description}
                    </Typography>
                  )}

                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: { xs: 'center', sm: 'flex-start' }, gap: 1 }}>
                    <span>{songs.length} bài hát</span>
                    <span>•</span>
                    <span>Tạo bởi {playlist?.createdBy?.name || 'MusicFlow'}</span>
                    {totalPlays > 0 && (
                      <>
                        <span>•</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <PlayCountIcon sx={{ fontSize: 15 }} />
                          {totalPlays.toLocaleString('vi-VN')} lượt phát
                        </span>
                      </>
                    )}
                  </Typography>
                </Box>
              </Stack>

              <Box sx={{ flexShrink: 0 }}>
                <Button
                  variant="contained"
                  disabled={!songs.length}
                  onClick={playAll}
                  startIcon={<PlayIcon sx={{ fontSize: 24 }} />}
                  sx={{
                    bgcolor: 'primary.main',
                    color: '#fff',
                    px: 4.5,
                    py: 1.75,
                    borderRadius: 4,
                    fontSize: 15,
                    fontWeight: 800,
                    boxShadow: '0 8px 24px rgba(108, 99, 255, 0.3)',
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:hover': {
                      bgcolor: 'primary.dark',
                      transform: 'translateY(-2px)',
                      boxShadow: '0 12px 28px rgba(108, 99, 255, 0.4)',
                    },
                    '&:active': {
                      transform: 'translateY(0)',
                    }
                  }}
                >
                  Phát Tất Cả
                </Button>
              </Box>
            </Stack>
          </Box>
        </Box>

        {/* Songs List */}
        <Paper 
          elevation={0}
          sx={{ 
            p: { xs: 3, md: 4.5 }, 
            borderRadius: 6, 
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
            minHeight: 350,
            boxShadow: '0 4px 20px rgba(0,0,0,0.01)'
          }}
        >
          <Typography variant="h5" sx={{ fontWeight: 900, mb: 3, letterSpacing: '-0.5px' }}>
            Danh sách bài hát
          </Typography>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 10 }}>
              <CircularProgress size={38} sx={{ color: 'primary.main' }} />
            </Box>
          ) : (
            <Stack spacing={1} divider={<Divider flexItem sx={{ opacity: 0.5, borderStyle: 'dashed' }} />}>
              {songs.map((song, index) => (
                <Paper
                  key={song._id}
                  elevation={0}
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
                    p: 1.5,
                    borderRadius: 4.5,
                    border: '1px solid',
                    borderColor: 'transparent',
                    bgcolor: 'transparent',
                    cursor: 'pointer',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:hover': {
                      borderColor: 'divider',
                      bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(108, 99, 255, 0.06)' : 'rgba(108, 99, 255, 0.02)',
                      boxShadow: '0 6px 15px rgba(0,0,0,0.015)',
                      transform: 'translateY(-2px)',
                      '& .song-index': { display: 'none' },
                      '& .song-play-icon-hover': { display: 'block' },
                    },
                  }}
                >
                  <Stack direction="row" spacing={2.5} alignItems="center">
                    {/* Index / Hover Play Icon */}
                    <Box sx={{ width: 30, display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
                      <Typography className="song-index" variant="body1" fontWeight={800} color="text.secondary">
                        {String(index + 1).padStart(2, '0')}
                      </Typography>
                      <PlayIcon className="song-play-icon-hover" sx={{ display: 'none', color: 'primary.main', fontSize: 22 }} />
                    </Box>

                    {/* Cover Art */}
                    <Avatar
                      src={song.imageUrl || undefined}
                      variant="rounded"
                      sx={{
                        width: 52,
                        height: 52,
                        borderRadius: 3,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                        bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(108, 99, 255, 0.12)' : 'rgba(108, 99, 255, 0.04)',
                        color: 'primary.main',
                        flexShrink: 0,
                      }}
                    >
                      <MusicIcon sx={{ fontSize: 26 }} />
                    </Avatar>

                    {/* Info */}
                    <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                      <Typography variant="body1" fontWeight={750} noWrap sx={{ mb: 0.5 }}>
                        {song.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap sx={{ fontWeight: 500 }}>
                        {(song.artists || []).map((artist) => artist?.name).filter(Boolean).join(', ') || 'Nghệ sĩ ẩn danh'}
                      </Typography>
                    </Box>

                    {/* Stats */}
                    <Box sx={{ display: { xs: 'none', sm: 'block' }, minWidth: 100, textAlign: 'right', mr: 2 }}>
                      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                        {(song.playCount || 0).toLocaleString('vi-VN')} lượt phát
                      </Typography>
                    </Box>

                    {/* Action Row */}
                    <Stack direction="row" spacing={1} alignItems="center" onClick={(e) => e.stopPropagation()}>
                      <Tooltip title="Phát bài hát" arrow>
                        <IconButton
                          size="small"
                          onClick={() => playSong(song, { queue: songs })}
                          sx={{ 
                            color: 'primary.main',
                            bgcolor: 'rgba(108, 99, 255, 0.06)',
                            p: 1,
                            borderRadius: 3.5,
                            border: '1px solid',
                            borderColor: 'rgba(108, 99, 255, 0.1)',
                            '&:hover': { 
                              bgcolor: 'primary.main', 
                              color: '#fff',
                              borderColor: 'primary.main',
                            }
                          }}
                        >
                          <PlayIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      
                      <SongMoreMenu 
                        song={song} 
                        buttonSx={{
                          color: 'text.secondary',
                          bgcolor: 'action.hover',
                          p: 1,
                          borderRadius: 3.5,
                          border: '1px solid',
                          borderColor: 'divider',
                          '&:hover': { 
                            bgcolor: 'primary.main', 
                            color: '#fff',
                            borderColor: 'primary.main',
                          }
                        }} 
                      />
                    </Stack>
                  </Stack>
                </Paper>
              ))}

              {!songs.length && (
                <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center', fontWeight: 555 }}>
                  Playlist này chưa có bài hát nào.
                </Typography>
              )}
            </Stack>
          )}
        </Paper>
      </Stack>
    </ClientLayout>
  );
}

export default ClientPlaylist;
