import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { UploadFileRounded as UploadIcon } from '@mui/icons-material';
import ClientLayout from '../../components/Layout/client/ClientLayout';
import { clientFavoritesApi, clientPlaylistsApi, clientSongsApi } from '../../services/api';
import { useClientPlayer } from '../../components/Layout/client/ClientPlayerProvider';
import SongMoreMenu from '../../components/Layout/client/SongMoreMenu';

function ClientLibrary() {
  const navigate = useNavigate();
  const { playSong } = useClientPlayer();

  const [playlists, setPlaylists] = useState([]);
  const [uploads, setUploads] = useState([]);
  const [favoriteSongs, setFavoriteSongs] = useState([]);
  const [downloadedSongs, setDownloadedSongs] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadLyrics, setUploadLyrics] = useState('');
  const [uploadAudioFile, setUploadAudioFile] = useState(null);
  const [uploadImageFile, setUploadImageFile] = useState(null);

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
  const listViewportSx = {
    maxHeight: 320,
    overflowY: 'auto',
    pr: 0.5,
  };

  const loadLibrary = async () => {
    try {
      setLoading(true);
      setError('');

      const [playlistsRes, uploadsRes, downloadRes, favoritesRes] = await Promise.all([
        clientPlaylistsApi.getMine(),
        clientSongsApi.getMyUploads(),
        clientSongsApi.getMyDownloadHistory({ limit: 50 }),
        clientFavoritesApi.getAll(),
      ]);

      setPlaylists(playlistsRes.data?.playlists || []);
      setUploads(uploadsRes.data?.songs || []);
      setDownloadedSongs(downloadRes.data?.songs || []);
      const favorites = favoritesRes.data?.favorites || [];
      setFavoriteSongs(Array.isArray(favorites) ? favorites : []);
    } catch (err) {
      setError(err.response?.data?.message || 'Khong the tai thu vien.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLibrary();
  }, []);

  const handleDownloadSong = async (event, song) => {
    event.stopPropagation();

    try {
      const response = await clientSongsApi.requestDownload(song._id);
      const audioUrl = response.data?.audioUrl;
      if (!audioUrl) return;

      const link = document.createElement('a');
      link.href = audioUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.click();

      await loadLibrary();
    } catch (err) {
      setError(err.response?.data?.message || 'Khong the tai bai hat.');
    }
  };

  const resetUploadForm = () => {
    setUploadTitle('');
    setUploadLyrics('');
    setUploadAudioFile(null);
    setUploadImageFile(null);
  };

  const handleUploadSubmit = async () => {
    if (!uploadAudioFile) {
      setError('Vui long chon file audio de upload.');
      return;
    }

    try {
      setUploading(true);
      setError('');

      const formData = new FormData();
      formData.append('audio', uploadAudioFile);
      if (uploadImageFile) formData.append('image', uploadImageFile);
      if (uploadTitle.trim()) formData.append('title', uploadTitle.trim());
      if (uploadLyrics.trim()) formData.append('lyrics', uploadLyrics.trim());
      formData.append('isPublic', 'false');

      await clientSongsApi.uploadSong(formData);
      setUploadOpen(false);
      resetUploadForm();
      await loadLibrary();
    } catch (err) {
      setError(err.response?.data?.message || 'Upload bai hat that bai.');
    } finally {
      setUploading(false);
    }
  };

  const renderSongRow = (song, keyPrefix = 'song', options = { showMore: true, showDownload: false }) => (
    <Paper
      key={`${keyPrefix}-${song._id}`}
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
      <Stack direction="row" spacing={1} alignItems="center">
        <Avatar src={song.imageUrl} variant="rounded" sx={{ width: 36, height: 36 }} />
        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Typography variant="body2" noWrap>{song.title}</Typography>
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
        {options.showDownload && (
          <Button
            size="small"
            onClick={(event) => handleDownloadSong(event, song)}
            sx={{ color: '#0f766e', '&:hover': { backgroundColor: 'rgba(20, 184, 166, 0.14)' } }}
          >
            Tai
          </Button>
        )}
        {options.showMore && (
          <SongMoreMenu song={song} buttonSx={{ color: '#0f766e', '&:hover': { backgroundColor: 'rgba(20, 184, 166, 0.14)' } }} />
        )}
      </Stack>
    </Paper>
  );

  return (
    <ClientLayout title="Thu vien cua ban">
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 2.5, borderRadius: 3, border: '1px solid #e2e8f0' }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>
              Playlist của bạn
            </Typography>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
                <CircularProgress size={28} />
              </Box>
            ) : (
              <Stack spacing={1.25}>
                <Box sx={listViewportSx}>
                  <Stack spacing={1.25}>
                    {playlists.slice(0, 5).map((playlist) => (
                      <Paper
                        key={playlist._id}
                        variant="outlined"
                        onClick={() => navigate(`/client/playlists/${playlist._id}`)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            navigate(`/client/playlists/${playlist._id}`);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                        sx={{ ...interactiveCardSx, cursor: 'pointer' }}
                      >
                        <Stack direction="row" spacing={1.25} alignItems="center">
                          <Avatar src={playlist.coverImage || ''} variant="rounded" sx={{ width: 52, height: 52, bgcolor: '#14b8a6' }}>
                            {(playlist.name || 'P').charAt(0)}
                          </Avatar>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography fontWeight={700} noWrap>{playlist.name}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {playlist.songCount || playlist.songs?.length || 0} bai hat
                            </Typography>
                          </Box>
                        </Stack>
                      </Paper>
                    ))}
                  </Stack>
                </Box>
                {!playlists.length && <Typography color="text.secondary">Ban chua tao playlist nao.</Typography>}
              </Stack>
            )}
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 2.5, borderRadius: 3, border: '1px solid #e2e8f0', minHeight: 260 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Đã tải lên
              </Typography>
              <Button
                size="small"
                variant="outlined"
                startIcon={<UploadIcon />}
                onClick={() => setUploadOpen(true)}
              >
                Upload
              </Button>
            </Stack>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
                <CircularProgress size={24} />
              </Box>
            ) : (
              <Stack spacing={1.25}>
                <Box sx={listViewportSx}>
                  <Stack spacing={1.25}>
                    {uploads.slice(0, 5).map((song) => renderSongRow(song, 'upload', { showMore: true, showDownload: true }))}
                  </Stack>
                </Box>
                {!uploads.length && <Typography color="text.secondary">Ban chua upload bai hat nao.</Typography>}
              </Stack>
            )}
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 2.5, borderRadius: 3, border: '1px solid #e2e8f0', minHeight: 260 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>
              Bai hat da tai
            </Typography>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
                <CircularProgress size={24} />
              </Box>
            ) : (
              <Stack spacing={1.25}>
                <Box sx={listViewportSx}>
                  <Stack spacing={1.25}>
                    {downloadedSongs.slice(0, 5).map((song) => renderSongRow(song, 'downloaded', { showMore: false, showDownload: false }))}
                  </Stack>
                </Box>
                {!downloadedSongs.length && <Typography color="text.secondary">Ban chua tai bai hat nao.</Typography>}
              </Stack>
            )}
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 2.5, borderRadius: 3, border: '1px solid #e2e8f0', minHeight: 260 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>
              Bai hat yeu thich
            </Typography>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
                <CircularProgress size={24} />
              </Box>
            ) : (
              <Stack spacing={1.25}>
                <Box sx={listViewportSx}>
                  <Stack spacing={1.25}>
                    {favoriteSongs.slice(0, 5).map((song) => renderSongRow(song, 'favorite', { showMore: true, showDownload: false }))}
                  </Stack>
                </Box>
                {!favoriteSongs.length && <Typography color="text.secondary">Ban chua co bai hat yeu thich.</Typography>}
              </Stack>
            )}
          </Paper>
        </Grid>
      </Grid>

      <Dialog open={uploadOpen} onClose={() => !uploading && setUploadOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Upload bai hat</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            <TextField
              label="Ten bai hat (tuy chon)"
              value={uploadTitle}
              onChange={(event) => setUploadTitle(event.target.value)}
              fullWidth
            />
            <TextField
              label="Loi bai hat (tuy chon)"
              value={uploadLyrics}
              onChange={(event) => setUploadLyrics(event.target.value)}
              multiline
              minRows={3}
              fullWidth
            />
            <Button variant="outlined" component="label">
              Chon file audio *
              <input
                type="file"
                accept="audio/*"
                hidden
                onChange={(event) => setUploadAudioFile(event.target.files?.[0] || null)}
              />
            </Button>
            <Typography variant="caption" color="text.secondary">
              {uploadAudioFile ? uploadAudioFile.name : 'Chua chon file audio'}
            </Typography>

            <Button variant="outlined" component="label">
              Chon anh bia (tuy chon)
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={(event) => setUploadImageFile(event.target.files?.[0] || null)}
              />
            </Button>
            <Typography variant="caption" color="text.secondary">
              {uploadImageFile ? uploadImageFile.name : 'Chua chon anh bia'}
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              if (uploading) return;
              setUploadOpen(false);
              resetUploadForm();
            }}
          >
            Huy
          </Button>
          <Button onClick={handleUploadSubmit} disabled={uploading} variant="contained">
            {uploading ? 'Dang upload...' : 'Upload'}
          </Button>
        </DialogActions>
      </Dialog>
    </ClientLayout>
  );
}

export default ClientLibrary;
