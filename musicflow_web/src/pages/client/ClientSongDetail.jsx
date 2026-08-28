import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  Box,
  Typography,
  Stack,
  Button,
  CircularProgress,
  Paper,
  Chip,
  IconButton,
  Tooltip,
  Divider,
  Grid,
  Avatar,
} from '@mui/material';
import {
  PlayArrowRounded as PlayIcon,
  PauseRounded as PauseIcon,
  ShareRounded as ShareIcon,
  FavoriteRounded as FavoriteIcon,
  FavoriteBorderRounded as FavoriteBorderIcon,
  MusicNoteRounded as MusicIcon,
  HeadphonesRounded as PlayCountIcon,
  AccessTimeRounded as DurationIcon,
  ArrowBackRounded as ArrowBackIcon,
  AutoAwesomeRounded as SparklesIcon,
} from '@mui/icons-material';
import ClientLayout from '../../components/Layout/client/ClientLayout';
import { clientSongsApi, clientFavoritesApi } from '../../services/client/client.service';
import { useClientPlayer, useClientPlayerActions } from '../../components/Layout/client/ClientPlayerProvider';
import ShareSongModal from '../../components/common/ShareSongModal';
import ClientSongMoreMenu from '../../components/Layout/client/ClientSongMoreMenu';
import useAppToast from '../../components/common/useAppToast';
import { parseLyrics } from '../../utils/lyrics';


function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function ClientSongDetail() {
  const navigate = useNavigate();
  const { songId, artistSlug, songSlug } = useParams();
  const { playSong, pauseSong, resumeSong } = useClientPlayerActions();
  const playerState = useClientPlayer();
  const { showToast } = useAppToast();

  const [song, setSong] = useState(null);
  const [relatedSongs, setRelatedSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likeLoading, setLikeLoading] = useState(false);

  // Check if this song is currently playing in global player
  const currentPlayingSong = playerState?.currentSong;
  const activeSongId = song?._id || song?.id || songId;
  const isPlayingThisSong = currentPlayingSong && (
    (activeSongId && (currentPlayingSong._id === activeSongId || currentPlayingSong.id === activeSongId)) ||
    (songSlug && currentPlayingSong.slug === songSlug)
  );
  const isAudioPlaying = isPlayingThisSong && playerState?.isPlaying;

  useEffect(() => {
    let isSubscribed = true;

    const fetchSongDetail = async () => {
      try {
        setLoading(true);
        setError('');
        let res;

        if (artistSlug && songSlug) {
          res = await clientSongsApi.getBySlug(artistSlug, songSlug);
        } else if (songId) {
          res = await clientSongsApi.getSongById(songId);
        } else {
          setError('Đường dẫn bài hát không hợp lệ.');
          setLoading(false);
          return;
        }

        if (isSubscribed && res.data?.success && res.data?.song) {
          const songData = res.data.song;
          setSong(songData);
          setRelatedSongs(res.data.relatedSongs || []);

          // Set Page Document Title
          const artistNames = Array.isArray(songData.artists)
            ? songData.artists.map((a) => (typeof a === 'object' ? a.name : a)).filter(Boolean).join(', ')
            : (songData.artist || '');
          document.title = `${songData.title} - ${artistNames || 'MusicFlow'} | MusicFlow`;
        }
      } catch (err) {
        if (isSubscribed) {
          const errMsg = err.response?.data?.message || 'Không thể tải thông tin bài hát hoặc bài hát đã bị ẩn.';
          setError(errMsg);
        }
      } finally {
        if (isSubscribed) {
          setLoading(false);
        }
      }
    };

    fetchSongDetail();

    return () => {
      isSubscribed = false;
    };
  }, [songId, artistSlug, songSlug]);

  // Check favorite status if user is logged in
  useEffect(() => {
    let isSubscribed = true;
    const token = localStorage.getItem('accessToken');
    const targetId = song?._id || song?.id || songId;
    if (!token || !targetId) return;

    clientFavoritesApi.check(targetId)
      .then((res) => {
        if (isSubscribed && res.data?.success) {
          setIsLiked(Boolean(res.data.isFavorite));
        }
      })
      .catch(() => {});

    return () => {
      isSubscribed = false;
    };
  }, [song?._id, song?.id, songId]);

  const handleToggleFavorite = async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      showToast({ message: 'Vui lòng đăng nhập để lưu bài hát yêu thích.', severity: 'warning' });
      return;
    }

    const targetId = song?._id || song?.id || songId;
    if (!targetId) return;

    try {
      setLikeLoading(true);
      if (isLiked) {
        await clientFavoritesApi.remove(targetId);
        setIsLiked(false);
        showToast({ message: 'Đã xóa khỏi bài hát yêu thích.', severity: 'info' });
      } else {
        await clientFavoritesApi.add(targetId);
        setIsLiked(true);
        showToast({ message: 'Đã thêm vào bài hát yêu thích! ❤️', severity: 'success' });
      }
    } catch {
      showToast({ message: 'Không thể cập nhật danh sách yêu thích.', severity: 'error' });
    } finally {

      setLikeLoading(false);
    }
  };

  const handlePlayMainSong = () => {
    if (!song) return;
    if (isPlayingThisSong) {
      if (isAudioPlaying) {
        pauseSong();
      } else {
        resumeSong();
      }
    } else {
      const queue = [song, ...relatedSongs];
      playSong(song, { queue });
      showToast({ message: `Đang phát: ${song.title}`, severity: 'info' });
    }
  };

  // Process lyrics
  const parsedLyrics = useMemo(() => {
    if (!song?.lyrics) return [];
    try {
      const result = parseLyrics(song.lyrics);
      if (result?.lines && result.lines.length > 0) return result.lines;
    } catch {
      // ignore
    }

    return song.lyrics.split('\n').filter(Boolean).map((t, idx) => ({ text: t, id: idx }));
  }, [song?.lyrics]);

  const artistList = useMemo(() => {
    if (!song?.artists) return [];
    return Array.isArray(song.artists) ? song.artists : [];
  }, [song?.artists]);

  const artistNamesText = useMemo(() => {
    if (!song) return '';
    return artistList.map((a) => (typeof a === 'object' ? a.name : a)).filter(Boolean).join(', ') || song.artist || 'Nghệ sĩ MusicFlow';
  }, [song, artistList]);

  if (loading) {
    return (
      <ClientLayout title="Đang tải bài hát...">
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 2 }}>
          <CircularProgress size={44} sx={{ color: '#6c63ff' }} />
          <Typography variant="body2" color="text.secondary">
            Đang tải thông tin bài hát...
          </Typography>
        </Box>
      </ClientLayout>
    );
  }

  if (error || !song) {
    return (
      <ClientLayout title="Không tìm thấy bài hát">
        <Box sx={{ maxWidth: 540, mx: 'auto', mt: 8, p: 4, textAlign: 'center' }}>
          <Paper
            elevation={0}
            sx={{
              p: 4,
              borderRadius: 4,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.paper',
              boxShadow: '0 12px 32px rgba(0,0,0,0.06)',
            }}
          >
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                bgcolor: 'rgba(239, 68, 68, 0.12)',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                mb: 2,
              }}
            >
              <MusicIcon sx={{ fontSize: 32 }} />
            </Box>
            <Typography variant="h6" fontWeight={800} gutterBottom>
              Không thể truy cập bài hát
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {error || 'Bài hát này không tồn tại, đã bị xóa hoặc đang ở chế độ riêng tư.'}
            </Typography>
            <Button
              variant="contained"
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate('/')}
              sx={{
                borderRadius: 2.5,
                px: 3,
                py: 1,
                fontWeight: 700,
                textTransform: 'none',
                bgcolor: '#6c63ff',
                '&:hover': { bgcolor: '#5b52e0' },
              }}
            >
              Khám phá bài hát khác
            </Button>
          </Paper>
        </Box>
      </ClientLayout>
    );
  }

  return (
    <ClientLayout title={`${song.title} - ${artistNamesText}`}>
      <Box sx={{ pb: 8 }}>
        {/* Top Back Navigation */}
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(-1)}
          sx={{
            mb: 2,
            color: 'text.secondary',
            textTransform: 'none',
            fontWeight: 700,
            '&:hover': { color: 'text.primary', bgcolor: 'transparent' },
          }}
        >
          Quay lại
        </Button>

        {/* ── HERO BANNER: Song Artwork & Key Details ── */}
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2.5, md: 4 },
            borderRadius: 4,
            border: '1px solid',
            borderColor: (theme) =>
              theme.palette.mode === 'dark' ? 'rgba(108, 99, 255, 0.2)' : 'rgba(108, 99, 255, 0.12)',
            backgroundImage: (theme) =>
              theme.palette.mode === 'dark'
                ? 'linear-gradient(135deg, rgba(30, 27, 75, 0.7), rgba(15, 23, 42, 0.9))'
                : 'linear-gradient(135deg, #ffffff, #f5f3ff)',
            backdropFilter: 'blur(20px)',
            mb: 4,
          }}
        >
          <Grid container spacing={{ xs: 3, md: 4 }} alignItems="center">
            {/* Artwork */}
            <Grid item xs={12} sm={4} md={3.5} sx={{ display: 'flex', justifyContent: 'center' }}>
              <Box
                sx={{
                  position: 'relative',
                  width: { xs: 200, sm: 220, md: 240 },
                  height: { xs: 200, sm: 220, md: 240 },
                  borderRadius: 3.5,
                  overflow: 'hidden',
                  boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.5)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                <Box
                  component="img"
                  src={song.imageUrl || 'https://res.cloudinary.com/dzuhbme19/image/upload/v1778857942/musicflow/topics/zj3dxcuhyknbmfsi5zvu.jpg'}
                  alt={song.title}
                  sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                {isAudioPlaying && (
                  <Box
                    sx={{
                      position: 'absolute',
                      inset: 0,
                      bgcolor: 'rgba(0,0,0,0.45)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'flex-end', height: 28 }}>
                      {[40, 100, 60, 85].map((h, i) => (
                        <Box
                          key={i}
                          sx={{
                            width: 5,
                            height: `${h}%`,
                            bgcolor: '#00bcd4',
                            borderRadius: 1,
                            animation: 'pulse 1s infinite alternate',
                          }}
                        />
                      ))}
                    </Box>
                  </Box>
                )}
              </Box>
            </Grid>

            {/* Song Meta Info */}
            <Grid item xs={12} sm={8} md={8.5}>
              <Stack spacing={2}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  <Chip
                    label="Bài hát chính thức"
                    size="small"
                    color="primary"
                    sx={{ fontWeight: 800, fontSize: 11, bgcolor: '#6c63ff' }}
                  />
                  {Array.isArray(song.topicIds) &&
                    song.topicIds.map((topic) => (
                      <Chip
                        key={topic._id || topic}
                        label={topic.name || 'Thể loại'}
                        size="small"
                        variant="outlined"
                        sx={{ fontWeight: 700, fontSize: 11 }}
                      />
                    ))}
                </Stack>

                <Typography
                  variant="h3"
                  sx={{
                    fontWeight: 900,
                    fontSize: { xs: '1.75rem', md: '2.5rem' },
                    lineHeight: 1.15,
                    letterSpacing: -0.5,
                  }}
                >
                  {song.title}
                </Typography>

                {/* Artists list */}
                <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
                  {artistList.map((artist) => (
                    <Stack
                      key={artist._id || artist.name}
                      component={artist._id ? Link : 'div'}
                      to={artist._id ? `/artists/${artist._id}` : undefined}
                      direction="row"
                      spacing={1}
                      alignItems="center"
                      sx={{
                        textDecoration: 'none',
                        color: 'inherit',
                        '&:hover': { color: 'primary.main' },
                      }}
                    >
                      <Avatar
                        src={artist.avatar}
                        sx={{ width: 28, height: 28, border: '1px solid rgba(108,99,255,0.4)' }}
                      >
                        {artist.name?.[0]}
                      </Avatar>
                      <Typography variant="subtitle1" fontWeight={700}>
                        {artist.name || artist}
                      </Typography>
                    </Stack>
                  ))}
                  {artistList.length === 0 && (
                    <Typography variant="subtitle1" fontWeight={700} color="text.secondary">
                      {song.artist || 'Nghệ sĩ MusicFlow'}
                    </Typography>
                  )}
                </Stack>

                {/* Stats */}
                <Stack direction="row" spacing={3} alignItems="center" sx={{ color: 'text.secondary' }}>
                  <Stack direction="row" spacing={0.75} alignItems="center">
                    <PlayCountIcon sx={{ fontSize: 18, color: '#00bcd4' }} />
                    <Typography variant="body2" fontWeight={700}>
                      {(song.playCount || 0).toLocaleString()} lượt nghe
                    </Typography>
                  </Stack>
                  <Stack direction="row" spacing={0.75} alignItems="center">
                    <DurationIcon sx={{ fontSize: 18 }} />
                    <Typography variant="body2" fontWeight={600}>
                      {formatDuration(song.duration)}
                    </Typography>
                  </Stack>
                </Stack>

                {/* Action Buttons */}
                <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" sx={{ pt: 1 }}>
                  {/* Main Play Button */}
                  <Button
                    variant="contained"
                    size="large"
                    onClick={handlePlayMainSong}
                    startIcon={isAudioPlaying ? <PauseIcon sx={{ fontSize: 24 }} /> : <PlayIcon sx={{ fontSize: 24 }} />}
                    sx={{
                      borderRadius: 3,
                      px: 3.5,
                      py: 1.25,
                      fontWeight: 800,
                      fontSize: '1rem',
                      textTransform: 'none',
                      bgcolor: '#6c63ff',
                      backgroundImage: 'linear-gradient(135deg, #6c63ff, #00bcd4)',
                      boxShadow: '0 8px 24px -4px rgba(108, 99, 255, 0.4)',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: '0 12px 28px -4px rgba(108, 99, 255, 0.5)',
                      },
                    }}
                  >
                    {isAudioPlaying ? 'Tạm dừng' : isPlayingThisSong ? 'Tiếp tục phát' : 'Phát bài hát'}
                  </Button>

                  {/* Favorite Button */}
                  <Tooltip title={isLiked ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'}>
                    <IconButton
                      onClick={handleToggleFavorite}
                      disabled={likeLoading}
                      sx={{
                        width: 46,
                        height: 46,
                        borderRadius: 2.5,
                        border: '1px solid',
                        borderColor: isLiked ? '#ec4899' : 'divider',
                        bgcolor: isLiked ? 'rgba(236, 72, 153, 0.12)' : 'background.paper',
                        color: isLiked ? '#ec4899' : 'text.secondary',
                        '&:hover': {
                          bgcolor: 'rgba(236, 72, 153, 0.2)',
                          color: '#ec4899',
                          borderColor: '#ec4899',
                        },
                      }}
                    >
                      {isLiked ? <FavoriteIcon /> : <FavoriteBorderIcon />}
                    </IconButton>
                  </Tooltip>

                  {/* Share Button */}
                  <Button
                    variant="outlined"
                    startIcon={<ShareIcon />}
                    onClick={() => setShareModalOpen(true)}
                    sx={{
                      borderRadius: 3,
                      px: 2.5,
                      py: 1.2,
                      fontWeight: 700,
                      textTransform: 'none',
                      borderColor: 'rgba(108, 99, 255, 0.35)',
                      color: 'text.primary',
                      '&:hover': {
                        borderColor: '#6c63ff',
                        bgcolor: 'rgba(108, 99, 255, 0.08)',
                      },
                    }}
                  >
                    Chia sẻ
                  </Button>

                  {/* More Menu */}
                  <ClientSongMoreMenu song={song} />
                </Stack>
              </Stack>
            </Grid>
          </Grid>
        </Paper>

        {/* ── LOWER SECTION: Lyrics & Related Songs ── */}
        <Grid container spacing={3}>
          {/* Lyrics Box */}
          <Grid item xs={12} md={7}>
            <Paper
              elevation={0}
              sx={{
                p: 3,
                borderRadius: 3.5,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                <SparklesIcon sx={{ color: '#6c63ff', fontSize: 20 }} />
                <Typography variant="h6" fontWeight={800} fontSize="1.1rem">
                  Lời bài hát (Lyrics)
                </Typography>
              </Stack>
              <Divider sx={{ mb: 2.5 }} />

              {parsedLyrics.length > 0 ? (
                <Box
                  sx={{
                    maxHeight: 450,
                    overflowY: 'auto',
                    pr: 1,
                    '&::-webkit-scrollbar': { width: 6 },
                    '&::-webkit-scrollbar-thumb': { borderRadius: 3, bgcolor: 'rgba(108, 99, 255, 0.2)' },
                  }}
                >
                  <Stack spacing={1.5}>
                    {parsedLyrics.map((line, idx) => (
                      <Typography
                        key={line.id || idx}
                        variant="body1"
                        sx={{
                          fontSize: '1.02rem',
                          lineHeight: 1.7,
                          color: 'text.primary',
                          fontWeight: 500,
                        }}
                      >
                        {line.text}
                      </Typography>
                    ))}
                  </Stack>
                </Box>
              ) : (
                <Box sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}>
                  <MusicIcon sx={{ fontSize: 40, opacity: 0.3, mb: 1 }} />
                  <Typography variant="body2">
                    Bài hát này hiện chưa có lời bài hát chính thức.
                  </Typography>
                </Box>
              )}
            </Paper>
          </Grid>

          {/* Related Songs */}
          <Grid item xs={12} md={5}>
            <Paper
              elevation={0}
              sx={{
                p: 3,
                borderRadius: 3.5,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper',
                height: '100%',
              }}
            >
              <Typography variant="h6" fontWeight={800} fontSize="1.1rem" sx={{ mb: 2 }}>
                Bài hát liên quan
              </Typography>
              <Divider sx={{ mb: 2 }} />

              {relatedSongs.length > 0 ? (
                <Stack spacing={1}>
                  {relatedSongs.map((relSong) => {
                    const isRelPlaying = currentPlayingSong && (currentPlayingSong._id === relSong._id || currentPlayingSong.id === relSong._id);
                    return (
                      <Stack
                        key={relSong._id}
                        direction="row"
                        alignItems="center"
                        spacing={1.5}
                        onClick={() => navigate(`/songs/${relSong._id}`)}
                        sx={{
                          p: 1.25,
                          borderRadius: 2.5,
                          cursor: 'pointer',
                          bgcolor: isRelPlaying ? 'rgba(108, 99, 255, 0.1)' : 'transparent',
                          transition: 'all 0.2s',
                          '&:hover': {
                            bgcolor: (theme) =>
                              theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                            transform: 'translateX(3px)',
                          },
                        }}
                      >
                        <Avatar
                          src={relSong.imageUrl}
                          variant="rounded"
                          sx={{ width: 44, height: 44, borderRadius: 2 }}
                        />
                        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                          <Typography
                            variant="subtitle2"
                            noWrap
                            sx={{
                              fontWeight: 700,
                              color: isRelPlaying ? '#6c63ff' : 'text.primary',
                            }}
                          >
                            {relSong.title}
                          </Typography>
                          <Typography variant="caption" noWrap color="text.secondary" sx={{ display: 'block' }}>
                            {Array.isArray(relSong.artists)
                              ? relSong.artists.map((a) => (typeof a === 'object' ? a.name : a)).filter(Boolean).join(', ')
                              : relSong.artist || 'MusicFlow Artist'}
                          </Typography>
                        </Box>

                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            playSong(relSong, { queue: [relSong, ...relatedSongs] });
                          }}
                          sx={{ color: '#6c63ff' }}
                        >
                          <PlayIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    );
                  })}
                </Stack>
              ) : (
                <Box sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}>
                  <Typography variant="body2">Chưa có bài hát liên quan đề xuất.</Typography>
                </Box>
              )}
            </Paper>
          </Grid>
        </Grid>
      </Box>

      {/* Share Modal */}
      <ShareSongModal
        open={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        song={song}
      />
    </ClientLayout>
  );
}
