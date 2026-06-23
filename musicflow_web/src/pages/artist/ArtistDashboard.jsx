import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  Stack,
  Typography,
  IconButton,
  Tooltip,
  useTheme,
  Paper,
} from '@mui/material';
import {
  Edit as EditIcon,
  FavoriteRounded as FavoriteIcon,
  HeadphonesRounded as HeadphonesIcon,
  MusicNoteRounded as MusicNoteIcon,
  PersonAddAlt1Rounded as FollowersIcon,
  TrendingUpRounded as TrendingIcon,
  RadioRounded as RadioIcon,
  CheckCircleRounded as VerifiedIcon,
  CheckCircleRounded as CheckCircleIcon,
  PlayArrowRounded as PlayIcon,
  AccessTimeRounded as TimeIcon,
  AssessmentRounded as InsightIcon,
  InfoOutlined as InfoIcon,
  ChevronRightRounded as ArrowIcon,
} from '@mui/icons-material';
import ArtistLayout from '../../components/Layout/artist/ArtistLayout';
import ArtistProfileDialog from './ArtistProfileDialog';
import { artistApi } from '../../services/api';
import { syncArtistSession } from '../../utils/artistSession';
import {
  buildArtistProfilePayload,
  calculateArtistAnalytics,
  createArtistProfileForm,
  formatDurationLabel,
} from '../../utils/artistProfile';
import useAppToast from '../../components/common/useAppToast';

function ArtistDashboard() {
  const theme = useTheme();
  const navigate = useNavigate();
  const { showToast } = useAppToast();
  const [artist, setArtist] = useState(null);
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [profileForm, setProfileForm] = useState(createArtistProfileForm());
  const [avatarFile, setAvatarFile] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const currentArtistResponse = await artistApi.getMe();
      const currentArtist = currentArtistResponse.data.artist;
      syncArtistSession(currentArtist);

      const profileResponse = await artistApi.getProfile({ id: currentArtist._id });
      const artistProfile = profileResponse.data.artist || {};

      setArtist({
        _id: currentArtist._id,
        name: currentArtist.name || artistProfile.name || 'Artist',
        email: currentArtist.email || '',
        avatar: currentArtist.avatar || artistProfile.avatar || '',
        bio: currentArtist.bio || artistProfile.bio || '',
        totalSongs: artistProfile.totalSongs || 0,
        totalLikes: artistProfile.totalLikes || 0,
        followers: artistProfile.followers || 0,
        monthlyListeners: artistProfile.monthlyListeners || 0,
        latestReleaseLabel: artistProfile.latestReleaseLabel || 'No release yet',
      });
      setSongs(artistProfile.songs || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load artist dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const handleOpenEdit = () => {
    setProfileForm(createArtistProfileForm(artist));
    setAvatarFile(null);
    setEditOpen(true);
    setError('');
  };

  const handleCloseEdit = () => {
    setEditOpen(false);
    setEditLoading(false);
    setProfileForm(createArtistProfileForm());
    setAvatarFile(null);
  };

  const handleProfileChange = (field) => (event) => {
    setProfileForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSaveProfile = async () => {
    if (!profileForm.name.trim() || !profileForm.email.trim()) {
      const message = 'Name and email are required.';
      setError(message);
      showToast({ severity: 'warning', title: 'Missing information', message });
      return;
    }

    try {
      setEditLoading(true);
      const response = await artistApi.updateProfile(buildArtistProfilePayload(profileForm, avatarFile));
      const updatedArtist = response.data.artist;

      setArtist((prev) => ({
        ...prev,
        name: updatedArtist.name || prev?.name || '',
        email: updatedArtist.email || prev?.email || '',
        bio: updatedArtist.bio || '',
        avatar: updatedArtist.avatar || '',
      }));
      syncArtistSession(updatedArtist);
      showToast({ severity: 'success', title: 'Success!', message: 'Profile updated successfully.' });
      handleCloseEdit();
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to update profile.';
      setError(message);
      showToast({ severity: 'error', title: 'Update failed', message });
    } finally {
      setEditLoading(false);
    }
  };

  const analytics = useMemo(() => calculateArtistAnalytics(artist, songs), [artist, songs]);

  const readinessScore = useMemo(() => {
    let score = 0;
    if (artist?.bio) score += 33;
    if (artist?.avatar) score += 33;
    if (songs.length > 0) score += 34;
    return score;
  }, [artist, songs]);

  // Greeting message based on local hour
  const timeGreeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Good morning';
    if (hour >= 12 && hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const stats = useMemo(() => ([
    {
      label: 'Released songs',
      value: analytics.totalSongs,
      icon: <MusicNoteIcon sx={{ fontSize: 24 }} />,
      accent: '#0ea5e9',
      gradient: 'linear-gradient(135deg, rgba(14, 165, 233, 0.15) 0%, rgba(14, 165, 233, 0.02) 100%)',
      helper: 'Tracks live in catalog',
    },
    {
      label: 'Total likes',
      value: analytics.totalLikes,
      icon: <FavoriteIcon sx={{ fontSize: 24 }} />,
      accent: '#ef4444',
      gradient: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(239, 68, 68, 0.02) 100%)',
      helper: 'Hearts from listeners',
    },
    {
      label: 'Followers',
      value: analytics.followers,
      icon: <FollowersIcon sx={{ fontSize: 24 }} />,
      accent: '#8b5cf6',
      gradient: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(139, 92, 246, 0.02) 100%)',
      helper: 'Fans tracking updates',
    },
    {
      label: 'Monthly listeners',
      value: analytics.monthlyListeners,
      icon: <HeadphonesIcon sx={{ fontSize: 24 }} />,
      accent: '#10b981',
      gradient: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(16, 185, 129, 0.02) 100%)',
      helper: 'Active audience monthly',
    },
  ]), [analytics]);

  // Max value for releases visualizer height calculation
  const maxReleaseCount = useMemo(() => {
    const values = (analytics.releasesByMonth || []).map(r => r.value);
    return values.length ? Math.max(...values, 1) : 4;
  }, [analytics.releasesByMonth]);

  return (
    <ArtistLayout title="Artist Dashboard">
      {error && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CircularProgress color="primary" size={48} />
        </Box>
      ) : (
        <Box sx={{ display: 'grid', gap: 4, pb: 6 }}>
          {/* Panoramic Hero Header Card */}
          <Card
            elevation={0}
            sx={{
              overflow: 'hidden',
              borderRadius: 6,
              border: '1px solid rgba(255, 255, 255, 0.08)',
              background: 'linear-gradient(135deg, #090d16 0%, #1a1e36 45%, #6c63ff 100%)',
              boxShadow: '0 20px 45px rgba(108, 99, 255, 0.15)',
              position: 'relative',
            }}
          >
            {/* Ambient Background Lights */}
            <Box
              sx={{
                position: 'absolute',
                top: '-30%',
                right: '-10%',
                width: 320,
                height: 320,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(0, 188, 212, 0.25) 0%, transparent 70%)',
                filter: 'blur(30px)',
                zIndex: 0,
                pointerEvents: 'none',
              }}
            />
            <Box
              sx={{
                position: 'absolute',
                bottom: '-20%',
                left: '10%',
                width: 250,
                height: 250,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(108, 99, 255, 0.2) 0%, transparent 70%)',
                filter: 'blur(25px)',
                zIndex: 0,
                pointerEvents: 'none',
              }}
            />

            <Box
              sx={{
                p: { xs: 3, md: 5 },
                position: 'relative',
                zIndex: 1,
                background: 'rgba(255, 255, 255, 0.01)',
              }}
            >
              <Grid container spacing={4} alignItems="center">
                <Grid size={{ xs: 12, md: 8 }}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} alignItems={{ xs: 'flex-start', sm: 'center' }}>
                    <Box sx={{ position: 'relative' }}>
                      <Avatar
                        src={artist?.avatar}
                        sx={{
                          width: 104,
                          height: 104,
                          bgcolor: 'rgba(255,255,255,0.12)',
                          border: '3px solid rgba(108, 99, 255, 0.6)',
                          boxShadow: '0 8px 24px rgba(108, 99, 255, 0.3)',
                          transition: 'transform 0.3s ease',
                          '&:hover': {
                            transform: 'scale(1.05)',
                          }
                        }}
                      >
                        {artist?.name?.charAt(0)?.toUpperCase()}
                      </Avatar>
                      <Box
                        sx={{
                          position: 'absolute',
                          bottom: 2,
                          right: 2,
                          bgcolor: '#090d16',
                          borderRadius: '50%',
                          display: 'flex',
                          p: '2px',
                        }}
                      >
                        <VerifiedIcon sx={{ color: '#00bcd4', fontSize: 22 }} />
                      </Box>
                    </Box>
                    <Box>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                        <Chip
                          icon={<RadioIcon sx={{ color: '#00bcd4 !important', fontSize: 16 }} />}
                          label="Verified Creator"
                          sx={{
                            color: '#00bcd4',
                            fontWeight: 700,
                            fontSize: '11px',
                            textTransform: 'uppercase',
                            letterSpacing: '1.2px',
                            backgroundColor: 'rgba(0, 188, 212, 0.1)',
                            border: '1px solid rgba(0, 188, 212, 0.25)',
                          }}
                        />
                      </Stack>
                      <Typography variant="h3" sx={{ fontWeight: 900, letterSpacing: -1.2, color: '#fff', mb: 1 }}>
                        {artist?.name || 'Artist'}
                      </Typography>
                      <Typography sx={{ color: 'rgba(255, 255, 255, 0.76)', maxWidth: 640, fontSize: 15, fontWeight: 500, lineHeight: 1.45 }}>
                        {artist?.bio || 'Introduce your style, project news, and upcoming work to your monthly audience.'}
                      </Typography>
                    </Box>
                  </Stack>
                  <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap sx={{ mt: 3 }}>
                    <Chip label={artist?.email || 'No email'} sx={{ color: '#fff', backgroundColor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }} />
                    <Chip label={`Latest release: ${artist?.latestReleaseLabel || 'No release yet'}`} sx={{ color: '#fff', backgroundColor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }} />
                  </Stack>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Card
                    elevation={0}
                    sx={{
                      borderRadius: 5,
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      backdropFilter: 'blur(16px)',
                      color: '#fff',
                    }}
                  >
                    <CardContent sx={{ p: 3.5 }}>
                      <Typography variant="overline" sx={{ opacity: 0.7, letterSpacing: 1.5, fontWeight: 700 }}>
                        {timeGreeting}, Creator
                      </Typography>
                      <Typography variant="h4" sx={{ fontWeight: 900, mt: 0.75, mb: 1, background: 'linear-gradient(90deg, #00bcd4, #6c63ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        Ready for Fans?
                      </Typography>
                      <Typography sx={{ opacity: 0.8, fontSize: 13.5, lineHeight: 1.4, mb: 3 }}>
                        Your artist profile is live. Customize your details below to capture more listeners.
                      </Typography>
                      <Button
                        variant="contained"
                        startIcon={<EditIcon />}
                        onClick={handleOpenEdit}
                        sx={{
                          bgcolor: '#6c63ff',
                          color: '#fff',
                          fontWeight: 700,
                          px: 3.5,
                          py: 1.25,
                          borderRadius: 3,
                          textTransform: 'none',
                          boxShadow: '0 6px 20px rgba(108, 99, 255, 0.3)',
                          '&:hover': {
                            bgcolor: '#5b54e0',
                            transform: 'translateY(-2px)',
                            boxShadow: '0 8px 24px rgba(108, 99, 255, 0.4)',
                          },
                          transition: 'all 0.2s ease-in-out',
                        }}
                      >
                        Customize profile
                      </Button>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Box>
          </Card>

          {/* Creator Quick Actions Panel */}
          <Grid container spacing={3.25}>
            <Grid size={{ xs: 12 }}>
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  borderRadius: 5,
                  border: '1px solid',
                  borderColor: 'divider',
                  background: (theme) => theme.palette.mode === 'dark' 
                    ? 'linear-gradient(135deg, rgba(30, 41, 59, 0.4) 0%, rgba(108, 99, 255, 0.05) 100%)' 
                    : 'linear-gradient(135deg, #ffffff 0%, rgba(108, 99, 255, 0.02) 100%)',
                  boxShadow: '0 8px 30px rgba(0,0,0,0.02)',
                }}
              >
                <Grid container spacing={3} alignItems="center">
                  <Grid size={{ xs: 12, md: 4 }}>
                    <Typography variant="h6" fontWeight={850} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <RadioIcon sx={{ color: 'primary.main' }} /> Creator Quick Console
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      Manage releases, customize bio, and view realtime statistics.
                    </Typography>
                  </Grid>
                  
                  <Grid size={{ xs: 12, md: 8 }}>
                    <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap justifyContent={{ md: 'flex-end' }}>
                      <Button
                        variant="contained"
                        onClick={() => navigate('/artist/songs')}
                        startIcon={<MusicNoteIcon />}
                        sx={{
                          borderRadius: 3,
                          fontWeight: 700,
                          bgcolor: '#6c63ff',
                          backgroundImage: 'linear-gradient(135deg, #6c63ff, #5b54e0)',
                          boxShadow: '0 4px 12px rgba(108, 99, 255, 0.2)',
                          '&:hover': { bgcolor: '#5b54e0' }
                        }}
                      >
                        Upload Track
                      </Button>
                      
                      <Button
                        variant="outlined"
                        onClick={() => navigate('/artist/analytics')}
                        startIcon={<InsightIcon />}
                        sx={{ borderRadius: 3, fontWeight: 700, border: '1px solid', borderColor: 'divider' }}
                      >
                        Audience Stats
                      </Button>

                      <Button
                        variant="outlined"
                        onClick={handleOpenEdit}
                        startIcon={<EditIcon />}
                        sx={{ borderRadius: 3, fontWeight: 700, border: '1px solid', borderColor: 'divider' }}
                      >
                        Edit Bio Info
                      </Button>

                      <Button
                        variant="outlined"
                        onClick={() => showToast({ severity: 'info', title: 'Lossless Audio', message: 'Hi-Res Lossless (FLAC/WAV) encoding is active for all uploads.' })}
                        startIcon={<CheckCircleIcon />}
                        sx={{ borderRadius: 3, fontWeight: 700, borderColor: 'secondary.main', color: 'secondary.main' }}
                      >
                        Lossless: Active
                      </Button>
                    </Stack>
                  </Grid>
                </Grid>
              </Paper>
            </Grid>
          </Grid>

          {/* Statistics Grid */}
          <Grid container spacing={3.25}>
            {stats.map((item) => (
              <Grid key={item.label} size={{ xs: 12, sm: 6, lg: 3 }}>
                <Card
                  elevation={0}
                  sx={{
                    height: '100%',
                    borderRadius: 5,
                    border: '1px solid',
                    borderColor: 'divider',
                    backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.02)' : '#ffffff',
                    background: item.gradient,
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:hover': {
                      transform: 'translateY(-6px)',
                      borderColor: item.accent,
                      boxShadow: `0 12px 28px -12px ${item.accent}3d`,
                    },
                  }}
                >
                  <CardContent sx={{ p: 3.5 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                      <Box>
                        <Typography variant="subtitle2" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          {item.label}
                        </Typography>
                        <Typography variant="h3" sx={{ fontWeight: 900, mt: 1.5, color: 'text.primary', letterSpacing: -0.5 }}>
                          {item.value}
                        </Typography>
                      </Box>
                      <Box
                        sx={{
                          width: 52,
                          height: 52,
                          display: 'grid',
                          placeItems: 'center',
                          borderRadius: 3.5,
                          color: item.accent,
                          backgroundColor: `${item.accent}14`,
                          border: `1px solid ${item.accent}24`,
                        }}
                      >
                        {item.icon}
                      </Box>
                    </Stack>
                    <Typography variant="body2" sx={{ mt: 3, color: 'text.secondary', fontWeight: 500 }}>
                      {item.helper}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {/* Toggleable Advanced Analytics Section */}
          <Box>
            <Button
              startIcon={<InsightIcon />}
              onClick={() => setShowAdvanced(!showAdvanced)}
              sx={{
                color: '#00bcd4',
                fontWeight: 800,
                fontSize: 14.5,
                mb: 1.5,
                textTransform: 'none',
                px: 2.5,
                py: 1,
                borderRadius: 3,
                border: '1px solid rgba(0, 188, 212, 0.15)',
                backgroundColor: 'rgba(0, 188, 212, 0.03)',
                '&:hover': {
                  backgroundColor: 'rgba(0, 188, 212, 0.08)',
                  borderColor: '#00bcd4',
                },
                transition: 'all 0.25s',
              }}
            >
              {showAdvanced ? 'Hide Detailed Insights' : 'View Detailed Insights'}
            </Button>

            {showAdvanced && (
              <Card
                elevation={0}
                sx={{
                  borderRadius: 5,
                  border: '1px solid',
                  borderColor: 'divider',
                  backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.01)' : '#ffffff',
                  p: 3,
                  animation: 'fadeIn 0.4s ease-out',
                  '@keyframes fadeIn': {
                    from: { opacity: 0, transform: 'translateY(10px)' },
                    to: { opacity: 1, transform: 'translateY(0)' },
                  },
                }}
              >
                <Grid container spacing={4}>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <Typography variant="subtitle2" sx={{ color: 'text.secondary', fontWeight: 700, mb: 2 }}>
                      STREAM PERFORMANCE
                    </Typography>
                    <Stack spacing={2.5}>
                      <Box>
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
                          Total Song Streams
                        </Typography>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <PlayIcon sx={{ color: '#0ea5e9' }} />
                          <Typography variant="h5" sx={{ fontWeight: 800 }}>
                            {analytics.totalPlays}
                          </Typography>
                        </Stack>
                      </Box>
                      <Box>
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
                          Avg Streams per Release
                        </Typography>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <TrendingIcon sx={{ color: '#10b981' }} />
                          <Typography variant="h5" sx={{ fontWeight: 800 }}>
                            {analytics.averagePlays}
                          </Typography>
                        </Stack>
                      </Box>
                    </Stack>
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <Typography variant="subtitle2" sx={{ color: 'text.secondary', fontWeight: 700, mb: 2 }}>
                      CATALOG METRICS
                    </Typography>
                    <Stack spacing={2.5}>
                      <Box>
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
                          Catalog Playtime
                        </Typography>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <TimeIcon sx={{ color: '#8b5cf6' }} />
                          <Typography variant="h5" sx={{ fontWeight: 800 }}>
                            {formatDurationLabel(analytics.totalDuration)}
                          </Typography>
                        </Stack>
                      </Box>
                      <Box>
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
                          Fan Engagement Ratio
                        </Typography>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <FavoriteIcon sx={{ color: '#ef4444' }} />
                          <Typography variant="h5" sx={{ fontWeight: 800 }}>
                            {analytics.totalPlays > 0
                              ? `${((analytics.totalLikes / analytics.totalPlays) * 100).toFixed(1)}%`
                              : '0%'}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            likes to streams
                          </Typography>
                        </Stack>
                      </Box>
                    </Stack>
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <Typography variant="subtitle2" sx={{ color: 'text.secondary', fontWeight: 700, mb: 2 }}>
                      ENGAGEMENT INSIGHT
                    </Typography>
                    <Box sx={{ p: 2, borderRadius: 4, bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider' }}>
                      <Stack direction="row" spacing={1.5} sx={{ mb: 1.5 }}>
                        <InfoIcon sx={{ color: '#00bcd4', mt: 0.25 }} />
                        <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
                          Audience Interest
                        </Typography>
                      </Stack>
                      <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.45, display: 'block' }}>
                        Your songs get an average of <strong>{analytics.averageLikes} likes</strong> per track. 
                        Keep uploading tracks and sharing release links with your social followers to grow monthly listener counts!
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </Card>
            )}
          </Box>

          <Grid container spacing={4}>
            {/* Left Section: Releases & Releases Chart */}
            <Grid size={{ xs: 12, lg: 8 }}>
              <Stack spacing={4}>
                {/* Visual Chart Card */}
                {analytics.releasesByMonth && analytics.releasesByMonth.length > 0 && (
                  <Card elevation={0} sx={{ borderRadius: 5, border: '1px solid', borderColor: 'divider', backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.01)' : '#ffffff' }}>
                    <CardContent sx={{ p: 3.5 }}>
                      <Typography variant="h6" sx={{ fontWeight: 800, mb: 3 }}>
                        Catalog Releases Trend
                      </Typography>
                      <Box sx={{ height: 160, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', px: { xs: 1, sm: 3 }, pt: 2, gap: 1.5 }}>
                        {analytics.releasesByMonth.map((item) => {
                          const percentage = (item.value / maxReleaseCount) * 100;
                          return (
                            <Box
                              key={item.label}
                              sx={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                flex: 1,
                                height: '100%',
                                justifyContent: 'flex-end',
                              }}
                            >
                              <Tooltip title={`${item.value} release(s) in ${item.label}`} arrow placement="top">
                                <Box
                                  sx={{
                                    width: '100%',
                                    maxWidth: 38,
                                    height: `${percentage}%`,
                                    background: 'linear-gradient(180deg, #6c63ff 0%, rgba(108, 99, 255, 0.15) 100%)',
                                    borderRadius: '6px 6px 0 0',
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    cursor: 'pointer',
                                    position: 'relative',
                                    boxShadow: '0 2px 8px rgba(108, 99, 255, 0.1)',
                                    '&:hover': {
                                      background: 'linear-gradient(180deg, #00bcd4 0%, rgba(0, 188, 212, 0.2) 100%)',
                                      transform: 'scaleY(1.05)',
                                      boxShadow: '0 4px 16px rgba(0, 188, 212, 0.35)',
                                    },
                                  }}
                                >
                                  {/* Bar top indicator for high values */}
                                  <Box
                                    sx={{
                                      position: 'absolute',
                                      top: -24,
                                      left: '50%',
                                      transform: 'translateX(-50%)',
                                      fontSize: '11px',
                                      fontWeight: 800,
                                      color: 'rgba(255,255,255,0.7)',
                                    }}
                                  >
                                    {item.value}
                                  </Box>
                                </Box>
                              </Tooltip>
                              <Typography variant="caption" sx={{ mt: 1.5, color: 'text.secondary', fontWeight: 650, fontSize: '10.5px' }}>
                                {item.label.split('-')[1]}/{item.label.split('-')[0].slice(-2)}
                              </Typography>
                            </Box>
                          );
                        })}
                      </Box>
                    </CardContent>
                  </Card>
                )}

                {/* Recent Releases Section */}
                <Card elevation={0} sx={{ borderRadius: 5, border: '1px solid', borderColor: 'divider', backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.01)' : '#ffffff' }}>
                  <CardContent sx={{ p: 3.5 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
                      <Box>
                        <Typography variant="h6" sx={{ fontWeight: 800 }}>Recent catalog releases</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Manage your tracks live on public grids.</Typography>
                      </Box>
                      <Chip icon={<TrendingIcon />} label="Catalog Stats" color="primary" variant="outlined" sx={{ fontWeight: 700, borderColor: 'rgba(108, 99, 255, 0.3)', color: '#6c63ff' }} />
                    </Stack>

                    {songs.length === 0 ? (
                      <Box sx={{ p: 4, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.01)', border: '1px dashed', borderColor: 'divider', textAlign: 'center' }}>
                        <MusicNoteIcon sx={{ fontSize: 44, color: 'text.secondary', opacity: 0.4, mb: 1.5 }} />
                        <Typography fontWeight={700} sx={{ color: 'text.primary' }}>No songs yet</Typography>
                        <Typography color="text.secondary" variant="body2" sx={{ mt: 0.75, maxWidth: 360, mx: 'auto' }}>
                          Upload tracks inside the Creator Studio to build your stream metrics.
                        </Typography>
                      </Box>
                    ) : (
                      <Stack divider={<Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.06)' }} />} spacing={0.5}>
                        {songs.slice(0, 5).map((song, index) => {
                          const formattedDuration = song.duration ? formatDurationLabel(song.duration) : `${3 + (index % 2)}:${15 + (index * 12) % 45}`;
                          return (
                            <Box
                              key={song._id || `${song.title}-${index}`}
                              onClick={() => navigate('/artist/songs')}
                              sx={{
                                py: 2,
                                px: 1.5,
                                borderRadius: 4,
                                display: 'flex',
                                gap: 2.25,
                                alignItems: 'center',
                                border: '1px solid transparent',
                                cursor: 'pointer',
                                transition: 'all 0.25s ease-in-out',
                                '&:hover': {
                                  borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(108, 99, 255, 0.4)' : 'rgba(108, 99, 255, 0.25)',
                                  backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(108, 99, 255, 0.03)',
                                  transform: 'translateX(4px)',
                                  boxShadow: (theme) => theme.palette.mode === 'dark' ? '0 4px 12px rgba(0, 0, 0, 0.3)' : '0 4px 12px rgba(108, 99, 255, 0.05)',
                                },
                              }}
                            >
                              <Avatar
                                src={song.imageUrl}
                                variant="rounded"
                                sx={{
                                  width: 56,
                                  height: 56,
                                  bgcolor: 'rgba(108, 99, 255, 0.12)',
                                  border: '1px solid rgba(255, 255, 255, 0.05)',
                                  color: '#6c63ff',
                                  borderRadius: 3,
                                }}
                              >
                                <MusicNoteIcon />
                              </Avatar>
                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
                                  <Typography fontWeight={800} noWrap sx={{ color: 'text.primary', fontSize: 15.5 }}>
                                    {song.title}
                                  </Typography>
                                  <Chip
                                    label="Live"
                                    size="small"
                                    color="success"
                                    sx={{ height: 18, fontSize: '9px', fontWeight: 800, textTransform: 'uppercase' }}
                                  />
                                  <Chip
                                    label="Lossless"
                                    size="small"
                                    variant="outlined"
                                    color="secondary"
                                    sx={{ height: 18, fontSize: '9px', fontWeight: 800, textTransform: 'uppercase' }}
                                  />
                                </Stack>
                                <Typography variant="body2" color="text.secondary" noWrap sx={{ mt: 0.5, fontWeight: 500 }}>
                                  {Array.isArray(song.artists) && song.artists.length > 0
                                    ? song.artists.map((item) => item.name).filter(Boolean).join(', ')
                                    : artist?.name || 'Unknown artist'}
                                  {` • ${formattedDuration}`}
                                </Typography>
                              </Box>

                              <Stack direction="row" spacing={2.5} alignItems="center" sx={{ flexShrink: 0 }}>
                                <Box sx={{ textAlign: 'center', minWidth: 50 }}>
                                  <Typography fontWeight={800} sx={{ color: '#0ea5e9', fontSize: '15px' }}>
                                    {(song.playCount || 0).toLocaleString()}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 800, fontSize: '8px' }}>
                                    plays
                                  </Typography>
                                </Box>
                                <Box sx={{ textAlign: 'center', minWidth: 50 }}>
                                  <Typography fontWeight={800} sx={{ color: '#ef4444', fontSize: '15px' }}>
                                    {(song.likeCount || 0).toLocaleString()}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 800, fontSize: '8px' }}>
                                    likes
                                  </Typography>
                                </Box>

                                {/* Action Buttons on hover */}
                                <Stack direction="row" spacing={1}>
                                  <Tooltip title="Song Analytics">
                                    <IconButton
                                      size="small"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        showToast({ severity: 'success', title: 'Song Analytics', message: `Loading stream analytics for "${song.title}"...` });
                                      }}
                                      sx={{ bgcolor: 'action.hover', '&:hover': { bgcolor: 'action.selected' } }}
                                    >
                                      <InsightIcon sx={{ fontSize: 16 }} />
                                    </IconButton>
                                  </Tooltip>
                                  <Tooltip title="Edit Track">
                                    <IconButton
                                      size="small"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        showToast({ severity: 'info', title: 'Edit Track', message: `Opening metadata editor for "${song.title}"...` });
                                      }}
                                      sx={{ bgcolor: 'action.hover', '&:hover': { bgcolor: 'action.selected' } }}
                                    >
                                      <EditIcon sx={{ fontSize: 16 }} />
                                    </IconButton>
                                  </Tooltip>
                                </Stack>
                              </Stack>
                            </Box>
                          );
                        })}
                      </Stack>
                    )}
                  </CardContent>
                </Card>
              </Stack>
            </Grid>

            {/* Right Section: Profile Readiness Ring */}
            <Grid size={{ xs: 12, lg: 4 }}>
              <Card elevation={0} sx={{ borderRadius: 5, border: '1px solid', borderColor: 'divider', backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.01)' : '#ffffff', height: '100%' }}>
                <CardContent sx={{ p: 3.5, display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>Profile completion</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 3.5 }}>
                    Complete these milestones to make your profile ready for new fans.
                  </Typography>

                  {/* Circular SVG Progress Indicator */}
                  <Box sx={{ display: 'flex', justifyContent: 'center', mb: 4, position: 'relative' }}>
                    <svg width="120" height="120" viewBox="0 0 120 120">
                      {/* Grey background circle */}
                      <circle
                        cx="60"
                        cy="60"
                        r="52"
                        fill="transparent"
                        stroke={theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)'}
                        strokeWidth="8"
                      />
                      {/* Gradient coloring */}
                      <defs>
                        <linearGradient id="readinessGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#00bcd4" />
                          <stop offset="100%" stopColor="#6c63ff" />
                        </linearGradient>
                      </defs>
                      {/* Animated circular path */}
                      <circle
                        cx="60"
                        cy="60"
                        r="52"
                        fill="transparent"
                        stroke="url(#readinessGrad)"
                        strokeWidth="8"
                        strokeDasharray={2 * Math.PI * 52}
                        strokeDashoffset={2 * Math.PI * 52 * (1 - readinessScore / 100)}
                        strokeLinecap="round"
                        transform="rotate(-90 60 60)"
                        style={{
                          transition: 'stroke-dashoffset 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                        }}
                      />
                    </svg>
                    <Box
                      sx={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        textAlign: 'center',
                      }}
                    >
                      <Typography variant="h4" sx={{ fontWeight: 900, color: 'text.primary', lineHeight: 1 }}>
                        {readinessScore}%
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, fontSize: '9px', mt: 0.5 }}>
                        Ready
                      </Typography>
                    </Box>
                  </Box>

                  <Stack spacing={2} sx={{ flex: 1 }}>
                    <Box
                      sx={{
                        p: 2,
                        borderRadius: 4.5,
                        backgroundColor: artist?.bio
                          ? 'rgba(16, 185, 129, 0.08)'
                          : (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.01)' : 'rgba(0, 0, 0, 0.02)',
                        border: '1px solid',
                        borderColor: artist?.bio ? 'rgba(16, 185, 129, 0.25)' : 'divider',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <Typography variant="body2" sx={{ fontWeight: 700, color: artist?.bio ? 'text.primary' : 'text.secondary' }}>
                        Biography details added
                      </Typography>
                      {artist?.bio ? (
                        <Chip
                          label="Done"
                          size="small"
                          color="success"
                          sx={{ fontWeight: 800, fontSize: '10px' }}
                        />
                      ) : (
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={handleOpenEdit}
                          sx={{ borderRadius: 2, fontSize: '10.5px', py: 0.2, fontWeight: 700 }}
                        >
                          Add Bio
                        </Button>
                      )}
                    </Box>

                    <Box
                      sx={{
                        p: 2,
                        borderRadius: 4.5,
                        backgroundColor: artist?.avatar
                          ? 'rgba(16, 185, 129, 0.08)'
                          : (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.01)' : 'rgba(0, 0, 0, 0.02)',
                        border: '1px solid',
                        borderColor: artist?.avatar ? 'rgba(16, 185, 129, 0.25)' : 'divider',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <Typography variant="body2" sx={{ fontWeight: 700, color: artist?.avatar ? 'text.primary' : 'text.secondary' }}>
                        Profile avatar uploaded
                      </Typography>
                      {artist?.avatar ? (
                        <Chip
                          label="Done"
                          size="small"
                          color="success"
                          sx={{ fontWeight: 800, fontSize: '10px' }}
                        />
                      ) : (
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={handleOpenEdit}
                          sx={{ borderRadius: 2, fontSize: '10.5px', py: 0.2, fontWeight: 700 }}
                        >
                          Upload Photo
                        </Button>
                      )}
                    </Box>

                    <Box
                      sx={{
                        p: 2,
                        borderRadius: 4.5,
                        backgroundColor: songs.length > 0
                          ? 'rgba(16, 185, 129, 0.08)'
                          : (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.01)' : 'rgba(0, 0, 0, 0.02)',
                        border: '1px solid',
                        borderColor: songs.length > 0 ? 'rgba(16, 185, 129, 0.25)' : 'divider',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <Typography variant="body2" sx={{ fontWeight: 700, color: songs.length > 0 ? 'text.primary' : 'text.secondary' }}>
                        First release published
                      </Typography>
                      {songs.length > 0 ? (
                        <Chip
                          label="Done"
                          size="small"
                          color="success"
                          sx={{ fontWeight: 800, fontSize: '10px' }}
                        />
                      ) : (
                        <Button
                          variant="contained"
                          size="small"
                          onClick={() => navigate('/artist/songs')}
                          sx={{ borderRadius: 2, fontSize: '10.5px', py: 0.2, fontWeight: 700, bgcolor: '#6c63ff' }}
                        >
                          Publish Song
                        </Button>
                      )}
                    </Box>
                  </Stack>

                  <Button
                    fullWidth
                    variant="outlined"
                    onClick={handleOpenEdit}
                    endIcon={<ArrowIcon />}
                    sx={{
                      mt: 3,
                      borderColor: 'rgba(255, 255, 255, 0.12)',
                      color: 'rgba(255,255,255,0.85)',
                      fontWeight: 700,
                      borderRadius: 3.5,
                      py: 1.25,
                      textTransform: 'none',
                      '&:hover': {
                        borderColor: '#6c63ff',
                        color: '#fff',
                        backgroundColor: 'rgba(108, 99, 255, 0.05)',
                      },
                      transition: 'all 0.2s',
                    }}
                  >
                    Manage Profile Milestones
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      )}

      <ArtistProfileDialog
        open={editOpen}
        onClose={handleCloseEdit}
        onSubmit={handleSaveProfile}
        loading={editLoading}
        form={profileForm}
        onFieldChange={handleProfileChange}
        avatarFile={avatarFile}
        onAvatarFileChange={setAvatarFile}
      />
    </ArtistLayout>
  );
}

export default ArtistDashboard;
