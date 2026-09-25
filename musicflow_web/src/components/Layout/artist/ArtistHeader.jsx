import { useEffect, useMemo, useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  Avatar,
  Box,
  Stack,
  Tooltip,
  Chip,
} from '@mui/material';
import {
  DarkModeRounded as DarkModeIcon,
  LightModeRounded as LightModeIcon,
} from '@mui/icons-material';
import { ColorModeContext } from '../../../context/ColorModeContext';
import useAppToast from '../../common/useAppToast';
import { logout } from '../../../services/api';

const drawerWidth = 260;
const collapsedDrawerWidth = 76;

function ArtistHeader({ title, desktopSidebarOpen = true }) {
  const navigate = useNavigate();
  const { showToast } = useAppToast();
  const colorMode = useContext(ColorModeContext);
  const [anchorEl, setAnchorEl] = useState(null);
  const [artistName, setArtistName] = useState(localStorage.getItem('artistName') || 'Artist');
  const [artistAvatar, setArtistAvatar] = useState(localStorage.getItem('artistAvatar') || '');
  const [isPro, setIsPro] = useState(localStorage.getItem('artistIsPro') === 'true');
  const artistInitial = useMemo(() => artistName.charAt(0).toUpperCase(), [artistName]);

  useEffect(() => {
    const syncArtist = () => {
      setArtistName(localStorage.getItem('artistName') || 'Artist');
      setArtistAvatar(localStorage.getItem('artistAvatar') || '');
      setIsPro(localStorage.getItem('artistIsPro') === 'true');
    };

    window.addEventListener('artist-profile-updated', syncArtist);
    window.addEventListener('storage', syncArtist);

    return () => {
      window.removeEventListener('artist-profile-updated', syncArtist);
      window.removeEventListener('storage', syncArtist);
    };
  }, []);

  const handleMenu = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    await logout();
    showToast({
      severity: 'success',
      title: 'Thành công!',
      message: 'Bạn đã đăng xuất khỏi artist workspace.',
    });
    window.setTimeout(() => {
      window.location.replace('/artist/dashboard?auth=login');
    }, 650);
  };

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        width: {
          xs: '100%',
          md: `calc(100% - ${desktopSidebarOpen ? drawerWidth : collapsedDrawerWidth}px)`,
        },
        ml: {
          xs: 0,
          md: `${desktopSidebarOpen ? drawerWidth : collapsedDrawerWidth}px`,
        },
        color: 'text.primary',
        background: (theme) => theme.palette.mode === 'dark' 
          ? 'rgba(11, 15, 25, 0.85)' 
          : 'rgba(250, 252, 255, 0.86)',
        backdropFilter: 'blur(18px)',
        borderBottom: (theme) => theme.palette.mode === 'dark'
          ? '1px solid rgba(255, 255, 255, 0.08)'
          : '1px solid rgba(20, 33, 61, 0.08)',
        transition: (theme) => theme.transitions.create(['width', 'margin-left'], {
          duration: theme.transitions.duration.shorter,
        }),
      }}
    >
      <Toolbar>
        <Typography variant="h6" noWrap component="div" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mr: 1.5 }}>
          <Tooltip title={colorMode.mode === 'dark' ? 'Bật chế độ sáng' : 'Bật chế độ tối'}>
            <IconButton onClick={colorMode.toggleColorMode} color="inherit" sx={{ p: 1 }}>
              {colorMode.mode === 'dark' ? <LightModeIcon sx={{ color: '#fbbf24' }} /> : <DarkModeIcon />}
            </IconButton>
          </Tooltip>
          <Box sx={{ textAlign: 'right', display: { xs: 'none', md: 'block' } }}>
            <Stack direction="row" spacing={0.8} alignItems="center" justifyContent="flex-end">
              <Typography variant="body2" fontWeight={700}>
                {artistName}
              </Typography>
              {isPro && (
                <Chip
                  label="PRO"
                  size="small"
                  sx={{
                    height: 18,
                    fontSize: '0.65rem',
                    fontWeight: 800,
                    letterSpacing: '0.5px',
                    color: '#fff',
                    background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                    boxShadow: '0 2px 8px rgba(245, 158, 11, 0.4)',
                  }}
                />
              )}
            </Stack>
            <Typography variant="caption" color="text.secondary">
              {isPro ? 'Artist Studio Pro' : 'Artist workspace'}
            </Typography>
          </Box>
          <IconButton onClick={handleMenu} color="inherit" sx={{ p: 0.5 }}>
            <Avatar src={artistAvatar} sx={{ bgcolor: isPro ? '#f59e0b' : '#0ea5e9', color: '#fff' }}>
              {artistAvatar ? null : artistInitial}
            </Avatar>
          </IconButton>
        </Stack>
        <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleClose}>
          <MenuItem onClick={() => { handleClose(); navigate('/artist/profile'); }}>Profile</MenuItem>
          <MenuItem onClick={() => { handleClose(); navigate('/artist/pro'); }}>Artist Studio Pro</MenuItem>
          <MenuItem onClick={handleLogout}>Logout</MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
}

export default ArtistHeader;
