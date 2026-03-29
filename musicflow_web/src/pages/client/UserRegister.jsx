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

const UserRegister = () => {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
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
      const res = await axios.post("/api/auth/register", form);
      setMessage(res.data.message || "Đăng ký thành công!");
      // Xóa token cũ nếu có
      localStorage.removeItem('token');
      localStorage.removeItem('role');
      setTimeout(() => {
        window.location.replace('/accountlogin');
      }, 1200);
    } catch (err) {
      setError(err.response?.data?.message || "Đăng ký thất bại");
    }
    setLoading(false);
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #f8fafc 0%, #e0e7ff 100%)' }}>
      <Paper elevation={10} sx={{ p: 4, width: '100%', maxWidth: 400, borderRadius: 3 }}>
        <Typography variant="h5" fontWeight={700} gutterBottom textAlign="center">
          Đăng ký tài khoản User
        </Typography>
        {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <form onSubmit={handleSubmit}>
          <TextField name="name" label="Tên người dùng" fullWidth sx={{ mb: 2 }} value={form.name} onChange={handleChange} required />
          <TextField name="email" label="Email" type="email" fullWidth sx={{ mb: 2 }} value={form.email} onChange={handleChange} required />
          <TextField name="password" label="Mật khẩu" type="password" fullWidth sx={{ mb: 3 }} value={form.password} onChange={handleChange} required minLength={6} />
          <Button type="submit" fullWidth variant="contained" size="large" disabled={loading} sx={{ bgcolor: '#6c63ff', '&:hover': { bgcolor: '#5a52d5' }, py: 1.5 }}>
            {loading ? "Đang đăng ký..." : "Đăng ký"}
          </Button>
        </form>
      </Paper>
    </Box>
  );
};

export default UserRegister;
