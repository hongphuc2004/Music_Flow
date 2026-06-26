import React from 'react';
import { Box } from '@mui/material';

const PlayingEqualizer = ({ isPlaying }) => (
  <Box sx={{
    display: 'flex',
    alignItems: 'flex-end',
    gap: '2px',
    height: '14px',
    width: '14px',
    mx: '4px',
    mb: '2px',
    '@keyframes eq-bounce': {
      '0%': { height: '30%' },
      '100%': { height: '100%' },
    },
  }}>
    <Box sx={{ width: '2.5px', height: isPlaying ? '100%' : '30%', bgcolor: '#14b8a6', borderRadius: '1px', animation: isPlaying ? 'eq-bounce 0.8s ease-in-out infinite alternate' : 'none' }} />
    <Box sx={{ width: '2.5px', height: isPlaying ? '100%' : '60%', bgcolor: '#14b8a6', borderRadius: '1px', animation: isPlaying ? 'eq-bounce 0.5s ease-in-out infinite alternate 0.15s' : 'none' }} />
    <Box sx={{ width: '2.5px', height: isPlaying ? '100%' : '40%', bgcolor: '#14b8a6', borderRadius: '1px', animation: isPlaying ? 'eq-bounce 0.7s ease-in-out infinite alternate 0.3s' : 'none' }} />
  </Box>
);

export default PlayingEqualizer;
