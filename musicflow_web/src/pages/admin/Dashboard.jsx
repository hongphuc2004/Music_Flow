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
} from '@mui/material';
import {
  People as PeopleIcon,
  MusicNote as MusicNoteIcon,
  PlaylistPlay as PlaylistIcon,
  PersonAdd as PersonAddIcon,
  LibraryMusic as LibraryMusicIcon,
} from '@mui/icons-material';
import { Layout } from '../../components/Layout';
import { statsApi } from '../../services/api';

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
  const [data, setData] = useState({
    stats: { totalUsers: 0, totalSongs: 0, totalPlaylists: 0, newUsers: 0 },
    recentAccounts: [],
    recentSongs: [],
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await statsApi.getDashboard();
      setData({
        ...response.data,
        recentAccounts: response.data.recentAccounts || response.data.recentUsers || [],
      });
      setError(null);
    } catch (err) {
      setError('Failed to load dashboard data. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const statsCards = [
    { 
      title: 'Total Accounts', 
      value: data.stats.totalUsers, 
      icon: <PeopleIcon sx={{ fontSize: 32, color: '#fff' }} />, 
      gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      shadow: 'rgba(118, 75, 162, 0.4)'
    },
    { 
      title: 'Total Songs', 
      value: data.stats.totalSongs, 
      icon: <MusicNoteIcon sx={{ fontSize: 32, color: '#fff' }} />, 
      gradient: 'linear-gradient(135deg, #00c6ff 0%, #0072ff 100%)',
      shadow: 'rgba(0, 114, 255, 0.4)'
    },
    { 
      title: 'Total Playlists', 
      value: data.stats.totalPlaylists, 
      icon: <LibraryMusicIcon sx={{ fontSize: 32, color: '#fff' }} />, 
      gradient: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
      shadow: 'rgba(56, 239, 125, 0.4)'
    },
    { 
      title: 'New Accounts (30d)', 
      value: data.stats.newUsers, 
      icon: <PersonAddIcon sx={{ fontSize: 32, color: '#fff' }} />, 
      gradient: 'linear-gradient(135deg, #f12711 0%, #f5af19 100%)',
      shadow: 'rgba(245, 175, 25, 0.4)'
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
          fontWeight={800} 
          gutterBottom 
          sx={{ 
            background: 'linear-gradient(90deg, #6c63ff 0%, #00bcd4 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            display: 'inline-block'
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

      {/* Stats Cards */}
      <Grid container spacing={4} sx={{ mb: 6 }}>
        {statsCards.map((stat, index) => (
          <Grid size={{ xs: 12, sm: 6, md: 3 }} key={index}>
            <Card 
              sx={{ 
                height: '100%', 
                background: stat.gradient,
                color: '#fff',
                borderRadius: 4,
                boxShadow: `0 10px 20px ${stat.shadow}`,
                transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                position: 'relative',
                overflow: 'hidden',
                '&:hover': {
                  transform: 'translateY(-8px)',
                  boxShadow: `0 15px 30px ${stat.shadow}`,
                },
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  top: -20,
                  right: -20,
                  width: 100,
                  height: 100,
                  background: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '50%',
                }
              }}
            >
              <CardContent sx={{ p: 3, position: 'relative', zIndex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                  <Typography variant="h6" fontWeight={500} sx={{ opacity: 0.9 }}>
                    {stat.title}
                  </Typography>
                  <Box 
                    sx={{ 
                      p: 1.5, 
                      backgroundColor: 'rgba(255,255,255,0.2)', 
                      borderRadius: 3,
                      backdropFilter: 'blur(10px)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {stat.icon}
                  </Box>
                </Box>
                <Typography variant="h3" fontWeight={800} sx={{ textShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                  {stat.value.toLocaleString()}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Recent Activity */}
      <Grid container spacing={4}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper 
            sx={{ 
              p: 4, 
              height: '100%', 
              borderRadius: 4, 
              boxShadow: '0 8px 32px rgba(0,0,0,0.06)',
              border: '1px solid rgba(0,0,0,0.04)',
              transition: 'box-shadow 0.3s ease',
              '&:hover': { boxShadow: '0 12px 40px rgba(0,0,0,0.1)' }
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
              <Typography variant="h5" fontWeight={700} color="text.primary">
                Recent Accounts
              </Typography>
              <Chip label="View All" size="small" sx={{ fontWeight: 600, cursor: 'pointer', '&:hover': { bgcolor: 'primary.light', color: 'white' } }} />
            </Box>
            
            {data.recentAccounts.length === 0 ? (
              <Box sx={{ py: 4, textAlign: 'center' }}>
                <PeopleIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                <Typography color="text.secondary">No accounts yet</Typography>
              </Box>
            ) : (
              <List sx={{ p: 0 }}>
                {data.recentAccounts.map((user, index) => (
                  <ListItem 
                    key={user._id} 
                    sx={{ 
                      px: 2, 
                      py: 1.5,
                      mb: 1.5,
                      borderRadius: 3,
                      border: '1px solid transparent',
                      transition: 'all 0.2s',
                      '&:hover': {
                        bgcolor: alpha(theme.palette.primary.main, 0.04),
                        border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                        transform: 'translateX(4px)',
                      }
                    }}
                  >
                    <ListItemAvatar>
                      <Avatar 
                        src={user.avatar} 
                        sx={{ 
                          bgcolor: theme.palette.primary.main, 
                          width: 48, 
                          height: 48,
                          boxShadow: '0 4px 10px rgba(108, 99, 255, 0.3)'
                        }}
                      >
                        {user.name?.charAt(0)}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      sx={{ ml: 1 }}
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <Typography fontWeight={600} noWrap sx={{ maxWidth: '200px' }}>
                            {user.name}
                          </Typography>
                          <Chip
                            label={user.role === 'artist' ? 'Artist' : user.role === 'admin' ? 'Admin' : 'User'}
                            size="small"
                            sx={{
                              bgcolor: user.role === 'artist' ? '#fff4e5' : user.role === 'admin' ? '#fdecea' : '#e3f2fd',
                              color: user.role === 'artist' ? '#ed6c02' : user.role === 'admin' ? '#d32f2f' : '#1976d2',
                              fontWeight: 700,
                              fontSize: '0.7rem',
                              height: 20,
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em'
                            }}
                          />
                        </Box>
                      }
                      secondary={
                        <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: '250px' }}>
                          {user.email}
                        </Typography>
                      }
                    />
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', minWidth: '80px' }}>
                      <Typography variant="caption" color="text.secondary" fontWeight={500}>
                        {timeAgo(user.createdAt)}
                      </Typography>
                    </Box>
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Paper 
            sx={{ 
              p: 4, 
              height: '100%', 
              borderRadius: 4, 
              boxShadow: '0 8px 32px rgba(0,0,0,0.06)',
              border: '1px solid rgba(0,0,0,0.04)',
              transition: 'box-shadow 0.3s ease',
              '&:hover': { boxShadow: '0 12px 40px rgba(0,0,0,0.1)' }
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
              <Typography variant="h5" fontWeight={700} color="text.primary">
                Recent Songs
              </Typography>
              <Chip label="View All" size="small" sx={{ fontWeight: 600, cursor: 'pointer', '&:hover': { bgcolor: 'secondary.light', color: 'white' } }} />
            </Box>

            {data.recentSongs.length === 0 ? (
              <Box sx={{ py: 4, textAlign: 'center' }}>
                <MusicNoteIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                <Typography color="text.secondary">No songs yet</Typography>
              </Box>
            ) : (
              <List sx={{ p: 0 }}>
                {data.recentSongs.map((song) => (
                  <ListItem 
                    key={song._id} 
                    sx={{ 
                      px: 2, 
                      py: 1.5,
                      mb: 1.5,
                      borderRadius: 3,
                      border: '1px solid transparent',
                      transition: 'all 0.2s',
                      '&:hover': {
                        bgcolor: alpha(theme.palette.secondary.main, 0.04),
                        border: `1px solid ${alpha(theme.palette.secondary.main, 0.1)}`,
                        transform: 'translateX(4px)',
                      }
                    }}
                  >
                    <ListItemAvatar>
                      <Avatar 
                        src={song.imageUrl} 
                        variant="rounded"
                        sx={{ 
                          bgcolor: theme.palette.secondary.main, 
                          width: 48, 
                          height: 48, 
                          borderRadius: 2,
                          boxShadow: '0 4px 10px rgba(0, 188, 212, 0.3)'
                        }}
                      >
                        <MusicNoteIcon />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      sx={{ ml: 1 }}
                      primary={
                        <Typography fontWeight={600} noWrap sx={{ maxWidth: '200px', mb: 0.5 }}>
                          {song.title}
                        </Typography>
                      }
                      secondary={
                        <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: '250px' }}>
                          {song.artist}
                        </Typography>
                      }
                    />
                    <Box sx={{ display: 'flex', flexShrink: 0, alignItems: 'center' }}>
                      <Typography variant="caption" color="text.secondary" fontWeight={500} sx={{ 
                        bgcolor: 'rgba(0,0,0,0.04)', 
                        px: 1.5, 
                        py: 0.5, 
                        borderRadius: 4 
                      }}>
                        {timeAgo(song.createdAt)}
                      </Typography>
                    </Box>
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Layout>
  );
}

export default Dashboard;

