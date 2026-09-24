import React, { useState } from 'react';
import {
  Paper,
  Box,
  Typography,
  TextField,
  Button,
  Stack,
  Alert,
  IconButton,
  InputAdornment,
  CircularProgress,
  Chip,
} from '@mui/material';
import {
  LockResetRounded as LockResetIcon,
  LockOutlined,
  Visibility,
  VisibilityOff,
  Google as GoogleIcon,
  ShieldRounded as ShieldIcon,
  CheckCircleRounded as CheckIcon,
} from '@mui/icons-material';
import { changePassword } from '../../services/api';
import useAppToast from '../common/useAppToast';

export default function ChangePasswordCard({ hasPassword = true, role = 'user' }) {
  const { showToast } = useAppToast();

  const [form, setForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    if (error) setError('');
    if (success) setSuccess('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!form.currentPassword || !form.newPassword || !form.confirmPassword) {
      setError('Vui lòng nhập đầy đủ các trường mật khẩu.');
      return;
    }

    if (form.newPassword.length < 6) {
      setError('Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      setError('Xác nhận mật khẩu mới không khớp.');
      return;
    }

    if (form.newPassword === form.currentPassword) {
      setError('Mật khẩu mới không được trùng với mật khẩu hiện tại.');
      return;
    }

    setLoading(true);
    try {
      const res = await changePassword({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
        confirmPassword: form.confirmPassword,
      });

      setSuccess(res.message || 'Đổi mật khẩu thành công! Các phiên đăng nhập cũ đã được thu hồi.');
      showToast({
        severity: 'success',
        message: 'Đổi mật khẩu thành công!',
      });

      setForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (err) {
      const msg = err.response?.data?.message || 'Đổi mật khẩu thất bại. Vui lòng kiểm tra lại mật khẩu cũ.';
      setError(msg);
      showToast({
        severity: 'error',
        message: msg,
      });
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    '& .MuiOutlinedInput-root': {
      borderRadius: '12px',
      backgroundColor: (theme) =>
        theme.palette.mode === 'dark' ? 'rgba(15, 23, 42, 0.6)' : '#f8fafc',
      color: 'inherit',
      '&:hover': {
        borderColor: '#6c63ff',
      },
      '&.Mui-focused': {
        borderColor: '#00bcd4',
        boxShadow: '0 0 0 2px rgba(0, 188, 212, 0.2)',
      },
    },
  };

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 3, sm: 3.5 },
        borderRadius: '24px',
        bgcolor: (theme) =>
          theme.palette.mode === 'dark' ? 'rgba(16, 22, 40, 0.55)' : '#ffffff',
        border: '1px solid',
        borderColor: (theme) =>
          theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
        backdropFilter: 'blur(16px)',
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: '12px',
            bgcolor: 'rgba(108, 99, 255, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#6c63ff',
          }}
        >
          <LockResetIcon sx={{ fontSize: 22 }} />
        </Box>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 800, fontSize: '1.1rem' }}>
            Bảo Mật &amp; Đổi Mật Khẩu
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Quản lý mật khẩu đăng nhập của bạn trên hệ sinh thái MusicFlow
          </Typography>
        </Box>
      </Stack>

      {!hasPassword ? (
        <Box
          sx={{
            p: 2.5,
            borderRadius: '16px',
            bgcolor: 'rgba(219, 68, 55, 0.06)',
            border: '1px solid rgba(219, 68, 55, 0.2)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 2,
            mt: 1,
          }}
        >
          <GoogleIcon sx={{ color: '#db4437', fontSize: 28, mt: 0.2 }} />
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#db4437', mb: 0.5 }}>
              Tài Khoản Liên Kết Google
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem', lineHeight: 1.6 }}>
              Tài khoản của bạn được đăng ký và xác thực thông qua Google Sign-In. Bạn không sử dụng mật khẩu cục bộ và không cần thay đổi mật khẩu tại đây.
            </Typography>
          </Box>
        </Box>
      ) : (
        <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2.5, borderRadius: '12px' }} onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          {success && (
            <Alert severity="success" sx={{ mb: 2.5, borderRadius: '12px' }} onClose={() => setSuccess('')}>
              {success}
            </Alert>
          )}

          <Stack spacing={2.2}>
            <TextField
              fullWidth
              size="small"
              label="Mật khẩu hiện tại"
              type={showCurrent ? 'text' : 'password'}
              value={form.currentPassword}
              onChange={handleChange('currentPassword')}
              disabled={loading}
              required
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockOutlined sx={{ fontSize: 20, color: '#64748b' }} />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowCurrent((p) => !p)} edge="end" size="small">
                      {showCurrent ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={inputStyle}
            />

            <TextField
              fullWidth
              size="small"
              label="Mật khẩu mới"
              type={showNew ? 'text' : 'password'}
              value={form.newPassword}
              onChange={handleChange('newPassword')}
              disabled={loading}
              placeholder="Tối thiểu 6 ký tự"
              required
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <ShieldIcon sx={{ fontSize: 20, color: '#64748b' }} />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowNew((p) => !p)} edge="end" size="small">
                      {showNew ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={inputStyle}
            />

            <TextField
              fullWidth
              size="small"
              label="Xác nhận mật khẩu mới"
              type={showConfirm ? 'text' : 'password'}
              value={form.confirmPassword}
              onChange={handleChange('confirmPassword')}
              disabled={loading}
              required
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <CheckIcon sx={{ fontSize: 20, color: '#64748b' }} />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowConfirm((p) => !p)} edge="end" size="small">
                      {showConfirm ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={inputStyle}
            />

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', pt: 0.5 }}>
              <Button
                type="submit"
                variant="contained"
                disabled={loading}
                sx={{
                  px: 3,
                  py: 1,
                  borderRadius: '12px',
                  fontWeight: 700,
                  textTransform: 'none',
                  fontSize: '0.9rem',
                  background:
                    role === 'artist'
                      ? 'linear-gradient(135deg, #00bcd4 0%, #6c63ff 100%)'
                      : 'linear-gradient(135deg, #6c63ff 0%, #00bcd4 100%)',
                  boxShadow: '0 4px 15px rgba(108, 99, 255, 0.25)',
                  '&:hover': {
                    background:
                      role === 'artist'
                        ? 'linear-gradient(135deg, #00acc1 0%, #5b52e5 100%)'
                        : 'linear-gradient(135deg, #5b52e5 0%, #00acc1 100%)',
                  },
                }}
              >
                {loading ? <CircularProgress size={20} color="inherit" /> : 'Cập nhật mật khẩu'}
              </Button>
            </Box>
          </Stack>
        </Box>
      )}
    </Paper>
  );
}
