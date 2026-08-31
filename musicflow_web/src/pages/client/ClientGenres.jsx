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
  Chip,
} from '@mui/material';
import {
  SearchRounded as SearchIcon,
  MusicNoteRounded as MusicIcon,
  PlayArrowRounded as PlayIcon,
  RefreshRounded as RefreshIcon,
  ShuffleRounded as ShuffleIcon,
  AutoAwesomeRounded as SparklesIcon,
  PersonAddAltRounded as FollowIcon,
  CheckRounded as CheckIcon,
  ChevronLeftRounded as BackIcon,
  ExploreRounded as ExploreIcon,
  WavesRounded as WavesIcon,
  BoltRounded as BoltIcon,
  LocalFireDepartmentRounded as FireIcon,
  PublicRounded as GlobeIcon,
  LibraryMusicRounded as LibraryMusicIcon,
  RadioRounded as RadioIcon,
} from '@mui/icons-material';
import ClientLayout from '../../components/Layout/client/ClientLayout';
import { clientSongsApi, clientTopicsApi, clientPlaylistsApi, clientArtistApi } from '../../services/client/client.service';
import { useClientPlayer } from '../../components/Layout/client/ClientPlayerProvider';
import useAppToast from '../../components/common/useAppToast';
import { scheduleIdleTask } from '../../utils/scheduleIdleTask';
import ClientSongItem from '../../components/Layout/client/ClientSongItem';
import ClientPlaylistCard from '../../components/Layout/client/ClientPlaylistCard';

const CAROUSEL_SLIDES = [
  {
    id: 'slide-vpop',
    title: 'V-Pop Điểm Hẹn',
    subtitle: 'Khám phá những giai điệu V-Pop thịnh hành và ngọt ngào nhất hiện nay.',
    image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1400&auto=format&fit=crop&q=80',
    gradient: 'linear-gradient(135deg, rgba(236, 72, 153, 0.85) 0%, rgba(139, 92, 246, 0.85) 50%, rgba(99, 102, 241, 0.85) 100%)',
    query: 'Việt',
    label: 'V-Pop',
    icon: '🇻🇳',
  },
  {
    id: 'slide-edm',
    title: 'EDM Không Gian & Bass Boost',
    subtitle: 'Năng lượng bùng nổ cùng những giai điệu nhạc điện tử căng tràn sức sống vũ trụ.',
    image: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1400&auto=format&fit=crop&q=80',
    gradient: 'linear-gradient(135deg, rgba(245, 158, 11, 0.85) 0%, rgba(239, 68, 68, 0.85) 50%, rgba(168, 85, 247, 0.85) 100%)',
    topicName: 'EDM',
    query: 'EDM',
    label: 'EDM Dance',
    icon: '⚡',
  },
  {
    id: 'slide-lofi',
    title: 'Cosmic Chill Lofi Station',
    subtitle: 'Tập trung học tập và làm việc cùng những thanh âm lofi nhẹ nhàng, thư giãn đầu óc.',
    image: 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=1400&auto=format&fit=crop&q=80',
    gradient: 'linear-gradient(135deg, rgba(6, 182, 212, 0.85) 0%, rgba(59, 130, 246, 0.85) 50%, rgba(99, 102, 241, 0.85) 100%)',
    query: 'lofi',
    label: 'Lofi Chill',
    icon: '☕',
  }
];

const FEATURED_ITEMS = [
  {
    id: 'feat-lofi',
    title: 'Lofi Chill',
    description: 'Nhẹ nhàng và thư thái đầu óc',
    image: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=600&auto=format&fit=crop&q=80',
    gradient: 'linear-gradient(180deg, rgba(6, 182, 212, 0.35) 0%, rgba(10, 15, 30, 0.95) 100%)',
    query: 'lofi',
    icon: <WavesIcon sx={{ fontSize: 28 }} />,
    color: '#06b6d4',
  },
  {
    id: 'feat-edm',
    title: 'EDM Dance',
    description: 'Năng lượng bùng nổ, bass cực căng',
    image: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=600&auto=format&fit=crop&q=80',
    gradient: 'linear-gradient(180deg, rgba(236, 72, 153, 0.35) 0%, rgba(10, 15, 30, 0.95) 100%)',
    topicName: 'EDM',
    query: 'EDM',
    icon: <BoltIcon sx={{ fontSize: 28 }} />,
    color: '#ec4899',
  },
  {
    id: 'feat-acoustic',
    title: 'Acoustic Cafe',
    description: 'Mộc mạc, sâu lắng đầy cảm xúc',
    image: 'https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=600&auto=format&fit=crop&q=80',
    gradient: 'linear-gradient(180deg, rgba(245, 158, 11, 0.35) 0%, rgba(10, 15, 30, 0.95) 100%)',
    query: 'acoustic',
    icon: <SparklesIcon sx={{ fontSize: 28 }} />,
    color: '#f59e0b',
  },
  {
    id: 'feat-ballad',
    title: 'V-Pop Ballad',
    description: 'Giai điệu tự sự, tràn ngập nỗi lòng',
    image: 'https://images.unsplash.com/photo-1520523839898-507128054a01?w=600&auto=format&fit=crop&q=80',
    gradient: 'linear-gradient(180deg, rgba(16, 185, 129, 0.35) 0%, rgba(10, 15, 30, 0.95) 100%)',
    topicName: 'Pop',
    query: 'ballad',
    icon: <MusicIcon sx={{ fontSize: 28 }} />,
    color: '#10b981',
  }
];

const NATIONS_ITEMS = [
  {
    id: 'nation-vn',
    title: 'Nhạc Việt Nam',
    subtitle: 'Giai điệu thân thương & cảm xúc',
    image: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600&auto=format&fit=crop&q=80',
    gradient: 'linear-gradient(180deg, rgba(220, 38, 38, 0.35) 0%, rgba(10, 15, 30, 0.95) 100%)',
    query: 'Việt',
    flag: '🇻🇳',
  },
  {
    id: 'nation-usuk',
    title: 'Nhạc Âu Mỹ (US-UK)',
    subtitle: 'Xu hướng Billboard toàn cầu',
    image: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=600&auto=format&fit=crop&q=80',
    gradient: 'linear-gradient(180deg, rgba(37, 99, 235, 0.35) 0%, rgba(10, 15, 30, 0.95) 100%)',
    query: 'US UK',
    flag: '🇺🇸',
  },
  {
    id: 'nation-kpop',
    title: 'Nhạc Hàn (K-Pop)',
    subtitle: 'Vũ đạo & giai điệu bùng nổ',
    image: 'https://images.unsplash.com/photo-1538485399081-7191377e8241?w=600&auto=format&fit=crop&q=80',
    gradient: 'linear-gradient(180deg, rgba(219, 39, 119, 0.35) 0%, rgba(10, 15, 30, 0.95) 100%)',
    query: 'Kpop',
    flag: '🇰🇷',
  },
  {
    id: 'nation-cpop',
    title: 'Nhạc Hoa (C-Pop)',
    subtitle: 'Cổ phong & ngọt ngào sâu lắng',
    image: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80',
    gradient: 'linear-gradient(180deg, rgba(185, 28, 28, 0.35) 0%, rgba(10, 15, 30, 0.95) 100%)',
    query: 'Hoa',
    flag: '🇨🇳',
  }
];

const MOODS_ITEMS = [
  {
    id: 'mood-study',
    title: 'Tập Trung Sâu',
    subtitle: 'Không lời, tối đa hóa hiệu suất',
    image: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=600&auto=format&fit=crop&q=80',
    gradient: 'linear-gradient(180deg, rgba(30, 58, 138, 0.35) 0%, rgba(10, 15, 30, 0.95) 100%)',
    query: 'focus',
    icon: '🎯',
  },
  {
    id: 'mood-chillout',
    title: 'Chill Thư Giãn',
    subtitle: 'Không gian thả lỏng tuyệt đối',
    image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&auto=format&fit=crop&q=80',
    gradient: 'linear-gradient(180deg, rgba(13, 148, 136, 0.35) 0%, rgba(10, 15, 30, 0.95) 100%)',
    query: 'chill',
    icon: '🍃',
  },
  {
    id: 'mood-morning',
    title: 'Cà Phê Sáng',
    subtitle: 'Cảm hứng ngập tràn ngày mới',
    image: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600&auto=format&fit=crop&q=80',
    gradient: 'linear-gradient(180deg, rgba(180, 83, 9, 0.35) 0%, rgba(10, 15, 30, 0.95) 100%)',
    query: 'cafe',
    icon: '☕',
  },
  {
    id: 'mood-workout',
    title: 'Năng Lượng Gym',
    subtitle: 'Beat bốc lửa đốt cháy calo',
    image: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&auto=format&fit=crop&q=80',
    gradient: 'linear-gradient(180deg, rgba(190, 18, 60, 0.35) 0%, rgba(10, 15, 30, 0.95) 100%)',
    query: 'gym',
    icon: '🔥',
  }
];

const TOPIC_IMAGES = [
  'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=500&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=500&auto=format&fit=crop&q=80',
];

const TOPIC_GRADIENTS = [
  'linear-gradient(180deg, rgba(245, 158, 11, 0.4) 0%, rgba(10, 15, 30, 0.95) 100%)',
  'linear-gradient(180deg, rgba(16, 185, 129, 0.4) 0%, rgba(10, 15, 30, 0.95) 100%)',
  'linear-gradient(180deg, rgba(99, 102, 241, 0.4) 0%, rgba(10, 15, 30, 0.95) 100%)',
  'linear-gradient(180deg, rgba(139, 92, 246, 0.4) 0%, rgba(10, 15, 30, 0.95) 100%)',
  'linear-gradient(180deg, rgba(59, 130, 246, 0.4) 0%, rgba(10, 15, 30, 0.95) 100%)',
  'linear-gradient(180deg, rgba(236, 72, 153, 0.4) 0%, rgba(10, 15, 30, 0.95) 100%)',
];

function getTopicImage(topicName, index) {
  const hash = (topicName || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return TOPIC_IMAGES[(hash + index) % TOPIC_IMAGES.length];
}

function getTopicGradient(topicName, index) {
  const hash = (topicName || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const gradIndex = (hash + index) % TOPIC_GRADIENTS.length;
  return TOPIC_GRADIENTS[gradIndex];
}

function toSlug(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function findMatchingDbTopic(item, topicsList) {
  if (!topicsList || topicsList.length === 0) return null;
  if (item._id) return item;

  const rawName = item.topicName || item.name || item.title || '';
  const searchName = rawName.toLowerCase();
  const searchSlug = toSlug(rawName);
  
  // 1. Khớp chính xác name, _id, hoặc slug
  let match = topicsList.find(t => t.name.toLowerCase() === searchName || toSlug(t.name) === searchSlug || t._id === item.id);
  if (match) return match;
  
  // 2. Khớp includes
  match = topicsList.find(t => {
    const dbName = t.name.toLowerCase();
    const dbSlug = toSlug(t.name);
    return dbName.includes(searchName) || searchName.includes(dbName) || (searchSlug && dbSlug.includes(searchSlug));
  });
  if (match) return match;

  const keywords = {
    'viet': ['việt', 'vpop', 'v-pop', 'nhac viet'],
    'lofi': ['lofi', 'chill'],
    'ballad': ['pop', 'ballad'],
    'acoustic': ['acoustic', 'cafe', 'mộc'],
    'edm': ['edm', 'dance', 'electronic', 'remix'],
    'us-uk': ['us', 'uk', 'pop', 'âu mỹ'],
    'kpop': ['kpop', 'k-pop', 'hàn'],
    'cpop': ['hoa', 'cpop', 'c-pop'],
    'gym': ['gym', 'workout', 'remix', 'edm'],
    'focus': ['focus', 'lofi', 'không lời']
  };

  for (const [key, aliases] of Object.entries(keywords)) {
    if (searchSlug.includes(key) || searchName.includes(key)) {
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

  const loadDefault = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    loadDefault();
  }, [loadDefault]);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % CAROUSEL_SLIDES.length);
    }, 6000);
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
  }, [searchParams, defaultSongs, query, runSearch]);

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

  const fetchTopicSongs = useCallback(async (item) => {
    const itemId = item.id || item._id;
    const itemName = item.title || item.name;

    setSelectedTopic(itemId);
    setSelectedTitle(itemName);
    setQuery('');

    window.scrollTo({ top: 0, behavior: 'smooth' });

    try {
      setLoading(true);
      setError('');
      
      const dbTopic = findMatchingDbTopic(item, topics);
      if (dbTopic) {
        const response = await clientTopicsApi.getSongsByTopic(dbTopic._id);
        setSongs(response.data || []);
      } else {
        setSongs([]);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể tải bài hát cho chủ đề này.');
      setSongs([]);
    } finally {
      setLoading(false);
    }
  }, [topics]);

  const handleSelectCategory = useCallback((item) => {
    const itemName = item.title || item.name || item.topicName;
    const slug = toSlug(itemName) || item.id || item._id;
    const newParams = new URLSearchParams(searchParams);
    newParams.set('topic', slug);
    newParams.delete('query');
    newParams.delete('tab');
    setSearchParams(newParams);
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const topicParam = searchParams.get('topic');
    if (topicParam) {
      const normalizedParam = topicParam.trim();
      if (selectedTopic !== normalizedParam) {
        // 1. Tìm trong DB topics theo _id, name, hoặc slug
        if (topics.length > 0) {
          const dynamicMatch = topics.find(
            (t) => t._id === normalizedParam || toSlug(t.name) === normalizedParam || t.name.toLowerCase() === normalizedParam.toLowerCase()
          );
          if (dynamicMatch) {
            fetchTopicSongs(dynamicMatch);
            return;
          }
        }
        
        // 2. Tìm trong Curated items
        const allCurated = [
          ...FEATURED_ITEMS,
          ...NATIONS_ITEMS,
          ...MOODS_ITEMS,
          ...CAROUSEL_SLIDES
        ];
        const curatedMatch = allCurated.find(
          (item) => item.id === normalizedParam || toSlug(item.title) === normalizedParam || toSlug(item.label) === normalizedParam
        );
        
        if (curatedMatch) {
          fetchTopicSongs(curatedMatch);
        } else if (topics.length > 0) {
          const fallbackMatch = topics.find((t) => toSlug(t.name).includes(toSlug(normalizedParam)));
          if (fallbackMatch) {
            fetchTopicSongs(fallbackMatch);
          }
        }
      }
    } else {
      if (selectedTopic !== null) {
        setSelectedTopic(null);
        setSelectedTitle('Gợi ý cho bạn');
        setSongs(defaultSongs);
      }
    }
  }, [searchParams, topics, defaultSongs, selectedTopic, fetchTopicSongs]);

  const activeTopicTab = searchParams.get('tab') || 'all';

  const handleBack = () => {
    setSelectedTopic(null);
    setSelectedTitle('Gợi ý cho bạn');
    setSongs(defaultSongs);
    setQuery('');
    
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/genres', { replace: true });
    }
  };

  const handleSelectTopicTab = (tab) => {
    const newParams = new URLSearchParams(searchParams);
    if (tab === 'all') {
      newParams.delete('tab');
    } else {
      newParams.set('tab', tab);
    }
    setSearchParams(newParams);
  };

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
      showToast({ message: 'Vui lòng đăng nhập để quan tâm nghệ sĩ.', severity: 'warning' });
      navigate('/?auth=login');
      return;
    }
    try {
      const response = await clientArtistApi.toggleFollow(artist._id);
      if (response.data.success) {
        const { isFollowing, followers, message } = response.data;
        setFollowedArtists(prev => ({ ...prev, [artist._id]: isFollowing }));
        setArtistFollowersState(prev => ({ ...prev, [artist._id]: followers }));
        showToast({ message: message || (isFollowing ? `Đã theo dõi ${artist.name}` : `Đã bỏ theo dõi ${artist.name}`), severity: 'success' });
      }
    } catch (err) {
      showToast({ message: err.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại.', severity: 'error' });
    }
  };

  const slide = CAROUSEL_SLIDES[activeSlide];

  const relatedPlaylists = useMemo(() => {
    if (!playlists.length || !selectedTopic) return [];
    const keyword = selectedTitle.toLowerCase();
    const filtered = playlists.filter(p => 
      (p.name && p.name.toLowerCase().includes(keyword)) ||
      (p.description && p.description.toLowerCase().includes(keyword))
    );
    return filtered.length > 0 ? filtered.slice(0, 6) : playlists.slice(0, 6);
  }, [playlists, selectedTitle, selectedTopic]);

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

    return 'linear-gradient(180deg, rgba(108, 99, 255, 0.45) 0%, rgba(10, 15, 30, 0.95) 100%)';
  }, [selectedTopic, selectedTitle, topics]);

  const activeImage = useMemo(() => {
    if (!selectedTopic) return '';
    const slideMatch = CAROUSEL_SLIDES.find(c => c.id === selectedTopic);
    if (slideMatch) return slideMatch.image;
    
    const featMatch = FEATURED_ITEMS.find(f => f.id === selectedTopic);
    if (featMatch) return featMatch.image;
    
    const nationMatch = NATIONS_ITEMS.find(n => n.id === selectedTopic);
    if (nationMatch) return nationMatch.image;

    const moodMatch = MOODS_ITEMS.find(m => m.id === selectedTopic);
    if (moodMatch) return moodMatch.image;
    
    const dbMatchIndex = topics.findIndex(t => t._id === selectedTopic);
    if (dbMatchIndex !== -1) return getTopicImage(selectedTitle, dbMatchIndex);

    return 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1400&auto=format&fit=crop&q=80';
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
    return Object.values(artistMap).slice(0, 6);
  }, [songs]);

  useEffect(() => {
    if (!relatedArtists.length) return;
    const followerMap = {};
    relatedArtists.forEach(artist => {
      followerMap[artist._id] = artist.followers || 0;
    });
    setArtistFollowersState(prev => ({ ...prev, ...followerMap }));
  }, [relatedArtists]);

  useEffect(() => {
    let cancelled = false;
    const fetchFollowStatuses = async () => {
      if (!relatedArtists.length) return;
      const isLoggedIn = !!localStorage.getItem('userId');
      if (!isLoggedIn) {
        const followMap = {};
        relatedArtists.forEach(artist => followMap[artist._id] = false);
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
        console.error("Error:", err);
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
        <Stack spacing={4.5} sx={{ width: '100%', pb: 5 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2.5} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }}>
            <Box>
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 950,
                  letterSpacing: '-0.04em',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  fontSize: { xs: '1.6rem', sm: '2rem' },
                  background: (theme) => theme.palette.mode === 'dark'
                    ? 'linear-gradient(135deg, #ffffff 20%, #a5b4fc 60%, #00e5ff 100%)'
                    : 'linear-gradient(135deg, #1e1b4b 10%, #4f46e5 60%, #0284c7 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                <ExploreIcon sx={{ color: '#00bcd4', fontSize: 32 }} />
                Vũ Trụ Thể Loại & Sóng Âm Nhạc
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontWeight: 550 }}>
                Khám phá thế giới âm thanh đa vũ trụ phân loại theo thể loại, quốc gia và tâm trạng.
              </Typography>
            </Box>

            <ClickAwayListener onClickAway={() => setShowSuggestions(false)}>
              <Box sx={{ position: 'relative', width: { xs: '100%', md: 360 } }}>
                <TextField
                  size="small"
                  value={query}
                  onFocus={() => { if (query.trim() && suggestions.length) setShowSuggestions(true); }}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); handleSearch(); } }}
                  placeholder="Tìm thể loại, bài hát, ca sĩ..."
                  fullWidth
                  InputProps={{
                    startAdornment: <SearchIcon sx={{ color: '#8c85ff', mr: 1, fontSize: 20 }} />,
                    sx: {
                      borderRadius: '9999px',
                      bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      transition: 'all 0.25s',
                      fontSize: 13.5,
                      '&:hover': { borderColor: '#6c63ff' },
                      '&.Mui-focused': { borderColor: '#6c63ff', boxShadow: '0 0 16px rgba(108, 99, 255, 0.35)' }
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
                      zIndex: 1400,
                      borderRadius: 3.5,
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(14, 20, 38, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                      backdropFilter: 'blur(20px)',
                      maxHeight: 280,
                      overflowY: 'auto',
                      boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
                    }}
                  >
                    <List dense disablePadding>
                      {suggestions.map((song) => (
                        <ListItemButton
                          key={song._id}
                          onClick={() => { setQuery(song.title || ''); setShowSuggestions(false); playSong(song, { queue: suggestions }); }}
                          sx={{ py: 1.25, px: 2 }}
                        >
                          <Avatar
                            src={song.imageUrl || undefined}
                            variant="rounded"
                            sx={{ width: 34, height: 34, mr: 1.5, borderRadius: '8px', bgcolor: 'rgba(99, 102, 241, 0.15)', color: '#6c63ff' }}
                          >
                            <MusicIcon sx={{ fontSize: 18 }} />
                          </Avatar>
                          <ListItemText
                            primary={song.title || 'Unknown song'}
                            secondary={Array.isArray(song.artists) ? song.artists.map((artist) => artist?.name).filter(Boolean).join(', ') : 'Nghệ sĩ ẩn danh'}
                            primaryTypographyProps={{ noWrap: true, fontWeight: 750, fontSize: 13 }}
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

          {/* ── 1. SÂN KHẤU LĂNG KÍNH THỂ LOẠI (HERO PRISM STAGE CÓ ẢNH NỀN) ── */}
          <Box
            onClick={() => handleSelectCategory(slide)}
            sx={{
              p: { xs: 3.5, sm: 4.5, md: 5.5 },
              minHeight: { xs: 260, md: 320 },
              borderRadius: { xs: 4, md: 6 },
              position: 'relative',
              overflow: 'hidden',
              backgroundImage: `linear-gradient(to right, rgba(9, 13, 26, 0.95) 0%, rgba(9, 13, 26, 0.65) 50%, rgba(9, 13, 26, 0.3) 100%), url(${slide.image})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              color: '#fff',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              transition: 'all 0.5s ease',
              border: '1px solid rgba(255, 255, 255, 0.18)',
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.6), inset 0 1px 1.5px rgba(255, 255, 255, 0.25)',
              cursor: 'pointer',
              '&:hover': {
                transform: 'scale(1.008)',
              }
            }}
          >
            <Box sx={{ position: 'absolute', top: '-20%', right: '-10%', width: 360, height: 360, borderRadius: '50%', background: 'rgba(255, 255, 255, 0.12)', filter: 'blur(50px)' }} />
            <Stack spacing={2} sx={{ maxWidth: { xs: '100%', md: '65%' }, position: 'relative', zIndex: 2 }}>
              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, px: 2, py: 0.5, borderRadius: '9999px', bgcolor: 'rgba(0, 0, 0, 0.45)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.3)', width: 'fit-content' }}>
                <SparklesIcon sx={{ fontSize: 15, color: '#00e5ff' }} />
                <Typography sx={{ fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1.2, color: '#00e5ff' }}>TÂM ĐIỂM SÓNG THỂ LOẠI</Typography>
              </Box>
              <Typography variant="h3" sx={{ fontWeight: 950, letterSpacing: '-0.04em', fontSize: { xs: '1.7rem', sm: '2.4rem', md: '2.8rem' }, lineHeight: 1.15 }}>
                {slide.icon} {slide.title}
              </Typography>
              <Typography variant="body1" sx={{ opacity: 0.92, fontWeight: 550, maxWidth: 540, fontSize: { xs: 13.5, sm: 15 } }}>
                {slide.subtitle}
              </Typography>
              <Button
                variant="contained"
                startIcon={<PlayIcon sx={{ fontSize: 22 }} />}
                sx={{ width: 'fit-content', bgcolor: '#fff', color: '#090d1a', fontWeight: 900, borderRadius: '9999px', px: 4, py: 1.2, textTransform: 'none', fontSize: 14, boxShadow: '0 6px 20px rgba(0, 0, 0, 0.3)', '&:hover': { bgcolor: '#fff', transform: 'scale(1.05)' }, transition: 'all 0.2s ease' }}
              >
                Kích Hoạt Không Gian
              </Button>
            </Stack>
            <Stack direction="row" spacing={1} sx={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 3 }}>
              {CAROUSEL_SLIDES.map((_, idx) => (
                <Box
                  key={idx}
                  onClick={(e) => { e.stopPropagation(); setActiveSlide(idx); }}
                  sx={{ width: idx === activeSlide ? 28 : 8, height: 8, borderRadius: '9999px', bgcolor: idx === activeSlide ? '#fff' : 'rgba(255,255,255,0.4)', boxShadow: idx === activeSlide ? '0 0 10px #fff' : 'none', transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)', cursor: 'pointer' }}
                />
              ))}
            </Stack>
          </Box>

          {/* ── 2. TRẠM THỂ LOẠI NỔI BẬT (CÓ HÌNH ẢNH NGHỆ THUẬT) ── */}
          <Box>
            <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 2.5 }}>
              <FireIcon sx={{ color: '#ec4899', fontSize: 26 }} />
              <Typography sx={{ fontWeight: 900, fontSize: { xs: 20, sm: 23 }, letterSpacing: '-0.03em' }}>Trạm Sóng Nổi Bật</Typography>
            </Stack>
            <Grid container spacing={2.5}>
              {FEATURED_ITEMS.map((item) => (
                <Grid key={item.id} size={{ xs: 12, sm: 6, md: 3 }}>
                  <Box
                    onClick={() => handleSelectCategory(item)}
                    sx={{
                      p: 3,
                      height: 160,
                      borderRadius: '24px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      position: 'relative',
                      overflow: 'hidden',
                      backgroundImage: `${item.gradient}, url(${item.image})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      color: '#fff',
                      boxShadow: '0 10px 28px rgba(0, 0, 0, 0.4)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                      '&:hover': {
                        transform: 'translateY(-6px)',
                        boxShadow: `0 16px 36px -6px ${item.color}88`,
                        filter: 'brightness(1.1)',
                      }
                    }}
                  >
                    <Box sx={{ position: 'relative', zIndex: 1 }}>
                      <Typography variant="h5" sx={{ fontWeight: 950, fontSize: '1.35rem', mb: 0.5, textShadow: '0 2px 8px rgba(0,0,0,0.6)' }}>
                        {item.title}
                      </Typography>
                      <Typography variant="body2" sx={{ opacity: 0.92, fontWeight: 550, fontSize: 13, textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>
                        {item.description}
                      </Typography>
                    </Box>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ position: 'relative', zIndex: 1 }}>
                      <Typography variant="caption" sx={{ fontWeight: 850, textTransform: 'uppercase', letterSpacing: 1, opacity: 0.9, textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
                        Khám Phá Sóng
                      </Typography>
                      <IconButton sx={{ p: 0.6, color: '#fff', bgcolor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,0.2)', '&:hover': { bgcolor: '#fff', color: '#090d1a' } }}>
                        <PlayIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Stack>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Box>

          {/* ── 3. KHÔNG GIAN QUỐC GIA ÂM NHẠC (CÓ ẢNH THÀNH PHỐ / VĂN HÓA) ── */}
          <Box>
            <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 2.5 }}>
              <GlobeIcon sx={{ color: '#3b82f6', fontSize: 26 }} />
              <Typography sx={{ fontWeight: 900, fontSize: { xs: 20, sm: 23 }, letterSpacing: '-0.03em' }}>Không Gian Quốc Gia Âm Nhạc</Typography>
            </Stack>
            <Grid container spacing={2.5}>
              {NATIONS_ITEMS.map((item) => (
                <Grid key={item.id} size={{ xs: 6, sm: 3 }}>
                  <Box
                    onClick={() => handleSelectCategory(item)}
                    sx={{
                      p: 2.5,
                      height: 130,
                      borderRadius: '24px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      alignItems: 'center',
                      textAlign: 'center',
                      position: 'relative',
                      overflow: 'hidden',
                      backgroundImage: `${item.gradient}, url(${item.image})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      color: '#fff',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      boxShadow: '0 10px 28px rgba(0,0,0,0.35)',
                      transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                      '&:hover': {
                        transform: 'translateY(-5px) scale(1.02)',
                        boxShadow: '0 14px 34px rgba(0,0,0,0.5)',
                        filter: 'brightness(1.12)',
                      }
                    }}
                  >
                    <Typography sx={{ fontSize: 28, mb: 0.5, filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.6))' }}>{item.flag}</Typography>
                    <Typography sx={{ fontWeight: 900, fontSize: 15, textShadow: '0 2px 6px rgba(0,0,0,0.7)' }}>{item.title}</Typography>
                    <Typography variant="caption" sx={{ opacity: 0.9, fontWeight: 600, display: { xs: 'none', sm: 'block' }, textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
                      {item.subtitle}
                    </Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Box>

          {/* ── 4. TÂM TRẠNG & HOẠT ĐỘNG (CÓ HÌNH ẢNH SỐNG ĐỘNG) ── */}
          <Box>
            <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 2.5 }}>
              <WavesIcon sx={{ color: '#10b981', fontSize: 26 }} />
              <Typography sx={{ fontWeight: 900, fontSize: { xs: 20, sm: 23 }, letterSpacing: '-0.03em' }}>Tâm Trạng & Không Gian Sống</Typography>
            </Stack>
            <Grid container spacing={2.5}>
              {MOODS_ITEMS.map((item) => (
                <Grid key={item.id} size={{ xs: 6, sm: 3 }}>
                  <Box
                    onClick={() => handleSelectCategory(item)}
                    sx={{
                      p: 2.5,
                      height: 130,
                      borderRadius: '24px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      alignItems: 'center',
                      textAlign: 'center',
                      position: 'relative',
                      overflow: 'hidden',
                      backgroundImage: `${item.gradient}, url(${item.image})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      color: '#fff',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      boxShadow: '0 10px 28px rgba(0,0,0,0.35)',
                      transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                      '&:hover': {
                        transform: 'translateY(-5px) scale(1.02)',
                        boxShadow: '0 14px 34px rgba(0,0,0,0.5)',
                        filter: 'brightness(1.12)',
                      }
                    }}
                  >
                    <Typography sx={{ fontSize: 28, mb: 0.5, filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.6))' }}>{item.icon}</Typography>
                    <Typography sx={{ fontWeight: 900, fontSize: 15, textShadow: '0 2px 6px rgba(0,0,0,0.7)' }}>{item.title}</Typography>
                    <Typography variant="caption" sx={{ opacity: 0.9, fontWeight: 600, display: { xs: 'none', sm: 'block' }, textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
                      {item.subtitle}
                    </Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Box>

          {/* ── 5. BẢN ĐỒ THỂ LOẠI TOÀN NĂNG (DYNAMIC TOPIC MATRIX CÓ ẢNH) ── */}
          {topics.length > 0 && (
            <Box
              sx={{
                p: { xs: 3, sm: 4 },
                borderRadius: '28px',
                bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(16, 22, 40, 0.6)' : '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                backdropFilter: 'blur(16px)',
              }}
            >
              <Typography sx={{ fontWeight: 900, fontSize: 20, mb: 2.5, letterSpacing: '-0.02em' }}>
                🪐 Bản Đồ Thể Loại Đa Vũ Trụ ({topics.length} Chủ Đề)
              </Typography>

              <Grid container spacing={2}>
                {topics.map((topic, index) => {
                  const gradient = getTopicGradient(topic.name, index);
                  const topicImg = getTopicImage(topic.name, index);
                  return (
                    <Grid size={{ xs: 6, sm: 4, md: 3, lg: 2 }} key={topic._id}>
                      <Box
                        onClick={() => handleSelectCategory(topic)}
                        sx={{
                          p: 2,
                          height: 110,
                          borderRadius: '20px',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          position: 'relative',
                          overflow: 'hidden',
                          backgroundImage: `${gradient}, url(${topicImg})`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          color: '#fff',
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                          boxShadow: '0 8px 20px rgba(0,0,0,0.3)',
                          transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                          '&:hover': {
                            transform: 'translateY(-4px) scale(1.03)',
                            boxShadow: '0 12px 28px rgba(0,0,0,0.45)',
                            filter: 'brightness(1.1)',
                          },
                        }}
                      >
                        <Typography sx={{ fontWeight: 900, fontSize: 14, textShadow: '0 2px 6px rgba(0,0,0,0.8)' }} noWrap>
                          {topic.name}
                        </Typography>
                        <Typography variant="caption" sx={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, opacity: 0.9, textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
                          Khám phá →
                        </Typography>
                      </Box>
                    </Grid>
                  );
                })}
              </Grid>
            </Box>
          )}
        </Stack>
      ) : (
        /* ━━━━━━━━━━━━━━━━━━━━━━━━ 🔮 MASTER SOUNDSCAPE DETAIL HUB ━━━━━━━━━━━━━━━━━━━━━━━━ */
        <Box sx={{ pb: 6, width: '100%' }}>
          {/* Back button */}
          <Button
            onClick={handleBack}
            startIcon={<BackIcon />}
            sx={{
              color: '#8c85ff',
              fontWeight: 800,
              textTransform: 'none',
              fontSize: 13.5,
              mb: 2.5,
              borderRadius: '9999px',
              px: 2.5,
              py: 0.65,
              bgcolor: 'rgba(108, 99, 255, 0.1)',
              border: '1px solid rgba(108, 99, 255, 0.25)',
              '&:hover': {
                bgcolor: 'rgba(108, 99, 255, 0.2)',
                borderColor: '#8c85ff',
              }
            }}
          >
            Quay Lại
          </Button>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}>
              <CircularProgress size={44} sx={{ color: '#6c63ff' }} />
            </Box>
          ) : (
            <Stack spacing={4.5}>
              {/* ── 1. ASYMMETRIC DUAL MASTER HERO STAGE (SPLIT 7/12 + 5/12) ── */}
              <Grid container spacing={2.5}>
                {/* Left: Master Genre Capsule (7/12) */}
                <Grid size={{ xs: 12, md: 7 }}>
                  <Box
                    sx={{
                      height: '100%',
                      minHeight: 280,
                      p: { xs: 3, sm: 4 },
                      borderRadius: '28px',
                      position: 'relative',
                      overflow: 'hidden',
                      backgroundImage: `${activeGradient}, url(${activeImage})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      color: '#fff',
                      border: '1px solid rgba(255,255,255,0.18)',
                      boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Box>
                      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, px: 1.75, py: 0.4, borderRadius: '9999px', bgcolor: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.25)', mb: 2 }}>
                        <SparklesIcon sx={{ fontSize: 14, color: '#00e5ff' }} />
                        <Typography sx={{ fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1, color: '#00e5ff' }}>
                          KHÔNG GIAN THỂ LOẠI • {songs.length} BÀI HÁT
                        </Typography>
                      </Box>

                      <Typography variant="h3" sx={{ fontWeight: 950, letterSpacing: '-0.04em', fontSize: { xs: '1.8rem', sm: '2.4rem' }, mb: 1, lineHeight: 1.15 }}>
                        {selectedTitle}
                      </Typography>
                      
                      <Typography variant="body2" sx={{ opacity: 0.92, maxWidth: 520, fontWeight: 550, fontSize: { xs: 13, sm: 14 }, textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
                        Thưởng thức những tác phẩm âm nhạc tuyển chọn xuất sắc nhất thuộc chủ đề {selectedTitle}.
                      </Typography>
                    </Box>

                    <Box sx={{ mt: 3 }}>
                      {songs.length > 0 && (
                        <Stack direction="row" spacing={1.5} sx={{ mb: 2.5, flexWrap: 'wrap', gap: 1 }}>
                          <Button
                            variant="contained"
                            startIcon={<PlayIcon sx={{ fontSize: 22 }} />}
                            onClick={() => handlePlayAll(false)}
                            sx={{
                              bgcolor: '#fff',
                              color: '#090d1a',
                              fontWeight: 900,
                              borderRadius: '9999px',
                              px: 3.5,
                              py: 1,
                              fontSize: 14,
                              textTransform: 'none',
                              boxShadow: '0 6px 20px rgba(0,0,0,0.3)',
                              '&:hover': { bgcolor: '#fff', transform: 'scale(1.04)' },
                              transition: 'all 0.2s ease',
                            }}
                          >
                            Phát Toàn Bộ ({songs.length})
                          </Button>
                          <Button
                            variant="outlined"
                            startIcon={<ShuffleIcon />}
                            onClick={() => handlePlayAll(true)}
                            sx={{
                              borderColor: 'rgba(255, 255, 255, 0.4)',
                              color: '#fff',
                              fontWeight: 800,
                              borderRadius: '9999px',
                              px: 3,
                              py: 1,
                              fontSize: 14,
                              textTransform: 'none',
                              backdropFilter: 'blur(10px)',
                              bgcolor: 'rgba(0, 0, 0, 0.3)',
                              '&:hover': { borderColor: '#fff', bgcolor: 'rgba(0, 0, 0, 0.5)' }
                            }}
                          >
                            Trộn Bài
                          </Button>
                        </Stack>
                      )}

                      {/* Sub-tabs pills */}
                      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                        {[
                          { id: 'all', label: '✨ Tất Cả' },
                          { id: 'songs', label: `🎧 Bài Hát (${songs.length})` },
                          ...(relatedPlaylists.length > 0 ? [{ id: 'playlists', label: `📻 Tuyển Tập (${relatedPlaylists.length})` }] : []),
                          ...(relatedArtists.length > 0 ? [{ id: 'artists', label: `🪐 Nghệ Sĩ (${relatedArtists.length})` }] : []),
                        ].map((t) => (
                          <Chip
                            key={t.id}
                            label={t.label}
                            onClick={() => handleSelectTopicTab(t.id)}
                            sx={{
                              fontWeight: 850,
                              fontSize: 12,
                              cursor: 'pointer',
                              borderRadius: '9999px',
                              color: activeTopicTab === t.id ? '#090d1a' : '#fff',
                              bgcolor: activeTopicTab === t.id ? '#fff' : 'rgba(0, 0, 0, 0.4)',
                              border: '1px solid',
                              borderColor: activeTopicTab === t.id ? '#fff' : 'rgba(255, 255, 255, 0.25)',
                              backdropFilter: 'blur(8px)',
                              '&:hover': {
                                bgcolor: activeTopicTab === t.id ? '#fff' : 'rgba(0, 0, 0, 0.6)',
                              },
                            }}
                          />
                        ))}
                      </Stack>
                    </Box>
                  </Box>
                </Grid>

                {/* Right: Spotlight #01 Trending Song Hologram (5/12) */}
                <Grid size={{ xs: 12, md: 5 }}>
                  {songs.length > 0 ? (
                    <Box
                      onClick={() => playSong(songs[0], { queue: songs })}
                      sx={{
                        height: '100%',
                        minHeight: 280,
                        p: 3,
                        borderRadius: '28px',
                        bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(16, 22, 40, 0.65)' : '#ffffff',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        backdropFilter: 'blur(16px)',
                        boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        position: 'relative',
                        overflow: 'hidden',
                        transition: 'all 0.3s ease',
                        '&:hover': {
                          borderColor: '#6c63ff',
                          transform: 'translateY(-4px)',
                          boxShadow: '0 24px 60px rgba(108, 99, 255, 0.35)',
                        },
                        '&:hover .spotlight-disc': {
                          transform: 'rotate(45deg) scale(1.05)',
                        }
                      }}
                    >
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, px: 1.5, py: 0.35, borderRadius: '9999px', bgcolor: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.4)' }}>
                          <FireIcon sx={{ fontSize: 15, color: '#f59e0b' }} />
                          <Typography sx={{ fontSize: 11, fontWeight: 900, color: '#f59e0b' }}>
                            #01 SPOTLIGHT THỂ LOẠI
                          </Typography>
                        </Box>
                        <Chip
                          label="Phát ngay"
                          size="small"
                          icon={<PlayIcon sx={{ color: '#00e5ff !important', fontSize: 16 }} />}
                          sx={{ fontWeight: 900, bgcolor: 'rgba(0, 229, 255, 0.15)', color: '#00e5ff', border: '1px solid rgba(0, 229, 255, 0.35)' }}
                        />
                      </Stack>

                      {/* Disc & Song Info */}
                      <Stack direction="row" spacing={2.5} alignItems="center" sx={{ my: 2 }}>
                        {/* 3D Vinyl Disc Effect */}
                        <Box sx={{ position: 'relative', width: 90, height: 90, flexShrink: 0 }}>
                          <Box
                            className="spotlight-disc"
                            sx={{
                              width: 90,
                              height: 90,
                              borderRadius: '50%',
                              backgroundImage: `url(${songs[0].imageUrl || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300'})`,
                              backgroundSize: 'cover',
                              backgroundPosition: 'center',
                              boxShadow: '0 8px 24px rgba(0,0,0,0.5), 0 0 16px rgba(108, 99, 255, 0.3)',
                              border: '3px solid rgba(255,255,255,0.4)',
                              transition: 'transform 0.5s ease',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          />
                        </Box>

                        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                          <Typography variant="h6" sx={{ fontWeight: 900, mb: 0.5 }} noWrap>
                            {songs[0].title}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, mb: 1 }} noWrap>
                            {Array.isArray(songs[0].artists) ? songs[0].artists.map((a) => a?.name).filter(Boolean).join(', ') : (songs[0].artistText || 'Nhiều nghệ sĩ')}
                          </Typography>
                          <Stack direction="row" spacing={2} alignItems="center">
                            <Typography sx={{ fontSize: 12, fontWeight: 750, color: '#8c85ff' }}>
                              🎧 {Number(songs[0].playCount || 1280).toLocaleString()} lượt nghe
                            </Typography>
                          </Stack>
                        </Box>
                      </Stack>

                      <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic', fontWeight: 550 }}>
                        Giai điệu nổi bật được nghe nhiều nhất trong tuần này.
                      </Typography>
                    </Box>
                  ) : (
                    <Box sx={{ p: 4, height: '100%', borderRadius: '28px', border: '1px dashed rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Typography variant="body2" color="text.secondary">Chưa có giai điệu nào</Typography>
                    </Box>
                  )}
                </Grid>
              </Grid>

              {songs.length === 0 ? (
                <Box sx={{ p: 6, textAlign: 'center', borderRadius: '24px', border: '1px dashed rgba(255,255,255,0.15)', bgcolor: 'rgba(255,255,255,0.02)' }}>
                  <Typography variant="h6" fontWeight={800} sx={{ mb: 0.5 }}>
                    Chủ đề này chưa có bài hát nào
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Hệ thống sẽ sớm cập nhật thêm các ca khúc mới cho chủ đề này.
                  </Typography>
                </Box>
              ) : (
                <Stack spacing={4.5}>
                  {/* ── 2. MATRIX NỘI DUNG TÙY BIẾN THEO TAB ── */}

                  {/* TAB 1: ✨ TẤT CẢ (BENTO MATRIX 2 CỘT 7.5/12 + 4.5/12) */}
                  {activeTopicTab === 'all' && (
                    <Grid container spacing={3}>
                      {/* Left: Dòng Chảy Tác Phẩm Nổi Bật (7.5/12) */}
                      <Grid size={{ xs: 12, md: 7.5 }}>
                        <Box
                          sx={{
                            p: { xs: 2.5, sm: 3.5 },
                            borderRadius: '28px',
                            bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(16, 22, 40, 0.55)' : '#ffffff',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            backdropFilter: 'blur(16px)',
                          }}
                        >
                          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2.5 }}>
                            <Stack direction="row" spacing={1.25} alignItems="center">
                              <MusicIcon sx={{ color: '#00e5ff', fontSize: 24 }} />
                              <Typography sx={{ fontWeight: 900, fontSize: 20, letterSpacing: '-0.02em' }}>
                                Dòng Chảy Tác Phẩm Tiêu Biểu
                              </Typography>
                            </Stack>
                            <Button
                              variant="outlined"
                              size="small"
                              startIcon={<RefreshIcon />}
                              onClick={handleRefreshHotSongs}
                              disabled={songs.length <= 1}
                              sx={{
                                color: '#00e5ff',
                                borderColor: 'rgba(0, 229, 255, 0.3)',
                                borderRadius: '9999px',
                                textTransform: 'none',
                                fontWeight: 800,
                                px: 2,
                                '&:hover': { borderColor: '#00e5ff', bgcolor: 'rgba(0, 229, 255, 0.1)' },
                              }}
                            >
                              Đổi Bài
                            </Button>
                          </Stack>

                          {/* 2-Column Ranked Song Stream */}
                          <Grid container spacing={1.5}>
                            {hotSongs.slice(0, 10).map((song, idx) => {
                              const isCur = currentSong?._id === song._id;
                              const isPlay = isPlaying && isCur;
                              return (
                                <Grid size={{ xs: 12, sm: 6 }} key={`detail-song-${song._id}`}>
                                  <Stack
                                    direction="row"
                                    spacing={1.5}
                                    alignItems="center"
                                    onClick={() => playSong(song, { queue: songs })}
                                    sx={{
                                      p: 1.25,
                                      borderRadius: '16px',
                                      cursor: 'pointer',
                                      bgcolor: isCur ? 'rgba(108, 99, 255, 0.15)' : 'transparent',
                                      border: '1px solid',
                                      borderColor: isCur ? '#6c63ff' : 'transparent',
                                      transition: 'all 0.2s ease',
                                      '&:hover': {
                                        bgcolor: 'rgba(255, 255, 255, 0.05)',
                                        borderColor: 'rgba(255, 255, 255, 0.15)',
                                        transform: 'translateX(3px)',
                                      }
                                    }}
                                  >
                                    <Typography sx={{ fontWeight: 900, fontSize: 13, color: idx < 3 ? '#00e5ff' : 'text.secondary', width: 22, textAlign: 'center' }}>
                                      {String(idx + 1).padStart(2, '0')}
                                    </Typography>
                                    <Avatar
                                      src={song.imageUrl}
                                      variant="rounded"
                                      sx={{ width: 44, height: 44, borderRadius: '10px' }}
                                    />
                                    <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                                      <Typography variant="body2" sx={{ fontWeight: 800, color: isCur ? '#00e5ff' : 'inherit' }} noWrap>
                                        {song.title}
                                      </Typography>
                                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }} noWrap display="block">
                                        {Array.isArray(song.artists) ? song.artists.map(a => a?.name).filter(Boolean).join(', ') : (song.artistText || 'Nhiều nghệ sĩ')}
                                      </Typography>
                                    </Box>
                                    <IconButton size="small" sx={{ color: isPlay ? '#00e5ff' : 'text.secondary' }}>
                                      <PlayIcon sx={{ fontSize: 20 }} />
                                    </IconButton>
                                  </Stack>
                                </Grid>
                              );
                            })}
                          </Grid>
                        </Box>
                      </Grid>

                      {/* Right: Radar Tuyển Tập & Nghệ Sĩ Trực Thuộc (4.5/12) */}
                      <Grid size={{ xs: 12, md: 4.5 }}>
                        <Stack spacing={2.5}>
                          {/* Nghệ sĩ tiêu biểu Mini Box */}
                          {relatedArtists.length > 0 && (
                            <Box
                              sx={{
                                p: 2.5,
                                borderRadius: '24px',
                                bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(16, 22, 40, 0.55)' : '#ffffff',
                                border: '1px solid rgba(255, 255, 255, 0.08)',
                              }}
                            >
                              <Typography sx={{ fontWeight: 900, fontSize: 16, mb: 2 }}>
                                🪐 Nghệ Sĩ Tiêu Biểu
                              </Typography>
                              <Stack spacing={1.5}>
                                {relatedArtists.slice(0, 3).map((artist) => {
                                  const isFollowed = !!followedArtists[artist._id];
                                  return (
                                    <Stack
                                      key={`side-artist-${artist._id}`}
                                      direction="row"
                                      spacing={1.5}
                                      alignItems="center"
                                      justifyContent="space-between"
                                      sx={{ p: 1, borderRadius: '14px', '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' } }}
                                    >
                                      <Stack
                                        direction="row"
                                        spacing={1.5}
                                        alignItems="center"
                                        onClick={() => navigate(`/artists/${artist._id}`)}
                                        sx={{ cursor: 'pointer', minWidth: 0, flexGrow: 1 }}
                                      >
                                        <Avatar src={artist.avatar} sx={{ width: 42, height: 42 }} />
                                        <Box sx={{ minWidth: 0 }}>
                                          <Typography variant="body2" sx={{ fontWeight: 800 }} noWrap>
                                            {artist.name}
                                          </Typography>
                                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                                            {formatFollowerCount(artistFollowersState[artist._id] ?? artist.followers)}
                                          </Typography>
                                        </Box>
                                      </Stack>
                                      <Button
                                        size="small"
                                        variant={isFollowed ? 'outlined' : 'contained'}
                                        onClick={() => handleToggleFollow(artist)}
                                        sx={{
                                          borderRadius: '9999px',
                                          fontSize: 10.5,
                                          py: 0.25,
                                          px: 1.25,
                                          fontWeight: 800,
                                          textTransform: 'none',
                                          bgcolor: isFollowed ? 'transparent' : '#6c63ff',
                                        }}
                                      >
                                        {isFollowed ? 'Đã theo dõi' : 'Quan tâm'}
                                      </Button>
                                    </Stack>
                                  );
                                })}
                              </Stack>
                            </Box>
                          )}

                          {/* Featured Playlist Mini Card */}
                          {relatedPlaylists.length > 0 && (
                            <Box
                              onClick={() => navigate(`/collections/${relatedPlaylists[0]._id}`)}
                              sx={{
                                p: 2.5,
                                borderRadius: '24px',
                                background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.15) 0%, rgba(99, 102, 241, 0.2) 100%)',
                                border: '1px solid rgba(6, 182, 212, 0.3)',
                                cursor: 'pointer',
                                transition: 'all 0.25s ease',
                                '&:hover': {
                                  borderColor: '#06b6d4',
                                  transform: 'translateY(-3px)',
                                }
                              }}
                            >
                              <Typography sx={{ fontSize: 11, fontWeight: 900, color: '#00e5ff', textTransform: 'uppercase', mb: 1 }}>
                                📻 PLAYLIST GỢI Ý ĐẶC BIỆT
                              </Typography>
                              <Typography variant="subtitle1" sx={{ fontWeight: 900, mb: 0.5 }} noWrap>
                                {relatedPlaylists[0].name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block', mb: 1.5 }}>
                                Tuyển tập {relatedPlaylists[0].songCount || 0} bài hát
                              </Typography>
                              <Button
                                size="small"
                                variant="contained"
                                startIcon={<PlayIcon />}
                                sx={{
                                  bgcolor: '#06b6d4',
                                  color: '#fff',
                                  fontWeight: 850,
                                  borderRadius: '9999px',
                                  textTransform: 'none',
                                  fontSize: 12,
                                  '&:hover': { bgcolor: '#0891b2' }
                                }}
                              >
                                Khám phá Playlist
                              </Button>
                            </Box>
                          )}
                        </Stack>
                      </Grid>
                    </Grid>
                  )}

                  {/* TAB 2: 🎧 BÀI HÁT (TOÀN BỘ DANH SÁCH 3 CỘT) */}
                  {activeTopicTab === 'songs' && (
                    <Box>
                      <Typography sx={{ fontWeight: 900, fontSize: 20, mb: 2.5, letterSpacing: '-0.02em' }}>
                        Toàn Bộ Danh Sách Bài Hát ({songs.length})
                      </Typography>
                      <Grid container spacing={2}>
                        {songs.map((song) => (
                          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={song._id}>
                            <ClientSongItem
                              song={song}
                              showDuration={true}
                              isCurrent={currentSong?._id === song._id}
                              isPlaying={isPlaying && currentSong?._id === song._id}
                              onPlay={() => playSong(song, { queue: songs })}
                            />
                          </Grid>
                        ))}
                      </Grid>
                    </Box>
                  )}

                  {/* TAB 3 / SECTION: 📻 PLAYLIST & TUYỂN TẬP */}
                  {(activeTopicTab === 'all' || activeTopicTab === 'playlists') && relatedPlaylists.length > 0 && (
                    <Box>
                      <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 2 }}>
                        <LibraryMusicIcon sx={{ color: '#06b6d4', fontSize: 24 }} />
                        <Typography sx={{ fontWeight: 900, fontSize: 20, letterSpacing: '-0.02em' }}>
                          Tuyển Tập & Playlist Liên Quan
                        </Typography>
                      </Stack>
                      <Grid container spacing={2}>
                        {relatedPlaylists.map((playlist) => (
                          <Grid size={{ xs: 6, sm: 4, md: 3, lg: 2 }} key={playlist._id}>
                            <ClientPlaylistCard
                              playlist={playlist}
                              onPlay={async (e, pl) => {
                                e.stopPropagation();
                                const res = await clientPlaylistsApi.getSystemById(pl._id);
                                const plSongs = res.data?.playlist?.songs || [];
                                if (plSongs.length) playSong(plSongs[0], { queue: plSongs });
                              }}
                            />
                          </Grid>
                        ))}
                      </Grid>
                    </Box>
                  )}

                  {/* TAB 4 / SECTION: 🪐 NGHỆ SĨ */}
                  {(activeTopicTab === 'all' || activeTopicTab === 'artists') && relatedArtists.length > 0 && (
                    <Box>
                      <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 2 }}>
                        <RadioIcon sx={{ color: '#6366f1', fontSize: 24 }} />
                        <Typography sx={{ fontWeight: 900, fontSize: 20, letterSpacing: '-0.02em' }}>
                          Hành Tinh Nghệ Sĩ Thuộc Thể Loại
                        </Typography>
                      </Stack>
                      <Grid container spacing={2}>
                        {relatedArtists.map((artist) => {
                          const isFollowed = !!followedArtists[artist._id];
                          const followers = artistFollowersState[artist._id] ?? artist.followers;
                          return (
                            <Grid size={{ xs: 6, sm: 4, md: 2 }} key={artist._id}>
                              <Box
                                onClick={() => navigate(`/artists/${artist._id}`)}
                                sx={{
                                  p: 2,
                                  borderRadius: '24px',
                                  bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(16, 22, 40, 0.55)' : '#ffffff',
                                  border: '1px solid rgba(255, 255, 255, 0.08)',
                                  textAlign: 'center',
                                  cursor: 'pointer',
                                  transition: 'all 0.25s ease',
                                  '&:hover': {
                                    transform: 'translateY(-4px)',
                                    borderColor: '#6c63ff',
                                    boxShadow: '0 10px 24px -5px rgba(108, 99, 255, 0.35)',
                                  }
                                }}
                              >
                                <Avatar
                                  src={artist.avatar}
                                  sx={{ width: 72, height: 72, mx: 'auto', mb: 1.5, border: '2px solid rgba(108, 99, 255, 0.4)' }}
                                />
                                <Typography variant="body2" sx={{ fontWeight: 850 }} noWrap>
                                  {artist.name}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 1.5 }} display="block">
                                  {formatFollowerCount(followers)}
                                </Typography>
                                <Button
                                  size="small"
                                  variant={isFollowed ? 'outlined' : 'contained'}
                                  startIcon={isFollowed ? <CheckIcon /> : <FollowIcon />}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleFollow(artist);
                                  }}
                                  sx={{
                                    borderRadius: '9999px',
                                    fontSize: 11,
                                    py: 0.3,
                                    px: 1.5,
                                    textTransform: 'none',
                                    fontWeight: 800,
                                    bgcolor: isFollowed ? 'transparent' : '#6c63ff',
                                    color: isFollowed ? 'text.secondary' : '#fff',
                                    borderColor: isFollowed ? 'rgba(255,255,255,0.2)' : 'transparent',
                                  }}
                                >
                                  {isFollowed ? 'Đã quan tâm' : 'Quan tâm'}
                                </Button>
                              </Box>
                            </Grid>
                          );
                        })}
                      </Grid>
                    </Box>
                  )}
                </Stack>
              )}
            </Stack>
          )}
        </Box>
      )}
    </ClientLayout>
  );
}

export default ClientGenres;
