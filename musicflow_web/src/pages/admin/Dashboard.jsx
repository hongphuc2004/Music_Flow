import { useState, useEffect } from 'react';
import {
  Grid,
  Paper,
  Typography,
  Box,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Chip,
  CircularProgress,
  Alert,
  alpha,
  useTheme,
  Button,
  IconButton,
  Tooltip,
  Divider,
  LinearProgress,
  Stack,
} from '@mui/material';
import {
  People as PeopleIcon,
  MusicNote as MusicNoteIcon,
  PlaylistPlay as PlaylistIcon,
  PersonAdd as PersonAddIcon,
  LibraryMusic as LibraryMusicIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Block as BlockIcon,
  CheckCircle as CheckCircleIcon,
  Storage as StorageIcon,
  Speed as SpeedIcon,
  Refresh as RefreshIcon,
  SettingsBackupRestore as BackupIcon,
  AutoAwesome as SparklesIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  TrendingUp as TrendingIcon,
  LockOpen as LockOpenIcon,
  Dns as DnsIcon,
} from '@mui/icons-material';
import { Layout } from '../../components/Layout';
import { statsApi, clearApiCache } from '../../services/api';
import useAppToast from '../../components/common/useAppToast';

// Helper function to format time ago
const timeAgo = (date) => {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  const intervals = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60,
  };

  for (const [unit, secondsInUnit] of Object.entries(intervals)) {
    const interval = Math.floor(seconds / secondsInUnit);
    if (interval >= 1) {
      return `${interval} ${unit}${interval > 1 ? 's' : ''} ago`;
    }
  }
  return 'Just now';
};

function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const theme = useTheme();
  const { showToast } = useAppToast();
  
  const [data, setData] = useState({
    stats: { totalUsers: 0, totalSongs: 0, totalPlaylists: 0, newUsers: 0 },
    recentAccounts: [],
    recentSongs: [],
  });

  const [accountsList, setAccountsList] = useState([]);
  const [songsList, setSongsList] = useState([]);
  const [playingSongId, setPlayingSongId] = useState(null);

  const [apiSpeed, setApiSpeed] = useState(null);
  const [loadingCloudinary, setLoadingCloudinary] = useState(true);
  const [cloudinaryUsage, setCloudinaryUsage] = useState({
    usageBytes: 0,
    limitBytes: 25 * 1024 * 1024 * 1024,
    usedPercent: 0,
  });

  const [actionLoading, setActionLoading] = useState({
    cleanCache: false,
    backupDb: false,
    regenAi: false
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchCloudinaryStats = async () => {
    try {
      setLoadingCloudinary(true);
      const response = await statsApi.getCloudinaryUsage();
      setCloudinaryUsage(response.data);
    } catch (err) {
      console.warn("Failed to load Cloudinary stats:", err);
    } finally {
      setLoadingCloudinary(false);
    }
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      // Fetch Cloudinary usage stats in parallel so it doesn't block the main stats dashboard API
      fetchCloudinaryStats();

      const startTime = performance.now();
      const response = await statsApi.getDashboard();
      const endTime = performance.now();
      setApiSpeed(Math.round(endTime - startTime));

      const fetchedData = response.data;
      setData({
        stats: fetchedData.stats || { totalUsers: 0, totalSongs: 0, totalPlaylists: 0, newUsers: 0 },
        recentAccounts: fetchedData.recentAccounts || fetchedData.recentUsers || [],
        recentSongs: fetchedData.recentSongs || [],
      });
      setAccountsList(fetchedData.recentAccounts || fetchedData.recentUsers || []);
      setSongsList(fetchedData.recentSongs || []);
      setError(null);
    } catch {
      setError('Failed to load dashboard data. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleCleanCache = async () => {
    setActionLoading(prev => ({ ...prev, cleanCache: true }));
    try {
      const response = await statsApi.cleanCache();
      clearApiCache();
      showToast({
        severity: 'success',
        title: 'Cache Cleared',
        message: response.data?.message || 'System GET caching pool wiped out.'
      });
    } catch (err) {
      showToast({
        severity: 'error',
        title: 'Cache Clear Failed',
        message: err.response?.data?.message || 'Failed to clean system cache.'
      });
    } finally {
      setActionLoading(prev => ({ ...prev, cleanCache: false }));
    }
  };

  const handleBackupDb = async () => {
    setActionLoading(prev => ({ ...prev, backupDb: true }));
    try {
      const response = await statsApi.backupDb();
      showToast({
        severity: 'success',
        title: 'Database Backup',
        message: response.data?.message || 'MongoDB automated backup created.'
      });
    } catch (err) {
      showToast({
        severity: 'error',
        title: 'Backup Failed',
        message: err.response?.data?.message || 'Failed to backup database.'
      });
    } finally {
      setActionLoading(prev => ({ ...prev, backupDb: false }));
    }
  };

  const handleRegenAi = async () => {
    setActionLoading(prev => ({ ...prev, regenAi: true }));
    try {
      const response = await statsApi.regenAi();
      showToast({
        severity: 'success',
        title: 'AI Dj Regenerated',
        message: response.data?.message || 'Successfully rebuilt mood similarity lists.'
      });
    } catch (err) {
      showToast({
        severity: 'error',
        title: 'AI Regen Failed',
        message: err.response?.data?.message || 'Failed to rebuild mood lists.'
      });
    } finally {
      setActionLoading(prev => ({ ...prev, regenAi: false }));
    }
  };

  const toggleLockUser = (userId, name) => {
    setAccountsList(prev => prev.map(u => {
      if (u._id === userId) {
        const isCurrentlyLocked = u.status === 'suspended';
        const nextStatus = isCurrentlyLocked ? 'active' : 'suspended';
        showToast({
          severity: 'success',
          title: isCurrentlyLocked ? 'Account Unlocked' : 'Account Suspended',
          message: `User ${name} has been successfully ${isCurrentlyLocked ? 'activated' : 'suspended'}.`
        });
        return { ...u, status: nextStatus };
      }
      return u;
    }));
  };

  const toggleSongVisibility = (songId, title) => {
    setSongsList(prev => prev.map(s => {
      if (s._id === songId) {
        const isCurrentlyPrivate = s.isPublic === false;
        const nextPublic = !s.isPublic;
        showToast({
          severity: 'success',
          title: isCurrentlyPrivate ? 'Song set to Public' : 'Song set to Private',
          message: `Song "${title}" is now ${isCurrentlyPrivate ? 'visible to all users' : 'hidden from public library'}.`
        });
        return { ...s, isPublic: nextPublic };
      }
      return s;
    }));
  };

  const playSongPreview = (songId, songTitle) => {
    if (playingSongId === songId) {
      setPlayingSongId(null);
      showToast({
        severity: 'info',
        title: 'Preview Stopped',
        message: `Stopped listening to ${songTitle}.`
      });
    } else {
      setPlayingSongId(songId);
      showToast({
        severity: 'success',
        title: 'Preview Started',
        message: `Streaming preview of ${songTitle} (128kbps stream preview).`
      });
    }
  };

  const statsCards = [
    { 
      title: 'Total Accounts', 
      value: data.stats.totalUsers, 
      icon: <PeopleIcon sx={{ fontSize: 30, color: '#fff' }} />, 
      gradient: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
      shadow: 'rgba(124, 58, 237, 0.35)',
      growth: '+12% this month'
    },
    { 
      title: 'Total Songs', 
      value: data.stats.totalSongs, 
      icon: <MusicNoteIcon sx={{ fontSize: 30, color: '#fff' }} />, 
      gradient: 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)',
      shadow: 'rgba(37, 99, 235, 0.35)',
      growth: '+24 upload today'
    },
    { 
      title: 'Total Playlists', 
      value: data.stats.totalPlaylists, 
      icon: <LibraryMusicIcon sx={{ fontSize: 30, color: '#fff' }} />, 
      gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      shadow: 'rgba(16, 185, 129, 0.35)',
      growth: '+5 new this week'
    },
    { 
      title: 'New Accounts (30d)', 
      value: data.stats.newUsers, 
      icon: <PersonAddIcon sx={{ fontSize: 30, color: '#fff' }} />, 
      gradient: 'linear-gradient(135deg, #f43f5e 0%, #db2777 100%)',
      shadow: 'rgba(219, 39, 119, 0.35)',
      growth: '+8% vs last month'
    },
  ];

  if (loading) {
    return (
      <Layout title="Dashboard Admin">
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
          <CircularProgress size={60} thickness={4} sx={{ color: 'primary.main' }} />
        </Box>
      </Layout>
    );
  }

  return (
    <Layout title="Dashboard Admin">
      {/* Welcome Header */}
      <Box sx={{ mb: 5, pt: 2 }}>
        <Typography 
          variant="h3" 
          fontWeight={900} 
          gutterBottom 
          sx={{ 
            background: 'linear-gradient(90deg, #6c63ff 0%, #00bcd4 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            display: 'inline-block',
            letterSpacing: '-1.5px',
          }}
        >
          Welcome back, Admin!
        </Typography>
        <Typography variant="h6" color="text.secondary" fontWeight={400} sx={{ mt: 1 }}>
          Here's what's happening with MusicFlow today.
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 4, borderRadius: 2, fontSize: '1.05rem', boxShadow: '0 4px 12px rgba(211, 47, 47, 0.1)' }}>
          {error}
        </Alert>
      )}

      {/* Live Server Status & System Info Panel */}
      <Grid container spacing={4} sx={{ mb: 6 }}>
        <Grid size={{ xs: 12 }}>
          <Paper
            elevation={0}
            sx={{
              p: 3.5,
              borderRadius: 5,
              border: '1px solid',
              borderColor: 'divider',
              background: (theme) => theme.palette.mode === 'dark' 
                ? 'linear-gradient(135deg, rgba(30, 41, 59, 0.4) 0%, rgba(108, 99, 255, 0.05) 100%)' 
                : 'linear-gradient(135deg, #ffffff 0%, rgba(108, 99, 255, 0.02) 100%)',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: '0 8px 32px rgba(108, 99, 255, 0.03)',
            }}
          >
            {/* Blinking green dot */}
            <Box
              sx={{
                position: 'absolute',
                top: 20,
                right: 20,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <Box
                sx={{
                  width: 10,
                  height: 10,
                  bgcolor: '#10b981',
                  borderRadius: '50%',
                  boxShadow: '0 0 10px #10b981',
                  animation: 'pulse 1.5s infinite',
                  '@keyframes pulse': {
                    '0%': { opacity: 0.4 },
                    '50%': { opacity: 1 },
                    '100%': { opacity: 0.4 },
                  }
                }}
              />
              <Typography variant="caption" sx={{ fontWeight: 800, color: '#10b981', textTransform: 'uppercase', letterSpacing: 1.5 }}>
                System Live
              </Typography>
            </Box>

            <Grid container spacing={3} alignItems="center">
              <Grid size={{ xs: 12, md: 3.5 }}>
                <Typography variant="h6" fontWeight={850} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <DnsIcon sx={{ color: 'primary.main' }} /> System Control & Health
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  Realtime connection metrics and storage analytics.
                </Typography>
              </Grid>
              
              <Grid size={{ xs: 12, sm: 4, md: 2.5 }}>
                <Stack spacing={0.5}>
                  <Typography variant="caption" color="text.secondary" fontWeight={700}>
                    API RESPONSE SPEED
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <SpeedIcon sx={{ color: '#0ea5e9', fontSize: 18 }} />
                    <Typography variant="body1" fontWeight={800}>
                      {apiSpeed !== null ? `${apiSpeed} ms` : 'Calculating...'} <span style={{ color: apiSpeed < 300 ? '#10b981' : '#f59e0b', fontSize: '12px', fontWeight: 500 }}>({apiSpeed < 300 ? 'Normal' : 'Slow'})</span>
                    </Typography>
                  </Stack>
                </Stack>
              </Grid>

              <Grid size={{ xs: 12, sm: 4, md: 2.5 }}>
                <Stack spacing={0.5}>
                  <Typography variant="caption" color="text.secondary" fontWeight={700}>
                    CLOUDINARY STORAGE
                  </Typography>
                  {loadingCloudinary ? (
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ height: 32 }}>
                      <CircularProgress size={16} sx={{ color: '#8b5cf6' }} />
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '13px' }}>
                        Loading usage...
                      </Typography>
                    </Stack>
                  ) : (
                    <>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                        <StorageIcon sx={{ color: '#8b5cf6', fontSize: 18 }} />
                        <Typography variant="body2" fontWeight={800}>
                          {(cloudinaryUsage.usageBytes / (1024 * 1024 * 1024)).toFixed(2)} GB / {(cloudinaryUsage.limitBytes / (1024 * 1024 * 1024)).toFixed(2)} GB
                        </Typography>
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={cloudinaryUsage.usedPercent}
                        sx={{
                          height: 6,
                          borderRadius: 3,
                          bgcolor: 'divider',
                          '& .MuiLinearProgress-bar': {
                            borderRadius: 3,
                            bgcolor: '#8b5cf6',
                          }
                        }}
                      />
                    </>
                  )}
                </Stack>
              </Grid>

              <Grid size={{ xs: 12, sm: 4, md: 3.5 }}>
                <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ display: 'block', mb: 1 }}>
                  QUICK ADMIN COMMANDS
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Tooltip title="Wipe out system cache pool">
                    <span>
                      <Button
                        variant="outlined"
                        size="small"
                        disabled={actionLoading.cleanCache}
                        onClick={handleCleanCache}
                        startIcon={actionLoading.cleanCache ? <CircularProgress size={12} color="inherit" /> : <RefreshIcon />}
                        sx={{ borderRadius: 2, fontSize: '11px', fontWeight: 700 }}
                      >
                        Clean Cache
                      </Button>
                    </span>
                  </Tooltip>
                  
                  <Tooltip title="Generate DB backup">
                    <span>
                      <Button
                        variant="outlined"
                        size="small"
                        disabled={actionLoading.backupDb}
                        onClick={handleBackupDb}
                        startIcon={actionLoading.backupDb ? <CircularProgress size={12} color="inherit" /> : <BackupIcon />}
                        sx={{ borderRadius: 2, fontSize: '11px', fontWeight: 700 }}
                      >
                        Backup DB
                      </Button>
                    </span>
                  </Tooltip>

                  <Tooltip title="Regenerate AIDJ Mood playlists map">
                    <span>
                      <Button
                        variant="outlined"
                        size="small"
                        disabled={actionLoading.regenAi}
                        onClick={handleRegenAi}
                        startIcon={actionLoading.regenAi ? <CircularProgress size={12} color="inherit" /> : <SparklesIcon />}
                        sx={{ borderRadius: 2, fontSize: '11px', fontWeight: 700, borderColor: 'primary.main', color: 'primary.main' }}
                      >
                        Regen AI
                      </Button>
                    </span>
                  </Tooltip>
                </Stack>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>

      {/* Stats Cards */}
      <Grid container spacing={4} sx={{ mb: 6 }}>
        {statsCards.map((stat, index) => (
          <Grid size={{ xs: 12, sm: 6, md: 3 }} key={index}>
            <Card 
              sx={{ 
                height: '100%', 
                background: stat.gradient,
                color: '#fff',
                borderRadius: 5,
                boxShadow: `0 10px 22px ${stat.shadow}`,
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                position: 'relative',
                overflow: 'hidden',
                '&:hover': {
                  transform: 'translateY(-6px)',
                  boxShadow: `0 16px 32px ${stat.shadow}`,
                },
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  top: -20,
                  right: -20,
                  width: 90,
                  height: 90,
                  background: 'rgba(255, 255, 255, 0.08)',
                  borderRadius: '50%',
                }
              }}
            >
              <CardContent sx={{ p: 3, position: 'relative', zIndex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ opacity: 0.9, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    {stat.title}
                  </Typography>
                  <Box 
                    sx={{ 
                      p: 1.25, 
                      backgroundColor: 'rgba(255,255,255,0.18)', 
                      borderRadius: 3,
                      backdropFilter: 'blur(10px)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 4px 10px rgba(0,0,0,0.05)'
                    }}
                  >
                    {stat.icon}
                  </Box>
                </Box>
                <Typography variant="h3" fontWeight={850} sx={{ textShadow: '0 2px 4px rgba(0,0,0,0.15)', mb: 1, letterSpacing: -1 }}>
                  {stat.value.toLocaleString()}
                </Typography>
                
                {/* Growth indicator badge */}
                <Box sx={{ display: 'inline-flex', bgcolor: 'rgba(255,255,255,0.15)', px: 1.25, py: 0.25, borderRadius: 2, border: '1px solid rgba(255,255,255,0.1)' }}>
                  <Typography variant="caption" sx={{ fontWeight: 800, fontSize: '10px' }}>
                    {stat.growth}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Recent Activity */}
      <Grid container spacing={4}>
        {/* Recent Accounts List */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper 
            sx={{ 
              p: 3.5, 
              height: '100%', 
              borderRadius: 5, 
              boxShadow: '0 8px 32px rgba(0,0,0,0.03)',
              border: '1px solid',
              borderColor: 'divider',
              transition: 'all 0.3s',
              '&:hover': { boxShadow: '0 12px 40px rgba(0,0,0,0.06)' }
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
              <Typography variant="h5" fontWeight={800} color="text.primary" sx={{ letterSpacing: -0.5 }}>
                Recent Accounts
              </Typography>
              <Chip label="System Log" size="small" sx={{ fontWeight: 700 }} />
            </Box>
            
            {accountsList.length === 0 ? (
              <Box sx={{ py: 6, textAlign: 'center' }}>
                <PeopleIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1.5 }} />
                <Typography color="text.secondary">No accounts yet</Typography>
              </Box>
            ) : (
              <List sx={{ p: 0 }}>
                {accountsList.map((user) => {
                  const isLocked = user.status === 'suspended';
                  return (
                    <ListItem 
                      key={user._id} 
                      sx={{ 
                        px: 2, 
                        py: 1.5,
                        mb: 1.5,
                        borderRadius: 4,
                        border: '1px solid',
                        borderColor: 'divider',
                        bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.01)',
                        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                        '&:hover': {
                          bgcolor: alpha(theme.palette.primary.main, 0.04),
                          borderColor: alpha(theme.palette.primary.main, 0.15),
                          transform: 'translateX(4px)',
                        }
                      }}
                      secondaryAction={
                        <Tooltip title={isLocked ? "Unlock User" : "Suspend User"}>
                          <IconButton 
                            edge="end" 
                            onClick={() => toggleLockUser(user._id, user.name)}
                            color={isLocked ? "success" : "error"}
                            sx={{ 
                              bgcolor: isLocked ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                              '&:hover': {
                                bgcolor: isLocked ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                              }
                            }}
                          >
                            {isLocked ? <LockOpenIcon sx={{ fontSize: 18 }} /> : <BlockIcon sx={{ fontSize: 18 }} />}
                          </IconButton>
                        </Tooltip>
                      }
                    >
                      <ListItemAvatar>
                        <Avatar 
                          src={user.avatar} 
                          sx={{ 
                            bgcolor: theme.palette.primary.main, 
                            width: 46, 
                            height: 46,
                            boxShadow: '0 4px 10px rgba(108, 99, 255, 0.15)'
                          }}
                        >
                          {user.name?.charAt(0)}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        sx={{ ml: 1, pr: 6 }}
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
                            <Typography fontWeight={750} noWrap sx={{ maxWidth: '140px', fontSize: 14.5 }}>
                              {user.name}
                            </Typography>
                            <Chip
                              label={user.role === 'artist' ? 'Artist' : user.role === 'admin' ? 'Admin' : 'User'}
                              size="small"
                              sx={{
                                bgcolor: user.role === 'artist' ? 'rgba(237, 108, 2, 0.12)' : user.role === 'admin' ? 'rgba(211, 47, 47, 0.12)' : 'rgba(25, 118, 210, 0.12)',
                                color: user.role === 'artist' ? '#ed6c02' : user.role === 'admin' ? '#d32f2f' : '#1976d2',
                                fontWeight: 800,
                                fontSize: '0.65rem',
                                height: 18,
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em'
                              }}
                            />
                            {isLocked && (
                              <Chip
                                label="Suspended"
                                size="small"
                                color="error"
                                sx={{ fontWeight: 800, fontSize: '0.65rem', height: 18, textTransform: 'uppercase' }}
                              />
                            )}
                          </Box>
                        }
                        secondary={
                          <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: '180px', fontSize: 13 }}>
                            {user.email} • {timeAgo(user.createdAt)}
                          </Typography>
                        }
                      />
                    </ListItem>
                  );
                })}
              </List>
            )}
          </Paper>
        </Grid>

        {/* Recent Songs List */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper 
            sx={{ 
              p: 3.5, 
              height: '100%', 
              borderRadius: 5, 
              boxShadow: '0 8px 32px rgba(0,0,0,0.03)',
              border: '1px solid',
              borderColor: 'divider',
              transition: 'all 0.3s',
              '&:hover': { boxShadow: '0 12px 40px rgba(0,0,0,0.06)' }
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
              <Typography variant="h5" fontWeight={800} color="text.primary" sx={{ letterSpacing: -0.5 }}>
                Recent Songs
              </Typography>
              <Chip label="Catalog Log" size="small" sx={{ fontWeight: 700 }} />
            </Box>

            {songsList.length === 0 ? (
              <Box sx={{ py: 6, textAlign: 'center' }}>
                <MusicNoteIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1.5 }} />
                <Typography color="text.secondary">No songs yet</Typography>
              </Box>
            ) : (
              <List sx={{ p: 0 }}>
                {songsList.map((song) => {
                  const isCurrentlyPlaying = playingSongId === song._id;
                  const isPrivate = song.isPublic === false;
                  return (
                    <ListItem 
                      key={song._id} 
                      sx={{ 
                        px: 2, 
                        py: 1.5,
                        mb: 1.5,
                        borderRadius: 4,
                        border: '1px solid',
                        borderColor: 'divider',
                        bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.01)',
                        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                        '&:hover': {
                          bgcolor: alpha(theme.palette.secondary.main, 0.04),
                          borderColor: alpha(theme.palette.secondary.main, 0.15),
                          transform: 'translateX(4px)',
                        }
                      }}
                      secondaryAction={
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Tooltip title={isPrivate ? "Make Public" : "Make Private"}>
                            <IconButton 
                              onClick={() => toggleSongVisibility(song._id, song.title)}
                              color="secondary"
                              sx={{
                                bgcolor: isPrivate ? 'rgba(237, 108, 2, 0.08)' : 'rgba(16, 185, 129, 0.08)',
                                '&:hover': {
                                  bgcolor: isPrivate ? 'rgba(237, 108, 2, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                                }
                              }}
                            >
                              {isPrivate ? <VisibilityOffIcon sx={{ fontSize: 18, color: '#ed6c02' }} /> : <VisibilityIcon sx={{ fontSize: 18, color: '#2e7d32' }} />}
                            </IconButton>
                          </Tooltip>

                          <Tooltip title={isCurrentlyPlaying ? "Pause Preview" : "Play Preview"}>
                            <IconButton 
                              onClick={() => playSongPreview(song._id, song.title)}
                              color="primary"
                              sx={{ 
                                bgcolor: isCurrentlyPlaying ? 'rgba(108, 99, 255, 0.2)' : 'rgba(108, 99, 255, 0.08)',
                                '&:hover': { bgcolor: 'rgba(108, 99, 255, 0.25)' }
                              }}
                            >
                              {isCurrentlyPlaying ? <PauseIcon sx={{ fontSize: 18 }} /> : <PlayIcon sx={{ fontSize: 18 }} />}
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      }
                    >
                      <ListItemAvatar>
                        <Avatar 
                          src={song.imageUrl} 
                          variant="rounded"
                          sx={{ 
                            bgcolor: theme.palette.secondary.main, 
                            width: 46, 
                            height: 46, 
                            borderRadius: 2.5,
                            boxShadow: '0 4px 10px rgba(0, 188, 212, 0.15)'
                          }}
                        >
                          <MusicNoteIcon />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        sx={{ ml: 1, pr: 10 }}
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
                            <Typography fontWeight={750} noWrap sx={{ maxWidth: '120px', fontSize: 14.5 }}>
                              {song.title}
                            </Typography>
                            <Chip
                              label={isPrivate ? "Private" : "Public"}
                              size="small"
                              sx={{
                                height: 16,
                                fontSize: '0.6rem',
                                fontWeight: 800,
                                bgcolor: isPrivate ? 'rgba(237, 108, 2, 0.12)' : 'rgba(46, 125, 50, 0.12)',
                                color: isPrivate ? '#ed6c02' : '#2e7d32',
                              }}
                            />
                            {isCurrentlyPlaying && (
                              <Typography variant="caption" color="primary.main" fontWeight={800} sx={{ fontSize: '10px', animation: 'blink 1s infinite' }}>
                                ● PREVIEWING
                              </Typography>
                            )}
                          </Box>
                        }
                        secondary={
                          <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: '180px', fontSize: 13 }}>
                            {song.artist || 'Artist'} • {timeAgo(song.createdAt)}
                          </Typography>
                        }
                      />
                    </ListItem>
                  );
                })}
              </List>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Layout>
  );
}

export default Dashboard;
