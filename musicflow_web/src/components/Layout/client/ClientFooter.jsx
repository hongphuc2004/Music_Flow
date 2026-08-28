import { Box, Grid, Typography, Stack, Link, IconButton, Divider, Chip, useTheme } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import {
  Headphones as HeadphonesIcon,
  AutoAwesome as SparklesIcon,
  WorkspacePremiumRounded as PremiumIcon,
  GraphicEqRounded as WaveIcon,
  FavoriteRounded as HeartIcon,
  Facebook as FacebookIcon,
  YouTube as YouTubeIcon,
  GitHub as GitHubIcon,
  Send as TelegramIcon,
} from '@mui/icons-material';

function ClientFooter() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const discoverLinks = [
    { label: 'Trang Chủ', path: '/' },
    { label: 'Khám Phá Âm Nhạc', path: '/discover' },
    { label: 'Chủ Đề & Thể Loại', path: '/genres' },
    { label: 'Bảng Xếp Hạng Thịnh Hành', path: '/rankings' },
    { label: 'AI Mood DJ Generator', path: '/ai-mood' },
  ];

  const artistLinks = [
    { label: 'Artist Studio', path: '/artistlogin' },
    { label: 'Đăng Ký Nghệ Sĩ', path: '/artist/register' },
    { label: 'Gói Hội Viên Premium', path: '/premium' },
    { label: 'Thư Viện & Yêu Thích', path: '/library' },
  ];

  return (
    <Box
      component="footer"
      sx={{
        mt: { xs: 5, md: 6 },
        pt: { xs: 4.5, md: 5.5 },
        pb: { xs: 3, md: 3.5 },
        px: { xs: 3, sm: 4, md: 5, lg: 6 },
        borderRadius: 4,
        position: 'relative',
        overflow: 'hidden',
        bgcolor: isDark ? 'rgba(17, 24, 39, 0.5)' : 'rgba(255, 255, 255, 0.65)',
        backdropFilter: 'blur(20px)',
        border: '1px solid',
        borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
        boxShadow: isDark ? '0 16px 40px rgba(0,0,0,0.3)' : '0 16px 40px rgba(0,0,0,0.04)',
      }}
    >
      {/* Decorative top accent gradient line */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: '5%',
          right: '5%',
          height: '2px',
          background: 'linear-gradient(90deg, transparent, #14b8a6, #6c63ff, transparent)',
          opacity: isDark ? 0.85 : 0.6,
        }}
      />

      <Grid container spacing={{ xs: 4, md: 5, lg: 6 }}>
        {/* Brand & Mission Column */}
        <Grid size={{ xs: 12, md: 4.2 }}>
          <Stack direction="row" spacing={1.75} alignItems="center" sx={{ mb: 2.25 }}>
            <Box
              sx={{
                width: 46,
                height: 46,
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #14b8a6 0%, #6c63ff 100%)',
                display: 'grid',
                placeItems: 'center',
                color: '#fff',
                boxShadow: '0 6px 18px rgba(20, 184, 166, 0.4)',
              }}
            >
              <HeadphonesIcon sx={{ fontSize: 26 }} />
            </Box>
            <Box>
              <Typography
                variant="h5"
                sx={{
                  fontWeight: 900,
                  letterSpacing: '-0.5px',
                  lineHeight: 1.1,
                  fontSize: { xs: '1.4rem', md: '1.6rem' },
                  background: 'linear-gradient(90deg, #14b8a6, #6c63ff)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                MusicFlow
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, fontSize: 12.5, letterSpacing: '0.2px' }}>
                Next-Gen Music & AI Ecosystem
              </Typography>
            </Box>
          </Stack>

          <Typography
            variant="body1"
            sx={{
              color: 'text.secondary',
              lineHeight: 1.75,
              mb: 3,
              pr: { lg: 3 },
              fontSize: { xs: '14px', md: '15px' },
              fontWeight: 500,
            }}
          >
            Hệ sinh thái âm nhạc trực tuyến đa nền tảng hiện đại. Khám phá kho bài hát bản quyền chất lượng cao, cập nhật bảng xếp hạng xu hướng và tận hưởng danh sách phát thông minh được cá nhân hóa bởi trợ lý AI DJ.
          </Typography>

          <Stack direction="row" spacing={1.25} alignItems="center">
            <IconButton
              size="medium"
              aria-label="Facebook"
              sx={{
                color: isDark ? '#9ca3af' : '#64748b',
                bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                '&:hover': { color: '#1877f2', bgcolor: isDark ? 'rgba(24,119,242,0.18)' : 'rgba(24,119,242,0.12)', transform: 'translateY(-2px)' },
                transition: 'all 0.2s ease',
              }}
            >
              <FacebookIcon sx={{ fontSize: 20 }} />
            </IconButton>
            <IconButton
              size="medium"
              aria-label="YouTube"
              sx={{
                color: isDark ? '#9ca3af' : '#64748b',
                bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                '&:hover': { color: '#ef4444', bgcolor: isDark ? 'rgba(239,68,68,0.18)' : 'rgba(239,68,68,0.12)', transform: 'translateY(-2px)' },
                transition: 'all 0.2s ease',
              }}
            >
              <YouTubeIcon sx={{ fontSize: 20 }} />
            </IconButton>
            <IconButton
              size="medium"
              aria-label="GitHub"
              sx={{
                color: isDark ? '#9ca3af' : '#64748b',
                bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                '&:hover': { color: isDark ? '#fff' : '#0f172a', bgcolor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)', transform: 'translateY(-2px)' },
                transition: 'all 0.2s ease',
              }}
            >
              <GitHubIcon sx={{ fontSize: 20 }} />
            </IconButton>
            <IconButton
              size="medium"
              aria-label="Telegram"
              sx={{
                color: isDark ? '#9ca3af' : '#64748b',
                bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                '&:hover': { color: '#229ed9', bgcolor: isDark ? 'rgba(34,158,217,0.18)' : 'rgba(34,158,217,0.12)', transform: 'translateY(-2px)' },
                transition: 'all 0.2s ease',
              }}
            >
              <TelegramIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </Stack>
        </Grid>

        {/* Section: Khám Phá */}
        <Grid size={{ xs: 6, sm: 6, md: 2.6 }}>
          <Typography
            variant="subtitle1"
            sx={{
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '0.8px',
              fontSize: { xs: '13px', md: '14px' },
              color: 'text.primary',
              mb: 2.5,
            }}
          >
            Khám Phá
          </Typography>
          <Stack spacing={1.6}>
            {discoverLinks.map((item) => (
              <Link
                key={item.path}
                component="button"
                onClick={() => navigate(item.path)}
                sx={{
                  textAlign: 'left',
                  color: 'text.secondary',
                  fontSize: { xs: '14.5px', md: '15.5px' },
                  fontWeight: 600,
                  textDecoration: 'none',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    color: '#14b8a6',
                    transform: 'translateX(4px)',
                  },
                }}
              >
                {item.label}
              </Link>
            ))}
          </Stack>
        </Grid>

        {/* Section: Nghệ Sĩ & Dịch Vụ */}
        <Grid size={{ xs: 6, sm: 6, md: 2.6 }}>
          <Typography
            variant="subtitle1"
            sx={{
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '0.8px',
              fontSize: { xs: '13px', md: '14px' },
              color: 'text.primary',
              mb: 2.5,
            }}
          >
            Nghệ Sĩ & Dịch Vụ
          </Typography>
          <Stack spacing={1.6}>
            {artistLinks.map((item) => (
              <Link
                key={item.path}
                component="button"
                onClick={() => navigate(item.path)}
                sx={{
                  textAlign: 'left',
                  color: 'text.secondary',
                  fontSize: { xs: '14.5px', md: '15.5px' },
                  fontWeight: 600,
                  textDecoration: 'none',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    color: '#6c63ff',
                    transform: 'translateX(4px)',
                  },
                }}
              >
                {item.label}
              </Link>
            ))}
          </Stack>
        </Grid>

        {/* Section: Công Nghệ Nổi Bật */}
        <Grid size={{ xs: 12, sm: 6, md: 2.6 }}>
          <Typography
            variant="subtitle1"
            sx={{
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '0.8px',
              fontSize: { xs: '13px', md: '14px' },
              color: 'text.primary',
              mb: 2.5,
            }}
          >
            Công Nghệ Nổi Bật
          </Typography>

          <Stack spacing={2}>
            <Box
              onClick={() => navigate('/ai-mood')}
              sx={{
                p: 2,
                borderRadius: 3,
                cursor: 'pointer',
                bgcolor: isDark ? 'rgba(108, 99, 255, 0.09)' : 'rgba(108, 99, 255, 0.05)',
                border: '1px solid',
                borderColor: isDark ? 'rgba(108, 99, 255, 0.25)' : 'rgba(108, 99, 255, 0.16)',
                transition: 'all 0.25s ease',
                '&:hover': {
                  borderColor: '#6c63ff',
                  transform: 'translateY(-3px)',
                  boxShadow: '0 8px 24px rgba(108, 99, 255, 0.18)',
                },
              }}
            >
              <Stack direction="row" spacing={1.2} alignItems="center">
                <SparklesIcon sx={{ fontSize: 18, color: '#6c63ff' }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'text.primary', fontSize: 14.5 }}>
                  AI Mood Playlist
                </Typography>
              </Stack>
              <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: 12.5, mt: 0.5, lineHeight: 1.5 }}>
                Gợi ý bài hát thông minh qua phân tích cảm xúc
              </Typography>
            </Box>

            <Box
              onClick={() => navigate('/premium')}
              sx={{
                p: 2,
                borderRadius: 3,
                cursor: 'pointer',
                bgcolor: isDark ? 'rgba(20, 184, 166, 0.09)' : 'rgba(20, 184, 166, 0.05)',
                border: '1px solid',
                borderColor: isDark ? 'rgba(20, 184, 166, 0.25)' : 'rgba(20, 184, 166, 0.16)',
                transition: 'all 0.25s ease',
                '&:hover': {
                  borderColor: '#14b8a6',
                  transform: 'translateY(-3px)',
                  boxShadow: '0 8px 24px rgba(20, 184, 166, 0.18)',
                },
              }}
            >
              <Stack direction="row" spacing={1.2} alignItems="center">
                <PremiumIcon sx={{ fontSize: 18, color: '#14b8a6' }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'text.primary', fontSize: 14.5 }}>
                  MusicFlow Premium
                </Typography>
              </Stack>
              <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: 12.5, mt: 0.5, lineHeight: 1.5 }}>
                Âm thanh Lossless 320kbps không quảng cáo
              </Typography>
            </Box>
          </Stack>
        </Grid>
      </Grid>

      <Divider sx={{ my: 3.5, borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }} />

      {/* Bottom Bar: Copyright & Badges */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        justifyContent="space-between"
        alignItems="center"
      >
        <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: { xs: 13, sm: 14 }, textAlign: { xs: 'center', sm: 'left' } }}>
          © {new Date().getFullYear()} MusicFlow. Nền tảng âm nhạc trực tuyến đa nền tảng.
        </Typography>

        <Stack direction="row" spacing={1.5} alignItems="center">
          <Chip
            size="medium"
            icon={<WaveIcon sx={{ fontSize: '16px !important', color: '#14b8a6 !important' }} />}
            label="Lossless Audio"
            variant="outlined"
            sx={{
              fontSize: 12.5,
              fontWeight: 700,
              py: 0.5,
              borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
            }}
          />
          <Chip
            size="medium"
            icon={<HeartIcon sx={{ fontSize: '15px !important', color: '#ef4444 !important' }} />}
            label="Made with Passion"
            variant="outlined"
            sx={{
              fontSize: 12.5,
              fontWeight: 700,
              py: 0.5,
              borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
            }}
          />
        </Stack>
      </Stack>
    </Box>
  );
}

export default ClientFooter;
