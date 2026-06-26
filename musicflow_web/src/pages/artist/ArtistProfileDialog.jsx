import {
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
            InputProps={{ sx: { borderRadius: 3.5 } }}
          />
          
          <TextField 
            label="Địa chỉ Email *" 
            type="email" 
            value={form.email} 
            onChange={onFieldChange('email')} 
            fullWidth 
            InputProps={{ sx: { borderRadius: 3.5 } }}
          />

          {/* Custom Avatar Upload Area */}
          <Box>
            <Typography variant="subtitle2" fontWeight={800} color="text.secondary" sx={{ mb: 1.25 }}>
              Hình đại diện (Avatar File)
            </Typography>
            <Button
              variant="outlined"
              component="label"
              fullWidth
              sx={{
                py: 2.5,
                borderRadius: 4,
                borderColor: avatarFile ? 'success.main' : 'divider',
                borderStyle: 'dashed',
                borderWidth: 2,
                bgcolor: avatarFile ? 'rgba(46, 125, 50, 0.03)' : 'rgba(0,0,0,0.01)',
                color: 'text.secondary',
                flexDirection: 'column',
                gap: 0.5,
                '&:hover': {
                  borderColor: 'primary.main',
                  bgcolor: 'rgba(108, 99, 255, 0.04)',
                }
              }}
            >
              {avatarFile ? (
                <>
                  <CheckCircleIcon color="success" sx={{ fontSize: 24 }} />
                  <Typography variant="body2" fontWeight={700} color="success.main" noWrap sx={{ maxWidth: '90%' }}>
                    {avatarFile.name}
                  </Typography>
                </>
              ) : (
                <>
                  <CameraIcon sx={{ fontSize: 24, color: 'text.disabled' }} />
                  <Typography variant="body2" fontWeight={700}>
                    Tải lên file hình ảnh mới
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

          <Divider sx={{ my: 0.5 }}>
            <Typography variant="caption" color="text.disabled" fontWeight={700}>HOẶC</Typography>
          </Divider>

          <TextField
            label="Link URL Ảnh đại diện trực tuyến"
            value={form.avatarUrl}
            onChange={onFieldChange('avatarUrl')}
            fullWidth
            helperText="Nếu bạn chọn cả tải file ảnh và dán URL, file ảnh được tải lên sẽ được sử dụng trước."
            InputProps={{ sx: { borderRadius: 3.5 } }}
          />

          <TextField
            label="Tiểu sử / Giới thiệu bản thân (Bio)"
            value={form.bio}
            onChange={onFieldChange('bio')}
            multiline
            minRows={4}
            fullWidth
            helperText="Chia sẻ câu chuyện âm nhạc, phong cách chủ đạo hoặc gửi gắm lời chào tới người hâm mộ."
            InputProps={{ sx: { borderRadius: 3.5 } }}
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
