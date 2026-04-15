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
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Google as GoogleIcon,
  MusicNote as MusicNoteIcon,
} from '@mui/icons-material';
import api, { setAccessToken } from '../services/api';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

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
    if (!GOOGLE_CLIENT_ID) return;

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
    window.google.accounts.id.prompt();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      // Chỉ đăng nhập user
      const res = await api.post('/auth/login', formData);
      const { token, user } = res.data;
      setAccessToken(token);
      localStorage.setItem('role', user.role);
      localStorage.setItem('userName', user.name || 'Listener');
      localStorage.setItem('email', user.email || '');
      localStorage.setItem('userId', user._id || '');
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

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #f8fafc 0%, #e0e7ff 100%)',
      }}
    >
      <Paper
        elevation={12}
        sx={{
          p: 4,
          width: '100%',
          maxWidth: 420,
          borderRadius: 4,
          boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
        }}
      >
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 70,
              height: 70,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #6c63ff 0%, #00bcd4 100%)',
              mb: 2,
              boxShadow: '0 4px 16px 0 rgba(108,99,255,0.15)',
            }}
          >
            <MusicNoteIcon sx={{ fontSize: 38, color: '#fff' }} />
          </Box>
          <Typography variant="h4" fontWeight={800} gutterBottom color="#6c63ff">
            MusicFlow
          </Typography>
          <Typography color="text.secondary" fontWeight={500}>
            Đăng nhập để trải nghiệm âm nhạc tuyệt vời!
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <TextField
            fullWidth
            label="Email"
            type="email"
            value={formData.email}
            onChange={handleChange('email')}
            sx={{ mb: 2 }}
            required
          />
          <TextField
            fullWidth
            label="Mật khẩu"
            type={showPassword ? 'text' : 'password'}
            value={formData.password}
            onChange={handleChange('password')}
            sx={{ mb: 3 }}
            required
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowPassword(!showPassword)}
                    edge="end"
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
          <Button
            type="submit"
            fullWidth
            variant="contained"
            size="large"
            disabled={loading}
            sx={{
              bgcolor: '#6c63ff',
              '&:hover': { bgcolor: '#5a52d5' },
              py: 1.5,
              fontWeight: 700,
              fontSize: 18,
              letterSpacing: 1,
            }}
          >
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </Button>
        </form>

        <Divider sx={{ my: 2.5 }}>Hoặc đăng nhập nhanh</Divider>

        <Box sx={{ display: 'flex', gap: 1.25, flexDirection: { xs: 'column', sm: 'row' } }}>
          <Button
            fullWidth
            variant="outlined"
            startIcon={<GoogleIcon />}
            disabled={!GOOGLE_CLIENT_ID || googleLoading}
            onClick={handleGoogleLogin}
            sx={{ borderColor: '#db4437', color: '#db4437', fontWeight: 600 }}
          >
            {googleLoading ? 'Đang xử lý...' : 'Đăng nhập bằng Google'}
          </Button>
        </Box>
        {!GOOGLE_CLIENT_ID && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Chua cau hinh VITE_GOOGLE_CLIENT_ID nen tam thoi an Google Login.
          </Typography>
        )}

        <Box sx={{ mt: 4, textAlign: 'center' }}>
          <Typography variant="body1" fontWeight={500} mb={1}>
            Bạn chưa có tài khoản?
          </Typography>
          <Button
            variant="outlined"
            sx={{ borderColor: '#6c63ff', color: '#6c63ff', fontWeight: 600 }}
            onClick={() => navigate('/user/register')}
          >
            Đăng ký User
          </Button>
          <Button
            variant="outlined"
            sx={{ borderColor: '#00bcd4', color: '#00bcd4', fontWeight: 600, ml: 2 }}
            onClick={() => navigate('/artistlogin')}
          >
            Đăng nhập Artist
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}

export default AccountLogin;
