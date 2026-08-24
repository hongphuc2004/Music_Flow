import { useMemo, useState, useContext, useEffect, useCallback } from 'react';
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
  InputBase,
  Stack,
  ClickAwayListener,
  Paper,
  List,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  CircularProgress,
  Badge,
  Popover,
  Button,
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  MenuRounded as MenuIcon,
  SearchRounded as SearchIcon,
  PersonRounded as PersonIcon,
  MicExternalOnOutlined,
  DarkModeRounded as DarkModeIcon,
  LightModeRounded as LightModeIcon,
  CreditCardRounded as CreditCardIcon,
  CampaignRounded as CampaignIcon,
  InfoRounded as InfoIcon,
} from '@mui/icons-material';
import useAppToast from '../../../components/common/useAppToast';
import { ColorModeContext } from '../../../context/ColorModeContext';
import useClientSession from '../../../hooks/useClientSession';
import { logout } from '../../../services/api';
import { useClientPlayer } from './ClientPlayerProvider';
import { clientSongsApi, clientNotificationsApi } from '../../../services/client/client.service';

const drawerWidth = 260;
const collapsedDrawerWidth = 76;

function ClientHeader({ title, desktopSidebarOpen = true, onToggleSidebar, onLogoutSuccess = () => {}, onOpenCommentsTarget = null }) {
  const navigate = useNavigate();
  const { showToast } = useAppToast();
  const { toggleColorMode, mode } = useContext(ColorModeContext);
  const [anchorEl, setAnchorEl] = useState(null);
  const [searchValue, setSearchValue] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notiAnchorEl, setNotiAnchorEl] = useState(null);
  const { playSong } = useClientPlayer();
  const { isLoggedIn, userName, userAvatar } = useClientSession();
  const userInitial = useMemo(() => (userName || 'U').charAt(0).toUpperCase(), [userName]);

  const fetchNotifications = useCallback(async () => {
    if (!isLoggedIn) return;
    try {
      const res = await clientNotificationsApi.getAll();
      if (res.data?.success) {
        setNotifications(res.data.data || []);
        setUnreadCount(res.data.unreadCount || 0);
      }
    } catch (err) {
      console.warn("Failed to fetch notifications:", err);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (isLoggedIn) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 60000); // 60s auto refresh
      return () => clearInterval(interval);
    }
  }, [isLoggedIn, fetchNotifications]);

  const handleNotiOpen = (event) => {
    setNotiAnchorEl(event.currentTarget);
  };

  const handleNotiClose = () => {
    setNotiAnchorEl(null);
  };

  const handleMarkAsRead = async (id) => {
    try {
      await clientNotificationsApi.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.warn("Failed to mark notification as read:", err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await clientNotificationsApi.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.warn("Failed to mark all notifications as read:", err);
    }
  };

  const formatTimeAgo = (dateString) => {
    try {
      const date = new Date(dateString);
      const seconds = Math.floor((new Date() - date) / 1000);
      if (seconds < 60) return "vừa xong";
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return `${minutes} phút trước`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours} giờ trước`;
      const days = Math.floor(hours / 24);
      if (days < 30) return `${days} ngày trước`;
      return date.toLocaleDateString("vi-VN");
    } catch {
      return "";
    }
  };

  useEffect(() => {
    const trimmed = searchValue.trim();
    if (!trimmed) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);
    const delayDebounce = setTimeout(async () => {
      try {
        const response = await clientSongsApi.search({ query: trimmed, limit: 8 });
        setSearchResults(Array.isArray(response.data) ? response.data : []);
      } catch (err) {
        console.warn('Header search error:', err);
      } finally {
        setSearchLoading(false);
      }
    }, 400); // 400ms debounce

    return () => clearTimeout(delayDebounce);
  }, [searchValue]);

  const handleMenu = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    handleClose();
    await logout();
    onLogoutSuccess();
    showToast({
      severity: 'success',
      title: 'Thành công!',
      message: 'Bạn đã đăng xuất khỏi tài khoản.',
    });
    navigate('/client/home');
  };

  const goToLogin = () => {
    handleClose();
    navigate('/client/home?auth=login');
  };

  const goToRegister = () => {
    handleClose();
    navigate('/client/home?auth=register');
  };

  const goToArtistLogin = () => {
    handleClose();
    navigate('/artist/dashboard?auth=login');
  };

  const submitSearch = () => {
    if (searchResults.length > 0) {
      playSong(searchResults[0], { queue: searchResults });
      setShowResults(false);
    }
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
        background: (theme) => theme.palette.mode === 'dark' ? 'rgba(11, 15, 25, 0.88)' : 'rgba(248, 250, 252, 0.88)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid',
        borderColor: 'divider',
        transition: (theme) => theme.transitions.create(['width', 'margin-left'], {
          duration: theme.transitions.duration.shorter,
        }),
      }}
    >
      <Toolbar>
        <IconButton
          onClick={onToggleSidebar}
          color="inherit"
          sx={{ mr: 1.25, display: { xs: 'inline-flex', md: 'none' } }}
        >
          <MenuIcon />
        </IconButton>
        <Typography variant="h6" noWrap component="div" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
        <Box sx={{ flexGrow: 1, px: { xs: 1, md: 2 }, display: 'flex', justifyContent: 'center', position: 'relative' }}>
          <ClickAwayListener onClickAway={() => setShowResults(false)}>
            <Box sx={{ width: '100%', maxWidth: 420, position: 'relative' }}>
              <Box
                sx={{
                  width: '100%',
                  display: { xs: 'none', sm: 'flex' },
                  alignItems: 'center',
                  borderRadius: 3,
                  px: 1.25,
                  py: 0.5,
                  backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(31, 41, 55, 0.5)' : 'rgba(255,255,255,0.76)',
                  border: '1px solid',
                  borderColor: (theme) => showResults && searchValue.trim() ? theme.palette.primary.main : 'divider',
                  boxShadow: showResults && searchValue.trim() ? '0 0 0 2px rgba(108, 99, 255, 0.2)' : 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                <SearchIcon sx={{ color: 'text.secondary', mr: 0.75, fontSize: 18 }} />
                <InputBase
                  placeholder="Tìm kiếm bài hát, ca sĩ..."
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                  onFocus={() => setShowResults(true)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      submitSearch();
                    }
                  }}
                  sx={{ width: '100%', fontSize: 14 }}
                />
              </Box>

              {/* Floating Autocomplete Dropdown */}
              {showResults && searchValue.trim() && (
                <Paper
                  elevation={8}
                  sx={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    left: 0,
                    right: 0,
                    zIndex: 1400,
                    borderRadius: 3,
                    overflow: 'hidden',
                    maxHeight: 380,
                    overflowY: 'auto',
                    border: '1px solid',
                    borderColor: 'divider',
                    backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(17, 24, 39, 0.95)' : 'rgba(255, 255, 255, 0.98)',
                    backdropFilter: 'blur(16px)',
                  }}
                >
                  {searchLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
                      <CircularProgress size={24} sx={{ color: 'primary.main' }} />
                    </Box>
                  ) : searchResults.length > 0 ? (
                    <List disablePadding>
                      {searchResults.map((song) => (
                        <ListItemButton
                          key={song._id}
                          onClick={() => {
                            playSong(song, { queue: searchResults });
                            setShowResults(false);
                          }}
                          sx={{
                            py: 1,
                            px: 1.5,
                            '&:hover': {
                              backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                            },
                          }}
                        >
                          <ListItemAvatar sx={{ minWidth: 44 }}>
                            <Avatar
                              variant="rounded"
                              src={song.imageUrl}
                              sx={{ width: 34, height: 34, borderRadius: 1.5 }}
                            />
                          </ListItemAvatar>
                          <ListItemText
                            primary={song.title}
                            secondary={(song.artists || []).map(a => typeof a === 'string' ? a : a.name).join(', ')}
                            primaryTypographyProps={{
                              fontSize: 13.5,
                              fontWeight: 700,
                              noWrap: true,
                            }}
                            secondaryTypographyProps={{
                              fontSize: 11,
                              noWrap: true,
                            }}
                          />
                        </ListItemButton>
                      ))}
                    </List>
                  ) : (
                    <Box sx={{ py: 3, px: 2, textAlign: 'center' }}>
                      <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                        Không tìm thấy bài hát nào phù hợp.
                      </Typography>
                    </Box>
                  )}
                </Paper>
              )}
            </Box>
          </ClickAwayListener>
        </Box>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mr: 1.5 }}>
          <IconButton onClick={toggleColorMode} color="inherit">
            {mode === 'dark' ? <LightModeIcon sx={{ color: '#fbbf24' }} /> : <DarkModeIcon />}
          </IconButton>
          <IconButton color="inherit" onClick={handleNotiOpen}>
            <Badge badgeContent={unreadCount} color="error" max={99}>
              <NotificationsIcon />
            </Badge>
          </IconButton>
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
                width: 360,
                maxHeight: 480,
                borderRadius: 3,
                mt: 1.5,
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.24)',
                border: '1px solid',
                borderColor: 'divider',
                backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(17, 24, 39, 0.95)' : 'rgba(255, 255, 255, 0.98)',
                backdropFilter: 'blur(16px)',
              }
            }}
          >
            <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid', borderColor: 'divider' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Thông báo</Typography>
              {unreadCount > 0 && (
                <Button size="small" variant="text" onClick={handleMarkAllAsRead} sx={{ fontSize: 12, fontWeight: 700, p: 0, minWidth: 0, textTransform: 'none' }}>
                  Đọc tất cả
                </Button>
              )}
            </Box>
            
            <Box sx={{ overflowY: 'auto', maxHeight: 380 }}>
              {notifications.length > 0 ? (
                <List disablePadding>
                  {notifications.map((noti) => {
                    let IconComponent = InfoIcon;
                    let iconBgColor = 'rgba(0, 188, 212, 0.15)';
                    let iconColor = '#00bcd4';

                    if (noti.type === 'subscription') {
                      IconComponent = CreditCardIcon;
                      iconBgColor = 'rgba(108, 99, 255, 0.15)';
                      iconColor = '#6c63ff';
                    } else if (noti.type === 'system') {
                      IconComponent = CampaignIcon;
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
                          const songId = metadata.songId || '';
                          const commentId = metadata.commentId || '';
                          const actionUrl = metadata.actionUrl || '';

                          if (noti.type === 'interaction' || commentId || songId || (actionUrl && actionUrl.includes('comment='))) {
                            if (onOpenCommentsTarget) {
                              onOpenCommentsTarget({ songId, commentId, actionUrl });
                            }
                          } else if (actionUrl) {
                            navigate(actionUrl);
                          } else if (noti.type === 'subscription') {
                            navigate('/client/subscription');
                          }
                        }}
                        sx={{
                          py: 1.5,
                          px: 2,
                          alignItems: 'flex-start',
                          borderBottom: '1px solid',
                          borderColor: 'rgba(0,0,0,0.03)',
                          backgroundColor: noti.isRead 
                            ? 'transparent' 
                            : (theme) => theme.palette.mode === 'dark' ? 'rgba(108, 99, 255, 0.05)' : 'rgba(108, 99, 255, 0.03)',
                          '&:hover': {
                            backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                          }
                        }}
                      >
                        <ListItemAvatar sx={{ minWidth: 46, mt: 0.5 }}>
                          <Avatar sx={{ width: 34, height: 34, bgcolor: iconBgColor, color: iconColor }}>
                            <IconComponent sx={{ fontSize: 18 }} />
                          </Avatar>
                        </ListItemAvatar>
                        
                        <ListItemText
                          primary={noti.title}
                          secondary={
                            <Stack spacing={0.5}>
                              <Typography variant="body2" color="text.primary" sx={{ fontSize: 12.5, fontWeight: noti.isRead ? 500 : 700, lineHeight: 1.4 }}>
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
                  <Typography variant="body2" color="text.secondary" fontWeight={500}>
                    Bạn chưa có thông báo nào.
                  </Typography>
                </Box>
              )}
            </Box>
          </Popover>
          {isLoggedIn && (
            <Box sx={{ textAlign: 'right', display: { xs: 'none', md: 'block' } }}>
              <Typography variant="body2" fontWeight={700}>
                {userName}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Music listener
              </Typography>
            </Box>
          )}
          <IconButton onClick={handleMenu} color="inherit" sx={{ p: 0.5 }}>
            <Avatar src={isLoggedIn && userAvatar ? userAvatar : undefined} sx={{ bgcolor: '#14b8a6', color: '#fff' }}>
              {isLoggedIn ? userInitial : <PersonIcon />}
            </Avatar>
          </IconButton>
        </Stack>
        <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleClose}>
          {isLoggedIn ? (
            [
              <MenuItem key="profile" onClick={() => { handleClose(); navigate('/client/profile'); }}>Profile</MenuItem>,
              <MenuItem key="logout" onClick={handleLogout}>Đăng Xuất</MenuItem>,
            ]
          ) : (
            [
              <MenuItem key="login" onClick={goToLogin}>Đăng Nhập</MenuItem>,
              <MenuItem key="register" onClick={goToRegister}>Đăng Ký Tài Khoản</MenuItem>,
              <MenuItem key="artist" onClick={goToArtistLogin}>
                <MicExternalOnOutlined fontSize="small" sx={{ mr: 1.25 }} />
                Artist Studio
              </MenuItem>,
            ]
          )}
        </Menu>
      </Toolbar>
    </AppBar>
  );
}

export default ClientHeader;
