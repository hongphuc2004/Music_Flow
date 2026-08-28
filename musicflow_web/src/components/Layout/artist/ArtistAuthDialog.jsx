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
  Visibility,
  VisibilityOff,
  PersonOutline,
  ImageOutlined,
  AlternateEmailOutlined,
} from '@mui/icons-material';
import api, { setAccessToken } from '../../../services/api';
import { syncArtistSession } from '../../../utils/artistSession';
import useAppToast from '../../../components/common/useAppToast';

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

function ArtistAuthDialog() {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useAppToast();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  
  const authParam = params.get('auth');
  const open = authParam === 'login' || authParam === 'register';
  const isRegister = authParam === 'register';

  const [formData, setFormData] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ name: '', email: '', password: '', avatar: '', bio: '' });
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
    if (!localStorage.getItem('role')) {
      navigate('/', { replace: true });
      setError('');
      return;
    }

    const nextParams = new URLSearchParams(location.search);
    nextParams.delete('auth');
    const search = nextParams.toString();
    navigate(`${location.pathname}${search ? `?${search}` : ''}`, { replace: true });
    setError('');
  }, [location.pathname, location.search, navigate]);

  const completeArtistAuth = useCallback(({ token, artist }) => {
    setAccessToken(token);
    localStorage.setItem('role', artist.role);
    syncArtistSession(artist);
    navigate('/artist/dashboard', { replace: true });
  }, [navigate]);

  const handleLoginChange = (field) => (event) => {
    setFormData((prev) => ({ ...prev, [field]: event.target.value }));
    setError('');
  };

  const handleRegisterChange = (field) => (event) => {
    setRegisterForm((prev) => ({ ...prev, [field]: event.target.value }));
    setError('');
  };

  const switchMode = (mode) => {
    const nextParams = new URLSearchParams(location.search);
    nextParams.set('auth', mode);
    navigate(`${location.pathname}?${nextParams.toString()}`, { replace: true });
    setError('');
    setShowPassword(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await api.post('/artist/login', formData);
      completeArtistAuth(res.data);
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
      await api.post('/artist/register', registerForm);
      showToast({
        severity: 'success',
        title: 'Đăng ký thành công!',
        message: 'Tài khoản nghệ sĩ đã được tạo. Vui lòng đăng nhập.',
      });
      setRegisterForm({ name: '', email: '', password: '', avatar: '', bio: '' });
      switchMode('login');
    } catch (err) {
      setError(err.response?.data?.message || 'Đăng ký nghệ sĩ thất bại.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (!GOOGLE_CLIENT_ID) {
      setError('Chua cau hinh Google Login.');
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
            const res = await api.post('/artist/google', {
              credential: accessToken,
              tokenType: 'access_token',
            });
            completeArtistAuth(res.data);
          } catch (err) {
            setError(err.response?.data?.error || err.response?.data?.message || 'Dang nhap Google that bai.');
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
            <Box sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 58, height: 58, borderRadius: 3, background: 'linear-gradient(135deg, #00bcd4 0%, #6c63ff 72%)', boxShadow: '0 14px 30px rgba(108, 99, 255, 0.24)', mb: 1.5 }}>
              <MusicNoteIcon sx={{ fontSize: 32, color: '#fff' }} />
            </Box>
            <Typography variant="h5" fontWeight={850}>
              {isRegister ? 'Đăng ký Artist' : 'Artist Studio'}
            </Typography>
            <Typography color="text.secondary" sx={{ fontSize: 14.5, mt: 0.5 }}>
              {isRegister ? 'Tạo hồ sơ nghệ sĩ để phát hành và quản lý nhạc' : 'Đăng nhập tài khoản nghệ sĩ của bạn'}
            </Typography>
          </Box>

          {error && <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>}

          {isRegister ? (
            <Box component="form" onSubmit={handleRegisterSubmit}>
              <Stack spacing={1.6}>
                <TextField fullWidth label="Tên nghệ sĩ" value={registerForm.name} onChange={handleRegisterChange('name')} sx={fieldSx} required InputProps={{ startAdornment: <InputAdornment position="start"><PersonOutline sx={{ color: '#7c8597' }} /></InputAdornment> }} />
                <TextField fullWidth label="Email" type="email" value={registerForm.email} onChange={handleRegisterChange('email')} sx={fieldSx} required InputProps={{ startAdornment: <InputAdornment position="start"><EmailOutlined sx={{ color: '#7c8597' }} /></InputAdornment> }} />
                <TextField
                  fullWidth
                  label="Mật khẩu"
                  type={showPassword ? 'text' : 'password'}
                  value={registerForm.password}
                  onChange={handleRegisterChange('password')}
                  sx={fieldSx}
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
                <TextField fullWidth label="Avatar (URL)" value={registerForm.avatar} onChange={handleRegisterChange('avatar')} sx={fieldSx} InputProps={{ startAdornment: <InputAdornment position="start"><ImageOutlined sx={{ color: '#7c8597' }} /></InputAdornment> }} />
                <TextField fullWidth label="Giới thiệu" multiline minRows={3} value={registerForm.bio} onChange={handleRegisterChange('bio')} sx={fieldSx} InputProps={{ startAdornment: <InputAdornment position="start" sx={{ alignSelf: 'flex-start', mt: 1.5 }}><AlternateEmailOutlined sx={{ color: '#7c8597' }} /></InputAdornment> }} />
                <Button type="submit" fullWidth variant="contained" disabled={loading} startIcon={<MicExternalOnOutlined />} sx={{ py: 1.35, borderRadius: 2, background: 'linear-gradient(135deg, #00bcd4 0%, #6c63ff 70%)' }}>
                  {loading ? 'Đang đăng ký nghệ sĩ...' : 'Đăng ký Artist'}
                </Button>
              </Stack>
            </Box>
          ) : (
            <>
              <Box component="form" onSubmit={handleSubmit}>
                <Stack spacing={1.6}>
                  <TextField fullWidth label="Email" type="email" value={formData.email} onChange={handleLoginChange('email')} sx={fieldSx} required InputProps={{ startAdornment: <InputAdornment position="start"><EmailOutlined sx={{ color: '#7c8597' }} /></InputAdornment> }} />
                  <TextField
                    fullWidth
                    label="Mat khau"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={handleLoginChange('password')}
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
                  <Button type="submit" fullWidth variant="contained" disabled={loading} startIcon={<MicExternalOnOutlined />} sx={{ py: 1.35, borderRadius: 2, background: 'linear-gradient(135deg, #00bcd4 0%, #6c63ff 70%)' }}>
                    {loading ? 'Đang đăng nhập...' : 'Đăng nhập Artist'}
                  </Button>
                </Stack>
              </Box>

              <Divider>Hoac</Divider>
              {GOOGLE_CLIENT_ID ? (
                <Button type="button" fullWidth variant="outlined" startIcon={<GoogleIcon />} disabled={googleLoading || !googleReady} onClick={handleGoogleLogin} sx={{ py: 1.1, borderRadius: 2, borderColor: '#d8dce6', color: '#db4437', fontWeight: 700 }}>
                  {googleLoading ? 'Đang xử lý...' : 'Đăng nhập Artist bằng Google'}
                </Button>
              ) : (
                <Button type="button" fullWidth variant="outlined" startIcon={<GoogleIcon />} disabled sx={{ py: 1.1, borderRadius: 2, borderColor: '#d8dce6', color: '#db4437', fontWeight: 700 }}>
                  Chưa cấu hình Google Login
                </Button>
              )}
            </>
          )}

          <Box sx={{ textAlign: 'center' }}>
            <Button
              type="button"
              variant="text"
              sx={{ fontWeight: 800, color: '#6c63ff' }}
              onClick={() => switchMode(isRegister ? 'login' : 'register')}
            >
              {isRegister ? 'Đã có tài khoản? Đăng nhập Artist' : 'Đăng ký Artist'}
            </Button>
          </Box>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}

export default ArtistAuthDialog;
