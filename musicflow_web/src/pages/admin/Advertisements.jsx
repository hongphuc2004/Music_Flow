import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Chip,
  TextField,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  CircularProgress,
  Grid,
  Stack,
  Divider,
  Card,
  CardContent,
  Tooltip,
  Switch,
  MenuItem,
  FormControlLabel,
  Checkbox,
  FormGroup,
  useTheme,
  Avatar,
} from '@mui/material';
import {
  Search as SearchIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Add as AddIcon,
  Refresh as RefreshIcon,
  CampaignRounded as CampaignIcon,
  GraphicEqRounded as AudioIcon,
  ViewCarouselRounded as BannerIcon,
  VisibilityRounded as ImpressionsIcon,
  TouchAppRounded as ClicksIcon,
  TrendingUpRounded as CtrIcon,
  CloudUploadRounded as UploadIcon,
  LinkRounded as LinkIcon,
} from '@mui/icons-material';
import { Layout } from '../../components/Layout';
import { adminAdsApi } from '../../services/admin/admin.service';
import api from '../../services/api';
import useAppToast from '../../components/common/js/useAppToast';

const INITIAL_FORM_DATA = {
  title: '',
  description: '',
  type: 'banner',
  audioUrl: '',
  imageUrl: '',
  targetUrl: '/client/premium',
  duration: 15,
  canSkip: false,
  skipAfterSeconds: 5,
  applicableTiers: ['basic'],
  isActive: true,
  priority: 1,
};

const TIERS_CONFIG = [
  { value: 'basic', label: 'Gói FREE (Basic)', color: '#9e9e9e' },
  { value: 'plus', label: 'Gói PLUS (49k)', color: '#00bcd4' },
  { value: 'premium', label: 'Gói PREMIUM (99k)', color: '#6c63ff' },
];

export default function Advertisements() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { showToast } = useAppToast();

  const [ads, setAds] = useState([]);
  const [stats, setStats] = useState({
    totalAds: 0,
    activeAds: 0,
    audioCount: 0,
    bannerCount: 0,
    totalImpressions: 0,
    totalClicks: 0,
    ctr: 0,
  });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [total, setTotal] = useState(0);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Dialog State
  const [editDialog, setEditDialog] = useState({ open: false, isEdit: false, adId: null });
  const [formData, setFormData] = useState(INITIAL_FORM_DATA);
  const [formLoading, setFormLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);

  // Delete Dialog State
  const [deleteDialog, setDeleteDialog] = useState({ open: false, ad: null });
  const [deleteLoading, setDeleteLoading] = useState(false);

  // File input refs
  const imageInputRef = useRef(null);
  const audioInputRef = useRef(null);

  // Fetch metrics overview
  const fetchStats = useCallback(async () => {
    try {
      const res = await adminAdsApi.getStats();
      if (res.data?.success && res.data?.data) {
        setStats(res.data.data);
      }
    } catch (err) {
      console.warn('Lỗi tải thống kê quảng cáo:', err);
    }
  }, []);

  // Fetch ads list
  const fetchAds = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        page: page + 1,
        limit: rowsPerPage,
        search: searchQuery.trim() || undefined,
        type: typeFilter !== 'all' ? typeFilter : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      };
      const res = await adminAdsApi.getAll(params);
      if (res.data?.success) {
        setAds(res.data.data || []);
        setTotal(res.data.total || 0);
      }
    } catch (err) {
      showToast({
        severity: 'error',
        title: 'Lỗi',
        message: err.response?.data?.message || 'Không thể tải danh sách quảng cáo.',
      });
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, searchQuery, typeFilter, statusFilter, showToast]);

  useEffect(() => {
    fetchStats();
    fetchAds();
  }, [fetchStats, fetchAds]);

  // Handle Quick Toggle Status
  const handleToggleActive = async (ad) => {
    try {
      const res = await adminAdsApi.toggleActive(ad._id);
      if (res.data?.success) {
        showToast({
          severity: 'success',
          title: 'Thành công',
          message: res.data.message || 'Đã cập nhật trạng thái quảng cáo.',
        });
        setAds((prev) =>
          prev.map((item) => (item._id === ad._id ? { ...item, isActive: !item.isActive } : item))
        );
        fetchStats();
      }
    } catch (err) {
      showToast({
        severity: 'error',
        title: 'Lỗi',
        message: err.response?.data?.message || 'Không thể cập nhật trạng thái.',
      });
    }
  };

  // Open Create Dialog
  const handleOpenCreate = () => {
    setFormData(INITIAL_FORM_DATA);
    setEditDialog({ open: true, isEdit: false, adId: null });
  };

  // Open Edit Dialog
  const handleOpenEdit = (ad) => {
    setFormData({
      title: ad.title || '',
      description: ad.description || '',
      type: ad.type || 'banner',
      audioUrl: ad.audioUrl || '',
      imageUrl: ad.imageUrl || '',
      targetUrl: ad.targetUrl || '/client/premium',
      duration: ad.duration || 15,
      canSkip: Boolean(ad.canSkip),
      skipAfterSeconds: ad.skipAfterSeconds || 5,
      applicableTiers: Array.isArray(ad.applicableTiers) ? ad.applicableTiers : ['basic'],
      isActive: ad.isActive !== undefined ? Boolean(ad.isActive) : true,
      priority: ad.priority || 1,
    });
    setEditDialog({ open: true, isEdit: true, adId: ad._id });
  };

  // Handle Upload Image
  const handleImageFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingImage(true);
      const uploadData = new FormData();
      uploadData.append('image', file);
      const res = await api.post('/upload/image', uploadData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data?.url) {
        setFormData((prev) => ({ ...prev, imageUrl: res.data.url }));
        showToast({ severity: 'success', title: 'Tải ảnh lên thành công!' });
      }
    } catch (err) {
      showToast({
        severity: 'error',
        title: 'Tải ảnh thất bại',
        message: err.response?.data?.message || 'Vui lòng thử lại.',
      });
    } finally {
      setUploadingImage(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

  // Handle Upload Audio
  const handleAudioFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingAudio(true);
      const uploadData = new FormData();
      uploadData.append('audio', file);
      const res = await api.post('/upload/audio', uploadData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data?.url) {
        setFormData((prev) => ({ ...prev, audioUrl: res.data.url }));
        showToast({ severity: 'success', title: 'Tải file âm thanh thành công!' });
      }
    } catch (err) {
      showToast({
        severity: 'error',
        title: 'Tải audio thất bại',
        message: err.response?.data?.message || 'Vui lòng kiểm tra định dạng mp3/wav.',
      });
    } finally {
      setUploadingAudio(false);
      if (audioInputRef.current) audioInputRef.current.value = '';
    }
  };

  // Submit Create or Edit Form
  const handleSubmitForm = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      showToast({ severity: 'warning', title: 'Vui lòng nhập tiêu đề chiến dịch.' });
      return;
    }
    if (formData.type === 'audio' && !formData.audioUrl.trim()) {
      showToast({ severity: 'warning', title: 'Quảng cáo Audio yêu cầu phải có Audio URL.' });
      return;
    }

    try {
      setFormLoading(true);
      if (editDialog.isEdit) {
        await adminAdsApi.update(editDialog.adId, formData);
        showToast({ severity: 'success', title: 'Cập nhật chiến dịch thành công!' });
      } else {
        await adminAdsApi.create(formData);
        showToast({ severity: 'success', title: 'Tạo chiến dịch quảng cáo mới thành công!' });
      }
      setEditDialog({ open: false, isEdit: false, adId: null });
      fetchAds();
      fetchStats();
    } catch (err) {
      showToast({
        severity: 'error',
        title: 'Lỗi',
        message: err.response?.data?.message || 'Không thể lưu quảng cáo.',
      });
    } finally {
      setFormLoading(false);
    }
  };

  // Handle Delete
  const handleConfirmDelete = async () => {
    if (!deleteDialog.ad) return;
    try {
      setDeleteLoading(true);
      await adminAdsApi.delete(deleteDialog.ad._id);
      showToast({ severity: 'success', title: 'Đã xóa chiến dịch quảng cáo.' });
      setDeleteDialog({ open: false, ad: null });
      fetchAds();
      fetchStats();
    } catch (err) {
      showToast({
        severity: 'error',
        title: 'Lỗi xóa',
        message: err.response?.data?.message || 'Không thể xóa quảng cáo.',
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  // Toggle applicable tiers helper
  const handleTierToggle = (tierValue) => {
    setFormData((prev) => {
      const exists = prev.applicableTiers.includes(tierValue);
      const nextTiers = exists
        ? prev.applicableTiers.filter((t) => t !== tierValue)
        : [...prev.applicableTiers, tierValue];
      return { ...prev, applicableTiers: nextTiers };
    });
  };

  return (
    <Layout title="Quản Lý Quảng Cáo">
      <Box sx={{ width: '100%', pb: 3 }}>
        {/* Header */}
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          justifyContent="space-between"
          spacing={2}
          sx={{ mb: 3 }}
        >
          <Box>
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 0.5 }}>
              <Box
                sx={{
                  width: 38,
                  height: 38,
                  borderRadius: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: 'rgba(108, 99, 255, 0.15)',
                  color: '#6c63ff',
                }}
              >
                <CampaignIcon sx={{ fontSize: 22 }} />
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: -0.5 }}>
                Quản Lý Quảng Cáo
              </Typography>
            </Stack>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Kiểm soát chiến dịch Banner & Audio Ads xen kẽ, theo dõi Impressions, Clicks và CTR thực tế.
            </Typography>
          </Box>

          <Stack direction="row" spacing={1.5} alignItems="center">
            <Tooltip title="Làm mới dữ liệu">
              <IconButton
                onClick={() => {
                  fetchStats();
                  fetchAds();
                }}
                disabled={loading}
                sx={{
                  borderRadius: 1.5,
                  bgcolor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
                }}
              >
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleOpenCreate}
              sx={{
                background: 'linear-gradient(135deg, #6c63ff 0%, #00bcd4 100%)',
                color: '#fff',
                fontWeight: 700,
                borderRadius: 1.5,
                px: 2.5,
                py: 0.9,
                textTransform: 'none',
                boxShadow: '0 4px 14px rgba(108, 99, 255, 0.3)',
              }}
            >
              Tạo Chiến Dịch
            </Button>
          </Stack>
        </Stack>

        {/* ── 4 Thống kê thực tế Cards ── */}
        <Grid container spacing={2.5} sx={{ mb: 3 }}>
          {/* Card 1: Tổng chiến dịch */}
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <Card
              sx={{
                borderRadius: 2,
                background: isDark
                  ? 'linear-gradient(135deg, rgba(108, 99, 255, 0.1) 0%, rgba(18, 22, 34, 0.9) 100%)'
                  : 'linear-gradient(135deg, rgba(108, 99, 255, 0.05) 0%, #fff 100%)',
                border: '1px solid',
                borderColor: isDark ? 'rgba(108, 99, 255, 0.22)' : 'rgba(108, 99, 255, 0.16)',
                boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
              }}
            >
              <CardContent sx={{ p: 2.2, '&:last-child': { pb: 2.2 } }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                      Chiến Dịch
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 800, mt: 0.5, color: '#6c63ff' }}>
                      {stats.totalAds}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {stats.activeAds} đang chạy • {stats.audioCount} audio, {stats.bannerCount} banner
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      width: 44,
                      height: 44,
                      borderRadius: 1.5,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: 'rgba(108, 99, 255, 0.15)',
                      color: '#6c63ff',
                    }}
                  >
                    <CampaignIcon sx={{ fontSize: 24 }} />
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          {/* Card 2: Lượt xem Impression */}
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <Card
              sx={{
                borderRadius: 2,
                background: isDark
                  ? 'linear-gradient(135deg, rgba(0, 188, 212, 0.1) 0%, rgba(18, 22, 34, 0.9) 100%)'
                  : 'linear-gradient(135deg, rgba(0, 188, 212, 0.05) 0%, #fff 100%)',
                border: '1px solid',
                borderColor: isDark ? 'rgba(0, 188, 212, 0.22)' : 'rgba(0, 188, 212, 0.16)',
                boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
              }}
            >
              <CardContent sx={{ p: 2.2, '&:last-child': { pb: 2.2 } }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                      Lượt Hiển Thị (Impressions)
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 800, mt: 0.5, color: '#00bcd4' }}>
                      {stats.totalImpressions.toLocaleString('vi-VN')}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      Tracking thực tế từ Client & App
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      width: 44,
                      height: 44,
                      borderRadius: 1.5,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: 'rgba(0, 188, 212, 0.15)',
                      color: '#00bcd4',
                    }}
                  >
                    <ImpressionsIcon sx={{ fontSize: 24 }} />
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          {/* Card 3: Lượt Click */}
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <Card
              sx={{
                borderRadius: 2,
                background: isDark
                  ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(18, 22, 34, 0.9) 100%)'
                  : 'linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, #fff 100%)',
                border: '1px solid',
                borderColor: isDark ? 'rgba(16, 185, 129, 0.22)' : 'rgba(16, 185, 129, 0.16)',
                boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
              }}
            >
              <CardContent sx={{ p: 2.2, '&:last-child': { pb: 2.2 } }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                      Lượt Tương Tác (Clicks)
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 800, mt: 0.5, color: '#10b981' }}>
                      {stats.totalClicks.toLocaleString('vi-VN')}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      Lượt bấm vào link chiến dịch
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      width: 44,
                      height: 44,
                      borderRadius: 1.5,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: 'rgba(16, 185, 129, 0.15)',
                      color: '#10b981',
                    }}
                  >
                    <ClicksIcon sx={{ fontSize: 24 }} />
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          {/* Card 4: Tỷ lệ CTR */}
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <Card
              sx={{
                borderRadius: 2,
                background: isDark
                  ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(18, 22, 34, 0.9) 100%)'
                  : 'linear-gradient(135deg, rgba(245, 158, 11, 0.05) 0%, #fff 100%)',
                border: '1px solid',
                borderColor: isDark ? 'rgba(245, 158, 11, 0.22)' : 'rgba(245, 158, 11, 0.16)',
                boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
              }}
            >
              <CardContent sx={{ p: 2.2, '&:last-child': { pb: 2.2 } }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                      Tỷ Lệ Nhấp (CTR)
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 800, mt: 0.5, color: '#f59e0b' }}>
                      {stats.ctr}%
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      Hiệu quả chuyển đổi trung bình
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      width: 44,
                      height: 44,
                      borderRadius: 1.5,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: 'rgba(245, 158, 11, 0.15)',
                      color: '#f59e0b',
                    }}
                  >
                    <CtrIcon sx={{ fontSize: 24 }} />
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* ── Filter Bar ── */}
        <Paper
          sx={{
            p: 2,
            mb: 2.5,
            borderRadius: 2,
            bgcolor: isDark ? 'rgba(255, 255, 255, 0.02)' : '#fff',
            border: '1px solid',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.07)',
          }}
        >
          <Grid container spacing={2} alignItems="center">
            <Grid size={{ xs: 12, md: 5 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Tìm kiếm theo tiêu đề hoặc nội dung..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(0);
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: 'text.secondary' }} />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 1.5,
                  },
                }}
              />
            </Grid>

            <Grid size={{ xs: 6, md: 3.5 }}>
              <TextField
                select
                fullWidth
                size="small"
                label="Loại quảng cáo"
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  setPage(0);
                }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
              >
                <MenuItem value="all">Tất cả định dạng</MenuItem>
                <MenuItem value="audio">Audio Ad (Âm thanh xen kẽ)</MenuItem>
                <MenuItem value="banner">Banner Ad (Hiển thị thẻ banner)</MenuItem>
              </TextField>
            </Grid>

            <Grid size={{ xs: 6, md: 3.5 }}>
              <TextField
                select
                fullWidth
                size="small"
                label="Trạng thái"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(0);
                }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
              >
                <MenuItem value="all">Tất cả trạng thái</MenuItem>
                <MenuItem value="active">Đang kích hoạt</MenuItem>
                <MenuItem value="inactive">Đã tạm dừng</MenuItem>
              </TextField>
            </Grid>
          </Grid>
        </Paper>

        {/* ── Table Danh Sách Quảng Cáo ── */}
        <Paper
          sx={{
            borderRadius: 2,
            overflow: 'hidden',
            border: '1px solid',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.07)',
            boxShadow: '0 2px 14px rgba(0,0,0,0.03)',
          }}
        >
          <TableContainer>
            <Table sx={{ minWidth: 800 }}>
              <TableHead sx={{ bgcolor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 800, py: 1.6 }}>Chiến Dịch</TableCell>
                  <TableCell sx={{ fontWeight: 800, py: 1.6 }}>Định Dạng</TableCell>
                  <TableCell sx={{ fontWeight: 800, py: 1.6 }}>Gói Áp Dụng</TableCell>
                  <TableCell sx={{ fontWeight: 800, py: 1.6 }}>Ưu Tiên</TableCell>
                  <TableCell sx={{ fontWeight: 800, py: 1.6 }}>Hiển Thị / Click</TableCell>
                  <TableCell sx={{ fontWeight: 800, py: 1.6 }}>CTR</TableCell>
                  <TableCell sx={{ fontWeight: 800, py: 1.6 }}>Trạng Thái</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, py: 1.6 }}>Hành Động</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                      <CircularProgress size={32} sx={{ color: '#6c63ff' }} />
                    </TableCell>
                  </TableRow>
                ) : ads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                      <Typography variant="body1" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                        Không tìm thấy chiến dịch quảng cáo nào phù hợp.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  ads.map((ad) => {
                    const adCtr =
                      ad.impressionCount > 0
                        ? ((ad.clickCount / ad.impressionCount) * 100).toFixed(1)
                        : '0.0';

                    return (
                      <TableRow
                        key={ad._id}
                        hover
                        sx={{
                          '&:last-child td, &:last-child th': { border: 0 },
                          transition: 'background 0.2s ease',
                        }}
                      >
                        {/* Cột Chiến dịch */}
                        <TableCell sx={{ py: 1.8 }}>
                          <Stack direction="row" spacing={1.8} alignItems="center">
                            <Avatar
                              src={ad.imageUrl || undefined}
                              variant="rounded"
                              sx={{
                                width: 44,
                                height: 44,
                                borderRadius: 1.5,
                                bgcolor: ad.type === 'audio' ? 'rgba(108, 99, 255, 0.15)' : 'rgba(0, 188, 212, 0.15)',
                                color: ad.type === 'audio' ? '#6c63ff' : '#00bcd4',
                              }}
                            >
                              {ad.type === 'audio' ? <AudioIcon /> : <BannerIcon />}
                            </Avatar>
                            <Box sx={{ minWidth: 0, maxWidth: 380 }}>
                              <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary' }} noWrap>
                                {ad.title}
                              </Typography>
                              <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap display="block">
                                {ad.description || 'Không có mô tả'}
                              </Typography>
                              {ad.targetUrl && (
                                <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.3 }}>
                                  <LinkIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
                                  <Typography variant="caption" sx={{ color: '#6c63ff', fontSize: 11.5 }} noWrap>
                                    {ad.targetUrl}
                                  </Typography>
                                </Stack>
                              )}
                            </Box>
                          </Stack>
                        </TableCell>

                        {/* Cột Định dạng */}
                        <TableCell sx={{ py: 1.8 }}>
                          <Stack spacing={0.5} alignItems="flex-start">
                            <Chip
                              size="small"
                              icon={ad.type === 'audio' ? <AudioIcon sx={{ fontSize: 14 }} /> : <BannerIcon sx={{ fontSize: 14 }} />}
                              label={ad.type === 'audio' ? 'Audio Ad' : 'Banner Ad'}
                              sx={{
                                fontWeight: 700,
                                fontSize: 11,
                                borderRadius: 1,
                                bgcolor: ad.type === 'audio' ? 'rgba(108, 99, 255, 0.12)' : 'rgba(0, 188, 212, 0.12)',
                                color: ad.type === 'audio' ? '#6c63ff' : '#00bcd4',
                              }}
                            />
                            {ad.type === 'audio' && (
                              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 11 }}>
                                {ad.duration || 15}s {ad.canSkip ? `• Bỏ qua sau ${ad.skipAfterSeconds}s` : '• Không skip'}
                              </Typography>
                            )}
                          </Stack>
                        </TableCell>

                        {/* Cột Gói áp dụng */}
                        <TableCell sx={{ py: 1.8 }}>
                          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ maxWidth: 180 }}>
                            {(ad.applicableTiers || ['basic']).map((tier) => {
                              const config = TIERS_CONFIG.find((t) => t.value === tier);
                              return (
                                <Chip
                                  key={tier}
                                  size="small"
                                  label={tier.toUpperCase()}
                                  sx={{
                                    height: 20,
                                    fontSize: 9.5,
                                    fontWeight: 800,
                                    borderRadius: 1,
                                    bgcolor: config ? `${config.color}20` : 'rgba(255,255,255,0.08)',
                                    color: config?.color || 'text.secondary',
                                  }}
                                />
                              );
                            })}
                          </Stack>
                        </TableCell>

                        {/* Cột Độ ưu tiên */}
                        <TableCell sx={{ py: 1.8 }}>
                          <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                            #{ad.priority || 1}
                          </Typography>
                        </TableCell>

                        {/* Cột Hiển thị / Click */}
                        <TableCell sx={{ py: 1.8 }}>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {(ad.impressionCount || 0).toLocaleString()} <Typography component="span" variant="caption" color="text.secondary">views</Typography>
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#10b981', fontWeight: 600 }}>
                            {(ad.clickCount || 0).toLocaleString()} clicks
                          </Typography>
                        </TableCell>

                        {/* Cột CTR */}
                        <TableCell sx={{ py: 1.8 }}>
                          <Chip
                            size="small"
                            label={`${adCtr}%`}
                            sx={{
                              fontWeight: 800,
                              fontSize: 11,
                              borderRadius: 1,
                              bgcolor: Number(adCtr) > 5 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                              color: Number(adCtr) > 5 ? '#10b981' : '#f59e0b',
                            }}
                          />
                        </TableCell>

                        {/* Cột Trạng thái */}
                        <TableCell sx={{ py: 1.8 }}>
                          <FormControlLabel
                            control={
                              <Switch
                                size="small"
                                checked={Boolean(ad.isActive)}
                                onChange={() => handleToggleActive(ad)}
                                color="primary"
                              />
                            }
                            label={
                              <Typography variant="caption" sx={{ fontWeight: 700, color: ad.isActive ? '#10b981' : 'text.disabled' }}>
                                {ad.isActive ? 'Đang chạy' : 'Tạm dừng'}
                              </Typography>
                            }
                          />
                        </TableCell>

                        {/* Cột Hành động */}
                        <TableCell align="right" sx={{ py: 1.8 }}>
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            <Tooltip title="Chỉnh sửa">
                              <IconButton
                                size="small"
                                onClick={() => handleOpenEdit(ad)}
                                sx={{ color: '#6c63ff', borderRadius: 1 }}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Xóa">
                              <IconButton
                                size="small"
                                onClick={() => setDeleteDialog({ open: true, ad })}
                                sx={{ color: 'error.main', borderRadius: 1 }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <TablePagination
            rowsPerPageOptions={[5, 10, 25]}
            component="div"
            count={total}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={(e, newPage) => setPage(newPage)}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
            labelRowsPerPage="Số dòng:"
          />
        </Paper>

        {/* ── Dialog Thêm / Sửa Chiến Dịch ── */}
        <Dialog
          open={editDialog.open}
          onClose={() => !formLoading && setEditDialog({ open: false, isEdit: false, adId: null })}
          maxWidth="md"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 2,
              bgcolor: isDark ? '#131826' : '#fff',
              backgroundImage: 'none',
            },
          }}
        >
          <form onSubmit={handleSubmitForm}>
            <DialogTitle sx={{ pb: 1, fontWeight: 800 }}>
              {editDialog.isEdit ? 'Chỉnh Sửa Chiến Dịch Quảng Cáo' : 'Tạo Chiến Dịch Quảng Cáo Mới'}
            </DialogTitle>
            <Divider />

            <DialogContent sx={{ py: 2.5 }}>
              <Grid container spacing={2.5}>
                {/* Tiêu đề */}
                <Grid size={{ xs: 12, md: 8 }}>
                  <TextField
                    fullWidth
                    required
                    label="Tiêu đề chiến dịch"
                    placeholder="VD: Nâng cấp Gói PLUS nghe nhạc không gián đoạn"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
                  />
                </Grid>

                {/* Loại quảng cáo */}
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    select
                    fullWidth
                    label="Loại quảng cáo"
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
                  >
                    <MenuItem value="banner">Banner Ad (Hiển thị thẻ banner)</MenuItem>
                    <MenuItem value="audio">Audio Ad (Âm thanh xen kẽ)</MenuItem>
                  </TextField>
                </Grid>

                {/* Mô tả */}
                <Grid size={{ xs: 12 }}>
                  <TextField
                    fullWidth
                    multiline
                    rows={2}
                    label="Mô tả / Thông điệp quảng cáo"
                    placeholder="VD: Chỉ 19.000đ/tháng mở khóa chuyển bài không giới hạn và giảm quảng cáo..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
                  />
                </Grid>

                {/* Target URL */}
                <Grid size={{ xs: 12, md: 8 }}>
                  <TextField
                    fullWidth
                    label="Target URL (Đích đến khi người dùng click)"
                    placeholder="VD: /client/premium hoặc https://..."
                    value={formData.targetUrl}
                    onChange={(e) => setFormData({ ...formData, targetUrl: e.target.value })}
                    helperText="Có thể là trang nội bộ (/client/premium) hoặc link ngoài (https://...)"
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
                  />
                </Grid>

                {/* Priority */}
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Độ ưu tiên (Priority)"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value, 10) || 1 })}
                    helperText="Số càng lớn càng được ưu tiên xuất hiện trước"
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
                  />
                </Grid>

                {/* Ảnh quảng cáo / Banner Image */}
                <Grid size={{ xs: 12 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                    Hình ảnh Banner / Thumbnail
                  </Typography>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
                    <TextField
                      fullWidth
                      size="small"
                      label="Image URL"
                      placeholder="https://res.cloudinary.com/..."
                      value={formData.imageUrl}
                      onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
                    />
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={handleImageFileChange}
                    />
                    <Button
                      variant="outlined"
                      startIcon={uploadingImage ? <CircularProgress size={18} /> : <UploadIcon />}
                      onClick={() => imageInputRef.current?.click()}
                      disabled={uploadingImage}
                      sx={{ borderRadius: 1.5, minWidth: 140, textTransform: 'none', py: 0.9 }}
                    >
                      {uploadingImage ? 'Đang tải...' : 'Tải ảnh lên'}
                    </Button>
                  </Stack>
                  {formData.imageUrl && (
                    <Box sx={{ mt: 1.5 }}>
                      <Box
                        component="img"
                        src={formData.imageUrl}
                        alt="Preview"
                        sx={{
                          height: 70,
                          borderRadius: 1.5,
                          objectFit: 'cover',
                          border: '1px solid',
                          borderColor: 'divider',
                        }}
                      />
                    </Box>
                  )}
                </Grid>

                {/* Audio Settings (Nếu type là Audio) */}
                {formData.type === 'audio' && (
                  <>
                    <Grid size={{ xs: 12 }}>
                      <Divider sx={{ my: 0.5 }}>
                        <Chip label="Cấu hình Audio Ad Xen Kẽ" size="small" sx={{ fontWeight: 700, borderRadius: 1 }} />
                      </Divider>
                    </Grid>

                    <Grid size={{ xs: 12 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                        File Âm Thanh Quảng Cáo (Audio URL)*
                      </Typography>
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
                        <TextField
                          fullWidth
                          required
                          size="small"
                          label="Audio URL"
                          placeholder="https://res.cloudinary.com/.../audio.mp3"
                          value={formData.audioUrl}
                          onChange={(e) => setFormData({ ...formData, audioUrl: e.target.value })}
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
                        />
                        <input
                          ref={audioInputRef}
                          type="file"
                          accept="audio/*"
                          style={{ display: 'none' }}
                          onChange={handleAudioFileChange}
                        />
                        <Button
                          variant="outlined"
                          startIcon={uploadingAudio ? <CircularProgress size={18} /> : <UploadIcon />}
                          onClick={() => audioInputRef.current?.click()}
                          disabled={uploadingAudio}
                          sx={{ borderRadius: 1.5, minWidth: 140, textTransform: 'none', py: 0.9 }}
                        >
                          {uploadingAudio ? 'Đang tải...' : 'Tải audio lên'}
                        </Button>
                      </Stack>
                    </Grid>

                    <Grid size={{ xs: 12, sm: 4 }}>
                      <TextField
                        fullWidth
                        type="number"
                        label="Thời lượng ước tính (giây)"
                        value={formData.duration}
                        onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value, 10) || 15 })}
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
                      />
                    </Grid>

                    <Grid size={{ xs: 12, sm: 4 }}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={formData.canSkip}
                            onChange={(e) => setFormData({ ...formData, canSkip: e.target.checked })}
                          />
                        }
                        label="Cho phép bỏ qua (Skip)"
                        sx={{ mt: 1 }}
                      />
                    </Grid>

                    <Grid size={{ xs: 12, sm: 4 }}>
                      <TextField
                        fullWidth
                        type="number"
                        label="Bỏ qua sau (giây)"
                        disabled={!formData.canSkip}
                        value={formData.skipAfterSeconds}
                        onChange={(e) => setFormData({ ...formData, skipAfterSeconds: parseInt(e.target.value, 10) || 5 })}
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
                      />
                    </Grid>
                  </>
                )}

                {/* Gói áp dụng */}
                <Grid size={{ xs: 12 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                    Gói tài khoản áp dụng hiển thị quảng cáo:
                  </Typography>
                  <FormGroup row>
                    {TIERS_CONFIG.map((tier) => (
                      <FormControlLabel
                        key={tier.value}
                        control={
                          <Checkbox
                            checked={formData.applicableTiers.includes(tier.value)}
                            onChange={() => handleTierToggle(tier.value)}
                          />
                        }
                        label={tier.label}
                      />
                    ))}
                  </FormGroup>
                </Grid>

                {/* Trạng thái kích hoạt */}
                <Grid size={{ xs: 12 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.isActive}
                        onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                        color="primary"
                      />
                    }
                    label={
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        Kích hoạt ngay khi lưu chiến dịch
                      </Typography>
                    }
                  />
                </Grid>
              </Grid>
            </DialogContent>

            <Divider />
            <DialogActions sx={{ p: 2 }}>
              <Button
                onClick={() => setEditDialog({ open: false, isEdit: false, adId: null })}
                disabled={formLoading}
                sx={{ textTransform: 'none', color: 'text.secondary', borderRadius: 1.5 }}
              >
                Hủy
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={formLoading}
                sx={{
                  background: 'linear-gradient(135deg, #6c63ff 0%, #00bcd4 100%)',
                  fontWeight: 700,
                  borderRadius: 1.5,
                  px: 3,
                  textTransform: 'none',
                }}
              >
                {formLoading ? <CircularProgress size={20} color="inherit" /> : editDialog.isEdit ? 'Lưu Thay Đổi' : 'Tạo Chiến Dịch'}
              </Button>
            </DialogActions>
          </form>
        </Dialog>

        {/* ── Dialog Xác Nhận Xóa ── */}
        <Dialog
          open={deleteDialog.open}
          onClose={() => !deleteLoading && setDeleteDialog({ open: false, ad: null })}
          PaperProps={{ sx: { borderRadius: 2, p: 1 } }}
        >
          <DialogTitle sx={{ fontWeight: 800 }}>Xác nhận xóa chiến dịch quảng cáo?</DialogTitle>
          <DialogContent>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Bạn có chắc chắn muốn xóa chiến dịch <strong>"{deleteDialog.ad?.title}"</strong>? Lịch sử thống kê impressions và clicks của chiến dịch này sẽ bị xóa khỏi hệ thống.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button
              onClick={() => setDeleteDialog({ open: false, ad: null })}
              disabled={deleteLoading}
              sx={{ textTransform: 'none', borderRadius: 1.5 }}
            >
              Hủy
            </Button>
            <Button
              onClick={handleConfirmDelete}
              variant="contained"
              color="error"
              disabled={deleteLoading}
              sx={{ textTransform: 'none', borderRadius: 1.5 }}
            >
              {deleteLoading ? <CircularProgress size={20} color="inherit" /> : 'Xác nhận xóa'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Layout>
  );
}
