import { useEffect, useState } from 'react';
import { Avatar, Box, IconButton, Slider, Stack, Typography, Menu, MenuItem, ListItemText, Dialog, DialogTitle, DialogContent, DialogActions, Button, CircularProgress, Tooltip } from '@mui/material';
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
import { useClientPlayer } from './ClientPlayerProvider';
import { clientFavoritesApi, clientSongsApi, clientCommentsApi } from '../../../services/client/client.service';
import useAppToast from '../../../components/common/useAppToast';
import { useNavigate } from 'react-router-dom';

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
                {formatDuration(displayDuration)}
              </Typography>
            </Stack>
          </Box>
        </Stack>

        <Stack direction="row" alignItems="center" spacing={0.8} sx={{ display: { xs: 'none', md: 'flex' } }}>
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
              mr: 0.5,
            }}
          >
            <CommentIcon sx={{ fontSize: 25 }} />
          </IconButton>

          {/* Quality Selector */}
          <Button
            size="small"
            onClick={handleQualityMenuOpen}
            disabled={isQualityLoading}
            sx={{
              color: '#fff',
              fontSize: '11px',
              fontWeight: 700,
              bgcolor: 'rgba(255,255,255,0.08)',
              borderRadius: '12px',
              px: 1.25,
              py: 0.4,
              textTransform: 'none',
              border: '1px solid rgba(255,255,255,0.15)',
              '&:hover': {
                bgcolor: 'rgba(255,255,255,0.16)',
              },
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              opacity: isQualityLoading ? 0.6 : 1,
            }}
          >
            {isQualityLoading ? (
              <>
                <CircularProgress size={12} sx={{ color: '#14b8a6' }} />
                <span>Đang chuyển...</span>
              </>
            ) : actualAudioQuality === 'hq' ? (
              <>
                <span style={{ color: '#ffd700' }}>HQ 320k</span>
                <PremiumIcon sx={{ fontSize: 13, color: '#ffd700' }} />
              </>
            ) : (
              <>
                <span style={{ color: '#5eead4' }}>Standard</span>
              </>
            )}
          </Button>
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
            <IconButton
              size="small"
              onClick={handleToggleAutoplay}
              sx={{ color: autoplay ? '#5eead4' : 'rgba(255,255,255,0.68)', display: { xs: 'none', sm: 'inline-flex' } }}
            >
              <AutoplayIcon sx={{ fontSize: 25 }} />
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
              bgcolor: 'rgba(20, 184, 166, 0.15)',
              color: '#5eead4',
              '&:hover': {
                bgcolor: 'rgba(20, 184, 166, 0.25)',
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
                  bgcolor: 'rgba(20, 184, 166, 0.15)',
                  color: '#5eead4',
                  '&:hover': {
                    bgcolor: 'rgba(20, 184, 166, 0.25)',
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
            backgroundImage: 'linear-gradient(135deg, rgba(8, 47, 73, 0.5) 0%, rgba(15, 23, 42, 0.8) 100%)',
            boxShadow: '0 20px 45px rgba(0, 0, 0, 0.65)',
            color: '#fff',
            borderRadius: 3,
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
              navigate('/client/premium');
            }}
            sx={{
              bgcolor: '#14b8a6',
              backgroundImage: 'linear-gradient(to right, #14b8a6, #0d9488)',
              color: '#fff',
              fontWeight: 700,
              fontSize: '13px',
              px: 3,
              borderRadius: '20px',
              textTransform: 'none',
              boxShadow: '0 4px 14px rgba(20, 184, 166, 0.4)',
              '&:hover': {
                bgcolor: '#0f766e',
                boxShadow: '0 6px 20px rgba(20, 184, 166, 0.6)',
              }
            }}
          >
            Nâng cấp Premium
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default ClientNowPlayingBar;
