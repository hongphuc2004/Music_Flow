import { startTransition, useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Box,
  Divider,
  Avatar,
  Chip,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  BarChart as BarChartIcon,
  MusicNote as MusicNoteIcon,
  Logout as LogoutIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { clearArtistSession } from '../../../utils/artistSession';
import useAppToast from '../../common/useAppToast';
import { preloadRoute } from '../../../utils/routePreload';

const drawerWidth = 260;

const menuItems = [
  { text: 'Dashboard', icon: <DashboardIcon />, path: '/artist/dashboard' },
  { text: 'My Songs', icon: <MusicNoteIcon />, path: '/artist/songs' },
  { text: 'Analytics', icon: <BarChartIcon />, path: '/artist/analytics' },
  { text: 'Profile', icon: <PersonIcon />, path: '/artist/profile' },
];

function ArtistSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useAppToast();
  const [artistName, setArtistName] = useState(localStorage.getItem('artistName') || 'Artist');
  const [artistAvatar, setArtistAvatar] = useState(localStorage.getItem('artistAvatar') || '');
  const artistInitial = useMemo(() => artistName.charAt(0).toUpperCase(), [artistName]);

  useEffect(() => {
    const syncArtist = () => {
      setArtistName(localStorage.getItem('artistName') || 'Artist');
      setArtistAvatar(localStorage.getItem('artistAvatar') || '');
    };

    window.addEventListener('artist-profile-updated', syncArtist);
    window.addEventListener('storage', syncArtist);

    return () => {
      window.removeEventListener('artist-profile-updated', syncArtist);
      window.removeEventListener('storage', syncArtist);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('role');
    clearArtistSession();
    showToast({
      severity: 'success',
      title: 'Thành công!',
      message: 'Bạn đã đăng xuất khỏi artist workspace.',
    });
    window.setTimeout(() => {
      navigate('/artistlogin');
    }, 650);
  };

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          boxSizing: 'border-box',
          color: '#fff',
          background:
            'radial-gradient(circle at top, rgba(14,165,233,0.24), transparent 30%), linear-gradient(180deg, #0f172a 0%, #111827 55%, #1e1b4b 100%)',
          borderRight: '1px solid rgba(255,255,255,0.08)',
        },
      }}
    >
      <Toolbar sx={{ alignItems: 'flex-start', pt: 2.5 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 2.5 }}>
            <MusicNoteIcon sx={{ color: '#38bdf8', fontSize: 30 }} />
            <Typography variant="h6" noWrap component="div" sx={{ fontWeight: 800, letterSpacing: -0.3 }}>
              MusicFlow Artist
            </Typography>
          </Box>
          <Box
            sx={{
              p: 1.5,
              borderRadius: 3,
              backgroundColor: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Avatar src={artistAvatar} sx={{ width: 46, height: 46, bgcolor: '#0ea5e9' }}>
                {artistAvatar ? null : artistInitial}
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography fontWeight={700} noWrap>
                  {artistName}
                </Typography>
                <Chip
                  label="Artist"
                  size="small"
                  sx={{
                    mt: 0.75,
                    height: 22,
                    color: '#bae6fd',
                    backgroundColor: 'rgba(14,165,233,0.18)',
                  }}
                />
              </Box>
            </Box>
          </Box>
        </Box>
      </Toolbar>
      <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />
      <List sx={{ px: 1.5, py: 2 }}>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding sx={{ mb: 1 }}>
            <ListItemButton
              onClick={() => startTransition(() => navigate(item.path))}
              onPointerEnter={() => preloadRoute(item.path)}
              onFocus={() => preloadRoute(item.path)}
              selected={location.pathname === item.path}
              sx={{
                borderRadius: 3,
                minHeight: 48,
                '&.Mui-selected': {
                  background: 'linear-gradient(90deg, rgba(14,165,233,0.24), rgba(99,102,241,0.26))',
                  border: '1px solid rgba(125,211,252,0.24)',
                  '&:hover': {
                    background: 'linear-gradient(90deg, rgba(14,165,233,0.3), rgba(99,102,241,0.3))',
                  },
                },
              }}
            >
              <ListItemIcon sx={{ color: '#fff', minWidth: 40 }}>{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} primaryTypographyProps={{ fontWeight: 600 }} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      <Box sx={{ flexGrow: 1 }} />
      <List sx={{ px: 1.5, pb: 2 }}>
        <ListItem disablePadding>
          <ListItemButton onClick={handleLogout} sx={{ borderRadius: 3 }}>
            <ListItemIcon sx={{ color: '#fff', minWidth: 40 }}><LogoutIcon /></ListItemIcon>
            <ListItemText primary="Logout" primaryTypographyProps={{ fontWeight: 600 }} />
          </ListItemButton>
        </ListItem>
      </List>
    </Drawer>
  );
}

export default ArtistSidebar;
