import { useEffect, useState } from 'react';
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  WorkspacePremiumRounded as PremiumIcon,
  CheckCircleOutlineRounded as CheckIcon,
  FlashOnRounded as FlashIcon,
  AccountBalanceWalletRounded as WalletIcon,
} from '@mui/icons-material';
import ClientLayout from '../../components/Layout/client/ClientLayout';
import { clientPlansApi, clientSubscriptionApi } from '../../services/client/client.service';
import useAppToast from '../../components/common/useAppToast';
import { useNavigate } from 'react-router-dom';

function ClientPremium() {
  const { showToast } = useAppToast();
  const navigate = useNavigate();

  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Trạng thái Premium hiện tại của user
  const [currentSub, setCurrentSub] = useState(null);
  const [isPremiumUser, setIsPremiumUser] = useState(false);
  const [expiryDate, setExpiryDate] = useState('');

  // Trạng thái Checkout Modal
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('mock'); // 'mock' hoặc 'vnpay'
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const loadPremiumInfo = async () => {
      try {
        setLoading(true);
        setError('');
        
        // 1. Tải danh sách gói cước hoạt động từ DB
        const plansRes = await clientPlansApi.getActive();
        setPlans(plansRes.data?.data || []);

        // 2. Tải thông tin cước hiện tại của user
        const subRes = await clientSubscriptionApi.getCurrent();
        const activeSub = subRes.data?.data?.activeSubscription;
        setCurrentSub(activeSub);

        if (activeSub) {
          setIsPremiumUser(true);
          if (activeSub.endDate) {
            setExpiryDate(new Date(activeSub.endDate).toLocaleDateString('vi-VN'));
          }
        }
      } catch (err) {
        console.error('Failed to load premium info:', err);
        setError('Không thể kết nối máy chủ để tải thông tin Premium.');
      } finally {
        setLoading(false);
      }
    };

    loadPremiumInfo();
  }, []);

  const handleOpenCheckout = (plan) => {
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
    if (plan.price === 19000 || plan.name.includes("GO")) return { title: 'GO', badge: '' };
    if (plan.price === 49000 || plan.name.includes("PLUS")) return { title: 'PLUS', badge: 'PHỔ BIẾN NHẤT' };
    if (plan.price === 89000 || plan.name.includes("PREMIUM")) return { title: 'PREMIUM', badge: 'VIP' };
    return { title: plan.name, badge: '' };
  };

  // Trích lọc các đặc quyền riêng biệt để giảm lặp text giữa các Pricing Card
  const getConciseBenefits = (plan) => {
    if (plan.price === 19000 || plan.name.includes("GO")) {
      return [
        'Hạn mức tải lên tối đa 250 MB',
        'Tải nhạc ngoại tuyến tối đa 300 MB',
        'Trò chuyện AI DJ tối đa 10 lần / ngày',
      ];
    }
    if (plan.price === 49000 || plan.name.includes("PLUS")) {
      return [
        'Hạn mức tải lên tối đa 500 MB',
        'Tải nhạc ngoại tuyến tối đa 700 MB',
        'Trò chuyện AI DJ tối đa 15 lần / ngày',
      ];
    }
    if (plan.price === 89000 || plan.name.includes("PREMIUM")) {
      return [
        'Hạn mức tải lên tối đa 1 GB',
        'Tải nhạc ngoại tuyến tối đa 1 GB',
        'Trò chuyện AI DJ tối đa 20 lần / ngày',
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
              borderRadius: 4.5,
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
                const isCurrentPlan = currentSub && currentSub.plan && currentSub.plan._id === plan._id;
                const { title: displayTitle, badge: highlightBadge } = getMappedPlanLabel(plan);
                const planBenefits = getConciseBenefits(plan);

                // CSS styles for highlighted cards (Plus and Premium)
                const isHighlighted = highlightBadge !== '';
                const isPopular = plan.price === 49000 || plan.name.includes("PLUS");
                
                return (
                  <Grid size={{ xs: 12, sm: 6, md: 4 }} key={plan._id} sx={{ display: 'flex' }}>
                    <Card
                      elevation={0}
                      sx={{
                        width: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        borderRadius: '24px',
                        border: '2px solid',
                        borderColor: isCurrentPlan
                          ? '#22c55e'
                          : isHighlighted
                            ? isPopular ? '#6c63ff' : '#00bcd4'
                            : (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                        background: (theme) => theme.palette.mode === 'dark' ? '#111827' : '#ffffff',
                        transition: 'all 0.3s ease-in-out',
                        position: 'relative',
                        overflow: 'hidden',
                        '&:hover': {
                          transform: 'translateY(-6px)',
                          boxShadow: isCurrentPlan 
                            ? '0 12px 30px rgba(34, 197, 94, 0.15)'
                            : isHighlighted
                              ? isPopular ? '0 12px 30px rgba(108, 99, 255, 0.15)' : '0 12px 30px rgba(0, 188, 212, 0.15)'
                              : '0 12px 30px rgba(0, 0, 0, 0.08)',
                          borderColor: isCurrentPlan 
                            ? '#22c55e' 
                            : isHighlighted
                              ? isPopular ? '#6c63ff' : '#00bcd4'
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
                            bgcolor: isPopular ? '#6c63ff' : '#00bcd4',
                            backgroundImage: isPopular
                              ? 'linear-gradient(135deg, #6c63ff, #7c3aed)'
                              : 'linear-gradient(135deg, #00bcd4, #14b8a6)',
                            color: '#fff',
                            px: 1.5,
                            py: 0.4,
                            borderRadius: '10px',
                            zIndex: 2,
                            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
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
                            borderRadius: '10px',
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
                            <Typography variant="h4" fontWeight={900} color={isCurrentPlan ? '#22c55e' : '#6c63ff'} sx={{ letterSpacing: '-0.5px' }}>
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
                              <CheckIcon sx={{ color: isCurrentPlan ? '#22c55e' : '#6c63ff', fontSize: 18 }} />
                              <Typography variant="body2" color="text.secondary" fontWeight={600}>
                                {desc}
                              </Typography>
                            </Stack>
                          ))}
                        </Stack>

                        <Button
                          variant={isCurrentPlan ? 'outlined' : 'contained'}
                          color={isCurrentPlan ? 'success' : 'primary'}
                          fullWidth
                          onClick={() => handleOpenCheckout(plan)}
                          sx={{
                            py: 1.5,
                            borderRadius: 3.5,
                            fontWeight: 800,
                            textTransform: 'none',
                            fontSize: '14.5px',
                            ...(isCurrentPlan ? {
                              borderWidth: 2,
                              color: '#22c55e',
                              borderColor: '#22c55e',
                              '&:hover': { borderWidth: 2, borderColor: '#16a34a', bgcolor: 'rgba(34, 197, 94, 0.04)' }
                            } : {
                              bgcolor: '#6c63ff',
                              backgroundImage: isPopular 
                                ? 'linear-gradient(135deg, #6c63ff, #7c3aed)' 
                                : isHighlighted 
                                  ? 'linear-gradient(135deg, #00bcd4, #14b8a6)'
                                  : 'linear-gradient(135deg, #6c63ff, #00bcd4)',
                              '&:hover': {
                                opacity: 0.95,
                              },
                            })
                          }}
                        >
                          {isCurrentPlan 
                            ? 'Gói hiện tại của bạn' 
                            : isPremiumUser 
                              ? 'Gia hạn Premium' 
                              : (plan.price === 19000 || plan.name.includes("GO"))
                                ? 'Nâng cấp GO' 
                                : (plan.price === 49000 || plan.name.includes("PLUS"))
                                  ? 'Nâng cấp PLUS' 
                                  : 'Nâng cấp PREMIUM'}
                        </Button>
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          </Box>

          {/* 3. SO SÁNH QUYỀN LỢI CHI TIẾT (Bảng so sánh Free vs Premium dễ nhìn) */}
          <Paper
            elevation={0}
            sx={{
              p: 4,
              borderRadius: 5,
              border: '1px solid',
              borderColor: 'divider',
              background: (theme) => theme.palette.mode === 'dark' ? 'rgba(30, 41, 59, 0.4)' : '#f8fafc',
            }}
          >
            <Typography variant="h6" fontWeight={900} sx={{ mb: 3, letterSpacing: '-0.5px' }}>
              So sánh chi tiết tính năng & hạn mức
            </Typography>
            
            <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 4, overflowX: 'auto', width: '100%' }}>
              <Table sx={{ width: '100%', minWidth: 680, tableLayout: 'fixed' }}>
                <TableHead sx={{ bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 850, fontSize: '14.5px', width: '34%', pl: { xs: 3, md: 30 }, py: 2.2 }}>Tính năng & Hạn mức</TableCell>
                    <TableCell sx={{ fontWeight: 850, fontSize: '14.5px', width: '16.5%', py: 2.2 }} align="center">Tài khoản FREE</TableCell>
                    <TableCell sx={{ fontWeight: 850, fontSize: '14.5px', color: '#6c63ff', width: '16.5%', py: 2.2 }} align="center">Gói GO</TableCell>
                    <TableCell sx={{ fontWeight: 850, fontSize: '14.5px', color: '#6c63ff', width: '16.5%', py: 2.2 }} align="center">Gói PLUS</TableCell>
                    <TableCell sx={{ fontWeight: 850, fontSize: '14.5px', color: '#00bcd4', width: '16.5%', py: 2.2 }} align="center">Gói PREMIUM</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {/* Chi phí */}
                  <TableRow hover>
                    <TableCell sx={{ fontWeight: 750, pl: { xs: 3, md: 33 }, py: 2 }}>Chi phí / tháng</TableCell>
                    <TableCell align="center" sx={{ color: 'text.secondary', fontWeight: 600, py: 2 }}>Miễn phí</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800, color: '#6c63ff', py: 2 }}>19.000 đ</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800, color: '#6c63ff', py: 2 }}>49.000 đ</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800, color: '#00bcd4', py: 2 }}>89.000 đ</TableCell>
                  </TableRow>
                  
                  {/* Tải lên */}
                  <TableRow hover>
                    <TableCell sx={{ fontWeight: 750, pl: { xs: 3, md: 28 }, py: 2 }}>Dung lượng tải lên (Upload)</TableCell>
                    <TableCell align="center" sx={{ color: 'text.secondary', fontWeight: 600, py: 2 }}>Tối đa 100 MB</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 750, py: 2 }}>Tối đa 250 MB</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 750, py: 2 }}>Tối đa 500 MB</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800, color: '#00bcd4', py: 2 }}>Tối đa 1 GB</TableCell>
                  </TableRow>
                  
                  {/* Tải xuống */}
                  <TableRow hover>
                    <TableCell sx={{ fontWeight: 750, pl: { xs: 3, md: 26 }, py: 2 }}>Tải nhạc ngoại tuyến (Download)</TableCell>
                    <TableCell align="center" sx={{ color: 'text.secondary', fontWeight: 600, py: 2 }}>Tối đa 100 MB</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 750, py: 2 }}>Tối đa 300 MB</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 750, py: 2 }}>Tối đa 700 MB</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800, color: '#00bcd4', py: 2 }}>Tối đa 1 GB</TableCell>
                  </TableRow>
                  
                  {/* Trợ lý AI */}
                  <TableRow hover>
                    <TableCell sx={{ fontWeight: 750, pl: { xs: 3, md: 27 }, py: 2 }}>Trò chuyện & Tạo Playlist AI</TableCell>
                    <TableCell align="center" sx={{ color: 'text.secondary', fontWeight: 600, py: 2 }}>5 yêu cầu / 24 giờ</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 750, py: 2 }}>10 yêu cầu / 24 giờ</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 750, py: 2 }}>15 yêu cầu / 24 giờ</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800, color: '#00bcd4', py: 2 }}>20 yêu cầu / 24 giờ</TableCell>
                  </TableRow>
                  
                  {/* Chất lượng âm thanh */}
                  <TableRow hover>
                    <TableCell sx={{ fontWeight: 750, pl: { xs: 3, md: 31 }, py: 2 }}>Chất lượng âm thanh</TableCell>
                    <TableCell align="center" sx={{ color: 'text.secondary', fontWeight: 600, py: 2 }}>Tiêu chuẩn (128kbps)</TableCell>
                    <TableCell align="center" sx={{ color: 'text.disabled', fontStyle: 'italic', fontWeight: 600, py: 2 }}>HQ (320kbps - Sắp có)</TableCell>
                    <TableCell align="center" sx={{ color: 'text.disabled', fontStyle: 'italic', fontWeight: 600, py: 2 }}>HQ (320kbps - Sắp có)</TableCell>
                    <TableCell align="center" sx={{ color: 'text.disabled', fontStyle: 'italic', fontWeight: 600, py: 2 }}>HQ (320kbps - Sắp có)</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Stack>
      )}

      {/* CHECKOUT PAYMENT DIALOG */}
      <Dialog
        open={checkoutOpen}
        onClose={handleCloseCheckout}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 5, p: 1.5 },
        }}
      >
        <DialogTitle sx={{ fontWeight: 850, pb: 1 }}>
          Xác nhận thanh toán
        </DialogTitle>
        <DialogContent>
          {selectedPlan && (
            <Stack spacing={2.5}>
              <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 3.5 }}>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                  Gói đăng ký lựa chọn
                </Typography>
                <Typography variant="subtitle1" fontWeight={800}>
                  {selectedPlan.name}
                </Typography>
                <Stack direction="row" justifyContent="space-between" sx={{ mt: 1 }}>
                  <Typography variant="body2" color="text.secondary" fontWeight={600}>
                    Hạn sử dụng:
                  </Typography>
                  <Typography variant="body2" fontWeight={800}>
                    {selectedPlan.durationInDays} ngày
                  </Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.5 }}>
                  <Typography variant="body2" color="text.secondary" fontWeight={600}>
                    Tổng số tiền:
                  </Typography>
                  <Typography variant="body2" fontWeight={900} color="#6c63ff">
                    {selectedPlan.price.toLocaleString('vi-VN')} đ
                  </Typography>
                </Stack>
              </Box>

              <Typography variant="subtitle2" fontWeight={800}>
                Chọn phương thức thanh toán:
              </Typography>

              <RadioGroup
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                <Stack spacing={1.5}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 1.5,
                      borderRadius: 3.5,
                      border: '1px solid',
                      borderColor: paymentMethod === 'mock' ? '#6c63ff' : 'divider',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <FormControlLabel
                      value="mock"
                      control={<Radio size="small" color="secondary" />}
                      label={
                        <Stack direction="row" spacing={1} alignItems="center">
                          <FlashIcon sx={{ color: '#eab308' }} />
                          <Box>
                            <Typography variant="body2" fontWeight={750}>
                              Thử nghiệm (Mock Payment)
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                              Kích hoạt Premium ngay lập tức để thử nghiệm.
                            </Typography>
                          </Box>
                        </Stack>
                      }
                      sx={{ width: '100%', m: 0 }}
                    />
                  </Paper>

                  <Paper
                    elevation={0}
                    sx={{
                      p: 1.5,
                      borderRadius: 3.5,
                      border: '1px solid',
                      borderColor: paymentMethod === 'vnpay' ? '#6c63ff' : 'divider',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <FormControlLabel
                      value="vnpay"
                      control={<Radio size="small" color="secondary" />}
                      label={
                        <Stack direction="row" spacing={1} alignItems="center">
                          <WalletIcon sx={{ color: '#00bcd4' }} />
                          <Box>
                            <Typography variant="body2" fontWeight={750}>
                              Cổng thanh toán VNPay Sandbox
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                              Thanh toán qua ví VNPay Sandbox / Thẻ ngân hàng test.
                            </Typography>
                          </Box>
                        </Stack>
                      }
                      sx={{ width: '100%', m: 0 }}
                    />
                  </Paper>
                </Stack>
              </RadioGroup>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button 
            onClick={handleCloseCheckout} 
            disabled={processing}
            sx={{ borderRadius: 3, fontWeight: 700, textTransform: 'none', color: 'text.secondary' }}
          >
            Hủy bỏ
          </Button>
          <Button
            onClick={handleCheckout}
            disabled={processing}
            variant="contained"
            sx={{
              px: 3,
              borderRadius: 3,
              fontWeight: 800,
              textTransform: 'none',
              bgcolor: '#6c63ff',
              backgroundImage: 'linear-gradient(135deg, #6c63ff, #00bcd4)',
            }}
          >
            {processing ? <CircularProgress size={20} color="inherit" /> : 'Xác nhận'}
          </Button>
        </DialogActions>
      </Dialog>
    </ClientLayout>
  );
}

export default ClientPremium;
