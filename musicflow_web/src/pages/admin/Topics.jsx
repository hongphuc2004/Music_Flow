import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  Grid,
  Stack,
  Checkbox,
  Divider,
  Card,
  CardContent,
  CardMedia,
  Tooltip,
} from '@mui/material';
import {
  Search as SearchIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Add as AddIcon,
  Refresh as RefreshIcon,
  Category as CategoryIcon,
  CloudUpload as CloudUploadIcon,
  LibraryMusicRounded as TracksIcon,
  FeaturedPlayListRounded as TopicIcon,
} from '@mui/icons-material';
import { Layout } from '../../components/Layout';
import { topicsApi, songsApi } from '../../services/api';
import useAppToast from '../../components/common/useAppToast';

function Topics() {
  const { showToast } = useAppToast();
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(12); // Grid layout usually looks better with multiples of 3/4
  const [total, setTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchTimeout, setSearchTimeout] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, topic: null });
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [editDialog, setEditDialog] = useState({ open: false, topic: null });
  const [formData, setFormData] = useState({ name: '', description: '', avatarUrl: '', songs: [] });
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const fileInputRef = useRef(null);
  
  // Song picker state
  const [songPickerOpen, setSongPickerOpen] = useState(false);
  const [songOptions, setSongOptions] = useState([]);
  const [songOptionsLoading, setSongOptionsLoading] = useState(false);
  const [songOptionsPage, setSongOptionsPage] = useState(0);
  const [songOptionsRowsPerPage, setSongOptionsRowsPerPage] = useState(10);
  const [songOptionsSearch, setSongOptionsSearch] = useState('');

  const fetchTopics = useCallback(async () => {
    try {
      setLoading(true);
      const response = await topicsApi.getAll({
        page: page + 1,
        limit: rowsPerPage,
        search: searchQuery,
      });
      setTopics(response.data.topics);
      setTotal(response.data.pagination.total);
      setError(null);
    } catch {
      setError('Failed to load topics. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, searchQuery]);

  useEffect(() => {
    fetchTopics();
  }, [fetchTopics]);

  // Derived calculations
  const stats = useMemo(() => {
    const totalTopics = total;
    const totalSongsInTopics = topics.reduce((sum, t) => sum + (t.songCount || 0), 0);
    return { totalTopics, totalSongsInTopics };
  }, [topics, total]);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    
    if (searchTimeout) clearTimeout(searchTimeout);
    setSearchTimeout(setTimeout(() => {
      setPage(0);
    }, 500));
  };

  const handleDelete = async () => {
    if (!deleteDialog.topic) return;
    
    try {
      setDeleteLoading(true);
      await topicsApi.delete(deleteDialog.topic._id);
      setDeleteDialog({ open: false, topic: null });
      showToast({ severity: 'success', title: 'Success!', message: 'Topic deleted successfully.' });
      fetchTopics();
    } catch {
      const message = 'Failed to delete topic';
      setError(message);
      showToast({ severity: 'error', title: 'Delete failed', message });
    } finally {
      setDeleteLoading(false);
    }
  };

  const openEditDialog = async (topic = null) => {
    if (topic) {
      setFormLoading(true);
      try {
        const res = await topicsApi.getSongsByTopic(topic._id);
        const songIds = Array.isArray(res.data.songs) ? res.data.songs.map((s) => s._id) : [];
        setFormData({
          name: topic.name,
          description: topic.description || '',
          avatarUrl: topic.avatar || '',
          songs: songIds,
        });
        setAvatarPreview(topic.avatar || '');
      } catch {
        setFormData({
          name: topic.name,
          description: topic.description || '',
          avatarUrl: topic.avatar || '',
          songs: [],
        });
        setAvatarPreview(topic.avatar || '');
      } finally {
        setFormLoading(false);
      }
    } else {
      setFormData({ name: '', description: '', avatarUrl: '', songs: [] });
      setAvatarPreview('');
    }
    setAvatarFile(null);
    setEditDialog({ open: true, topic });
  };

  const handleCloseDialog = () => {
    setEditDialog({ open: false, topic: null });
    setAvatarFile(null);
    setAvatarPreview('');
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    try {
      setFormLoading(true);
      let submitData;
      if (avatarFile) {
        submitData = new FormData();
        submitData.append('name', formData.name);
        submitData.append('description', formData.description);
        submitData.append('avatar', avatarFile);
        submitData.append('songs', JSON.stringify(formData.songs));
      } else if (formData.avatarUrl && formData.avatarUrl.trim()) {
        submitData = new FormData();
        submitData.append('name', formData.name);
        submitData.append('description', formData.description);
        submitData.append('avatarUrl', formData.avatarUrl.trim());
        submitData.append('songs', JSON.stringify(formData.songs));
      } else {
        submitData = new FormData();
        submitData.append('name', formData.name);
        submitData.append('description', formData.description);
        submitData.append('songs', JSON.stringify(formData.songs));
      }
      if (editDialog.topic) {
        await topicsApi.update(editDialog.topic._id, submitData);
        showToast({ severity: 'success', title: 'Success!', message: 'Topic updated successfully.' });
      } else {
        await topicsApi.create(submitData);
        showToast({ severity: 'success', title: 'Success!', message: 'Topic created successfully.' });
      }
      handleCloseDialog();
      fetchTopics();
    } catch {
      const message = 'Failed to save topic';
      setError(message);
      showToast({ severity: 'error', title: 'Save failed', message });
    } finally {
      setFormLoading(false);
    }
  };
  
  const fetchSongOptions = useCallback(async () => {
    try {
      setSongOptionsLoading(true);
      const response = await songsApi.getAll({
        page: 1,
        limit: 2000,
      });
      let songs = response.data?.songs || [];
      setSongOptions(songs);
    } catch (err) {
      console.error('Failed to fetch song options:', err);
      setSongOptions([]);
    } finally {
      setSongOptionsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (songPickerOpen) {
      fetchSongOptions();
    }
  }, [songPickerOpen, fetchSongOptions]);

  const filteredSongOptions = React.useMemo(() => {
    const keyword = songOptionsSearch.trim().toLowerCase();
    if (!keyword) return songOptions;
    return songOptions.filter((song) => {
      const title = String(song.title || '').toLowerCase();
      const artist = String(song.artist || '').toLowerCase();
      return title.includes(keyword) || artist.includes(keyword);
    });
  }, [songOptions, songOptionsSearch]);

  const displayedSongOptions = React.useMemo(() => {
    const sorted = [...filteredSongOptions].sort((a, b) => {
      const aSelected = formData.songs.includes(a._id);
      const bSelected = formData.songs.includes(b._id);
      if (aSelected && !bSelected) return -1;
      if (!aSelected && bSelected) return 1;
      return 0;
    });
    const startIndex = songOptionsPage * songOptionsRowsPerPage;
    return sorted.slice(startIndex, startIndex + songOptionsRowsPerPage);
  }, [filteredSongOptions, formData.songs, songOptionsPage, songOptionsRowsPerPage]);

  const handleSongSearchChange = (event) => {
    setSongOptionsSearch(event.target.value);
    setSongOptionsPage(0);
  };

  const toggleSongSelection = (song) => {
    setFormData((prev) => {
      const exists = prev.songs.includes(song._id);
      return {
        ...prev,
        songs: exists
          ? prev.songs.filter((id) => id !== song._id)
          : [...prev.songs, song._id],
      };
    });
  };

  const handleOpenSongPicker = () => {
    setSongOptionsPage(0);
    setSongOptionsSearch('');
    setSongPickerOpen(true);
  };

  const handleSongOptionsPageChange = (event, newPage) => {
    setSongOptionsPage(newPage);
  };

  const handleSongOptionsRowsChange = (event) => {
    setSongOptionsRowsPerPage(parseInt(event.target.value, 10));
    setSongOptionsPage(0);
  };

  return (
    <Layout title="Topics Hub">
      <Stack spacing={3.5}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Stack spacing={0.5}>
            <Typography variant="h4" fontWeight={900} sx={{ letterSpacing: '-1px' }}>
              Topics Studio
            </Typography>
            <Typography variant="body2" color="text.secondary" fontWeight={500}>
              Phân loại album, thể loại hoặc cảm xúc chủ đạo (Moods, Genres, Topics).
            </Typography>
          </Stack>
          <Stack direction="row" spacing={1.5}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => openEditDialog()}
              sx={{
                bgcolor: '#6c63ff',
                fontWeight: 800,
                textTransform: 'none',
                borderRadius: 3.5,
                px: 3,
                '&:hover': { bgcolor: '#534bae' },
              }}
            >
              Thêm chủ đề
            </Button>
            <IconButton onClick={fetchTopics} disabled={loading} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
              <RefreshIcon />
            </IconButton>
          </Stack>
        </Box>

        {error && (
          <Alert severity="error" variant="filled" onClose={() => setError(null)} sx={{ borderRadius: 4 }}>
            {error}
          </Alert>
        )}

        {/* Derived Stats widgets */}
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Paper elevation={0} sx={{ p: 2.5, borderRadius: 5, border: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ p: 1.5, borderRadius: 3, bgcolor: 'rgba(108, 99, 255, 0.08)', color: '#6c63ff' }}>
                <TopicIcon />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={700}>TOTAL TOPICS</Typography>
                <Typography variant="h5" fontWeight={900}>{stats.totalTopics}</Typography>
              </Box>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Paper elevation={0} sx={{ p: 2.5, borderRadius: 5, border: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ p: 1.5, borderRadius: 3, bgcolor: 'rgba(0, 188, 212, 0.08)', color: '#00bcd4' }}>
                <TracksIcon />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={700}>CATEGORIZED SONGS</Typography>
                <Typography variant="h5" fontWeight={900}>{stats.totalSongsInTopics} bài hát</Typography>
              </Box>
            </Paper>
          </Grid>
        </Grid>

        {/* Filter Toolbar */}
        <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 4 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Tìm kiếm chủ đề theo tên gọi..."
            value={searchQuery}
            onChange={handleSearchChange}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="primary" />
                </InputAdornment>
              ),
              sx: {
                borderRadius: 3.5,
                bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.02)' : '#f8fafc',
              }
            }}
          />
        </Paper>

        {/* Visual Card Grid (Spotify style) */}
        {loading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 8, gap: 2 }}>
            <CircularProgress size={36} sx={{ color: '#6c63ff' }} />
            <Typography variant="body2" color="text.secondary" fontWeight={600}>Đang tải kho chủ đề...</Typography>
          </Box>
        ) : topics.length === 0 ? (
          <Paper sx={{ p: 8, textAlign: 'center', border: '1px dashed', borderColor: 'divider', borderRadius: 5 }}>
            <CategoryIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1.5 }} />
            <Typography variant="subtitle1" fontWeight={700} color="text.secondary">Không tìm thấy chủ đề nào</Typography>
            <Typography variant="body2" color="text.disabled">Tạo một chủ đề mới để bắt đầu phân loại bộ sưu tập âm nhạc của bạn.</Typography>
          </Paper>
        ) : (
          <Box>
            <Grid container spacing={3}>
              {topics.map((topic) => (
                <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={topic._id}>
                  <Card 
                    elevation={0}
                    sx={{ 
                      borderRadius: 5, 
                      border: '1px solid', 
                      borderColor: 'divider', 
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      overflow: 'hidden',
                      position: 'relative',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.01)',
                      '&:hover': {
                        boxShadow: '0 12px 28px rgba(108,99,255,0.08)',
                        borderColor: 'primary.main',
                        '& .topic-cover': { transform: 'scale(1.04)' },
                        '& .topic-actions-hover': { opacity: 1, transform: 'scale(1)' },
                      },
                      transition: 'all 0.25s ease'
                    }}
                  >
                    {/* Header Image Cover */}
                    <Box sx={{ position: 'relative', height: 130, overflow: 'hidden', bgcolor: 'action.hover' }}>
                      <CardMedia
                        component="img"
                        className="topic-cover"
                        image={topic.avatar || 'none'}
                        alt={topic.name}
                        sx={{
                          height: '100%',
                          objectFit: 'cover',
                          transition: 'transform 0.25s ease',
                          display: topic.avatar ? 'block' : 'none'
                        }}
                      />
                      {/* Fallback avatar box */}
                      {!topic.avatar && (
                        <Box sx={{ 
                          height: '100%', 
                          background: 'linear-gradient(135deg, #6c63ff 0%, #00bcd4 100%)', 
                          display: 'grid', 
                          placeItems: 'center', 
                          color: '#fff' 
                        }}>
                          <CategoryIcon sx={{ fontSize: 44 }} />
                        </Box>
                      )}

                    </Box>

                    <CardContent sx={{ p: 2.5, flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                      <Typography variant="h6" fontWeight={850} sx={{ lineHeight: 1.3, mb: 1 }} noWrap>
                        {topic.name}
                      </Typography>
                      <Typography 
                        variant="body2" 
                        color="text.secondary" 
                        sx={{ 
                          lineHeight: 1.5, 
                          mb: 2.5,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          height: 40,
                          fontWeight: 500
                        }}
                      >
                        {topic.description || 'Không có mô tả chi tiết cho chủ đề này.'}
                      </Typography>

                      <Divider sx={{ my: 1.5, borderStyle: 'dashed' }} />
                      
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 'auto' }}>
                        <Chip
                          icon={<TracksIcon style={{ fontSize: 13 }} />}
                          label={`${topic.songCount || 0} tracks`}
                          size="small"
                          color="primary"
                          variant="outlined"
                          sx={{ fontWeight: 700, borderRadius: 2 }}
                        />
                        {/* Hover/Touch Actions */}
                        <Box 
                          className="topic-actions-hover"
                          sx={{ 
                            opacity: { xs: 1, md: 0 }, 
                            transform: { xs: 'none', md: 'scale(0.85)' },
                            transition: 'opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1), transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                            display: 'flex',
                            gap: 1
                          }}
                        >
                          <Tooltip title="Hiệu chỉnh chủ đề" arrow>
                            <IconButton 
                              size="small" 
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditDialog(topic);
                              }}
                              sx={{ 
                                color: 'primary.main', 
                                bgcolor: 'rgba(108, 99, 255, 0.08)',
                                border: '1px solid',
                                borderColor: 'rgba(108, 99, 255, 0.15)',
                                p: 0.75,
                                '&:hover': { 
                                  bgcolor: 'primary.main', 
                                  color: '#fff',
                                  borderColor: 'primary.main',
                                } 
                              }}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Xóa chủ đề" arrow>
                            <IconButton 
                              size="small" 
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteDialog({ open: true, topic });
                              }}
                              sx={{ 
                                color: 'error.main', 
                                bgcolor: 'rgba(239, 68, 68, 0.08)',
                                border: '1px solid',
                                borderColor: 'rgba(239, 68, 68, 0.15)',
                                p: 0.75,
                                '&:hover': { 
                                  bgcolor: 'error.main', 
                                  color: '#fff',
                                  borderColor: 'error.main',
                                } 
                              }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>

            {/* Pagination Controls */}
            {topics.length > 0 && (
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 4 }}>
                <TablePagination
                  rowsPerPageOptions={[6, 12, 24]}
                  component="div"
                  count={total}
                  rowsPerPage={rowsPerPage}
                  page={page}
                  onPageChange={handleChangePage}
                  onRowsPerPageChange={handleChangeRowsPerPage}
                  sx={{ border: 'none' }}
                />
              </Box>
            )}
          </Box>
        )}
      </Stack>

      {/* Edit/Create Dialog */}
      <Dialog 
        open={editDialog.open} 
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 6, overflow: 'hidden' } }}
      >
        <Box sx={{ background: 'linear-gradient(135deg, #6c63ff 0%, #00bcd4 100%)', p: 3.5, color: '#fff' }}>
          <Typography variant="h5" fontWeight={900}>
            {editDialog.topic ? 'Hiệu chỉnh Chủ đề' : 'Tạo Chủ đề mới'}
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.85, mt: 0.5 }}>
            Thiết lập danh mục nhạc phân phối theo chủ đề hoặc định dạng thể loại.
          </Typography>
        </Box>
        
        <DialogContent sx={{ p: 4, pt: 3.5 }}>
          <Grid container spacing={2.5} sx={{ mt: 0.5 }}>
            {/* Cover image preview & file select */}
            <Grid size={{ xs: 12 }}>
              <Stack direction="row" spacing={3} alignItems="center">
                <Avatar
                  src={avatarPreview || formData.avatarUrl}
                  sx={{ width: 90, height: 90, bgcolor: '#6c63ff', borderRadius: 4, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                >
                  <CategoryIcon sx={{ fontSize: 44 }} />
                </Avatar>
                <Stack spacing={1} sx={{ flexGrow: 1 }}>
                  <input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    onChange={handleAvatarChange}
                    style={{ display: 'none' }}
                  />
                  <Button
                    variant="outlined"
                    startIcon={<CloudUploadIcon />}
                    onClick={() => fileInputRef.current.click()}
                    sx={{ borderColor: '#6c63ff', color: '#6c63ff', borderRadius: 3, textTransform: 'none', fontWeight: 700 }}
                  >
                    Chọn file ảnh bìa
                  </Button>
                  {avatarFile && (
                    <Typography variant="caption" color="success.main" fontWeight={700}>
                      ✓ {avatarFile.name}
                    </Typography>
                  )}
                </Stack>
              </Stack>
            </Grid>

            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Tên chủ đề *"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                InputProps={{ sx: { borderRadius: 3.5 } }}
              />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Mô tả chi tiết"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                multiline
                rows={3}
                InputProps={{ sx: { borderRadius: 3.5 } }}
              />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Hoặc dán Link URL ảnh bìa"
                value={formData.avatarUrl}
                onChange={(e) => setFormData((prev) => ({ ...prev, avatarUrl: e.target.value }))}
                placeholder="https://..."
                helperText="Chấp nhận mọi liên kết ảnh trực tuyến."
                InputProps={{ sx: { borderRadius: 3.5 } }}
              />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <Divider sx={{ my: 1, borderStyle: 'dashed' }} />
              <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="subtitle2" fontWeight={800}>Bài hát thuộc chủ đề</Typography>
                  <Typography variant="caption" color="text.secondary">Quản lý danh sách nhạc trực thuộc chủ đề này.</Typography>
                </Box>
                <Chip label={`${formData.songs.length} selected`} size="small" color="primary" sx={{ fontWeight: 700 }} />
              </Stack>
              <Button 
                variant="outlined" 
                onClick={handleOpenSongPicker} 
                sx={{ mt: 1.5, borderRadius: 3, textTransform: 'none', fontWeight: 700 }}
              >
                Lựa chọn bài hát
              </Button>
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions sx={{ p: 4, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
          <Button onClick={handleCloseDialog} disabled={formLoading} sx={{ borderRadius: 3, fontWeight: 700 }}>
            Hủy bỏ
          </Button>
          <Button 
            variant="contained" 
            onClick={handleSave}
            disabled={formLoading || !formData.name}
            sx={{ borderRadius: 3, fontWeight: 800, px: 4, bgcolor: '#6c63ff', '&:hover': { bgcolor: '#534bae' } }}
          >
            {formLoading ? <CircularProgress size={20} color="inherit" /> : 'Lưu'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Song Picker Dialog */}
      <Dialog
        open={songPickerOpen}
        onClose={() => setSongPickerOpen(false)}
        fullWidth
        maxWidth="md"
        PaperProps={{ sx: { borderRadius: 5 } }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>Lựa chọn bài hát trong Topic</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            size="small"
            placeholder="Tìm kiếm bài hát theo tên bài hoặc nghệ sĩ..."
            value={songOptionsSearch}
            onChange={handleSongSearchChange}
            sx={{ mt: 1.5, mb: 2 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="primary" />
                </InputAdornment>
              ),
              sx: { borderRadius: 3.5 }
            }}
          />
          <Divider sx={{ mb: 2 }} />
          
          {songOptionsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={28} />
            </Box>
          ) : (
            <>
              <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3.5, overflow: 'hidden' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'action.hover' }}>
                      <TableCell width={80} sx={{ fontWeight: 700 }}>Chọn</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Tên bài hát</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Nghệ sĩ</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {displayedSongOptions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} align="center" sx={{ py: 4 }}>
                          Không tìm thấy bản nhạc nào.
                        </TableCell>
                      </TableRow>
                    ) : (
                      displayedSongOptions.map((song) => {
                        const checked = formData.songs.includes(song._id);
                        return (
                          <TableRow key={song._id} hover>
                            <TableCell>
                              <Checkbox
                                checked={checked}
                                onChange={() => toggleSongSelection(song)}
                              />
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>{song.title}</TableCell>
                            <TableCell sx={{ color: 'text.secondary', fontWeight: 500 }}>{song.artist}</TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                rowsPerPageOptions={[10, 20, 50]}
                component="div"
                count={filteredSongOptions.length}
                rowsPerPage={songOptionsRowsPerPage}
                page={songOptionsPage}
                onPageChange={handleSongOptionsPageChange}
                onRowsPerPageChange={handleSongOptionsRowsChange}
              />
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setSongPickerOpen(false)} variant="contained" sx={{ borderRadius: 2.5, fontWeight: 700, px: 3 }}>
            Xong
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog.open} onClose={() => setDeleteDialog({ open: false, topic: null })}>
        <DialogTitle sx={{ fontWeight: 800, color: 'error.main' }}>Xác nhận xóa chủ đề</DialogTitle>
        <DialogContent>
          Bạn có chắc chắn muốn xóa chủ đề <b>{deleteDialog.topic?.name}</b>?
          Các ca khúc thuộc chủ đề này sẽ tạm thời bị gỡ phân loại chủ đề (không bị xóa khỏi hệ thống).
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, topic: null })} disabled={deleteLoading} sx={{ borderRadius: 3, fontWeight: 700 }}>
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

export default Topics;
