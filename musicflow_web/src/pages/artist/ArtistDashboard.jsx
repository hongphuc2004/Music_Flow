

import React, { useEffect, useState } from 'react';
import { Grid, Typography, Box, Avatar, Stack, Card, CardContent } from '@mui/material';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import FavoriteIcon from '@mui/icons-material/Favorite';
import HeadphonesIcon from '@mui/icons-material/Headphones';
import ArtistLayout from '../../components/Layout/artist/ArtistLayout';
import axios from 'axios';

const ArtistDashboard = () => {
  const [stats, setStats] = useState({ totalSongs: 0, totalViews: 0, totalLikes: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const artistName = localStorage.getItem('artistName');
        if (!artistName) {
          setStats({ totalSongs: 0, totalViews: 0, totalLikes: 0 });
          setLoading(false);
          return;
        }
        const res = await axios.get(`/api/songs/by-artist?name=${encodeURIComponent(artistName)}`);
        const songs = res.data.songs || [];
        const totalSongs = songs.length;
        const totalViews = songs.reduce((sum, s) => sum + (s.playCount || 0), 0);
        const totalLikes = songs.reduce((sum, s) => sum + (s.likeCount || 0), 0);
        setStats({ totalSongs, totalViews, totalLikes });
      } catch (err) {
        setStats({ totalSongs: 0, totalViews: 0, totalLikes: 0 });
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const statList = [
    { label: 'Tổng bài hát', value: stats.totalSongs, icon: <MusicNoteIcon color="primary" /> },
    { label: 'Lượt nghe', value: stats.totalViews, icon: <HeadphonesIcon color="success" /> },
    { label: 'Lượt thích', value: stats.totalLikes, icon: <FavoriteIcon color="error" /> },
  ];

  return (
    <ArtistLayout title="Artist Dashboard">
      <Box mb={3}>
        <Stack direction="row" alignItems="center" spacing={2} mb={2}>
          <Avatar sx={{ bgcolor: '#6c63ff', width: 56, height: 56, fontSize: 32 }}>A</Avatar>
          <Box>
            <Typography variant="h5" fontWeight={700}>Chào mừng trở lại, Artist!</Typography>
            <Typography color="text.secondary">Quản lý nhạc, upload bài hát mới và xem thống kê cá nhân tại đây.</Typography>
          </Box>
        </Stack>
        <Grid container columns={12} columnSpacing={2} mb={2}>
          {statList.map((stat, idx) => (
            <Grid key={stat.label} gridColumn={{ xs: 'span 12', sm: 'span 4' }}>
              <Card elevation={2} sx={{ display: 'flex', alignItems: 'center', p: 2 }}>
                <Box mr={2}>{stat.icon}</Box>
                <CardContent sx={{ flex: 1, p: 0 }}>
                  <Typography variant="h6" fontWeight={600}>{loading ? '...' : stat.value}</Typography>
                  <Typography color="text.secondary" fontSize={14}>{stat.label}</Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
    </ArtistLayout>
  );
};

export default ArtistDashboard;
