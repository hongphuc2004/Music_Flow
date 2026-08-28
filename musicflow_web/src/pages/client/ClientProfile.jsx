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
  Chip,
  Divider,
} from '@mui/material';
import {
  CameraAltRounded as CameraIcon,
  WorkspacePremiumRounded as PremiumIcon,
  PlayArrowRounded as PlayIcon,
  MusicNoteRounded as MusicIcon,
  FlashOnRounded as FlashIcon,
  AutoAwesomeRounded as SparklesIcon,
  CloudUploadRounded as UploadIcon,
  DownloadRounded as DownloadIcon,
  CheckCircleRounded as CheckIcon,
  ArrowForwardRounded as ArrowIcon,
  HeadphonesRounded as HeadphonesIcon,
  BlockRounded as AdBlockIcon,
  StarRounded as StarIcon,
} from '@mui/icons-material';
import ClientLayout from '../../components/Layout/client/ClientLayout';
import { clientUserApi, clientSongsApi, clientPlansApi, clientSubscriptionApi } from '../../services/client/client.service';
import useAppToast from '../../components/common/useAppToast';
import { useClientPlayer, useClientPlayerActions } from '../../components/Layout/client/ClientPlayerProvider';
import { notifyClientSessionChanged } from '../../hooks/useClientSession';
import { useNavigate } from 'react-router-dom';

function ClientProfile() {
  const { showToast } = useAppToast();
  const { currentSong, isPlaying } = useClientPlayer();
  const { playSong } = useClientPlayerActions();
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', avatarUrl: '' });
  const [avatarFile, setAvatarFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [uploadUsed, setUploadUsed] = useState(0);
  const [downloadUsed, setDownloadUsed] = useState(0);
  const [recentSongs, setRecentSongs] = useState([]);
  
  const [plans, setPlans] = useState([]);
  const [activeSub, setActiveSub] = useState(null);

  const userName = useMemo(() => form.name || 'Người nghe', [form.name]);

  const isPremium = useMemo(() => {
    return (user?.isPremium && user?.premiumExpiry && new Date(user.premiumExpiry) > new Date()) || !!activeSub;
  }, [user, activeSub]);

  useEffect(() => {
    const fetchProfileAndPlans = async () => {
      try {
        setLoading(true);
        setError('');
        
        // 1. Fetch User info
        const response = await clientUserApi.getMe();
        const userObj = response.data?.user;
        setUser(userObj);

        setForm({
          name: userObj?.name || '',
          email: userObj?.email || '',
          avatarUrl: userObj?.avatar || '',
        });

        localStorage.setItem('userName', userObj?.name || '');
        localStorage.setItem('email', userObj?.email || '');
        localStorage.setItem('userId', userObj?._id || '');
        localStorage.setItem('userAvatar', userObj?.avatar || '');
        notifyClientSessionChanged();

        // 2. Fetch Subscription & Plans
        try {
          const [subRes, plansRes] = await Promise.all([
            clientSubscriptionApi.getCurrent(),
            clientPlansApi.getActive(),
          ]);
          setActiveSub(subRes.data?.data?.activeSubscription || null);
          setPlans(plansRes.data?.data || []);
        } catch {
          // ignore if non-critical
        }

        // 3. Load recent songs
        const userId = userObj?._id || 'anonymous';
        const rawRecent = localStorage.getItem(`musicflow_recent_played_${userId}`);
        if (rawRecent) {
          try {
            const parsed = JSON.parse(rawRecent);
            if (Array.isArray(parsed)) {
              setRecentSongs(parsed.slice(0, 6));
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
        const mySongs = Array.isArray(res.data?.songs) ? res.data.songs : [];
        const calculatedSize = mySongs.reduce((sum, song) => sum + (song.fileSize ? song.fileSize / (1024 * 1024) : 4.8), 0);
        setUploadUsed(Number(calculatedSize.toFixed(1)));
      } catch {
        setUploadUsed(0);
      }
    };

    const fetchDownloads = async () => {
      try {
        const res = await clientSongsApi.getMyDownloadHistory();
        const downloadedSongs = Array.isArray(res.data?.songs) ? res.data.songs : [];
        const calculatedSize = downloadedSongs.reduce((sum, song) => sum + (song.fileSize ? song.fileSize / (1024 * 1024) : 4.5), 0);
        setDownloadUsed(Number(calculatedSize.toFixed(1)));
      } catch {
        setDownloadUsed(0);
      }
    };

    fetchProfileAndPlans();
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
      const userObj = response.data?.user;
      setUser(userObj);

      setForm((prev) => ({
        ...prev,
        name: userObj?.name || prev.name,
        email: userObj?.email || prev.email,
        avatarUrl: userObj?.avatar || prev.avatarUrl,
      }));
      setAvatarFile(null);
      setSuccess('Đã cập nhật thông tin tài khoản.');
      showToast({ severity: 'success', message: 'Cập nhật thông tin tài khoản thành công.' });

      localStorage.setItem('userName', userObj?.name || form.name || '');
      localStorage.setItem('email', userObj?.email || form.email || '');
      localStorage.setItem('userId', userObj?._id || localStorage.getItem('userId') || '');
      localStorage.setItem('userAvatar', userObj?.avatar || form.avatarUrl || '');
      notifyClientSessionChanged();
    } catch (err) {
      setError(err.response?.data?.message || 'Cập nhật thất bại.');
      showToast({ severity: 'error', message: err.response?.data?.message || 'Cập nhật thất bại.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ClientLayout title="Hồ Sơ & Gói Dịch Vụ">
      {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 3 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 3, borderRadius: 3 }}>{success}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 18 }}>
          <CircularProgress size={44} sx={{ color: '#6c63ff' }} />
        </Box>
      ) : (
        <Stack spacing={4} sx={{ pb: 6 }}>
          {/* ── 1. MASTER PROFILE HERO STAGE ── */}
          <Box
            sx={{
              minHeight: { xs: 260, md: 220 },
              borderRadius: '28px',
              position: 'relative',
              overflow: 'hidden',
              backgroundImage: isPremium
                ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.9) 0%, rgba(108, 99, 255, 0.85) 60%, rgba(10, 15, 30, 0.95) 100%), url(https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1400)'
                : 'linear-gradient(135deg, rgba(13, 148, 136, 0.85) 0%, rgba(108, 99, 255, 0.75) 50%, rgba(9, 13, 26, 0.95) 100%), url(https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1400)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              p: { xs: 3, sm: 4.5 },
              border: '1px solid rgba(255, 255, 255, 0.18)',
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.5)',
            }}
          >
            {/* Ambient blur circle */}
            <Box
              sx={{
                position: 'absolute',
                top: -80,
                right: -80,
                width: 320,
                height: 320,
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.12)',
                filter: 'blur(60px)',
                pointerEvents: 'none',
              }}
            />

            <Stack
              direction={{ xs: 'column', md: 'row' }}
              alignItems={{ xs: 'center', md: 'center' }}
              justifyContent="space-between"
              spacing={3.5}
              sx={{ width: '100%', zIndex: 2 }}
            >
              {/* User Avatar & Info */}
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                alignItems="center"
                spacing={3}
                sx={{ textAlign: { xs: 'center', sm: 'left' } }}
              >
                <Box
                  sx={{
                    position: 'relative',
                    width: 110,
                    height: 110,
                    borderRadius: '50%',
                    border: isPremium ? '4px solid #f59e0b' : '4px solid rgba(255, 255, 255, 0.8)',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    boxShadow: isPremium ? '0 0 25px rgba(245, 158, 11, 0.6)' : '0 8px 25px rgba(0,0,0,0.35)',
                    flexShrink: 0,
                    transition: 'transform 0.3s ease',
                    '&:hover': {
                      transform: 'scale(1.05)',
                    },
                    '&:hover .avatar-hover-overlay': { opacity: 1 },
                  }}
                  component="label"
                >
                  <Avatar
                    src={form.avatarUrl || undefined}
                    sx={{ width: '100%', height: '100%', bgcolor: 'rgba(255,255,255,0.2)', fontSize: 44, color: '#fff', fontWeight: 900 }}
                  >
                    {userName.charAt(0).toUpperCase()}
                  </Avatar>
                  <Box
                    className="avatar-hover-overlay"
                    sx={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      bgcolor: 'rgba(0,0,0,0.6)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: 0,
                      transition: 'opacity 0.2s ease',
                      color: '#fff',
                    }}
                  >
                    <CameraIcon sx={{ fontSize: 30 }} />
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

                <Box>
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ justifyContent: { xs: 'center', sm: 'flex-start' }, mb: 0.5 }}>
                    <Typography variant="h4" sx={{ fontWeight: 950, letterSpacing: '-0.03em', fontSize: { xs: '1.7rem', sm: '2.2rem' } }}>
                      {userName}
                    </Typography>
                    {isPremium ? (
                      <Chip
                        icon={<StarIcon sx={{ color: '#090d1a !important', fontSize: 16 }} />}
                        label="VIP PREMIUM"
                        sx={{
                          fontWeight: 900,
                          fontSize: 11,
                          bgcolor: '#f59e0b',
                          color: '#090d1a',
                          boxShadow: '0 4px 14px rgba(245, 158, 11, 0.4)',
                        }}
                      />
                    ) : (
                      <Chip
                        label="BASIC"
                        size="small"
                        sx={{
                          fontWeight: 850,
                          fontSize: 11,
                          bgcolor: 'rgba(255, 255, 255, 0.2)',
                          color: '#fff',
                          backdropFilter: 'blur(10px)',
                          border: '1px solid rgba(255, 255, 255, 0.3)',
                        }}
                      />
                    )}
                  </Stack>

                  <Typography variant="body2" sx={{ opacity: 0.9, fontWeight: 550, textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>
                    Gói tài khoản:{' '}
                    <span style={{ color: isPremium ? '#ffd700' : '#00e5ff', fontWeight: 800 }}>
                      {isPremium ? (activeSub?.planName || 'MusicFlow Premium Pro') : 'Basic Listener (Miễn Phí)'}
                    </span>
                  </Typography>

                  {isPremium && (user?.premiumExpiry || activeSub?.endDate) && (
                    <Typography variant="caption" sx={{ opacity: 0.85, fontWeight: 600, display: 'block', mt: 0.5 }}>
                      ⏳ Hạn sử dụng:{' '}
                      {new Date(user?.premiumExpiry || activeSub?.endDate).toLocaleDateString('vi-VN')}
                    </Typography>
                  )}
                </Box>
              </Stack>

              {/* Quick Action Button */}
              <Box>
                <Button
                  variant="contained"
                  startIcon={<FlashIcon />}
                  onClick={() => navigate('/premium')}
                  sx={{
                    bgcolor: isPremium ? '#fff' : '#00e5ff',
                    color: '#090d1a',
                    fontWeight: 900,
                    borderRadius: '9999px',
                    px: 3.5,
                    py: 1.2,
                    textTransform: 'none',
                    fontSize: 14,
                    boxShadow: isPremium ? '0 6px 20px rgba(0,0,0,0.3)' : '0 6px 20px rgba(0, 229, 255, 0.4)',
                    '&:hover': {
                      bgcolor: '#fff',
                      transform: 'scale(1.05)',
                    },
                    transition: 'all 0.2s ease',
                  }}
                >
                  {isPremium ? 'Quản Lý Gói Dịch Vụ' : 'Nâng Cấp Gói Premium'}
                </Button>
              </Box>
            </Stack>
          </Box>

          {/* ── 2. BENTO BODY (PERSONAL INFO & GÓI DỊCH VỤ PREMIUM) ── */}
          <Grid container spacing={3.5}>
            {/* Left Column: Personal Form & Gói Dịch Vụ Suite (7.5/12) */}
            <Grid size={{ xs: 12, md: 7.5 }}>
              <Stack spacing={3.5}>
                {/* A. THÔNG TIN CÁ NHÂN */}
                <Paper
                  elevation={0}
                  sx={{
                    p: 3.5,
                    borderRadius: '24px',
                    bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(16, 22, 40, 0.55)' : '#ffffff',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    backdropFilter: 'blur(16px)',
                  }}
                >
                  <Typography variant="h6" sx={{ fontWeight: 900, mb: 2.5, letterSpacing: '-0.02em' }}>
                    Thông Tin Cá Nhân
                  </Typography>
                  <Stack spacing={2.5}>
                    <TextField
                      label="Tên hiển thị"
                      value={form.name}
                      onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                      fullWidth
                    />
                    <TextField
                      label="Email tài khoản"
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
                        backgroundImage: 'linear-gradient(135deg, #6c63ff 0%, #00bcd4 100%)',
                        borderRadius: '9999px',
                        fontWeight: 850,
                        px: 4,
                        py: 1.1,
                        color: '#fff',
                        textTransform: 'none',
                        boxShadow: '0 4px 14px rgba(108, 99, 255, 0.3)',
                        transition: 'all 0.25s ease',
                        '&:hover': {
                          transform: 'translateY(-2px)',
                          boxShadow: '0 8px 22px rgba(108, 99, 255, 0.45)',
                        },
                      }}
                    >
                      {saving ? <CircularProgress size={22} color="inherit" /> : 'Lưu Thay Đổi'}
                    </Button>
                  </Stack>
                </Paper>

                {/* B. QUẢN LÝ GÓI DỊCH VỤ & ĐẶC QUYỀN SOUND PASS */}
                <Paper
                  elevation={0}
                  sx={{
                    p: 3.5,
                    borderRadius: '24px',
                    bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(16, 22, 40, 0.65)' : '#ffffff',
                    border: isPremium ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(108, 99, 255, 0.3)',
                    position: 'relative',
                    overflow: 'hidden',
                    boxShadow: isPremium ? '0 10px 30px rgba(245, 158, 11, 0.15)' : '0 10px 30px rgba(108, 99, 255, 0.1)',
                  }}
                >
                  <Stack spacing={3}>
                    {/* Header Gói Dịch Vụ */}
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ flexWrap: 'wrap', gap: 1 }}>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <PremiumIcon sx={{ color: isPremium ? '#f59e0b' : '#6c63ff', fontSize: 28 }} />
                        <Box>
                          <Typography variant="h6" sx={{ fontWeight: 950, letterSpacing: '-0.02em' }}>
                            Gói Dịch Vụ & Hạn Mức Âm Nhạc
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                            {isPremium ? 'Bạn đang sở hữu quyền lợi không giới hạn của gói Premium VIP' : 'Nâng cấp để mở khóa toàn bộ đặc quyền âm nhạc chất lượng cao'}
                          </Typography>
                        </Box>
                      </Stack>
                      <Chip
                        label={isPremium ? 'Đang Hoạt Động' : 'Gói Miễn Phí'}
                        sx={{
                          fontWeight: 900,
                          bgcolor: isPremium ? 'rgba(245, 158, 11, 0.15)' : 'rgba(108, 99, 255, 0.15)',
                          color: isPremium ? '#f59e0b' : '#6c63ff',
                          border: isPremium ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(108, 99, 255, 0.3)',
                        }}
                      />
                    </Stack>

                    {/* Progress 1: Upload Quota */}
                    <Box>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <UploadIcon sx={{ color: '#00e5ff', fontSize: 18 }} />
                          <Typography variant="body2" sx={{ fontWeight: 750 }}>
                            Dung lượng tải lên hệ thống:
                          </Typography>
                        </Stack>
                        <Typography variant="body2" sx={{ fontWeight: 900, color: '#00e5ff' }}>
                          {isPremium ? `${uploadUsed} MB / Không Giới Hạn` : `${uploadUsed} MB / 100 MB`}
                        </Typography>
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={isPremium ? 0 : Math.min((uploadUsed / 100) * 100, 100)}
                        sx={{
                          height: 8,
                          borderRadius: 4,
                          bgcolor: 'rgba(255, 255, 255, 0.08)',
                          '& .MuiLinearProgress-bar': {
                            borderRadius: 4,
                            backgroundImage: isPremium 
                              ? 'linear-gradient(90deg, #f59e0b, #ec4899)' 
                              : 'linear-gradient(90deg, #00e5ff, #6c63ff)',
                          },
                        }}
                      />
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75, fontWeight: 550 }}>
                        {isPremium 
                          ? '🌟 Tài khoản Premium Pro được tải lên bài hát dung lượng không giới hạn.' 
                          : '⚡ Bản miễn phí giới hạn tối đa 100MB tải bài hát lên hệ thống.'}
                      </Typography>
                    </Box>

                    {/* Progress 2: Download Quota */}
                    <Box>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <DownloadIcon sx={{ color: '#a855f7', fontSize: 18 }} />
                          <Typography variant="body2" sx={{ fontWeight: 750 }}>
                            Dung lượng tải về ngoại tuyến:
                          </Typography>
                        </Stack>
                        <Typography variant="body2" sx={{ fontWeight: 900, color: '#a855f7' }}>
                          {isPremium ? `${downloadUsed} MB / Không Giới Hạn` : `${downloadUsed} MB / 100 MB`}
                        </Typography>
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={isPremium ? 0 : Math.min((downloadUsed / 100) * 100, 100)}
                        sx={{
                          height: 8,
                          borderRadius: 4,
                          bgcolor: 'rgba(255, 255, 255, 0.08)',
                          '& .MuiLinearProgress-bar': {
                            borderRadius: 4,
                            backgroundImage: isPremium
                              ? 'linear-gradient(90deg, #f59e0b, #ec4899)'
                              : 'linear-gradient(90deg, #a855f7, #6c63ff)',
                          },
                        }}
                      />
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75, fontWeight: 550 }}>
                        {isPremium 
                          ? '🌟 Tài khoản Premium Pro được phép tải bài hát về nghe offline không giới hạn.' 
                          : '⚡ Bản miễn phí giới hạn tối đa 100MB tải bài hát về máy.'}
                      </Typography>
                    </Box>

                    {/* Danh sách đặc quyền Premium Suite */}
                    <Box
                      sx={{
                        p: 2.5,
                        borderRadius: '20px',
                        bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(15, 23, 42, 0.5)' : '#f8fafc',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                      }}
                    >
                      <Typography variant="subtitle2" sx={{ fontWeight: 900, mb: 1.5, color: isPremium ? '#f59e0b' : '#6c63ff' }}>
                        💎 Đặc Quyền Gói Dịch Vụ Premium:
                      </Typography>
                      <Grid container spacing={1.5}>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <SparklesIcon sx={{ color: '#00e5ff', fontSize: 18 }} />
                            <Typography variant="caption" sx={{ fontWeight: 650 }}>
                              AI DJ & Trợ Lý Tạo Playlist (20 lượt/ngày)
                            </Typography>
                          </Stack>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <HeadphonesIcon sx={{ color: '#ec4899', fontSize: 18 }} />
                            <Typography variant="caption" sx={{ fontWeight: 650 }}>
                              Âm Thanh Lossless Hi-Fi 320kbps Đỉnh Cao
                            </Typography>
                          </Stack>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <UploadIcon sx={{ color: '#10b981', fontSize: 18 }} />
                            <Typography variant="caption" sx={{ fontWeight: 650 }}>
                              Lưu Trữ Nhạc Cá Nhân Không Giới Hạn
                            </Typography>
                          </Stack>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <AdBlockIcon sx={{ color: '#f59e0b', fontSize: 18 }} />
                            <Typography variant="caption" sx={{ fontWeight: 650 }}>
                              Trải Nghiệm 100% Không Bị Gián Đoạn
                            </Typography>
                          </Stack>
                        </Grid>
                      </Grid>
                    </Box>

                    {/* Available Plans Quick Showcase (Nếu có) */}
                    {plans.length > 0 && !isPremium && (
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 900, mb: 1.5 }}>
                          🔥 Các Gói Cước Đang Mở Bán:
                        </Typography>
                        <Grid container spacing={1.5}>
                          {plans.slice(0, 3).map((plan) => (
                            <Grid size={{ xs: 12, sm: 4 }} key={plan._id}>
                              <Box
                                onClick={() => navigate('/premium')}
                                sx={{
                                  p: 2,
                                  borderRadius: '16px',
                                  bgcolor: 'rgba(255, 255, 255, 0.03)',
                                  border: '1px solid rgba(255, 255, 255, 0.1)',
                                  textAlign: 'center',
                                  cursor: 'pointer',
                                  transition: 'all 0.25s ease',
                                  '&:hover': {
                                    borderColor: '#00e5ff',
                                    bgcolor: 'rgba(0, 229, 255, 0.06)',
                                    transform: 'translateY(-2px)',
                                  }
                                }}
                              >
                                <Typography sx={{ fontWeight: 900, fontSize: 14 }}>
                                  {plan.name}
                                </Typography>
                                <Typography sx={{ fontWeight: 950, color: '#f59e0b', fontSize: 16, my: 0.5 }}>
                                  {Number(plan.price || 0).toLocaleString()}đ
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                                  Thời hạn: {plan.durationDays} ngày
                                </Typography>
                              </Box>
                            </Grid>
                          ))}
                        </Grid>
                      </Box>
                    )}

                    {/* Action Button */}
                    <Button
                      variant="contained"
                      startIcon={<FlashIcon />}
                      endIcon={<ArrowIcon />}
                      onClick={() => navigate('/premium')}
                      sx={{
                        width: '100%',
                        backgroundImage: isPremium
                          ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                          : 'linear-gradient(135deg, #6c63ff 0%, #00e5ff 100%)',
                        borderRadius: '9999px',
                        fontWeight: 900,
                        py: 1.4,
                        color: isPremium ? '#090d1a' : '#fff',
                        textTransform: 'none',
                        fontSize: 14.5,
                        boxShadow: isPremium
                          ? '0 6px 20px rgba(245, 158, 11, 0.35)'
                          : '0 6px 20px rgba(108, 99, 255, 0.35)',
                        '&:hover': {
                          transform: 'scale(1.015)',
                        },
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {isPremium ? 'Quản Lý / Gia Hạn Gói Cước Premium' : 'Xem Chi Tiết & Nâng Cấp Gói'}
                    </Button>
                  </Stack>
                </Paper>
              </Stack>
            </Grid>

            {/* Right Column: Hoạt Động Nghe Gần Đây (4.5/12) */}
            <Grid size={{ xs: 12, md: 4.5 }}>
              <Paper
                elevation={0}
                sx={{
                  p: 3.5,
                  borderRadius: '24px',
                  bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(16, 22, 40, 0.55)' : '#ffffff',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  backdropFilter: 'blur(16px)',
                  height: '100%',
                  minHeight: 380,
                }}
              >
                <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 2.5 }}>
                  <MusicIcon sx={{ color: '#6c63ff', fontSize: 24 }} />
                  <Typography variant="h6" sx={{ fontWeight: 900, letterSpacing: '-0.02em' }}>
                    Hoạt Động Gần Đây
                  </Typography>
                </Stack>

                {recentSongs.length > 0 ? (
                  <Stack spacing={1.5}>
                    {recentSongs.map((song, idx) => {
                      const isCur = currentSong?._id === song._id;
                      const isPlay = isPlaying && isCur;
                      return (
                        <Stack
                          key={`recent-${song._id}-${idx}`}
                          direction="row"
                          spacing={1.5}
                          alignItems="center"
                          onClick={() => playSong(song, { queue: recentSongs })}
                          sx={{
                            p: 1.2,
                            borderRadius: '16px',
                            cursor: 'pointer',
                            bgcolor: isCur ? 'rgba(108, 99, 255, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                            border: '1px solid',
                            borderColor: isCur ? '#6c63ff' : 'rgba(255, 255, 255, 0.05)',
                            transition: 'all 0.25s ease',
                            '&:hover': {
                              transform: 'translateX(3px)',
                              borderColor: '#6c63ff',
                              bgcolor: 'rgba(108, 99, 255, 0.08)',
                            }
                          }}
                        >
                          <Avatar
                            src={song.imageUrl}
                            variant="rounded"
                            sx={{ width: 44, height: 44, borderRadius: '10px' }}
                          />
                          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                            <Typography variant="body2" sx={{ fontWeight: 800, color: isCur ? '#00e5ff' : 'inherit' }} noWrap>
                              {song.title}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }} noWrap display="block">
                              {Array.isArray(song.artists) ? song.artists.map(a => a?.name).filter(Boolean).join(', ') : (song.artistText || 'Nhiều nghệ sĩ')}
                            </Typography>
                          </Box>
                          <Button
                            size="small"
                            sx={{
                              minWidth: 32,
                              height: 32,
                              borderRadius: '50%',
                              p: 0,
                              color: isPlay ? '#00e5ff' : 'text.secondary',
                              bgcolor: 'rgba(255, 255, 255, 0.05)',
                            }}
                          >
                            <PlayIcon sx={{ fontSize: 18 }} />
                          </Button>
                        </Stack>
                      );
                    })}
                  </Stack>
                ) : (
                  <Box sx={{ p: 4, textAlign: 'center', borderRadius: '18px', border: '1px dashed rgba(255,255,255,0.1)' }}>
                    <Typography variant="body2" color="text.secondary">
                      Chưa có lịch sử phát gần đây. Hãy bắt đầu nghe nhạc ngay!
                    </Typography>
                  </Box>
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
