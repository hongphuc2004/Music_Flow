import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  Typography,
  IconButton,
  Tooltip,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  ArrowBackRounded as ArrowBackIcon,
  PlayArrowRounded as PlayIcon,
  CheckCircleRounded as VerifiedIcon,
  PersonAddRounded as FollowIcon,
  PersonRemoveRounded as UnfollowIcon,
  ShareRounded as ShareIcon,
  ChevronRightRounded as ChevronRightIcon,
  CloseRounded as CloseIcon,
  HeadphonesRounded as PlayCountIcon,
  LibraryMusicRounded as CollectionIcon,
} from '@mui/icons-material';
import ClientLayout from '../../components/Layout/client/ClientLayout';
import ClientSongItem from '../../components/Layout/client/ClientSongItem';
import { clientSongsApi, clientArtistApi } from '../../services/client/client.service';
import { useClientPlayer, useClientPlayerActions } from '../../components/Layout/client/ClientPlayerProvider';
import useAppToast from '../../components/common/useAppToast';
import ShareArtistModal from '../../components/common/ShareArtistModal';
import { toZingArtistSlug, getArtistCollectionPath } from '../../utils/shareUtil';

function formatNumber(num) {
  if (!num && num !== 0) return '0';
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return Number(num).toLocaleString('vi-VN');
}

function ClientArtist() {
  const navigate = useNavigate();
  const location = useLocation();
  const { artistId, artistSlug } = useParams();
  const targetArtistKey = artistSlug || artistId;
  const { playSong } = useClientPlayerActions();
  const { currentSong, isPlaying } = useClientPlayer();
  const { showToast } = useAppToast();

  const [artistData, setArtistData] = useState(null);
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState(0);

  // Follow state
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followLoading, setFollowLoading] = useState(false);

  // Dialog
  const [bioDialogOpen, setBioDialogOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);

  const isLoggedIn = !!localStorage.getItem('accessToken') || !!localStorage.getItem('userId');

  const openLoginModal = () => {
    const nextParams = new URLSearchParams(location.search);
    nextParams.set('auth', 'login');
    navigate(`${location.pathname}?${nextParams.toString()}`);
  };

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    let isMounted = true;

    const fetchAllArtistData = async () => {
      try {
        setLoading(true);
        setError('');

        const [profileRes, songsRes] = await Promise.allSettled([
          clientArtistApi.getProfile(targetArtistKey),
          clientSongsApi.search({ artistId: targetArtistKey }),
        ]);

        if (!isMounted) return;

        let resolvedArtist = null;
        if (profileRes.status === 'fulfilled' && profileRes.value?.data?.artist) {
          resolvedArtist = profileRes.value.data.artist;
          setArtistData(resolvedArtist);
          setFollowersCount(resolvedArtist.followers || 0);
        } else {
          setError('Không tìm thấy thông tin nghệ sĩ này.');
          setArtistData(null);
          setSongs([]);
          return;
        }

        let songList = [];
        if (resolvedArtist?.songs && Array.isArray(resolvedArtist.songs) && resolvedArtist.songs.length > 0) {
          songList = resolvedArtist.songs;
        } else if (songsRes.status === 'fulfilled' && Array.isArray(songsRes.value?.data) && songsRes.value.data.length > 0) {
          songList = songsRes.value.data;
        }
        setSongs(songList);

        // Check follow status if logged in
        const effectiveArtistId = resolvedArtist?._id || targetArtistKey;
        if (isLoggedIn && effectiveArtistId) {
          clientArtistApi
            .getFollowStatus(effectiveArtistId)
            .then((res) => {
              if (isMounted && res?.data?.success) {
                setIsFollowing(!!res.data.isFollowing);
              }
            })
            .catch(() => {});
        }
      } catch (err) {
        if (isMounted) {
          setError(err.response?.data?.message || 'Không thể tải dữ liệu nghệ sĩ.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchAllArtistData();

    return () => {
      isMounted = false;
    };
  }, [targetArtistKey, isLoggedIn]);

  const artistInfo = useMemo(() => {
    if (artistData?.name) {
      return {
        _id: artistData._id || targetArtistKey,
        id: artistData._id || targetArtistKey,
        name: artistData.name,
        slug: artistData.slug || toZingArtistSlug(artistData.name),
        avatar: artistData.avatar || artistData.coverUrl || '',
        bio: (artistData.bio || '').trim(),
        isVerified: artistData.isVerified || false,
        totalLikes: artistData.totalLikes || 0,
        monthlyListeners: artistData.monthlyListeners || 0,
      };
    }

    const firstSong = songs[0];
    const matchedArtist = firstSong?.artists?.find((a) => a?._id === targetArtistKey || a?.slug === targetArtistKey);

    return {
      _id: targetArtistKey,
      id: targetArtistKey,
      name: matchedArtist?.name || (targetArtistKey ? String(targetArtistKey).replace(/[-_]/g, ' ') : 'Nghệ sĩ'),
      slug: matchedArtist?.slug || (matchedArtist?.name ? toZingArtistSlug(matchedArtist.name) : targetArtistKey),
      avatar: matchedArtist?.avatar || '',
      bio: '',
      isVerified: false,
      totalLikes: 0,
      monthlyListeners: 0,
    };
  }, [artistData, songs, targetArtistKey]);

  // Auto-rewrite URL in address bar to clean ZingMP3 slug (e.g. /Da-LAB instead of /artists/6a268f...)
  useEffect(() => {
    if (!artistInfo?.name || artistInfo.name === 'Nghệ sĩ') return;
    const cleanSlug = toZingArtistSlug(artistInfo.name);
    if (
      cleanSlug &&
      (location.pathname.startsWith('/artists/') || location.pathname.startsWith('/client/artists/'))
    ) {
      navigate(`/${cleanSlug}${location.search}`, { replace: true });
    }
  }, [artistInfo?.name, location.pathname, location.search, navigate]);

  const totalPlays = useMemo(() => {
    return songs.reduce((sum, s) => sum + (s.playCount || 0), 0);
  }, [songs]);

  const totalLikesCount = useMemo(() => {
    return artistInfo.totalLikes || songs.reduce((sum, s) => sum + (s.likeCount || 0), 0);
  }, [artistInfo.totalLikes, songs]);

  // Featured songs for 2-column grid in "Tổng quan"
  // Fills both columns cleanly: displays up to 10 songs (or all if <= 10)
  const featuredSongs = useMemo(() => {
    if (!songs.length) return [];
    if (songs.length <= 10) {
      return songs;
    }
    // Take top 10 songs
    return songs.slice(0, 10);
  }, [songs]);

  // Dynamically generated Curated Collections ("Tuyển tập") for this artist based on listens & interaction
  const artistCollections = useMemo(() => {
    if (!songs.length) return [];

    const sortedByEngagement = [...songs].sort((a, b) => {
      const scoreA = (a.playCount || 0) * 1.5 + (a.likeCount || 0) * 2;
      const scoreB = (b.playCount || 0) * 1.5 + (b.likeCount || 0) * 2;
      return scoreB - scoreA;
    });

    const collections = [];

    // Collection 1: Những bài hát hay nhất (Top 10 engagement)
    const bestSongs = sortedByEngagement.slice(0, 10);
    collections.push({
      id: 'best_songs',
      isBestOf: true,
      title: `Những Bài Hát Hay Nhất Của ${artistInfo.name}`,
      subtitle: `MusicFlow Tuyển Tập • ${bestSongs.length} ca khúc`,
      imageUrl: bestSongs[0]?.imageUrl || artistInfo.avatar || '/placeholder-music.jpg',
      songs: bestSongs,
    });

    // Collection 2: Top Hits được nghe nhiều nhất
    if (songs.length >= 3) {
      const topPlayed = [...songs]
        .sort((a, b) => (b.playCount || 0) - (a.playCount || 0))
        .slice(0, 10);
      collections.push({
        id: 'top_hits',
        title: `Top Hits ${artistInfo.name}`,
        subtitle: `Các ca khúc được nghe nhiều nhất`,
        imageUrl: topPlayed[1]?.imageUrl || topPlayed[0]?.imageUrl || artistInfo.avatar,
        songs: topPlayed,
      });
    }

    // Collection 3: Các ca khúc mới nhất
    if (songs.length >= 5) {
      const recentSongs = [...songs]
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
        .slice(0, 10);
      collections.push({
        id: 'recent_releases',
        title: `Tuyển Tập Ca Khúc Mới Nhất`,
        subtitle: `Phát hành gần đây của ${artistInfo.name}`,
        imageUrl: recentSongs[0]?.imageUrl || artistInfo.avatar,
        songs: recentSongs,
      });
    }

    // Collection 4: Trọn bộ ca khúc
    if (songs.length > 2) {
      collections.push({
        id: 'all_songs',
        title: `Trọn Bộ Tuyển Tập ${artistInfo.name}`,
        subtitle: `Toàn bộ ${songs.length} tác phẩm`,
        imageUrl: artistInfo.avatar || songs[0]?.imageUrl,
        songs: songs,
      });
    }

    return collections;
  }, [songs, artistInfo]);

  const playAll = () => {
    if (!songs.length) return;
    playSong(songs[0], { queue: songs });
  };

  const playCollection = (col) => {
    if (!col?.songs?.length) return;
    playSong(col.songs[0], { queue: col.songs });
    showToast({
      message: `Đang phát: ${col.title}`,
      severity: 'info',
    });
  };

  const handleToggleFollow = async () => {
    if (!isLoggedIn) {
      showToast({
        message: 'Vui lòng đăng nhập để quan tâm nghệ sĩ này.',
        severity: 'warning',
      });
      openLoginModal();
      return;
    }

    try {
      setFollowLoading(true);
      const effectiveId = artistInfo._id || targetArtistKey;
      const res = await clientArtistApi.toggleFollow(effectiveId);
      if (res?.data?.success) {
        setIsFollowing(res.data.isFollowing);
        if (typeof res.data.followers === 'number') {
          setFollowersCount(res.data.followers);
        } else {
          setFollowersCount((prev) => (res.data.isFollowing ? prev + 1 : Math.max(0, prev - 1)));
        }
        showToast({
          message: res.data.isFollowing ? `Đã quan tâm ${artistInfo.name}` : `Đã bỏ quan tâm ${artistInfo.name}`,
          severity: 'success',
        });
      }
    } catch {
      showToast({
        message: 'Không thể cập nhật trạng thái quan tâm. Vui lòng thử lại.',
        severity: 'error',
      });
    } finally {
      setFollowLoading(false);
    }
  };

  const handleShare = () => {
    setShareModalOpen(true);
  };

  return (
    <ClientLayout title={`${artistInfo.name} - MusicFlow`}>
      {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>}

      <Stack spacing={4}>
        {/* Navigation / Back Button */}
        <Box>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate(-1)}
            sx={{
              color: 'text.primary',
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
              px: 2.5,
              py: 0.75,
              fontWeight: 700,
              fontSize: 14,
              boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
              '&:hover': {
                bgcolor: 'action.hover',
                transform: 'translateX(-3px)',
              },
              transition: 'all 0.2s ease',
            }}
          >
            Quay lại
          </Button>
        </Box>

        {/* ========================================================================= */}
        {/* HERO HEADER: ZingMP3 Template Layout with MusicFlow Brand Colors         */}
        {/* Moderated border-radius: 10px-12px (borderRadius: 2.5)                   */}
        {/* ========================================================================= */}
        <Box
          sx={{
            position: 'relative',
            borderRadius: 2.5,
            overflow: 'hidden',
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: (theme) => theme.palette.mode === 'dark' ? '#120f1f' : '#f8f8fb',
            boxShadow: '0 6px 20px rgba(0,0,0,0.02)',
          }}
        >
          {/* Blurred Atmospheric Backdrop */}
          {artistInfo.avatar && (
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundImage: `url(${artistInfo.avatar})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center 30%',
                filter: 'blur(40px) brightness(0.6)',
                opacity: (theme) => (theme.palette.mode === 'dark' ? 0.3 : 0.16),
                zIndex: 0,
                transform: 'scale(1.2)',
              }}
            />
          )}

          {/* Header Gradient Surface */}
          <Box
            sx={{
              position: 'relative',
              zIndex: 1,
              p: { xs: 3, sm: 4, md: 4.5 },
              background: (theme) =>
                theme.palette.mode === 'dark'
                  ? 'linear-gradient(180deg, rgba(18,15,31,0.6) 0%, rgba(18,15,31,0.95) 100%)'
                  : 'linear-gradient(180deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.98) 100%)',
            }}
          >
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={{ xs: 3, md: 4 }}
              alignItems={{ xs: 'center', md: 'flex-end' }}
              justifyContent="space-between"
            >
              {/* Left Column: Avatar + Info */}
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={{ xs: 2.5, sm: 3.5 }}
                alignItems="center"
                sx={{ textAlign: { xs: 'center', sm: 'left' }, maxWidth: { md: '70%' } }}
              >
                {/* Large Round Avatar */}
                <Avatar
                  src={artistInfo.avatar}
                  alt={artistInfo.name}
                  sx={{
                    width: { xs: 120, sm: 135, md: 145 },
                    height: { xs: 120, sm: 135, md: 145 },
                    bgcolor: 'primary.main',
                    fontSize: { xs: 44, md: 54 },
                    fontWeight: 900,
                    boxShadow: '0 8px 24px rgba(108,99,255,0.25)',
                    border: '3px solid',
                    borderColor: 'background.paper',
                    outline: '2px solid #6c63ff',
                    flexShrink: 0,
                  }}
                >
                  {artistInfo.name.charAt(0)}
                </Avatar>

                {/* Artist Meta */}
                <Box sx={{ minWidth: 0 }}>
                  <Stack
                    direction="row"
                    alignItems="center"
                    spacing={1}
                    sx={{ justifyContent: { xs: 'center', sm: 'flex-start' }, mb: 1 }}
                  >
                    <Typography
                      variant="h1"
                      sx={{
                        fontSize: { xs: 26, sm: 34, md: 40 },
                        fontWeight: 900,
                        letterSpacing: '-0.5px',
                        lineHeight: 1.2,
                      }}
                    >
                      {artistInfo.name}
                    </Typography>
                    {artistInfo.isVerified && (
                      <Tooltip title="Nghệ sĩ chính thức đã xác minh" arrow>
                        <VerifiedIcon sx={{ color: '#00bcd4', fontSize: { xs: 22, md: 26 } }} />
                      </Tooltip>
                    )}
                  </Stack>

                  {/* Sub-stats row */}
                  <Stack
                    direction="row"
                    spacing={1.5}
                    alignItems="center"
                    sx={{
                      justifyContent: { xs: 'center', sm: 'flex-start' },
                      color: 'text.secondary',
                      fontWeight: 600,
                      fontSize: 14,
                      mb: 1.5,
                      flexWrap: 'wrap',
                    }}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary' }}>
                      {formatNumber(followersCount)} người quan tâm
                    </Typography>
                    <span>•</span>
                    <Typography variant="body2" color="text.secondary">
                      {songs.length} bài hát
                    </Typography>
                    {totalPlays > 0 && (
                      <>
                        <span>•</span>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <PlayCountIcon sx={{ fontSize: 16, color: 'primary.main' }} />
                          <Typography variant="body2" color="text.secondary">
                            {formatNumber(totalPlays)} lượt phát
                          </Typography>
                        </Box>
                      </>
                    )}
                  </Stack>

                  {/* Bio Teaser */}
                  {artistInfo.bio && (
                    <Box sx={{ mt: 1 }}>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          lineHeight: 1.6,
                          fontSize: 13.5,
                        }}
                      >
                        {artistInfo.bio}
                      </Typography>
                      <Button
                        size="small"
                        onClick={() => setBioDialogOpen(true)}
                        sx={{
                          p: 0,
                          mt: 0.5,
                          minWidth: 0,
                          fontSize: 12.5,
                          fontWeight: 800,
                          color: 'primary.main',
                          textTransform: 'uppercase',
                          letterSpacing: 0.5,
                          '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' },
                        }}
                      >
                        Xem thêm
                      </Button>
                    </Box>
                  )}
                </Box>
              </Stack>

              {/* Right Column: Actions */}
              <Stack
                direction="row"
                spacing={1.5}
                alignItems="center"
                sx={{
                  flexShrink: 0,
                  justifyContent: { xs: 'center', md: 'flex-end' },
                  width: { xs: '100%', md: 'auto' },
                }}
              >
                {/* Play All Button */}
                <Button
                  variant="contained"
                  disabled={!songs.length}
                  onClick={playAll}
                  startIcon={<PlayIcon sx={{ fontSize: 22 }} />}
                  sx={{
                    background: 'linear-gradient(135deg, #6c63ff 0%, #00bcd4 100%)',
                    color: '#fff',
                    px: { xs: 3, sm: 3.5 },
                    py: 1.1,
                    borderRadius: '9999px',
                    fontSize: 14,
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    boxShadow: '0 4px 16px rgba(108, 99, 255, 0.35)',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #594fe6 0%, #00acc1 100%)',
                      transform: 'translateY(-2px)',
                      boxShadow: '0 8px 20px rgba(108, 99, 255, 0.45)',
                    },
                  }}
                >
                  Phát tất cả
                </Button>

                {/* Follow Button */}
                <Button
                  variant={isFollowing ? 'outlined' : 'contained'}
                  disabled={followLoading}
                  onClick={handleToggleFollow}
                  startIcon={isFollowing ? <UnfollowIcon /> : <FollowIcon />}
                  sx={{
                    borderRadius: '9999px',
                    px: 2.5,
                    py: 1.1,
                    fontSize: 13.5,
                    fontWeight: 700,
                    textTransform: 'none',
                    borderColor: isFollowing ? 'divider' : 'transparent',
                    bgcolor: isFollowing
                      ? 'background.paper'
                      : (theme) => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'),
                    color: isFollowing ? 'text.secondary' : 'text.primary',
                    '&:hover': {
                      borderColor: 'primary.main',
                      bgcolor: isFollowing ? 'action.hover' : 'rgba(108,99,255,0.1)',
                      color: 'primary.main',
                    },
                  }}
                >
                  {isFollowing ? 'Đã quan tâm' : 'Quan tâm'}
                </Button>

                {/* Share Button */}
                <Tooltip title="Chia sẻ trang nghệ sĩ" arrow>
                  <IconButton
                    onClick={handleShare}
                    sx={{
                      p: 1.1,
                      borderRadius: '50%',
                      bgcolor: (theme) =>
                        theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                      border: '1px solid',
                      borderColor: 'divider',
                      color: 'text.primary',
                      '&:hover': {
                        bgcolor: 'primary.main',
                        color: '#fff',
                        borderColor: 'primary.main',
                      },
                    }}
                  >
                    <ShareIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Stack>
          </Box>
        </Box>

        {/* ========================================================================= */}
        {/* NAVIGATION TABS: ZingMP3 Template Strip                                 */}
        {/* ========================================================================= */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={activeTab}
            onChange={(_, val) => setActiveTab(val)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              '& .MuiTabs-indicator': {
                height: 3,
                borderRadius: '3px 3px 0 0',
                bgcolor: 'primary.main',
              },
              '& .MuiTab-root': {
                fontWeight: 700,
                fontSize: 14,
                textTransform: 'uppercase',
                letterSpacing: 0.6,
                minWidth: 90,
                px: 2.2,
                py: 1.5,
                color: 'text.secondary',
                '&.Mui-selected': {
                  color: 'primary.main',
                  fontWeight: 900,
                },
              },
            }}
          >
            <Tab label="Tổng quan" />
            <Tab label={`Bài hát (${songs.length})`} />
            <Tab label="Single & EP" />
            <Tab label="Tuyển tập" />
            <Tab label="Giới thiệu" />
          </Tabs>
        </Box>

        {/* Loading Spinner */}
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}>
            <CircularProgress size={38} sx={{ color: 'primary.main' }} />
          </Box>
        )}

        {/* ========================================================================= */}
        {/* TAB 0: TỔNG QUAN (Overview)                                              */}
        {/* ========================================================================= */}
        {!loading && activeTab === 0 && (
          <Stack spacing={5}>
            {/* ── 1. BÀI HÁT NỔI BẬT (2-Column Grid - Full Width, No Empty Gap) ── */}
            <Box sx={{ width: '100%' }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.3px', fontSize: { xs: 20, sm: 22 } }}>
                  Bài Hát Nổi Bật
                </Typography>
                {songs.length > featuredSongs.length && (
                  <Button
                    endIcon={<ChevronRightIcon />}
                    onClick={() => setActiveTab(1)}
                    sx={{
                      fontWeight: 800,
                      fontSize: 13,
                      textTransform: 'uppercase',
                      color: 'text.secondary',
                      letterSpacing: 0.5,
                      '&:hover': { color: 'primary.main', bgcolor: 'transparent' },
                    }}
                  >
                    TẤT CẢ
                  </Button>
                )}
              </Stack>

              {!featuredSongs.length ? (
                <Paper
                  elevation={0}
                  sx={{
                    p: 3.5,
                    textAlign: 'center',
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <Typography color="text.secondary" fontWeight={600}>
                    Nghệ sĩ chưa có bài hát nào được đăng tải.
                  </Typography>
                </Paper>
              ) : (
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                    gap: 1.5,
                    width: '100%',
                  }}
                >
                  {featuredSongs.map((song, index) => (
                    <ClientSongItem
                      key={song._id}
                      song={song}
                      index={index + 1}
                      isCurrent={currentSong?._id === song._id}
                      isPlaying={isPlaying && currentSong?._id === song._id}
                      onPlay={() => playSong(song, { queue: songs })}
                      showDuration={true}
                      sx={{ borderRadius: 1.5 }}
                    />
                  ))}
                </Box>
              )}
            </Box>

            {/* ── 2. SINGLE & EP (Uniform Square Cards - Fixed Aspect Ratio 1:1) ── */}
            {songs.length > 0 && (
              <Box sx={{ width: '100%' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                  <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.3px', fontSize: { xs: 20, sm: 22 } }}>
                    Single & EP
                  </Typography>
                  {songs.length > 5 && (
                    <Button
                      endIcon={<ChevronRightIcon />}
                      onClick={() => setActiveTab(2)}
                      sx={{
                        fontWeight: 800,
                        fontSize: 13,
                        textTransform: 'uppercase',
                        color: 'text.secondary',
                        letterSpacing: 0.5,
                        '&:hover': { color: 'primary.main', bgcolor: 'transparent' },
                      }}
                    >
                      TẤT CẢ
                    </Button>
                  )}
                </Stack>

                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: 'repeat(2, 1fr)',
                      sm: 'repeat(3, 1fr)',
                      md: 'repeat(5, 1fr)',
                    },
                    gap: 2.5,
                    width: '100%',
                  }}
                >
                  {songs.slice(0, 5).map((song) => (
                    <Box
                      key={song._id}
                      onClick={() => playSong(song, { queue: songs })}
                      sx={{
                        cursor: 'pointer',
                        width: '100%',
                        '&:hover .cover-overlay': { opacity: 1 },
                        '&:hover .cover-img': { transform: 'scale(1.05)' },
                      }}
                    >
                      {/* Fixed 1:1 Aspect Ratio Square Image */}
                      <Box
                        sx={{
                          position: 'relative',
                          width: '100%',
                          aspectRatio: '1 / 1',
                          borderRadius: 2,
                          overflow: 'hidden',
                          bgcolor: (theme) =>
                            theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                          border: '1px solid',
                          borderColor: 'divider',
                          mb: 1.25,
                        }}
                      >
                        <Box
                          component="img"
                          src={song.imageUrl || artistInfo.avatar || '/placeholder-music.jpg'}
                          alt={song.title}
                          className="cover-img"
                          sx={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            display: 'block',
                            transition: 'transform 0.3s ease',
                          }}
                        />
                        {/* Hover Play Button Overlay */}
                        <Box
                          className="cover-overlay"
                          sx={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            bgcolor: 'rgba(0,0,0,0.4)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            opacity: 0,
                            transition: 'opacity 0.2s ease',
                          }}
                        >
                          <Box
                            sx={{
                              width: 44,
                              height: 44,
                              borderRadius: '50%',
                              bgcolor: 'primary.main',
                              color: '#fff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              boxShadow: '0 4px 14px rgba(108, 99, 255, 0.5)',
                            }}
                          >
                            <PlayIcon sx={{ fontSize: 26 }} />
                          </Box>
                        </Box>
                      </Box>

                      {/* Song Title & Year */}
                      <Typography
                        variant="body1"
                        fontWeight={700}
                        noWrap
                        sx={{
                          fontSize: 14,
                          lineHeight: 1.3,
                          '&:hover': { color: 'primary.main' },
                        }}
                      >
                        {song.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" fontWeight={500} sx={{ mt: 0.25, display: 'block' }}>
                        {song.createdAt ? new Date(song.createdAt).getFullYear() : 'Single'}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            )}

            {/* ── 3. TUYỂN TẬP (Curated Collections - Generated specifically from this artist's top songs) ── */}
            {artistCollections.length > 0 && (
              <Box sx={{ width: '100%' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                  <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.3px', fontSize: { xs: 20, sm: 22 } }}>
                    Tuyển Tập
                  </Typography>
                  {artistCollections.length > 5 && (
                    <Button
                      endIcon={<ChevronRightIcon />}
                      onClick={() => setActiveTab(3)}
                      sx={{
                        fontWeight: 800,
                        fontSize: 13,
                        textTransform: 'uppercase',
                        color: 'text.secondary',
                        letterSpacing: 0.5,
                        '&:hover': { color: 'primary.main', bgcolor: 'transparent' },
                      }}
                    >
                      TẤT CẢ
                    </Button>
                  )}
                </Stack>

                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: 'repeat(2, 1fr)',
                      sm: 'repeat(3, 1fr)',
                      md: 'repeat(5, 1fr)',
                    },
                    gap: 2.5,
                    width: '100%',
                  }}
                >
                  {artistCollections.slice(0, 5).map((col) => (
                    <Box
                      key={col.id}
                      onClick={() => navigate(getArtistCollectionPath(artistInfo, col.id))}
                      sx={{
                        cursor: 'pointer',
                        width: '100%',
                        '&:hover .col-overlay': { opacity: 1 },
                        '&:hover .col-img': { transform: 'scale(1.05)' },
                      }}
                    >
                      {/* Square 1:1 Aspect Ratio Cover */}
                      <Box
                        sx={{
                          position: 'relative',
                          width: '100%',
                          aspectRatio: '1 / 1',
                          borderRadius: 2,
                          overflow: 'hidden',
                          bgcolor: (theme) =>
                            theme.palette.mode === 'dark' ? '#18122b' : '#ffffff',
                          border: '1px solid',
                          borderColor: 'divider',
                          mb: 1.25,
                        }}
                      >
                        {col.isBestOf ? (
                          /* ZingMP3-Style Poster for "HAY NHẤT CỦA [Nghệ Sĩ]" */
                          <Box
                            className="col-img"
                            sx={{
                              width: '100%',
                              height: '100%',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              p: { xs: 1, sm: 1.25 },
                              transition: 'transform 0.3s ease',
                              background: (theme) =>
                                theme.palette.mode === 'dark'
                                  ? 'linear-gradient(180deg, #1c1538 0%, #110d24 100%)'
                                  : 'linear-gradient(180deg, #f1f0f7 0%, #e5e3f1 100%)',
                            }}
                          >
                            <Box sx={{ textAlign: 'center', width: '100%', pt: 0.5 }}>
                              <Typography
                                sx={{
                                  fontSize: { xs: 8.5, sm: 9.5 },
                                  fontWeight: 800,
                                  letterSpacing: '1.5px',
                                  color: (theme) =>
                                    theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.75)' : '#475569',
                                  textTransform: 'uppercase',
                                  lineHeight: 1.2,
                                }}
                              >
                                HAY NHẤT CỦA
                              </Typography>
                              <Typography
                                noWrap
                                sx={{
                                  fontSize: { xs: 12.5, sm: 14.5 },
                                  fontWeight: 900,
                                  color: (theme) =>
                                    theme.palette.mode === 'dark' ? '#ff4b72' : '#dc2626',
                                  letterSpacing: '-0.3px',
                                  lineHeight: 1.2,
                                  mt: 0.25,
                                }}
                              >
                                {artistInfo.name}
                              </Typography>
                            </Box>

                            <Box
                              sx={{
                                width: '100%',
                                flex: 1,
                                mt: 0.75,
                                borderRadius: 1.5,
                                overflow: 'hidden',
                                position: 'relative',
                              }}
                            >
                              <Box
                                component="img"
                                src={artistInfo.avatar || col.imageUrl}
                                alt={col.title}
                                sx={{
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'cover',
                                  objectPosition: 'center 20%',
                                  display: 'block',
                                }}
                              />
                            </Box>
                          </Box>
                        ) : (
                          <Box
                            component="img"
                            src={col.imageUrl}
                            alt={col.title}
                            className="col-img"
                            sx={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                              display: 'block',
                              transition: 'transform 0.3s ease',
                            }}
                          />
                        )}
                        {/* Play Hover Overlay */}
                        <Box
                          className="col-overlay"
                          sx={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            bgcolor: 'rgba(0,0,0,0.4)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            opacity: 0,
                            transition: 'opacity 0.2s ease',
                          }}
                        >
                          <Box
                            onClick={(e) => {
                              e.stopPropagation();
                              playCollection(col);
                            }}
                            sx={{
                              width: 44,
                              height: 44,
                              borderRadius: '50%',
                              bgcolor: 'primary.main',
                              color: '#fff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              boxShadow: '0 4px 14px rgba(108, 99, 255, 0.5)',
                            }}
                          >
                            <PlayIcon sx={{ fontSize: 26 }} />
                          </Box>
                        </Box>
                      </Box>

                      {/* Collection Name & Subtitle */}
                      <Typography
                        variant="body1"
                        fontWeight={700}
                        noWrap
                        sx={{
                          fontSize: 14,
                          lineHeight: 1.3,
                          '&:hover': { color: 'primary.main' },
                        }}
                      >
                        {col.title}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        noWrap
                        sx={{ mt: 0.25, display: 'block' }}
                      >
                        {col.subtitle}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            )}

            {/* ── 4. VỀ [TÊN NGHỆ SĨ] (Matching Image 3 Template Exactly) ── */}
            <Box sx={{ width: '100%' }}>
              <Typography variant="h5" sx={{ fontWeight: 800, mb: 2, letterSpacing: '-0.3px', fontSize: { xs: 20, sm: 22 } }}>
                Về {artistInfo.name}
              </Typography>

              <Paper
                elevation={0}
                sx={{
                  p: { xs: 2.5, md: 3.5 },
                  borderRadius: 2,
                  bgcolor: (theme) =>
                    theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                  border: '1px solid',
                  borderColor: 'divider',
                  boxShadow: 'none',
                }}
              >
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: '300px 1fr' },
                    gap: { xs: 2.5, md: 4 },
                    alignItems: 'stretch',
                  }}
                >
                  {/* Left Column: Portrait Artist Photo (Matching Image 3) */}
                  <Box
                    sx={{
                      width: '100%',
                      height: { xs: 260, md: 340 },
                      borderRadius: 2,
                      overflow: 'hidden',
                      bgcolor: 'action.hover',
                      flexShrink: 0,
                    }}
                  >
                    <Box
                      component="img"
                      src={artistInfo.avatar || '/placeholder-avatar.jpg'}
                      alt={artistInfo.name}
                      sx={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                      }}
                    />
                  </Box>

                  {/* Right Column: Bio text & Follower count (Matching Image 3) */}
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      py: 0.5,
                    }}
                  >
                    {/* Bio Section */}
                    <Box>
                      {artistInfo.bio ? (
                        <>
                          <Typography
                            variant="body2"
                            sx={{
                              color: 'text.secondary',
                              lineHeight: 1.85,
                              fontSize: 14.5,
                              whiteSpace: 'pre-line',
                              display: '-webkit-box',
                              WebkitLineClamp: 7,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                            }}
                          >
                            {artistInfo.bio}
                          </Typography>
                          <Button
                            size="small"
                            onClick={() => setBioDialogOpen(true)}
                            sx={{
                              p: 0,
                              mt: 1.5,
                              minWidth: 0,
                              fontSize: 13,
                              fontWeight: 800,
                              color: 'primary.main',
                              textTransform: 'uppercase',
                              letterSpacing: 0.5,
                              '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' },
                            }}
                          >
                            ... XEM THÊM
                          </Button>
                        </>
                      ) : (
                        <Typography
                          variant="body2"
                          sx={{
                            color: 'text.secondary',
                            lineHeight: 1.8,
                            fontSize: 14.5,
                            fontStyle: 'italic',
                          }}
                        >
                          Chưa có thông tin về nghệ sĩ này.
                        </Typography>
                      )}
                    </Box>

                    {/* Bottom Stat: Followers Count (Matching Image 3 format) */}
                    <Box sx={{ mt: 3, pt: 2 }}>
                      <Typography
                        variant="h5"
                        sx={{
                          fontWeight: 800,
                          fontSize: 24,
                          color: 'text.primary',
                          letterSpacing: '-0.5px',
                        }}
                      >
                        {Number(followersCount || 0).toLocaleString('vi-VN')}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          color: 'text.secondary',
                          fontWeight: 500,
                          fontSize: 14,
                          mt: 0.25,
                        }}
                      >
                        Người quan tâm
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              </Paper>
            </Box>
          </Stack>
        )}

        {/* ========================================================================= */}
        {/* TAB 1: BÀI HÁT (All Songs List)                                          */}
        {/* ========================================================================= */}
        {!loading && activeTab === 1 && (
          <Paper
            elevation={0}
            sx={{
              p: { xs: 2, md: 3 },
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.paper',
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2.5 }}>
              <Typography variant="h5" fontWeight={800} sx={{ fontSize: { xs: 18, sm: 20 } }}>
                Tất Cả Bài Hát ({songs.length})
              </Typography>
              <Button
                variant="contained"
                disabled={!songs.length}
                onClick={playAll}
                startIcon={<PlayIcon />}
                size="small"
                sx={{
                  background: 'linear-gradient(135deg, #6c63ff 0%, #00bcd4 100%)',
                  color: '#fff',
                  borderRadius: '9999px',
                  fontWeight: 700,
                  px: 2.5,
                }}
              >
                Phát tất cả
              </Button>
            </Stack>

            <Stack spacing={1}>
              {songs.map((song, idx) => (
                <ClientSongItem
                  key={song._id}
                  song={song}
                  index={idx + 1}
                  isCurrent={currentSong?._id === song._id}
                  isPlaying={isPlaying && currentSong?._id === song._id}
                  onPlay={() => playSong(song, { queue: songs })}
                  showDuration={true}
                  sx={{ borderRadius: 1.5 }}
                />
              ))}

              {!songs.length && (
                <Typography color="text.secondary" sx={{ py: 6, textAlign: 'center', fontWeight: 600 }}>
                  Không có bài hát nào.
                </Typography>
              )}
            </Stack>
          </Paper>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: SINGLE & EP (All Singles Grid)                                    */}
        {/* ========================================================================= */}
        {!loading && activeTab === 2 && (
          <Box sx={{ width: '100%' }}>
            <Typography variant="h5" fontWeight={800} sx={{ mb: 2.5, fontSize: { xs: 18, sm: 20 } }}>
              Single & EP ({songs.length})
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: 'repeat(2, 1fr)',
                  sm: 'repeat(3, 1fr)',
                  md: 'repeat(5, 1fr)',
                },
                gap: 2.5,
                width: '100%',
              }}
            >
              {songs.map((song) => (
                <Box
                  key={song._id}
                  onClick={() => playSong(song, { queue: songs })}
                  sx={{
                    cursor: 'pointer',
                    width: '100%',
                    '&:hover .cover-overlay': { opacity: 1 },
                    '&:hover .cover-img': { transform: 'scale(1.05)' },
                  }}
                >
                  <Box
                    sx={{
                      position: 'relative',
                      width: '100%',
                      aspectRatio: '1 / 1',
                      borderRadius: 2,
                      overflow: 'hidden',
                      bgcolor: (theme) =>
                        theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                      border: '1px solid',
                      borderColor: 'divider',
                      mb: 1.25,
                    }}
                  >
                    <Box
                      component="img"
                      src={song.imageUrl || artistInfo.avatar || '/placeholder-music.jpg'}
                      alt={song.title}
                      className="cover-img"
                      sx={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                        transition: 'transform 0.3s ease',
                      }}
                    />
                    <Box
                      className="cover-overlay"
                      sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        bgcolor: 'rgba(0,0,0,0.4)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: 0,
                        transition: 'opacity 0.2s ease',
                      }}
                    >
                      <Box
                        sx={{
                          width: 46,
                          height: 46,
                          borderRadius: '50%',
                          bgcolor: 'primary.main',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 4px 14px rgba(108, 99, 255, 0.5)',
                        }}
                      >
                        <PlayIcon sx={{ fontSize: 28 }} />
                      </Box>
                    </Box>
                  </Box>
                  <Typography variant="body1" fontWeight={700} noWrap sx={{ fontSize: 14 }}>
                    {song.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.25, display: 'block' }}>
                    {song.createdAt ? new Date(song.createdAt).toLocaleDateString('vi-VN') : 'Single'}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: TUYỂN TẬP (Artist Curated Collections)                            */}
        {/* ========================================================================= */}
        {!loading && activeTab === 3 && (
          <Box sx={{ width: '100%' }}>
            <Typography variant="h5" fontWeight={800} sx={{ mb: 2.5, fontSize: { xs: 18, sm: 20 } }}>
              Tuyển Tập Của {artistInfo.name} ({artistCollections.length})
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: 'repeat(2, 1fr)',
                  sm: 'repeat(3, 1fr)',
                  md: 'repeat(5, 1fr)',
                },
                gap: 2.5,
                width: '100%',
              }}
            >
              {artistCollections.map((col) => (
                <Box
                  key={col.id}
                  onClick={() => navigate(getArtistCollectionPath(artistInfo, col.id))}
                  sx={{
                    cursor: 'pointer',
                    width: '100%',
                    '&:hover .col-overlay': { opacity: 1 },
                    '&:hover .col-img': { transform: 'scale(1.05)' },
                  }}
                >
                  <Box
                    sx={{
                      position: 'relative',
                      width: '100%',
                      aspectRatio: '1 / 1',
                      borderRadius: 2,
                      overflow: 'hidden',
                      bgcolor: (theme) =>
                        theme.palette.mode === 'dark' ? '#18122b' : '#ffffff',
                      border: '1px solid',
                      borderColor: 'divider',
                      mb: 1.25,
                    }}
                  >
                    {col.isBestOf ? (
                      /* ZingMP3-Style Poster for "HAY NHẤT CỦA [Nghệ Sĩ]" */
                      <Box
                        className="col-img"
                        sx={{
                          width: '100%',
                          height: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          p: { xs: 1, sm: 1.25 },
                          transition: 'transform 0.3s ease',
                          background: (theme) =>
                            theme.palette.mode === 'dark'
                              ? 'linear-gradient(180deg, #1c1538 0%, #110d24 100%)'
                              : 'linear-gradient(180deg, #f1f0f7 0%, #e5e3f1 100%)',
                        }}
                      >
                        <Box sx={{ textAlign: 'center', width: '100%', pt: 0.5 }}>
                          <Typography
                            sx={{
                              fontSize: { xs: 8.5, sm: 9.5 },
                              fontWeight: 800,
                              letterSpacing: '1.5px',
                              color: (theme) =>
                                theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.75)' : '#475569',
                              textTransform: 'uppercase',
                              lineHeight: 1.2,
                            }}
                          >
                            HAY NHẤT CỦA
                          </Typography>
                          <Typography
                            noWrap
                            sx={{
                              fontSize: { xs: 12.5, sm: 14.5 },
                              fontWeight: 900,
                              color: (theme) =>
                                theme.palette.mode === 'dark' ? '#ff4b72' : '#dc2626',
                              letterSpacing: '-0.3px',
                              lineHeight: 1.2,
                              mt: 0.25,
                            }}
                          >
                            {artistInfo.name}
                          </Typography>
                        </Box>

                        <Box
                          sx={{
                            width: '100%',
                            flex: 1,
                            mt: 0.75,
                            borderRadius: 1.5,
                            overflow: 'hidden',
                            position: 'relative',
                          }}
                        >
                          <Box
                            component="img"
                            src={artistInfo.avatar || col.imageUrl}
                            alt={col.title}
                            sx={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                              objectPosition: 'center 20%',
                              display: 'block',
                            }}
                          />
                        </Box>
                      </Box>
                    ) : (
                      <Box
                        component="img"
                        src={col.imageUrl}
                        alt={col.title}
                        className="col-img"
                        sx={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          display: 'block',
                          transition: 'transform 0.3s ease',
                        }}
                      />
                    )}
                    <Box
                      className="col-overlay"
                      sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        bgcolor: 'rgba(0,0,0,0.4)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: 0,
                        transition: 'opacity 0.2s ease',
                      }}
                    >
                      <Box
                        onClick={(e) => {
                          e.stopPropagation();
                          playCollection(col);
                        }}
                        sx={{
                          width: 46,
                          height: 46,
                          borderRadius: '50%',
                          bgcolor: 'primary.main',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 4px 14px rgba(108, 99, 255, 0.5)',
                        }}
                      >
                        <PlayIcon sx={{ fontSize: 28 }} />
                      </Box>
                    </Box>
                  </Box>
                  <Typography variant="body1" fontWeight={700} noWrap sx={{ fontSize: 14 }}>
                    {col.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap sx={{ mt: 0.25, display: 'block' }}>
                    {col.subtitle}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: GIỚI THIỆU (Biography / About)                                    */}
        {/* ========================================================================= */}
        {!loading && activeTab === 4 && (
          <Paper
            elevation={0}
            sx={{
              p: { xs: 3, md: 4 },
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.paper',
            }}
          >
            <Stack spacing={3.5}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} alignItems="center">
                <Avatar
                  src={artistInfo.avatar}
                  sx={{
                    width: 90,
                    height: 90,
                    border: '2px solid #6c63ff',
                    boxShadow: '0 4px 16px rgba(108,99,255,0.2)',
                  }}
                />
                <Box sx={{ textAlign: { xs: 'center', sm: 'left' } }}>
                  <Typography variant="h4" fontWeight={900}>
                    {artistInfo.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" fontWeight={600} sx={{ mt: 0.5 }}>
                    {Number(followersCount || 0).toLocaleString('vi-VN')} người theo dõi • {songs.length} tác phẩm
                  </Typography>
                </Box>
              </Stack>

              <Box>
                <Typography variant="h6" fontWeight={800} sx={{ mb: 1.5 }}>
                  Tiểu sử
                </Typography>
                <Typography
                  variant="body1"
                  color="text.secondary"
                  sx={{
                    lineHeight: 1.85,
                    fontSize: 15,
                    whiteSpace: 'pre-line',
                    fontStyle: artistInfo.bio ? 'normal' : 'italic',
                  }}
                >
                  {artistInfo.bio || 'Chưa có thông tin về nghệ sĩ này.'}
                </Typography>
              </Box>

              {/* Stats overview */}
              <Box>
                <Typography variant="h6" fontWeight={800} sx={{ mb: 2 }}>
                  Thống kê
                </Typography>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' },
                    gap: 2,
                  }}
                >
                  <Paper
                    elevation={0}
                    sx={{ p: 2, borderRadius: 2, bgcolor: 'action.hover', textAlign: 'center' }}
                  >
                    <Typography variant="h5" fontWeight={900} color="primary.main">
                      {formatNumber(followersCount)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" fontWeight={700}>
                      Quan tâm
                    </Typography>
                  </Paper>
                  <Paper
                    elevation={0}
                    sx={{ p: 2, borderRadius: 2, bgcolor: 'action.hover', textAlign: 'center' }}
                  >
                    <Typography variant="h5" fontWeight={900} color="#00bcd4">
                      {songs.length}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" fontWeight={700}>
                      Bài hát
                    </Typography>
                  </Paper>
                  <Paper
                    elevation={0}
                    sx={{ p: 2, borderRadius: 2, bgcolor: 'action.hover', textAlign: 'center' }}
                  >
                    <Typography variant="h5" fontWeight={900} color="primary.main">
                      {formatNumber(totalPlays)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" fontWeight={700}>
                      Lượt phát
                    </Typography>
                  </Paper>
                  <Paper
                    elevation={0}
                    sx={{ p: 2, borderRadius: 2, bgcolor: 'action.hover', textAlign: 'center' }}
                  >
                    <Typography variant="h5" fontWeight={900} color="#00bcd4">
                      {formatNumber(totalLikesCount)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" fontWeight={700}>
                      Yêu thích
                    </Typography>
                  </Paper>
                </Box>
              </Box>
            </Stack>
          </Paper>
        )}
      </Stack>

      {/* ========================================================================= */}
      {/* DIALOG: Tiểu sử đầy đủ của nghệ sĩ                                       */}
      {/* ========================================================================= */}
      <Dialog
        open={bioDialogOpen}
        onClose={() => setBioDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2.5,
            p: 1.5,
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
          },
        }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
          <Typography variant="h6" fontWeight={800}>
            Tiểu sử {artistInfo.name}
          </Typography>
          <IconButton onClick={() => setBioDialogOpen(false)} size="small">
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ borderColor: 'divider' }}>
          <Stack direction="row" spacing={2.5} alignItems="center" sx={{ mb: 2.5 }}>
            <Avatar
              src={artistInfo.avatar}
              sx={{ width: 64, height: 64, border: '2px solid #6c63ff' }}
            />
            <Box>
              <Typography variant="subtitle1" fontWeight={800}>
                {artistInfo.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {Number(followersCount || 0).toLocaleString('vi-VN')} người quan tâm
              </Typography>
            </Box>
          </Stack>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              lineHeight: 1.85,
              fontSize: 14.5,
              whiteSpace: 'pre-line',
              fontStyle: artistInfo.bio ? 'normal' : 'italic',
            }}
          >
            {artistInfo.bio || 'Chưa có thông tin về nghệ sĩ này.'}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ pt: 2 }}>
          <Button
            onClick={() => setBioDialogOpen(false)}
            variant="contained"
            sx={{
              borderRadius: '9999px',
              px: 3,
              bgcolor: 'primary.main',
              fontWeight: 700,
            }}
          >
            Đóng
          </Button>
        </DialogActions>
      </Dialog>

      {/* Share Artist Modal (mimicking song share modal) */}
      <ShareArtistModal
        open={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        artist={artistInfo}
      />
    </ClientLayout>
  );
}

export default ClientArtist;
