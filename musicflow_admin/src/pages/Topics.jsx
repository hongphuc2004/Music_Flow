import { useState, useEffect, useCallback, useRef } from 'react';
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
} from '@mui/material';
import {
  Search as SearchIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Add as AddIcon,
  Refresh as RefreshIcon,
  Category as CategoryIcon,
  CloudUpload as CloudUploadIcon,
} from '@mui/icons-material';
import { Layout } from '../components/Layout';
import { topicsApi, songsApi } from '../services/api';

function Topics() {
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
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
  const [songOptionsTotal, setSongOptionsTotal] = useState(0);
  const [songOptionsSearch, setSongOptionsSearch] = useState('');
  const [songOptionsSearchTimeout, setSongOptionsSearchTimeout] = useState(null);
  const [selectedSongMap, setSelectedSongMap] = useState({});

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
    } catch (err) {
      setError('Failed to load topics. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, searchQuery]);

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
    if (!deleteDialog.topic) return;
    
    try {
      setDeleteLoading(true);
      await topicsApi.delete(deleteDialog.topic._id);
      setDeleteDialog({ open: false, topic: null });
      fetchTopics();
    } catch (err) {
      setError('Failed to delete topic');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Sửa lại: Khi sửa topic, gọi API lấy danh sách bài hát thuộc topic
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
      } catch (err) {
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
      // Create preview URL
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
      } else {
        await topicsApi.create(submitData);
      }
      handleCloseDialog();
      fetchTopics();
    } catch (err) {
      setError('Failed to save topic');
    } finally {
      setFormLoading(false);
    }
  };
  // Song picker logic (reuse from playlist)
  const fetchSongOptions = useCallback(async () => {
    try {
      setSongOptionsLoading(true);
      const response = await songsApi.getAll({
        page: songOptionsPage + 1,
        limit: songOptionsRowsPerPage,
        search: songOptionsSearch,
      });
      const songs = response.data?.songs || [];
      setSongOptions(songs);
      setSongOptionsTotal(response.data?.pagination?.total || 0);
      setSelectedSongMap((prev) => {
        const next = { ...prev };
        songs.forEach((song) => {
          next[song._id] = {
            title: song.title,
            artist: song.artist,
          };
        });
        return next;
      });
    } catch {
      setSongOptions([]);
      setSongOptionsTotal(0);
    } finally {
      setSongOptionsLoading(false);
    }
  }, [songOptionsPage, songOptionsRowsPerPage, songOptionsSearch]);

  useEffect(() => {
    if (songPickerOpen) {
      fetchSongOptions();
    }
  }, [songPickerOpen, fetchSongOptions]);

  const handleSongSearchChange = (event) => {
    const value = event.target.value;
    setSongOptionsSearch(value);
    if (songOptionsSearchTimeout) clearTimeout(songOptionsSearchTimeout);
    setSongOptionsSearchTimeout(setTimeout(() => {
      setSongOptionsPage(0);
    }, 400));
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
    setSelectedSongMap((prev) => ({
      ...prev,
      [song._id]: {
        title: song.title,
        artist: song.artist,
      },
    }));
  };

  const removeSelectedSong = (songId) => {
    setFormData((prev) => ({
      ...prev,
      songs: prev.songs.filter((id) => id !== songId),
    }));
  };

  const handleSongOptionsPageChange = (event, newPage) => {
    setSongOptionsPage(newPage);
  };

  const handleSongOptionsRowsChange = (event) => {
    setSongOptionsRowsPerPage(parseInt(event.target.value, 10));
    setSongOptionsPage(0);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <Layout title="Topics Management">
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5" fontWeight={600}>
          Topics ({total})
        </Typography>
        <Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => openEditDialog()}
            sx={{ mr: 1, bgcolor: '#6c63ff', '&:hover': { bgcolor: '#5a52d5' } }}
          >
            Add Topic
          </Button>
          <IconButton onClick={fetchTopics} disabled={loading}>
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
          placeholder="Search topics by name..."
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
                <TableCell>Topic</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Songs</TableCell>
                <TableCell>Created</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {topics.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    No topics found
                  </TableCell>
                </TableRow>
              ) : (
                topics.map((topic) => (
                  <TableRow key={topic._id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar 
                          src={topic.avatar}
                          sx={{ bgcolor: '#6c63ff', width: 48, height: 48 }}
                        >
                          <CategoryIcon />
                        </Avatar>
                        <Typography fontWeight={500}>{topic.name}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      {topic.description ? (
                        <Typography variant="body2" color="text.secondary">
                          {topic.description.substring(0, 50)}
                          {topic.description.length > 50 ? '...' : ''}
                        </Typography>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={`${topic.songCount || 0} songs`}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>{formatDate(topic.createdAt)}</TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => openEditDialog(topic)}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => setDeleteDialog({ open: true, topic })}
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

      {/* Edit/Create Dialog */}
      <Dialog 
        open={editDialog.open} 
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {editDialog.topic ? 'Edit Topic' : 'Create Topic'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            {/* Avatar Upload */}
            <Grid size={12}>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <Avatar
                  src={avatarPreview || formData.avatarUrl}
                  sx={{ width: 120, height: 120, bgcolor: '#6c63ff' }}
                >
                  <CategoryIcon sx={{ fontSize: 60 }} />
                </Avatar>
                <TextField
                  fullWidth
                  label="Avatar Image URL"
                  value={formData.avatarUrl}
                  onChange={(e) => setFormData((prev) => ({ ...prev, avatarUrl: e.target.value }))}
                  helperText="Paste image URL or upload from computer below"
                  sx={{ mt: 2 }}
                />
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
                  sx={{ borderColor: '#6c63ff', color: '#6c63ff' }}
                >
                  Upload Avatar
                </Button>
                {avatarFile && (
                  <Typography variant="caption" color="text.secondary">
                    {avatarFile.name}
                  </Typography>
                )}
              </Box>
            </Grid>
            <Grid size={12}>
              <TextField
                fullWidth
                label="Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </Grid>
            <Grid size={12}>
              <TextField
                fullWidth
                label="Description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                multiline
                rows={3}
              />
            </Grid>
            <Grid size={12}>
              <Box sx={{ mt: 2 }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <Typography variant="subtitle2">Songs in topic</Typography>
                  <Chip label={`${formData.songs.length} selected`} size="small" color="primary" />
                </Stack>
                <Button variant="outlined" onClick={() => setSongPickerOpen(true)}>
                  Choose Songs
                </Button>
              </Box>
            </Grid>
                <Dialog
                  open={songPickerOpen}
                  onClose={() => setSongPickerOpen(false)}
                  fullWidth
                  maxWidth="md"
                >
                  <DialogTitle>Select Songs</DialogTitle>
                  <DialogContent>
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="Search songs by title or artist..."
                      value={songOptionsSearch}
                      onChange={handleSongSearchChange}
                      sx={{ mt: 1, mb: 2 }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchIcon />
                          </InputAdornment>
                        ),
                      }}
                    />
                    <Divider sx={{ mb: 2 }} />
                    {songOptionsLoading ? (
                      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                        <CircularProgress size={28} />
                      </Box>
                    ) : (
                      <>
                        <TableContainer component={Paper} variant="outlined">
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell width={80}>Select</TableCell>
                                <TableCell>Title</TableCell>
                                <TableCell>Artist</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {songOptions.length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={3} align="center">
                                    No songs found
                                  </TableCell>
                                </TableRow>
                              ) : (
                                songOptions.map((song) => {
                                  const checked = formData.songs.includes(song._id);
                                  return (
                                    <TableRow key={song._id} hover>
                                      <TableCell>
                                        <Checkbox
                                          checked={checked}
                                          onChange={() => toggleSongSelection(song)}
                                        />
                                      </TableCell>
                                      <TableCell>{song.title}</TableCell>
                                      <TableCell>{song.artist}</TableCell>
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
                          count={songOptionsTotal}
                          rowsPerPage={songOptionsRowsPerPage}
                          page={songOptionsPage}
                          onPageChange={handleSongOptionsPageChange}
                          onRowsPerPageChange={handleSongOptionsRowsChange}
                        />
                      </>
                    )}
                  </DialogContent>
                  <DialogActions>
                    <Button onClick={() => setSongPickerOpen(false)}>Done</Button>
                  </DialogActions>
                </Dialog>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={handleCloseDialog}
            disabled={formLoading}
          >
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={handleSave}
            disabled={formLoading || !formData.name}
            sx={{ bgcolor: '#6c63ff', '&:hover': { bgcolor: '#5a52d5' } }}
          >
            {formLoading ? <CircularProgress size={20} /> : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog.open} onClose={() => setDeleteDialog({ open: false, topic: null })}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          Are you sure you want to delete topic "{deleteDialog.topic?.name}"?
          Songs in this topic will be unassigned.
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setDeleteDialog({ open: false, topic: null })}
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

export default Topics;
