import React from 'react';
import { Box } from '@mui/material';

/**
 * PremiumBadge - Gold badge styled after Zing MP3 Premium songs
 */
export default function PremiumBadge({ sx = {} }) {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: '#e5ac18',
        color: '#ffffff',
        fontSize: '9.5px',
        fontWeight: 800,
        letterSpacing: '0.4px',
        px: '6px',
        py: '1.5px',
        borderRadius: '4px',
        lineHeight: 1.2,
        flexShrink: 0,
        userSelect: 'none',
        verticalAlign: 'middle',
        boxShadow: '0 2px 6px rgba(229, 172, 24, 0.35)',
        ...sx,
      }}
    >
      PREMIUM
    </Box>
  );
}
