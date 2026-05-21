import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { RefreshRounded as RefreshIcon, ChevronRightRounded as ArrowIcon } from '@mui/icons-material';
import ClientLayout from '../../components/Layout/client/ClientLayout';
import { clientPlaylistsApi, clientSongsApi, clientTopicsApi } from '../../services/api';
import { useClientPlayer } from '../../components/Layout/client/ClientPlayerProvider';

const getRecentPlayedStorageKey = () => {
  const userId = localStorage.getItem('userId') || 'anonymous';
  return `musicflow_recent_played_${userId}`;
};

const readRecentPlayedSongs = () => {
  try {
    const raw = localStorage.getItem(getRecentPlayedStorageKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

function ClientDiscover() {
  const { playSong } = useClientPlayer();
  const [songs, setSongs] = useState([]);
  const [suggestedSongs, setSuggestedSongs] = useState([]);
  const [topics, setTopics] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshingSuggestions, setRefreshingSuggestions] = useState(false);
  const [error, setError] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const [songsRes, topicsRes, playlistsRes] = await Promise.all([
        clientSongsApi.getRecommended({ limit: 24 }),
        clientTopicsApi.getAll(),
        clientPlaylistsApi.getSystem({ limit: 20 }),
      ]);

      const nextSongs = Array.isArray(songsRes.data) ? songsRes.data : [];
      setSongs(nextSongs);
      setSuggestedSongs(nextSongs.slice(0, 9));
      setTopics(Array.isArray(topicsRes.data) ? topicsRes.data : []);
      setPlaylists(playlistsRes.data?.playlists || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Khong the tai du lieu kham pha.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const refreshSuggestedSongsOnly = async () => {
    try {
      setRefreshingSuggestions(true);
      setError('');
      const songsRes = await clientSongsApi.getRecommended({ limit: 24 });
      const nextSongs = Array.isArray(songsRes.data) ? songsRes.data : [];
      setSuggestedSongs(nextSongs.slice(0, 9));
    } catch (err) {
      setError(err.response?.data?.message || 'Khong the lam moi goi y bai hat.');
    } finally {
      setRefreshingSuggestions(false);
    }
  };

  const recentSongs = useMemo(() => readRecentPlayedSongs().slice(0, 6), []);

  const top100Cards = useMemo(() => {
    return [...songs]
      .sort((a, b) => (b.playCount || 0) - (a.playCount || 0))
      .slice(0, 5);
  }, [songs]);

  const chillCards = useMemo(() => {
    const chillTopics = new Set(['chill', 'lofi', 'sleep', 'piano']);
    const matched = playlists.filter((playlist) => {
      const name = String(playlist?.name || '').toLowerCase();
      return [...chillTopics].some((keyword) => name.includes(keyword));
    });
    return (matched.length > 0 ? matched : playlists).slice(0, 5);
  }, [playlists]);

  const artistMixCards = useMemo(() => {
    const artistMap = new Map();
    songs.forEach((song) => {
      if (!Array.isArray(song.artists)) return;
      song.artists.forEach((artist) => {
        if (!artist?._id || artistMap.has(artist._id)) return;
        artistMap.set(artist._id, {
          id: artist._id,
          name: artist.name || 'Unknown artist',
          avatar: artist.avatar || song.imageUrl || '',
          subtitle: (song.artists || []).map((a) => a?.name).filter(Boolean).join(', '),
        });
      });
    });
    return [...artistMap.values()].slice(0, 5);
  }, [songs]);

  const shellSx = {
    borderRadius: 4,
    p: { xs: 2, md: 3 },
    background: '#ffffff',
    border: '1px solid #dfe8f2',
    color: '#0f172a',
  };

  const sectionHeader = (title) => (
    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.25 }}>
      <Typography sx={{ fontWeight: 800, fontSize: 24 }}>{title}</Typography>
      <Button size="small" endIcon={<ArrowIcon />} sx={{ color: '#0f766e', fontWeight: 700 }}>
        Tat ca
      </Button>
    </Stack>
  );

  const cardSx = {
    borderRadius: 2.5,
    p: 1,
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    minWidth: 210,
    maxWidth: 210,
    flexShrink: 0,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    '&:hover': {
      transform: 'translateY(-3px)',
      borderColor: '#14b8a6',
      backgroundColor: '#f0fdfa',
      boxShadow: '0 16px 30px -22px rgba(20, 184, 166, 0.7)',
    },
  };

  return (
    <ClientLayout title="Kham pha">
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Paper sx={shellSx}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}>
            <CircularProgress size={34} sx={{ color: '#16a34a' }} />
          </Box>
        ) : (
          <Stack spacing={4}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography sx={{ fontWeight: 900, fontSize: 26 }}>Goi Y Bai Hat</Typography>
              <Button
                onClick={refreshSuggestedSongsOnly}
                startIcon={<RefreshIcon />}
                sx={{ color: '#0f766e', borderColor: '#9dd5ce' }}
                variant="outlined"
                disabled={refreshingSuggestions}
              >
                {refreshingSuggestions ? 'Dang lam moi...' : 'Lam moi'}
              </Button>
            </Stack>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, gap: 1.5 }}>
              {suggestedSongs.map((song) => (
                <Stack
                  key={`quick-${song._id}`}
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  sx={{
                    p: 0.75,
                    borderRadius: 2,
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      borderColor: '#14b8a6',
                      backgroundColor: '#f0fdfa',
                      transform: 'translateY(-2px)',
                    },
                  }}
                  onClick={() => playSong(song)}
                >
                  <Avatar src={song.imageUrl} variant="rounded" sx={{ width: 44, height: 44 }} />
                  <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                    <Typography variant="body2" noWrap sx={{ fontWeight: 700 }}>{song.title}</Typography>
                    <Typography variant="caption" noWrap sx={{ color: '#64748b' }}>
                      {Array.isArray(song.artists)
                        ? song.artists.map((artist) => artist?.name).filter(Boolean).join(', ')
                        : 'Unknown artist'}
                    </Typography>
                  </Box>
                </Stack>
              ))}
            </Box>

            <Box>
              {sectionHeader('Nghe Gan Day')}
              <Stack direction="row" spacing={1.5} sx={{ overflowX: 'auto', pb: 1 }}>
                {(recentSongs.length > 0 ? recentSongs : songs.slice(0, 5)).map((song) => (
                  <Box key={`recent-${song._id}`} sx={cardSx} onClick={() => playSong(song)}>
                    <Box component="img" src={song.imageUrl} alt={song.title} sx={{ width: '100%', aspectRatio: '1/1', borderRadius: 2, objectFit: 'cover', mb: 1 }} />
                    <Typography variant="body2" noWrap sx={{ fontWeight: 700 }}>{song.title}</Typography>
                    <Typography variant="caption" sx={{ color: '#64748b' }} noWrap>
                      {Array.isArray(song.artists)
                        ? song.artists.map((artist) => artist?.name).filter(Boolean).join(', ')
                        : 'Unknown artist'}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Box>

            <Box>
              {sectionHeader('Danh Rieng Cho Ban')}
              <Stack direction="row" spacing={1.5} sx={{ overflowX: 'auto', pb: 1 }}>
                {artistMixCards.map((artist) => (
                  <Box key={`mix-${artist.id}`} sx={{ ...cardSx, minWidth: 230, maxWidth: 230, background: 'linear-gradient(145deg, #2563eb, #14b8a6)' }}>
                    <Stack direction="row" spacing={1.25} alignItems="center">
                      <Avatar src={artist.avatar} sx={{ width: 72, height: 72 }} />
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 900, color: '#fff' }}>{artist.name} Mix</Typography>
                        <Typography variant="caption" sx={{ color: '#e2e8f0' }}>
                          {artist.subtitle || 'Artist selection'}
                        </Typography>
                      </Box>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            </Box>

            <Box>
              {sectionHeader('Top 100')}
              <Stack direction="row" spacing={1.5} sx={{ overflowX: 'auto', pb: 1 }}>
                {top100Cards.map((song, index) => (
                  <Box key={`top-${song._id}`} sx={cardSx}>
                    <Box component="img" src={song.imageUrl} alt={song.title} sx={{ width: '100%', aspectRatio: '1/1', borderRadius: 2, objectFit: 'cover', mb: 1 }} />
                    <Typography sx={{ fontWeight: 900, color: '#0f766e' }}>TOP {index + 1}</Typography>
                    <Typography variant="body2" noWrap sx={{ fontWeight: 700 }}>{song.title}</Typography>
                    <Typography variant="caption" sx={{ color: '#64748b' }} noWrap>
                      {song.playCount || 0} plays
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Box>

            <Box>
              {sectionHeader('Goi Y Playlist')}
              <Stack direction="row" spacing={1.5} sx={{ overflowX: 'auto', pb: 1 }}>
                {playlists.slice(0, 5).map((playlist) => (
                  <Box key={`playlist-${playlist._id}`} sx={cardSx}>
                    <Box component="img" src={playlist.coverImage || ''} alt={playlist.name} sx={{ width: '100%', aspectRatio: '1/1', borderRadius: 2, objectFit: 'cover', mb: 1 }} />
                    <Typography variant="body2" noWrap sx={{ fontWeight: 700 }}>{playlist.name}</Typography>
                    <Typography variant="caption" sx={{ color: '#64748b' }} noWrap>
                      {(playlist.songs || []).length} bai hat
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Box>

            <Box>
              {sectionHeader('Chill')}
              <Stack direction="row" spacing={1.5} sx={{ overflowX: 'auto', pb: 1 }}>
                {chillCards.map((playlist) => (
                  <Box key={`chill-${playlist._id}`} sx={cardSx}>
                    <Box component="img" src={playlist.coverImage || ''} alt={playlist.name} sx={{ width: '100%', aspectRatio: '1/1', borderRadius: 2, objectFit: 'cover', mb: 1 }} />
                    <Typography variant="body2" noWrap sx={{ fontWeight: 700 }}>{playlist.name}</Typography>
                    <Typography variant="caption" sx={{ color: '#64748b' }} noWrap>
                      {(playlist.songs || []).length} bai hat
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Box>

            {topics.length > 0 && (
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                {topics.slice(0, 10).map((topic) => (
                  <Button key={topic._id} size="small" sx={{ color: '#0f766e', borderColor: '#9dd5ce' }} variant="outlined">
                    {topic.name}
                  </Button>
                ))}
              </Stack>
            )}
          </Stack>
        )}
      </Paper>
    </ClientLayout>
  );
}

export default ClientDiscover;
