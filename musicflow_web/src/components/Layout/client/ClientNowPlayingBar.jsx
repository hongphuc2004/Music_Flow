import { useEffect, useState } from 'react';
import { Avatar, Box, IconButton, Slider, Stack, Typography, Menu, MenuItem, ListItemText, Dialog, DialogTitle, DialogContent, DialogActions, Button, CircularProgress, Tooltip, Badge } from '@mui/material';

import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorderRounded';
import FavoriteIcon from '@mui/icons-material/FavoriteRounded';
import DownloadIcon from '@mui/icons-material/DownloadRounded';
import RepeatIcon from '@mui/icons-material/RepeatRounded';
import RepeatOneIcon from '@mui/icons-material/RepeatOneRounded';
import PrevIcon from '@mui/icons-material/SkipPreviousRounded';
import PauseIcon from '@mui/icons-material/PauseRounded';
import PlayIcon from '@mui/icons-material/PlayArrowRounded';
import NextIcon from '@mui/icons-material/SkipNextRounded';
import ShuffleIcon from '@mui/icons-material/ShuffleRounded';
import MusicIcon from '@mui/icons-material/MusicNoteRounded';
import CommentIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import AutoplayIcon from '@mui/icons-material/AllInclusiveRounded';
import PremiumIcon from '@mui/icons-material/WorkspacePremiumRounded';
import ShareIcon from '@mui/icons-material/ShareRounded';
import { useClientPlayer } from './ClientPlayerProvider';
import { clientFavoritesApi, clientSongsApi, clientCommentsApi } from '../../../services/client/client.service';
import useAppToast from '../../../components/common/useAppToast';
import { useNavigate } from 'react-router-dom';
import ShareSongModal from '../../common/ShareSongModal';
import { getOptimizedImageUrl } from '../../../utils/imageUtil';


function formatDuration(seconds) {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function ClientNowPlayingBar({
  desktopSidebarOpen = true,
  commentsOpen,
  onToggleComments,
  commentCount,
  setCommentCount,
}) {
  const { showToast } = useAppToast();
  const [favorite, setFavorite] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
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
    autoplay,
    toggleAutoplay,
    audioQuality,
    actualAudioQuality,
    isPremium,
    setAudioQuality,
    isQualityLoading,
  } = useClientPlayer();
  const isLoggedIn = Boolean(localStorage.getItem('role'));
  const navigate = useNavigate();
  const [qualityAnchorEl, setQualityAnchorEl] = useState(null);
  const [premiumDialogOpen, setPremiumDialogOpen] = useState(false);

  const handleQualityMenuOpen = (event) => {
    setQualityAnchorEl(event.currentTarget);
  };

  const handleQualityMenuClose = () => {
    setQualityAnchorEl(null);
  };

  const handleSelectQuality = (quality) => {
    handleQualityMenuClose();
    if (quality === 'hq') {
      if (!isPremium) {
        setPremiumDialogOpen(true);
        return;
      }
    }
    setAudioQuality(quality);
  };

  const isHQAvailable = currentSong?.audioMetadata?.hasHighQualitySource === true;
  const displayDuration = (Number.isFinite(duration) && duration > 0) ? duration : (currentSong?.duration || 0);

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

  const handleToggleAutoplay = () => {
    toggleAutoplay();
    showToast({
      severity: 'info',
      title: !autoplay ? 'Đã bật Tự động phát' : 'Đã tắt Tự động phát',
      message: !autoplay
        ? 'Hệ thống sẽ tự động tìm và phát các bài hát tương tự khi hết danh sách chờ.'
        : 'Trình phát sẽ dừng lại khi phát hết danh sách chờ.',
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
        overflow: 'visible',
        borderRadius: '26px',
        border: '1px solid rgba(255,255,255,0.14)',
        background: 'linear-gradient(135deg, rgba(12, 18, 34, 0.82) 0%, rgba(6, 9, 18, 0.9) 100%)',
        backdropFilter: 'blur(40px) saturate(220%)',
        boxShadow: '0 30px 60px -12px rgba(0, 0, 0, 0.8), 0 0 35px rgba(99, 102, 241, 0.22), inset 0 1px 1.5px rgba(255, 255, 255, 0.2)',
        color: '#fff',
        p: { xs: 1.2, md: 1.4 },
        minHeight: { xs: 78, md: 84 },
        transition: (theme) => theme.transitions.create('left', {
          duration: theme.transitions.duration.shorter,
        }),
      }}
    >
      <Stack direction="row" alignItems="center" spacing={{ xs: 1, md: 2 }} sx={{ minWidth: 0, flexShrink: 0 }}>
        <Stack
          direction="row"
          spacing={1.5}
          alignItems="center"
          sx={{
            minWidth: 0,
            width: { xs: 140, sm: 190, md: 250, lg: 280 },
            maxWidth: { xs: 140, sm: 190, md: 250, lg: 280 },
            flexShrink: 0,
            overflow: 'visible',
          }}
        >
          <Box sx={{ position: 'relative', width: { xs: 44, md: 54 }, height: { xs: 44, md: 54 }, flexShrink: 0 }}>
            {/* Vinyl Record 3D that slides out when playing */}
            <Box
              className={isPlaying ? 'animate-vinyl-spin' : 'animate-vinyl-spin-paused'}
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: { xs: 44, md: 54 },
                height: { xs: 44, md: 54 },
                borderRadius: '50%',
                background: 'radial-gradient(circle, #05070e 22%, #1a2035 23%, #0c101d 42%, #1e2640 43%, #070912 68%, #252e4d 69%, #05070e 100%)',
                border: '1px solid rgba(255,255,255,0.18)',
                boxShadow: isPlaying ? '0 0 16px rgba(108, 99, 255, 0.45)' : 'none',
                transform: isPlaying ? 'translateX(14px)' : 'translateX(0)',
                transition: 'transform 0.45s cubic-bezier(0.16, 1, 0.3, 1)',
                zIndex: 0,
                display: { xs: 'none', sm: 'block' },
              }}
            >
              {/* Vinyl center hole */}
              <Box
                sx={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  bgcolor: '#6c63ff',
                  border: '2px solid #05070e',
                }}
              />
            </Box>

            <Avatar
              src={getOptimizedImageUrl(currentSong?.imageUrl, 'now_playing')}
              variant="rounded"
              sx={{
                position: 'relative',
                zIndex: 1,
                width: '100%',
                height: '100%',
                borderRadius: 2.5,
                bgcolor: 'rgba(108, 99, 255, 0.18)',
                color: '#8c85ff',
                boxShadow: isPlaying ? '0 8px 24px rgba(0,0,0,0.5), 0 0 14px rgba(108, 99, 255, 0.4)' : '0 4px 12px rgba(0,0,0,0.3)',
                transition: 'all 0.3s ease',
              }}
            >
              <MusicIcon sx={{ fontSize: 26 }} />
            </Avatar>
          </Box>
          <Box sx={{ minWidth: 0, flexGrow: 1, width: '100%', overflow: 'hidden' }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
              <Typography
                variant="body2"
                fontWeight={850}
                noWrap
                sx={{
                  fontSize: { xs: 13, md: 14 },
                  letterSpacing: '-0.01em',
                  display: 'block',
                  minWidth: 0,
                  flexGrow: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {currentSong?.title}
              </Typography>
              {isPlaying && (
                <Stack direction="row" spacing={0.3} alignItems="flex-end" sx={{ height: 12, flexShrink: 0, pb: 0.2 }}>
                  <Box sx={{ width: 2, bgcolor: '#00e5ff', borderRadius: 1 }} className="spectrum-bar-1" />
                  <Box sx={{ width: 2, bgcolor: '#8c85ff', borderRadius: 1 }} className="spectrum-bar-2" />
                  <Box sx={{ width: 2, bgcolor: '#6c63ff', borderRadius: 1 }} className="spectrum-bar-3" />
                  <Box sx={{ width: 2, bgcolor: '#00e5ff', borderRadius: 1 }} className="spectrum-bar-4" />
                </Stack>
              )}
            </Stack>
            <Typography
              variant="caption"
              noWrap
              sx={{
                color: 'rgba(255,255,255,0.7)',
                display: 'block',
                mt: 0.1,
                width: '100%',
                fontWeight: 500,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {currentSong?.artistText || 'Unknown artist'}
            </Typography>
            <Stack direction="row" spacing={0.3} sx={{ mt: 0.2 }}>
              <Typography variant="caption" sx={{ opacity: 0.85, fontSize: 11, fontWeight: 700, color: '#00e5ff' }}>
                {formatDuration(currentTime)}
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.4, fontSize: 11 }}>
                /
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.7, fontSize: 11, fontWeight: 600 }}>
                {formatDuration(displayDuration)}
              </Typography>
            </Stack>
          </Box>
        </Stack>

        <Stack direction="row" alignItems="center" spacing={0.6} sx={{ display: { xs: 'none', md: 'flex' } }}>
          <IconButton
            size="small"
            onClick={handleToggleFavorite}
            sx={{
              color: favorite ? '#f43f5e' : 'rgba(255,255,255,0.75)',
              transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              '&:hover': { transform: 'scale(1.1)', color: '#f43f5e' },
            }}
          >
            {favorite ? <FavoriteIcon sx={{ fontSize: 24 }} /> : <FavoriteBorderIcon sx={{ fontSize: 24 }} />}
          </IconButton>
          <IconButton
            size="small"
            onClick={handleDownload}
            sx={{
              color: 'rgba(255,255,255,0.75)',
              transition: 'all 0.2s ease',
              '&:hover': { color: '#00e5ff', transform: 'scale(1.08)' },
            }}
          >
            <DownloadIcon sx={{ fontSize: 24 }} />
          </IconButton>
          <Tooltip title="Chia sẻ bài hát">
            <IconButton
              size="small"
              onClick={() => setShareOpen(true)}
              sx={{
                color: 'rgba(255,255,255,0.75)',
                transition: 'all 0.2s ease',
                '&:hover': { color: '#8c85ff', transform: 'scale(1.08)' },
              }}
            >
              <ShareIcon sx={{ fontSize: 22 }} />
            </IconButton>
          </Tooltip>
          <IconButton
            size="small"
            onClick={onToggleComments}
            sx={{
              color: commentsOpen ? '#6c63ff' : 'rgba(255,255,255,0.75)',
              mr: 0.5,
              transition: 'all 0.2s ease',
              '&:hover': { color: '#6c63ff', transform: 'scale(1.08)' },
            }}
          >
            <Badge
              badgeContent={commentCount || 0}
              color="primary"
              max={99}
              sx={{
                '& .MuiBadge-badge': {
                  fontSize: 10,
                  height: 16,
                  minWidth: 16,
                  bgcolor: '#6c63ff',
                },
              }}
            >
              <CommentIcon sx={{ fontSize: 24 }} />
            </Badge>
          </IconButton>

          {/* Hi-Res Lossless Quality Selector */}
          <Button
            size="small"
            onClick={handleQualityMenuOpen}
            disabled={isQualityLoading}
            sx={{
              color: '#fff',
              fontSize: '10.5px',
              fontWeight: 800,
              bgcolor: 'rgba(255,255,255,0.06)',
              borderRadius: '9999px',
              px: 1.5,
              py: 0.4,
              textTransform: 'none',
              letterSpacing: '0.4px',
              border: '1px solid rgba(255,255,255,0.15)',
              transition: 'all 0.2s ease',
              '&:hover': {
                bgcolor: 'rgba(255,255,255,0.12)',
                borderColor: '#00e5ff',
                boxShadow: '0 0 10px rgba(0, 229, 255, 0.3)',
              },
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              opacity: isQualityLoading ? 0.6 : 1,
            }}
          >
            {isQualityLoading ? (
              <>
                <CircularProgress size={12} sx={{ color: '#6c63ff' }} />
                <span>Đang chuyển...</span>
              </>
            ) : actualAudioQuality === 'hq' ? (
              <>
                <span style={{ color: '#ffd700' }}>LOSSLESS 320k</span>
                <PremiumIcon sx={{ fontSize: 13, color: '#ffd700' }} />
              </>
            ) : (
              <>
                <span style={{ color: '#00e5ff' }}>Hi-Fi 128k</span>
              </>
            )}
          </Button>
        </Stack>

        <Stack sx={{ flex: 1, minWidth: 0 }}>
          <Stack
            direction="row"
            justifyContent="center"
            alignItems="center"
            spacing={{ xs: 0.5, sm: 1, md: 1.2 }}
            sx={{ mb: 0.8 }}
          >
            <IconButton
              size="small"
              onClick={handleToggleShuffle}
              sx={{
                color: shuffle ? '#00e5ff' : 'rgba(255,255,255,0.65)',
                display: { xs: 'none', sm: 'inline-flex' },
                transition: 'all 0.2s ease',
                '&:hover': { color: '#00e5ff', transform: 'scale(1.1)' },
              }}
            >
              <ShuffleIcon sx={{ fontSize: 22 }} />
            </IconButton>
            <IconButton
              size="small"
              sx={{
                color: 'rgba(255,255,255,0.85)',
                transition: 'all 0.2s ease',
                '&:hover': { color: '#fff', transform: 'scale(1.1)' },
              }}
              onClick={handlePrevious}
            >
              <PrevIcon sx={{ fontSize: 25 }} />
            </IconButton>
            <IconButton
              size="small"
              onClick={togglePlay}
              sx={{
                color: '#fff',
                background: 'linear-gradient(135deg, #8c85ff 0%, #6c63ff 60%, #00e5ff 100%)',
                width: 42,
                height: 42,
                boxShadow: isPlaying
                  ? '0 0 20px rgba(108, 99, 255, 0.6), 0 0 40px rgba(0, 229, 255, 0.3)'
                  : '0 4px 14px rgba(108, 99, 255, 0.4)',
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                '&:hover': {
                  transform: 'scale(1.08)',
                  boxShadow: '0 0 25px rgba(108, 99, 255, 0.8)',
                },
                '&:active': {
                  transform: 'scale(0.96)',
                },
              }}
            >
              {isPlaying ? <PauseIcon sx={{ fontSize: 26 }} /> : <PlayIcon sx={{ fontSize: 26, ml: 0.2 }} />}
            </IconButton>
            <IconButton
              size="small"
              sx={{
                color: 'rgba(255,255,255,0.85)',
                transition: 'all 0.2s ease',
                '&:hover': { color: '#fff', transform: 'scale(1.1)' },
              }}
              onClick={handleNext}
            >
              <NextIcon sx={{ fontSize: 25 }} />
            </IconButton>
            <IconButton
              size="small"
              onClick={handleCycleRepeat}
              sx={{
                color: repeatMode !== 'off' ? '#00e5ff' : 'rgba(255,255,255,0.65)',
                display: { xs: 'none', sm: 'inline-flex' },
                transition: 'all 0.2s ease',
                '&:hover': { color: '#00e5ff', transform: 'scale(1.1)' },
              }}
            >
              {repeatMode === 'one' ? <RepeatOneIcon sx={{ fontSize: 22 }} /> : <RepeatIcon sx={{ fontSize: 22 }} />}
            </IconButton>
            <IconButton
              size="small"
              onClick={handleToggleAutoplay}
              sx={{
                color: autoplay ? '#00e5ff' : 'rgba(255,255,255,0.65)',
                display: { xs: 'none', sm: 'inline-flex' },
                transition: 'all 0.2s ease',
                '&:hover': { color: '#00e5ff', transform: 'scale(1.1)' },
              }}
            >
              <AutoplayIcon sx={{ fontSize: 22 }} />
            </IconButton>
          </Stack>

          <Slider
            size="small"
            min={0}
            max={displayDuration || 1}
            value={Math.min(scrubTime ?? currentTime, displayDuration || 1)}
            onChange={(_, value) => setScrubTime(Number(value))}
            onChangeCommitted={(_, value) => {
              seekTo(value);
              setScrubTime(null);
            }}
            sx={{
              color: '#6c63ff',
              py: 0,
              mt: 0.2,
              height: 4,
              '& .MuiSlider-thumb': {
                width: 10,
                height: 10,
                transition: '0.2s ease',
                '&:before': { boxShadow: '0 2px 6px rgba(0,0,0,0.4)' },
                '&:hover, &.Mui-focusVisible, &.Mui-active': {
                  boxShadow: '0 0 0 8px rgba(108, 99, 255, 0.2)',
                  width: 12,
                  height: 12,
                },
              },
              '& .MuiSlider-rail': {
                opacity: 0.2,
                bgcolor: '#fff',
              },
              '& .MuiSlider-track': {
                backgroundImage: 'linear-gradient(90deg, #6c63ff, #00bcd4)',
              },
            }}
          />
        </Stack>
      </Stack>

      <Menu
        anchorEl={qualityAnchorEl}
        open={Boolean(qualityAnchorEl)}
        onClose={handleQualityMenuClose}
        PaperProps={{
          sx: {
            bgcolor: '#0f172a',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)',
            color: '#fff',
            borderRadius: 2,
            minWidth: 200,
            mt: -1,
          }
        }}
      >
        <MenuItem
          onClick={() => handleSelectQuality('std')}
          selected={audioQuality === 'std'}
          sx={{
            fontSize: '13px',
            py: 1,
            '&.Mui-selected': {
              bgcolor: 'rgba(108, 99, 255, 0.18)',
              color: '#8c85ff',
              '&:hover': {
                bgcolor: 'rgba(108, 99, 255, 0.28)',
              }
            },
            '&:hover': {
              bgcolor: 'rgba(255, 255, 255, 0.05)',
            }
          }}
        >
          <ListItemText 
            primary="Standard 128kbps" 
            primaryTypographyProps={{ fontSize: '13px', fontWeight: audioQuality === 'std' ? 700 : 500 }} 
          />
        </MenuItem>
        
        <Tooltip 
          title={!isHQAvailable ? "Bài hát này chỉ hỗ trợ chất lượng Standard." : ""} 
          arrow 
          placement="left"
        >
          <span>
            <MenuItem
              onClick={() => handleSelectQuality('hq')}
              selected={audioQuality === 'hq'}
              disabled={!isHQAvailable}
              sx={{
                fontSize: '13px',
                py: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                '&.Mui-selected': {
                  bgcolor: 'rgba(108, 99, 255, 0.18)',
                  color: '#8c85ff',
                  '&:hover': {
                    bgcolor: 'rgba(108, 99, 255, 0.28)',
                  }
                },
                '&:hover': {
                  bgcolor: 'rgba(255, 255, 255, 0.05)',
                }
              }}
            >
              <Stack direction="row" alignItems="center" spacing={1} sx={{ width: '100%' }}>
                <ListItemText 
                  primary="HQ 320kbps" 
                  secondary={!isHQAvailable ? "Nguồn gốc Standard" : null}
                  primaryTypographyProps={{ fontSize: '13px', fontWeight: audioQuality === 'hq' ? 700 : 500 }} 
                  secondaryTypographyProps={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)' }}
                />
                {isHQAvailable && (
                  <PremiumIcon sx={{ fontSize: 16, color: '#ffd700', ml: 'auto' }} />
                )}
              </Stack>
            </MenuItem>
          </span>
        </Tooltip>
      </Menu>

      <Dialog
        open={premiumDialogOpen}
        onClose={() => setPremiumDialogOpen(false)}
        PaperProps={{
          sx: {
            bgcolor: '#0f172a',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            backgroundImage: 'linear-gradient(135deg, rgba(108, 99, 255, 0.15) 0%, rgba(15, 23, 42, 0.95) 100%)',
            boxShadow: '0 20px 45px rgba(0, 0, 0, 0.65)',
            color: '#fff',
            borderRadius: 3.5,
            maxWidth: 400,
            p: 1.5,
          }
        }}
      >
        <DialogTitle sx={{ textAlign: 'center', fontWeight: 800, fontSize: '20px', color: '#ffd700', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
          <PremiumIcon sx={{ fontSize: 45, color: '#ffd700' }} />
          Trải nghiệm Âm thanh HQ 320kbps
        </DialogTitle>
        <DialogContent sx={{ textAlign: 'center', py: 1 }}>
          <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.85)', lineHeight: 1.6 }}>
            Chất lượng âm thanh trung thực cao **HQ 320kbps** chỉ dành riêng cho thành viên Premium. Hãy nâng cấp ngay để tận hưởng âm nhạc không giới hạn!
          </Typography>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', gap: 1.5, pb: 2, px: 2 }}>
          <Button 
            onClick={() => setPremiumDialogOpen(false)}
            sx={{ 
              color: 'rgba(255,255,255,0.7)', 
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '13px'
            }}
          >
            Để sau
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              setPremiumDialogOpen(false);
              navigate('/premium');
            }}
            sx={{
              bgcolor: '#6c63ff',
              backgroundImage: 'linear-gradient(135deg, #8c85ff 0%, #6c63ff 100%)',
              color: '#fff',
              fontWeight: 700,
              fontSize: '13px',
              px: 3,
              borderRadius: '20px',
              textTransform: 'none',
              boxShadow: '0 4px 14px rgba(108, 99, 255, 0.4)',
              '&:hover': {
                bgcolor: '#5246e2',
                boxShadow: '0 6px 20px rgba(108, 99, 255, 0.6)',
              }
            }}
          >
            Nâng cấp Premium
          </Button>
        </DialogActions>
      </Dialog>

      <ShareSongModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        song={currentSong}
      />
    </Box>

  );
}

export default ClientNowPlayingBar;
