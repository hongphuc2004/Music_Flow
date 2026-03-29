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
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  MusicNote as MusicNoteIcon,
} from '@mui/icons-material';
import axios from 'axios';

function ArtistLogin() {
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
      const res = await axios.post('/api/artist/login', formData);
      const { token, artist } = res.data;
      localStorage.setItem('token', token);
      localStorage.setItem('role', artist.role);
      localStorage.setItem('artistName', artist.name); // Lưu tên artist để fetch bài hát
      navigate('/artist/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Email hoặc mật khẩu không đúng');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #f8fafc 0%, #e0e7ff 100%)' }}>
      <Paper elevation={12} sx={{ p: 4, width: '100%', maxWidth: 420, borderRadius: 4, boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)' }}>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Box sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 70, height: 70, borderRadius: '50%', background: 'linear-gradient(135deg, #00bcd4 0%, #6c63ff 100%)', mb: 2, boxShadow: '0 4px 16px 0 rgba(108,99,255,0.15)' }}>
            <MusicNoteIcon sx={{ fontSize: 38, color: '#fff' }} />
          </Box>
          <Typography variant="h4" fontWeight={800} gutterBottom color="#00bcd4">
            Artist Login
          </Typography>
          <Typography color="text.secondary" fontWeight={500}>
            Đăng nhập tài khoản nghệ sĩ để quản lý nhạc của bạn!
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
            sx={{ bgcolor: '#00bcd4', '&:hover': { bgcolor: '#0097a7' }, py: 1.5, fontWeight: 700, fontSize: 18, letterSpacing: 1 }}
          >
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </Button>
        </form>
        <Box sx={{ mt: 4, textAlign: 'center' }}>
          <Typography variant="body1" fontWeight={500} mb={1}>
            Bạn chưa có tài khoản nghệ sĩ?
          </Typography>
          <Button
            variant="outlined"
            sx={{ borderColor: '#00bcd4', color: '#00bcd4', fontWeight: 600 }}
            onClick={() => navigate('/artist/register')}
          >
            Đăng ký Artist
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}

export default ArtistLogin;
