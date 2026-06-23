import { Drawer, Box, Stack, Typography, IconButton, Avatar, Button } from '@mui/material';
import {
  CloseRounded as CloseIcon,
  QueueMusicRounded as QueueMusicIcon,
  MusicNoteRounded as MusicIcon,
  PlayArrowRounded as PlayIcon,
  PauseRounded as PauseIcon,
} from '@mui/icons-material';
import { useClientPlayer } from './ClientPlayerProvider';

function QueueDrawer({ open, onClose }) {
  const { currentSong, queue, isPlaying, playSong } = useClientPlayer();

  const formatDuration = (seconds) => {
    const safeSeconds = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
    const mins = Math.floor(safeSeconds / 60);
    const secs = safeSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePlaySong = (song) => {
    playSong(song, { queue });
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 400 },
          background: 'linear-gradient(180deg, #0f172a 0%, #080d1a 100%)',
          boxShadow: '-8px 0 30px rgba(0, 0, 0, 0.5)',
          borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          zIndex: 1200, // standard MUI Drawer z-index (lies below dialogs but above player bar 1150)
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 2,
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(255, 255, 255, 0.01)',
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={1} alignItems="center">
            <QueueMusicIcon sx={{ color: '#14b8a6' }} />
            <Typography variant="h6" fontWeight={700} color="#fff">
              Danh sách phát ({queue.length})
            </Typography>
          </Stack>
          <IconButton onClick={onClose} sx={{ color: 'rgba(255, 255, 255, 0.6)' }}>
            <CloseIcon />
          </IconButton>
        </Stack>
      </Box>

      {/* Queue List */}
      <Box
        sx={{
          flexGrow: 1,
          p: 2,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          '&::-webkit-scrollbar': { width: 5 },
          '&::-webkit-scrollbar-track': { bgcolor: 'transparent' },
          '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255, 255, 255, 0.12)', borderRadius: 10 },
        }}
      >
        {queue.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8, px: 2 }}>
            <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.45)' }}>
              Danh sách phát trống. Hãy chọn một bài hát để bắt đầu!
            </Typography>
          </Box>
        ) : (
          queue.map((song, index) => {
            const isCurrent = currentSong?._id === song._id;

            return (
              <Box
                key={`${song._id}-${index}`}
                onClick={() => handlePlaySong(song)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  p: 1.25,
                  borderRadius: 2.5,
                  cursor: 'pointer',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  bgcolor: isCurrent ? 'rgba(20, 184, 166, 0.1)' : 'transparent',
                  border: '1px solid',
                  borderColor: isCurrent ? 'rgba(20, 184, 166, 0.25)' : 'transparent',
                  '&:hover': {
                    borderColor: '#14b8a6',
                    bgcolor: 'rgba(20, 184, 166, 0.06)',
                    transform: 'translateY(-1px)',
                  },
                  '&:hover .queue-play-btn': {
                    opacity: 1,
                    transform: 'scale(1)',
                  },
                  '&:hover .queue-index': {
                    display: 'none',
                  },
                }}
              >
                {/* Index / Play / Pause */}
                <Box sx={{ width: 24, display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
                  {isCurrent ? (
                    isPlaying ? (
                      <PauseIcon sx={{ color: '#14b8a6', fontSize: 18 }} />
                    ) : (
                      <PlayIcon sx={{ color: '#14b8a6', fontSize: 18 }} />
                    )
                  ) : (
                    <Box sx={{ position: 'relative', width: 24, height: 24, display: 'grid', placeItems: 'center' }}>
                      <Typography
                        className="queue-index"
                        variant="caption"
                        sx={{
                          color: 'rgba(255, 255, 255, 0.45)',
                          fontWeight: 700,
                          fontSize: 12,
                        }}
                      >
                        {(index + 1).toString().padStart(2, '0')}
                      </Typography>
                      <IconButton
                        className="queue-play-btn"
                        size="small"
                        sx={{
                          position: 'absolute',
                          opacity: 0,
                          transform: 'scale(0.8)',
                          transition: 'all 0.2s ease',
                          color: '#14b8a6',
                          p: 0,
                        }}
                      >
                        <PlayIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Box>
                  )}
                </Box>

                {/* Song Cover Thumbnail */}
                <Avatar
                  src={song.imageUrl || undefined}
                  variant="rounded"
                  sx={{
                    width: 40,
                    height: 40,
                    bgcolor: 'rgba(255, 255, 255, 0.08)',
                    borderRadius: 1.5,
                  }}
                >
                  <MusicIcon sx={{ fontSize: 20, color: '#14b8a6' }} />
                </Avatar>

                {/* Title & Artist */}
                <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                  <Typography
                    variant="body2"
                    fontWeight={800}
                    noWrap
                    sx={{
                      color: isCurrent ? '#14b8a6' : 'rgba(255, 255, 255, 0.9)',
                      fontSize: 13,
                      mb: 0.25,
                    }}
                  >
                    {song.title}
                  </Typography>
                  <Typography
                    variant="caption"
                    noWrap
                    sx={{
                      display: 'block',
                      color: isCurrent ? 'rgba(20, 184, 166, 0.7)' : 'rgba(255, 255, 255, 0.5)',
                      fontWeight: 500,
                    }}
                  >
                    {Array.isArray(song.artists)
                      ? song.artists.map((artist) => artist?.name).filter(Boolean).join(', ')
                      : song.artistText || 'Unknown artist'}
                  </Typography>
                </Box>

                {/* Duration */}
                <Typography
                  variant="caption"
                  sx={{
                    color: 'rgba(255, 255, 255, 0.45)',
                    fontWeight: 600,
                    minWidth: 32,
                    textAlign: 'right',
                    flexShrink: 0,
                  }}
                >
                  {song.duration ? formatDuration(song.duration) : '--:--'}
                </Typography>
              </Box>
            );
          })
        )}
      </Box>
    </Drawer>
  );
}

export default QueueDrawer;
