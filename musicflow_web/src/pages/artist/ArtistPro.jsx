import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Grid,
  Button,
  Chip,
  Stack,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  RadioGroup,
  FormControlLabel,
  Radio,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert,
  IconButton,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Avatar,
  LinearProgress,
} from '@mui/material';
import {
  WorkspacePremiumRounded as ProIcon,
  CheckCircleRounded as CheckIcon,
  CloseRounded as CloseIcon,
  AutoAwesomeRounded as SparklesIcon,
  CloudUploadRounded as UploadIcon,
  StorageRounded as StorageIcon,
  SpeedRounded as SpeedIcon,
  HistoryRounded as HistoryIcon,
  VerifiedRounded as VerifiedIcon,
  DiamondRounded as DiamondIcon,
  SecurityRounded as ShieldIcon,
  HelpOutlineRounded as FaqIcon,
  ExpandMoreRounded as ExpandMoreIcon,
  ContentCopyRounded as CopyIcon,
  BoltRounded as BoltIcon,
  StarRounded as StarIcon,
  GraphicEqRounded as WaveformIcon,
  LockRounded as LockIcon,
} from '@mui/icons-material';
import ArtistLayout from '../../components/Layout/artist/ArtistLayout';
import { clientPlansApi, clientSubscriptionApi } from '../../services/client/client.service';
import useAppToast from '../../components/common/js/useAppToast';
import { syncArtistSession } from '../../utils/artistSession';

const FAQ_ITEMS = [
  {
    q: 'Gói Artist Studio Pro có tự động trừ tiền gia hạn không?',
    a: 'Không. MusicFlow không tự động trừ tiền định kỳ. Khi gói sắp hết hạn, hệ thống sẽ gửi thông báo nhắc nhở để bạn chủ động gia hạn nếu tiếp tục có nhu cầu.',
  },
  {
    q: 'Nếu gói Pro hết hạn, các bài hát dung lượng lớn đã đăng tải có bị xóa không?',
    a: 'Hoàn toàn không! Mọi tác phẩm âm nhạc bạn đã phát hành trong thời gian hoạt động gói Pro sẽ được bảo toàn nguyên vẹn 100% trên hệ thống. Giới hạn 50MB chỉ áp dụng khi bạn upload bài hát mới sau khi gói hết hạn.',
  },
  {
    q: 'Huy hiệu PRO sẽ hiển thị ở đâu trên MusicFlow?',
    a: 'Huy hiệu PRO màu vàng hổ phách nổi bật sẽ xuất hiện ngay cạnh tên nghệ sĩ trên Hồ sơ cá nhân (Artist Profile), trang bài hát, bảng xếp hạng và thanh tìm kiếm toàn hệ thống Web & Mobile.',
  },
  {
    q: 'Tôi có thể thanh toán qua những phương thức nào?',
    a: 'Hệ thống tích hợp cổng thanh toán VNPay hỗ trợ đa dạng: Quét mã VNPAY-QR qua ứng dụng ngân hàng, thẻ ATM nội địa tất cả ngân hàng, và thẻ quốc tế Visa / MasterCard.',
  },
];

function ArtistPro() {
  const { showToast } = useAppToast();
  const [proPlan, setProPlan] = useState(null);
  const [activeSub, setActiveSub] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('vnpay');
  const [submitting, setSubmitting] = useState(false);

  // Artist session info for VIP pass
  const artistName = localStorage.getItem('artistName') || 'Nghệ sĩ MusicFlow';
  const artistAvatar = localStorage.getItem('artistAvatar') || '';
  const artistEmail = localStorage.getItem('artistEmail') || '';

  const isProActive = Boolean(activeSub && activeSub.status === 'active' && new Date(activeSub.endDate) > new Date());

  // Tính số ngày còn lại của gói Pro
  const calculateDaysRemaining = () => {
    if (!activeSub?.endDate) return 0;
    const diffTime = new Date(activeSub.endDate) - new Date();
    return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  };

  const daysRemaining = calculateDaysRemaining();
  const progressPercent = Math.min(100, Math.max(0, (daysRemaining / 30) * 100));

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      // 1. Fetch plans with targetRole = 'artist'
      const plansRes = await clientPlansApi.getActive({ targetRole: 'artist' });
      if (plansRes.data?.success) {
        const artistPlans = plansRes.data.data || [];
        const pro = artistPlans.find((p) => p.name === 'Artist Studio Pro') || artistPlans[0] || null;
        setProPlan(pro);
      }

      // 2. Fetch current subscription and transaction history
      const subRes = await clientSubscriptionApi.getCurrent();
      if (subRes.data?.success) {
        setActiveSub(subRes.data.data?.activeSubscription || null);
        setHistory(subRes.data.data?.history || []);
      }
    } catch (err) {
      console.error('Fetch Artist Pro data error:', err);
      showToast({
        severity: 'error',
        title: 'Lỗi tải dữ liệu',
        message: err.response?.data?.message || 'Không thể tải thông tin gói cước.',
      });
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenCheckout = () => {
    setPaymentMethod('vnpay');
    setCheckoutOpen(true);
  };

  const handleCloseCheckout = () => {
    if (submitting) return;
    setCheckoutOpen(false);
  };

  const handleCopyRef = (ref) => {
    navigator.clipboard?.writeText(ref);
    showToast({
      severity: 'success',
      title: 'Đã sao chép',
      message: `Đã sao chép mã giao dịch: ${ref}`,
    });
  };

  const handleCheckout = async () => {
    if (!proPlan) return;
    try {
      setSubmitting(true);
      const res = await clientSubscriptionApi.checkout({
        planId: proPlan._id,
        paymentMethod,
      });

      if (paymentMethod === 'vnpay') {
        if (res.data?.paymentUrl) {
          showToast({
            severity: 'info',
            title: 'Chuyển hướng VNPay',
            message: 'Đang chuyển đến cổng thanh toán VNPay Sandbox...',
          });
          window.location.href = res.data.paymentUrl;
        } else {
          throw new Error('Không nhận được liên kết thanh toán từ VNPay');
        }
      } else {
        // Mock payment confirmation
        const txRef = res.data?.transaction?.transactionRef;
        const confirmRes = await clientSubscriptionApi.mockConfirm({ transactionRef: txRef });
        if (confirmRes.data?.success) {
          showToast({
            severity: 'success',
            title: 'Thành công',
            message: 'Đã nâng cấp Artist Studio Pro (Giao dịch Mock)!',
          });
          if (confirmRes.data.data?.artist) {
            syncArtistSession(confirmRes.data.data.artist);
          }
          setCheckoutOpen(false);
          await fetchData();
        }
      }
    } catch (err) {
      console.error('Checkout error:', err);
      showToast({
        severity: 'error',
        title: 'Thanh toán thất bại',
        message: err.response?.data?.message || err.message || 'Lỗi xử lý giao dịch',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ArtistLayout title="Artist Studio Pro">
      <Box sx={{ width: '100%', pb: 8 }}>
        {/* =========================================================================
            1. HERO / VIP STATUS SECTION (FULL WIDTH)
        ========================================================================== */}
        {isProActive ? (
          /* VIP PASS ACTIVE BANNER */
          <Paper
            elevation={0}
            sx={{
              p: { xs: 3, md: 4.5 },
              mb: 3.5,
              borderRadius: 3.5,
              position: 'relative',
              overflow: 'hidden',
              background: 'linear-gradient(135deg, #090d16 0%, #151a2e 50%, #1a1528 100%)',
              color: '#fff',
              border: '1px solid rgba(245, 158, 11, 0.35)',
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.6), 0 0 30px rgba(245, 158, 11, 0.1)',
            }}
          >
            {/* Ambient Background Aura */}
            <Box
              sx={{
                position: 'absolute',
                top: -80,
                right: -80,
                width: 350,
                height: 350,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(245, 158, 11, 0.2) 0%, rgba(245, 158, 11, 0) 70%)',
                filter: 'blur(45px)',
                pointerEvents: 'none',
              }}
            />

            <Grid container spacing={3.5} alignItems="center">
              {/* Left Column: VIP Card Visual */}
              <Grid size={{ xs: 12, lg: 4.5 }}>
                <Box
                  sx={{
                    p: 3,
                    borderRadius: 3,
                    background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(20, 24, 40, 0.8) 100%)',
                    border: '1px solid rgba(245, 158, 11, 0.4)',
                    backdropFilter: 'blur(20px)',
                    boxShadow: '0 16px 36px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255, 255, 255, 0.15)',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2.5 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <WaveformIcon sx={{ color: '#f59e0b', fontSize: 24 }} />
                      <Typography variant="subtitle2" sx={{ fontWeight: 900, letterSpacing: '1px', color: '#f59e0b' }}>
                        MUSICFLOW STUDIO
                      </Typography>
                    </Stack>
                    <Chip
                      icon={<ProIcon sx={{ color: '#fff !important', fontSize: 16 }} />}
                      label="PRO PASS"
                      size="small"
                      sx={{
                        background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                        color: '#fff',
                        fontWeight: 900,
                        fontSize: '0.68rem',
                        boxShadow: '0 2px 10px rgba(245, 158, 11, 0.4)',
                      }}
                    />
                  </Stack>

                  <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
                    <Avatar
                      src={artistAvatar}
                      sx={{
                        width: 58,
                        height: 58,
                        border: '2px solid #f59e0b',
                        boxShadow: '0 0 16px rgba(245, 158, 11, 0.35)',
                      }}
                    />
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="h6" fontWeight={900} noWrap sx={{ letterSpacing: '-0.3px' }}>
                        {artistName}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.65)' }} noWrap display="block">
                        {artistEmail || 'Verified Music Producer'}
                      </Typography>
                    </Box>
                  </Stack>

                  <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.1)', mb: 2 }} />

                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.6)', display: 'block', fontSize: '0.7rem' }}>
                        THỜI HẠN GÓI PRO
                      </Typography>
                      <Typography variant="body2" fontWeight={800} color="#fbbf24">
                        {new Date(activeSub.endDate).toLocaleDateString('vi-VN')} ({daysRemaining} ngày)
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.6)', display: 'block', fontSize: '0.7rem' }}>
                        TRẠNG THÁI
                      </Typography>
                      <Chip
                        label="ACTIVE VIP"
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: '0.65rem',
                          fontWeight: 850,
                          bgcolor: 'rgba(34, 197, 94, 0.2)',
                          color: '#4ade80',
                          border: '1px solid rgba(34, 197, 94, 0.4)',
                        }}
                      />
                    </Box>
                  </Stack>
                </Box>
              </Grid>

              {/* Right Column: Perks Status & Action */}
              <Grid size={{ xs: 12, lg: 7.5 }}>
                <Stack spacing={2.5}>
                  <Box>
                    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
                      <CheckIcon sx={{ color: '#4ade80', fontSize: 24 }} />
                      <Typography variant="h5" fontWeight={900} sx={{ letterSpacing: '-0.3px' }}>
                        Không Gian Studio Pro Đang Kích Hoạt
                      </Typography>
                    </Stack>
                    <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.75)', lineHeight: 1.7 }}>
                      Tài khoản của bạn đang sở hữu toàn bộ quyền năng cao cấp nhất dành cho nhà sản xuất: Hạn mức Trợ lý AI tăng lên 70 yêu cầu/ngày, lưu trữ 5GB và xuất bản âm thanh chất lượng tối đa 150MB.
                    </Typography>
                  </Box>

                  {/* Progress bar */}
                  <Box sx={{ p: 2, borderRadius: 2.5, bgcolor: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
                      <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.7)', fontWeight: 700 }}>
                        Chu kỳ sử dụng hiện tại
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#fbbf24', fontWeight: 800 }}>
                        Còn lại {daysRemaining} ngày
                      </Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={progressPercent}
                      sx={{
                        height: 8,
                        borderRadius: 4,
                        bgcolor: 'rgba(255, 255, 255, 0.1)',
                        '& .MuiLinearProgress-bar': {
                          background: 'linear-gradient(90deg, #f59e0b, #ef4444)',
                          borderRadius: 4,
                        },
                      }}
                    />
                  </Box>

                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
                    <Button
                      variant="contained"
                      onClick={handleOpenCheckout}
                      startIcon={<BoltIcon />}
                      sx={{
                        background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                        color: '#fff',
                        fontWeight: 850,
                        borderRadius: 2.5,
                        px: 3.5,
                        py: 1.25,
                        textTransform: 'none',
                        boxShadow: '0 8px 20px rgba(245, 158, 11, 0.35)',
                        '&:hover': { background: 'linear-gradient(135deg, #d97706, #b45309)' },
                      }}
                    >
                      Gia hạn thêm 30 ngày ({proPlan?.price ? `${Number(proPlan.price).toLocaleString('vi-VN')} đ` : '79.000 đ'})
                    </Button>
                    <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.55)' }}>
                      Thời hạn mới sẽ được tự động cộng dồn tiếp tục.
                    </Typography>
                  </Stack>
                </Stack>
              </Grid>
            </Grid>
          </Paper>
        ) : (
          /* STANDARD HERO SHOWCASE (FULL WIDTH) */
          <Paper
            elevation={0}
            sx={{
              p: { xs: 3, md: 4.5, lg: 5 },
              mb: 3.5,
              borderRadius: 3.5,
              position: 'relative',
              overflow: 'hidden',
              background: 'linear-gradient(135deg, #0b0f19 0%, #171b30 45%, #1f1530 100%)',
              color: '#fff',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.5)',
            }}
          >
            {/* Ambient Lighting Orbs */}
            <Box
              sx={{
                position: 'absolute',
                top: -60,
                right: -60,
                width: 350,
                height: 350,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(245, 158, 11, 0.22) 0%, rgba(245, 158, 11, 0) 70%)',
                filter: 'blur(45px)',
                pointerEvents: 'none',
              }}
            />
            <Box
              sx={{
                position: 'absolute',
                bottom: -50,
                left: '30%',
                width: 300,
                height: 300,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(108, 99, 255, 0.18) 0%, rgba(108, 99, 255, 0) 70%)',
                filter: 'blur(45px)',
                pointerEvents: 'none',
              }}
            />

            <Grid container spacing={3.5} alignItems="center" justifyContent="space-between">
              <Grid size={{ xs: 12, lg: 8, xl: 8.5 }}>
                <Box sx={{ zIndex: 1 }}>
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
                    <Chip
                      icon={<ProIcon sx={{ color: '#fff !important', fontSize: 18 }} />}
                      label="ARTIST STUDIO PRO"
                      sx={{
                        background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                        color: '#fff',
                        fontWeight: 850,
                        letterSpacing: '0.8px',
                        fontSize: '0.75rem',
                        boxShadow: '0 4px 14px rgba(245, 158, 11, 0.35)',
                      }}
                    />
                    <Chip
                      label="ĐẶC QUYỀN SẢN XUẤT"
                      size="small"
                      sx={{
                        bgcolor: 'rgba(255, 255, 255, 0.1)',
                        color: 'rgba(255, 255, 255, 0.9)',
                        fontWeight: 700,
                        backdropFilter: 'blur(10px)',
                      }}
                    />
                  </Stack>

                  <Typography variant="h3" fontWeight={950} sx={{ mb: 2, letterSpacing: '-1px', fontSize: { xs: '1.9rem', sm: '2.4rem', lg: '2.8rem' }, lineHeight: 1.2 }}>
                    Biến Studio Của Bạn Thành Cỗ Máy Sáng Tác Toàn Năng
                  </Typography>

                  <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.8)', lineHeight: 1.7, fontSize: { xs: '0.95rem', sm: '1.05rem' }, mb: 3 }}>
                    Gói tài nguyên tối thượng độc quyền dành riêng cho Nghệ sĩ: Nâng cấp Trợ lý AI Studio lên <strong>70 yêu cầu/ngày</strong>, đăng tải bản master dung lượng cao tới <strong>150MB</strong>, kho lưu trữ <strong>5GB</strong> và sở hữu <strong>Huy hiệu PRO</strong> khẳng định thương hiệu.
                  </Typography>

                  {/* Micro Highlights Pill */}
                  <Stack direction="row" spacing={1.5} flexWrap="wrap" sx={{ gap: 1.2 }}>
                    {[
                      { label: '70 AI Prompts / ngày', icon: <SparklesIcon sx={{ fontSize: 16, color: '#f59e0b' }} /> },
                      { label: '150MB Lossless Audio', icon: <UploadIcon sx={{ fontSize: 16, color: '#06b6d4' }} /> },
                      { label: '5GB Cloud Storage', icon: <StorageIcon sx={{ fontSize: 16, color: '#10b981' }} /> },
                      { label: 'PRO Golden Badge', icon: <ProIcon sx={{ fontSize: 16, color: '#ef4444' }} /> },
                    ].map((badge, idx) => (
                      <Box
                        key={idx}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          px: 2,
                          py: 0.8,
                          borderRadius: 2,
                          bgcolor: 'rgba(255, 255, 255, 0.06)',
                          border: '1px solid rgba(255, 255, 255, 0.12)',
                          backdropFilter: 'blur(8px)',
                        }}
                      >
                        {badge.icon}
                        <Typography variant="caption" sx={{ fontWeight: 750, color: '#fff' }}>
                          {badge.label}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                </Box>
              </Grid>

              <Grid size={{ xs: 12, lg: 4, xl: 3.5 }}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 3.5,
                    borderRadius: 3,
                    bgcolor: 'rgba(15, 20, 36, 0.85)',
                    border: '1px solid rgba(245, 158, 11, 0.35)',
                    backdropFilter: 'blur(16px)',
                    textAlign: 'center',
                  }}
                >
                  <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.65)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>
                    Chi phí đầu tư Studio
                  </Typography>
                  <Box sx={{ my: 1.5 }}>
                    <Typography variant="h3" fontWeight={950} color="#f59e0b" sx={{ display: 'inline', letterSpacing: '-1px' }}>
                      {proPlan?.price ? `${Number(proPlan.price).toLocaleString('vi-VN')} đ` : '79.000 đ'}
                    </Typography>
                    <Typography variant="caption" color="rgba(255, 255, 255, 0.6)" sx={{ ml: 0.75 }}>
                      / 30 ngày
                    </Typography>
                  </Box>
                  <Typography variant="caption" sx={{ display: 'block', color: 'rgba(255, 255, 255, 0.55)', mb: 2.5 }}>
                    Chỉ ~{proPlan?.price ? `${Math.round(proPlan.price / 30).toLocaleString('vi-VN')} đ` : '2.600 đ'} / ngày • Không ràng buộc tự gia hạn
                  </Typography>

                  <Button
                    variant="contained"
                    fullWidth
                    size="large"
                    onClick={handleOpenCheckout}
                    sx={{
                      py: 1.6,
                      background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
                      color: '#fff',
                      fontWeight: 850,
                      fontSize: '1.02rem',
                      borderRadius: 2.5,
                      textTransform: 'none',
                      boxShadow: '0 8px 24px rgba(245, 158, 11, 0.4)',
                      '&:hover': {
                        background: 'linear-gradient(135deg, #d97706 0%, #dc2626 100%)',
                        transform: 'translateY(-2px)',
                        boxShadow: '0 12px 28px rgba(245, 158, 11, 0.5)',
                      },
                      transition: 'all 0.25s ease',
                    }}
                  >
                    Nâng Cấp Studio Pro
                  </Button>
                </Paper>
              </Grid>
            </Grid>
          </Paper>
        )}

        {/* Loading Spinner */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
            <CircularProgress size={44} sx={{ color: '#f59e0b' }} />
          </Box>
        ) : (
          <Stack spacing={4}>
            {/* =========================================================================
                2. BENTO GRID: 4 CORE PRO PRIVILEGES (FULL SPREAD)
            ========================================================================== */}
            <Box>
              <Box sx={{ mb: 2.5 }}>
                <Typography variant="caption" sx={{ color: '#f59e0b', fontWeight: 850, letterSpacing: '1.5px', textTransform: 'uppercase' }}>
                  CORE ADVANTAGES
                </Typography>
                <Typography variant="h5" fontWeight={900} sx={{ mt: 0.25, letterSpacing: '-0.3px' }}>
                  4 Đặc Quyền Vượt Trội Của Studio Pro
                </Typography>
              </Box>

              <Grid container spacing={2.5}>
                {/* Bento Item 1: AI Studio Gemini */}
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 3,
                      height: '100%',
                      borderRadius: 3,
                      border: '1px solid',
                      borderColor: 'divider',
                      background: (theme) => theme.palette.mode === 'dark'
                        ? 'linear-gradient(135deg, rgba(30, 27, 75, 0.45) 0%, rgba(15, 23, 42, 0.6) 100%)'
                        : '#ffffff',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        borderColor: '#f59e0b',
                        boxShadow: '0 16px 36px rgba(245, 158, 11, 0.12)',
                      },
                    }}
                  >
                    <Box>
                      <Box sx={{ p: 1.5, width: 'fit-content', borderRadius: 2, bgcolor: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', mb: 2 }}>
                        <SparklesIcon sx={{ fontSize: 26 }} />
                      </Box>
                      <Typography variant="subtitle1" fontWeight={850} sx={{ mb: 1 }}>
                        Trợ Lý AI Studio 70x
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                        Được cấp <strong>70 lượt yêu cầu/24h</strong> (thay vì 10 lượt). Mô hình Gemini thế hệ mới giúp gợi ý giai điệu, sáng tác lyrics và cố vấn chiến lược marketing bài hát.
                      </Typography>
                    </Box>
                    <Box sx={{ mt: 2.5, pt: 1.5, borderTop: '1px dashed', borderColor: 'divider' }}>
                      <Typography variant="caption" sx={{ color: '#f59e0b', fontWeight: 800 }}>
                        +600% Hạn mức sáng tác
                      </Typography>
                    </Box>
                  </Paper>
                </Grid>

                {/* Bento Item 2: Lossless Master Audio 150MB */}
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 3,
                      height: '100%',
                      borderRadius: 3,
                      border: '1px solid',
                      borderColor: 'divider',
                      background: (theme) => theme.palette.mode === 'dark'
                        ? 'linear-gradient(135deg, rgba(6, 182, 212, 0.1) 0%, rgba(15, 23, 42, 0.6) 100%)'
                        : '#ffffff',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        borderColor: '#06b6d4',
                        boxShadow: '0 16px 36px rgba(6, 182, 212, 0.12)',
                      },
                    }}
                  >
                    <Box>
                      <Box sx={{ p: 1.5, width: 'fit-content', borderRadius: 2, bgcolor: 'rgba(6, 182, 212, 0.15)', color: '#06b6d4', mb: 2 }}>
                        <UploadIcon sx={{ fontSize: 26 }} />
                      </Box>
                      <Typography variant="subtitle1" fontWeight={850} sx={{ mb: 1 }}>
                        Tải Lên Tối Đa 150MB
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                        Phá bỏ giới hạn 50MB. Thoải mái phát hành các bản thu Master âm thanh độ phân giải cao chuẩn <strong>WAV / FLAC 24-bit</strong> nguyên bản không nén méo tiếng.
                      </Typography>
                    </Box>
                    <Box sx={{ mt: 2.5, pt: 1.5, borderTop: '1px dashed', borderColor: 'divider' }}>
                      <Typography variant="caption" sx={{ color: '#06b6d4', fontWeight: 800 }}>
                        Chuẩn Hi-Res Lossless
                      </Typography>
                    </Box>
                  </Paper>
                </Grid>

                {/* Bento Item 3: 5GB Cloud Storage */}
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 3,
                      height: '100%',
                      borderRadius: 3,
                      border: '1px solid',
                      borderColor: 'divider',
                      background: (theme) => theme.palette.mode === 'dark'
                        ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(15, 23, 42, 0.6) 100%)'
                        : '#ffffff',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        borderColor: '#10b981',
                        boxShadow: '0 16px 36px rgba(16, 185, 129, 0.12)',
                      },
                    }}
                  >
                    <Box>
                      <Box sx={{ p: 1.5, width: 'fit-content', borderRadius: 2, bgcolor: 'rgba(16, 185, 129, 0.15)', color: '#10b981', mb: 2 }}>
                        <StorageIcon sx={{ fontSize: 26 }} />
                      </Box>
                      <Typography variant="subtitle1" fontWeight={850} sx={{ mb: 1 }}>
                        Kho Đám Mây 5GB
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                        Mở rộng dung lượng lưu trữ lên tới <strong>5.120 MB (5GB)</strong> so với 500MB ban đầu. Tự do lưu trữ hàng trăm ca khúc và album hoàn chỉnh an toàn tuyệt đối.
                      </Typography>
                    </Box>
                    <Box sx={{ mt: 2.5, pt: 1.5, borderTop: '1px dashed', borderColor: 'divider' }}>
                      <Typography variant="caption" sx={{ color: '#10b981', fontWeight: 800 }}>
                        Dung lượng gấp 10 lần
                      </Typography>
                    </Box>
                  </Paper>
                </Grid>

                {/* Bento Item 4: Brand Recognition & PRO Badge */}
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 3,
                      height: '100%',
                      borderRadius: 3,
                      border: '1px solid',
                      borderColor: 'divider',
                      background: (theme) => theme.palette.mode === 'dark'
                        ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(15, 23, 42, 0.6) 100%)'
                        : '#ffffff',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        borderColor: '#ef4444',
                        boxShadow: '0 16px 36px rgba(239, 68, 68, 0.12)',
                      },
                    }}
                  >
                    <Box>
                      <Box sx={{ p: 1.5, width: 'fit-content', borderRadius: 2, bgcolor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', mb: 2 }}>
                        <DiamondIcon sx={{ fontSize: 26 }} />
                      </Box>
                      <Typography variant="subtitle1" fontWeight={850} sx={{ mb: 1 }}>
                        Huy Hiệu PRO Độc Quyền
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                        Gắn huy hiệu <strong>PRO</strong> sắc vàng hổ phách sang trọng cạnh tên của bạn trên mọi sản phẩm, nâng tầm uy tín cá nhân và thu hút thêm lượng người theo dõi mới.
                      </Typography>
                    </Box>
                    <Box sx={{ mt: 2.5, pt: 1.5, borderTop: '1px dashed', borderColor: 'divider' }}>
                      <Typography variant="caption" sx={{ color: '#ef4444', fontWeight: 800 }}>
                        Nhận diện Creator VIP
                      </Typography>
                    </Box>
                  </Paper>
                </Grid>
              </Grid>
            </Box>

            {/* =========================================================================
                3. PRICING OFFER CARD & COMPARISON MATRIX (FULL SPREAD 4.2 / 7.8)
            ========================================================================== */}
            <Grid container spacing={3} alignItems="stretch">
              {/* Left Column: Luxury Plan Card */}
              <Grid size={{ xs: 12, lg: 4.2, xl: 3.8 }}>
                <Paper
                  elevation={0}
                  sx={{
                    p: { xs: 3, sm: 3.5 },
                    borderRadius: 3.5,
                    height: '100%',
                    border: '1.5px solid #f59e0b',
                    background: (theme) => theme.palette.mode === 'dark'
                      ? 'linear-gradient(135deg, rgba(28, 22, 50, 0.75) 0%, rgba(12, 16, 30, 0.95) 100%)'
                      : 'linear-gradient(135deg, #ffffff 0%, #fffbf0 100%)',
                    boxShadow: '0 20px 50px rgba(245, 158, 11, 0.18)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {/* Decorative Amber Glow */}
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 0,
                      right: 0,
                      width: 140,
                      height: 140,
                      background: 'radial-gradient(circle, rgba(245, 158, 11, 0.18) 0%, transparent 70%)',
                      pointerEvents: 'none',
                    }}
                  />

                  <Box>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                      <Chip
                        icon={<StarIcon sx={{ fontSize: 15, color: '#f59e0b !important' }} />}
                        label="GÓI ĐỀ XUẤT CHO NGHỆ SĨ"
                        size="small"
                        sx={{
                          fontWeight: 850,
                          bgcolor: 'rgba(245, 158, 11, 0.15)',
                          color: '#d97706',
                          border: '1px solid rgba(245, 158, 11, 0.3)',
                          fontSize: '0.68rem',
                        }}
                      />
                      <Chip
                        label="30 NGÀY"
                        size="small"
                        sx={{ fontWeight: 800, bgcolor: 'action.hover' }}
                      />
                    </Stack>

                    <Typography variant="h5" fontWeight={900} sx={{ mb: 1 }}>
                      Artist Studio Pro
                    </Typography>

                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
                      Bộ công cụ hoàn hảo dành cho nghệ sĩ độc lập, ban nhạc và nhà sản xuất muốn mở rộng tầm ảnh hưởng.
                    </Typography>

                    <Box sx={{ mb: 3, p: 2, borderRadius: 2.5, bgcolor: 'action.hover' }}>
                      <Typography variant="h3" fontWeight={950} color="#f59e0b" sx={{ display: 'inline', letterSpacing: '-1px' }}>
                        {proPlan?.price ? `${Number(proPlan.price).toLocaleString('vi-VN')} đ` : '79.000 đ'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ display: 'inline', ml: 1, fontWeight: 600 }}>
                        / chu kỳ 30 ngày
                      </Typography>
                      <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 0.5 }}>
                        Tương đương ~{proPlan?.price ? `${Math.round(proPlan.price / 30).toLocaleString('vi-VN')} đ` : '2.600 đ'} / ngày (Đã bao gồm VAT)
                      </Typography>
                    </Box>

                    <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', mb: 2 }}>
                      Tất cả đặc quyền bao gồm:
                    </Typography>

                    <Stack spacing={1.75} sx={{ mb: 3.5 }}>
                      {[
                        { text: '70 lượt tương tác Trợ lý AI Studio mỗi 24h', icon: <SparklesIcon sx={{ color: '#f59e0b', fontSize: 19 }} /> },
                        { text: 'Đăng tải bản ghi âm tối đa 150MB / bài hát', icon: <UploadIcon sx={{ color: '#06b6d4', fontSize: 19 }} /> },
                        { text: 'Mở rộng kho lưu trữ đám mây Studio lên 5GB', icon: <StorageIcon sx={{ color: '#10b981', fontSize: 19 }} /> },
                        { text: 'Huy hiệu PRO ánh kim trên hồ sơ & bài hát', icon: <ProIcon sx={{ color: '#ef4444', fontSize: 19 }} /> },
                        { text: 'Ưu tiên băng thông AI phản hồi siêu tốc', icon: <SpeedIcon sx={{ color: '#8b5cf6', fontSize: 19 }} /> },
                        { text: 'Hỗ trợ kỹ thuật ưu tiên 24/7 từ MusicFlow', icon: <ShieldIcon sx={{ color: '#3b82f6', fontSize: 19 }} /> },
                      ].map((item, i) => (
                        <Stack key={i} direction="row" spacing={1.5} alignItems="center">
                          {item.icon}
                          <Typography variant="body2" fontWeight={650}>
                            {item.text}
                          </Typography>
                        </Stack>
                      ))}
                    </Stack>
                  </Box>

                  <Box>
                    <Button
                      variant="contained"
                      fullWidth
                      size="large"
                      onClick={handleOpenCheckout}
                      sx={{
                        py: 1.5,
                        borderRadius: 3,
                        fontWeight: 900,
                        fontSize: '1rem',
                        textTransform: 'none',
                        background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
                        boxShadow: '0 8px 24px rgba(245, 158, 11, 0.4)',
                        '&:hover': {
                          background: 'linear-gradient(135deg, #d97706 0%, #dc2626 100%)',
                          boxShadow: '0 12px 28px rgba(245, 158, 11, 0.5)',
                        },
                      }}
                    >
                      {isProActive ? 'Gia Hạn Gói Studio Pro' : 'Nâng Cấp Ngay Hôm Nay'}
                    </Button>
                    <Stack direction="row" spacing={1} justifyContent="center" alignItems="center" sx={{ mt: 1.5 }}>
                      <LockIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                      <Typography variant="caption" color="text.secondary">
                        Thanh toán bảo mật mã hóa qua VNPay
                      </Typography>
                    </Stack>
                  </Box>
                </Paper>
              </Grid>

              {/* Right Column: Feature Comparison Matrix */}
              <Grid size={{ xs: 12, lg: 7.8, xl: 8.2 }}>
                <Paper
                  elevation={0}
                  sx={{
                    borderRadius: 3.5,
                    p: { xs: 2.5, sm: 3.5 },
                    height: '100%',
                    border: '1px solid',
                    borderColor: 'divider',
                    bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(15, 23, 42, 0.4)' : '#ffffff',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <Box>
                    <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 1 }}>
                      <WaveformIcon sx={{ color: '#6c63ff', fontSize: 24 }} />
                      <Typography variant="h6" fontWeight={850}>
                        Bảng So Sánh Quyền Lợi Nghệ Sĩ
                      </Typography>
                    </Stack>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
                      Xem nhanh sự khác biệt giữa tài khoản Artist tiêu chuẩn và đặc quyền mở rộng của Studio Pro.
                    </Typography>

                    <TableContainer sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                      <Table size="medium">
                        <TableHead sx={{ bgcolor: 'action.hover' }}>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 800, fontSize: '0.88rem' }}>Tính năng & Tài nguyên</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 800, fontSize: '0.88rem', color: 'text.secondary' }}>Artist Tiêu chuẩn</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 900, fontSize: '0.88rem', color: '#f59e0b' }}>Artist Studio Pro</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          <TableRow hover>
                            <TableCell sx={{ fontWeight: 650 }}>
                              Lượt dùng Trợ lý AI Studio
                              <Typography variant="caption" color="text.secondary" display="block">
                                Phân tích nhạc & viết lyrics
                              </Typography>
                            </TableCell>
                            <TableCell align="center" sx={{ color: 'text.secondary' }}>10 req / 24h</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 800, color: '#f59e0b' }}>
                              70 req / 24h
                            </TableCell>
                          </TableRow>

                          <TableRow hover>
                            <TableCell sx={{ fontWeight: 650 }}>
                              Dung lượng tối đa mỗi bài hát
                              <Typography variant="caption" color="text.secondary" display="block">
                                Chuẩn tệp tải lên hệ thống
                              </Typography>
                            </TableCell>
                            <TableCell align="center" sx={{ color: 'text.secondary' }}>50 MB</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 800, color: '#f59e0b' }}>
                              150 MB (Lossless)
                            </TableCell>
                          </TableRow>

                          <TableRow hover>
                            <TableCell sx={{ fontWeight: 650 }}>
                              Tổng kho lưu trữ Studio
                              <Typography variant="caption" color="text.secondary" display="block">
                                Đám mây bảo toàn file gốc
                              </Typography>
                            </TableCell>
                            <TableCell align="center" sx={{ color: 'text.secondary' }}>500 MB</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 800, color: '#f59e0b' }}>
                              5.000 MB (5GB)
                            </TableCell>
                          </TableRow>

                          <TableRow hover>
                            <TableCell sx={{ fontWeight: 650 }}>
                              Huy hiệu trên Hồ sơ cá nhân
                              <Typography variant="caption" color="text.secondary" display="block">
                                Khẳng định vị thế chuyên nghiệp
                              </Typography>
                            </TableCell>
                            <TableCell align="center" sx={{ color: 'text.secondary' }}>-</TableCell>
                            <TableCell align="center">
                              <Chip
                                label="PRO"
                                size="small"
                                sx={{
                                  height: 20,
                                  fontSize: '0.65rem',
                                  fontWeight: 850,
                                  background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                                  color: '#fff',
                                }}
                              />
                            </TableCell>
                          </TableRow>

                          <TableRow hover>
                            <TableCell sx={{ fontWeight: 650 }}>
                              Tốc độ xử lý AI Studio
                              <Typography variant="caption" color="text.secondary" display="block">
                                Ưu tiên luồng máy chủ xử lý
                              </Typography>
                            </TableCell>
                            <TableCell align="center" sx={{ color: 'text.secondary' }}>Tiêu chuẩn</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 800, color: '#f59e0b' }}>
                              Ưu tiên cao nhất
                            </TableCell>
                          </TableRow>

                          <TableRow hover>
                            <TableCell sx={{ fontWeight: 650 }}>
                              Hỗ trợ kỹ thuật Creator
                            </TableCell>
                            <TableCell align="center" sx={{ color: 'text.secondary' }}>Cộng đồng</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 800, color: '#4ade80' }}>
                              Kênh ưu tiên 24/7
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>

                  <Alert
                    severity="info"
                    sx={{
                      mt: 2.5,
                      borderRadius: 2.5,
                      fontSize: '0.85rem',
                      border: '1px solid',
                      borderColor: 'info.light',
                    }}
                  >
                    <strong>Lưu ý:</strong> Huy hiệu <strong>PRO</strong> là biểu tượng đặc quyền cho tài khoản nâng cấp gói sản xuất Artist Studio Pro. Huy hiệu <strong>Nghệ sĩ xác thực (Verified Artist <VerifiedIcon sx={{ fontSize: 15, verticalAlign: 'text-bottom', color: '#0ea5e9' }} />)</strong> tuân theo quy trình định danh riêng của ban quản trị MusicFlow.
                  </Alert>
                </Paper>
              </Grid>
            </Grid>

            {/* =========================================================================
                4. TRANSACTION HISTORY & FAQ (SPLIT 2 COLUMNS: 7 / 5)
            ========================================================================== */}
            <Grid container spacing={3} alignItems="flex-start">
              {/* Left Column: Transaction History */}
              <Grid size={{ xs: 12, lg: 7 }}>
                <Paper
                  elevation={0}
                  sx={{
                    borderRadius: 3.5,
                    p: { xs: 2.5, sm: 3 },
                    border: '1px solid',
                    borderColor: 'divider',
                    minHeight: '100%',
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2.5 }}>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <HistoryIcon sx={{ color: 'primary.main', fontSize: 24 }} />
                      <Typography variant="h6" fontWeight={850}>
                        Lịch Sử Giao Dịch Gói Studio
                      </Typography>
                    </Stack>
                    {history.length > 0 && (
                      <Chip
                        label={`${history.length} giao dịch`}
                        size="small"
                        sx={{ fontWeight: 750 }}
                      />
                    )}
                  </Stack>

                  {history.length === 0 ? (
                    <Box sx={{ py: 6, textAlign: 'center' }}>
                      <Typography variant="body2" color="text.secondary">
                        Chưa có giao dịch nâng cấp nào được ghi nhận.
                      </Typography>
                    </Box>
                  ) : (
                    <TableContainer sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                      <Table size="small">
                        <TableHead sx={{ bgcolor: 'action.hover' }}>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 800 }}>Mã giao dịch</TableCell>
                            <TableCell sx={{ fontWeight: 800 }}>Gói dịch vụ</TableCell>
                            <TableCell sx={{ fontWeight: 800 }}>Số tiền</TableCell>
                            <TableCell sx={{ fontWeight: 800 }}>Phương thức</TableCell>
                            <TableCell sx={{ fontWeight: 800 }}>Ngày tạo</TableCell>
                            <TableCell sx={{ fontWeight: 800 }}>Trạng thái</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {history.map((tx) => (
                            <TableRow key={tx._id || tx.transactionRef} hover>
                              <TableCell sx={{ fontFamily: 'monospace', fontWeight: 650 }}>
                                <Stack direction="row" spacing={0.5} alignItems="center">
                                  <span>{tx.transactionRef}</span>
                                  <Tooltip title="Sao chép mã giao dịch">
                                    <IconButton size="small" onClick={() => handleCopyRef(tx.transactionRef)}>
                                      <CopyIcon sx={{ fontSize: 13 }} />
                                    </IconButton>
                                  </Tooltip>
                                </Stack>
                              </TableCell>
                              <TableCell sx={{ fontWeight: 600 }}>{tx.plan?.name || 'Studio Pro'}</TableCell>
                              <TableCell sx={{ fontWeight: 800, color: '#f59e0b' }}>
                                {(tx.amount || 0).toLocaleString('vi-VN')} đ
                              </TableCell>
                              <TableCell sx={{ textTransform: 'uppercase', fontWeight: 650, fontSize: '0.78rem' }}>
                                {tx.paymentMethod}
                              </TableCell>
                              <TableCell sx={{ color: 'text.secondary' }}>
                                {new Date(tx.createdAt).toLocaleDateString('vi-VN')}
                              </TableCell>
                              <TableCell>
                                <Chip
                                  label={tx.status === 'success' ? 'Thành công' : tx.status === 'pending' ? 'Đang xử lý' : 'Thất bại'}
                                  size="small"
                                  sx={{
                                    height: 22,
                                    fontSize: '0.7rem',
                                    fontWeight: 800,
                                    bgcolor: tx.status === 'success' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                    color: tx.status === 'success' ? '#22c55e' : '#ef4444',
                                  }}
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </Paper>
              </Grid>

              {/* Right Column: FAQ Accordions */}
              <Grid size={{ xs: 12, lg: 5 }}>
                <Paper
                  elevation={0}
                  sx={{
                    borderRadius: 3.5,
                    p: { xs: 2.5, sm: 3 },
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
                    <FaqIcon sx={{ color: 'text.secondary', fontSize: 24 }} />
                    <Typography variant="h6" fontWeight={850}>
                      Câu Hỏi Thường Gặp Của Nghệ Sĩ
                    </Typography>
                  </Stack>

                  <Stack spacing={1.25}>
                    {FAQ_ITEMS.map((item, idx) => (
                      <Accordion
                        key={idx}
                        elevation={0}
                        sx={{
                          borderRadius: '12px !important',
                          border: '1px solid',
                          borderColor: 'divider',
                          '&:before': { display: 'none' },
                        }}
                      >
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                          <Typography variant="subtitle2" fontWeight={800} sx={{ fontSize: '0.88rem' }}>
                            {item.q}
                          </Typography>
                        </AccordionSummary>
                        <AccordionDetails sx={{ pt: 0, pb: 2 }}>
                          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6, fontSize: '0.84rem' }}>
                            {item.a}
                          </Typography>
                        </AccordionDetails>
                      </Accordion>
                    ))}
                  </Stack>
                </Paper>
              </Grid>
            </Grid>
          </Stack>
        )}
      </Box>

      {/* =========================================================================
          6. CHECKOUT MODAL DIALOG
      ========================================================================== */}
      <Dialog
        open={checkoutOpen}
        onClose={handleCloseCheckout}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3.5,
            p: 1,
          },
        }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <ProIcon sx={{ color: '#f59e0b' }} />
            <Typography variant="h6" fontWeight={900}>
              Nâng Cấp Studio Pro
            </Typography>
          </Stack>
          <IconButton onClick={handleCloseCheckout} size="small" disabled={submitting}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers sx={{ py: 2.5 }}>
          {/* Order Summary Box */}
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(245, 158, 11, 0.08)' : 'rgba(245, 158, 11, 0.04)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              borderRadius: 2.5,
              mb: 3,
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Gói bản quyền:
              </Typography>
              <Chip label="ARTIST PRO" size="small" sx={{ fontWeight: 800, height: 20, fontSize: '0.65rem', bgcolor: '#f59e0b', color: '#fff' }} />
            </Stack>
            <Typography variant="subtitle1" fontWeight={900}>
              Artist Studio Pro (Chu kỳ 30 ngày)
            </Typography>
            <Divider sx={{ my: 1.5, borderColor: 'rgba(245, 158, 11, 0.15)' }} />
            <Stack direction="row" justifyContent="space-between" alignItems="baseline">
              <Typography variant="caption" color="text.secondary" fontWeight={600}>
                Tổng thanh toán (đã có VAT):
              </Typography>
              <Typography variant="h5" fontWeight={950} color="#f59e0b">
                {proPlan?.price ? `${Number(proPlan.price).toLocaleString('vi-VN')} đ` : '79.000 đ'}
              </Typography>
            </Stack>
          </Paper>

          <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1.5 }}>
            Phương thức thanh toán bảo mật:
          </Typography>

          <RadioGroup value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            <Paper
              elevation={0}
              sx={{
                p: 1.75,
                borderRadius: 2.5,
                border: '1.5px solid #f59e0b',
                bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(245, 158, 11, 0.06)' : 'rgba(245, 158, 11, 0.02)',
              }}
            >
              <FormControlLabel
                value="vnpay"
                control={<Radio color="warning" checked readOnly />}
                label={
                  <Box>
                    <Typography variant="body2" fontWeight={800}>
                      Cổng thanh toán VNPay
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Quét mã VNPAY-QR, Thẻ ATM / Internet Banking, Visa / Mastercard
                    </Typography>
                  </Box>
                }
                sx={{ width: '100%', m: 0 }}
              />
            </Paper>
          </RadioGroup>

          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 2.5, px: 0.5 }}>
            <ShieldIcon sx={{ fontSize: 16, color: '#10b981' }} />
            <Typography variant="caption" color="text.secondary">
              Giao dịch được bảo vệ bởi cổng thanh toán bảo mật chuẩn quốc tế.
            </Typography>
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={handleCloseCheckout} disabled={submitting} sx={{ fontWeight: 700, borderRadius: 2 }}>
            Hủy
          </Button>
          <Button
            variant="contained"
            onClick={handleCheckout}
            disabled={submitting}
            sx={{
              background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
              fontWeight: 850,
              borderRadius: 2.5,
              px: 3.5,
              py: 1.1,
              textTransform: 'none',
              boxShadow: '0 4px 14px rgba(245, 158, 11, 0.35)',
              '&:hover': {
                background: 'linear-gradient(135deg, #d97706, #dc2626)',
              },
            }}
          >
            {submitting ? <CircularProgress size={22} color="inherit" /> : 'Tiến Hành Thanh Toán'}
          </Button>
        </DialogActions>
      </Dialog>
    </ArtistLayout>
  );
}

export default ArtistPro;
