import { useMemo, useState, useContext, useEffect, useCallback, useRef } from 'react';
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
  QueueMusicRounded as PlaylistIcon,
  WarningAmberRounded as WarningIcon,
  SecurityRounded as SecurityIcon,
  HistoryRounded as HistoryIcon,
  CloseRounded as CloseIcon,
  ClearRounded as ClearIcon,
} from '@mui/icons-material';
import useAppToast from '../../../components/common/useAppToast';
import { ColorModeContext } from '../../../context/ColorModeContext';
import useClientSession from '../../../hooks/useClientSession';
import { logout } from '../../../services/api';
import { useClientPlayer } from './ClientPlayerProvider';
import { clientSongsApi, clientNotificationsApi } from '../../../services/client/client.service';
import { getOptimizedImageUrl } from '../../../utils/imageUtil';

const SEARCH_HISTORY_STORAGE_KEY = 'musicflow_search_history';
const MAX_SEARCH_HISTORY = 5;

const readSearchHistory = () => {
  try {
    const raw = localStorage.getItem(SEARCH_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const drawerWidth = 260;
const collapsedDrawerWidth = 76;

function ClientHeader({ title, desktopSidebarOpen = true, onToggleSidebar, onLogoutSuccess = () => {}, onOpenCommentsTarget = null }) {
  const navigate = useNavigate();
  const { showToast } = useAppToast();
  const { toggleColorMode, mode } = useContext(ColorModeContext);
  const [anchorEl, setAnchorEl] = useState(null);
  const [searchValue, setSearchValue] = useState('');
  const [searchResults, setSearchResults] = useState({ songs: [], playlists: [] });
  const [searchLoading, setSearchLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [searchHistory, setSearchHistory] = useState(() => readSearchHistory());
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notiAnchorEl, setNotiAnchorEl] = useState(null);
  const { playSong } = useClientPlayer();
  const { isLoggedIn, userName, userAvatar } = useClientSession();
  const userInitial = useMemo(() => (userName || 'U').charAt(0).toUpperCase(), [userName]);

  const saveHistory = useCallback((query) => {
    const trimmed = (query || '').trim();
    if (!trimmed) return;
    setSearchHistory((prev) => {
      const filtered = prev.filter((item) => item.toLowerCase() !== trimmed.toLowerCase());
      const updated = [trimmed, ...filtered].slice(0, 20);
      try {
        localStorage.setItem(SEARCH_HISTORY_STORAGE_KEY, JSON.stringify(updated));
      } catch (err) {
        console.warn('Failed to save search history:', err);
      }
      return updated;
    });
  }, []);

  const handleRemoveHistoryItem = (queryToRemove) => {
    setSearchHistory((prev) => {
      const updated = prev.filter((item) => item !== queryToRemove);
      try {
        localStorage.setItem(SEARCH_HISTORY_STORAGE_KEY, JSON.stringify(updated));
      } catch (err) {
        console.warn('Failed to update search history item:', err);
      }
      return updated;
    });
  };

  const handleClearAllHistory = () => {
    setSearchHistory([]);
    try {
      localStorage.removeItem(SEARCH_HISTORY_STORAGE_KEY);
    } catch (err) {
      console.warn('Failed to clear search history:', err);
    }
  };

  const handleSelectHistoryItem = (queryText) => {
    setSearchValue(queryText);
    saveHistory(queryText);
    setShowResults(true);
  };

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
      setSearchResults({ songs: [], playlists: [] });
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);
    const delayDebounce = setTimeout(async () => {
      try {
        const response = await clientSongsApi.search({
          query: trimmed,
          includePlaylists: true,
          includeArtists: true,
          limit: 8,
        });
        if (response.data && typeof response.data === 'object' && !Array.isArray(response.data)) {
          setSearchResults({
            songs: Array.isArray(response.data.songs) ? response.data.songs : [],
            playlists: Array.isArray(response.data.playlists) ? response.data.playlists : [],
          });
        } else if (Array.isArray(response.data)) {
          setSearchResults({ songs: response.data, playlists: [] });
        } else {
          setSearchResults({ songs: [], playlists: [] });
        }
      } catch (err) {
        console.warn('Header search error:', err);
        setSearchResults({ songs: [], playlists: [] });
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
    navigate('/');
  };

  const goToLogin = () => {
    handleClose();
    navigate('/?auth=login');
  };

  const goToRegister = () => {
    handleClose();
    navigate('/?auth=register');
  };

  const goToArtistLogin = () => {
    handleClose();
    navigate('/artist/dashboard?auth=login');
  };

  const submitSearch = () => {
    const trimmed = searchValue.trim();
    if (trimmed) {
      saveHistory(trimmed);
    }
    if (searchResults.songs.length > 0) {
      playSong(searchResults.songs[0], { queue: searchResults.songs });
      setShowResults(false);
    } else if (searchResults.playlists.length > 0) {
      navigate(`/playlists/${searchResults.playlists[0]._id}`);
      setShowResults(false);
    }
  };

  const searchInputRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        setShowResults(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
        background: (theme) => theme.palette.mode === 'dark' ? 'rgba(8, 12, 22, 0.72)' : 'rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(36px) saturate(200%)',
        borderBottom: '1px solid',
        borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
        transition: (theme) => theme.transitions.create(['width', 'margin-left'], {
          duration: theme.transitions.duration.shorter,
        }),
      }}
    >
      <Toolbar sx={{ minHeight: { xs: 64, md: 70 } }}>
        <IconButton
          onClick={onToggleSidebar}
          color="inherit"
          sx={{ mr: 1.25, display: { xs: 'inline-flex', md: 'none' } }}
        >
          <MenuIcon />
        </IconButton>
        <Typography variant="h6" noWrap component="div" sx={{ fontWeight: 850, fontSize: { xs: '1.05rem', md: '1.25rem' }, letterSpacing: '-0.02em' }}>
          {title}
        </Typography>
        <Box sx={{ flexGrow: 1, px: { xs: 1, md: 3 }, display: 'flex', justifyContent: 'center', position: 'relative' }}>
          <ClickAwayListener onClickAway={() => setShowResults(false)}>
            <Box sx={{ width: '100%', maxWidth: 480, position: 'relative' }}>
              <Box
                sx={{
                  width: '100%',
                  display: { xs: 'none', sm: 'flex' },
                  alignItems: 'center',
                  borderRadius: '9999px',
                  px: 2,
                  py: 0.85,
                  backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)',
                  border: '1px solid',
                  borderColor: (theme) => showResults ? '#6c63ff' : (theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'),
                  boxShadow: showResults ? '0 0 0 3px rgba(108, 99, 255, 0.25), 0 8px 24px rgba(0,0,0,0.3)' : 'none',
                  transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                  '&:hover': {
                    backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.06)',
                    borderColor: 'rgba(108, 99, 255, 0.5)',
                  }
                }}
              >
                <SearchIcon sx={{ color: '#8c85ff', mr: 1, fontSize: 20 }} />
                <InputBase
                  inputRef={searchInputRef}
                  placeholder="Tìm kiếm bài hát, nghệ sĩ, album, playlist..."
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                  onFocus={() => setShowResults(true)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      submitSearch();
                    }
                  }}
                  sx={{ width: '100%', fontSize: 13.5, fontWeight: 500 }}
                />
                {searchValue && (
                  <IconButton
                    size="small"
                    onClick={() => {
                      setSearchValue('');
                      searchInputRef.current?.focus();
                    }}
                    sx={{ p: 0.25, color: 'text.secondary', '&:hover': { color: 'text.primary' } }}
                  >
                    <ClearIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                )}
              </Box>

              {/* Floating Autocomplete & Search History Dropdown */}
              {showResults && (
                <Paper
                  elevation={12}
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
                  {/* TRƯỜNG HỢP 1: Chưa nhập chữ -> Hiển thị Lịch sử tìm kiếm (Tối đa 5 mục gần nhất) */}
                  {!searchValue.trim() ? (
                    searchHistory.length > 0 ? (
                      <Box sx={{ py: 1 }}>
                        <Box sx={{ px: 2, py: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid', borderColor: 'divider' }}>
                          <Stack direction="row" spacing={0.8} alignItems="center">
                            <HistoryIcon sx={{ fontSize: 16, color: '#8c85ff' }} />
                            <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                              Tìm kiếm gần đây
                            </Typography>
                          </Stack>
                          <Button
                            size="small"
                            variant="text"
                            onClick={handleClearAllHistory}
                            sx={{ fontSize: 11, fontWeight: 700, p: 0, minWidth: 0, textTransform: 'none', color: 'text.secondary', '&:hover': { color: 'error.main' } }}
                          >
                            Xóa tất cả
                          </Button>
                        </Box>
                        <List disablePadding sx={{ py: 0.5 }}>
                          {searchHistory.slice(0, MAX_SEARCH_HISTORY).map((queryText) => (
                            <ListItemButton
                              key={queryText}
                              onClick={() => handleSelectHistoryItem(queryText)}
                              sx={{
                                py: 0.85,
                                px: 2,
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                '&:hover': {
                                  backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(108, 99, 255, 0.08)' : 'rgba(108, 99, 255, 0.04)',
                                },
                              }}
                            >
                              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0, flexGrow: 1, mr: 1 }}>
                                <HistoryIcon sx={{ fontSize: 18, color: 'text.disabled', flexShrink: 0 }} />
                                <Typography variant="body2" sx={{ fontSize: 13, fontWeight: 600, color: 'text.primary' }} noWrap>
                                  {queryText}
                                </Typography>
                              </Stack>
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveHistoryItem(queryText);
                                }}
                                sx={{
                                  p: 0.5,
                                  color: 'text.disabled',
                                  '&:hover': { color: 'error.main', bgcolor: 'rgba(239, 68, 68, 0.1)' },
                                }}
                              >
                                <CloseIcon sx={{ fontSize: 15 }} />
                              </IconButton>
                            </ListItemButton>
                          ))}
                        </List>
                      </Box>
                    ) : null
                  ) : (
                    /* TRƯỜNG HỢP 2: Đang nhập từ khóa tìm kiếm */
                    searchLoading ? (
                      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
                        <CircularProgress size={24} sx={{ color: 'primary.main' }} />
                      </Box>
                    ) : (() => {
                      const foundSongs = Array.isArray(searchResults?.songs) ? searchResults.songs : (Array.isArray(searchResults) ? searchResults : []);
                      const foundPlaylists = Array.isArray(searchResults?.playlists) ? searchResults.playlists : [];
                      const hasResults = foundSongs.length > 0 || foundPlaylists.length > 0;

                      if (!hasResults) {
                        return (
                          <Box sx={{ py: 3, px: 2, textAlign: 'center' }}>
                            <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                              Không tìm thấy bài hát hoặc playlist nào phù hợp.
                            </Typography>
                          </Box>
                        );
                      }

                      return (
                        <List disablePadding sx={{ py: 0.5 }}>
                          {foundSongs.length > 0 && (
                            <>
                              <Box sx={{ px: 2, pt: 1, pb: 0.5 }}>
                                <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                                  Bài hát ({foundSongs.length})
                                </Typography>
                              </Box>
                              {foundSongs.map((song) => (
                                <ListItemButton
                                  key={song._id || song.id}
                                  onClick={() => {
                                    saveHistory(searchValue.trim());
                                    playSong(song, { queue: foundSongs });
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
                                      src={getOptimizedImageUrl(song.imageUrl, 'song_thumb')}
                                      sx={{ width: 34, height: 34, borderRadius: 1.5 }}
                                    />
                                  </ListItemAvatar>
                                  <ListItemText
                                    primary={song.title}
                                    secondary={(song.artists || []).map(a => typeof a === 'string' ? a : a?.name).filter(Boolean).join(', ')}
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
                            </>
                          )}

                          {foundPlaylists.length > 0 && (
                            <>
                              <Box sx={{ px: 2, pt: 1.5, pb: 0.5 }}>
                                <Typography variant="caption" sx={{ fontWeight: 800, color: 'primary.main', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                                  Danh sách phát ({foundPlaylists.length})
                                </Typography>
                              </Box>
                              {foundPlaylists.map((playlist) => (
                                <ListItemButton
                                  key={playlist._id || playlist.id}
                                  onClick={() => {
                                    saveHistory(searchValue.trim());
                                    navigate(`/playlists/${playlist._id || playlist.id}`);
                                    setShowResults(false);
                                  }}
                                  sx={{
                                    py: 1,
                                    px: 1.5,
                                    '&:hover': {
                                      backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(108, 99, 255, 0.1)' : 'rgba(108, 99, 255, 0.05)',
                                    },
                                  }}
                                >
                                  <ListItemAvatar sx={{ minWidth: 44 }}>
                                    <Avatar
                                      variant="rounded"
                                      src={getOptimizedImageUrl(playlist.coverImage, 'song_thumb')}
                                      sx={{ width: 34, height: 34, borderRadius: 1.5, bgcolor: 'rgba(108, 99, 255, 0.15)', color: 'primary.main' }}
                                    >
                                      <PlaylistIcon sx={{ fontSize: 18 }} />
                                    </Avatar>
                                  </ListItemAvatar>
                                  <ListItemText
                                    primary={playlist.name}
                                    secondary={`${playlist.ownerName || 'Playlist'} • ${playlist.songCount || 0} bài hát`}
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
                            </>
                          )}
                        </List>
                      );
                    })()
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
                    } else if (noti.type === 'admin_moderation_alert') {
                      IconComponent = WarningIcon;
                      iconBgColor = 'rgba(239, 68, 68, 0.15)';
                      iconColor = '#ef4444';
                    } else if (noti.type === 'song_moderation_result') {
                      IconComponent = SecurityIcon;
                      iconBgColor = 'rgba(245, 158, 11, 0.15)';
                      iconColor = '#f59e0b';
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

                          // 1. Chỉ mở bình luận khi thực sự là thông báo về tương tác / bình luận
                          if (noti.type === 'interaction' || commentId || (actionUrl && actionUrl.includes('comment='))) {
                            if (onOpenCommentsTarget) {
                              onOpenCommentsTarget({ songId, commentId, actionUrl });
                            }
                          }
                          // 2. Cảnh báo kiểm duyệt AI cho Admin -> Chuyển đến trang Quản lý bài hát
                          else if (noti.type === 'admin_moderation_alert') {
                            navigate(actionUrl || '/admin/songs');
                          }
                          // 3. Kết quả kiểm duyệt cho Uploader -> Chuyển đến Thư viện tải lên
                          else if (noti.type === 'song_moderation_result') {
                            navigate(actionUrl || '/client/library');
                          }
                          // 4. Thông báo gói dịch vụ Subscription -> Chuyển đến trang Premium
                          else if (noti.type === 'subscription') {
                            navigate('/client/premium');
                          }
                          // 5. Các hành động điều hướng khác nếu có actionUrl
                          else if (actionUrl) {
                            navigate(actionUrl);
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
            <Avatar src={isLoggedIn && userAvatar ? userAvatar : undefined} sx={{ bgcolor: '#6c63ff', color: '#fff', width: 36, height: 36, fontWeight: 700, boxShadow: '0 2px 8px rgba(108, 99, 255, 0.3)' }}>
              {isLoggedIn ? userInitial : <PersonIcon />}
            </Avatar>
          </IconButton>
        </Stack>
        <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleClose}>
          {isLoggedIn ? (
            [
              <MenuItem key="profile" onClick={() => { handleClose(); navigate('/profile'); }}>Profile</MenuItem>,
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
