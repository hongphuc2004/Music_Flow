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
  Tabs,
  Tab,
  Tooltip,
  Divider,
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
  AudioFileRounded as AudioIcon,
  ImageRounded as ImageIcon,
  CheckCircleRounded as CheckCircleIcon,
  FeaturedPlayListRounded as PlaylistIcon,
  PublicRounded as PublicIcon,
  VisibilityOffRounded as PrivateIcon,
  QueueMusicRounded as QueueMusicIcon,
} from '@mui/icons-material';
import ArtistLayout from '../../components/Layout/artist/ArtistLayout';
import api from '../../services/api';
import useAppToast from '../../components/common/useAppToast';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function ArtistSong() {
  const { showToast, updateToast } = useAppToast();
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  
  // Dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [dialogTab, setDialogTab] = useState(0);
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

  // Statistics
  const stats = useMemo(() => {
    const total = songs.length;
    const publicSongs = songs.filter(s => s.isPublic).length;
    const privateSongs = total - publicSongs;
    return { total, publicSongs, privateSongs };
  }, [songs]);

  const openCreateDialog = () => {
    setEditingSong(null);
    setFormData({ title: '', lyrics: '', imageUrl: '', collaborators: '' });
    setAudioFile(null);
    setImageFile(null);
    setShowFullLyrics(false);
    setDialogTab(0);
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
    setDialogTab(0);
    setCreateDialogOpen(true);
    setError(null);
  };

  const handleCreateSong = async () => {
    if (!formData.title.trim()) {
      const message = 'Tiêu đề bài hát không được để trống.';
      setError(message);
      showToast({ severity: 'warning', title: 'Thiếu thông tin', message });
      setDialogTab(0); // Switch to General Tab
      return;
    }
    if (!editingSong && !audioFile) {
      const message = 'File audio (mp3) là bắt buộc khi thêm bài hát.';
      setError(message);
      showToast({ severity: 'warning', title: 'Thiếu file audio', message });
      setDialogTab(1); // Switch to Files Tab
      return;
    }

    const isEditing = Boolean(editingSong?._id);
    const loadingTitle = isEditing ? 'Đang cập nhật' : 'Đang tải lên';
    const loadingMessage = isEditing ? 'Bài hát của bạn đang được cập nhật...' : 'Bài hát của bạn đang được tải lên...';
    let visualProgress = 0;
    let progressTimer = null;
    
    try {
      setCreateLoading(true);
      setError(null);
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

      if (isEditing) {
        await api.put(`/songs/${editingSong._id}`, uploadData);
      } else {
        await api.post('/songs', uploadData);
      }
      if (progressTimer) window.clearInterval(progressTimer);
      progressTimer = null;
      updateToast({ progress: 100 });
      await wait(350);
      showToast({
        severity: 'success',
        title: 'Thành công!',
        message: isEditing ? 'Đã cập nhật bài hát thành công.' : 'Đã thêm bài hát mới thành công.',
      });
      setCreateDialogOpen(false);
      fetchSongs();
    } catch (err) {
      console.error(err);
      const message = err.response?.data?.message || err.message || 'Không thể lưu bài hát.';
      setError(message);
      showToast({ severity: 'error', title: 'Lưu thất bại', message });
    } finally {
      if (progressTimer) window.clearInterval(progressTimer);
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
    <ArtistLayout title="Songs Studio">
      <Stack spacing={3.5}>
        {error && (
          <Alert 
            severity="error" 
            variant="filled" 
            onClose={() => setError(null)}
            sx={{ borderRadius: 4, fontWeight: 500 }}
          >
            {error}
          </Alert>
        )}

        {/* Dashboard-style Header Card */}
        <Card
          elevation={0}
          sx={{
            overflow: 'hidden',
            borderRadius: 6,
            background: (theme) => theme.palette.mode === 'dark'
              ? 'linear-gradient(135deg, rgba(108, 99, 255, 0.95) 0%, rgba(0, 188, 212, 0.9) 100%)'
              : 'linear-gradient(135deg, #6c63ff 0%, #00bcd4 100%)',
            boxShadow: '0 8px 32px 0 rgba(108, 99, 255, 0.25)',
            color: '#fff',
            position: 'relative',
          }}
        >
          {/* Decorative mesh shapes */}
          <Box
            sx={{
              position: 'absolute',
              top: -60,
              right: -60,
              width: 240,
              height: 240,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255,255,255,0.2) 0%, transparent 70%)',
              pointerEvents: 'none',
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              bottom: -50,
              left: 100,
              width: 180,
              height: 180,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
              pointerEvents: 'none',
            }}
          />

          <Box sx={{ p: { xs: 3.5, md: 5.5 }, position: 'relative', zIndex: 1 }}>
            <Grid container spacing={3} alignItems="center">
              <Grid size={{ xs: 12, md: 7 }}>
                <Stack spacing={1}>
                  <Typography variant="h3" fontWeight={900} sx={{ letterSpacing: '-1.5px', textShadow: '0 2px 10px rgba(0,0,0,0.15)' }}>
                    My Studio Catalog
                  </Typography>
                  <Typography variant="body1" sx={{ opacity: 0.9, fontWeight: 500, maxWidth: 520, lineHeight: 1.6 }}>
                    Quản lý toàn bộ thư viện âm nhạc của bạn tại đây. Đăng tải sản phẩm mới, chỉnh sửa thông tin metadata, lời bài hát, và cập nhật trạng thái phân phối.
                  </Typography>
                </Stack>
                
                {/* Stats row */}
                <Stack direction="row" spacing={3} sx={{ mt: 4 }} flexWrap="wrap" gap={1.5}>
                  <Box sx={{ bgcolor: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(10px)', px: 2.5, py: 1.5, borderRadius: 4, border: '1px solid rgba(255,255,255,0.2)' }}>
                    <Typography variant="caption" sx={{ display: 'block', opacity: 0.8, fontWeight: 600 }}>TỔNG BÀI HÁT</Typography>
                    <Typography variant="h4" fontWeight={900}>{stats.total}</Typography>
                  </Box>
                  <Box sx={{ bgcolor: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(10px)', px: 2.5, py: 1.5, borderRadius: 4, border: '1px solid rgba(255,255,255,0.2)' }}>
                    <Typography variant="caption" sx={{ display: 'block', opacity: 0.8, fontWeight: 600 }}>CÔNG KHAI (PUBLIC)</Typography>
                    <Typography variant="h4" fontWeight={900}>{stats.publicSongs}</Typography>
                  </Box>
                  <Box sx={{ bgcolor: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(10px)', px: 2.5, py: 1.5, borderRadius: 4, border: '1px solid rgba(255,255,255,0.2)' }}>
                    <Typography variant="caption" sx={{ display: 'block', opacity: 0.8, fontWeight: 600 }}>RIÊNG TƯ (PRIVATE)</Typography>
                    <Typography variant="h4" fontWeight={900}>{stats.privateSongs}</Typography>
                  </Box>
                </Stack>
              </Grid>
              
              <Grid size={{ xs: 12, md: 5 }} sx={{ display: 'flex', justifyContent: { xs: 'flex-start', md: 'flex-end' }, gap: 2 }}>
                <Button
                  variant="outlined"
                  onClick={fetchSongs}
                  disabled={loading}
                  startIcon={<RefreshIcon />}
                  sx={{
                    color: '#fff',
                    borderColor: 'rgba(255,255,255,0.35)',
                    borderWidth: 2,
                    textTransform: 'none',
                    borderRadius: 4,
                    px: 3,
                    py: 1.5,
                    fontWeight: 700,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                    '&:hover': {
                      borderColor: '#fff',
                      borderWidth: 2,
                      bgcolor: 'rgba(255,255,255,0.1)',
                    },
                  }}
                >
                  Làm mới
                </Button>
                <Button
                  variant="contained"
                  onClick={openCreateDialog}
                  startIcon={<AddIcon />}
                  sx={{
                    bgcolor: '#fff',
                    color: '#6c63ff',
                    textTransform: 'none',
                    fontWeight: 800,
                    borderRadius: 4,
                    px: 4,
                    py: 1.5,
                    boxShadow: '0 10px 20px rgba(0,0,0,0.12)',
                    '&:hover': {
                      bgcolor: 'rgba(255,255,255,0.9)',
                      transform: 'translateY(-2px)',
                      boxShadow: '0 12px 24px rgba(0,0,0,0.18)',
                    },
                    transition: 'all 0.2s ease',
                  }}
                >
                  Upload Track
                </Button>
              </Grid>
            </Grid>
          </Box>
        </Card>

        {/* Content Table Card */}
        <Card 
          elevation={0} 
          sx={{ 
            borderRadius: 6, 
            border: '1px solid', 
            borderColor: 'divider', 
            bgcolor: 'background.paper',
            boxShadow: '0 4px 20px rgba(0,0,0,0.02)',
            overflow: 'hidden',
          }}
        >
          {/* Table Header Filter Action Row */}
          <Stack 
            direction={{ xs: 'column', sm: 'row' }} 
            spacing={2} 
            alignItems={{ xs: 'stretch', sm: 'center' }} 
            justifyContent="space-between" 
            sx={{ p: 3, borderBottom: '1px solid', borderColor: 'divider', bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.01)' }}
          >
            <Typography variant="h6" fontWeight={800} color="text.primary">
              Track List ({filteredSongs.length})
            </Typography>

            <TextField
              size="small"
              placeholder="Tìm kiếm theo tiêu đề bài hát..."
              value={searchQuery}
              onChange={handleSearchChange}
              sx={{ minWidth: { xs: '100%', sm: 360 } }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="primary" />
                  </InputAdornment>
                ),
                sx: {
                  borderRadius: 4,
                  bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.04)' : '#f8fafc',
                  border: '1px solid',
                  borderColor: 'divider',
                  '& fieldset': { border: 'none' },
                  '&:hover': {
                    bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.06)' : '#f1f5f9',
                  },
                },
              }}
            />
          </Stack>

          <TableContainer>
            {loading ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 10, gap: 2 }}>
                <CircularProgress size={40} thickness={4.5} sx={{ color: '#6c63ff' }} />
                <Typography color="text.secondary" fontWeight={600}>Đang tải kho nhạc...</Typography>
              </Box>
            ) : (
              <Table sx={{ minWidth: 650 }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : '#f8fafc' }}>
                    <TableCell sx={{ fontWeight: 800, py: 2.5, pl: 3, color: 'text.secondary' }}>Track</TableCell>
                    <TableCell sx={{ fontWeight: 800, color: 'text.secondary' }}>Thời lượng</TableCell>
                    <TableCell sx={{ fontWeight: 800, color: 'text.secondary' }}>Ngày tải</TableCell>
                    <TableCell sx={{ fontWeight: 800, color: 'text.secondary' }}>Phân phối</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800, pr: 3, color: 'text.secondary' }}>Hành động</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredSongs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 10 }}>
                        <Stack spacing={1.5} alignItems="center" justifyContent="center">
                          <Box sx={{ p: 2, borderRadius: '50%', bgcolor: 'action.hover' }}>
                            <QueueMusicIcon sx={{ fontSize: 44, color: 'text.disabled' }} />
                          </Box>
                          <Typography variant="subtitle1" fontWeight={700} color="text.secondary">
                            {searchQuery ? 'Không tìm thấy kết quả phù hợp' : 'Chưa có bài hát nào'}
                          </Typography>
                          <Typography variant="body2" color="text.disabled" sx={{ maxWidth: 300 }}>
                            {searchQuery ? 'Hãy thử tìm kiếm với từ khóa hoặc tên bài hát khác.' : 'Đăng tải bản thu âm MP3 đầu tiên của bạn để giới thiệu tài năng.'}
                          </Typography>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSongs
                      .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                      .map((song) => (
                        <TableRow 
                          key={song._id} 
                          hover 
                          sx={{ 
                            '&:last-child td, &:last-child th': { border: 0 },
                            transition: 'background-color 0.2s ease',
                            cursor: 'pointer',
                          }}
                        >
                          {/* Title & Artist */}
                          <TableCell sx={{ pl: 3, py: 2 }}>
                            <Stack direction="row" alignItems="center" spacing={2.5}>
                              <Avatar
                                src={song.imageUrl}
                                variant="rounded"
                                sx={{ 
                                  width: 54, 
                                  height: 54, 
                                  borderRadius: 3.5, 
                                  bgcolor: 'primary.light',
                                  boxShadow: '0 4px 10px rgba(0,0,0,0.08)',
                                  border: '1px solid',
                                  borderColor: 'divider',
                                }}
                              >
                                <MusicNoteIcon sx={{ fontSize: 28 }} />
                              </Avatar>
                              <Box sx={{ minWidth: 0 }}>
                                <Typography variant="subtitle2" fontWeight={800} noWrap sx={{ maxWidth: { xs: 150, sm: 260 } }}>
                                  {song.title}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" fontWeight={600} noWrap sx={{ display: 'block', mt: 0.25 }}>
                                  {song.artists?.map(a => a.name).join(', ')}
                                </Typography>
                              </Box>
                            </Stack>
                          </TableCell>

                          {/* Duration */}
                          <TableCell>
                            <Typography variant="body2" fontWeight={600} color="text.primary">
                              {formatDuration(song.duration)}
                            </Typography>
                          </TableCell>

                          {/* Created date */}
                          <TableCell>
                            <Typography variant="body2" color="text.secondary" fontWeight={500}>
                              {song.createdAt ? new Date(song.createdAt).toLocaleDateString('vi-VN', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '--'}
                            </Typography>
                          </TableCell>

                          {/* Public Switch */}
                          <TableCell>
                            <Stack direction="row" alignItems="center" spacing={1}>
                              <Switch
                                checked={song.isPublic}
                                size="medium"
                                color="success"
                                onChange={async (e) => {
                                  const newStatus = e.target.checked;
                                  try {
                                    setSongs(songs.map(s => s._id === song._id ? { ...s, isPublic: newStatus } : s));
                                    await api.put(`/songs/${song._id}`, { isPublic: newStatus });
                                    showToast({
                                      severity: 'success',
                                      title: 'Đã cập nhật',
                                      message: newStatus ? 'Bản nhạc đã được công khai trên nền tảng.' : 'Bản nhạc đã chuyển sang trạng thái lưu trữ riêng tư.',
                                    });
                                  } catch (err) {
                                    console.error("Failed to update status", err);
                                    setSongs(songs.map(s => s._id === song._id ? { ...s, isPublic: !newStatus } : s));
                                    showToast({
                                      severity: 'error',
                                      title: 'Cập nhật thất bại',
                                      message: err.response?.data?.message || 'Không thể đổi trạng thái bài hát.',
                                    });
                                  }
                                }}
                                sx={{
                                  '& .MuiSwitch-switchBase.Mui-checked': {
                                    color: '#00bcd4',
                                  },
                                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                                    bgcolor: '#00bcd4',
                                  }
                                }}
                              />
                              <Chip
                                icon={song.isPublic ? <PublicIcon style={{ fontSize: 14 }} /> : <PrivateIcon style={{ fontSize: 14 }} />}
                                label={song.isPublic ? 'Public' : 'Private'}
                                size="small"
                                variant="outlined"
                                color={song.isPublic ? 'success' : 'default'}
                                sx={{ 
                                  fontWeight: 700, 
                                  borderRadius: 2, 
                                  fontSize: '0.7rem',
                                  border: 'none',
                                  bgcolor: song.isPublic ? 'rgba(46, 125, 50, 0.08)' : 'rgba(0,0,0,0.04)',
                                }}
                              />
                            </Stack>
                          </TableCell>

                          {/* Actions */}
                          <TableCell align="right" sx={{ pr: 3 }}>
                            <Stack direction="row" justifyContent="flex-end" spacing={1}>
                              <Tooltip title="Nghe thử" arrow>
                                <IconButton
                                  size="small"
                                  onClick={() => window.open(song.audioUrl, '_blank')}
                                  sx={{ 
                                    color: 'info.main', 
                                    bgcolor: 'info.lighter',
                                    borderRadius: 3.5,
                                    border: '1px solid',
                                    borderColor: 'info.light',
                                    p: 1,
                                    '&:hover': { bgcolor: 'info.main', color: '#fff' }
                                  }}
                                >
                                  <PlayIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Chỉnh sửa thông tin" arrow>
                                <IconButton
                                  size="small"
                                  color="primary"
                                  onClick={() => openEditDialog(song)}
                                  sx={{ 
                                    bgcolor: 'rgba(108, 99, 255, 0.08)',
                                    borderRadius: 3.5,
                                    border: '1px solid rgba(108, 99, 255, 0.15)',
                                    p: 1,
                                    '&:hover': { bgcolor: '#6c63ff', color: '#fff' }
                                  }}
                                >
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Xóa bài hát" arrow>
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => setDeleteDialog({ open: true, song })}
                                  sx={{ 
                                    bgcolor: 'rgba(211, 47, 47, 0.08)',
                                    borderRadius: 3.5,
                                    border: '1px solid rgba(211, 47, 47, 0.15)',
                                    p: 1,
                                    '&:hover': { bgcolor: 'error.main', color: '#fff' }
                                  }}
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
              sx={{ borderTop: '1px solid', borderColor: 'divider' }}
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
        PaperProps={{ 
          sx: { 
            borderRadius: 6,
            boxShadow: '0 24px 48px rgba(0,0,0,0.2)',
            overflow: 'hidden',
          } 
        }}
      >
        {/* Banner Dialog Header */}
        <Box sx={{ 
          background: 'linear-gradient(135deg, #6c63ff 0%, #00bcd4 100%)', 
          p: 3.5, 
          pb: 4.5,
          color: '#fff',
          position: 'relative' 
        }}>
          <Typography variant="h5" fontWeight={900}>
            {editingSong ? 'Hiệu chỉnh tác phẩm' : 'Đăng tải bài hát mới'}
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.85, mt: 0.5 }}>
            {editingSong
              ? 'Cập nhật lại thông tin mô tả, nghệ sĩ đồng hành hoặc thay mới files media.'
              : 'Chia sẻ giai điệu chất lượng cao định dạng MP3 cùng hình ảnh artwork nổi bật.'}
          </Typography>
          
          {/* Custom Tabs inside header */}
          <Box sx={{ position: 'absolute', bottom: 0, left: 16, right: 16 }}>
            <Tabs 
              value={dialogTab} 
              onChange={(e, val) => setDialogTab(val)}
              textColor="inherit"
              indicatorColor="primary"
              sx={{
                '& .MuiTabs-indicator': {
                  backgroundColor: '#fff',
                  height: 3,
                  borderRadius: 1.5,
                },
                '& .MuiTab-root': {
                  fontWeight: 700,
                  opacity: 0.7,
                  '&.Mui-selected': { opacity: 1 }
                }
              }}
            >
              <Tab label="Thông tin chung" id="general-tab" />
              <Tab label="File & Artwork" id="files-tab" />
            </Tabs>
          </Box>
        </Box>

        <DialogContent sx={{ p: 4, pt: 3, mt: 1 }}>
          {dialogTab === 0 && (
            <Stack spacing={3}>
              <TextField
                fullWidth
                label="Tiêu đề bài hát *"
                value={formData.title}
                onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                InputProps={{ sx: { borderRadius: 3.5 } }}
              />

              <TextField
                fullWidth
                label="Nghệ sĩ cộng tác"
                value={formData.collaborators}
                onChange={(e) => setFormData((prev) => ({ ...prev, collaborators: e.target.value }))}
                placeholder="Ví dụ: collab@artist.com, Nguyễn Văn A"
                helperText="Nhập địa chỉ email hoặc tên nghệ sĩ, phân tách bằng dấu phẩy."
                InputProps={{ sx: { borderRadius: 3.5 } }}
              />
              
              <Box sx={{ position: 'relative' }}>
                <TextField
                  fullWidth
                  label="Lời bài hát"
                  multiline
                  minRows={3}
                  maxRows={showFullLyrics ? 12 : 5}
                  value={formData.lyrics}
                  onChange={(e) => setFormData((prev) => ({ ...prev, lyrics: e.target.value }))}
                  InputProps={{ sx: { borderRadius: 3.5 } }}
                  placeholder="Điền lời bài hát hoặc cấu trúc LRC đồng bộ..."
                />
                {formData.lyrics?.split('\n').length > 5 && (
                  <Button
                    size="small"
                    sx={{ position: 'absolute', right: 8, bottom: -28, textTransform: 'none', fontWeight: 700 }}
                    onClick={() => setShowFullLyrics(v => !v)}
                  >
                    {showFullLyrics ? 'Thu gọn' : 'Xem đầy đủ'}
                  </Button>
                )}
              </Box>
            </Stack>
          )}

          {dialogTab === 1 && (
            <Stack spacing={3.5}>
              {/* Audio Upload Area */}
              <Box>
                <Typography variant="subtitle2" fontWeight={800} color="text.secondary" sx={{ mb: 1.25 }}>
                  File âm thanh (Audio File) *
                </Typography>
                <Button
                  variant="outlined"
                  component="label"
                  fullWidth
                  sx={{
                    py: 3,
                    borderRadius: 4,
                    borderColor: audioFile ? 'success.main' : 'divider',
                    borderStyle: 'dashed',
                    borderWidth: 2,
                    bgcolor: audioFile ? 'rgba(46, 125, 50, 0.03)' : 'rgba(0,0,0,0.01)',
                    color: 'text.secondary',
                    flexDirection: 'column',
                    gap: 1,
                    '&:hover': {
                      borderColor: 'primary.main',
                      bgcolor: 'rgba(108, 99, 255, 0.04)',
                    }
                  }}
                >
                  {audioFile ? (
                    <>
                      <CheckCircleIcon color="success" sx={{ fontSize: 36 }} />
                      <Typography variant="subtitle2" fontWeight={800} color="success.main">
                        Đã chọn: {audioFile.name}
                      </Typography>
                      <Typography variant="caption">
                        {(audioFile.size / (1024 * 1024)).toFixed(2)} MB
                      </Typography>
                    </>
                  ) : (
                    <>
                      <AudioIcon sx={{ fontSize: 36, color: 'text.disabled' }} />
                      <Typography variant="subtitle2" fontWeight={700}>
                        {editingSong ? 'Thay đổi file MP3 (Nếu có)' : 'Kéo thả hoặc click để chọn file MP3'}
                      </Typography>
                      <Typography variant="caption" color="text.disabled">
                        Chấp nhận định dạng file: .mp3, .wav (Tối đa 15MB)
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

              {/* Cover Artwork Upload Area */}
              <Box>
                <Typography variant="subtitle2" fontWeight={800} color="text.secondary" sx={{ mb: 1.25 }}>
                  Hình đại diện (Artwork Image)
                </Typography>
                <Grid container spacing={2}>
                  <Grid size={{ xs: imageFile || formData.imageUrl ? 8 : 12 }}>
                    <Button
                      variant="outlined"
                      component="label"
                      fullWidth
                      sx={{
                        py: imageFile ? 2 : 2.5,
                        borderRadius: 4,
                        borderColor: imageFile ? 'success.main' : 'divider',
                        borderStyle: 'dashed',
                        borderWidth: 2,
                        bgcolor: imageFile ? 'rgba(46, 125, 50, 0.03)' : 'rgba(0,0,0,0.01)',
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
                      {imageFile ? (
                        <>
                          <CheckCircleIcon color="success" sx={{ fontSize: 24 }} />
                          <Typography variant="body2" fontWeight={700} color="success.main" noWrap sx={{ maxWidth: '90%' }}>
                            {imageFile.name}
                          </Typography>
                        </>
                      ) : (
                        <>
                          <ImageIcon sx={{ fontSize: 28, color: 'text.disabled' }} />
                          <Typography variant="body2" fontWeight={700}>
                            Tải lên file ảnh artwork
                          </Typography>
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

                  {/* Thumbnail Preview */}
                  {(imageFile || formData.imageUrl) && (
                    <Grid size={{ xs: 4 }}>
                      <Box sx={{ 
                        width: '100%', 
                        height: 76, 
                        borderRadius: 3.5, 
                        border: '1px solid',
                        borderColor: 'divider',
                        overflow: 'hidden',
                        display: 'grid',
                        placeItems: 'center',
                        bgcolor: 'action.hover'
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

              <Divider sx={{ my: 1 }} />

              <TextField
                fullWidth
                label="Hoặc dán Link URL ảnh bìa"
                value={formData.imageUrl}
                onChange={(e) => setFormData((prev) => ({ ...prev, imageUrl: e.target.value }))}
                placeholder="https://images.unsplash.com/..."
                helperText="Sử dụng nếu bạn có sẵn link lưu trữ ảnh online."
                InputProps={{ sx: { borderRadius: 3.5 } }}
              />
            </Stack>
          )}
        </DialogContent>
        
        <DialogActions sx={{ p: 4, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
          <Button
            onClick={() => setCreateDialogOpen(false)}
            disabled={createLoading}
            sx={{ borderRadius: 3, textTransform: 'none', fontWeight: 700, px: 3 }}
          >
            Hủy
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateSong}
            disabled={createLoading}
            sx={{ 
              borderRadius: 3, 
              textTransform: 'none', 
              fontWeight: 800, 
              px: 4.5, 
              minWidth: 140,
              bgcolor: '#6c63ff',
              '&:hover': { bgcolor: '#534bae' }
            }}
          >
            {createLoading ? <CircularProgress size={24} color="inherit" /> : editingSong ? 'Lưu thay đổi' : 'Tải lên'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog
        open={deleteDialog.open}
        onClose={() => !deleteLoading && setDeleteDialog({ open: false, song: null })}
        PaperProps={{ sx: { borderRadius: 5, minWidth: { xs: '90%', sm: 400 } } }}
      >
        <DialogTitle sx={{ fontWeight: 800, pb: 1, color: 'error.main' }}>Xác nhận xóa bản nhạc</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontWeight: 500 }}>
            Bạn có chắc chắn muốn xóa vĩnh viễn bài hát <b>{deleteDialog.song?.title}</b>? Tác phẩm này sẽ không còn hiển thị trên các bảng xếp hạng và playlist cá nhân của người dùng. Hành động này không thể phục hồi.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button
            onClick={() => setDeleteDialog({ open: false, song: null })}
            disabled={deleteLoading}
            sx={{ borderRadius: 3, fontWeight: 700, px: 2 }}
          >
            Hủy bỏ
          </Button>
          <Button
            onClick={handleDelete}
            color="error"
            variant="contained"
            disabled={deleteLoading}
            sx={{ 
              borderRadius: 3, 
              fontWeight: 800, 
              px: 3,
              boxShadow: '0 4px 14px rgba(211, 47, 47, 0.25)'
            }}
          >
            {deleteLoading ? <CircularProgress size={20} color="inherit" /> : 'Xóa vĩnh viễn'}
          </Button>
        </DialogActions>
      </Dialog>
    </ArtistLayout>
  );
}

export default ArtistSong;
