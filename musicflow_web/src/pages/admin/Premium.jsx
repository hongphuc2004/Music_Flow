import { useState, useEffect, useCallback } from 'react';
import {
  Grid,
  Paper,
  Typography,
  Box,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  IconButton,
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
  Stack,
  Tooltip,
  Tabs,
  Tab,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  WorkspacePremiumRounded as PremiumIcon,
  TrendingUpRounded as RevenueIcon,
  CheckCircleRounded as SuccessIcon,
  ErrorOutlineRounded as ErrorIcon,
  HourglassEmptyRounded as PendingIcon,
  CancelRounded as CancelledIcon,
  AddRounded as AddIcon,
  EditRounded as EditIcon,
  DeleteRounded as DeleteIcon,
  RefreshRounded as RefreshIcon,
  SearchRounded as SearchIcon,
  PaymentRounded as PaymentIcon,
  CalendarMonthRounded as CalendarIcon,
} from '@mui/icons-material';
import { Layout } from '../../components/Layout';
import { adminPremiumApi } from '../../services/admin/admin.service';
import useAppToast from '../../components/common/useAppToast';

const emptyPlanForm = {
  name: '',
  price: '',
  durationInDays: '',
  description: '',
  isActive: true,
};

function Premium() {
  const { showToast } = useAppToast();
  const [activeTab, setActiveTab] = useState(0);
  const [loadingStats, setLoadingStats] = useState(true);
  const [stats, setStats] = useState({
    totalRevenue: 0,
    successCount: 0,
    failedCount: 0,
    pendingCount: 0,
    cancelledCount: 0,
    activePremiumUsers: 0,
  });

  // Plans State
  const [plans, setPlans] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [planForm, setPlanForm] = useState(emptyPlanForm);
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState(null);
  const [submittingPlan, setSubmittingPlan] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [deletingPlan, setDeletingPlan] = useState(false);

  // Transactions State
  const [transactions, setTransactions] = useState([]);
  const [txTotal, setTxTotal] = useState(0);
  const [txPage, setTxPage] = useState(0);
  const [txRowsPerPage, setTxRowsPerPage] = useState(10);
  const [txSearch, setTxSearch] = useState('');
  const [txStatus, setTxStatus] = useState('');
  const [loadingTxs, setLoadingTxs] = useState(false);

  // Subscriptions State
  const [subscriptions, setSubscriptions] = useState([]);
  const [subTotal, setSubTotal] = useState(0);
  const [subPage, setSubPage] = useState(0);
  const [subRowsPerPage, setSubRowsPerPage] = useState(10);
  const [subSearch, setSubSearch] = useState('');
  const [subStatus, setSubStatus] = useState('');
  const [loadingSubs, setLoadingSubs] = useState(false);

  // Fetch Statistics
  const fetchStats = async () => {
    try {
      setLoadingStats(true);
      const res = await adminPremiumApi.getStats();
      setStats(res.data?.data || {
        totalRevenue: 0,
        successCount: 0,
        failedCount: 0,
        pendingCount: 0,
        cancelledCount: 0,
        activePremiumUsers: 0,
      });
    } catch (err) {
      showToast({
        severity: 'error',
        title: 'Lỗi tải thống kê',
        message: err.response?.data?.message || 'Không thể tải thống kê Premium.',
      });
    } finally {
      setLoadingStats(false);
    }
  };

  // Fetch Plans
  const fetchPlans = async () => {
    try {
      setLoadingPlans(true);
      const res = await adminPremiumApi.getPlans();
      setPlans(res.data?.data || []);
    } catch (err) {
      showToast({
        severity: 'error',
        title: 'Lỗi tải gói cước',
        message: err.response?.data?.message || 'Không thể tải danh sách gói cước.',
      });
    } finally {
      setLoadingPlans(false);
    }
  };

  // Fetch Transactions
  const fetchTransactions = useCallback(async () => {
    try {
      setLoadingTxs(true);
      const params = {
        page: txPage + 1,
        limit: txRowsPerPage,
        search: txSearch,
        status: txStatus,
      };
      const res = await adminPremiumApi.getTransactions(params);
      setTransactions(res.data?.data || []);
      setTxTotal(res.data?.total || 0);
    } catch (err) {
      showToast({
        severity: 'error',
        title: 'Lỗi tải giao dịch',
        message: err.response?.data?.message || 'Không thể tải danh sách giao dịch.',
      });
    } finally {
      setLoadingTxs(false);
    }
  }, [txPage, txRowsPerPage, txSearch, txStatus, showToast]);

  // Fetch Subscriptions
  const fetchSubscriptions = useCallback(async () => {
    try {
      setLoadingSubs(true);
      const params = {
        page: subPage + 1,
        limit: subRowsPerPage,
        search: subSearch,
        status: subStatus,
      };
      const res = await adminPremiumApi.getSubscriptions(params);
      setSubscriptions(res.data?.data || []);
      setSubTotal(res.data?.total || 0);
    } catch (err) {
      showToast({
        severity: 'error',
        title: 'Lỗi tải Subscriptions',
        message: err.response?.data?.message || 'Không thể tải danh sách đăng ký.',
      });
    } finally {
      setLoadingSubs(false);
    }
  }, [subPage, subRowsPerPage, subSearch, subStatus, showToast]);

  // Initial Load
  useEffect(() => {
    fetchStats();
    fetchPlans();
  }, []);

  // Sync Tabs data
  useEffect(() => {
    if (activeTab === 1) {
      fetchTransactions();
    } else if (activeTab === 2) {
      fetchSubscriptions();
    }
  }, [activeTab, fetchTransactions, fetchSubscriptions]);

  // Tab change
  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  // Open plan creation dialog
  const handleOpenCreatePlan = () => {
    setPlanForm(emptyPlanForm);
    setEditingPlanId(null);
    setPlanDialogOpen(true);
  };

  // Open plan edit dialog
  const handleOpenEditPlan = (plan) => {
    setPlanForm({
      name: plan.name,
      price: plan.price,
      durationInDays: plan.durationInDays,
      description: plan.description.join(', '),
      isActive: plan.isActive,
    });
    setEditingPlanId(plan._id);
    setPlanDialogOpen(true);
  };

  // Submit plan (Create or Update)
  const handleSubmitPlan = async (e) => {
    e.preventDefault();
    if (!planForm.name || !planForm.price || !planForm.durationInDays) {
      showToast({ severity: 'warning', message: 'Vui lòng điền đầy đủ các thông tin bắt buộc.' });
      return;
    }

    try {
      setSubmittingPlan(true);
      const payload = {
        ...planForm,
        price: Number(planForm.price),
        durationInDays: Number(planForm.durationInDays),
      };

      if (editingPlanId) {
        await adminPremiumApi.updatePlan(editingPlanId, payload);
        showToast({ severity: 'success', message: 'Cập nhật gói cước thành công.' });
      } else {
        await adminPremiumApi.createPlan(payload);
        showToast({ severity: 'success', message: 'Tạo gói cước mới thành công.' });
      }

      setPlanDialogOpen(false);
      setPlanForm(emptyPlanForm);
      fetchPlans();
    } catch (err) {
      showToast({
        severity: 'error',
        title: 'Thao tác thất bại',
        message: err.response?.data?.message || 'Có lỗi xảy ra khi lưu gói cước.',
      });
    } finally {
      setSubmittingPlan(false);
    }
  };

  // Open delete plan confirmation dialog
  const handleOpenDeletePlan = (plan) => {
    setSelectedPlan(plan);
    setDeleteDialogOpen(true);
  };

  // Delete plan API trigger
  const handleDeletePlan = async () => {
    if (!selectedPlan) return;
    try {
      setDeletingPlan(true);
      const res = await adminPremiumApi.deletePlan(selectedPlan._id);
      showToast({
        severity: 'success',
        title: 'Thành công',
        message: res.data?.message || 'Đã xóa gói cước.',
      });
      setDeleteDialogOpen(false);
      setSelectedPlan(null);
      fetchPlans();
    } catch (err) {
      showToast({
        severity: 'error',
        title: 'Xóa thất bại',
        message: err.response?.data?.message || 'Có lỗi xảy ra khi xóa gói cước.',
      });
    } finally {
      setDeletingPlan(false);
    }
  };

  // Pagination & Filtering Search triggers
  const handleTxSearchChange = (e) => {
    setTxSearch(e.target.value);
    setTxPage(0);
  };

  const handleTxStatusChange = (status) => {
    setTxStatus(status);
    setTxPage(0);
  };

  const handleSubSearchChange = (e) => {
    setSubSearch(e.target.value);
    setSubPage(0);
  };

  const handleSubStatusChange = (status) => {
    setSubStatus(status);
    setSubPage(0);
  };

  const refreshActiveTab = () => {
    fetchStats();
    if (activeTab === 0) {
      fetchPlans();
    } else if (activeTab === 1) {
      fetchTransactions();
    } else if (activeTab === 2) {
      fetchSubscriptions();
    }
  };

  // Chip helpers for Transaction Statuses
  const getTxStatusChip = (status) => {
    switch (status) {
      case 'success':
        return <Chip icon={<SuccessIcon />} label="Thành công" color="success" size="small" variant="outlined" sx={{ fontWeight: 700 }} />;
      case 'pending':
        return <Chip icon={<PendingIcon />} label="Chờ duyệt" color="warning" size="small" variant="outlined" sx={{ fontWeight: 700 }} />;
      case 'failed':
        return <Chip icon={<ErrorIcon />} label="Lỗi" color="error" size="small" variant="outlined" sx={{ fontWeight: 700 }} />;
      case 'cancelled':
        return <Chip icon={<CancelledIcon />} label="Đã hủy" color="default" size="small" variant="outlined" sx={{ fontWeight: 700 }} />;
      default:
        return <Chip label={status} size="small" />;
    }
  };

  // Chip helpers for Subscription Statuses
  const getSubStatusChip = (status, endDate) => {
    const isExpired = endDate && new Date(endDate) < new Date();
    if (status === 'active' && !isExpired) {
      return <Chip icon={<SuccessIcon />} label="Đang hoạt động" color="success" size="small" sx={{ fontWeight: 700 }} />;
    }
    if (status === 'expired' || isExpired) {
      return <Chip icon={<ErrorIcon />} label="Hết hạn" color="error" size="small" variant="outlined" sx={{ fontWeight: 700 }} />;
    }
    if (status === 'cancelled') {
      return <Chip icon={<CancelledIcon />} label="Đã huỷ" color="default" size="small" variant="outlined" sx={{ fontWeight: 700 }} />;
    }
    return <Chip icon={<PendingIcon />} label="Chờ kích hoạt" color="warning" size="small" variant="outlined" sx={{ fontWeight: 700 }} />;
  };

  return (
    <Layout title="Quản lý Premium & Plans">
      <Stack spacing={4}>
        {/* Header toolbar */}
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h5" fontWeight={900} sx={{ letterSpacing: '-0.5px' }}>
            Bảng điều khiển Premium
          </Typography>
          <Tooltip title="Tải lại dữ liệu">
            <IconButton onClick={refreshActiveTab} sx={{ bgcolor: 'action.hover' }}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Stack>

        {/* 1. STATS OVERVIEW CARDS */}
        {loadingStats ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={30} color="secondary" />
          </Box>
        ) : (
          <Grid container spacing={3}>
            {/* Doanh thu */}
            <Grid item xs={12} sm={6} md={3}>
              <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 4, background: 'linear-gradient(135deg, rgba(108, 99, 255, 0.05) 0%, transparent 100%)' }}>
                <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{ p: 1.5, borderRadius: 3, bgcolor: 'rgba(108, 99, 255, 0.1)', color: '#6c63ff' }}>
                    <RevenueIcon sx={{ fontSize: 28 }} />
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={700}>
                      TỔNG DOANH THU (SUCCESS)
                    </Typography>
                    <Typography variant="h5" fontWeight={900} color="#6c63ff" sx={{ mt: 0.5 }}>
                      {stats.totalRevenue.toLocaleString('vi-VN')} đ
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Premium Users */}
            <Grid item xs={12} sm={6} md={3}>
              <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 4, background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.05) 0%, transparent 100%)' }}>
                <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{ p: 1.5, borderRadius: 3, bgcolor: 'rgba(34, 197, 94, 0.1)', color: '#22c55e' }}>
                    <PremiumIcon sx={{ fontSize: 28 }} />
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={700}>
                      PREMIUM USERS HOẠT ĐỘNG
                    </Typography>
                    <Typography variant="h5" fontWeight={900} color="#22c55e" sx={{ mt: 0.5 }}>
                      {stats.activePremiumUsers} users
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Giao dịch thành công */}
            <Grid item xs={12} sm={6} md={3}>
              <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 4 }}>
                <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{ p: 1.5, borderRadius: 3, bgcolor: 'rgba(239, 68, 68, 0.05)', color: '#ef4444' }}>
                    <SuccessIcon sx={{ fontSize: 28 }} />
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={700}>
                      GIAO DỊCH THÀNH CÔNG
                    </Typography>
                    <Typography variant="h5" fontWeight={900} sx={{ mt: 0.5 }}>
                      {stats.successCount} / {stats.successCount + stats.failedCount + stats.pendingCount + stats.cancelledCount} gd
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Đang chờ thanh toán */}
            <Grid item xs={12} sm={6} md={3}>
              <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 4 }}>
                <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{ p: 1.5, borderRadius: 3, bgcolor: 'rgba(245, 158, 11, 0.05)', color: '#f59e0b' }}>
                    <PendingIcon sx={{ fontSize: 28 }} />
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={700}>
                      GIAO DỊCH ĐANG CHỜ (PENDING)
                    </Typography>
                    <Typography variant="h5" fontWeight={900} color="#f59e0b" sx={{ mt: 0.5 }}>
                      {stats.pendingCount} gd
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {/* 2. TABS MANAGEMENT PANEL */}
        <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 4.5, overflow: 'hidden' }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            indicatorColor="primary"
            textColor="primary"
            variant="fullWidth"
            sx={{
              borderBottom: '1px solid',
              borderColor: 'divider',
              '& .MuiTab-root': { fontWeight: 800, py: 2 },
            }}
          >
            <Tab label="Quản lý Gói cước (Plans)" />
            <Tab label="Lịch sử Giao dịch (Transactions)" />
            <Tab label="Lịch sử Subscription (Subscriptions)" />
          </Tabs>

          <Box sx={{ p: 3 }}>
            {/* Tab 0: Plans CRUD */}
            {activeTab === 0 && (
              <Stack spacing={3}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="h6" fontWeight={800}>
                    Danh sách gói cước (Plans)
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={handleOpenCreatePlan}
                    sx={{
                      bgcolor: '#6c63ff',
                      backgroundImage: 'linear-gradient(135deg, #6c63ff, #00bcd4)',
                      borderRadius: 2.5,
                      px: 3,
                    }}
                  >
                    Thêm gói cước mới
                  </Button>
                </Stack>

                {loadingPlans ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                    <CircularProgress size={34} color="secondary" />
                  </Box>
                ) : plans.length === 0 ? (
                  <Alert severity="info" sx={{ borderRadius: 3 }}>
                    Chưa cấu hình gói cước Premium nào trong hệ thống.
                  </Alert>
                ) : (
                  <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
                    <Table>
                      <TableHead sx={{ bgcolor: 'action.hover' }}>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 800 }}>Tên Gói</TableCell>
                          <TableCell sx={{ fontWeight: 800 }}>Giá Tiền</TableCell>
                          <TableCell sx={{ fontWeight: 800 }}>Thời hạn (Ngày)</TableCell>
                          <TableCell sx={{ fontWeight: 800 }}>Mô tả</TableCell>
                          <TableCell sx={{ fontWeight: 800 }}>Trạng thái</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 800 }}>Thao tác</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {plans.map((plan) => (
                          <TableRow key={plan._id} hover>
                            <TableCell sx={{ fontWeight: 750 }}>{plan.name}</TableCell>
                            <TableCell sx={{ fontWeight: 750, color: '#6c63ff' }}>{plan.price.toLocaleString('vi-VN')} đ</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>{plan.durationInDays} ngày</TableCell>
                            <TableCell sx={{ maxWidth: 300, color: 'text.secondary', fontSize: '13px' }}>
                              {plan.description.join(', ')}
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={plan.isActive ? 'Active' : 'Inactive'}
                                color={plan.isActive ? 'success' : 'default'}
                                size="small"
                                sx={{ fontWeight: 700 }}
                              />
                            </TableCell>
                            <TableCell align="right">
                              <Tooltip title="Chỉnh sửa">
                                <IconButton onClick={() => handleOpenEditPlan(plan)} color="primary" size="small" sx={{ mr: 0.5 }}>
                                  <EditIcon size="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Xóa/Tắt kích hoạt">
                                <IconButton onClick={() => handleOpenDeletePlan(plan)} color="error" size="small">
                                  <DeleteIcon size="small" />
                                </IconButton>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Stack>
            )}

            {/* Tab 1: Transactions Ledger */}
            {activeTab === 1 && (
              <Stack spacing={3}>
                {/* Search & Filter bar */}
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} sm={6} md={7}>
                    <TextField
                      fullWidth
                      placeholder="Tìm kiếm giao dịch theo Tên/Email khách hàng hoặc Mã Ref..."
                      value={txSearch}
                      onChange={handleTxSearchChange}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchIcon sx={{ color: 'text.secondary' }} />
                          </InputAdornment>
                        ),
                      }}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={3} md={2.5}>
                    <TextField
                      select
                      fullWidth
                      label="Trạng thái"
                      value={txStatus}
                      onChange={(e) => handleTxStatusChange(e.target.value)}
                      SelectProps={{ native: true }}
                      InputLabelProps={{ shrink: true }}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                    >
                      <option value="">Tất cả trạng thái</option>
                      <option value="success">Thành công</option>
                      <option value="pending">Đang chờ</option>
                      <option value="failed">Lỗi</option>
                      <option value="cancelled">Đã hủy</option>
                    </TextField>
                  </Grid>
                  <Grid item xs={12} sm={3} md={2.5} align="right">
                    <Button
                      variant="outlined"
                      startIcon={<RefreshIcon />}
                      onClick={fetchTransactions}
                      fullWidth
                      sx={{ borderRadius: 3, py: 1.5 }}
                    >
                      Tải lại gd
                    </Button>
                  </Grid>
                </Grid>

                {loadingTxs ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                    <CircularProgress size={34} color="secondary" />
                  </Box>
                ) : transactions.length === 0 ? (
                  <Alert severity="info" sx={{ borderRadius: 3 }}>
                    Không tìm thấy giao dịch nào khớp với điều kiện tìm kiếm.
                  </Alert>
                ) : (
                  <Stack spacing={2}>
                    <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
                      <Table>
                        <TableHead sx={{ bgcolor: 'action.hover' }}>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 800 }}>Mã Giao Dịch (Ref)</TableCell>
                            <TableCell sx={{ fontWeight: 800 }}>Khách Hàng</TableCell>
                            <TableCell sx={{ fontWeight: 800 }}>Gói Cước</TableCell>
                            <TableCell sx={{ fontWeight: 800 }}>Số Tiền</TableCell>
                            <TableCell sx={{ fontWeight: 800 }}>Cổng</TableCell>
                            <TableCell sx={{ fontWeight: 800 }}>Trạng Thái</TableCell>
                            <TableCell sx={{ fontWeight: 800 }}>Ngày Tạo</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {transactions.map((tx) => (
                            <TableRow key={tx._id} hover>
                              <TableCell sx={{ fontWeight: 700, fontFamily: 'monospace', fontSize: '13px' }}>
                                {tx.transactionRef}
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" fontWeight={750}>{tx.user?.name || 'User ẩn danh'}</Typography>
                                <Typography variant="caption" color="text.secondary">{tx.user?.email || 'N/A'}</Typography>
                              </TableCell>
                              <TableCell sx={{ fontWeight: 600 }}>{tx.plan?.name || 'N/A'}</TableCell>
                              <TableCell sx={{ fontWeight: 750, color: '#6c63ff' }}>{tx.amount.toLocaleString('vi-VN')} đ</TableCell>
                              <TableCell>
                                <Chip
                                  icon={<PaymentIcon />}
                                  label={tx.paymentMethod === 'vnpay' ? 'VNPay' : 'Mock Pay'}
                                  size="small"
                                  variant="outlined"
                                  sx={{ textTransform: 'uppercase', fontSize: '11px', fontWeight: 600 }}
                                />
                              </TableCell>
                              <TableCell>{getTxStatusChip(tx.status)}</TableCell>
                              <TableCell sx={{ fontSize: '13px', color: 'text.secondary' }}>
                                {new Date(tx.createdAt).toLocaleString('vi-VN')}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>

                    <TablePagination
                      component="div"
                      count={txTotal}
                      page={txPage}
                      onPageChange={(e, newPage) => setTxPage(newPage)}
                      rowsPerPage={txRowsPerPage}
                      onRowsPerPageChange={(e) => {
                        setTxRowsPerPage(parseInt(e.target.value, 10));
                        setTxPage(0);
                      }}
                      labelRowsPerPage="Số dòng mỗi trang:"
                    />
                  </Stack>
                )}
              </Stack>
            )}

            {/* Tab 2: Subscriptions Ledger */}
            {activeTab === 2 && (
              <Stack spacing={3}>
                {/* Search & Filter bar */}
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} sm={6} md={7}>
                    <TextField
                      fullWidth
                      placeholder="Tìm kiếm Subscription theo Tên hoặc Email người dùng..."
                      value={subSearch}
                      onChange={handleSubSearchChange}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchIcon sx={{ color: 'text.secondary' }} />
                          </InputAdornment>
                        ),
                      }}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={3} md={2.5}>
                    <TextField
                      select
                      fullWidth
                      label="Trạng thái"
                      value={subStatus}
                      onChange={(e) => handleSubStatusChange(e.target.value)}
                      SelectProps={{ native: true }}
                      InputLabelProps={{ shrink: true }}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                    >
                      <option value="">Tất cả trạng thái</option>
                      <option value="active">Đang hoạt động</option>
                      <option value="expired">Hết hạn</option>
                      <option value="pending">Chờ kích hoạt</option>
                      <option value="cancelled">Đã huỷ</option>
                    </TextField>
                  </Grid>
                  <Grid item xs={12} sm={3} md={2.5} align="right">
                    <Button
                      variant="outlined"
                      startIcon={<RefreshIcon />}
                      onClick={fetchSubscriptions}
                      fullWidth
                      sx={{ borderRadius: 3, py: 1.5 }}
                    >
                      Tải lại subs
                    </Button>
                  </Grid>
                </Grid>

                {loadingSubs ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                    <CircularProgress size={34} color="secondary" />
                  </Box>
                ) : subscriptions.length === 0 ? (
                  <Alert severity="info" sx={{ borderRadius: 3 }}>
                    Không tìm thấy Subscription nào khớp với điều kiện tìm kiếm.
                  </Alert>
                ) : (
                  <Stack spacing={2}>
                    <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
                      <Table>
                        <TableHead sx={{ bgcolor: 'action.hover' }}>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 800 }}>Khách Hàng</TableCell>
                            <TableCell sx={{ fontWeight: 800 }}>Gói Premium</TableCell>
                            <TableCell sx={{ fontWeight: 800 }}>Ngày Bắt Đầu</TableCell>
                            <TableCell sx={{ fontWeight: 800 }}>Ngày Hết Hạn</TableCell>
                            <TableCell sx={{ fontWeight: 800 }}>Trạng Thái</TableCell>
                            <TableCell sx={{ fontWeight: 800 }}>Giao Dịch Gốc (Ref)</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {subscriptions.map((sub) => (
                            <TableRow key={sub._id} hover>
                              <TableCell>
                                <Typography variant="body2" fontWeight={750}>{sub.user?.name || 'User ẩn danh'}</Typography>
                                <Typography variant="caption" color="text.secondary">{sub.user?.email || 'N/A'}</Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" fontWeight={700}>{sub.plan?.name || 'N/A'}</Typography>
                                <Typography variant="caption" color="text.secondary">{sub.plan?.durationInDays} ngày sử dụng</Typography>
                              </TableCell>
                              <TableCell sx={{ fontSize: '13px' }}>
                                {sub.startDate ? new Date(sub.startDate).toLocaleDateString('vi-VN') : 'Chưa bắt đầu'}
                              </TableCell>
                              <TableCell sx={{ fontSize: '13px', fontWeight: 600 }}>
                                {sub.endDate ? new Date(sub.endDate).toLocaleDateString('vi-VN') : 'Chưa xác định'}
                              </TableCell>
                              <TableCell>{getSubStatusChip(sub.status, sub.endDate)}</TableCell>
                              <TableCell sx={{ fontSize: '13px', fontFamily: 'monospace' }}>
                                {sub.transaction?.transactionRef ? (
                                  <Tooltip title={`Số tiền: ${(sub.transaction?.amount || 0).toLocaleString('vi-VN')} đ`}>
                                    <Chip label={sub.transaction?.transactionRef} size="small" variant="outlined" />
                                  </Tooltip>
                                ) : (
                                  'N/A'
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>

                    <TablePagination
                      component="div"
                      count={subTotal}
                      page={subPage}
                      onPageChange={(e, newPage) => setSubPage(newPage)}
                      rowsPerPage={subRowsPerPage}
                      onRowsPerPageChange={(e) => {
                        setSubRowsPerPage(parseInt(e.target.value, 10));
                        setSubPage(0);
                      }}
                      labelRowsPerPage="Số dòng mỗi trang:"
                    />
                  </Stack>
                )}
              </Stack>
            )}
          </Box>
        </Paper>
      </Stack>

      {/* dialog 1: CRUD PLAN */}
      <Dialog
        open={planDialogOpen}
        onClose={() => !submittingPlan && setPlanDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 4 } }}
      >
        <form onSubmit={handleSubmitPlan}>
          <DialogTitle sx={{ fontWeight: 850 }}>
            {editingPlanId ? 'Chỉnh sửa gói cước' : 'Thêm gói cước Premium mới'}
          </DialogTitle>
          <DialogContent>
            <Stack spacing={2.5} sx={{ mt: 1 }}>
              <TextField
                required
                fullWidth
                label="Tên gói cước"
                value={planForm.name}
                onChange={(e) => setPlanForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ví dụ: Premium 1 Tháng, VIP 6 Tháng..."
              />
              <TextField
                required
                fullWidth
                type="number"
                label="Giá cước (VNĐ)"
                value={planForm.price}
                onChange={(e) => setPlanForm(prev => ({ ...prev, price: e.target.value }))}
                InputProps={{
                  endAdornment: <InputAdornment position="end">đ</InputAdornment>,
                  inputProps: { min: 0 },
                }}
              />
              <TextField
                required
                fullWidth
                type="number"
                label="Thời hạn sử dụng (Ngày)"
                value={planForm.durationInDays}
                onChange={(e) => setPlanForm(prev => ({ ...prev, durationInDays: e.target.value }))}
                InputProps={{
                  endAdornment: <InputAdornment position="end">ngày</InputAdornment>,
                  inputProps: { min: 1 },
                }}
              />
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Đặc quyền / Mô tả gói (Cách nhau bởi dấu phẩy)"
                value={planForm.description}
                onChange={(e) => setPlanForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Ví dụ: Tải nhạc không giới hạn, Trò chuyện AI không giới hạn, Âm thanh chất lượng cao..."
                helperText="Mỗi câu phân cách bằng dấu phẩy sẽ hiển thị như 1 gạch đầu dòng quyền lợi."
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={planForm.isActive}
                    onChange={(e) => setPlanForm(prev => ({ ...prev, isActive: e.target.checked }))}
                    color="success"
                  />
                }
                label="Gói cước đang hoạt động (Hiển thị cho Client mua cước)"
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button disabled={submittingPlan} onClick={() => setPlanDialogOpen(false)} color="inherit">
              Hủy
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={submittingPlan}
              sx={{
                bgcolor: '#6c63ff',
                backgroundImage: 'linear-gradient(135deg, #6c63ff, #00bcd4)',
                borderRadius: 2,
                px: 3,
              }}
            >
              {submittingPlan ? <CircularProgress size={20} color="inherit" /> : 'Lưu gói cước'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* dialog 2: DELETE CONFIRMATION */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => !deletingPlan && setDeleteDialogOpen(false)}
        PaperProps={{ sx: { borderRadius: 4, p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 850, display: 'flex', alignItems: 'center', gap: 1 }}>
          <ErrorIcon sx={{ color: 'error.main' }} />
          Xác nhận gỡ gói cước?
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Bạn có chắc chắn muốn xóa gói cước <strong>{selectedPlan?.name}</strong>?
          </Typography>
          <Box sx={{ mt: 2, p: 1.5, bgcolor: 'action.hover', borderRadius: 2.5 }}>
            <Typography variant="caption" color="text.disabled" sx={{ display: 'block', fontStyle: 'italic' }}>
              💡 Lưu ý bảo vệ an toàn: Nếu gói cước đã có người đăng ký mua cước hoặc tạo giao dịch trong hệ thống, 
              hệ thống sẽ tự động ngưng hoạt động (deactivate) gói cước này thay vì xóa cứng khỏi cơ sở dữ liệu để bảo vệ tính toàn vẹn của lịch sử hoá đơn.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button disabled={deletingPlan} onClick={() => setDeleteDialogOpen(false)} color="inherit">
            Hủy
          </Button>
          <Button
            variant="contained"
            color="error"
            disabled={deletingPlan}
            onClick={handleDeletePlan}
            sx={{ borderRadius: 2, px: 3 }}
          >
            {deletingPlan ? <CircularProgress size={20} color="inherit" /> : 'Đồng ý xóa'}
          </Button>
        </DialogActions>
      </Dialog>
    </Layout>
  );
}

export default Premium;
