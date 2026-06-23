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
  IconButton,
  Stack,
  Tooltip,
  useTheme,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  BarChart as BarChartIcon,
  Logout as LogoutIcon,
  Person as PersonIcon,
  Headphones as HeadphonesIcon,
  ViewSidebarRounded as SidebarIcon,
  MusicNote as MusicNoteIcon,
} from '@mui/icons-material';
import useAppToast from '../../common/useAppToast';
import { logout } from '../../../services/api';
import { preloadRoute } from '../../../utils/routePreload';

const drawerWidth = 260;
const collapsedDrawerWidth = 76;

const menuGroups = [
  {
    title: 'STUDIO NGHỆ SĨ',
    items: [
      { text: 'Tổng Quan', icon: <DashboardIcon />, path: '/artist/dashboard' },
      { text: 'Bài Hát Của Tôi', icon: <MusicNoteIcon />, path: '/artist/songs' },
      { text: 'Phân Tích', icon: <BarChartIcon />, path: '/artist/analytics' },
      { text: 'Hồ Sơ Nghệ Sĩ', icon: <PersonIcon />, path: '/artist/profile' },
    ],
  },
];

function ArtistSidebar({
  desktopOpen = true,
  onToggleDesktop = () => {},
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useAppToast();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
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

  const handleLogout = async () => {
    await logout();
    showToast({
      severity: 'success',
      title: 'Thành công!',
      message: 'Bạn đã đăng xuất khỏi artist workspace.',
    });
    window.setTimeout(() => {
      window.location.replace('/artistlogin');
    }, 650);
  };

  const renderSidebarContent = (collapsed = false, showDesktopToggle = false) => (
    <Stack sx={{ height: '100%', width: collapsed ? collapsedDrawerWidth : drawerWidth, overflowX: 'hidden' }}>
      {/* Brand Logo Header */}
      <Toolbar
        sx={{
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          pt: 2.5,
          px: collapsed ? 1 : 2.5,
          overflow: 'hidden',
        }}
      >
        <Tooltip title={collapsed && showDesktopToggle ? 'Mở thanh bên' : ''} placement="right" arrow>
          <Box
            onClick={collapsed && showDesktopToggle ? onToggleDesktop : () => navigate('/artist/dashboard')}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: collapsed ? 0 : 1.5,
              cursor: 'pointer',
              userSelect: 'none',
              '&:hover .brand-icon-container': {
                transform: 'scale(1.05)',
                boxShadow: isDark ? '0 0 16px rgba(108, 99, 255, 0.4)' : '0 0 12px rgba(108, 99, 255, 0.25)',
              },
              '&:hover .brand-text': {
                opacity: 0.85,
              },
              '&:hover .brand-logo-icon': {
                opacity: collapsed && showDesktopToggle ? 0 : 1,
              },
              '&:hover .brand-open-icon': {
                opacity: collapsed && showDesktopToggle ? 1 : 0,
              },
              transition: 'all 0.2s ease',
            }}
          >
            <Box
              className="brand-icon-container"
              sx={{
                display: 'flex',
                position: 'relative',
                alignItems: 'center',
                justifyContent: 'center',
                width: 38,
                height: 38,
                borderRadius: '50%',
                bgcolor: isDark ? 'rgba(108, 99, 255, 0.15)' : 'rgba(108, 99, 255, 0.12)',
                border: isDark ? '1px solid rgba(108, 99, 255, 0.3)' : '1px solid rgba(108, 99, 255, 0.25)',
                boxShadow: isDark ? '0 0 12px rgba(108, 99, 255, 0.25)' : '0 0 8px rgba(108, 99, 255, 0.12)',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            >
              <HeadphonesIcon
                className="brand-logo-icon"
                sx={{
                  color: isDark ? '#a78bfa' : '#6c63ff',
                  fontSize: 22,
                  opacity: 1,
                  transition: 'opacity 0.16s ease',
                }}
              />
              {collapsed && showDesktopToggle && (
                <SidebarIcon
                  className="brand-open-icon"
                  sx={{
                    position: 'absolute',
                    color: isDark ? '#a78bfa' : '#6c63ff',
                    fontSize: 22,
                    opacity: 0,
                    transition: 'opacity 0.16s ease',
                  }}
                />
              )}
            </Box>
            <Typography
              variant="h6"
              noWrap
              component="div"
              className="brand-text"
              sx={{
                display: collapsed ? 'none' : 'block',
                fontWeight: 900,
                fontSize: 18,
                letterSpacing: -0.5,
                background: 'linear-gradient(90deg, #6c63ff, #00bcd4)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                transition: 'opacity 0.2s ease',
              }}
            >
              MusicFlow
            </Typography>
          </Box>
        </Tooltip>
        {!collapsed && showDesktopToggle && (
          <Tooltip title="Thu gọn thanh bên" placement="right" arrow>
            <IconButton
              size="small"
              onClick={onToggleDesktop}
              sx={{
                width: 32,
                height: 32,
                flexShrink: 0,
                color: 'text.secondary',
                '&:hover': {
                  color: '#6c63ff',
                  bgcolor: isDark ? 'rgba(108,99,255,0.12)' : 'rgba(108,99,255,0.08)',
                },
              }}
            >
              <SidebarIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Toolbar>

      <Divider sx={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', my: 2, mx: collapsed ? 1 : 2 }} />

      {/* Menu Groups */}
      <Box sx={{ flexGrow: 1, overflowY: 'auto', overflowX: 'hidden', py: 1 }}>
        {menuGroups.map((group) => (
          <Box key={group.title} sx={{ px: collapsed ? 1 : 2, mb: collapsed ? 1.5 : 3 }}>
            <Typography
              variant="caption"
              sx={{
                px: 1.5,
                pb: 0.75,
                pt: 1,
                display: collapsed ? 'none' : 'block',
                fontWeight: 900,
                color: isDark ? 'rgba(255, 255, 255, 0.55)' : 'rgba(0, 0, 0, 0.65)',
                letterSpacing: 1.6,
                fontSize: 11,
              }}
            >
              {group.title}
            </Typography>
            <List dense disablePadding>
              {group.items.map((item) => {
                const active = location.pathname === item.path;
                return (
                  <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
                    <Tooltip title={collapsed ? item.text : ''} placement="right" arrow>
                      <ListItemButton
                        onClick={() => { startTransition(() => navigate(item.path)); }}
                        onPointerEnter={() => preloadRoute(item.path)}
                        onFocus={() => preloadRoute(item.path)}
                        selected={active}
                        sx={{
                          borderRadius: 2.5,
                          minHeight: 44,
                          position: 'relative',
                          px: collapsed ? 0 : undefined,
                          pl: collapsed ? 0 : (active ? 2.5 : 2),
                          justifyContent: collapsed ? 'center' : 'flex-start',
                          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                          willChange: 'transform',
                          borderLeft: active
                            ? '4px solid #6c63ff'
                            : '0px solid transparent',
                          bgcolor: active
                            ? (isDark ? 'rgba(108, 99, 255, 0.12) !important' : 'rgba(108, 99, 255, 0.08) !important')
                            : 'transparent',
                          boxShadow: active
                            ? (isDark ? 'inset 0 0 8px rgba(108, 99, 255, 0.2), 0 2px 6px rgba(0,0,0,0.1)' : 'inset 0 0 6px rgba(108, 99, 255, 0.15)')
                            : 'none',
                          '&:hover': {
                            bgcolor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
                            transform: collapsed ? 'none' : 'translateX(6px)',
                          },
                        }}
                      >
                        <ListItemIcon
                          sx={{
                            minWidth: collapsed ? 0 : 34,
                            justifyContent: 'center',
                            transition: 'color 0.2s ease',
                            color: active
                              ? (isDark ? '#00bcd4' : '#6c63ff')
                              : (isDark ? 'rgba(255, 255, 255, 0.52)' : 'rgba(0, 0, 0, 0.45)'),
                          }}
                        >
                          {item.icon}
                        </ListItemIcon>
                        <ListItemText
                          sx={{ display: collapsed ? 'none' : 'block' }}
                          primary={item.text}
                          primaryTypographyProps={{
                            fontWeight: active ? 800 : 600,
                            fontSize: 14,
                            color: active
                              ? (isDark ? '#fff' : '#6c63ff')
                              : (isDark ? 'rgba(255, 255, 255, 0.68)' : 'rgba(0, 0, 0, 0.65)'),
                            transition: 'all 0.2s ease',
                          }}
                        />
                      </ListItemButton>
                    </Tooltip>
                  </ListItem>
                );
              })}
            </List>
          </Box>
        ))}
      </Box>

      {/* Footer Area with profile info and logout inline */}
      <Stack spacing={1.5} sx={{ p: collapsed ? 1 : 2, mt: 'auto' }}>
        <Tooltip title={collapsed ? artistName : ''} placement="right" arrow>
          <Box
            onClick={collapsed ? () => startTransition(() => navigate('/artist/profile')) : undefined}
            sx={{
              p: collapsed ? 0.75 : 1.25,
              borderRadius: 3.5,
              bgcolor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)',
              border: isDark ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid rgba(0, 0, 0, 0.06)',
              display: 'flex',
              alignItems: 'center',
              gap: collapsed ? 0 : 1.25,
              justifyContent: collapsed ? 'center' : 'flex-start',
              cursor: collapsed ? 'pointer' : 'default',
            }}
          >
            <Avatar src={artistAvatar} sx={{ width: 36, height: 36, bgcolor: '#0ea5e9', fontSize: 15, fontWeight: 700, boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }}>
              {artistInitial}
            </Avatar>
            <Box sx={{ minWidth: 0, flexGrow: 1, display: collapsed ? 'none' : 'block' }}>
              <Typography variant="body2" sx={{ fontWeight: 800, color: isDark ? '#fff' : 'text.primary', fontSize: 13 }} noWrap>
                {artistName}
              </Typography>
              <Typography variant="caption" sx={{ color: isDark ? 'rgba(255, 255, 255, 0.45)' : 'text.secondary', display: 'block', fontSize: 10 }} noWrap>
                Nghệ sĩ
              </Typography>
            </Box>
            {!collapsed && (
              <IconButton
                onClick={handleLogout}
                size="small"
                sx={{
                  color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)',
                  '&:hover': { color: '#ef4444', bgcolor: isDark ? 'rgba(239, 68, 68, 0.12)' : 'rgba(239, 68, 68, 0.06)' },
                  transition: 'all 0.2s ease',
                }}
              >
                <LogoutIcon fontSize="small" />
              </IconButton>
            )}
          </Box>
        </Tooltip>
      </Stack>
    </Stack>
  );

  const drawerPaperStyles = {
    width: desktopOpen ? drawerWidth : collapsedDrawerWidth,
    boxSizing: 'border-box',
    color: isDark ? '#fff' : 'text.primary',
    background: isDark
      ? 'radial-gradient(circle at top, rgba(108, 99, 255, 0.08) 0%, transparent 60%), linear-gradient(180deg, rgba(9, 13, 22, 0.82) 0%, rgba(17, 24, 39, 0.85) 60%, rgba(7, 21, 30, 0.9) 100%)'
      : 'radial-gradient(circle at top, rgba(108, 99, 255, 0.06) 0%, transparent 60%), linear-gradient(180deg, rgba(255, 255, 255, 0.78) 0%, rgba(248, 250, 252, 0.8) 60%, rgba(241, 245, 249, 0.85) 100%)',
    backdropFilter: 'blur(20px) saturate(150%)',
    overflowX: 'hidden',
    borderRight: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)',
    transition: 'width 0.22s ease, background 0.3s ease, border-color 0.3s ease',
  };

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: desktopOpen ? drawerWidth : collapsedDrawerWidth,
        flexShrink: 0,
        transition: 'width 0.22s ease',
        overflowX: 'hidden',
        '& .MuiDrawer-paper': {
          ...drawerPaperStyles,
          width: desktopOpen ? drawerWidth : collapsedDrawerWidth,
          overflowX: 'hidden',
        },
      }}
    >
      {renderSidebarContent(!desktopOpen, true)}
    </Drawer>
  );
}

export default ArtistSidebar;
