import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Divider,
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
  InputAdornment,
  IconButton,
  Chip,
  Stack,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Google as GoogleIcon,
  MusicNote as MusicNoteIcon,
  EmailOutlined,
  LockOutlined,
  HeadphonesOutlined,
  LibraryMusicOutlined,
  FavoriteBorderOutlined,
  ExploreOutlined,
} from '@mui/icons-material';
import api, { setAccessToken } from '../services/api';
import { notifyClientSessionChanged } from '../hooks/useClientSession';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

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

function AccountLogin() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      setError('Chưa cấu hình Google Login.');
      return;
    }

    const existing = document.querySelector('script[data-google-gsi="true"]');
    if (existing && window.google?.accounts?.id) {
      setGoogleReady(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.dataset.googleGsi = 'true';
    script.onload = () => setGoogleReady(true);
    script.onerror = () => setError('Không thể tải Google SDK.');
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!googleReady || !window.google || !GOOGLE_CLIENT_ID) return;

    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: async (response) => {
        try {
          setGoogleLoading(true);
          setError('');

          const res = await api.post('/auth/google', {
            credential: response.credential,
          });
          const { token, user } = res.data;
          setAccessToken(token);
          localStorage.setItem('role', user.role);
          localStorage.setItem('userName', user.name || 'Listener');
          localStorage.setItem('email', user.email || '');
          localStorage.setItem('userId', user._id || '');
          notifyClientSessionChanged();
          navigate('/client/home');
        } catch (err) {
          setError(err.response?.data?.error || err.response?.data?.message || 'Đăng nhập Google thất bại');
        } finally {
          setGoogleLoading(false);
        }
      },
    });
  }, [googleReady, navigate]);

  const handleChange = (field) => (event) => {
    setFormData({ ...formData, [field]: event.target.value });
    setError('');
  };

  const handleGoogleLogin = () => {
    if (!GOOGLE_CLIENT_ID) return;

    if (!googleReady || !window.google?.accounts?.id) {
      setError('Google SDK chưa sẵn sàng. Vui lòng thử lại sau.');
      return;
    }

    setError('');
    setGoogleLoading(true);
    window.google.accounts.id.prompt((notification) => {
      if (!notification?.isNotDisplayed?.() && !notification?.isSkippedMoment?.()) {
        setGoogleLoading(false);
        return;
      }

      requestGoogleAccessToken({
        clientId: GOOGLE_CLIENT_ID,
        onSuccess: async (accessToken) => {
          try {
            const res = await api.post('/auth/google', {
              credential: accessToken,
              tokenType: 'access_token',
            });
            const { token, user } = res.data;
            setAccessToken(token);
            localStorage.setItem('role', user.role);
            localStorage.setItem('userName', user.name || 'Listener');
            localStorage.setItem('email', user.email || '');
            localStorage.setItem('userId', user._id || '');
            notifyClientSessionChanged();
            navigate('/client/home');
          } catch (err) {
            setError(err.response?.data?.error || err.response?.data?.message || 'Đăng nhập Google thất bại');
          } finally {
            setGoogleLoading(false);
          }
        },
        onError: (err) => {
          setError(err.message || 'Đăng nhập Google thất bại');
          setGoogleLoading(false);
        },
      });
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/auth/login', formData);
      const { token, user } = res.data;
      setAccessToken(token);
      localStorage.setItem('role', user.role);
      localStorage.setItem('userName', user.name || 'Listener');
      localStorage.setItem('email', user.email || '');
      localStorage.setItem('userId', user._id || '');
      notifyClientSessionChanged();
      if (user.role === 'user') {
        navigate('/client/home');
      } else {
        setError('Bạn không có quyền truy cập trang này!');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Email hoặc mật khẩu không đúng');
    } finally {
      setLoading(false);
    }
  };

  const fieldSx = {
    mb: 2,
    '& .MuiOutlinedInput-root': {
      borderRadius: 2,
      bgcolor: '#f7f8fb',
    },
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: { xs: 2.5, md: 5 },
        py: { xs: 4, md: 6 },
        background:
          'radial-gradient(circle at 14% 18%, rgba(53, 208, 223, 0.22), transparent 28%), radial-gradient(circle at 86% 12%, rgba(255, 107, 129, 0.18), transparent 30%), linear-gradient(135deg, #eef7ff 0%, #f7f5ff 45%, #fff7fb 100%)',
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(15,23,42,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.055) 1px, transparent 1px)',
          backgroundSize: '42px 42px',
          maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.65), transparent)',
        },
      }}
    >
      <Box
        sx={{
          width: '100%',
          maxWidth: 1080,
          position: 'relative',
          zIndex: 1,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1.05fr 0.95fr' },
          gap: { xs: 3, md: 5 },
          alignItems: 'center',
        }}
      >
        <Box sx={{ color: '#111827', display: { xs: 'none', md: 'block' } }}>
          <Chip
            icon={<HeadphonesOutlined />}
            label="Listener space"
            sx={{
              mb: 3,
              color: '#175a66',
              bgcolor: 'rgba(255,255,255,0.72)',
              border: '1px solid rgba(23,90,102,0.14)',
              '& .MuiChip-icon': { color: '#14b8c5' },
            }}
          />
          <Typography component="h1" sx={{ maxWidth: 520, fontSize: { md: 52, lg: 60 }, lineHeight: 1, fontWeight: 850, mb: 2 }}>
            Nhạc hay hơn khi mọi thứ ở đúng gu của bạn.
          </Typography>
          <Typography sx={{ maxWidth: 470, color: '#536070', fontSize: 17, lineHeight: 1.7 }}>
            Đăng nhập để tiếp tục nghe nhạc, lưu bài yêu thích, khám phá playlist và giữ toàn bộ trải nghiệm MusicFlow của bạn.
          </Typography>

          <Stack direction="row" spacing={2} sx={{ mt: 5 }}>
            {[
              { icon: <ExploreOutlined />, label: 'Khám phá' },
              { icon: <FavoriteBorderOutlined />, label: 'Yêu thích' },
              { icon: <LibraryMusicOutlined />, label: 'Thư viện' },
            ].map((item) => (
              <Box key={item.label} sx={{ minWidth: 118, p: 2, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.68)', border: '1px solid rgba(17,24,39,0.08)', boxShadow: '0 18px 42px rgba(37, 47, 74, 0.08)' }}>
                <Box sx={{ color: '#14b8c5', mb: 1, display: 'flex' }}>{item.icon}</Box>
                <Typography fontWeight={800}>{item.label}</Typography>
              </Box>
            ))}
          </Stack>
        </Box>

        <Paper elevation={0} sx={{ p: { xs: 3, sm: 4.5 }, width: '100%', maxWidth: 470, mx: 'auto', borderRadius: 4, bgcolor: 'rgba(255,255,255,0.94)', border: '1px solid rgba(255,255,255,0.74)', boxShadow: '0 26px 80px rgba(37, 47, 74, 0.18)' }}>
          <Box sx={{ textAlign: 'center', mb: 3.5 }}>
            <Box sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 68, height: 68, borderRadius: 3, background: 'linear-gradient(135deg, #35d0df 0%, #6c63ff 62%, #ff6b81 100%)', boxShadow: '0 16px 34px rgba(108, 99, 255, 0.24)', mb: 2.5 }}>
              <MusicNoteIcon sx={{ fontSize: 36, color: '#fff' }} />
            </Box>
            <Typography variant="h4" fontWeight={850} gutterBottom>
              Chào mừng trở lại
            </Typography>
            <Typography color="text.secondary" sx={{ fontSize: 15.5 }}>
              Đăng nhập tài khoản MusicFlow của bạn
            </Typography>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>}

          <form onSubmit={handleSubmit} noValidate>
            <TextField fullWidth label="Email" type="email" value={formData.email} onChange={handleChange('email')} sx={fieldSx} required InputProps={{ startAdornment: <InputAdornment position="start"><EmailOutlined sx={{ color: '#7c8597' }} /></InputAdornment> }} />
            <TextField
              fullWidth
              label="Mật khẩu"
              type={showPassword ? 'text' : 'password'}
              value={formData.password}
              onChange={handleChange('password')}
              sx={{ ...fieldSx, mb: 3 }}
              required
              InputProps={{
                startAdornment: <InputAdornment position="start"><LockOutlined sx={{ color: '#7c8597' }} /></InputAdornment>,
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton type="button" onClick={() => setShowPassword(!showPassword)} edge="end" aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <Button type="submit" fullWidth variant="contained" size="large" disabled={loading} sx={{ py: 1.55, borderRadius: 2, fontSize: 16, background: 'linear-gradient(135deg, #35d0df 0%, #6c63ff 70%)', boxShadow: '0 14px 28px rgba(108, 99, 255, 0.25)', '&:hover': { background: 'linear-gradient(135deg, #24c0d0 0%, #5f57f4 70%)' } }}>
              {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </Button>
          </form>

          <Divider sx={{ my: 2.5 }}>Hoặc</Divider>

          <Button type="button" fullWidth variant="outlined" startIcon={<GoogleIcon />} disabled={!GOOGLE_CLIENT_ID || googleLoading} onClick={handleGoogleLogin} sx={{ py: 1.2, borderRadius: 2, borderColor: '#d8dce6', color: '#db4437', fontWeight: 700 }}>
            {googleLoading ? 'Đang xử lý...' : 'Đăng nhập bằng Google'}
          </Button>
          {!GOOGLE_CLIENT_ID && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              Chưa cấu hình VITE_GOOGLE_CLIENT_ID nên tạm thời ẩn Google Login.
            </Typography>
          )}

          <Box sx={{ mt: 3.5, display: 'flex', gap: 1.5, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button type="button" variant="text" sx={{ color: '#0f766e', fontWeight: 800 }} onClick={() => navigate('/client/home')}>
              Nghe với tư cách khách
            </Button>
            <Button type="button" variant="text" sx={{ color: '#6c63ff', fontWeight: 800 }} onClick={() => navigate('/user/register')}>
              Tạo tài khoản 
            </Button>
            <Button type="button" variant="text" sx={{ color: '#14a7b7', fontWeight: 800 }} onClick={() => navigate('/artist/dashboard?auth=login')}>
              Đăng nhập artist
            </Button>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}

export default AccountLogin;


