import React from 'react';
import { Box, Avatar, Typography, IconButton, Stack } from '@mui/material';
import {
  PlayArrowRounded as PlayIcon,
  LibraryMusicRounded as LibraryMusicIcon,
  EditRounded as EditIcon,
  DeleteOutlineRounded as DeleteIcon,
  LockRounded as LockIcon,
  PublicRounded as PublicIcon,
} from '@mui/icons-material';

const PlaylistCard = ({
  playlist,
  onClick,
  onPlay = null,
  onEdit = null,
  onDelete = null,
  showPrivacyBadge = false,
}) => {
  const hasCover = playlist.coverImage && playlist.coverImage.trim() !== '';
  const songCount = playlist.songCount !== undefined ? playlist.songCount : (playlist.songs?.length || 0);

  return (
    <Box
      onClick={onClick}
      sx={{
        p: 2.25,
        borderRadius: '24px',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        flexGrow: 1,
        position: 'relative',
        overflow: 'hidden',
        border: '1px solid',
        borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)',
        background: (theme) => theme.palette.mode === 'dark'
          ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.02) 0%, rgba(255, 255, 255, 0.005) 100%)'
          : 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(245,247,250,0.7) 100%)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.02)',
        transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        '&:hover': {
          transform: 'translateY(-6px)',
          boxShadow: (theme) => theme.palette.mode === 'dark'
            ? '0 16px 35px rgba(0, 0, 0, 0.4)'
            : '0 16px 35px rgba(108, 99, 255, 0.08)',
          borderColor: '#6c63ff',
          '& .playlist-cover': { transform: 'scale(1.06)' },
          '& .play-action-overlay': {
            opacity: 1,
            '& .play-btn': { transform: 'scale(1) translateY(0)' },
            '& .crud-actions': { transform: 'translateY(0)' },
          },
        },
      }}
    >
      {/* Cover Image Area */}
      <Box sx={{ width: '100%', aspectRatio: '1/1', borderRadius: '18px', overflow: 'hidden', position: 'relative', mb: 2, flexShrink: 0 }}>
        <Avatar
          variant="rounded"
          src={hasCover ? playlist.coverImage : undefined}
          className="playlist-cover"
          sx={{
            width: '100%',
            height: '100%',
            bgcolor: 'rgba(20, 184, 166, 0.08)',
            color: '#14b8a6',
            transition: 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
            '& .MuiAvatar-fallback': { display: 'none' }
          }}
        >
          <Typography variant="h3" sx={{ fontWeight: 900 }}>
            {(playlist.name || 'P').charAt(0).toUpperCase()}
          </Typography>
        </Avatar>

        {/* Hover Overlay Controls */}
        <Box
          className="play-action-overlay"
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15,23,42,0.45)',
            opacity: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            transition: 'opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            backdropFilter: 'blur(4px)',
            zIndex: 3,
          }}
        >
          {onPlay && (
            <IconButton
              className="play-btn"
              onClick={(e) => {
                e.stopPropagation();
                onPlay(e);
              }}
              sx={{
                width: 52,
                height: 52,
                bgcolor: 'primary.main',
                color: '#fff',
                transform: 'scale(0.8) translateY(15px)',
                boxShadow: '0 8px 20px rgba(108, 99, 255, 0.4)',
                transition: 'all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
                '&:hover': { bgcolor: 'primary.dark', transform: 'scale(1.1)' },
                mb: 1.5,
              }}
            >
              <PlayIcon sx={{ fontSize: 30 }} />
            </IconButton>
          )}

          {(onEdit || onDelete) && (
            <Stack
              direction="row"
              spacing={1}
              className="crud-actions"
              sx={{
                transform: 'translateY(15px)',
                transition: 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              {onEdit && (
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(e);
                  }}
                  sx={{
                    bgcolor: 'rgba(255,255,255,0.15)',
                    color: '#fff',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.3)', transform: 'scale(1.05)' },
                  }}
                >
                  <EditIcon sx={{ fontSize: 16 }} />
                </IconButton>
              )}
              {onDelete && (
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(e);
                  }}
                  sx={{
                    bgcolor: 'rgba(255,255,255,0.15)',
                    color: '#ff4e7c',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.3)', transform: 'scale(1.05)' },
                  }}
                >
                  <DeleteIcon sx={{ fontSize: 16 }} />
                </IconButton>
              )}
            </Stack>
          )}
        </Box>

        {/* Privacy Badge */}
        {showPrivacyBadge && (
          <Box
            sx={{
              position: 'absolute',
              top: 10,
              right: 10,
              bgcolor: 'rgba(15, 23, 42, 0.75)',
              color: '#fff',
              px: 1.25,
              py: 0.5,
              borderRadius: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              backdropFilter: 'blur(4px)',
              border: '1px solid rgba(255,255,255,0.1)',
              zIndex: 4,
            }}
          >
            {playlist.isPublic ? <PublicIcon sx={{ fontSize: 11 }} /> : <LockIcon sx={{ fontSize: 11 }} />}
            <Typography variant="caption" sx={{ fontSize: '0.6rem', fontWeight: 800 }}>
              {playlist.isPublic ? 'Public' : 'Private'}
            </Typography>
          </Box>
        )}
      </Box>

      <Box sx={{ px: 0.5, display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
        <Typography variant="body1" sx={{ fontWeight: 800 }} noWrap>
          {playlist.name || 'Không tên'}
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            display: '-webkit-box',
            WebkitLineClamp: 1,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            minHeight: '18px',
            fontWeight: 555,
            mt: 0.25,
          }}
        >
          {playlist.description || 'Không có mô tả.'}
        </Typography>
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            mt: 'auto',
            pt: 1,
            fontWeight: 800,
            color: 'primary.main',
          }}
        >
          {songCount} bài hát
        </Typography>
      </Box>
    </Box>
  );
};

export default PlaylistCard;
