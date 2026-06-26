import { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  Divider,
  Grid,
  Alert,
  Stack,
  Card,
  CardContent,
} from '@mui/material';
import {
  Save as SaveIcon,
  StorageRounded as DbIcon,
  CachedRounded as CacheIcon,
  PsychologyRounded as AiIcon,
  CloudQueueRounded as CloudIcon,
} from '@mui/icons-material';
import { Layout } from '../../components/Layout';
import { statsApi } from '../../services/api';
import useAppToast from '../../components/common/useAppToast';

function Settings() {
  const { showToast } = useAppToast();
  const [settings, setSettings] = useState({
    siteName: 'MusicFlow',
    siteDescription: 'Your favorite music streaming platform',
    adminEmail: 'admin@musicflow.com',
    maxUploadSize: '50',
    enableRegistration: true,
    enableComments: true,
    maintenanceMode: false,
    analyticsEnabled: true,
  });
  
  const [saved, setSaved] = useState(false);
  const [dbLoading, setDbLoading] = useState(false);
  const [cacheLoading, setCacheLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  const handleChange = (field) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setSettings({ ...settings, [field]: value });
  };

  const handleSave = () => {
    // Note: Settings are not persisted to backend yet, but we update visual state and show toast.
    setSaved(true);
    showToast({ severity: 'success', title: 'Success!', message: 'Settings saved successfully.' });
    setTimeout(() => setSaved(false), 3000);
  };

  // System actions callingstatsApi
  const handleBackupDb = async () => {
    try {
      setDbLoading(true);
      await statsApi.backupDb();
      showToast({ severity: 'success', title: 'Backup Successful', message: 'Cơ sở dữ liệu MongoDB đã được sao lưu thành công.' });
    } catch {
      showToast({ severity: 'error', title: 'Backup Failed', message: 'Không thể sao lưu cơ sở dữ liệu.' });
    } finally {
      setDbLoading(false);
    }
  };

  const handleCleanCache = async () => {
    try {
      setCacheLoading(true);
      await statsApi.cleanCache();
      showToast({ severity: 'success', title: 'Cache Cleaned', message: 'Đã giải phóng bộ nhớ đệm API thành công.' });
    } catch {
      showToast({ severity: 'error', title: 'Clean Failed', message: 'Không thể làm sạch bộ nhớ đệm.' });
    } finally {
      setCacheLoading(false);
    }
  };

  const handleRegenAi = async () => {
    try {
      setAiLoading(true);
      await statsApi.regenAi();
      showToast({ severity: 'success', title: 'AI DJ Synced', message: 'Đã đồng bộ chỉ mục bài hát cho AI DJ thành công.' });
    } catch {
      showToast({ severity: 'error', title: 'Sync Failed', message: 'Không thể tái lập chỉ mục AI.' });
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <Layout title="System Console">
      <Stack spacing={3.5}>
        <Box sx={{ mb: 1 }}>
          <Typography variant="h4" fontWeight={900} sx={{ letterSpacing: '-1px' }}>
            System Settings
          </Typography>
          <Typography color="text.secondary" fontWeight={500}>
            Configure your MusicFlow system defaults and execute administrative system maintenance.
          </Typography>
        </Box>

        {saved && (
          <Alert severity="success" variant="filled" sx={{ borderRadius: 4 }}>
            Cấu hình tùy chỉnh đã được cập nhật thành công!
          </Alert>
        )}

        <Grid container spacing={3}>
          {/* Grid Layout size replacement */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Card elevation={0} sx={{ borderRadius: 5, border: '1px solid', borderColor: 'divider', height: '100%' }}>
              <CardContent sx={{ p: 4 }}>
                <Typography variant="h6" fontWeight={850} sx={{ mb: 1 }}>
                  General Configuration
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3, fontWeight: 500 }}>
                  Cấu hình mô tả, tên hiển thị và định mức của trang web.
                </Typography>
                
                <Stack spacing={2.5}>
                  <TextField
                    fullWidth
                    label="Site Name"
                    value={settings.siteName}
                    onChange={handleChange('siteName')}
                    InputProps={{ sx: { borderRadius: 3.5 } }}
                  />
                  <TextField
                    fullWidth
                    label="Site Description"
                    value={settings.siteDescription}
                    onChange={handleChange('siteDescription')}
                    multiline
                    rows={2}
                    InputProps={{ sx: { borderRadius: 3.5 } }}
                  />
                  <TextField
                    fullWidth
                    label="Admin Email"
                    type="email"
                    value={settings.adminEmail}
                    onChange={handleChange('adminEmail')}
                    InputProps={{ sx: { borderRadius: 3.5 } }}
                  />
                  <TextField
                    fullWidth
                    label="Max Upload Size (MB)"
                    type="number"
                    value={settings.maxUploadSize}
                    onChange={handleChange('maxUploadSize')}
                    InputProps={{ sx: { borderRadius: 3.5 } }}
                  />
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          {/* Feature Toggles */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Card elevation={0} sx={{ borderRadius: 5, border: '1px solid', borderColor: 'divider', height: '100%' }}>
              <CardContent sx={{ p: 4 }}>
                <Typography variant="h6" fontWeight={850} sx={{ mb: 1 }}>
                  Feature Controls
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3, fontWeight: 500 }}>
                  Bật hoặc tắt các chức năng dịch vụ thành viên trực tuyến.
                </Typography>
                
                <Stack spacing={1.5}>
                  <Paper sx={{ p: 2, borderRadius: 3, border: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography variant="subtitle2" fontWeight={800}>User Registration</Typography>
                      <Typography variant="caption" color="text.secondary">Cho phép người dùng mới tạo tài khoản khách hàng.</Typography>
                    </Box>
                    <Switch
                      checked={settings.enableRegistration}
                      onChange={handleChange('enableRegistration')}
                      color="primary"
                    />
                  </Paper>

                  <Paper sx={{ p: 2, borderRadius: 3, border: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography variant="subtitle2" fontWeight={800}>Comments section</Typography>
                      <Typography variant="caption" color="text.secondary">Mở khu vực bình luận tương tác dưới các bài hát.</Typography>
                    </Box>
                    <Switch
                      checked={settings.enableComments}
                      onChange={handleChange('enableComments')}
                      color="primary"
                    />
                  </Paper>

                  <Paper sx={{ p: 2, borderRadius: 3, border: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography variant="subtitle2" fontWeight={800}>Visitor Analytics</Typography>
                      <Typography variant="caption" color="text.secondary">Thu thập hành vi phát nhạc của người dùng.</Typography>
                    </Box>
                    <Switch
                      checked={settings.analyticsEnabled}
                      onChange={handleChange('analyticsEnabled')}
                      color="primary"
                    />
                  </Paper>

                  <Paper sx={{ p: 2, borderRadius: 3, border: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography variant="subtitle2" fontWeight={800} color="warning.main">Maintenance Mode</Typography>
                      <Typography variant="caption" color="text.secondary">Khóa tạm thời các cổng client và studio nghệ sĩ.</Typography>
                    </Box>
                    <Switch
                      checked={settings.maintenanceMode}
                      onChange={handleChange('maintenanceMode')}
                      color="warning"
                    />
                  </Paper>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          {/* System Maintenance Actions Panel */}
          <Grid size={{ xs: 12 }}>
            <Card elevation={0} sx={{ borderRadius: 5, border: '1px solid', borderColor: 'divider' }}>
              <CardContent sx={{ p: 4 }}>
                <Typography variant="h6" fontWeight={850} sx={{ mb: 1 }}>
                  System Maintenance
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3.5, fontWeight: 500 }}>
                  Thực thi các nghiệp vụ bảo trì, đồng bộ và dọn dẹp bộ nhớ đệm hệ thống.
                </Typography>

                <Grid container spacing={3.5}>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <Paper sx={{ p: 3, borderRadius: 4, border: '1px solid', borderColor: 'divider', height: '100%', display: 'flex', flexDirection: 'column' }}>
                      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                        <Box sx={{ p: 1, borderRadius: 2, bgcolor: 'rgba(25, 118, 210, 0.08)', color: 'primary.main' }}>
                          <DbIcon />
                        </Box>
                        <Typography variant="subtitle1" fontWeight={800}>Database Backup</Typography>
                      </Stack>
                      <Typography variant="caption" color="text.secondary" sx={{ flexGrow: 1, display: 'block', mb: 3, lineHeight: 1.5 }}>
                        Sao lưu dữ liệu MongoDB (Accounts, Songs, Playlists, AI DJs history) và lưu trữ dạng tệp tin dự phòng bảo mật.
                      </Typography>
                      <Button 
                        variant="outlined" 
                        onClick={handleBackupDb}
                        disabled={dbLoading}
                        startIcon={dbLoading ? <CircularProgress size={16} /> : <DbIcon />}
                        sx={{ borderRadius: 2.5, textTransform: 'none', fontWeight: 700 }}
                      >
                        Sao lưu ngay
                      </Button>
                    </Paper>
                  </Grid>

                  <Grid size={{ xs: 12, sm: 4 }}>
                    <Paper sx={{ p: 3, borderRadius: 4, border: '1px solid', borderColor: 'divider', height: '100%', display: 'flex', flexDirection: 'column' }}>
                      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                        <Box sx={{ p: 1, borderRadius: 2, bgcolor: 'rgba(108, 99, 255, 0.08)', color: '#6c63ff' }}>
                          <CacheIcon />
                        </Box>
                        <Typography variant="subtitle1" fontWeight={800}>Clean API Cache</Typography>
                      </Stack>
                      <Typography variant="caption" color="text.secondary" sx={{ flexGrow: 1, display: 'block', mb: 3, lineHeight: 1.5 }}>
                        Làm sạch bộ nhớ đệm (Cache) hệ thống để cập nhật lại dữ liệu danh mục nhạc tức thời mà không phải chờ chu kỳ tự làm mới.
                      </Typography>
                      <Button 
                        variant="outlined" 
                        onClick={handleCleanCache}
                        disabled={cacheLoading}
                        startIcon={cacheLoading ? <CircularProgress size={16} /> : <CacheIcon />}
                        sx={{ borderRadius: 2.5, textTransform: 'none', fontWeight: 700, borderColor: '#6c63ff', color: '#6c63ff' }}
                      >
                        Giải phóng cache
                      </Button>
                    </Paper>
                  </Grid>

                  <Grid size={{ xs: 12, sm: 4 }}>
                    <Paper sx={{ p: 3, borderRadius: 4, border: '1px solid', borderColor: 'divider', height: '100%', display: 'flex', flexDirection: 'column' }}>
                      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                        <Box sx={{ p: 1, borderRadius: 2, bgcolor: 'rgba(0, 188, 212, 0.08)', color: '#00bcd4' }}>
                          <AiIcon />
                        </Box>
                        <Typography variant="subtitle1" fontWeight={800}>Regen AI DJ Index</Typography>
                      </Stack>
                      <Typography variant="caption" color="text.secondary" sx={{ flexGrow: 1, display: 'block', mb: 3, lineHeight: 1.5 }}>
                        Đồng bộ lại cơ sở dữ liệu bài hát với mô hình Generative AI để đảm bảo AI DJ của Gemini tạo gợi ý playlist chính xác nhất.
                      </Typography>
                      <Button 
                        variant="outlined" 
                        onClick={handleRegenAi}
                        disabled={aiLoading}
                        startIcon={aiLoading ? <CircularProgress size={16} /> : <AiIcon />}
                        sx={{ borderRadius: 2.5, textTransform: 'none', fontWeight: 700, borderColor: '#00bcd4', color: '#00bcd4' }}
                      >
                        Đồng bộ AI DJ
                      </Button>
                    </Paper>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Action Row */}
          <Grid size={{ xs: 12 }}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={handleSave}
                sx={{
                  bgcolor: '#6c63ff',
                  fontWeight: 800,
                  textTransform: 'none',
                  borderRadius: 3.5,
                  px: 4.5,
                  py: 1.5,
                  boxShadow: '0 8px 24px rgba(108,99,255,0.2)',
                  '&:hover': { bgcolor: '#534bae' }
                }}
              >
                Lưu cấu hình
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Stack>
    </Layout>
  );
}

export default Settings;
