import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Dialog,
  Fade,
  IconButton,
  Typography,
} from '@mui/material';
import {
  CloseRounded as CloseIcon,
  WorkspacePremiumRounded as PremiumIcon,
} from '@mui/icons-material';
import { useClientPlayer } from '../../Layout/client/ClientPlayerProvider';

function ClientAdPromoModal() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { isPremium, userTier } = useClientPlayer();

  useEffect(() => {
    // Không hiện nếu là tài khoản trả phí
    if (isPremium || userTier === 'plus' || userTier === 'premium') {
      return;
    }

    // Không hiện khi người dùng đang ở trang thanh toán / nâng cấp
    if (
      location.pathname.startsWith('/premium') ||
      location.pathname.includes('/login') ||
      location.pathname.includes('/register')
    ) {
      return;
    }

    // Kiểm tra xem trong phiên duyệt web này đã hiển thị chưa
    const hasShownInSession = sessionStorage.getItem('mf_plus_promo_shown');
    if (hasShownInSession) {
      return;
    }

    // Hẹn giờ hiển thị sau 1.8 giây khi vào trang
    const timer = setTimeout(() => {
      setOpen(true);
    }, 1800);

    return () => clearTimeout(timer);
  }, [isPremium, userTier, location.pathname]);

  const handleClose = () => {
    sessionStorage.setItem('mf_plus_promo_shown', 'true');
    setOpen(false);
  };

  const handleExplore = () => {
    sessionStorage.setItem('mf_plus_promo_shown', 'true');
    setOpen(false);
    navigate('/premium');
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      TransitionComponent={Fade}
      transitionDuration={350}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 4,
          overflow: 'hidden',
          background: 'linear-gradient(145deg, #7c3aed 0%, #8b5cf6 50%, #6d28d9 100%)',
          color: '#ffffff',
          boxShadow: '0 28px 70px rgba(109, 40, 217, 0.45), 0 10px 30px rgba(0, 0, 0, 0.3)',
          p: { xs: 3, sm: 3.5 },
          position: 'relative',
          border: '1px solid rgba(255, 255, 255, 0.16)',
        },
      }}
    >
      {/* Nút đóng góc phải */}
      <IconButton
        onClick={handleClose}
        size="small"
        sx={{
          position: 'absolute',
          top: 14,
          right: 14,
          color: '#ffffff',
          bgcolor: 'rgba(0, 0, 0, 0.18)',
          backdropFilter: 'blur(8px)',
          '&:hover': {
            bgcolor: 'rgba(0, 0, 0, 0.35)',
            transform: 'scale(1.08)',
          },
          transition: 'all 0.2s',
          zIndex: 2,
        }}
        aria-label="Đóng thông báo"
      >
        <CloseIcon sx={{ fontSize: 19 }} />
      </IconButton>

      {/* Badge thương hiệu MusicFlow PLUS */}
      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.75,
            px: 2,
            py: 0.5,
            borderRadius: '9999px',
            bgcolor: 'rgba(0, 0, 0, 0.22)',
            border: '1px solid rgba(255, 255, 255, 0.18)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.12)',
          }}
        >
          <Typography
            sx={{
              fontWeight: 900,
              fontSize: '13px',
              letterSpacing: '0.8px',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
            }}
          >
            MusicFlow <Box component="span" sx={{ color: '#fef08a', fontWeight: 950 }}>PLUS</Box>
          </Typography>
        </Box>
      </Box>

      {/* Minh họa Vector Zing MP3 / No Ads Character */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          my: 1,
          position: 'relative',
        }}
      >
        <svg width="220" height="150" viewBox="0 0 240 160" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Phím đàn Piano / Sóng nhạc nền */}
          <path
            d="M20 120 C 60 70, 180 70, 220 120"
            stroke="rgba(255, 255, 255, 0.25)"
            strokeWidth="16"
            strokeLinecap="round"
          />
          <path
            d="M35 110 C 70 75, 170 75, 205 110"
            stroke="rgba(255, 255, 255, 0.4)"
            strokeWidth="2"
            strokeDasharray="6 6"
          />

          {/* Vòng hào quang sáng phía sau */}
          <circle cx="120" cy="85" r="50" fill="url(#haloGrad)" />

          {/* Biển chặn quảng cáo (Smartphone / Shield with AD) */}
          <g transform="translate(130, 25) rotate(12)">
            <rect x="0" y="0" width="48" height="74" rx="8" fill="#1e1b4b" stroke="#ffffff" strokeWidth="2.5" />
            <circle cx="24" cy="34" r="15" fill="#ef4444" />
            <text x="14" y="38" fill="#ffffff" fontSize="9" fontWeight="900" fontFamily="sans-serif">AD</text>
            <line x1="13" y1="43" x2="35" y2="25" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
            <rect x="18" y="65" width="12" height="2" rx="1" fill="rgba(255,255,255,0.4)" />
          </g>

          {/* Nhân vật năng động chặn quảng cáo */}
          {/* Thân & Áo vàng */}
          <path d="M78 145 C78 115, 95 102, 120 102 C145 102, 162 115, 162 145 Z" fill="#facc15" />
          
          {/* Cánh tay trái giơ lên chặn */}
          <path d="M88 120 L68 92 C65 88, 72 82, 77 86 L102 108 Z" fill="#eab308" />
          
          {/* Cánh tay phải bắt chéo */}
          <path d="M152 120 L128 88 C124 84, 118 90, 122 95 L144 122 Z" fill="#eab308" />

          {/* Đầu & Tóc */}
          <ellipse cx="120" cy="72" rx="18" ry="20" fill="#fed7aa" />
          <path d="M102 68 C102 52, 138 52, 138 68 C134 60, 106 60, 102 68 Z" fill="#1e293b" />
          {/* Mắt nhắm cười sảng khoái */}
          <path d="M112 70 Q115 74 118 70" stroke="#1e293b" strokeWidth="1.8" strokeLinecap="round" fill="none" />
          <path d="M122 70 Q125 74 128 70" stroke="#1e293b" strokeWidth="1.8" strokeLinecap="round" fill="none" />

          {/* Nốt nhạc bay bổng 🎵 🎶 */}
          <g transform="translate(36, 45)">
            <ellipse cx="6" cy="14" rx="4" ry="3" fill="#ffffff" transform="rotate(-20 6 14)" />
            <rect x="8" y="3" width="2" height="12" fill="#ffffff" />
            <path d="M10 3 C14 3, 16 6, 17 8" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" fill="none" />
          </g>

          <g transform="translate(192, 50)">
            <ellipse cx="5" cy="12" rx="3.5" ry="2.5" fill="#fef08a" transform="rotate(-20 5 12)" />
            <rect x="7" y="2" width="2" height="11" fill="#fef08a" />
            <path d="M9 2 C13 2, 15 5, 16 7" stroke="#fef08a" strokeWidth="1.8" strokeLinecap="round" fill="none" />
          </g>

          <defs>
            <radialGradient id="haloGrad" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </radialGradient>
          </defs>
        </svg>
      </Box>

      {/* Tiêu đề chính */}
      <Typography
        component="h2"
        sx={{
          fontWeight: 900,
          fontSize: { xs: '21px', sm: '23px' },
          textAlign: 'center',
          color: '#ffffff',
          letterSpacing: '-0.4px',
          lineHeight: 1.25,
          mt: 1.5,
          mb: 1.2,
          textShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
        }}
      >
        Muốn nghe nhạc không quảng cáo?
      </Typography>

      {/* Mô tả ưu đãi gói PLUS */}
      <Typography
        variant="body2"
        sx={{
          textAlign: 'center',
          color: 'rgba(255, 255, 255, 0.92)',
          fontSize: '13.5px',
          lineHeight: 1.6,
          px: { xs: 0.5, sm: 1.5 },
          mb: 3,
          fontWeight: 500,
        }}
      >
        Nâng cấp gói <Box component="span" sx={{ fontWeight: 800, color: '#fef08a' }}>MusicFlow Plus</Box> chỉ từ{' '}
        <Box component="span" sx={{ fontWeight: 850 }}>20.000 đ/tháng</Box>. Tặng bạn thêm chất lượng âm thanh Studio HQ 320kbps và nhiều đặc quyền hấp dẫn khác.
      </Typography>

      {/* Nút Khám Phá Ngay */}
      <Button
        onClick={handleExplore}
        fullWidth
        variant="contained"
        sx={{
          bgcolor: '#ffffff',
          color: '#7c3aed',
          fontWeight: 900,
          fontSize: '14.5px',
          py: 1.35,
          borderRadius: '9999px',
          textTransform: 'uppercase',
          letterSpacing: '0.6px',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.22)',
          '&:hover': {
            bgcolor: '#f8fafc',
            transform: 'translateY(-2px)',
            boxShadow: '0 14px 32px rgba(0, 0, 0, 0.3)',
          },
          transition: 'all 0.25s ease',
        }}
      >
        Khám Phá Ngay
      </Button>
    </Dialog>
  );
}

export default ClientAdPromoModal;
