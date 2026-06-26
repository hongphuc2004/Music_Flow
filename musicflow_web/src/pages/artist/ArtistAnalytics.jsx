import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Card,
  CardContent,
  CircularProgress,
  Grid,
  Stack,
  Typography,
  Paper,
  Divider,
} from '@mui/material';
import {
  FavoriteRounded as FavoriteIcon,
  HeadphonesRounded as HeadphonesIcon,
  QueryStatsRounded as StatsIcon,
  TimerRounded as TimerIcon,
  PeopleRounded as FollowersIcon,
  LibraryMusicRounded as TracksIcon,
} from '@mui/icons-material';
import ArtistLayout from '../../components/Layout/artist/ArtistLayout';
import { artistApi } from '../../services/api';
import { calculateArtistAnalytics, formatDurationLabel } from '../../utils/artistProfile';

// Custom SVG Area Chart Component (Release Momentum)
const AreaChart = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <Box sx={{ height: 200, display: 'grid', placeItems: 'center', color: 'text.disabled' }}>
        <Typography variant="body2" fontWeight={600}>Chưa đủ dữ liệu biểu đồ</Typography>
      </Box>
    );
  }
  const paddingX = 50;
  const paddingY = 30;
  const chartWidth = 550;
  const chartHeight = 220;
  
  const values = data.map(d => d.value);
  const maxVal = Math.max(...values, 1);
  
  const points = data.map((d, i) => {
    const x = paddingX + (i * (chartWidth - paddingX * 2)) / Math.max(1, data.length - 1);
    const y = chartHeight - paddingY - (d.value * (chartHeight - paddingY * 2)) / maxVal;
    return { x, y, label: d.label, value: d.value };
  });

  const pathD = points.reduce((acc, p, i) => {
    return i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
  }, '');

  const areaD = points.length > 0 
    ? `${pathD} L ${points[points.length - 1].x} ${chartHeight - paddingY} L ${points[0].x} ${chartHeight - paddingY} Z`
    : '';

  return (
    <Box sx={{ width: '100%', overflowX: 'auto', py: 1 }}>
      <svg width="100%" height="220" viewBox={`0 0 ${chartWidth} ${chartHeight}`} style={{ overflow: 'visible', minWidth: 450 }}>
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6c63ff" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#6c63ff" stopOpacity="0.0" />
          </linearGradient>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#6c63ff" />
            <stop offset="100%" stopColor="#00bcd4" />
          </linearGradient>
        </defs>
        
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => {
          const y = paddingY + ratio * (chartHeight - paddingY * 2);
          const gridVal = Math.round(maxVal * (1 - ratio) * 10) / 10;
          return (
            <g key={index}>
              <line 
                x1={paddingX} 
                y1={y} 
                x2={chartWidth - paddingX} 
                y2={y} 
                stroke="rgba(108, 99, 255, 0.08)" 
                strokeDasharray="4 4" 
              />
              <text 
                x={paddingX - 10} 
                y={y + 4} 
                textAnchor="end" 
                fill="currentColor" 
                style={{ fontSize: 9, opacity: 0.5, fontWeight: 700 }}
              >
                {gridVal}
              </text>
            </g>
          );
        })}

        {/* Area Path */}
        {areaD && <path d={areaD} fill="url(#areaGrad)" />}
        
        {/* Line Path */}
        {pathD && (
          <path 
            d={pathD} 
            fill="none" 
            stroke="url(#lineGrad)" 
            strokeWidth="3.5" 
            strokeLinecap="round"
            strokeLinejoin="round" 
          />
        )}

        {/* Dots */}
        {points.map((p, i) => (
          <g key={i}>
            <circle 
              cx={p.x} 
              cy={p.y} 
              r="4.5" 
              fill="#00bcd4" 
              stroke="#fff" 
              strokeWidth="2" 
            />
            {/* X Axis label */}
            <text 
              x={p.x} 
              y={chartHeight - 10} 
              textAnchor="middle" 
              fill="currentColor" 
              style={{ fontSize: 9, opacity: 0.6, fontWeight: 700 }}
            >
              {p.label}
            </text>
            {/* Value display */}
            <text 
              x={p.x} 
              y={p.y - 10} 
              textAnchor="middle" 
              fill="#6c63ff" 
              style={{ fontSize: 9, fontWeight: 800 }}
            >
              {p.value}
            </text>
          </g>
        ))}
      </svg>
    </Box>
  );
};

// Custom SVG Bar Chart Component (Top Songs by Likes)
const BarChart = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <Box sx={{ height: 200, display: 'grid', placeItems: 'center', color: 'text.disabled' }}>
        <Typography variant="body2" fontWeight={600}>Chưa đủ dữ liệu biểu đồ</Typography>
      </Box>
    );
  }
  const paddingX = 50;
  const paddingY = 30;
  const chartWidth = 550;
  const chartHeight = 220;
  
  const values = data.map(d => d.value);
  const maxVal = Math.max(...values, 1);
  const N = data.length;
  
  const barWidth = Math.min(32, (chartWidth - paddingX * 2) / (N * 1.6));
  const spacing = (chartWidth - paddingX * 2 - barWidth * N) / Math.max(1, N - 1);

  return (
    <Box sx={{ width: '100%', overflowX: 'auto', py: 1 }}>
      <svg width="100%" height="220" viewBox={`0 0 ${chartWidth} ${chartHeight}`} style={{ overflow: 'visible', minWidth: 450 }}>
        <defs>
          <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00bcd4" />
            <stop offset="100%" stopColor="#6c63ff" />
          </linearGradient>
        </defs>
        
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => {
          const y = paddingY + ratio * (chartHeight - paddingY * 2);
          const gridVal = Math.round(maxVal * (1 - ratio));
          return (
            <g key={index}>
              <line 
                x1={paddingX} 
                y1={y} 
                x2={chartWidth - paddingX} 
                y2={y} 
                stroke="rgba(108, 99, 255, 0.08)" 
                strokeDasharray="4 4" 
              />
              <text 
                x={paddingX - 10} 
                y={y + 4} 
                textAnchor="end" 
                fill="currentColor" 
                style={{ fontSize: 9, opacity: 0.5, fontWeight: 700 }}
              >
                {gridVal}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {data.map((d, i) => {
          const x = paddingX + i * (barWidth + spacing);
          const barHeight = (d.value * (chartHeight - paddingY * 2)) / maxVal;
          const y = chartHeight - paddingY - barHeight;
          
          return (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(barHeight, 2)}
                rx={3}
                fill="url(#barGrad)"
              />
              {/* Label below bar */}
              <text 
                x={x + barWidth / 2} 
                y={chartHeight - 10} 
                textAnchor="middle" 
                fill="currentColor" 
                style={{ fontSize: 9, opacity: 0.6, fontWeight: 700 }}
              >
                {d.label.length > 10 ? `${d.label.substring(0, 8)}...` : d.label}
              </text>
              {/* Value above bar */}
              <text 
                x={x + barWidth / 2} 
                y={y - 8} 
                textAnchor="middle" 
                fill="#00bcd4" 
                style={{ fontSize: 9, fontWeight: 800 }}
              >
                {d.value}
              </text>
            </g>
          );
        })}
      </svg>
    </Box>
  );
};

function ArtistAnalytics() {
  const [artist, setArtist] = useState(null);
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      const meResponse = await artistApi.getMe();
      const currentArtist = meResponse.data.artist;
      
      const songsResponse = await artistApi.getSongsByArtist({ artistId: currentArtist._id, page: 1, limit: 100 });
      const profileResponse = await artistApi.getProfile({ id: currentArtist._id });

      setArtist({
        ...currentArtist,
        followers: profileResponse.data.artist?.followers || 0,
        monthlyListeners: profileResponse.data.artist?.monthlyListeners || 0,
        totalSongs: profileResponse.data.artist?.totalSongs || 0,
      });
      setSongs(songsResponse.data.songs || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load analytics.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const analytics = useMemo(() => calculateArtistAnalytics(artist, songs), [artist, songs]);
  
  // Transform Top Songs for the Bar Chart
  const topSongsChartData = useMemo(() => {
    return analytics.topSongs.map(song => ({
      label: song.title,
      value: Number(song.likeCount) || 0
    }));
  }, [analytics.topSongs]);

  const highlights = [
    { label: 'Followers', value: analytics.followers.toLocaleString('vi-VN'), icon: <FollowersIcon />, accent: '#38bdf8' },
    { label: 'Monthly Listeners', value: analytics.monthlyListeners.toLocaleString('vi-VN'), icon: <StatsIcon />, accent: '#06b6d4' },
    { label: 'Total Track Plays', value: analytics.totalPlays.toLocaleString('vi-VN'), icon: <HeadphonesIcon />, accent: '#10b981' },
    { label: 'Average Plays / Song', value: analytics.averagePlays.toLocaleString('vi-VN'), icon: <HeadphonesIcon />, accent: '#6c63ff' },
    { label: 'Total Track Likes', value: analytics.totalLikes.toLocaleString('vi-VN'), icon: <FavoriteIcon />, accent: '#ef4444' },
    { label: 'Average Likes / Song', value: analytics.averageLikes.toLocaleString('vi-VN'), icon: <FavoriteIcon />, accent: '#f43f5e' },
    { label: 'Catalog Size', value: analytics.totalSongs, icon: <TracksIcon />, accent: '#f59e0b' },
    { label: 'Catalog Runtime', value: formatDurationLabel(analytics.totalDuration), icon: <TimerIcon />, accent: '#8b5cf6' },
  ];

  return (
    <ArtistLayout title="Studio Analytics">
      {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>{error}</Alert>}

      {loading ? (
        <Box sx={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CircularProgress size={44} sx={{ color: '#6c63ff' }} />
        </Box>
      ) : (
        <Stack spacing={4}>
          {/* Header Section */}
          <Card 
            elevation={0}
            sx={{
              p: { xs: 3.5, md: 4.5 },
              borderRadius: 6,
              border: '1px solid',
              borderColor: 'divider',
              background: (theme) => theme.palette.mode === 'dark'
                ? 'radial-gradient(circle at top right, rgba(108, 99, 255, 0.12), transparent 40%), #111827'
                : 'radial-gradient(circle at top right, rgba(108, 99, 255, 0.08), transparent 30%), #ffffff',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            <Stack spacing={1}>
              <Typography variant="h4" fontWeight={900} sx={{ letterSpacing: '-1px' }}>
                Analytics Dashboard
              </Typography>
              <Typography variant="body1" color="text.secondary" fontWeight={500} sx={{ maxWidth: 600 }}>
                Theo dõi hiệu suất phân phối kho nhạc của bạn. Tổng hợp chỉ số tiếp cận, lượt phát, lượt yêu thích từ cộng đồng khán thính giả.
              </Typography>
            </Stack>
          </Card>

          {/* Highlights Statistics Grid */}
          <Grid container spacing={3}>
            {highlights.map((item) => (
              <Grid key={item.label} size={{ xs: 12, sm: 6, md: 4, xl: 3 }}>
                <Card 
                  elevation={0} 
                  sx={{ 
                    borderRadius: 5, 
                    border: '1px solid', 
                    borderColor: 'divider', 
                    bgcolor: 'background.paper',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.01)',
                    '&:hover': {
                      borderColor: item.accent,
                      boxShadow: `0 8px 24px ${item.accent}12`,
                      transform: 'translateY(-2px)'
                    },
                    transition: 'all 0.2s ease'
                  }}
                >
                  <CardContent sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 2.5 }}>
                    <Box sx={{ 
                      width: 54, 
                      height: 54, 
                      display: 'grid', 
                      placeItems: 'center', 
                      borderRadius: 3.5, 
                      color: item.accent, 
                      backgroundColor: `${item.accent}12` 
                    }}>
                      {item.icon}
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        {item.label}
                      </Typography>
                      <Typography variant="h5" fontWeight={900} sx={{ mt: 0.5 }}>
                        {item.value}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {/* Charts Grid */}
          <Grid container spacing={3}>
            {/* Left: Custom SVG Area Chart */}
            <Grid size={{ xs: 12, lg: 6 }}>
              <Card 
                elevation={0} 
                sx={{ 
                  borderRadius: 6, 
                  border: '1px solid', 
                  borderColor: 'divider', 
                  bgcolor: 'background.paper',
                  height: '100%',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.01)',
                }}
              >
                <CardContent sx={{ p: 4 }}>
                  <Typography variant="h6" fontWeight={900}>Release Momentum</Typography>
                  <Typography color="text.secondary" variant="body2" sx={{ mb: 4, fontWeight: 500 }}>
                    Tần suất xuất bản bài hát mới theo từng tháng phát sinh gần đây.
                  </Typography>
                  <AreaChart data={analytics.releasesByMonth} />
                </CardContent>
              </Card>
            </Grid>

            {/* Right: Custom SVG Bar Chart */}
            <Grid size={{ xs: 12, lg: 6 }}>
              <Card 
                elevation={0} 
                sx={{ 
                  borderRadius: 6, 
                  border: '1px solid', 
                  borderColor: 'divider', 
                  bgcolor: 'background.paper',
                  height: '100%',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.01)',
                }}
              >
                <CardContent sx={{ p: 4 }}>
                  <Typography variant="h6" fontWeight={900}>Top Releases by Likes</Typography>
                  <Typography color="text.secondary" variant="body2" sx={{ mb: 4, fontWeight: 500 }}>
                    Xếp hạng các bản nhạc sở hữu lượt yêu thích (Likes) cao nhất của bạn.
                  </Typography>
                  <BarChart data={topSongsChartData} />
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Top Songs Detailed Table list */}
          <Card 
            elevation={0}
            sx={{
              borderRadius: 6,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.paper',
              boxShadow: '0 4px 20px rgba(0,0,0,0.01)',
              overflow: 'hidden'
            }}
          >
            <Box sx={{ p: 3, borderBottom: '1px solid', borderColor: 'divider', bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.01)' }}>
              <Typography variant="h6" fontWeight={900}>Top Track Performances</Typography>
            </Box>
            
            <Box sx={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--mui-palette-divider)' }}>
                    <th style={{ padding: '16px 24px', fontWeight: 800, fontSize: '0.85rem', color: 'gray' }}>Rank</th>
                    <th style={{ padding: '16px 24px', fontWeight: 800, fontSize: '0.85rem', color: 'gray' }}>Bài hát</th>
                    <th style={{ padding: '16px 24px', fontWeight: 800, fontSize: '0.85rem', color: 'gray' }}>Lượt nghe</th>
                    <th style={{ padding: '16px 24px', fontWeight: 800, fontSize: '0.85rem', color: 'gray' }}>Yêu thích (Likes)</th>
                    <th style={{ padding: '16px 24px', fontWeight: 800, fontSize: '0.85rem', color: 'gray', textAlign: 'right' }}>Độ phổ biến</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.topSongs.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: '40px', textAnchor: 'middle', textAlign: 'center', color: 'gray' }}>
                        Chưa có dữ liệu bài hát nào.
                      </td>
                    </tr>
                  ) : (
                    analytics.topSongs.map((song, index) => {
                      const maxLikes = Math.max(...analytics.topSongs.map(s => Number(s.likeCount) || 0), 1);
                      const percent = Math.round(((Number(song.likeCount) || 0) / maxLikes) * 100);
                      
                      return (
                        <tr key={song._id} style={{ borderBottom: '1px solid var(--mui-palette-divider)' }}>
                          <td style={{ padding: '16px 24px', fontWeight: 800, color: '#6c63ff', width: 60 }}>
                            #{index + 1}
                          </td>
                          <td style={{ padding: '16px 24px' }}>
                            <Stack direction="row" alignItems="center" spacing={2}>
                              <img 
                                src={song.imageUrl} 
                                alt={song.title} 
                                style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover' }} 
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                }}
                              />
                              <Box>
                                <Typography variant="subtitle2" fontWeight={800}>{song.title}</Typography>
                                <Typography variant="caption" color="text.secondary">{song.artists?.map(a => a.name).join(', ')}</Typography>
                              </Box>
                            </Stack>
                          </td>
                          <td style={{ padding: '16px 24px', fontWeight: 600 }}>
                            {(Number(song.playCount) || 0).toLocaleString('vi-VN')}
                          </td>
                          <td style={{ padding: '16px 24px', fontWeight: 600 }}>
                            {(Number(song.likeCount) || 0).toLocaleString('vi-VN')}
                          </td>
                          <td style={{ padding: '16px 24px', width: 220 }}>
                            <Stack direction="row" alignItems="center" spacing={1.5} justifyContent="flex-end">
                              <Box sx={{ width: '100%', bgcolor: 'action.hover', height: 8, borderRadius: 4, overflow: 'hidden', minWidth: 100 }}>
                                <Box sx={{ width: `${percent}%`, height: '100%', borderRadius: 4, background: 'linear-gradient(90deg, #6c63ff, #00bcd4)' }} />
                              </Box>
                              <Typography variant="caption" fontWeight={800} color="text.secondary">{percent}%</Typography>
                            </Stack>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </Box>
          </Card>
        </Stack>
      )}
    </ArtistLayout>
  );
}

export default ArtistAnalytics;
