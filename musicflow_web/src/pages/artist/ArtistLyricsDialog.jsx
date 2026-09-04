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
  LinearProgress,
  Paper,
  Slider,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
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
  AutoAwesomeRounded as AiIcon,
  RefreshRounded as RefreshIcon,
  DeleteOutlineRounded as DeleteIcon,
} from '@mui/icons-material';
import { artistApi } from '../../services/artist/artist.service';
import { parseLyrics, findActiveLyricIndex, findActiveWordIndex } from '../../utils/lyrics';
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
  const [actionLoading, setActionLoading] = useState(null);
  const [lyricsData, setLyricsData] = useState(null);

  // Form State
  const [tabIndex, setTabIndex] = useState(0); // 0: Plain, 1: Synced LRC
  const [plainText, setPlainText] = useState('');
  const [lrcText, setLrcText] = useState('');
  const fileInputRef = useRef(null);

  // AI Alignment State Machine
  // alignmentState: 'IDLE' | 'PROCESSING' | 'SUCCEEDED' | 'WARNING' | 'FAILED'
  const [alignmentState, setAlignmentState] = useState('IDLE');
  const [alignmentJob, setAlignmentJob] = useState(null);
  const [aiResultAvailable, setAiResultAvailable] = useState(null);
  const [draftConflictNote, setDraftConflictNote] = useState(null);
  const pollingRef = useRef(null);
  const isMountedRef = useRef(true);

  // Audio Preview Player State
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [previewLyricsMode, setPreviewLyricsMode] = useState('line');
  const lyricsListRef = useRef(null);

  // Cleanup polling timer
  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  // Polling implementation for AI alignment status
  const startPolling = useCallback(
    (songId) => {
      stopPolling();
      let pollCount = 0;
      const MAX_POLL_CYCLES = 60; // Max 4 minutes

      const poll = async () => {
        if (!isMountedRef.current) return;
        pollCount++;

        if (pollCount > MAX_POLL_CYCLES) {
          stopPolling();
          setAlignmentState('FAILED');
          showToast({
            severity: 'error',
            title: 'Hết thời gian chờ AI',
            message: 'Tác vụ AI căn nhịp mất nhiều thời gian hơn dự kiến hoặc Worker AI chưa sẵn sàng. Vui lòng thử lại sau.',
          });
          return;
        }

        try {
          const res = await artistApi.getLyricsAlignmentStatus(songId);
          const job = res.data?.data;
          if (!job || !job.hasJob) return;

          setAlignmentJob(job);

          if (job.status === 'succeeded') {
            stopPolling();
            const hasWarning = job.qualityStatus === 'WARNING';
            setAlignmentState(hasWarning ? 'WARNING' : 'SUCCEEDED');

            // Check if draft was modified during alignment
            const isOccConflict = job.qualityNotes?.some((n) =>
              n.includes('DRAFT_MODIFIED_DURING_ALIGNMENT')
            );

            if (isOccConflict) {
              setDraftConflictNote('Bản nháp của bạn đã được chỉnh sửa gần đây. Kết quả AI được lưu an toàn và chưa ghi đè.');
              if (job.result) {
                setAiResultAvailable(job.result);
              }
            } else {
              // Apply result to editor
              if (job.result?.lrcData) {
                setLrcText(job.result.lrcData);
              }
              setTabIndex(1);
              showToast({
                severity: hasWarning ? 'warning' : 'success',
                title: hasWarning ? 'AI căn nhịp hoàn thành (Có lưu ý)' : 'AI căn nhịp thành công',
                message: hasWarning
                  ? (job.qualityNotes?.[0] || 'Vui lòng kiểm tra lại các mốc thời gian.')
                  : 'Đã hoàn tất tạo nhịp tự động cho từng dòng và từng từ!',
              });
            }

            // Refresh draft metadata from server
            const freshRes = await artistApi.getSongLyrics(songId);
            if (freshRes.data?.data) {
              setLyricsData(freshRes.data.data);
            }
            if (onUpdated) onUpdated();
          } else if (job.status === 'failed') {
            stopPolling();
            setAlignmentState('FAILED');
            showToast({
              severity: 'error',
              title: 'AI căn nhịp thất bại',
              message: job.errorMessage || 'Không thể căn nhịp bài hát tự động.',
            });
          }
        } catch {
          // Polling errors handled gracefully
        }
      };

      // Run initial check after 2s, then interval 4s
      setTimeout(poll, 2000);
      pollingRef.current = setInterval(poll, 4000);
    },
    [stopPolling, showToast, onUpdated]
  );

  // Fetch lyrics & alignment status when dialog opens
  const fetchLyrics = useCallback(async (isSilent = false) => {
    if (!song?._id) return;
    try {
      if (!isSilent) setLoading(true);
      const res = await artistApi.getSongLyrics(song._id);
      const data = res.data?.data || {};
      setLyricsData(data);

      if (!isSilent) {
        setPlainText(data.plainLyrics || data.publishedPlainLyrics || '');
        setLrcText(data.lrcData || data.publishedLrcData || '');
        setTabIndex(data.lyricsType === 'synced' ? 1 : 0);
      }

      // Check existing alignment job status
      try {
        const jobRes = await artistApi.getLyricsAlignmentStatus(song._id);
        const jobData = jobRes.data?.data;
        if (jobData && jobData.hasJob) {
          setAlignmentJob(jobData);
          if (jobData.status === 'processing') {
            setAlignmentState('PROCESSING');
            startPolling(song._id);
          } else if (
            jobData.status === 'succeeded' &&
            data.lyricsType === 'synced' &&
            data.syncSource === 'ai_alignment' &&
            data.lrcData
          ) {
            const hasWarning = jobData.qualityStatus === 'WARNING';
            setAlignmentState(hasWarning ? 'WARNING' : 'SUCCEEDED');
            // Check for OCC conflict notice
            const isOccConflict = jobData.qualityNotes?.some((n) =>
              n.includes('DRAFT_MODIFIED_DURING_ALIGNMENT')
            );
            if (isOccConflict) {
              setDraftConflictNote('Bản nháp đã được chỉnh sửa trong lúc AI xử lý. Kết quả AI được lưu an toàn.');
              if (jobData.result) {
                setAiResultAvailable(jobData.result);
              }
            }
          } else {
            setAlignmentState('IDLE');
          }
        } else {
          setAlignmentState('IDLE');
        }
      } catch {
        setAlignmentState('IDLE');
      }
    } catch (err) {
      showToast({
        severity: 'error',
        title: 'Lỗi tải lời bài hát',
        message: err.response?.data?.message || 'Không thể tải thông tin lời bài hát',
      });
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [song?._id, showToast, startPolling]);

  // Trigger AI Alignment
  const handleTriggerAiAlignment = async (options = {}) => {
    if (!song?._id) return;
    if (!plainText || plainText.trim().length < 10) {
      showToast({
        severity: 'warning',
        title: 'Lời bài hát chưa đủ',
        message: 'Vui lòng nhập ít nhất 10 ký tự lời bài hát thường (Plain Lyrics) trước khi tạo nhịp AI.',
      });
      return;
    }

    try {
      setActionLoading(true);
      setAlignmentState('PROCESSING');
      setDraftConflictNote(null);
      setAiResultAvailable(null);

      // Auto-save current plain text draft before triggering alignment
      await artistApi.saveDraftLyrics(song._id, {
        lyricsType: 'plain',
        plainLyrics: plainText,
        lrcData: lrcText,
      });

      const isForce = options?.forceRealign !== false; // Default to true so artist trigger always performs fresh alignment

      const res = await artistApi.triggerLyricsAlignment(song._id, {
        forceRealign: isForce,
      });
      const data = res.data?.data || {};

      if (data.isCached && !isForce) {
        // Cached Result Hit (HTTP 200)
        if (data.result?.lrcData) {
          setLrcText(data.result.lrcData);
        }
        setAlignmentState('SUCCEEDED');
        showToast({
          severity: 'info',
          title: 'Kết quả từ bộ nhớ đệm',
          message: 'Đã nạp nhanh kết quả AI căn nhịp trước đó với cùng nội dung.',
        });
        await fetchLyrics();
        setTabIndex(1);
      } else {
        // Pending Job Created (HTTP 202)
        setAlignmentState('PROCESSING');
        showToast({
          severity: 'info',
          title: 'Đang tạo nhịp AI',
          message: 'Hệ thống đang tiến hành bóc tách giọng hát và căn nhịp bằng Neural CTC...',
        });
        startPolling(song._id);
      }
    } catch (err) {
      setAlignmentState('FAILED');
      const msg = err.response?.data?.message || 'Không thể bắt đầu tác vụ AI căn nhịp.';
      showToast({
        severity: 'error',
        title: 'Lỗi kích hoạt AI',
        message: msg,
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Clear all lyrics completely (Both Plain & Synced) to start from blank
  const handleClearAllLyrics = async () => {
    try {
      setActionLoading('clear');
      setPlainText('');
      setLrcText('');
      setTabIndex(0);
      setAlignmentState('IDLE');
      setAlignmentJob(null);
      setAiResultAvailable(null);
      setDraftConflictNote(null);

      await artistApi.saveDraftLyrics(song._id, {
        lyricsType: 'plain',
        plainLyrics: '',
        lrcData: '',
      });

      await fetchLyrics(true);

      showToast({
        severity: 'info',
        title: 'Đã xóa sạch lời bài hát',
        message: 'Đã xóa toàn bộ bản nháp lời. Bạn có thể bấm "Tự nghe & nhận diện lời" để AI tự động làm tất cả!',
      });
      if (onUpdated) onUpdated();
    } catch {
      showToast({
        severity: 'error',
        title: 'Lỗi',
        message: 'Không thể xóa lời bài hát.',
      });
    } finally {
      setActionLoading(null);
    }
  };

  // Apply AI Result manually if OCC conflict occurred
  const handleApplyAiResult = () => {
    if (aiResultAvailable?.lrcData) {
      setLrcText(aiResultAvailable.lrcData);
      setTabIndex(1);
      setDraftConflictNote(null);
      showToast({
        severity: 'success',
        title: 'Đã nạp kết quả AI',
        message: 'Đã đưa các mốc thời gian AI vào khung chỉnh sửa Synced LRC.',
      });
    }
  };

  // Lifecycle
  useEffect(() => {
    isMountedRef.current = true;
    if (open && song?._id) {
      fetchLyrics();
      setIsPlaying(false);
      setCurrentTime(0);
    }
    return () => {
      isMountedRef.current = false;
      stopPolling();
    };
  }, [open, song?._id, fetchLyrics, stopPolling]);

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

  // Realtime Parse LRC for live preview, preserving structured words if present
  const parsedLrc = useMemo(() => {
    const structuredLines = lyricsData?.syncedLines || [];
    return parseLyrics(lrcText, structuredLines);
  }, [lrcText, lyricsData?.syncedLines]);

  // Active lyric line index for karaoke highlight
  const activeIndex = useMemo(() => {
    if (tabIndex === 1 && parsedLrc.isSynced) {
      return findActiveLyricIndex(parsedLrc.lines, currentTime);
    }
    return -1;
  }, [tabIndex, parsedLrc, currentTime]);

  // Active word index inside active line for word-level karaoke highlight
  const activeWordIndex = useMemo(() => {
    if (activeIndex >= 0 && parsedLrc.lines[activeIndex]?.words?.length > 0) {
      return findActiveWordIndex(parsedLrc.lines[activeIndex].words, currentTime);
    }
    return -1;
  }, [activeIndex, parsedLrc, currentTime]);

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

  // Save Draft (Does not publish)
  const handleSaveDraft = async () => {
    try {
      setActionLoading('draft');
      const payload = {
        lyricsType: tabIndex === 1 ? 'synced' : 'plain',
        plainLyrics: plainText,
        lrcData: lrcText,
      };

      const res = await artistApi.saveDraftLyrics(song._id, payload);
      if (res.data?.data) {
        setLyricsData(res.data.data);
      }

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

      await fetchLyrics(true);
      if (onUpdated) onUpdated();
    } catch (err) {
      showToast({
        severity: 'error',
        title: 'Lưu thất bại',
        message: err.response?.data?.message || 'Không thể lưu bản nháp',
      });
    } finally {
      setActionLoading(null);
    }
  };

  // Publish (Explicit Artist action)
  const handlePublish = async () => {
    try {
      setActionLoading('publish');
      const payload = {
        lyricsType: tabIndex === 1 ? 'synced' : 'plain',
        plainLyrics: plainText,
        lrcData: lrcText,
      };

      const res = await artistApi.publishLyrics(song._id, payload);
      if (res.data?.data) {
        setLyricsData(res.data.data);
      } else {
        setLyricsData((prev) => ({
          ...prev,
          status: 'published',
          publishedLyricsType: payload.lyricsType,
          publishedPlainLyrics: payload.plainLyrics,
          publishedLrcData: payload.lrcData,
        }));
      }

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

      await fetchLyrics(true);
      if (onUpdated) onUpdated();
    } catch (err) {
      showToast({
        severity: 'error',
        title: 'Xuất bản thất bại',
        message: err.response?.data?.message || 'Lỗi xuất bản lời bài hát',
      });
    } finally {
      setActionLoading(null);
    }
  };

  // Unpublish
  const handleUnpublish = async () => {
    try {
      setActionLoading('unpublish');
      const res = await artistApi.unpublishLyrics(song._id);
      if (res.data?.data) {
        setLyricsData(res.data.data);
      } else {
        setLyricsData((prev) => ({ ...prev, status: 'draft' }));
      }
      showToast({
        severity: 'info',
        title: 'Đã hủy xuất bản',
        message: res.data?.message || 'Đã ẩn lời bài hát khỏi người nghe. Bản nháp của bạn vẫn được giữ nguyên.',
      });
      await fetchLyrics(true);
      if (onUpdated) onUpdated();
    } catch (err) {
      showToast({
        severity: 'error',
        title: 'Lỗi hủy xuất bản',
        message: err.response?.data?.message || 'Không thể hủy xuất bản',
      });
    } finally {
      setActionLoading(null);
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

  // AI Alignment Button UI rendering
  const renderAiAlignmentButton = () => {
    const isProcessing = alignmentState === 'PROCESSING' || Boolean(actionLoading);
    const isSucceeded = alignmentState === 'SUCCEEDED';
    const isWarning = alignmentState === 'WARNING';

    if (isProcessing) {
      const pVal = alignmentJob?.progressPercent || 25;
      return (
        <Button
          size="small"
          variant="contained"
          disabled
          startIcon={<CircularProgress size={15} sx={{ color: '#00e5ff' }} />}
          sx={{
            borderRadius: 2,
            textTransform: 'none',
            fontWeight: 850,
            fontSize: 12.5,
            bgcolor: 'rgba(108, 99, 255, 0.4) !important',
            color: '#00e5ff !important',
            border: '1px solid rgba(0, 229, 255, 0.3)',
          }}
        >
          ⚡ Đang xử lý AI ({pVal}%)
        </Button>
      );
    }

    if (isSucceeded || isWarning) {
      return (
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip
            icon={isWarning ? <WarningIcon sx={{ fontSize: 16 }} /> : <CheckCircleIcon sx={{ fontSize: 16 }} />}
            label={isWarning ? 'AI đã căn nhịp (Có lưu ý)' : '✓ AI đã căn nhịp'}
            color={isWarning ? 'warning' : 'success'}
            size="small"
            sx={{ fontWeight: 800, fontSize: 11.5 }}
          />
          <Tooltip title="Yêu cầu AI phân tích âm học & căn nhịp lại toàn bộ từ đầu (Bỏ qua cache)">
            <Button
              size="small"
              variant="outlined"
              startIcon={<RefreshIcon sx={{ color: '#00e5ff' }} />}
              onClick={() => handleTriggerAiAlignment({ forceRealign: true })}
              disabled={actionLoading || isProcessing}
              sx={{
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 750,
                fontSize: 12,
                borderColor: 'rgba(0, 229, 255, 0.4)',
                color: '#00e5ff',
                '&:hover': {
                  borderColor: '#00e5ff',
                  bgcolor: 'rgba(0, 229, 255, 0.08)',
                },
              }}
            >
              Căn nhịp lại
            </Button>
          </Tooltip>
          {plainText && (
            <Tooltip title="Xóa sạch toàn bộ lời bài hát để làm lại từ đầu">
              <IconButton
                size="small"
                onClick={handleClearAllLyrics}
                disabled={actionLoading || isProcessing}
                sx={{ color: 'text.secondary', '&:hover': { color: '#f44336', bgcolor: 'rgba(244, 67, 54, 0.1)' } }}
              >
                <DeleteIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      );
    }

    return (
      <Stack direction="row" spacing={1} alignItems="center">
        {/* ✨ AI Alignment Button (Requires Plain Lyrics) */}
        <Tooltip
          title={
            !plainText || plainText.trim().length < 10
              ? 'Vui lòng nhập lời bài hát (tối thiểu 10 ký tự) để AI tiến hành tạo nhịp karaoke'
              : 'Tách vocal & tự động tạo mốc thời gian karaoke chính xác cho từng từ'
          }
        >
          <span>
            <Button
              size="small"
              variant="contained"
              startIcon={<AiIcon sx={{ color: '#00e5ff' }} />}
              onClick={handleTriggerAiAlignment}
              disabled={isProcessing || !plainText || plainText.trim().length < 10}
              sx={{
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 800,
                fontSize: 12,
                background: 'linear-gradient(135deg, #6c63ff 0%, #00bcd4 100%)',
                color: '#fff',
                boxShadow: '0 4px 14px rgba(108, 99, 255, 0.35)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #534bae 0%, #0097a7 100%)',
                  boxShadow: '0 6px 20px rgba(108, 99, 255, 0.5)',
                },
                '&:disabled': {
                  opacity: 0.5,
                },
              }}
            >
              ✨ Tự động tạo nhịp bằng AI
            </Button>
          </span>
        </Tooltip>

        {plainText && (
          <Tooltip title="Xóa sạch toàn bộ lời bài hát">
            <IconButton
              size="small"
              onClick={handleClearAllLyrics}
              disabled={actionLoading}
              sx={{ color: 'text.secondary', '&:hover': { color: '#f44336', bgcolor: 'rgba(244, 67, 54, 0.1)' } }}
            >
              <DeleteIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        )}
      </Stack>
    );
  };

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
            {lyricsData?.syncSource === 'ai_alignment' && (
              <Chip
                icon={<AiIcon sx={{ fontSize: 14, color: '#00e5ff' }} />}
                label="AI Aligned"
                size="small"
                sx={{
                  fontWeight: 800,
                  fontSize: 11,
                  bgcolor: 'rgba(0, 188, 212, 0.15)',
                  color: '#00e5ff',
                  border: '1px solid rgba(0, 188, 212, 0.3)',
                }}
              />
            )}
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
        {/* OCC Conflict Notice Banner */}
        {draftConflictNote && (
          <Alert
            severity="warning"
            action={
              aiResultAvailable ? (
                <Button color="inherit" size="small" variant="outlined" onClick={handleApplyAiResult}>
                  Áp Dụng Kết Quả AI
                </Button>
              ) : null
            }
            sx={{ mb: 2.5, borderRadius: 2.5, fontWeight: 650 }}
          >
            {draftConflictNote}
          </Alert>
        )}

        {/* Quality Warning Notes Banner */}
        {alignmentState === 'WARNING' && alignmentJob?.qualityNotes?.length > 0 && !draftConflictNote && (
          <Alert severity="info" sx={{ mb: 2.5, borderRadius: 2.5, fontWeight: 600 }}>
            Lưu ý chất lượng từ AI: {alignmentJob.qualityNotes.join(' • ')}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ py: 12, display: 'grid', placeItems: 'center' }}>
            <CircularProgress sx={{ color: '#6c63ff' }} />
          </Box>
        ) : (
          <Grid container spacing={3}>
            {/* ━━━━━━━━━━━━━━━━━━━━ 📝 LEFT COLUMN: EDITORS ━━━━━━━━━━━━━━━━━━━━ */}
            <Grid size={{ xs: 12, md: 7 }}>
              <Paper
                elevation={0}
                sx={{
                  p: 2.5,
                  borderRadius: 3,
                  bgcolor: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                {/* Mode Tabs & Action Buttons */}
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
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

                  <Stack direction="row" spacing={1} alignItems="center">
                    {/* ✨ AI Alignment Action Button */}
                    {renderAiAlignmentButton()}

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
                </Stack>

                {/* Tab 0: Plain Lyrics Editor */}
                {tabIndex === 0 && (
                  <Box>
                    <TextField
                      fullWidth
                      multiline
                      minRows={14}
                      maxRows={18}
                      placeholder="Nhập lời bài hát dạng văn bản thường tại đây...&#10;&#10;Em ngày em đánh rơi nụ cười vào anh&#10;Có nghe mùa thu tắt nắng ở trên bàn tay&#10;Em mang cả mùa xuân trong mắt&#10;Và cả mùa đông đọng lại trên mi..."
                      value={plainText}
                      onChange={(e) => {
                        setPlainText(e.target.value);
                        if (alignmentState !== 'IDLE') {
                          setAlignmentState('IDLE');
                          setDraftConflictNote(null);
                        }
                      }}
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
                        💡 Mẹo: Nhập đầy đủ lời thường rồi bấm <strong>"✨ Tự động tạo nhịp bằng AI"</strong> để tự động căn từng câu và từng từ!
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
                      <Typography
                        variant="caption"
                        color={parsedLrc.isSynced ? 'success.main' : 'text.secondary'}
                        fontWeight={700}
                      >
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

            {/* ━━━━━━━━━━━━━━━━━━━━ 🎧 RIGHT COLUMN: AUDIO PREVIEW PLAYER & WORD-LEVEL KARAOKE ━━━━━━━━━━━━━━━━━━━━ */}
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
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
                  <Typography variant="subtitle1" fontWeight={850}>
                    Studio Audio Sync Previewer
                  </Typography>

                  {tabIndex === 1 && (
                    <Stack direction="row" spacing={0.5} sx={{ bgcolor: 'rgba(255,255,255,0.06)', p: 0.3, borderRadius: 2 }}>
                      <Button
                        size="small"
                        onClick={() => setPreviewLyricsMode('line')}
                        sx={{
                          py: 0.2,
                          px: 1.2,
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          textTransform: 'none',
                          borderRadius: 1.5,
                          minWidth: 'auto',
                          bgcolor: previewLyricsMode === 'line' ? '#6c63ff' : 'transparent',
                          color: previewLyricsMode === 'line' ? '#fff' : 'rgba(255,255,255,0.7)',
                        }}
                      >
                        🎵 Từng câu
                      </Button>
                      <Button
                        size="small"
                        onClick={() => setPreviewLyricsMode('karaoke')}
                        sx={{
                          py: 0.2,
                          px: 1.2,
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          textTransform: 'none',
                          borderRadius: 1.5,
                          minWidth: 'auto',
                          bgcolor: previewLyricsMode === 'karaoke' ? '#00e5ff' : 'transparent',
                          color: previewLyricsMode === 'karaoke' ? '#000' : 'rgba(255,255,255,0.7)',
                        }}
                      >
                        🎙️ Hát Karaoke
                      </Button>
                    </Stack>
                  )}
                </Stack>

                {/* Mini Player Controls */}
                <Box
                  sx={{
                    p: 2,
                    borderRadius: 2.5,
                    bgcolor: 'rgba(108, 99, 255, 0.08)',
                    border: '1px solid rgba(108, 99, 255, 0.2)',
                    mb: 2,
                  }}
                >
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
                <Typography
                  variant="caption"
                  fontWeight={800}
                  color="text.secondary"
                  sx={{ mb: 1, textTransform: 'uppercase' }}
                >
                  {tabIndex === 1 ? 'Bản xem trước sau khi xử lý:' : 'Bản xem trước văn bản:'}
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
                  {alignmentState === 'PROCESSING' ? (
                    <Box
                      sx={{
                        py: 3,
                        px: 2,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textAlign: 'center',
                        minHeight: 280,
                      }}
                    >
                      {/* Animated Circular Progress Gauge */}
                      <Box
                        sx={{
                          position: 'relative',
                          width: 80,
                          height: 80,
                          display: 'grid',
                          placeItems: 'center',
                          mb: 2,
                        }}
                      >
                        <CircularProgress
                          variant="determinate"
                          value={alignmentJob?.progressPercent || 25}
                          size={76}
                          thickness={4}
                          sx={{
                            color: '#00e5ff',
                            filter: 'drop-shadow(0 0 10px rgba(0, 229, 255, 0.5))',
                          }}
                        />
                        <Box sx={{ position: 'absolute' }}>
                          <Typography variant="caption" fontWeight={950} color="#00e5ff" sx={{ fontSize: 13.5 }}>
                            {alignmentJob?.progressPercent || 25}%
                          </Typography>
                        </Box>
                      </Box>

                      {/* Status Message */}
                      <Typography variant="subtitle2" fontWeight={900} sx={{ color: '#fff', mb: 0.5 }}>
                        {alignmentJob?.progressMessage || 'Đang xử lý bắt nhịp lời bài hát...'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" fontWeight={650} sx={{ mb: 2 }}>
                        Tiến trình:{' '}
                        <span style={{ color: '#00e5ff', fontWeight: 800 }}>
                          {
                            {
                              STARTING: 'Khởi động phòng thu',
                              DOWNLOADING: 'Nạp âm thanh',
                              PREPROCESSING: 'Chuẩn hóa âm thanh',
                              SEPARATING: 'Lọc giọng hát',
                              TRANSCRIBING: 'Nhận diện lời AI',
                              NORMALIZING: 'Chuẩn hóa câu chữ',
                              ALIGNING: 'Bắt nhịp từng câu',
                              POSTPROCESSING: 'Hoàn thiện',
                              COMPLETED: 'Hoàn tất',
                            }[alignmentJob?.stage] || alignmentJob?.stage || 'Đang tiến hành'
                          }
                        </span>
                      </Typography>

                      {/* 5 Pipeline Step Badges */}
                      <Stack direction="row" spacing={0.8} sx={{ width: '100%', maxWidth: 390, mb: 2 }}>
                        {[
                          { label: '1. Nạp & Lọc', minP: 25 },
                          { label: '2. Nhận diện', minP: 55 },
                          { label: '3. Chuẩn hóa', minP: 65 },
                          { label: '4. Khớp nhịp', minP: 85 },
                          { label: '5. Hoàn tất', minP: 100 },
                        ].map((st, idx) => {
                          const isDone = (alignmentJob?.progressPercent || 0) >= st.minP;
                          return (
                            <Box
                              key={idx}
                              sx={{
                                flex: 1,
                                py: 0.6,
                                px: 0.5,
                                borderRadius: 1.5,
                                textAlign: 'center',
                                bgcolor: isDone ? 'rgba(0, 229, 255, 0.18)' : 'rgba(255, 255, 255, 0.04)',
                                border: '1px solid',
                                borderColor: isDone ? '#00e5ff' : 'rgba(255, 255, 255, 0.08)',
                                transition: 'all 0.3s ease',
                              }}
                            >
                              <Typography
                                variant="caption"
                                sx={{
                                  fontSize: 9.5,
                                  fontWeight: isDone ? 900 : 600,
                                  color: isDone ? '#00e5ff' : 'text.secondary',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {st.label}
                              </Typography>
                            </Box>
                          );
                        })}
                      </Stack>

                      {/* Progress Linear Bar */}
                      <LinearProgress
                        variant="determinate"
                        value={alignmentJob?.progressPercent || 25}
                        sx={{
                          width: '100%',
                          maxWidth: 360,
                          height: 6,
                          borderRadius: 3,
                          bgcolor: 'rgba(255, 255, 255, 0.08)',
                          '& .MuiLinearProgress-bar': {
                            background: 'linear-gradient(90deg, #6c63ff 0%, #00e5ff 100%)',
                          },
                        }}
                      />
                    </Box>
                  ) : tabIndex === 1 ? (
                    parsedLrc.lines.length === 0 ? (
                      <Box sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}>
                        <Typography variant="body2" fontWeight={600}>
                          Chưa có câu hát đồng bộ nào để xem trước. Hãy nhập lời và bấm "Tự động tạo nhịp bằng AI" hoặc dán nội dung LRC ở bên trái!
                        </Typography>
                      </Box>
                    ) : (
                      <Stack spacing={1}>
                        {parsedLrc.lines.map((line, idx) => {
                          const isActive = idx === activeIndex;
                          const hasWordTimestamps = Array.isArray(line.words) && line.words.length > 0;

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

                                {/* Line Text with Word-Level Karaoke Highlight when available */}
                                <Box sx={{ flex: 1 }}>
                                  {previewLyricsMode === 'karaoke' && isActive && hasWordTimestamps ? (
                                    <Box sx={{ display: 'inline' }}>
                                      {line.words.map((w, wIdx) => {
                                        const wStart = Number(w.startTime) || 0;
                                        const wEnd = Number(w.endTime) || (wStart + 0.3);
                                        const isPastWord = currentTime >= wEnd || (activeWordIndex >= 0 && wIdx < activeWordIndex);
                                        const isCurrentWord = wIdx === activeWordIndex || (currentTime >= wStart && currentTime < wEnd);
                                        const wDur = Math.max(0.08, wEnd - wStart);
                                        const fillRatio = isPastWord ? 1 : isCurrentWord ? Math.min(1, Math.max(0, (currentTime - wStart) / wDur)) : 0;
                                        const fillPercent = Math.round(fillRatio * 100);

                                        return (
                                          <Typography
                                            key={wIdx}
                                            component="span"
                                            variant="body2"
                                            fontWeight={isCurrentWord ? 950 : isPastWord ? 900 : 700}
                                            sx={{
                                              mr: 0.75,
                                              display: 'inline-block',
                                              background: isPastWord
                                                ? '#00e5ff'
                                                : isCurrentWord
                                                ? `linear-gradient(90deg, #00e5ff 0%, #00e5ff ${fillPercent}%, rgba(255, 255, 255, 0.4) ${fillPercent}%, rgba(255, 255, 255, 0.4) 100%)`
                                                : 'rgba(255, 255, 255, 0.4)',
                                              WebkitBackgroundClip: 'text',
                                              WebkitTextFillColor: isPastWord ? '#00e5ff' : 'transparent',
                                              textShadow: isPastWord || isCurrentWord ? '0 0 12px rgba(0, 229, 255, 0.8)' : 'none',
                                              transform: isCurrentWord ? 'scale(1.08)' : 'none',
                                              transformOrigin: 'left center',
                                              transition: 'transform 0.1s ease-out',
                                            }}
                                          >
                                            {w.text}
                                          </Typography>
                                        );
                                      })}
                                    </Box>
                                  ) : (
                                    <Typography
                                      variant="body2"
                                      fontWeight={isActive ? 850 : 600}
                                      sx={{
                                        color: isActive ? '#00e5ff' : 'text.primary',
                                        textShadow: isActive ? '0 0 12px rgba(0, 229, 255, 0.8)' : 'none',
                                      }}
                                    >
                                      {line.text}
                                    </Typography>
                                  )}
                                </Box>
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
              startIcon={actionLoading === 'unpublish' ? <CircularProgress size={16} color="inherit" /> : <UnpublishIcon />}
              onClick={handleUnpublish}
              disabled={Boolean(actionLoading) || alignmentState === 'PROCESSING'}
              sx={{ borderRadius: 2.5, textTransform: 'none', fontWeight: 750 }}
            >
              {actionLoading === 'unpublish' ? 'Đang hủy...' : 'Hủy Xuất Bản'}
            </Button>
          )}
        </Box>

        <Stack direction="row" spacing={1.5}>
          <Button
            onClick={onClose}
            disabled={Boolean(actionLoading)}
            sx={{ borderRadius: 2.5, textTransform: 'none', fontWeight: 750 }}
          >
            Đóng
          </Button>

          <Button
            variant="outlined"
            startIcon={actionLoading === 'draft' ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
            onClick={handleSaveDraft}
            disabled={Boolean(actionLoading) || alignmentState === 'PROCESSING'}
            sx={{ borderRadius: 2.5, textTransform: 'none', fontWeight: 750 }}
          >
            {actionLoading === 'draft' ? 'Đang lưu...' : 'Lưu Bản Nháp'}
          </Button>

          <Button
            variant="contained"
            startIcon={actionLoading === 'publish' ? <CircularProgress size={16} color="inherit" /> : <PublishIcon />}
            onClick={handlePublish}
            disabled={Boolean(actionLoading) || alignmentState === 'PROCESSING'}
            sx={{
              borderRadius: 2.5,
              textTransform: 'none',
              fontWeight: 800,
              bgcolor: '#6c63ff',
              '&:hover': { bgcolor: '#534bae' },
            }}
          >
            {actionLoading === 'publish' ? 'Đang xuất bản...' : 'Xuất Bản'}
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}
