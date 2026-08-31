import {
  Avatar,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
  Stack,
  Divider,
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  CheckCircleRounded as CheckCircleIcon,
  PhotoCameraRounded as CameraIcon,
} from '@mui/icons-material';

function ArtistProfileDialog({
  open,
  onClose,
  onSubmit,
  loading,
  form,
  onFieldChange,
  avatarFile,
  onAvatarFileChange,
}) {
  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      fullWidth 
      maxWidth="sm"
      PaperProps={{
        sx: {
          borderRadius: 6,
          boxShadow: '0 24px 48px rgba(0,0,0,0.2)',
          overflow: 'hidden'
        }
      }}
    >
      {/* Header Banner */}
      <Box sx={{ 
        background: 'linear-gradient(135deg, #6c63ff 0%, #00bcd4 100%)', 
        p: 3.5, 
        color: '#fff',
      }}>
        <Typography variant="h5" fontWeight={900}>
          Cập nhật hồ sơ Nghệ sĩ
        </Typography>
        <Typography variant="body2" sx={{ opacity: 0.85, mt: 0.5 }}>
          Thay đổi các thông tin nhận diện cốt lõi của bạn hiển thị trên toàn hệ thống.
        </Typography>
      </Box>

      <DialogContent sx={{ p: 4, pt: 3.5 }}>
        <Stack spacing={3}>
          <TextField 
            label="Tên nghệ sĩ hiển thị *" 
            value={form.name} 
            onChange={onFieldChange('name')} 
            fullWidth 
            InputProps={{ sx: { borderRadius: 2.5 } }}
          />
          
          <TextField 
            label="Địa chỉ Email *" 
            type="email" 
            value={form.email} 
            onChange={onFieldChange('email')} 
            fullWidth 
            InputProps={{ sx: { borderRadius: 2.5 } }}
          />

          {/* Custom Avatar Upload Area */}
          <Box>
            <Typography variant="subtitle2" fontWeight={800} color="text.secondary" sx={{ mb: 1.25 }}>
              Hình đại diện (Avatar)
            </Typography>
            <Button
              variant="outlined"
              component="label"
              fullWidth
              sx={{
                py: 2.5,
                borderRadius: 2.5,
                borderColor: avatarFile ? 'success.main' : 'divider',
                borderStyle: 'dashed',
                borderWidth: 2,
                bgcolor: avatarFile ? 'rgba(46, 125, 50, 0.03)' : 'rgba(0,0,0,0.01)',
                color: 'text.secondary',
                flexDirection: 'column',
                gap: 1,
                '&:hover': {
                  borderColor: 'primary.main',
                  bgcolor: 'rgba(108, 99, 255, 0.04)',
                }
              }}
            >
              {avatarFile ? (
                <>
                  <CheckCircleIcon color="success" sx={{ fontSize: 28 }} />
                  <Typography variant="body2" fontWeight={700} color="success.main" noWrap sx={{ maxWidth: '90%' }}>
                    {avatarFile.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Nhấn để chọn file ảnh khác
                  </Typography>
                </>
              ) : form.avatarUrl ? (
                <Stack direction="row" spacing={2} alignItems="center">
                  <Avatar
                    src={form.avatarUrl}
                    alt={form.name}
                    sx={{ width: 52, height: 52, border: '2px solid #6c63ff', boxShadow: '0 4px 12px rgba(108, 99, 255, 0.25)' }}
                  />
                  <Box sx={{ textAlign: 'left' }}>
                    <Typography variant="body2" fontWeight={750} color="text.primary">
                      Ảnh đại diện hiện tại
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Nhấn để tải lên file hình ảnh mới
                    </Typography>
                  </Box>
                </Stack>
              ) : (
                <>
                  <CameraIcon sx={{ fontSize: 28, color: 'text.disabled' }} />
                  <Typography variant="body2" fontWeight={700}>
                    Tải lên file hình ảnh mới
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Định dạng hỗ trợ: JPG, PNG, WEBP
                  </Typography>
                </>
              )}
              <input
                hidden
                type="file"
                accept="image/*"
                onChange={(event) => onAvatarFileChange(event.target.files?.[0] || null)}
              />
            </Button>
          </Box>

          <TextField
            label="Tiểu sử / Giới thiệu bản thân (Bio)"
            value={form.bio}
            onChange={onFieldChange('bio')}
            multiline
            minRows={4}
            fullWidth
            helperText="Chia sẻ câu chuyện âm nhạc, phong cách chủ đạo hoặc gửi gắm lời chào tới người hâm mộ."
            InputProps={{ sx: { borderRadius: 2.5 } }}
          />
        </Stack>
      </DialogContent>
      
      <DialogActions sx={{ p: 4, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
        <Button onClick={onClose} disabled={loading} sx={{ borderRadius: 3, textTransform: 'none', fontWeight: 700, px: 3 }}>
          Hủy bỏ
        </Button>
        <Button 
          variant="contained" 
          onClick={onSubmit} 
          disabled={loading}
          sx={{ 
            borderRadius: 3, 
            textTransform: 'none', 
            fontWeight: 800, 
            px: 4.5, 
            minWidth: 140,
            bgcolor: '#6c63ff',
            '&:hover': { bgcolor: '#534bae' }
          }}
        >
          {loading ? <CircularProgress size={24} color="inherit" /> : 'Lưu hồ sơ'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ArtistProfileDialog;
