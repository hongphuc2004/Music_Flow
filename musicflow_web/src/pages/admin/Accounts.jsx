import { useState, useEffect, useCallback } from 'react';
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
} from '@mui/material';
import {
  Search as SearchIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Edit as EditIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { Layout } from '../../components/Layout';
import { accountsApi } from '../../services/api';

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
      setError('Name, email, and password are required.');
      return;
    }

    if (payload.role === 'artist') {
      payload.bio = createForm.bio.trim();
    }

    try {
      setCreateLoading(true);
      await accountsApi.create(payload);
      setSuccess('Account created successfully.');
      closeCreateDialog();
      fetchAccounts();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create account.');
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
      setError('Name and email are required.');
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
      handleCloseEdit();
      fetchAccounts();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update account.');
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
      fetchAccounts();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete account.');
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
      setError('Cannot change role of artist account.');
      return;
    }

    try {
      setRoleLoading(userId);
      await accountsApi.update(userId, { role: newRole });
      setSuccess('Role updated successfully.');
      fetchAccounts();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update role.');
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
    <Layout title="Accounts Management">
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5" fontWeight={600}>
          Accounts ({total})
        </Typography>
        <Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={openCreateDialog}
            sx={{ mr: 1 }}
          >
            Add Account
          </Button>
          <IconButton onClick={fetchAccounts} disabled={loading}>
            <RefreshIcon />
          </IconButton>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Paper sx={{ mb: 3, p: 2 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Search users by name or email..."
          value={searchQuery}
          onChange={handleSearchChange}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
      </Paper>

      <TableContainer component={Paper}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                <TableCell>Account</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Provider</TableCell>
                <TableCell>Joined</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user._id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar src={user.avatar} sx={{ bgcolor: '#6c63ff' }}>
                          {user.name?.charAt(0)}
                        </Avatar>
                        <Box>
                          <Typography fontWeight={500}>{user.name}</Typography>
                          {user.role === 'artist' && user.bio ? (
                            <Typography variant="body2" color="text.secondary" noWrap>
                              {user.bio}
                            </Typography>
                          ) : null}
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Select
                        size="small"
                        value={user.role || 'user'}
                        onChange={(e) => handleRoleChange(user._id, e.target.value)}
                        disabled={roleLoading === user._id || user.role === 'artist'}
                        sx={{
                          minWidth: 100,
                          '& .MuiSelect-select': {
                            py: 0.5,
                            color: user.role === 'admin' ? '#d32f2f' : user.role === 'artist' ? '#ff9800' : '#1976d2',
                            fontWeight: 600,
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
                          bgcolor: `${getProviderColor(user.provider || user.role)}20`,
                          color: getProviderColor(user.provider || user.role),
                          fontWeight: 600,
                          textTransform: 'capitalize',
                        }}
                      />
                    </TableCell>
                    <TableCell>{formatDate(user.createdAt)}</TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => handleOpenEdit(user)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => setDeleteDialog({ open: true, user })}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={total}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </TableContainer>

      <Dialog open={createDialogOpen} onClose={closeCreateDialog} fullWidth maxWidth="sm">
        <DialogTitle>Add Account</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gap: 2, pt: 1 }}>
            <TextField
              label="Name"
              fullWidth
              value={createForm.name}
              onChange={handleCreateFieldChange('name')}
            />
            <TextField
              label="Email"
              fullWidth
              type="email"
              value={createForm.email}
              onChange={handleCreateFieldChange('email')}
            />
            <TextField
              select
              label="Role"
              fullWidth
              value={createForm.role}
              onChange={handleCreateFieldChange('role')}
            >
              <MenuItem value="user">User</MenuItem>
              <MenuItem value="admin">Admin</MenuItem>
              <MenuItem value="artist">Artist</MenuItem>
            </TextField>
            {createForm.role === 'artist' ? (
              <TextField
                label="Bio"
                fullWidth
                multiline
                minRows={3}
                value={createForm.bio}
                onChange={handleCreateFieldChange('bio')}
              />
            ) : null}
            <TextField
              label="Password"
              fullWidth
              type="password"
              value={createForm.password}
              onChange={handleCreateFieldChange('password')}
              helperText="Password must be at least 6 characters."
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeCreateDialog} disabled={createLoading}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleCreateAccount} disabled={createLoading}>
            {createLoading ? <CircularProgress size={20} /> : 'Create account'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={editDialog.open} onClose={handleCloseEdit} fullWidth maxWidth="sm">
        <DialogTitle>Edit Account</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gap: 2, pt: 1 }}>
            <TextField
              label="Name"
              fullWidth
              value={editForm.name}
              onChange={handleEditFieldChange('name')}
            />
            <TextField
              label="Email"
              fullWidth
              type="email"
              value={editForm.email}
              onChange={handleEditFieldChange('email')}
            />
            {editDialog.user?.role === 'artist' ? (
              <TextField
                label="Bio"
                fullWidth
                multiline
                minRows={3}
                value={editForm.bio}
                onChange={handleEditFieldChange('bio')}
              />
            ) : (
              <TextField
                select
                label="Role"
                fullWidth
                value={editForm.role}
                onChange={handleEditFieldChange('role')}
              >
                <MenuItem value="user">User</MenuItem>
                <MenuItem value="admin">Admin</MenuItem>
              </TextField>
            )}
            <TextField
              label="New Password"
              fullWidth
              type="password"
              value={editForm.password}
              onChange={handleEditFieldChange('password')}
              helperText="Leave blank if you do not want to change the password."
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseEdit} disabled={editLoading}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleSaveEdit} disabled={editLoading}>
            {editLoading ? <CircularProgress size={20} /> : 'Save changes'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteDialog.open} onClose={() => setDeleteDialog({ open: false, user: null })}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          Are you sure you want to delete account "{deleteDialog.user?.name}"?
          This action cannot be undone.
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setDeleteDialog({ open: false, user: null })}
            disabled={deleteLoading}
          >
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleDelete}
            disabled={deleteLoading}
          >
            {deleteLoading ? <CircularProgress size={20} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Layout>
  );
}

export default Accounts;
