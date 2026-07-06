import { useState, useEffect, useCallback, useMemo, forwardRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  IconButton,
  Avatar,
  Chip,
  TextField,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  CircularProgress,
  Alert,
  Switch,
  DialogContentText,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Autocomplete,
  Stack,
  Tabs,
  Tab,
  Tooltip,
  Divider,
  Card,
  Slide,
} from '@mui/material';
import {
  Search as SearchIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Refresh as RefreshIcon,
  MusicNote as MusicNoteIcon,
  PlayArrow as PlayIcon,
  Add as AddIcon,
  CloudUpload as CloudUploadIcon,
  CheckCircleRounded as CheckCircleIcon,
  AudioFileRounded as AudioIcon,
  ImageRounded as ImageIcon,
  AdminPanelSettingsRounded as AdminIcon,
  MusicNoteRounded as ArtistIcon,
  CloudUploadRounded as UploadIcon,
  Close as CloseIcon,
  Category as CategoryIcon,
} from '@mui/icons-material';
import { Layout } from '../../components/Layout';
import { songsApi, topicsApi, accountsApi } from '../../services/admin/admin.service';
import useAppToast from '../../components/common/useAppToast';

const Transition = forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

const emptyFormData = {
  title: '',
  artists: [],
  topicId: '',
  lyrics: '',
  isPublic: true,
  imageUrl: '',
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function Songs() {
  const { showToast, updateToast } = useAppToast();
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [total, setTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteDialog, setDeleteDialog] = useState({ open: false, song: null });
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [topics, setTopics] = useState([]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [dialogTab, setDialogTab] = useState(0);
  const [createLoading, setCreateLoading] = useState(false);
  const [editingSong, setEditingSong] = useState(null);
  const [formData, setFormData] = useState(emptyFormData);
  const [audioFile, setAudioFile] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [showFullLyrics, setShowFullLyrics] = useState(false);
  const [artistOptions, setArtistOptions] = useState([]);

  const fetchSongs = useCallback(async () => {
    try {
      setLoading(true);
      const response = await songsApi.getAll({
        page: page + 1,
        limit: rowsPerPage,
        search: searchQuery.trim(),
      });
      setSongs(response.data.songs || []);
      setTotal(response.data.pagination?.total || 0);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load songs. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, searchQuery]);

  useEffect(() => {
    fetchSongs();
  }, [fetchSongs]);

  const fetchTopics = useCallback(async () => {
    try {
      const response = await topicsApi.getAll({ page: 1, limit: 1000 });
      setTopics(response.data.topics || []);
    } catch {
      setTopics([]);
    }
  }, []);

  useEffect(() => {
    fetchTopics();
  }, [fetchTopics]);

  useEffect(() => {
    const fetchArtists = async () => {
      try {
        const res = await accountsApi.getAll();
        const artists = (res.data?.accounts || []).filter((acc) => acc.role === 'artist');
        setArtistOptions(artists);
      } catch {
        setArtistOptions([]);
      }
    };
    fetchArtists();
  }, []);

  // Compute database source tallies
  const stats = useMemo(() => {
    const fromAdmin = songs.filter(s => s.source === 'admin').length;
    const fromArtist = songs.filter(s => s.source === 'artist').length;
    const fromUser = songs.filter(s => s.source !== 'admin' && s.source !== 'artist').length;
    return { fromAdmin, fromArtist, fromUser };
  }, [songs]);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    setPage(0);
  };

  const resetSongDialog = () => {
    setCreateDialogOpen(false);
    setEditingSong(null);
    setFormData(emptyFormData);
    setAudioFile(null);
    setImageFile(null);
    setShowFullLyrics(false);
    setDialogTab(0);
    setCreateLoading(false);
  };

  const handleDelete = async () => {
    if (!deleteDialog.song) return;

    try {
      setDeleteLoading(true);
      await songsApi.delete(deleteDialog.song._id);
      setDeleteDialog({ open: false, song: null });
      setSuccess('Song deleted successfully.');
      showToast({ severity: 'success', title: 'Success!', message: 'Song deleted successfully.' });
      fetchSongs();
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to delete song.';
      setError(message);
      showToast({ severity: 'error', title: 'Delete failed', message });
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleVisibilityChange = async (song) => {
    try {
      await songsApi.updateVisibility(song._id, !song.isPublic);
      setSuccess('Song visibility updated successfully.');
      showToast({ severity: 'success', title: 'Success!', message: 'Song visibility updated successfully.' });
      fetchSongs();
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to update song visibility.';
      setError(message);
      showToast({ severity: 'error', title: 'Update failed', message });
    }
  };

  const openCreateDialog = () => {
    setEditingSong(null);
    setFormData(emptyFormData);
    setAudioFile(null);
    setImageFile(null);
    setShowFullLyrics(false);
    setDialogTab(0);
    setCreateDialogOpen(true);
    setError(null);
    setSuccess(null);
  };

  const openEditDialog = (song) => {
    setEditingSong(song);
    setFormData({
      title: song.title || '',
      artists: Array.isArray(song.artists) ? song.artists.map((a) => a.name).filter(Boolean) : [],
      topicId: song.topicId?._id || song.topicId || '',
      lyrics: song.lyrics || '',
      isPublic: !!song.isPublic,
      imageUrl: song.imageUrl || '',
    });
    setAudioFile(null);
    setImageFile(null);
    setShowFullLyrics(false);
    setDialogTab(0);
    setCreateDialogOpen(true);
    setError(null);
    setSuccess(null);
  };

  const handleCreateSong = async () => {
    if (!formData.title.trim() || formData.artists.length === 0) {
      const message = 'Title and at least one artist are required.';
      setError(message);
      showToast({ severity: 'warning', title: 'Missing information', message });
      setDialogTab(0);
      return;
    }

    if (!editingSong && !audioFile) {
      const message = 'Audio file is required when creating a song.';
      setError(message);
      showToast({ severity: 'warning', title: 'Missing audio', message });
      setDialogTab(1);
      return;
    }

    const isEditing = Boolean(editingSong?._id);
    const loadingTitle = isEditing ? 'Updating song' : 'Uploading song';
    const loadingMessage = isEditing ? 'Your song changes are being saved...' : 'Your song is being uploaded...';
    let visualProgress = 0;
    let progressTimer = null;

    try {
      setCreateLoading(true);
      showToast({
        severity: 'info',
        title: loadingTitle,
        message: loadingMessage,
        loading: true,
        progress: 0,
      });
      progressTimer = window.setInterval(() => {
        const remaining = 94 - visualProgress;
        const nextStep = Math.max(0.45, remaining * 0.045);
        visualProgress = Math.min(94, visualProgress + nextStep);
        updateToast({ progress: Math.round(visualProgress) });
      }, 450);

      const payload = new FormData();
      payload.append('title', formData.title.trim());
      payload.append('artist', formData.artists.join(', '));
      payload.append('lyrics', formData.lyrics || '');
      payload.append('isPublic', String(formData.isPublic));
      payload.append('topicId', formData.topicId || '');
      if (audioFile) payload.append('audio', audioFile);
      if (imageFile) payload.append('image', imageFile);
      if (formData.imageUrl && formData.imageUrl.trim()) {
        payload.append('imageUrl', formData.imageUrl.trim());
      }

      if (isEditing) {
        await songsApi.update(editingSong._id, payload);
        setSuccess('Song updated successfully.');
      } else {
        await songsApi.create(payload);
        setSuccess('Song created successfully.');
      }
      if (progressTimer) window.clearInterval(progressTimer);
      progressTimer = null;
      updateToast({ progress: 100 });
      await wait(350);
      showToast({
        severity: 'success',
        title: 'Success!',
        message: isEditing ? 'Song updated successfully.' : 'Song created successfully.',
      });

      resetSongDialog();
      fetchSongs();
    } catch (err) {
      const message = err.response?.data?.message || (isEditing ? 'Failed to update song.' : 'Failed to create song.');
      setError(message);
      showToast({ severity: 'error', title: isEditing ? 'Update failed' : 'Create failed', message });
    } finally {
      if (progressTimer) window.clearInterval(progressTimer);
      setCreateLoading(false);
    }
  };

  const formatDuration = (seconds) => {
    const num = Number(seconds);
    if (isNaN(num) || num < 0) return '--:--';
    const mins = Math.floor(num / 60);
    const secs = Math.floor(num % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <Layout title="Songs Studio">
      <Stack spacing={3.5}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Stack spacing={0.5}>
            <Typography variant="h4" fontWeight={900} sx={{ letterSpacing: '-1px' }}>
              Tracks Catalog
            </Typography>
            <Typography variant="body2" color="text.secondary" fontWeight={500}>
              Kho bài hát toàn hệ thống. Thêm bài hát do Admin phát hành hoặc quản lý bản thu của Artist/User.
            </Typography>
          </Stack>
          <Stack direction="row" spacing={1.5}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={openCreateDialog}
              sx={{
                bgcolor: '#00bcd4',
                fontWeight: 800,
                textTransform: 'none',
                borderRadius: 3.5,
                px: 3,
                '&:hover': { bgcolor: '#0097a7' },
              }}
            >
              Thêm bài hát
            </Button>
            <IconButton onClick={fetchSongs} disabled={loading} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
              <RefreshIcon />
            </IconButton>
          </Stack>
        </Box>

        {error && (
          <Alert severity="error" variant="filled" onClose={() => setError(null)} sx={{ borderRadius: 4 }}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" variant="filled" onClose={() => setSuccess(null)} sx={{ borderRadius: 4 }}>
            {success}
          </Alert>
        )}

        {/* Stats Overview */}
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Paper elevation={0} sx={{ p: 2.5, borderRadius: 5, border: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ p: 1.5, borderRadius: 3, bgcolor: 'rgba(0, 188, 212, 0.08)', color: '#00bcd4' }}>
                <MusicNoteIcon />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={700}>TOTAL SONGS</Typography>
                <Typography variant="h5" fontWeight={900}>{total}</Typography>
              </Box>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Paper elevation={0} sx={{ p: 2.5, borderRadius: 5, border: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ p: 1.5, borderRadius: 3, bgcolor: 'rgba(108, 99, 255, 0.08)', color: '#6c63ff' }}>
                <AdminIcon />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={700}>ADMIN UPLOADS</Typography>
                <Typography variant="h5" fontWeight={900}>{stats.fromAdmin} (trang)</Typography>
              </Box>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Paper elevation={0} sx={{ p: 2.5, borderRadius: 5, border: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ p: 1.5, borderRadius: 3, bgcolor: 'rgba(255, 152, 0, 0.08)', color: '#ff9800' }}>
                <ArtistIcon />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={700}>ARTIST STUDIO UPLOADS</Typography>
                <Typography variant="h5" fontWeight={900}>{stats.fromArtist} (trang)</Typography>
              </Box>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Paper elevation={0} sx={{ p: 2.5, borderRadius: 5, border: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ p: 1.5, borderRadius: 3, bgcolor: 'rgba(16, 185, 129, 0.08)', color: '#10b981' }}>
                <UploadIcon />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={700}>USER UPLOADS</Typography>
                <Typography variant="h5" fontWeight={900}>{stats.fromUser} (trang)</Typography>
              </Box>
            </Paper>
          </Grid>
        </Grid>

        {/* Main Content Card Table */}
        <Card elevation={0} sx={{ borderRadius: 6, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', overflow: 'hidden' }}>
          <Box sx={{ p: 2.5, borderBottom: '1px solid', borderColor: 'divider', bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.01)' : 'rgba(0,0,0,0.01)' }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Tìm kiếm bài hát theo tiêu đề hoặc nghệ sĩ..."
              value={searchQuery}
              onChange={handleSearchChange}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="primary" />
                  </InputAdornment>
                ),
                sx: {
                  borderRadius: 4,
                  bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.03)' : '#f8fafc',
                }
              }}
            />
          </Box>

          <TableContainer>
            {loading ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 8, gap: 2 }}>
                <CircularProgress size={36} sx={{ color: '#00bcd4' }} />
                <Typography variant="body2" color="text.secondary" fontWeight={600}>Đang tải danh mục bài hát...</Typography>
              </Box>
            ) : (
              <Table sx={{ minWidth: 800 }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : '#f8fafc' }}>
                    <TableCell sx={{ fontWeight: 800, color: 'text.secondary', pl: 3 }}>Bài hát</TableCell>
                    <TableCell sx={{ fontWeight: 800, color: 'text.secondary' }}>Nghệ sĩ</TableCell>
                    <TableCell sx={{ fontWeight: 800, color: 'text.secondary' }}>Thời lượng</TableCell>
                    <TableCell sx={{ fontWeight: 800, color: 'text.secondary' }}>Nguồn Upload</TableCell>
                    <TableCell sx={{ fontWeight: 800, color: 'text.secondary' }}>Công khai</TableCell>
                    <TableCell sx={{ fontWeight: 800, color: 'text.secondary' }}>Ngày đăng</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800, color: 'text.secondary', pr: 3 }}>Hành động</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {songs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 8, color: 'text.secondary' }}>
                        Không có dữ liệu bài hát nào phù hợp.
                      </TableCell>
                    </TableRow>
                  ) : (
                    songs.map((song) => (
                      <TableRow key={song._id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                        <TableCell sx={{ pl: 3 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Avatar
                              src={song.imageUrl}
                              variant="rounded"
                              sx={{ bgcolor: '#00bcd4', width: 44, height: 44, borderRadius: 2.5, boxShadow: '0 2px 6px rgba(0,0,0,0.08)' }}
                            >
                              <MusicNoteIcon />
                            </Avatar>
                            <Typography fontWeight={700} noWrap sx={{ maxWidth: 180 }}>{song.title}</Typography>
                          </Box>
                        </TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>{song.artist}</TableCell>
                        <TableCell sx={{ fontWeight: 500, color: 'text.secondary' }}>{formatDuration(song.duration)}</TableCell>
                        <TableCell>
                          {song.source === 'admin' ? (
                            <Chip 
                              icon={<AdminIcon style={{ fontSize: 13, color: '#6c63ff' }} />}
                              label="Admin" 
                              size="small" 
                              sx={{ bgcolor: 'rgba(108, 99, 255, 0.08)', color: '#6c63ff', fontWeight: 700, borderRadius: 2 }} 
                            />
                          ) : song.source === 'artist' ? (
                            <Chip 
                              icon={<ArtistIcon style={{ fontSize: 13, color: '#ff9800' }} />}
                              label={song.uploadedBy?.name || 'Artist'} 
                              size="small" 
                              variant="outlined"
                              sx={{ borderColor: 'rgba(255, 152, 0, 0.3)', bgcolor: 'rgba(255, 152, 0, 0.04)', color: '#ff9800', fontWeight: 700, borderRadius: 2 }} 
                            />
                          ) : (
                            <Chip
                              icon={<UploadIcon style={{ fontSize: 13, color: '#10b981' }} />}
                              label={song.uploadedBy?.name || 'User'}
                              size="small"
                              variant="outlined"
                              sx={{ borderColor: 'rgba(16, 185, 129, 0.3)', bgcolor: 'rgba(16, 185, 129, 0.04)', color: '#10b981', fontWeight: 700, borderRadius: 2 }} 
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={song.isPublic}
                            onChange={() => handleVisibilityChange(song)}
                            size="small"
                            color="success"
                          />
                        </TableCell>
                        <TableCell sx={{ color: 'text.secondary', fontWeight: 500 }}>{formatDate(song.createdAt)}</TableCell>
                        <TableCell align="right" sx={{ pr: 3 }}>
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            <Tooltip title="Nghe thử" arrow>
                              <IconButton
                                size="small"
                                color="success"
                                onClick={() => window.open(song.audioUrl, '_blank')}
                                sx={{ bgcolor: 'rgba(76,175,80,0.06)', borderRadius: 3, border: '1px solid rgba(76,175,80,0.1)' }}
                              >
                                <PlayIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Sửa bài hát" arrow>
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => openEditDialog(song)}
                                sx={{ bgcolor: 'rgba(0,188,212,0.06)', borderRadius: 3, border: '1px solid rgba(0,188,212,0.1)' }}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Xóa bài hát" arrow>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => setDeleteDialog({ open: true, song })}
                                sx={{ bgcolor: 'rgba(211,47,47,0.06)', borderRadius: 3, border: '1px solid rgba(211,47,47,0.1)' }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </TableContainer>
          {!loading && songs.length > 0 && (
            <TablePagination
              rowsPerPageOptions={[5, 10, 25]}
              component="div"
              count={total}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              sx={{ borderTop: '1px solid', borderColor: 'divider' }}
            />
          )}
        </Card>
      </Stack>

      {/* Add/Edit Modal */}
      {/* Add/Edit Modal */}
      <Dialog
        open={createDialogOpen}
        onClose={resetSongDialog}
        TransitionComponent={Transition}
        maxWidth="sm"
        fullWidth
        PaperProps={{ 
          sx: { 
            borderRadius: 6, 
            overflow: 'hidden',
            boxShadow: '0 24px 64px rgba(0,0,0,0.15)',
          } 
        }}
      >
        <Box sx={{ background: 'linear-gradient(135deg, #6c63ff 0%, #00bcd4 100%)', p: 3, color: '#fff', display: 'flex', alignItems: 'center', gap: 2, position: 'relative' }}>
          <Box sx={{
            p: 1.25,
            borderRadius: 3,
            background: 'rgba(255, 255, 255, 0.2)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <MusicNoteIcon sx={{ fontSize: 24, color: '#fff' }} />
          </Box>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6" fontWeight={900} sx={{ color: '#fff', letterSpacing: '-0.5px', lineHeight: 1.2 }}>
              {editingSong ? 'Track Studio — Edit Song' : 'Track Studio — Upload Song'}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>
              Configure release metadata, lyrics sheets, audio files, and promotional artworks.
            </Typography>
          </Box>
          <IconButton 
            onClick={resetSongDialog} 
            disabled={createLoading}
            sx={{ 
              color: 'rgba(255,255,255,0.8)', 
              '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.12)' } 
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Navigation tabs */}
        <Box sx={{ px: 3, pt: 2, pb: 1, borderBottom: '1px solid', borderColor: 'divider', bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.01)' }}>
          <Tabs 
            value={dialogTab} 
            onChange={(e, val) => setDialogTab(val)}
            sx={{
              minHeight: 40,
              '& .MuiTabs-indicator': { display: 'none' },
              '& .MuiTabs-flexContainer': { gap: 1 }
            }}
          >
            <Tab 
              label="Thông tin chung" 
              sx={{
                minHeight: 36,
                textTransform: 'none',
                fontWeight: 700,
                borderRadius: 2.5,
                px: 3,
                fontSize: '0.875rem',
                transition: 'all 0.2s',
                color: 'text.secondary',
                '&.Mui-selected': {
                  color: '#fff',
                  bgcolor: '#6c63ff',
                  boxShadow: '0 4px 12px rgba(108, 99, 255, 0.3)'
                },
                '&.Mui-selected:hover': {
                  bgcolor: '#534bae',
                  color: '#fff'
                },
                '&:hover': {
                  bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'
                }
              }}
            />
            <Tab 
              label="File & Artwork" 
              sx={{
                minHeight: 36,
                textTransform: 'none',
                fontWeight: 700,
                borderRadius: 2.5,
                px: 3,
                fontSize: '0.875rem',
                transition: 'all 0.2s',
                color: 'text.secondary',
                '&.Mui-selected': {
                  color: '#fff',
                  bgcolor: '#6c63ff',
                  boxShadow: '0 4px 12px rgba(108, 99, 255, 0.3)'
                },
                '&.Mui-selected:hover': {
                  bgcolor: '#534bae',
                  color: '#fff'
                },
                '&:hover': {
                  bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'
                }
              }}
            />
          </Tabs>
        </Box>

        <DialogContent sx={{ p: 3, pt: 2, pb: 4 }}>
          {dialogTab === 0 && (
            <Stack spacing={2.5} sx={{ mt: 1.5 }}>
              <TextField
                fullWidth
                label="Tiêu đề bài hát *"
                value={formData.title}
                onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <MusicNoteIcon color="action" fontSize="small" />
                    </InputAdornment>
                  ),
                  sx: { borderRadius: 3.5 }
                }}
              />

              <Autocomplete
                multiple
                freeSolo
                options={artistOptions}
                getOptionLabel={(option) => typeof option === 'string' ? option : (option.name || '')}
                value={formData.artists}
                isOptionEqualToValue={(option, value) => {
                  const optionName = typeof option === 'string' ? option : option.name;
                  const valueName = typeof value === 'string' ? value : value.name;
                  return optionName === valueName;
                }}
                onChange={(_, newValue) => {
                  const artistNames = newValue.map((val) => typeof val === 'string' ? val : val.name);
                  setFormData((prev) => ({ ...prev, artists: artistNames }));
                }}
                renderTags={(tagValue, getTagProps) =>
                  tagValue.map((option, index) => {
                    const name = typeof option === 'string' ? option : option.name;
                    const artistObj = artistOptions.find((a) => a.name === name);
                    return (
                      <Chip
                        avatar={
                          <Avatar 
                            src={artistObj?.avatar || ''} 
                            sx={{ width: 18, height: 18, fontSize: 9 }}
                          >
                            {name.charAt(0)}
                          </Avatar>
                        }
                        label={name}
                        size="small"
                        {...getTagProps({ index })}
                        sx={{ borderRadius: 2 }}
                      />
                    );
                  })
                }
                renderOption={(props, option) => {
                  const name = typeof option === 'string' ? option : option.name;
                  const avatar = typeof option === 'string' ? '' : option.avatar;
                  return (
                    <Box component="li" {...props} key={option._id || name} sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1.25, px: 2 }}>
                      <Avatar 
                        src={avatar} 
                        variant="rounded" 
                        sx={{ width: 32, height: 32, fontSize: 14, bgcolor: '#00bcd4' }}
                      >
                        {name.charAt(0)}
                      </Avatar>
                      <Typography variant="body1" fontWeight={600}>{name}</Typography>
                    </Box>
                  );
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Nghệ sĩ phát hành *"
                    placeholder="Chọn hoặc nhập nghệ sĩ..."
                    helperText="Chọn từ danh sách gợi ý hoặc nhập tên nghệ sĩ mới rồi nhấn Enter."
                    InputProps={{
                      ...params.InputProps,
                      startAdornment: (
                        <>
                          <InputAdornment position="start">
                            <ArtistIcon color="action" fontSize="small" />
                          </InputAdornment>
                          {params.InputProps.startAdornment}
                        </>
                      ),
                      sx: { borderRadius: 3.5 }
                    }}
                  />
                )}
              />

              <Autocomplete
                options={topics}
                getOptionLabel={(option) => typeof option === 'string' ? option : (option.name || '')}
                value={topics.find((t) => t._id === formData.topicId) || null}
                onChange={(_, newValue) => {
                  setFormData((prev) => ({ ...prev, topicId: newValue ? newValue._id : '' }));
                }}
                isOptionEqualToValue={(option, value) => option._id === value._id}
                renderOption={(props, option) => (
                  <Box component="li" {...props} key={option._id} sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1.25, px: 2 }}>
                    <Avatar 
                      src={option.avatar} 
                      variant="rounded" 
                      sx={{ width: 32, height: 32, fontSize: 14, bgcolor: '#6c63ff' }}
                    >
                      <CategoryIcon sx={{ fontSize: 18 }} />
                    </Avatar>
                    <Typography variant="body1" fontWeight={600}>{option.name}</Typography>
                  </Box>
                )}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Chủ đề (Topic)"
                    placeholder="Chọn chủ đề..."
                    InputProps={{
                      ...params.InputProps,
                      startAdornment: (
                        <>
                          <InputAdornment position="start">
                            {formData.topicId ? (
                              (() => {
                                const selectedTopic = topics.find((t) => t._id === formData.topicId);
                                return (
                                  <Avatar 
                                    src={selectedTopic?.avatar} 
                                    variant="rounded" 
                                    sx={{ width: 20, height: 20, mr: 0.5, fontSize: 11 }}
                                  >
                                    {selectedTopic?.name?.charAt(0)}
                                  </Avatar>
                                );
                              })()
                            ) : (
                              <CategoryIcon color="action" fontSize="small" />
                            )}
                          </InputAdornment>
                          {params.InputProps.startAdornment}
                        </>
                      ),
                      sx: { borderRadius: 3.5 }
                    }}
                  />
                )}
              />

              <Box sx={{ position: 'relative' }}>
                <TextField
                  fullWidth
                  label="Lời bài hát"
                  multiline
                  minRows={6}
                  maxRows={showFullLyrics ? 20 : 8}
                  value={formData.lyrics}
                  onChange={(e) => setFormData((prev) => ({ ...prev, lyrics: e.target.value }))}
                  placeholder="Nhập lời bài hát hoặc cấu trúc LRC..."
                  InputProps={{
                    sx: { 
                      borderRadius: 3.5,
                      fontFamily: 'monospace',
                      fontSize: '0.875rem',
                      lineHeight: 1.6,
                      letterSpacing: '0.02em',
                    }
                  }}
                />
                {formData.lyrics && formData.lyrics.split('\n').length > 5 && (
                  <Button
                    size="small"
                    sx={{ position: 'absolute', right: 8, bottom: -28, textTransform: 'none', fontWeight: 700 }}
                    onClick={() => setShowFullLyrics((v) => !v)}
                  >
                    {showFullLyrics ? 'Thu gọn' : 'Xem đầy đủ'}
                  </Button>
                )}
              </Box>

              <Box sx={{ pt: 2.5 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.isPublic}
                      onChange={(e) => setFormData((prev) => ({ ...prev, isPublic: e.target.checked }))}
                    />
                  }
                  label="Đặt bài hát ở chế độ Công khai (Public)"
                />
              </Box>
            </Stack>
          )}

          {dialogTab === 1 && (
            <Stack spacing={3} sx={{ mt: 1.5 }}>
              {/* Audio Upload */}
              <Box>
                <Typography variant="subtitle2" fontWeight={800} color="text.secondary" sx={{ mb: 1.25 }}>
                  File âm thanh (Audio file) *
                </Typography>
                <Button
                  variant="outlined"
                  component="label"
                  fullWidth
                  sx={{
                    py: 4,
                    borderRadius: 4.5,
                    borderColor: audioFile ? 'success.main' : 'divider',
                    borderStyle: 'dashed',
                    borderWidth: 2,
                    bgcolor: audioFile ? 'rgba(76, 175, 80, 0.02)' : (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.01)',
                    color: 'text.secondary',
                    flexDirection: 'column',
                    gap: 1.5,
                    transition: 'all 0.3s',
                    '&:hover': {
                      borderColor: 'primary.main',
                      bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(108, 99, 255, 0.05)' : 'rgba(108, 99, 255, 0.02)',
                      boxShadow: '0 8px 24px rgba(108,99,255,0.04)'
                    }
                  }}
                >
                  {audioFile ? (
                    <>
                      <CheckCircleIcon color="success" sx={{ fontSize: 36 }} />
                      <Typography variant="subtitle2" fontWeight={800} color="success.main" sx={{ mt: 0.5 }}>
                        Đã chọn: {audioFile.name}
                      </Typography>
                      <Typography variant="caption">{(audioFile.size / (1024 * 1024)).toFixed(2)} MB</Typography>
                    </>
                  ) : (
                    <>
                      <AudioIcon sx={{ fontSize: 36, color: 'text.disabled' }} />
                      <Typography variant="body2" fontWeight={700}>
                        {editingSong ? 'Thay đổi file MP3 (Không bắt buộc)' : 'Nhấp để chọn file nhạc MP3 *'}
                      </Typography>
                    </>
                  )}
                  <input
                    hidden
                    type="file"
                    accept="audio/*"
                    onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
                  />
                </Button>
              </Box>

              {/* Cover Artwork */}
              <Box>
                <Typography variant="subtitle2" fontWeight={800} color="text.secondary" sx={{ mb: 1.25 }}>
                  Ảnh đại diện (Artwork image)
                </Typography>
                <Grid container spacing={2} alignItems="center">
                  <Grid size={{ xs: imageFile || formData.imageUrl ? 8 : 12 }}>
                    <Button
                      variant="outlined"
                      component="label"
                      fullWidth
                      sx={{
                        py: imageFile ? 2 : 2.5,
                        borderRadius: 4.5,
                        borderColor: imageFile ? 'success.main' : 'divider',
                        borderStyle: 'dashed',
                        borderWidth: 2,
                        bgcolor: imageFile ? 'rgba(76, 175, 80, 0.02)' : (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.01)',
                        color: 'text.secondary',
                        flexDirection: 'column',
                        gap: 0.5,
                        height: '100%',
                        transition: 'all 0.3s',
                        '&:hover': {
                          borderColor: 'primary.main',
                          bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(108, 99, 255, 0.05)' : 'rgba(108, 99, 255, 0.02)',
                        }
                      }}
                    >
                      {imageFile ? (
                        <>
                          <CheckCircleIcon color="success" sx={{ fontSize: 24 }} />
                          <Typography variant="body2" fontWeight={700} color="success.main" noWrap sx={{ maxWidth: '90%', mt: 0.5 }}>
                            {imageFile.name}
                          </Typography>
                        </>
                      ) : (
                        <>
                          <ImageIcon sx={{ fontSize: 24, color: 'text.disabled' }} />
                          <Typography variant="body2" fontWeight={700}>Tải ảnh lên từ thiết bị</Typography>
                        </>
                      )}
                      <input
                        hidden
                        type="file"
                        accept="image/*"
                        onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                      />
                    </Button>
                  </Grid>

                  {(imageFile || formData.imageUrl) && (
                    <Grid size={{ xs: 4 }}>
                      <Box sx={{ 
                        width: 72, 
                        height: 72, 
                        borderRadius: 3.5, 
                        border: '1px solid', 
                        borderColor: 'divider', 
                        overflow: 'hidden', 
                        bgcolor: 'action.hover',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                        mx: 'auto'
                      }}>
                        <img 
                          src={imageFile ? URL.createObjectURL(imageFile) : formData.imageUrl} 
                          alt="Cover preview" 
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                        />
                      </Box>
                    </Grid>
                  )}
                </Grid>
              </Box>

              <Divider sx={{ my: 0.5 }} />

              <TextField
                fullWidth
                label="Hoặc dán Link URL ảnh bìa"
                value={formData.imageUrl}
                onChange={(e) => setFormData((prev) => ({ ...prev, imageUrl: e.target.value }))}
                placeholder="https://..."
                helperText="Hệ thống ưu tiên sử dụng file tải lên từ thiết bị trước."
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <ImageIcon color="action" fontSize="small" />
                    </InputAdornment>
                  ),
                  sx: { borderRadius: 3.5 }
                }}
              />
            </Stack>
          )}
        </DialogContent>

        <DialogActions sx={{ 
          p: 3, 
          borderTop: '1px solid', 
          borderColor: 'divider', 
          bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(30, 30, 40, 0.9)' : 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(8px)',
          position: 'sticky',
          bottom: 0,
          zIndex: 10
        }}>
          <Button 
            onClick={resetSongDialog} 
            disabled={createLoading} 
            sx={{ 
              borderRadius: 3, 
              fontWeight: 700,
              textTransform: 'none',
              px: 3,
              color: 'text.secondary',
              '&:hover': { bgcolor: 'action.hover' }
            }}
          >
            Hủy bỏ
          </Button>
          <Button 
            variant="contained" 
            onClick={handleCreateSong} 
            disabled={createLoading}
            sx={{ 
              borderRadius: 3, 
              fontWeight: 800, 
              px: 4.5, 
              textTransform: 'none',
              bgcolor: '#00bcd4', 
              boxShadow: '0 4px 14px rgba(0, 188, 212, 0.35)',
              '&:hover': { 
                bgcolor: '#0097a7',
                boxShadow: '0 6px 20px rgba(0, 188, 212, 0.45)',
              } 
            }}
          >
            {createLoading ? <CircularProgress size={20} color="inherit" /> : editingSong ? 'Lưu thay đổi' : 'Tải lên'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialog.open} onClose={() => setDeleteDialog({ open: false, song: null })}>
        <DialogTitle sx={{ fontWeight: 800, color: 'error.main' }}>Xác nhận xóa bài hát</DialogTitle>
        <DialogContent>
          Bạn có chắc chắn muốn xóa bài hát <b>{deleteDialog.song?.title}</b> của {deleteDialog.song?.artist}?
          Hành động này sẽ loại bỏ vĩnh viễn tệp âm thanh khỏi máy chủ Cloudinary.
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button onClick={() => setDeleteDialog({ open: false, song: null })} disabled={deleteLoading} sx={{ borderRadius: 3, fontWeight: 700 }}>
            Hủy
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleDelete}
            disabled={deleteLoading}
            sx={{ borderRadius: 3, fontWeight: 800 }}
          >
            {deleteLoading ? <CircularProgress size={20} color="inherit" /> : 'Xác nhận xóa'}
          </Button>
        </DialogActions>
      </Dialog>
    </Layout>
  );
}

export default Songs;
