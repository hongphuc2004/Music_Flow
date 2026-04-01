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
} from '@mui/icons-material';
import { Layout } from '../../components/Layout';
import { accountsApi } from '../../services/api';



function Accounts() {
  const [allAccounts, setAllAccounts] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [total, setTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchTimeout, setSearchTimeout] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, user: null });
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [roleLoading, setRoleLoading] = useState(null);

  // Lấy tất cả accounts (users + artists)
  const fetchAccounts = useCallback(async () => {
    try {
      setLoading(true);
      const response = await accountsApi.getAll();
      let accounts = response.data.accounts || [];
      setAllAccounts(accounts);
      setError(null);
    } catch (err) {
      setError('Failed to load accounts. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Lọc và phân trang client-side
  useEffect(() => {
    let filtered = allAccounts;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(acc =>
        (acc.name && acc.name.toLowerCase().includes(q)) ||
        (acc.email && acc.email.toLowerCase().includes(q))
      );
    }
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
    const value = e.target.value;
    setSearchQuery(value);
    setPage(0);
    // Debounce nếu muốn
    if (searchTimeout) clearTimeout(searchTimeout);
    setSearchTimeout(setTimeout(() => {
      setSearchQuery(value);
    }, 300));
  };


  const handleDelete = async () => {
    if (!deleteDialog.user) return;
    try {
      setDeleteLoading(true);
      // Chỉ xóa user thường, không xóa artist qua API này
      if (deleteDialog.user.role !== 'artist') {
        await usersApi.delete(deleteDialog.user._id);
        setDeleteDialog({ open: false, user: null });
        fetchAccounts();
      } else {
        setError('Cannot delete artist from this panel.');
        setDeleteDialog({ open: false, user: null });
      }
    } catch (err) {
      setError('Failed to delete user');
    } finally {
      setDeleteLoading(false);
    }
  };

  const getProviderColor = (provider) => {
    switch (provider) {
      case 'google': return '#db4437';
      case 'local': return '#6c63ff';
      default: return '#9e9e9e';
    }
  };


  const handleRoleChange = async (userId, newRole) => {
    try {
      setRoleLoading(userId);
      // Chỉ cho phép đổi role user thường, không đổi role artist
      const user = users.find(u => u._id === userId);
      if (user && user.role !== 'artist') {
        await usersApi.updateRole(userId, newRole);
        fetchAccounts();
      } else {
        setError('Cannot change role of artist account.');
      }
    } catch (err) {
      setError('Failed to update role');
    } finally {
      setRoleLoading(null);
    }
  };

  const formatDate = (dateString) => {
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
        <IconButton onClick={fetchAccounts} disabled={loading}>
          <RefreshIcon />
        </IconButton>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
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
                        <Typography fontWeight={500}>{user.name}</Typography>
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
                          <MenuItem value="artist" disabled>Artist</MenuItem>
                        )}
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={user.provider || 'local'}
                        size="small"
                        sx={{
                          bgcolor: `${getProviderColor(user.provider)}20`,
                          color: getProviderColor(user.provider),
                          fontWeight: 600,
                          textTransform: 'capitalize',
                        }}
                      />
                    </TableCell>
                    <TableCell>{formatDate(user.createdAt)}</TableCell>
                    <TableCell align="right">
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog.open} onClose={() => setDeleteDialog({ open: false, user: null })}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          Are you sure you want to delete user "{deleteDialog.user?.name}"? 
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
