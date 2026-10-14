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
  Tooltip,
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
  TrendingUpRounded as TrendingIcon,
  CheckCircleRounded as VerifiedIcon,
  MicRounded as MicIcon,
} from '@mui/icons-material';
import useAppToast from '../../../components/common/js/useAppToast';
import { ColorModeContext } from '../../../context/ColorModeContext';
import useClientSession from '../../../hooks/useClientSession';
import { logout } from '../../../services/api';
import { useClientPlayer, useClientPlayerActions } from './ClientPlayerProvider';
import ClientSongMoreMenu from './ClientSongMoreMenu';
import { clientSongsApi, clientNotificationsApi } from '../../../services/client/client.service';
import { getOptimizedImageUrl } from '../../../utils/imageUtil';
import { getArtistPath } from '../../../utils/shareUtil';
import useVoiceRecognition from '../../../hooks/useVoiceRecognition';
import NotificationBellButton from '../../../components/common/ui/NotificationBellButton';
import NotificationPanel from '../../../components/common/ui/NotificationPanel';
import PremiumBadge from '../../../components/common/ui/PremiumBadge';

const SEARCH_HISTORY_STORAGE_KEY = 'musicflow_search_history';
const MAX_SEARCH_HISTORY = 5;
const DEFAULT_SUGGESTIONS = [
  'Đến khi nào',
  'Kẻ say tình 2',
  'Ngược lối yêu',
  'Tình hà say hi',
  'Anh trai vượt ngàn chông gai',
  '#musicflowchart',
];

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
  const [searchResults, setSearchResults] = useState({ songs: [], artists: [], playlists: [] });
  const [searchLoading, setSearchLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [searchHistory, setSearchHistory] = useState(() => readSearchHistory());
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notiAnchorEl, setNotiAnchorEl] = useState(null);
  const { isPlaying } = useClientPlayer();
  const { playSong, pauseSong, resumeSong } = useClientPlayerActions();
  const wasPlayingRef = useRef(false);
  const { isLoggedIn, userName, userAvatar } = useClientSession();
  const userInitial = useMemo(() => (userName || 'U').charAt(0).toUpperCase(), [userName]);

  const {
    isSupported: isVoiceSupported,
    isListening: isVoiceListening,
    startListening: startVoiceListening,
    stopListening: stopVoiceListening,
  } = useVoiceRecognition();

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
      setSearchResults({ songs: [], artists: [], playlists: [] });
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
            artists: Array.isArray(response.data.artists) ? response.data.artists : [],
            playlists: Array.isArray(response.data.playlists) ? response.data.playlists : [],
          });
        } else if (Array.isArray(response.data)) {
          setSearchResults({ songs: response.data, artists: [], playlists: [] });
        } else {
          setSearchResults({ songs: [], artists: [], playlists: [] });
        }
      } catch (err) {
        console.warn('Header search error:', err);
        setSearchResults({ songs: [], artists: [], playlists: [] });
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
    if (localStorage.getItem('role') === 'artist') {
      navigate('/artist/dashboard');
    } else {
      navigate('/artist/dashboard?auth=login');
    }
  };

  const relatedKeywords = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    if (!query) return [];
    const list = [];
    const artists = Array.isArray(searchResults?.artists) ? searchResults.artists : [];
    const songs = Array.isArray(searchResults?.songs) ? searchResults.songs : [];

    // Prioritize matching artist names
    artists.forEach((a) => {
      if (a.name && a.name.toLowerCase().includes(query)) {
        if (!list.some((item) => item.toLowerCase() === a.name.toLowerCase())) {
          list.push(a.name);
        }
      }
    });

    // Prioritize songs whose title contains the query
    songs.forEach((s) => {
      if (s.title && s.title.toLowerCase().includes(query)) {
        if (!list.some((item) => item.toLowerCase() === s.title.toLowerCase())) {
          list.push(s.title);
        }
      }
    });

    // Then other artists from results
    artists.forEach((a) => {
      if (a.name && !list.some((item) => item.toLowerCase() === a.name.toLowerCase())) {
        list.push(a.name);
      }
    });

    // Then other songs from results
    songs.forEach((s) => {
      if (s.title && !list.some((item) => item.toLowerCase() === s.title.toLowerCase())) {
        list.push(s.title);
      }
    });

    const playlists = Array.isArray(searchResults?.playlists) ? searchResults.playlists : [];
    playlists.forEach((p) => {
      if (p.name && !list.some((item) => item.toLowerCase() === p.name.toLowerCase())) {
        list.push(p.name);
      }
    });
    return list.slice(0, 4);
  }, [searchValue, searchResults]);

  const submitSearch = (customQuery) => {
    const trimmed = (customQuery !== undefined ? customQuery : searchValue).trim();
    if (trimmed) {
      saveHistory(trimmed);
      setSearchValue(trimmed);
    }
    const songs = Array.isArray(searchResults?.songs) ? searchResults.songs : [];
    const artists = Array.isArray(searchResults?.artists) ? searchResults.artists : [];
    const playlists = Array.isArray(searchResults?.playlists) ? searchResults.playlists : [];

    const matchedArtist = artists.find(
      (a) => a.name && a.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (matchedArtist) {
      navigate(getArtistPath(matchedArtist));
      setShowResults(false);
    } else if (songs.length > 0) {
      playSong(songs[0], { queue: songs });
      setShowResults(false);
    } else if (artists.length > 0) {
      navigate(getArtistPath(artists[0]));
      setShowResults(false);
    } else if (playlists.length > 0) {
      navigate(`/playlists/${playlists[0]._id || playlists[0].id}`);
      setShowResults(false);
    }
  };

  const handleToggleVoiceSearch = () => {
    if (isVoiceListening) {
      stopVoiceListening();
      if (wasPlayingRef.current) {
        wasPlayingRef.current = false;
        resumeSong?.();
      }
      return;
    }
    if (!isVoiceSupported) {
      showToast({
        severity: 'warning',
        title: 'Chưa hỗ trợ',
        message: 'Trình duyệt của bạn chưa hỗ trợ nhận diện giọng nói Web Speech API.',
      });
      return;
    }

    // Tạm dừng nhạc nếu đang phát để Micro không thu phải âm thanh từ loa
    if (isPlaying) {
      wasPlayingRef.current = true;
      pauseSong?.();
    } else {
      wasPlayingRef.current = false;
    }

    setShowResults(true);
    startVoiceListening({
      lang: 'vi-VN',
      silenceTimeoutMs: 1300,
      onResult: (text) => {
        setSearchValue(text);
      },
      onEnd: async (cleanedQuery, rawQuery) => {
        // Khôi phục nhạc nếu trước đó đang phát
        if (wasPlayingRef.current) {
          wasPlayingRef.current = false;
          resumeSong?.();
        }

        const query = (cleanedQuery || rawQuery || '').trim();
        if (!query) return;

        setSearchValue(query);
        saveHistory(query);
        setShowResults(true);
        setSearchLoading(true);

        try {
          const response = await clientSongsApi.search({
            query,
            includePlaylists: true,
            includeArtists: true,
            limit: 8,
          });

          if (response.data && typeof response.data === 'object') {
            const songs = Array.isArray(response.data.songs) ? response.data.songs : [];
            const artists = Array.isArray(response.data.artists) ? response.data.artists : [];
            const playlists = Array.isArray(response.data.playlists) ? response.data.playlists : [];

            setSearchResults({ songs, artists, playlists });

            // 1. Nếu trùng khớp tên nghệ sĩ -> chuyển thẳng tới trang nghệ sĩ
            const matchedArtist = artists.find(
              (a) => a.name && a.name.toLowerCase() === query.toLowerCase()
            );
            if (matchedArtist) {
              navigate(getArtistPath(matchedArtist));
              setShowResults(false);
              return;
            }

            // 2. Nếu trùng khớp tên bài hát -> phát luôn bài đó
            const exactSong = songs.find(
              (s) => s.title && s.title.toLowerCase() === query.toLowerCase()
            );
            if (exactSong) {
              playSong(exactSong, { queue: songs });
              setShowResults(false);
              return;
            }
          }
        } catch (err) {
          console.warn('[Voice Search] Direct search error:', err);
        } finally {
          setSearchLoading(false);
        }
      },
      onError: (err) => {
        if (wasPlayingRef.current) {
          wasPlayingRef.current = false;
          resumeSong?.();
        }
        showToast({
          severity: 'error',
          title: 'Lỗi giọng nói',
          message: err.message,
        });
      },
    });
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
                  placeholder={isVoiceListening ? "Đang lắng nghe bạn nói..." : "Tìm kiếm bài hát, nghệ sĩ, lời bài hát..."}
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
                    sx={{ p: 0.25, mr: 0.5, color: 'text.secondary', '&:hover': { color: 'text.primary' } }}
                  >
                    <ClearIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                )}
                <Tooltip title={isVoiceListening ? "Đang nghe... Bấm để dừng" : "Tìm kiếm bằng giọng nói"}>
                  <IconButton
                    size="small"
                    onClick={handleToggleVoiceSearch}
                    sx={{
                      p: 0.5,
                      color: isVoiceListening ? '#ef4444' : (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.54)',
                      bgcolor: isVoiceListening ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
                      animation: isVoiceListening ? 'pulseVoice 1.4s infinite ease-in-out' : 'none',
                      '@keyframes pulseVoice': {
                        '0%': { transform: 'scale(1)', boxShadow: '0 0 0 0 rgba(239, 68, 68, 0.5)' },
                        '50%': { transform: 'scale(1.15)', boxShadow: '0 0 0 6px rgba(239, 68, 68, 0)' },
                        '100%': { transform: 'scale(1)', boxShadow: '0 0 0 0 rgba(239, 68, 68, 0)' },
                      },
                      '&:hover': {
                        color: isVoiceListening ? '#dc2626' : 'primary.main',
                        bgcolor: isVoiceListening ? 'rgba(239, 68, 68, 0.25)' : 'rgba(108, 99, 255, 0.1)',
                      },
                    }}
                  >
                    <MicIcon sx={{ fontSize: 19 }} />
                  </IconButton>
                </Tooltip>
              </Box>

              {/* Floating Autocomplete & Search History Dropdown (ZingMP3 Style) */}
              {showResults && (
                <Paper
                  elevation={12}
                  sx={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    left: 0,
                    right: 0,
                    zIndex: 1400,
                    borderRadius: '16px',
                    overflow: 'hidden',
                    maxHeight: 520,
                    overflowY: 'auto',
                    border: '1px solid',
                    borderColor: 'divider',
                    backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(17, 24, 39, 0.96)' : 'rgba(255, 255, 255, 0.98)',
                    backdropFilter: 'blur(16px)',
                    boxShadow: (theme) => theme.palette.mode === 'dark'
                      ? '0 12px 36px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.06)'
                      : '0 12px 36px rgba(0, 0, 0, 0.12)',
                    '&::-webkit-scrollbar': { width: 5 },
                    '&::-webkit-scrollbar-thumb': {
                      backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)',
                      borderRadius: 4,
                    },
                  }}
                >
                  {/* Visual Voice Search Banner */}
                  {isVoiceListening && (
                    <Box
                      sx={{
                        p: 1.75,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(108, 99, 255, 0.12))',
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                      }}
                    >
                      <Box
                        sx={{
                          width: 34,
                          height: 34,
                          borderRadius: '50%',
                          bgcolor: 'error.main',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          animation: 'pulseVoice 1.4s infinite ease-in-out',
                        }}
                      >
                        <MicIcon sx={{ fontSize: 18 }} />
                      </Box>
                      <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary', fontSize: 13 }}>
                          Đang lắng nghe giọng nói...
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 11.5 }}>
                          {searchValue ? `"${searchValue}"` : "Hãy nói tên bài hát hoặc ca sĩ (ví dụ: 'Bùi Anh Tuấn', 'Hẹn Một Mai')..."}
                        </Typography>
                      </Box>
                    </Box>
                  )}

                  {/* TRƯỜNG HỢP 1: Chưa nhập chữ -> Hiển thị "Đề xuất cho bạn" & "Tìm kiếm gần đây" */}
                  {!searchValue.trim() ? (
                    <Box sx={{ py: 1 }}>
                      {/* Section 1: Đề xuất cho bạn */}
                      <Box sx={{ px: 2, pt: 0.5, pb: 0.8 }}>
                        <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.8, fontSize: 12 }}>
                          Đề xuất cho bạn
                        </Typography>
                      </Box>
                      <List disablePadding sx={{ pb: 0.5 }}>
                        {DEFAULT_SUGGESTIONS.map((suggestion) => (
                          <ListItemButton
                            key={suggestion}
                            onClick={() => handleSelectHistoryItem(suggestion)}
                            sx={{
                              py: 0.85,
                              px: 2,
                              borderRadius: '8px',
                              mx: 1,
                              '&:hover': {
                                backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(108, 99, 255, 0.08)' : 'rgba(108, 99, 255, 0.04)',
                              },
                            }}
                          >
                            <TrendingIcon sx={{ fontSize: 18, color: '#8c85ff', mr: 1.5, flexShrink: 0 }} />
                            <Typography variant="body2" sx={{ fontSize: 13.5, fontWeight: 600, color: 'text.primary' }} noWrap>
                              {suggestion}
                            </Typography>
                          </ListItemButton>
                        ))}
                      </List>

                      {/* Phân cách giữa Đề xuất & Tìm kiếm gần đây */}
                      <Box sx={{ borderBottom: '1px solid', borderColor: 'divider', my: 1 }} />

                      {/* Section 2: Tìm kiếm gần đây */}
                      <Box sx={{ px: 2, pt: 0.5, pb: 0.8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.8, fontSize: 12 }}>
                          Tìm kiếm gần đây
                        </Typography>
                        {searchHistory.length > 0 && (
                          <Button
                            size="small"
                            variant="text"
                            onClick={handleClearAllHistory}
                            sx={{
                              fontSize: 11.5,
                              fontWeight: 700,
                              p: 0,
                              minWidth: 0,
                              textTransform: 'uppercase',
                              color: '#8c85ff',
                              '&:hover': { color: 'error.main' },
                            }}
                          >
                            Xóa
                          </Button>
                        )}
                      </Box>
                      {searchHistory.length > 0 ? (
                        <List disablePadding sx={{ pb: 0.5 }}>
                          {searchHistory.slice(0, MAX_SEARCH_HISTORY).map((queryText) => (
                            <ListItemButton
                              key={queryText}
                              onClick={() => handleSelectHistoryItem(queryText)}
                              sx={{
                                py: 0.85,
                                px: 2,
                                borderRadius: '8px',
                                mx: 1,
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
                                <Typography variant="body2" sx={{ fontSize: 13.5, fontWeight: 600, color: 'text.primary' }} noWrap>
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
                      ) : (
                        <Box sx={{ px: 2, py: 1 }}>
                          <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: 12.5, fontStyle: 'italic' }}>
                            Chưa có lịch sử tìm kiếm.
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  ) : (
                    /* TRƯỜNG HỢP 2: Đang nhập từ khóa tìm kiếm (như ZingMP3) */
                    searchLoading ? (
                      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
                        <CircularProgress size={24} sx={{ color: 'primary.main' }} />
                      </Box>
                    ) : (() => {
                      const foundSongs = Array.isArray(searchResults?.songs) ? searchResults.songs : (Array.isArray(searchResults) ? searchResults : []);
                      const foundArtists = Array.isArray(searchResults?.artists) ? searchResults.artists : [];
                      const foundPlaylists = Array.isArray(searchResults?.playlists) ? searchResults.playlists : [];
                      const hasResults = foundSongs.length > 0 || foundArtists.length > 0 || foundPlaylists.length > 0;

                      return (
                        <Box sx={{ py: 1 }}>
                          {/* Section 1: Từ khóa liên quan */}
                          <Box sx={{ px: 2, pt: 0.5, pb: 0.8 }}>
                            <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.8, fontSize: 12 }}>
                              Từ khóa liên quan
                            </Typography>
                          </Box>
                          <List disablePadding sx={{ pb: 0.5 }}>
                            {relatedKeywords.map((keyword) => (
                              <ListItemButton
                                key={keyword}
                                onClick={() => {
                                  handleSelectHistoryItem(keyword);
                                }}
                                sx={{
                                  py: 0.85,
                                  px: 2,
                                  borderRadius: '8px',
                                  mx: 1,
                                  '&:hover': {
                                    backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(108, 99, 255, 0.08)' : 'rgba(108, 99, 255, 0.04)',
                                  },
                                }}
                              >
                                <SearchIcon sx={{ fontSize: 18, color: 'text.secondary', mr: 1.5, flexShrink: 0 }} />
                                <Typography variant="body2" sx={{ fontSize: 13.5, fontWeight: 600, color: 'text.primary' }} noWrap>
                                  {keyword}
                                </Typography>
                              </ListItemButton>
                            ))}
                            {/* Dòng tìm kiếm chính từ khóa đang gõ */}
                            <ListItemButton
                              onClick={() => submitSearch()}
                              sx={{
                                py: 0.85,
                                px: 2,
                                borderRadius: '8px',
                                mx: 1,
                                '&:hover': {
                                  backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(108, 99, 255, 0.12)' : 'rgba(108, 99, 255, 0.06)',
                                },
                              }}
                            >
                              <SearchIcon sx={{ fontSize: 18, color: '#8c85ff', mr: 1.5, flexShrink: 0 }} />
                              <Typography variant="body2" sx={{ fontSize: 13.5, fontWeight: 600, color: '#8c85ff' }} noWrap>
                                Tìm kiếm "{searchValue.trim()}"
                              </Typography>
                            </ListItemButton>
                          </List>

                          {/* Phân cách giữa Từ khóa liên quan & Gợi ý kết quả */}
                          <Box sx={{ borderBottom: '1px solid', borderColor: 'divider', my: 1 }} />

                          {/* Section 2: Gợi ý kết quả */}
                          <Box sx={{ px: 2, pt: 0.5, pb: 0.8 }}>
                            <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.8, fontSize: 12 }}>
                              Gợi ý kết quả
                            </Typography>
                          </Box>

                          {!hasResults ? (
                            <Box sx={{ py: 2.5, px: 2, textAlign: 'center' }}>
                              <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500, fontSize: 13 }}>
                                Không tìm thấy bài hát, nghệ sĩ hoặc danh sách phát nào phù hợp.
                              </Typography>
                            </Box>
                          ) : (
                            <List disablePadding sx={{ pb: 0.5 }}>
                              {/* Khối Nghệ Sĩ */}
                              {foundArtists.length > 0 && (
                                <>
                                  <Box sx={{ px: 2, pt: 0.8, pb: 0.4 }}>
                                    <Typography variant="caption" sx={{ fontWeight: 800, color: 'primary.main', textTransform: 'uppercase', letterSpacing: 0.8, fontSize: 11.5 }}>
                                      Nghệ sĩ ({foundArtists.length})
                                    </Typography>
                                  </Box>
                                  {foundArtists.map((artist) => (
                                    <ListItemButton
                                      key={artist._id || artist.id}
                                      onClick={() => {
                                        saveHistory(searchValue.trim());
                                        navigate(getArtistPath(artist));
                                        setShowResults(false);
                                      }}
                                      sx={{
                                        py: 0.85,
                                        px: 1.5,
                                        borderRadius: '8px',
                                        mx: 1,
                                        my: 0.25,
                                        display: 'flex',
                                        alignItems: 'center',
                                        '&:hover': {
                                          backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(108, 99, 255, 0.12)' : 'rgba(108, 99, 255, 0.06)',
                                        },
                                      }}
                                    >
                                      <ListItemAvatar sx={{ minWidth: 46 }}>
                                        <Avatar
                                          src={getOptimizedImageUrl(artist.avatar, 'avatar')}
                                          sx={{
                                            width: 40,
                                            height: 40,
                                            border: '1.5px solid',
                                            borderColor: 'primary.main',
                                            bgcolor: 'rgba(108, 99, 255, 0.15)',
                                            color: 'primary.main',
                                          }}
                                        >
                                          <PersonIcon sx={{ fontSize: 20 }} />
                                        </Avatar>
                                      </ListItemAvatar>
                                      <ListItemText
                                        primary={
                                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                                            <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: 'text.primary' }} noWrap>
                                              {artist.name}
                                            </Typography>
                                            {Boolean(artist.isVerified) && (
                                              <VerifiedIcon sx={{ fontSize: 14, color: 'primary.main', flexShrink: 0 }} />
                                            )}
                                          </Box>
                                        }
                                        secondary={
                                          artist.followersCount !== undefined && artist.followersCount > 0
                                            ? `Nghệ sĩ • ${Number(artist.followersCount).toLocaleString('vi-VN')} người quan tâm`
                                            : 'Nghệ sĩ'
                                        }
                                        secondaryTypographyProps={{
                                          fontSize: 11.5,
                                          color: 'text.secondary',
                                          noWrap: true,
                                        }}
                                      />
                                    </ListItemButton>
                                  ))}
                                </>
                              )}

                              {/* Khối Bài Hát */}
                              {foundSongs.length > 0 && (
                                <>
                                  {foundArtists.length > 0 && (
                                    <Box sx={{ px: 2, pt: 1, pb: 0.4 }}>
                                      <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.8, fontSize: 11.5 }}>
                                        Bài hát ({foundSongs.length})
                                      </Typography>
                                    </Box>
                                  )}
                                  {foundSongs.map((song) => (
                                    <ListItemButton
                                      key={song._id || song.id}
                                      onClick={() => {
                                        saveHistory(searchValue.trim());
                                        playSong(song, { queue: foundSongs });
                                        setShowResults(false);
                                      }}
                                      sx={{
                                        py: 0.85,
                                        px: 1.5,
                                        borderRadius: '8px',
                                        mx: 1,
                                        my: 0.25,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        '&:hover': {
                                          backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                                        },
                                      }}
                                    >
                                      <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 0, flexGrow: 1, mr: 1 }}>
                                        <ListItemAvatar sx={{ minWidth: 46 }}>
                                          <Avatar
                                            variant="rounded"
                                            src={getOptimizedImageUrl(song.imageUrl, 'song_thumb')}
                                            sx={{ width: 38, height: 38, borderRadius: 1.5 }}
                                          />
                                        </ListItemAvatar>
                                        <ListItemText
                                          primary={
                                            <Stack direction="row" alignItems="center" spacing={0.8} sx={{ minWidth: 0 }}>
                                              <Typography
                                                sx={{
                                                  fontSize: 13.5,
                                                  fontWeight: 700,
                                                  color: 'text.primary',
                                                  overflow: 'hidden',
                                                  textOverflow: 'ellipsis',
                                                  whiteSpace: 'nowrap',
                                                  minWidth: 0,
                                                  flexShrink: 1,
                                                }}
                                              >
                                                {song.title}
                                              </Typography>
                                              {Boolean(song.isPremium) && <PremiumBadge sx={{ flexShrink: 0 }} />}
                                            </Stack>
                                          }
                                          secondary={(song.artists || []).map(a => typeof a === 'string' ? a : a?.name).filter(Boolean).join(', ')}
                                          secondaryTypographyProps={{
                                            fontSize: 11.5,
                                            noWrap: true,
                                          }}
                                        />
                                      </Box>
                                      <Box onClick={(e) => e.stopPropagation()} sx={{ flexShrink: 0 }}>
                                        <ClientSongMoreMenu
                                          song={song}
                                          buttonSx={{
                                            color: 'text.secondary',
                                            p: 0.4,
                                            '&:hover': {
                                              color: 'text.primary',
                                              backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'
                                            }
                                          }}
                                        />
                                      </Box>
                                    </ListItemButton>
                                  ))}
                                </>
                              )}

                              {foundPlaylists.length > 0 && (
                                <>
                                  <Box sx={{ px: 2, pt: 1, pb: 0.5 }}>
                                    <Typography variant="caption" sx={{ fontWeight: 800, color: 'primary.main', textTransform: 'uppercase', letterSpacing: 0.8, fontSize: 11.5 }}>
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
                                        py: 0.85,
                                        px: 1.5,
                                        borderRadius: '8px',
                                        mx: 1,
                                        my: 0.25,
                                        '&:hover': {
                                          backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(108, 99, 255, 0.1)' : 'rgba(108, 99, 255, 0.05)',
                                        },
                                      }}
                                    >
                                      <ListItemAvatar sx={{ minWidth: 46 }}>
                                        <Avatar
                                          variant="rounded"
                                          src={getOptimizedImageUrl(playlist.coverImage, 'song_thumb')}
                                          sx={{ width: 38, height: 38, borderRadius: 1.5, bgcolor: 'rgba(108, 99, 255, 0.15)', color: 'primary.main' }}
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
                                          fontSize: 11.5,
                                          noWrap: true,
                                        }}
                                      />
                                    </ListItemButton>
                                  ))}
                                </>
                              )}
                            </List>
                          )}
                        </Box>
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
          <NotificationBellButton
            onClick={handleNotiOpen}
            hasUnread={unreadCount > 0}
            unreadCount={unreadCount}
          />
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
            slotProps={{
              paper: {
                sx: {
                  bgcolor: 'transparent',
                  boxShadow: 'none',
                  overflow: 'visible',
                  mt: 1.5,
                  p: 0,
                },
              },
            }}
          >
            <NotificationPanel
              notifications={notifications}
              onMarkAsRead={handleMarkAsRead}
              onMarkAllAsRead={handleMarkAllAsRead}
              onItemClick={(noti) => {
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
              onClose={handleNotiClose}
            />
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
