import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  AlbumOutlined,
  EmailOutlined,
  GraphicEqOutlined,
  Google as GoogleIcon,
  LockOutlined,
  MicExternalOnOutlined,
  MusicNote as MusicNoteIcon,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';
import api from '../../services/api';
import { syncArtistSession } from '../../utils/artistSession';
import { setAccessToken } from '../../services/api';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

function ArtistLogin() {
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
          const res = await api.post('/artist/google', {
            credential: response.credential,
          });

          const { token, artist } = res.data;
          setAccessToken(token);
          localStorage.setItem('role', artist.role);
          syncArtistSession(artist);
          navigate('/artist/dashboard');
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/artist/login', formData);
      const { token, artist } = res.data;
      setAccessToken(token);
      localStorage.setItem('role', artist.role);
      syncArtistSession(artist);
      navigate('/artist/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Email hoặc mật khẩu không đúng');
    } finally {
      setLoading(false);
    }
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

  const fieldSx = {
    mb: 2,
    '& .MuiOutlinedInput-root': {
      borderRadius: 2,
      bgcolor: '#f7f8fb',
    },
  };

  return (
    <Box sx={{ minHeight: '100vh', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', px: { xs: 2.5, md: 5 }, py: { xs: 4, md: 6 }, background: 'radial-gradient(circle at 14% 20%, rgba(108, 99, 255, 0.22), transparent 28%), radial-gradient(circle at 86% 12%, rgba(0, 188, 212, 0.24), transparent 30%), linear-gradient(135deg, #101423 0%, #142033 48%, #102b35 100%)' }}>
      <Box sx={{ width: '100%', maxWidth: 1080, display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.05fr 0.95fr' }, gap: { xs: 3, md: 5 }, alignItems: 'center' }}>
        <Box sx={{ color: '#fff', display: { xs: 'none', md: 'block' } }}>
          <Chip icon={<MicExternalOnOutlined />} label="Artist studio" sx={{ mb: 3, color: '#d7fbff', bgcolor: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.16)', '& .MuiChip-icon': { color: '#35d0df' } }} />
          <Typography component="h1" sx={{ maxWidth: 520, fontSize: { md: 52, lg: 60 }, lineHeight: 1, fontWeight: 850, mb: 2 }}>
            Studio quản lý nhạc dành riêng cho nghệ sĩ.
          </Typography>
          <Typography sx={{ maxWidth: 470, color: 'rgba(255,255,255,0.72)', fontSize: 17, lineHeight: 1.7 }}>
            Đăng nhập để theo dõi bài hát, cập nhật hồ sơ nghệ sĩ và xem hiệu quả phát hành của bạn trên MusicFlow.
          </Typography>
          <Stack direction="row" spacing={2} sx={{ mt: 5 }}>
            {[
              { icon: <AlbumOutlined />, label: 'Release' },
              { icon: <GraphicEqOutlined />, label: 'Analytics' },
              { icon: <MicExternalOnOutlined />, label: 'Profile' },
            ].map((item) => (
              <Box key={item.label} sx={{ minWidth: 118, p: 2, borderRadius: 2, color: '#eef7ff', bgcolor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(14px)' }}>
                <Box sx={{ color: '#35d0df', mb: 1, display: 'flex' }}>{item.icon}</Box>
                <Typography fontWeight={800}>{item.label}</Typography>
              </Box>
            ))}
          </Stack>
        </Box>

        <Paper elevation={0} sx={{ p: { xs: 3, sm: 4.5 }, width: '100%', maxWidth: 470, mx: 'auto', borderRadius: 4, bgcolor: 'rgba(255,255,255,0.96)', border: '1px solid rgba(255,255,255,0.65)', boxShadow: '0 26px 80px rgba(0, 0, 0, 0.34)' }}>
          <Box sx={{ textAlign: 'center', mb: 3.5 }}>
            <Box sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 68, height: 68, borderRadius: 3, background: 'linear-gradient(135deg, #00bcd4 0%, #6c63ff 70%)', boxShadow: '0 16px 34px rgba(0, 188, 212, 0.25)', mb: 2.5 }}>
              <MusicNoteIcon sx={{ fontSize: 36, color: '#fff' }} />
            </Box>
            <Typography variant="h4" fontWeight={850} gutterBottom>
              Artist Login
            </Typography>
            <Typography color="text.secondary" sx={{ fontSize: 15.5 }}>
              Đăng nhập tài khoản nghệ sĩ của bạn
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
            <Button type="submit" fullWidth variant="contained" size="large" disabled={loading} sx={{ py: 1.55, borderRadius: 2, fontSize: 16, background: 'linear-gradient(135deg, #00bcd4 0%, #6c63ff 76%)', boxShadow: '0 14px 28px rgba(0, 188, 212, 0.24)', '&:hover': { background: 'linear-gradient(135deg, #00a9bd 0%, #5f57f4 76%)' } }}>
              {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </Button>
          </form>

          <Divider sx={{ my: 2.5 }}>Hoặc</Divider>
          <Button type="button" fullWidth variant="outlined" startIcon={<GoogleIcon />} disabled={!GOOGLE_CLIENT_ID || googleLoading} onClick={handleGoogleLogin} sx={{ py: 1.2, borderRadius: 2, borderColor: '#d8dce6', color: '#db4437', fontWeight: 700 }}>
            {googleLoading ? 'Đang xử lý...' : 'Đăng nhập Artist bằng Google'}
          </Button>
          {!GOOGLE_CLIENT_ID && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              Chưa cấu hình VITE_GOOGLE_CLIENT_ID nên tạm thời ẩn Google Login.
            </Typography>
          )}
          <Box sx={{ mt: 3.5, display: 'flex', gap: 1.5, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button type="button" variant="text" sx={{ color: '#00a9bd', fontWeight: 800 }} onClick={() => navigate('/artist/register')}>
              Đăng ký Artist
            </Button>
            <Button type="button" variant="text" sx={{ color: '#6c63ff', fontWeight: 800 }} onClick={() => navigate('/accountlogin')}>
              Login User
            </Button>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}

export default ArtistLogin;


