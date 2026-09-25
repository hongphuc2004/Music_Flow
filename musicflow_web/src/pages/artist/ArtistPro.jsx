import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
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
} from '@mui/icons-material';
import ArtistLayout from '../../components/Layout/artist/ArtistLayout';
import { clientPlansApi, clientSubscriptionApi } from '../../services/client/client.service';
import useAppToast from '../../components/common/useAppToast';
import { syncArtistSession } from '../../utils/artistSession';

function ArtistPro() {
  const { showToast } = useAppToast();
  const [plans, setPlans] = useState([]);
  const [proPlan, setProPlan] = useState(null);
  const [activeSub, setActiveSub] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('vnpay');
  const [submitting, setSubmitting] = useState(false);

  const isProActive = Boolean(activeSub && activeSub.status === 'active' && new Date(activeSub.endDate) > new Date());

  const fetchData = async () => {
    try {
      setLoading(true);
      // 1. Fetch plans with targetRole = 'artist'
      const plansRes = await clientPlansApi.getActive({ targetRole: 'artist' });
      if (plansRes.data?.success) {
        const artistPlans = plansRes.data.data || [];
        setPlans(artistPlans);
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
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenCheckout = () => {
    setPaymentMethod('vnpay');
    setCheckoutOpen(true);
  };

  const handleCloseCheckout = () => {
    if (submitting) return;
    setCheckoutOpen(false);
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
    <ArtistLayout title="Gói Artist Studio Pro">
      <Box sx={{ maxWidth: 1100, mx: 'auto', pb: 8 }}>
        {/* Banner Section */}
        <Paper
          elevation={0}
          sx={{
            p: { xs: 3, md: 5 },
            mb: 4,
            borderRadius: 4,
            position: 'relative',
            overflow: 'hidden',
            background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #0f172a 100%)',
            color: '#fff',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 20px 40px rgba(15, 23, 42, 0.4)',
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              top: -60,
              right: -60,
              width: 260,
              height: 260,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(245, 158, 11, 0.25) 0%, rgba(245, 158, 11, 0) 70%)',
              filter: 'blur(20px)',
              pointerEvents: 'none',
            }}
          />

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} alignItems={{ xs: 'flex-start', md: 'center' }} justifyContent="space-between">
            <Box sx={{ zIndex: 1, maxWidth: 650 }}>
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5 }}>
                <Chip
                  icon={<ProIcon sx={{ color: '#fff !important', fontSize: 18 }} />}
                  label="ARTIST STUDIO PRO"
                  sx={{
                    background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                    color: '#fff',
                    fontWeight: 800,
                    letterSpacing: '0.8px',
                    fontSize: '0.75rem',
                    boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
                  }}
                />
                {isProActive && (
                  <Chip
                    label="ĐANG HOẠT ĐỘNG"
                    size="small"
                    sx={{ bgcolor: 'rgba(34, 197, 94, 0.2)', color: '#4ade80', fontWeight: 700, border: '1px solid rgba(34, 197, 94, 0.4)' }}
                  />
                )}
              </Stack>
              <Typography variant="h4" fontWeight={900} sx={{ mb: 1.5, letterSpacing: '-0.5px' }}>
                Nâng Tầm Không Gian Sáng Tác Âm Nhạc
              </Typography>
              <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.8)', lineHeight: 1.6 }}>
                Gói đặc quyền chuyên biệt dành cho Nghệ sĩ: Tăng 5x hạn mức Trợ lý AI Studio (150 lượt/ngày), tải lên bài hát dung lượng lớn 150MB, kho lưu trữ 5GB và gắn huy hiệu PRO chuyên nghiệp.
              </Typography>
            </Box>

            <Box sx={{ zIndex: 1, minWidth: { md: 240 }, textAlign: { xs: 'left', md: 'right' } }}>
              {isProActive ? (
                <Stack spacing={1} alignItems={{ xs: 'flex-start', md: 'flex-end' }}>
                  <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                    Hạn sử dụng đến:
                  </Typography>
                  <Typography variant="h6" fontWeight={800} color="#fbbf24">
                    {new Date(activeSub.endDate).toLocaleDateString('vi-VN')}
                  </Typography>
                  <Button
                    variant="contained"
                    onClick={handleOpenCheckout}
                    sx={{
                      mt: 1,
                      background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                      fontWeight: 800,
                      borderRadius: 2.5,
                      textTransform: 'none',
                      px: 3,
                    }}
                  >
                    Gia hạn gói PRO
                  </Button>
                </Stack>
              ) : (
                <Button
                  variant="contained"
                  size="large"
                  onClick={handleOpenCheckout}
                  sx={{
                    background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                    color: '#fff',
                    fontWeight: 850,
                    fontSize: '1.05rem',
                    borderRadius: 3,
                    px: 4,
                    py: 1.6,
                    textTransform: 'none',
                    boxShadow: '0 8px 24px rgba(245, 158, 11, 0.35)',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #d97706, #dc2626)',
                    },
                  }}
                >
                  Nâng cấp ngay • 99.000 đ
                </Button>
              )}
            </Box>
          </Stack>
        </Paper>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress color="secondary" />
          </Box>
        ) : (
          <Grid container spacing={3.5}>
            {/* Plan Offer Card */}
            <Grid item xs={12} md={5}>
              <Card
                elevation={0}
                sx={{
                  p: 3.5,
                  borderRadius: 4,
                  height: '100%',
                  border: '2px solid',
                  borderColor: '#f59e0b',
                  background: (theme) =>
                    theme.palette.mode === 'dark' ? 'rgba(30, 27, 75, 0.4)' : '#fff',
                  boxShadow: '0 12px 32px rgba(245, 158, 11, 0.12)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <Box>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                    <Typography variant="h6" fontWeight={850} color="text.primary">
                      Artist Studio Pro
                    </Typography>
                    <Chip
                      label="30 NGÀY"
                      size="small"
                      sx={{ fontWeight: 800, bgcolor: 'rgba(245, 158, 11, 0.15)', color: '#d97706' }}
                    />
                  </Stack>

                  <Box sx={{ my: 2.5 }}>
                    <Typography variant="h3" fontWeight={900} color="#f59e0b" sx={{ display: 'inline' }}>
                      99.000 đ
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ display: 'inline', ml: 1 }}>
                      / 30 ngày
                    </Typography>
                  </Box>

                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    Gói tài nguyên mạnh mẽ tối ưu hóa toàn bộ quy trình sản xuất âm nhạc và quảng bá bài hát.
                  </Typography>

                  <Divider sx={{ my: 2 }} />

                  <Stack spacing={2} sx={{ mb: 4 }}>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <SparklesIcon sx={{ color: '#f59e0b', fontSize: 22 }} />
                      <Typography variant="body2" fontWeight={650}>
                        150 yêu cầu Trợ lý AI Studio / 24h
                      </Typography>
                    </Stack>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <UploadIcon sx={{ color: '#f59e0b', fontSize: 22 }} />
                      <Typography variant="body2" fontWeight={650}>
                        Tải lên tệp âm thanh tối đa 150MB / bài
                      </Typography>
                    </Stack>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <StorageIcon sx={{ color: '#f59e0b', fontSize: 22 }} />
                      <Typography variant="body2" fontWeight={650}>
                        Kho lưu trữ Studio mở rộng 5GB (5.120MB)
                      </Typography>
                    </Stack>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <ProIcon sx={{ color: '#f59e0b', fontSize: 22 }} />
                      <Typography variant="body2" fontWeight={650}>
                        Huy hiệu PRO độc quyền trên toàn hệ sinh thái
                      </Typography>
                    </Stack>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <SpeedIcon sx={{ color: '#f59e0b', fontSize: 22 }} />
                      <Typography variant="body2" fontWeight={650}>
                        Ưu tiên tài nguyên AI phản hồi tức thì
                      </Typography>
                    </Stack>
                  </Stack>
                </Box>

                <Button
                  variant="contained"
                  fullWidth
                  size="large"
                  onClick={handleOpenCheckout}
                  sx={{
                    py: 1.5,
                    borderRadius: 3,
                    fontWeight: 800,
                    textTransform: 'none',
                    background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                    boxShadow: '0 6px 18px rgba(245, 158, 11, 0.3)',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #d97706, #dc2626)',
                    },
                  }}
                >
                  {isProActive ? 'Gia hạn gói Studio Pro' : 'Nâng cấp ngay'}
                </Button>
              </Card>
            </Grid>

            {/* Feature Comparison Table */}
            <Grid item xs={12} md={7}>
              <Card
                elevation={0}
                sx={{
                  borderRadius: 4,
                  p: 3,
                  border: '1px solid',
                  borderColor: 'divider',
                  background: (theme) => theme.palette.mode === 'dark' ? 'rgba(15, 23, 42, 0.4)' : '#fff',
                }}
              >
                <Typography variant="h6" fontWeight={850} sx={{ mb: 2 }}>
                  So sánh quyền lợi gói Nghệ sĩ
                </Typography>

                <TableContainer>
                  <Table size="medium">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 800, color: 'text.secondary' }}>Tính năng</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 800, color: 'text.secondary' }}>Artist Free</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 850, color: '#f59e0b' }}>Artist Studio Pro</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600 }}>Lượt dùng Trợ lý AI Studio</TableCell>
                        <TableCell align="center">30 req / 24h</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 750, color: '#f59e0b' }}>
                          150 req / 24h
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600 }}>Dung lượng tối đa mỗi bài hát</TableCell>
                        <TableCell align="center">50 MB</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 750, color: '#f59e0b' }}>
                          150 MB
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600 }}>Tổng kho lưu trữ Studio</TableCell>
                        <TableCell align="center">500 MB</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 750, color: '#f59e0b' }}>
                          5.000 MB (5GB)
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600 }}>Huy hiệu trên Hồ sơ</TableCell>
                        <TableCell align="center">-</TableCell>
                        <TableCell align="center">
                          <Chip label="PRO" size="small" sx={{ height: 20, fontSize: '0.65rem', fontWeight: 800, bgcolor: 'linear-gradient(135deg, #f59e0b, #ef4444)', color: '#fff', background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }} />
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600 }}>Tốc độ xử lý AI Studio</TableCell>
                        <TableCell align="center">Tiêu chuẩn</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 750, color: '#f59e0b' }}>
                          Ưu tiên cao nhất
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>

                <Alert severity="info" sx={{ mt: 3, borderRadius: 3, fontSize: '0.85rem' }}>
                  <strong>Lưu ý:</strong> Huy hiệu <strong>PRO</strong> là biểu tượng đặc quyền cho tài khoản đăng ký gói thương mại Artist Studio Pro. Trạng thái xác thực <strong>Xác minh Nghệ sĩ (Verified Artist <VerifiedIcon sx={{ fontSize: 15, verticalAlign: 'text-bottom', color: '#0ea5e9' }} />)</strong> tuân theo quy trình định danh độc lập của ban quản trị MusicFlow.
                </Alert>
              </Card>
            </Grid>

            {/* Transaction History */}
            {history.length > 0 && (
              <Grid item xs={12}>
                <Card
                  elevation={0}
                  sx={{
                    borderRadius: 4,
                    p: 3,
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2.5 }}>
                    <HistoryIcon sx={{ color: 'text.secondary' }} />
                    <Typography variant="h6" fontWeight={850}>
                      Lịch sử giao dịch gói Studio
                    </Typography>
                  </Stack>

                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 700 }}>Mã giao dịch</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Gói</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Số tiền</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Phương thức</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Thời gian</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Trạng thái</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {history.map((tx) => (
                          <TableRow key={tx._id || tx.transactionRef}>
                            <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                              {tx.transactionRef}
                            </TableCell>
                            <TableCell>{tx.plan?.name || 'Studio Pro'}</TableCell>
                            <TableCell sx={{ fontWeight: 750, color: '#f59e0b' }}>
                              {(tx.amount || 0).toLocaleString('vi-VN')} đ
                            </TableCell>
                            <TableCell sx={{ textTransform: 'uppercase' }}>{tx.paymentMethod}</TableCell>
                            <TableCell>{new Date(tx.createdAt).toLocaleDateString('vi-VN')}</TableCell>
                            <TableCell>
                              <Chip
                                label={tx.status === 'success' ? 'Thành công' : tx.status === 'pending' ? 'Đang xử lý' : 'Thất bại'}
                                size="small"
                                sx={{
                                  height: 22,
                                  fontSize: '0.7rem',
                                  fontWeight: 700,
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
                </Card>
              </Grid>
            )}
          </Grid>
        )}
      </Box>

      {/* Checkout Modal */}
      <Dialog
        open={checkoutOpen}
        onClose={handleCloseCheckout}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 4,
            p: 1.5,
          },
        }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" fontWeight={850}>
            Thanh toán Artist Studio Pro
          </Typography>
          <IconButton onClick={handleCloseCheckout} size="small" disabled={submitting}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers sx={{ py: 2.5 }}>
          <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 3, mb: 3 }}>
            <Typography variant="body2" color="text.secondary">
              Gói dịch vụ:
            </Typography>
            <Typography variant="subtitle1" fontWeight={800}>
              Artist Studio Pro (30 ngày)
            </Typography>
            <Typography variant="h5" fontWeight={900} color="#f59e0b" sx={{ mt: 1 }}>
              99.000 đ
            </Typography>
          </Box>

          <Typography variant="subtitle2" fontWeight={750} sx={{ mb: 1.5 }}>
            Chọn phương thức thanh toán:
          </Typography>

          <RadioGroup value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            <Paper
              elevation={0}
              sx={{
                p: 1.5,
                mb: 1.5,
                borderRadius: 2.5,
                border: '1.5px solid',
                borderColor: paymentMethod === 'vnpay' ? '#f59e0b' : 'divider',
              }}
            >
              <FormControlLabel
                value="vnpay"
                control={<Radio color="warning" />}
                label={
                  <Box>
                    <Typography variant="body2" fontWeight={750}>
                      Cổng thanh toán VNPay (ATM / QR / Visa)
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Thanh toán an toàn qua cổng VNPay Sandbox
                    </Typography>
                  </Box>
                }
                sx={{ width: '100%', m: 0 }}
              />
            </Paper>

            <Paper
              elevation={0}
              sx={{
                p: 1.5,
                borderRadius: 2.5,
                border: '1.5px solid',
                borderColor: paymentMethod === 'mock' ? '#f59e0b' : 'divider',
              }}
            >
              <FormControlLabel
                value="mock"
                control={<Radio color="warning" />}
                label={
                  <Box>
                    <Typography variant="body2" fontWeight={750}>
                      Giả lập thanh toán (Mock Demo)
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Thử nghiệm kích hoạt nhanh tức thì không cần thẻ
                    </Typography>
                  </Box>
                }
                sx={{ width: '100%', m: 0 }}
              />
            </Paper>
          </RadioGroup>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={handleCloseCheckout} disabled={submitting} sx={{ fontWeight: 600 }}>
            Hủy
          </Button>
          <Button
            variant="contained"
            onClick={handleCheckout}
            disabled={submitting}
            sx={{
              background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
              fontWeight: 800,
              borderRadius: 2.5,
              px: 3,
              textTransform: 'none',
            }}
          >
            {submitting ? <CircularProgress size={22} color="inherit" /> : 'Xác nhận thanh toán'}
          </Button>
        </DialogActions>
      </Dialog>
    </ArtistLayout>
  );
}

export default ArtistPro;
