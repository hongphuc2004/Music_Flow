import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
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
  MusicNote as MusicNoteIcon,
  EmailOutlined,
  LockOutlined,
  AdminPanelSettingsOutlined,
  GraphicEqOutlined,
  LibraryMusicOutlined,
  ShieldOutlined,
} from '@mui/icons-material';
import { authApi, setAccessToken } from '../../services/api';

function AdminLogin() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (field) => (event) => {
    setFormData({ ...formData, [field]: event.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await authApi.login(formData);
      const { token, user } = res.data;
      if (user.role !== 'admin') {
        setError('Bạn không có quyền truy cập admin!');
        setLoading(false);
        return;
      }
      setAccessToken(token);
      localStorage.setItem('role', user.role);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Email hoặc mật khẩu không đúng');
    } finally {
      setLoading(false);
    }
  };

  const featureCards = [
    { icon: <LibraryMusicOutlined />, label: 'Kho nhạc' },
    { icon: <GraphicEqOutlined />, label: 'Thống kê' },
    { icon: <AdminPanelSettingsOutlined />, label: 'Quyền admin' },
  ];

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
          'radial-gradient(circle at 12% 18%, rgba(44, 211, 225, 0.2), transparent 28%), radial-gradient(circle at 88% 10%, rgba(126, 87, 194, 0.24), transparent 30%), linear-gradient(135deg, #0b1020 0%, #101a2f 45%, #172035 100%)',
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
          maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.75), transparent)',
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
        <Box sx={{ color: '#fff', display: { xs: 'none', md: 'block' } }}>
          <Chip
            icon={<ShieldOutlined />}
            label="Admin workspace"
            sx={{
              mb: 3,
              color: '#d7fbff',
              bgcolor: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.16)',
              '& .MuiChip-icon': { color: '#47d7e8' },
            }}
          />
          <Typography
            component="h1"
            sx={{
              maxWidth: 520,
              fontSize: { md: 52, lg: 60 },
              lineHeight: 1,
              fontWeight: 800,
              mb: 2,
            }}
          >
            Chào mừng trở lại.
          </Typography>
          <Typography sx={{ maxWidth: 470, color: 'rgba(255,255,255,0.72)', fontSize: 17, lineHeight: 1.7 }}>
            Đăng nhập để quản lý tài khoản, bài hát, playlist và chủ đề trong một không gian điều hành riêng cho admin.
          </Typography>

          <Stack direction="row" spacing={2} sx={{ mt: 5 }}>
            {featureCards.map((item) => (
              <Box
                key={item.label}
                sx={{
                  minWidth: 118,
                  p: 2,
                  borderRadius: 2,
                  color: '#eef7ff',
                  bgcolor: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  backdropFilter: 'blur(14px)',
                }}
              >
                <Box sx={{ color: '#48d8e8', mb: 1, display: 'flex' }}>{item.icon}</Box>
                <Typography fontWeight={700}>{item.label}</Typography>
              </Box>
            ))}
          </Stack>
        </Box>

        <Paper
          elevation={0}
          sx={{
            p: { xs: 3, sm: 4.5 },
            width: '100%',
            maxWidth: 460,
            mx: 'auto',
            borderRadius: 4,
            bgcolor: 'rgba(255,255,255,0.96)',
            border: '1px solid rgba(255,255,255,0.65)',
            boxShadow: '0 26px 80px rgba(0, 0, 0, 0.34)',
          }}
        >
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 68,
                height: 68,
                borderRadius: 3,
                background: 'linear-gradient(135deg, #35d0df 0%, #6c63ff 58%, #9b5cff 100%)',
                boxShadow: '0 16px 34px rgba(108, 99, 255, 0.32)',
                mb: 2.5,
              }}
            >
              <MusicNoteIcon sx={{ fontSize: 36, color: '#fff' }} />
            </Box>
            <Typography variant="h4" fontWeight={800} gutterBottom>
              MusicFlow Admin
            </Typography>
            <Typography color="text.secondary" sx={{ fontSize: 15.5 }}>
              Đăng nhập vào bảng điều khiển quản trị
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
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
              sx={{
                mb: 2,
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  bgcolor: '#f7f8fb',
                },
              }}
              required
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <EmailOutlined sx={{ color: '#7c8597' }} />
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              fullWidth
              label="Mật khẩu"
              type={showPassword ? 'text' : 'password'}
              value={formData.password}
              onChange={handleChange('password')}
              sx={{
                mb: 3,
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  bgcolor: '#f7f8fb',
                },
              }}
              required
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockOutlined sx={{ color: '#7c8597' }} />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                      aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
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
                py: 1.55,
                borderRadius: 2,
                fontSize: 16,
                background: 'linear-gradient(135deg, #35d0df 0%, #6c63ff 70%)',
                boxShadow: '0 14px 28px rgba(108, 99, 255, 0.3)',
                '&:hover': {
                  boxShadow: '0 16px 32px rgba(108, 99, 255, 0.4)',
                  background: 'linear-gradient(135deg, #24c0d0 0%, #5f57f4 70%)',
                },
              }}
            >
              {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </Button>
          </form>
        </Paper>
      </Box>
    </Box>
  );
}

export default AdminLogin;
