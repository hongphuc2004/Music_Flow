import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  IconButton,
  Avatar,
  Chip,
  TextField,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  CircularProgress,
  Alert,
  Select,
  MenuItem,
  Stack,
  Tooltip,
  Grid,
  Card,
} from '@mui/material';
import {
  Search as SearchIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Edit as EditIcon,
  Add as AddIcon,
  PeopleRounded as PeopleIcon,
  AdminPanelSettingsRounded as AdminIcon,
  MusicNoteRounded as ArtistIcon,
  PersonRounded as UserIcon,
  AutoAwesomeRounded as AiQuotaIcon,
  Close as CloseIcon,
  FlashOn as FlashIcon,
} from '@mui/icons-material';
import { Layout } from '../../components/Layout';

import { accountsApi } from '../../services/admin/admin.service';
import useAppToast from '../../components/common/useAppToast';

const emptyEditForm = {
  name: '',
  email: '',
  role: 'user',
  bio: '',
  password: '',
};

const emptyCreateForm = {
  name: '',
  email: '',
  role: 'user',
  bio: '',
  password: '',
};

function Accounts() {
  const { showToast } = useAppToast();
  const [allAccounts, setAllAccounts] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [total, setTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteDialog, setDeleteDialog] = useState({ open: false, user: null });
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [roleLoading, setRoleLoading] = useState(null);
  const [editDialog, setEditDialog] = useState({ open: false, user: null });
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [editLoading, setEditLoading] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [createLoading, setCreateLoading] = useState(false);

  // AI Quota management state
  const [aiQuotaDialog, setAiQuotaDialog] = useState({
    open: false,
    user: null,
    loading: false,
    saving: false,
    info: null,
    customAiLimit: '',
    bonusAiQuota: 0,
  });

  const handleOpenAiQuota = async (user) => {
    setAiQuotaDialog({
      open: true,
      user,
      loading: true,
      saving: false,
      info: null,
      customAiLimit: '',
      bonusAiQuota: 0,
    });

    try {
      const res = await accountsApi.getUserAiQuota(user._id);
      if (res.data?.success) {
        const info = res.data.data;
        setAiQuotaDialog({
          open: true,
          user,
          loading: false,
          saving: false,
          info,
          customAiLimit: info.customAiLimit !== null && info.customAiLimit !== undefined ? String(info.customAiLimit) : '',
          bonusAiQuota: info.bonusAiQuota || 0,
        });
      }
    } catch (err) {
      showToast({ message: err.response?.data?.message || 'Không thể lấy thông tin hạn mức AI.', severity: 'error' });
      setAiQuotaDialog((prev) => ({ ...prev, loading: false }));
    }
  };

  const handleCloseAiQuota = () => {
    setAiQuotaDialog({ open: false, user: null, loading: false, saving: false, info: null, customAiLimit: '', bonusAiQuota: 0 });
  };

  const handleSaveAiQuota = async () => {
    if (!aiQuotaDialog.user) return;
    setAiQuotaDialog((prev) => ({ ...prev, saving: true }));

    try {
      const payload = {
        customAiLimit: aiQuotaDialog.customAiLimit === '' ? null : Number(aiQuotaDialog.customAiLimit),
        bonusAiQuota: Number(aiQuotaDialog.bonusAiQuota || 0),
      };

      const res = await accountsApi.updateUserAiQuota(aiQuotaDialog.user._id, payload);
      if (res.data?.success) {
        showToast({ message: 'Cập nhật hạn mức AI thành công!', severity: 'success' });
        handleCloseAiQuota();
        fetchAccounts();
      }
    } catch (err) {
      showToast({ message: err.response?.data?.message || 'Lỗi khi cập nhật hạn mức AI.', severity: 'error' });
      setAiQuotaDialog((prev) => ({ ...prev, saving: false }));
    }
  };


  const fetchAccounts = useCallback(async () => {
    try {
      setLoading(true);
      const response = await accountsApi.getAll();
      const accounts = [...(response.data.accounts || [])].sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );
      setAllAccounts(accounts);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load accounts. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = query
      ? allAccounts.filter((acc) =>
          (acc.name && acc.name.toLowerCase().includes(query)) ||
          (acc.email && acc.email.toLowerCase().includes(query))
        )
      : allAccounts;

    setTotal(filtered.length);
    setUsers(filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage));
  }, [allAccounts, searchQuery, page, rowsPerPage]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  // Derived stats overview
  const stats = useMemo(() => {
    const totalCount = allAccounts.length;
    const adminCount = allAccounts.filter(a => a.role === 'admin').length;
    const artistCount = allAccounts.filter(a => a.role === 'artist').length;
    const userCount = totalCount - adminCount - artistCount;
    return { totalCount, adminCount, artistCount, userCount };
  }, [allAccounts]);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    setPage(0);
  };

  const openCreateDialog = () => {
    setCreateDialogOpen(true);
    setCreateForm(emptyCreateForm);
    setError(null);
    setSuccess(null);
  };

  const closeCreateDialog = () => {
    setCreateDialogOpen(false);
    setCreateForm(emptyCreateForm);
    setCreateLoading(false);
  };

  const handleCreateFieldChange = (field) => (event) => {
    setCreateForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleCreateAccount = async () => {
    const payload = {
      name: createForm.name.trim(),
      email: createForm.email.trim(),
      password: createForm.password.trim(),
      role: createForm.role,
    };

    if (!payload.name || !payload.email || !payload.password) {
      const message = 'Name, email, and password are required.';
      setError(message);
      showToast({ severity: 'warning', title: 'Missing information', message });
      return;
    }

    if (payload.role === 'artist') {
      payload.bio = createForm.bio.trim();
    }

    try {
      setCreateLoading(true);
      await accountsApi.create(payload);
      setSuccess('Account created successfully.');
      showToast({ severity: 'success', title: 'Success!', message: 'Account created successfully.' });
      closeCreateDialog();
      fetchAccounts();
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to create account.';
      setError(message);
      showToast({ severity: 'error', title: 'Create failed', message });
    } finally {
      setCreateLoading(false);
    }
  };

  const handleOpenEdit = (user) => {
    setEditDialog({ open: true, user });
    setEditForm({
      name: user.name || '',
      email: user.email || '',
      role: user.role || 'user',
      bio: user.bio || '',
      password: '',
    });
    setError(null);
    setSuccess(null);
  };

  const handleCloseEdit = () => {
    setEditDialog({ open: false, user: null });
    setEditForm(emptyEditForm);
    setEditLoading(false);
  };

  const handleEditFieldChange = (field) => (event) => {
    setEditForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSaveEdit = async () => {
    if (!editDialog.user) return;

    const payload = {
      name: editForm.name.trim(),
      email: editForm.email.trim(),
    };

    if (!payload.name || !payload.email) {
      const message = 'Name and email are required.';
      setError(message);
      showToast({ severity: 'warning', title: 'Missing information', message });
      return;
    }

    if (editDialog.user.role === 'artist') {
      payload.bio = editForm.bio.trim();
    } else {
      payload.role = editForm.role;
    }

    if (editForm.password.trim()) {
      payload.password = editForm.password.trim();
    }

    try {
      setEditLoading(true);
      await accountsApi.update(editDialog.user._id, payload);
      setSuccess('Account updated successfully.');
      showToast({ severity: 'success', title: 'Success!', message: 'Account updated successfully.' });
      handleCloseEdit();
      fetchAccounts();
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to update account.';
      setError(message);
      showToast({ severity: 'error', title: 'Update failed', message });
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog.user) return;
    try {
      setDeleteLoading(true);
      await accountsApi.delete(deleteDialog.user._id);
      setDeleteDialog({ open: false, user: null });
      setSuccess('Account deleted successfully.');
      showToast({ severity: 'success', title: 'Success!', message: 'Account deleted successfully.' });
      fetchAccounts();
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to delete account.';
      setError(message);
      showToast({ severity: 'error', title: 'Delete failed', message });
    } finally {
      setDeleteLoading(false);
    }
  };

  const getProviderColor = (provider) => {
    switch (provider) {
      case 'google':
        return '#db4437';
      case 'local':
        return '#6c63ff';
      case 'artist':
        return '#ff9800';
      default:
        return '#9e9e9e';
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    const user = users.find((item) => item._id === userId);
    if (!user || user.role === 'artist') {
      const message = 'Cannot change role of artist account.';
      setError(message);
      showToast({ severity: 'warning', title: 'Role unchanged', message });
      return;
    }

    try {
      setRoleLoading(userId);
      await accountsApi.update(userId, { role: newRole });
      setSuccess('Role updated successfully.');
      showToast({ severity: 'success', title: 'Success!', message: 'Role updated successfully.' });
      fetchAccounts();
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to update role.';
      setError(message);
      showToast({ severity: 'error', title: 'Update failed', message });
    } finally {
      setRoleLoading(null);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <Layout title="Accounts Studio">
      <Stack spacing={3.5}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Stack spacing={0.5}>
            <Typography variant="h4" fontWeight={900} sx={{ letterSpacing: '-1px' }}>
              Accounts Workspace
            </Typography>
            <Typography variant="body2" color="text.secondary" fontWeight={500}>
              Quản trị tài khoản thành viên hệ thống MusicFlow (Người dùng, Nghệ sĩ, Quản trị viên).
            </Typography>
          </Stack>
          <Stack direction="row" spacing={1.5}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={openCreateDialog}
              sx={{
                bgcolor: '#6c63ff',
                fontWeight: 800,
                textTransform: 'none',
                borderRadius: 3.5,
                px: 3,
                '&:hover': { bgcolor: '#534bae' },
              }}
            >
              Tạo tài khoản
            </Button>
            <IconButton onClick={fetchAccounts} disabled={loading} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
              <RefreshIcon />
            </IconButton>
          </Stack>
        </Box>

        {error && (
          <Alert severity="error" variant="filled" onClose={() => setError(null)} sx={{ borderRadius: 4 }}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" variant="filled" onClose={() => setSuccess(null)} sx={{ borderRadius: 4 }}>
            {success}
          </Alert>
        )}

        {/* Dashboard Stats Overview */}
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Paper elevation={0} sx={{ p: 2.5, borderRadius: 5, border: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ p: 1.5, borderRadius: 3, bgcolor: 'rgba(108, 99, 255, 0.08)', color: '#6c63ff' }}>
                <PeopleIcon />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={700}>TOTAL ACCOUNTS</Typography>
                <Typography variant="h5" fontWeight={900}>{stats.totalCount}</Typography>
              </Box>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Paper elevation={0} sx={{ p: 2.5, borderRadius: 5, border: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ p: 1.5, borderRadius: 3, bgcolor: 'rgba(211, 47, 47, 0.08)', color: '#d32f2f' }}>
                <AdminIcon />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={700}>ADMINISTRATORS</Typography>
                <Typography variant="h5" fontWeight={900}>{stats.adminCount}</Typography>
              </Box>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Paper elevation={0} sx={{ p: 2.5, borderRadius: 5, border: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ p: 1.5, borderRadius: 3, bgcolor: 'rgba(255, 152, 0, 0.08)', color: '#ff9800' }}>
                <ArtistIcon />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={700}>ARTISTS</Typography>
                <Typography variant="h5" fontWeight={900}>{stats.artistCount}</Typography>
              </Box>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Paper elevation={0} sx={{ p: 2.5, borderRadius: 5, border: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ p: 1.5, borderRadius: 3, bgcolor: 'rgba(25, 118, 210, 0.08)', color: '#1976d2' }}>
                <UserIcon />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={700}>STANDARD USERS</Typography>
                <Typography variant="h5" fontWeight={900}>{stats.userCount}</Typography>
              </Box>
            </Paper>
          </Grid>
        </Grid>

        {/* Filters and Table */}
        <Card elevation={0} sx={{ borderRadius: 6, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', overflow: 'hidden' }}>
          <Box sx={{ p: 2.5, borderBottom: '1px solid', borderColor: 'divider', bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.01)' : 'rgba(0,0,0,0.01)' }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Tìm kiếm tài khoản theo tên hiển thị hoặc email..."
              value={searchQuery}
              onChange={handleSearchChange}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="primary" />
                  </InputAdornment>
                ),
                sx: {
                  borderRadius: 4,
                  bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.03)' : '#f8fafc',
                }
              }}
            />
          </Box>

          <TableContainer>
            {loading ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 8, gap: 2 }}>
                <CircularProgress size={36} sx={{ color: '#6c63ff' }} />
                <Typography variant="body2" color="text.secondary" fontWeight={600}>Đang tải danh sách thành viên...</Typography>
              </Box>
            ) : (
              <Table sx={{ minWidth: 700 }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : '#f8fafc' }}>
                    <TableCell sx={{ fontWeight: 800, color: 'text.secondary', pl: 3 }}>Thành viên</TableCell>
                    <TableCell sx={{ fontWeight: 800, color: 'text.secondary' }}>Email</TableCell>
                    <TableCell sx={{ fontWeight: 800, color: 'text.secondary' }}>Vai trò (Role)</TableCell>
                    <TableCell sx={{ fontWeight: 800, color: 'text.secondary' }}>Đăng nhập qua</TableCell>
                    <TableCell sx={{ fontWeight: 800, color: 'text.secondary' }}>Ngày tham gia</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800, color: 'text.secondary', pr: 3 }}>Hành động</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 8, color: 'text.secondary' }}>
                        Không tìm thấy tài khoản phù hợp.
                      </TableCell>
                    </TableRow>
                  ) : (
                    users.map((user) => (
                      <TableRow key={user._id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                        <TableCell sx={{ pl: 3 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Avatar src={user.avatar} sx={{ bgcolor: '#6c63ff', width: 42, height: 42, boxShadow: '0 2px 6px rgba(0,0,0,0.08)' }}>
                              {user.name?.charAt(0)?.toUpperCase()}
                            </Avatar>
                            <Box sx={{ minWidth: 0 }}>
                              <Typography fontWeight={700} noWrap sx={{ maxWidth: 180 }}>{user.name}</Typography>
                              {user.role === 'artist' && user.bio && (
                                <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', maxWidth: 200 }}>
                                  {user.bio}
                                </Typography>
                              )}
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell sx={{ fontWeight: 500 }}>{user.email}</TableCell>
                        <TableCell>
                          <Select
                            size="small"
                            value={user.role || 'user'}
                            onChange={(e) => handleRoleChange(user._id, e.target.value)}
                            disabled={roleLoading === user._id || user.role === 'artist'}
                            sx={{
                              minWidth: 110,
                              borderRadius: 2.5,
                              '& .MuiSelect-select': {
                                py: 0.75,
                                color: user.role === 'admin' ? '#d32f2f' : user.role === 'artist' ? '#ff9800' : '#1976d2',
                                fontWeight: 700,
                                fontSize: '0.85rem'
                              },
                            }}
                          >
                            <MenuItem value="user">User</MenuItem>
                            <MenuItem value="admin">Admin</MenuItem>
                            {user.role === 'artist' && (
                              <MenuItem value="artist" disabled>
                                Artist
                              </MenuItem>
                            )}
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={user.provider || user.role || 'local'}
                            size="small"
                            sx={{
                              bgcolor: `${getProviderColor(user.provider || user.role)}12`,
                              color: getProviderColor(user.provider || user.role),
                              fontWeight: 700,
                              fontSize: '0.75rem',
                              textTransform: 'capitalize',
                              borderRadius: 2,
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ color: 'text.secondary', fontWeight: 500 }}>
                          {formatDate(user.createdAt)}
                        </TableCell>
                        <TableCell align="right" sx={{ pr: 3 }}>
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            <Tooltip title="Quản lý Hạn Mức AI (Rate Limit)" arrow>
                              <IconButton
                                size="small"
                                onClick={() => handleOpenAiQuota(user)}
                                sx={{
                                  color: '#8b5cf6',
                                  bgcolor: 'rgba(139,92,246,0.08)',
                                  borderRadius: 3,
                                  border: '1px solid rgba(139,92,246,0.2)',
                                  '&:hover': { bgcolor: 'rgba(139,92,246,0.18)' },
                                }}
                              >
                                <AiQuotaIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Hiệu chỉnh thông tin" arrow>
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => handleOpenEdit(user)}
                                sx={{ bgcolor: 'rgba(108,99,255,0.06)', borderRadius: 3, border: '1px solid rgba(108,99,255,0.1)' }}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Xóa tài khoản" arrow>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => setDeleteDialog({ open: true, user })}
                                sx={{ bgcolor: 'rgba(211,47,47,0.06)', borderRadius: 3, border: '1px solid rgba(211,47,47,0.1)' }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>

                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </TableContainer>
          {!loading && allAccounts.length > 0 && (
            <TablePagination
              rowsPerPageOptions={[5, 10, 25]}
              component="div"
              count={total}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              sx={{ borderTop: '1px solid', borderColor: 'divider' }}
            />
          )}
        </Card>
      </Stack>

      {/* Add Dialog */}
      <Dialog 
        open={createDialogOpen} 
        onClose={closeCreateDialog} 
        fullWidth 
        maxWidth="sm"
        PaperProps={{ sx: { borderRadius: 6, overflow: 'hidden' } }}
      >
        <Box sx={{ background: 'linear-gradient(135deg, #6c63ff 0%, #00bcd4 100%)', p: 3.5, color: '#fff' }}>
          <Typography variant="h5" fontWeight={900}>Tạo tài khoản mới</Typography>
          <Typography variant="body2" sx={{ opacity: 0.85, mt: 0.5 }}>Cung cấp thông tin đầy đủ để thiết lập tài khoản thành viên thủ công.</Typography>
        </Box>
        <DialogContent sx={{ p: 4, pt: 3.5 }}>
          <Stack spacing={2.5}>
            <TextField
              label="Họ và tên hiển thị *"
              fullWidth
              value={createForm.name}
              onChange={handleCreateFieldChange('name')}
              InputProps={{ sx: { borderRadius: 3.5 } }}
            />
            <TextField
              label="Địa chỉ Email *"
              fullWidth
              type="email"
              value={createForm.email}
              onChange={handleCreateFieldChange('email')}
              InputProps={{ sx: { borderRadius: 3.5 } }}
            />
            <TextField
              select
              label="Phân quyền (Role) *"
              fullWidth
              value={createForm.role}
              onChange={handleCreateFieldChange('role')}
              InputProps={{ sx: { borderRadius: 3.5 } }}
            >
              <MenuItem value="user">User (Thành viên nghe nhạc)</MenuItem>
              <MenuItem value="admin">Admin (Quản trị hệ thống)</MenuItem>
              <MenuItem value="artist">Artist (Nghệ sĩ phát hành)</MenuItem>
            </TextField>
            {createForm.role === 'artist' && (
              <TextField
                label="Tiểu sử nghệ sĩ (Bio)"
                fullWidth
                multiline
                minRows={3}
                value={createForm.bio}
                onChange={handleCreateFieldChange('bio')}
                InputProps={{ sx: { borderRadius: 3.5 } }}
              />
            )}
            <TextField
              label="Mật khẩu thiết lập *"
              fullWidth
              type="password"
              value={createForm.password}
              onChange={handleCreateFieldChange('password')}
              helperText="Mật khẩu tối thiểu cần có 6 ký tự."
              InputProps={{ sx: { borderRadius: 3.5 } }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 4, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
          <Button onClick={closeCreateDialog} disabled={createLoading} sx={{ borderRadius: 3, fontWeight: 700 }}>
            Hủy bỏ
          </Button>
          <Button 
            variant="contained" 
            onClick={handleCreateAccount} 
            disabled={createLoading}
            sx={{ borderRadius: 3, fontWeight: 800, px: 3, bgcolor: '#6c63ff', '&:hover': { bgcolor: '#534bae' } }}
          >
            {createLoading ? <CircularProgress size={20} color="inherit" /> : 'Tạo tài khoản'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog 
        open={editDialog.open} 
        onClose={handleCloseEdit} 
        fullWidth 
        maxWidth="sm"
        PaperProps={{ sx: { borderRadius: 6, overflow: 'hidden' } }}
      >
        <Box sx={{ background: 'linear-gradient(135deg, #6c63ff 0%, #00bcd4 100%)', p: 3.5, color: '#fff' }}>
          <Typography variant="h5" fontWeight={900}>Hiệu chỉnh tài khoản</Typography>
          <Typography variant="body2" sx={{ opacity: 0.85, mt: 0.5 }}>Cập nhật thông tin chi tiết hoặc đặt lại mật khẩu cho thành viên.</Typography>
        </Box>
        <DialogContent sx={{ p: 4, pt: 3.5 }}>
          <Stack spacing={2.5}>
            <TextField
              label="Họ và tên hiển thị *"
              fullWidth
              value={editForm.name}
              onChange={handleEditFieldChange('name')}
              InputProps={{ sx: { borderRadius: 3.5 } }}
            />
            <TextField
              label="Địa chỉ Email *"
              fullWidth
              type="email"
              value={editForm.email}
              onChange={handleEditFieldChange('email')}
              InputProps={{ sx: { borderRadius: 3.5 } }}
            />
            {editDialog.user?.role === 'artist' ? (
              <TextField
                label="Tiểu sử nghệ sĩ (Bio)"
                fullWidth
                multiline
                minRows={3}
                value={editForm.bio}
                onChange={handleEditFieldChange('bio')}
                InputProps={{ sx: { borderRadius: 3.5 } }}
              />
            ) : (
              <TextField
                select
                label="Phân quyền (Role) *"
                fullWidth
                value={editForm.role}
                onChange={handleEditFieldChange('role')}
                InputProps={{ sx: { borderRadius: 3.5 } }}
              >
                <MenuItem value="user">User</MenuItem>
                <MenuItem value="admin">Admin</MenuItem>
              </TextField>
            )}
            <TextField
              label="Đặt lại mật khẩu mới"
              fullWidth
              type="password"
              value={editForm.password}
              onChange={handleEditFieldChange('password')}
              helperText="Bỏ trống nếu bạn không có nhu cầu đổi mật khẩu cho tài khoản này."
              InputProps={{ sx: { borderRadius: 3.5 } }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 4, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
          <Button onClick={handleCloseEdit} disabled={editLoading} sx={{ borderRadius: 3, fontWeight: 700 }}>
            Hủy bỏ
          </Button>
          <Button 
            variant="contained" 
            onClick={handleSaveEdit} 
            disabled={editLoading}
            sx={{ borderRadius: 3, fontWeight: 800, px: 3, bgcolor: '#6c63ff', '&:hover': { bgcolor: '#534bae' } }}
          >
            {editLoading ? <CircularProgress size={20} color="inherit" /> : 'Lưu thay đổi'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog 
        open={deleteDialog.open} 
        onClose={() => setDeleteDialog({ open: false, user: null })}
        PaperProps={{ sx: { borderRadius: 5 } }}
      >
        <DialogTitle sx={{ fontWeight: 800, color: 'error.main' }}>Xác nhận xóa tài khoản</DialogTitle>
        <DialogContent>
          Bạn có chắc chắn muốn xóa tài khoản của thành viên <b>{deleteDialog.user?.name}</b>?
          Mọi dữ liệu cá nhân liên quan của tài khoản sẽ bị loại bỏ vĩnh viễn khỏi cơ sở dữ liệu.
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button onClick={() => setDeleteDialog({ open: false, user: null })} disabled={deleteLoading} sx={{ borderRadius: 3, fontWeight: 700 }}>
            Hủy
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleDelete}
            disabled={deleteLoading}
            sx={{ borderRadius: 3, fontWeight: 800 }}
          >
            {deleteLoading ? <CircularProgress size={20} color="inherit" /> : 'Xác nhận xóa'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* AI Quota Management Dialog (Redesigned Modern Glassmorphism UI) */}
      <Dialog
        open={aiQuotaDialog.open}
        onClose={handleCloseAiQuota}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 6,
            overflow: 'hidden',
            bgcolor: (theme) => (theme.palette.mode === 'dark' ? '#121624' : '#ffffff'),
            backgroundImage: 'none',
            border: '1px solid',
            borderColor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'),
            boxShadow: '0 24px 48px -12px rgba(0, 0, 0, 0.5)',
          },
        }}
      >
        {/* Header Banner */}
        <Box
          sx={{
            px: 3.5,
            pt: 3.5,
            pb: 2.5,
            background: 'linear-gradient(135deg, rgba(124,58,237,0.18) 0%, rgba(6,182,212,0.12) 100%)',
            borderBottom: '1px solid',
            borderColor: 'divider',
            position: 'relative',
          }}
        >
          <IconButton
            onClick={handleCloseAiQuota}
            size="small"
            sx={{
              position: 'absolute',
              top: 16,
              right: 16,
              color: 'text.secondary',
              bgcolor: 'rgba(255,255,255,0.05)',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.12)' },
            }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>

          <Stack direction="row" alignItems="center" spacing={2}>
            <Box
              sx={{
                width: 52,
                height: 52,
                borderRadius: 4,
                background: 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 20px rgba(139,92,246,0.35)',
                flexShrink: 0,
              }}
            >
              <AiQuotaIcon sx={{ color: '#ffffff', fontSize: 28 }} />
            </Box>
            <Box sx={{ minWidth: 0, pr: 3 }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                <Typography variant="h6" fontWeight={850} letterSpacing="-0.02em">
                  Quản Lý Hạn Mức AI
                </Typography>
                <Chip
                  label="Rate Limit"
                  size="small"
                  sx={{
                    fontWeight: 800,
                    fontSize: 10,
                    height: 20,
                    bgcolor: 'rgba(139,92,246,0.15)',
                    color: '#a78bfa',
                    border: '1px solid rgba(139,92,246,0.3)',
                    borderRadius: 1.5,
                  }}
                />
              </Stack>
              <Typography variant="body2" color="text.secondary" noWrap fontWeight={500}>
                {aiQuotaDialog.user?.name} · <span style={{ opacity: 0.7 }}>{aiQuotaDialog.user?.email}</span>
              </Typography>
            </Box>
          </Stack>
        </Box>

        <DialogContent sx={{ p: 3.5 }}>
          {aiQuotaDialog.loading ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 6, gap: 2 }}>
              <CircularProgress size={36} sx={{ color: '#8b5cf6' }} />
              <Typography variant="body2" color="text.secondary" fontWeight={600}>
                Đang tải thông tin hạn mức AI...
              </Typography>
            </Box>
          ) : (
            <Stack spacing={3.5}>
              {/* Stat Widgets */}
              <Grid container spacing={1.5} alignItems="stretch">
                <Grid size={{ xs: 6, sm: 3 }} sx={{ display: 'flex' }}>
                  <Paper
                    elevation={0}
                    sx={{
                      width: '100%',
                      p: 1.75,
                      borderRadius: 3.5,
                      border: '1px solid',
                      borderColor: 'rgba(139,92,246,0.2)',
                      bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(139,92,246,0.06)' : 'rgba(139,92,246,0.04)'),
                      textAlign: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      fontWeight={800}
                      textTransform="uppercase"
                      noWrap
                      sx={{ fontSize: '0.66rem', letterSpacing: 0.3, width: '100%', textAlign: 'center' }}
                    >
                      Gói Mặc Định
                    </Typography>
                    <Typography variant="h6" fontWeight={900} noWrap sx={{ color: '#a78bfa', mt: 0.5, lineHeight: 1.2 }}>
                      {aiQuotaDialog.info?.tierLimit ?? 5} <Typography component="span" variant="caption" fontWeight={700}>lượt</Typography>
                    </Typography>
                  </Paper>
                </Grid>

                <Grid size={{ xs: 6, sm: 3 }} sx={{ display: 'flex' }}>
                  <Paper
                    elevation={0}
                    sx={{
                      width: '100%',
                      p: 1.75,
                      borderRadius: 3.5,
                      border: '1px solid',
                      borderColor: 'rgba(59,130,246,0.2)',
                      bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(59,130,246,0.06)' : 'rgba(59,130,246,0.04)'),
                      textAlign: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      fontWeight={800}
                      textTransform="uppercase"
                      noWrap
                      sx={{ fontSize: '0.66rem', letterSpacing: 0.3, width: '100%', textAlign: 'center' }}
                    >
                      Đã Dùng 24h
                    </Typography>
                    <Typography variant="h6" fontWeight={900} noWrap sx={{ color: '#60a5fa', mt: 0.5, lineHeight: 1.2 }}>
                      {aiQuotaDialog.info?.used24h ?? 0} <Typography component="span" variant="caption" fontWeight={700}>lượt</Typography>
                    </Typography>
                  </Paper>
                </Grid>

                <Grid size={{ xs: 6, sm: 3 }} sx={{ display: 'flex' }}>
                  <Paper
                    elevation={0}
                    sx={{
                      width: '100%',
                      p: 1.75,
                      borderRadius: 3.5,
                      border: '1px solid',
                      borderColor: 'rgba(16,185,129,0.2)',
                      bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(16,185,129,0.06)' : 'rgba(16,185,129,0.04)'),
                      textAlign: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      fontWeight={800}
                      textTransform="uppercase"
                      noWrap
                      sx={{ fontSize: '0.66rem', letterSpacing: 0.3, width: '100%', textAlign: 'center' }}
                    >
                      Lượt Còn Lại
                    </Typography>
                    <Typography variant="h6" fontWeight={900} noWrap sx={{ color: '#34d399', mt: 0.5, lineHeight: 1.2 }}>
                      {aiQuotaDialog.info?.remaining ?? 0} <Typography component="span" variant="caption" fontWeight={700}>lượt</Typography>
                    </Typography>
                  </Paper>
                </Grid>

                <Grid size={{ xs: 6, sm: 3 }} sx={{ display: 'flex' }}>
                  <Paper
                    elevation={0}
                    sx={{
                      width: '100%',
                      p: 1.75,
                      borderRadius: 3.5,
                      border: '1px solid',
                      borderColor: 'rgba(245,158,11,0.3)',
                      bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(245,158,11,0.08)' : 'rgba(245,158,11,0.06)'),
                      textAlign: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      alignItems: 'center',
                      boxShadow: '0 4px 12px rgba(245,158,11,0.1)',
                    }}
                  >
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      fontWeight={800}
                      textTransform="uppercase"
                      noWrap
                      sx={{ fontSize: '0.66rem', letterSpacing: 0.3, width: '100%', textAlign: 'center' }}
                    >
                      Hạn Mức Tổng
                    </Typography>
                    <Typography variant="h6" fontWeight={900} noWrap sx={{ color: '#fbbf24', mt: 0.5, lineHeight: 1.2 }}>
                      {aiQuotaDialog.info?.effectiveLimit ?? 5} <Typography component="span" variant="caption" fontWeight={700}>/24h</Typography>
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>


              {/* Form Input Section */}
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  borderRadius: 4.5,
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : '#f8fafc'),
                }}
              >
                <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 2, color: 'text.primary' }}>
                  Cấu Hình Hạn Mức Tùy Chỉnh
                </Typography>

                <Stack spacing={2.5}>
                  {/* Custom AI Limit Override */}
                  <Box>
                    <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
                      Hạn mức cố định riêng cho user (Custom Limit Override)
                    </Typography>
                    <TextField
                      placeholder="Bỏ trống để dùng mặc định của gói tài khoản"
                      type="number"
                      fullWidth
                      value={aiQuotaDialog.customAiLimit}
                      onChange={(e) => setAiQuotaDialog((prev) => ({ ...prev, customAiLimit: e.target.value }))}
                      InputProps={{
                        endAdornment: <InputAdornment position="end">lượt / 24h</InputAdornment>,
                        sx: {
                          borderRadius: 3,
                          fontWeight: 700,
                          fontSize: 14,
                          '& input[type=number]::-webkit-inner-spin-button': { display: 'none' },
                        },
                      }}
                    />
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block', fontSize: 11 }}>
                      💡 Ví dụ nhập 50: User sẽ có 50 lượt/24h thay vì hạn mức mặc định của gói ({aiQuotaDialog.info?.tierLimit ?? 5} lượt).
                    </Typography>
                  </Box>

                  {/* Bonus AI Quota */}
                  <Box>
                    <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
                      Số lượt AI thưởng thêm (Bonus AI Quota)
                    </Typography>
                    <TextField
                      placeholder="0"
                      type="number"
                      fullWidth
                      value={aiQuotaDialog.bonusAiQuota}
                      onChange={(e) => setAiQuotaDialog((prev) => ({ ...prev, bonusAiQuota: e.target.value }))}
                      InputProps={{
                        endAdornment: <InputAdornment position="end">lượt cộng thêm</InputAdornment>,
                        sx: {
                          borderRadius: 3,
                          fontWeight: 700,
                          fontSize: 14,
                          '& input[type=number]::-webkit-inner-spin-button': { display: 'none' },
                        },
                      }}
                    />

                    {/* Quick Boost Preset Buttons */}
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1.25, flexWrap: 'wrap', gap: 0.75 }}>
                      <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ mr: 0.5 }}>
                        Tặng nhanh:
                      </Typography>
                      {[5, 10, 20, 50].map((preset) => (
                        <Chip
                          key={preset}
                          label={`+${preset}`}
                          size="small"
                          onClick={() => setAiQuotaDialog((prev) => ({ ...prev, bonusAiQuota: (Number(prev.bonusAiQuota) || 0) + preset }))}
                          clickable
                          sx={{
                            fontWeight: 800,
                            fontSize: 11,
                            borderRadius: 2,
                            bgcolor: 'rgba(139,92,246,0.1)',
                            color: '#8b5cf6',
                            border: '1px solid rgba(139,92,246,0.25)',
                            '&:hover': { bgcolor: 'rgba(139,92,246,0.2)', borderColor: '#8b5cf6' },
                          }}
                        />
                      ))}
                      <Chip
                        label="Reset 0"
                        size="small"
                        onClick={() => setAiQuotaDialog((prev) => ({ ...prev, bonusAiQuota: 0 }))}
                        clickable
                        sx={{
                          fontWeight: 700,
                          fontSize: 11,
                          borderRadius: 2,
                          bgcolor: 'rgba(255,255,255,0.05)',
                          color: 'text.secondary',
                        }}
                      />
                    </Stack>
                  </Box>
                </Stack>
              </Paper>

              {/* Formula Calculation Live Banner */}
              <Box
                sx={{
                  p: 2.25,
                  borderRadius: 4,
                  background: 'linear-gradient(135deg, rgba(139,92,246,0.12) 0%, rgba(99,102,241,0.08) 100%)',
                  border: '1px solid rgba(139,92,246,0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                }}
              >
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    bgcolor: 'rgba(139,92,246,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <FlashIcon sx={{ color: '#a78bfa', fontSize: 20 }} />
                </Box>

                <Box sx={{ flexGrow: 1 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={700} display="block">
                    TỔNG HẠN MỨC HIỆU LỰC MỚI CỦA USER
                  </Typography>
                  <Typography variant="subtitle1" fontWeight={900} sx={{ color: 'text.primary' }}>
                    {(aiQuotaDialog.customAiLimit !== '' ? Number(aiQuotaDialog.customAiLimit) : (aiQuotaDialog.info?.tierLimit ?? 5)) +
                      Number(aiQuotaDialog.bonusAiQuota || 0)}{' '}
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#a78bfa' }}>yêu cầu / 24 giờ</span>
                  </Typography>
                </Box>
              </Box>
            </Stack>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 3, pt: 1.5, borderTop: '1px solid', borderColor: 'divider', gap: 1 }}>
          <Button
            onClick={handleCloseAiQuota}
            disabled={aiQuotaDialog.saving}
            sx={{ borderRadius: 3, fontWeight: 700, px: 2.5, color: 'text.secondary' }}
          >
            Hủy Bỏ
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveAiQuota}
            disabled={aiQuotaDialog.saving || aiQuotaDialog.loading}
            sx={{
              borderRadius: 3.5,
              fontWeight: 800,
              px: 3.5,
              py: 1.1,
              background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
              boxShadow: '0 4px 14px rgba(139,92,246,0.4)',
              '&:hover': {
                background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
                boxShadow: '0 6px 20px rgba(139,92,246,0.6)',
              },
            }}
          >
            {aiQuotaDialog.saving ? <CircularProgress size={20} color="inherit" /> : 'Cập Nhật Hạn Mức'}
          </Button>
        </DialogActions>
      </Dialog>

    </Layout>

  );
}

export default Accounts;
