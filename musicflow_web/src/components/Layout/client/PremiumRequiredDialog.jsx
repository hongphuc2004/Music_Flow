import React from 'react';
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  Button,
  IconButton,
  Stack,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/CloseRounded';
import { useNavigate } from 'react-router-dom';
import PremiumBadge from '../../common/ui/PremiumBadge';

export default function PremiumRequiredDialog({ open, onClose }) {
  const navigate = useNavigate();

  const handleUpgrade = () => {
    if (onClose) onClose();
    navigate('/premium');
  };

  return (
    <Dialog
      open={Boolean(open)}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      slotProps={{
        backdrop: {
          sx: {
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
          },
        },
      }}
      PaperProps={{
        sx: {
          bgcolor: '#1e212d',
          backgroundImage: 'radial-gradient(circle at top center, rgba(108, 99, 255, 0.12) 0%, transparent 70%)',
          borderRadius: '24px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.6), 0 0 40px rgba(229, 172, 24, 0.15)',
          p: { xs: 2.5, sm: 3.5 },
          position: 'relative',
          overflow: 'hidden',
          textAlign: 'center',
        },
      }}
    >
      {/* Nút đóng góc phải */}
      <IconButton
        onClick={onClose}
        size="small"
        sx={{
          position: 'absolute',
          top: 16,
          right: 16,
          color: 'rgba(255, 255, 255, 0.6)',
          bgcolor: 'rgba(255, 255, 255, 0.05)',
          transition: 'all 0.2s ease',
          '&:hover': {
            color: '#fff',
            bgcolor: 'rgba(255, 255, 255, 0.12)',
            transform: 'scale(1.08)',
          },
        }}
      >
        <CloseIcon sx={{ fontSize: 20 }} />
      </IconButton>

      <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* Header: MusicFlow + PREMIUM Badge */}
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" sx={{ mb: 2 }}>
          <Typography
            sx={{
              fontWeight: 800,
              fontSize: '17px',
              color: '#ffffff',
              letterSpacing: '-0.02em',
            }}
          >
            MusicFlow
          </Typography>
          <PremiumBadge sx={{ fontSize: '10px', py: '2px', px: '8px' }} />
        </Stack>

        {/* Center Illustration (SVG Zing MP3 style) */}
        <Box
          sx={{
            width: '100%',
            maxWidth: 280,
            height: 160,
            my: 1.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          <svg
            viewBox="0 0 320 200"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ width: '100%', height: '100%', overflow: 'visible' }}
          >
            {/* Background glowing aura */}
            <circle cx="160" cy="110" r="85" fill="url(#bgGlow)" opacity="0.6" />

            {/* Dynamic Sound Waves */}
            <path
              d="M30 115 C 80 80, 120 145, 160 110 C 200 75, 250 140, 290 105"
              stroke="#e5ac18"
              strokeWidth="10"
              strokeLinecap="round"
              opacity="0.85"
            />
            <path
              d="M20 100 C 70 65, 115 130, 160 95 C 205 60, 255 125, 300 90"
              stroke="#6c63ff"
              strokeWidth="8"
              strokeLinecap="round"
              opacity="0.85"
            />
            <path
              d="M45 130 C 95 95, 135 155, 165 125 C 200 95, 240 150, 275 120"
              stroke="#00e5ff"
              strokeWidth="5"
              strokeLinecap="round"
              opacity="0.7"
            />

            {/* Character listening to music with headphones */}
            <g transform="translate(110, 30)">
              {/* Hair backdrop */}
              <path
                d="M50 35 C 20 25, 10 65, 15 105 C 18 120, 35 125, 55 120 C 75 125, 95 110, 95 90 C 95 60, 80 35, 50 35 Z"
                fill="#54382f"
              />
              {/* Face */}
              <ellipse cx="50" cy="55" rx="18" ry="24" fill="#ffd1b3" />
              {/* Body / Shirt */}
              <path
                d="M25 110 C 25 88, 75 88, 75 110 L 85 140 L 15 140 Z"
                fill="#ffffff"
              />
              <path
                d="M35 110 C 35 95, 65 95, 65 110"
                fill="#ffd1b3"
              />
              {/* Headband of headphones */}
              <path
                d="M30 48 C 30 25, 70 25, 70 48"
                stroke="#2563eb"
                strokeWidth="5"
                fill="none"
              />
              {/* Headphone ear cups */}
              <rect x="25" y="44" width="10" height="18" rx="5" fill="#3b82f6" />
              <rect x="65" y="44" width="10" height="18" rx="5" fill="#3b82f6" />
            </g>

            {/* Floating Musical Notes */}
            <text x="50" y="65" fill="#818cf8" fontSize="22" fontWeight="bold">♪</text>
            <text x="80" y="40" fill="#ffffff" fontSize="20" fontWeight="bold">♫</text>
            <text x="65" y="155" fill="#818cf8" fontSize="24" fontWeight="bold">♫</text>
            <text x="245" y="55" fill="#ffffff" fontSize="22" fontWeight="bold">♫</text>
            <text x="270" y="150" fill="#ffffff" fontSize="20" fontWeight="bold">♪</text>
            <text x="240" y="120" fill="#818cf8" fontSize="18" fontWeight="bold">♪</text>

            {/* Gradient Definitions */}
            <defs>
              <radialGradient id="bgGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#6c63ff" stopOpacity="0.45" />
                <stop offset="70%" stopColor="#e5ac18" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#1e212d" stopOpacity="0" />
              </radialGradient>
            </defs>
          </svg>
        </Box>

        {/* Title */}
        <Typography
          variant="h6"
          sx={{
            fontWeight: 900,
            fontSize: { xs: '18px', sm: '20px' },
            color: '#ffffff',
            textTransform: 'uppercase',
            letterSpacing: '0.02em',
            mt: 1,
            lineHeight: 1.3,
          }}
        >
          NÂNG CẤP PREMIUM ĐỂ NGHE TRỌN BÀI
        </Typography>

        {/* Description */}
        <Typography
          sx={{
            fontSize: '13.5px',
            color: 'rgba(255, 255, 255, 0.72)',
            maxWidth: 340,
            mt: 1.5,
            mb: 3,
            lineHeight: 1.6,
          }}
        >
          Theo yêu cầu của đơn vị sở hữu bản quyền, bạn cần tài khoản PREMIUM để nghe trọn vẹn bài hát này
        </Typography>

        {/* Upgrade Button */}
        <Button
          variant="contained"
          onClick={handleUpgrade}
          sx={{
            bgcolor: '#e5ac18',
            color: '#ffffff',
            fontWeight: 800,
            fontSize: '14.5px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            borderRadius: '9999px',
            px: 5,
            py: 1.25,
            minWidth: 175,
            boxShadow: '0 8px 24px rgba(229, 172, 24, 0.4)',
            transition: 'all 0.25s ease',
            '&:hover': {
              bgcolor: '#d49c11',
              boxShadow: '0 10px 30px rgba(229, 172, 24, 0.6)',
              transform: 'translateY(-1px)',
            },
            '&:active': {
              transform: 'scale(0.98)',
            },
          }}
        >
          NÂNG CẤP
        </Button>
      </DialogContent>
    </Dialog>
  );
}
