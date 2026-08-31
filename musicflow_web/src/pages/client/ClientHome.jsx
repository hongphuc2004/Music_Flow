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
  Tooltip,
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
  QueueMusic as QueueMusicIcon,
  FavoriteRounded as FavoriteIcon,
  FavoriteBorderRounded as FavoriteBorderIcon,
  DownloadRounded as DownloadIcon,
  ShareRounded as ShareIcon,
  BoltRounded as BoltIcon,
  WavesRounded as WavesIcon,
  NightlightRounded as MoonIcon,
  LocalFireDepartmentRounded as FireIcon,
  WaterDropRounded as WaterIcon,
  EmojiEventsRounded as TrophyIcon,
  MicRounded as MicIcon,
  RadioRounded as RadioIcon,
} from '@mui/icons-material';
import ClientLayout from '../../components/Layout/client/ClientLayout';
import { clientArtistApi, clientPlaylistsApi, clientSongsApi, clientFavoritesApi } from '../../services/client/client.service';
import ClientQueueDrawer from '../../components/Layout/client/ClientQueueDrawer';
import { useClientPlayer } from '../../components/Layout/client/ClientPlayerProvider';
import ClientSongMoreMenu from '../../components/Layout/client/ClientSongMoreMenu';
import useAppToast from '../../components/common/useAppToast';
import useClientSession from '../../hooks/useClientSession';
import { scheduleIdleTask } from '../../utils/scheduleIdleTask';
import ClientSongItem from '../../components/Layout/client/ClientSongItem';
import ClientPlaylistCard from '../../components/Layout/client/ClientPlaylistCard';
import PlayingEqualizer from '../../components/Layout/client/ClientPlayingEqualizer';
import { getOptimizedImageUrl } from '../../utils/imageUtil';
import ShareSongModal from '../../components/common/ShareSongModal';



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


function ClientHome() {
  const { isLoggedIn } = useClientSession();
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
    lyricsLoading,
    handleNext,
    handlePrevious,
  } = useClientPlayer();
  const [songs, setSongs] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [queueOpen, setQueueOpen] = useState(false);
  const { showToast } = useAppToast();
  const [followedArtists, setFollowedArtists] = useState({});
  const [artistFollowersState, setArtistFollowersState] = useState({});
  const [isArtistsExpanded, setIsArtistsExpanded] = useState(false);
  const [isPlaylistsExpanded, setIsPlaylistsExpanded] = useState(false);
  const [displayedSongCount, setDisplayedSongCount] = useState(8);
  const [loadingMoreSongs, setLoadingMoreSongs] = useState(false);
  const [scrubTime, setScrubTime] = useState(null);
  const lyricItemRefs = useRef([]);
  const lyricsContainerRef = useRef(null);

  const displayDuration = (Number.isFinite(duration) && duration > 0) ? duration : (currentSong?.duration || 0);

  const formatDuration = (seconds) => {
    const safeSeconds = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
    const mins = Math.floor(safeSeconds / 60);
    const secs = safeSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError('');

        const [songsRes, playlistsRes] = await Promise.all([
          clientSongsApi.getRecommended({ limit: 24 }),
          clientPlaylistsApi.getSystem({ limit: 16 }),
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

  const topSongs = useMemo(
    () => [...songs].sort((a, b) => (b.playCount || 0) - (a.playCount || 0)).slice(0, 6),
    [songs],
  );
  const spotlightSong = useMemo(() => songs[0] || null, [songs]);
  const quickListenSongs = useMemo(() => songs.slice(0, 6), [songs]);
  const recommendedSongs = useMemo(() => songs.slice(0, displayedSongCount), [songs, displayedSongCount]);
  const activeHeroSong = currentSong || spotlightSong;
  const [favorite, setFavorite] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    let ignore = false;
    const checkFavorite = async () => {
      if (!activeHeroSong?._id || !isLoggedIn) {
        setFavorite(false);
        return;
      }
      try {
        const response = await clientFavoritesApi.check(activeHeroSong._id);
        if (!ignore) {
          setFavorite(Boolean(response.data?.isFavorite));
        }
      } catch {
        if (!ignore) setFavorite(false);
      }
    };
    checkFavorite();
    return () => { ignore = true; };
  }, [activeHeroSong?._id, isLoggedIn]);

  const handleToggleFavoriteHero = async () => {
    if (!activeHeroSong?._id) return;
    if (!isLoggedIn) {
      showToast({ severity: 'info', title: 'Cần đăng nhập', message: 'Vui lòng đăng nhập để lưu bài hát yêu thích.' });
      navigate('/?auth=login');
      return;
    }
    try {
      const response = await clientFavoritesApi.toggle(activeHeroSong._id);
      const next = response.data?.isFavorite ?? !favorite;
      setFavorite(next);
      showToast({
        severity: 'success',
        title: 'Thành công',
        message: next ? 'Đã thêm bài hát vào danh sách yêu thích.' : 'Đã bỏ bài hát khỏi danh sách yêu thích.',
      });
    } catch (error) {
      showToast({ severity: 'error', title: 'Lỗi', message: error.response?.data?.message || 'Không thể cập nhật yêu thích.' });
    }
  };

  const handleDownloadHero = async () => {
    if (!activeHeroSong?._id) return;
    if (!isLoggedIn) {
      showToast({ severity: 'info', title: 'Cần đăng nhập', message: 'Vui lòng đăng nhập để tải bài hát.' });
      navigate('/?auth=login');
      return;
    }
    try {
      await clientSongsApi.requestDownload(activeHeroSong._id);
      showToast({ severity: 'success', title: 'Đã tải xuống', message: 'Bài hát đã được thêm vào danh sách tải xuống.' });
    } catch (error) {
      showToast({ severity: 'error', title: 'Không thể tải', message: error.response?.data?.message || 'Vui lòng thử lại sau.' });
    }
  };

  const handleLoadMoreSongs = async () => {
    if (displayedSongCount < songs.length) {
      setDisplayedSongCount((prev) => Math.min(prev + 8, songs.length));
      return;
    }
    try {
      setLoadingMoreSongs(true);
      const res = await clientSongsApi.getRecommended({ limit: displayedSongCount + 12 });
      if (Array.isArray(res.data) && res.data.length > 0) {
        setSongs(res.data);
        setDisplayedSongCount((prev) => prev + 8);
      }
    } catch (err) {
      console.warn('Failed to load more songs:', err);
    } finally {
      setLoadingMoreSongs(false);
    }
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
            followers: artist.followersCount || artist.followers || 0,
            plays: 0,
          });
        }

        map.get(artist._id).plays += song.playCount || 0;
      });
    });

    return [...map.values()].sort((a, b) => b.plays - a.plays).slice(0, 20);
  }, [songs]);

  // Set followers count directly from pre-populated song artist data
  useEffect(() => {
    if (!topArtists.length) return;
    const followerMap = {};
    topArtists.forEach(artist => {
      followerMap[artist._id] = artist.followers || 0;
    });
    setArtistFollowersState(prev => ({ ...prev, ...followerMap }));
  }, [topArtists]);

  // Batch query follow statuses in one single network request
  useEffect(() => {
    let cancelled = false;

    const fetchFollowStatuses = async () => {
      if (!topArtists.length) return;
      const isLoggedIn = !!localStorage.getItem('userId');
      if (!isLoggedIn) {
        const followMap = {};
        topArtists.forEach(artist => {
          followMap[artist._id] = false;
        });
        setFollowedArtists(followMap);
        return;
      }

      try {
        const artistIds = topArtists.map(artist => artist._id);
        const response = await clientArtistApi.getBatchFollowStatus(artistIds);
        if (response.data.success && response.data.followStatusMap && !cancelled) {
          setFollowedArtists(response.data.followStatusMap);
        }
      } catch (err) {
        console.error("Error fetching batch follow status:", err);
      }
    };

    const cancelIdleTask = scheduleIdleTask(fetchFollowStatuses);
    return () => {
      cancelled = true;
      cancelIdleTask();
    };
  }, [topArtists, isLoggedIn]);

  const handleToggleFollow = async (artist) => {
    const isLoggedIn = !!localStorage.getItem('userId');
    if (!isLoggedIn) {
      showToast({
        message: 'Vui lòng đăng nhập để quan tâm nghệ sĩ.',
        severity: 'warning'
      });
      navigate('/?auth=login');
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

  // Synced Lyrics Autoscroll Effect
  useEffect(() => {
    if (!hasSyncedLyrics || activeLyricIndex < 0) return;
    const container = lyricsContainerRef.current;
    const activeLineElement = lyricItemRefs.current[activeLyricIndex];
    if (!container || !activeLineElement) return;

    const containerRect = container.getBoundingClientRect();
    const lineRect = activeLineElement.getBoundingClientRect();
    const lineTopInContainer = lineRect.top - containerRect.top + container.scrollTop;
    const lineBottomInContainer = lineTopInContainer + lineRect.height;

    const padding = 24;
    const viewTop = container.scrollTop;
    const viewBottom = viewTop + container.clientHeight;

    if (lineTopInContainer < viewTop + padding || lineBottomInContainer > viewBottom - padding) {
      const targetScrollTop = lineTopInContainer - (container.clientHeight * 0.38);
      container.scrollTo({
        top: Math.max(0, targetScrollTop),
        behavior: 'smooth',
      });
    }
  }, [activeLyricIndex, hasSyncedLyrics, lyricsLines]);

  const [selectedMood, setSelectedMood] = useState(null);
  const [activeTabFilter, setActiveTabFilter] = useState('all');

  const moodOrbs = useMemo(() => [
    { id: 'hyper', label: 'Hyper Flow', desc: 'Bùng nổ năng lượng', icon: <BoltIcon />, color: '#ec4899', gradient: 'linear-gradient(135deg, #ec4899, #f43f5e)' },
    { id: 'abyss', label: 'Deep Abyss', desc: 'Tập trung sâu & Lofi', icon: <WavesIcon />, color: '#06b6d4', gradient: 'linear-gradient(135deg, #06b6d4, #3b82f6)' },
    { id: 'cosmic', label: 'Cosmic Chill', desc: 'Thư giãn vũ trụ', icon: <MoonIcon />, color: '#6366f1', gradient: 'linear-gradient(135deg, #6366f1, #8b5cf6)' },
    { id: 'party', label: 'Neon Party', desc: 'EDM & Sôi động', icon: <FireIcon />, color: '#f59e0b', gradient: 'linear-gradient(135deg, #f59e0b, #ef4444)' },
    { id: 'rain', label: 'Rainy Lo-Fi', desc: 'Lắng đọng cảm xúc', icon: <WaterIcon />, color: '#38bdf8', gradient: 'linear-gradient(135deg, #38bdf8, #818cf8)' },
  ], []);

  const genreCapsules = useMemo(() => [
    { id: 'vpop', name: 'V-Pop Điểm Hẹn', color: '#ec4899', icon: '🇻🇳', desc: 'Bản hit Việt mới nhất' },
    { id: 'usuk', name: 'US-UK Billboard', color: '#6366f1', icon: '🇺🇸', desc: 'Top hits toàn cầu' },
    { id: 'kpop', name: 'K-Pop Hallyu', color: '#06b6d4', icon: '🇰🇷', desc: 'Giai điệu xu hướng' },
    { id: 'indie', name: 'Indie & Acoustic', color: '#10b981', icon: '🎸', desc: 'Mộc mạc & Thư thái' },
    { id: 'rap', name: 'Rap & Hip-Hop', color: '#f59e0b', icon: '🎤', desc: 'Bùng nổ nhịp beat' },
    { id: 'edm', name: 'EDM Không Gian', color: '#a855f7', icon: '🌌', desc: 'Năng lượng vũ trụ' },
  ], []);

  const handleMoodSelect = (mood) => {
    setSelectedMood(mood.id);
    navigate(`/ai-mood?mood=${mood.id}`);
  };

  const top3Podium = useMemo(() => topSongs.slice(0, 3), [topSongs]);
  const restTopSongs = useMemo(() => topSongs.slice(3, 10), [topSongs]);

  return (
    <ClientLayout title="Trang chủ">
      {error && <Alert severity="error" sx={{ mb: 2.5, borderRadius: 3 }}>{error}</Alert>}

      <Stack spacing={4} sx={{ width: '100%', pb: 4 }}>
        {/* ── 0. TOP CATEGORY PILLS BAR ── */}
        <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', pb: 0.5, scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}>
          {[
            { id: 'all', label: '✨ Tất Cả Dòng Chảy' },
            { id: 'lyrics', label: '🎙️ Live Lyrics Karaoke' },
            { id: 'tracks', label: '🎧 Âm Nhạc Hot' },
            { id: 'mood', label: '⚡ Trạm Cảm Xúc' },
            { id: 'podium', label: '🏆 Bục Vinh Quang' },
            { id: 'genres', label: '📻 Sóng Thể Loại' },
            { id: 'artists', label: '🪐 Hành Tinh Nghệ Sĩ' },
            { id: 'playlists', label: '📻 Tuyển Tập Đặc Tuyển' },
          ].map((tab) => {
            const isTabActive = activeTabFilter === tab.id;
            return (
              <Box
                key={tab.id}
                onClick={() => setActiveTabFilter(tab.id)}
                sx={{
                  px: 2.25,
                  py: 0.85,
                  borderRadius: '9999px',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: isTabActive ? 850 : 600,
                  whiteSpace: 'nowrap',
                  bgcolor: isTabActive ? '#6c63ff' : (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                  color: isTabActive ? '#fff' : (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.7)' : '#334155',
                  border: '1px solid',
                  borderColor: isTabActive ? '#8c85ff' : (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                  boxShadow: isTabActive ? '0 4px 16px rgba(108, 99, 255, 0.45)' : 'none',
                  transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                  '&:hover': {
                    bgcolor: isTabActive ? '#5246e2' : (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.07)',
                    transform: 'translateY(-1.5px)',
                  },
                }}
              >
                {tab.label}
              </Box>
            );
          })}
        </Stack>

        {/* ── 1. 🔮 SÂN KHẤU TÂM ĐIỂM DÒNG CHẢY & LIVE LYRICS (UNIFIED MASTER HERO STAGE) ── */}
        {(activeTabFilter === 'all' || activeTabFilter === 'tracks' || activeTabFilter === 'lyrics') && (
          <Box
            sx={{
              position: 'relative',
              borderRadius: { xs: 4, md: 6 },
              overflow: 'hidden',
              p: { xs: 2.5, sm: 3, md: 3.5 },
              minHeight: { xs: 'auto', md: 260 },
              background: (theme) => theme.palette.mode === 'dark'
                ? 'linear-gradient(135deg, rgba(14, 20, 38, 0.96) 0%, rgba(7, 10, 22, 0.98) 100%)'
                : 'linear-gradient(135deg, #181c32 0%, #1e1b4b 50%, #0f172a 100%)',
              border: (theme) => theme.palette.mode === 'dark'
                ? '1px solid rgba(165, 180, 252, 0.18)'
                : '1px solid rgba(99, 102, 241, 0.35)',
              boxShadow: (theme) => theme.palette.mode === 'dark'
                ? '0 24px 60px -15px rgba(0, 0, 0, 0.75), 0 0 35px rgba(99, 102, 241, 0.2), inset 0 1px 1.5px rgba(255, 255, 255, 0.25)'
                : '0 20px 50px -10px rgba(30, 27, 75, 0.45), 0 0 30px rgba(99, 102, 241, 0.25), inset 0 1px 1.5px rgba(255, 255, 255, 0.35)',
            }}
          >
            {/* Dynamic Aurora Ambient Backlight */}
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                backgroundImage: (currentSong?.imageUrl || spotlightSong?.imageUrl) ? `url(${currentSong?.imageUrl || spotlightSong?.imageUrl})` : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                filter: 'blur(80px) saturate(2.4)',
                opacity: (theme) => theme.palette.mode === 'dark' ? 0.38 : 0.45,
                transform: 'scale(1.3)',
                zIndex: 0,
                pointerEvents: 'none',
              }}
            />

            <Grid container spacing={{ xs: 2.5, md: 3.5 }} alignItems="center" sx={{ position: 'relative', zIndex: 2, width: '100%' }}>
              {/* Left Column (5/12): Song Info + Full Vinyl Artwork Disc + Playback Controls */}
              <Grid size={{ xs: 12, md: 5 }}>
                <Stack spacing={2} alignItems="flex-start">
                  {/* Song Title & Vinyl Row */}
                  <Stack direction="row" spacing={2.5} alignItems="center" sx={{ width: '100%' }}>
                    {/* 3D Vinyl Disc With Full Artwork */}
                    <Box
                      sx={{
                        position: 'relative',
                        width: { xs: 92, sm: 104 },
                        height: { xs: 92, sm: 104 },
                        flexShrink: 0,
                      }}
                    >
                      <Box
                        className={isPlaying ? 'animate-vinyl-spin' : 'animate-vinyl-spin-paused'}
                        sx={{
                          width: '100%',
                          height: '100%',
                          borderRadius: '50%',
                          backgroundImage: `url(${(currentSong || spotlightSong)?.imageUrl || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400'})`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          border: '3px solid rgba(255, 255, 255, 0.45)',
                          boxShadow: '0 10px 28px rgba(0, 0, 0, 0.65), 0 0 24px rgba(108, 99, 255, 0.45)',
                        }}
                      />
                    </Box>

                    <Box sx={{ minWidth: 0, flexGrow: 1, overflow: 'hidden' }}>
                      <Typography
                        variant="h3"
                        sx={{
                          fontWeight: 950,
                          letterSpacing: '-0.035em',
                          mb: 0.5,
                          background: 'linear-gradient(135deg, #ffffff 15%, #a5b4fc 50%, #00e5ff 100%)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          lineHeight: 1.15,
                          fontSize: { xs: '1.45rem', sm: '1.8rem', md: '2rem' },
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {(currentSong || spotlightSong)?.title || 'Khám Phá MusicFlow'}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          color: 'rgba(255, 255, 255, 0.78)',
                          fontWeight: 650,
                          fontSize: { xs: 13, sm: 14.5 },
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {Array.isArray((currentSong || spotlightSong)?.artists)
                          ? (currentSong || spotlightSong).artists.map(a => a?.name).filter(Boolean).join(', ')
                          : ((currentSong || spotlightSong)?.artistText || 'Nhiều nghệ sĩ')}
                      </Typography>
                    </Box>
                  </Stack>

                  {/* Progress Bar (if song is loaded) */}
                  {currentSong && (
                    <Box sx={{ width: '100%', pr: { md: 2 } }}>
                      <Slider
                        size="small"
                        min={0}
                        max={displayDuration || 1}
                        value={Math.min(scrubTime ?? currentTime, displayDuration || 1)}
                        onChange={(_, val) => setScrubTime(Number(val))}
                        onChangeCommitted={(_, val) => {
                          seekTo(val);
                          setScrubTime(null);
                        }}
                        sx={{
                          color: '#6c63ff',
                          height: 4,
                          py: 1,
                          '& .MuiSlider-thumb': {
                            width: 10,
                            height: 10,
                            '&:hover, &.Mui-focusVisible': {
                              boxShadow: '0 0 0 8px rgba(108, 99, 255, 0.2)',
                            },
                          },
                          '& .MuiSlider-rail': { opacity: 0.25, bgcolor: '#fff' },
                        }}
                      />
                      <Stack direction="row" justifyContent="space-between" sx={{ mt: -0.5 }}>
                        <Typography variant="caption" sx={{ fontSize: 11, opacity: 0.7, fontWeight: 600 }}>
                          {formatDuration(scrubTime ?? currentTime)}
                        </Typography>
                        <Typography variant="caption" sx={{ fontSize: 11, opacity: 0.7, fontWeight: 600 }}>
                          {formatDuration(displayDuration)}
                        </Typography>
                      </Stack>
                    </Box>
                  )}

                  {/* Control Buttons Group */}
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ pt: 0.5, flexWrap: 'wrap', gap: 1 }}>
                    {currentSong ? (
                      <Button
                        variant="contained"
                        onClick={togglePlay}
                        startIcon={isPlaying ? <PauseIcon sx={{ fontSize: 22 }} /> : <PlayIcon sx={{ fontSize: 22 }} />}
                        sx={{
                          background: 'linear-gradient(135deg, #8c85ff 0%, #6366f1 45%, #00e5ff 100%)',
                          color: '#fff',
                          fontWeight: 900,
                          borderRadius: '9999px',
                          px: 3.5,
                          py: 1,
                          fontSize: 14,
                          textTransform: 'uppercase',
                          letterSpacing: 0.5,
                          boxShadow: '0 8px 24px rgba(99, 102, 241, 0.55)',
                          '&:hover': {
                            transform: 'scale(1.05)',
                            boxShadow: '0 12px 30px rgba(99, 102, 241, 0.75)',
                          },
                          transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                        }}
                      >
                        {isPlaying ? 'Tạm Dừng' : 'Tiếp Tục'}
                      </Button>
                    ) : (
                      <Button
                        variant="contained"
                        onClick={() => spotlightSong && playSong(spotlightSong, { queue: songs })}
                        startIcon={<PlayIcon sx={{ fontSize: 22 }} />}
                        sx={{
                          background: 'linear-gradient(135deg, #8c85ff 0%, #6366f1 45%, #00e5ff 100%)',
                          color: '#fff',
                          fontWeight: 900,
                          borderRadius: '9999px',
                          px: 3.5,
                          py: 1,
                          fontSize: 14,
                          textTransform: 'uppercase',
                          letterSpacing: 0.5,
                          boxShadow: '0 8px 24px rgba(99, 102, 241, 0.55)',
                          '&:hover': {
                            transform: 'scale(1.05)',
                            boxShadow: '0 12px 30px rgba(99, 102, 241, 0.75)',
                          },
                          transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                        }}
                      >
                        Kích Hoạt Dòng Chảy
                      </Button>
                    )}

                    {currentSong && (
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <IconButton size="small" onClick={handlePrevious} sx={{ color: '#fff', '&:hover': { transform: 'scale(1.15)' } }}>
                          <PrevIcon sx={{ fontSize: 22 }} />
                        </IconButton>
                        <IconButton size="small" onClick={handleNext} sx={{ color: '#fff', '&:hover': { transform: 'scale(1.15)' } }}>
                          <NextIcon sx={{ fontSize: 22 }} />
                        </IconButton>
                      </Stack>
                    )}

                    {/* Action icons capsule on Banner */}
                    <Stack
                      direction="row"
                      spacing={0.5}
                      alignItems="center"
                      sx={{
                        bgcolor: 'rgba(255, 255, 255, 0.08)',
                        backdropFilter: 'blur(16px)',
                        border: '1px solid rgba(255, 255, 255, 0.16)',
                        borderRadius: '9999px',
                        px: 1,
                        py: 0.4,
                      }}
                    >
                      <Tooltip title={favorite ? 'Bỏ thích' : 'Yêu thích'} arrow>
                        <IconButton
                          size="small"
                          onClick={handleToggleFavoriteHero}
                          sx={{
                            color: favorite ? '#ff4081' : 'rgba(255, 255, 255, 0.85)',
                            p: 0.75,
                            '&:hover': {
                              transform: 'scale(1.15)',
                              color: '#ff4081',
                              bgcolor: 'rgba(255, 64, 129, 0.15)',
                            },
                            transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                          }}
                        >
                          {favorite ? <FavoriteIcon sx={{ fontSize: 18 }} /> : <FavoriteBorderIcon sx={{ fontSize: 18 }} />}
                        </IconButton>
                      </Tooltip>

                      <Tooltip title="Tải xuống bài hát" arrow>
                        <IconButton
                          size="small"
                          onClick={handleDownloadHero}
                          sx={{
                            color: 'rgba(255, 255, 255, 0.85)',
                            p: 0.75,
                            '&:hover': {
                              transform: 'scale(1.15)',
                              color: '#00e5ff',
                              bgcolor: 'rgba(0, 229, 255, 0.15)',
                            },
                            transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                          }}
                        >
                          <DownloadIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Tooltip>

                      <Tooltip title="Chia sẻ bài hát" arrow>
                        <IconButton
                          size="small"
                          onClick={() => setShareOpen(true)}
                          sx={{
                            color: 'rgba(255, 255, 255, 0.85)',
                            p: 0.75,
                            '&:hover': {
                              transform: 'scale(1.15)',
                              color: '#6c63ff',
                              bgcolor: 'rgba(108, 99, 255, 0.18)',
                            },
                            transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                          }}
                        >
                          <ShareIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Tooltip>

                      <Tooltip title="Danh sách đang phát" arrow>
                        <IconButton
                          size="small"
                          onClick={() => setQueueOpen(true)}
                          sx={{
                            color: queueOpen ? '#6c63ff' : 'rgba(255, 255, 255, 0.85)',
                            p: 0.75,
                            '&:hover': {
                              transform: 'scale(1.15)',
                              color: '#6c63ff',
                              bgcolor: 'rgba(108, 99, 255, 0.18)',
                            },
                            transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                          }}
                        >
                          <QueueMusicIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Tooltip>
                    </Stack>

                    <Button
                      variant="outlined"
                      onClick={() => navigate('/ai-mood')}
                      startIcon={<SparklesIcon sx={{ fontSize: 16 }} />}
                      sx={{
                        borderColor: 'rgba(255, 255, 255, 0.2)',
                        bgcolor: 'rgba(255, 255, 255, 0.06)',
                        backdropFilter: 'blur(16px)',
                        color: '#fff',
                        fontWeight: 750,
                        borderRadius: '9999px',
                        px: 2.75,
                        py: 0.95,
                        fontSize: 13,
                        textTransform: 'none',
                        '&:hover': {
                          borderColor: '#00e5ff',
                          bgcolor: 'rgba(0, 229, 255, 0.12)',
                          transform: 'scale(1.04)',
                        },
                        transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                      }}
                    >
                      AI DJ
                    </Button>
                  </Stack>
                </Stack>
              </Grid>

              {/* Right Column (7/12): Apple Music Sing Live Synced Lyrics HUD */}
              <Grid size={{ xs: 12, md: 7 }}>
                <Box
                  sx={{
                    p: { xs: 2, sm: 2.5 },
                    borderRadius: '24px',
                    bgcolor: 'rgba(6, 9, 18, 0.55)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    backdropFilter: 'blur(20px)',
                    position: 'relative',
                    minHeight: { xs: 190, sm: 220 },
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                  }}
                >
                  {/* Lyrics Header Tag */}
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1, px: 1 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <MicIcon sx={{ fontSize: 18, color: '#00e5ff' }} />
                      <Typography sx={{ fontSize: 11.5, fontWeight: 850, textTransform: 'uppercase', letterSpacing: 1, color: '#00e5ff' }}>
                        {hasSyncedLyrics ? 'Live Karaoke Lyrics' : 'Lời Bài Hát'}
                      </Typography>
                    </Stack>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 600 }}>
                      Chạm câu hát để tua nhanh
                    </Typography>
                  </Stack>

                  {lyricsLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                      <CircularProgress size={28} sx={{ color: '#6c63ff' }} />
                    </Box>
                  ) : lyricsLines.length === 0 ? (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' }}>
                        {currentSong ? (currentSong.lyrics ? 'Lời bài hát chưa hỗ trợ chế độ chạy từng giây.' : 'Bài hát hiện chưa có lời.') : 'Phát một ca khúc để theo dõi lời bài hát trực tiếp.'}
                      </Typography>
                    </Box>
                  ) : (
                    <Box
                      ref={lyricsContainerRef}
                      sx={{
                        maxHeight: 220,
                        overflowY: 'auto',
                        px: { xs: 1, sm: 2 },
                        py: 1.5,
                        maskImage: 'linear-gradient(to bottom, transparent 0%, #fff 15%, #fff 85%, transparent 100%)',
                        WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, #fff 15%, #fff 85%, transparent 100%)',
                        scrollbarWidth: 'none',
                        '&::-webkit-scrollbar': { display: 'none' },
                      }}
                    >
                      <Stack spacing={1.75} sx={{ py: 1.5 }}>
                        {lyricsLines.map((line, index) => {
                          const isActive = hasSyncedLyrics && index === activeLyricIndex;
                          const isPast = hasSyncedLyrics && activeLyricIndex >= 0 && index < activeLyricIndex;

                          return (
                            <Typography
                              key={`${line.time}-${line.text}-${index}`}
                              ref={(el) => {
                                lyricItemRefs.current[index] = el;
                              }}
                              variant="h5"
                              onClick={() => seekTo(line.time / 1000)}
                              sx={{
                                textAlign: { xs: 'center', md: 'left' },
                                fontWeight: isActive ? 950 : 600,
                                fontSize: isActive ? { xs: '1.18rem', sm: '1.4rem' } : { xs: '0.9rem', sm: '1.02rem' },
                                color: isActive ? '#ffffff' : isPast ? 'rgba(255,255,255,0.32)' : 'rgba(255,255,255,0.58)',
                                transform: isActive ? 'scale(1.04)' : 'scale(1)',
                                transformOrigin: 'left center',
                                textShadow: isActive ? '0 0 25px rgba(165, 180, 252, 0.95), 0 0 45px rgba(6, 182, 212, 0.6)' : 'none',
                                transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                                cursor: 'pointer',
                                '&:hover': {
                                  color: '#a5b4fc',
                                  opacity: 1,
                                },
                              }}
                            >
                              {line.text}
                            </Typography>
                          );
                        })}
                      </Stack>
                    </Box>
                  )}
                </Box>
              </Grid>
            </Grid>
          </Box>
        )}

        {/* ── 3. ⚡ TRẠM NĂNG LƯỢNG CẢM XÚC: "THE MOOD REACTOR ORBS" ── */}
        {(activeTabFilter === 'all' || activeTabFilter === 'mood') && (
          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 900, letterSpacing: '-0.03em' }}>
                  Trạm Năng Lượng Cảm Xúc (Mood Reactor)
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 550 }}>
                  Chạm vào một viên ngọc năng lượng để kích hoạt bầu không khí âm nhạc tương ứng
                </Typography>
              </Box>
              <Button
                size="small"
                onClick={() => navigate('/ai-mood')}
                endIcon={<ArrowIcon />}
                sx={{ color: '#8c85ff', fontWeight: 800, textTransform: 'none' }}
              >
                Mở AI DJ Studio
              </Button>
            </Stack>

            <Grid container spacing={2}>
              {moodOrbs.map((orb) => {
                const isOrbActive = selectedMood === orb.id;
                return (
                  <Grid size={{ xs: 6, sm: 4, md: 2.4 }} key={orb.id}>
                    <Box
                      onClick={() => handleMoodSelect(orb)}
                      className="glass-card-interactive"
                      sx={{
                        p: 2.25,
                        borderRadius: '24px',
                        cursor: 'pointer',
                        textAlign: 'center',
                        position: 'relative',
                        overflow: 'hidden',
                        bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(12, 16, 30, 0.65)' : 'rgba(255, 255, 255, 0.8)',
                        border: '1px solid',
                        borderColor: isOrbActive ? orb.color : 'rgba(255, 255, 255, 0.08)',
                        boxShadow: isOrbActive ? `0 0 30px ${orb.color}66` : 'none',
                        '&:hover': {
                          borderColor: orb.color,
                          boxShadow: `0 12px 30px -5px ${orb.color}55`,
                        },
                      }}
                    >
                      {/* Orb Icon Glow */}
                      <Box
                        className="animate-orb-pulse"
                        sx={{
                          width: 54,
                          height: 54,
                          borderRadius: '50%',
                          mx: 'auto',
                          mb: 1.5,
                          display: 'grid',
                          placeItems: 'center',
                          background: orb.gradient,
                          color: '#fff',
                          boxShadow: `0 8px 24px ${orb.color}66`,
                        }}
                      >
                        {orb.icon}
                      </Box>
                      <Typography variant="subtitle2" fontWeight={850} noWrap sx={{ fontSize: 14 }}>
                        {orb.label}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize: 11.5, fontWeight: 550, display: 'block', mt: 0.25 }}>
                        {orb.desc}
                      </Typography>
                    </Box>
                  </Grid>
                );
              })}
            </Grid>
          </Box>
        )}

        {/* ── 4. 🌊 DÒNG SÔNG ÂM THANH: "THE INFINITE FLOW RIBBON" (Quick Listen 6-Grid) ── */}
        {(activeTabFilter === 'all' || activeTabFilter === 'tracks') && quickListenSongs.length > 0 && (
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 900, letterSpacing: '-0.03em', mb: 2 }}>
              Dòng Chảy Đang Nghe (Quick Flow)
            </Typography>
            <Grid container spacing={2}>
              {quickListenSongs.map((song, idx) => {
                const isCurrent = currentSong?._id === song._id;
                const flowScore = 98 - (idx * 2);
                return (
                  <Grid size={{ xs: 12, sm: 6, md: 4 }} key={`quick-flow-${song._id}`}>
                    <Box
                      onClick={() => playSong(song, { queue: quickListenSongs })}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                        p: 1.25,
                        pr: 2,
                        borderRadius: '20px',
                        cursor: 'pointer',
                        bgcolor: (theme) => isCurrent
                          ? (theme.palette.mode === 'dark' ? 'rgba(99, 102, 241, 0.2)' : 'rgba(99, 102, 241, 0.12)')
                          : (theme.palette.mode === 'dark' ? 'rgba(12, 16, 30, 0.6)' : 'rgba(255, 255, 255, 0.95)'),
                        border: '1px solid',
                        borderColor: (theme) => isCurrent ? '#6c63ff' : (theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'),
                        backdropFilter: 'blur(20px)',
                        boxShadow: (theme) => isCurrent
                          ? '0 0 25px rgba(108, 99, 255, 0.35)'
                          : (theme.palette.mode === 'dark' ? 'none' : '0 4px 18px rgba(0, 0, 0, 0.06)'),
                        transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                        '&:hover': {
                          borderColor: '#00e5ff',
                          transform: 'translateY(-3px)',
                          boxShadow: '0 12px 30px -8px rgba(0, 229, 255, 0.35)',
                          '& .flow-play-btn': {
                            opacity: 1,
                            transform: 'scale(1)',
                          },
                        },
                      }}
                    >
                      <Avatar
                        src={getOptimizedImageUrl(song.imageUrl, 'song_thumb')}
                        variant="rounded"
                        sx={{
                          width: 56,
                          height: 56,
                          borderRadius: '16px',
                          flexShrink: 0,
                          boxShadow: '0 6px 16px rgba(0,0,0,0.3)',
                        }}
                      />
                      <Box sx={{ minWidth: 0, flexGrow: 1, overflow: 'hidden' }}>
                        <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.2 }}>
                          <Typography
                            variant="body2"
                            fontWeight={850}
                            noWrap
                            sx={{
                              color: isCurrent ? '#00e5ff' : 'text.primary',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              display: 'block',
                              width: '100%',
                              fontSize: 14,
                            }}
                          >
                            {song.title}
                          </Typography>
                        </Stack>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          noWrap
                          sx={{
                            display: 'block',
                            fontWeight: 550,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            width: '100%',
                          }}
                        >
                          {Array.isArray(song.artists) ? song.artists.map(a => a?.name).filter(Boolean).join(', ') : (song.artistText || 'Nghệ sĩ')}
                        </Typography>
                        <Typography variant="caption" sx={{ fontSize: 10, fontWeight: 800, color: '#00e5ff', mt: 0.25, display: 'inline-block' }}>
                          ⚡ Flow Index {flowScore}%
                        </Typography>
                      </Box>
                      <IconButton
                        className="flow-play-btn"
                        size="small"
                        sx={{
                          opacity: isCurrent ? 1 : 0,
                          transform: isCurrent ? 'scale(1)' : 'scale(0.8)',
                          background: 'linear-gradient(135deg, #8c85ff, #6366f1)',
                          color: '#fff',
                          boxShadow: '0 6px 16px rgba(99, 102, 241, 0.5)',
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            transform: 'scale(1.15) !important',
                          },
                        }}
                      >
                        {isCurrent && isPlaying ? <PauseIcon sx={{ fontSize: 22 }} /> : <PlayIcon sx={{ fontSize: 22, ml: 0.2 }} />}
                      </IconButton>
                    </Box>
                  </Grid>
                );
              })}
            </Grid>
          </Box>
        )}

        {/* ── 5. 🏆 BỤC VINH QUANG: "THE SONIC PODIUM" (Top 3 3D Matrix + List) ── */}
        {(activeTabFilter === 'all' || activeTabFilter === 'podium') && top3Podium.length >= 3 && (
          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2.5 }}>
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 900, letterSpacing: '-0.03em' }}>
                  Đấu Trường Bảng Xếp Hạng (Sonic Podium)
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 550 }}>
                  3 Quán Quân chiếm lĩnh dòng chảy âm nhạc tuần này
                </Typography>
              </Box>
              <Button
                size="small"
                onClick={() => navigate('/rankings')}
                endIcon={<ArrowIcon />}
                sx={{ color: '#8c85ff', fontWeight: 800, textTransform: 'none' }}
              >
                Xem Toàn Bộ BXH
              </Button>
            </Stack>

            <Grid container spacing={2.5} alignItems="flex-end" sx={{ mb: 3 }}>
              {/* Podium #02 (Silver Cyan - Left) */}
              <Grid size={{ xs: 12, md: 4 }}>
                <Box
                  onClick={() => playSong(top3Podium[1], { queue: topSongs })}
                  className="podium-silver"
                  sx={{
                    p: 3,
                    borderRadius: '28px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    minHeight: 260,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                    '&:hover': { transform: 'translateY(-6px)' },
                  }}
                >
                  <Typography sx={{ fontSize: 24, fontWeight: 950, color: '#00e5ff', mb: 1, letterSpacing: 1 }}>
                    #02
                  </Typography>
                  <Avatar
                    src={getOptimizedImageUrl(top3Podium[1].imageUrl, 'song_card')}
                    sx={{ width: 80, height: 80, borderRadius: '20px', mb: 1.5, boxShadow: '0 8px 24px rgba(0, 229, 255, 0.35)' }}
                  />
                  <Typography variant="subtitle1" fontWeight={900} noWrap sx={{ maxWidth: '100%', color: '#fff' }}>
                    {top3Podium[1].title}
                  </Typography>
                  <Typography variant="caption" noWrap sx={{ maxWidth: '100%', fontWeight: 600, color: 'rgba(255, 255, 255, 0.75)' }}>
                    {Array.isArray(top3Podium[1].artists) ? top3Podium[1].artists.map(a => a?.name).join(', ') : top3Podium[1].artistText}
                  </Typography>
                </Box>
              </Grid>

              {/* Podium #01 (Gold Neon - Center Tallest) */}
              <Grid size={{ xs: 12, md: 4 }}>
                <Box
                  onClick={() => playSong(top3Podium[0], { queue: topSongs })}
                  className="podium-gold"
                  sx={{
                    p: 3.5,
                    borderRadius: '32px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    minHeight: 300,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                    '&:hover': { transform: 'translateY(-8px) scale(1.02)' },
                  }}
                >
                  <Typography sx={{ fontSize: 32, fontWeight: 950, color: '#ffd700', mb: 1, letterSpacing: 1, textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
                    👑 #01 QUÁN QUÂN
                  </Typography>
                  <Avatar
                    src={getOptimizedImageUrl(top3Podium[0].imageUrl, 'song_card')}
                    sx={{ width: 100, height: 100, borderRadius: '24px', mb: 1.5, boxShadow: '0 12px 30px rgba(255, 215, 0, 0.45)' }}
                  />
                  <Typography variant="h6" fontWeight={950} noWrap sx={{ maxWidth: '100%', fontSize: 18, color: '#fff' }}>
                    {top3Podium[0].title}
                  </Typography>
                  <Typography variant="caption" noWrap sx={{ maxWidth: '100%', fontWeight: 700, color: 'rgba(255, 255, 255, 0.75)' }}>
                    {Array.isArray(top3Podium[0].artists) ? top3Podium[0].artists.map(a => a?.name).join(', ') : top3Podium[0].artistText}
                  </Typography>
                </Box>
              </Grid>

              {/* Podium #03 (Bronze Purple - Right) */}
              <Grid size={{ xs: 12, md: 4 }}>
                <Box
                  onClick={() => playSong(top3Podium[2], { queue: topSongs })}
                  className="podium-bronze"
                  sx={{
                    p: 3,
                    borderRadius: '28px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    minHeight: 240,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                    '&:hover': { transform: 'translateY(-6px)' },
                  }}
                >
                  <Typography sx={{ fontSize: 24, fontWeight: 950, color: '#c084fc', mb: 1, letterSpacing: 1 }}>
                    #03
                  </Typography>
                  <Avatar
                    src={getOptimizedImageUrl(top3Podium[2].imageUrl, 'song_card')}
                    sx={{ width: 76, height: 76, borderRadius: '18px', mb: 1.5, boxShadow: '0 8px 24px rgba(192, 132, 252, 0.35)' }}
                  />
                  <Typography variant="subtitle1" fontWeight={900} noWrap sx={{ maxWidth: '100%', color: '#fff' }}>
                    {top3Podium[2].title}
                  </Typography>
                  <Typography variant="caption" noWrap sx={{ maxWidth: '100%', fontWeight: 600, color: 'rgba(255, 255, 255, 0.75)' }}>
                    {Array.isArray(top3Podium[2].artists) ? top3Podium[2].artists.map(a => a?.name).join(', ') : top3Podium[2].artistText}
                  </Typography>
                </Box>
              </Grid>
            </Grid>

            {/* Rest of Top Songs List (Top 4 - 10) */}
            <Grid container spacing={2}>
              {restTopSongs.map((song, index) => (
                <Grid size={{ xs: 12, sm: 6 }} key={`rest-top-${song._id}`}>
                  <ClientSongItem
                    song={song}
                    index={index + 4}
                    isCurrent={currentSong?._id === song._id}
                    isPlaying={isPlaying}
                    onPlay={() => playSong(song, { queue: topSongs })}
                  />
                </Grid>
              ))}
            </Grid>
          </Box>
        )}

        {/* ── 6. 📻 SÓNG THỂ LOẠI ÂM NHẠC: "SONIC GENRE CAPSULES" ── */}
        {(activeTabFilter === 'all' || activeTabFilter === 'genres') && (
          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 900, letterSpacing: '-0.03em' }}>
                  Trạm Sóng Thể Loại (Sonic Genre Capsules)
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 550 }}>
                  Khám phá những vùng không gian âm nhạc theo phong cách riêng
                </Typography>
              </Box>
              <Button
                size="small"
                onClick={() => navigate('/genres')}
                endIcon={<ArrowIcon />}
                sx={{ color: '#8c85ff', fontWeight: 800, textTransform: 'none' }}
              >
                Tất Cả Thể Loại
              </Button>
            </Stack>

            <Grid container spacing={2}>
              {genreCapsules.map((genre) => (
                <Grid size={{ xs: 6, sm: 4, md: 2 }} key={genre.id}>
                  <Box
                    onClick={() => navigate(`/genres?cat=${genre.id}`)}
                    className="glass-card-interactive"
                    sx={{
                      p: 2,
                      borderRadius: '22px',
                      cursor: 'pointer',
                      bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(14, 18, 34, 0.65)' : 'rgba(255, 255, 255, 0.95)',
                      border: '1px solid',
                      borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.07)',
                      boxShadow: (theme) => theme.palette.mode === 'dark' ? 'none' : '0 4px 16px rgba(0, 0, 0, 0.05)',
                      textAlign: 'center',
                      '&:hover': {
                        borderColor: genre.color,
                        boxShadow: `0 10px 25px -4px ${genre.color}55`,
                      },
                    }}
                  >
                    <Typography sx={{ fontSize: 28, mb: 1 }}>{genre.icon}</Typography>
                    <Typography variant="subtitle2" fontWeight={850} noWrap sx={{ fontSize: 13.5 }}>
                      {genre.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize: 11, fontWeight: 550, display: 'block', mt: 0.25 }}>
                      {genre.desc}
                    </Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Box>
        )}

        {/* ── 7. 🪐 HÀNH TINH NGHỆ SĨ: "ARTIST CONSTELLATION SPHERES" ── */}
        {(activeTabFilter === 'all' || activeTabFilter === 'artists') && (
          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2.5 }}>
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 900, letterSpacing: '-0.03em' }}>
                  Hành Tinh Nghệ Sĩ (Artist Constellation)
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 550 }}>
                  Những ngôi sao định hình dòng chảy âm nhạc
                </Typography>
              </Box>
              {topArtists.length > 6 && (
                <Button
                  size="small"
                  onClick={() => setIsArtistsExpanded((prev) => !prev)}
                  sx={{ color: '#8c85ff', fontWeight: 800, textTransform: 'none' }}
                >
                  {isArtistsExpanded ? 'Thu gọn' : 'Xem tất cả'}
                </Button>
              )}
            </Stack>

            <Grid container spacing={3}>
              {(isArtistsExpanded ? topArtists.slice(0, 18) : topArtists.slice(0, 6)).map((artist) => {
                const isFollowed = followedArtists[artist._id] || false;
                return (
                  <Grid size={{ xs: 6, sm: 4, md: 2 }} key={artist._id} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <Box sx={{ position: 'relative', width: { xs: 96, md: 115 }, height: { xs: 96, md: 115 }, mb: 1.75 }}>
                      {/* Glowing Saturn Orbit Ring */}
                      <Box
                        className="animate-saturn-orbit"
                        sx={{
                          position: 'absolute',
                          inset: -6,
                          borderRadius: '50%',
                          border: '2px solid rgba(99, 102, 241, 0.3)',
                          boxShadow: '0 0 16px rgba(99, 102, 241, 0.25)',
                        }}
                      />
                      <Avatar
                        src={getOptimizedImageUrl(artist.avatar, 'avatar')}
                        sx={{
                          width: '100%',
                          height: '100%',
                          cursor: 'pointer',
                          boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                          transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                          '&:hover': { transform: 'scale(1.08)' },
                        }}
                        onClick={() => navigate(`/artists/${artist._id}`)}
                      >
                        {artist.name.charAt(0)}
                      </Avatar>
                    </Box>
                    <Typography
                      variant="subtitle2"
                      fontWeight={900}
                      noWrap
                      sx={{
                        maxWidth: '100%',
                        textAlign: 'center',
                        cursor: 'pointer',
                        fontSize: 14,
                        '&:hover': { color: '#00e5ff' },
                      }}
                      onClick={() => navigate(`/artists/${artist._id}`)}
                    >
                      {artist.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.25, fontWeight: 600, fontSize: 11.5 }}>
                      {formatFollowerCount(artistFollowersState[artist._id] || 0)}
                    </Typography>
                    <Button
                      variant="outlined"
                      onClick={() => handleToggleFollow(artist)}
                      sx={{
                        mt: 1.5,
                        borderRadius: '9999px',
                        px: 2.25,
                        py: 0.35,
                        fontSize: '11px',
                        fontWeight: 850,
                        textTransform: 'uppercase',
                        borderColor: isFollowed ? '#6c63ff' : 'rgba(255, 255, 255, 0.15)',
                        color: isFollowed ? '#8c85ff' : 'text.primary',
                        bgcolor: isFollowed ? 'rgba(108, 99, 255, 0.12)' : 'transparent',
                        '&:hover': {
                          borderColor: '#6c63ff',
                          bgcolor: 'rgba(108, 99, 255, 0.2)',
                        },
                      }}
                    >
                      {isFollowed ? 'Đang Theo' : 'Theo Dõi'}
                    </Button>
                  </Grid>
                );
              })}
            </Grid>
          </Box>
        )}

        {/* ── 8. 📻 TUYỂN TẬP PLAYLIST ĐẶC SẮC (Compact Sizing: 6 items / row) ── */}
        {(activeTabFilter === 'all' || activeTabFilter === 'playlists') && (
          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 900, letterSpacing: '-0.03em' }}>
                  Tuyển Tập Playlist Đặc Sắc
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 550 }}>
                  Bộ sưu tập được chọn lọc theo từng cung bậc cảm xúc
                </Typography>
              </Box>
              {playlists.length > 6 && (
                <Button
                  size="small"
                  onClick={() => setIsPlaylistsExpanded((prev) => !prev)}
                  sx={{ color: '#8c85ff', fontWeight: 800, textTransform: 'none' }}
                >
                  {isPlaylistsExpanded ? 'Thu gọn' : 'Xem tất cả'}
                </Button>
              )}
            </Stack>
            <Grid container spacing={2}>
              {(isPlaylistsExpanded ? playlists.slice(0, 18) : playlists.slice(0, 6)).map((playlist) => (
                <Grid size={{ xs: 6, sm: 4, md: 3, lg: 2 }} key={playlist._id}>
                  <ClientPlaylistCard
                    playlist={playlist}
                    onClick={() => navigate(`/collections/${playlist._id}`)}
                  />
                </Grid>
              ))}
            </Grid>
          </Box>
        )}

        {/* ── 9. 🎧 ĐỀ XUẤT TOÀN DIỆN CHO BẠN (Infinite Stream Feed) ── */}
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 900, letterSpacing: '-0.03em', mb: 2.5 }}>
            Gợi Ý Dành Riêng Cho Bạn
          </Typography>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={32} sx={{ color: '#6c63ff' }} />
            </Box>
          ) : (
            <Grid container spacing={2}>
              {recommendedSongs.map((song) => (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={song._id}>
                  <ClientSongItem
                    song={song}
                    isCurrent={currentSong?._id === song._id}
                    isPlaying={isPlaying}
                    onPlay={() => playSong(song, { queue: recommendedSongs })}
                  />
                </Grid>
              ))}
            </Grid>
          )}
          {songs.length > displayedSongCount && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3.5 }}>
              <Button
                variant="outlined"
                onClick={handleLoadMoreSongs}
                disabled={loadingMoreSongs}
                startIcon={loadingMoreSongs ? <CircularProgress size={16} sx={{ color: '#6c63ff' }} /> : null}
                sx={{
                  color: '#fff',
                  borderColor: 'rgba(255, 255, 255, 0.2)',
                  fontWeight: 800,
                  borderRadius: '9999px',
                  px: 4,
                  py: 1,
                  textTransform: 'none',
                  '&:hover': {
                    borderColor: '#6c63ff',
                    bgcolor: 'rgba(108, 99, 255, 0.12)',
                  },
                }}
              >
                {loadingMoreSongs ? 'Đang tải...' : 'Tải Thêm Bài Hát'}
              </Button>
            </Box>
          )}
        </Box>
      </Stack>

      <ClientQueueDrawer open={queueOpen} onClose={() => setQueueOpen(false)} />
      <ShareSongModal open={shareOpen} onClose={() => setShareOpen(false)} song={activeHeroSong} />
    </ClientLayout>
  );
}

export default ClientHome;
