import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Stack,
  Tooltip,
  IconButton,
  Fade,
} from '@mui/material';
import {
  WorkspacePremiumRounded as PremiumIcon,
  DiamondRounded as DiamondIcon,
  HeadphonesRounded as HeadphonesIcon,
  BlockRounded as NoAdsIcon,
  BoltRounded as BoltIcon,
} from '@mui/icons-material';
import { useClientPlayer } from './ClientPlayerProvider';

/**
 * ClientSidebarPremiumBanner
 * Banner quảng bá gói Premium VIP ở Sidebar bên trái (như Zing MP3)
 * Tự động hiển thị khi người dùng Free đang nghe bài hát có isPremium = true.
 */
export default function ClientSidebarPremiumBanner({ collapsed = false }) {
  const navigate = useNavigate();
  const { currentSong, isPremiumPreview } = useClientPlayer();
  const [dismissedSongId, setDismissedSongId] = useState(null);

  // Điều kiện hiển thị: bài hát đang phát là Premium VÀ người dùng chưa có gói VIP
  const shouldShow =
    Boolean(isPremiumPreview) &&
    Boolean(currentSong?.isPremium) &&
    currentSong?._id !== dismissedSongId;

  if (!shouldShow) {
    return null;
  }

  const handleUpgrade = () => {
    navigate('/premium');
  };

  const handleDismiss = (e) => {
    e.stopPropagation();
    setDismissedSongId(currentSong?._id);
  };

  // Trường hợp Sidebar đang thu gọn (collapsed mode)
  if (collapsed) {
    return (
      <Tooltip title="Tận Hưởng Kho Nhạc Premium (VIP)" placement="right" arrow>
        <Box
          onClick={handleUpgrade}
          sx={{
            my: 1,
            mx: 'auto',
            width: 44,
            height: 44,
            borderRadius: 3,
            background: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 50%, #d97706 100%)',
            boxShadow: '0 4px 14px rgba(245, 158, 11, 0.45), 0 0 10px rgba(251, 191, 36, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            animation: 'pulseGlow 2.5s infinite ease-in-out',
            '@keyframes pulseGlow': {
              '0%, 100%': { transform: 'scale(1)', boxShadow: '0 4px 14px rgba(245, 158, 11, 0.45)' },
              '50%': { transform: 'scale(1.08)', boxShadow: '0 6px 20px rgba(245, 158, 11, 0.7)' },
            },
            '&:hover': {
              transform: 'scale(1.12) !important',
            },
          }}
        >
          <DiamondIcon sx={{ color: '#451a03', fontSize: 24 }} />
        </Box>
      </Tooltip>
    );
  }

  // Trường hợp Sidebar mở rộng đầy đủ (như giao diện Zing MP3)
  return (
    <Fade in={shouldShow} timeout={350}>
      <Box
        sx={{
          borderRadius: 4,
          overflow: 'hidden',
          boxShadow: '0 12px 36px rgba(0, 0, 0, 0.45), 0 0 16px rgba(245, 158, 11, 0.22)',
          border: '1.5px solid rgba(245, 158, 11, 0.45)',
          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s ease',
          '&:hover': {
            transform: 'translateY(-3px)',
            boxShadow: '0 16px 42px rgba(245, 158, 11, 0.35), 0 0 22px rgba(251, 191, 36, 0.3)',
          },
        }}
      >
        {/* Nửa trên: Header Vàng Gold Gradient sang trọng */}
        <Box
          sx={{
            background: 'linear-gradient(135deg, #d97706 0%, #f59e0b 35%, #fbbf24 70%, #d97706 100%)',
            p: 2,
            pb: 1.75,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Họa tiết vòng tròn ánh sáng mờ phía sau */}
          <Box
            sx={{
              position: 'absolute',
              top: -25,
              right: -25,
              width: 110,
              height: 110,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255, 255, 255, 0.4) 0%, transparent 70%)',
              pointerEvents: 'none',
            }}
          />

          <Stack direction="row" alignItems="center" justifyContent="space-between">
            {/* Tag Brand Logo */}
            <Box
              sx={{
                bgcolor: 'rgba(0, 0, 0, 0.28)',
                backdropFilter: 'blur(6px)',
                px: 1.2,
                py: 0.35,
                borderRadius: 1.75,
                border: '1px solid rgba(255, 255, 255, 0.3)',
              }}
            >
              <Typography
                sx={{
                  fontSize: 10.5,
                  fontWeight: 900,
                  color: '#fff',
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase',
                }}
              >
                MusicFlow PREMIUM
              </Typography>
            </Box>

            {/* Icon Kim cương VIP trung tâm */}
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                bgcolor: 'rgba(255, 255, 255, 0.32)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
              }}
            >
              <DiamondIcon sx={{ fontSize: 24, color: '#451a03' }} />
            </Box>
          </Stack>

          {/* Dải đặc quyền mini + Tag giá */}
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ mt: 1.5 }}
          >
            {/* Tag giá cước */}
            <Box
              sx={{
                bgcolor: 'rgba(0, 0, 0, 0.38)',
                px: 1.3,
                py: 0.45,
                borderRadius: 999,
                border: '1px solid rgba(255, 255, 255, 0.35)',
              }}
            >
              <Typography
                sx={{
                  fontSize: 11.5,
                  fontWeight: 900,
                  color: '#fef08a',
                  letterSpacing: '0.3px',
                }}
              >
                CHỈ TỪ 20K/THÁNG
              </Typography>
            </Box>

            {/* Icons đặc quyền mini */}
            <Stack direction="row" spacing={0.6} alignItems="center">
              <Tooltip title="Âm thanh Studio Lossless" arrow placement="top">
                <Box
                  sx={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    bgcolor: 'rgba(255, 255, 255, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#451a03',
                  }}
                >
                  <HeadphonesIcon sx={{ fontSize: 13.5 }} />
                </Box>
              </Tooltip>
              <Tooltip title="Không bị ngắt quảng cáo" arrow placement="top">
                <Box
                  sx={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    bgcolor: 'rgba(255, 255, 255, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#451a03',
                  }}
                >
                  <NoAdsIcon sx={{ fontSize: 13.5 }} />
                </Box>
              </Tooltip>
              <Tooltip title="Nghe trọn vẹn toàn bộ bài hát VIP" arrow placement="top">
                <Box
                  sx={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    bgcolor: 'rgba(255, 255, 255, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#451a03',
                  }}
                >
                  <BoltIcon sx={{ fontSize: 13.5 }} />
                </Box>
              </Tooltip>
            </Stack>
          </Stack>
        </Box>

        {/* Nửa dưới: Thông tin và 2 nút hành động (Tím than huyền bí) */}
        <Box
          sx={{
            background: 'linear-gradient(180deg, #1b1735 0%, #110e24 100%)',
            p: 2,
            pt: 1.75,
            color: '#fff',
          }}
        >
          <Typography
            variant="subtitle1"
            sx={{
              fontWeight: 900,
              fontSize: 15,
              letterSpacing: '-0.2px',
              color: '#fff',
              lineHeight: 1.35,
            }}
          >
            Tận Hưởng Kho Nhạc Premium
          </Typography>

          <Typography
            variant="body2"
            sx={{
              display: 'block',
              mt: 0.6,
              color: 'rgba(255, 255, 255, 0.72)',
              fontSize: 12,
              lineHeight: 1.45,
            }}
          >
            Mở khóa nghe trọn vẹn bài hát VIP, chất lượng Studio và không giới hạn.
          </Typography>

          {/* Hàng 2 nút: [ĐỂ SAU] và [NÂNG CẤP] */}
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            spacing={1.25}
            sx={{ mt: 2 }}
          >
            <Button
              size="medium"
              variant="text"
              onClick={handleDismiss}
              sx={{
                textTransform: 'none',
                color: 'rgba(255, 255, 255, 0.65)',
                fontWeight: 700,
                fontSize: 12,
                px: 1.25,
                py: 0.6,
                minWidth: 0,
                borderRadius: 2,
                '&:hover': {
                  color: '#fff',
                  bgcolor: 'rgba(255, 255, 255, 0.1)',
                },
              }}
            >
              Để sau
            </Button>

            <Button
              size="medium"
              variant="contained"
              onClick={handleUpgrade}
              sx={{
                textTransform: 'uppercase',
                fontWeight: 900,
                fontSize: 12.5,
                letterSpacing: '0.5px',
                borderRadius: 999,
                px: 2.75,
                py: 0.8,
                background: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)',
                color: '#fff',
                boxShadow: '0 4px 16px rgba(124, 58, 237, 0.5)',
                transition: 'all 0.2s ease',
                '&:hover': {
                  background: 'linear-gradient(135deg, #c084fc 0%, #9333ea 100%)',
                  boxShadow: '0 6px 20px rgba(124, 58, 237, 0.75)',
                  transform: 'scale(1.03)',
                },
              }}
            >
              Nâng cấp
            </Button>
          </Stack>
        </Box>
      </Box>
    </Fade>
  );
}
