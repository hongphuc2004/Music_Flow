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
} from '@mui/material';
import {
  People as PeopleIcon,
  MusicNote as MusicNoteIcon,
  PlaylistPlay as PlaylistIcon,
  PersonAdd as PersonAddIcon,
} from '@mui/icons-material';
import { Layout } from '../components/Layout';
import { statsApi } from '../services/api';

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
  const [data, setData] = useState({
    stats: { totalUsers: 0, totalSongs: 0, totalPlaylists: 0, newUsers: 0 },
    recentUsers: [],
    recentSongs: [],
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await statsApi.getDashboard();
      setData(response.data);
      setError(null);
    } catch (err) {
      setError('Failed to load dashboard data. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const statsCards = [
    { title: 'Total Users', value: data.stats.totalUsers, icon: <PeopleIcon />, color: '#6c63ff' },
    { title: 'Total Songs', value: data.stats.totalSongs, icon: <MusicNoteIcon />, color: '#00bcd4' },
    { title: 'Total Playlists', value: data.stats.totalPlaylists, icon: <PlaylistIcon />, color: '#4caf50' },
    { title: 'New Users (30d)', value: data.stats.newUsers, icon: <PersonAddIcon />, color: '#ff9800' },
  ];

  if (loading) {
    return (
      <Layout title="Dashboard">
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
          <CircularProgress />
        </Box>
      </Layout>
    );
  }

  return (
    <Layout title="Dashboard">
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          Welcome back, Admin!
        </Typography>
        <Typography color="text.secondary">
          Here's what's happening with MusicFlow today.
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {statsCards.map((stat, index) => (
          <Grid size={{ xs: 12, sm: 6, md: 3 }} key={index}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Avatar
                    sx={{
                      bgcolor: `${stat.color}20`,
                      color: stat.color,
                      mr: 2,
                    }}
                  >
                    {stat.icon}
                  </Avatar>
                </Box>
                <Typography variant="h4" fontWeight={700}>
                  {stat.value.toLocaleString()}
                </Typography>
                <Typography color="text.secondary" variant="body2">
                  {stat.title}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Recent Activity */}
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              Recent Users
            </Typography>
            {data.recentUsers.length === 0 ? (
              <Typography color="text.secondary">No users yet</Typography>
            ) : (
              <List>
                {data.recentUsers.map((user) => (
                  <ListItem key={user._id} sx={{ px: 0 }}>
                    <ListItemAvatar>
                      <Avatar src={user.avatar} sx={{ bgcolor: '#6c63ff' }}>
                        {user.name?.charAt(0)}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={user.name}
                      secondary={user.email}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {timeAgo(user.createdAt)}
                    </Typography>
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              Recent Songs
            </Typography>
            {data.recentSongs.length === 0 ? (
              <Typography color="text.secondary">No songs yet</Typography>
            ) : (
              <List>
                {data.recentSongs.map((song) => (
                  <ListItem key={song._id} sx={{ px: 0 }}>
                    <ListItemAvatar>
                      <Avatar src={song.imageUrl} sx={{ bgcolor: '#00bcd4' }}>
                        <MusicNoteIcon />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={song.title}
                      secondary={song.artist}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {timeAgo(song.createdAt)}
                    </Typography>
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
