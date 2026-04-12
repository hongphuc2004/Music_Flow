import { useEffect, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  ClickAwayListener,
  Chip,
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
} from '@mui/material';
import { SearchRounded as SearchIcon } from '@mui/icons-material';
import ClientLayout from '../../components/Layout/client/ClientLayout';
import { clientSongsApi, clientTopicsApi } from '../../services/api';
import { useClientPlayer } from '../../components/Layout/client/ClientPlayerProvider';
import SongMoreMenu from '../../components/Layout/client/SongMoreMenu';

function ClientDiscover() {
  const { playSong } = useClientPlayer();
  const [topics, setTopics] = useState([]);
  const [defaultSongs, setDefaultSongs] = useState([]);
  const [songs, setSongs] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');

  const interactiveCardSx = {
    p: 1.25,
    borderRadius: 2.5,
    border: '1px solid #e2e8f0',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease, background-color 0.2s ease',
    '&:hover': {
      transform: 'translateY(-2px)',
      borderColor: '#14b8a6',
      backgroundColor: '#f0fdfa',
      boxShadow: '0 14px 28px -24px rgba(13, 95, 89, 0.7)',
    },
  };

  const loadDefault = async () => {
    try {
      setLoading(true);
      setError('');
      const [topicsRes, songsRes] = await Promise.all([
        clientTopicsApi.getAll(),
        clientSongsApi.getRecommended({ limit: 12 }),
      ]);

      setTopics(topicsRes.data || []);
      const nextSongs = Array.isArray(songsRes.data) ? songsRes.data : [];
      setDefaultSongs(nextSongs);
      setSongs(nextSongs);
      setSuggestions(nextSongs.slice(0, 6));
    } catch (err) {
      setError(err.response?.data?.message || 'Khong the tai du lieu kham pha.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDefault();
  }, []);

  const runSearch = async (keyword, { withLoading = false } = {}) => {
    const normalized = keyword.trim();

    if (!normalized) {
      setSongs(defaultSongs);
      setSuggestions(defaultSongs.slice(0, 6));
      return;
    }

    try {
      if (withLoading) setLoading(true);
      else setSearching(true);
      setError('');
      const response = await clientSongsApi.search({ query: normalized, limit: 24 });
      const nextSongs = Array.isArray(response.data) ? response.data : [];
      setSongs(nextSongs);
      setSuggestions(nextSongs.slice(0, 6));
    } catch (err) {
      setError(err.response?.data?.message || 'Tim kiem that bai.');
    } finally {
      if (withLoading) setLoading(false);
      else setSearching(false);
    }
  };

  const handleSearch = async () => {
    await runSearch(query, { withLoading: true });
    setShowSuggestions(false);
  };

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
  }, [query, defaultSongs]);

  const handleChooseTopic = async (topicId) => {
    try {
      setLoading(true);
      setError('');
      const response = await clientTopicsApi.getSongsByTopic(topicId);
      setSongs(response.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Khong the tai bai hat theo chu de.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ClientLayout title="Kham pha">
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12 }}>
          <Paper sx={{ p: 2.5, borderRadius: 3, border: '1px solid #e2e8f0' }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>
              Chu de dang hot
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ mb: 1.5 }}>
              <ClickAwayListener onClickAway={() => setShowSuggestions(false)}>
                <Box sx={{ position: 'relative', flexGrow: 1 }}>
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
                    placeholder="Tim bai hat..."
                    fullWidth
                    InputProps={{
                      startAdornment: <SearchIcon sx={{ color: 'text.secondary', mr: 0.75 }} />,
                    }}
                  />
                  {showSuggestions && suggestions.length > 0 && (
                    <Paper
                      sx={{
                        position: 'absolute',
                        top: 'calc(100% + 6px)',
                        left: 0,
                        right: 0,
                        zIndex: 8,
                        borderRadius: 2,
                        border: '1px solid #dbeafe',
                        maxHeight: 260,
                        overflowY: 'auto',
                      }}
                    >
                      <List dense disablePadding>
                        {suggestions.map((song) => (
                          <ListItemButton
                            key={song._id}
                            onClick={() => {
                              setQuery(song.title || '');
                              setShowSuggestions(false);
                              playSong(song);
                            }}
                            sx={{ py: 0.75 }}
                          >
                            <Avatar src={song.imageUrl} variant="rounded" sx={{ width: 28, height: 28, mr: 1 }}>
                              {song.title?.charAt(0)}
                            </Avatar>
                            <ListItemText
                              primary={song.title || 'Unknown song'}
                              secondary={Array.isArray(song.artists)
                                ? song.artists.map((artist) => artist?.name).filter(Boolean).join(', ')
                                : 'Unknown artist'}
                              primaryTypographyProps={{ noWrap: true, fontWeight: 700, fontSize: 13 }}
                              secondaryTypographyProps={{ noWrap: true, fontSize: 12 }}
                            />
                          </ListItemButton>
                        ))}
                      </List>
                    </Paper>
                  )}
                </Box>
              </ClickAwayListener>
              <Button variant="contained" onClick={handleSearch} sx={{ minWidth: 120, bgcolor: '#0f766e', '&:hover': { bgcolor: '#0d5f59' } }}>
                Tim
              </Button>
            </Stack>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              {topics.map((topic) => (
                <Chip
                  key={topic._id}
                  clickable
                  onClick={() => handleChooseTopic(topic._id)}
                  label={topic.name}
                  sx={{ bgcolor: '#ecfeff', color: '#0f766e', fontWeight: 700 }}
                />
              ))}
            </Stack>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12 }}>
          <Paper sx={{ p: 2.5, borderRadius: 3, minHeight: 220, border: '1px solid #e2e8f0' }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>
              Ket qua kham pha
            </Typography>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
                <CircularProgress size={28} />
              </Box>
            ) : (
              <>
                {searching && (
                  <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1, display: 'block' }}>
                    Dang cap nhat ket qua...
                  </Typography>
                )}
                <Grid container spacing={1.5}>
                {songs.map((song) => (
                  <Grid size={{ xs: 12, md: 6 }} key={song._id}>
                    <Paper
                      variant="outlined"
                      onClick={() => playSong(song)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          playSong(song);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      sx={{ ...interactiveCardSx, cursor: 'pointer' }}
                    >
                      <Stack direction="row" spacing={1.25} alignItems="center">
                        <Avatar src={song.imageUrl} variant="rounded" sx={{ width: 48, height: 48 }}>
                          {song.title?.charAt(0)}
                        </Avatar>
                        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                          <Typography fontWeight={700} noWrap>{song.title}</Typography>
                          <Typography variant="caption" color="text.secondary" noWrap>
                            {Array.isArray(song.artists)
                              ? song.artists.map((artist) => artist?.name).filter(Boolean).join(', ')
                              : 'Unknown artist'}
                          </Typography>
                        </Box>
                        <Button
                          size="small"
                          onClick={(event) => {
                            event.stopPropagation();
                            playSong(song);
                          }}
                          sx={{ color: '#0f766e', '&:hover': { backgroundColor: 'rgba(20, 184, 166, 0.14)' } }}
                        >
                          Play
                        </Button>
                        <SongMoreMenu song={song} buttonSx={{ color: '#0f766e', '&:hover': { backgroundColor: 'rgba(20, 184, 166, 0.14)' } }} />
                      </Stack>
                    </Paper>
                  </Grid>
                ))}
                {!songs.length && (
                  <Grid size={{ xs: 12 }}>
                    <Typography color="text.secondary">Khong tim thay bai hat phu hop.</Typography>
                  </Grid>
                )}
                </Grid>
              </>
            )}
          </Paper>
        </Grid>
      </Grid>
    </ClientLayout>
  );
}

export default ClientDiscover;
