import { useEffect, useState } from 'react';
import { Avatar, Box, IconButton, Slider, Stack, Typography } from '@mui/material';
import {
  FavoriteBorderRounded as FavoriteBorderIcon,
  FavoriteRounded as FavoriteIcon,
  DownloadRounded as DownloadIcon,
  RepeatRounded as RepeatIcon,
  RepeatOneRounded as RepeatOneIcon,
  SkipPreviousRounded as PrevIcon,
  PauseRounded as PauseIcon,
  PlayArrowRounded as PlayIcon,
  SkipNextRounded as NextIcon,
  ShuffleRounded as ShuffleIcon,
  MusicNoteRounded as MusicIcon,
  ChatBubbleOutlineRounded as CommentIcon,
} from '@mui/icons-material';
import { useClientPlayer } from './ClientPlayerProvider';
import { clientFavoritesApi, clientSongsApi, clientCommentsApi } from '../../../services/api';
import useClientToast from './useClientToast';

function formatDuration(seconds) {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function NowPlayingBar({
  desktopSidebarOpen = true,
  commentsOpen,
  onToggleComments,
  commentCount,
  setCommentCount,
}) {
  const { showToast } = useClientToast();
  const [favorite, setFavorite] = useState(false);
  const [scrubTime, setScrubTime] = useState(null);
  const {
    currentSong,
    isPlaying,
    currentTime,
    duration,
    hasSong,
    shuffle,
    repeatMode,
    togglePlay,
    seekTo,
    playPrevious,
    playNext,
    toggleShuffle,
    cycleRepeatMode,
  } = useClientPlayer();
  const isLoggedIn = localStorage.getItem('role') === 'user';

  useEffect(() => {
    let ignore = false;

    const checkFavorite = async () => {
      if (!currentSong?._id || !isLoggedIn) {
        setFavorite(false);
        return;
      }

      try {
        const response = await clientFavoritesApi.check(currentSong._id);
        if (!ignore) {
          setFavorite(Boolean(response.data?.isFavorite));
        }
      } catch {
        if (!ignore) {
          setFavorite(false);
        }
      }
    };

    checkFavorite();

    return () => {
      ignore = true;
    };
  }, [currentSong?._id, isLoggedIn]);

  useEffect(() => {
    if (!currentSong?._id) return;
    clientCommentsApi.getSongComments(currentSong._id, { limit: 1 })
      .then((res) => {
        if (res.data?.success && setCommentCount) {
          setCommentCount(res.data.totalComments || 0);
        }
      })
      .catch(() => {});
  }, [currentSong?._id, setCommentCount]);

  const requireLogin = () => {
    showToast({
      severity: 'info',
      title: 'Cần đăng nhập',
      message: 'Vui lòng đăng nhập để sử dụng chức năng này.',
    });
  };

  const handleToggleFavorite = async () => {
    if (!currentSong?._id) return;
    if (!isLoggedIn) {
      requireLogin();
      return;
    }

    try {
      const response = await clientFavoritesApi.toggle(currentSong._id);
      const next = response.data?.isFavorite ?? !favorite;
      setFavorite(next);
      showToast({
        severity: 'success',
        title: 'Thành công!',
        message: next
          ? 'Đã thêm bài hát vào danh sách yêu thích.'
          : 'Đã bỏ bài hát khỏi danh sách yêu thích.',
      });
    } catch (error) {
      showToast({
        severity: 'error',
        title: 'Có lỗi xảy ra',
        message: error.response?.data?.message || 'Không thể cập nhật yêu thích.',
      });
    }
  };

  const handleDownload = async () => {
    if (!currentSong?._id) return;
    if (!isLoggedIn) {
      requireLogin();
      return;
    }

    try {
      await clientSongsApi.requestDownload(currentSong._id);
      showToast({
        severity: 'success',
        title: 'Đã tải xuống',
        message: 'Bài hát đã được thêm vào danh sách bài hát đã tải.',
      });
    } catch (error) {
      showToast({
        severity: 'error',
        title: 'Không thể tải bài hát',
        message: error.response?.data?.message || 'Vui lòng thử lại sau.',
      });
    }
  };

  const handlePrevious = async () => {
    const didPlay = await playPrevious();
    showToast({
      severity: didPlay ? 'success' : 'info',
      title: didPlay ? 'Đang chuyển bài' : 'Không có bài trước',
      message: didPlay
        ? 'Đã chuyển về bài trước trong danh sách phát.'
        : 'Hãy bật lặp toàn bộ hoặc phát từ một danh sách có nhiều bài.',
    });
  };

  const handleNext = async () => {
    const didPlay = await playNext();
    showToast({
      severity: didPlay ? 'success' : 'info',
      title: didPlay ? 'Đang chuyển bài' : 'Không có bài tiếp theo',
      message: didPlay
        ? 'Đã chuyển sang bài tiếp theo trong danh sách phát.'
        : 'Hãy bật lặp toàn bộ hoặc phát từ một danh sách có nhiều bài.',
    });
  };

  const handleToggleShuffle = () => {
    toggleShuffle();
    showToast({
      severity: 'info',
      title: !shuffle ? 'Đã bật phát ngẫu nhiên' : 'Đã tắt phát ngẫu nhiên',
      message: !shuffle
        ? 'Các bài tiếp theo sẽ được chọn ngẫu nhiên trong danh sách.'
        : 'Danh sách sẽ phát theo thứ tự.',
    });
  };

  const handleCycleRepeat = () => {
    const nextMode = cycleRepeatMode();
    const repeatCopy = {
      off: ['Đã tắt lặp', 'Danh sách sẽ dừng khi phát hết.'],
      all: ['Lặp toàn bộ danh sách', 'Khi hết danh sách, player sẽ quay lại bài đầu.'],
      one: ['Lặp một bài', 'Bài hiện tại sẽ được phát lại liên tục.'],
    };

    showToast({
      severity: 'info',
      title: repeatCopy[nextMode][0],
      message: repeatCopy[nextMode][1],
    });
  };

  if (!hasSong) return null;

  return (
    <Box
      sx={{
        position: 'fixed',
        left: { xs: 10, md: desktopSidebarOpen ? 276 : 92 },
        right: 16,
        bottom: 12,
        zIndex: 1150,
        overflow: 'hidden',
        borderRadius: 2.5,
        border: '1px solid rgba(255,255,255,0.12)',
        background: 'linear-gradient(110deg, #082f49 0%, #0f172a 55%, #102a43 100%)',
        boxShadow: '0 16px 38px rgba(2, 6, 23, 0.35)',
        color: '#fff',
        p: { xs: 1.2, md: 1.4 },
        minHeight: { xs: 78, md: 84 },
        transition: (theme) => theme.transitions.create('left', {
          duration: theme.transitions.duration.shorter,
        }),
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
              bgcolor: 'rgba(20, 184, 166, 0.12)',
              color: '#14b8a6',
            }}
          >
            <MusicIcon sx={{ fontSize: 28 }} />
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
          <IconButton
            size="small"
            onClick={handleToggleFavorite}
            sx={{ color: favorite ? '#fb7185' : 'rgba(255,255,255,0.78)' }}
          >
            {favorite ? <FavoriteIcon sx={{ fontSize: 25 }} /> : <FavoriteBorderIcon sx={{ fontSize: 25 }} />}
          </IconButton>
          <IconButton size="small" onClick={handleDownload} sx={{ color: 'rgba(255,255,255,0.78)' }}>
            <DownloadIcon sx={{ fontSize: 25 }} />
          </IconButton>
          <IconButton
            size="small"
            onClick={onToggleComments}
            sx={{
              color: commentsOpen ? '#14b8a6' : 'rgba(255,255,255,0.78)',
              position: 'relative',
            }}
          >
            <CommentIcon sx={{ fontSize: 25 }} />
            {commentCount > 0 && (
              <Box
                sx={{
                  position: 'absolute',
                  top: -2,
                  right: -2,
                  bgcolor: '#14b8a6',
                  color: '#fff',
                  borderRadius: '50%',
                  minWidth: 15,
                  height: 15,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '9px',
                  fontWeight: 'bold',
                  px: 0.5,
                }}
              >
                {commentCount > 99 ? '99+' : commentCount}
              </Box>
            )}
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
            <IconButton
              size="small"
              onClick={handleToggleShuffle}
              sx={{ color: shuffle ? '#5eead4' : 'rgba(255,255,255,0.68)', display: { xs: 'none', sm: 'inline-flex' } }}
            >
              <ShuffleIcon sx={{ fontSize: 25 }} />
            </IconButton>
            <IconButton size="small" sx={{ color: 'rgba(255,255,255,0.78)' }} onClick={handlePrevious}>
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
            <IconButton size="small" sx={{ color: 'rgba(255,255,255,0.78)' }} onClick={handleNext}>
              <NextIcon sx={{ fontSize: 25 }} />
            </IconButton>
            <IconButton
              size="small"
              onClick={handleCycleRepeat}
              sx={{ color: repeatMode === 'off' ? 'rgba(255,255,255,0.68)' : '#5eead4', display: { xs: 'none', sm: 'inline-flex' } }}
            >
              {repeatMode === 'one' ? <RepeatOneIcon sx={{ fontSize: 25 }} /> : <RepeatIcon sx={{ fontSize: 25 }} />}
            </IconButton>
          </Stack>

          <Slider
            size="small"
            min={0}
            max={duration || currentSong?.duration || 1}
            value={Math.min(scrubTime ?? currentTime, duration || currentSong?.duration || 1)}
            onChange={(_, value) => setScrubTime(Number(value))}
            onChangeCommitted={(_, value) => {
              seekTo(value);
              setScrubTime(null);
            }}
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
