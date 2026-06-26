import { useState, useEffect, useCallback, useMemo } from 'react';
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  Stack,
  Divider,
  Grid,
  Tooltip,
  Card,
} from '@mui/material';
import {
  Search as SearchIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  PlaylistPlay as PlaylistIcon,
  Add as AddIcon,
  Edit as EditIcon,
  CloudUpload as CloudUploadIcon,
  CheckCircleRounded as CheckCircleIcon,
  ImageRounded as ImageIcon,
  PublicRounded as PublicIcon,
  VisibilityOffRounded as PrivateIcon,
} from '@mui/icons-material';
import { Layout } from '../../components/Layout';
import { playlistsApi, songsApi } from '../../services/api';
import useAppToast from '../../components/common/useAppToast';

const INITIAL_FORM_DATA = {
  name: '',
  description: '',
  isPublic: true,
  coverImage: '',
  songs: [],
};

function Playlists() {
  const { showToast } = useAppToast();
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [total, setTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchTimeout, setSearchTimeout] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, playlist: null });
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [songPickerOpen, setSongPickerOpen] = useState(false);
  const [songOptions, setSongOptions] = useState([]);
  const [songOptionsLoading, setSongOptionsLoading] = useState(false);
  const [songOptionsPage, setSongOptionsPage] = useState(0);
  const [songOptionsRowsPerPage, setSongOptionsRowsPerPage] = useState(10);
  const [songOptionsSearch, setSongOptionsSearch] = useState('');
  const [formDialog, setFormDialog] = useState({ open: false, mode: 'create', playlist: null });
  const [formData, setFormData] = useState(INITIAL_FORM_DATA);
  const [coverImageFile, setCoverImageFile] = useState(null);
  const [saveLoading, setSaveLoading] = useState(false);

  const filteredSongOptions = useMemo(() => {
    const keyword = songOptionsSearch.trim().toLowerCase();
    if (!keyword) return songOptions;
    return songOptions.filter((song) => {
      const title = String(song.title || '').toLowerCase();
      const artist = String(song.artist || '').toLowerCase();
      return title.includes(keyword) || artist.includes(keyword);
    });
  }, [songOptions, songOptionsSearch]);

  const displayedSongOptions = useMemo(() => {
    const selectedSet = new Set(formData.songs);
    const sorted = [...filteredSongOptions].sort((a, b) => {
      const aSelected = selectedSet.has(a._id) ? 1 : 0;
      const bSelected = selectedSet.has(b._id) ? 1 : 0;
      if (aSelected !== bSelected) return bSelected - aSelected;
      return String(a.title || '').localeCompare(String(b.title || ''), undefined, {
        sensitivity: 'base',
      });
    });
    const startIndex = songOptionsPage * songOptionsRowsPerPage;
    return sorted.slice(startIndex, startIndex + songOptionsRowsPerPage);
  }, [filteredSongOptions, formData.songs, songOptionsPage, songOptionsRowsPerPage]);

  const fetchPlaylists = useCallback(async () => {
    try {
      setLoading(true);
      const response = await playlistsApi.getAll({
        page: page + 1,
        limit: rowsPerPage,
        search: searchQuery,
      });
      setPlaylists(response.data.playlists);
      setTotal(response.data.pagination.total);
      setError(null);
    } catch {
      setError('Failed to load playlists. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, searchQuery]);

  useEffect(() => {
    fetchPlaylists();
  }, [fetchPlaylists]);

  const fetchSongOptions = useCallback(async () => {
    try {
      setSongOptionsLoading(true);
      const response = await songsApi.getAll({
        page: 1,
        limit: 2000,
      });
      const songs = response.data?.songs || [];
      setSongOptions(songs);
    } catch {
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

  // Derived statistics
  const stats = useMemo(() => {
    const totalCount = total;
    const publicCount = playlists.filter(p => p.isPublic).length;
    const privateCount = playlists.filter(p => !p.isPublic).length;
    const totalSongs = playlists.reduce((sum, p) => sum + (p.songs?.length || 0), 0);
    return { totalCount, publicCount, privateCount, totalSongs };
  }, [playlists, total]);

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
    if (!deleteDialog.playlist) return;
    
    try {
      setDeleteLoading(true);
      await playlistsApi.delete(deleteDialog.playlist._id);
      setDeleteDialog({ open: false, playlist: null });
      showToast({ severity: 'success', title: 'Success!', message: 'Playlist deleted successfully.' });
      fetchPlaylists();
    } catch {
      const message = 'Failed to delete playlist';
      setError(message);
      showToast({ severity: 'error', title: 'Delete failed', message });
    } finally {
      setDeleteLoading(false);
    }
  };

  const openCreateDialog = () => {
    setFormData(INITIAL_FORM_DATA);
    setCoverImageFile(null);
    setSongOptionsSearch('');
    setSongOptionsPage(0);
    setFormDialog({ open: true, mode: 'create', playlist: null });
  };

  const openEditDialog = (playlist) => {
    const songs = playlist.songs || [];
    setFormData({
      name: playlist.name || '',
      description: playlist.description || '',
      isPublic: playlist.isPublic ?? true,
      coverImage: playlist.coverImage || '',
      songs: songs.map((song) => song._id),
    });
    setCoverImageFile(null);
    setSongOptionsSearch('');
    setSongOptionsPage(0);
    setFormDialog({ open: true, mode: 'edit', playlist });
  };

  const closeFormDialog = () => {
    setSongPickerOpen(false);
    setFormDialog({ open: false, mode: 'create', playlist: null });
    setFormData(INITIAL_FORM_DATA);
    setCoverImageFile(null);
  };

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

  const handleSongOptionsPageChange = (event, newPage) => {
    setSongOptionsPage(newPage);
  };

  const handleSongOptionsRowsChange = (event) => {
    setSongOptionsRowsPerPage(parseInt(event.target.value, 10));
    setSongOptionsPage(0);
  };

  const handleOpenSongPicker = () => {
    setSongOptionsPage(0);
    setSongOptionsSearch('');
    setSongPickerOpen(true);
  };

  const handleSavePlaylist = async () => {
    if (!formData.name.trim()) {
      const message = 'Playlist name is required';
      setError(message);
      showToast({ severity: 'warning', title: 'Missing information', message });
      return;
    }

    let payload;
    if (coverImageFile) {
      payload = new FormData();
      payload.append('name', formData.name.trim());
      payload.append('description', formData.description.trim());
      payload.append('isPublic', String(formData.isPublic));
      payload.append('coverImage', formData.coverImage.trim());
      payload.append('songs', JSON.stringify(formData.songs));
      payload.append('coverImageFile', coverImageFile);
    } else {
      payload = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        isPublic: formData.isPublic,
        coverImage: formData.coverImage.trim(),
        songs: formData.songs,
      };
    }

    try {
      setSaveLoading(true);
      if (formDialog.mode === 'edit' && formDialog.playlist?._id) {
        await playlistsApi.update(formDialog.playlist._id, payload);
        showToast({ severity: 'success', title: 'Success!', message: 'Playlist updated successfully.' });
      } else {
        await playlistsApi.create(payload);
        showToast({ severity: 'success', title: 'Success!', message: 'Playlist created successfully.' });
      }
      closeFormDialog();
      fetchPlaylists();
      setError(null);
    } catch {
      const message = 'Failed to save playlist';
      setError(message);
      showToast({ severity: 'error', title: 'Save failed', message });
    } finally {
      setSaveLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <Layout title="Playlists Studio">
      <Stack spacing={3.5}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Stack spacing={0.5}>
            <Typography variant="h4" fontWeight={900} sx={{ letterSpacing: '-1px' }}>
              Playlists Hub
            </Typography>
            <Typography variant="body2" color="text.secondary" fontWeight={500}>
              Thiết lập danh sách phát (Playlists) hệ thống được phân phối công khai tới trang khách hàng.
            </Typography>
          </Stack>
          <Stack direction="row" spacing={1.5}>
            <Button 
              variant="contained" 
              startIcon={<AddIcon />} 
              onClick={openCreateDialog}
              sx={{
                bgcolor: '#ff9800',
                fontWeight: 800,
                textTransform: 'none',
                borderRadius: 3.5,
                px: 3,
                '&:hover': { bgcolor: '#e68a00' },
              }}
            >
              Tạo Playlist
            </Button>
            <IconButton onClick={fetchPlaylists} disabled={loading} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
              <RefreshIcon />
            </IconButton>
          </Stack>
        </Box>

        {error && (
          <Alert severity="error" variant="filled" onClose={() => setError(null)} sx={{ borderRadius: 4 }}>
            {error}
          </Alert>
        )}

        {/* Stats Overview */}
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Paper elevation={0} sx={{ p: 2.5, borderRadius: 5, border: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ p: 1.5, borderRadius: 3, bgcolor: 'rgba(255, 152, 0, 0.08)', color: '#ff9800' }}>
                <PlaylistIcon />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={700}>TOTAL PLAYLISTS</Typography>
                <Typography variant="h5" fontWeight={900}>{total}</Typography>
              </Box>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Paper elevation={0} sx={{ p: 2.5, borderRadius: 5, border: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ p: 1.5, borderRadius: 3, bgcolor: 'rgba(76, 175, 80, 0.08)', color: '#4caf50' }}>
                <PublicIcon />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={700}>PUBLIC PLATFORMS</Typography>
                <Typography variant="h5" fontWeight={900}>{stats.publicCount} (trang)</Typography>
              </Box>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Paper elevation={0} sx={{ p: 2.5, borderRadius: 5, border: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ p: 1.5, borderRadius: 3, bgcolor: 'rgba(158, 158, 158, 0.08)', color: '#9e9e9e' }}>
                <PrivateIcon />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={700}>PRIVATE CHANNELS</Typography>
                <Typography variant="h5" fontWeight={900}>{stats.privateCount} (trang)</Typography>
              </Box>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Paper elevation={0} sx={{ p: 2.5, borderRadius: 5, border: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ p: 1.5, borderRadius: 3, bgcolor: 'rgba(108, 99, 255, 0.08)', color: '#6c63ff' }}>
                <PlaylistIcon />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={700}>SONGS MAPPED</Typography>
                <Typography variant="h5" fontWeight={900}>{stats.totalSongs} bài hát</Typography>
              </Box>
            </Paper>
          </Grid>
        </Grid>

        {/* Filter Input */}
        <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 4 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Tìm kiếm danh sách phát theo tên gọi..."
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

        {/* Table View */}
        <Card elevation={0} sx={{ borderRadius: 6, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', overflow: 'hidden' }}>
          <TableContainer>
            {loading ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 8, gap: 2 }}>
                <CircularProgress size={36} sx={{ color: '#ff9800' }} />
                <Typography variant="body2" color="text.secondary" fontWeight={600}>Đang tải danh sách phát...</Typography>
              </Box>
            ) : (
              <Table sx={{ minWidth: 800 }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : '#f8fafc' }}>
                    <TableCell sx={{ fontWeight: 800, color: 'text.secondary', pl: 3 }}>Playlist</TableCell>
                    <TableCell sx={{ fontWeight: 800, color: 'text.secondary' }}>Số lượng bài hát</TableCell>
                    <TableCell sx={{ fontWeight: 800, color: 'text.secondary' }}>Chế độ hiển thị</TableCell>
                    <TableCell sx={{ fontWeight: 800, color: 'text.secondary' }}>Tác giả tạo</TableCell>
                    <TableCell sx={{ fontWeight: 800, color: 'text.secondary' }}>Ngày khởi tạo</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800, color: 'text.secondary', pr: 3 }}>Hành động</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {playlists.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 8, color: 'text.secondary' }}>
                        Không tìm thấy playlist nào phù hợp.
                      </TableCell>
                    </TableRow>
                  ) : (
                    playlists.map((playlist) => (
                      <TableRow key={playlist._id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                        <TableCell sx={{ pl: 3 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Avatar 
                              src={playlist.coverImage} 
                              variant="rounded"
                              sx={{ bgcolor: '#ff9800', width: 44, height: 44, borderRadius: 2.5, boxShadow: '0 2px 6px rgba(0,0,0,0.08)' }}
                            >
                              <PlaylistIcon />
                            </Avatar>
                            <Box sx={{ minWidth: 0 }}>
                              <Typography fontWeight={700} noWrap sx={{ maxWidth: 200 }}>{playlist.name}</Typography>
                              {playlist.description && (
                                <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', maxWidth: 220 }}>
                                  {playlist.description}
                                </Typography>
                              )}
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={`${playlist.songs?.length || 0} songs`}
                            size="small"
                            color="primary"
                            variant="outlined"
                            sx={{ fontWeight: 700, borderRadius: 2 }}
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            icon={playlist.isPublic ? <PublicIcon style={{ fontSize: 13 }} /> : <PrivateIcon style={{ fontSize: 13 }} />}
                            label={playlist.isPublic ? 'Public' : 'Private'}
                            size="small"
                            color={playlist.isPublic ? 'success' : 'default'}
                            sx={{ fontWeight: 700, borderRadius: 2 }}
                          />
                        </TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>
                          {playlist.createdBy?.name || 'Admin'}
                        </TableCell>
                        <TableCell sx={{ color: 'text.secondary', fontWeight: 500 }}>
                          {formatDate(playlist.createdAt)}
                        </TableCell>
                        <TableCell align="right" sx={{ pr: 3 }}>
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            <Tooltip title="Hiệu chỉnh playlist" arrow>
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => openEditDialog(playlist)}
                                sx={{ bgcolor: 'rgba(255,152,0,0.06)', borderRadius: 3, border: '1px solid rgba(255,152,0,0.1)' }}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Xóa playlist" arrow>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => setDeleteDialog({ open: true, playlist })}
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
          {!loading && playlists.length > 0 && (
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog.open} onClose={() => setDeleteDialog({ open: false, playlist: null })}>
        <DialogTitle sx={{ fontWeight: 800, color: 'error.main' }}>Xác nhận xóa playlist</DialogTitle>
        <DialogContent>
          Bạn có chắc chắn muốn xóa playlist <b>{deleteDialog.playlist?.name}</b>?
          Hành động này sẽ không thể hoàn tác. Các bài hát thuộc playlist sẽ không bị ảnh hưởng.
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setDeleteDialog({ open: false, playlist: null })} disabled={deleteLoading} sx={{ borderRadius: 3, fontWeight: 700 }}>
            Hủy bỏ
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

      {/* Form Dialog */}
      <Dialog
        open={formDialog.open}
        onClose={saveLoading ? undefined : closeFormDialog}
        fullWidth
        maxWidth="sm"
        PaperProps={{ sx: { borderRadius: 6, overflow: 'hidden' } }}
      >
        <Box sx={{ background: 'linear-gradient(135deg, #ff9800 0%, #6c63ff 100%)', p: 3.5, color: '#fff' }}>
          <Typography variant="h5" fontWeight={900}>
            {formDialog.mode === 'edit' ? 'Cập nhật Playlist' : 'Tạo Playlist mới'}
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.85, mt: 0.5 }}>
            Cấu hình tên gọi, mô tả chi tiết, hình ảnh đại diện và tuyển tập danh sách bài hát đi kèm.
          </Typography>
        </Box>

        <DialogContent sx={{ p: 4, pt: 3.5 }}>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField
              label="Tên Playlist *"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              required
              fullWidth
              InputProps={{ sx: { borderRadius: 3.5 } }}
            />
            <TextField
              label="Mô tả Playlist"
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              multiline
              minRows={2}
              fullWidth
              InputProps={{ sx: { borderRadius: 3.5 } }}
            />
            
            {/* Custom Cover Image Zone */}
            <Box>
              <Typography variant="subtitle2" fontWeight={800} color="text.secondary" sx={{ mb: 1.25 }}>
                Ảnh đại diện (Artwork Cover)
              </Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: coverImageFile || formData.coverImage ? 8 : 12 }}>
                  <Button
                    variant="outlined"
                    component="label"
                    fullWidth
                    sx={{
                      py: coverImageFile ? 1.5 : 2,
                      borderRadius: 4,
                      borderColor: coverImageFile ? 'success.main' : 'divider',
                      borderStyle: 'dashed',
                      borderWidth: 2,
                      bgcolor: coverImageFile ? 'rgba(46, 125, 50, 0.03)' : 'rgba(0,0,0,0.01)',
                      color: 'text.secondary',
                      flexDirection: 'column',
                      gap: 0.5,
                      height: '100%',
                      '&:hover': {
                        borderColor: 'primary.main',
                        bgcolor: 'rgba(108, 99, 255, 0.04)',
                      }
                    }}
                  >
                    {coverImageFile ? (
                      <>
                        <CheckCircleIcon color="success" sx={{ fontSize: 24 }} />
                        <Typography variant="body2" fontWeight={700} color="success.main" noWrap sx={{ maxWidth: '90%' }}>
                          {coverImageFile.name}
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
                      onChange={(e) => setCoverImageFile(e.target.files?.[0] || null)}
                    />
                  </Button>
                </Grid>

                {(coverImageFile || formData.coverImage) && (
                  <Grid size={{ xs: 4 }}>
                    <Box sx={{ width: '100%', height: 68, borderRadius: 3.5, border: '1px solid', borderColor: 'divider', overflow: 'hidden', bgcolor: 'action.hover' }}>
                      <img 
                        src={coverImageFile ? URL.createObjectURL(coverImageFile) : formData.coverImage} 
                        alt="Cover preview" 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                      />
                    </Box>
                  </Grid>
                )}
              </Grid>
            </Box>

            {coverImageFile && (
              <Button
                size="small"
                color="error"
                onClick={() => setCoverImageFile(null)}
                sx={{ alignSelf: 'flex-start', textTransform: 'none', fontWeight: 700 }}
              >
                Gỡ ảnh đã chọn
              </Button>
            )}

            <TextField
              label="Hoặc dán Link URL ảnh bìa"
              value={formData.coverImage}
              onChange={(e) => setFormData((prev) => ({ ...prev, coverImage: e.target.value }))}
              placeholder="https://..."
              helperText="Hệ thống ưu tiên sử dụng ảnh tải lên từ thiết bị trước."
              InputProps={{ sx: { borderRadius: 3.5 } }}
            />

            <FormControl fullWidth>
              <InputLabel id="playlist-visibility-label">Chế độ hiển thị</InputLabel>
              <Select
                labelId="playlist-visibility-label"
                value={formData.isPublic ? 'public' : 'private'}
                label="Chế độ hiển thị"
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, isPublic: e.target.value === 'public' }))
                }
                sx={{ borderRadius: 3.5 }}
              >
                <MenuItem value="public">Công khai (Public)</MenuItem>
                <MenuItem value="private">Riêng tư (Private)</MenuItem>
              </Select>
            </FormControl>

            <Divider sx={{ my: 0.5, borderStyle: 'dashed' }} />

            <Box>
              <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
                <Box>
                  <Typography variant="subtitle2" fontWeight={850}>Bài hát trong playlist</Typography>
                  <Typography variant="caption" color="text.secondary">Liên kết tuyển tập bài nhạc vào danh sách phát.</Typography>
                </Box>
                <Chip label={`${formData.songs.length} selected`} size="small" color="primary" sx={{ fontWeight: 700 }} />
              </Stack>
              <Button 
                variant="outlined" 
                onClick={handleOpenSongPicker}
                sx={{ borderRadius: 3, textTransform: 'none', fontWeight: 700 }}
              >
                Lựa chọn bài hát
              </Button>
            </Box>
          </Stack>
        </DialogContent>

        <DialogActions sx={{ p: 4, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
          <Button onClick={closeFormDialog} disabled={saveLoading} sx={{ borderRadius: 3, fontWeight: 700 }}>
            Hủy bỏ
          </Button>
          <Button
            variant="contained"
            onClick={handleSavePlaylist}
            disabled={saveLoading}
            sx={{ borderRadius: 3, fontWeight: 800, px: 4, bgcolor: '#ff9800', '&:hover': { bgcolor: '#e68a00' } }}
          >
            {saveLoading ? <CircularProgress size={20} color="inherit" /> : 'Lưu'}
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
        <DialogTitle sx={{ fontWeight: 800 }}>Lựa chọn bài hát trong Playlist</DialogTitle>
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
                          Không tìm thấy bài hát nào.
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
    </Layout>
  );
}

export default Playlists;
