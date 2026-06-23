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
  AlbumOutlined,
  AlternateEmailOutlined,
  EmailOutlined,
  GraphicEqOutlined,
  ImageOutlined,
  LockOutlined,
  MicExternalOnOutlined,
  MusicNote as MusicNoteIcon,
  PersonOutline,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';

const ArtistRegister = () => {
  const [form, setForm] = useState({ name: '', email: '', password: '', avatar: '', bio: '' });
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
      const res = await api.post('/artist/register', form);
      setMessage(res.data.message || 'Đăng ký thành công!');
      localStorage.removeItem('role');
      setTimeout(() => {
        window.location.replace('/artistlogin');
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
      '& input': {
        color: '#0f172a',
      },
      '& textarea': {
        color: '#0f172a',
      },
      '& .MuiOutlinedInput-notchedOutline': {
        borderColor: 'rgba(15, 23, 42, 0.15)',
      },
      '&:hover .MuiOutlinedInput-notchedOutline': {
        borderColor: 'rgba(15, 23, 42, 0.3)',
      },
      '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
        borderColor: '#6c63ff',
      },
    },
    '& .MuiInputLabel-root': {
      color: '#475569',
      '&.Mui-focused': {
        color: '#6c63ff',
      },
    },
  };

  return (
    <Box sx={{ minHeight: '100vh', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', px: { xs: 2.5, md: 5 }, py: { xs: 4, md: 6 }, background: 'radial-gradient(circle at 16% 20%, rgba(0, 188, 212, 0.24), transparent 28%), radial-gradient(circle at 86% 12%, rgba(108, 99, 255, 0.22), transparent 30%), linear-gradient(135deg, #f1fbff 0%, #f7f5ff 48%, #eef7ff 100%)' }}>
      <Box sx={{ width: '100%', maxWidth: 1120, display: 'grid', gridTemplateColumns: { xs: '1fr', md: '0.95fr 1.05fr' }, gap: { xs: 3, md: 5 }, alignItems: 'center' }}>
        <Paper elevation={0} sx={{ p: { xs: 3, sm: 4.5 }, width: '100%', maxWidth: 520, mx: 'auto', borderRadius: 4, bgcolor: 'rgba(255,255,255,0.96)', border: '1px solid rgba(255,255,255,0.74)', boxShadow: '0 26px 80px rgba(37, 47, 74, 0.18)' }}>
          <Box sx={{ textAlign: 'center', mb: 3.5 }}>
            <Box sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 68, height: 68, borderRadius: 3, background: 'linear-gradient(135deg, #00bcd4 0%, #6c63ff 70%)', boxShadow: '0 16px 34px rgba(0, 188, 212, 0.25)', mb: 2.5 }}>
              <MusicNoteIcon sx={{ fontSize: 36, color: '#fff' }} />
            </Box>
            <Typography variant="h4" fontWeight={850} gutterBottom sx={{ color: '#0f172a' }}>
              Đăng ký Artist
            </Typography>
            <Typography sx={{ fontSize: 15.5, color: '#475569' }}>
              Tạo hồ sơ nghệ sĩ để phát hành và quản lý nhạc
            </Typography>
          </Box>

          {message && <Alert severity="success" sx={{ mb: 2.5, borderRadius: 2 }}>{message}</Alert>}
          {error && <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2 }}>{error}</Alert>}

          <form onSubmit={handleSubmit}>
            <TextField name="name" label="Tên nghệ sĩ" fullWidth sx={fieldSx} value={form.name} onChange={handleChange} required InputProps={{ startAdornment: <InputAdornment position="start"><PersonOutline sx={{ color: '#7c8597' }} /></InputAdornment> }} />
            <TextField name="email" label="Email" type="email" fullWidth sx={fieldSx} value={form.email} onChange={handleChange} required InputProps={{ startAdornment: <InputAdornment position="start"><EmailOutlined sx={{ color: '#7c8597' }} /></InputAdornment> }} />
            <TextField
              name="password"
              label="Mật khẩu"
              type={showPassword ? 'text' : 'password'}
              fullWidth
              sx={fieldSx}
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
            <TextField name="avatar" label="Avatar (URL)" fullWidth sx={fieldSx} value={form.avatar} onChange={handleChange} InputProps={{ startAdornment: <InputAdornment position="start"><ImageOutlined sx={{ color: '#7c8597' }} /></InputAdornment> }} />
            <TextField name="bio" label="Giới thiệu" fullWidth multiline minRows={3} sx={{ ...fieldSx, mb: 3 }} value={form.bio} onChange={handleChange} InputProps={{ startAdornment: <InputAdornment position="start" sx={{ alignSelf: 'flex-start', mt: 1.5 }}><AlternateEmailOutlined sx={{ color: '#7c8597' }} /></InputAdornment> }} />
            <Button type="submit" fullWidth variant="contained" size="large" disabled={loading} sx={{ py: 1.55, borderRadius: 2, fontSize: 16, background: 'linear-gradient(135deg, #00bcd4 0%, #6c63ff 76%)', boxShadow: '0 14px 28px rgba(0, 188, 212, 0.24)', '&:hover': { background: 'linear-gradient(135deg, #00a9bd 0%, #5f57f4 76%)' } }}>
              {loading ? 'Đang đăng ký...' : 'Đăng ký'}
            </Button>
          </form>

          <Box sx={{ mt: 3.5, textAlign: 'center' }}>
            <Button variant="text" sx={{ color: '#00a9bd', fontWeight: 800 }} onClick={() => navigate('/artistlogin')}>
              Đã có tài khoản Artist? Đăng nhập
            </Button>
          </Box>
        </Paper>

        <Box sx={{ color: '#111827', display: { xs: 'none', md: 'block' } }}>
          <Chip icon={<MicExternalOnOutlined />} label="Creator profile" sx={{ mb: 3, color: '#175a66', bgcolor: 'rgba(255,255,255,0.72)', border: '1px solid rgba(23,90,102,0.14)', '& .MuiChip-icon': { color: '#00bcd4' } }} />
          <Typography component="h1" sx={{ maxWidth: 540, fontSize: { md: 52, lg: 60 }, lineHeight: 1, fontWeight: 850, mb: 2 }}>
            Đưa âm nhạc của bạn lên MusicFlow.
          </Typography>
          <Typography sx={{ maxWidth: 480, color: '#536070', fontSize: 17, lineHeight: 1.7 }}>
            Tạo hồ sơ nghệ sĩ, quản lý bài phát hành và xây dựng sự hiện diện của bạn với người nghe.
          </Typography>
          <Stack direction="row" spacing={2} sx={{ mt: 5 }}>
            {[
              { icon: <AlbumOutlined />, label: 'Phát hành' },
              { icon: <GraphicEqOutlined />, label: 'Theo dõi' },
              { icon: <MicExternalOnOutlined />, label: 'Hồ sơ' },
            ].map((item) => (
              <Box key={item.label} sx={{ minWidth: 118, p: 2, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.68)', border: '1px solid rgba(17,24,39,0.08)', boxShadow: '0 18px 42px rgba(37, 47, 74, 0.08)' }}>
                <Box sx={{ color: '#00bcd4', mb: 1, display: 'flex' }}>{item.icon}</Box>
                <Typography fontWeight={800}>{item.label}</Typography>
              </Box>
            ))}
          </Stack>
        </Box>
      </Box>
    </Box>
  );
};

export default ArtistRegister;
