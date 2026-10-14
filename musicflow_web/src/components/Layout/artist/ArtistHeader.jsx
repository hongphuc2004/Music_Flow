import { useEffect, useMemo, useState, useContext, useCallback } from 'react';
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
  Popover,
  List,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  Button,
} from '@mui/material';
import {
  DarkModeRounded as DarkModeIcon,
  LightModeRounded as LightModeIcon,
  NotificationsRounded as NotificationsIcon,
  EmojiEventsRounded as MilestoneIcon,
  PersonAddRounded as FollowerIcon,
  ChatBubbleRounded as CommentIcon,
  LibraryMusicRounded as SongIcon,
  WorkspacePremiumRounded as ProIcon,
  CampaignRounded as SystemIcon,
  InfoRounded as InfoIcon,
  CheckCircleRounded as CheckCircleIcon,
  WarningRounded as WarningIcon,
} from '@mui/icons-material';
import { ColorModeContext } from '../../../context/ColorModeContext';
import useAppToast from '../../common/js/useAppToast';
import { logout } from '../../../services/api';
import { artistNotificationsApi } from '../../../services/artist/artist.service';
import NotificationBellButton from '../../common/ui/NotificationBellButton';

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

  // 🔔 Notifications State
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notiAnchorEl, setNotiAnchorEl] = useState(null);

  const fetchNotifications = useCallback(async () => {
    if (localStorage.getItem('role') !== 'artist') return;
    try {
      const res = await artistNotificationsApi.getAll();
      if (res.data?.success) {
        setNotifications(res.data.data || []);
        setUnreadCount(res.data.unreadCount || 0);
      }
    } catch (err) {
      console.warn('Failed to fetch artist notifications:', err);
    }
  }, []);

  useEffect(() => {
    if (localStorage.getItem('role') !== 'artist') return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000); // 60s auto refresh
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const handleNotiOpen = (event) => {
    setNotiAnchorEl(event.currentTarget);
  };

  const handleNotiClose = () => {
    setNotiAnchorEl(null);
  };

  const handleMarkAsRead = async (id) => {
    try {
      await artistNotificationsApi.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.warn('Failed to mark notification as read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await artistNotificationsApi.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.warn('Failed to mark all notifications as read:', err);
    }
  };

  const formatTimeAgo = (dateString) => {
    try {
      const date = new Date(dateString);
      const seconds = Math.floor((new Date() - date) / 1000);
      if (seconds < 60) return 'vừa xong';
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return `${minutes} phút trước`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours} giờ trước`;
      const days = Math.floor(hours / 24);
      if (days < 30) return `${days} ngày trước`;
      return date.toLocaleDateString('vi-VN');
    } catch {
      return '';
    }
  };

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
          {/* Chế độ Sáng / Tối */}
          <Tooltip title={colorMode.mode === 'dark' ? 'Bật chế độ sáng' : 'Bật chế độ tối'}>
            <IconButton onClick={colorMode.toggleColorMode} color="inherit" sx={{ p: 1 }}>
              {colorMode.mode === 'dark' ? <LightModeIcon sx={{ color: '#fbbf24' }} /> : <DarkModeIcon />}
            </IconButton>
          </Tooltip>

          {/* 🔔 Nút Thông báo Studio cho Artist */}
          <NotificationBellButton
            onClick={handleNotiOpen}
            hasUnread={unreadCount > 0}
            unreadCount={unreadCount}
            title="Thông báo Studio"
          />

          {/* Popover danh sách thông báo */}
          <Popover
            anchorEl={notiAnchorEl}
            open={Boolean(notiAnchorEl)}
            onClose={handleNotiClose}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            PaperProps={{
              sx: {
                width: 380,
                maxHeight: 500,
                borderRadius: 3,
                mt: 1.5,
                boxShadow: '0 12px 36px rgba(0, 0, 0, 0.28)',
                border: '1px solid',
                borderColor: 'divider',
                backgroundColor: (theme) =>
                  theme.palette.mode === 'dark' ? 'rgba(15, 23, 42, 0.96)' : 'rgba(255, 255, 255, 0.98)',
                backdropFilter: 'blur(20px)',
              },
            }}
          >
            <Box
              sx={{
                p: 2,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                  Thông báo Studio
                </Typography>
                {unreadCount > 0 && (
                  <Chip
                    label={`${unreadCount} mới`}
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      bgcolor: 'rgba(239, 68, 68, 0.15)',
                      color: '#ef4444',
                    }}
                  />
                )}
              </Stack>
              {unreadCount > 0 && (
                <Button
                  size="small"
                  variant="text"
                  onClick={handleMarkAllAsRead}
                  sx={{ fontSize: 12, fontWeight: 700, p: 0, minWidth: 0, textTransform: 'none' }}
                >
                  Đọc tất cả
                </Button>
              )}
            </Box>

            <Box sx={{ overflowY: 'auto', maxHeight: 400 }}>
              {notifications.length > 0 ? (
                <List disablePadding>
                  {notifications.map((noti) => {
                    let IconComponent = InfoIcon;
                    let iconBgColor = 'rgba(14, 165, 233, 0.15)';
                    let iconColor = '#0ea5e9';

                    if (noti.type === 'artist_milestone') {
                      IconComponent = MilestoneIcon;
                      iconBgColor = 'rgba(245, 158, 11, 0.15)';
                      iconColor = '#f59e0b';
                    } else if (noti.type === 'artist_follow') {
                      IconComponent = FollowerIcon;
                      iconBgColor = 'rgba(139, 92, 246, 0.15)';
                      iconColor = '#8b5cf6';
                    } else if (noti.type === 'interaction') {
                      IconComponent = CommentIcon;
                      iconBgColor = 'rgba(16, 185, 129, 0.15)';
                      iconColor = '#10b981';
                    } else if (noti.type === 'song_moderation_result') {
                      const status = noti.metadata?.status;
                      IconComponent = status === 'BLOCK' ? WarningIcon : SongIcon;
                      iconBgColor = status === 'BLOCK' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(6, 182, 212, 0.15)';
                      iconColor = status === 'BLOCK' ? '#ef4444' : '#06b6d4';
                    } else if (noti.type === 'subscription' || noti.type === 'artist_pro') {
                      IconComponent = ProIcon;
                      iconBgColor = 'rgba(249, 115, 22, 0.15)';
                      iconColor = '#f97316';
                    } else if (noti.type === 'system') {
                      IconComponent = SystemIcon;
                      iconBgColor = 'rgba(244, 63, 94, 0.15)';
                      iconColor = '#f43f5e';
                    }

                    return (
                      <ListItemButton
                        key={noti._id}
                        onClick={() => {
                          if (!noti.isRead) {
                            handleMarkAsRead(noti._id);
                          }
                          handleNotiClose();

                          const metadata = noti.metadata || {};
                          const actionUrl = metadata.actionUrl || '';

                          if (actionUrl) {
                            navigate(actionUrl);
                          } else if (noti.type === 'artist_milestone' || noti.type === 'song_moderation_result') {
                            navigate('/artist/songs');
                          } else if (noti.type === 'artist_follow') {
                            navigate('/artist/analytics');
                          } else if (noti.type === 'subscription' || noti.type === 'artist_pro') {
                            navigate('/artist/pro');
                          } else {
                            navigate('/artist/dashboard');
                          }
                        }}
                        sx={{
                          py: 1.5,
                          px: 2,
                          alignItems: 'flex-start',
                          borderBottom: '1px solid',
                          borderColor: 'rgba(255,255,255,0.04)',
                          backgroundColor: noti.isRead
                            ? 'transparent'
                            : (theme) =>
                                theme.palette.mode === 'dark'
                                  ? 'rgba(14, 165, 233, 0.08)'
                                  : 'rgba(14, 165, 233, 0.05)',
                          '&:hover': {
                            backgroundColor: (theme) =>
                              theme.palette.mode === 'dark'
                                ? 'rgba(255, 255, 255, 0.04)'
                                : 'rgba(0, 0, 0, 0.03)',
                          },
                        }}
                      >
                        <ListItemAvatar sx={{ minWidth: 46, mt: 0.5 }}>
                          <Avatar sx={{ width: 36, height: 36, bgcolor: iconBgColor, color: iconColor }}>
                            <IconComponent sx={{ fontSize: 20 }} />
                          </Avatar>
                        </ListItemAvatar>

                        <ListItemText
                          primary={
                            <Typography
                              variant="subtitle2"
                              sx={{
                                fontSize: 13,
                                fontWeight: noti.isRead ? 600 : 800,
                                color: noti.isRead ? 'text.secondary' : 'text.primary',
                              }}
                            >
                              {noti.title}
                            </Typography>
                          }
                          secondary={
                            <Stack spacing={0.5} sx={{ mt: 0.3 }}>
                              <Typography
                                variant="body2"
                                color="text.primary"
                                sx={{
                                  fontSize: 12.5,
                                  fontWeight: noti.isRead ? 450 : 600,
                                  lineHeight: 1.4,
                                }}
                              >
                                {noti.content}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10.5 }}>
                                {formatTimeAgo(noti.createdAt)}
                              </Typography>
                            </Stack>
                          }
                          disableTypography
                        />
                      </ListItemButton>
                    );
                  })}
                </List>
              ) : (
                <Box sx={{ py: 6, px: 2, textAlign: 'center' }}>
                  <Avatar
                    sx={{
                      width: 48,
                      height: 48,
                      mx: 'auto',
                      mb: 1.5,
                      bgcolor: (theme) =>
                        theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                      color: 'text.secondary',
                    }}
                  >
                    <NotificationsIcon sx={{ fontSize: 24 }} />
                  </Avatar>
                  <Typography variant="body2" color="text.secondary" fontWeight={500}>
                    Chưa có thông báo mới nào trong Studio.
                  </Typography>
                </Box>
              )}
            </Box>
          </Popover>

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

