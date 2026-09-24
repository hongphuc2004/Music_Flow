import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  TextField,
  Button,
  IconButton,
  Stack,
  Alert,
  CircularProgress,
  InputAdornment,
} from '@mui/material';
import {
  CloseRounded as CloseIcon,
  EmailOutlined,
  LockOutlined,
  Visibility,
  VisibilityOff,
  CheckCircleOutlineRounded as SuccessIcon,
  ArrowBackRounded as BackIcon,
  KeyRounded as KeyIcon,
} from '@mui/icons-material';
import { forgotPassword, verifyOtp, resetPassword } from '../../services/api';
import FloatingTextField from '../common/FloatingTextField';

export default function ForgotPasswordDialog({
  open,
  onClose,
  role = 'user',
  initialEmail = '',
  onSuccess,
}) {
  const [step, setStep] = useState(1); // 1: Email, 2: OTP, 3: New Password, 4: Done
  const [email, setEmail] = useState('');
  const [otpValues, setOtpValues] = useState(['', '', '', '', '', '']);
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [cooldown, setCooldown] = useState(0);

  const otpInputsRef = useRef([]);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setStep(1);
      setEmail(initialEmail || '');
      setOtpValues(['', '', '', '', '', '']);
      setResetToken('');
      setNewPassword('');
      setConfirmPassword('');
      setError('');
      setInfoMessage('');
      setLoading(false);
    }
  }, [open, initialEmail]);

  // Handle 60s cooldown timer
  useEffect(() => {
    let timer = null;
    if (cooldown > 0) {
      timer = setInterval(() => {
        setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [cooldown]);

  // STEP 1: Submit Email
  const handleSendEmail = async (e) => {
    if (e) e.preventDefault();
    setError('');
    setInfoMessage('');

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError('Vui lòng nhập địa chỉ email.');
      return;
    }

    setLoading(true);
    try {
      const res = await forgotPassword(cleanEmail, role);
      setInfoMessage(
        res.message ||
          'Nếu email của bạn tồn tại trên hệ thống và đủ điều kiện, bạn sẽ nhận được mã OTP xác thực trong giây lát.'
      );
      setCooldown(60);
      setStep(2);
      // Auto focus first OTP input after small delay
      setTimeout(() => {
        if (otpInputsRef.current[0]) {
          otpInputsRef.current[0].focus();
        }
      }, 200);
    } catch (err) {
      setError(err.response?.data?.message || 'Có lỗi xảy ra khi gửi yêu cầu. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (cooldown > 0 || loading) return;
    setError('');
    setLoading(true);
    try {
      const res = await forgotPassword(email.trim().toLowerCase(), role);
      setInfoMessage(
        res.message ||
          'Mã xác thực mới đã được gửi nếu email của bạn đủ điều kiện.'
      );
      setCooldown(60);
      setOtpValues(['', '', '', '', '', '']);
      if (otpInputsRef.current[0]) {
        otpInputsRef.current[0].focus();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể gửi lại mã lúc này. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  };

  // OTP Input handlers
  const handleOtpChange = (index, value) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const newOtp = [...otpValues];
    newOtp[index] = digit;
    setOtpValues(newOtp);

    // Auto advance to next box
    if (digit && index < 5 && otpInputsRef.current[index + 1]) {
      otpInputsRef.current[index + 1].focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpValues[index] && index > 0 && otpInputsRef.current[index - 1]) {
      otpInputsRef.current[index - 1].focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const newOtp = [...otpValues];
    for (let i = 0; i < 6; i++) {
      newOtp[i] = pasted[i] || '';
    }
    setOtpValues(newOtp);
    const nextFocusIndex = Math.min(pasted.length, 5);
    if (otpInputsRef.current[nextFocusIndex]) {
      otpInputsRef.current[nextFocusIndex].focus();
    }
  };

  // STEP 2: Verify OTP
  const handleVerifyOtp = async (e) => {
    if (e) e.preventDefault();
    setError('');
    const fullOtp = otpValues.join('');
    if (fullOtp.length < 6) {
      setError('Vui lòng nhập đầy đủ mã OTP 6 chữ số.');
      return;
    }

    setLoading(true);
    try {
      const res = await verifyOtp(email.trim().toLowerCase(), fullOtp);
      if (res.resetToken) {
        setResetToken(res.resetToken);
        setStep(3);
      } else {
        setError('Xác thực thất bại. Vui lòng thử lại.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Mã OTP không chính xác hoặc đã hết hạn.');
    } finally {
      setLoading(false);
    }
  };

  // STEP 3: Reset Password
  const handleResetPassword = async (e) => {
    if (e) e.preventDefault();
    setError('');

    if (!newPassword || newPassword.length < 6) {
      setError('Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Xác nhận mật khẩu mới không khớp.');
      return;
    }

    setLoading(true);
    try {
      await resetPassword({
        resetToken,
        newPassword,
        confirmPassword,
      });
      setStep(4);
    } catch (err) {
      setError(err.response?.data?.message || 'Đặt lại mật khẩu thất bại. Vui lòng thực hiện lại từ đầu.');
    } finally {
      setLoading(false);
    }
  };

  const handleDone = () => {
    if (onSuccess) {
      onSuccess();
    } else {
      onClose();
    }
  };

  const inputStyle = {
    '& .MuiOutlinedInput-root': {
      borderRadius: '16px',
      backgroundColor: '#131b2e',
      color: '#f8fafc',
      '& .MuiOutlinedInput-notchedOutline': {
        borderColor: 'rgba(255, 255, 255, 0.1)',
      },
      '&:hover .MuiOutlinedInput-notchedOutline': {
        borderColor: '#6c63ff',
      },
      '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
        borderColor: '#00bcd4',
        borderWidth: '1.5px',
      },
    },
    '& .MuiInputLabel-root.Mui-focused': {
      color: '#00bcd4 !important',
    },
  };

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '20px',
          background: 'linear-gradient(145deg, #0e1526 0%, #0a0e1a 100%)',
          border: '1px solid rgba(108, 99, 255, 0.2)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7)',
          overflow: 'hidden',
          color: '#fff',
        },
      }}
    >
      <DialogContent sx={{ p: { xs: 3, sm: 4 }, position: 'relative' }}>
        {/* Close Button */}
        {!loading && (
          <IconButton
            onClick={onClose}
            aria-label="Đóng"
            sx={{
              position: 'absolute',
              top: 14,
              right: 14,
              color: '#94a3b8',
              '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.06)' },
            }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        )}

        {/* Back Button (if on step 2 or 3) */}
        {!loading && (step === 2 || step === 3) && (
          <IconButton
            onClick={() => setStep((prev) => prev - 1)}
            aria-label="Quay lại"
            sx={{
              position: 'absolute',
              top: 14,
              left: 14,
              color: '#94a3b8',
              '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.06)' },
            }}
          >
            <BackIcon fontSize="small" />
          </IconButton>
        )}

        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: 3, mt: 1 }}>
          <Box
            sx={{
              width: 52,
              height: 52,
              borderRadius: '16px',
              background: 'linear-gradient(135deg, rgba(108,99,255,0.2) 0%, rgba(0,188,212,0.2) 100%)',
              border: '1px solid rgba(108,99,255,0.3)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: 1.5,
              color: '#00bcd4',
            }}
          >
            {step === 4 ? (
              <SuccessIcon sx={{ fontSize: 30, color: '#10b981' }} />
            ) : (
              <KeyIcon sx={{ fontSize: 26 }} />
            )}
          </Box>
          <Typography
            variant="h5"
            sx={{
              fontWeight: 800,
              fontSize: '1.35rem',
              letterSpacing: '-0.3px',
              background: 'linear-gradient(135deg, #fff 0%, #cbd5e1 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            {step === 1 && 'Quên mật khẩu'}
            {step === 2 && 'Nhập mã xác thực (OTP)'}
            {step === 3 && 'Đặt lại mật khẩu mới'}
            {step === 4 && 'Thành công!'}
          </Typography>
          <Typography variant="body2" sx={{ color: '#94a3b8', mt: 0.5 }}>
            {step === 1 && 'Nhập email tài khoản của bạn để nhận mã xác thực đặt lại mật khẩu.'}
            {step === 2 && `Mã xác thực gồm 6 chữ số đã được gửi tới ${email}`}
            {step === 3 && 'Tạo mật khẩu mới có ít nhất 6 ký tự để bảo vệ tài khoản.'}
            {step === 4 && 'Mật khẩu của bạn đã được cập nhật thành công.'}
          </Typography>
        </Box>

        {/* Alerts */}
        {error && (
          <Alert severity="error" sx={{ mb: 2.5, borderRadius: '10px' }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}
        {infoMessage && step === 2 && (
          <Alert severity="info" sx={{ mb: 2.5, borderRadius: '10px' }} onClose={() => setInfoMessage('')}>
            {infoMessage}
          </Alert>
        )}

        {/* STEP 1: Enter Email */}
        {step === 1 && (
          <Box component="form" onSubmit={handleSendEmail}>
            <FloatingTextField
              fullWidth
              label="Địa chỉ email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              autoFocus
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <EmailOutlined sx={{ color: '#64748b' }} />
                  </InputAdornment>
                ),
              }}
              sx={inputStyle}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              disabled={loading}
              sx={{
                mt: 3,
                py: 1.3,
                borderRadius: '12px',
                fontWeight: 700,
                textTransform: 'none',
                fontSize: '0.95rem',
                background: 'linear-gradient(135deg, #6c63ff 0%, #00bcd4 100%)',
                boxShadow: '0 4px 15px rgba(108, 99, 255, 0.3)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #5b52e5 0%, #00acc1 100%)',
                },
              }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Gửi mã xác thực'}
            </Button>
          </Box>
        )}

        {/* STEP 2: Enter OTP */}
        {step === 2 && (
          <Box component="form" onSubmit={handleVerifyOtp}>
            <Stack direction="row" spacing={1} justifyContent="center" sx={{ mb: 3 }} onPaste={handleOtpPaste}>
              {otpValues.map((digit, idx) => (
                <TextField
                  key={idx}
                  inputRef={(el) => (otpInputsRef.current[idx] = el)}
                  value={digit}
                  onChange={(e) => handleOtpChange(idx, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                  disabled={loading}
                  inputProps={{
                    maxLength: 1,
                    style: {
                      textAlign: 'center',
                      fontSize: '1.4rem',
                      fontWeight: 800,
                      color: '#00bcd4',
                      padding: '12px 0',
                      width: '40px',
                    },
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '10px',
                      backgroundColor: '#131b2e',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      '&.Mui-focused': {
                        borderColor: '#00bcd4',
                        boxShadow: '0 0 0 2px rgba(0, 188, 212, 0.3)',
                      },
                    },
                  }}
                />
              ))}
            </Stack>

            <Button
              type="submit"
              fullWidth
              variant="contained"
              disabled={loading || otpValues.join('').length < 6}
              sx={{
                py: 1.3,
                borderRadius: '12px',
                fontWeight: 700,
                textTransform: 'none',
                fontSize: '0.95rem',
                background: 'linear-gradient(135deg, #6c63ff 0%, #00bcd4 100%)',
                boxShadow: '0 4px 15px rgba(108, 99, 255, 0.3)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #5b52e5 0%, #00acc1 100%)',
                },
              }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Xác thực mã OTP'}
            </Button>

            <Box sx={{ textAlign: 'center', mt: 2.5 }}>
              <Typography variant="body2" sx={{ color: '#94a3b8' }}>
                Không nhận được mã?{' '}
                <Button
                  onClick={handleResendOtp}
                  disabled={cooldown > 0 || loading}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 700,
                    p: 0,
                    minWidth: 'auto',
                    color: cooldown > 0 ? '#64748b' : '#00bcd4',
                  }}
                >
                  {cooldown > 0 ? `Gửi lại sau (${cooldown}s)` : 'Gửi lại mã'}
                </Button>
              </Typography>
            </Box>
          </Box>
        )}

        {/* STEP 3: Enter New Password */}
        {step === 3 && (
          <Box component="form" onSubmit={handleResetPassword}>
            <Stack spacing={2}>
              <FloatingTextField
                fullWidth
                label="Mật khẩu mới"
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={loading}
                autoFocus
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockOutlined sx={{ color: '#64748b' }} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowNewPassword((prev) => !prev)}
                        edge="end"
                        sx={{ color: '#94a3b8' }}
                      >
                        {showNewPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                sx={inputStyle}
              />

              <FloatingTextField
                fullWidth
                label="Xác nhận mật khẩu mới"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockOutlined sx={{ color: '#64748b' }} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                        edge="end"
                        sx={{ color: '#94a3b8' }}
                      >
                        {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                sx={inputStyle}
              />
            </Stack>

            <Button
              type="submit"
              fullWidth
              variant="contained"
              disabled={loading}
              sx={{
                mt: 3,
                py: 1.3,
                borderRadius: '12px',
                fontWeight: 700,
                textTransform: 'none',
                fontSize: '0.95rem',
                background: 'linear-gradient(135deg, #6c63ff 0%, #00bcd4 100%)',
                boxShadow: '0 4px 15px rgba(108, 99, 255, 0.3)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #5b52e5 0%, #00acc1 100%)',
                },
              }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Cập nhật mật khẩu'}
            </Button>
          </Box>
        )}

        {/* STEP 4: Success */}
        {step === 4 && (
          <Box sx={{ textAlign: 'center', py: 1 }}>
            <Typography variant="body1" sx={{ color: '#cbd5e1', mb: 3 }}>
              Mật khẩu của bạn đã được thay đổi. Các phiên đăng nhập trên thiết bị cũ đã được thu hồi để đảm bảo an toàn. Vui lòng đăng nhập lại.
            </Typography>
            <Button
              fullWidth
              variant="contained"
              onClick={handleDone}
              sx={{
                py: 1.3,
                borderRadius: '12px',
                fontWeight: 700,
                textTransform: 'none',
                fontSize: '0.95rem',
                background: 'linear-gradient(135deg, #10b981 0%, #00bcd4 100%)',
                boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)',
              }}
            >
              Đăng nhập ngay
            </Button>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}
