import { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Alert,
  Avatar,
  Box,
  ClickAwayListener,
  CircularProgress,
  Grid,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Typography,
  Button,
  IconButton,
} from '@mui/material';
import {
  SearchRounded as SearchIcon,
  MusicNoteRounded as MusicIcon,
  PlayArrowRounded as PlayIcon,
  RefreshRounded as RefreshIcon,
  ShuffleRounded as ShuffleIcon,
  AutoAwesomeRounded as SparklesIcon,
  ChevronLeftRounded as PrevIcon,
  ChevronRightRounded as NextIcon,
  PersonAddAltRounded as FollowIcon,
  CheckRounded as CheckIcon,
} from '@mui/icons-material';
import ClientLayout from '../../components/Layout/client/ClientLayout';
import { clientSongsApi, clientTopicsApi, clientPlaylistsApi, clientArtistApi } from '../../services/api';
import { useClientPlayer } from '../../components/Layout/client/ClientPlayerProvider';
import useAppToast from '../../components/common/useAppToast';
import { scheduleIdleTask } from '../../utils/scheduleIdleTask';
import SongItem from '../../components/client/SongItem';
import PlaylistCard from '../../components/client/PlaylistCard';

const CAROUSEL_SLIDES = [
  {
    id: 'slide-vpop',
    title: 'V-Pop Mới Nhất',
    subtitle: 'Khám phá những giai điệu V-Pop thịnh hành và ngọt ngào nhất hiện nay.',
    gradient: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #ec4899 100%)',
    query: 'Việt',
    label: 'Nhạc Việt'
  },
  {
    id: 'slide-edm',
    title: 'EDM Party Club',
    subtitle: 'Năng lượng bùng nổ cùng những giai điệu nhạc điện tử căng tràn sức sống.',
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 30%, #db2777 100%)',
    topicName: 'EDM',
    query: 'EDM',
    label: 'EDM Dance'
  },
  {
    id: 'slide-lofi',
    title: 'Chill Lofi Không Gian',
    subtitle: 'Tập trung học tập và làm việc cùng những thanh âm lofi nhẹ nhàng, thư giãn.',
    gradient: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 40%, #4f46e5 100%)',
    query: 'lofi',
    label: 'Lofi Chill'
  }
];

const FEATURED_ITEMS = [
  {
    id: 'feat-lofi',
    title: 'Lofi Chill',
    description: 'Nhẹ nhàng và thư thái đầu óc',
    gradient: 'linear-gradient(135deg, #6366f1 0%, #3b82f6 100%)',
    query: 'lofi'
  },
  {
    id: 'feat-edm',
    title: 'EDM Dance',
    description: 'Năng lượng bùng nổ, bass cực căng',
    gradient: 'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)',
    topicName: 'EDM',
    query: 'EDM'
  },
  {
    id: 'feat-acoustic',
    title: 'Acoustic Cafe',
    description: 'Mộc mạc, sâu lắng đầy cảm xúc',
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #f97316 100%)',
    query: 'acoustic'
  },
  {
    id: 'feat-ballad',
    title: 'V-Pop Ballad',
    description: 'Giai điệu tự sự, tràn ngập nỗi lòng',
    gradient: 'linear-gradient(135deg, #10b981 0%, #14b8a6 100%)',
    topicName: 'Pop',
    query: 'ballad'
  }
];

const NATIONS_ITEMS = [
  {
    id: 'nation-vn',
    title: 'Nhạc Việt',
    subtitle: 'Hào hùng và đầy cảm xúc',
    gradient: 'linear-gradient(135deg, #b91c1c 0%, #ea580c 100%)',
    query: 'Việt'
  },
  {
    id: 'nation-usuk',
    title: 'Nhạc Âu Mỹ',
    subtitle: 'Thời thượng và cuốn hút',
    gradient: 'linear-gradient(135deg, #1d4ed8 0%, #6d28d9 100%)',
    query: 'US UK'
  },
  {
    id: 'nation-kpop',
    title: 'Nhạc Hàn',
    subtitle: 'K-Pop bùng nổ vũ đạo',
    gradient: 'linear-gradient(135deg, #db2777 0%, #7e22ce 100%)',
    query: 'Kpop'
  },
  {
    id: 'nation-cpop',
    title: 'Nhạc Hoa',
    subtitle: 'Giai điệu cổ trang nhẹ nhàng',
    gradient: 'linear-gradient(135deg, #b91c1c 0%, #b45309 100%)',
    query: 'Hoa'
  }
];

const MOODS_ITEMS = [
  {
    id: 'mood-study',
    title: 'Tập Trung Học Tập',
    subtitle: 'Nhạc không lời, tập trung tuyệt đối',
    gradient: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
    query: 'focus'
  },
  {
    id: 'mood-chillout',
    title: 'Chill Cuối Tuần',
    subtitle: 'Không gian thư giãn nhẹ nhàng',
    gradient: 'linear-gradient(135deg, #0f766e 0%, #0d9488 100%)',
    query: 'chill'
  },
  {
    id: 'mood-morning',
    title: 'Cà Phê Sáng',
    subtitle: 'Khởi đầu ngày mới tràn đầy cảm hứng',
    gradient: 'linear-gradient(135deg, #7c2d12 0%, #9a3412 100%)',
    query: 'cafe'
  },
  {
    id: 'mood-workout',
    title: 'Năng Lượng Gym',
    subtitle: 'Nhịp điệu bốc lửa thúc đẩy tập luyện',
    gradient: 'linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%)',
    query: 'gym'
  }
];

const TOPIC_GRADIENTS = [
  'linear-gradient(135deg, #f59e0b 0%, #ec4899 100%)',
  'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
  'linear-gradient(135deg, #6366f1 0%, #3b82f6 100%)',
  'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
  'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
];

function getTopicGradient(topicName, index) {
  const hash = (topicName || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const gradIndex = (hash + index) % TOPIC_GRADIENTS.length;
  return TOPIC_GRADIENTS[gradIndex];
}

function findMatchingDbTopic(item, topicsList) {
  if (!topicsList || topicsList.length === 0) return null;
  if (item._id) return item;

  const searchName = (item.topicName || item.title || '').toLowerCase();
  
  let match = topicsList.find(t => t.name.toLowerCase() === searchName);
  if (match) return match;
  
  match = topicsList.find(t => {
    const dbName = t.name.toLowerCase();
    return dbName.includes(searchName) || searchName.includes(dbName);
  });
  if (match) return match;

  const keywords = {
    'việt': ['việt', 'vpop', 'v-pop'],
    'lofi': ['lofi', 'chill'],
    'ballad': ['pop', 'ballad'],
    'acoustic': ['acoustic', 'cafe', 'mộc'],
    'edm': ['edm', 'dance', 'electronic', 'remix'],
    'us uk': ['us', 'uk', 'pop', 'âu mỹ'],
    'kpop': ['kpop', 'k-pop', 'hàn'],
    'hoa': ['hoa', 'cpop', 'c-pop'],
    'gym': ['gym', 'workout', 'remix', 'edm'],
    'focus': ['focus', 'lofi', 'không lời']
  };

  for (const [key, aliases] of Object.entries(keywords)) {
    if (searchName.includes(key)) {
      const aliasMatch = topicsList.find(t => {
        const dbName = t.name.toLowerCase();
        return aliases.some(alias => dbName.includes(alias));
      });
      if (aliasMatch) return aliasMatch;
    }
  }

  return null;
}



function formatFollowerCount(count) {
  if (count === undefined || count === null) return '0 quan tâm';
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1).replace(/\.0$/, '')}M quan tâm`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1).replace(/\.0$/, '')}K quan tâm`;
  }
  return `${count} quan tâm`;
}

function getSongKey(song) {
  return song?._id || song?.id || song?.title || '';
}

function shuffleSongs(sourceSongs) {
  const nextSongs = [...sourceSongs];

  for (let i = nextSongs.length - 1; i > 0; i -= 1) {
    const randomIndex = Math.floor(Math.random() * (i + 1));
    [nextSongs[i], nextSongs[randomIndex]] = [nextSongs[randomIndex], nextSongs[i]];
  }

  return nextSongs;
}

function getUniqueSongs(sourceSongs) {
  const seenKeys = new Set();

  return sourceSongs.filter((song) => {
    const key = getSongKey(song);
    if (!key || seenKeys.has(key)) return false;
    seenKeys.add(key);
    return true;
  });
}

function getNextHotSongBatch(sourceSongs, usedSongKeys, currentSongs = [], limit = 15) {
  const uniqueSongs = getUniqueSongs(sourceSongs);
  const currentKeys = new Set(currentSongs.map(getSongKey).filter(Boolean));
  let availableSongs = uniqueSongs.filter((song) => !usedSongKeys.has(getSongKey(song)));

  if (availableSongs.length === 0) {
    availableSongs = uniqueSongs.filter((song) => !currentKeys.has(getSongKey(song)));
    usedSongKeys.clear();
  }

  if (availableSongs.length === 0) {
    availableSongs = uniqueSongs;
  }

  const nextBatch = shuffleSongs(availableSongs).slice(0, limit);
  nextBatch.forEach((song) => {
    const key = getSongKey(song);
    if (key) usedSongKeys.add(key);
  });

  return nextBatch;
}

function ClientGenres() {
  const navigate = useNavigate();
  const { playSong, currentSong, isPlaying } = useClientPlayer();
  const { showToast } = useAppToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [topics, setTopics] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [defaultSongs, setDefaultSongs] = useState([]);
  const [songs, setSongs] = useState([]);
  const [hotSongs, setHotSongs] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [selectedTitle, setSelectedTitle] = useState('Gợi ý cho bạn');
  const [activeSlide, setActiveSlide] = useState(0);
  const [followedArtists, setFollowedArtists] = useState({});
  const [artistFollowersState, setArtistFollowersState] = useState({});
  const usedHotSongKeysRef = useRef(new Set());

  const loadDefault = async () => {
    try {
      setLoading(true);
      setError('');
      const [topicsRes, songsRes, playlistsRes] = await Promise.all([
        clientTopicsApi.getAll(),
        clientSongsApi.getRecommended({ limit: 12 }),
        clientPlaylistsApi.getSystem({ limit: 10 }),
      ]);

      setTopics(topicsRes.data || []);
      setPlaylists(playlistsRes.data?.playlists || []);
      const nextSongs = Array.isArray(songsRes.data) ? songsRes.data : [];
      setDefaultSongs(nextSongs);
      setSongs(nextSongs);
      setSuggestions(nextSongs.slice(0, 6));
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể tải dữ liệu thể loại.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDefault();
  }, []);

  // Auto slide for main Hero Banner
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % CAROUSEL_SLIDES.length);
    }, 5500);
    return () => clearInterval(interval);
  }, []);

  const runSearch = useCallback(async (keyword, { withLoading = false } = {}) => {
    const fontNormalized = keyword.trim();

    if (!fontNormalized) {
      setSongs(defaultSongs);
      setSuggestions(defaultSongs.slice(0, 6));
      return;
    }

    try {
      if (withLoading) setLoading(true);
      setError('');
      const response = await clientSongsApi.search({ query: fontNormalized, limit: 24 });
      const nextSongs = Array.isArray(response.data) ? response.data : [];
      setSongs(nextSongs);
      setSuggestions(nextSongs.slice(0, 6));
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi tìm kiếm bài hát.');
    } finally {
      if (withLoading) setLoading(false);
    }
  }, [defaultSongs]);

  const handleSearch = async () => {
    setSelectedTopic(null);
    setSelectedTitle(`Tìm kiếm: "${query}"`);
    
    // Remove topic from search params when searching
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('topic');
    setSearchParams(newParams);
    
    await runSearch(query, { withLoading: true });
    setShowSuggestions(false);
  };

  useEffect(() => {
    const routeQuery = searchParams.get('query') || '';
    if (routeQuery && routeQuery !== query) {
      setQuery(routeQuery);
      setSelectedTopic(null);
      setSelectedTitle(`Tìm kiếm: "${routeQuery}"`);
      runSearch(routeQuery, { withLoading: true });
    }
  }, [searchParams, defaultSongs]);

  useEffect(() => {
    const normalized = query.trim();

    if (!normalized) {
      setSongs(defaultSongs);
      setSuggestions(defaultSongs.slice(0, 6));
      setShowSuggestions(false);
      return;
    }

    setShowSuggestions(true);
    const timer = setTimeout(() => {
      runSearch(normalized);
    }, 260);

    return () => clearTimeout(timer);
  }, [query, defaultSongs, runSearch]);

  const handleSelectCategory = async (item) => {
    const itemId = item.id || item._id;
    const itemName = item.title || item.name;

    setSelectedTopic(itemId);
    setSelectedTitle(itemName);
    setQuery('');
    
    // Sync to search parameters
    const newParams = new URLSearchParams(searchParams);
    newParams.set('topic', itemId);
    newParams.delete('query');
    setSearchParams(newParams);

    // Reset window scroll to top when category changes
    window.scrollTo({ top: 0, behavior: 'smooth' });

    try {
      setLoading(true);
      setError('');
      
      const dbTopic = findMatchingDbTopic(item, topics);
      if (dbTopic) {
        const response = await clientTopicsApi.getSongsByTopic(dbTopic._id);
        setSongs(response.data || []);
      } else {
        // Strict database constraint: display empty if topic doesn't exist
        setSongs([]);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể tải bài hát cho chủ đề này.');
      setSongs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const topicId = searchParams.get('topic');
    if (topicId) {
      if (selectedTopic !== topicId) {
        // Check dynamic topics
        if (topics.length > 0) {
          const dynamicMatch = topics.find((t) => t._id === topicId);
          if (dynamicMatch) {
            handleSelectCategory(dynamicMatch);
            return;
          }
        }
        // Check curated lists
        const curatedMatch = [
          ...FEATURED_ITEMS,
          ...NATIONS_ITEMS,
          ...MOODS_ITEMS,
          ...CAROUSEL_SLIDES
        ].find((item) => item.id === topicId);
        
        if (curatedMatch) {
          handleSelectCategory(curatedMatch);
        }
      }
    } else {
      if (selectedTopic !== null) {
        setSelectedTopic(null);
        setSelectedTitle('Gợi ý cho bạn');
        setSongs(defaultSongs);
      }
    }
  }, [searchParams, topics, defaultSongs]);

  useEffect(() => {
    const initialHotSongs = getUniqueSongs(songs).slice(0, 15);
    usedHotSongKeysRef.current = new Set(initialHotSongs.map(getSongKey).filter(Boolean));
    setHotSongs(initialHotSongs);
  }, [songs]);

  const handlePlayAll = (shuffle = false) => {
    if (songs.length === 0) return;
    let queue = [...songs];
    if (shuffle) {
      queue.sort(() => Math.random() - 0.5);
    }
    playSong(queue[0], { queue });
  };

  const handleRefreshHotSongs = () => {
    setHotSongs((currentHotSongs) => getNextHotSongBatch(
      songs,
      usedHotSongKeysRef.current,
      currentHotSongs,
      15
    ));
  };

  const handleToggleFollow = async (artist) => {
    const isLoggedIn = !!localStorage.getItem('userId');
    if (!isLoggedIn) {
      showToast({
        message: 'Vui lòng đăng nhập để quan tâm nghệ sĩ.',
        severity: 'warning'
      });
      navigate('/client/home?auth=login');
      return;
    }
    
    try {
      const response = await clientArtistApi.toggleFollow(artist._id);
      if (response.data.success) {
        const { isFollowing, followers, message } = response.data;
        
        setFollowedArtists(prev => ({
          ...prev,
          [artist._id]: isFollowing
        }));
        
        setArtistFollowersState(prev => ({
          ...prev,
          [artist._id]: followers
        }));
        
        showToast({
          message: message || (isFollowing ? `Đã theo dõi ${artist.name}` : `Đã bỏ theo dõi ${artist.name}`),
          severity: 'success'
        });
      }
    } catch (err) {
      showToast({
        message: err.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại.',
        severity: 'error'
      });
    }
  };

  const slide = CAROUSEL_SLIDES[activeSlide];

  // Derive related playlists for Category Detail view
  const relatedPlaylists = useMemo(() => {
    if (!playlists.length || !selectedTopic) return [];
    const keyword = selectedTitle.toLowerCase();
    const filtered = playlists.filter(p => 
      (p.name && p.name.toLowerCase().includes(keyword)) ||
      (p.description && p.description.toLowerCase().includes(keyword))
    );
    return filtered.length > 0 ? filtered.slice(0, 5) : playlists.slice(0, 5);
  }, [playlists, selectedTitle, selectedTopic]);



  // Derive gradient color for active category banner
  const activeGradient = useMemo(() => {
    if (!selectedTopic) return '';
    const slideMatch = CAROUSEL_SLIDES.find(c => c.id === selectedTopic);
    if (slideMatch) return slideMatch.gradient;
    
    const featMatch = FEATURED_ITEMS.find(f => f.id === selectedTopic);
    if (featMatch) return featMatch.gradient;
    
    const nationMatch = NATIONS_ITEMS.find(n => n.id === selectedTopic);
    if (nationMatch) return nationMatch.gradient;

    const moodMatch = MOODS_ITEMS.find(m => m.id === selectedTopic);
    if (moodMatch) return moodMatch.gradient;
    
    const dbMatchIndex = topics.findIndex(t => t._id === selectedTopic);
    if (dbMatchIndex !== -1) return getTopicGradient(selectedTitle, dbMatchIndex);

    return 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)';
  }, [selectedTopic, selectedTitle, topics]);

  const relatedArtists = useMemo(() => {
    if (!songs.length) return [];
    const artistMap = {};
    songs.forEach(song => {
      if (Array.isArray(song.artists)) {
        song.artists.forEach(artist => {
          if (artist && artist._id && !artistMap[artist._id]) {
            artistMap[artist._id] = {
              _id: artist._id,
              name: artist.name || 'Unknown artist',
              avatar: artist.avatar || '',
              followers: artist.followersCount || artist.followers || 0,
            };
          }
        });
      }
    });
    return Object.values(artistMap).slice(0, 5);
  }, [songs]);

  // Set followers count directly from pre-populated song artist data
  useEffect(() => {
    if (!relatedArtists.length) return;
    const followerMap = {};
    relatedArtists.forEach(artist => {
      followerMap[artist._id] = artist.followers || 0;
    });
    setArtistFollowersState(prev => ({ ...prev, ...followerMap }));
  }, [relatedArtists]);

  // Batch query follow statuses in one single network request
  useEffect(() => {
    let cancelled = false;

    const fetchFollowStatuses = async () => {
      if (!relatedArtists.length) return;
      const isLoggedIn = !!localStorage.getItem('userId');
      if (!isLoggedIn) {
        const followMap = {};
        relatedArtists.forEach(artist => {
          followMap[artist._id] = false;
        });
        setFollowedArtists(followMap);
        return;
      }

      try {
        const artistIds = relatedArtists.map(artist => artist._id);
        const response = await clientArtistApi.getBatchFollowStatus(artistIds);
        if (response.data.success && response.data.followStatusMap && !cancelled) {
          setFollowedArtists(response.data.followStatusMap);
        }
      } catch (err) {
        console.error("Error fetching batch follow status:", err);
      }
    };

    const cancelIdleTask = scheduleIdleTask(fetchFollowStatuses);
    return () => {
      cancelled = true;
      cancelIdleTask();
    };
  }, [relatedArtists]);



  return (
    <ClientLayout title="Chủ đề & Thể loại">
      {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 3 }}>{error}</Alert>}

      {selectedTopic === null ? (
        /* ━━━━━━━━━━━━━━━━━━━━━━━━ CATALOG MAIN HUB ━━━━━━━━━━━━━━━━━━━━━━━━ */
        <Stack spacing={5.5}>
          {/* Header & Search */}
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2.5} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }}>
            <Box>
              <Typography variant="h4" fontWeight={950} sx={{ letterSpacing: '-0.7px', display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <SparklesIcon sx={{ color: '#14b8a6', fontSize: 32 }} />
                Chủ Đề & Thể Loại
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Khám phá thế giới âm nhạc được phân loại theo từng tâm trạng, quốc gia và thể loại.
              </Typography>
            </Box>

            <ClickAwayListener onClickAway={() => setShowSuggestions(false)}>
              <Box sx={{ position: 'relative', width: { xs: '100%', md: 360 } }}>
                <TextField
                  size="small"
                  value={query}
                  onFocus={() => {
                    if (query.trim() && suggestions.length) setShowSuggestions(true);
                  }}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      handleSearch();
                    }
                  }}
                  placeholder="Tìm bài hát, ca sĩ..."
                  fullWidth
                  InputProps={{
                    startAdornment: <SearchIcon sx={{ color: 'text.secondary', mr: 0.75, fontSize: 20 }} />,
                    sx: {
                      borderRadius: 3.5,
                      bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(31, 41, 55, 0.4)' : 'rgba(255, 255, 255, 0.76)',
                      border: '1px solid',
                      borderColor: 'divider',
                      transition: 'all 0.25s',
                      '&:hover': {
                        borderColor: '#14b8a6',
                      },
                      '&.Mui-focused': {
                        borderColor: '#14b8a6',
                        boxShadow: '0 0 12px rgba(20,184,166,0.18)',
                      }
                    }
                  }}
                />
                {showSuggestions && suggestions.length > 0 && (
                  <Paper
                    sx={{
                      position: 'absolute',
                      top: 'calc(100% + 8px)',
                      left: 0,
                      right: 0,
                      zIndex: 10,
                      borderRadius: 3.5,
                      border: '1px solid',
                      borderColor: 'divider',
                      bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(17, 24, 39, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                      backdropFilter: 'blur(16px)',
                      maxHeight: 280,
                      overflowY: 'auto',
                      boxShadow: '0 12px 36px rgba(0,0,0,0.12)',
                    }}
                  >
                    <List dense disablePadding>
                      {suggestions.map((song) => (
                        <ListItemButton
                          key={song._id}
                          onClick={() => {
                            setQuery(song.title || '');
                            setShowSuggestions(false);
                            playSong(song, { queue: suggestions });
                          }}
                          sx={{ py: 1.25, px: 2 }}
                        >
                          <Avatar
                            src={song.imageUrl || undefined}
                            variant="rounded"
                            sx={{
                              width: 32,
                              height: 32,
                              mr: 1.5,
                              bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(20, 184, 166, 0.08)' : 'rgba(20, 184, 166, 0.04)',
                              color: '#14b8a6',
                            }}
                          >
                            <MusicIcon sx={{ fontSize: 18 }} />
                          </Avatar>
                          <ListItemText
                            primary={song.title || 'Unknown song'}
                            secondary={Array.isArray(song.artists)
                              ? song.artists.map((artist) => artist?.name).filter(Boolean).join(', ')
                              : 'Nghệ sĩ ẩn danh'}
                            primaryTypographyProps={{ noWrap: true, fontWeight: 700, fontSize: 13 }}
                            secondaryTypographyProps={{ noWrap: true, fontSize: 11 }}
                          />
                        </ListItemButton>
                      ))}
                    </List>
                  </Paper>
                )}
              </Box>
            </ClickAwayListener>
          </Stack>

          {/* Hero Carousel */}
          <Box
            sx={{
              p: { xs: 4, md: 6 },
              height: { xs: 260, md: 320 },
              borderRadius: 5,
              position: 'relative',
              overflow: 'hidden',
              background: slide.gradient,
              color: '#fff',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              transition: 'background 0.5s ease-in-out',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.15)',
              cursor: 'pointer',
              '&:hover': {
                transform: 'scale(1.005)',
              }
            }}
            onClick={() => handleSelectCategory(slide)}
          >
            <Box
              sx={{
                position: 'absolute',
                top: '-15%',
                right: '-15%',
                width: 320,
                height: 320,
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.08)',
                filter: 'blur(40px)',
              }}
            />
            <Box
              sx={{
                position: 'absolute',
                bottom: '-25%',
                left: '12%',
                width: 260,
                height: 260,
                borderRadius: '50%',
                background: 'rgba(0, 0, 0, 0.06)',
                filter: 'blur(50px)',
              }}
            />

            <Stack spacing={2} sx={{ maxWidth: { xs: '100%', md: '65%' }, position: 'relative', zIndex: 2 }}>
              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, px: 1.5, py: 0.5, borderRadius: 10, bgcolor: 'rgba(255, 255, 255, 0.15)', backdropFilter: 'blur(10px)', width: 'fit-content' }}>
                <SparklesIcon sx={{ fontSize: 16, color: '#f59e0b' }} />
                <Typography variant="caption" sx={{ fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1 }}>
                  Nổi Bật
                </Typography>
              </Box>

              <Typography variant="h3" sx={{ fontWeight: 950, letterSpacing: '-1.5px', textShadow: '0 4px 10px rgba(0,0,0,0.2)' }}>
                {slide.title}
              </Typography>
              
              <Typography variant="body1" sx={{ opacity: 0.9, fontWeight: 500, textShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
                {slide.subtitle}
              </Typography>

              <Button
                variant="contained"
                startIcon={<PlayIcon />}
                sx={{
                  width: 'fit-content',
                  bgcolor: '#fff',
                  color: '#000',
                  fontWeight: 900,
                  borderRadius: 10,
                  px: 4,
                  py: 1.25,
                  textTransform: 'none',
                  boxShadow: '0 4px 15px rgba(255,255,255,0.3)',
                  '&:hover': {
                    bgcolor: 'rgba(255, 255, 255, 0.9)',
                  }
                }}
              >
                Nghe ngay
              </Button>
            </Stack>

            {/* Slider arrows */}
            <IconButton
              onClick={(e) => {
                e.stopPropagation();
                setActiveSlide((prev) => (prev - 1 + CAROUSEL_SLIDES.length) % CAROUSEL_SLIDES.length);
              }}
              sx={{
                position: 'absolute',
                left: 20,
                top: '50%',
                transform: 'translateY(-50%)',
                bgcolor: 'rgba(255, 255, 255, 0.15)',
                color: '#fff',
                zIndex: 3,
                '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.3)' },
              }}
            >
              <PrevIcon />
            </IconButton>

            <IconButton
              onClick={(e) => {
                e.stopPropagation();
                setActiveSlide((prev) => (prev + 1) % CAROUSEL_SLIDES.length);
              }}
              sx={{
                position: 'absolute',
                right: 20,
                top: '50%',
                transform: 'translateY(-50%)',
                bgcolor: 'rgba(255, 255, 255, 0.15)',
                color: '#fff',
                zIndex: 3,
                '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.3)' },
              }}
            >
              <NextIcon />
            </IconButton>

            {/* Dots */}
            <Stack direction="row" spacing={1} sx={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 3 }}>
              {CAROUSEL_SLIDES.map((_, idx) => (
                <Box
                  key={idx}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveSlide(idx);
                  }}
                  sx={{
                    width: idx === activeSlide ? 24 : 8,
                    height: 8,
                    borderRadius: 10,
                    bgcolor: idx === activeSlide ? '#fff' : 'rgba(255,255,255,0.4)',
                    transition: 'all 0.3s ease',
                    cursor: 'pointer',
                  }}
                />
              ))}
            </Stack>
          </Box>

          {/* Featured */}
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 900, mb: 3, letterSpacing: '-0.3px' }}>
              Nổi Bật
            </Typography>

            <Grid container spacing={3}>
              {FEATURED_ITEMS.map((item) => {
                const active = selectedTopic === item.id;
                return (
                  <Grid size={{ xs: 12, sm: 6, md: 3 }} key={item.id}>
                    <Paper
                      elevation={0}
                      onClick={() => handleSelectCategory(item)}
                      sx={{
                        p: 3,
                        height: 160,
                        borderRadius: 4.5,
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        position: 'relative',
                        overflow: 'hidden',
                        background: item.gradient,
                        color: '#fff',
                        border: '2px solid',
                        borderColor: active ? '#14b8a6' : 'transparent',
                        boxShadow: active ? '0 8px 24px rgba(20,184,166,0.35)' : '0 4px 15px rgba(0,0,0,0.06)',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        '&::before': {
                          content: '""',
                          position: 'absolute',
                          inset: 0,
                          background: 'rgba(0,0,0,0.1)',
                        },
                        '&:hover': {
                          transform: 'translateY(-6px)',
                          boxShadow: '0 12px 28px rgba(0,0,0,0.18)',
                          filter: 'saturate(1.15)',
                        },
                      }}
                    >
                      <Box sx={{ position: 'relative', zIndex: 1 }}>
                        <Typography variant="h5" fontWeight={900} sx={{ textShadow: '0 2px 4px rgba(0,0,0,0.2)', fontSize: '1.35rem' }}>
                          {item.title}
                        </Typography>
                        <Typography variant="body2" sx={{ opacity: 0.85, mt: 0.5, fontWeight: 500 }}>
                          {item.description}
                        </Typography>
                      </Box>
                      
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ position: 'relative', zIndex: 1 }}>
                        <Typography variant="caption" sx={{ opacity: 0.82, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Khám phá
                        </Typography>
                        <IconButton sx={{ p: 0, color: '#fff', bgcolor: 'rgba(255,255,255,0.2)', '&:hover': { bgcolor: 'rgba(255,255,255,0.4)' } }}>
                          <PlayIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Stack>
                    </Paper>
                  </Grid>
                );
              })}
            </Grid>
          </Box>

          {/* Nations */}
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 900, mb: 3, letterSpacing: '-0.3px' }}>
              Quốc Gia
            </Typography>

            <Grid container spacing={3}>
              {NATIONS_ITEMS.map((item) => {
                const active = selectedTopic === item.id;
                return (
                  <Grid size={{ xs: 6, sm: 3 }} key={item.id}>
                    <Paper
                      elevation={0}
                      onClick={() => handleSelectCategory(item)}
                      sx={{
                        p: 2.5,
                        height: 110,
                        borderRadius: 4,
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        textAlign: 'center',
                        position: 'relative',
                        overflow: 'hidden',
                        background: item.gradient,
                        color: '#fff',
                        border: '2px solid',
                        borderColor: active ? '#14b8a6' : 'transparent',
                        boxShadow: active ? '0 8px 24px rgba(20,184,166,0.3)' : '0 4px 12px rgba(0,0,0,0.05)',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        '&::before': {
                          content: '""',
                          position: 'absolute',
                          inset: 0,
                          background: 'rgba(0,0,0,0.15)',
                        },
                        '&:hover': {
                          transform: 'translateY(-6px)',
                          boxShadow: '0 10px 24px rgba(0,0,0,0.15)',
                          filter: 'saturate(1.15)',
                        },
                      }}
                    >
                      <Stack spacing={0.5} sx={{ position: 'relative', zIndex: 1 }}>
                        <Typography variant="h6" fontWeight={900} sx={{ textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
                          {item.title}
                        </Typography>
                        <Typography variant="caption" sx={{ opacity: 0.85, fontWeight: 600 }}>
                          {item.subtitle}
                        </Typography>
                      </Stack>
                    </Paper>
                  </Grid>
                );
              })}
            </Grid>
          </Box>

          {/* Moods */}
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 900, mb: 3, letterSpacing: '-0.3px' }}>
              Tâm Trạng Và Hoạt Động
            </Typography>

            <Grid container spacing={3}>
              {MOODS_ITEMS.map((item) => {
                const active = selectedTopic === item.id;
                return (
                  <Grid size={{ xs: 12, sm: 6, md: 3 }} key={item.id}>
                    <Paper
                      elevation={0}
                      onClick={() => handleSelectCategory(item)}
                      sx={{
                        p: 2.5,
                        height: 130,
                        borderRadius: 4,
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        position: 'relative',
                        overflow: 'hidden',
                        background: item.gradient,
                        color: '#fff',
                        border: '2px solid',
                        borderColor: active ? '#14b8a6' : 'transparent',
                        boxShadow: active ? '0 8px 24px rgba(20,184,166,0.3)' : '0 4px 12px rgba(0,0,0,0.05)',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        '&::before': {
                          content: '""',
                          position: 'absolute',
                          inset: 0,
                          background: 'rgba(0,0,0,0.12)',
                        },
                        '&:hover': {
                          transform: 'translateY(-6px)',
                          boxShadow: '0 10px 24px rgba(0,0,0,0.15)',
                          filter: 'saturate(1.15)',
                        },
                      }}
                    >
                      <Box sx={{ position: 'relative', zIndex: 1 }}>
                        <Typography variant="subtitle1" fontWeight={900} sx={{ textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
                          {item.title}
                        </Typography>
                        <Typography variant="caption" sx={{ opacity: 0.85, display: 'block', mt: 0.5 }}>
                          {item.subtitle}
                        </Typography>
                      </Box>
                      
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ position: 'relative', zIndex: 1 }}>
                        <Typography variant="caption" sx={{ opacity: 0.8, fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Bắt đầu nghe
                        </Typography>
                      </Stack>
                    </Paper>
                  </Grid>
                );
              })}
            </Grid>
          </Box>

          {/* Dynamic Topics */}
          {topics.length > 0 && (
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 900, mb: 3, letterSpacing: '-0.3px' }}>
                Thể Loại Chi Tiết
              </Typography>

              <Grid container spacing={3}>
                {topics.map((topic, index) => {
                  const active = selectedTopic === topic._id;
                  const gradient = getTopicGradient(topic.name, index);
                  return (
                    <Grid size={{ xs: 6, sm: 4, md: 3, lg: 2.4 }} key={topic._id}>
                      <Paper
                        elevation={0}
                        onClick={() => handleSelectCategory(topic)}
                        sx={{
                          p: 3,
                          height: 115,
                          borderRadius: 4,
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          position: 'relative',
                          overflow: 'hidden',
                          background: gradient,
                          color: '#fff',
                          border: '2px solid',
                          borderColor: active ? '#14b8a6' : 'transparent',
                          boxShadow: active ? '0 8px 24px rgba(20,184,166,0.3)' : '0 4px 12px rgba(0,0,0,0.05)',
                          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                          '&::before': {
                            content: '""',
                            position: 'absolute',
                            inset: 0,
                            background: 'rgba(0,0,0,0.08)',
                          },
                          '&:hover': {
                            transform: 'translateY(-6px)',
                            boxShadow: '0 12px 28px rgba(0,0,0,0.18)',
                            filter: 'saturate(1.15)',
                          },
                        }}
                      >
                        <Box sx={{ position: 'relative', zIndex: 1 }}>
                          <Typography variant="body1" fontWeight={900} sx={{ textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
                            {topic.name}
                          </Typography>
                        </Box>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ position: 'relative', zIndex: 1 }}>
                          <Typography variant="caption" sx={{ opacity: 0.82, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Khám phá
                          </Typography>
                        </Stack>
                      </Paper>
                    </Grid>
                  );
                })}
              </Grid>
            </Box>
          )}
        </Stack>
      ) : (
        /* ━━━━━━━━━━━━━━━━━━━━━━━━ CATEGORY DETAIL VIEW (ZingMP3 Restructured) ━━━━━━━━━━━━━━━━━━━━━━━━ */
        <Box>
          {/* Back button */}
          <Button
            onClick={() => {
              setSelectedTopic(null);
              const newParams = new URLSearchParams(searchParams);
              newParams.delete('topic');
              setSearchParams(newParams);
            }}
            startIcon={<PrevIcon />}
            sx={{
              color: 'text.secondary',
              fontWeight: 800,
              textTransform: 'none',
              mb: 3,
              '&:hover': {
                color: '#14b8a6',
              }
            }}
          >
            Quay lại Thể loại
          </Button>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}>
              <CircularProgress size={44} sx={{ color: '#14b8a6' }} />
            </Box>
          ) : (
            <>
              {/* Visual Header Banner */}
              <Paper
            elevation={0}
            sx={{
              p: { xs: 4, md: 5 },
              borderRadius: 5,
              position: 'relative',
              overflow: 'hidden',
              background: activeGradient,
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.12)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
              mb: 6,
            }}
          >
            <Box
              sx={{
                position: 'absolute',
                top: '-20%',
                right: '-10%',
                width: 280,
                height: 280,
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.1)',
                filter: 'blur(30px)',
              }}
            />
            <Box
              sx={{
                position: 'absolute',
                bottom: '-30%',
                left: '20%',
                width: 200,
                height: 200,
                borderRadius: '50%',
                background: 'rgba(0, 0, 0, 0.1)',
                filter: 'blur(40px)',
              }}
            />

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={4} alignItems={{ xs: 'flex-start', md: 'center' }} sx={{ position: 'relative', zIndex: 2 }}>
              <Avatar
                sx={{
                  width: { xs: 80, md: 100 },
                  height: { xs: 80, md: 100 },
                  bgcolor: 'rgba(255, 255, 255, 0.2)',
                  backdropFilter: 'blur(10px)',
                  border: '2px solid rgba(255, 255, 255, 0.4)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                  fontSize: { xs: 36, md: 44 },
                  fontWeight: 900,
                  color: '#fff',
                }}
              >
                {selectedTitle.charAt(0).toUpperCase()}
              </Avatar>

              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="h3" sx={{ fontWeight: 950, letterSpacing: '-1.5px', textShadow: '0 4px 10px rgba(0,0,0,0.2)' }}>
                  {selectedTitle}
                </Typography>
                <Typography variant="body1" sx={{ opacity: 0.9, mt: 1, maxWidth: 600, fontWeight: 500 }}>
                  Thưởng thức những tác phẩm âm nhạc tuyển chọn xuất sắc thuộc chủ đề {selectedTitle}. Hãy sẵn sàng hòa mình vào thế giới âm thanh đầy lôi cuốn.
                </Typography>
                
                {songs.length > 0 && (
                  <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
                    <Button
                      variant="contained"
                      startIcon={<PlayIcon />}
                      onClick={() => handlePlayAll(false)}
                      sx={{
                        bgcolor: '#fff',
                        color: '#000',
                        fontWeight: 900,
                        borderRadius: 3.5,
                        px: 3.5,
                        py: 1,
                        textTransform: 'none',
                        boxShadow: '0 4px 15px rgba(255,255,255,0.25)',
                        '&:hover': {
                          bgcolor: 'rgba(255, 255, 255, 0.9)',
                        }
                      }}
                    >
                      Phát tất cả
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<ShuffleIcon />}
                      onClick={() => handlePlayAll(true)}
                      sx={{
                        borderColor: 'rgba(255, 255, 255, 0.4)',
                        color: '#fff',
                        fontWeight: 900,
                        borderRadius: 3.5,
                        px: 3.5,
                        py: 1,
                        textTransform: 'none',
                        backdropFilter: 'blur(10px)',
                        bgcolor: 'rgba(255, 255, 255, 0.08)',
                        '&:hover': {
                          borderColor: '#fff',
                          bgcolor: 'rgba(255, 255, 255, 0.15)',
                        }
                      }}
                    >
                      Trộn bài
                    </Button>
                  </Stack>
                )}
              </Box>
            </Stack>
          </Paper>

          {songs.length === 0 ? (
            <Paper variant="outlined" sx={{ p: 8, textAlign: 'center', borderRadius: 5, borderStyle: 'dashed', borderColor: 'divider', bgcolor: 'rgba(255,255,255,0.01)', mt: 4 }}>
              <Typography variant="h6" fontWeight={700} color="text.secondary" sx={{ mb: 1 }}>
                Chủ đề này chưa có bài hát nào
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Hiện tại chưa có bài hát nào thuộc chủ đề này trong cơ sở dữ liệu. Vui lòng quay lại sau!
              </Typography>
            </Paper>
          ) : (
            <Stack spacing={7}>
              {/* ──────── SECTION 1: HOT SONGS (3 Columns Grid) ──────── */}
              <Box>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3, gap: 2 }}>
                  <Typography variant="h5" sx={{ fontWeight: 900, letterSpacing: '-0.3px' }}>
                    Hot Songs
                  </Typography>
                  <Button
                    variant="outlined"
                    startIcon={<RefreshIcon />}
                    onClick={handleRefreshHotSongs}
                    disabled={songs.length <= 1}
                    sx={{
                      color: '#14b8a6',
                      borderColor: 'rgba(20, 184, 166, 0.25)',
                      borderRadius: 2,
                      textTransform: 'none',
                      fontWeight: 800,
                      px: 2,
                      flexShrink: 0,
                      '&:hover': {
                        borderColor: '#14b8a6',
                        bgcolor: 'rgba(20, 184, 166, 0.05)',
                      },
                    }}
                  >
                    Đổi bài hát
                  </Button>
                </Stack>
                
                <Grid container spacing={2.5}>
                  {hotSongs.map((song) => (
                    <Grid size={{ xs: 12, sm: 6, md: 4 }} key={song._id}>
                      <SongItem
                        song={song}
                        showDuration={true}
                        isCurrent={currentSong?._id === song._id}
                        isPlaying={currentSong?._id === song._id && isPlaying}
                        onPlay={() => playSong(song, { queue: hotSongs })}
                      />
                    </Grid>
                  ))}
                </Grid>
              </Box>

              {/* ──────── SECTION 2: PLAYLIST / ALBUM GỢI Ý (5 Columns Grid) ──────── */}
              {relatedPlaylists.length > 0 && (
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 900, mb: 3, letterSpacing: '-0.3px' }}>
                    Playlist / Album gợi ý
                  </Typography>
                  
                  <Grid container spacing={2.5}>
                    {relatedPlaylists.slice(0, 5).map((playlist) => (
                      <Grid size={{ xs: 6, sm: 4, md: 2.4 }} key={playlist._id}>
                        <PlaylistCard
                          playlist={playlist}
                          onClick={() => navigate(`/client/playlists/${playlist._id}`)}
                        />
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              )}

            {/* ──────── SECTION 3: NGHỆ SĨ (5 Columns Circular Profile Grid) ──────── */}
            {relatedArtists.length > 0 && (
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 900, mb: 3, letterSpacing: '-0.3px' }}>
                  Nghệ Sĩ
                </Typography>
                
                <Grid container spacing={3}>
                  {relatedArtists.map((artist) => {
                    const isFollowed = followedArtists[artist._id] || false;
                    return (
                      <Grid size={{ xs: 6, sm: 4, md: 2.4 }} key={artist._id} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <Avatar
                          src={artist.imageUrl || artist.avatar}
                          sx={{
                            width: 130,
                            height: 130,
                            mb: 2,
                            boxShadow: '0 6px 18px rgba(0,0,0,0.1)',
                            cursor: 'pointer',
                            transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            '&:hover': {
                              transform: 'scale(1.08)',
                            }
                          }}
                          onClick={() => navigate(`/client/artists/${artist._id}`)}
                        />
                        <Typography
                          variant="subtitle1"
                          fontWeight={850}
                          noWrap
                          sx={{
                            maxWidth: 160,
                            textAlign: 'center',
                            cursor: 'pointer',
                            '&:hover': { color: '#14b8a6' }
                          }}
                          onClick={() => navigate(`/client/artists/${artist._id}`)}
                        >
                          {artist.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, fontWeight: 600 }}>
                          {formatFollowerCount(artistFollowersState[artist._id] || 0)}
                        </Typography>
                        <Button
                          variant="outlined"
                          onClick={() => handleToggleFollow(artist)}
                          startIcon={isFollowed ? <CheckIcon sx={{ fontSize: 16 }} /> : <FollowIcon sx={{ fontSize: 16 }} />}
                          sx={{
                            mt: 2,
                            borderRadius: 10,
                            px: 3,
                            py: 0.5,
                            fontSize: '11px',
                            fontWeight: 900,
                            textTransform: 'uppercase',
                            letterSpacing: '0.8px',
                            borderColor: isFollowed ? '#14b8a6' : 'rgba(255, 255, 255, 0.25)',
                            color: isFollowed ? '#14b8a6' : 'text.primary',
                            bgcolor: isFollowed ? 'rgba(20, 184, 166, 0.08)' : 'transparent',
                            transition: 'all 0.25s',
                            '&:hover': {
                              borderColor: '#14b8a6',
                              bgcolor: 'rgba(20, 184, 166, 0.12)',
                              color: '#14b8a6',
                            }
                          }}
                        >
                          {isFollowed ? 'ĐÃ QUAN TÂM' : 'QUAN TÂM'}
                        </Button>
                      </Grid>
                    );
                  })}
                </Grid>
              </Box>
            )}
          </Stack>
        )}
      </>
    )}
  </Box>
)}
    </ClientLayout>
  );
}

export default ClientGenres;
