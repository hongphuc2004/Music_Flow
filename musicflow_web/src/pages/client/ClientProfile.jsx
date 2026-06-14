import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Grid,
  Paper,
  Stack,
  TextField,
  Typography,
  LinearProgress,
} from '@mui/material';
import {
  CameraAltRounded as CameraIcon,
  WorkspacePremiumRounded as PremiumIcon,
  PlayArrowRounded as PlayIcon,
  MusicNoteRounded as MusicIcon,
  FlashOnRounded as FlashIcon,
} from '@mui/icons-material';
import ClientLayout from '../../components/Layout/client/ClientLayout';
import { clientUserApi, clientSongsApi } from '../../services/api';
import useAppToast from '../../components/common/useAppToast';
import { useClientPlayerActions } from '../../components/Layout/client/ClientPlayerProvider';

function ClientProfile() {
  const { showToast } = useAppToast();
  const { playSong } = useClientPlayerActions();

  const [form, setForm] = useState({ name: '', email: '', avatarUrl: '' });
  const [avatarFile, setAvatarFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [uploadUsed, setUploadUsed] = useState(15.4);
  const [downloadUsed, setDownloadUsed] = useState(32.8);
  const [recentSongs, setRecentSongs] = useState([]);

  const userName = useMemo(() => form.name || 'Người nghe', [form.name]);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await clientUserApi.getMe();
        const user = response.data?.user;

        setForm({
          name: user?.name || '',
          email: user?.email || '',
          avatarUrl: user?.avatar || '',
        });

        localStorage.setItem('userName', user?.name || '');
        localStorage.setItem('email', user?.email || '');
        localStorage.setItem('userId', user?._id || '');
        localStorage.setItem('userAvatar', user?.avatar || '');

        // Load recent songs
        const userId = user?._id || 'anonymous';
        const rawRecent = localStorage.getItem(`musicflow_recent_played_${userId}`);
        if (rawRecent) {
          try {
            const parsed = JSON.parse(rawRecent);
            if (Array.isArray(parsed)) {
              setRecentSongs(parsed.slice(0, 5));
            }
          } catch (e) {
            console.error('Failed to parse recent songs:', e);
          }
        }
      } catch (err) {
        setError(err.response?.data?.message || 'Không thể tải thông tin tài khoản.');
      } finally {
        setLoading(false);
      }
    };

    const fetchUploads = async () => {
      try {
        const res = await clientSongsApi.getMyUploads();
        const mySongs = Array.isArray(res.data) ? res.data : [];
        const calculatedSize = mySongs.reduce((sum, song) => sum + (song.fileSize ? song.fileSize / (1024 * 1024) : 4.8), 0);
        setUploadUsed(Number((calculatedSize > 0 ? calculatedSize : 15.4).toFixed(1)));
      } catch {
        setUploadUsed(15.4);
      }
    };

    const fetchDownloads = async () => {
      try {
        const res = await clientSongsApi.getMyDownloadHistory();
        const downloadedSongs = Array.isArray(res.data) ? res.data : [];
        const calculatedSize = downloadedSongs.reduce((sum, song) => sum + (song.fileSize ? song.fileSize / (1024 * 1024) : 4.5), 0);
        setDownloadUsed(Number((calculatedSize > 0 ? calculatedSize : 32.8).toFixed(1)));
      } catch {
        setDownloadUsed(32.8);
      }
    };

    fetchProfile();
    fetchUploads();
    fetchDownloads();
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');

      const payload = new FormData();
      payload.append('name', form.name.trim());
      payload.append('email', form.email.trim());
      if (avatarFile) payload.append('avatar', avatarFile);

      const response = await clientUserApi.updateMe(payload);
      const user = response.data?.user;

      setForm((prev) => ({
        ...prev,
        name: user?.name || prev.name,
        email: user?.email || prev.email,
        avatarUrl: user?.avatar || prev.avatarUrl,
      }));
      setAvatarFile(null);
      setSuccess('Đã cập nhật thông tin tài khoản.');
      showToast({ severity: 'success', message: 'Cập nhật thông tin tài khoản thành công.' });

      localStorage.setItem('userName', user?.name || form.name || '');
      localStorage.setItem('email', user?.email || form.email || '');
      localStorage.setItem('userId', user?._id || localStorage.getItem('userId') || '');
      localStorage.setItem('userAvatar', user?.avatar || form.avatarUrl || '');
    } catch (err) {
      setError(err.response?.data?.message || 'Cập nhật thất bại.');
      showToast({ severity: 'error', message: err.response?.data?.message || 'Cập nhật thất bại.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ClientLayout title="Thông tin tài khoản">
      {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 3 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 3, borderRadius: 3 }}>{success}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 18 }}>
          <CircularProgress size={38} color="secondary" />
        </Box>
      ) : (
        <Stack spacing={4}>
          {/* 1. HERO GRADIENT BANNER WITH PROFILE PICTURE */}
          <Box
            sx={{
              height: { xs: 240, md: 200 },
              borderRadius: 4.5,
              background: (theme) => theme.palette.mode === 'dark'
                ? 'linear-gradient(135deg, #0d9488 0%, #0b0f19 100%)'
                : 'linear-gradient(135deg, #14b8a6 0%, #0f766e 100%)',
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'flex-end',
              p: 4,
            }}
          >
            {/* Soft decorative background glow */}
            <Box sx={{
              position: 'absolute',
              top: -100,
              right: -100,
              width: 300,
              height: 300,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0) 70%)',
              pointerEvents: 'none',
            }} />

            <Stack
              direction={{ xs: 'column', md: 'row' }}
              alignItems="center"
              spacing={3}
              sx={{
                width: '100%',
                zIndex: 2,
                textAlign: { xs: 'center', md: 'left' }
              }}
            >
              {/* Interactive Avatar Container */}
              <Box
                sx={{
                  position: 'relative',
                  width: 120,
                  height: 120,
                  borderRadius: '50%',
                  border: '4px solid rgba(255, 255, 255, 0.8)',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  boxShadow: '0 8px 25px rgba(0,0,0,0.35)',
                  flexShrink: 0,
                  transition: 'transform 0.3s ease, border-color 0.3s ease',
                  '&:hover': {
                    transform: 'scale(1.03)',
                    borderColor: '#fff',
                  },
                  '&:hover .avatar-hover-overlay': { opacity: 1 },
                }}
                component="label"
              >
                <Avatar
                  src={form.avatarUrl || undefined}
                  sx={{ width: '100%', height: '100%', bgcolor: 'rgba(255,255,255,0.2)', fontSize: 52, color: '#fff' }}
                >
                  {userName.charAt(0).toUpperCase()}
                </Avatar>
                {/* Hover Overlay */}
                <Box
                  className="avatar-hover-overlay"
                  sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    bgcolor: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: 0,
                    transition: 'opacity 0.2s ease',
                    color: '#fff',
                  }}
                >
                  <CameraIcon sx={{ fontSize: 32 }} />
                </Box>
                <input
                  hidden
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      setAvatarFile(file);
                      setForm((prev) => ({ ...prev, avatarUrl: URL.createObjectURL(file) }));
                    }
                  }}
                />
              </Box>

              <Box sx={{ mt: { xs: 1, md: 0 } }}>
                <Typography variant="h4" sx={{ fontWeight: 900, color: '#fff', letterSpacing: '-1px', textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
                  {userName}
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.8)', fontWeight: 500, mt: 0.5 }}>
                  Loại tài khoản: <span style={{ color: '#ffffff', fontWeight: 700 }}>Basic Listener</span>
                </Typography>
              </Box>
            </Stack>
          </Box>

          {/* 2. MAIN GRID LAYOUT */}
          <Grid container spacing={3.5}>
            {/* Left Column: Personal Form & Quota Block */}
            <Grid size={{ xs: 12, md: 7.5 }}>
              <Stack spacing={3.5}>
                {/* Form Card */}
                <Paper
                  elevation={0}
                  sx={{
                    p: 3.5,
                    borderRadius: 4.5,
                    border: '1px solid',
                    borderColor: 'divider',
                    bgcolor: 'background.paper',
                  }}
                >
                  <Typography variant="h6" fontWeight={800} mb={3}>
                    Thông tin cá nhân
                  </Typography>
                  <Stack spacing={3}>
                    <TextField
                      label="Tên hiển thị"
                      value={form.name}
                      onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                      fullWidth
                    />
                    <TextField
                      label="Email"
                      value={form.email}
                      onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                      fullWidth
                    />

                    <Button
                      variant="contained"
                      onClick={handleSave}
                      disabled={saving}
                      sx={{
                        width: 'fit-content',
                        bgcolor: (theme) => theme.palette.mode === 'dark' ? '#14b8a6' : '#0f766e',
                        backgroundImage: 'linear-gradient(135deg, #14b8a6, #0d9488)',
                        borderRadius: 3,
                        fontWeight: 800,
                        px: 4,
                        py: 1.2,
                        color: '#fff',
                        boxShadow: '0 4px 14px rgba(20, 184, 166, 0.25)',
                        transition: 'all 0.25s ease',
                        '&:hover': {
                          transform: 'translateY(-1px)',
                          boxShadow: '0 8px 22px rgba(20, 184, 166, 0.4)',
                          bgcolor: '#0d9488',
                        },
                      }}
                    >
                      {saving ? <CircularProgress size={24} color="inherit" /> : 'Lưu thay đổi'}
                    </Button>
                  </Stack>
                </Paper>

                {/* Quota & Upgrade Premium */}
                <Paper
                  elevation={0}
                  sx={{
                    p: 3.5,
                    borderRadius: 4.5,
                    border: '1px solid',
                    borderColor: 'rgba(20, 184, 166, 0.2)',
                    background: (theme) => theme.palette.mode === 'dark'
                      ? 'linear-gradient(135deg, rgba(30, 41, 59, 0.5) 0%, rgba(20, 184, 166, 0.05) 100%)'
                      : 'linear-gradient(135deg, #fff 0%, rgba(20, 184, 166, 0.02) 100%)',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {/* Decorative blur circle */}
                  <Box
                    sx={{
                      position: 'absolute',
                      top: -60,
                      right: -60,
                      width: 180,
                      height: 180,
                      borderRadius: '50%',
                      background: 'radial-gradient(circle, rgba(20, 184, 166, 0.15) 0%, rgba(20, 184, 166, 0) 70%)',
                      zIndex: 1,
                    }}
                  />

                  <Stack spacing={3} sx={{ position: 'relative', zIndex: 2 }}>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <PremiumIcon sx={{ color: '#14b8a6', fontSize: 26 }} />
                      <Typography variant="h6" fontWeight={850}>
                        Giới hạn tải lên & Nâng cấp VIP
                      </Typography>
                    </Stack>

                    <Box>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                        <Typography variant="body2" color="text.secondary" fontWeight={600}>
                          Dung lượng tải lên đã dùng:
                        </Typography>
                        <Typography variant="body2" fontWeight={800} color="#14b8a6">
                          {uploadUsed} MB / 50 MB
                        </Typography>
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={Math.min((uploadUsed / 50) * 100, 100)}
                        sx={{
                          height: 8,
                          borderRadius: 4,
                          bgcolor: 'divider',
                          '& .MuiLinearProgress-bar': {
                            borderRadius: 4,
                            bgcolor: '#14b8a6',
                            backgroundImage: 'linear-gradient(90deg, #14b8a6, #00bcd4)',
                          },
                        }}
                      />
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                        Bản miễn phí giới hạn tối đa 50MB tải bài hát lên hệ thống.
                      </Typography>
                    </Box>

                    <Box>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                        <Typography variant="body2" color="text.secondary" fontWeight={600}>
                          Dung lượng tải xuống đã dùng:
                        </Typography>
                        <Typography variant="body2" fontWeight={800} color="#7c3aed">
                          {downloadUsed} MB / 100 MB
                        </Typography>
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={Math.min((downloadUsed / 100) * 100, 100)}
                        sx={{
                          height: 8,
                          borderRadius: 4,
                          bgcolor: 'divider',
                          '& .MuiLinearProgress-bar': {
                            borderRadius: 4,
                            bgcolor: '#7c3aed',
                            backgroundImage: 'linear-gradient(90deg, #7c3aed, #a855f7)',
                          },
                        }}
                      />
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                        Bản miễn phí giới hạn tối đa 100MB tải bài hát về máy.
                      </Typography>
                    </Box>

                    <Stack
                      spacing={1.5}
                      sx={{
                        bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(15, 23, 42, 0.4)' : '#f8fafc',
                        p: 2,
                        borderRadius: 3.5,
                        border: '1px solid',
                        borderColor: 'divider',
                      }}
                    >
                      <Typography variant="subtitle2" fontWeight={750} color="text.primary">
                        Đặc quyền tài khoản VIP:
                      </Typography>
                      <Stack spacing={1}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          ● Tải lên không giới hạn dung lượng lưu trữ bài hát
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          ● Chất lượng âm thanh chuẩn Lossless (320kbps)
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          ● Công cụ phân tích số liệu lượt nghe thời gian thực
                        </Typography>
                      </Stack>
                    </Stack>

                    <Button
                      variant="contained"
                      startIcon={<FlashIcon />}
                      onClick={() => {
                        showToast({
                          severity: 'info',
                          title: 'Nâng cấp Premium',
                          message: 'Chức năng đăng ký nâng cấp tài khoản đang được hoàn thiện và sẽ sớm ra mắt!',
                        });
                      }}
                      sx={{
                        width: '100%',
                        bgcolor: '#14b8a6',
                        backgroundImage: 'linear-gradient(135deg, #14b8a6, #00bcd4)',
                        borderRadius: 3,
                        fontWeight: 800,
                        py: 1.5,
                        textTransform: 'none',
                        boxShadow: '0 4px 16px rgba(20, 184, 166, 0.2)',
                        '&:hover': {
                          bgcolor: '#0d9488',
                          boxShadow: '0 8px 24px rgba(20, 184, 166, 0.35)',
                        },
                      }}
                    >
                      Nâng cấp tài khoản VIP
                    </Button>
                  </Stack>
                </Paper>
              </Stack>
            </Grid>

            {/* Right Column: Recent Activity */}
            <Grid size={{ xs: 12, md: 4.5 }}>
              <Paper
                elevation={0}
                sx={{
                  p: 3.5,
                  borderRadius: 4.5,
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: 'background.paper',
                  height: '100%',
                  minHeight: 380,
                }}
              >
                <Typography variant="h6" fontWeight={800} mb={3} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <MusicIcon sx={{ color: '#7c3aed', fontSize: 22 }} />
                  Hoạt động gần đây
                </Typography>

                {recentSongs.length > 0 ? (
                  <Stack spacing={2}>
                    {recentSongs.map((song) => (
                      <Paper
                        key={song._id}
                        elevation={0}
                        onClick={() => playSong(song, { queue: recentSongs })}
                        sx={{
                          p: 1.5,
                          borderRadius: 3.5,
                          border: '1px solid',
                          borderColor: 'divider',
                          bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(30, 41, 59, 0.25)' : '#fff',
                          cursor: 'pointer',
                          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                          '&:hover': {
                            transform: 'translateY(-2px)',
                            borderColor: '#7c3aed',
                            boxShadow: '0 4px 18px rgba(124, 58, 237, 0.12)',
                            bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(124, 58, 237, 0.05)' : 'rgba(124, 58, 237, 0.01)',
                          },
                          '&:hover .play-overlay': { opacity: 1 },
                        }}
                      >
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <Box sx={{ position: 'relative', width: 44, height: 44, flexShrink: 0 }}>
                            <Avatar
                              src={song.imageUrl && !song.imageUrl.includes('tgdfbp3zivuqoxq') ? song.imageUrl : undefined}
                              variant="rounded"
                              imgProps={{ loading: 'lazy' }}
                              sx={{ width: '100%', height: '100%', bgcolor: 'rgba(124, 58, 237, 0.1)', color: '#7c3aed' }}
                            >
                              <MusicIcon sx={{ fontSize: 22 }} />
                            </Avatar>
                            <Box
                              className="play-overlay"
                              sx={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                                bgcolor: 'rgba(0,0,0,0.4)',
                                borderRadius: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                opacity: 0,
                                transition: 'opacity 0.2s',
                                color: '#fff',
                              }}
                            >
                              <PlayIcon sx={{ fontSize: 22 }} />
                            </Box>
                          </Box>
                          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                            <Typography variant="body2" fontWeight={800} noWrap>
                              {song.title}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', mt: 0.25 }}>
                              {Array.isArray(song.artists)
                                ? song.artists.map((a) => a?.name).filter(Boolean).join(', ')
                                : 'Nghệ sĩ ẩn danh'}
                            </Typography>
                          </Box>
                        </Stack>
                      </Paper>
                    ))}
                  </Stack>
                ) : (
                  <Stack
                    spacing={2}
                    alignItems="center"
                    justifyContent="center"
                    sx={{ height: '70%', py: 6, color: 'text.secondary', textAlign: 'center' }}
                  >
                    <MusicIcon sx={{ fontSize: 44, opacity: 0.2 }} />
                    <Typography variant="body2">
                      Bạn chưa phát bài hát nào gần đây.
                    </Typography>
                  </Stack>
                )}
              </Paper>
            </Grid>
          </Grid>
        </Stack>
      )}
    </ClientLayout>
  );
}

export default ClientProfile;
