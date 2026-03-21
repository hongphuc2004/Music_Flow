import { useState, useEffect, useCallback } from 'react';
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
} from '@mui/icons-material';
import { Layout } from '../../components/Layout';
import { songsApi, topicsApi } from '../../services/api';

function Songs() {
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [total, setTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchTimeout, setSearchTimeout] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, song: null });
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [topics, setTopics] = useState([]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [editingSong, setEditingSong] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    artist: '',
    topicId: '',
    lyrics: '',
    isPublic: true,
  });
  const [audioFile, setAudioFile] = useState(null);
  const [imageFile, setImageFile] = useState(null);

  const fetchSongs = useCallback(async () => {
    try {
      setLoading(true);
      const response = await songsApi.getAll({
        page: page + 1,
        limit: rowsPerPage,
        search: searchQuery,
      });
      setSongs(response.data.songs);
      setTotal(response.data.pagination.total);
      setError(null);
    } catch (err) {
      setError('Failed to load songs. Make sure the backend is running.');
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
    } catch (err) {
      setTopics([]);
    }
  }, []);

  useEffect(() => {
    fetchTopics();
  }, [fetchTopics]);

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
    if (!deleteDialog.song) return;
    
    try {
      setDeleteLoading(true);
      await songsApi.delete(deleteDialog.song._id);
      setDeleteDialog({ open: false, song: null });
      fetchSongs();
    } catch (err) {
      setError('Failed to delete song');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleVisibilityChange = async (song) => {
    try {
      await songsApi.updateVisibility(song._id, !song.isPublic);
      fetchSongs();
    } catch (err) {
      setError('Failed to update song visibility');
    }
  };

  const openCreateDialog = () => {
    setEditingSong(null);
    setFormData({
      title: '',
      artist: '',
      topicId: '',
      lyrics: '',
      isPublic: true,
    });
    setAudioFile(null);
    setImageFile(null);
    setCreateDialogOpen(true);
  };

  const openEditDialog = (song) => {
    setEditingSong(song);
    setFormData({
      title: song.title || '',
      artist: song.artist || '',
      topicId: song.topicId?._id || '',
      lyrics: song.lyrics || '',
      isPublic: !!song.isPublic,
    });
    setAudioFile(null);
    setImageFile(null);
    setCreateDialogOpen(true);
  };

  const handleCreateSong = async () => {
    if (!formData.title.trim() || !formData.artist.trim()) {
      setError('Title and artist are required');
      return;
    }

    if (!editingSong && !audioFile) {
      setError('Audio file is required');
      return;
    }

    try {
      setCreateLoading(true);
      const payload = new FormData();
      payload.append('title', formData.title.trim());
      payload.append('artist', formData.artist.trim());
      payload.append('lyrics', formData.lyrics || '');
      payload.append('isPublic', String(formData.isPublic));
      if (formData.topicId) payload.append('topicId', formData.topicId);
      else payload.append('topicId', '');
      if (audioFile) payload.append('audio', audioFile);
      if (imageFile) payload.append('image', imageFile);

      if (editingSong) {
        await songsApi.update(editingSong._id, payload);
      } else {
        await songsApi.create(payload);
      }

      setCreateDialogOpen(false);
      setEditingSong(null);
      fetchSongs();
    } catch (err) {
      setError(editingSong ? 'Failed to update song' : 'Failed to create song');
    } finally {
      setCreateLoading(false);
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <Layout title="Songs Management">
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5" fontWeight={600}>
          Songs ({total})
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
                <TableCell>Uploaded By</TableCell>
                <TableCell>Public</TableCell>
                <TableCell>Created</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {songs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
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
                    <TableCell>
                      {song.uploadedBy ? (
                        <Chip
                          label={song.uploadedBy.name}
                          size="small"
                          variant="outlined"
                        />
                      ) : (
                        <Chip label="Admin" size="small" color="primary" />
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={song.isPublic}
                        onChange={() => handleVisibilityChange(song)}
                        size="small"
                      />
                    </TableCell>
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
          count={total}
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
              <FormControl fullWidth>
                <InputLabel id="song-topic-label">Topic</InputLabel>
                <Select
                  labelId="song-topic-label"
                  value={formData.topicId}
                  label="Topic"
                  onChange={(e) => setFormData((prev) => ({ ...prev, topicId: e.target.value }))}
                >
                  <MenuItem value="">None</MenuItem>
                  {topics.map((topic) => (
                    <MenuItem key={topic._id} value={topic._id}>
                      {topic.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={12}>
              <TextField
                fullWidth
                label="Lyrics"
                multiline
                minRows={3}
                value={formData.lyrics}
                onChange={(e) => setFormData((prev) => ({ ...prev, lyrics: e.target.value }))}
              />
            </Grid>
            <Grid size={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.isPublic}
                    onChange={(e) => setFormData((prev) => ({ ...prev, isPublic: e.target.checked }))}
                  />
                }
                label="Public song"
              />
            </Grid>
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
          <Button variant="contained" onClick={handleCreateSong} disabled={createLoading}>
            {createLoading ? <CircularProgress size={20} /> : editingSong ? 'Save Changes' : 'Create Song'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog.open} onClose={() => setDeleteDialog({ open: false, song: null })}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          Are you sure you want to delete "{deleteDialog.song?.title}" by {deleteDialog.song?.artist}?
          This action cannot be undone.
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setDeleteDialog({ open: false, song: null })}
            disabled={deleteLoading}
          >
            Cancel
          </Button>
          <Button 
            color="error" 
            variant="contained" 
            onClick={handleDelete}
            disabled={deleteLoading}
          >
            {deleteLoading ? <CircularProgress size={20} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Layout>
  );
}

export default Songs;
