import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  EmailOutlined,
  FavoriteBorderOutlined,
  LibraryMusicOutlined,
  LockOutlined,
  MusicNote as MusicNoteIcon,
  PersonOutline,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';

const UserRegister = () => {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');
    try {
      const res = await api.post('/auth/register', form);
      setMessage(res.data.message || 'Đăng ký thành công!');
      localStorage.removeItem('role');
      setTimeout(() => {
        window.location.replace('/client/home?auth=login');
      }, 1200);
    } catch (err) {
      setError(err.response?.data?.message || 'Đăng ký thất bại');
    }
    setLoading(false);
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
          'radial-gradient(circle at 16% 20%, rgba(255, 107, 129, 0.2), transparent 28%), radial-gradient(circle at 86% 12%, rgba(53, 208, 223, 0.22), transparent 30%), linear-gradient(135deg, #fff7fb 0%, #f2fbff 48%, #f7f5ff 100%)',
      }}
    >
      <Box sx={{ width: '100%', maxWidth: 1080, display: 'grid', gridTemplateColumns: { xs: '1fr', md: '0.95fr 1.05fr' }, gap: { xs: 3, md: 5 }, alignItems: 'center' }}>
        <Paper elevation={0} sx={{ p: { xs: 3, sm: 4.5 }, width: '100%', maxWidth: 470, mx: 'auto', borderRadius: 4, bgcolor: 'rgba(255,255,255,0.95)', border: '1px solid rgba(255,255,255,0.76)', boxShadow: '0 26px 80px rgba(37, 47, 74, 0.16)' }}>
          <Box sx={{ textAlign: 'center', mb: 3.5 }}>
            <Box sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 68, height: 68, borderRadius: 3, background: 'linear-gradient(135deg, #ff6b81 0%, #6c63ff 55%, #35d0df 100%)', boxShadow: '0 16px 34px rgba(108, 99, 255, 0.24)', mb: 2.5 }}>
              <MusicNoteIcon sx={{ fontSize: 36, color: '#fff' }} />
            </Box>
            <Typography variant="h4" fontWeight={850} gutterBottom>
              Tạo tài khoản
            </Typography>
            <Typography color="text.secondary" sx={{ fontSize: 15.5 }}>
              Bắt đầu thư viện nhạc cá nhân trên MusicFlow
            </Typography>
          </Box>

          {message && <Alert severity="success" sx={{ mb: 2.5, borderRadius: 2 }}>{message}</Alert>}
          {error && <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2 }}>{error}</Alert>}

          <form onSubmit={handleSubmit}>
            <TextField name="name" label="Tên người dùng" fullWidth sx={fieldSx} value={form.name} onChange={handleChange} required InputProps={{ startAdornment: <InputAdornment position="start"><PersonOutline sx={{ color: '#7c8597' }} /></InputAdornment> }} />
            <TextField name="email" label="Email" type="email" fullWidth sx={fieldSx} value={form.email} onChange={handleChange} required InputProps={{ startAdornment: <InputAdornment position="start"><EmailOutlined sx={{ color: '#7c8597' }} /></InputAdornment> }} />
            <TextField
              name="password"
              label="Mật khẩu"
              type={showPassword ? 'text' : 'password'}
              fullWidth
              sx={{ ...fieldSx, mb: 3 }}
              value={form.password}
              onChange={handleChange}
              required
              inputProps={{ minLength: 6 }}
              InputProps={{
                startAdornment: <InputAdornment position="start"><LockOutlined sx={{ color: '#7c8597' }} /></InputAdornment>,
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <Button type="submit" fullWidth variant="contained" size="large" disabled={loading} sx={{ py: 1.55, borderRadius: 2, fontSize: 16, background: 'linear-gradient(135deg, #ff6b81 0%, #6c63ff 72%)', boxShadow: '0 14px 28px rgba(108, 99, 255, 0.24)', '&:hover': { background: 'linear-gradient(135deg, #f35f76 0%, #5f57f4 72%)' } }}>
              {loading ? 'Đang đăng ký...' : 'Đăng ký'}
            </Button>
          </form>

          <Box sx={{ mt: 3.5, textAlign: 'center' }}>
            <Button variant="text" sx={{ color: '#6c63ff', fontWeight: 800 }} onClick={() => navigate('/client/home?auth=login')}>
              Đã có tài khoản? Đăng nhập
            </Button>
          </Box>
        </Paper>

        <Box sx={{ color: '#111827', display: { xs: 'none', md: 'block' } }}>
          <Chip label="New listener" sx={{ mb: 3, color: '#6f3140', bgcolor: 'rgba(255,255,255,0.72)', border: '1px solid rgba(111,49,64,0.12)' }} />
          <Typography component="h1" sx={{ maxWidth: 520, fontSize: { md: 52, lg: 60 }, lineHeight: 1, fontWeight: 850, mb: 2 }}>
            Một tài khoản, cả thế giới nhạc theo bạn.
          </Typography>
          <Typography sx={{ maxWidth: 470, color: '#536070', fontSize: 17, lineHeight: 1.7 }}>
            Lưu bài hát yêu thích, tạo playlist và tiếp tục nghe ở bất cứ đâu với hồ sơ cá nhân của bạn.
          </Typography>
          <Stack direction="row" spacing={2} sx={{ mt: 5 }}>
            {[
              { icon: <FavoriteBorderOutlined />, label: 'Lưu gu nhạc' },
              { icon: <LibraryMusicOutlined />, label: 'Playlist riêng' },
            ].map((item) => (
              <Box key={item.label} sx={{ minWidth: 144, p: 2, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.68)', border: '1px solid rgba(17,24,39,0.08)', boxShadow: '0 18px 42px rgba(37, 47, 74, 0.08)' }}>
                <Box sx={{ color: '#ff6b81', mb: 1, display: 'flex' }}>{item.icon}</Box>
                <Typography fontWeight={800}>{item.label}</Typography>
              </Box>
            ))}
          </Stack>
        </Box>
      </Box>
    </Box>
  );
};

export default UserRegister;
