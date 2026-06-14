import { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Avatar,
  Box,
  CircularProgress,
  Grid,
  Paper,
  Stack,
  Typography,
  Button,
  Tabs,
  Tab,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  EmojiEventsRounded as TrophyIcon,
  TrendingUpRounded as RiseIcon,
  TrendingDownRounded as DropIcon,
  RemoveRounded as StableIcon,
  PlayArrowRounded as PlayIcon,
  PauseRounded as PauseIcon,
  ReplayRounded as ReplayIcon,
  AutoAwesomeRounded as SparklesIcon,
  MusicNoteRounded as MusicIcon,
  FiberNewRounded as NewIcon,
  EqualizerRounded as EqualizerIcon,
  WhatshotRounded as FireIcon,
} from '@mui/icons-material';
import ClientLayout from '../../components/Layout/client/ClientLayout';
import { clientSongsApi } from '../../services/api';
import { useClientPlayerActions } from '../../components/Layout/client/ClientPlayerProvider';
import SongMoreMenu from '../../components/Layout/client/SongMoreMenu';

const PERIODS = ['Today', 'This Week', 'This Month'];

// Helper to deterministically sort and rank songs for a given period
function getRankedSongsForPeriod(songs, periodIndex) {
  if (!songs || songs.length === 0) return [];
  const sorted = [...songs].map((song) => {
    // Generate a pseudo-random multiplier or offset based on song title hash and period index
    const charCodeSum = (song.title || '').split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    // Dynamic score based on playCount + sine wave shifts
    const score = (song.playCount || 0) * (1 + Math.sin(charCodeSum + periodIndex * 1.5) * 0.22);
    return { ...song, calculatedScore: score };
  });

  return sorted
    .sort((a, b) => b.calculatedScore - a.calculatedScore)
    .slice(0, 30);
}

export default function ClientRankings() {
  const navigate = useNavigate();
  const { playSong } = useClientPlayerActions();
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // State for active period
  const [activePeriod, setActivePeriod] = useState(0);
  const [isReplaying, setIsReplaying] = useState(false);
  const replayTimer = useRef(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await clientSongsApi.getAllPublic();
        setSongs(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        setError(err.response?.data?.message || 'Không thể tải bảng xếp hạng.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Compute lists for all periods to easily compare and track histories
  const periodLists = useMemo(() => {
    return PERIODS.map((_, idx) => getRankedSongsForPeriod(songs, idx));
  }, [songs]);

  // Current list of top 30 songs
  const currentList = useMemo(() => {
    return periodLists[activePeriod] || [];
  }, [periodLists, activePeriod]);

  // Rankings of next historical period (P+1) for comparing trends
  // When going from index 6 (90s) up to 0 (Today), the "past" is the larger index.
  const pastList = useMemo(() => {
    const pastIdx = activePeriod === PERIODS.length - 1 ? PERIODS.length - 1 : activePeriod + 1;
    return periodLists[pastIdx] || [];
  }, [periodLists, activePeriod]);

  // Rank Map for past list to make searches O(1)
  const pastRankMap = useMemo(() => {
    const map = new Map();
    pastList.forEach((song, idx) => {
      map.set(song._id, idx);
    });
    return map;
  }, [pastList]);

  // Calculate song positions and trend indicators (rise/drop/NEW) for the active list
  const rankedSongsWithTrends = useMemo(() => {
    return currentList.map((song, currentIdx) => {
      const pastIdx = pastRankMap.get(song._id);

      let trend = 'stable'; // 'stable' | 'rise' | 'drop' | 'new'
      let difference = 0;

      if (pastIdx === undefined) {
        trend = 'new';
      } else if (currentIdx < pastIdx) {
        trend = 'rise';
        difference = pastIdx - currentIdx;
      } else if (currentIdx > pastIdx) {
        trend = 'drop';
        difference = currentIdx - pastIdx;
      }

      return {
        ...song,
        rank: currentIdx + 1,
        trend,
        difference,
      };
    });
  }, [currentList, pastRankMap]);

  // Splitting into Top 3 and Ranks 4-30
  const topThree = useMemo(() => {
    const list = rankedSongsWithTrends.slice(0, 3);
    // Return in order: Hạng 2 (left), Hạng 1 (center), Hạng 3 (right)
    const result = [null, null, null];
    if (list[0]) result[1] = list[0]; // #1
    if (list[1]) result[0] = list[1]; // #2
    if (list[2]) result[2] = list[2]; // #3
    return result;
  }, [rankedSongsWithTrends]);

  const remainingSongs = useMemo(() => {
    return rankedSongsWithTrends.slice(3);
  }, [rankedSongsWithTrends]);

  // WOW Feature: Rank Replay Autoplay
  const startReplay = () => {
    if (isReplaying) {
      clearInterval(replayTimer.current);
      setIsReplaying(false);
      return;
    }

    setIsReplaying(true);
    // Start from the furthest history
    let currentStep = PERIODS.length - 1;
    setActivePeriod(currentStep);

    replayTimer.current = setInterval(() => {
      currentStep -= 1;
      if (currentStep < 0) {
        clearInterval(replayTimer.current);
        setIsReplaying(false);
        setActivePeriod(0); // Restores to Today
      } else {
        setActivePeriod(currentStep);
      }
    }, 2000);
  };

  useEffect(() => {
    return () => clearInterval(replayTimer.current);
  }, []);

  // Trending Artists calculation (Accumulate play count from all public songs)
  const trendingArtists = useMemo(() => {
    if (!songs || songs.length === 0) return [];
    const artistStats = {};
    songs.forEach((song) => {
      if (!Array.isArray(song.artists)) return;
      song.artists.forEach((artist) => {
        if (!artist || !artist._id) return;
        if (!artistStats[artist._id]) {
          artistStats[artist._id] = {
            _id: artist._id,
            name: artist.name || 'Nghệ sĩ ẩn danh',
            avatar: artist.avatar || '',
            totalPlayCount: 0,
            songCount: 0,
          };
        }
        artistStats[artist._id].totalPlayCount += song.playCount || 0;
        artistStats[artist._id].songCount += 1;
      });
    });

    return Object.values(artistStats)
      .sort((a, b) => b.totalPlayCount - a.totalPlayCount)
      .slice(0, 5);
  }, [songs]);

  // New Releases calculation (Sort songs by createdAt descending)
  const newReleases = useMemo(() => {
    if (!songs || songs.length === 0) return [];
    return [...songs]
      .sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      })
      .slice(0, 5);
  }, [songs]);

  const maxPlayCount = useMemo(() => {
    if (rankedSongsWithTrends.length === 0) return 1;
    return Math.max(...rankedSongsWithTrends.map((s) => s.playCount || 0), 1);
  }, [rankedSongsWithTrends]);

  const handlePlayAll = (shuffle = false) => {
    if (rankedSongsWithTrends.length === 0) return;
    let queue = [...rankedSongsWithTrends];
    if (shuffle) {
      queue.sort(() => Math.random() - 0.5);
    }
    playSong(queue[0], { queue });
  };

  const renderTrendIcon = (song) => {
    if (song.trend === 'new') {
      return (
        <Tooltip title="Bài mới lọt top">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, color: '#8b5cf6' }}>
            <NewIcon sx={{ fontSize: 20 }} />
          </Box>
        </Tooltip>
      );
    }
    if (song.trend === 'rise') {
      return (
        <Tooltip title={`Tăng ${song.difference} bậc`}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, color: '#10b981' }}>
            <RiseIcon sx={{ fontSize: 18 }} />
            <Typography variant="caption" fontWeight={900}>
              {song.difference}
            </Typography>
          </Box>
        </Tooltip>
      );
    }
    if (song.trend === 'drop') {
      return (
        <Tooltip title={`Giảm ${song.difference} bậc`}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, color: '#ef4444' }}>
            <DropIcon sx={{ fontSize: 18 }} />
            <Typography variant="caption" fontWeight={900}>
              {song.difference}
            </Typography>
          </Box>
        </Tooltip>
      );
    }
    return (
      <Tooltip title="Không đổi">
        <Box sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center' }}>
          <StableIcon sx={{ fontSize: 18 }} />
        </Box>
      </Tooltip>
    );
  };

  return (
    <ClientLayout title="Bảng xếp hạng MusicFlow">
      {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 3 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 18 }}>
          <CircularProgress size={38} color="secondary" />
        </Box>
      ) : (
        <Grid container spacing={3.5}>

          {/* ── CENTRAL COLUMN (LEFT: HERO PODIUM + REPLAY + TIMELINE + LIST) ── */}
          <Grid size={{ xs: 12, lg: 8.5 }}>
            <Stack spacing={4}>

              {/* ── 1. HERO TOP 3 PODIUM ── */}
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 900, mb: 3, letterSpacing: '-0.5px' }}>
                  Top Bảng Xếp Hạng
                </Typography>

                <Grid container spacing={2.5} alignItems="flex-end" sx={{ px: { xs: 0, md: 3 } }}>
                  {/* Rank #2: LEFT */}
                  <Grid size={{ xs: 4 }}>
                    {topThree[0] ? (
                      <Paper
                        elevation={0}
                        sx={{
                          p: 2,
                          borderRadius: 4,
                          border: '2px solid rgba(148, 163, 184, 0.25)',
                          background: (theme) => theme.palette.mode === 'dark' ? 'rgba(30, 41, 59, 0.4)' : '#fff',
                          textAlign: 'center',
                          boxShadow: '0 8px 30px rgba(0,0,0,0.06)',
                          transition: 'all 0.3s ease',
                          cursor: 'pointer',
                          position: 'relative',
                          '&:hover': {
                            transform: 'translateY(-6px)',
                            borderColor: '#94a3b8',
                            boxShadow: '0 12px 28px rgba(148, 163, 184, 0.15)',
                          },
                          '&:hover .podium-play': { opacity: 1, transform: 'scale(1)' },
                        }}
                        onClick={() => playSong(topThree[0], { queue: rankedSongsWithTrends })}
                      >
                        <Box sx={{ position: 'relative', width: { xs: 60, md: 80 }, height: { xs: 60, md: 80 }, margin: '0 auto 12px', borderRadius: '50%', overflow: 'hidden' }}>
                          <Avatar
                            src={topThree[0].imageUrl || undefined}
                            imgProps={{ loading: 'lazy' }}
                            sx={{ width: '100%', height: '100%' }}
                          >
                            <MusicIcon sx={{ fontSize: 32 }} />
                          </Avatar>
                          <Box className="podium-play" sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', bgcolor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', opacity: 0, transform: 'scale(0.8)', transition: 'all 0.25s' }}>
                            <PlayIcon sx={{ fontSize: 28 }} />
                          </Box>
                        </Box>

                        <Box sx={{ display: 'inline-flex', bgcolor: '#e2e8f0', color: '#475569', borderRadius: 2, px: 1.25, py: 0.25, mb: 1, fontWeight: 900, fontSize: 11 }}>
                          #2
                        </Box>
                        <Typography variant="body2" fontWeight={800} noWrap sx={{ mb: 0.25 }}>
                          {topThree[0].title}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                          {Array.isArray(topThree[0].artists) ? topThree[0].artists[0]?.name : 'Unknown'}
                        </Typography>
                      </Paper>
                    ) : (
                      <Box sx={{ height: 100 }} />
                    )}
                  </Grid>

                  {/* Rank #1: CENTER (GOLD GLOW & LARGER) */}
                  <Grid size={{ xs: 4 }}>
                    {topThree[1] ? (
                      <Paper
                        elevation={0}
                        sx={{
                          p: 3,
                          borderRadius: 4.5,
                          border: '2px solid rgba(251, 191, 36, 0.4)',
                          background: (theme) => theme.palette.mode === 'dark'
                            ? 'linear-gradient(135deg, rgba(251, 191, 36, 0.15) 0%, rgba(30, 41, 59, 0.6) 100%)'
                            : '#fff',
                          textAlign: 'center',
                          boxShadow: '0 12px 36px rgba(251, 191, 36, 0.2)',
                          transition: 'all 0.3s ease',
                          cursor: 'pointer',
                          position: 'relative',
                          zIndex: 2,
                          '&:hover': {
                            transform: 'translateY(-10px)',
                            borderColor: '#fbbf24',
                            boxShadow: '0 16px 42px rgba(251, 191, 36, 0.35)',
                          },
                          '&:hover .podium-play': { opacity: 1, transform: 'scale(1)' },
                        }}
                        onClick={() => playSong(topThree[1], { queue: rankedSongsWithTrends })}
                      >
                        {/* Crown/Trophy Indicator */}
                        <Box sx={{ position: 'absolute', top: -24, left: '50%', transform: 'translateX(-50%)', bgcolor: '#fbbf24', borderRadius: '50%', p: 0.75, display: 'flex', boxShadow: '0 4px 12px rgba(251,191,36,0.5)' }}>
                          <TrophyIcon sx={{ color: '#fff', fontSize: 20 }} />
                        </Box>

                        <Box sx={{ position: 'relative', width: { xs: 75, md: 105 }, height: { xs: 75, md: 105 }, margin: '8px auto 16px', borderRadius: '50%', overflow: 'hidden', border: '3px solid #fbbf24' }}>
                          <Avatar
                            src={topThree[1].imageUrl || undefined}
                            imgProps={{ loading: 'lazy' }}
                            sx={{ width: '100%', height: '100%' }}
                          >
                            <MusicIcon sx={{ fontSize: 44 }} />
                          </Avatar>
                          <Box className="podium-play" sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', bgcolor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', opacity: 0, transform: 'scale(0.8)', transition: 'all 0.25s' }}>
                            <PlayIcon sx={{ fontSize: 36 }} />
                          </Box>
                        </Box>

                        <Box sx={{ display: 'inline-flex', bgcolor: '#fef3c7', color: '#d97706', borderRadius: 2, px: 1.75, py: 0.4, mb: 1, fontWeight: 900, fontSize: 12 }}>
                          Quán Quân #1
                        </Box>
                        <Typography variant="body1" fontWeight={900} noWrap sx={{ mb: 0.35 }}>
                          {topThree[1].title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" noWrap sx={{ display: 'block' }}>
                          {Array.isArray(topThree[1].artists) ? topThree[1].artists[0]?.name : 'Unknown'}
                        </Typography>
                      </Paper>
                    ) : (
                      <Box sx={{ height: 120 }} />
                    )}
                  </Grid>

                  {/* Rank #3: RIGHT */}
                  <Grid size={{ xs: 4 }}>
                    {topThree[2] ? (
                      <Paper
                        elevation={0}
                        sx={{
                          p: 2,
                          borderRadius: 4,
                          border: '2px solid rgba(234, 88, 12, 0.25)',
                          background: (theme) => theme.palette.mode === 'dark' ? 'rgba(30, 41, 59, 0.4)' : '#fff',
                          textAlign: 'center',
                          boxShadow: '0 8px 30px rgba(0,0,0,0.06)',
                          transition: 'all 0.3s ease',
                          cursor: 'pointer',
                          position: 'relative',
                          '&:hover': {
                            transform: 'translateY(-6px)',
                            borderColor: '#ea580c',
                            boxShadow: '0 12px 28px rgba(234, 88, 12, 0.15)',
                          },
                          '&:hover .podium-play': { opacity: 1, transform: 'scale(1)' },
                        }}
                        onClick={() => playSong(topThree[2], { queue: rankedSongsWithTrends })}
                      >
                        <Box sx={{ position: 'relative', width: { xs: 60, md: 80 }, height: { xs: 60, md: 80 }, margin: '0 auto 12px', borderRadius: '50%', overflow: 'hidden' }}>
                          <Avatar
                            src={topThree[2].imageUrl || undefined}
                            imgProps={{ loading: 'lazy' }}
                            sx={{ width: '100%', height: '100%' }}
                          >
                            <MusicIcon sx={{ fontSize: 32 }} />
                          </Avatar>
                          <Box className="podium-play" sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', bgcolor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', opacity: 0, transform: 'scale(0.8)', transition: 'all 0.25s' }}>
                            <PlayIcon sx={{ fontSize: 28 }} />
                          </Box>
                        </Box>

                        <Box sx={{ display: 'inline-flex', bgcolor: '#ffedd5', color: '#c2410c', borderRadius: 2, px: 1.25, py: 0.25, mb: 1, fontWeight: 900, fontSize: 11 }}>
                          #3
                        </Box>
                        <Typography variant="body2" fontWeight={800} noWrap sx={{ mb: 0.25 }}>
                          {topThree[2].title}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                          {Array.isArray(topThree[2].artists) ? topThree[2].artists[0]?.name : 'Unknown'}
                        </Typography>
                      </Paper>
                    ) : (
                      <Box sx={{ height: 100 }} />
                    )}
                  </Grid>
                </Grid>
              </Box>

              {/* ── 2. CHARTS TIMELINE & TABS & PLAY BAR ── */}
              <Box>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2.5} justifyContent="space-between" alignItems="center">
                  <Paper
                    elevation={0}
                    sx={{
                      p: 0.5,
                      borderRadius: 3.5,
                      border: '1px solid',
                      borderColor: 'divider',
                      bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(30, 41, 59, 0.4)' : '#fff',
                      width: { xs: '100%', md: 'auto' },
                    }}
                  >
                    <Tabs
                      value={activePeriod}
                      onChange={(_, val) => {
                        if (isReplaying) clearInterval(replayTimer.current);
                        setIsReplaying(false);
                        setActivePeriod(val);
                      }}
                      variant="scrollable"
                      scrollButtons="auto"
                      sx={{
                        minHeight: 40,
                        '& .MuiTabs-indicator': { display: 'none' },
                        '& .MuiTab-root': {
                          minHeight: 36,
                          borderRadius: 2.5,
                          textTransform: 'none',
                          fontWeight: 700,
                          fontSize: 13,
                          px: 2,
                          color: 'text.secondary',
                          transition: 'all 0.25s',
                          '&.Mui-selected': {
                            color: '#fff',
                            bgcolor: '#7c3aed',
                            backgroundImage: 'linear-gradient(135deg, #7c3aed, #6366f1)',
                            boxShadow: '0 4px 12px rgba(124,58,237,0.25)',
                          },
                        },
                      }}
                    >
                      {PERIODS.map((p) => (
                        <Tab key={p} label={p} />
                      ))}
                    </Tabs>
                  </Paper>

                  {/* WOW Rank Replay Control & Action Controls */}
                  <Stack direction="row" spacing={1.5} sx={{ width: { xs: '100%', md: 'auto' }, justifyContent: 'flex-end' }}>
                    <Button
                      variant="outlined"
                      color={isReplaying ? 'error' : 'secondary'}
                      startIcon={isReplaying ? <PauseIcon /> : <ReplayIcon />}
                      onClick={startReplay}
                      sx={{
                        borderRadius: 3,
                        textTransform: 'none',
                        fontWeight: 800,
                        px: 2.5,
                        borderColor: isReplaying ? 'error.main' : 'divider',
                        ...(isReplaying ? {
                          animation: 'pulseGlow 1.5s infinite',
                          '@keyframes pulseGlow': {
                            '0%': { boxShadow: '0 0 0 0 rgba(239, 68, 68, 0.4)' },
                            '70%': { boxShadow: '0 0 0 10px rgba(239, 68, 68, 0)' },
                            '100%': { boxShadow: '0 0 0 0 rgba(239, 68, 68, 0)' },
                          }
                        } : {}),
                      }}
                    >
                      {isReplaying ? 'Dừng phát' : 'Rank Replay'}
                    </Button>

                    <Button
                      variant="contained"
                      startIcon={<PlayIcon />}
                      onClick={() => handlePlayAll(false)}
                      sx={{
                        borderRadius: 3,
                        textTransform: 'none',
                        fontWeight: 800,
                        px: 2.5,
                        bgcolor: '#7c3aed',
                        backgroundImage: 'linear-gradient(135deg, #7c3aed, #6366f1)',
                        boxShadow: '0 4px 12px rgba(124, 58, 237, 0.2)',
                        '&:hover': {
                          bgcolor: '#6d28d9',
                        },
                      }}
                    >
                      Phát tất cả
                    </Button>
                  </Stack>
                </Stack>

                {isReplaying && (
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 2, justifyContent: 'center' }}>
                    <Typography variant="caption" sx={{ color: '#7c3aed', fontWeight: 900, letterSpacing: '1px', animation: 'blink 1s infinite' }}>
                      ● ĐANG PHÁT LẠI LỊCH SỬ BIẾN ĐỘNG BXH... ({PERIODS[activePeriod]})
                    </Typography>
                    <style>{`
                      @keyframes blink {
                        0%, 100% { opacity: 1; }
                        50% { opacity: 0.4; }
                      }
                    `}</style>
                  </Stack>
                )}
              </Box>

              {/* ── 3. LIST OF SONGS (RANKS 4–30) ── */}
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 900, mb: 2, letterSpacing: '-0.3px' }}>
                  Xếp hạng #4 – #30
                </Typography>

                <Stack spacing={1.5}>
                  {remainingSongs.map((song) => (
                    <Paper
                      key={song._id}
                      variant="outlined"
                      sx={{
                        p: 1.5,
                        borderRadius: 3.5,
                        border: '1px solid',
                        borderColor: 'divider',
                        bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(30, 41, 59, 0.25)' : '#fff',
                        position: 'relative',
                        overflow: 'hidden',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        cursor: 'pointer',
                        '&:hover': {
                          transform: 'translateX(6px)',
                          borderColor: '#7c3aed',
                          bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(124, 58, 237, 0.05)' : 'rgba(124, 58, 237, 0.01)',
                          boxShadow: '0 4px 18px rgba(124,58,237,0.06)',
                        },
                        '&:hover .list-play-btn': { opacity: 1 },
                      }}
                      onClick={() => playSong(song, { queue: rankedSongsWithTrends })}
                    >
                      {/* Pop popularity bar under bottom */}
                      <Box
                        sx={{
                          position: 'absolute',
                          left: 0,
                          bottom: 0,
                          height: 2,
                          width: `${((song.playCount || 0) / maxPlayCount) * 100}%`,
                          bgcolor: 'rgba(124, 58, 237, 0.2)',
                          borderRadius: 1,
                        }}
                      />

                      <Stack direction="row" spacing={2} alignItems="center">
                        {/* Position Number */}
                        <Typography variant="body2" sx={{ fontWeight: 900, width: 24, textAlign: 'center', color: 'text.secondary' }}>
                          #{song.rank}
                        </Typography>

                        {/* Trend Indicator */}
                        <Box sx={{ width: 42, display: 'flex', justifyContent: 'center' }}>
                          {renderTrendIcon(song)}
                        </Box>

                        {/* Song Cover Avatar */}
                        <Box sx={{ position: 'relative', width: 44, height: 44, flexShrink: 0 }}>
                          <Avatar
                            src={song.imageUrl || undefined}
                            variant="rounded"
                            imgProps={{ loading: 'lazy' }}
                            sx={{
                              width: '100%',
                              height: '100%',
                              boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                              bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(124, 58, 237, 0.08)' : 'rgba(124, 58, 237, 0.04)',
                              color: '#7c3aed',
                            }}
                          >
                            <MusicIcon sx={{ fontSize: 22 }} />
                          </Avatar>
                          <Box
                            className="list-play-btn"
                            sx={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: '100%',
                              height: '100%',
                              bgcolor: 'rgba(0,0,0,0.5)',
                              borderRadius: 1,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#fff',
                              opacity: 0,
                              transition: 'opacity 0.2s',
                            }}
                          >
                            <PlayIcon sx={{ fontSize: 22 }} />
                          </Box>
                        </Box>

                        {/* Song Details */}
                        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                          <Typography variant="body2" fontWeight={800} noWrap>
                            {song.title}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', mt: 0.25 }}>
                            {Array.isArray(song.artists)
                              ? song.artists.map((artist) => artist?.name).filter(Boolean).join(', ')
                              : 'Nghệ sĩ ẩn danh'}
                          </Typography>
                        </Box>

                        {/* Stats & Actions */}
                        <Typography variant="caption" color="text.secondary" sx={{ minWidth: 80, textAlign: 'right', mr: 2 }}>
                          {song.playCount || 0} lượt nghe
                        </Typography>

                        <Box onClick={(e) => e.stopPropagation()}>
                          <SongMoreMenu
                            song={song}
                            buttonSx={{
                              color: 'text.secondary',
                              '&:hover': {
                                backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
                              },
                            }}
                          />
                        </Box>
                      </Stack>
                    </Paper>
                  ))}

                  {!remainingSongs.length && (
                    <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
                      Chưa có đủ dữ liệu xếp hạng thêm.
                    </Typography>
                  )}
                </Stack>
              </Box>

            </Stack>
          </Grid>

          {/* ── SIDEBAR COLUMN (RIGHT: TRENDING ARTISTS & NEW RELEASES) ── */}
          <Grid size={{ xs: 12, lg: 3.5 }}>
            <Stack spacing={4.5}>

              {/* ── 4. NGHỆ SĨ THỊNH HÀNH (TRENDING ARTISTS) ── */}
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 900, mb: 2, letterSpacing: '-0.3px', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <FireIcon sx={{ color: '#f57c00', fontSize: 20 }} />
                  Nghệ sĩ thịnh hành
                </Typography>

                <Stack spacing={2}>
                  {trendingArtists.map((artist) => (
                    <Paper
                      key={artist._id}
                      elevation={0}
                      onClick={() => navigate(`/client/artists/${artist._id}`)}
                      sx={{
                        p: 1.5,
                        borderRadius: 3.5,
                        border: '1px solid',
                        borderColor: 'divider',
                        background: (theme) => theme.palette.mode === 'dark'
                          ? 'rgba(30, 41, 59, 0.4)'
                          : '#fff',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        cursor: 'pointer',
                        '&:hover': {
                          transform: 'translateY(-2px)',
                          borderColor: '#f57c00',
                          boxShadow: '0 4px 18px rgba(245, 124, 0, 0.12)',
                          bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(245, 124, 0, 0.05)' : 'rgba(245, 124, 0, 0.01)',
                        },
                      }}
                    >
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Avatar
                          src={artist.avatar || undefined}
                          imgProps={{ loading: 'lazy' }}
                          sx={{
                            width: 46,
                            height: 46,
                            border: '2px solid rgba(245, 124, 0, 0.2)',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
                          }}
                        >
                          <MusicIcon sx={{ fontSize: 24 }} />
                        </Avatar>
                        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                          <Typography variant="body2" fontWeight={800} noWrap>
                            {artist.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', mt: 0.25 }}>
                            {artist.totalPlayCount.toLocaleString('vi-VN')} lượt nghe • {artist.songCount} bài hát
                          </Typography>
                        </Box>
                      </Stack>
                    </Paper>
                  ))}
                  {!trendingArtists.length && (
                    <Typography variant="caption" color="text.secondary">
                      Chưa có đủ dữ liệu nghệ sĩ thịnh hành.
                    </Typography>
                  )}
                </Stack>
              </Box>

              {/* ── 5. BÀI HÁT MỚI PHÁT HÀNH (NEW RELEASES) ── */}
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 900, mb: 2, letterSpacing: '-0.3px', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <SparklesIcon sx={{ color: '#7c3aed', fontSize: 20 }} />
                  Bài hát mới phát hành
                </Typography>

                <Stack spacing={2}>
                  {newReleases.map((song) => (
                    <Paper
                      key={song._id}
                      elevation={0}
                      onClick={() => playSong(song, { queue: newReleases })}
                      sx={{
                        p: 1.5,
                        borderRadius: 3.5,
                        border: '1px solid',
                        borderColor: 'divider',
                        background: (theme) => theme.palette.mode === 'dark'
                          ? 'rgba(30, 41, 59, 0.4)'
                          : '#fff',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        cursor: 'pointer',
                        '&:hover': {
                          transform: 'translateY(-2px)',
                          borderColor: '#7c3aed',
                          boxShadow: '0 4px 18px rgba(124, 58, 237, 0.12)',
                          bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(124, 58, 237, 0.05)' : 'rgba(124, 58, 237, 0.01)',
                        },
                        '&:hover .new-release-play': { opacity: 1 },
                      }}
                    >
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Box sx={{ position: 'relative', width: 44, height: 44, flexShrink: 0 }}>
                          <Avatar
                            src={song.imageUrl || undefined}
                            variant="rounded"
                            imgProps={{ loading: 'lazy' }}
                            sx={{
                              width: '100%',
                              height: '100%',
                              boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                              bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(124, 58, 237, 0.08)' : 'rgba(124, 58, 237, 0.04)',
                              color: '#7c3aed',
                            }}
                          >
                            <MusicIcon sx={{ fontSize: 22 }} />
                          </Avatar>
                          <Box
                            className="new-release-play"
                            sx={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: '100%',
                              height: '100%',
                              bgcolor: 'rgba(0,0,0,0.4)',
                              borderRadius: 1,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#fff',
                              opacity: 0,
                              transition: 'opacity 0.2s',
                            }}
                          >
                            <PlayIcon sx={{ fontSize: 22 }} />
                          </Box>
                        </Box>

                        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                          <Stack direction="row" alignItems="center" spacing={0.5}>
                            <Typography variant="body2" fontWeight={800} noWrap sx={{ maxWidth: '75%' }}>
                              {song.title}
                            </Typography>
                            <Box sx={{ bgcolor: 'rgba(124, 58, 237, 0.15)', color: '#7c3aed', borderRadius: 1, px: 0.5, py: 0.1, fontSize: 8, fontWeight: 900, display: 'inline-block' }}>
                              NEW
                            </Box>
                          </Stack>
                          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', mt: 0.25 }}>
                            {Array.isArray(song.artists)
                              ? song.artists.map((artist) => artist?.name).filter(Boolean).join(', ')
                              : 'Nghệ sĩ ẩn danh'}
                          </Typography>
                        </Box>
                      </Stack>
                    </Paper>
                  ))}
                  {!newReleases.length && (
                    <Typography variant="caption" color="text.secondary">
                      Chưa có đủ dữ liệu bài hát mới phát hành.
                    </Typography>
                  )}
                </Stack>
              </Box>

            </Stack>
          </Grid>

        </Grid>
      )}
    </ClientLayout>
  );
}
