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
  PlayArrowRounded as PlayIcon,
  PauseRounded as PauseIcon,
  RepeatRounded as RepeatIcon,
  SkipPreviousRounded as PrevIcon,
  SkipNextRounded as NextIcon,
  ShuffleRounded as ShuffleIcon,
  MusicNoteRounded as MusicIcon,
  AutoAwesomeRounded as SparklesIcon,
  LibraryMusicRounded as LibraryMusicIcon,
  ChevronRightRounded as ArrowIcon,
  Check as CheckIcon,
  PersonAdd as FollowIcon,
} from '@mui/icons-material';
import ClientLayout from '../../components/Layout/client/ClientLayout';
import { clientArtistApi, clientPlaylistsApi, clientSongsApi } from '../../services/api';
import { useClientPlayer } from '../../components/Layout/client/ClientPlayerProvider';
import SongMoreMenu from '../../components/Layout/client/SongMoreMenu';
import useAppToast from '../../components/common/useAppToast';

const getPersonalizedGreeting = () => {
  const hour = new Date().getHours();
  const userName = localStorage.getItem('userName') || localStorage.getItem('name') || 'Listener';
  if (hour >= 5 && hour < 12) {
    return { text: `Chào buổi sáng, ${userName} ☀️`, subtitle: 'Khởi đầu ngày mới tràn đầy cảm hứng!' };
  } else if (hour >= 12 && hour < 18) {
    return { text: `Chào buổi chiều, ${userName} 🌤️`, subtitle: 'Nạp thêm năng lượng cùng giai điệu tuyệt vời!' };
  } else {
    return { text: `Chào buổi tối, ${userName} 🌙`, subtitle: 'Thư giãn và khép lại ngày dài cùng âm nhạc nhé!' };
  }
};

function formatFollowerCount(count) {
  if (count === undefined || count === null) return '0 quan tâm';
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1).replace(/\.0$/, '')}M quan tâm`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1).replace(/\.0$/, '')}K quan tâm`;
  }
  return `${count} quan tâm`;
}

const PlayingEqualizer = ({ isPlaying }) => (
  <Box sx={{
    display: 'flex',
    alignItems: 'flex-end',
    gap: '2px',
    height: '14px',
    width: '14px',
    mx: '4px',
    mb: '2px',
    '@keyframes eq-bounce': {
      '0%': { height: '30%' },
      '100%': { height: '100%' },
    },
  }}>
    <Box sx={{ width: '2.5px', height: isPlaying ? '100%' : '30%', bgcolor: '#14b8a6', borderRadius: '1px', animation: isPlaying ? 'eq-bounce 0.8s ease-in-out infinite alternate' : 'none' }} />
    <Box sx={{ width: '2.5px', height: isPlaying ? '100%' : '60%', bgcolor: '#14b8a6', borderRadius: '1px', animation: isPlaying ? 'eq-bounce 0.5s ease-in-out infinite alternate 0.15s' : 'none' }} />
    <Box sx={{ width: '2.5px', height: isPlaying ? '100%' : '40%', bgcolor: '#14b8a6', borderRadius: '1px', animation: isPlaying ? 'eq-bounce 0.7s ease-in-out infinite alternate 0.3s' : 'none' }} />
  </Box>
);


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
  const [nowPlayingColors, setNowPlayingColors] = useState(null);
  const { showToast } = useAppToast();
  const [followedArtists, setFollowedArtists] = useState({});
  const [artistFollowersState, setArtistFollowersState] = useState({});

  const greeting = useMemo(() => getPersonalizedGreeting(), []);


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
        setError(err.response?.data?.message || 'Không thể tải dữ liệu trang chủ.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const extractColors = async () => {
      const imageUrl = currentSong?.imageUrl;
      if (!imageUrl) {
        setNowPlayingColors(null);
        return;
      }

      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';

        await new Promise((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('load_failed'));
          img.src = imageUrl;
        });

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) throw new Error('no_canvas');

        const size = 48;
        canvas.width = size;
        canvas.height = size;
        ctx.drawImage(img, 0, 0, size, size);

        const { data } = ctx.getImageData(0, 0, size, size);
        const buckets = {
          dark: { r: 0, g: 0, b: 0, n: 0 },
          mid: { r: 0, g: 0, b: 0, n: 0 },
          bright: { r: 0, g: 0, b: 0, n: 0 },
          all: { r: 0, g: 0, b: 0, n: 0 },
        };

        for (let i = 0; i < data.length; i += 4) {
          const a = data[i + 3];
          if (a < 40) continue;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          const key = lum < 85 ? 'dark' : lum > 170 ? 'bright' : 'mid';

          buckets[key].r += r;
          buckets[key].g += g;
          buckets[key].b += b;
          buckets[key].n += 1;

          buckets.all.r += r;
          buckets.all.g += g;
          buckets.all.b += b;
          buckets.all.n += 1;
        }

        const avg = (bucket) => {
          const n = bucket.n || 1;
          return {
            r: Math.round(bucket.r / n),
            g: Math.round(bucket.g / n),
            b: Math.round(bucket.b / n),
          };
        };

        const fallback = avg(buckets.all);
        const dark = buckets.dark.n ? avg(buckets.dark) : fallback;
        const mid = buckets.mid.n ? avg(buckets.mid) : fallback;
        const bright = buckets.bright.n ? avg(buckets.bright) : fallback;

        if (!cancelled) {
          setNowPlayingColors({
            dark,
            mid,
            bright,
          });
        }
      } catch {
        if (!cancelled) setNowPlayingColors(null);
      }
    };

    extractColors();

    return () => {
      cancelled = true;
    };
  }, [currentSong?._id, currentSong?.imageUrl]);

  const topSongs = useMemo(
    () => [...songs].sort((a, b) => (b.playCount || 0) - (a.playCount || 0)).slice(0, 6),
    [songs],
  );
  const recommendedSongs = useMemo(() => songs.slice(0, 6), [songs]);

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
    const fetchArtistDetails = async () => {
      if (!topArtists.length) return;
      const isLoggedIn = !!localStorage.getItem('userId');

      const promises = topArtists.map(async (artist) => {
        try {
          const profileRes = await clientArtistApi.getProfile(artist._id);
          const followers = profileRes.data.artist?.followers || 0;

          let isFollowing = false;
          if (isLoggedIn) {
            try {
              const statusRes = await clientArtistApi.getFollowStatus(artist._id);
              isFollowing = statusRes.data.isFollowing;
            } catch (statusErr) {
              console.error("Error fetching follow status for", artist._id, statusErr);
            }
          }

          return {
            id: artist._id,
            followers,
            isFollowing
          };
        } catch (err) {
          console.error("Error fetching details for artist", artist._id, err);
          return {
            id: artist._id,
            followers: 0,
            isFollowing: false
          };
        }
      });

      const results = await Promise.all(promises);
      const followerMap = {};
      const followMap = {};
      results.forEach(res => {
        followerMap[res.id] = res.followers;
        followMap[res.id] = res.isFollowing;
      });

      setArtistFollowersState(followerMap);
      setFollowedArtists(followMap);
    };

    fetchArtistDetails();
  }, [topArtists]);

  const handleToggleFollow = async (artist) => {
    const isLoggedIn = !!localStorage.getItem('userId');
    if (!isLoggedIn) {
      showToast({
        message: 'Vui lòng đăng nhập để quan tâm nghệ sĩ.',
        severity: 'warning'
      });
      navigate('/client/home?auth=login');
      return;
    }

    try {
      const response = await clientArtistApi.toggleFollow(artist._id);
      if (response.data.success) {
        const { isFollowing, followers, message } = response.data;

        setFollowedArtists(prev => ({
          ...prev,
          [artist._id]: isFollowing
        }));

        setArtistFollowersState(prev => ({
          ...prev,
          [artist._id]: followers
        }));

        showToast({
          title: 'Thành công',
          message: message || (isFollowing ? `Đã theo dõi ${artist.name}` : `Đã bỏ theo dõi ${artist.name}`),
          severity: 'success'
        });
      }
    } catch (err) {
      console.error("Error toggling follow", err);
      showToast({
        message: err.response?.data?.message || 'Không thể thực hiện hành động này.',
        severity: 'error'
      });
    }
  };

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
          <Stack spacing={3}>
            <Box
              sx={{
                p: { xs: 3, sm: 4 },
                borderRadius: 5,
                position: 'relative',
                overflow: 'hidden',
                background: (theme) => theme.palette.mode === 'dark'
                  ? 'linear-gradient(135deg, #0b0f19 0%, #111827 100%)'
                  : 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
                border: '1px solid',
                borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                boxShadow: (theme) => theme.palette.mode === 'dark' ? '0 10px 30px rgba(0,0,0,0.3)' : '0 10px 30px rgba(0,0,0,0.02)',
              }}
            >
              {/* Decorative blobs */}
              <Box
                sx={{
                  position: 'absolute',
                  top: '-40px',
                  right: '-40px',
                  width: 200,
                  height: 200,
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(20, 184, 166, 0.25) 0%, transparent 70%)',
                  filter: 'blur(30px)',
                  zIndex: 0,
                  pointerEvents: 'none',
                }}
              />
              <Box
                sx={{
                  position: 'absolute',
                  bottom: '-50px',
                  left: '30%',
                  width: 160,
                  height: 160,
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(99, 102, 241, 0.2) 0%, transparent 70%)',
                  filter: 'blur(25px)',
                  zIndex: 0,
                  pointerEvents: 'none',
                }}
              />

              <Stack spacing={2} sx={{ position: 'relative', zIndex: 1 }} alignItems="flex-start">
                <Box
                  sx={{
                    bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(20, 184, 166, 0.15)' : 'rgba(20, 184, 166, 0.08)',
                    px: 1.5,
                    py: 0.5,
                    borderRadius: 2,
                    border: '1px solid rgba(20, 184, 166, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.75,
                  }}
                >
                  <SparklesIcon sx={{ fontSize: 13, color: '#14b8a6' }} />
                  <Typography sx={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.2, color: '#14b8a6' }}>
                    Chào mừng trở lại
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: -1, mb: 0.75, background: 'linear-gradient(90deg, #14b8a6, #6c63ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1.2 }}>
                    {greeting.text}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, maxWidth: 500 }}>
                    {greeting.subtitle}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1.5} sx={{ pt: 0.5 }}>
                  <Button
                    variant="contained"
                    onClick={() => navigate('/client/discover')}
                    startIcon={<SparklesIcon sx={{ fontSize: 16 }} />}
                    sx={{
                      background: 'linear-gradient(90deg, #14b8a6, #6c63ff)',
                      color: '#fff',
                      fontWeight: 800,
                      borderRadius: 2.5,
                      px: 3,
                      py: 1,
                      textTransform: 'none',
                      boxShadow: '0 4px 14px rgba(20, 184, 166, 0.25)',
                      '&:hover': {
                        background: 'linear-gradient(90deg, #0d9488, #5b54e0)',
                        transform: 'translateY(-2px)',
                        boxShadow: '0 6px 18px rgba(20, 184, 166, 0.35)',
                      },
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                  >
                    Khám phá ngay
                  </Button>
                  {currentSong && !isPlaying && (
                    <Button
                      variant="outlined"
                      onClick={togglePlay}
                      startIcon={<PlayIcon sx={{ fontSize: 16 }} />}
                      sx={{
                        borderColor: '#14b8a6',
                        color: '#14b8a6',
                        fontWeight: 700,
                        borderRadius: 2.5,
                        px: 3,
                        py: 1,
                        textTransform: 'none',
                        '&:hover': {
                          borderColor: '#0d9488',
                          bgcolor: 'rgba(20, 184, 166, 0.04)',
                          transform: 'translateY(-2px)',
                        },
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      }}
                    >
                      Tiếp tục phát
                    </Button>
                  )}
                </Stack>
              </Stack>
            </Box>

            <Paper
              sx={{
                p: 2.5,
                borderRadius: 4,
                bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.02)' : '#ffffff',
                border: '1px solid',
                borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
                boxShadow: (theme) => theme.palette.mode === 'dark' ? '0 4px 20px rgba(0,0,0,0.15)' : '0 4px 20px rgba(0,0,0,0.01)',
              }}
            >
              <Typography variant="h6" sx={{ fontWeight: 800, mb: 3, letterSpacing: -0.5 }}>
                Nghệ Sĩ
              </Typography>
              <Grid container spacing={3}>
                {topArtists.slice(0, 5).map((artist) => {
                  const isFollowed = followedArtists[artist._id] || false;
                  return (
                    <Grid size={{ xs: 6, sm: 4, md: 2.4 }} key={artist._id} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <Avatar
                        src={artist.avatar}
                        sx={{
                          width: { xs: 90, sm: 110, md: 120 },
                          height: { xs: 90, sm: 110, md: 120 },
                          mb: 2,
                          boxShadow: '0 6px 18px rgba(0,0,0,0.1)',
                          cursor: 'pointer',
                          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                          '&:hover': {
                            transform: 'scale(1.08)',
                          }
                        }}
                        onClick={() => navigate(`/client/artists/${artist._id}`)}
                      >
                        {artist.name.charAt(0)}
                      </Avatar>
                      <Typography
                        variant="subtitle1"
                        fontWeight={850}
                        noWrap
                        sx={{
                          maxWidth: '100%',
                          textAlign: 'center',
                          cursor: 'pointer',
                          fontSize: { xs: '13px', sm: '15px' },
                          '&:hover': { color: '#14b8a6' }
                        }}
                        onClick={() => navigate(`/client/artists/${artist._id}`)}
                      >
                        {artist.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, fontWeight: 600 }}>
                        {formatFollowerCount(artistFollowersState[artist._id] || 0)}
                      </Typography>
                      <Button
                        variant="outlined"
                        onClick={() => handleToggleFollow(artist)}
                        startIcon={isFollowed ? <CheckIcon sx={{ fontSize: 16 }} /> : <FollowIcon sx={{ fontSize: 16 }} />}
                        sx={{
                          mt: 2,
                          borderRadius: 10,
                          px: { xs: 2, sm: 3 },
                          py: 0.5,
                          fontSize: '11px',
                          fontWeight: 900,
                          textTransform: 'uppercase',
                          letterSpacing: '0.8px',
                          borderColor: isFollowed ? '#14b8a6' : 'rgba(255, 255, 255, 0.25)',
                          color: isFollowed ? '#14b8a6' : 'text.primary',
                          bgcolor: isFollowed ? 'rgba(20, 184, 166, 0.08)' : 'transparent',
                          transition: 'all 0.25s',
                          '&:hover': {
                            borderColor: '#14b8a6',
                            bgcolor: 'rgba(20, 184, 166, 0.12)',
                            color: '#14b8a6',
                          }
                        }}
                      >
                        {isFollowed ? 'ĐÃ QUAN TÂM' : 'QUAN TÂM'}
                      </Button>
                    </Grid>
                  );
                })}
                {!topArtists.length && (
                  <Grid size={{ xs: 12 }}>
                    <Typography color="text.secondary" sx={{ py: 1 }}>Chưa có dữ liệu nghệ sĩ.</Typography>
                  </Grid>
                )}
              </Grid>
            </Paper>

            <Paper
              sx={{
                p: 2.5,
                borderRadius: 4,
                bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.02)' : '#ffffff',
                border: '1px solid',
                borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
                boxShadow: (theme) => theme.palette.mode === 'dark' ? '0 4px 20px rgba(0,0,0,0.15)' : '0 4px 20px rgba(0,0,0,0.01)',
              }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: -0.5 }}>
                  Đề xuất cho bạn
                </Typography>
                <Button
                  size="small"
                  endIcon={<ArrowIcon />}
                  onClick={() => navigate('/client/discover')}
                  sx={{ color: '#14b8a6', fontWeight: 700, borderRadius: 2, textTransform: 'none' }}
                >
                  Xem tất cả
                </Button>
              </Stack>
              <Grid container spacing={2}>
                {playlists.slice(0, 4).map((playlist) => (
                  <Grid size={{ xs: 6, sm: 3 }} key={playlist._id}>
                    <Box
                      onClick={() => navigate(`/client/collections/${playlist._id}`)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          navigate(`/client/collections/${playlist._id}`);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      sx={{
                        p: 1.5,
                        borderRadius: 3.5,
                        cursor: 'pointer',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        background: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.01)',
                        border: '1px solid',
                        borderColor: 'transparent',
                        outline: 'none',
                        '&:hover': {
                          transform: 'translateY(-6px)',
                          borderColor: '#14b8a6',
                          background: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                          boxShadow: (theme) => theme.palette.mode === 'dark'
                            ? '0 12px 24px -8px rgba(20, 184, 166, 0.3), 0 4px 12px rgba(0,0,0,0.3)'
                            : '0 12px 24px -8px rgba(20, 184, 166, 0.15), 0 4px 12px rgba(0,0,0,0.03)',
                        },
                        '&:hover .play-overlay-card': {
                          opacity: 1,
                          transform: 'scale(1) translate(-50%, -50%)',
                        },
                        '&:hover .zoom-img': {
                          transform: 'scale(1.06)',
                        },
                      }}
                    >
                      <Box sx={{ position: 'relative', borderRadius: 2.5, overflow: 'hidden', mb: 1.5, aspectRatio: '1/1' }}>
                        <Avatar
                          variant="rounded"
                          src={playlist.coverImage && playlist.coverImage.trim() !== '' ? playlist.coverImage : undefined}
                          className="zoom-img"
                          sx={{
                            width: '100%',
                            height: '100%',
                            bgcolor: 'rgba(20, 184, 166, 0.08)',
                            color: '#14b8a6',
                            transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            '& .MuiAvatar-fallback': { display: 'none' }
                          }}
                        >
                          <LibraryMusicIcon sx={{ fontSize: 40 }} />
                        </Avatar>

                        {/* Floating Play Overlay Button */}
                        <Box
                          className="play-overlay-card"
                          sx={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'scale(0.8) translate(-50%, -50%)',
                            transformOrigin: '0 0',
                            bgcolor: '#14b8a6',
                            color: '#fff',
                            width: 44,
                            height: 44,
                            borderRadius: '50%',
                            display: 'grid',
                            placeItems: 'center',
                            opacity: 0,
                            boxShadow: '0 4px 12px rgba(20, 184, 166, 0.4)',
                            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                            zIndex: 3,
                          }}
                        >
                          <PlayIcon sx={{ fontSize: 26, ml: '2px' }} />
                        </Box>
                      </Box>
                      <Typography variant="body2" fontWeight={800} noWrap sx={{ mb: 0.5, fontSize: 13.5 }}>
                        {playlist.name || 'Untitled playlist'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                        {(playlist.songs || []).length} bài hát
                      </Typography>
                    </Box>
                  </Grid>
                ))}
                {!playlists.length && (
                  <Grid size={{ xs: 12 }}>
                    <Typography color="text.secondary" sx={{ py: 1 }}>Chưa có collection hệ thống.</Typography>
                  </Grid>
                )}
              </Grid>
            </Paper>

            <Paper
              sx={{
                p: 2.5,
                borderRadius: 4,
                bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.02)' : '#ffffff',
                border: '1px solid',
                borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
                boxShadow: (theme) => theme.palette.mode === 'dark' ? '0 4px 20px rgba(0,0,0,0.15)' : '0 4px 20px rgba(0,0,0,0.01)',
              }}
            >
              <Typography variant="h6" sx={{ fontWeight: 800, mb: 2.5, letterSpacing: -0.5 }}>
                Gợi ý dành cho bạn
              </Typography>
              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress size={28} sx={{ color: '#14b8a6' }} />
                </Box>
              ) : (
                <Grid container spacing={2}>
                  {recommendedSongs.map((song) => {
                    const isCurrent = currentSong?._id === song._id;
                    return (
                      <Grid size={{ xs: 12, md: 6 }} key={song._id}>
                        <Box
                          onClick={() => playSong(song, { queue: recommendedSongs })}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              playSong(song, { queue: recommendedSongs });
                            }
                          }}
                          role="button"
                          tabIndex={0}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 2,
                            p: 1.5,
                            borderRadius: 3,
                            cursor: 'pointer',
                            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                            bgcolor: (theme) => isCurrent
                              ? theme.palette.mode === 'dark' ? 'rgba(20, 184, 166, 0.12)' : 'rgba(20, 184, 166, 0.06)'
                              : theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.01)',
                            border: '1px solid',
                            borderColor: (theme) => isCurrent
                              ? '#14b8a6'
                              : theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)',
                            outline: 'none',
                            '&:hover': {
                              borderColor: '#14b8a6',
                              bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(20, 184, 166, 0.08)' : 'rgba(20, 184, 166, 0.04)',
                              transform: 'translateY(-2px)',
                              boxShadow: (theme) => theme.palette.mode === 'dark'
                                ? '0 8px 20px -6px rgba(20, 184, 166, 0.3)'
                                : '0 8px 16px -6px rgba(20, 184, 166, 0.12)',
                            },
                            '&:hover .song-img-overlay': {
                              opacity: 1,
                            },
                            '&:hover .song-img-avatar': {
                              transform: 'scale(1.04)',
                            }
                          }}
                        >
                          <Box sx={{ position: 'relative', overflow: 'hidden', borderRadius: 2, flexShrink: 0, width: 48, height: 48 }}>
                            <Avatar
                              variant="rounded"
                              src={song.imageUrl && song.imageUrl.trim() !== '' && !song.imageUrl.includes('tgdfbp3zivuqoxqxpltj') ? song.imageUrl : undefined}
                              className="song-img-avatar"
                              sx={{
                                width: '100%',
                                height: '100%',
                                bgcolor: 'rgba(20, 184, 166, 0.08)',
                                color: '#14b8a6',
                                transition: 'transform 0.25s ease',
                                '& .MuiAvatar-fallback': { display: 'none' }
                              }}
                            >
                              <MusicIcon sx={{ fontSize: 24 }} />
                            </Avatar>

                            {/* Hover Play Overlay */}
                            <Box
                              className="song-img-overlay"
                              sx={{
                                position: 'absolute',
                                inset: 0,
                                bgcolor: 'rgba(0,0,0,0.45)',
                                display: 'grid',
                                placeItems: 'center',
                                opacity: isCurrent ? 1 : 0,
                                transition: 'opacity 0.2s ease',
                              }}
                            >
                              {isCurrent ? (
                                isPlaying ? (
                                  <PauseIcon sx={{ color: '#fff', fontSize: 20 }} />
                                ) : (
                                  <PlayIcon sx={{ color: '#fff', fontSize: 20 }} />
                                )
                              ) : (
                                <PlayIcon sx={{ color: '#fff', fontSize: 20 }} />
                              )}
                            </Box>
                          </Box>

                          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.25 }}>
                              <Typography
                                variant="body2"
                                noWrap
                                sx={{
                                  fontWeight: 800,
                                  color: isCurrent ? '#14b8a6' : 'text.primary',
                                  transition: 'color 0.2s ease',
                                  fontSize: 13.5,
                                }}
                              >
                                {song.title}
                              </Typography>
                              {isCurrent && <PlayingEqualizer isPlaying={isPlaying} />}
                            </Stack>
                            <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', fontWeight: 500 }}>
                              {Array.isArray(song.artists)
                                ? song.artists.map((artist) => artist?.name).filter(Boolean).join(', ')
                                : 'Unknown artist'}
                            </Typography>
                          </Box>

                          {/* Action area */}
                          <Box onClick={(e) => e.stopPropagation()} sx={{ opacity: 0.7, '&:hover': { opacity: 1 } }}>
                            <SongMoreMenu song={song} />
                          </Box>
                        </Box>
                      </Grid>
                    );
                  })}
                  {!songs.length && (
                    <Grid size={{ xs: 12 }}>
                      <Typography color="text.secondary" sx={{ py: 1 }}>Chưa có bài hát để đề xuất.</Typography>
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
              <Paper
                sx={{
                  p: 2.25,
                  borderRadius: 4,
                  bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.02)' : '#ffffff',
                  border: '1px solid',
                  borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
                  boxShadow: (theme) => theme.palette.mode === 'dark' ? '0 4px 20px rgba(0,0,0,0.15)' : '0 4px 20px rgba(0,0,0,0.01)',
                }}
              >
                <Typography variant="h6" sx={{ fontWeight: 800, mb: 1.5, letterSpacing: -0.5 }}>
                  Đang phát
                </Typography>
                <Stack
                  spacing={2.5}
                  sx={{
                    p: 2.5,
                    borderRadius: 3.5,
                    overflow: 'hidden',
                    position: 'relative',
                    border: '1px solid rgba(255,255,255,0.08)',
                    backgroundColor: '#0b0f19',
                    color: '#fff',
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      inset: 0,
                      backgroundImage: `url(${currentSong.imageUrl || ''})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      filter: 'blur(36px) saturate(1.2)',
                      transform: 'scale(1.15)',
                      opacity: 0.6,
                      zIndex: 0,
                    },
                    '&::after': {
                      content: '""',
                      position: 'absolute',
                      inset: 0,
                      backgroundImage: nowPlayingColors
                        ? `linear-gradient(155deg, rgba(${nowPlayingColors.bright.r},${nowPlayingColors.bright.g},${nowPlayingColors.bright.b},0.22), rgba(${nowPlayingColors.mid.r},${nowPlayingColors.mid.g},${nowPlayingColors.mid.b},0.35), rgba(${nowPlayingColors.dark.r},${nowPlayingColors.dark.g},${nowPlayingColors.dark.b},0.88))`
                        : 'linear-gradient(155deg, rgba(8,47,73,0.8), rgba(15,23,42,0.85), rgba(16,42,67,0.9))',
                      zIndex: 1,
                    },
                    '& > *': { position: 'relative', zIndex: 2 },
                  }}
                >
                  <Stack alignItems="center" spacing={2.25} sx={{ py: 1 }}>
                    {/* Vinyl Record */}
                    <Box
                      sx={{
                        position: 'relative',
                        width: 180,
                        height: 180,
                        borderRadius: '50%',
                        display: 'grid',
                        placeItems: 'center',
                        animation: 'spinDisc 15s linear infinite',
                        animationPlayState: isPlaying ? 'running' : 'paused',
                        '@keyframes spinDisc': {
                          from: { transform: 'rotate(0deg)' },
                          to: { transform: 'rotate(360deg)' },
                        },
                        boxShadow: () => {
                          const glowColor = nowPlayingColors
                            ? `rgba(${nowPlayingColors.bright.r}, ${nowPlayingColors.bright.g}, ${nowPlayingColors.bright.b}, 0.5)`
                            : 'rgba(20, 184, 166, 0.4)';
                          return `0 0 0 8px rgba(0, 0, 0, 0.75), 0 0 0 9px rgba(255, 255, 255, 0.05), 0 12px 32px -6px ${glowColor}`;
                        },
                        '&::after': {
                          content: '""',
                          position: 'absolute',
                          inset: 0,
                          borderRadius: '50%',
                          background: 'radial-gradient(circle, transparent 35%, rgba(0,0,0,0.4) 36%, transparent 40%, rgba(255,255,255,0.08) 50%, transparent 60%, rgba(0,0,0,0.5) 70%, transparent 71%, rgba(255,255,255,0.05) 85%, transparent 100%)',
                          pointerEvents: 'none',
                        }
                      }}
                    >
                      <Avatar
                        key={currentSong._id}
                        src={currentSong.imageUrl || undefined}
                        sx={{
                          width: '88%',
                          height: '88%',
                          borderRadius: '50%',
                          border: '2px solid #000',
                        }}
                      >
                        <MusicIcon sx={{ fontSize: 70 }} />
                      </Avatar>
                      {/* Spindle hole */}
                      <Box
                        sx={{
                          position: 'absolute',
                          width: 14,
                          height: 14,
                          borderRadius: '50%',
                          bgcolor: '#0b0f19',
                          border: '2.5px solid rgba(255,255,255,0.2)',
                          zIndex: 2,
                          boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.8)',
                        }}
                      />
                    </Box>

                    <Box sx={{ width: '100%', textAlign: 'center' }}>
                      <Typography variant="h6" fontWeight={900} textAlign="center" noWrap sx={{ maxWidth: '100%', fontSize: 16, letterSpacing: -0.3, mb: 0.25 }}>
                        {currentSong.title}
                      </Typography>
                      <Typography
                        variant="caption"
                        textAlign="center"
                        noWrap
                        sx={{ maxWidth: '100%', color: 'rgba(255,255,255,0.7)', display: 'block', fontWeight: 600 }}
                      >
                        {currentSong.artistText || 'Unknown artist'}
                      </Typography>
                    </Box>
                  </Stack>

                  {/* Playback Slider */}
                  <Box sx={{ px: 0.5 }}>
                    <Slider
                      size="small"
                      min={0}
                      max={duration || currentSong?.duration || 1}
                      value={Math.min(currentTime, duration || currentSong?.duration || 1)}
                      onChange={(_, value) => seekTo(value)}
                      sx={{
                        color: '#14b8a6',
                        height: 4,
                        '& .MuiSlider-thumb': {
                          width: 8,
                          height: 8,
                          transition: 'all 0.15s ease',
                          '&:hover, &.Mui-focusVisible': {
                            boxShadow: '0 0 0 8px rgba(20, 184, 166, 0.16)',
                            width: 12,
                            height: 12,
                          },
                        },
                        '& .MuiSlider-rail': {
                          opacity: 0.2,
                          bgcolor: '#fff',
                        },
                        '& .MuiSlider-track': {
                          border: 'none',
                        }
                      }}
                    />
                    <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.5 }}>
                      <Typography variant="caption" sx={{ opacity: 0.7, fontSize: 11, fontWeight: 600 }}>
                        {formatDuration(currentTime)}
                      </Typography>
                      <Typography variant="caption" sx={{ opacity: 0.7, fontSize: 11, fontWeight: 600 }}>
                        {formatDuration(duration || currentSong?.duration || 0)}
                      </Typography>
                    </Stack>
                  </Box>

                  {/* Player Controls */}
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 1 }}>
                    <IconButton sx={{ color: 'rgba(255,255,255,0.65)', '&:hover': { color: '#14b8a6', transform: 'scale(1.08)' }, transition: 'all 0.2s' }}>
                      <RepeatIcon sx={{ fontSize: 20 }} />
                    </IconButton>
                    <IconButton sx={{ color: 'rgba(255,255,255,0.8)', '&:hover': { color: '#fff', transform: 'scale(1.08)' }, transition: 'all 0.2s' }} onClick={() => seekTo(0)}>
                      <PrevIcon sx={{ fontSize: 28 }} />
                    </IconButton>
                    <IconButton
                      onClick={togglePlay}
                      sx={{
                        color: '#fff',
                        background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
                        width: 54,
                        height: 54,
                        boxShadow: '0 4px 14px rgba(20, 184, 166, 0.4)',
                        '&:hover': {
                          background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
                          transform: 'scale(1.06)',
                          boxShadow: '0 6px 18px rgba(20, 184, 166, 0.55)',
                        },
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      }}
                    >
                      {isPlaying ? <PauseIcon sx={{ fontSize: 32 }} /> : <PlayIcon sx={{ fontSize: 32 }} />}
                    </IconButton>
                    <IconButton sx={{ color: 'rgba(255,255,255,0.8)', '&:hover': { color: '#fff', transform: 'scale(1.08)' }, transition: 'all 0.2s' }} onClick={() => playSong(currentSong)}>
                      <NextIcon sx={{ fontSize: 28 }} />
                    </IconButton>
                    <IconButton sx={{ color: 'rgba(255,255,255,0.65)', '&:hover': { color: '#14b8a6', transform: 'scale(1.08)' }, transition: 'all 0.2s' }}>
                      <ShuffleIcon sx={{ fontSize: 20 }} />
                    </IconButton>
                  </Stack>

                  {/* Glassmorphic Lyrics scroll panel */}
                  {lyricsLines.length > 0 && (
                    <Box
                      ref={lyricsContainerRef}
                      sx={{
                        mt: 1,
                        borderRadius: 3,
                        border: '1px solid rgba(255,255,255,0.08)',
                        backgroundColor: 'rgba(0, 0, 0, 0.25)',
                        px: 2,
                        py: 1.5,
                        maxHeight: 120,
                        overflowY: 'auto',
                        maskImage: 'linear-gradient(to bottom, transparent 0%, #fff 15%, #fff 85%, transparent 100%)',
                        WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, #fff 15%, #fff 85%, transparent 100%)',
                        scrollbarWidth: 'none',
                        '&::-webkit-scrollbar': { display: 'none' },
                      }}
                    >
                      <Stack spacing={1} sx={{ py: 1.5 }}>
                        {lyricsLines.map((line, index) => (
                          <Typography
                            key={`${line.time}-${line.text}-${index}`}
                            ref={(element) => {
                              lyricItemRefs.current[index] = element;
                            }}
                            variant="body2"
                            sx={{
                              textAlign: 'center',
                              color: hasSyncedLyrics && index === activeLyricIndex ? '#14b8a6' : 'rgba(255,255,255,0.5)',
                              fontWeight: hasSyncedLyrics && index === activeLyricIndex ? 800 : 500,
                              fontSize: hasSyncedLyrics && index === activeLyricIndex ? 13.5 : 12.5,
                              opacity: hasSyncedLyrics && activeLyricIndex >= 0 && index < activeLyricIndex ? 0.4 : 1,
                              transform: hasSyncedLyrics && index === activeLyricIndex ? 'scale(1.02)' : 'scale(1)',
                              transition: 'all 0.25s ease',
                              cursor: 'pointer',
                              '&:hover': {
                                color: '#14b8a6',
                                opacity: 0.9,
                              }
                            }}
                            onClick={() => seekTo(line.time / 1000)}
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

            <Paper
              sx={{
                p: 2.5,
                borderRadius: 4,
                bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.02)' : '#ffffff',
                border: '1px solid',
                borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
                boxShadow: (theme) => theme.palette.mode === 'dark' ? '0 4px 20px rgba(0,0,0,0.15)' : '0 4px 20px rgba(0,0,0,0.01)',
              }}
            >
              <Typography variant="h6" sx={{ fontWeight: 800, mb: 2, letterSpacing: -0.5 }}>
                Bài hát phổ biến
              </Typography>
              <Stack spacing={1}>
                {topSongs.map((song, index) => {
                  const isCurrent = currentSong?._id === song._id;
                  return (
                    <Box
                      key={song._id}
                      onClick={() => playSong(song, { queue: topSongs })}
                      sx={{
                        p: 1,
                        borderRadius: 2.5,
                        cursor: 'pointer',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        bgcolor: (theme) => isCurrent
                          ? theme.palette.mode === 'dark' ? 'rgba(20, 184, 166, 0.1)' : 'rgba(20, 184, 166, 0.04)'
                          : 'transparent',
                        border: '1px solid',
                        borderColor: (theme) => isCurrent ? 'rgba(20, 184, 166, 0.3)' : 'transparent',
                        '&:hover': {
                          borderColor: '#14b8a6',
                          bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(20, 184, 166, 0.06)' : 'rgba(20, 184, 166, 0.02)',
                          transform: 'translateY(-1px)',
                        },
                        '&:hover .song-row-play-btn': {
                          opacity: 1,
                          transform: 'scale(1)',
                        },
                        '&:hover .song-row-num': {
                          display: 'none',
                        },
                      }}
                    >
                      {/* Left: Index / Play Icon / Equalizer */}
                      <Box sx={{ width: 24, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        {isCurrent ? (
                          <PlayingEqualizer isPlaying={isPlaying} />
                        ) : (
                          <Box sx={{ position: 'relative', width: 24, height: 24, display: 'grid', placeItems: 'center' }}>
                            <Typography
                              className="song-row-num"
                              variant="caption"
                              sx={{
                                color: index < 3 ? '#14b8a6' : 'text.secondary',
                                fontWeight: 800,
                                fontSize: 13,
                              }}
                            >
                              {(index + 1).toString().padStart(2, '0')}
                            </Typography>
                            <IconButton
                              className="song-row-play-btn"
                              size="small"
                              sx={{
                                position: 'absolute',
                                inset: 0,
                                opacity: 0,
                                transform: 'scale(0.8)',
                                transition: 'all 0.2s ease',
                                color: '#14b8a6',
                                p: 0,
                              }}
                            >
                              <PlayIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                          </Box>
                        )}
                      </Box>

                      {/* Song Image */}
                      <Avatar
                        src={song.imageUrl || undefined}
                        variant="rounded"
                        sx={{
                          width: 40,
                          height: 40,
                          bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                        }}
                      >
                        <MusicIcon sx={{ fontSize: 20, color: '#14b8a6' }} />
                      </Avatar>

                      {/* Title & Artist */}
                      <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                        <Typography
                          variant="body2"
                          fontWeight={800}
                          noWrap
                          sx={{
                            color: isCurrent ? '#14b8a6' : 'text.primary',
                            transition: 'color 0.2s ease',
                            fontSize: 13,
                            mb: 0.25,
                          }}
                        >
                          {song.title}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', fontWeight: 500 }}>
                          {Array.isArray(song.artists)
                            ? song.artists.map((artist) => artist?.name).filter(Boolean).join(', ')
                            : 'Unknown artist'}
                        </Typography>
                      </Box>

                      {/* Duration / More Options */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography
                          variant="caption"
                          className="song-row-duration"
                          sx={{ color: 'text.secondary', minWidth: 38, textAlign: 'right', fontWeight: 600 }}
                        >
                          {song.duration ? `${Math.floor(song.duration / 60)}:${Math.floor(song.duration % 60).toString().padStart(2, '0')}` : '--:--'}
                        </Typography>
                        <Box onClick={(e) => e.stopPropagation()} sx={{ opacity: 0.6, '&:hover': { opacity: 1 } }}>
                          <SongMoreMenu song={song} />
                        </Box>
                      </Box>
                    </Box>
                  );
                })}
                {!topSongs.length && <Typography color="text.secondary" sx={{ py: 1 }}>Chưa có bài hát phổ biến.</Typography>}
              </Stack>
            </Paper>
          </Stack>
        </Grid>
      </Grid>
    </ClientLayout>
  );
}

export default ClientHome;
