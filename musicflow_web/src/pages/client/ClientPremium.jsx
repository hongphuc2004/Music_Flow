import { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  Paper,
  Radio,
  RadioGroup,
  FormControlLabel,
  Stack,
  Typography,
  Alert,
  IconButton,
} from '@mui/material';
import {
  WorkspacePremiumRounded as PremiumIcon,
  CheckCircleOutlineRounded as CheckIcon,
  FlashOnRounded as FlashIcon,
  AccountBalanceWalletRounded as WalletIcon,
  GraphicEqRounded,
  TuneRounded,
  CloudUploadRounded,
  AutoAwesomeRounded,
  SearchRounded,
  PanToolRounded,
  MusicNoteRounded,
  ShuffleRounded,
  CloseRounded as CloseIcon,
  SecurityRounded,
} from '@mui/icons-material';
import ClientLayout from '../../components/Layout/client/ClientLayout';
import { clientPlansApi, clientSubscriptionApi, clientUserApi } from '../../services/client/client.service';
import useAppToast from '../../components/common/js/useAppToast';
import { useNavigate } from 'react-router-dom';

function ClientPremium() {
  const { showToast } = useAppToast();
  const navigate = useNavigate();

  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Tab đặc quyền khi nâng cấp (plus | premium)
  const [privilegeTab, setPrivilegeTab] = useState('plus');

  // Trạng thái Premium hiện tại của user
  const [currentSub, setCurrentSub] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [isPremiumUser, setIsPremiumUser] = useState(false);
  const [expiryDate, setExpiryDate] = useState('');

  // Trạng thái Checkout Modal
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('vnpay'); // 'vnpay' làm phương thức chính thức
  const [processing, setProcessing] = useState(false);

  const loadPremiumInfo = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      
      // 1. Tải danh sách gói cước hoạt động từ DB (chỉ lấy gói dành cho User)
      const plansRes = await clientPlansApi.getActive({ targetRole: 'user' });
      const userPlans = (plansRes.data?.data || []).filter((p) => p.targetRole !== 'artist');
      setPlans(userPlans);

      // 2. Tải thông tin cước hiện tại của user & user profile (nếu đã đăng nhập)
      const token = localStorage.getItem('accessToken');
      if (token) {
        try {
          const [subRes, userRes] = await Promise.all([
            clientSubscriptionApi.getCurrent(),
            clientUserApi.getMe()
          ]);
          const activeSub = subRes.data?.data?.activeSubscription || null;
          const userObj = userRes.data?.user || null;
          setCurrentSub(activeSub);
          setCurrentUser(userObj);

          const isUserActive = Boolean(
            (userObj?.isPremium && userObj?.premiumExpiry && new Date(userObj.premiumExpiry) > new Date()) ||
            (activeSub?.status === 'active' && activeSub?.endDate && new Date(activeSub.endDate) > new Date())
          );

          setIsPremiumUser(isUserActive);
          if (isUserActive) {
            const exp = activeSub?.endDate || userObj?.premiumExpiry;
            if (exp) {
              setExpiryDate(new Date(exp).toLocaleDateString('vi-VN'));
            }
          }
        } catch {
          // ignore error if token invalid / guest
        }
      } else {
        setIsPremiumUser(false);
        setCurrentSub(null);
        setCurrentUser(null);
      }
    } catch (err) {
      console.error('Failed to load premium info:', err);
      setError('Không thể kết nối máy chủ để tải thông tin Premium.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPremiumInfo();
  }, [loadPremiumInfo]);

  // Tự động tải lại thông tin khi phiên đăng nhập thay đổi
  useEffect(() => {
    const handleSessionChange = () => {
      loadPremiumInfo();
    };
    window.addEventListener('musicflow-client-session-changed', handleSessionChange);
    return () => window.removeEventListener('musicflow-client-session-changed', handleSessionChange);
  }, [loadPremiumInfo]);

  // Tự động tiếp tục tiến trình đăng ký gói cước sau khi người dùng đăng nhập thành công
  useEffect(() => {
    if (!loading && plans.length > 0) {
      const token = localStorage.getItem('accessToken');
      const role = localStorage.getItem('role');
      const pendingPlanId = sessionStorage.getItem('mf_pending_upgrade_plan_id');

      if (token && role && pendingPlanId) {
        const targetPlan = plans.find((p) => String(p._id) === String(pendingPlanId));
        if (targetPlan) {
          sessionStorage.removeItem('mf_pending_upgrade_plan_id');
          sessionStorage.removeItem('mf_redirect_after_login');
          setSelectedPlan(targetPlan);
          setCheckoutOpen(true);
          showToast({
            severity: 'info',
            title: 'Tiếp tục đăng ký',
            message: `Tiếp tục tiến trình đăng ký gói ${targetPlan.name}.`,
          });
        }
      }
    }
  }, [loading, plans, showToast]);

  const handleOpenCheckout = (plan) => {
    const token = localStorage.getItem('accessToken');
    const role = localStorage.getItem('role');

    // Nếu chưa đăng nhập: Lưu lại gói đang chọn và mở login ngay trên trang /premium
    if (!token || !role) {
      sessionStorage.setItem('mf_pending_upgrade_plan_id', String(plan._id));
      sessionStorage.setItem('mf_redirect_after_login', '/premium');
      showToast({
        severity: 'info',
        title: 'Yêu cầu đăng nhập',
        message: `Vui lòng đăng nhập để tiếp tục đăng ký gói ${plan.name}.`,
      });
      // Mở dialog đăng nhập ngay tại URL /premium?auth=login (không chuyển ra trang chủ)
      navigate('/premium?auth=login');
      return;
    }

    setSelectedPlan(plan);
    setCheckoutOpen(true);
  };

  const handleCloseCheckout = () => {
    if (processing) return;
    setCheckoutOpen(false);
    setSelectedPlan(null);
  };

  const handleCheckout = async () => {
    if (!selectedPlan) return;
    try {
      setProcessing(true);
      
      // 1. Gọi API Checkout ở Backend (Giá tiền và số ngày được lấy trực tiếp từ DB Plan, không tin Client)
      const checkoutRes = await clientSubscriptionApi.checkout({
        planId: selectedPlan._id,
        paymentMethod: paymentMethod,
      });

      if (paymentMethod === 'vnpay') {
        // Cổng VNPay: Chuyển hướng sang VNPay Sandbox để thanh toán
        if (checkoutRes.data?.paymentUrl) {
          showToast({
            severity: 'info',
            title: 'Chuyển hướng thanh toán',
            message: 'Đang chuyển bạn sang cổng thanh toán VNPay Sandbox...',
          });
          window.location.href = checkoutRes.data.paymentUrl;
        } else {
          throw new Error('Không nhận được link thanh toán từ VNPay');
        }
      } else {
        // Cổng Mock Payment: Xác nhận thanh toán trực tiếp để kích hoạt
        const transactionRef = checkoutRes.data?.transaction?.transactionRef;
        await clientSubscriptionApi.mockConfirm({ transactionRef });

        showToast({
          severity: 'success',
          title: 'Thanh toán thành công',
          message: `Nâng cấp thành công gói Premium ${selectedPlan.name}!`,
        });
        
        setCheckoutOpen(false);
        // Chuyển hướng về trang cá nhân để cập nhật trạng thái mới
        navigate('/profile');

      }
    } catch (err) {
      console.error('Checkout error:', err);
      showToast({
        severity: 'error',
        title: 'Thanh toán thất bại',
        message: err.response?.data?.message || 'Có lỗi xảy ra trong quá trình thanh toán.',
      });
    } finally {
      setProcessing(false);
    }
  };

  const getMappedPlanLabel = (plan) => {
    if (plan.price === 20000 || plan.name.includes("PLUS")) return { title: 'PLUS', badge: 'PHỔ BIẾN NHẤT' };
    if (plan.price === 50000 || plan.name.includes("PREMIUM")) return { title: 'PREMIUM', badge: 'VIP' };
    return { title: plan.name, badge: '' };
  };

  // Trích lọc các đặc quyền riêng biệt để giảm lặp text giữa các Pricing Card
  const getConciseBenefits = (plan) => {
    if (plan.price === 20000 || plan.name.includes("PLUS")) {
      return [
        'Hạn mức tải lên tối đa 500 MB',
        'Tải nhạc ngoại tuyến tối đa 700 MB',
        'Trò chuyện AI DJ (20 lượt / ngày)',
        'Miễn 100% quảng cáo âm thanh & Banner',
      ];
    }
    if (plan.price === 50000 || plan.name.includes("PREMIUM")) {
      return [
        'Nghe trọn vẹn toàn bộ Kho nhạc Premium',
        'Âm thanh Studio HQ 320kbps toàn diện',
        'Trò chuyện AI DJ (50 lượt / ngày, mô hình AI thông minh nhất)',
        'Hạn mức tải lên & ngoại tuyến tối đa 1 GB',
      ];
    }
    return plan.description;
  };

  return (
    <ClientLayout title="MusicFlow Premium">
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 18 }}>
          <CircularProgress size={38} color="secondary" />
        </Box>
      ) : error ? (
        <Alert severity="error" sx={{ borderRadius: 3 }}>{error}</Alert>
      ) : (
        <Stack spacing={4}>
          {/* 1. Sleek Compact Hero Banner */}
          <Paper
            elevation={0}
            sx={{
              p: 3,
              borderRadius: 3,
              background: (theme) => theme.palette.mode === 'dark'
                ? 'linear-gradient(135deg, rgba(108, 99, 255, 0.15) 0%, rgba(20, 184, 166, 0.03) 100%)'
                : 'linear-gradient(135deg, rgba(108, 99, 255, 0.05) 0%, rgba(20, 184, 166, 0.01) 100%)',
              border: '1px solid',
              borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(108, 99, 255, 0.1)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <Stack 
              direction={{ xs: 'column', md: 'row' }} 
              spacing={3} 
              alignItems="center" 
              justifyContent="space-between"
            >
              <Stack direction="row" spacing={2} alignItems="center">
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 48,
                    height: 48,
                    borderRadius: 3,
                    background: 'linear-gradient(135deg, #6c63ff, #00bcd4)',
                    boxShadow: '0 4px 14px rgba(108, 99, 255, 0.2)',
                    flexShrink: 0,
                  }}
                >
                  <PremiumIcon sx={{ color: '#fff', fontSize: 24 }} />
                </Box>
                <Box>
                  <Typography variant="h6" fontWeight={850}>
                    Nâng cấp trải nghiệm âm nhạc của bạn
                  </Typography>
                  <Typography variant="body2" color="text.secondary" fontWeight={500}>
                    Mở khóa các đặc quyền tải nhạc, trò chuyện AI DJ không giới hạn chất lượng cao.
                  </Typography>
                </Box>
              </Stack>

              {isPremiumUser ? (
                <Box
                  sx={{
                    px: 2,
                    py: 1,
                    borderRadius: 3,
                    bgcolor: 'rgba(34, 197, 94, 0.12)',
                    border: '1px solid rgba(34, 197, 94, 0.25)',
                    textAlign: { xs: 'center', md: 'right' },
                    alignSelf: { xs: 'stretch', md: 'auto' },
                  }}
                >
                  <Typography variant="subtitle2" fontWeight={800} color="#22c55e" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                    <CheckIcon fontSize="small" /> Tài khoản Premium hoạt động
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25, fontWeight: 600 }}>
                    Hạn dùng: {expiryDate}
                  </Typography>
                </Box>
              ) : (
                <Box
                  sx={{
                    px: 2,
                    py: 1,
                    borderRadius: 3,
                    bgcolor: 'action.hover',
                    border: '1px solid divider',
                    textAlign: { xs: 'center', md: 'right' },
                    alignSelf: { xs: 'stretch', md: 'auto' },
                  }}
                >
                  <Typography variant="subtitle2" fontWeight={800} color="text.secondary">
                    Tài khoản Basic Listener
                  </Typography>
                  <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.25 }}>
                    Đang chịu giới hạn hạn mức Free
                  </Typography>
                </Box>
              )}
            </Stack>
          </Paper>

          {/* 2. CHỌN GÓI PREMIUM PLANS */}
          <Box>
            <Typography variant="h5" fontWeight={900} align="center" sx={{ mb: 4, letterSpacing: '-0.5px' }}>
              {isPremiumUser ? 'Nâng cấp gói của bạn' : 'Chọn gói cước phù hợp'}
            </Typography>

            <Grid container spacing={3.5} justifyContent="center" alignItems="stretch">
              {plans.map((plan) => {
                const isCurrentPlan = isPremiumUser && Boolean(
                  (currentSub?.plan?._id && String(currentSub.plan._id) === String(plan._id)) ||
                  (currentSub?.plan && String(currentSub.plan) === String(plan._id)) ||
                  (currentUser?.premiumPlan?._id && String(currentUser.premiumPlan._id) === String(plan._id)) ||
                  (currentUser?.premiumPlan && String(currentUser.premiumPlan) === String(plan._id)) ||
                  (currentUser?.premiumPlan?.name && currentUser.premiumPlan.name === plan.name)
                );
                const { title: displayTitle, badge: highlightBadge } = getMappedPlanLabel(plan);
                const planBenefits = getConciseBenefits(plan);

                const isPopular = plan.price === 20000 || plan.name.includes("PLUS");
                const isPremium = plan.price === 50000 || plan.name.includes("PREMIUM");
                
                return (
                  <Grid size={{ xs: 12, sm: 6, md: 4 }} key={plan._id} sx={{ display: 'flex' }}>
                    <Card
                      elevation={0}
                      sx={{
                        width: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        borderRadius: '16px',
                        border: '2px solid',
                        borderColor: isCurrentPlan
                          ? '#22c55e'
                          : isPopular
                            ? 'rgba(168, 85, 247, 0.45)'
                            : isPremium
                              ? 'rgba(245, 158, 11, 0.5)'
                              : (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                        background: (theme) => theme.palette.mode === 'dark'
                          ? isPopular
                            ? 'linear-gradient(180deg, rgba(38, 16, 68, 0.72) 0%, rgba(18, 10, 32, 0.95) 100%)'
                            : isPremium
                              ? 'linear-gradient(180deg, rgba(50, 30, 8, 0.72) 0%, rgba(22, 13, 3, 0.95) 100%)'
                              : '#111827'
                          : '#ffffff',
                        transition: 'all 0.3s ease-in-out',
                        position: 'relative',
                        overflow: 'hidden',
                        '&:hover': {
                          transform: 'translateY(-6px)',
                          boxShadow: isCurrentPlan 
                            ? '0 12px 30px rgba(34, 197, 94, 0.15)'
                            : isPopular
                              ? '0 16px 36px rgba(124, 58, 237, 0.25)'
                              : isPremium
                                ? '0 16px 36px rgba(245, 158, 11, 0.25)'
                                : '0 12px 30px rgba(0, 0, 0, 0.08)',
                          borderColor: isCurrentPlan 
                            ? '#22c55e' 
                            : isPopular
                              ? '#c084fc'
                              : isPremium
                                ? '#fbbf24'
                                : '#6c63ff',
                        },
                      }}
                    >
                      {/* Highlight Badge */}
                      {highlightBadge && !isCurrentPlan && (
                        <Box
                          sx={{
                            position: 'absolute',
                            top: 18,
                            right: 18,
                            bgcolor: isPopular ? '#7c3aed' : '#f59e0b',
                            backgroundImage: isPopular
                              ? 'linear-gradient(135deg, #7c3aed, #9333ea)'
                              : 'linear-gradient(135deg, #fbbf24, #f59e0b)',
                            color: isPopular ? '#fff' : '#181001',
                            px: 1.5,
                            py: 0.4,
                            borderRadius: '8px',
                            zIndex: 2,
                            boxShadow: isPopular ? '0 2px 10px rgba(124, 58, 237, 0.4)' : '0 2px 10px rgba(245, 158, 11, 0.45)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Typography variant="caption" sx={{ fontWeight: 900, fontSize: '11px', letterSpacing: '0.3px', lineHeight: 1.4 }}>
                            {highlightBadge}
                          </Typography>
                        </Box>
                      )}

                      {/* Current Active Plan Badge */}
                      {isCurrentPlan && (
                        <Box
                          sx={{
                            position: 'absolute',
                            top: 18,
                            right: 18,
                            bgcolor: 'rgba(34, 197, 94, 0.15)',
                            color: '#22c55e',
                            border: '1px solid rgba(34, 197, 94, 0.3)',
                            px: 1.5,
                            py: 0.4,
                            borderRadius: '8px',
                            zIndex: 2,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Typography variant="caption" sx={{ fontWeight: 900, fontSize: '11px', letterSpacing: '0.3px', lineHeight: 1.4 }}>
                            GÓI HIỆN TẠI
                          </Typography>
                        </Box>
                      )}

                      <CardContent sx={{ p: 4, display: 'flex', flexDirection: 'column', height: '100%' }}>
                        <Typography variant="h6" fontWeight={900} color="text.primary" sx={{ mb: 2 }}>
                          {displayTitle}
                        </Typography>
                        
                        {/* Pricing section with primary total cost and secondary monthly equivalence */}
                        <Stack direction="column" sx={{ mb: 3 }}>
                          <Stack direction="row" alignItems="baseline" spacing={0.5}>
                            <Typography
                              variant="h4"
                              fontWeight={900}
                              color={isCurrentPlan ? '#22c55e' : isPopular ? '#c084fc' : isPremium ? '#fbbf24' : '#6c63ff'}
                              sx={{ letterSpacing: '-0.5px' }}
                            >
                              {plan.price.toLocaleString('vi-VN')} đ
                            </Typography>
                            <Typography variant="body2" color="text.secondary" fontWeight={750}>
                              / tháng
                            </Typography>
                          </Stack>
                        </Stack>

                        <Divider sx={{ mb: 3 }} />

                        <Stack spacing={2.2} sx={{ mb: 4, flexGrow: 1 }}>
                          {planBenefits.map((desc, index) => (
                            <Stack key={index} direction="row" spacing={1.2} alignItems="center">
                              <CheckIcon sx={{ color: isCurrentPlan ? '#22c55e' : isPopular ? '#c084fc' : isPremium ? '#fbbf24' : '#6c63ff', fontSize: 18 }} />
                              <Typography variant="body2" color="text.secondary" fontWeight={600}>
                                {desc}
                              </Typography>
                            </Stack>
                          ))}
                        </Stack>

                        {(() => {
                          const planBtnGradient = isPopular
                            ? 'linear-gradient(15deg, #6c63ff, #7c3aed, #8b5cf6, #a855f7, #c084fc, #a855f7, #8b5cf6, #7c3aed, #6c63ff)'
                            : isPremium
                              ? 'linear-gradient(15deg, #b45309, #d97706, #f59e0b, #fbbf24, #fef08a, #fbbf24, #f59e0b, #d97706, #b45309)'
                              : 'linear-gradient(15deg, #1d4ed8, #2563eb, #0284c7, #00bcd4, #38bdf8, #00bcd4, #0284c7, #2563eb, #1d4ed8)';

                          const planTextShadow = isPopular
                            ? '2px 2px 3px rgba(108, 99, 255, 0.55)'
                            : isPremium
                              ? '2px 2px 4px rgba(120, 53, 15, 0.75)'
                              : '2px 2px 3px rgba(30, 58, 138, 0.55)';

                          const planHoverShadow = isPopular
                            ? '0 8px 24px rgba(124, 58, 237, 0.5)'
                            : isPremium
                              ? '0 8px 26px rgba(245, 158, 11, 0.55)'
                              : '0 8px 24px rgba(0, 188, 212, 0.4)';

                          return (
                            <Button
                              variant={isCurrentPlan ? 'outlined' : 'contained'}
                              color={isCurrentPlan ? 'success' : 'primary'}
                              fullWidth
                              onClick={() => handleOpenCheckout(plan)}
                              sx={{
                                py: 1.4,
                                borderRadius: '30px',
                                fontWeight: 800,
                                textTransform: 'none',
                                fontSize: '14.5px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                cursor: 'pointer',
                                ...(isCurrentPlan ? {
                                  borderWidth: 2,
                                  color: '#22c55e',
                                  borderColor: '#22c55e',
                                  '&:hover': { borderWidth: 2, borderColor: '#16a34a', bgcolor: 'rgba(34, 197, 94, 0.04)' }
                                } : {
                                  color: '#fff',
                                  background: `${planBtnGradient} no-repeat`,
                                  backgroundSize: '300%',
                                  backgroundPosition: 'left center',
                                  textShadow: planTextShadow,
                                  boxShadow: '0 4px 14px rgba(0, 0, 0, 0.15)',
                                  transition: 'all 0.35s ease',
                                  '& svg': {
                                    width: '23px',
                                    height: '16px',
                                    fill: isPopular ? '#f09f33' : '#fef08a',
                                    transition: '0.3s ease',
                                    flexShrink: 0,
                                  },
                                  '&:hover': {
                                    backgroundSize: '320%',
                                    backgroundPosition: 'right center',
                                    boxShadow: planHoverShadow,
                                    transform: 'translateY(-2px)',
                                    '& svg': {
                                      fill: '#fff',
                                      transform: 'scale(1.08)',
                                    },
                                  },
                                  '&:active': {
                                    transform: 'translateY(0)',
                                  },
                                })
                              }}
                            >
                              {!isCurrentPlan ? (
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 24">
                                  <path d="m18 0 8 12 10-8-4 20H4L0 4l10 8 8-12z" />
                                </svg>
                              ) : (
                                <CheckIcon fontSize="small" sx={{ color: '#22c55e' }} />
                              )}
                              {isCurrentPlan 
                                ? 'Gói hiện tại của bạn' 
                                : isPremiumUser 
                                  ? 'Gia hạn Premium' 
                                  : (plan.price === 19000 || plan.name.includes("GO"))
                                    ? 'Nâng cấp GO' 
                                    : (plan.price === 20000 || plan.name.includes("PLUS"))
                                      ? 'Nâng cấp PLUS' 
                                      : 'Nâng cấp PREMIUM'}
                            </Button>
                          );
                        })()}
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          </Box>

          {/* 3. ĐẶC QUYỀN KHI NÂNG CẤP (HIỆU ỨNG CHUYỂN TAB & MÀU SẮC RIÊNG BIỆT CHUẨN QC.MP4) */}
          <Box sx={{ mt: 5, mb: 3, width: '100%' }}>
            {/* Tiêu đề trung tâm */}
            <Typography
              variant="h4"
              align="center"
              sx={{
                fontWeight: 900,
                color: (theme) => theme.palette.mode === 'dark' ? '#ffffff' : '#1e1b4b',
                fontSize: { xs: '24px', sm: '28px', md: '32px' },
                letterSpacing: '-0.5px',
                mb: 2.5,
              }}
            >
              Đặc quyền khi nâng cấp
            </Typography>

            {/* Bộ chuyển đổi Tab hình viên thuốc với màu sắc riêng biệt cho từng gói */}
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 4 }}>
              <Box
                sx={{
                  display: 'inline-flex',
                  p: '5px',
                  borderRadius: '999px',
                  bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                  border: '1px solid',
                  borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
                  backdropFilter: 'blur(12px)',
                }}
              >
                {/* NÚT PLUS: Tông tím sắc sảo */}
                <Button
                  onClick={() => setPrivilegeTab('plus')}
                  sx={{
                    px: { xs: 3, sm: 4.5 },
                    py: 0.9,
                    borderRadius: '999px',
                    fontWeight: 900,
                    fontSize: '13.5px',
                    letterSpacing: '0.8px',
                    textTransform: 'uppercase',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    bgcolor: privilegeTab === 'plus' ? '#7c3aed' : 'transparent',
                    color: privilegeTab === 'plus' ? '#ffffff' : (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.65)' : 'rgba(0, 0, 0, 0.55)',
                    boxShadow: privilegeTab === 'plus' ? '0 4px 18px rgba(124, 58, 237, 0.55)' : 'none',
                    '&:hover': {
                      bgcolor: privilegeTab === 'plus' ? '#6d28d9' : 'rgba(255, 255, 255, 0.08)',
                      color: '#ffffff',
                    },
                  }}
                >
                  PLUS
                </Button>

                {/* NÚT PREMIUM: Tông Vàng Gold Hoàng Gia theo qc.mp4 */}
                <Button
                  onClick={() => setPrivilegeTab('premium')}
                  sx={{
                    px: { xs: 3, sm: 4.5 },
                    py: 0.9,
                    borderRadius: '999px',
                    fontWeight: 900,
                    fontSize: '13.5px',
                    letterSpacing: '0.8px',
                    textTransform: 'uppercase',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    bgcolor: privilegeTab === 'premium' ? '#f59e0b' : 'transparent',
                    background: privilegeTab === 'premium' ? 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)' : 'transparent',
                    color: privilegeTab === 'premium' ? '#181001' : (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.65)' : 'rgba(0, 0, 0, 0.55)',
                    boxShadow: privilegeTab === 'premium' ? '0 4px 20px rgba(245, 158, 11, 0.65)' : 'none',
                    '&:hover': {
                      bgcolor: privilegeTab === 'premium' ? '#d97706' : 'rgba(255, 255, 255, 0.08)',
                      color: privilegeTab === 'premium' ? '#181001' : '#ffffff',
                    },
                  }}
                >
                  PREMIUM
                </Button>
              </Box>
            </Box>

            {/* DANH SÁCH THẺ ĐẶC QUYỀN (ANIMATION CHUYỂN TAB MƯỢT MÀ VÀ THEME MÀU ĐÚNG GÓI) */}
            <Box
              key={privilegeTab}
              sx={{
                animation: 'privilegeFadeIn 0.38s cubic-bezier(0.4, 0, 0.2, 1)',
                '@keyframes privilegeFadeIn': {
                  '0%': { opacity: 0, transform: 'translateY(10px) scale(0.99)' },
                  '100%': { opacity: 1, transform: 'translateY(0) scale(1)' },
                },
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: 'repeat(2, 1fr)',
                  md: privilegeTab === 'premium' ? 'repeat(3, 1fr)' : 'repeat(3, 1fr)',
                  lg: privilegeTab === 'premium' ? 'repeat(6, 1fr)' : 'repeat(5, 1fr)',
                },
                gap: 2,
                width: '100%',
              }}
            >
              {/* THẺ ĐẶC QUYỀN: KHO NHẠC PREMIUM (CHỈ CÓ Ở TAB PREMIUM THEO VIDEO QC.MP4) */}
              {privilegeTab === 'premium' && (
                <Card
                  sx={{
                    borderRadius: '24px',
                    background: 'linear-gradient(180deg, #382109 0%, #1a1003 100%)',
                    border: '1px solid rgba(245, 158, 11, 0.35)',
                    boxShadow: '0 12px 32px rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    transition: 'transform 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease',
                    '&:hover': {
                      transform: 'translateY(-6px)',
                      borderColor: 'rgba(251, 191, 36, 0.75)',
                      boxShadow: '0 20px 42px rgba(245, 158, 11, 0.35)',
                    },
                  }}
                >
                  <Box
                    sx={{
                      width: '100%',
                      height: 230,
                      background: 'linear-gradient(180deg, #fffbeb 0%, #fef3c7 100%)',
                      borderRadius: '22px 22px 0 0',
                      p: 1.5,
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    {/* Header giao diện */}
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                        <PremiumIcon sx={{ fontSize: 16, color: '#d97706' }} />
                        <Typography sx={{ fontSize: '11px', fontWeight: 900, color: '#78350f' }}>
                          Kho nhạc Premium
                        </Typography>
                      </Box>
                      <Box sx={{ px: 0.8, py: 0.2, bgcolor: '#f59e0b', borderRadius: '4px' }}>
                        <Typography sx={{ fontSize: '8px', fontWeight: 900, color: '#181001' }}>
                          VIP
                        </Typography>
                      </Box>
                    </Box>

                    {/* Hộp thoại thông báo nổi bật */}
                    <Box
                      sx={{
                        p: 1.2,
                        bgcolor: '#ffffff',
                        borderRadius: '12px',
                        boxShadow: '0 4px 14px rgba(217, 119, 6, 0.15)',
                        border: '1px solid rgba(245, 158, 11, 0.25)',
                        mb: 1.2,
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box
                          sx={{
                            width: 32,
                            height: 32,
                            borderRadius: '8px',
                            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#ffffff',
                            boxShadow: '0 4px 10px rgba(245, 158, 11, 0.35)',
                          }}
                        >
                          <MusicNoteRounded sx={{ fontSize: 18 }} />
                        </Box>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography sx={{ fontSize: '10px', fontWeight: 800, color: '#78350f', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            Đặc quyền Premium
                          </Typography>
                          <Typography sx={{ fontSize: '8px', color: '#92400e', lineHeight: 1.2 }}>
                            Tất cả bài hát độc quyền
                          </Typography>
                        </Box>
                      </Box>
                    </Box>

                    {/* Danh sách bài hát độc quyền demo */}
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        p: 0.8,
                        borderRadius: '8px',
                        bgcolor: 'rgba(255, 255, 255, 0.9)',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                      }}
                    >
                      <Box sx={{ width: 26, height: 26, borderRadius: '6px', bgcolor: '#b45309', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                        <PremiumIcon sx={{ fontSize: 14 }} />
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontSize: '9.5px', fontWeight: 800, color: '#451a03', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          Album Signature
                        </Typography>
                        <Typography sx={{ fontSize: '8px', color: '#92400e' }}>
                          Dành riêng cho Premium
                        </Typography>
                      </Box>
                      <AutoAwesomeRounded sx={{ fontSize: 13, color: '#f59e0b' }} />
                    </Box>
                  </Box>

                  {/* Nội dung bên dưới */}
                  <Box sx={{ p: 2, flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                    <Typography sx={{ color: '#ffffff', fontWeight: 850, fontSize: '15px', mb: 1, lineHeight: 1.3 }}>
                      Kho nhạc Premium
                    </Typography>
                    <Typography sx={{ color: 'rgba(255, 255, 255, 0.72)', fontSize: '12.5px', lineHeight: 1.5 }}>
                      Tất cả các bài hát và album bản quyền đỉnh cao dành riêng cho thành viên Premium
                    </Typography>
                  </Box>
                </Card>
              )}

              {/* CARD: NGHE NHẠC KHÔNG QUẢNG CÁO */}
              <Card
                sx={{
                  borderRadius: '24px',
                  background: privilegeTab === 'premium' ? 'linear-gradient(180deg, #382109 0%, #1a1003 100%)' : 'linear-gradient(180deg, #2c124d 0%, #16092b 100%)',
                  border: '1px solid',
                  borderColor: privilegeTab === 'premium' ? 'rgba(245, 158, 11, 0.35)' : 'rgba(168, 85, 247, 0.28)',
                  boxShadow: '0 12px 32px rgba(0, 0, 0, 0.45)',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  transition: 'transform 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-6px)',
                    borderColor: privilegeTab === 'premium' ? 'rgba(251, 191, 36, 0.75)' : 'rgba(192, 132, 252, 0.6)',
                    boxShadow: privilegeTab === 'premium' ? '0 20px 42px rgba(245, 158, 11, 0.35)' : '0 20px 42px rgba(124, 58, 237, 0.28)',
                  },
                }}
              >
                <Box
                  sx={{
                    width: '100%',
                    height: 230,
                    background: 'linear-gradient(180deg, #e2e8f0 0%, #cbd5e1 100%)',
                    borderRadius: '22px 22px 0 0',
                    p: 1.5,
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.2 }}>
                    <Typography sx={{ fontSize: '11px', fontWeight: 800, color: '#1e293b' }}>
                      Khám phá
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.8, color: '#64748b' }}>
                      <SearchRounded sx={{ fontSize: 13 }} />
                      <MusicNoteRounded sx={{ fontSize: 13 }} />
                    </Box>
                  </Box>

                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                    <Box sx={{ height: 75, borderRadius: '8px', bgcolor: '#94a3b8', opacity: 0.6 }} />
                    <Box sx={{ height: 75, borderRadius: '8px', bgcolor: '#94a3b8', opacity: 0.6 }} />
                    <Box sx={{ height: 75, borderRadius: '8px', bgcolor: '#94a3b8', opacity: 0.6 }} />
                    <Box sx={{ height: 75, borderRadius: '8px', bgcolor: '#94a3b8', opacity: 0.6 }} />
                  </Box>

                  {/* Huy hiệu ADS cấm đỏ */}
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 48,
                      left: 18,
                      width: 52,
                      height: 52,
                      borderRadius: '50%',
                      background: 'radial-gradient(circle at 30% 30%, #ef4444 0%, #b91c1c 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 8px 18px rgba(220, 38, 38, 0.55)',
                      border: '2px solid #ffffff',
                      transform: 'rotate(-10deg)',
                    }}
                  >
                    <Typography sx={{ color: '#ffffff', fontWeight: 900, fontSize: '11.5px', letterSpacing: '0.5px' }}>
                      ADS
                    </Typography>
                    <Box
                      sx={{
                        position: 'absolute',
                        width: '42px',
                        height: '3.5px',
                        bgcolor: '#ffffff',
                        transform: 'rotate(-45deg)',
                        borderRadius: '2px',
                      }}
                    />
                  </Box>

                  {/* Huy hiệu Bàn tay dừng cấm đỏ */}
                  <Box
                    sx={{
                      position: 'absolute',
                      bottom: 24,
                      right: 18,
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      background: 'radial-gradient(circle at 30% 30%, #dc2626 0%, #991b1b 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 8px 18px rgba(185, 28, 28, 0.55)',
                      border: '2px solid #ffffff',
                    }}
                  >
                    <PanToolRounded sx={{ color: '#ffffff', fontSize: 24 }} />
                  </Box>
                </Box>

                <Box sx={{ p: 2, flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                  <Typography sx={{ color: '#ffffff', fontWeight: 850, fontSize: '15px', mb: 1, lineHeight: 1.3 }}>
                    Nghe nhạc không quảng cáo
                  </Typography>
                  <Typography sx={{ color: 'rgba(255, 255, 255, 0.72)', fontSize: '12.5px', lineHeight: 1.5 }}>
                    Trải nghiệm nghe nhạc xuyên suốt, không bị làm phiền bởi quảng cáo âm thanh và hình ảnh
                  </Typography>
                </Box>
              </Card>

              {/* CARD: NGHE VÀ TẢI NHẠC LOSSLESS / CHẤT LƯỢNG CAO */}
              <Card
                sx={{
                  borderRadius: '24px',
                  background: privilegeTab === 'premium' ? 'linear-gradient(180deg, #382109 0%, #1a1003 100%)' : 'linear-gradient(180deg, #2c124d 0%, #16092b 100%)',
                  border: '1px solid',
                  borderColor: privilegeTab === 'premium' ? 'rgba(245, 158, 11, 0.35)' : 'rgba(168, 85, 247, 0.28)',
                  boxShadow: '0 12px 32px rgba(0, 0, 0, 0.45)',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  transition: 'transform 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-6px)',
                    borderColor: privilegeTab === 'premium' ? 'rgba(251, 191, 36, 0.75)' : 'rgba(192, 132, 252, 0.6)',
                    boxShadow: privilegeTab === 'premium' ? '0 20px 42px rgba(245, 158, 11, 0.35)' : '0 20px 42px rgba(124, 58, 237, 0.28)',
                  },
                }}
              >
                <Box
                  sx={{
                    width: '100%',
                    height: 230,
                    background: privilegeTab === 'premium'
                      ? 'radial-gradient(circle at 50% 35%, #451a03 0%, #291203 50%, #0c0601 100%)'
                      : 'radial-gradient(circle at 50% 35%, #164e63 0%, #082f49 50%, #030712 100%)',
                    borderRadius: '22px 22px 0 0',
                    p: 1.5,
                    position: 'relative',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                  }}
                >
                  {/* Đĩa nhạc xoay phát sáng neon */}
                  <Box
                    sx={{
                      width: 110,
                      height: 110,
                      borderRadius: '50%',
                      background: privilegeTab === 'premium'
                        ? 'radial-gradient(circle, #f59e0b 15%, #1c1102 45%, #fbbf24 90%)'
                        : 'radial-gradient(circle, #0284c7 15%, #0f172a 45%, #06b6d4 90%)',
                      boxShadow: privilegeTab === 'premium'
                        ? '0 0 28px rgba(245, 158, 11, 0.75), inset 0 0 12px rgba(0,0,0,0.85)'
                        : '0 0 26px rgba(6, 182, 212, 0.7), inset 0 0 12px rgba(0,0,0,0.85)',
                      border: privilegeTab === 'premium' ? '3px solid rgba(251, 191, 36, 0.6)' : '3px solid rgba(56, 189, 248, 0.5)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mt: 0.5,
                      animation: 'spinVinyl 20s linear infinite',
                      '@keyframes spinVinyl': {
                        '0%': { transform: 'rotate(0deg)' },
                        '100%': { transform: 'rotate(360deg)' },
                      },
                    }}
                  >
                    <Box
                      sx={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        bgcolor: privilegeTab === 'premium' ? '#1c1102' : '#0f172a',
                        border: privilegeTab === 'premium' ? '2.5px solid #fbbf24' : '2.5px solid #38bdf8',
                      }}
                    />
                  </Box>

                  {/* Khung thông báo vàng Gold */}
                  <Box
                    sx={{
                      position: 'absolute',
                      bottom: 12,
                      left: 10,
                      right: 10,
                      borderRadius: '12px',
                      bgcolor: 'rgba(54, 30, 8, 0.94)',
                      backdropFilter: 'blur(12px)',
                      border: '1px solid rgba(245, 158, 11, 0.45)',
                      p: 1.2,
                      boxShadow: '0 8px 20px rgba(0,0,0,0.5)',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.4 }}>
                      <Typography sx={{ color: '#fbbf24', fontWeight: 900, fontSize: '11px', letterSpacing: '0.3px' }}>
                        {privilegeTab === 'premium' ? 'LOSSLESS (1411 Kbps)' : 'HQ (320 Kbps)'}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: '2px', alignItems: 'flex-end', height: 12 }}>
                        <Box sx={{ width: 2, height: 8, bgcolor: '#f59e0b', borderRadius: 1 }} />
                        <Box sx={{ width: 2, height: 12, bgcolor: '#f59e0b', borderRadius: 1 }} />
                        <Box sx={{ width: 2, height: 6, bgcolor: '#f59e0b', borderRadius: 1 }} />
                        <Box sx={{ width: 2, height: 10, bgcolor: '#f59e0b', borderRadius: 1 }} />
                      </Box>
                    </Box>
                    <Typography sx={{ color: 'rgba(255,255,255,0.75)', fontSize: '9px', lineHeight: 1.2 }}>
                      Thưởng thức âm nhạc với chất lượng siêu cao.
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ p: 2, flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                  <Typography sx={{ color: '#ffffff', fontWeight: 850, fontSize: '15px', mb: 1, lineHeight: 1.3 }}>
                    {privilegeTab === 'premium' ? 'Nghe và tải nhạc Lossless' : 'Nghe và tải nhạc chất lượng cao'}
                  </Typography>
                  <Typography sx={{ color: 'rgba(255, 255, 255, 0.72)', fontSize: '12.5px', lineHeight: 1.5 }}>
                    Chất lượng âm thanh {privilegeTab === 'premium' ? 'Lossless' : 'HQ 320kbps'} giúp phát huy hết khả năng của Loa và Tai Nghe
                  </Typography>
                </Box>
              </Card>

              {/* CARD: LƯU TRỮ NHẠC KHÔNG GIỚI HẠN / NGOẠI TUYẾN */}
              <Card
                sx={{
                  borderRadius: '24px',
                  background: privilegeTab === 'premium' ? 'linear-gradient(180deg, #382109 0%, #1a1003 100%)' : 'linear-gradient(180deg, #2c124d 0%, #16092b 100%)',
                  border: '1px solid',
                  borderColor: privilegeTab === 'premium' ? 'rgba(245, 158, 11, 0.35)' : 'rgba(168, 85, 247, 0.28)',
                  boxShadow: '0 12px 32px rgba(0, 0, 0, 0.45)',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  transition: 'transform 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-6px)',
                    borderColor: privilegeTab === 'premium' ? 'rgba(251, 191, 36, 0.75)' : 'rgba(192, 132, 252, 0.6)',
                    boxShadow: privilegeTab === 'premium' ? '0 20px 42px rgba(245, 158, 11, 0.35)' : '0 20px 42px rgba(124, 58, 237, 0.28)',
                  },
                }}
              >
                <Box
                  sx={{
                    width: '100%',
                    height: 230,
                    background: 'linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%)',
                    borderRadius: '22px 22px 0 0',
                    p: 1.2,
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <Box sx={{ textAlign: 'center', mb: 1, pt: 0.5 }}>
                    <Typography sx={{ fontSize: '12px', fontWeight: 900, color: '#0f172a' }}>
                      Đã tải
                    </Typography>
                    <Typography sx={{ fontSize: '8.5px', color: '#64748b' }}>
                      Đã tải xuống hoặc có trên thiết bị
                    </Typography>
                  </Box>

                  <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5, mb: 1.2 }}>
                    {['Bài hát', 'Playlist', 'Album'].map((tab, idx) => (
                      <Box
                        key={tab}
                        sx={{
                          px: 1,
                          py: 0.2,
                          borderRadius: '99px',
                          fontSize: '8.5px',
                          fontWeight: idx === 0 ? 800 : 500,
                          bgcolor: idx === 0 ? (privilegeTab === 'premium' ? '#f59e0b' : '#7c3aed') : 'rgba(0,0,0,0.06)',
                          color: idx === 0 ? (privilegeTab === 'premium' ? '#181001' : '#fff') : '#64748b',
                        }}
                      >
                        {tab}
                      </Box>
                    ))}
                  </Box>

                  <Typography sx={{ fontSize: '10px', fontWeight: 800, color: '#334155', px: 0.5, mb: 0.8 }}>
                    Bài hát {privilegeTab === 'premium' ? '(+∞)' : '(700 MB)'}
                  </Typography>

                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      p: 0.8,
                      borderRadius: '8px',
                      bgcolor: '#ffffff',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
                      mb: 0.8,
                    }}
                  >
                    <Box
                      sx={{
                        width: 28,
                        height: 28,
                        borderRadius: '6px',
                        bgcolor: privilegeTab === 'premium' ? '#f59e0b' : '#8b5cf6',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: privilegeTab === 'premium' ? '#181001' : '#fff',
                      }}
                    >
                      <MusicNoteRounded sx={{ fontSize: 16 }} />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: '10px', fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        ngủ một mình
                      </Typography>
                      <Typography sx={{ fontSize: '8.5px', color: '#64748b' }}>
                        HIEUTHUHAI
                      </Typography>
                    </Box>
                    <CheckIcon sx={{ fontSize: 14, color: '#10b981' }} />
                  </Box>

                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      p: 0.8,
                      borderRadius: '8px',
                      bgcolor: 'rgba(255,255,255,0.7)',
                    }}
                  >
                    <Box
                      sx={{
                        width: 28,
                        height: 28,
                        borderRadius: '6px',
                        bgcolor: privilegeTab === 'premium' ? '#d97706' : '#06b6d4',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                      }}
                    >
                      <MusicNoteRounded sx={{ fontSize: 16 }} />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: '10px', fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        Waiting For You
                      </Typography>
                      <Typography sx={{ fontSize: '8.5px', color: '#64748b' }}>
                        MONO
                      </Typography>
                    </Box>
                    <CheckIcon sx={{ fontSize: 14, color: '#10b981' }} />
                  </Box>
                </Box>

                <Box sx={{ p: 2, flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                  <Typography sx={{ color: '#ffffff', fontWeight: 850, fontSize: '15px', mb: 1, lineHeight: 1.3 }}>
                    {privilegeTab === 'premium' ? 'Lưu trữ nhạc không giới hạn' : 'Lưu trữ nhạc ngoại tuyến'}
                  </Typography>
                  <Typography sx={{ color: 'rgba(255, 255, 255, 0.72)', fontSize: '12.5px', lineHeight: 1.5 }}>
                    {privilegeTab === 'premium' 
                      ? 'Không giới hạn số lượng bài hát có thể tải về thiết bị (tối đa 1 GB bộ nhớ lưu trữ)' 
                      : 'Thoải mái tải nhạc ngoại tuyến chất lượng cao lên tới 700 MB dữ liệu bài hát'}
                  </Typography>
                </Box>
              </Card>

              {/* CARD: TÍNH NĂNG NGHE NHẠC NÂNG CAO */}
              <Card
                sx={{
                  borderRadius: '24px',
                  background: privilegeTab === 'premium' ? 'linear-gradient(180deg, #382109 0%, #1a1003 100%)' : 'linear-gradient(180deg, #2c124d 0%, #16092b 100%)',
                  border: '1px solid',
                  borderColor: privilegeTab === 'premium' ? 'rgba(245, 158, 11, 0.35)' : 'rgba(168, 85, 247, 0.28)',
                  boxShadow: '0 12px 32px rgba(0, 0, 0, 0.45)',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  transition: 'transform 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-6px)',
                    borderColor: privilegeTab === 'premium' ? 'rgba(251, 191, 36, 0.75)' : 'rgba(192, 132, 252, 0.6)',
                    boxShadow: privilegeTab === 'premium' ? '0 20px 42px rgba(245, 158, 11, 0.35)' : '0 20px 42px rgba(124, 58, 237, 0.28)',
                  },
                }}
              >
                <Box
                  sx={{
                    width: '100%',
                    height: 230,
                    background: privilegeTab === 'premium'
                      ? 'linear-gradient(180deg, #78350f 0%, #291203 100%)'
                      : 'linear-gradient(180deg, #4c1d95 0%, #1e1b4b 100%)',
                    borderRadius: '22px 22px 0 0',
                    p: 1.5,
                    position: 'relative',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Box
                    sx={{
                      width: 86,
                      height: 86,
                      borderRadius: '20px',
                      background: privilegeTab === 'premium'
                        ? 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)'
                        : 'linear-gradient(135deg, #f43f5e 0%, #fb7185 100%)',
                      boxShadow: privilegeTab === 'premium' ? '0 8px 24px rgba(245, 158, 11, 0.45)' : '0 8px 24px rgba(244, 63, 94, 0.45)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                    }}
                  >
                    <MusicNoteRounded sx={{ fontSize: 38 }} />
                  </Box>

                  {/* Pill 1 */}
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 14,
                      left: 6,
                      bgcolor: 'rgba(255, 255, 255, 0.94)',
                      borderRadius: '99px',
                      px: 0.9,
                      py: 0.4,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.4,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                    }}
                  >
                    <GraphicEqRounded sx={{ fontSize: 12, color: privilegeTab === 'premium' ? '#d97706' : '#0284c7' }} />
                    <Typography sx={{ fontSize: '8px', fontWeight: 800, color: '#0f172a' }}>
                      {privilegeTab === 'premium' ? 'Chất lượng Lossless' : 'Chất lượng HQ'}
                    </Typography>
                  </Box>

                  {/* Pill 2 */}
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 18,
                      right: 6,
                      bgcolor: 'rgba(255, 255, 255, 0.94)',
                      borderRadius: '99px',
                      px: 0.9,
                      py: 0.4,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.4,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                    }}
                  >
                    <FlashIcon sx={{ fontSize: 12, color: '#f59e0b' }} />
                    <Typography sx={{ fontSize: '8px', fontWeight: 800, color: '#0f172a' }}>
                      Bỏ qua khoảng lặng
                    </Typography>
                  </Box>

                  {/* Pill 3 */}
                  <Box
                    sx={{
                      position: 'absolute',
                      bottom: 22,
                      left: 6,
                      bgcolor: 'rgba(255, 255, 255, 0.94)',
                      borderRadius: '99px',
                      px: 0.9,
                      py: 0.4,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.4,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                    }}
                  >
                    <TuneRounded sx={{ fontSize: 12, color: privilegeTab === 'premium' ? '#d97706' : '#8b5cf6' }} />
                    <Typography sx={{ fontSize: '8px', fontWeight: 800, color: '#0f172a' }}>
                      Bộ chỉnh âm EQ
                    </Typography>
                  </Box>

                  {/* Pill 4 */}
                  <Box
                    sx={{
                      position: 'absolute',
                      bottom: 18,
                      right: 6,
                      bgcolor: 'rgba(255, 255, 255, 0.94)',
                      borderRadius: '99px',
                      px: 0.9,
                      py: 0.4,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.4,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                    }}
                  >
                    <AutoAwesomeRounded sx={{ fontSize: 12, color: '#ec4899' }} />
                    <Typography sx={{ fontSize: '8px', fontWeight: 800, color: '#0f172a' }}>
                      Chuyển bài mượt mà
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ p: 2, flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                  <Typography sx={{ color: '#ffffff', fontWeight: 850, fontSize: '15px', mb: 1, lineHeight: 1.3 }}>
                    Tính năng nghe nhạc nâng cao
                  </Typography>
                  <Typography sx={{ color: 'rgba(255, 255, 255, 0.72)', fontSize: '12.5px', lineHeight: 1.5 }}>
                    Tính năng Chuyển bài mượt mà (Crossfade), Bỏ qua khoảng lặng (Gapless playback) và Trợ lý AI DJ ({privilegeTab === 'premium' ? '50 yêu cầu/ngày' : '20 yêu cầu/ngày'})
                  </Typography>
                </Box>
              </Card>

              {/* CARD: MỞ RỘNG KHẢ NĂNG UPLOAD */}
              <Card
                sx={{
                  borderRadius: '24px',
                  background: privilegeTab === 'premium' ? 'linear-gradient(180deg, #382109 0%, #1a1003 100%)' : 'linear-gradient(180deg, #2c124d 0%, #16092b 100%)',
                  border: '1px solid',
                  borderColor: privilegeTab === 'premium' ? 'rgba(245, 158, 11, 0.35)' : 'rgba(168, 85, 247, 0.28)',
                  boxShadow: '0 12px 32px rgba(0, 0, 0, 0.45)',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  transition: 'transform 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-6px)',
                    borderColor: privilegeTab === 'premium' ? 'rgba(251, 191, 36, 0.75)' : 'rgba(192, 132, 252, 0.6)',
                    boxShadow: privilegeTab === 'premium' ? '0 20px 42px rgba(245, 158, 11, 0.35)' : '0 20px 42px rgba(124, 58, 237, 0.28)',
                  },
                }}
              >
                <Box
                  sx={{
                    width: '100%',
                    height: 230,
                    background: privilegeTab === 'premium'
                      ? 'linear-gradient(180deg, #fffbeb 0%, #fef3c7 100%)'
                      : 'linear-gradient(180deg, #f5f3ff 0%, #ede9fe 100%)',
                    borderRadius: '22px 22px 0 0',
                    p: 1.2,
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 10,
                      left: 10,
                      bgcolor: '#ffffff',
                      border: '1.5px solid',
                      borderColor: privilegeTab === 'premium' ? '#f59e0b' : '#8b5cf6',
                      borderRadius: '99px',
                      px: 1,
                      py: 0.3,
                      boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.4,
                    }}
                  >
                    <CloudUploadRounded sx={{ fontSize: 12, color: privilegeTab === 'premium' ? '#d97706' : '#7c3aed' }} />
                    <Typography sx={{ fontSize: '9px', fontWeight: 900, color: privilegeTab === 'premium' ? '#b45309' : '#6d28d9' }}>
                      {privilegeTab === 'premium' ? '1 GB • 1000+' : '500 MB • 99+'}
                    </Typography>
                  </Box>

                  <Box sx={{ textAlign: 'center', mt: 4.8, mb: 1 }}>
                    <Typography sx={{ fontSize: '12px', fontWeight: 900, color: privilegeTab === 'premium' ? '#78350f' : '#1e1b4b' }}>
                      Upload
                    </Typography>
                    <Typography sx={{ fontSize: '8px', color: privilegeTab === 'premium' ? '#b45309' : '#6d28d9' }}>
                      {privilegeTab === 'premium' ? 'Tối đa 1 GB lưu trữ thư viện' : 'Tối đa 500 MB lưu trữ thư viện'}
                    </Typography>
                  </Box>

                  <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1.5 }}>
                    <Box
                      sx={{
                        bgcolor: privilegeTab === 'premium' ? '#d97706' : '#7c3aed',
                        color: '#ffffff',
                        borderRadius: '99px',
                        px: 1.6,
                        py: 0.4,
                        fontSize: '9px',
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                        boxShadow: privilegeTab === 'premium' ? '0 4px 10px rgba(217, 119, 6, 0.35)' : '0 4px 10px rgba(124, 58, 237, 0.35)',
                      }}
                    >
                      <ShuffleRounded sx={{ fontSize: 11 }} />
                      PHÁT NGẪU NHIÊN
                    </Box>
                  </Box>

                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      p: 0.8,
                      borderRadius: '8px',
                      bgcolor: '#ffffff',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                    }}
                  >
                    <Box sx={{ width: 26, height: 26, borderRadius: '6px', bgcolor: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                      <MusicNoteRounded sx={{ fontSize: 14 }} />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: '9.5px', fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        Bo Xì Bo
                      </Typography>
                      <Typography sx={{ fontSize: '8px', color: '#64748b' }}>
                        Hoàng Thùy Linh
                      </Typography>
                    </Box>
                    <CloudUploadRounded sx={{ fontSize: 13, color: privilegeTab === 'premium' ? '#d97706' : '#7c3aed' }} />
                  </Box>
                </Box>

                <Box sx={{ p: 2, flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                  <Typography sx={{ color: '#ffffff', fontWeight: 850, fontSize: '15px', mb: 1, lineHeight: 1.3 }}>
                    Mở rộng khả năng Upload
                  </Typography>
                  <Typography sx={{ color: 'rgba(255, 255, 255, 0.72)', fontSize: '12.5px', lineHeight: 1.5 }}>
                    {privilegeTab === 'premium'
                      ? 'Số lượng bài hát lên tới 1000, dung lượng file lưu trữ lên tới 1 GB đám mây'
                      : 'Số lượng bài hát lên tới 500, dung lượng file lưu trữ lên tới 500 MB đám mây'}
                  </Typography>
                </Box>
              </Card>
            </Box>
          </Box>
        </Stack>
      )}

      {/* CHECKOUT PAYMENT DIALOG (THIẾT KẾ ĐẲNG CẤP & MÀU SẮC ĐỒNG BỘ CHO TỪNG GÓI) */}
      <Dialog
        open={checkoutOpen}
        onClose={handleCloseCheckout}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '24px',
            p: 0,
            overflow: 'hidden',
            bgcolor: (selectedPlan?.price === 50000 || selectedPlan?.name?.includes('PREMIUM')) ? '#1a1003' : '#140827',
            background: (selectedPlan?.price === 50000 || selectedPlan?.name?.includes('PREMIUM'))
              ? 'linear-gradient(180deg, #2f1906 0%, #150d02 100%)'
              : 'linear-gradient(180deg, #270e44 0%, #110620 100%)',
            border: '1px solid',
            borderColor: (selectedPlan?.price === 50000 || selectedPlan?.name?.includes('PREMIUM'))
              ? 'rgba(245, 158, 11, 0.4)'
              : 'rgba(168, 85, 247, 0.4)',
            boxShadow: (selectedPlan?.price === 50000 || selectedPlan?.name?.includes('PREMIUM'))
              ? '0 24px 60px rgba(0, 0, 0, 0.8), 0 0 40px rgba(245, 158, 11, 0.2)'
              : '0 24px 60px rgba(0, 0, 0, 0.8), 0 0 40px rgba(124, 58, 237, 0.2)',
          },
        }}
      >
        {selectedPlan && (() => {
          const isSelectedPremium = selectedPlan.price === 50000 || selectedPlan.name.includes('PREMIUM');
          const modalThemeColor = isSelectedPremium ? '#f59e0b' : '#7c3aed';
          const modalThemeLight = isSelectedPremium ? '#fbbf24' : '#c084fc';
          const modalGlowColor = isSelectedPremium ? 'rgba(245, 158, 11, 0.35)' : 'rgba(124, 58, 237, 0.35)';

          return (
            <>
              {/* Header Popup với icon huy hiệu và nút đóng */}
              <Box
                sx={{
                  px: 3,
                  pt: 2.8,
                  pb: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid',
                  borderColor: 'rgba(255, 255, 255, 0.08)',
                  background: isSelectedPremium
                    ? 'linear-gradient(90deg, rgba(245, 158, 11, 0.18) 0%, rgba(0, 0, 0, 0) 100%)'
                    : 'linear-gradient(90deg, rgba(124, 58, 237, 0.18) 0%, rgba(0, 0, 0, 0) 100%)',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box
                    sx={{
                      width: 44,
                      height: 44,
                      borderRadius: '14px',
                      background: isSelectedPremium
                        ? 'linear-gradient(135deg, #fbbf24 0%, #d97706 100%)'
                        : 'linear-gradient(135deg, #a855f7 0%, #6d28d9 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: isSelectedPremium
                        ? '0 6px 16px rgba(245, 158, 11, 0.45)'
                        : '0 6px 16px rgba(124, 58, 237, 0.45)',
                      color: isSelectedPremium ? '#181001' : '#ffffff',
                    }}
                  >
                    <PremiumIcon sx={{ fontSize: 26 }} />
                  </Box>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 900, color: '#ffffff', lineHeight: 1.2 }}>
                      Xác nhận thanh toán
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.65)', fontWeight: 600 }}>
                      Nâng cấp tài khoản MusicFlow ngay lập tức
                    </Typography>
                  </Box>
                </Box>

                <IconButton
                  onClick={handleCloseCheckout}
                  disabled={processing}
                  sx={{
                    color: 'rgba(255, 255, 255, 0.65)',
                    bgcolor: 'rgba(255, 255, 255, 0.06)',
                    '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.15)', color: '#ffffff' },
                  }}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Box>

              {/* Nội dung Popup */}
              <DialogContent sx={{ p: 3, pt: 2.5 }}>
                <Stack spacing={2.5}>
                  {/* Card tóm tắt gói cước (Order Summary) */}
                  <Box
                    sx={{
                      p: 2.5,
                      borderRadius: '18px',
                      bgcolor: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid',
                      borderColor: isSelectedPremium ? 'rgba(245, 158, 11, 0.28)' : 'rgba(168, 85, 247, 0.28)',
                      backdropFilter: 'blur(12px)',
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                      <Box>
                        <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.55)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                          Gói dịch vụ đã chọn
                        </Typography>
                        <Typography variant="h5" sx={{ fontWeight: 900, color: '#ffffff', mt: 0.3 }}>
                          {selectedPlan.name}
                        </Typography>
                      </Box>
                      <Box
                        sx={{
                          px: 1.5,
                          py: 0.4,
                          borderRadius: '99px',
                          fontWeight: 900,
                          fontSize: '11px',
                          letterSpacing: '0.4px',
                          bgcolor: isSelectedPremium ? '#f59e0b' : '#7c3aed',
                          color: isSelectedPremium ? '#181001' : '#ffffff',
                          boxShadow: isSelectedPremium ? '0 2px 10px rgba(245, 158, 11, 0.45)' : '0 2px 10px rgba(124, 58, 237, 0.45)',
                        }}
                      >
                        {isSelectedPremium ? 'VIP MEMBER' : 'PHỔ BIẾN NHẤT'}
                      </Box>
                    </Box>

                    {/* Danh sách quyền lợi chính */}
                    <Stack spacing={1.1} sx={{ mb: 2, pt: 1.5, borderTop: '1px dashed rgba(255, 255, 255, 0.1)' }}>
                      {(isSelectedPremium ? [
                        'Toàn bộ kho nhạc bản quyền độc quyền VIP',
                        'Chất lượng âm thanh Lossless Studio cao cấp',
                        'Trợ lý AI DJ (50 lượt / ngày, mô hình AI thông minh nhất)',
                        'Mở rộng tải lên 1 GB bài hát cá nhân',
                      ] : [
                        'Miễn 100% quảng cáo âm thanh & Banner hiển thị',
                        'Chất lượng âm thanh Studio HQ 320kbps sắc nét',
                        'Trò chuyện & tạo Playlist AI DJ (20 lượt / ngày)',
                        'Mở rộng tải lên 500 MB bài hát cá nhân',
                      ]).map((benefit, idx) => (
                        <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                          <CheckIcon sx={{ fontSize: 16, color: modalThemeLight }} />
                          <Typography sx={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.85)', fontWeight: 500 }}>
                            {benefit}
                          </Typography>
                        </Box>
                      ))}
                    </Stack>

                    {/* Hàng thông tin thời hạn & Tổng tiền */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pt: 1.8, borderTop: '1px solid rgba(255, 255, 255, 0.12)' }}>
                      <Box>
                        <Typography sx={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.6)', fontWeight: 600 }}>
                          Thời hạn sử dụng:
                        </Typography>
                        <Typography sx={{ fontSize: '14px', color: '#ffffff', fontWeight: 800 }}>
                          {selectedPlan.durationInDays} ngày ({Math.round(selectedPlan.durationInDays / 30)} tháng)
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: 'right' }}>
                        <Typography sx={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.6)', fontWeight: 600 }}>
                          Tổng tiền thanh toán:
                        </Typography>
                        <Typography
                          variant="h5"
                          sx={{
                            fontWeight: 900,
                            color: modalThemeLight,
                            textShadow: `0 0 16px ${modalGlowColor}`,
                            letterSpacing: '-0.5px',
                          }}
                        >
                          {selectedPlan.price.toLocaleString('vi-VN')} đ
                        </Typography>
                      </Box>
                    </Box>
                  </Box>

                  {/* Chọn phương thức thanh toán */}
                  <Box>
                    <Typography sx={{ fontSize: '13.5px', fontWeight: 800, color: 'rgba(255, 255, 255, 0.9)', mb: 1.2 }}>
                      Phương thức thanh toán:
                    </Typography>

                    <Paper
                      elevation={0}
                      sx={{
                        p: 2,
                        borderRadius: '16px',
                        border: '1.5px solid',
                        borderColor: modalThemeColor,
                        bgcolor: isSelectedPremium ? 'rgba(245, 158, 11, 0.08)' : 'rgba(124, 58, 237, 0.08)',
                        boxShadow: `0 4px 18px ${modalGlowColor}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.6 }}>
                        <Radio
                          checked={paymentMethod === 'vnpay'}
                          onChange={() => setPaymentMethod('vnpay')}
                          sx={{
                            color: modalThemeColor,
                            '&.Mui-checked': { color: modalThemeColor },
                            p: 0.5,
                          }}
                        />
                        <Box
                          sx={{
                            width: 44,
                            height: 44,
                            borderRadius: '12px',
                            bgcolor: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                            flexShrink: 0,
                          }}
                        >
                          <Typography sx={{ fontWeight: 900, fontSize: '12px', color: '#005baa', letterSpacing: '-0.5px' }}>
                            VN<span style={{ color: '#ed1c24' }}>PAY</span>
                          </Typography>
                        </Box>
                        <Box>
                          <Typography sx={{ fontWeight: 850, fontSize: '14px', color: '#ffffff' }}>
                            Cổng thanh toán VNPAY Sandbox
                          </Typography>
                          <Typography sx={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.65)', lineHeight: 1.3 }}>
                            Quét mã VNPAY-QR, Thẻ ATM nội địa, Visa, Mastercard
                          </Typography>
                        </Box>
                      </Box>
                      <Box
                        sx={{
                          px: 1.2,
                          py: 0.4,
                          borderRadius: '6px',
                          bgcolor: 'rgba(34, 197, 94, 0.15)',
                          border: '1px solid rgba(34, 197, 94, 0.3)',
                          color: '#22c55e',
                          display: { xs: 'none', sm: 'flex' },
                          alignItems: 'center',
                          gap: 0.4,
                          flexShrink: 0,
                        }}
                      >
                        <SecurityRounded sx={{ fontSize: 13 }} />
                        <Typography sx={{ fontSize: '10px', fontWeight: 800 }}>
                          BẢO MẬT
                        </Typography>
                      </Box>
                    </Paper>

                    {/* Dòng ghi chú bảo mật */}
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.6, pt: 1.2 }}>
                      <SecurityRounded sx={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.5)' }} />
                      <Typography sx={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)', fontWeight: 600 }}>
                        Giao dịch được mã hóa an toàn 256-bit SSL • Kích hoạt gói dịch vụ tức thì
                      </Typography>
                    </Box>
                  </Box>
                </Stack>
              </DialogContent>

              {/* Nút hành động */}
              <DialogActions
                sx={{
                  px: 3,
                  pb: 3,
                  pt: 1.5,
                  display: 'flex',
                  justifyContent: 'space-between',
                  borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <Button
                  onClick={handleCloseCheckout}
                  disabled={processing}
                  sx={{
                    px: 3,
                    py: 1.2,
                    borderRadius: '12px',
                    fontWeight: 700,
                    textTransform: 'none',
                    color: 'rgba(255, 255, 255, 0.65)',
                    '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.08)', color: '#ffffff' },
                  }}
                >
                  Hủy bỏ
                </Button>

                <Button
                  onClick={handleCheckout}
                  disabled={processing}
                  variant="contained"
                  sx={{
                    px: 4.5,
                    py: 1.2,
                    borderRadius: '12px',
                    fontWeight: 900,
                    fontSize: '14.5px',
                    textTransform: 'none',
                    bgcolor: modalThemeColor,
                    background: isSelectedPremium
                      ? 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #d97706 100%)'
                      : 'linear-gradient(135deg, #a855f7 0%, #7c3aed 50%, #6d28d9 100%)',
                    color: isSelectedPremium ? '#181001' : '#ffffff',
                    boxShadow: isSelectedPremium
                      ? '0 6px 22px rgba(245, 158, 11, 0.45)'
                      : '0 6px 22px rgba(124, 58, 237, 0.45)',
                    transition: 'all 0.25s ease',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: isSelectedPremium
                        ? '0 8px 28px rgba(245, 158, 11, 0.6)'
                        : '0 8px 28px rgba(124, 58, 237, 0.6)',
                    },
                  }}
                >
                  {processing ? (
                    <CircularProgress size={22} sx={{ color: isSelectedPremium ? '#181001' : '#ffffff' }} />
                  ) : (
                    `Thanh toán ${selectedPlan.price.toLocaleString('vi-VN')} đ`
                  )}
                </Button>
              </DialogActions>
            </>
          );
        })()}
      </Dialog>
    </ClientLayout>
  );
}

export default ClientPremium;
