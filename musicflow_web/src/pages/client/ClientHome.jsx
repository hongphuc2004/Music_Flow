import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Grid,
  IconButton,
  Paper,
  Slider,
  Stack,
  Typography,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  GraphicEq as GraphicEqIcon,
  PlaylistPlay as PlaylistIcon,
  PlayArrowRounded as PlayIcon,
  PauseRounded as PauseIcon,
  RepeatRounded as RepeatIcon,
  SkipPreviousRounded as PrevIcon,
  SkipNextRounded as NextIcon,
  ShuffleRounded as ShuffleIcon,
} from '@mui/icons-material';
import ClientLayout from '../../components/Layout/client/ClientLayout';
import { clientPlaylistsApi, clientSongsApi } from '../../services/api';
import { useClientPlayer } from '../../components/Layout/client/ClientPlayerProvider';
import SongMoreMenu from '../../components/Layout/client/SongMoreMenu';

function ClientHome() {
  const navigate = useNavigate();
  const {
    playSong,
    currentSong,
    isPlaying,
    togglePlay,
    seekTo,
    currentTime,
    duration,
    lyricsLines,
    activeLyricIndex,
    hasSyncedLyrics,
  } = useClientPlayer();
  const [songs, setSongs] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const lyricItemRefs = useRef([]);
  const lyricsContainerRef = useRef(null);

  const interactiveCardSx = {
    border: '1px solid #e2e8f0',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease, background-color 0.2s ease',
    '&:hover': {
      transform: 'translateY(-2px)',
      borderColor: '#14b8a6',
      backgroundColor: '#f0fdfa',
      boxShadow: '0 14px 28px -24px rgba(13, 95, 89, 0.7)',
    },
  };

  const actionButtonSx = {
    color: '#0f766e',
    '&:hover': { backgroundColor: 'rgba(20, 184, 166, 0.14)' },
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError('');

        const [songsRes, playlistsRes] = await Promise.all([
          clientSongsApi.getRecommended({ limit: 8 }),
          clientPlaylistsApi.getSystem({ limit: 6 }),
        ]);

        setSongs(Array.isArray(songsRes.data) ? songsRes.data : []);
        setPlaylists(playlistsRes.data?.playlists || []);
      } catch (err) {
        setError(err.response?.data?.message || 'Khong the tai du lieu trang chu.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const quickStats = useMemo(() => ([
    { label: 'Bai hat goi y', value: songs.length, icon: <GraphicEqIcon /> },
    { label: 'Playlist he thong', value: playlists.length, icon: <PlaylistIcon /> },
    { label: 'Dang thinh hanh', value: songs.filter((song) => (song.playCount || 0) > 0).length, icon: <TrendingUpIcon /> },
  ]), [songs, playlists]);

  const topSongs = useMemo(
    () => [...songs].sort((a, b) => (b.playCount || 0) - (a.playCount || 0)).slice(0, 6),
    [songs],
  );

  const formatDuration = (seconds) => {
    const safeSeconds = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
    const mins = Math.floor(safeSeconds / 60);
    const secs = safeSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const topArtists = useMemo(() => {
    const map = new Map();

    songs.forEach((song) => {
      if (!Array.isArray(song.artists)) return;
      song.artists.forEach((artist) => {
        if (!artist?._id) return;
        if (!map.has(artist._id)) {
          map.set(artist._id, {
            _id: artist._id,
            name: artist.name || 'Unknown artist',
            avatar: artist.avatar || '',
            plays: 0,
          });
        }

        map.get(artist._id).plays += song.playCount || 0;
      });
    });

    return [...map.values()].sort((a, b) => b.plays - a.plays).slice(0, 6);
  }, [songs]);

  useEffect(() => {
    if (!hasSyncedLyrics || activeLyricIndex < 0) return;
    const container = lyricsContainerRef.current;
    const activeLineElement = lyricItemRefs.current[activeLyricIndex];
    if (!container || !activeLineElement) return;

    const containerRect = container.getBoundingClientRect();
    const lineRect = activeLineElement.getBoundingClientRect();
    const lineTopInContainer = lineRect.top - containerRect.top + container.scrollTop;
    const lineBottomInContainer = lineTopInContainer + lineRect.height;

    const padding = 18;
    const viewTop = container.scrollTop;
    const viewBottom = viewTop + container.clientHeight;

    if (lineTopInContainer < viewTop + padding || lineBottomInContainer > viewBottom - padding) {
      const targetScrollTop = lineTopInContainer - (container.clientHeight * 0.35);
      container.scrollTo({
        top: Math.max(0, targetScrollTop),
        behavior: 'smooth',
      });
    }
  }, [activeLyricIndex, hasSyncedLyrics, lyricsLines]);

  return (
    <ClientLayout title="Trang chủ">
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Stack spacing={2.5}>
            <Paper sx={{ p: 3, borderRadius: 3, background: 'linear-gradient(120deg, #06b6d4, #14b8a6)', color: '#fff' }}>
              <Typography variant="h4" sx={{ fontWeight: 800, mb: 1 }}>
                Chao mung ban quay lai
              </Typography>
              <Typography variant="body1" sx={{ opacity: 0.92, mb: 2 }}>
                Kham pha nhac moi, playlist ca nhan va theo doi xu huong ngay hom nay.
              </Typography>
              <Button
                variant="contained"
                onClick={() => navigate('/client/discover')}
                sx={{ bgcolor: '#fff', color: '#0f766e', '&:hover': { bgcolor: '#f0fdfa' } }}
              >
                Bat dau nghe
              </Button>
            </Paper>

            <Grid container spacing={2}>
              {quickStats.map((item) => (
                <Grid size={{ xs: 12, sm: 4 }} key={item.label}>
                  <Paper sx={{ ...interactiveCardSx, p: 2.25, borderRadius: 3, height: '100%' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#0f766e', mb: 1 }}>
                      {item.icon}
                      <Typography fontWeight={700}>{item.label}</Typography>
                    </Box>
                    <Typography variant="h4" sx={{ fontWeight: 800 }}>
                      {item.value}
                    </Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>

            <Paper sx={{ p: 2.5, borderRadius: 3, border: '1px solid #e2e8f0' }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>
                Top artists
              </Typography>
              <Stack direction="row" spacing={1.25} useFlexGap flexWrap="wrap">
                {topArtists.map((artist) => (
                  <Paper
                    key={artist._id}
                    variant="outlined"
                    onClick={() => navigate(`/client/artists/${artist._id}`)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        navigate(`/client/artists/${artist._id}`);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    sx={{ ...interactiveCardSx, p: 1.25, borderRadius: 2.5, width: 120, cursor: 'pointer' }}
                  >
                    <Stack spacing={0.75} alignItems="center">
                      <Avatar src={artist.avatar} sx={{ width: 52, height: 52, bgcolor: '#14b8a6' }}>
                        {artist.name.charAt(0)}
                      </Avatar>
                      <Typography variant="body2" fontWeight={700} noWrap sx={{ maxWidth: 100 }}>
                        {artist.name}
                      </Typography>
                      {artist.plays > 0 && (
                        <Typography variant="caption" color="text.secondary">
                          {artist.plays} plays
                        </Typography>
                      )}
                    </Stack>
                  </Paper>
                ))}
                {!topArtists.length && <Typography color="text.secondary">Chua co du lieu artist.</Typography>}
              </Stack>
            </Paper>

            <Paper sx={{ p: 2.5, borderRadius: 3, border: '1px solid #e2e8f0' }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>
                Top collections
              </Typography>
              <Grid container spacing={1.5}>
                {playlists.slice(0, 4).map((playlist) => (
                  <Grid size={{ xs: 12, sm: 6 }} key={playlist._id}>
                    <Paper variant="outlined" sx={{ ...interactiveCardSx, p: 1.5, borderRadius: 2.5 }}>
                      <Typography fontWeight={700} noWrap>{playlist.name || 'Untitled playlist'}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {(playlist.songs || []).length} songs
                      </Typography>
                    </Paper>
                  </Grid>
                ))}
                {!playlists.length && (
                  <Grid size={{ xs: 12 }}>
                    <Typography color="text.secondary">Chua co collection he thong.</Typography>
                  </Grid>
                )}
              </Grid>
            </Paper>

            <Paper sx={{ p: 2.5, borderRadius: 3, border: '1px solid #e2e8f0' }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>
                Goi y danh cho ban
              </Typography>
              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress size={28} />
                </Box>
              ) : (
                <Grid container spacing={2}>
                  {songs.slice(0, 6).map((song) => (
                    <Grid size={{ xs: 12, md: 6 }} key={song._id}>
                      <Paper
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
                        sx={{ ...interactiveCardSx, p: 1.5, borderRadius: 2.5, cursor: 'pointer' }}
                      >
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <Avatar src={song.imageUrl} variant="rounded" sx={{ width: 52, height: 52 }}>
                            {song.title?.charAt(0)}
                          </Avatar>
                          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                            <Typography fontWeight={700} noWrap>{song.title}</Typography>
                            <Typography variant="caption" color="text.secondary" noWrap>
                              {Array.isArray(song.artists)
                                ? song.artists.map((artist) => artist?.name).filter(Boolean).join(', ')
                                : 'Unknown artist'}
                            </Typography>
                          </Box>
                          <Button
                            size="small"
                            startIcon={<PlayIcon />}
                            onClick={(event) => {
                              event.stopPropagation();
                              playSong(song);
                            }}
                            sx={actionButtonSx}
                          >
                            Play
                          </Button>
                          <SongMoreMenu song={song} buttonSx={actionButtonSx} />
                        </Stack>
                      </Paper>
                    </Grid>
                  ))}
                  {!songs.length && (
                    <Grid size={{ xs: 12 }}>
                      <Typography color="text.secondary">Chua co bai hat de xuat.</Typography>
                    </Grid>
                  )}
                </Grid>
              )}
            </Paper>
          </Stack>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <Stack spacing={2.5}>
            {currentSong && (
              <Paper sx={{ p: 2.25, borderRadius: 3, border: '1px solid #e2e8f0' }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.25 }}>
                  Now playing
                </Typography>
                <Stack
                  spacing={2}
                  sx={{
                    p: 2,
                    borderRadius: 3,
                    overflow: 'hidden',
                    border: '1px solid rgba(255,255,255,0.16)',
                    backgroundImage: `linear-gradient(155deg, rgba(8,47,73,0.96), rgba(15,23,42,0.96), rgba(16,42,67,0.94)), url(${currentSong.imageUrl || ''})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    color: '#fff',
                  }}
                >
                  <Stack alignItems="center" spacing={1.25}>
                    <Avatar
                      src={currentSong.imageUrl}
                      variant="rounded"
                      sx={{ width: 190, height: 190, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.16)' }}
                    >
                      {currentSong.title?.charAt(0)}
                    </Avatar>
                    <Typography variant="h4" fontWeight={800} textAlign="center" noWrap sx={{ maxWidth: '100%' }}>
                      {currentSong.title}
                    </Typography>
                    <Typography
                      variant="body1"
                      textAlign="center"
                      noWrap
                      sx={{ maxWidth: '100%', color: '#fff', opacity: 0.9 }}
                    >
                      {currentSong.artistText || 'Unknown artist'}
                    </Typography>
                  </Stack>

                  <Box sx={{ px: 0.5 }}>
                    <Slider
                      size="small"
                      min={0}
                      max={duration || currentSong?.duration || 1}
                      value={Math.min(currentTime, duration || currentSong?.duration || 1)}
                      onChange={(_, value) => seekTo(value)}
                      sx={{
                        color: '#14b8a6',
                        '& .MuiSlider-thumb': {
                          width: 12,
                          height: 12,
                        },
                        '& .MuiSlider-rail': {
                          opacity: 0.3,
                        },
                      }}
                    />
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="caption" sx={{ opacity: 0.72 }}>
                        {formatDuration(currentTime)}
                      </Typography>
                      <Typography variant="caption" sx={{ opacity: 0.72 }}>
                        {formatDuration(duration || currentSong?.duration || 0)}
                      </Typography>
                    </Stack>
                  </Box>

                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 1 }}>
                    <IconButton sx={{ color: 'rgba(255,255,255,0.65)' }}>
                      <RepeatIcon />
                    </IconButton>
                    <IconButton sx={{ color: 'rgba(255,255,255,0.72)' }} onClick={() => seekTo(0)}>
                      <PrevIcon />
                    </IconButton>
                    <IconButton
                      onClick={togglePlay}
                      sx={{
                        color: '#fff',
                        bgcolor: '#14b8a6',
                        width: 64,
                        height: 64,
                        '&:hover': {
                          bgcolor: '#0f766e',
                        },
                      }}
                    >
                      {isPlaying ? <PauseIcon sx={{ fontSize: 42 }} /> : <PlayIcon sx={{ fontSize: 42 }} />}
                    </IconButton>
                    <IconButton sx={{ color: 'rgba(255,255,255,0.72)' }} onClick={() => playSong(currentSong)}>
                      <NextIcon />
                    </IconButton>
                    <IconButton sx={{ color: 'rgba(255,255,255,0.65)' }}>
                      <ShuffleIcon />
                    </IconButton>
                  </Stack>

                  {lyricsLines.length > 0 && (
                    <Box
                      ref={lyricsContainerRef}
                      sx={{
                        mt: 0.5,
                        borderRadius: 2,
                        border: '1px solid rgba(255,255,255,0.12)',
                        backgroundColor: 'rgba(255,255,255,0.04)',
                        px: 1.25,
                        py: 1,
                        maxHeight: 132,
                        overflowY: 'auto',
                      }}
                    >
                      <Stack spacing={0.45}>
                        {lyricsLines.map((line, index) => (
                          <Typography
                            key={`${line.time}-${line.text}-${index}`}
                            ref={(element) => {
                              lyricItemRefs.current[index] = element;
                            }}
                            variant="caption"
                            sx={{
                              color: hasSyncedLyrics && index === activeLyricIndex ? '#ccfbf1' : 'rgba(255,255,255,0.76)',
                              fontWeight: hasSyncedLyrics && index === activeLyricIndex ? 700 : 500,
                              opacity: hasSyncedLyrics && activeLyricIndex >= 0 && index < activeLyricIndex ? 0.5 : 1,
                              transition: 'all 0.2s ease',
                            }}
                          >
                            {line.text}
                          </Typography>
                        ))}
                      </Stack>
                    </Box>
                  )}
                </Stack>
              </Paper>
            )}

            <Paper sx={{ p: 2, borderRadius: 3, border: '1px solid #e2e8f0' }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.25 }}>
                Top songs weekly
              </Typography>
              <Stack spacing={1}>
                {topSongs.map((song, index) => (
                  <Paper
                    key={song._id}
                    variant="outlined"
                    onClick={() => playSong(song)}
                    sx={{
                      px: 1,
                      py: 0.75,
                      borderRadius: 2,
                      borderColor: 'transparent',
                      bgcolor: 'transparent',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        borderColor: 'rgba(20,184,166,0.45)',
                        bgcolor: 'rgba(20,184,166,0.08)',
                        transform: 'translateY(-1px)',
                        boxShadow: '0 8px 18px rgba(15,118,110,0.16)',
                      },
                      '&:hover .song-play-btn': {
                        opacity: 1,
                        transform: 'translateX(0)',
                      },
                      '&:hover .song-duration': {
                        opacity: 0.2,
                      },
                    }}
                  >
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography
                        variant="caption"
                        sx={{ width: 22, color: index < 3 ? '#0f766e' : 'text.secondary', fontWeight: index < 3 ? 700 : 500 }}
                      >
                        {(index + 1).toString().padStart(2, '0')}
                      </Typography>
                      <Avatar src={song.imageUrl} variant="rounded" sx={{ width: 40, height: 40 }}>
                        {song.title?.charAt(0)}
                      </Avatar>
                      <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                        <Typography variant="body2" fontWeight={700} noWrap>{song.title}</Typography>
                        <Typography variant="caption" color="text.secondary" noWrap>
                          {Array.isArray(song.artists)
                            ? song.artists.map((artist) => artist?.name).filter(Boolean).join(', ')
                            : 'Unknown artist'}
                        </Typography>
                      </Box>
                      <Typography
                        variant="caption"
                        className="song-duration"
                        sx={{ color: 'text.secondary', minWidth: 38, textAlign: 'right', transition: 'opacity 0.2s ease' }}
                      >
                        {(song.duration || 0) ? `${Math.floor((song.duration || 0) / 60)}:${Math.floor((song.duration || 0) % 60).toString().padStart(2, '0')}` : '--:--'}
                      </Typography>
                      <Button
                        size="small"
                        className="song-play-btn"
                        onClick={(event) => {
                          event.stopPropagation();
                          playSong(song);
                        }}
                        sx={{
                          opacity: 0,
                          transform: 'translateX(6px)',
                          transition: 'all 0.2s ease',
                          color: '#0f766e',
                          minWidth: 52,
                        }}
                      >
                        Play
                      </Button>
                    </Stack>
                  </Paper>
                ))}
                {!topSongs.length && <Typography color="text.secondary">Chua co bai hat top.</Typography>}
              </Stack>
            </Paper>
          </Stack>
        </Grid>
      </Grid>
    </ClientLayout>
  );
}

export default ClientHome;
