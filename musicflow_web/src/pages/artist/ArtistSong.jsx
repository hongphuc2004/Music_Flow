import React from 'react';
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
  DialogContentText,
} from '@mui/material';

import axios from 'axios';
import {
  Search as SearchIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Refresh as RefreshIcon,
  MusicNote as MusicNoteIcon,
  PlayArrow as PlayIcon,
  Add as AddIcon,
  CloudUpload as CloudUploadIcon,
} from '@mui/icons-material';
import ArtistLayout from '../../components/Layout/artist/ArtistLayout';

function ArtistSong() {
  // State và logic lấy từ Songs.jsx
  const [songs, setSongs] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(10);
  const [total, setTotal] = React.useState(0);
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [editingSong, setEditingSong] = React.useState(null);
  const [formData, setFormData] = React.useState({ title: '', artist: '', lyrics: '', imageUrl: '' });
  const [audioFile, setAudioFile] = React.useState(null);
  const [imageFile, setImageFile] = React.useState(null);
  const [createLoading, setCreateLoading] = React.useState(false);
  const [showFullLyrics, setShowFullLyrics] = React.useState(false);
  const [deleteDialog, setDeleteDialog] = React.useState({ open: false, song: null });
  const [deleteLoading, setDeleteLoading] = React.useState(false);

  React.useEffect(() => {
    fetchSongs();
    // eslint-disable-next-line
  }, [page, rowsPerPage, searchQuery]);

  const fetchSongs = async () => {
    setLoading(true);
    setError(null);
    try {
      const artistName = localStorage.getItem('artistName');
      if (!artistName) {
        setSongs([]);
        setTotal(0);
        setError('Không tìm thấy tên nghệ sĩ.');
        setLoading(false);
        return;
      }
      const res = await axios.get(`/api/songs/by-artist?name=${encodeURIComponent(artistName)}&search=${encodeURIComponent(searchQuery)}&page=${page + 1}&limit=${rowsPerPage}`);
      setSongs(res.data.songs || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      setError('Không thể tải danh sách bài hát.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    setPage(0);
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const openCreateDialog = () => {
    setEditingSong(null);
    setFormData({ title: '', artist: '', lyrics: '', imageUrl: '' });
    setAudioFile(null);
    setImageFile(null);
    setShowFullLyrics(false);
    setCreateDialogOpen(true);
  };

  const openEditDialog = (song) => {
    setEditingSong(song);
    setFormData({
      title: song.title,
      artist: song.artist,
      lyrics: song.lyrics || '',
      imageUrl: song.imageUrl || '',
    });
    setAudioFile(null);
    setImageFile(null);
    setShowFullLyrics(false);
    setCreateDialogOpen(true);
  };

  const handleCreateSong = async () => {
    setCreateLoading(true);
    try {
      // Tùy vào editingSong để gọi API tạo mới hoặc cập nhật
      if (editingSong) {
        // Update song
        await axios.put(`/api/songs/${editingSong._id}`, formData);
      } else {
        // Create song
        await axios.post('/api/songs', formData);
      }
      setCreateDialogOpen(false);
      fetchSongs();
    } catch (err) {
      setError('Không thể lưu bài hát.');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog.song) return;
    setDeleteLoading(true);
    try {
      await axios.delete(`/api/songs/${deleteDialog.song._id}`);
      setDeleteDialog({ open: false, song: null });
      fetchSongs();
    } catch (err) {
      setError('Không thể xóa bài hát.');
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

  const formatDate = (date) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('vi-VN');
  };

  return (
    <ArtistLayout title="Songs Management">
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5" fontWeight={600}>
          Songs ({songs.length})
        </Typography>
        <Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={openCreateDialog}
            sx={{ mr: 1, bgcolor: '#00bcd4', '&:hover': { bgcolor: '#0097a7' } }}
          >
            Add Song
          </Button>
          <IconButton onClick={fetchSongs} disabled={loading}>
            <RefreshIcon />
          </IconButton>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper sx={{ mb: 3, p: 2 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Search songs by title or artist..."
          value={searchQuery}
          onChange={handleSearchChange}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
      </Paper>

      <TableContainer component={Paper}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                <TableCell>Song</TableCell>
                <TableCell>Artist</TableCell>
                <TableCell>Duration</TableCell>
                <TableCell>Created</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {songs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    No songs found
                  </TableCell>
                </TableRow>
              ) : (
                songs.map((song) => (
                  <TableRow key={song._id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar 
                          src={song.imageUrl} 
                          variant="rounded"
                          sx={{ bgcolor: '#00bcd4' }}
                        >
                          <MusicNoteIcon />
                        </Avatar>
                        <Typography fontWeight={500}>{song.title}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>{song.artist}</TableCell>
                    <TableCell>{formatDuration(song.duration)}</TableCell>
                    <TableCell>{formatDate(song.createdAt)}</TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        color="success"
                        onClick={() => window.open(song.audioUrl, '_blank')}
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
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={songs.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </TableContainer>

      <Dialog
        open={createDialogOpen}
        onClose={() => {
          setCreateDialogOpen(false);
          setEditingSong(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{editingSong ? 'Edit Song' : 'Add New Song'}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            {editingSong
              ? 'Update song metadata and optionally replace audio/cover.'
              : 'Upload an audio file and fill basic metadata.'}
          </DialogContentText>
          <Grid container spacing={2}>
            <Grid size={12}>
              <TextField
                fullWidth
                label="Title"
                value={formData.title}
                onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
              />
            </Grid>
            <Grid size={12}>
              <TextField
                fullWidth
                label="Artist"
                value={formData.artist}
                onChange={(e) => setFormData((prev) => ({ ...prev, artist: e.target.value }))}
              />
            </Grid>
            <Grid size={12}>
              <Box sx={{ position: 'relative', mb: 2 }}>
                <TextField
                  fullWidth
                  label="Lyrics"
                  multiline
                  minRows={3}
                  maxRows={showFullLyrics ? 20 : 5}
                  value={formData.lyrics}
                  onChange={(e) => setFormData((prev) => ({ ...prev, lyrics: e.target.value }))}
                />
                {formData.lyrics && formData.lyrics.split('\n').length > 5 && (
                  <Button
                    size="small"
                    sx={{ position: 'absolute', right: 0, bottom: -30 }}
                    onClick={() => setShowFullLyrics(v => !v)}
                  >
                    {showFullLyrics ? 'Rút gọn' : 'Xem thêm'}
                  </Button>
                )}
              </Box>
            </Grid>
            {/* Đã xóa các trường upload/cover image/audio theo yêu cầu */}
<Grid size={12}>
              <Button variant="outlined" component="label" startIcon={<CloudUploadIcon />} fullWidth>
                {audioFile
                  ? `Audio: ${audioFile.name}`
                  : editingSong
                    ? 'Replace Audio (optional)'
                    : 'Upload Audio (required)'}
                <input
                  hidden
                  type="file"
                  accept="audio/*"
                  onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
                />
              </Button>
            </Grid>
            <Grid size={12}>
              <Button variant="outlined" component="label" startIcon={<CloudUploadIcon />} fullWidth>
                {imageFile ? `Cover: ${imageFile.name}` : 'Upload Cover Image (optional)'}
                <input
                  hidden
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                />
              </Button>
            </Grid>
            <Grid size={12}>
              <TextField
                fullWidth
                label="Ảnh bìa URL (tuỳ chọn)"
                value={formData.imageUrl}
                onChange={(e) => setFormData((prev) => ({ ...prev, imageUrl: e.target.value }))}
                placeholder="Dán link ảnh cover..."
                helperText="Có thể upload file hoặc dán link trực tiếp. Nếu có cả 2 thì ưu tiên file."
              />
            </Grid>          
        </Grid>
    </DialogContent>
    <DialogActions>
        <Button
            onClick={() => {
              setCreateDialogOpen(false);
              setEditingSong(null);
            }}
            disabled={createLoading}
          >
            Cancel
          </Button>
          <Button variant="contained" onClick={handleCreateSong} disabled={createLoading} sx={{ ml: 2 }}>
            {createLoading ? <CircularProgress size={20} /> : editingSong ? 'Save Changes' : 'Create Song'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, song: null })}
      >
        <DialogTitle>Xác nhận xóa</DialogTitle>
        <DialogContent>Bạn có chắc muốn xóa bài hát này?</DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, song: null })}>Hủy</Button>
          <Button onClick={handleDelete} color="error" disabled={deleteLoading}>
            Xóa
          </Button>
        </DialogActions>
      </Dialog>
    </ArtistLayout>
  );
}

export default ArtistSong;
