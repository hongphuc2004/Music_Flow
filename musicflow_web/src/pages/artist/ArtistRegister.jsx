import React, { useState } from "react";
import { useNavigate } from 'react-router-dom';
import axios from "axios";
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
} from '@mui/material';

const ArtistRegister = () => {
  const [form, setForm] = useState({ name: "", email: "", password: "", avatar: "", bio: "" });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");
    try {
      const res = await axios.post("/api/artist/register", form);
      setMessage(res.data.message || "Đăng ký thành công!");
      // Xóa token cũ nếu có
      localStorage.removeItem('token');
      localStorage.removeItem('role');
      setTimeout(() => {
        window.location.replace('/artistlogin');
      }, 1200);
    } catch (err) {
      setError(err.response?.data?.message || "Đăng ký thất bại");
    }
    setLoading(false);
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #f8fafc 0%, #e0e7ff 100%)' }}>
      <Paper elevation={12} sx={{ p: 4, width: '100%', maxWidth: 420, borderRadius: 4, boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)' }}>
        <Typography variant="h4" fontWeight={800} gutterBottom color="#00bcd4" textAlign="center">
          Đăng ký Artist
        </Typography>
        <Typography color="text.secondary" fontWeight={500} textAlign="center" mb={2}>
          Tạo tài khoản nghệ sĩ để chia sẻ âm nhạc của bạn!
        </Typography>
        {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <form onSubmit={handleSubmit}>
          <TextField name="name" label="Tên nghệ sĩ" fullWidth sx={{ mb: 2 }} value={form.name} onChange={handleChange} required />
          <TextField name="email" label="Email" type="email" fullWidth sx={{ mb: 2 }} value={form.email} onChange={handleChange} required />
          <TextField name="password" label="Mật khẩu" type="password" fullWidth sx={{ mb: 2 }} value={form.password} onChange={handleChange} required minLength={6} />
          <TextField name="avatar" label="Avatar (URL)" fullWidth sx={{ mb: 2 }} value={form.avatar} onChange={handleChange} />
          <TextField name="bio" label="Giới thiệu" fullWidth multiline minRows={2} sx={{ mb: 3 }} value={form.bio} onChange={handleChange} />
          <Button type="submit" fullWidth variant="contained" size="large" disabled={loading} sx={{ bgcolor: '#00bcd4', '&:hover': { bgcolor: '#0097a7' }, py: 1.5, fontWeight: 700, fontSize: 18, letterSpacing: 1 }}>
            {loading ? "Đang đăng ký..." : "Đăng ký"}
          </Button>
        </form>
      </Paper>
    </Box>
  );
};

export default ArtistRegister;
