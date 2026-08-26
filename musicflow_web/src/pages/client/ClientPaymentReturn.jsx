import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import {
  CheckCircleOutlineRounded as SuccessIcon,
  ErrorOutlineRounded as ErrorIcon,
} from '@mui/icons-material';
import ClientLayout from '../../components/Layout/client/ClientLayout';
import { clientSubscriptionApi } from '../../services/client/client.service';
import useAppToast from '../../components/common/useAppToast';

function ClientPaymentReturn() {
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useAppToast();

  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState('');
  const [transaction, setTransaction] = useState(null);

  useEffect(() => {
    const verifyPayment = async () => {
      try {
        setLoading(true);
        // Lấy tất cả query parameters từ URL gửi từ VNPay
        const params = {};
        const searchParams = new URLSearchParams(location.search);
        for (const [key, value] of searchParams.entries()) {
          params[key] = value;
        }

        // Gọi API Backend để xác thực chữ ký bảo mật và số tiền (Source of Truth)
        const response = await clientSubscriptionApi.vnpayReturn(params);

        if (response.data?.success) {
          setSuccess(true);
          setMessage('Tài khoản của bạn đã được nâng cấp lên gói Premium thành công!');
          setTransaction(response.data.data?.transaction);
          showToast({
            severity: 'success',
            title: 'Thanh toán thành công',
            message: 'Chúc mừng bạn đã nâng cấp Premium thành công!',
          });
        } else {
          setSuccess(false);
          setMessage(response.data?.message || 'Giao dịch thanh toán không thành công hoặc đã bị hủy.');
        }
      } catch (err) {
        console.error('Verify payment error:', err);
        setSuccess(false);
        setMessage(err.response?.data?.message || 'Lỗi xác minh giao dịch từ máy chủ.');
      } finally {
        setLoading(false);
      }
    };

    verifyPayment();
  }, [location.search]);

  return (
    <ClientLayout title="Kết quả thanh toán">
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <Paper
          elevation={0}
          sx={{
            p: 5,
            width: '100%',
            maxWidth: 500,
            borderRadius: 5,
            border: '1px solid',
            borderColor: () => success 
              ? 'rgba(34, 197, 94, 0.2)' 
              : 'rgba(239, 68, 68, 0.2)',

            background: (theme) => theme.palette.mode === 'dark'
              ? success 
                ? 'linear-gradient(135deg, rgba(17, 24, 39, 0.9) 0%, rgba(34, 197, 94, 0.05) 100%)'
                : 'linear-gradient(135deg, rgba(17, 24, 39, 0.9) 0%, rgba(239, 68, 68, 0.05) 100%)'
              : '#ffffff',
            textAlign: 'center',
            boxShadow: success
              ? '0 10px 40px rgba(34, 197, 94, 0.08)'
              : '0 10px 40px rgba(239, 68, 68, 0.08)',
          }}
        >
          {loading ? (
            <Stack spacing={3} alignItems="center" sx={{ py: 6 }}>
              <CircularProgress size={44} color="secondary" />
              <Typography variant="body1" fontWeight={600} color="text.secondary">
                Đang xác thực thông tin giao dịch an toàn...
              </Typography>
            </Stack>
          ) : (
            <Stack spacing={4} alignItems="center">
              {success ? (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 72,
                    height: 72,
                    borderRadius: '50%',
                    bgcolor: 'rgba(34, 197, 94, 0.1)',
                  }}
                >
                  <SuccessIcon sx={{ color: '#22c55e', fontSize: 48 }} />
                </Box>
              ) : (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 72,
                    height: 72,
                    borderRadius: '50%',
                    bgcolor: 'rgba(239, 68, 68, 0.1)',
                  }}
                >
                  <ErrorIcon sx={{ color: '#ef4444', fontSize: 48 }} />
                </Box>
              )}

              <Stack spacing={1}>
                <Typography variant="h5" fontWeight={900}>
                  {success ? 'Thanh toán thành công!' : 'Thanh toán không thành công'}
                </Typography>
                <Typography variant="body2" color="text.secondary" fontWeight={500} sx={{ px: 2 }}>
                  {message}
                </Typography>
              </Stack>

              {success && transaction && (
                <Box 
                  sx={{ 
                    w: '100%', 
                    width: '100%',
                    p: 2.5, 
                    bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(31, 41, 55, 0.5)' : 'action.hover', 
                    borderRadius: 4,
                    textAlign: 'left'
                  }}
                >
                  <Stack spacing={1}>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="caption" color="text.secondary" fontWeight={600}>Mã giao dịch:</Typography>
                      <Typography variant="body2" fontWeight={750}>{transaction.transactionRef}</Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="caption" color="text.secondary" fontWeight={600}>Gói đăng ký:</Typography>
                      <Typography variant="body2" fontWeight={750}>{transaction.plan?.name || 'Premium'}</Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="caption" color="text.secondary" fontWeight={600}>Số tiền thanh toán:</Typography>
                      <Typography variant="body2" fontWeight={850} color="#6c63ff">{(transaction.amount || 0).toLocaleString('vi-VN')} đ</Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="caption" color="text.secondary" fontWeight={600}>Phương thức:</Typography>
                      <Typography variant="body2" fontWeight={750}>VNPay Sandbox</Typography>
                    </Stack>
                  </Stack>
                </Box>
              )}

              <Stack direction="row" spacing={2} sx={{ width: '100%' }}>
                <Button
                  variant="outlined"
                  fullWidth
                  onClick={() => navigate('/client/home')}
                  sx={{ py: 1.2, borderRadius: 3, fontWeight: 700, textTransform: 'none', borderColor: 'divider', color: 'text.secondary' }}
                >
                  Về Trang chủ
                </Button>
                <Button
                  variant="contained"
                  fullWidth
                  onClick={() => navigate('/client/profile')}
                  sx={{
                    py: 1.2,
                    borderRadius: 3,
                    fontWeight: 800,
                    textTransform: 'none',
                    bgcolor: success ? '#22c55e' : '#6c63ff',
                    backgroundImage: success 
                      ? 'linear-gradient(135deg, #22c55e, #10b981)'
                      : 'linear-gradient(135deg, #6c63ff, #00bcd4)',
                    boxShadow: success
                      ? '0 4px 14px rgba(34, 197, 94, 0.2)'
                      : '0 4px 14px rgba(108, 99, 255, 0.2)',
                  }}
                >
                  Xem Profile
                </Button>
              </Stack>
            </Stack>
          )}
        </Paper>
      </Box>
    </ClientLayout>
  );
}

export default ClientPaymentReturn;
