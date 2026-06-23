import { useEffect, useState, useMemo } from 'react';
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
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  QueueMusicRounded as PlaylistIcon,
  FavoriteRounded as FavoriteIcon,
  CloudUploadRounded as UploadIcon,
  FileDownloadRounded as DownloadIcon,
  PlayArrowRounded as PlayIcon,
  ShuffleRounded as ShuffleIcon,
  EditRounded as EditIcon,
  DeleteOutlineRounded as DeleteIcon,
  MusicNoteRounded as MusicIcon,
  LockRounded as LockIcon,
  PublicRounded as PublicIcon,
  CloseRounded as CloseIcon,
  SearchRounded as SearchIcon,
  AddRounded as AddIcon,
} from '@mui/icons-material';
import ClientLayout from '../../components/Layout/client/ClientLayout';
import { clientFavoritesApi, clientPlaylistsApi, clientSongsApi } from '../../services/api';
import { useClientPlayer } from '../../components/Layout/client/ClientPlayerProvider';
import SongMoreMenu from '../../components/Layout/client/SongMoreMenu';
import useClientToast from '../../components/Layout/client/useClientToast';
import useClientSession from '../../hooks/useClientSession';
import SongItem from '../../components/client/SongItem';
import PlaylistCard from '../../components/client/PlaylistCard';

const PLAYLIST_PRESETS = [
  { name: 'Synthwave', url: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=400&auto=format&fit=crop&q=80' },
  { name: 'Jazz Glow', url: 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=400&auto=format&fit=crop&q=80' },
  { name: 'Ambient Chill', url: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=400&auto=format&fit=crop&q=80' },
  { name: 'Pop Vibe', url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&auto=format&fit=crop&q=80' },
];

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function ClientLibrary() {
  const navigate = useNavigate();
  const { playSong, currentSong, isPlaying } = useClientPlayer();
  const { showToast, updateToast } = useClientToast();
  const { userName } = useClientSession();

  const [playlists, setPlaylists] = useState([]);
  const [uploads, setUploads] = useState([]);
  const [favoriteSongs, setFavoriteSongs] = useState([]);
  const [downloadedSongs, setDownloadedSongs] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Upload Song Dialog State
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadLyrics, setUploadLyrics] = useState('');
  const [uploadAudioFile, setUploadAudioFile] = useState(null);
  const [uploadImageFile, setUploadImageFile] = useState(null);
  const [uploadImageUrl, setUploadImageUrl] = useState('');
  const [editingUploadSong, setEditingUploadSong] = useState(null);

  // Tab & Search States
  const [activeTab, setActiveTab] = useState(0); // 0: Playlists, 1: Favorites, 2: Uploads, 3: Downloads
  const [searchQuery, setSearchQuery] = useState('');

  // Playlist Dialog State
  const [playlistDialogOpen, setPlaylistDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingPlaylistId, setEditingPlaylistId] = useState(null);
  const [playlistName, setPlaylistName] = useState('');
  const [playlistDescription, setPlaylistDescription] = useState('');
  const [playlistCoverImage, setPlaylistCoverImage] = useState('');
  const [playlistIsPublic, setPlaylistIsPublic] = useState(false);
  const [playlistSaving, setPlaylistSaving] = useState(false);

  // Playlist Delete Confirmation
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [playlistToDelete, setPlaylistToDelete] = useState(null);

  const [coverImageError, setCoverImageError] = useState(false);

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
      setError(err.response?.data?.message || 'Không thể tải thư viện.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLibrary();
  }, []);


  // Upload Logic
  const resetUploadForm = () => {
    setUploadTitle('');
    setUploadLyrics('');
    setUploadAudioFile(null);
    setUploadImageFile(null);
    setUploadImageUrl('');
    setEditingUploadSong(null);
  };

  const openCreateUploadDialog = () => {
    resetUploadForm();
    setUploadOpen(true);
  };

  const openEditUploadDialog = (song) => {
    setEditingUploadSong(song);
    setUploadTitle(song?.title || '');
    setUploadLyrics(song?.lyrics || '');
    setUploadAudioFile(null);
    setUploadImageFile(null);
    setUploadImageUrl(song?.imageUrl || '');
    setUploadOpen(true);
  };

  const handleUploadSubmit = async () => {
    const isEditing = Boolean(editingUploadSong?._id);

    if (!isEditing && !uploadAudioFile) {
      showToast({ severity: 'error', title: 'Thiếu file', message: 'Vui lòng chọn file audio để upload.' });
      return;
    }

    const loadingTitle = isEditing ? 'Đang cập nhật' : 'Đang tải lên';
    const loadingMessage = isEditing ? 'Bài hát của bạn đang được cập nhật...' : 'Bài hát của bạn đang được tải lên...';
    let visualProgress = 0;
    let progressTimer = null;
    const showUploadToast = (progress) => {
      showToast({
        severity: 'info',
        title: loadingTitle,
        message: loadingMessage,
        loading: true,
        progress,
      });
    };
    const updateUploadProgress = (progress) => {
      updateToast({ progress });
    };

    try {
      setUploading(true);
      setError('');
      showUploadToast(0);
      progressTimer = window.setInterval(() => {
        const remaining = 94 - visualProgress;
        const nextStep = Math.max(0.45, remaining * 0.045);
        visualProgress = Math.min(94, visualProgress + nextStep);
        updateUploadProgress(Math.round(visualProgress));
      }, 450);

      const formData = new FormData();
      if (uploadAudioFile) formData.append('audio', uploadAudioFile);
      if (uploadImageFile) formData.append('image', uploadImageFile);
      if (
        uploadImageUrl.trim() &&
        (!isEditing || uploadImageUrl.trim() !== String(editingUploadSong?.imageUrl || '').trim())
      ) {
        formData.append('imageUrl', uploadImageUrl.trim());
      }
      if (uploadTitle.trim()) formData.append('title', uploadTitle.trim());
      if (isEditing || uploadLyrics.trim()) formData.append('lyrics', uploadLyrics);
      if (!isEditing) formData.append('isPublic', 'false');

      if (isEditing) {
        await clientSongsApi.updateSong(editingUploadSong._id, formData);
      } else {
        await clientSongsApi.uploadSong(formData);
      }
      if (progressTimer) window.clearInterval(progressTimer);
      progressTimer = null;
      updateUploadProgress(100);
      await wait(350);
      setUploadOpen(false);
      resetUploadForm();
      await loadLibrary();
      showToast({
        severity: 'success',
        title: 'Thành công',
        message: isEditing ? 'Cập nhật bài hát thành công!' : 'Tải lên bài hát thành công!',
      });
    } catch (err) {
      const message = err.response?.data?.message || (isEditing ? 'Cập nhật bài hát thất bại.' : 'Upload bài hát thất bại.');
      setError(message);
      showToast({ severity: 'error', title: isEditing ? 'Cập nhật thất bại' : 'Tải lên thất bại', message });
    } finally {
      if (progressTimer) window.clearInterval(progressTimer);
      setUploading(false);
    }
  };

  const handleRemoveFavorite = async (event, songId) => {
    event.stopPropagation();
    try {
      await clientFavoritesApi.remove(songId);
      setFavoriteSongs((prev) => prev.filter((song) => song._id !== songId));
      showToast({ severity: 'success', title: 'Đã xóa', message: 'Đã xóa khỏi danh sách yêu thích.' });
    } catch {
      showToast({ severity: 'error', title: 'Lỗi', message: 'Không thể xóa bài hát khỏi danh sách yêu thích.' });
    }
  };

  const handleRemoveDownloaded = async (event, songId) => {
    event.stopPropagation();
    try {
      await clientSongsApi.removeFromDownloadHistory(songId);
      setDownloadedSongs((prev) => prev.filter((song) => song._id !== songId));
      showToast({ severity: 'success', title: 'Đã xóa', message: 'Đã xóa khỏi lịch sử tải xuống.' });
    } catch {
      showToast({ severity: 'error', title: 'Lỗi', message: 'Không thể xóa bài hát khỏi lịch sử tải xuống.' });
    }
  };

  // Playlist CRUD
  const handleOpenPlaylistDialog = (playlist = null) => {
    if (playlist) {
      setIsEditMode(true);
      setEditingPlaylistId(playlist._id);
      setPlaylistName(playlist.name || '');
      setPlaylistDescription(playlist.description || '');
      setPlaylistCoverImage(playlist.coverImage || '');
      setPlaylistIsPublic(playlist.isPublic || false);
    } else {
      setIsEditMode(false);
      setEditingPlaylistId(null);
      setPlaylistName('');
      setPlaylistDescription('');
      setPlaylistCoverImage('');
      setPlaylistIsPublic(false);
    }
    setPlaylistDialogOpen(true);
  };

  const handleSavePlaylist = async () => {
    if (!playlistName.trim()) {
      showToast({ severity: 'warning', title: 'Nhập thông tin', message: 'Vui lòng nhập tên playlist.' });
      return;
    }

    try {
      setPlaylistSaving(true);
      const payload = {
        name: playlistName.trim(),
        description: playlistDescription.trim(),
        coverImage: playlistCoverImage.trim(),
        isPublic: playlistIsPublic,
      };

      if (isEditMode) {
        await clientPlaylistsApi.update(editingPlaylistId, payload);
        showToast({ severity: 'success', title: 'Cập nhật', message: 'Cập nhật playlist thành công!' });
      } else {
        await clientPlaylistsApi.create(payload);
        showToast({ severity: 'success', title: 'Tạo mới', message: 'Tạo playlist thành công!' });
      }

      setPlaylistDialogOpen(false);
      await loadLibrary();
    } catch (err) {
      showToast({
        severity: 'error',
        title: 'Thất bại',
        message: err.response?.data?.message || 'Lưu playlist thất bại.',
      });
    } finally {
      setPlaylistSaving(false);
    }
  };

  const handleDeletePlaylistClick = (event, playlist) => {
    event.stopPropagation();
    setPlaylistToDelete(playlist);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDeletePlaylist = async () => {
    if (!playlistToDelete) return;
    try {
      await clientPlaylistsApi.delete(playlistToDelete._id);
      showToast({ severity: 'success', title: 'Đã xóa', message: 'Xóa playlist thành công!' });
      setDeleteConfirmOpen(false);
      setPlaylistToDelete(null);
      await loadLibrary();
    } catch (err) {
      showToast({
        severity: 'error',
        title: 'Thất bại',
        message: err.response?.data?.message || 'Xóa playlist thất bại.',
      });
    }
  };

  // Search filter
  const filteredPlaylists = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return playlists;
    return playlists.filter(
      (p) =>
        p.name?.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query)
    );
  }, [playlists, searchQuery]);

  const filteredFavorites = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return favoriteSongs;
    return favoriteSongs.filter(
      (s) =>
        s.title?.toLowerCase().includes(query) ||
        (Array.isArray(s.artists)
          ? s.artists.map((a) => a?.name).join(', ')
          : s.artistText || ''
        )
          .toLowerCase()
          .includes(query)
    );
  }, [favoriteSongs, searchQuery]);

  const filteredUploads = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return uploads;
    return uploads.filter(
      (s) =>
        s.title?.toLowerCase().includes(query) ||
        (Array.isArray(s.artists)
          ? s.artists.map((a) => a?.name).join(', ')
          : s.artistText || ''
        )
          .toLowerCase()
          .includes(query)
    );
  }, [uploads, searchQuery]);

  const filteredDownloads = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return downloadedSongs;
    return downloadedSongs.filter(
      (s) =>
        s.title?.toLowerCase().includes(query) ||
        (Array.isArray(s.artists)
          ? s.artists.map((a) => a?.name).join(', ')
          : s.artistText || ''
        )
          .toLowerCase()
          .includes(query)
    );
  }, [downloadedSongs, searchQuery]);

  const activeSongsList = useMemo(() => {
    if (activeTab === 1) return filteredFavorites;
    if (activeTab === 2) return filteredUploads;
    if (activeTab === 3) return filteredDownloads;
    return [];
  }, [activeTab, filteredFavorites, filteredUploads, filteredDownloads]);

  const songWithCover = useMemo(() => {
    return activeSongsList.find(
      (s) =>
        s.imageUrl &&
        s.imageUrl.trim() !== '' &&
        !s.imageUrl.includes('tgdfbp3zivuqoxqxpltj')
    );
  }, [activeSongsList]);

  useEffect(() => {
    setCoverImageError(false);
  }, [activeSongsList]);

  const handlePlayAll = (shuffleMode = false) => {
    let targetSongs = [];
    if (activeTab === 0) {
      const unique = [];
      const seen = new Set();
      filteredPlaylists.forEach((p) => {
        if (Array.isArray(p.songs)) {
          p.songs.forEach((s) => {
            if (s?._id && !seen.has(s._id)) {
              seen.add(s._id);
              unique.push(s);
            }
          });
        }
      });
      targetSongs = unique;
    } else {
      targetSongs = activeSongsList;
    }

    if (!targetSongs.length) {
      showToast({ severity: 'info', title: 'Thông báo', message: 'Không tìm thấy bài hát nào để phát.' });
      return;
    }

    if (shuffleMode) {
      const shuffled = [...targetSongs].sort(() => Math.random() - 0.5);
      playSong(shuffled[0], { queue: shuffled });
      showToast({ severity: 'success', title: 'Trộn bài', message: `Đang phát ngẫu nhiên ${shuffled.length} bài hát.` });
    } else {
      playSong(targetSongs[0], { queue: targetSongs });
      showToast({ severity: 'success', title: 'Phát tất cả', message: `Đang phát tất cả ${targetSongs.length} bài hát.` });
    }
  };

  const handlePlaySinglePlaylist = (event, playlist) => {
    event.stopPropagation();
    const playlistSongs = playlist.songs || [];
    if (!playlistSongs.length) {
      showToast({ severity: 'info', title: 'Thông báo', message: 'Playlist này chưa có bài hát nào.' });
      return;
    }
    playSong(playlistSongs[0], { queue: playlistSongs });
  };

  const tabColorConfig = useMemo(() => {
    if (activeTab === 1) return { color: '#ff4e7c', bg: 'linear-gradient(135deg, #ff4e7c 0%, #ff839b 100%)', label: 'Yêu thích' };
    if (activeTab === 2) return { color: '#a855f7', bg: 'linear-gradient(135deg, #a855f7 0%, #c084fc 100%)', label: 'Đã tải lên' };
    if (activeTab === 3) return { color: '#06b6d4', bg: 'linear-gradient(135deg, #06b6d4 0%, #22d3ee 100%)', label: 'Đã tải xuống' };
    return { color: '#6c63ff', bg: 'linear-gradient(135deg, #6c63ff 0%, #00bcd4 100%)', label: 'Danh sách phát' };
  }, [activeTab]);

  const featuredPlaylist = useMemo(() => {
    if (!playlists.length) return null;
    return playlists[0];
  }, [playlists]);

  const otherPlaylists = useMemo(() => {
    if (!playlists.length) return [];
    return playlists.slice(1);
  }, [playlists]);

  return (
    <ClientLayout title="Thư viện của bạn">
      {error && <Alert severity="error" sx={{ mb: 3, borderRadius: '14px' }}>{error}</Alert>}

      <style>{`
        @keyframes bounce-bar {
          0%, 100% { height: 8px; }
          50% { height: 32px; }
        }
        .eq-bar {
          width: 4px;
          border-radius: 2px;
          margin: 0 3px;
          display: inline-block;
        }
        .eq-bar-1 { animation: bounce-bar 0.8s ease-in-out infinite; }
        .eq-bar-2 { animation: bounce-bar 1.1s ease-in-out infinite 0.25s; }
        .eq-bar-3 { animation: bounce-bar 0.9s ease-in-out infinite 0.4s; }
        .eq-bar-4 { animation: bounce-bar 1.3s ease-in-out infinite 0.1s; }
      `}</style>

      {/* ================= 1. PERSONALIZED WELCOME BANNER (FULL-WIDTH) ================= */}
      <Box sx={{ width: '100%', mb: 4 }}>
        <Paper
          sx={{
            p: { xs: 3, md: 4 },
            borderRadius: '24px',
            border: '1px solid',
            borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(108, 99, 255, 0.1)',
            background: (theme) => theme.palette.mode === 'dark'
              ? 'linear-gradient(135deg, rgba(108, 99, 255, 0.2) 0%, rgba(6, 182, 212, 0.08) 100%)'
              : 'linear-gradient(135deg, rgba(108, 99, 255, 0.85) 0%, rgba(6, 182, 212, 0.6) 100%)',
            color: '#fff',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 12px 35px rgba(108, 99, 255, 0.15)',
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 3,
          }}
        >
          {/* Decorative glowing background bubbles */}
          <Box
            sx={{
              position: 'absolute',
              top: -60,
              right: -60,
              width: 240,
              height: 240,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(6, 182, 212, 0.35) 0%, transparent 70%)',
              filter: 'blur(30px)',
              zIndex: 0,
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              bottom: -50,
              left: '25%',
              width: 180,
              height: 180,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255, 78, 124, 0.25) 0%, transparent 70%)',
              filter: 'blur(25px)',
              zIndex: 0,
            }}
          />

          <Box sx={{ zIndex: 1, textAlign: { xs: 'center', sm: 'left' } }}>
            <Typography variant="h3" sx={{ fontWeight: 900, mb: 1, letterSpacing: -1.5, textShadow: '0 2px 4px rgba(0,0,0,0.15)', fontSize: { xs: '1.75rem', sm: '2.25rem', md: '2.75rem' } }}>
              Chào {userName}!
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.9, maxWidth: 650, fontWeight: 555, fontSize: { xs: '0.9rem', sm: '1.05rem' }, lineHeight: 1.4 }}>
              Chào mừng quay trở lại! Tận hưởng không gian âm nhạc cá nhân hóa đỉnh cao cùng MusicFlow.
            </Typography>
            <Button
              variant="contained"
              onClick={() => {
                setActiveTab(1);
                handlePlayAll(false);
              }}
              sx={{
                mt: 3,
                borderRadius: '20px',
                px: 4,
                py: 1.25,
                bgcolor: '#fff',
                color: 'primary.main',
                fontWeight: 900,
                fontSize: '0.95rem',
                boxShadow: '0 8px 25px rgba(0,0,0,0.1)',
                '&:hover': {
                  bgcolor: 'rgba(255,255,255,0.9)',
                  transform: 'scale(1.03)',
                },
              }}
            >
              Nghe nhạc yêu thích ngay
            </Button>
          </Box>

          {/* Big Avatar */}
          <Box
            sx={{
              zIndex: 1,
              width: { xs: 100, sm: 120 },
              height: { xs: 100, sm: 120 },
              borderRadius: '32px',
              background: 'linear-gradient(135deg, #00bcd4 0%, #ff4e7c 100%)',
              p: 0.5,
              boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            <Avatar
              sx={{
                width: '100%',
                height: '100%',
                borderRadius: '28px',
                bgcolor: '#111827',
                color: '#fff',
                fontSize: '2.75rem',
                fontWeight: 900,
              }}
            >
              {userName.charAt(0).toUpperCase()}
            </Avatar>
          </Box>
        </Paper>
      </Box>

      {/* ================= 2. 4-COLUMN STATS ROW (FULL-WIDTH) ================= */}
      <Grid container spacing={3} sx={{ mb: 5 }}>
        {[
          {
            title: 'Danh sách phát',
            count: playlists.length,
            icon: <PlaylistIcon sx={{ fontSize: 28, color: '#6c63ff' }} />,
            glow: 'rgba(108, 99, 255, 0.4)',
            cardGlow: '0 8px 24px rgba(108, 99, 255, 0.06)',
            accentColor: '#6c63ff',
            onClick: () => setActiveTab(0),
          },
          {
            title: 'Yêu thích',
            count: favoriteSongs.length,
            icon: <FavoriteIcon sx={{ fontSize: 28, color: '#ff4e7c' }} />,
            glow: 'rgba(255, 78, 124, 0.4)',
            cardGlow: '0 8px 24px rgba(255, 78, 124, 0.06)',
            accentColor: '#ff4e7c',
            onClick: () => setActiveTab(1),
          },
          {
            title: 'Tải lên',
            count: uploads.length,
            icon: <UploadIcon sx={{ fontSize: 28, color: '#a855f7' }} />,
            glow: 'rgba(168, 85, 247, 0.4)',
            cardGlow: '0 8px 24px rgba(168, 85, 247, 0.06)',
            accentColor: '#a855f7',
            onClick: () => setActiveTab(2),
          },
          {
            title: 'Đã tải xuống',
            count: downloadedSongs.length,
            icon: <DownloadIcon sx={{ fontSize: 28, color: '#06b6d4' }} />,
            glow: 'rgba(6, 182, 212, 0.4)',
            cardGlow: '0 8px 24px rgba(6, 182, 212, 0.06)',
            accentColor: '#06b6d4',
            onClick: () => setActiveTab(3),
          },
        ].map((stat, i) => (
          <Grid size={{ xs: 12, sm: 6, md: 3 }} key={i} sx={{ display: 'flex', flexDirection: 'column' }}>
            <Paper
              onClick={stat.onClick}
              sx={{
                p: 2.75,
                borderRadius: '22px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 2.5,
                flexGrow: 1,
                width: '100%',
                border: '1px solid',
                borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                background: (theme) => theme.palette.mode === 'dark'
                  ? 'rgba(255, 255, 255, 0.02)'
                  : '#ffffff',
                boxShadow: stat.cardGlow,
                transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                '&:hover': {
                  transform: 'translateY(-5px)',
                  borderColor: stat.accentColor,
                  boxShadow: `0 12px 30px -5px ${stat.glow}`,
                  '& .stat-icon-wrapper': {
                    transform: 'scale(1.08)',
                    boxShadow: `0 8px 20px ${stat.glow}`,
                  },
                },
              }}
            >
              <Box
                className="stat-icon-wrapper"
                sx={{
                  display: 'grid',
                  placeItems: 'center',
                  width: 56,
                  height: 56,
                  borderRadius: '16px',
                  backgroundColor: (theme) => theme.palette.mode === 'dark'
                    ? 'rgba(255,255,255,0.04)'
                    : 'rgba(0,0,0,0.02)',
                  transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              >
                {stat.icon}
              </Box>
              <Box>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 800, fontSize: '0.65rem' }}
                >
                  {stat.title}
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 900, mt: 0.25, color: 'text.primary', letterSpacing: -0.5 }}>
                  {loading ? <CircularProgress size={20} /> : stat.count}
                </Typography>
              </Box>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* ================= 3. CAPSULE TABS & CONTROLS TOOLBAR (ENLARGED) ================= */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'stretch', md: 'center' },
          gap: 2.5,
          pb: 2.5,
          borderBottom: '1px solid',
          borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
          mb: 4.5,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            borderRadius: '32px',
            p: 0.75,
            height: 48,
            backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.04)',
            backdropFilter: 'blur(10px)',
            gap: 0.5,
            alignSelf: 'flex-start',
            maxWidth: '100%',
            overflowX: 'auto',
            alignItems: 'center',
            '&::-webkit-scrollbar': { display: 'none' },
          }}
        >
          {[
            { label: 'Danh sách phát', value: 0 },
            { label: 'Yêu thích', value: 1 },
            { label: 'Tải lên', value: 2 },
            { label: 'Tải xuống', value: 3 },
          ].map((tab) => {
            const isSelected = activeTab === tab.value;
            return (
              <Box
                key={tab.value}
                onClick={() => {
                  setActiveTab(tab.value);
                  setSearchQuery('');
                }}
                sx={{
                  px: 3,
                  py: 1,
                  height: '100%',
                  borderRadius: '26px',
                  cursor: 'pointer',
                  fontWeight: 800,
                  fontSize: '0.9rem',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isSelected ? '#fff' : 'text.secondary',
                  background: isSelected ? tabColorConfig.bg : 'transparent',
                  boxShadow: isSelected ? `0 4px 15px ${tabColorConfig.color}50` : 'none',
                  transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                  '&:hover': {
                    color: isSelected ? '#fff' : 'text.primary',
                    backgroundColor: isSelected ? 'none' : (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                  },
                }}
              >
                {tab.label}
              </Box>
            );
          })}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          {/* Glass Search bar (48px height) */}
          <TextField
            size="small"
            placeholder="Tìm kiếm..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: <SearchIcon sx={{ color: 'text.secondary', mr: 1, fontSize: 18 }} />,
              sx: {
                borderRadius: '24px',
                height: 48,
                width: { xs: '100%', sm: 260 },
                backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.8)',
                border: '1px solid',
                borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)',
                '&.Mui-focused': {
                  borderColor: tabColorConfig.color,
                  boxShadow: `0 0 0 3px ${tabColorConfig.color}25`,
                },
              },
            }}
          />

          {/* Action buttons (48px height) */}
          <Button
            variant="contained"
            startIcon={<PlayIcon />}
            onClick={() => handlePlayAll(false)}
            sx={{
              borderRadius: '24px',
              height: 48,
              px: 3,
              fontSize: '0.9rem',
              fontWeight: 800,
              background: 'linear-gradient(135deg, #6c63ff 0%, #00bcd4 100%)',
              color: '#fff',
              boxShadow: '0 4px 15px -3px rgba(108, 99, 255, 0.4)',
              transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
              '&:hover': {
                background: 'linear-gradient(135deg, #5b54e0 0%, #00a4b8 100%)',
                transform: 'scale(1.03)',
                boxShadow: '0 6px 20px -3px rgba(108, 99, 255, 0.5)',
              },
            }}
          >
            Phát tất cả
          </Button>

          <Button
            variant="outlined"
            startIcon={<ShuffleIcon />}
            onClick={() => handlePlayAll(true)}
            sx={{
              borderRadius: '24px',
              height: 48,
              px: 3,
              fontSize: '0.9rem',
              fontWeight: 800,
              borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.15)',
              color: 'text.primary',
              backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.01)' : 'rgba(255,255,255,0.8)',
              transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
              '&:hover': {
                borderColor: 'primary.main',
                backgroundColor: 'rgba(108,99,255,0.06)',
                transform: 'scale(1.03)',
              },
            }}
          >
            Trộn bài
          </Button>

          {activeTab === 2 && (
            <Button
              variant="outlined"
              color="primary"
              startIcon={<UploadIcon />}
              onClick={openCreateUploadDialog}
              sx={{
                borderRadius: '24px',
                height: 48,
                px: 3,
                fontWeight: 800,
                fontSize: '0.9rem',
                borderWidth: '2px',
                borderColor: tabColorConfig.color,
                color: tabColorConfig.color,
                '&:hover': { borderWidth: '2px', borderColor: tabColorConfig.color, backgroundColor: `${tabColorConfig.color}08` },
              }}
            >
              Upload bài hát
            </Button>
          )}
        </Box>
      </Box>

      {/* ================= 4. TAB VIEWS CONTENT ================= */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 10 }}>
          <CircularProgress size={40} sx={{ color: tabColorConfig.color }} />
        </Box>
      ) : (
        <>
          {/* ================= PLAYLISTS TAB VIEW ================= */}
          {activeTab === 0 && (
            <Stack spacing={4.5}>
              {/* Redesigned Featured Playlist Horizontal Showcase */}
              {featuredPlaylist && !searchQuery && (
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 900, mb: 2, letterSpacing: -0.5, opacity: 0.9 }}>
                    Playlist nổi bật gần đây
                  </Typography>
                  <Paper
                    onClick={() => navigate(`/client/playlists/${featuredPlaylist._id}`)}
                    sx={{
                      p: 3,
                      borderRadius: '24px',
                      cursor: 'pointer',
                      border: '1px solid',
                      borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                      background: (theme) => theme.palette.mode === 'dark'
                        ? 'linear-gradient(135deg, rgba(108, 99, 255, 0.08) 0%, rgba(255, 255, 255, 0.01) 100%)'
                        : 'linear-gradient(135deg, rgba(108, 99, 255, 0.08) 0%, rgba(255, 255, 255, 0.95) 100%)',
                      transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: '0 16px 40px rgba(108,99,255,0.08)',
                        borderColor: '#6c63ff',
                      },
                    }}
                  >
                    <Grid container spacing={3} alignItems="center">
                      <Grid size={{ xs: 12, sm: 3, md: 2 }}>
                        <Box sx={{ width: '100%', aspectRatio: '1/1', borderRadius: '18px', overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
                          {featuredPlaylist.coverImage && featuredPlaylist.coverImage.trim() !== '' ? (
                            <Box component="img" src={featuredPlaylist.coverImage} alt={featuredPlaylist.name} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <Box sx={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg, #6c63ff 0%, #00bcd4 100%)', color: '#fff' }}>
                              <Typography variant="h4" sx={{ fontWeight: 900 }}>{(featuredPlaylist.name || 'P').charAt(0).toUpperCase()}</Typography>
                            </Box>
                          )}
                        </Box>
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6, md: 8 }} sx={{ minWidth: 0 }}>
                        <Stack spacing={1} alignItems="flex-start">
                          <Box sx={{ bgcolor: 'rgba(108,99,255,0.12)', color: '#6c63ff', px: 1.5, py: 0.5, borderRadius: '20px', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            Đại diện thư viện
                          </Box>
                          <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: -1, fontSize: { xs: '1.5rem', sm: '1.75rem', md: '2rem' } }}>
                            {featuredPlaylist.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 550, fontSize: '0.95rem', lineClamp: 2, WebkitLineClamp: 2, display: '-webkit-box', WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {featuredPlaylist.description || 'Không có mô tả cho playlist này.'}
                          </Typography>
                          <Typography variant="caption" sx={{ fontWeight: 800, color: 'primary.main', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            {featuredPlaylist.songs?.length || 0} bài hát
                          </Typography>
                        </Stack>
                      </Grid>
                      <Grid size={{ xs: 12, sm: 3, md: 2 }} sx={{ display: 'flex', flexDirection: 'column', alignItems: { xs: 'stretch', sm: 'flex-end' }, gap: 1.5 }}>
                        <Button
                          variant="contained"
                          startIcon={<PlayIcon />}
                          onClick={(e) => handlePlaySinglePlaylist(e, featuredPlaylist)}
                          sx={{
                            borderRadius: '16px',
                            py: 1.25,
                            px: 3,
                            width: '100%',
                            fontSize: '0.9rem',
                            fontWeight: 800,
                            background: 'linear-gradient(135deg, #6c63ff 0%, #00bcd4 100%)',
                            boxShadow: '0 6px 20px rgba(108,99,255,0.3)',
                          }}
                        >
                          Phát playlist
                        </Button>
                        <Stack direction="row" spacing={1} sx={{ width: '100%' }}>
                          <Button
                            variant="outlined"
                            fullWidth
                            startIcon={<EditIcon sx={{ fontSize: 16 }} />}
                            onClick={(e) => { e.stopPropagation(); handleOpenPlaylistDialog(featuredPlaylist); }}
                            sx={{ borderRadius: '12px', py: 1, borderColor: 'divider', color: 'text.secondary' }}
                          >
                            Sửa
                          </Button>
                          <Button
                            variant="outlined"
                            fullWidth
                            color="error"
                            startIcon={<DeleteIcon sx={{ fontSize: 16 }} />}
                            onClick={(e) => handleDeletePlaylistClick(e, featuredPlaylist)}
                            sx={{ borderRadius: '12px', py: 1, borderColor: 'divider' }}
                          >
                            Xóa
                          </Button>
                        </Stack>
                      </Grid>
                    </Grid>
                  </Paper>
                </Box>
              )}

              {/* Proportional Grid Playlists (All cards must have identical sizes/heights) */}
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 900, mb: 2.5, letterSpacing: -0.5, opacity: 0.9 }}>
                  Tất cả danh sách phát
                </Typography>
                <Grid container spacing={3.5}>
                  {/* Card đặc biệt tạo playlist (Strictly matches playlist card sizes) */}
                  <Grid size={{ xs: 6, sm: 4, md: 3, lg: 2 }} sx={{ display: 'flex', flexDirection: 'column' }}>
                    <Paper
                      onClick={() => handleOpenPlaylistDialog()}
                      sx={{
                        p: 2.25,
                        borderRadius: '24px',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        flexGrow: 1,
                        position: 'relative',
                        overflow: 'hidden',
                        border: '1px solid',
                        borderColor: 'divider',
                        backgroundColor: 'transparent',
                        transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                        '&:hover': {
                          borderColor: 'primary.main',
                          backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(108,99,255,0.03)' : 'rgba(108,99,255,0.01)',
                          transform: 'translateY(-6px)',
                          '& .add-icon-container': {
                            transform: 'rotate(90deg) scale(1.1)',
                            backgroundColor: 'rgba(108,99,255,0.15)',
                          },
                        },
                      }}
                    >
                      {/* Placeholder cover art */}
                      <Box sx={{ width: '100%', aspectRatio: '1/1', borderRadius: '18px', overflow: 'hidden', position: 'relative', mb: 2, flexShrink: 0 }}>
                        <Box
                          sx={{
                            width: '100%',
                            height: '100%',
                            border: '2px dashed',
                            borderColor: 'divider',
                            backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                            display: 'grid',
                            placeItems: 'center',
                          }}
                        >
                          <Box
                            className="add-icon-container"
                            sx={{
                              width: 58,
                              height: 58,
                              borderRadius: '50%',
                              backgroundColor: 'rgba(108,99,255,0.06)',
                              display: 'grid',
                              placeItems: 'center',
                              color: '#6c63ff',
                              transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                            }}
                          >
                            <AddIcon sx={{ fontSize: 30 }} />
                          </Box>
                        </Box>
                      </Box>
                      {/* Name & description (same structure as playlists) */}
                      <Box sx={{ px: 0.5, display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                        <Typography variant="body1" sx={{ fontWeight: 800, color: 'primary.main' }} noWrap>
                          Tạo playlist mới
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: '18px', fontWeight: 550, mt: 0.25 }}>
                          Tạo danh sách phát cá nhân
                        </Typography>
                        <Typography variant="caption" sx={{ display: 'block', mt: 'auto', pt: 1, fontWeight: 800, color: 'text.secondary' }}>
                          0 bài hát
                        </Typography>
                      </Box>
                    </Paper>
                  </Grid>

                  {/* Grid Playlists */}
                  {(searchQuery ? filteredPlaylists : otherPlaylists).map((playlist) => (
                    <Grid size={{ xs: 6, sm: 4, md: 3, lg: 2 }} key={playlist._id} sx={{ display: 'flex', flexDirection: 'column' }}>
                      <PlaylistCard
                        playlist={playlist}
                        onClick={() => navigate(`/client/playlists/${playlist._id}`)}
                        onPlay={(e) => handlePlaySinglePlaylist(e, playlist)}
                        onEdit={() => handleOpenPlaylistDialog(playlist)}
                        onDelete={() => handleDeletePlaylistClick(playlist)}
                        showPrivacyBadge={true}
                      />
                    </Grid>
                  ))}
                </Grid>
              </Box>
            </Stack>
          )}

          {/* ================= ASYMMETRIC SONGS VIEW LAYOUT (TAB 1, 2, 3) ================= */}
          {activeTab !== 0 && (
            <Grid container spacing={4}>
              {/* Left Sticky Panel */}
              <Grid size={{ xs: 12, md: 4, lg: 3.5 }}>
                <Box sx={{ position: { md: 'sticky' }, top: 88, zIndex: 5 }}>
                  <Paper
                    sx={{
                      p: 4,
                      borderRadius: '28px',
                      border: '1px solid',
                      borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                      background: (theme) => theme.palette.mode === 'dark'
                        ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.02) 0%, rgba(255, 255, 255, 0.005) 100%)'
                        : 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(245,247,250,0.8) 100%)',
                      backdropFilter: 'blur(20px)',
                      boxShadow: `0 15px 35px -10px ${tabColorConfig.color}20`,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      textAlign: 'center',
                    }}
                  >
                    <Box
                      sx={{
                        width: '100%',
                        maxWidth: 240,
                        aspectRatio: '1/1',
                        borderRadius: '24px',
                        overflow: 'hidden',
                        mb: 3,
                        boxShadow: `0 12px 30px ${tabColorConfig.color}35`,
                        background: tabColorConfig.bg,
                        display: 'grid',
                        placeItems: 'center',
                        color: '#fff',
                        position: 'relative',
                      }}
                    >
                      {songWithCover && !coverImageError ? (
                        <Box
                          component="img"
                          src={songWithCover.imageUrl}
                          alt="Cover"
                          onError={() => setCoverImageError(true)}
                          sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <MusicIcon sx={{ fontSize: 80 }} />
                      )}
                    </Box>

                    <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: -0.5, mb: 0.5 }}>
                      {tabColorConfig.label}
                    </Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 800, mb: 3 }}>
                      {activeSongsList.length} bài hát
                    </Typography>

                    {/* Equalizer animation */}
                    {activeSongsList.length > 0 && (
                      <Box sx={{ display: 'flex', alignItems: 'flex-end', height: 40, justifyContent: 'center', mb: 4 }}>
                        <div className="eq-bar eq-bar-1" style={{ backgroundColor: tabColorConfig.color }} />
                        <div className="eq-bar eq-bar-2" style={{ backgroundColor: tabColorConfig.color }} />
                        <div className="eq-bar eq-bar-3" style={{ backgroundColor: tabColorConfig.color }} />
                        <div className="eq-bar eq-bar-4" style={{ backgroundColor: tabColorConfig.color }} />
                      </Box>
                    )}

                    {/* Large buttons */}
                    <Stack spacing={1.5} sx={{ width: '100%' }}>
                      <Button
                        variant="contained"
                        startIcon={<PlayIcon sx={{ fontSize: 24 }} />}
                        onClick={() => handlePlayAll(false)}
                        disabled={!activeSongsList.length}
                        sx={{
                          borderRadius: '20px',
                          py: 1.5,
                          fontSize: '0.95rem',
                          fontWeight: 800,
                          background: tabColorConfig.bg,
                          color: '#fff',
                          boxShadow: `0 8px 25px ${tabColorConfig.color}40`,
                          '&:hover': {
                            transform: 'translateY(-2px)',
                            boxShadow: `0 12px 30px ${tabColorConfig.color}60`,
                          },
                        }}
                      >
                        Phát tất cả
                      </Button>
                      <Button
                        variant="outlined"
                        startIcon={<ShuffleIcon />}
                        onClick={() => handlePlayAll(true)}
                        disabled={!activeSongsList.length}
                        sx={{
                          borderRadius: '20px',
                          py: 1.5,
                          fontSize: '0.95rem',
                          fontWeight: 800,
                          borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)',
                          color: 'text.primary',
                          '&:hover': {
                            borderColor: tabColorConfig.color,
                            backgroundColor: `${tabColorConfig.color}08`,
                          },
                        }}
                      >
                        Trộn bài ngẫu nhiên
                      </Button>
                    </Stack>
                  </Paper>
                </Box>
              </Grid>

              {/* Right Column Song Rows */}
              <Grid size={{ xs: 12, md: 8, lg: 8.5 }}>
                <Box sx={{ maxHeight: 600, overflowY: 'auto', pr: 1.5, pt: '6px', pb: '6px' }}>

                  {activeSongsList.map((song, idx) => (
                    <Box key={song._id} sx={{ mb: 1.5 }}>
                      <SongItem
                        song={song}
                        index={idx + 1}
                        showDuration={true}
                        isCurrent={currentSong?._id === song._id}
                        isPlaying={isPlaying}
                        onPlay={() => playSong(song, { queue: activeSongsList })}
                        onEdit={activeTab === 2 ? openEditUploadDialog : undefined}
                        moreMenuButtonSx={{
                          color: 'text.secondary',
                          backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                        }}
                        actions={
                          <>
                            {activeTab === 1 && (
                              <IconButton
                                size="small"
                                onClick={(e) => handleRemoveFavorite(e, song._id)}
                                sx={{
                                  color: '#ff4e7c',
                                  backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                                  '&:hover': { backgroundColor: 'rgba(255,78,124,0.1)' },
                                }}
                                title="Bỏ yêu thích"
                              >
                                <DeleteIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            )}

                            {activeTab === 3 && (
                              <IconButton
                                size="small"
                                onClick={(e) => handleRemoveDownloaded(e, song._id)}
                                sx={{
                                  color: '#ff4e7c',
                                  backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                                  '&:hover': { backgroundColor: 'rgba(255,78,124,0.1)' },
                                }}
                                title="Xóa lịch sử tải"
                              >
                                <DeleteIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            )}
                          </>
                        }
                      />
                    </Box>
                  ))}
                  {!activeSongsList.length && (
                    <Box sx={{ textAlign: 'center', py: 8, border: '1px dashed', borderColor: 'divider', borderRadius: '24px' }}>
                      <Typography color="text.secondary" fontWeight={500}>Không tìm thấy bài hát nào.</Typography>
                    </Box>
                  )}
                </Box>
              </Grid>
            </Grid>
          )}
        </>
      )}

      {/* ================= 5. CREATE / EDIT PLAYLIST DIALOG ================= */}
      <Dialog
        open={playlistDialogOpen}
        onClose={() => !playlistSaving && setPlaylistDialogOpen(false)}
        fullWidth
        maxWidth="xs"
        PaperProps={{
          sx: {
            borderRadius: '24px',
            p: 1.5,
            border: '1px solid',
            borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
            backgroundImage: (theme) => theme.palette.mode === 'dark'
              ? 'radial-gradient(circle at top right, rgba(108, 99, 255, 0.12), transparent 60%)'
              : 'radial-gradient(circle at top right, rgba(6, 182, 212, 0.1), transparent 60%)',
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 900, fontSize: '1.35rem', pb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {isEditMode ? 'Chỉnh sửa playlist' : 'Tạo playlist mới'}
          <IconButton size="small" onClick={() => setPlaylistDialogOpen(false)} disabled={playlistSaving}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 1 }}>
          <TextField
            autoFocus
            label="Tên playlist *"
            value={playlistName}
            onChange={(e) => setPlaylistName(e.target.value)}
            fullWidth
            variant="outlined"
            InputProps={{ sx: { borderRadius: '14px' } }}
          />

          <TextField
            label="Mô tả"
            value={playlistDescription}
            onChange={(e) => setPlaylistDescription(e.target.value)}
            fullWidth
            multiline
            minRows={2}
            variant="outlined"
            InputProps={{ sx: { borderRadius: '14px' } }}
          />

          <TextField
            label="URL Ảnh bìa"
            value={playlistCoverImage}
            onChange={(e) => setPlaylistCoverImage(e.target.value)}
            fullWidth
            variant="outlined"
            InputProps={{ sx: { borderRadius: '14px' } }}
          />

          {/* Presets Row */}
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800, display: 'block', mb: 1, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Hoặc chọn mẫu ảnh bìa ấn tượng:
            </Typography>
            <Stack direction="row" spacing={1.5} sx={{ overflowX: 'auto', pb: 1 }}>
              {PLAYLIST_PRESETS.map((preset, i) => (
                <Box
                  key={i}
                  onClick={() => setPlaylistCoverImage(preset.url)}
                  sx={{
                    width: 58,
                    height: 58,
                    borderRadius: '10px',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    position: 'relative',
                    border: '2.5px solid',
                    borderColor: playlistCoverImage === preset.url ? '#6c63ff' : 'transparent',
                    boxShadow: playlistCoverImage === preset.url ? '0 0 12px rgba(108,99,255,0.4)' : 'none',
                    transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                    '&:hover': {
                      transform: 'scale(1.08)',
                    },
                  }}
                  title={preset.name}
                >
                  <Box
                    component="img"
                    src={preset.url}
                    alt={preset.name}
                    sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </Box>
              ))}
            </Stack>
          </Box>

          <FormControlLabel
            control={
              <Switch
                checked={playlistIsPublic}
                onChange={(e) => setPlaylistIsPublic(e.target.checked)}
                color="primary"
              />
            }
            label={
              <Typography variant="body2" fontWeight={700}>
                {playlistIsPublic ? 'Công khai cho mọi người xem' : 'Chỉ mình bạn truy cập (Riêng tư)'}
              </Typography>
            }
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button
            onClick={() => setPlaylistDialogOpen(false)}
            disabled={playlistSaving}
            sx={{ borderRadius: '12px', fontWeight: 800, color: 'text.secondary' }}
          >
            Hủy
          </Button>
          <Button
            onClick={handleSavePlaylist}
            disabled={playlistSaving}
            variant="contained"
            sx={{
              borderRadius: '12px',
              px: 3.5,
              fontWeight: 800,
              background: 'linear-gradient(135deg, #6c63ff 0%, #00bcd4 100%)',
              color: '#fff',
              boxShadow: '0 4px 15px rgba(108, 99, 255, 0.3)',
              transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
              '&:hover': {
                background: 'linear-gradient(135deg, #5b54e0 0%, #00a4b8 100%)',
                transform: 'scale(1.03)',
              },
            }}
          >
            {playlistSaving ? 'Đang lưu...' : 'Lưu lại'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ================= 6. DELETE CONFIRMATION DIALOG ================= */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        PaperProps={{
          sx: { borderRadius: '20px', p: 1 }
        }}
      >
        <DialogTitle sx={{ fontWeight: 900 }}>Xóa danh sách phát</DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ color: 'text.secondary', fontWeight: 500 }}>
            Bạn có chắc muốn xóa playlist <strong>"{playlistToDelete?.name}"</strong> không? Bài hát trong playlist sẽ không bị xóa và hành động này không thể hoàn tác.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteConfirmOpen(false)} sx={{ borderRadius: '10px', color: 'text.secondary', fontWeight: 700 }}>
            Hủy
          </Button>
          <Button onClick={handleConfirmDeletePlaylist} color="error" variant="contained" sx={{ borderRadius: '10px', px: 2.5, fontWeight: 700 }}>
            Đồng ý xóa
          </Button>
        </DialogActions>
      </Dialog>

      {/* ================= 7. UPLOAD SONG DIALOG ================= */}
      <Dialog
        open={uploadOpen}
        onClose={() => {
          if (uploading) return;
          setUploadOpen(false);
          resetUploadForm();
        }}
        fullWidth
        maxWidth="sm"
        PaperProps={{ sx: { borderRadius: '24px' } }}
      >
        <DialogTitle sx={{ fontWeight: 900, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {editingUploadSong ? 'Chỉnh sửa bài hát' : 'Tải lên bài hát mới'}
          <IconButton
            size="small"
            onClick={() => {
              setUploadOpen(false);
              resetUploadForm();
            }}
            disabled={uploading}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField
              label="Tên bài hát (tùy chọn)"
              value={uploadTitle}
              onChange={(event) => setUploadTitle(event.target.value)}
              fullWidth
              InputProps={{ sx: { borderRadius: '14px' } }}
            />
            <TextField
              label="Lời bài hát (tùy chọn)"
              value={uploadLyrics}
              onChange={(event) => setUploadLyrics(event.target.value)}
              multiline
              minRows={3}
              fullWidth
              InputProps={{ sx: { borderRadius: '14px' } }}
            />

            <Button variant="outlined" component="label" sx={{ py: 1.5, borderRadius: '14px', borderColor: 'divider', borderWidth: '2px', '&:hover': { borderWidth: '2px' } }}>
              {editingUploadSong ? 'Chọn file nhạc mới (tùy chọn)' : 'Chọn file nhạc phát * (MP3, WAV, FLAC, M4A)'}
              <input
                type="file"
                accept="audio/*"
                hidden
                onChange={(event) => setUploadAudioFile(event.target.files?.[0] || null)}
              />
            </Button>
            {uploadAudioFile && (
              <Typography variant="caption" color="primary" sx={{ mt: -1, fontWeight: 800 }}>
                Đã chọn: {uploadAudioFile.name}
              </Typography>
            )}

            <Button variant="outlined" component="label" sx={{ py: 1.5, borderRadius: '14px', borderColor: 'divider', borderWidth: '2px', '&:hover': { borderWidth: '2px' } }}>
              Chọn hình ảnh bìa (tùy chọn)
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={(event) => setUploadImageFile(event.target.files?.[0] || null)}
              />
            </Button>
            {uploadImageFile && (
              <Typography variant="caption" color="primary" sx={{ mt: -1, fontWeight: 800 }}>
                Đã chọn ảnh: {uploadImageFile.name}
              </Typography>
            )}
            <TextField
              label="Hoặc dán URL hình ảnh bìa (tùy chọn)"
              value={uploadImageUrl}
              onChange={(event) => setUploadImageUrl(event.target.value)}
              placeholder="https://..."
              helperText="Có thể chọn file hoặc dán URL ảnh. Nếu có cả hai, file ảnh sẽ được ưu tiên."
              fullWidth
              InputProps={{ sx: { borderRadius: '14px' } }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button
            onClick={() => {
              if (uploading) return;
              setUploadOpen(false);
              resetUploadForm();
            }}
            sx={{ borderRadius: '12px', color: 'text.secondary', fontWeight: 800 }}
          >
            Hủy
          </Button>
          <Button onClick={handleUploadSubmit} disabled={uploading} variant="contained" sx={{ borderRadius: '12px', px: 3.5, fontWeight: 800 }}>
            {uploading
              ? (editingUploadSong ? 'Đang cập nhật...' : 'Đang tải lên...')
              : (editingUploadSong ? 'Cập nhật' : 'Tải lên ngay')}
          </Button>
        </DialogActions>
      </Dialog>
    </ClientLayout>
  );
}

export default ClientLibrary;
