import { Avatar, Box, IconButton, Slider, Stack, Typography } from '@mui/material';
import {
  FavoriteBorderRounded as FavoriteIcon,
  DownloadRounded as DownloadIcon,
  RepeatRounded as RepeatIcon,
  SkipPreviousRounded as PrevIcon,
  PauseRounded as PauseIcon,
  PlayArrowRounded as PlayIcon,
  SkipNextRounded as NextIcon,
  ShuffleRounded as ShuffleIcon,
} from '@mui/icons-material';
import { useClientPlayer } from './ClientPlayerProvider';

function formatDuration(seconds) {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function NowPlayingBar() {
  const {
    currentSong,
    isPlaying,
    currentTime,
    duration,
    hasSong,
    playSong,
    togglePlay,
    seekTo,
  } = useClientPlayer();

  if (!hasSong) return null;

  return (
    <Box
      sx={{
        position: 'fixed',
        left: { xs: 10, md: 276 },
        right: 16,
        bottom: 12,
        zIndex: 1300,
        overflow: 'hidden',
        borderRadius: 2.5,
        border: '1px solid rgba(255,255,255,0.12)',
        background: 'linear-gradient(110deg, #082f49 0%, #0f172a 55%, #102a43 100%)',
        boxShadow: '0 16px 38px rgba(2, 6, 23, 0.35)',
        color: '#fff',
        p: { xs: 1.2, md: 1.4 },
      }}
    >
      <Stack direction="row" alignItems="center" spacing={{ xs: 1, md: 1.5 }}>
        <Stack direction="row" spacing={1.2} alignItems="center" sx={{ minWidth: 0, width: { xs: 180, md: 260 } }}>
          <Avatar
            src={currentSong?.imageUrl}
            variant="rounded"
            sx={{
              width: { xs: 48, md: 56 },
              height: { xs: 48, md: 56 },
              borderRadius: 1.25,
            }}
          >
            {currentSong?.title?.charAt(0) || 'S'}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" fontWeight={700} noWrap>
              {currentSong?.title}
            </Typography>
            <Typography variant="caption" sx={{ color: '#fff', opacity: 0.9 }} noWrap>
              {currentSong?.artistText || 'Unknown artist'}
            </Typography>
            <Stack direction="row" spacing={0.25} sx={{ mt: 0.2 }}>
              <Typography variant="caption" sx={{ opacity: 0.72 }}>
                {formatDuration(currentTime)}
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.52 }}>
                /
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.72 }}>
                {formatDuration(duration || currentSong?.duration || 0)}
              </Typography>
            </Stack>
          </Box>
        </Stack>

        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ display: { xs: 'none', md: 'flex' } }}>
          <IconButton size="small" sx={{ color: 'rgba(255,255,255,0.78)' }}>
            <FavoriteIcon sx={{ fontSize: 25 }} />
          </IconButton>
          <IconButton size="small" sx={{ color: 'rgba(255,255,255,0.78)' }}>
            <DownloadIcon sx={{ fontSize: 25 }} />
          </IconButton>
        </Stack>

        <Stack sx={{ flex: 1, minWidth: 0 }}>
          <Stack
            direction="row"
            justifyContent="center"
            alignItems="center"
            spacing={{ xs: 0.4, md: 0.8 }}
            sx={{ mb: 1.2 }}
          >
            <IconButton size="small" sx={{ color: 'rgba(255,255,255,0.68)', display: { xs: 'none', sm: 'inline-flex' } }}>
              <ShuffleIcon sx={{ fontSize: 25 }} />
            </IconButton>
            <IconButton size="small" sx={{ color: 'rgba(255,255,255,0.78)' }} onClick={() => seekTo(0)}>
              <PrevIcon sx={{ fontSize: 25 }} />
            </IconButton>
            <IconButton
              size="small"
              onClick={togglePlay}
              sx={{
                color: '#fff',
                bgcolor: '#14b8a6',
                width: 38,
                height: 38,
                '&:hover': {
                  bgcolor: '#0f766e',
                },
              }}
            >
              {isPlaying ? <PauseIcon sx={{ fontSize: 22 }} /> : <PlayIcon sx={{ fontSize: 22 }} />}
            </IconButton>
            <IconButton size="small" sx={{ color: 'rgba(255,255,255,0.78)' }} onClick={() => playSong(currentSong)}>
              <NextIcon sx={{ fontSize: 25 }} />
            </IconButton>
            <IconButton size="small" sx={{ color: 'rgba(255,255,255,0.68)', display: { xs: 'none', sm: 'inline-flex' } }}>
              <RepeatIcon sx={{ fontSize: 25 }} />
            </IconButton>
          </Stack>

          <Slider
            size="small"
            min={0}
            max={duration || currentSong?.duration || 1}
            value={Math.min(currentTime, duration || currentSong?.duration || 1)}
            onChange={(_, value) => seekTo(value)}
            sx={{
              color: '#14b8a6',
              py: 0,
              mt: 0.3,
              '& .MuiSlider-thumb': {
                width: 9,
                height: 9,
              },
              '& .MuiSlider-rail': {
                opacity: 0.26,
              },
            }}
          />
        </Stack>
      </Stack>
    </Box>
  );
}

export default NowPlayingBar;
