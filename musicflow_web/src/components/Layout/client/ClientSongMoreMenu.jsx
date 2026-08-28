import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stack,
  Typography,
  Avatar,
  Box,
  CircularProgress,
  TextField,
  Divider,
  Chip,
  Paper,
} from '@mui/material';
import {
  MoreHorizRounded as MoreIcon,
  PlayArrowRounded as PlayIcon,
  EditRounded as EditIcon,
  FavoriteRounded as FavoriteIcon,
  FavoriteBorderRounded as FavoriteBorderIcon,
  DownloadRounded as DownloadIcon,
  PersonRounded as ArtistIcon,
  PlaylistAddRounded as PlaylistAddIcon,
  DeleteOutlineRounded as DeleteIcon,
  AddRounded as AddIcon,
  CheckCircleRounded as CheckIcon,
  MusicNoteRounded as MusicIcon,
  ShareRounded as ShareIcon,
} from '@mui/icons-material';
import { clientFavoritesApi, clientPlaylistsApi, clientSongsApi } from '../../../services/client/client.service';
import { useClientPlayerActions } from './ClientPlayerProvider';
import useAppToast from '../../../components/common/useAppToast';
import ShareSongModal from '../../common/ShareSongModal';


function ClientSongMoreMenu({ song, buttonSx, onEdit, onRemoveFromPlaylist }) {
  const navigate = useNavigate();
  const { playSong } = useClientPlayerActions();
  const { showToast } = useAppToast();

  const [anchorEl, setAnchorEl] = useState(null);
  const [favorite, setFavorite] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);


  // Add to Playlist Dialog States
  const [playlistDialogOpen, setPlaylistDialogOpen] = useState(false);
  const [playlists, setPlaylists] = useState([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  const [addingSongToId, setAddingSongToId] = useState(null);

  // Quick Create Playlist States inside Dialog
  const [showCreateInput, setShowCreateInput] = useState(false);
  const [newPlaylistTitle, setNewPlaylistTitle] = useState('');
  const [creatingPlaylist, setCreatingPlaylist] = useState(false);

  const open = Boolean(anchorEl);
  const isLoggedIn = Boolean(
    localStorage.getItem('role') ||
    localStorage.getItem('userId') ||
    localStorage.getItem('accessToken')
  );

  const songId = useMemo(() => song?._id || song?.id || '', [song?._id, song?.id]);
  const primaryArtistId = useMemo(() => {
    const firstArtist = Array.isArray(song?.artists) ? song.artists[0] : null;
    return firstArtist?._id || firstArtist?.id || '';
  }, [song?.artists]);

  const handleOpen = async (event) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);

    if (!songId || !isLoggedIn) return;

    try {
      const response = await clientFavoritesApi.check(songId);
      setFavorite(Boolean(response.data?.isFavorite));
    } catch {
      setFavorite(false);
    }
  };

  const handleClose = (event) => {
    event?.stopPropagation?.();
    setAnchorEl(null);
  };

  const handleToggleFavorite = async (event) => {
    event.stopPropagation();
    if (!songId) return;

    if (!isLoggedIn) {
      handleClose(event);
      showToast({
        severity: 'info',
        title: 'Cần đăng nhập',
        message: 'Vui lòng đăng nhập để thêm bài hát yêu thích.',
      });
      return;
    }

    try {
      await clientFavoritesApi.toggle(songId);
      setFavorite((prev) => {
        const next = !prev;
        showToast({
          severity: 'success',
          title: 'Thành công!',
          message: next
            ? 'Đã thêm bài hát vào danh sách yêu thích.'
            : 'Đã bỏ bài hát khỏi danh sách yêu thích.',
        });
        return next;
      });
    } catch (error) {
      showToast({
        severity: 'error',
        title: 'Có lỗi xảy ra',
        message: error.response?.data?.message || 'Không thể cập nhật yêu thích.',
      });
    } finally {
      handleClose(event);
    }
  };

  const handleViewArtist = (event) => {
    event.stopPropagation();
    if (primaryArtistId) {
      navigate(`/artists/${primaryArtistId}`);
    }
    handleClose(event);
  };

  const handlePlay = (event) => {
    event.stopPropagation();
    if (song) {
      playSong(song);
    }
    handleClose(event);
  };

  const handleDownload = async (event) => {
    event.stopPropagation();
    if (!songId) return;

    if (!isLoggedIn) {
      handleClose(event);
      showToast({
        severity: 'info',
        title: 'Cần đăng nhập',
        message: 'Vui lòng đăng nhập để tải bài hát.',
      });
      return;
    }

    try {
      await clientSongsApi.requestDownload(songId);
      showToast({
        severity: 'success',
        title: 'Đã tải xuống',
        message: 'Bài hát đã được thêm vào danh sách bài hát đã tải.',
      });
    } catch (error) {
      showToast({
        severity: 'error',
        title: 'Không thể tải bài hát',
        message: error.response?.data?.message || 'Vui lòng thử lại sau.',
      });
    } finally {
      handleClose(event);
    }
  };

  const handleEdit = (event) => {
    event.stopPropagation();
    handleClose(event);
    onEdit?.(song);
  };

  const handleRemoveFromPlaylistClick = (event) => {
    event.stopPropagation();
    handleClose(event);
    onRemoveFromPlaylist?.(song);
  };

  const fetchUserPlaylists = async () => {
    try {
      setLoadingPlaylists(true);
      const res = await clientPlaylistsApi.getMine();
      const list = res.data?.playlists || res.data?.data || (Array.isArray(res.data) ? res.data : []);
      setPlaylists(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error("Failed to fetch user playlists:", err);
      showToast({
        severity: 'error',
        title: 'Lỗi',
        message: 'Không thể tải danh sách playlist của bạn.',
      });
    } finally {
      setLoadingPlaylists(false);
    }
  };

  // Open Add to Playlist Modal
  const handleOpenPlaylistModal = (event) => {
    event?.stopPropagation?.();
    setAnchorEl(null);

    if (!isLoggedIn) {
      showToast({
        severity: 'info',
        title: 'Cần đăng nhập',
        message: 'Vui lòng đăng nhập để lưu bài hát vào playlist.',
      });
      return;
    }

    setPlaylistDialogOpen(true);
    setShowCreateInput(false);
    setNewPlaylistTitle('');

    fetchUserPlaylists();
  };

  // Add song to playlist
  const handleAddSongToSelectedPlaylist = async (playlist) => {
    const plId = playlist?._id || playlist?.id;
    if (!songId || !plId) return;
    try {
      setAddingSongToId(plId);
      await clientPlaylistsApi.addSong(plId, songId);
      showToast({
        severity: 'success',
        title: 'Đã thêm vào Playlist',
        message: `Đã thêm "${song?.title || 'bài hát'}" vào playlist "${playlist.name || 'Playlist'}".`,
      });
      setPlaylistDialogOpen(false);
    } catch (err) {
      showToast({
        severity: 'error',
        title: 'Không thể thêm',
        message: err.response?.data?.message || 'Bài hát có thể đã có trong playlist này.',
      });
    } finally {
      setAddingSongToId(null);
    }
  };

  // Quick Create New Playlist and add song
  const handleCreateAndAddSong = async () => {
    const title = newPlaylistTitle.trim();
    if (!title || !songId) return;

    try {
      setCreatingPlaylist(true);
      const formData = new FormData();
      formData.append('name', title);
      formData.append('description', 'Playlist cá nhân tạo từ bài hát');

      const createRes = await clientPlaylistsApi.create(formData);
      const newPlaylist = createRes.data?.playlist || createRes.data?.data;
      const newPlId = newPlaylist?._id || newPlaylist?.id;

      if (newPlId) {
        await clientPlaylistsApi.addSong(newPlId, songId);
        showToast({
          severity: 'success',
          title: 'Tạo & Thêm thành công',
          message: `Đã tạo playlist "${title}" và thêm bài hát vào!`,
        });
      }
      setPlaylistDialogOpen(false);
    } catch (err) {
      showToast({
        severity: 'error',
        title: 'Tạo playlist thất bại',
        message: err.response?.data?.message || 'Có lỗi xảy ra khi tạo playlist.',
      });
    } finally {
      setCreatingPlaylist(false);
    }
  };

  return (
    <>
      <IconButton
        size="small"
        onClick={handleOpen}
        onKeyDown={(event) => event.stopPropagation()}
        sx={{
          color: '#0f766e',
          p: 0.45,
          '&:hover': { backgroundColor: 'rgba(20, 184, 166, 0.14)' },
          ...buttonSx,
        }}
        aria-label="More options"
      >
        <MoreIcon sx={{ fontSize: 22 }} />
      </IconButton>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        onClick={(event) => event.stopPropagation()}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        PaperProps={{
          sx: {
            borderRadius: 3,
            minWidth: 200,
            boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
            p: 0.5,
          },
        }}
      >
        <MenuItem onClick={handlePlay} sx={{ borderRadius: 2, py: 1 }}>
          <ListItemIcon><PlayIcon fontSize="small" sx={{ color: '#6c63ff' }} /></ListItemIcon>
          <ListItemText primary="Phát ngay" primaryTypographyProps={{ fontWeight: 600, fontSize: 13.5 }} />
        </MenuItem>

        <MenuItem onClick={handleOpenPlaylistModal} sx={{ borderRadius: 2, py: 1 }}>
          <ListItemIcon><PlaylistAddIcon fontSize="small" sx={{ color: '#00bcd4' }} /></ListItemIcon>
          <ListItemText primary="Thêm vào playlist..." primaryTypographyProps={{ fontWeight: 600, fontSize: 13.5 }} />
        </MenuItem>

        <MenuItem onClick={handleToggleFavorite} sx={{ borderRadius: 2, py: 1 }}>
          <ListItemIcon>
            {favorite ? (
              <FavoriteIcon fontSize="small" sx={{ color: '#ef4444' }} />
            ) : (
              <FavoriteBorderIcon fontSize="small" sx={{ color: 'text.secondary' }} />
            )}
          </ListItemIcon>
          <ListItemText
            primary={favorite ? 'Bỏ yêu thích' : 'Thêm yêu thích'}
            primaryTypographyProps={{ fontWeight: 600, fontSize: 13.5 }}
          />
        </MenuItem>

        <MenuItem
          onClick={(e) => {
            e.stopPropagation();
            setAnchorEl(null);
            setShareOpen(true);
          }}
          sx={{ borderRadius: 2, py: 1 }}
        >
          <ListItemIcon><ShareIcon fontSize="small" sx={{ color: '#6366f1' }} /></ListItemIcon>
          <ListItemText primary="Chia sẻ bài hát" primaryTypographyProps={{ fontWeight: 600, fontSize: 13.5 }} />
        </MenuItem>

        <MenuItem onClick={handleDownload} sx={{ borderRadius: 2, py: 1 }}>

          <ListItemIcon><DownloadIcon fontSize="small" sx={{ color: '#10b981' }} /></ListItemIcon>
          <ListItemText primary="Tải bài hát" primaryTypographyProps={{ fontWeight: 600, fontSize: 13.5 }} />
        </MenuItem>

        {primaryArtistId && (
          <MenuItem onClick={handleViewArtist} sx={{ borderRadius: 2, py: 1 }}>
            <ListItemIcon><ArtistIcon fontSize="small" sx={{ color: '#8b5cf6' }} /></ListItemIcon>
            <ListItemText primary="Xem nghệ sĩ" primaryTypographyProps={{ fontWeight: 600, fontSize: 13.5 }} />
          </MenuItem>
        )}

        {onEdit && (
          <MenuItem onClick={handleEdit} sx={{ borderRadius: 2, py: 1 }}>
            <ListItemIcon><EditIcon fontSize="small" sx={{ color: '#f59e0b' }} /></ListItemIcon>
            <ListItemText primary="Chỉnh sửa bài hát" primaryTypographyProps={{ fontWeight: 600, fontSize: 13.5 }} />
          </MenuItem>
        )}

        {onRemoveFromPlaylist && (
          <>
            <Divider sx={{ my: 0.5 }} />
            <MenuItem onClick={handleRemoveFromPlaylistClick} sx={{ borderRadius: 2, py: 1, color: '#ef4444' }}>
              <ListItemIcon><DeleteIcon fontSize="small" sx={{ color: '#ef4444' }} /></ListItemIcon>
              <ListItemText primary="Xóa khỏi playlist" primaryTypographyProps={{ fontWeight: 700, fontSize: 13.5, color: '#ef4444' }} />
            </MenuItem>
          </>
        )}
      </Menu>

      {/* ADD TO PLAYLIST DIALOG MODAL */}
      <Dialog
        open={playlistDialogOpen}
        onClose={(event) => {
          event?.stopPropagation?.();
          setPlaylistDialogOpen(false);
        }}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 4.5,
            p: 1,
            backdropFilter: 'blur(16px)',
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 850, fontSize: 18, pb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <PlaylistAddIcon sx={{ color: '#6c63ff' }} />
          Thêm bài hát vào Playlist
        </DialogTitle>

        <DialogContent dividers sx={{ border: 'none', py: 1.5 }}>
          {/* Target Song Info preview */}
          {song && (
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2, p: 1.25, bgcolor: 'action.hover', borderRadius: 3 }}>
              <Avatar
                src={song.imageUrl || undefined}
                variant="rounded"
                sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: '#6c63ff' }}
              >
                <MusicIcon />
              </Avatar>
              <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                <Typography variant="subtitle2" fontWeight={800} noWrap>
                  {song.title || 'Bài hát'}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap>
                  {(song.artists || []).map((a) => typeof a === 'string' ? a : a?.name).filter(Boolean).join(', ') || 'Nghệ sĩ'}
                </Typography>
              </Box>
            </Stack>
          )}

          {/* Playlist list or loader */}
          {loadingPlaylists ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={32} color="secondary" />
            </Box>
          ) : (
            <Stack spacing={1} sx={{ maxHeight: 260, overflowY: 'auto', pr: 0.5 }}>
              {Array.isArray(playlists) && playlists.map((pl) => {
                if (!pl || typeof pl !== 'object') return null;
                const plId = pl._id || pl.id;
                const songAlreadyInPlaylist = Array.isArray(pl.songs) && pl.songs.some(
                  (s) => (s._id || s.id || s) === songId
                );

                return (
                  <Paper
                    key={plId}
                    elevation={0}
                    onClick={() => handleAddSongToSelectedPlaylist(pl)}
                    sx={{
                      p: 1.25,
                      borderRadius: 3,
                      border: '1px solid',
                      borderColor: 'divider',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        borderColor: '#6c63ff',
                        bgcolor: 'rgba(108, 99, 255, 0.06)',
                        transform: 'translateX(4px)',
                      },
                    }}
                  >
                    <Avatar
                      src={pl.coverImage || ''}
                      variant="rounded"
                      sx={{ width: 44, height: 44, borderRadius: 2.5, bgcolor: '#6c63ff', fontWeight: 800 }}
                    >
                      {(pl.name || 'P').charAt(0)}
                    </Avatar>
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={800} noWrap>
                        {pl.name || 'Playlist'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {Array.isArray(pl.songs) ? pl.songs.length : 0} bài hát
                      </Typography>
                    </Box>

                    {addingSongToId === plId ? (
                      <CircularProgress size={20} />
                    ) : songAlreadyInPlaylist ? (
                      <Chip
                        icon={<CheckIcon style={{ fontSize: 14 }} />}
                        label="Đã có"
                        size="small"
                        color="success"
                        variant="outlined"
                        sx={{ height: 24, fontSize: 11, fontWeight: 700 }}
                      />
                    ) : (
                      <AddIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                    )}
                  </Paper>
                );
              })}

              {(!Array.isArray(playlists) || !playlists.length) && (
                <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>
                  Bạn chưa có playlist nào. Hãy tạo mới bên dưới!
                </Typography>
              )}
            </Stack>
          )}

          {/* Inline Quick Create Playlist */}
          <Box sx={{ mt: 2, pt: 1.5, borderTop: '1px dashed', borderColor: 'divider' }}>
            {!showCreateInput ? (
              <Button
                fullWidth
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() => setShowCreateInput(true)}
                sx={{ borderRadius: 3, fontWeight: 750, textTransform: 'none', borderStyle: 'dashed' }}
              >
                Tạo playlist mới...
              </Button>
            ) : (
              <Stack direction="row" spacing={1} alignItems="center">
                <TextField
                  autoFocus
                  size="small"
                  fullWidth
                  placeholder="Nhập tên playlist mới..."
                  value={newPlaylistTitle}
                  onChange={(e) => setNewPlaylistTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateAndAddSong();
                  }}
                  InputProps={{ sx: { borderRadius: 2.5, fontSize: 13.5 } }}
                />
                <Button
                  variant="contained"
                  disabled={!newPlaylistTitle.trim() || creatingPlaylist}
                  onClick={handleCreateAndAddSong}
                  sx={{ borderRadius: 2.5, fontWeight: 800, whiteSpace: 'nowrap', bgcolor: '#6c63ff' }}
                >
                  {creatingPlaylist ? <CircularProgress size={20} color="inherit" /> : 'Tạo & Thêm'}
                </Button>
              </Stack>
            )}
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 2.5, pb: 2 }}>
          <Button
            onClick={() => setPlaylistDialogOpen(false)}
            sx={{ borderRadius: 3, fontWeight: 750, color: 'text.secondary' }}
          >
            Đóng
          </Button>
        </DialogActions>
      </Dialog>

      <ShareSongModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        song={song}
      />
    </>

  );
}

export default ClientSongMoreMenu;
