import React, { useState, useEffect, useMemo } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Grid,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  CloudUpload as CloudUploadIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  MusicNoteRounded as MusicNoteIcon,
  PlayArrow as PlayIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import ArtistLayout from '../../components/Layout/artist/ArtistLayout';
import api from '../../services/api';
import useAppToast from '../../components/common/useAppToast';

function ArtistSong() {
  const { showToast } = useAppToast();
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingSong, setEditingSong] = useState(null);
  const [formData, setFormData] = useState({ title: '', lyrics: '', imageUrl: '', collaborators: '' });
  const [audioFile, setAudioFile] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [showFullLyrics, setShowFullLyrics] = useState(false);
  
  const [deleteDialog, setDeleteDialog] = useState({ open: false, song: null });
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchSongs = async () => {
    setLoading(true);
    setError(null);
    try {
      const artistId = localStorage.getItem('artistId');
      const artistName = localStorage.getItem('artistName');
      const res = await api.get(
        `/songs/by-artist?${artistId ? `artistId=${artistId}` : `name=${encodeURIComponent(artistName)}`}&limit=1000`
      );
      setSongs(res.data.songs || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể tải danh sách bài hát.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSongs();
  }, []);

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    setPage(0);
  };

  const filteredSongs = useMemo(() => {
    return songs.filter((s) =>
      s.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [songs, searchQuery]);

  const openCreateDialog = () => {
    setEditingSong(null);
    setFormData({ title: '', lyrics: '', imageUrl: '', collaborators: '' });
    setAudioFile(null);
    setImageFile(null);
    setShowFullLyrics(false);
    setCreateDialogOpen(true);
    setError(null);
  };

  const openEditDialog = (song) => {
    setEditingSong(song);
    setFormData({
      title: song.title || '',
      lyrics: song.lyrics || '',
      imageUrl: song.imageUrl || '',
      collaborators: song.artists
        ?.filter((a) => a?._id && a._id !== localStorage.getItem('artistId'))
        .map((a) => a?.name || a?.email || a?._id)
        .filter(Boolean)
        .join(', ') || '',
    });
    setAudioFile(null);
    setImageFile(null);
    setShowFullLyrics(false);
    setCreateDialogOpen(true);
    setError(null);
  };

  const handleCreateSong = async () => {
    if (!formData.title.trim()) {
      const message = 'Tiêu đề bài hát không được để trống.';
      setError(message);
      showToast({ severity: 'warning', title: 'Thiếu thông tin', message });
      return;
    }
    if (!editingSong && !audioFile) {
      const message = 'File audio (mp3) là bắt buộc khi thêm bài hát.';
      setError(message);
      showToast({ severity: 'warning', title: 'Thiếu file audio', message });
      return;
    }

    setCreateLoading(true);
    setError(null);
    
    try {
      const artistId = localStorage.getItem('artistId');
      if (!artistId) throw new Error('Không tìm thấy thông tin Artist hiện tại.');

      const uploadData = new FormData();
      uploadData.append('title', formData.title.trim());
      const collaboratorTokens = String(formData.collaborators || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
      uploadData.append('artists', JSON.stringify([artistId, ...collaboratorTokens]));
      uploadData.append('lyrics', formData.lyrics || '');
      uploadData.append('imageUrl', formData.imageUrl || '');
      uploadData.append('isPublic', 'true');
      
      if (audioFile) uploadData.append('audio', audioFile);
      if (imageFile) uploadData.append('image', imageFile);

      if (editingSong) {
        await api.put(`/songs/${editingSong._id}`, uploadData);
        showToast({ severity: 'success', title: 'Thành công!', message: 'Đã cập nhật bài hát thành công.' });
      } else {
        await api.post('/songs', uploadData);
        showToast({ severity: 'success', title: 'Thành công!', message: 'Đã thêm bài hát mới thành công.' });
      }
      setCreateDialogOpen(false);
      fetchSongs();
    } catch (err) {
      console.error(err);
      const message = err.response?.data?.message || err.message || 'Không thể lưu bài hát.';
      setError(message);
      showToast({ severity: 'error', title: 'Lưu thất bại', message });
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog.song) return;
    setDeleteLoading(true);
    setError(null);
    try {
      await api.delete(`/songs/${deleteDialog.song._id}`);
      setDeleteDialog({ open: false, song: null });
      showToast({ severity: 'success', title: 'Thành công!', message: 'Đã xóa bài hát thành công.' });
      fetchSongs();
    } catch (err) {
      const message = err.response?.data?.message || 'Không thể xóa bài hát.';
      setError(message);
      showToast({ severity: 'error', title: 'Xóa thất bại', message });
    } finally {
      setDeleteLoading(false);
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <ArtistLayout title="Songs Management">
      <Stack spacing={3}>
        {error && <Alert severity="error">{error}</Alert>}

        {/* Dashboard-style Header Card */}
        <Card
          elevation={0}
          sx={{
            overflow: 'hidden',
            borderRadius: 6,
            border: '1px solid rgba(15, 23, 42, 0.08)',
            background: 'linear-gradient(135deg, #0f172a 0%, #1d4ed8 48%, #38bdf8 100%)',
            color: '#fff',
          }}
        >
          <Box
            sx={{
              p: { xs: 3, md: 4 },
              background:
                'radial-gradient(circle at top right, rgba(255,255,255,0.24), transparent 22%), radial-gradient(circle at left bottom, rgba(255,255,255,0.12), transparent 24%)',
            }}
          >
            <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={2}>
              <Box>
                <Typography variant="h4" fontWeight={700} sx={{ mb: 1 }}>
                  My Songs
                </Typography>
                <Typography variant="body1" sx={{ opacity: 0.85, maxWidth: 500 }}>
                  Quản lý danh sách các bài hát của bạn đã tải lên hệ thống. Bạn có thể thêm bài mới hoặc chỉnh sửa bài hiện có.
                </Typography>
              </Box>
              <Stack direction="row" spacing={2}>
                <Button
                  variant="outlined"
                  onClick={fetchSongs}
                  disabled={loading}
                  startIcon={<RefreshIcon />}
                  sx={{
                    color: '#fff',
                    borderColor: 'rgba(255,255,255,0.4)',
                    textTransform: 'none',
                    borderRadius: 3,
                    '&:hover': {
                      borderColor: '#fff',
                      bgcolor: 'rgba(255,255,255,0.1)',
                    },
                  }}
                >
                  Refresh
                </Button>
                <Button
                  variant="contained"
                  onClick={openCreateDialog}
                  startIcon={<AddIcon />}
                  sx={{
                    bgcolor: '#fff',
                    color: '#0f172a',
                    textTransform: 'none',
                    fontWeight: 600,
                    borderRadius: 3,
                    px: 3,
                    '&:hover': {
                      bgcolor: 'rgba(255,255,255,0.9)',
                    },
                  }}
                >
                  Upload Song
                </Button>
              </Stack>
            </Stack>
          </Box>
        </Card>

        {/* Content Table */}
        <Card elevation={0} sx={{ borderRadius: 6, border: '1px solid rgba(15, 23, 42, 0.08)' }}>
          <Box sx={{ p: 2, borderBottom: '1px solid rgba(15, 23, 42, 0.05)' }}>
            <TextField
              size="small"
              placeholder="Tìm kiếm bài hát của bạn..."
              value={searchQuery}
              onChange={handleSearchChange}
              sx={{ minWidth: { xs: '100%', sm: 320 } }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" />
                  </InputAdornment>
                ),
                sx: { borderRadius: 3, bgcolor: '#f8fafc' },
              }}
            />
          </Box>

          <TableContainer>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
                <CircularProgress />
              </Box>
            ) : (
              <Table sx={{ minWidth: 600 }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: 'rgba(15, 23, 42, 0.02)' }}>
                    <TableCell sx={{ fontWeight: 600, py: 2 }}>Song</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Duration</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Created</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Public</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredSongs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                        {searchQuery ? 'Không tìm thấy bài hát nào khớp với tìm kiếm.' : 'Chưa có bài hát nào được tải lên.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSongs
                      .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                      .map((song) => (
                        <TableRow key={song._id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                          <TableCell>
                            <Stack direction="row" alignItems="center" spacing={2}>
                              <Avatar
                                src={song.imageUrl}
                                variant="rounded"
                                sx={{ width: 48, height: 48, borderRadius: 2, bgcolor: 'primary.light' }}
                              >
                                <MusicNoteIcon />
                              </Avatar>
                              <Box>
                                <Typography variant="subtitle2" fontWeight={600} noWrap sx={{ maxWidth: 200 }}>
                                  {song.title}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {song.artists?.map(a => a.name).join(', ')}
                                </Typography>
                              </Box>
                            </Stack>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color="text.secondary">
                              {formatDuration(song.duration)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color="text.secondary">
                              {song.createdAt ? new Date(song.createdAt).toLocaleDateString('vi-VN') : '--'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Switch
                              checked={song.isPublic}
                              size="small"
                              color="success"
                              onChange={async (e) => {
                                const newStatus = e.target.checked;
                                try {
                                  // Optimistic Update
                                  setSongs(songs.map(s => s._id === song._id ? { ...s, isPublic: newStatus } : s));
                                  await api.put(`/songs/${song._id}`, { isPublic: newStatus });
                                  showToast({
                                    severity: 'success',
                                    title: 'Thành công!',
                                    message: newStatus ? 'Bài hát đã được công khai.' : 'Bài hát đã chuyển sang riêng tư.',
                                  });
                                } catch (err) {
                                  console.error("Failed to update status", err);
                                  // Revert on failure
                                  setSongs(songs.map(s => s._id === song._id ? { ...s, isPublic: !newStatus } : s));
                                  showToast({
                                    severity: 'error',
                                    title: 'Cập nhật thất bại',
                                    message: err.response?.data?.message || 'Không thể đổi trạng thái bài hát.',
                                  });
                                }
                              }}
                            />
                            <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                              {song.isPublic ? 'Public' : 'Private'}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Stack direction="row" justifyContent="flex-end" spacing={0.5}>
                              <IconButton
                                size="small"
                                onClick={() => window.open(song.audioUrl, '_blank')}
                                sx={{ color: 'action.active' }}
                              >
                                <PlayIcon fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => openEditDialog(song)}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => setDeleteDialog({ open: true, song })}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      ))
                  )}
                </TableBody>
              </Table>
            )}
          </TableContainer>
          {!loading && filteredSongs.length > 0 && (
            <TablePagination
              component="div"
              count={filteredSongs.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={(e, newPage) => setPage(newPage)}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(0);
              }}
              rowsPerPageOptions={[5, 10, 25]}
            />
          )}
        </Card>
      </Stack>

      {/* Create/Edit Dialog */}
      <Dialog
        open={createDialogOpen}
        onClose={() => !createLoading && setCreateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 4 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>
          {editingSong ? 'Chỉnh sửa bài hát' : 'Tải lên bài hát mới'}
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 3 }}>
            {editingSong
              ? 'Bạn có thể chỉnh sửa tiêu đề, lời bài hát hoặc thay đổi file âm thanh/ảnh bìa.'
              : 'Tải lên file MP3 và cung cấp thông tin bài hát để xuất bản.'}
          </DialogContentText>
          <Stack spacing={2.5}>
            <TextField
              fullWidth
              label="Tiêu đề bài hát *"
              value={formData.title}
              onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
              InputProps={{ sx: { borderRadius: 3 } }}
            />

            <TextField
              fullWidth
              label="Thêm nghệ sĩ"
              value={formData.collaborators}
              onChange={(e) => setFormData((prev) => ({ ...prev, collaborators: e.target.value }))}
              placeholder="VD: artist2@email.com, Nguyen Van A"
              helperText="Nhập nhiều nghệ sĩ, cách nhau bằng dấu phẩy"
              InputProps={{ sx: { borderRadius: 3 } }}
            />
            
            <Box sx={{ position: 'relative' }}>
              <TextField
                fullWidth
                label="Lời bài hát"
                multiline
                minRows={3}
                maxRows={showFullLyrics ? 15 : 5}
                value={formData.lyrics}
                onChange={(e) => setFormData((prev) => ({ ...prev, lyrics: e.target.value }))}
                InputProps={{ sx: { borderRadius: 3 } }}
              />
              {formData.lyrics?.split('\n').length > 5 && (
                <Button
                  size="small"
                  sx={{ position: 'absolute', right: 8, bottom: -28, textTransform: 'none' }}
                  onClick={() => setShowFullLyrics(v => !v)}
                >
                  {showFullLyrics ? 'Rút gọn' : 'Xem thêm'}
                </Button>
              )}
            </Box>

            <Box sx={{ pt: showFullLyrics || (formData.lyrics?.split('\n').length > 5) ? 2 : 0 }} />

            <Button
              variant="outlined"
              component="label"
              startIcon={<CloudUploadIcon />}
              fullWidth
              sx={{
                py: 1.5,
                borderRadius: 3,
                justifyContent: 'flex-start',
                px: 2,
                color: 'text.secondary',
                borderColor: 'divider',
                borderStyle: 'dashed',
              }}
            >
              <Typography noWrap sx={{ flex: 1, textAlign: 'left' }}>
                {audioFile
                  ? `🎵 ${audioFile.name}`
                  : editingSong
                    ? 'Thay đổi File MP3 (Tùy chọn)'
                    : 'Tải File MP3 *'}
              </Typography>
              <input
                hidden
                type="file"
                accept="audio/*"
                onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
              />
            </Button>

            <Button
              variant="outlined"
              component="label"
              startIcon={<CloudUploadIcon />}
              fullWidth
              sx={{
                py: 1.5,
                borderRadius: 3,
                justifyContent: 'flex-start',
                px: 2,
                color: 'text.secondary',
                borderColor: 'divider',
                borderStyle: 'dashed',
              }}
            >
              <Typography noWrap sx={{ flex: 1, textAlign: 'left' }}>
                {imageFile
                  ? `🖼️ ${imageFile.name}`
                  : 'Tải Ảnh Bìa (Tùy chọn)'}
              </Typography>
              <input
                hidden
                type="file"
                accept="image/*"
                onChange={(e) => setImageFile(e.target.files?.[0] || null)}
              />
            </Button>
            
            <TextField
              fullWidth
              label="Hoặc dán Link URL Ảnh bìa"
              value={formData.imageUrl}
              onChange={(e) => setFormData((prev) => ({ ...prev, imageUrl: e.target.value }))}
              placeholder="https://..."
              helperText="Nếu có sẵn link ảnh."
              InputProps={{ sx: { borderRadius: 3 } }}
            />          
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button
            onClick={() => setCreateDialogOpen(false)}
            disabled={createLoading}
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
          >
            Hủy
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateSong}
            disabled={createLoading}
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600, px: 3, minWidth: 120 }}
          >
            {createLoading ? <CircularProgress size={24} color="inherit" /> : editingSong ? 'Lưu Thay Đổi' : 'Tải Lên'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog
        open={deleteDialog.open}
        onClose={() => !deleteLoading && setDeleteDialog({ open: false, song: null })}
        PaperProps={{ sx: { borderRadius: 4, minWidth: 400 } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Xác nhận xóa</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Bạn có chắc muốn xóa bài hát <b>{deleteDialog.song?.title}</b>? Hành động này không thể hoàn tác.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button
            onClick={() => setDeleteDialog({ open: false, song: null })}
            disabled={deleteLoading}
            sx={{ borderRadius: 2, fontWeight: 600, color: 'text.secondary' }}
          >
            Hủy bỏ
          </Button>
          <Button
            onClick={handleDelete}
            color="error"
            variant="contained"
            disabled={deleteLoading}
            sx={{ borderRadius: 2, fontWeight: 600 }}
          >
            {deleteLoading ? <CircularProgress size={20} color="inherit" /> : 'Xóa bài hát'}
          </Button>
        </DialogActions>
      </Dialog>
    </ArtistLayout>
  );
}

export default ArtistSong;
