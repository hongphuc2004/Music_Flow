import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Stack,
  Typography,
  Chip,
  IconButton,
} from '@mui/material';
import {
  RefreshRounded as RefreshIcon,
  ChevronRightRounded as ArrowIcon,
  MusicNoteRounded as MusicIcon,
  PlayArrowRounded as PlayIcon,
  PauseRounded as PauseIcon,
  AutoAwesomeRounded as SparklesIcon,
  ArrowBackIosNewRounded as PrevIcon,
  ArrowForwardIosRounded as NextIcon,
  WhatshotRounded as FireIcon,
  LibraryMusicRounded as LibraryMusicIcon,
} from '@mui/icons-material';
import ClientLayout from '../../components/Layout/client/ClientLayout';
import { clientPlaylistsApi, clientSongsApi, clientTopicsApi } from '../../services/api';
import { useClientPlayerActions } from '../../components/Layout/client/ClientPlayerProvider';
import SongMoreMenu from '../../components/Layout/client/SongMoreMenu';

const getRecentPlayedStorageKey = () => {
  const userId = localStorage.getItem('userId') || 'anonymous';
  return `musicflow_recent_played_${userId}`;
};

const readRecentPlayedSongs = () => {
  try {
    const raw = localStorage.getItem(getRecentPlayedStorageKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const getPersonalizedGreeting = () => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) {
    return { text: 'Chào buổi sáng ☀️', subtitle: 'Khởi đầu ngày mới tràn đầy cảm hứng!' };
  } else if (hour >= 12 && hour < 18) {
    return { text: 'Chào buổi chiều 🌤️', subtitle: 'Nạp thêm năng lượng cùng giai điệu tuyệt vời!' };
  } else {
    return { text: 'Chào buổi tối 🌙', subtitle: 'Thư giãn và khép lại ngày dài cùng âm nhạc nhé!' };
  }
};

function ClientDiscover() {
  const navigate = useNavigate();
  const { playSong } = useClientPlayerActions();
  const [songs, setSongs] = useState([]);
  const [suggestedSongs, setSuggestedSongs] = useState([]);
  const [topics, setTopics] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshingSuggestions, setRefreshingSuggestions] = useState(false);
  const [playingPlaylistId, setPlayingPlaylistId] = useState(null);
  const [error, setError] = useState('');

  // Carousel Slides State
  const [activeSlide, setActiveSlide] = useState(0);
  const [carouselHovered, setCarouselHovered] = useState(false);

  // Active Category Filtering
  const [activeCategory, setActiveCategory] = useState('all');

  const greeting = useMemo(() => getPersonalizedGreeting(), []);

  const categories = [
    { id: 'all', label: 'Tất cả' },
    { id: 'songs', label: 'Bài hát gợi ý' },
    { id: 'recent', label: 'Nghe gần đây' },
    { id: 'mixes', label: 'Dành riêng cho bạn' },
    { id: 'top100', label: 'Top 100' },
    { id: 'playlists', label: 'Playlists' }
  ];

  const fetchRecommendedSongs = useCallback(async ({ forceFresh = false } = {}) => {
    const params = {
      limit: 24,
      ...(forceFresh ? { _t: Date.now() } : {}),
    };
    const songsRes = await clientSongsApi.getRecommended(params);
    return Array.isArray(songsRes.data) ? songsRes.data : [];
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [songsRes, topicsRes, playlistsRes] = await Promise.all([
        fetchRecommendedSongs(),
        clientTopicsApi.getAll(),
        clientPlaylistsApi.getSystem({ limit: 20 }),
      ]);

      const nextSongs = songsRes;
      setSongs(nextSongs);
      setSuggestedSongs(nextSongs.slice(0, 9));
      setTopics(Array.isArray(topicsRes.data) ? topicsRes.data : []);
      setPlaylists(playlistsRes.data?.playlists || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể tải dữ liệu khám phá.');
    } finally {
      setLoading(false);
    }
  }, [fetchRecommendedSongs]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const refreshSuggestedSongsOnly = async () => {
    try {
      setRefreshingSuggestions(true);
      setError('');
      const nextSongs = await fetchRecommendedSongs({ forceFresh: true });
      setSuggestedSongs(nextSongs.slice(0, 9));
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể làm mới gợi ý bài hát.');
    } finally {
      setRefreshingSuggestions(false);
    }
  };

  const recentSongs = useMemo(() => readRecentPlayedSongs().slice(0, 6), []);
  const recentQueue = recentSongs.length > 0 ? recentSongs : songs.slice(0, 5);

  const top100Cards = useMemo(() => {
    return [...songs]
      .sort((a, b) => (b.playCount || 0) - (a.playCount || 0))
      .slice(0, 5);
  }, [songs]);

  const chillCards = useMemo(() => {
    const chillTopics = new Set(['chill', 'lofi', 'sleep', 'piano']);
    const matched = playlists.filter((playlist) => {
      const name = String(playlist?.name || '').toLowerCase();
      return [...chillTopics].some((keyword) => name.includes(keyword));
    });
    return (matched.length > 0 ? matched : playlists).slice(0, 5);
  }, [playlists]);

  const artistMixCards = useMemo(() => {
    const artistMap = new Map();
    songs.forEach((song) => {
      if (!Array.isArray(song.artists)) return;
      song.artists.forEach((artist) => {
        if (!artist?._id || artistMap.has(artist._id)) return;
        artistMap.set(artist._id, {
          id: artist._id,
          name: artist.name || 'Unknown artist',
          avatar: artist.avatar || song.imageUrl || '',
          subtitle: (song.artists || []).map((a) => a?.name).filter(Boolean).join(', '),
        });
      });
    });
    return [...artistMap.values()].slice(0, 5);
  }, [songs]);

  // Play whole playlist (fetches system playlist details with songs populated)
  const handlePlayPlaylist = async (e, playlist) => {
    e.stopPropagation();
    if (!playlist?._id) return;

    try {
      setPlayingPlaylistId(playlist._id);
      const res = await clientPlaylistsApi.getSystemById(playlist._id);
      const fullPlaylist = res.data?.playlist;
      const playlistSongs = Array.isArray(fullPlaylist?.songs) ? fullPlaylist.songs : [];
      if (playlistSongs.length > 0) {
        playSong(playlistSongs[0], { queue: playlistSongs });
      }
    } catch (err) {
      console.error('Không thể phát playlist:', err);
    } finally {
      setPlayingPlaylistId(null);
    }
  };

  // Play artist mixes directly
  const handlePlayArtistMix = (e, artistId) => {
    e.stopPropagation();
    const artistSongs = songs.filter((song) =>
      Array.isArray(song.artists) && song.artists.some((a) => a?._id === artistId)
    );
    if (artistSongs.length > 0) {
      playSong(artistSongs[0], { queue: artistSongs });
    }
  };

  // Featured Hero Slides
  const carouselSlides = useMemo(() => [
    {
      title: 'AI Mood Playlist',
      description: 'Nhập cảm xúc của bạn và để trí tuệ nhân tạo (AI) tự động thiết kế playlist nhạc phù hợp nhất!',
      gradient: 'linear-gradient(135deg, #7c3aed 0%, #2563eb 100%)',
      btnText: 'Tạo nhạc AI ngay',
      btnIcon: <SparklesIcon sx={{ mr: 1, fontSize: 18 }} />,
      action: () => navigate('/client/ai-mood'),
      badge: 'Tính năng HOT',
      bgGlow: 'rgba(124, 58, 237, 0.45)'
    },
    {
      title: 'Bảng Xếp Hạng BXH',
      description: 'Khám phá ngay danh sách 100 ca khúc đang đứng đầu xu hướng và được nghe nhiều nhất tuần này.',
      gradient: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
      btnText: 'Khám phá BXH',
      btnIcon: <FireIcon sx={{ mr: 1, fontSize: 18 }} />,
      action: () => navigate('/client/rankings'),
      badge: 'Xu hướng mới',
      bgGlow: 'rgba(239, 68, 68, 0.4)'
    },
    {
      title: 'Chủ Đề & Thể Loại',
      description: 'Tuyển tập các ca khúc theo từng chủ đề: Lofi Chill, nhạc Tập Trung, EDM sôi động hay Acoustic ngọt ngào.',
      gradient: 'linear-gradient(135deg, #10b981 0%, #14b8a6 100%)',
      btnText: 'Xem tất cả thể loại',
      btnIcon: <LibraryMusicIcon sx={{ mr: 1, fontSize: 18 }} />,
      action: () => navigate('/client/genres'),
      badge: 'Đa dạng thể loại',
      bgGlow: 'rgba(20, 184, 166, 0.45)'
    }
  ], [navigate]);

  // Slideshow Auto-Cycle
  useEffect(() => {
    if (carouselHovered) return;
    const interval = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % carouselSlides.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [carouselHovered, carouselSlides.length]);

  const handlePrevSlide = (e) => {
    e.stopPropagation();
    setActiveSlide((prev) => (prev - 1 + carouselSlides.length) % carouselSlides.length);
  };

  const handleNextSlide = (e) => {
    e.stopPropagation();
    setActiveSlide((prev) => (prev + 1) % carouselSlides.length);
  };

  // Styled scrollbar for horizontal sections
  const scrollbarSx = {
    overflowX: 'auto',
    pt: 1.25, // Extra headroom to prevent vertical clipping on card hover
    mt: -1.25, // Compensation margin
    pb: 1.5,
    mb: -1.5,
    scrollbarWidth: 'thin',
    '&::-webkit-scrollbar': {
      height: '6px',
    },
    '&::-webkit-scrollbar-track': {
      background: 'transparent',
    },
    '&::-webkit-scrollbar-thumb': {
      background: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
      borderRadius: '4px',
    },
    '&::-webkit-scrollbar-thumb:hover': {
      background: '#14b8a6',
    },
  };

  const cardSx = {
    borderRadius: 4,
    p: 1.5,
    background: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.02)' : '#ffffff',
    border: '1px solid',
    borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
    minWidth: 200,
    maxWidth: 200,
    flexShrink: 0,
    cursor: 'pointer',
    position: 'relative',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    boxShadow: (theme) => theme.palette.mode === 'dark'
      ? '0 4px 20px rgba(0,0,0,0.2)'
      : '0 4px 20px rgba(0,0,0,0.02)',
    '&:hover': {
      transform: 'translateY(-6px)',
      borderColor: '#14b8a6',
      boxShadow: (theme) => theme.palette.mode === 'dark'
        ? '0 12px 28px -8px rgba(20, 184, 166, 0.45), 0 4px 12px rgba(0,0,0,0.4)'
        : '0 12px 28px -8px rgba(20, 184, 166, 0.22), 0 4px 12px rgba(0,0,0,0.06)',
    },
    '&:hover .play-overlay-card': {
      opacity: 1,
      transform: 'scale(1)',
    },
    '&:hover .zoom-img': {
      transform: 'scale(1.06)',
    },
  };

  const sectionHeader = (title, categoryId) => (
    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
      <Typography sx={{ fontWeight: 850, fontSize: 24, letterSpacing: -0.5 }}>{title}</Typography>
      <Button
        size="small"
        endIcon={<ArrowIcon />}
        onClick={() => {
          if (categoryId === 'playlists') navigate('/client/genres');
          else if (categoryId === 'top100') navigate('/client/rankings');
          else if (categoryId === 'mixes') navigate('/client/ai-mood');
          else setActiveCategory('all');
        }}
        sx={{
          color: '#14b8a6',
          fontWeight: 700,
          borderRadius: 2,
          px: 1.5,
          '&:hover': { bgcolor: 'rgba(20, 184, 166, 0.08)' }
        }}
      >
        Tất cả
      </Button>
    </Stack>
  );

  return (
    <ClientLayout title="Khám phá">
      {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 3 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
          <CircularProgress size={40} sx={{ color: '#14b8a6' }} />
        </Box>
      ) : (
        <Stack spacing={4.5} sx={{ width: '100%' }}>

          {/* Header Greeting & Action */}
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={2}>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 900, mb: 0.5, letterSpacing: -1, background: 'linear-gradient(90deg, #14b8a6, #2563eb)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                {greeting.text}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                {greeting.subtitle}
              </Typography>
            </Box>
            <Button
              onClick={loadData}
              startIcon={<RefreshIcon />}
              sx={{
                color: '#14b8a6',
                borderColor: 'rgba(20, 184, 166, 0.3)',
                borderRadius: 2.5,
                px: 2,
                py: 0.75,
                '&:hover': {
                  borderColor: '#14b8a6',
                  bgcolor: 'rgba(20, 184, 166, 0.04)',
                }
              }}
              variant="outlined"
            >
              Cập nhật trang
            </Button>
          </Stack>

          {/* Premium Hero Carousel */}
          <Box
            onMouseEnter={() => setCarouselHovered(true)}
            onMouseLeave={() => setCarouselHovered(false)}
            sx={{
              position: 'relative',
              borderRadius: 5,
              overflow: 'hidden',
              height: { xs: 260, md: 240 },
              display: 'flex',
              alignItems: 'center',
              boxShadow: (theme) => theme.palette.mode === 'dark'
                ? `0 20px 40px -15px ${carouselSlides[activeSlide].bgGlow}, 0 4px 20px rgba(0,0,0,0.5)`
                : `0 20px 40px -18px ${carouselSlides[activeSlide].bgGlow}, 0 4px 15px rgba(0,0,0,0.06)`,
              transition: 'box-shadow 0.5s ease',
            }}
          >
            {carouselSlides.map((slide, index) => (
              <Box
                key={`slide-${index}`}
                sx={{
                  position: 'absolute',
                  inset: 0,
                  opacity: activeSlide === index ? 1 : 0,
                  transition: 'opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                  background: slide.gradient,
                  display: 'flex',
                  alignItems: 'center',
                  p: { xs: 3, md: 5 },
                  zIndex: activeSlide === index ? 2 : 1,
                  pointerEvents: activeSlide === index ? 'auto' : 'none',
                }}
              >
                {/* Backlit Overlay Glass effect */}
                <Box
                  sx={{
                    position: 'absolute',
                    right: '-5%',
                    bottom: '-20%',
                    width: 320,
                    height: 320,
                    borderRadius: '50%',
                    background: 'rgba(255, 255, 255, 0.1)',
                    filter: 'blur(30px)',
                    zIndex: 0,
                  }}
                />

                <Stack spacing={2} sx={{ maxWidth: { xs: '100%', md: '65%' }, zIndex: 1, color: '#ffffff' }} alignItems="flex-start">
                  {slide.badge && (
                    <Box sx={{ bgcolor: 'rgba(255, 255, 255, 0.2)', backdropFilter: 'blur(4px)', px: 1.5, py: 0.4, borderRadius: 2, border: '1px solid rgba(255,255,255,0.25)' }}>
                      <Typography sx={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1 }}>
                        {slide.badge}
                      </Typography>
                    </Box>
                  )}
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: -0.75, mb: 0.5, lineHeight: 1.2 }}>
                      {slide.title}
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.88, fontWeight: 500, lineHeight: 1.5 }}>
                      {slide.description}
                    </Typography>
                  </Box>
                  <Button
                    variant="contained"
                    onClick={slide.action}
                    startIcon={slide.btnIcon}
                    sx={{
                      bgcolor: '#ffffff',
                      color: '#0f172a',
                      fontWeight: 800,
                      borderRadius: 2.5,
                      px: 3,
                      py: 1,
                      textTransform: 'none',
                      boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
                      '&:hover': {
                        bgcolor: 'rgba(255, 255, 255, 0.9)',
                        transform: 'translateY(-2px)',
                        boxShadow: '0 6px 18px rgba(0,0,0,0.2)'
                      },
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {slide.btnText}
                  </Button>
                </Stack>
              </Box>
            ))}

            {/* Carousel Arrow Navigation Buttons */}
            <IconButton
              onClick={handlePrevSlide}
              sx={{
                position: 'absolute',
                left: 12,
                zIndex: 10,
                color: '#fff',
                bgcolor: 'rgba(0,0,0,0.2)',
                '&:hover': { bgcolor: 'rgba(0,0,0,0.45)' },
                width: 36,
                height: 36,
              }}
            >
              <PrevIcon sx={{ fontSize: 16 }} />
            </IconButton>
            <IconButton
              onClick={handleNextSlide}
              sx={{
                position: 'absolute',
                right: 12,
                zIndex: 10,
                color: '#fff',
                bgcolor: 'rgba(0,0,0,0.2)',
                '&:hover': { bgcolor: 'rgba(0,0,0,0.45)' },
                width: 36,
                height: 36,
              }}
            >
              <NextIcon sx={{ fontSize: 16 }} />
            </IconButton>

            {/* Slider Dots */}
            <Stack
              direction="row"
              spacing={1}
              sx={{
                position: 'absolute',
                bottom: 16,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 10,
              }}
            >
              {carouselSlides.map((_, idx) => (
                <Box
                  key={`dot-${idx}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveSlide(idx);
                  }}
                  sx={{
                    width: activeSlide === idx ? 24 : 8,
                    height: 8,
                    borderRadius: 4,
                    bgcolor: activeSlide === idx ? '#fff' : 'rgba(255, 255, 255, 0.4)',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                  }}
                />
              ))}
            </Stack>
          </Box>

          {/* Quick Categories Filter Bar */}
          <Stack
            direction="row"
            spacing={1.25}
            sx={{
              overflowX: 'auto',
              scrollbarWidth: 'none',
              '&::-webkit-scrollbar': { display: 'none' },
              pb: 0.5
            }}
          >
            {categories.map((cat) => (
              <Chip
                key={cat.id}
                label={cat.label}
                onClick={() => setActiveCategory(cat.id)}
                sx={{
                  fontWeight: 700,
                  fontSize: 13,
                  py: 2,
                  px: 1,
                  borderRadius: 3,
                  cursor: 'pointer',
                  border: '1px solid',
                  borderColor: activeCategory === cat.id ? '#14b8a6' : (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                  bgcolor: activeCategory === cat.id ? '#14b8a6' : (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.03)' : '#ffffff',
                  color: activeCategory === cat.id ? '#ffffff' : 'text.primary',
                  boxShadow: activeCategory === cat.id ? '0 4px 12px rgba(20, 184, 166, 0.25)' : 'none',
                  '&:hover': {
                    bgcolor: activeCategory === cat.id ? '#14b8a6' : 'action.hover',
                    borderColor: activeCategory === cat.id ? '#14b8a6' : '#14b8a6',
                  },
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              />
            ))}
          </Stack>

          {/* SECTION: Gợi Ý Bài Hát (Song Suggestions) */}
          {(activeCategory === 'all' || activeCategory === 'songs') && (
            <Box>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2.25 }}>
                <Typography sx={{ fontWeight: 850, fontSize: 24, letterSpacing: -0.5 }}>Gợi Ý Bài Hát</Typography>
                <Button
                  onClick={refreshSuggestedSongsOnly}
                  startIcon={<RefreshIcon />}
                  sx={{
                    color: '#14b8a6',
                    borderColor: 'rgba(20, 184, 166, 0.25)',
                    borderRadius: 2,
                    textTransform: 'none',
                    fontWeight: 700,
                    px: 2,
                    '&:hover': {
                      borderColor: '#14b8a6',
                      bgcolor: 'rgba(20, 184, 166, 0.05)'
                    }
                  }}
                  variant="outlined"
                  disabled={refreshingSuggestions}
                >
                  {refreshingSuggestions ? 'Đang cập nhật...' : 'Đổi đề xuất'}
                </Button>
              </Stack>

              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, gap: 2 }}>
                {suggestedSongs.map((song) => (
                  <Stack
                    key={`quick-${song._id}`}
                    direction="row"
                    spacing={1.5}
                    alignItems="center"
                    sx={{
                      p: 1.25,
                      borderRadius: 3.5,
                      backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.02)' : '#ffffff',
                      border: '1px solid',
                      borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
                      cursor: 'pointer',
                      position: 'relative',
                      transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                      boxShadow: (theme) => theme.palette.mode === 'dark' ? '0 4px 12px rgba(0,0,0,0.1)' : '0 4px 10px rgba(0,0,0,0.01)',
                      '&:hover': {
                        borderColor: '#14b8a6',
                        backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(20, 184, 166, 0.06)' : 'rgba(20, 184, 166, 0.02)',
                        transform: 'translateY(-2px)',
                        boxShadow: (theme) => theme.palette.mode === 'dark'
                          ? '0 8px 20px -6px rgba(20, 184, 166, 0.35)'
                          : '0 8px 16px -6px rgba(20, 184, 166, 0.18)',
                      },
                      '&:hover .song-play-overlay': {
                        opacity: 1,
                      },
                      '&:hover .song-avatar': {
                        transform: 'scale(1.04)',
                      }
                    }}
                    onClick={() => playSong(song, { queue: suggestedSongs })}
                  >
                    <Box sx={{ position: 'relative', overflow: 'hidden', borderRadius: 2.25, flexShrink: 0 }}>
                      <Avatar
                        src={song.imageUrl || undefined}
                        variant="rounded"
                        className="song-avatar"
                        imgProps={{ loading: 'lazy' }}
                        sx={{
                          width: 48,
                          height: 48,
                          transition: 'transform 0.25s ease',
                          bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0,0,0,0.04)'
                        }}
                      >
                        <MusicIcon sx={{ fontSize: 24, color: '#14b8a6' }} />
                      </Avatar>
                      {/* Play overlay for suggestions */}
                      <Box
                        className="song-play-overlay"
                        sx={{
                          position: 'absolute',
                          inset: 0,
                          bgcolor: 'rgba(0,0,0,0.45)',
                          display: 'grid',
                          placeItems: 'center',
                          opacity: 0,
                          transition: 'opacity 0.2s ease',
                        }}
                      >
                        <PlayIcon sx={{ color: '#fff', fontSize: 22 }} />
                      </Box>
                    </Box>

                    <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                      <Typography variant="body2" noWrap sx={{ fontWeight: 750, mb: 0.25 }}>{song.title}</Typography>
                      <Typography variant="caption" noWrap sx={{ color: 'text.secondary', display: 'block' }}>
                        {Array.isArray(song.artists)
                          ? song.artists.map((artist) => artist?.name).filter(Boolean).join(', ')
                          : 'Unknown artist'}
                      </Typography>
                    </Box>

                    {/* Reusable Menu Button */}
                    <Box onClick={(e) => e.stopPropagation()} sx={{ opacity: 0.7, '&:hover': { opacity: 1 } }}>
                      <SongMoreMenu song={song} />
                    </Box>
                  </Stack>
                ))}
              </Box>
            </Box>
          )}

          {/* SECTION: Nghe Gần Đây (Recently Played) */}
          {(activeCategory === 'all' || activeCategory === 'recent') && (
            <Box>
              {sectionHeader('Nghe Gần Đây', 'recent')}
              <Stack direction="row" spacing={2.25} sx={scrollbarSx}>
                {recentQueue.map((song) => (
                  <Box key={`recent-${song._id}`} sx={cardSx} onClick={() => playSong(song, { queue: recentQueue })}>
                    <Box sx={{ position: 'relative', borderRadius: 3, overflow: 'hidden', mb: 1.5, aspectRatio: '1/1' }}>
                      <Avatar
                        variant="rounded"
                        src={song.imageUrl && song.imageUrl.trim() !== '' && !song.imageUrl.includes('tgdfbp3zivuqoxqxpltj') ? song.imageUrl : undefined}
                        className="zoom-img"
                        imgProps={{ loading: 'lazy' }}
                        sx={{
                          width: '100%',
                          height: '100%',
                          bgcolor: 'rgba(20, 184, 166, 0.08)',
                          color: '#14b8a6',
                          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                          '& .MuiAvatar-fallback': { display: 'none' }
                        }}
                      >
                        <MusicIcon sx={{ fontSize: 40 }} />
                      </Avatar>

                      {/* Play Overlay */}
                      <Box
                        className="play-overlay-card"
                        sx={{
                          position: 'absolute',
                          inset: 0,
                          bgcolor: 'rgba(0, 0, 0, 0.4)',
                          display: 'grid',
                          placeItems: 'center',
                          opacity: 0,
                          transform: 'scale(0.95)',
                          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                          backdropFilter: 'blur(2px)',
                        }}
                      >
                        <IconButton
                          size="medium"
                          sx={{
                            bgcolor: '#14b8a6',
                            color: '#fff',
                            boxShadow: '0 4px 12px rgba(20, 184, 166, 0.4)',
                            '&:hover': { bgcolor: '#0f766e', transform: 'scale(1.1)' },
                            transition: 'all 0.2s ease',
                          }}
                        >
                          <PlayIcon sx={{ fontSize: 26 }} />
                        </IconButton>
                      </Box>
                    </Box>

                    <Typography variant="body2" noWrap sx={{ fontWeight: 750, mb: 0.25 }}>{song.title}</Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }} noWrap>
                      {Array.isArray(song.artists)
                        ? song.artists.map((artist) => artist?.name).filter(Boolean).join(', ')
                        : 'Unknown artist'}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Box>
          )}

          {/* SECTION: Dành Riêng Cho Bạn (Artist Mixes) */}
          {(activeCategory === 'all' || activeCategory === 'mixes') && (
            <Box>
              {sectionHeader('Dành Riêng Cho Bạn', 'mixes')}
              <Stack direction="row" spacing={2.25} sx={scrollbarSx}>
                {artistMixCards.map((artist) => (
                  <Box
                    key={`mix-${artist.id}`}
                    onClick={() => navigate(`/client/artists/${artist.id}`)}
                    sx={{
                      borderRadius: 4.5,
                      p: 2,
                      background: (theme) => theme.palette.mode === 'dark'
                        ? 'linear-gradient(135deg, rgba(37, 99, 235, 0.12) 0%, rgba(20, 184, 166, 0.12) 100%)'
                        : 'linear-gradient(135deg, rgba(37, 99, 235, 0.04) 0%, rgba(20, 184, 166, 0.04) 100%)',
                      border: '1px solid',
                      borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                      minWidth: 230,
                      maxWidth: 230,
                      flexShrink: 0,
                      cursor: 'pointer',
                      position: 'relative',
                      overflow: 'hidden',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        inset: 0,
                        background: 'linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.03) 100%)',
                        zIndex: 0,
                      },
                      '&:hover': {
                        transform: 'translateY(-6px)',
                        borderColor: '#14b8a6',
                        boxShadow: (theme) => theme.palette.mode === 'dark'
                          ? '0 12px 28px -8px rgba(37, 99, 235, 0.4), 0 4px 12px rgba(0,0,0,0.4)'
                          : '0 12px 28px -8px rgba(37, 99, 235, 0.15), 0 4px 12px rgba(0,0,0,0.04)',
                      },
                      '&:hover .mix-play': {
                        opacity: 1,
                        transform: 'scale(1)',
                      }
                    }}
                  >
                    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ zIndex: 1, position: 'relative' }}>
                      <Avatar
                        src={artist.avatar}
                        imgProps={{ loading: 'lazy' }}
                        sx={{
                          width: 68,
                          height: 68,
                          border: '2px solid rgba(20, 184, 166, 0.5)',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        }}
                      />
                      <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                        <Typography sx={{ fontWeight: 850, fontSize: 15, mb: 0.25, color: 'text.primary' }}>
                          {artist.name} Mix
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }} noWrap>
                          {artist.subtitle || 'Nhạc dành cho bạn'}
                        </Typography>
                      </Box>
                    </Stack>

                    {/* Hover Mix Play overlay button */}
                    <Box
                      className="mix-play"
                      sx={{
                        position: 'absolute',
                        right: 12,
                        bottom: 12,
                        opacity: 0,
                        transform: 'scale(0.85)',
                        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                        zIndex: 2,
                      }}
                    >
                      <IconButton
                        onClick={(e) => handlePlayArtistMix(e, artist.id)}
                        sx={{
                          bgcolor: '#14b8a6',
                          color: '#fff',
                          boxShadow: '0 4px 10px rgba(20, 184, 166, 0.4)',
                          '&:hover': { bgcolor: '#0f766e' },
                          width: 38,
                          height: 38,
                        }}
                      >
                        <PlayIcon sx={{ fontSize: 24 }} />
                      </IconButton>
                    </Box>
                  </Box>
                ))}
              </Stack>
            </Box>
          )}

          {/* SECTION: Top 100 Charts */}
          {(activeCategory === 'all' || activeCategory === 'top100') && (
            <Box>
              {sectionHeader('Bảng Xếp Hạng Top 100', 'top100')}
              <Stack direction="row" spacing={2.25} sx={scrollbarSx}>
                {top100Cards.map((song, index) => (
                  <Box
                    key={`top-${song._id}`}
                    sx={cardSx}
                    onClick={() => playSong(song, { queue: top100Cards })}
                  >
                    {/* Oversized ranking overlay */}
                    <Typography
                      sx={{
                        position: 'absolute',
                        top: 2,
                        left: 10,
                        fontSize: '3.2rem',
                        fontWeight: 900,
                        lineHeight: 1,
                        color: (theme) => theme.palette.mode === 'dark' ? 'rgba(20, 184, 166, 0.12)' : 'rgba(20, 184, 166, 0.09)',
                        WebkitTextStroke: (theme) => theme.palette.mode === 'dark' ? '1px rgba(20, 184, 166, 0.35)' : '1px rgba(20, 184, 166, 0.2)',
                        fontFamily: '"Outfit", "Inter", sans-serif',
                        pointerEvents: 'none',
                        zIndex: 2,
                      }}
                    >
                      {index + 1}
                    </Typography>

                    <Box sx={{ position: 'relative', borderRadius: 3, overflow: 'hidden', mb: 1.5, aspectRatio: '1/1' }}>
                      <Avatar
                        variant="rounded"
                        src={song.imageUrl && song.imageUrl.trim() !== '' && !song.imageUrl.includes('tgdfbp3zivuqoxqxpltj') ? song.imageUrl : undefined}
                        className="zoom-img"
                        imgProps={{ loading: 'lazy' }}
                        sx={{
                          width: '100%',
                          height: '100%',
                          bgcolor: 'rgba(20, 184, 166, 0.08)',
                          color: '#14b8a6',
                          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                          '& .MuiAvatar-fallback': { display: 'none' }
                        }}
                      >
                        <MusicIcon sx={{ fontSize: 40 }} />
                      </Avatar>

                      {/* Play Overlay */}
                      <Box
                        className="play-overlay-card"
                        sx={{
                          position: 'absolute',
                          inset: 0,
                          bgcolor: 'rgba(0, 0, 0, 0.4)',
                          display: 'grid',
                          placeItems: 'center',
                          opacity: 0,
                          transform: 'scale(0.95)',
                          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                          backdropFilter: 'blur(2px)',
                          zIndex: 3,
                        }}
                      >
                        <IconButton
                          size="medium"
                          sx={{
                            bgcolor: '#14b8a6',
                            color: '#fff',
                            boxShadow: '0 4px 12px rgba(20, 184, 166, 0.4)',
                            '&:hover': { bgcolor: '#0f766e', transform: 'scale(1.1)' },
                            transition: 'all 0.2s ease',
                          }}
                        >
                          <PlayIcon sx={{ fontSize: 26 }} />
                        </IconButton>
                      </Box>
                    </Box>

                    <Typography variant="body2" noWrap sx={{ fontWeight: 750, mb: 0.25 }}>{song.title}</Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }} noWrap>
                      {song.playCount || 0} lượt nghe
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Box>
          )}

          {/* SECTION: Gợi Ý Playlist (Playlist Recommendations) */}
          {(activeCategory === 'all' || activeCategory === 'playlists') && (
            <Box>
              {sectionHeader('Gợi Ý Playlist', 'playlists')}
              <Stack direction="row" spacing={2.25} sx={scrollbarSx}>
                {playlists.slice(0, 8).map((playlist) => (
                  <Box
                    key={`playlist-${playlist._id}`}
                    sx={cardSx}
                    onClick={() => navigate(`/client/collections/${playlist._id}`)}
                  >
                    <Box sx={{ position: 'relative', borderRadius: 3, overflow: 'hidden', mb: 1.5, aspectRatio: '1/1' }}>
                      <Avatar
                        variant="rounded"
                        src={playlist.coverImage && playlist.coverImage.trim() !== '' ? playlist.coverImage : undefined}
                        className="zoom-img"
                        imgProps={{ loading: 'lazy' }}
                        sx={{
                          width: '100%',
                          height: '100%',
                          bgcolor: 'rgba(20, 184, 166, 0.08)',
                          color: '#14b8a6',
                          fontSize: 32,
                          fontWeight: 900,
                          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                          '& .MuiAvatar-fallback': { display: 'none' }
                        }}
                      >
                        {(playlist.name || 'P').charAt(0).toUpperCase()}
                      </Avatar>

                      {/* Play Overlay */}
                      <Box
                        className="play-overlay-card"
                        sx={{
                          position: 'absolute',
                          inset: 0,
                          bgcolor: 'rgba(0, 0, 0, 0.45)',
                          display: 'grid',
                          placeItems: 'center',
                          opacity: 0,
                          transform: 'scale(0.95)',
                          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                          backdropFilter: 'blur(2.5px)',
                        }}
                      >
                        <IconButton
                          size="medium"
                          disabled={playingPlaylistId === playlist._id}
                          onClick={(e) => handlePlayPlaylist(e, playlist)}
                          sx={{
                            bgcolor: '#14b8a6',
                            color: '#fff',
                            boxShadow: '0 4px 12px rgba(20, 184, 166, 0.4)',
                            '&:hover': { bgcolor: '#0f766e', transform: 'scale(1.1)' },
                            transition: 'all 0.2s ease',
                            '&.Mui-disabled': {
                              bgcolor: '#0f766e',
                              color: '#fff',
                            }
                          }}
                        >
                          {playingPlaylistId === playlist._id ? (
                            <CircularProgress size={24} sx={{ color: '#fff' }} />
                          ) : (
                            <PlayIcon sx={{ fontSize: 26 }} />
                          )}
                        </IconButton>
                      </Box>
                    </Box>

                    <Typography variant="body2" noWrap sx={{ fontWeight: 750, mb: 0.25 }}>{playlist.name}</Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }} noWrap>
                      {(playlist.songs || []).length} bài hát
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Box>
          )}

          {/* SECTION: Chill */}
          {(activeCategory === 'all' || activeCategory === 'playlists') && (
            <Box>
              {sectionHeader('Không Gian Thư Giãn (Chill)', 'playlists')}
              <Stack direction="row" spacing={2.25} sx={scrollbarSx}>
                {chillCards.map((playlist) => (
                  <Box
                    key={`chill-${playlist._id}`}
                    sx={cardSx}
                    onClick={() => navigate(`/client/collections/${playlist._id}`)}
                  >
                    <Box sx={{ position: 'relative', borderRadius: 3, overflow: 'hidden', mb: 1.5, aspectRatio: '1/1' }}>
                      <Avatar
                        variant="rounded"
                        src={playlist.coverImage && playlist.coverImage.trim() !== '' ? playlist.coverImage : undefined}
                        className="zoom-img"
                        imgProps={{ loading: 'lazy' }}
                        sx={{
                          width: '100%',
                          height: '100%',
                          bgcolor: 'rgba(20, 184, 166, 0.08)',
                          color: '#14b8a6',
                          fontSize: 32,
                          fontWeight: 900,
                          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                          '& .MuiAvatar-fallback': { display: 'none' }
                        }}
                      >
                        {(playlist.name || 'P').charAt(0).toUpperCase()}
                      </Avatar>

                      {/* Play Overlay */}
                      <Box
                        className="play-overlay-card"
                        sx={{
                          position: 'absolute',
                          inset: 0,
                          bgcolor: 'rgba(0, 0, 0, 0.45)',
                          display: 'grid',
                          placeItems: 'center',
                          opacity: 0,
                          transform: 'scale(0.95)',
                          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                          backdropFilter: 'blur(2.5px)',
                        }}
                      >
                        <IconButton
                          size="medium"
                          disabled={playingPlaylistId === playlist._id}
                          onClick={(e) => handlePlayPlaylist(e, playlist)}
                          sx={{
                            bgcolor: '#14b8a6',
                            color: '#fff',
                            boxShadow: '0 4px 12px rgba(20, 184, 166, 0.4)',
                            '&:hover': { bgcolor: '#0f766e', transform: 'scale(1.1)' },
                            transition: 'all 0.2s ease',
                            '&.Mui-disabled': {
                              bgcolor: '#0f766e',
                              color: '#fff',
                            }
                          }}
                        >
                          {playingPlaylistId === playlist._id ? (
                            <CircularProgress size={24} sx={{ color: '#fff' }} />
                          ) : (
                            <PlayIcon sx={{ fontSize: 26 }} />
                          )}
                        </IconButton>
                      </Box>
                    </Box>

                    <Typography variant="body2" noWrap sx={{ fontWeight: 750, mb: 0.25 }}>{playlist.name}</Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }} noWrap>
                      {(playlist.songs || []).length} bài hát
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Box>
          )}

          {/* Quick Topics Tags at bottom */}
          {topics.length > 0 && activeCategory === 'all' && (
            <Box sx={{ pt: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1.5, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 1 }}>
                Chủ đề phổ biến
              </Typography>
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                {topics.slice(0, 12).map((topic) => (
                  <Chip
                    key={topic._id}
                    label={`# ${topic.name}`}
                    variant="outlined"
                    onClick={() => navigate(`/client/genres?topic=${topic._id}`)}
                    sx={{
                      cursor: 'pointer',
                      borderRadius: 2.25,
                      fontWeight: 600,
                      fontSize: 12,
                      borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)',
                      '&:hover': {
                        borderColor: '#14b8a6',
                        color: '#14b8a6',
                        bgcolor: 'rgba(20, 184, 166, 0.04)',
                      },
                      transition: 'all 0.2s ease',
                    }}
                  />
                ))}
              </Stack>
            </Box>
          )}
        </Stack>
      )}
    </ClientLayout>
  );
}

export default ClientDiscover;
