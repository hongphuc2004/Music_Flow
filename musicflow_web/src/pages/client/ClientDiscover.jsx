import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Stack,
  Typography,
  IconButton,
  Grid,
} from '@mui/material';
import {
  RefreshRounded as RefreshIcon,
  MusicNoteRounded as MusicIcon,
  PlayArrowRounded as PlayIcon,
  AutoAwesomeRounded as SparklesIcon,
  WhatshotRounded as FireIcon,
  LibraryMusicRounded as LibraryMusicIcon,
  ExploreRounded as ExploreIcon,
  RadioRounded as RadioIcon,
  BoltRounded as BoltIcon,
  WavesRounded as WavesIcon,
  CasinoRounded as ShuffleIcon,
} from '@mui/icons-material';
import ClientLayout from '../../components/Layout/client/ClientLayout';
import { clientPlaylistsApi, clientSongsApi, clientTopicsApi } from '../../services/client/client.service';
import { useClientPlayerActions } from '../../components/Layout/client/ClientPlayerProvider';
import ClientSongMoreMenu from '../../components/Layout/client/ClientSongMoreMenu';

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
    return { text: 'Chào buổi sáng', subtitle: 'Khởi động ngày mới với dòng chảy năng lượng!', icon: '☀️' };
  } else if (hour >= 12 && hour < 18) {
    return { text: 'Chào buổi chiều', subtitle: 'Khám phá giai điệu mới nạp đầy cảm hứng!', icon: '🌤️' };
  } else {
    return { text: 'Chào buổi tối', subtitle: 'Thả mình vào không gian giai điệu thư giãn!', icon: '🌙' };
  }
};

function ClientDiscover() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { playSong } = useClientPlayerActions();
  const [songs, setSongs] = useState([]);
  const [suggestedSongs, setSuggestedSongs] = useState([]);
  const [topics, setTopics] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshingSuggestions, setRefreshingSuggestions] = useState(false);
  const [playingPlaylistId, setPlayingPlaylistId] = useState(null);
  const [error, setError] = useState('');

  // Active Radar Lens: 'ai' | 'trending' | 'surprise'
  const [radarLens, setRadarLens] = useState('ai');

  // Active Category Filter
  const viewParam = searchParams.get('view');
  const [activeCategory, setActiveCategory] = useState('all');

  useEffect(() => {
    if (viewParam === 'artists' || viewParam === 'mixes') {
      setActiveCategory('mixes');
    } else if (viewParam === 'playlists') {
      setActiveCategory('playlists');
    } else if (viewParam === 'top100') {
      setActiveCategory('top100');
    } else if (viewParam === 'songs') {
      setActiveCategory('songs');
    } else if (viewParam === 'recent') {
      setActiveCategory('recent');
    } else {
      setActiveCategory('all');
    }
  }, [viewParam]);

  const handleSelectCategory = (catId) => {
    setActiveCategory(catId);
    if (catId === 'all') {
      setSearchParams({});
    } else if (catId === 'mixes') {
      setSearchParams({ view: 'artists' });
    } else {
      setSearchParams({ view: catId });
    }
  };

  const greeting = useMemo(() => getPersonalizedGreeting(), []);

  const categories = useMemo(() => [
    { id: 'all', label: '✨ Ma Trận Khám Phá' },
    { id: 'songs', label: '🎧 Tín Hiệu Gợi Ý' },
    { id: 'recent', label: '🕒 Nghe Gần Đây' },
    { id: 'mixes', label: '🪐 Hành Tinh Nghệ Sĩ' },
    { id: 'top100', label: '🏆 Radar Top Hits' },
    { id: 'playlists', label: '📻 Bento Playlists' },
  ], []);

  const fetchRecommendedSongs = useCallback(async ({ forceFresh = false } = {}) => {
    const params = {
      limit: 24,
      ...(forceFresh ? { refresh: true } : {}),
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
      setSuggestedSongs(nextSongs.slice(0, 6));
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
      setSuggestedSongs(nextSongs.slice(0, 6));
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể làm mới gợi ý bài hát.');
    } finally {
      setRefreshingSuggestions(false);
    }
  };

  const handleSurpriseMe = () => {
    if (songs.length > 0) {
      const randomIndex = Math.floor(Math.random() * songs.length);
      playSong(songs[randomIndex], { queue: songs });
    }
  };

  const recentSongs = useMemo(() => readRecentPlayedSongs().slice(0, 6), []);
  const recentQueue = recentSongs.length > 0 ? recentSongs : songs.slice(0, 6);

  const top100Cards = useMemo(() => {
    return [...songs]
      .sort((a, b) => (b.playCount || 0) - (a.playCount || 0))
      .slice(0, 6);
  }, [songs]);

  const featuredPlaylist = useMemo(() => playlists[0] || null, [playlists]);
  const subPlaylists = useMemo(() => playlists.slice(1, 5), [playlists]);

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
    return [...artistMap.values()].slice(0, 6);
  }, [songs]);

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

  const handlePlayArtistMix = (e, artistId) => {
    e.stopPropagation();
    const artistSongs = songs.filter((song) =>
      Array.isArray(song.artists) && song.artists.some((a) => a?._id === artistId)
    );
    if (artistSongs.length > 0) {
      playSong(artistSongs[0], { queue: artistSongs });
    }
  };

  const spotlightSong = top100Cards[0] || songs[0] || null;

  return (
    <ClientLayout title="Khám phá">
      {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 3 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
          <CircularProgress size={40} sx={{ color: '#6c63ff' }} />
        </Box>
      ) : (
        <Stack spacing={4} sx={{ width: '100%', pb: 5 }}>

          {/* ── 0. GREETING & RADAR NAVIGATION BAR ── */}
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={2}>
            <Box>
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 950,
                  letterSpacing: '-0.04em',
                  lineHeight: 1.15,
                  fontSize: { xs: '1.6rem', sm: '2rem' },
                  background: 'linear-gradient(135deg, #ffffff 20%, #a5b4fc 60%, #00e5ff 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                {greeting.text} {greeting.icon}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 550, mt: 0.25 }}>
                {greeting.subtitle}
              </Typography>
            </Box>

            {/* Quick Categories Filter Pills */}
            <Stack
              direction="row"
              spacing={1}
              sx={{
                overflowX: 'auto',
                scrollbarWidth: 'none',
                '&::-webkit-scrollbar': { display: 'none' },
                maxWidth: '100%',
              }}
            >
              {categories.map((cat) => {
                const isTabActive = activeCategory === cat.id;
                return (
                  <Box
                    key={cat.id}
                    onClick={() => handleSelectCategory(cat.id)}
                    sx={{
                      px: 2,
                      py: 0.75,
                      borderRadius: '9999px',
                      cursor: 'pointer',
                      fontSize: 12.5,
                      fontWeight: isTabActive ? 850 : 600,
                      whiteSpace: 'nowrap',
                      bgcolor: isTabActive ? '#6c63ff' : (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                      color: isTabActive ? '#fff' : 'text.secondary',
                      border: '1px solid',
                      borderColor: isTabActive ? '#8c85ff' : 'rgba(255,255,255,0.08)',
                      boxShadow: isTabActive ? '0 4px 16px rgba(108, 99, 255, 0.45)' : 'none',
                      transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                      '&:hover': {
                        bgcolor: isTabActive ? '#5246e2' : (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.07)',
                        transform: 'translateY(-1.5px)',
                      },
                    }}
                  >
                    {cat.label}
                  </Box>
                );
              })}
            </Stack>
          </Stack>

          {/* ── 1. 🎛️ BỐ CỤC ĐỘT PHÁ: DISCOVERY RADAR COMMAND CENTER ── */}
          <Grid container spacing={3} alignItems="stretch">
            {/* Cột Trái (7/12): Lăng Kính Khám Phá Đa Chiều (Multiverse Lens Interactive Hub) */}
            <Grid size={{ xs: 12, lg: 7.5 }}>
              <Box
                sx={{
                  height: '100%',
                  minHeight: 330,
                  p: { xs: 3, sm: 4 },
                  borderRadius: '28px',
                  background: (theme) => theme.palette.mode === 'dark'
                    ? 'linear-gradient(135deg, rgba(16, 22, 44, 0.9) 0%, rgba(8, 12, 26, 0.96) 100%)'
                    : 'linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%)',
                  border: '1px solid rgba(165, 180, 252, 0.18)',
                  backdropFilter: 'blur(24px)',
                  boxShadow: '0 24px 60px rgba(0, 0, 0, 0.5), inset 0 1px 1.5px rgba(255, 255, 255, 0.2)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Background Nebula Glow */}
                <Box
                  sx={{
                    position: 'absolute',
                    top: '-30%',
                    right: '-10%',
                    width: 320,
                    height: 320,
                    borderRadius: '50%',
                    background: radarLens === 'ai' ? 'rgba(99, 102, 241, 0.35)' : radarLens === 'trending' ? 'rgba(236, 72, 153, 0.35)' : 'rgba(6, 182, 212, 0.35)',
                    filter: 'blur(60px)',
                    zIndex: 0,
                    transition: 'all 0.5s ease',
                  }}
                />

                {/* Top Lens Selector Tabs */}
                <Box sx={{ position: 'relative', zIndex: 1 }}>
                  <Stack direction="row" spacing={1.5} sx={{ mb: 2.5, flexWrap: 'wrap', gap: 1 }}>
                    {[
                      { id: 'ai', label: '🔮 Lăng Kính AI Cảm Xúc', color: '#6366f1' },
                      { id: 'trending', label: '🔥 Radar Thịnh Hành', color: '#ec4899' },
                      { id: 'surprise', label: '🎲 Giai Điệu Bất Ngờ', color: '#06b6d4' },
                    ].map((lens) => {
                      const isLensActive = radarLens === lens.id;
                      return (
                        <Button
                          key={lens.id}
                          size="small"
                          onClick={() => setRadarLens(lens.id)}
                          sx={{
                            borderRadius: '9999px',
                            px: 2.25,
                            py: 0.65,
                            fontSize: 12.5,
                            fontWeight: 800,
                            textTransform: 'none',
                            bgcolor: isLensActive ? lens.color : 'rgba(255, 255, 255, 0.06)',
                            color: '#fff',
                            border: '1px solid',
                            borderColor: isLensActive ? 'rgba(255,255,255,0.4)' : 'rgba(255, 255, 255, 0.1)',
                            boxShadow: isLensActive ? `0 4px 18px ${lens.color}66` : 'none',
                            '&:hover': {
                              bgcolor: isLensActive ? lens.color : 'rgba(255, 255, 255, 0.12)',
                              transform: 'scale(1.03)',
                            },
                            transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                          }}
                        >
                          {lens.label}
                        </Button>
                      );
                    })}
                  </Stack>

                  {/* Dynamic Content Per Lens */}
                  {radarLens === 'ai' && (
                    <Box>
                      <Typography variant="h4" sx={{ fontWeight: 950, letterSpacing: '-0.03em', mb: 1, fontSize: { xs: '1.4rem', sm: '1.85rem' } }}>
                        AI DJ Mood Generator
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 520, fontWeight: 550, mb: 2.5 }}>
                        Trí tuệ nhân tạo Gemini phân tích cảm xúc và sở thích để tạo ra danh sách phát độc bản cho từng khoảnh khắc của bạn.
                      </Typography>
                      <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap', gap: 1 }}>
                        {[
                          { mood: 'chill', label: 'Cosmic Chill', icon: <WavesIcon /> },
                          { mood: 'hyper', label: 'Hyper Energy', icon: <BoltIcon /> },
                          { mood: 'party', label: 'Neon Party', icon: <FireIcon /> },
                        ].map((m) => (
                          <Button
                            key={m.mood}
                            variant="outlined"
                            startIcon={m.icon}
                            onClick={() => navigate(`/ai-mood?mood=${m.mood}`)}
                            sx={{
                              borderColor: 'rgba(255, 255, 255, 0.18)',
                              bgcolor: 'rgba(255, 255, 255, 0.05)',
                              color: '#fff',
                              borderRadius: '9999px',
                              px: 2.5,
                              py: 0.8,
                              fontSize: 13,
                              fontWeight: 750,
                              textTransform: 'none',
                              '&:hover': { borderColor: '#8c85ff', bgcolor: 'rgba(108, 99, 255, 0.2)', transform: 'scale(1.04)' },
                              transition: 'all 0.2s ease',
                            }}
                          >
                            {m.label}
                          </Button>
                        ))}
                      </Stack>
                    </Box>
                  )}

                  {radarLens === 'trending' && (
                    <Box>
                      <Typography variant="h4" sx={{ fontWeight: 950, letterSpacing: '-0.03em', mb: 1, fontSize: { xs: '1.4rem', sm: '1.85rem' } }}>
                        Radar Xu Hướng Toàn Cầu
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 520, fontWeight: 550, mb: 2.5 }}>
                        Theo dõi thời gian thực những bài hát đang được cộng đồng nghe nhiều nhất và tăng trưởng đột biến.
                      </Typography>
                      <Button
                        variant="contained"
                        onClick={() => navigate('/rankings')}
                        startIcon={<FireIcon sx={{ fontSize: 20 }} />}
                        sx={{
                          background: 'linear-gradient(135deg, #ec4899, #f43f5e)',
                          color: '#fff',
                          fontWeight: 900,
                          borderRadius: '9999px',
                          px: 3.5,
                          py: 1,
                          fontSize: 13.5,
                          boxShadow: '0 6px 20px rgba(236, 72, 153, 0.45)',
                          '&:hover': { transform: 'scale(1.04)' },
                        }}
                      >
                        Khám Phá Bảng Xếp Hạng Top 100
                      </Button>
                    </Box>
                  )}

                  {radarLens === 'surprise' && (
                    <Box>
                      <Typography variant="h4" sx={{ fontWeight: 950, letterSpacing: '-0.03em', mb: 1, fontSize: { xs: '1.4rem', sm: '1.85rem' } }}>
                        Vòng Xoay Giai Điệu Ngẫu Hứng
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 520, fontWeight: 550, mb: 2.5 }}>
                        Không biết nên nghe gì? Hãy để MusicFlow bất ngờ đưa bạn đến với một giai điệu hoàn toàn mới lạ.
                      </Typography>
                      <Button
                        variant="contained"
                        onClick={handleSurpriseMe}
                        startIcon={<ShuffleIcon sx={{ fontSize: 20 }} />}
                        sx={{
                          background: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
                          color: '#fff',
                          fontWeight: 900,
                          borderRadius: '9999px',
                          px: 3.5,
                          py: 1,
                          fontSize: 13.5,
                          boxShadow: '0 6px 20px rgba(6, 182, 212, 0.45)',
                          '&:hover': { transform: 'scale(1.04)' },
                        }}
                      >
                        Phát Ca Khúc Bất Ngờ
                      </Button>
                    </Box>
                  )}
                </Box>

                {/* Bottom Status Ticker */}
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ pt: 3, borderTop: '1px solid rgba(255,255,255,0.08)', position: 'relative', zIndex: 1 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#00e5ff', boxShadow: '0 0 10px #00e5ff' }} />
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 650 }}>
                      Radar đang quét {songs.length} tín hiệu âm thanh
                    </Typography>
                  </Stack>
                  <Button size="small" onClick={loadData} startIcon={<RefreshIcon sx={{ fontSize: 16 }} />} sx={{ color: '#8c85ff', fontWeight: 750, textTransform: 'none' }}>
                    Quét Lại Radar
                  </Button>
                </Stack>
              </Box>
            </Grid>

            {/* Cột Phải (4.5/12): Spotlight Hologram Card (Tâm Điểm Hotspot) */}
            <Grid size={{ xs: 12, lg: 4.5 }}>
              <Box
                sx={{
                  height: '100%',
                  minHeight: 330,
                  p: 3,
                  borderRadius: '28px',
                  background: 'linear-gradient(135deg, rgba(30, 24, 60, 0.85) 0%, rgba(12, 10, 30, 0.95) 100%)',
                  border: '1px solid rgba(236, 72, 153, 0.25)',
                  boxShadow: '0 24px 60px rgba(0, 0, 0, 0.6), 0 0 30px rgba(236, 72, 153, 0.15)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Background Ambient Glow */}
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    backgroundImage: spotlightSong?.imageUrl ? `url(${spotlightSong.imageUrl})` : 'none',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    filter: 'blur(60px) saturate(2)',
                    opacity: 0.3,
                    zIndex: 0,
                    pointerEvents: 'none',
                  }}
                />

                <Box sx={{ position: 'relative', zIndex: 1 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                    <Box sx={{ px: 1.75, py: 0.4, borderRadius: '9999px', bgcolor: 'rgba(236, 72, 153, 0.2)', border: '1px solid rgba(236, 72, 153, 0.4)' }}>
                      <Typography sx={{ fontSize: 11, fontWeight: 900, textTransform: 'uppercase', color: '#f472b6', letterSpacing: 1 }}>
                        🔥 TÂM ĐIỂM SPOTLIGHT
                      </Typography>
                    </Box>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', fontWeight: 700 }}>
                      #01 Thịnh Hành
                    </Typography>
                  </Stack>

                  {/* Artwork & Rotating Mini Vinyl */}
                  <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
                    <Box sx={{ position: 'relative', width: 140, height: 140 }}>
                      <Box
                        className="animate-vinyl-spin"
                        sx={{
                          width: 140,
                          height: 140,
                          borderRadius: '50%',
                          background: 'radial-gradient(circle, #05070e 20%, #1e2640 21%, #0b0f1d 40%, #2a3558 41%, #05070e 65%, #3b4876 66%, #05070e 100%)',
                          border: '2px solid rgba(255, 255, 255, 0.25)',
                          boxShadow: '0 12px 30px rgba(0, 0, 0, 0.8), 0 0 25px rgba(236, 72, 153, 0.4)',
                          display: 'grid',
                          placeItems: 'center',
                        }}
                      >
                        <Avatar
                          src={spotlightSong?.imageUrl}
                          sx={{
                            width: 60,
                            height: 60,
                            borderRadius: '50%',
                            border: '2px solid #05070e',
                          }}
                        />
                      </Box>
                    </Box>
                  </Box>

                  <Typography variant="h5" sx={{ fontWeight: 900, textAlign: 'center', mb: 0.25 }} noWrap>
                    {spotlightSong?.title || 'Khám Phá Âm Nhạc'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', fontWeight: 600 }} noWrap>
                    {Array.isArray(spotlightSong?.artists) ? spotlightSong.artists.map(a => a?.name).filter(Boolean).join(', ') : (spotlightSong?.artistText || 'Nhiều nghệ sĩ')}
                  </Typography>
                </Box>

                <Box sx={{ position: 'relative', zIndex: 1, pt: 2 }}>
                  <Button
                    fullWidth
                    variant="contained"
                    onClick={() => spotlightSong && playSong(spotlightSong, { queue: songs })}
                    startIcon={<PlayIcon sx={{ fontSize: 24 }} />}
                    sx={{
                      background: 'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)',
                      color: '#fff',
                      fontWeight: 900,
                      borderRadius: '9999px',
                      py: 1.2,
                      fontSize: 14,
                      textTransform: 'uppercase',
                      boxShadow: '0 8px 24px rgba(236, 72, 153, 0.5)',
                      '&:hover': { transform: 'scale(1.02)' },
                    }}
                  >
                    Phát Ngay Bây Giờ
                  </Button>
                </Box>
              </Box>
            </Grid>
          </Grid>

          {/* ── 2. ⚡ MA TRẬN 2 LUỒNG ÂM NHẠC: GỢI Ý & TOP RADAR ── */}
          <Grid container spacing={3}>
            {/* Luồng 1 (6/12): Gợi Ý Cá Nhân Hóa (Personalized Pulse Stream) */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Box
                sx={{
                  p: { xs: 2.5, sm: 3 },
                  borderRadius: '24px',
                  bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(16, 22, 40, 0.6)' : '#ffffff',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  backdropFilter: 'blur(16px)',
                  height: '100%',
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                  <Stack direction="row" spacing={1.25} alignItems="center">
                    <SparklesIcon sx={{ color: '#00e5ff', fontSize: 22 }} />
                    <Typography sx={{ fontWeight: 900, fontSize: 18, letterSpacing: '-0.02em' }}>
                      Tín Hiệu Gợi Ý Cá Nhân
                    </Typography>
                  </Stack>
                  <Button
                    size="small"
                    onClick={refreshSuggestedSongsOnly}
                    disabled={refreshingSuggestions}
                    startIcon={<RefreshIcon sx={{ fontSize: 16 }} />}
                    sx={{ color: '#00e5ff', fontWeight: 800, textTransform: 'none' }}
                  >
                    Đổi bài
                  </Button>
                </Stack>

                <Stack spacing={1.25}>
                  {suggestedSongs.map((song) => (
                    <Stack
                      key={`stream-suggest-${song._id}`}
                      direction="row"
                      spacing={1.5}
                      alignItems="center"
                      onClick={() => playSong(song, { queue: suggestedSongs })}
                      sx={{
                        p: 1.15,
                        borderRadius: '16px',
                        bgcolor: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        cursor: 'pointer',
                        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                        '&:hover': {
                          bgcolor: 'rgba(0, 229, 255, 0.08)',
                          borderColor: 'rgba(0, 229, 255, 0.4)',
                          transform: 'translateX(4px)',
                        },
                      }}
                    >
                      <Avatar
                        src={song.imageUrl}
                        variant="rounded"
                        sx={{ width: 44, height: 44, borderRadius: '10px' }}
                      />
                      <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 800 }} noWrap>
                          {song.title}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }} noWrap display="block">
                          {Array.isArray(song.artists) ? song.artists.map(a => a?.name).filter(Boolean).join(', ') : (song.artistText || 'Nhiều nghệ sĩ')}
                        </Typography>
                      </Box>
                      <ClientSongMoreMenu song={song} />
                    </Stack>
                  ))}
                </Stack>
              </Box>
            </Grid>

            {/* Luồng 2 (6/12): Top 6 Radar Hits Thịnh Hành */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Box
                sx={{
                  p: { xs: 2.5, sm: 3 },
                  borderRadius: '24px',
                  bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(16, 22, 40, 0.6)' : '#ffffff',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  backdropFilter: 'blur(16px)',
                  height: '100%',
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                  <Stack direction="row" spacing={1.25} alignItems="center">
                    <FireIcon sx={{ color: '#f59e0b', fontSize: 22 }} />
                    <Typography sx={{ fontWeight: 900, fontSize: 18, letterSpacing: '-0.02em' }}>
                      Radar Top Hits Tuần Này
                    </Typography>
                  </Stack>
                  <Button
                    size="small"
                    onClick={() => navigate('/rankings')}
                    sx={{ color: '#f59e0b', fontWeight: 800, textTransform: 'none' }}
                  >
                    Xem BXH
                  </Button>
                </Stack>

                <Stack spacing={1.25}>
                  {top100Cards.map((song, index) => (
                    <Stack
                      key={`stream-top-${song._id}`}
                      direction="row"
                      spacing={1.5}
                      alignItems="center"
                      onClick={() => playSong(song, { queue: top100Cards })}
                      sx={{
                        p: 1.15,
                        borderRadius: '16px',
                        bgcolor: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        cursor: 'pointer',
                        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                        '&:hover': {
                          bgcolor: 'rgba(245, 158, 11, 0.08)',
                          borderColor: 'rgba(245, 158, 11, 0.4)',
                          transform: 'translateX(4px)',
                        },
                      }}
                    >
                      <Typography sx={{ fontWeight: 950, fontSize: 14, width: 22, color: index === 0 ? '#f59e0b' : index === 1 ? '#94a3b8' : index === 2 ? '#f97316' : 'text.secondary' }}>
                        0{index + 1}
                      </Typography>
                      <Avatar
                        src={song.imageUrl}
                        variant="rounded"
                        sx={{ width: 44, height: 44, borderRadius: '10px' }}
                      />
                      <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 800 }} noWrap>
                          {song.title}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }} noWrap display="block">
                          {song.playCount || 0} lượt nghe
                        </Typography>
                      </Box>
                      <ClientSongMoreMenu song={song} />
                    </Stack>
                  ))}
                </Stack>
              </Box>
            </Grid>
          </Grid>

          {/* ── 3. 🪐 HÀNH TINH NGHỆ SĨ & ARTIST MIXES ── */}
          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Stack direction="row" spacing={1.25} alignItems="center">
                <RadioIcon sx={{ color: '#6366f1', fontSize: 24 }} />
                <Typography sx={{ fontWeight: 900, fontSize: 22, letterSpacing: '-0.02em' }}>
                  Hành Tinh Nghệ Sĩ & Mixes Độc Quyền
                </Typography>
              </Stack>
            </Stack>

            <Grid container spacing={2}>
              {artistMixCards.map((artist) => (
                <Grid size={{ xs: 6, sm: 4, md: 2 }} key={`planet-${artist.id}`}>
                  <Box
                    onClick={() => navigate(`/artists/${artist.id}`)}
                    sx={{
                      p: 2,
                      borderRadius: '24px',
                      bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(16, 22, 40, 0.55)' : '#ffffff',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      textAlign: 'center',
                      cursor: 'pointer',
                      position: 'relative',
                      transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                      '&:hover': {
                        transform: 'translateY(-5px)',
                        borderColor: '#6366f1',
                        boxShadow: '0 12px 30px -8px rgba(99, 102, 241, 0.45)',
                      },
                      '&:hover .artist-avatar': {
                        transform: 'scale(1.08)',
                      },
                      '&:hover .artist-play-btn': {
                        opacity: 1,
                        transform: 'scale(1)',
                      }
                    }}
                  >
                    <Box sx={{ position: 'relative', width: 80, height: 80, mx: 'auto', mb: 1.5 }}>
                      <Avatar
                        src={artist.avatar}
                        className="artist-avatar"
                        sx={{
                          width: 80,
                          height: 80,
                          borderRadius: '50%',
                          border: '2px solid rgba(99, 102, 241, 0.5)',
                          boxShadow: '0 8px 20px rgba(0,0,0,0.4)',
                          transition: 'transform 0.3s ease',
                        }}
                      />
                      <IconButton
                        className="artist-play-btn"
                        onClick={(e) => handlePlayArtistMix(e, artist.id)}
                        sx={{
                          position: 'absolute',
                          right: -4,
                          bottom: -4,
                          width: 32,
                          height: 32,
                          bgcolor: '#6366f1',
                          color: '#fff',
                          opacity: 0,
                          transform: 'scale(0.8)',
                          transition: 'all 0.2s ease',
                          boxShadow: '0 4px 10px rgba(99, 102, 241, 0.5)',
                          '&:hover': { bgcolor: '#4f46e5' },
                        }}
                      >
                        <PlayIcon sx={{ fontSize: 18, ml: 0.2 }} />
                      </IconButton>
                    </Box>
                    <Typography variant="body2" sx={{ fontWeight: 850, mb: 0.25 }} noWrap>
                      {artist.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }} noWrap display="block">
                      Mix Dành Cho Bạn
                    </Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Box>

          {/* ── 3.5. 🕒 DẤU CHÂN ÂM NHẠC GẦN ĐÂY (NẾU CÓ DỮ LIỆU) ── */}
          {(activeCategory === 'all' || activeCategory === 'recent') && recentQueue.length > 0 && (
            <Box>
              <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 2 }}>
                <MusicIcon sx={{ color: '#ec4899', fontSize: 24 }} />
                <Typography sx={{ fontWeight: 900, fontSize: 22, letterSpacing: '-0.02em' }}>
                  Dấu Chân Âm Nhạc Vừa Nghe
                </Typography>
              </Stack>
              <Grid container spacing={2}>
                {recentQueue.map((song) => (
                  <Grid size={{ xs: 6, sm: 4, md: 2 }} key={`recent-feed-${song._id}`}>
                    <Box
                      onClick={() => playSong(song, { queue: recentQueue })}
                      sx={{
                        p: 1.25,
                        borderRadius: '20px',
                        bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(16, 22, 40, 0.55)' : '#ffffff',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        cursor: 'pointer',
                        transition: 'all 0.25s ease',
                        '&:hover': {
                          borderColor: '#ec4899',
                          transform: 'translateY(-4px)',
                          boxShadow: '0 10px 24px -5px rgba(236, 72, 153, 0.35)',
                        },
                      }}
                    >
                      <Avatar
                        src={song.imageUrl}
                        variant="rounded"
                        sx={{ width: '100%', aspectRatio: '1/1', height: 'auto', borderRadius: '14px', mb: 1 }}
                      />
                      <Typography variant="body2" sx={{ fontWeight: 800 }} noWrap>
                        {song.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }} noWrap display="block">
                        {Array.isArray(song.artists) ? song.artists.map(a => a?.name).filter(Boolean).join(', ') : (song.artistText || 'Nhiều nghệ sĩ')}
                      </Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}

          {/* ── 4. 📻 BENTO MOSAIC PLAYLIST SHOWCASE (BẤT ĐỐI XỨNG NGHỆ THUẬT) ── */}
          {featuredPlaylist && (
            <Box>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Stack direction="row" spacing={1.25} alignItems="center">
                  <LibraryMusicIcon sx={{ color: '#06b6d4', fontSize: 24 }} />
                  <Typography sx={{ fontWeight: 900, fontSize: 22, letterSpacing: '-0.02em' }}>
                    Bento Mosaic Playlists
                  </Typography>
                </Stack>
              </Stack>

              <Grid container spacing={2.5}>
                {/* 1 Hero Featured Bento Card Lớn (5/12) */}
                <Grid size={{ xs: 12, md: 5 }}>
                  <Box
                    onClick={() => navigate(`/collections/${featuredPlaylist._id}`)}
                    sx={{
                      height: '100%',
                      minHeight: 280,
                      p: 3.5,
                      borderRadius: '28px',
                      background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.2) 0%, rgba(99, 102, 241, 0.25) 100%)',
                      border: '1px solid rgba(6, 182, 212, 0.35)',
                      boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      position: 'relative',
                      overflow: 'hidden',
                      transition: 'all 0.25s ease',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: '0 24px 60px rgba(6, 182, 212, 0.35)',
                      }
                    }}
                  >
                    <Box>
                      <Box sx={{ display: 'inline-block', px: 1.5, py: 0.35, borderRadius: '9999px', bgcolor: 'rgba(6, 182, 212, 0.25)', border: '1px solid rgba(6, 182, 212, 0.5)', mb: 2 }}>
                        <Typography sx={{ fontSize: 11, fontWeight: 900, color: '#00e5ff' }}>
                          📻 PLAYLIST ĐẶC TUYỂN
                        </Typography>
                      </Box>
                      <Typography variant="h4" sx={{ fontWeight: 950, letterSpacing: '-0.03em', mb: 1, lineHeight: 1.2 }}>
                        {featuredPlaylist.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                        Tuyển tập {featuredPlaylist.songCount || 0} giai điệu chất lượng cao được tuyển chọn.
                      </Typography>
                    </Box>

                    <Button
                      variant="contained"
                      onClick={(e) => handlePlayPlaylist(e, featuredPlaylist)}
                      startIcon={playingPlaylistId === featuredPlaylist._id ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : <PlayIcon />}
                      sx={{
                        background: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
                        color: '#fff',
                        fontWeight: 900,
                        borderRadius: '9999px',
                        py: 1,
                        width: 'fit-content',
                        px: 3,
                      }}
                    >
                      Phát Toàn Bộ
                    </Button>
                  </Box>
                </Grid>

                {/* 4 Sub-Playlists Bento (7/12) */}
                <Grid size={{ xs: 12, md: 7 }}>
                  <Grid container spacing={2}>
                    {subPlaylists.map((pl) => (
                      <Grid size={{ xs: 6, sm: 6 }} key={`bento-${pl._id}`}>
                        <Stack
                          direction="row"
                          spacing={1.5}
                          alignItems="center"
                          onClick={() => navigate(`/collections/${pl._id}`)}
                          sx={{
                            p: 1.5,
                            borderRadius: '20px',
                            bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(16, 22, 40, 0.55)' : '#ffffff',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            '&:hover': {
                              borderColor: '#06b6d4',
                              transform: 'translateX(4px)',
                              bgcolor: 'rgba(6, 182, 212, 0.08)',
                            }
                          }}
                        >
                          <Avatar
                            src={pl.coverImage}
                            variant="rounded"
                            sx={{ width: 56, height: 56, borderRadius: '12px', bgcolor: 'rgba(6, 182, 212, 0.2)' }}
                          >
                            <LibraryMusicIcon sx={{ color: '#06b6d4' }} />
                          </Avatar>
                          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                            <Typography variant="body2" sx={{ fontWeight: 850 }} noWrap>
                              {pl.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }} display="block" noWrap>
                              {pl.songCount || 0} bài hát
                            </Typography>
                          </Box>
                          <IconButton
                            size="small"
                            onClick={(e) => handlePlayPlaylist(e, pl)}
                            sx={{ color: '#06b6d4', bgcolor: 'rgba(6, 182, 212, 0.15)', '&:hover': { bgcolor: '#06b6d4', color: '#fff' } }}
                          >
                            <PlayIcon sx={{ fontSize: 20 }} />
                          </IconButton>
                        </Stack>
                      </Grid>
                    ))}
                  </Grid>
                </Grid>
              </Grid>
            </Box>
          )}

          {/* ── 5. 🪐 BẢN ĐỒ CHỦ ĐỀ & TAG VŨ TRỤ ── */}
          {topics.length > 0 && activeCategory === 'all' && (
            <Box
              sx={{
                p: { xs: 2.5, sm: 3.5 },
                borderRadius: '24px',
                bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(16, 22, 40, 0.5)' : '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                backdropFilter: 'blur(16px)',
              }}
            >
              <Typography
                variant="subtitle2"
                sx={{
                  fontWeight: 900,
                  mb: 2,
                  color: 'text.secondary',
                  textTransform: 'uppercase',
                  letterSpacing: 1.5,
                  fontSize: 12,
                }}
              >
                🪐 Bản Đồ Chủ Đề & Xu Hướng
              </Typography>
              <Stack direction="row" spacing={1.25} useFlexGap flexWrap="wrap">
                {topics.slice(0, 18).map((topic) => (
                  <Box
                    key={topic._id}
                    onClick={() => navigate(`/genres?topic=${topic._id}`)}
                    sx={{
                      cursor: 'pointer',
                      px: 2,
                      py: 0.8,
                      borderRadius: '9999px',
                      fontSize: 12.5,
                      fontWeight: 700,
                      bgcolor: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: 'text.primary',
                      transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                      '&:hover': {
                        borderColor: '#00e5ff',
                        color: '#00e5ff',
                        bgcolor: 'rgba(0, 229, 255, 0.1)',
                        transform: 'translateY(-2px)',
                        boxShadow: '0 4px 14px rgba(0, 229, 255, 0.25)',
                      },
                    }}
                  >
                    # {topic.name}
                  </Box>
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
