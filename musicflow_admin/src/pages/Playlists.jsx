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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  Stack,
  Divider,
} from '@mui/material';
import {
  Search as SearchIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  PlaylistPlay as PlaylistIcon,
  Add as AddIcon,
  Edit as EditIcon,
  CloudUpload as CloudUploadIcon,
} from '@mui/icons-material';
import { Layout } from '../components/Layout';
import { playlistsApi, songsApi } from '../services/api';

const INITIAL_FORM_DATA = {
  name: '',
  description: '',
  isPublic: true,
  coverImage: '',
  songs: [],
};

function Playlists() {
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
  const [songOptionsTotal, setSongOptionsTotal] = useState(0);
  const [songOptionsSearch, setSongOptionsSearch] = useState('');
  const [songOptionsSearchTimeout, setSongOptionsSearchTimeout] = useState(null);
  const [selectedSongMap, setSelectedSongMap] = useState({});
  const [formDialog, setFormDialog] = useState({ open: false, mode: 'create', playlist: null });
  const [formData, setFormData] = useState(INITIAL_FORM_DATA);
  const [coverImageFile, setCoverImageFile] = useState(null);
  const [saveLoading, setSaveLoading] = useState(false);

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
    } catch (err) {
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
      fetchPlaylists();
    } catch (err) {
      setError('Failed to delete playlist');
    } finally {
      setDeleteLoading(false);
    }
  };

  const openCreateDialog = () => {
    setFormData(INITIAL_FORM_DATA);
    setCoverImageFile(null);
    setSelectedSongMap({});
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
    setSelectedSongMap(
      songs.reduce((acc, song) => {
        acc[song._id] = {
          title: song.title,
          artist: song.artist,
        };
        return acc;
      }, {})
    );
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

  const handleSavePlaylist = async () => {
    if (!formData.name.trim()) {
      setError('Playlist name is required');
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
      } else {
        await playlistsApi.create(payload);
      }
      closeFormDialog();
      fetchPlaylists();
      setError(null);
    } catch {
      setError('Failed to save playlist');
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
    <Layout title="Playlists Management">
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5" fontWeight={600}>
          Playlists ({total})
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateDialog}>
            Create Playlist
          </Button>
          <IconButton onClick={fetchPlaylists} disabled={loading}>
            <RefreshIcon />
          </IconButton>
        </Stack>
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
          placeholder="Search playlists by name..."
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
                <TableCell>Playlist</TableCell>
                <TableCell>Songs</TableCell>
                <TableCell>Visibility</TableCell>
                <TableCell>Created By</TableCell>
                <TableCell>Created</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {playlists.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    No playlists found
                  </TableCell>
                </TableRow>
              ) : (
                playlists.map((playlist) => (
                  <TableRow key={playlist._id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar 
                          src={playlist.coverImage} 
                          sx={{ bgcolor: '#ff9800' }}
                        >
                          <PlaylistIcon />
                        </Avatar>
                        <Box>
                          <Typography fontWeight={500}>{playlist.name}</Typography>
                          {playlist.description && (
                            <Typography variant="caption" color="text.secondary">
                              {playlist.description.length > 50
                                ? `${playlist.description.substring(0, 50)}...`
                                : playlist.description}
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
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={playlist.isPublic ? 'Public' : 'Private'}
                        size="small"
                        color={playlist.isPublic ? 'success' : 'default'}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={playlist.createdBy?.name || 'Admin'}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>{formatDate(playlist.createdAt)}</TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => openEditDialog(playlist)}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => setDeleteDialog({ open: true, playlist })}
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog.open} onClose={() => setDeleteDialog({ open: false, playlist: null })}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          Are you sure you want to delete playlist "{deleteDialog.playlist?.name}"?
          This action cannot be undone.
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setDeleteDialog({ open: false, playlist: null })}
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

      <Dialog
        open={formDialog.open}
        onClose={saveLoading ? undefined : closeFormDialog}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {formDialog.mode === 'edit' ? 'Update Playlist' : 'Create Playlist'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Playlist Name"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              required
              fullWidth
            />
            <TextField
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              multiline
              minRows={2}
              fullWidth
            />
            <TextField
              label="Cover Image URL"
              value={formData.coverImage}
              onChange={(e) => setFormData((prev) => ({ ...prev, coverImage: e.target.value }))}
              helperText="Dán URL ảnh hoặc chọn ảnh từ máy ở bên dưới"
              fullWidth
            />
            <Button
              variant="outlined"
              component="label"
              startIcon={<CloudUploadIcon />}
            >
              {coverImageFile ? `Selected: ${coverImageFile.name}` : 'Upload Cover Image From Computer'}
              <input
                hidden
                type="file"
                accept="image/*"
                onChange={(e) => setCoverImageFile(e.target.files?.[0] || null)}
              />
            </Button>
            {coverImageFile && (
              <Button
                size="small"
                color="inherit"
                onClick={() => setCoverImageFile(null)}
              >
                Remove selected image
              </Button>
            )}
            <FormControl fullWidth>
              <InputLabel id="playlist-visibility-label">Visibility</InputLabel>
              <Select
                labelId="playlist-visibility-label"
                value={formData.isPublic ? 'public' : 'private'}
                label="Visibility"
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, isPublic: e.target.value === 'public' }))
                }
              >
                <MenuItem value="public">Public</MenuItem>
                <MenuItem value="private">Private</MenuItem>
              </Select>
            </FormControl>
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="subtitle2">Songs in playlist</Typography>
                <Chip label={`${formData.songs.length} selected`} size="small" color="primary" />
              </Stack>
              <Button variant="outlined" onClick={() => setSongPickerOpen(true)}>
                Choose Songs
              </Button>
              {/* Đã ẩn phần hiển thị danh sách bài hát đã chọn để tránh bị dài khi chọn nhiều bài hát */}
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeFormDialog} disabled={saveLoading}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSavePlaylist}
            disabled={saveLoading}
          >
            {saveLoading ? <CircularProgress size={20} /> : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

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
    </Layout>
  );
}

export default Playlists;
