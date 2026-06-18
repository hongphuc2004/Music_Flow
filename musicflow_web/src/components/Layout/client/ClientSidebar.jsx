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
  Avatar,
  Chip,
  IconButton,
  Stack,
  Paper,
  Tooltip,
  useTheme,
} from '@mui/material';
import {
  Home as HomeIcon,
  Explore as ExploreIcon,
  LibraryMusic as LibraryMusicIcon,
  CategoryOutlined as CategoryIcon,
  EqualizerRounded as EqualizerIcon,
  Person as PersonIcon,
  Logout as LogoutIcon,
  LoginRounded as LoginIcon,
  Headphones as HeadphonesIcon,
  MicExternalOnOutlined,
  AutoAwesomeRounded as SparklesIcon,
  ViewSidebarRounded as SidebarIcon,
} from '@mui/icons-material';
import useClientToast from './useClientToast';
import useClientSession, { notifyClientSessionChanged } from '../../../hooks/useClientSession';
import { preloadRoute } from '../../../utils/routePreload';

const drawerWidth = 260;
const collapsedDrawerWidth = 76;

const menuGroups = [
  {
    title: 'KHÁM PHÁ',
    items: [
      { text: 'Trang Chủ', icon: <HomeIcon />, path: '/client/home' },
      { text: 'Khám Phá', icon: <ExploreIcon />, path: '/client/discover' },
      { text: 'Thể Loại', icon: <CategoryIcon />, path: '/client/genres' },
      { text: 'Bảng Xếp Hạng', icon: <EqualizerIcon />, path: '/client/rankings' },
      { text: 'AI Mood Music', icon: <SparklesIcon />, path: '/client/ai-mood', isAi: true },
    ],
  },
  {
    title: 'CÁ NHÂN',
    items: [
      { text: 'Thư Viện', icon: <LibraryMusicIcon />, path: '/client/library' },
      { text: 'Tài Khoản', icon: <PersonIcon />, path: '/client/profile' },
    ],
  },
];

function ClientSidebar({
  mobileOpen = false,
  desktopOpen = true,
  onToggleDesktop = () => {},
  onClose = () => {},
  onLogoutSuccess = () => {},
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useClientToast();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { isLoggedIn, userName, userAvatar } = useClientSession();
  const userInitial = (userName || 'U').charAt(0).toUpperCase();

  const handleNavigate = (path) => {
    const privatePaths = ['/client/library', '/client/profile', '/client/ai-mood'];
    if (!isLoggedIn && privatePaths.includes(path)) {
      showToast({
        severity: 'info',
        title: 'Cần đăng nhập',
        message: 'Vui lòng đăng nhập để sử dụng chức năng này.',
      });
      onClose();
      return;
    }

    startTransition(() => navigate(path));
    onClose();
  };

  const handleLogout = () => {
    localStorage.removeItem('role');
    localStorage.removeItem('userName');
    localStorage.removeItem('email');
    localStorage.removeItem('userId');
    localStorage.removeItem('userAvatar');
    notifyClientSessionChanged();
    onClose();
    onLogoutSuccess();
    showToast({
      severity: 'success',
      title: 'Thành công!',
      message: 'Bạn đã đăng xuất khỏi tài khoản.',
    });
    navigate('/client/home');
  };

  const handleLogin = () => {
    onClose();
    navigate('/client/home?auth=login');
  };

  const handleArtistLogin = () => {
    onClose();
    navigate('/artistlogin');
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
          onClick={collapsed && showDesktopToggle ? onToggleDesktop : () => handleNavigate('/client/home')}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: collapsed ? 0 : 1.5,
            cursor: 'pointer',
            userSelect: 'none',
            '&:hover .brand-icon-container': {
              transform: 'scale(1.05)',
              boxShadow: isDark ? '0 0 16px rgba(34, 211, 238, 0.4)' : '0 0 12px rgba(20, 184, 166, 0.25)',
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
              bgcolor: isDark ? 'rgba(34, 211, 238, 0.15)' : 'rgba(20, 184, 166, 0.12)',
              border: isDark ? '1px solid rgba(34, 211, 238, 0.3)' : '1px solid rgba(20, 184, 166, 0.25)',
              boxShadow: isDark ? '0 0 12px rgba(34, 211, 238, 0.25)' : '0 0 8px rgba(20, 184, 166, 0.12)',
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            <HeadphonesIcon
              className="brand-logo-icon"
              sx={{
                color: isDark ? '#22d3ee' : '#14b8a6',
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
                  color: isDark ? '#22d3ee' : '#14b8a6',
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
              fontSize: 20,
              letterSpacing: -0.6,
              background: 'linear-gradient(90deg, #22d3ee, #10b981)',
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
                  color: '#14b8a6',
                  bgcolor: isDark ? 'rgba(20,184,166,0.12)' : 'rgba(20,184,166,0.08)',
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
                const isAi = item.isAi;
                return (
                  <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
                    <Tooltip title={collapsed ? item.text : ''} placement="right" arrow>
                    <ListItemButton
                      onClick={() => handleNavigate(item.path)}
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
                        // AI item has purple active accent; regular items use teal
                        borderLeft: active
                          ? `4px solid ${isAi ? '#8b5cf6' : '#14b8a6'}`
                          : '0px solid transparent',
                        bgcolor: active
                          ? isAi
                            ? (isDark ? 'rgba(139, 92, 246, 0.14) !important' : 'rgba(139, 92, 246, 0.09) !important')
                            : (isDark ? 'rgba(20, 184, 166, 0.12) !important' : 'rgba(20, 184, 166, 0.08) !important')
                          : isAi
                            ? (isDark ? 'rgba(139, 92, 246, 0.05)' : 'rgba(139, 92, 246, 0.04)')
                            : 'transparent',
                        boxShadow: active
                          ? isAi
                            ? (isDark ? 'inset 0 0 8px rgba(139, 92, 246, 0.2)' : 'inset 0 0 6px rgba(139, 92, 246, 0.12)')
                            : (isDark ? 'inset 0 0 8px rgba(20, 184, 166, 0.2), 0 2px 6px rgba(0,0,0,0.1)' : 'inset 0 0 6px rgba(20, 184, 166, 0.15)')
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
                            ? isAi
                              ? '#a78bfa'
                              : (isDark ? '#22d3ee' : '#14b8a6')
                            : isAi
                              ? (isDark ? 'rgba(167, 139, 250, 0.75)' : 'rgba(139, 92, 246, 0.7)')
                              : (isDark ? 'rgba(255, 255, 255, 0.52)' : 'rgba(0, 0, 0, 0.45)'),
                          // Sparkle animation for AI icon
                          ...(isAi && !active && {
                            animation: 'sparkle 3s ease-in-out infinite',
                            '@keyframes sparkle': {
                              '0%, 100%': { opacity: 0.7 },
                              '50%': { opacity: 1, filter: 'drop-shadow(0 0 4px rgba(167,139,250,0.8))' },
                            },
                          }),
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
                            ? isAi
                              ? (isDark ? '#c4b5fd' : '#7c3aed')
                              : (isDark ? '#fff' : '#0f766e')
                            : (isDark ? 'rgba(255, 255, 255, 0.68)' : 'rgba(0, 0, 0, 0.65)'),
                          transition: 'all 0.2s ease',
                        }}
                      />
                      {/* AI Badge */}
                      {isAi && (
                        <Chip
                          label="AI"
                          size="small"
                          sx={{
                            position: collapsed ? 'absolute' : 'static',
                            top: collapsed ? 3 : 'auto',
                            right: collapsed ? 3 : 'auto',
                            height: collapsed ? 14 : 18,
                            fontSize: collapsed ? 7 : 9,
                            fontWeight: 800,
                            letterSpacing: '0.05em',
                            borderRadius: 1,
                            background: 'linear-gradient(135deg, #7c3aed, #6366f1)',
                            color: '#fff',
                            border: 'none',
                            '& .MuiChip-label': { px: collapsed ? 0.45 : 0.75 },
                          }}
                        />
                      )}
                    </ListItemButton>
                    </Tooltip>
                  </ListItem>
                );
              })}
            </List>
          </Box>
        ))}
      </Box>

      {/* Footer Area */}
      <Stack spacing={1.5} sx={{ p: collapsed ? 1 : 2, mt: 'auto' }}>
        {/* Artist Studio Call-to-action */}
        {!isLoggedIn && !collapsed && (
          <Paper
            onClick={handleArtistLogin}
            sx={{
              p: 1.5,
              borderRadius: 3,
              background: 'linear-gradient(135deg, #6366f1, #a855f7)',
              color: '#fff',
              cursor: 'pointer',
              border: '1px solid rgba(255,255,255,0.08)',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: '0 4px 14px rgba(99, 102, 241, 0.25)',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: '0 8px 22px rgba(99, 102, 241, 0.4)',
                borderColor: 'rgba(255,255,255,0.2)',
              }
            }}
          >
            <Stack direction="row" spacing={1.25} alignItems="center">
              <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.15)', width: 34, height: 34 }}>
                <MicExternalOnOutlined sx={{ color: '#fff', fontSize: 18 }} />
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 800, fontSize: 13 }}>Artist Studio</Typography>
                <Typography variant="caption" sx={{ opacity: 0.82, display: 'block', fontSize: 9.5 }} noWrap>
                  Dành cho nghệ sĩ sáng tạo
                </Typography>
              </Box>
            </Stack>
          </Paper>
        )}

        {/* User Account Section */}
        {isLoggedIn ? (
          <Tooltip title={collapsed ? userName : ''} placement="right" arrow>
          <Box
            onClick={collapsed ? () => handleNavigate('/client/profile') : undefined}
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
            <Avatar src={isLoggedIn && userAvatar ? userAvatar : undefined} sx={{ width: 36, height: 36, bgcolor: '#14b8a6', fontSize: 15, fontWeight: 700, boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }}>
              {userInitial}
            </Avatar>
            <Box sx={{ minWidth: 0, flexGrow: 1, display: collapsed ? 'none' : 'block' }}>
              <Typography variant="body2" sx={{ fontWeight: 800, color: isDark ? '#fff' : 'text.primary', fontSize: 13 }} noWrap>
                {userName}
              </Typography>
              <Typography variant="caption" sx={{ color: isDark ? 'rgba(255, 255, 255, 0.45)' : 'text.secondary', display: 'block', fontSize: 10 }} noWrap>
                Người nghe
              </Typography>
            </Box>
            {!collapsed && <IconButton 
              onClick={handleLogout} 
              size="small" 
              sx={{ 
                color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)', 
                '&:hover': { color: '#ef4444', bgcolor: isDark ? 'rgba(239, 68, 68, 0.12)' : 'rgba(239, 68, 68, 0.06)' },
                transition: 'all 0.2s ease',
              }}
            >
              <LogoutIcon fontSize="small" />
            </IconButton>}
          </Box>
          </Tooltip>
        ) : (
          <Tooltip title={collapsed ? 'Đăng nhập' : ''} placement="right" arrow>
          <ListItemButton
            onClick={handleLogin}
            sx={{
              borderRadius: 3,
              minHeight: 44,
              bgcolor: isDark ? 'rgba(20, 184, 166, 0.12)' : 'rgba(20, 184, 166, 0.08)',
              border: isDark ? '1px solid rgba(20, 184, 166, 0.25)' : '1px solid rgba(20, 184, 166, 0.3)',
              color: isDark ? '#22d3ee' : '#0d9488',
              display: 'flex',
              justifyContent: 'center',
              gap: 1,
              transition: 'all 0.3s ease',
              '&:hover': {
                bgcolor: isDark ? 'rgba(20, 184, 166, 0.22)' : 'rgba(20, 184, 166, 0.15)',
                boxShadow: isDark ? '0 4px 12px rgba(20, 184, 166, 0.2)' : '0 4px 12px rgba(20, 184, 166, 0.1)',
                transform: 'translateY(-1.5px)',
              },
            }}
          >
            <LoginIcon sx={{ fontSize: 18 }} />
            {!collapsed && <Typography fontWeight={700} variant="body2" sx={{ fontSize: 13.5 }}>Đăng Nhập</Typography>}
          </ListItemButton>
          </Tooltip>
        )}
      </Stack>
    </Stack>
  );

  const drawerPaperStyles = {
    width: drawerWidth,
    boxSizing: 'border-box',
    color: isDark ? '#fff' : 'text.primary',
    background: isDark
      ? 'radial-gradient(circle at top, rgba(20, 184, 166, 0.08) 0%, transparent 60%), linear-gradient(180deg, rgba(9, 13, 22, 0.82) 0%, rgba(17, 24, 39, 0.85) 60%, rgba(7, 21, 30, 0.9) 100%)'
      : 'radial-gradient(circle at top, rgba(20, 184, 166, 0.06) 0%, transparent 60%), linear-gradient(180deg, rgba(255, 255, 255, 0.78) 0%, rgba(248, 250, 252, 0.8) 60%, rgba(241, 245, 249, 0.85) 100%)',
    backdropFilter: 'blur(20px) saturate(150%)',
    overflowX: 'hidden',
    borderRight: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)',
    transition: 'width 0.22s ease, background 0.3s ease, border-color 0.3s ease',
  };

  return (
    <>
      <Drawer
        variant="permanent"
        open={desktopOpen}
        sx={{
          display: { xs: 'none', md: 'block' },
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
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onClose}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': {
            ...drawerPaperStyles,
            overflowX: 'hidden',
          },
        }}
      >
        {renderSidebarContent(false, false)}
      </Drawer>
    </>
  );
}

export default ClientSidebar;
