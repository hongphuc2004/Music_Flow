import { startTransition } from 'react';
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
  Stack,
  Tooltip,
  useTheme,
  IconButton,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  MusicNote as MusicNoteIcon,
  Category as CategoryIcon,
  PlaylistPlay as PlaylistIcon,
  Settings as SettingsIcon,
  Logout as LogoutIcon,
  Headphones as HeadphonesIcon,
  ViewSidebarRounded as SidebarIcon,
} from '@mui/icons-material';
import useAppToast from '../../common/useAppToast';
import { preloadRoute } from '../../../utils/routePreload';
import { logout } from '../../../services/api';

const drawerWidth = 260;
const collapsedDrawerWidth = 76;

const menuItems = [
  { text: 'Tổng Quan', icon: <DashboardIcon />, path: '/' },
  { text: 'Tài Khoản', icon: <PeopleIcon />, path: '/accounts' },
  { text: 'Bài Hát', icon: <MusicNoteIcon />, path: '/songs' },
  { text: 'Chủ Đề', icon: <CategoryIcon />, path: '/topics' },
  { text: 'Playlists', icon: <PlaylistIcon />, path: '/playlists' },
  { text: 'Cài Đặt', icon: <SettingsIcon />, path: '/settings' },
];

function Sidebar({ desktopOpen = true, onToggleDesktop = () => {} }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useAppToast();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const collapsed = !desktopOpen;

  const handleLogout = async () => {
    await logout();
    showToast({
      severity: 'success',
      title: 'Success!',
      message: 'Admin signed out successfully.',
    });
    window.setTimeout(() => {
      navigate('/adminlogin');
    }, 650);
  };

  const renderSidebarContent = () => (
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
        <Tooltip title={collapsed ? 'Mở thanh bên' : ''} placement="right" arrow>
          <Box
            onClick={collapsed ? onToggleDesktop : () => navigate('/')}
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
                opacity: collapsed ? 0 : 1,
              },
              '&:hover .brand-open-icon': {
                opacity: collapsed ? 1 : 0,
              },
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
              {collapsed && (
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
                fontSize: 16,
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
        {!collapsed && (
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

      {/* Menu List */}
      <Box sx={{ flexGrow: 1, overflowY: 'auto', overflowX: 'hidden', py: 1 }}>
        <Box sx={{ px: collapsed ? 1 : 2, mb: collapsed ? 1.5 : 3 }}>
          <Typography
            variant="caption"
            sx={{
              px: 1.5,
              pb: 0.75,
              pt: 1,
              display: collapsed ? 'none' : 'block',
              fontWeight: 900,
              color: isDark ? 'rgba(255, 255, 255, 0.45)' : 'rgba(0, 0, 0, 0.55)',
              letterSpacing: 1.6,
              fontSize: 10,
              textTransform: 'uppercase',
            }}
          >
            Hệ Thống
          </Typography>
          <List sx={{ p: 0, mt: 0.5 }}>
            {menuItems.map((item) => {
              const isActive = location.pathname === item.path;
              const buttonContent = (
                <ListItemButton
                  onClick={() => startTransition(() => navigate(item.path))}
                  onPointerEnter={() => preloadRoute(item.path)}
                  onFocus={() => preloadRoute(item.path)}
                  selected={isActive}
                  sx={{
                    minHeight: 46,
                    borderRadius: 2.5,
                    px: collapsed ? 1.5 : 2,
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    mb: 0.5,
                    color: isActive ? '#6c63ff' : 'text.secondary',
                    bgcolor: isActive
                      ? isDark ? 'rgba(108, 99, 255, 0.15)' : 'rgba(108, 99, 255, 0.08)'
                      : 'transparent',
                    '&.Mui-selected': {
                      color: isDark ? '#c084fc' : '#6c63ff',
                      bgcolor: isDark ? 'rgba(108, 99, 255, 0.15)' : 'rgba(108, 99, 255, 0.08)',
                      '&:hover': {
                        bgcolor: isDark ? 'rgba(108, 99, 255, 0.2)' : 'rgba(108, 99, 255, 0.12)',
                      },
                      '& .MuiListItemIcon-root': {
                        color: isDark ? '#c084fc' : '#6c63ff',
                      },
                    },
                    '&:hover': {
                      color: isDark ? '#c084fc' : '#6c63ff',
                      bgcolor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                      '& .MuiListItemIcon-root': {
                        color: isDark ? '#c084fc' : '#6c63ff',
                      },
                    },
                    transition: 'all 0.2s ease',
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: collapsed ? 0 : 36,
                      mr: collapsed ? 0 : 0,
                      justifyContent: 'center',
                      color: isActive
                        ? isDark ? '#c084fc' : '#6c63ff'
                        : 'text.secondary',
                      transition: 'color 0.2s ease',
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>
                  {!collapsed && (
                    <ListItemText
                      primary={item.text}
                      primaryTypographyProps={{
                        fontWeight: isActive ? 700 : 500,
                        fontSize: 13.5,
                      }}
                    />
                  )}
                </ListItemButton>
              );

              return (
                <ListItem key={item.text} disablePadding sx={{ display: 'block' }}>
                  {collapsed ? (
                    <Tooltip title={item.text} placement="right" arrow>
                      {buttonContent}
                    </Tooltip>
                  ) : (
                    buttonContent
                  )}
                </ListItem>
              );
            })}
          </List>
        </Box>
      </Box>

      <Divider sx={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', my: 1, mx: collapsed ? 1 : 2 }} />

      {/* Footer Area with logout button */}
      <Box sx={{ p: collapsed ? 1 : 2, pb: 2.5 }}>
        {collapsed ? (
          <Tooltip title="Đăng xuất" placement="right" arrow>
            <ListItemButton
              onClick={handleLogout}
              sx={{
                minHeight: 46,
                borderRadius: 2.5,
                justifyContent: 'center',
                color: '#ff4d4d',
                bgcolor: isDark ? 'rgba(255, 77, 77, 0.05)' : 'rgba(255, 77, 77, 0.04)',
                '&:hover': {
                  bgcolor: 'rgba(255, 77, 77, 0.12)',
                },
              }}
            >
              <LogoutIcon size="small" />
            </ListItemButton>
          </Tooltip>
        ) : (
          <ListItemButton
            onClick={handleLogout}
            sx={{
              minHeight: 46,
              borderRadius: 2.5,
              px: 2,
              color: '#ff4d4d',
              bgcolor: isDark ? 'rgba(255, 77, 77, 0.05)' : 'rgba(255, 77, 77, 0.04)',
              '&:hover': {
                bgcolor: 'rgba(255, 77, 77, 0.12)',
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: 36, color: 'inherit' }}>
              <LogoutIcon size="small" />
            </ListItemIcon>
            <ListItemText
              primary="Đăng xuất"
              primaryTypographyProps={{
                fontWeight: 700,
                fontSize: 13.5,
              }}
            />
          </ListItemButton>
        )}
      </Box>
    </Stack>
  );

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: collapsed ? collapsedDrawerWidth : drawerWidth,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: collapsed ? collapsedDrawerWidth : drawerWidth,
          boxSizing: 'border-box',
          bgcolor: isDark ? '#0b0f19' : '#fff',
          color: 'text.primary',
          borderRight: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)',
          transition: (theme) => theme.transitions.create('width', {
            duration: theme.transitions.duration.shorter,
          }),
          overflowX: 'hidden',
        },
      }}
    >
      {renderSidebarContent()}
    </Drawer>
  );
}

export default Sidebar;
