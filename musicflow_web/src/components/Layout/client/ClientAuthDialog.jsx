import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogContent,
  Divider,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  CloseRounded as CloseIcon,
  EmailOutlined,
  Google as GoogleIcon,
  LockOutlined,
  MicExternalOnOutlined,
  MusicNote as MusicNoteIcon,
  PersonOutline,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';
import api, { setAccessToken } from '../../../services/api';
import useClientToast from './useClientToast';
import { notifyClientSessionChanged } from '../../../hooks/useClientSession';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

let googleScriptPromise = null;
let initializedGoogleClientId = '';

const loadGoogleScript = () => {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (googleScriptPromise) return googleScriptPromise;

  googleScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-google-gsi="true"]');
    if (existing) {
      existing.addEventListener('load', resolve, { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.dataset.googleGsi = 'true';
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });

  return googleScriptPromise;
};

const initializeGoogle = (clientId) => {
  if (!window.google?.accounts?.id || !clientId) return;
  if (initializedGoogleClientId === clientId) return;

  window.google.accounts.id.initialize({
    client_id: clientId,
    callback: () => {},
  });

  initializedGoogleClientId = clientId;
};

const requestGoogleAccessToken = ({ clientId, onSuccess, onError }) => {
  if (!window.google?.accounts?.oauth2 || !clientId) {
    onError?.(new Error('Google OAuth chưa sẵn sàng.'));
    return;
  }

  const tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: 'openid email profile',
    callback: (response) => {
      if (response?.access_token) {
        onSuccess(response.access_token);
        return;
      }
      onError?.(new Error(response?.error || 'Không lấy được Google token.'));
    },
    error_callback: (error) => {
      onError?.(new Error(error?.message || error?.type || 'Đăng nhập Google bị hủy.'));
    },
  });

  tokenClient.requestAccessToken({ prompt: 'select_account' });
};

function ClientAuthDialog() {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useClientToast();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const authMode = params.get('auth');
  const open = authMode === 'login' || authMode === 'register';
  const isRegister = authMode === 'register';

  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ name: '', email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    loadGoogleScript()
      .then(() => {
        initializeGoogle(GOOGLE_CLIENT_ID);
        setGoogleReady(true);
      })
      .catch(() => setError('Không thể tải Google SDK.'));
  }, []);

  const closeDialog = useCallback(() => {
    const nextParams = new URLSearchParams(location.search);
    nextParams.delete('auth');
    const search = nextParams.toString();
    navigate(`${location.pathname}${search ? `?${search}` : ''}`, { replace: true });
    setError('');
  }, [location.pathname, location.search, navigate]);

  const switchMode = (mode) => {
    const nextParams = new URLSearchParams(location.search);
    nextParams.set('auth', mode);
    navigate(`${location.pathname}?${nextParams.toString()}`, { replace: true });
    setError('');
    setShowPassword(false);
  };

  const goToArtistLogin = () => {
    navigate('/artist/dashboard?auth=login');
    setError('');
  };

  const completeAuth = useCallback(({ token, user }, message) => {
    setAccessToken(token);
    localStorage.setItem('role', user.role);
    localStorage.setItem('userName', user.name || 'Listener');
    localStorage.setItem('email', user.email || '');
    localStorage.setItem('userId', user._id || '');
    localStorage.setItem('userAvatar', user.avatar || '');
    notifyClientSessionChanged();
    closeDialog();
    showToast({
      severity: 'success',
      title: 'Thành công!',
      message,
    });
  }, [closeDialog, showToast]);

  const handleGoogleLogin = async () => {
    if (!GOOGLE_CLIENT_ID) {
      setError('Chưa cấu hình Google Login.');
      return;
    }

    try {
      setGoogleLoading(true);
      setError('');

      await loadGoogleScript();
      initializeGoogle(GOOGLE_CLIENT_ID);
      setGoogleReady(true);

      requestGoogleAccessToken({
        clientId: GOOGLE_CLIENT_ID,
        onSuccess: async (accessToken) => {
          try {
            const res = await api.post('/auth/google', {
              credential: accessToken,
              tokenType: 'access_token',
            });
            completeAuth(res.data, 'Đăng nhập Google thành công.');
          } catch (err) {
            setError(err.response?.data?.error || err.response?.data?.message || 'Đăng nhập Google thất bại.');
          } finally {
            setGoogleLoading(false);
          }
        },
        onError: (err) => {
          setError(err.message || 'Đăng nhập Google thất bại.');
          setGoogleLoading(false);
        },
      });
    } catch {
      setError('Không thể tải Google SDK.');
      setGoogleLoading(false);
    }
  };

  const handleLoginSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await api.post('/auth/login', loginForm);
      const { user } = res.data;

      if (user.role !== 'user') {
        setError('Tài khoản này không thuộc khu vực listener.');
        return;
      }

      completeAuth(res.data, 'Đăng nhập thành công.');
    } catch (err) {
      setError(err.response?.data?.message || 'Email hoặc mật khẩu không đúng.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await api.post('/auth/register', registerForm);
      completeAuth(res.data, 'Đăng ký tài khoản thành công.');
    } catch (err) {
      setError(err.response?.data?.message || 'Đăng ký thất bại.');
    } finally {
      setLoading(false);
    }
  };

  const fieldSx = {
    '& .MuiOutlinedInput-root': {
      borderRadius: 2.5,
      bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#f8fafc',
    },
  };

  return (
    <Dialog
      open={open}
      onClose={closeDialog}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 4,
          overflow: 'hidden',
          bgcolor: (theme) => theme.palette.mode === 'dark' 
            ? 'rgba(15, 23, 42, 0.95)' 
            : 'rgba(255, 255, 255, 0.96)',
          backdropFilter: 'blur(18px)',
          boxShadow: '0 28px 90px rgba(15, 23, 42, 0.35)',
          border: '1px solid',
          borderColor: (theme) => theme.palette.mode === 'dark' 
            ? 'rgba(255, 255, 255, 0.08)' 
            : 'transparent',
        },
      }}
      slotProps={{
        backdrop: {
          sx: {
            bgcolor: 'rgba(15, 23, 42, 0.38)',
            backdropFilter: 'blur(7px)',
          },
        },
      }}
    >
      <DialogContent sx={{ p: { xs: 2.75, sm: 3.25 } }}>
        <IconButton
          aria-label="Close"
          onClick={closeDialog}
          sx={{ position: 'absolute', right: 12, top: 12, color: '#64748b' }}
        >
          <CloseIcon />
        </IconButton>

        <Stack spacing={2.25}>
          <Box sx={{ textAlign: 'center', pt: 1 }}>
            <Box sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 58, height: 58, borderRadius: 3, background: 'linear-gradient(135deg, #35d0df 0%, #6c63ff 62%, #ff6b81 100%)', boxShadow: '0 14px 30px rgba(108, 99, 255, 0.24)', mb: 1.5 }}>
              <MusicNoteIcon sx={{ fontSize: 32, color: '#fff' }} />
            </Box>
            <Typography variant="h5" fontWeight={850}>
              {isRegister ? 'Tạo tài khoản' : 'Đăng nhập'}
            </Typography>
            <Typography color="text.secondary" sx={{ fontSize: 14.5, mt: 0.5 }}>
              {isRegister ? 'Bắt đầu lưu gu nhạc của bạn trên MusicFlow' : 'Tiếp tục trải nghiệm MusicFlow của bạn'}
            </Typography>
          </Box>

          {error && <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>}

          {isRegister ? (
            <Box component="form" onSubmit={handleRegisterSubmit}>
              <Stack spacing={1.6}>
                <TextField name="name" label="Tên người dùng" fullWidth sx={fieldSx} value={registerForm.name} onChange={(event) => setRegisterForm((prev) => ({ ...prev, name: event.target.value }))} required InputProps={{ startAdornment: <InputAdornment position="start"><PersonOutline sx={{ color: '#7c8597' }} /></InputAdornment> }} />
                <TextField name="email" label="Email" type="email" fullWidth sx={fieldSx} value={registerForm.email} onChange={(event) => setRegisterForm((prev) => ({ ...prev, email: event.target.value }))} required InputProps={{ startAdornment: <InputAdornment position="start"><EmailOutlined sx={{ color: '#7c8597' }} /></InputAdornment> }} />
                <TextField
                  name="password"
                  label="Mật khẩu"
                  type={showPassword ? 'text' : 'password'}
                  fullWidth
                  sx={fieldSx}
                  value={registerForm.password}
                  onChange={(event) => setRegisterForm((prev) => ({ ...prev, password: event.target.value }))}
                  required
                  inputProps={{ minLength: 6 }}
                  InputProps={{
                    startAdornment: <InputAdornment position="start"><LockOutlined sx={{ color: '#7c8597' }} /></InputAdornment>,
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setShowPassword((prev) => !prev)} edge="end">
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
                <Button type="submit" fullWidth variant="contained" disabled={loading} sx={{ py: 1.35, borderRadius: 2, background: 'linear-gradient(135deg, #ff6b81 0%, #6c63ff 72%)' }}>
                  {loading ? 'Đang đăng ký...' : 'Đăng ký'}
                </Button>
              </Stack>
            </Box>
          ) : (
            <Box component="form" onSubmit={handleLoginSubmit}>
              <Stack spacing={1.6}>
                <TextField fullWidth label="Email" type="email" value={loginForm.email} onChange={(event) => setLoginForm((prev) => ({ ...prev, email: event.target.value }))} sx={fieldSx} required InputProps={{ startAdornment: <InputAdornment position="start"><EmailOutlined sx={{ color: '#7c8597' }} /></InputAdornment> }} />
                <TextField
                  fullWidth
                  label="Mật khẩu"
                  type={showPassword ? 'text' : 'password'}
                  value={loginForm.password}
                  onChange={(event) => setLoginForm((prev) => ({ ...prev, password: event.target.value }))}
                  sx={fieldSx}
                  required
                  InputProps={{
                    startAdornment: <InputAdornment position="start"><LockOutlined sx={{ color: '#7c8597' }} /></InputAdornment>,
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setShowPassword((prev) => !prev)} edge="end">
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
                <Button type="submit" fullWidth variant="contained" disabled={loading} sx={{ py: 1.35, borderRadius: 2, background: 'linear-gradient(135deg, #35d0df 0%, #6c63ff 70%)' }}>
                  {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
                </Button>
              </Stack>
            </Box>
          )}

          {!isRegister && (
            <>
              <Divider>Hoặc</Divider>
              {GOOGLE_CLIENT_ID ? (
                <Button type="button" fullWidth variant="outlined" startIcon={<GoogleIcon />} disabled={googleLoading || !googleReady} onClick={handleGoogleLogin} sx={{ py: 1.1, borderRadius: 2, borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.12)' : '#d8dce6', color: '#db4437', fontWeight: 700 }}>
                  {googleLoading ? 'Đang xử lý...' : 'Đăng nhập bằng Google'}
                </Button>
              ) : (
                <Button type="button" fullWidth variant="outlined" startIcon={<GoogleIcon />} disabled sx={{ py: 1.1, borderRadius: 2, borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.12)' : '#d8dce6', color: '#db4437', fontWeight: 700 }}>
                  Chưa cấu hình Google Login
                </Button>
              )}
            </>
          )}

          <Box sx={{ textAlign: 'center' }}>
            <Stack spacing={0.25} alignItems="center">
            <Button
              type="button"
              variant="text"
              sx={{ fontWeight: 800, color: '#6c63ff' }}
              onClick={() => switchMode(isRegister ? 'login' : 'register')}
            >
              {isRegister ? 'Đã có tài khoản? Đăng nhập' : 'Chưa có tài khoản? Đăng ký'}
            </Button>
            <Button
              type="button"
              variant="text"
              startIcon={<MicExternalOnOutlined />}
              sx={{ fontWeight: 800, color: (theme) => theme.palette.mode === 'dark' ? '#14b8a6' : '#0f766e' }}
              onClick={goToArtistLogin}
            >
              Artist Studio
            </Button>
            </Stack>
          </Box>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}

export default ClientAuthDialog;
