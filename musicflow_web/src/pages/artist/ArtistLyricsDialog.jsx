import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  Paper,
  Slider,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  Close as CloseIcon,
  PlayArrowRounded as PlayIcon,
  PauseRounded as PauseIcon,
  UploadFileRounded as UploadFileIcon,
  CheckCircleRounded as CheckCircleIcon,
  WarningRounded as WarningIcon,
  DraftsRounded as DraftIcon,
  PublicRounded as PublicIcon,
  VisibilityOffRounded as UnpublishIcon,
  SaveRounded as SaveIcon,
  PublishRounded as PublishIcon,
  MusicNoteRounded as MusicNoteIcon,
  FormatAlignLeftRounded as PlainTextIcon,
  TimerRounded as SyncedIcon,
} from '@mui/icons-material';
import { artistApi } from '../../services/artist/artist.service';
import { parseLyrics, findActiveLyricIndex } from '../../utils/lyrics';
import useAppToast from '../../components/common/useAppToast';

function formatTime(seconds) {
  const total = Math.max(0, Number(seconds) || 0);
  const mins = Math.floor(total / 60);
  const secs = Math.floor(total % 60);
  const frac = Math.floor((total % 1) * 10);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${frac}`;
}

export default function ArtistLyricsDialog({ open, onClose, song, onUpdated }) {
  const { showToast } = useAppToast();

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [lyricsData, setLyricsData] = useState(null);

  // Form State
  const [tabIndex, setTabIndex] = useState(0); // 0: Plain, 1: Synced LRC
  const [plainText, setPlainText] = useState('');
  const [lrcText, setLrcText] = useState('');
  const fileInputRef = useRef(null);

  // Audio Preview Player State
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const lyricsListRef = useRef(null);

  // Load lyrics data when dialog opens
  const fetchLyrics = useCallback(async () => {
    if (!song?._id) return;
    try {
      setLoading(true);
      const res = await artistApi.getSongLyrics(song._id);
      const data = res.data?.data || {};
      setLyricsData(data);

      setPlainText(data.plainLyrics || data.publishedPlainLyrics || '');
      setLrcText(data.lrcData || data.publishedLrcData || '');
      setTabIndex(data.lyricsType === 'synced' ? 1 : 0);
    } catch (err) {
      showToast({
        severity: 'error',
        title: 'Lỗi tải lời bài hát',
        message: err.response?.data?.message || 'Không thể tải thông tin lời bài hát',
      });
    } finally {
      setLoading(false);
    }
  }, [song?._id, showToast]);

  useEffect(() => {
    if (open && song?._id) {
      fetchLyrics();
      setIsPlaying(false);
      setCurrentTime(0);
    }
  }, [open, song?._id, fetchLyrics]);

  // Audio Event Listeners
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration || song?.duration || 0);
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const handleSeek = (_, value) => {
    if (audioRef.current) {
      audioRef.current.currentTime = value;
      setCurrentTime(value);
    }
  };

  // Realtime Parse LRC for live preview
  const parsedLrc = useMemo(() => {
    return parseLyrics(lrcText);
  }, [lrcText]);

  // Active lyric index for karaoke highlight
  const activeIndex = useMemo(() => {
    if (tabIndex === 1 && parsedLrc.isSynced) {
      return findActiveLyricIndex(parsedLrc.lines, currentTime);
    }
    return -1;
  }, [tabIndex, parsedLrc, currentTime]);

  // Auto-scroll active lyric line into view
  useEffect(() => {
    if (activeIndex >= 0 && lyricsListRef.current) {
      const activeElement = lyricsListRef.current.querySelector(`[data-line-index="${activeIndex}"]`);
      if (activeElement) {
        activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [activeIndex]);

  // Handle .lrc file upload
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.lrc') && !file.name.endsWith('.txt')) {
      showToast({
        severity: 'warning',
        title: 'Định dạng file',
        message: 'Vui lòng chọn file có định dạng .lrc hoặc .txt',
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result || '';
      setLrcText(content);
      setTabIndex(1);
      showToast({
        severity: 'success',
        title: 'Đã tải file LRC',
        message: `Đã đọc thành công nội dung file "${file.name}"`,
      });
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  };

  // Save Draft
  const handleSaveDraft = async () => {
    try {
      setActionLoading(true);
      const payload = {
        lyricsType: tabIndex === 1 ? 'synced' : 'plain',
        plainLyrics: plainText,
        lrcData: lrcText,
      };

      const res = await artistApi.saveDraftLyrics(song._id, payload);
      showToast({
        severity: 'success',
        title: 'Đã lưu bản nháp',
        message: res.data?.message || 'Bản nháp lời bài hát đã được lưu an toàn.',
      });

      if (res.data?.data?.warnings?.length > 0) {
        showToast({
          severity: 'warning',
          title: 'Cảnh báo đồng bộ',
          message: res.data.data.warnings[0],
        });
      }

      fetchLyrics();
      if (onUpdated) onUpdated();
    } catch (err) {
      showToast({
        severity: 'error',
        title: 'Lưu thất bại',
        message: err.response?.data?.message || 'Không thể lưu bản nháp',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Publish
  const handlePublish = async () => {
    try {
      setActionLoading(true);
      const payload = {
        lyricsType: tabIndex === 1 ? 'synced' : 'plain',
        plainLyrics: plainText,
        lrcData: lrcText,
      };

      const res = await artistApi.publishLyrics(song._id, payload);
      showToast({
        severity: 'success',
        title: 'Xuất bản thành công',
        message: res.data?.message || 'Lời bài hát đã được xuất bản tới người nghe!',
      });

      if (res.data?.data?.warnings?.length > 0) {
        showToast({
          severity: 'warning',
          title: 'Lưu ý đồng bộ',
          message: res.data.data.warnings[0],
        });
      }

      fetchLyrics();
      if (onUpdated) onUpdated();
    } catch (err) {
      showToast({
        severity: 'error',
        title: 'Xuất bản thất bại',
        message: err.response?.data?.message || 'Lỗi xuất bản lời bài hát',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Unpublish
  const handleUnpublish = async () => {
    try {
      setActionLoading(true);
      const res = await artistApi.unpublishLyrics(song._id);
      showToast({
        severity: 'info',
        title: 'Đã hủy xuất bản',
        message: res.data?.message || 'Đã ẩn lời bài hát khỏi người nghe. Bản nháp của bạn vẫn được giữ nguyên.',
      });
      fetchLyrics();
      if (onUpdated) onUpdated();
    } catch (err) {
      showToast({
        severity: 'error',
        title: 'Lỗi hủy xuất bản',
        message: err.response?.data?.message || 'Không thể hủy xuất bản',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const statusLabel = useMemo(() => {
    if (!lyricsData || lyricsData.status === 'not_added') {
      return { label: 'Chưa có lời', color: 'default', icon: <MusicNoteIcon sx={{ fontSize: 16 }} /> };
    }
    if (lyricsData.status === 'draft') {
      return { label: 'Bản nháp (Draft)', color: 'warning', icon: <DraftIcon sx={{ fontSize: 16 }} /> };
    }
    return { label: 'Đã xuất bản (Published)', color: 'success', icon: <PublicIcon sx={{ fontSize: 16 }} /> };
  }, [lyricsData]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 4,
          bgcolor: 'background.paper',
          backgroundImage: 'none',
          boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
        },
      }}
    >
      {/* Hidden Audio Element for preview synchronization */}
      {song?.audioUrl && (
        <audio
          ref={audioRef}
          src={song.audioUrl}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={() => setIsPlaying(false)}
        />
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━ 👑 HEADER ━━━━━━━━━━━━━━━━━━━━ */}
      <DialogTitle sx={{ p: 3, pb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 0.5 }}>
            <Typography variant="h5" fontWeight={900}>
              Quản Lý Lời Bài Hát (Lyrics & LRC)
            </Typography>
            <Chip
              icon={statusLabel.icon}
              label={statusLabel.label}
              color={statusLabel.color}
              size="small"
              sx={{ fontWeight: 800, fontSize: 11.5 }}
            />
          </Stack>
          <Typography variant="body2" color="text.secondary" fontWeight={600}>
            {song?.title} • Thời lượng: {formatTime(song?.duration || duration)}
          </Typography>
        </Box>
        <IconButton onClick={onClose} sx={{ color: 'text.secondary' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <Divider />

      <DialogContent sx={{ p: 3 }}>
        {loading ? (
          <Box sx={{ py: 12, display: 'grid', placeItems: 'center' }}>
            <CircularProgress sx={{ color: '#6c63ff' }} />
          </Box>
        ) : (
          <Grid container spacing={3}>
            {/* ━━━━━━━━━━━━━━━━━━━━ 📝 LEFT COLUMN: EDITORS ━━━━━━━━━━━━━━━━━━━━ */}
            <Grid size={{ xs: 12, md: 7 }}>
              <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, bgcolor: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                {/* Mode Tabs */}
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                  <Tabs
                    value={tabIndex}
                    onChange={(_, val) => setTabIndex(val)}
                    sx={{
                      minHeight: 40,
                      '& .MuiTab-root': {
                        minHeight: 40,
                        py: 0.5,
                        px: 2,
                        borderRadius: 2,
                        fontWeight: 800,
                        textTransform: 'none',
                        fontSize: 13,
                      },
                    }}
                  >
                    <Tab icon={<PlainTextIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Lời Thường (Plain)" />
                    <Tab icon={<SyncedIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Lời Đồng Bộ (LRC Synced)" />
                  </Tabs>

                  {tabIndex === 1 && (
                    <>
                      <input
                        type="file"
                        accept=".lrc,.txt"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        onChange={handleFileUpload}
                      />
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<UploadFileIcon />}
                        onClick={() => fileInputRef.current?.click()}
                        sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 750, fontSize: 12 }}
                      >
                        Upload file .lrc
                      </Button>
                    </>
                  )}
                </Stack>

                {/* Tab 0: Plain Lyrics Editor */}
                {tabIndex === 0 && (
                  <Box>
                    <TextField
                      fullWidth
                      multiline
                      minRows={14}
                      maxRows={18}
                      placeholder="Nhập lời bài hát dạng văn bản thường tại đây...&#10;&#10;[Verse 1]&#10;Từng dòng người vội vã qua nhanh...&#10;[Chorus]&#10;Để lại nỗi nhớ trong anh..."
                      value={plainText}
                      onChange={(e) => setPlainText(e.target.value)}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          fontFamily: 'monospace',
                          fontSize: 13.5,
                          lineHeight: 1.6,
                          borderRadius: 2.5,
                        },
                      }}
                    />
                    <Stack direction="row" justifyContent="space-between" sx={{ mt: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        Định dạng: Đoạn, điệp khúc, lời văn bản tự do.
                      </Typography>
                      <Typography variant="caption" color="text.secondary" fontWeight={700}>
                        {plainText.length} ký tự
                      </Typography>
                    </Stack>
                  </Box>
                )}

                {/* Tab 1: Synced LRC Editor */}
                {tabIndex === 1 && (
                  <Box>
                    <TextField
                      fullWidth
                      multiline
                      minRows={14}
                      maxRows={18}
                      placeholder="[00:12.50] Dòng lời đầu tiên bắt đầu&#10;[00:16.80] Dòng lời tiếp theo theo giai điệu&#10;[00:22.00] Điệp khúc vang lên..."
                      value={lrcText}
                      onChange={(e) => setLrcText(e.target.value)}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          fontFamily: 'monospace',
                          fontSize: 13.5,
                          lineHeight: 1.6,
                          borderRadius: 2.5,
                        },
                      }}
                    />
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1 }}>
                      <Typography variant="caption" color={parsedLrc.isSynced ? 'success.main' : 'text.secondary'} fontWeight={700}>
                        {parsedLrc.isSynced
                          ? `✓ Đã nhận diện ${parsedLrc.lines.length} câu hát đồng bộ`
                          : '⚠️ Chưa tìm thấy timestamp [mm:ss.xx]'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" fontWeight={700}>
                        {lrcText.length} ký tự
                      </Typography>
                    </Stack>
                  </Box>
                )}
              </Paper>
            </Grid>

            {/* ━━━━━━━━━━━━━━━━━━━━ 🎧 RIGHT COLUMN: AUDIO PREVIEW PLAYER & KARAOKE SYNC ━━━━━━━━━━━━━━━━━━━━ */}
            <Grid size={{ xs: 12, md: 5 }}>
              <Paper
                elevation={0}
                sx={{
                  p: 2.5,
                  borderRadius: 3,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  bgcolor: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <Typography variant="subtitle1" fontWeight={850} sx={{ mb: 1.5 }}>
                  Studio Audio Sync Previewer
                </Typography>

                {/* Mini Player Controls */}
                <Box sx={{ p: 2, borderRadius: 2.5, bgcolor: 'rgba(108, 99, 255, 0.08)', border: '1px solid rgba(108, 99, 255, 0.2)', mb: 2 }}>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <IconButton
                      onClick={togglePlay}
                      sx={{
                        bgcolor: '#6c63ff',
                        color: '#fff',
                        '&:hover': { bgcolor: '#534bae' },
                      }}
                    >
                      {isPlaying ? <PauseIcon /> : <PlayIcon />}
                    </IconButton>
                    <Box sx={{ flex: 1 }}>
                      <Slider
                        size="small"
                        min={0}
                        max={duration || song?.duration || 100}
                        value={currentTime}
                        onChange={handleSeek}
                        sx={{ color: '#6c63ff', py: 0.5 }}
                      />
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="caption" fontWeight={750} color="#00bcd4">
                          {formatTime(currentTime)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" fontWeight={750}>
                          {formatTime(duration || song?.duration || 0)}
                        </Typography>
                      </Stack>
                    </Box>
                  </Stack>
                </Box>

                {/* Live Synced Lyrics Karaoke List */}
                <Typography variant="caption" fontWeight={800} color="text.secondary" sx={{ mb: 1, textTransform: 'uppercase' }}>
                  {tabIndex === 1 ? 'Khung xem trước đồng bộ (Karaoke Sync):' : 'Bản xem trước văn bản:'}
                </Typography>

                <Box
                  ref={lyricsListRef}
                  sx={{
                    flex: 1,
                    maxHeight: 310,
                    overflowY: 'auto',
                    pr: 1,
                    borderRadius: 2,
                    bgcolor: 'rgba(0, 0, 0, 0.2)',
                    p: 1.5,
                  }}
                >
                  {tabIndex === 1 ? (
                    parsedLrc.lines.length === 0 ? (
                      <Box sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}>
                        <Typography variant="body2" fontWeight={600}>
                          Chưa có câu hát đồng bộ nào để xem trước. Hãy dán nội dung LRC hoặc upload file .lrc ở bên trái!
                        </Typography>
                      </Box>
                    ) : (
                      <Stack spacing={1}>
                        {parsedLrc.lines.map((line, idx) => {
                          const isActive = idx === activeIndex;
                          return (
                            <Box
                              key={idx}
                              data-line-index={idx}
                              onClick={() => {
                                if (audioRef.current) {
                                  audioRef.current.currentTime = line.time;
                                  setCurrentTime(line.time);
                                }
                              }}
                              sx={{
                                p: 1.25,
                                borderRadius: 2,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                bgcolor: isActive ? 'rgba(0, 229, 255, 0.15)' : 'transparent',
                                border: isActive ? '1px solid #00bcd4' : '1px solid transparent',
                                transform: isActive ? 'scale(1.02)' : 'none',
                                '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.05)' },
                              }}
                            >
                              <Stack direction="row" spacing={1.5} alignItems="center">
                                <Chip
                                  label={formatTime(line.time)}
                                  size="small"
                                  sx={{
                                    fontSize: 10.5,
                                    fontWeight: 800,
                                    height: 20,
                                    bgcolor: isActive ? '#00bcd4' : 'rgba(255, 255, 255, 0.06)',
                                    color: isActive ? '#000' : 'text.secondary',
                                  }}
                                />
                                <Typography
                                  variant="body2"
                                  fontWeight={isActive ? 850 : 600}
                                  sx={{
                                    color: isActive ? '#00e5ff' : 'text.primary',
                                  }}
                                >
                                  {line.text}
                                </Typography>
                              </Stack>
                            </Box>
                          );
                        })}
                      </Stack>
                    )
                  ) : (
                    <Typography
                      variant="body2"
                      sx={{
                        whiteSpace: 'pre-line',
                        lineHeight: 1.8,
                        color: 'text.secondary',
                        fontSize: 13.5,
                      }}
                    >
                      {plainText || 'Chưa có nội dung lời bài hát...'}
                    </Typography>
                  )}
                </Box>
              </Paper>
            </Grid>
          </Grid>
        )}
      </DialogContent>

      <Divider />

      {/* ━━━━━━━━━━━━━━━━━━━━ 🔘 DIALOG ACTIONS ━━━━━━━━━━━━━━━━━━━━ */}
      <DialogActions sx={{ p: 2.5, px: 3, justifyContent: 'space-between' }}>
        <Box>
          {lyricsData?.status === 'published' && (
            <Button
              color="error"
              variant="outlined"
              startIcon={<UnpublishIcon />}
              onClick={handleUnpublish}
              disabled={actionLoading}
              sx={{ borderRadius: 2.5, textTransform: 'none', fontWeight: 750 }}
            >
              Hủy Xuất Bản (Unpublish)
            </Button>
          )}
        </Box>

        <Stack direction="row" spacing={1.5}>
          <Button onClick={onClose} sx={{ borderRadius: 2.5, textTransform: 'none', fontWeight: 750 }}>
            Đóng
          </Button>

          <Button
            variant="outlined"
            startIcon={<SaveIcon />}
            onClick={handleSaveDraft}
            disabled={actionLoading}
            sx={{ borderRadius: 2.5, textTransform: 'none', fontWeight: 750 }}
          >
            Lưu Bản Nháp (Draft)
          </Button>

          <Button
            variant="contained"
            startIcon={<PublishIcon />}
            onClick={handlePublish}
            disabled={actionLoading}
            sx={{
              borderRadius: 2.5,
              textTransform: 'none',
              fontWeight: 800,
              bgcolor: '#6c63ff',
              '&:hover': { bgcolor: '#534bae' },
            }}
          >
            Xuất Bản (Publish)
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}
