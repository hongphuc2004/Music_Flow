import React from 'react';
import { Box, Tooltip } from '@mui/material';

/**
 * PreviewDurationMarker
 * Hiển thị 1 vách ngăn nhỏ tại mốc 45s trên thanh thời lượng phát nhạc (như Zing MP3)
 * khi người dùng tài khoản Free đang phát bài hát thuộc Kho nhạc Premium (VIP).
 *
 * @param {boolean} isPremiumPreview - Có đang ở chế độ nghe thử giới hạn 45s hay không
 * @param {number} duration - Tổng thời lượng của bài hát (giây)
 * @param {number} [cutoffSeconds=45] - Mốc thời gian bị giới hạn (mặc định 45s)
 * @param {function} [onOpenModal] - Callback mở dialog khi click vào vách ngăn
 */
export default function PreviewDurationMarker({
  isPremiumPreview,
  duration,
  cutoffSeconds = 45,
  onOpenModal,
}) {
  if (!isPremiumPreview || !duration || duration <= cutoffSeconds) {
    return null;
  }

  const percent = Math.min(100, Math.max(0, (cutoffSeconds / duration) * 100));

  return (
    <Tooltip
      title={`Giới hạn nghe thử ${cutoffSeconds}s`}
      arrow
      placement="top"
    >
      <Box
        onClick={(e) => {
          e.stopPropagation();
          onOpenModal?.();
        }}
        sx={{
          position: 'absolute',
          left: `${percent}%`,
          top: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 3,
          cursor: 'pointer',
          py: 0.5,
          px: 0.25,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'auto',
          transition: 'all 0.15s ease',
          '&:hover': {
            transform: 'translate(-50%, -50%) scaleY(1.3)',
          },
        }}
      >
        {/* Vách ngăn nhỏ cắt qua thanh tiến trình */}
        <Box
          sx={{
            width: 2.5,
            height: 10,
            borderRadius: '1.5px',
            bgcolor: '#e5ac18',
            boxShadow: '0 0 6px rgba(229, 172, 24, 0.9), 0 0 2px rgba(255, 255, 255, 0.9)',
          }}
        />
      </Box>
    </Tooltip>
  );
}
