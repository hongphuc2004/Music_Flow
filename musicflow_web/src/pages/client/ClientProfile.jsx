import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Button,
  CircularProgress,
  Grid,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ClientLayout from '../../components/Layout/client/ClientLayout';
import { clientUserApi } from '../../services/api';

function ClientProfile() {
  const [form, setForm] = useState({ name: '', email: '', avatarUrl: '' });
  const [avatarFile, setAvatarFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const interactivePanelSx = {
    borderRadius: 3,
    border: '1px solid #e2e8f0',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
    '&:hover': {
      transform: 'translateY(-2px)',
      borderColor: '#14b8a6',
      boxShadow: '0 18px 32px -26px rgba(13, 95, 89, 0.7)',
    },
  };

  const userName = useMemo(() => form.name || 'Listener', [form.name]);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await clientUserApi.getMe();
        const user = response.data?.user;

        setForm({
          name: user?.name || '',
          email: user?.email || '',
          avatarUrl: user?.avatar || '',
        });

        localStorage.setItem('userName', user?.name || '');
        localStorage.setItem('email', user?.email || '');
        localStorage.setItem('userId', user?._id || '');
      } catch (err) {
        setError(err.response?.data?.message || 'Khong the tai thong tin tai khoan.');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');

      const payload = new FormData();
      payload.append('name', form.name.trim());
      if (form.avatarUrl) payload.append('avatarUrl', form.avatarUrl.trim());
      if (avatarFile) payload.append('avatar', avatarFile);

      const response = await clientUserApi.updateMe(payload);
      const user = response.data?.user;

      setForm((prev) => ({
        ...prev,
        name: user?.name || prev.name,
        avatarUrl: user?.avatar || prev.avatarUrl,
      }));
      setAvatarFile(null);
      setSuccess('Da cap nhat thong tin tai khoan.');

      localStorage.setItem('userName', user?.name || form.name || '');
      localStorage.setItem('email', user?.email || form.email || '');
      localStorage.setItem('userId', user?._id || localStorage.getItem('userId') || '');
    } catch (err) {
      setError(err.response?.data?.message || 'Cap nhat that bai.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ClientLayout title="Thong tin tai khoan">
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper sx={{ ...interactivePanelSx, p: 3, textAlign: 'center' }}>
            {loading ? (
              <CircularProgress size={28} />
            ) : (
              <Avatar src={form.avatarUrl} sx={{ width: 88, height: 88, mx: 'auto', mb: 1.5, bgcolor: '#14b8a6', fontSize: 34 }}>
              {userName.charAt(0).toUpperCase()}
              </Avatar>
            )}
            <Typography variant="h6" sx={{ fontWeight: 800 }}>{userName}</Typography>
            <Typography color="text.secondary">User</Typography>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 8 }}>
          <Paper sx={{ ...interactivePanelSx, p: 3 }}>
            <Stack spacing={2}>
              <TextField
                label="Ten hien thi"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                fullWidth
              />
              <TextField label="Email" value={form.email} fullWidth disabled />
              <TextField
                label="Avatar URL"
                value={form.avatarUrl}
                onChange={(event) => setForm((prev) => ({ ...prev, avatarUrl: event.target.value }))}
                fullWidth
              />
              <Button variant="outlined" component="label" sx={{ width: 'fit-content' }}>
                {avatarFile ? `Anh da chon: ${avatarFile.name}` : 'Tai len avatar (tuy chon)'}
                <input hidden type="file" accept="image/*" onChange={(event) => setAvatarFile(event.target.files?.[0] || null)} />
              </Button>
              <Button
                variant="contained"
                onClick={handleSave}
                disabled={saving || loading}
                sx={{
                  width: 'fit-content',
                  bgcolor: '#0f766e',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease',
                  '&:hover': {
                    bgcolor: '#0d5f59',
                    transform: 'translateY(-1px)',
                    boxShadow: '0 12px 24px -18px rgba(13, 95, 89, 0.7)',
                  },
                }}
              >
                Luu thay doi
              </Button>
            </Stack>
          </Paper>
        </Grid>
      </Grid>
    </ClientLayout>
  );
}

export default ClientProfile;
