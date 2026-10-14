import { Box, Typography, Button, IconButton, Chip, Paper, Fade } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import SkipNextRoundedIcon from '@mui/icons-material/SkipNextRounded';
import WorkspacePremiumRoundedIcon from '@mui/icons-material/WorkspacePremiumRounded';
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded';
import { useNavigate } from 'react-router-dom';
import { useClientPlayer, useClientPlayerActions } from './ClientPlayerProvider';
import { clientAdsApi } from '../../../services/client/client.service';

/**
 * Overlay thông báo và tương tác Quảng Cáo âm thanh.
 * Xuất hiện nổi góc phải hoặc đè lên NowPlayingBar khi Ad đang phát.
 */
function ClientAdInterruptionOverlay() {
  const { isAdPlaying, currentAd, adRemaining, adCanSkip } = useClientPlayer();
  const { skipAd } = useClientPlayerActions();
  const navigate = useNavigate();

  if (!isAdPlaying || !currentAd) {
    return null;
  }

  const remaining = adRemaining ?? 0;
  const canSkip = Boolean(adCanSkip);

  const handleUpgradeClick = () => {
    if (currentAd._id || currentAd.id) {
      clientAdsApi.recordClick(currentAd._id || currentAd.id).catch(() => {});
    }
    if (currentAd.targetUrl && currentAd.targetUrl.startsWith('http')) {
      window.open(currentAd.targetUrl, '_blank');
    } else {
      navigate('/client/premium');
    }
  };

  return (
    <Fade in={isAdPlaying}>
      <Paper
        elevation={16}
        sx={{
          position: 'fixed',
          bottom: { xs: 95, sm: 98, md: 104 },
          right: { xs: 12, sm: 20, md: 24 },
          zIndex: 1300,
          width: { xs: 'calc(100% - 24px)', sm: 400, md: 440 },
          maxWidth: 440,
          background: 'linear-gradient(135deg, rgba(30, 20, 53, 0.95) 0%, rgba(15, 10, 28, 0.98) 100%)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 179, 0, 0.4)',
          borderRadius: 3.5,
          p: 2.2,
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.65), 0 0 20px rgba(255, 179, 0, 0.15)',
          color: 'white',
        }}
      >
        {/* Header: Chip Quảng Cáo + Countdown + Nút Tắt */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              icon={<CampaignRoundedIcon sx={{ fontSize: '15px !important', color: '#FFB300 !important' }} />}
              label="QUẢNG CÁO"
              size="small"
              sx={{
                bgcolor: 'rgba(255, 179, 0, 0.18)',
                color: '#FFB300',
                fontWeight: 800,
                fontSize: '0.72rem',
                border: '1px solid rgba(255, 179, 0, 0.45)',
                height: 24,
              }}
            />
            <Chip
              label={remaining > 0 ? `0:${remaining.toString().padStart(2, '0')}` : '0:00'}
              size="small"
              sx={{
                bgcolor: 'rgba(255, 255, 255, 0.08)',
                color: 'rgba(255, 255, 255, 0.75)',
                fontSize: '0.75rem',
                fontWeight: 700,
                height: 24,
              }}
            />
          </Box>

          <IconButton
            size="small"
            onClick={skipAd}
            title="Đóng quảng cáo"
            sx={{
              color: 'rgba(255, 255, 255, 0.6)',
              bgcolor: 'rgba(255, 255, 255, 0.06)',
              '&:hover': {
                color: 'white',
                bgcolor: 'rgba(255, 255, 255, 0.15)',
              },
            }}
          >
            <CloseRoundedIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* Content: Image + Info */}
        <Box sx={{ display: 'flex', gap: 1.8, alignItems: 'center', mb: 2 }}>
          {currentAd.imageUrl && (
            <Box
              component="img"
              src={currentAd.imageUrl}
              alt={currentAd.title}
              sx={{
                width: 68,
                height: 68,
                borderRadius: 2,
                objectFit: 'cover',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                flexShrink: 0,
              }}
            />
          )}

          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 800,
                fontSize: '0.94rem',
                lineHeight: 1.3,
                color: 'white',
                mb: 0.5,
              }}
            >
              {currentAd.title}
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: 'rgba(255, 255, 255, 0.65)',
                fontSize: '0.8rem',
                lineHeight: 1.35,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {currentAd.description || 'Nghe nhạc liền mạch không quảng cáo với Gói PLUS'}
            </Typography>
          </Box>
        </Box>

        {/* Footer Actions: Skip Button + Upgrade CTA */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {canSkip || remaining <= 0 ? (
            <Button
              variant="contained"
              fullWidth
              startIcon={<SkipNextRoundedIcon />}
              onClick={skipAd}
              sx={{
                bgcolor: '#FFB300',
                color: '#1a102f',
                fontWeight: 800,
                fontSize: '0.85rem',
                textTransform: 'none',
                borderRadius: 2,
                py: 0.8,
                '&:hover': {
                  bgcolor: '#FFA000',
                },
              }}
            >
              Bỏ qua quảng cáo & Tiếp tục nghe nhạc
            </Button>
          ) : (
            <Typography
              variant="caption"
              sx={{
                color: 'rgba(255, 255, 255, 0.45)',
                textAlign: 'center',
                fontSize: '0.74rem',
              }}
            >
              Có thể bỏ qua sau vài giây...
            </Typography>
          )}

          <Button
            variant="text"
            fullWidth
            startIcon={<WorkspacePremiumRoundedIcon sx={{ color: '#00bcd4' }} />}
            onClick={handleUpgradeClick}
            sx={{
              color: '#00bcd4',
              fontWeight: 700,
              fontSize: '0.82rem',
              textTransform: 'none',
              borderRadius: 2,
              '&:hover': {
                bgcolor: 'rgba(0, 188, 212, 0.08)',
              },
            }}
          >
            Nâng cấp Gói PLUS (20.000đ/tháng) để nghe không quảng cáo
          </Button>
        </Box>
      </Paper>
    </Fade>
  );
}

export default ClientAdInterruptionOverlay;
