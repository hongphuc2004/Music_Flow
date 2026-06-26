import React from 'react';
import { Box, Avatar, Stack, Typography, IconButton } from '@mui/material';
import {
  PlayArrowRounded as PlayIcon,
  PauseRounded as PauseIcon,
  MusicNoteRounded as MusicIcon,
} from '@mui/icons-material';
import SongMoreMenu from '../Layout/client/SongMoreMenu';
import PlayingEqualizer from './PlayingEqualizer';

function formatDuration(secs) {
  if (isNaN(secs) || secs === undefined || secs === null) return '--:--';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

const SongItem = ({
  song,
  isCurrent,
  isPlaying,
  onPlay,
  showActions = true,
  actions = null,
  onEdit = undefined,
  moreMenuButtonSx = undefined,
  index = null,
  showDuration = false,
}) => {
  const hasImage = song.imageUrl && song.imageUrl.trim() !== '' && !song.imageUrl.includes('tgdfbp3zivuqoxqxpltj');

  return (
    <Box
      onClick={onPlay}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onPlay();
        }
      }}
      role="button"
      tabIndex={0}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        p: 1.5,
        borderRadius: 3,
        cursor: 'pointer',
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        bgcolor: (theme) => isCurrent
          ? theme.palette.mode === 'dark' ? 'rgba(20, 184, 166, 0.12)' : 'rgba(20, 184, 166, 0.06)'
          : theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.01)',
        border: '1px solid',
        borderColor: (theme) => isCurrent
          ? '#14b8a6'
          : theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)',
        outline: 'none',
        '&:hover': {
          borderColor: '#14b8a6',
          bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(20, 184, 166, 0.08)' : 'rgba(20, 184, 166, 0.04)',
          transform: 'translateY(-2px)',
          boxShadow: (theme) => theme.palette.mode === 'dark'
            ? '0 8px 20px -6px rgba(20, 184, 166, 0.3)'
            : '0 8px 16px -6px rgba(20, 184, 166, 0.12)',
        },
        '&:hover .song-img-overlay': {
          opacity: 1,
        },
        '&:hover .song-img-avatar': {
          transform: 'scale(1.04)',
        },
        '&:hover .song-row-play-btn': {
          opacity: 1,
          transform: 'scale(1)',
        },
        '&:hover .song-row-num': {
          display: 'none',
        },
      }}
    >
      {/* Optional Index / Hover Play */}
      {index !== null && (
        <Box sx={{ width: 24, display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
          {isCurrent ? (
            <PlayingEqualizer isPlaying={isPlaying} />
          ) : (
            <Box className="index-container" sx={{ position: 'relative', width: 24, height: 24, display: 'grid', placeItems: 'center' }}>
              <Typography
                className="song-row-num"
                variant="caption"
                sx={{
                  color: 'text.secondary',
                  fontWeight: 800,
                  fontSize: 13,
                }}
              >
                {index.toString().padStart(2, '0')}
              </Typography>
              <PlayIcon
                className="song-row-play-btn"
                sx={{
                  position: 'absolute',
                  inset: 0,
                  opacity: 0,
                  transform: 'scale(0.8)',
                  transition: 'all 0.2s ease',
                  color: '#14b8a6',
                  fontSize: 22,
                  m: 'auto',
                }}
              />
            </Box>
          )}
        </Box>
      )}

      {/* Cover Artwork */}
      <Box sx={{ position: 'relative', overflow: 'hidden', borderRadius: 2, flexShrink: 0, width: 48, height: 48 }}>
        <Avatar
          variant="rounded"
          src={hasImage ? song.imageUrl : undefined}
          className="song-img-avatar"
          sx={{
            width: '100%',
            height: '100%',
            bgcolor: 'rgba(20, 184, 166, 0.08)',
            color: '#14b8a6',
            transition: 'transform 0.25s ease',
            '& .MuiAvatar-fallback': { display: 'none' }
          }}
        >
          <MusicIcon sx={{ fontSize: 24 }} />
        </Avatar>

        {/* Hover Play Overlay */}
        <Box
          className="song-img-overlay"
          sx={{
            position: 'absolute',
            inset: 0,
            bgcolor: 'rgba(0,0,0,0.45)',
            display: 'grid',
            placeItems: 'center',
            opacity: isCurrent ? 1 : 0,
            transition: 'opacity 0.2s ease',
          }}
        >
          {isCurrent ? (
            isPlaying ? (
              <PauseIcon sx={{ color: '#fff', fontSize: 20 }} />
            ) : (
              <PlayIcon sx={{ color: '#fff', fontSize: 20 }} />
            )
          ) : (
            <PlayIcon sx={{ color: '#fff', fontSize: 20 }} />
          )}
        </Box>
      </Box>

      {/* Song details */}
      <Box sx={{ minWidth: 0, flexGrow: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.25 }}>
          <Typography
            variant="body2"
            noWrap
            sx={{
              fontWeight: 800,
              color: isCurrent ? '#14b8a6' : 'text.primary',
              transition: 'color 0.2s ease',
              fontSize: 13.5,
            }}
          >
            {song.title}
          </Typography>
          {isCurrent && index === null && <PlayingEqualizer isPlaying={isPlaying} />}
        </Stack>
        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', fontWeight: 500 }}>
          {Array.isArray(song.artists)
            ? song.artists.map((artist) => artist?.name || artist).filter(Boolean).join(', ')
            : song.artistText || 'Unknown artist'}
        </Typography>
      </Box>

      {/* Optional Duration */}
      {showDuration && (
        <Box sx={{ width: 80, textAlign: 'right', pr: 2, flexShrink: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.secondary' }}>
            {formatDuration(song.duration)}
          </Typography>
        </Box>
      )}

      {/* Action area */}
      {showActions && (
        <Box onClick={(e) => e.stopPropagation()} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {actions}
          <SongMoreMenu song={song} onEdit={onEdit} buttonSx={moreMenuButtonSx} />
        </Box>
      )}
    </Box>
  );
};

export default SongItem;
