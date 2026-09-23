import { useEffect, useState, useMemo } from 'react';
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
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  ArrowBackRounded as ArrowBackIcon,
  PlayArrowRounded as PlayIcon,
  MusicNoteRounded as MusicIcon,
  FeaturedPlayListRounded as PlaylistCategoryIcon,
  HeadphonesRounded as PlayCountIcon,
  PersonAddRounded as FollowIcon,
  PersonRemoveRounded as UnfollowIcon,
  CheckRounded as CheckIcon,
} from '@mui/icons-material';
import ClientLayout from '../../components/Layout/client/ClientLayout';
import ClientSongItem from '../../components/Layout/client/ClientSongItem';
import { clientPlaylistsApi, clientArtistApi, clientSongsApi } from '../../services/client/client.service';
import { useClientPlayer, useClientPlayerActions } from '../../components/Layout/client/ClientPlayerProvider';
import useAppToast from '../../components/common/useAppToast';
import { getArtistPath, toZingArtistSlug } from '../../utils/shareUtil';

function formatNumber(num) {
  if (!num && num !== 0) return '0';
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return Number(num).toLocaleString('vi-VN');
}

function ClientPlaylist() {
  const navigate = useNavigate();
  const location = useLocation();
  const { playlistId } = useParams();
  const { playSong } = useClientPlayerActions();
  const { currentSong, isPlaying } = useClientPlayer();
  const { showToast } = useAppToast();

  const [playlist, setPlaylist] = useState(null);
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Participating artists follow state
  const [followMap, setFollowMap] = useState({});
  const [artistFollowers, setArtistFollowers] = useState({});

  const isLoggedIn = Boolean(localStorage.getItem('role')) || Boolean(localStorage.getItem('accessToken')) || Boolean(localStorage.getItem('userId'));

  const openLoginModal = () => {
    const nextParams = new URLSearchParams(location.search);
    nextParams.set('auth', 'login');
    navigate(`${location.pathname}?${nextParams.toString()}`);
  };

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    let isMounted = true;

    const fetchPlaylistData = async () => {
      try {
        setLoading(true);
        setError('');

        if (!playlistId) return;

        // Check if this is an automated Artist Collection (e.g. artist-{artistSlugOrId}-{collectionType})
        const isArtistCol = playlistId.startsWith('artist-') || /-(best_songs|top_hits|recent_releases|all_songs)$/.test(playlistId);

        if (isArtistCol) {
          let aId = '';
          let colType = 'best_songs';

          const colMatch = playlistId.match(/^(?:artist-)?(.+)-(best_songs|top_hits|recent_releases|all_songs)$/);
          if (colMatch) {
            aId = colMatch[1];
            colType = colMatch[2];
          } else {
            const raw = playlistId.replace(/^artist-/, '');
            const lastDash = raw.lastIndexOf('-');
            if (lastDash > 0) {
              aId = raw.slice(0, lastDash);
              colType = raw.slice(lastDash + 1);
            } else {
              aId = raw;
            }
          }

          const [profRes, sRes] = await Promise.allSettled([
            clientArtistApi.getProfile(aId),
            clientSongsApi.search({ artistId: aId }),
          ]);

          if (!isMounted) return;

          const artist = profRes.status === 'fulfilled' && profRes.value?.data?.artist ? profRes.value.data.artist : {};
          const allSongs = sRes.status === 'fulfilled' && Array.isArray(sRes.value?.data) ? sRes.value.data : (artist.songs || []);

          // Canonicalize address bar URL to clean artist slug (e.g. /playlists/artist-MIN-best_songs)
          const cleanSlug = artist.slug || (artist.name ? toZingArtistSlug(artist.name) : '');
          if (cleanSlug) {
            const targetUrl = `/playlists/artist-${cleanSlug}-${colType}`;
            if (location.pathname !== targetUrl) {
              navigate(`${targetUrl}${location.search}`, { replace: true });
            }
          }

          let targetSongs = allSongs;
          let title = `Tuyển Tập ${artist.name || 'Nghệ Sĩ'}`;
          let desc = `Tuyển tập các ca khúc chọn lọc của ${artist.name || 'nghệ sĩ'}`;

          if (colType === 'best_songs') {
            const sorted = [...allSongs].sort((a, b) => ((b.playCount || 0) * 1.5 + (b.likeCount || 0) * 2) - ((a.playCount || 0) * 1.5 + (a.likeCount || 0) * 2));
            targetSongs = sorted.slice(0, 10);
            title = `Những Bài Hát Hay Nhất Của ${artist.name || 'Nghệ Sĩ'}`;
            desc = `Tuyển tập các ca khúc đỉnh nhất và được yêu thích nhất của ${artist.name || 'nghệ sĩ'}`;
          } else if (colType === 'top_hits') {
            const sorted = [...allSongs].sort((a, b) => (b.playCount || 0) - (a.playCount || 0));
            targetSongs = sorted.slice(0, 10);
            title = `Top Hits ${artist.name || 'Nghệ Sĩ'}`;
            desc = `Tuyển tập các ca khúc có lượt nghe nhiều nhất của ${artist.name || 'nghệ sĩ'}`;
          } else if (colType === 'recent_releases') {
            const sorted = [...allSongs].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
            targetSongs = sorted.slice(0, 10);
            title = `Tuyển Tập Ca Khúc Mới Nhất`;
            desc = `Phát hành gần đây của ${artist.name || 'nghệ sĩ'}`;
          } else {
            title = `Trọn Bộ Tuyển Tập ${artist.name || 'Nghệ Sĩ'}`;
            desc = `Toàn bộ ${allSongs.length} tác phẩm của ${artist.name || 'nghệ sĩ'} trên MusicFlow`;
          }

          const playlistData = {
            _id: cleanSlug ? `artist-${cleanSlug}-${colType}` : playlistId,
            name: title,
            description: desc,
            coverImage: targetSongs[0]?.imageUrl || artist.avatar || '',
            createdBy: { name: 'MusicFlow Tuyển Tập' },
            songs: targetSongs,
            isArtistCollection: true,
            isBestOf: colType === 'best_songs',
            artist,
          };

          setPlaylist(playlistData);
          setSongs(targetSongs);
        } else {
          // Standard User / System Playlist from DB
          const response = isLoggedIn
            ? await clientPlaylistsApi.getById(playlistId)
            : await clientPlaylistsApi.getSystemById(playlistId);

          if (!isMounted) return;

          const playlistData = response.data?.playlist || null;
          setPlaylist(playlistData);
          setSongs(Array.isArray(playlistData?.songs) ? playlistData.songs : []);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.response?.data?.message || 'Không thể tải dữ liệu tuyển tập/playlist.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchPlaylistData();

    return () => {
      isMounted = false;
    };
  }, [playlistId, isLoggedIn]);

  // Extract all participating artists across all songs in this playlist
  const participatingArtists = useMemo(() => {
    const map = new Map();
    songs.forEach((song) => {
      if (Array.isArray(song.artists)) {
        song.artists.forEach((artist) => {
          if (artist && (artist._id || artist.id)) {
            const id = String(artist._id || artist.id);
            if (!map.has(id)) {
              map.set(id, {
                _id: id,
                name: artist.name || 'Nghệ sĩ',
                slug: artist.slug || (artist.name ? toZingArtistSlug(artist.name) : ''),
                avatar: artist.avatar || '',
                followers: artist.followersCount || artist.followers || 0,
              });
            }
          }
        });
      }
    });
    return Array.from(map.values());
  }, [songs]);

  // Fetch follow status for participating artists
  useEffect(() => {
    const artistIds = participatingArtists.map((a) => a._id);
    if (!artistIds.length) return;

    const initialFollowers = {};
    participatingArtists.forEach((a) => {
      initialFollowers[a._id] = a.followers;
    });
    setArtistFollowers(initialFollowers);

    if (isLoggedIn) {
      clientArtistApi
        .getBatchFollowStatus(artistIds)
        .then((res) => {
          if (res.data?.followStatusMap) {
            setFollowMap(res.data.followStatusMap);
          }
        })
        .catch(() => {});
    }
  }, [participatingArtists, isLoggedIn]);

  const handleToggleFollowArtist = async (artist) => {
    if (!isLoggedIn) {
      showToast({
        message: 'Vui lòng đăng nhập để quan tâm nghệ sĩ này.',
        severity: 'warning',
      });
      openLoginModal();
      return;
    }

    try {
      const res = await clientArtistApi.toggleFollow(artist._id);
      if (res?.data?.success) {
        const isNowFollowing = res.data.isFollowing;
        setFollowMap((prev) => ({ ...prev, [artist._id]: isNowFollowing }));
        if (typeof res.data.followers === 'number') {
          setArtistFollowers((prev) => ({ ...prev, [artist._id]: res.data.followers }));
        } else {
          setArtistFollowers((prev) => ({
            ...prev,
            [artist._id]: Math.max(0, (prev[artist._id] || 0) + (isNowFollowing ? 1 : -1)),
          }));
        }
        showToast({
          message: isNowFollowing ? `Đã quan tâm ${artist.name}` : `Đã bỏ quan tâm ${artist.name}`,
          severity: 'success',
        });
      }
    } catch {
      showToast({
        message: 'Không thể cập nhật trạng thái quan tâm. Vui lòng thử lại.',
        severity: 'error',
      });
    }
  };

  const totalPlays = useMemo(() => {
    return songs.reduce((sum, s) => sum + (s.playCount || 0), 0);
  }, [songs]);

  const playAll = () => {
    if (!songs.length) return;
    playSong(songs[0], { queue: songs });
  };

  const handleRemoveSongFromPlaylist = async (songToRemove) => {
    const sId = songToRemove?._id || songToRemove?.id;
    if (!sId || !playlistId || playlist?.isArtistCollection) return;

    try {
      await clientPlaylistsApi.removeSong(playlistId, sId);
      setSongs((prev) => prev.filter((s) => (s._id || s.id) !== sId));
      showToast({
        severity: 'success',
        message: `Đã xóa bài hát "${songToRemove.title || 'này'}" khỏi playlist.`,
      });
    } catch (err) {
      showToast({
        severity: 'error',
        message: err.response?.data?.message || 'Có lỗi xảy ra khi xóa bài hát.',
      });
    }
  };

  return (
    <ClientLayout title={playlist?.name ? `${playlist.name} - MusicFlow` : 'Chi tiết Tuyển tập'}>
      {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>}

      <Stack spacing={4}>
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
              borderRadius: 2,
              px: 2.5,
              py: 0.75,
              fontWeight: 700,
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

        {/* Dynamic Premium Header Banner */}
        <Box
          sx={{
            position: 'relative',
            borderRadius: 2.5,
            overflow: 'hidden',
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: (theme) => theme.palette.mode === 'dark' ? '#120f1f' : '#f8f8fb',
            boxShadow: '0 8px 24px rgba(0,0,0,0.02)',
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
                filter: 'blur(35px) brightness(0.6)',
                opacity: (theme) => (theme.palette.mode === 'dark' ? 0.3 : 0.16),
                zIndex: 0,
                transform: 'scale(1.2)',
              }}
            />
          )}

          {/* Banner Contents */}
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
              alignItems="center"
              justifyContent="space-between"
            >
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={3}
                alignItems="center"
                sx={{ textAlign: { xs: 'center', sm: 'left' }, minWidth: 0, width: '100%' }}
              >
                {/* Square Album / Playlist Cover */}
                {playlist?.isBestOf ? (
                  <Box
                    sx={{
                      width: { xs: 120, sm: 140, md: 155 },
                      height: { xs: 120, sm: 140, md: 155 },
                      borderRadius: 2,
                      border: '3px solid',
                      borderColor: 'background.paper',
                      boxShadow: '0 8px 24px rgba(108,99,255,0.25)',
                      flexShrink: 0,
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      p: 1.25,
                      background: (theme) =>
                        theme.palette.mode === 'dark'
                          ? 'linear-gradient(180deg, #1c1538 0%, #110d24 100%)'
                          : 'linear-gradient(180deg, #f1f0f7 0%, #e5e3f1 100%)',
                    }}
                  >
                    <Box sx={{ textAlign: 'center', width: '100%' }}>
                      <Typography
                        sx={{
                          fontSize: 9,
                          fontWeight: 800,
                          letterSpacing: '1.2px',
                          color: (theme) =>
                            theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.75)' : '#475569',
                          textTransform: 'uppercase',
                        }}
                      >
                        HAY NHẤT CỦA
                      </Typography>
                      <Typography
                        noWrap
                        sx={{
                          fontSize: 13,
                          fontWeight: 900,
                          color: (theme) =>
                            theme.palette.mode === 'dark' ? '#ff4b72' : '#dc2626',
                          letterSpacing: '-0.3px',
                        }}
                      >
                        {playlist?.artist?.name || 'Nghệ Sĩ'}
                      </Typography>
                    </Box>
                    <Box
                      sx={{
                        width: '100%',
                        flex: 1,
                        mt: 0.75,
                        borderRadius: 1.5,
                        overflow: 'hidden',
                      }}
                    >
                      <Box
                        component="img"
                        src={playlist?.artist?.avatar || playlist?.coverImage}
                        alt={playlist?.name}
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
                  <Avatar
                    src={playlist?.coverImage || ''}
                    variant="rounded"
                    sx={{
                      width: { xs: 120, sm: 140, md: 155 },
                      height: { xs: 120, sm: 140, md: 155 },
                      bgcolor: 'primary.main',
                      fontSize: { xs: 44, md: 54 },
                      fontWeight: 900,
                      borderRadius: 2,
                      boxShadow: '0 8px 24px rgba(108,99,255,0.25)',
                      border: '3px solid',
                      borderColor: 'background.paper',
                      flexShrink: 0,
                    }}
                  >
                    {(playlist?.name || 'P').charAt(0)}
                  </Avatar>
                )}

                <Box sx={{ minWidth: 0 }}>
                  <Chip
                    icon={<PlaylistCategoryIcon style={{ fontSize: 13, color: '#fff' }} />}
                    label={playlist?.isArtistCollection ? 'TUYỂN TẬP' : 'PLAYLIST'}
                    size="small"
                    sx={{
                      bgcolor: '#6c63ff',
                      color: '#fff',
                      fontWeight: 800,
                      fontSize: 10.5,
                      letterSpacing: 1.2,
                      px: 0.5,
                      mb: 1.5,
                    }}
                  />
                  <Typography
                    variant="h1"
                    fontWeight={900}
                    noWrap
                    sx={{
                      fontSize: { xs: 24, sm: 32, md: 36 },
                      letterSpacing: '-0.5px',
                      lineHeight: 1.2,
                      mb: 1,
                    }}
                  >
                    {playlist?.name || 'Tuyển tập'}
                  </Typography>

                  {playlist?.description && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        fontWeight: 500,
                        mb: 1.5,
                        maxWidth: 650,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        lineHeight: 1.6,
                      }}
                    >
                      {playlist.description}
                    </Typography>
                  )}

                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: { xs: 'center', sm: 'flex-start' },
                      gap: 1,
                      flexWrap: 'wrap',
                    }}
                  >
                    <span style={{ color: 'var(--mui-palette-text-primary, inherit)' }}>
                      {songs.length} bài hát
                    </span>
                    <span>•</span>
                    <span>Tạo bởi {playlist?.createdBy?.name || 'MusicFlow Tuyển Tập'}</span>
                    {totalPlays > 0 && (
                      <>
                        <span>•</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <PlayCountIcon sx={{ fontSize: 15, color: 'primary.main' }} />
                          {formatNumber(totalPlays)} lượt phát
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
                    background: 'linear-gradient(135deg, #6c63ff 0%, #00bcd4 100%)',
                    color: '#fff',
                    px: { xs: 3, sm: 4 },
                    py: 1.25,
                    borderRadius: '9999px',
                    fontSize: 14.5,
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    boxShadow: '0 6px 20px rgba(108, 99, 255, 0.35)',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #594fe6 0%, #00acc1 100%)',
                      transform: 'translateY(-2px)',
                      boxShadow: '0 10px 24px rgba(108, 99, 255, 0.45)',
                    },
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
            p: { xs: 2.5, md: 3.5 },
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
          }}
        >
          <Typography variant="h5" sx={{ fontWeight: 800, mb: 2.5, letterSpacing: '-0.3px', fontSize: { xs: 18, sm: 20 } }}>
            Danh sách bài hát
          </Typography>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
              <CircularProgress size={36} sx={{ color: 'primary.main' }} />
            </Box>
          ) : (
            <Stack spacing={1}>
              {songs.map((song, index) => (
                <ClientSongItem
                  key={song._id || song.id}
                  song={song}
                  index={index + 1}
                  isCurrent={currentSong?._id === (song._id || song.id)}
                  isPlaying={isPlaying && currentSong?._id === (song._id || song.id)}
                  onPlay={() => playSong(song, { queue: songs })}
                  showDuration={true}
                  onRemoveFromPlaylist={!playlist?.isArtistCollection ? () => handleRemoveSongFromPlaylist(song) : undefined}
                  sx={{ borderRadius: 1.5 }}
                />
              ))}

              {!songs.length && (
                <Typography color="text.secondary" sx={{ py: 6, textAlign: 'center', fontWeight: 600 }}>
                  Tuyển tập này chưa có bài hát nào.
                </Typography>
              )}
            </Stack>
          )}
        </Paper>

        {/* ========================================================================= */}
        {/* NGHỆ SĨ THAM GIA: Exactly matching ZingMP3 Template Screenshot           */}
        {/* ========================================================================= */}
        {participatingArtists.length > 0 && (
          <Box sx={{ width: '100%', pt: 2 }}>
            <Typography
              variant="h5"
              sx={{
                fontWeight: 800,
                letterSpacing: '-0.3px',
                fontSize: { xs: 20, sm: 22 },
                mb: 3,
              }}
            >
              Nghệ Sĩ Tham Gia
            </Typography>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: 'repeat(2, 1fr)',
                  sm: 'repeat(3, 1fr)',
                  md: 'repeat(5, 1fr)',
                },
                gap: 3,
                width: '100%',
              }}
            >
              {participatingArtists.map((art) => {
                const isFollowing = !!followMap[art._id];
                const followers = artistFollowers[art._id] ?? art.followers;

                return (
                  <Box
                    key={art._id}
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      textAlign: 'center',
                    }}
                  >
                    {/* Circular Avatar exactly matching ZingMP3 screenshot */}
                    <Avatar
                      src={art.avatar}
                      alt={art.name}
                      onClick={() => navigate(getArtistPath(art))}
                      sx={{
                        width: { xs: 110, sm: 125, md: 135 },
                        height: { xs: 110, sm: 125, md: 135 },
                        cursor: 'pointer',
                        mb: 1.5,
                        boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                        border: '2px solid transparent',
                        transition: 'all 0.25s ease',
                        '&:hover': {
                          transform: 'scale(1.05)',
                          borderColor: 'primary.main',
                        },
                      }}
                    >
                      {art.name.charAt(0)}
                    </Avatar>

                    {/* Artist Name */}
                    <Typography
                      variant="subtitle1"
                      fontWeight={750}
                      noWrap
                      onClick={() => navigate(getArtistPath(art))}
                      sx={{
                        cursor: 'pointer',
                        maxWidth: '100%',
                        fontSize: 14.5,
                        lineHeight: 1.3,
                        '&:hover': { color: 'primary.main' },
                      }}
                    >
                      {art.name}
                    </Typography>

                    {/* Follower Count */}
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      fontWeight={500}
                      sx={{ mt: 0.25, mb: 1.5, display: 'block' }}
                    >
                      {formatNumber(followers)} quan tâm
                    </Typography>

                    {/* Pill Follow Button */}
                    <Button
                      variant={isFollowing ? 'outlined' : 'contained'}
                      size="small"
                      onClick={() => handleToggleFollowArtist(art)}
                      startIcon={
                        isFollowing ? (
                          <UnfollowIcon sx={{ fontSize: 15 }} />
                        ) : (
                          <FollowIcon sx={{ fontSize: 15 }} />
                        )
                      }
                      sx={{
                        borderRadius: '9999px',
                        px: 2,
                        py: 0.6,
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                        bgcolor: isFollowing
                          ? 'background.paper'
                          : (theme) =>
                              theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                        color: isFollowing ? 'text.secondary' : 'text.primary',
                        borderColor: isFollowing ? 'divider' : 'transparent',
                        '&:hover': {
                          borderColor: 'primary.main',
                          color: 'primary.main',
                          bgcolor: isFollowing ? 'action.hover' : 'rgba(108,99,255,0.12)',
                        },
                      }}
                    >
                      {isFollowing ? 'ĐÃ QUAN TÂM' : 'QUAN TÂM'}
                    </Button>
                  </Box>
                );
              })}
            </Box>
          </Box>
        )}
      </Stack>
    </ClientLayout>
  );
}

export default ClientPlaylist;
