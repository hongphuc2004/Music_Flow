import { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  IconButton,
  Button,
  Stack,
  TextField,
  InputAdornment,
  Tooltip,
  Avatar,
  Tab,
  Tabs,
  CircularProgress,
} from '@mui/material';
import {
  CloseRounded as CloseIcon,
  ContentCopyRounded as CopyIcon,
  CheckRounded as CheckIcon,
  ShareRounded as ShareIcon,
  QrCode2Rounded as QrIcon,
  OpenInNewRounded as OpenInNewIcon,
} from '@mui/icons-material';
import {
  createSongShareUrl,
  createSongShareText,
  getSocialShareUrl,
  triggerNativeShare,
  getQrCodeImageUrl,
  generateShareInstanceId,
} from '../../utils/shareUtil';
import { clientSongsApi } from '../../services/client/client.service';
import useAppToast from './useAppToast';

const SOCIAL_CHANNELS = [
  {
    id: 'messenger',
    name: 'Messenger',
    color: '#0084FF',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0C5.373 0 0 4.974 0 11.111c0 3.498 1.744 6.614 4.469 8.654V24l4.088-2.242c1.085.3 2.238.464 3.443.464 6.627 0 12-4.975 12-11.111S18.627 0 12 0zm1.191 14.963l-3.055-3.26-5.963 3.26 6.559-6.963 3.13 3.259 5.889-3.259-6.56 6.963z" />
      </svg>
    ),
  },
  {
    id: 'zalo',
    name: 'Zalo',
    color: '#0068FF',
    icon: (
      <Box
        sx={{
          fontWeight: 900,
          fontSize: '14px',
          fontFamily: 'system-ui, sans-serif',
          color: 'white',
          letterSpacing: '-0.5px',
        }}
      >
        Zalo
      </Box>
    ),
  },
  {
    id: 'telegram',
    name: 'Telegram',
    color: '#24A1DE',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
      </svg>
    ),
  },
  {
    id: 'instagram',
    name: 'Instagram',
    color: '#E4405F',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
      </svg>
    ),
  },
];

export default function ShareSongModal({ open, onClose, song }) {
  const { showToast } = useAppToast();

  const [copied, setCopied] = useState(false);
  const [currentTab, setCurrentTab] = useState(0);
  const [qrLoading, setQrLoading] = useState(true);

  const songId = song?._id || song?.id;

  useEffect(() => {
    if (open) {
      setQrLoading(true);
      setCopied(false);
    }
  }, [open, songId]);

  // Cố định link chia sẻ và mã QR bằng useMemo để không sinh ngẫu nhiên mã mới mỗi lần re-render
  const clipboardShareUrl = useMemo(() => {
    if (!song) return '';
    return createSongShareUrl(song, { source: 'clipboard', medium: 'share' });
  }, [song]);

  const qrShareUrl = useMemo(() => {
    if (!song) return '';
    return createSongShareUrl(song, { source: 'qrcode', medium: 'offline' });
  }, [song]);

  const qrImageUrl = useMemo(() => {
    if (!qrShareUrl) return '';
    return getQrCodeImageUrl(qrShareUrl, 300);
  }, [qrShareUrl]);

  const shareText = useMemo(() => {
    return createSongShareText(song);
  }, [song]);

  const artistNames = useMemo(() => {
    if (!song) return '';
    if (Array.isArray(song.artists) && song.artists.length > 0) {
      const names = song.artists
        .map((a) => (typeof a === 'object' && a !== null ? a.name : (typeof a === 'string' && !/^[0-9a-fA-F]{24}$/.test(a) ? a : '')))
        .filter(Boolean);
      if (names.length > 0) return names.join(', ');
    }
    return song.artistNames || song.artist || (typeof song.artists === 'string' ? song.artists : '');
  }, [song]);

  const trackShare = (source, medium) => {
    if (songId && typeof clientSongsApi?.trackShareEvent === 'function') {
      try {
        clientSongsApi.trackShareEvent(songId, {
          source,
          medium,
          campaign: 'social_sharing',
          si: generateShareInstanceId(),
        }).catch(() => {});
      } catch {
        // ignore tracking errors
      }
    }
  };

  const handleCopyLink = async () => {
    try {
      trackShare('clipboard', 'share');
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(clipboardShareUrl);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = clipboardShareUrl;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      showToast({ message: 'Đã sao chép liên kết bài hát!', severity: 'success' });
      setTimeout(() => setCopied(false), 2500);
    } catch {
      showToast({ message: 'Không thể sao chép liên kết.', severity: 'error' });
    }
  };

  const handleSocialClick = (platformId) => {
    const medium = 'social';
    trackShare(platformId, medium);
    const customUrl = createSongShareUrl(song, { source: platformId, medium });

    if (platformId === 'messenger') {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(customUrl);
        } else {
          const textarea = document.createElement('textarea');
          textarea.value = customUrl;
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand('copy');
          document.body.removeChild(textarea);
        }
        showToast({
          message: 'Đã sao chép link vào bộ nhớ tạm 💬',
          severity: 'success',
        });
      } catch {
        showToast({ message: 'Không thể sao chép liên kết.', severity: 'error' });
      }

      window.open('https://www.messenger.com/', '_blank', 'noopener,noreferrer');
      return;
    }

    if (platformId === 'zalo') {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(customUrl);
        } else {
          const textarea = document.createElement('textarea');
          textarea.value = customUrl;
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand('copy');
          document.body.removeChild(textarea);
        }
        showToast({
          message: 'Đã sao chép link vào bộ nhớ tạm 💬',
          severity: 'success',
        });
      } catch {
        showToast({ message: 'Không thể sao chép liên kết.', severity: 'error' });
      }

      window.open('https://chat.zalo.me/', '_blank', 'noopener,noreferrer');
      return;
    }

    if (platformId === 'instagram') {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(customUrl);
        } else {
          const textarea = document.createElement('textarea');
          textarea.value = customUrl;
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand('copy');
          document.body.removeChild(textarea);
        }
        showToast({
          message: 'Đã sao chép link vào bộ nhớ tạm 🎵',
          severity: 'success',
        });
      } catch {
        showToast({ message: 'Không thể sao chép liên kết.', severity: 'error' });
      }

      window.open('https://www.instagram.com/direct/inbox/', '_blank', 'noopener,noreferrer');
      return;
    }

    const intentUrl = getSocialShareUrl(platformId, {
      url: customUrl,
      text: shareText,
      title: song.title,
    });

    if (intentUrl) {
      window.open(intentUrl, '_blank', 'noopener,noreferrer,width=620,height=600');
    }
  };

  const handleNativeShare = async () => {
    trackShare('other', 'share');
    const customUrl = createSongShareUrl(song, { source: 'other', medium: 'share' });
    const success = await triggerNativeShare({
      title: song.title,
      text: shareText,
      url: customUrl,
    });
    if (!success) {
      handleCopyLink();
    }
  };

  if (!song) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3.5,
          bgcolor: 'background.paper',
          backgroundImage: (theme) =>
            theme.palette.mode === 'dark'
              ? 'linear-gradient(135deg, rgba(30, 27, 75, 0.45), rgba(15, 23, 42, 0.7))'
              : 'linear-gradient(135deg, #ffffff, #f8fafc)',
          backdropFilter: 'blur(20px)',
          border: '1px solid',
          borderColor: (theme) =>
            theme.palette.mode === 'dark' ? 'rgba(108, 99, 255, 0.25)' : 'rgba(108, 99, 255, 0.15)',
          boxShadow: '0 24px 48px -12px rgba(0, 0, 0, 0.35)',
          overflow: 'hidden',
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          px: 2.5,
          pt: 2.5,
          pb: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Stack direction="row" spacing={1.25} alignItems="center">
          <Box
            sx={{
              width: 34,
              height: 34,
              borderRadius: 2,
              bgcolor: 'rgba(108, 99, 255, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#6c63ff',
            }}
          >
            <ShareIcon fontSize="small" />
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 800, fontSize: '1.05rem' }}>
            Chia sẻ bài hát
          </Typography>
        </Stack>

        <IconButton size="small" onClick={onClose} sx={{ color: 'text.secondary' }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      <DialogContent sx={{ p: 2.5 }}>
        {/* Song Info Preview */}
        <Stack
          direction="row"
          spacing={1.5}
          alignItems="center"
          sx={{
            p: 1.5,
            borderRadius: 2.5,
            bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'),
            border: '1px solid',
            borderColor: 'divider',
            mb: 2.5,
          }}
        >
          <Avatar
            src={song.imageUrl}
            variant="rounded"
            sx={{ width: 50, height: 50, borderRadius: 2 }}
          />
          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
            <Typography variant="subtitle2" noWrap sx={{ fontWeight: 700, fontSize: '0.92rem' }}>
              {song.title}
            </Typography>
            <Typography variant="caption" noWrap color="text.secondary" sx={{ display: 'block' }}>
              {artistNames || 'MusicFlow Artist'}
            </Typography>
          </Box>
        </Stack>

        {/* Tabs: Link & Socials vs QR Code */}
        <Tabs
          value={currentTab}
          onChange={(_, val) => setCurrentTab(val)}
          variant="fullWidth"
          sx={{
            mb: 2.5,
            minHeight: 38,
            borderRadius: 2,
            bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'),
            p: 0.5,
            '& .MuiTabs-indicator': {
              height: '100%',
              borderRadius: 1.5,
              bgcolor: 'primary.main',
              zIndex: 0,
            },
            '& .MuiTab-root': {
              minHeight: 34,
              fontSize: '0.82rem',
              fontWeight: 700,
              textTransform: 'none',
              zIndex: 1,
              borderRadius: 1.5,
              transition: 'all 0.2s',
              color: 'text.secondary',
              '&.Mui-selected': {
                color: '#fff',
              },
            },
          }}
        >
          <Tab icon={<ShareIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Mạng xã hội" />
          <Tab icon={<QrIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Mã QR" />
        </Tabs>

        {currentTab === 0 ? (
          <Stack spacing={2.5}>
            {/* Social Icons Grid */}
            <Stack direction="row" spacing={1.5} justifyContent="center">
              {SOCIAL_CHANNELS.map((ch) => (
                <Tooltip key={ch.id} title={`Chia sẻ lên ${ch.name}`} arrow>
                  <Button
                    onClick={() => handleSocialClick(ch.id)}
                    sx={{
                      flex: 1,
                      minWidth: 0,
                      py: 1.25,
                      borderRadius: 2.5,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 0.6,
                      color: 'text.primary',
                      bgcolor: (theme) =>
                        theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                      border: '1px solid',
                      borderColor: 'divider',
                      transition: 'all 0.2s',
                      '&:hover': {
                        bgcolor: `${ch.color}15`,
                        borderColor: ch.color,
                        transform: 'translateY(-2px)',
                      },
                    }}
                  >
                    <Box sx={{ color: ch.color, display: 'flex', alignItems: 'center', height: 26 }}>
                      {ch.icon}
                    </Box>
                    <Typography variant="caption" sx={{ fontSize: 11, fontWeight: 700 }}>
                      {ch.name}
                    </Typography>
                  </Button>
                </Tooltip>
              ))}
            </Stack>

            {/* Direct Copy Link Field */}
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, mb: 0.75, display: 'block' }}>
                Liên kết chia sẻ cố định:
              </Typography>
              <TextField
                fullWidth
                size="small"
                value={clipboardShareUrl}
                slotProps={{

                  input: {
                    readOnly: true,
                    sx: {
                      borderRadius: 2.5,
                      fontSize: '0.85rem',
                      fontFamily: 'monospace',
                      bgcolor: (theme) =>
                        theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.02)',
                    },
                    endAdornment: (
                      <InputAdornment position="end">
                        <Button
                          variant="contained"
                          size="small"
                          onClick={handleCopyLink}
                          startIcon={copied ? <CheckIcon fontSize="small" /> : <CopyIcon fontSize="small" />}
                          sx={{
                            borderRadius: 2,
                            px: 1.5,
                            py: 0.6,
                            textTransform: 'none',
                            fontWeight: 700,
                            fontSize: '0.78rem',
                            bgcolor: copied ? '#10b981' : '#6c63ff',
                            '&:hover': {
                              bgcolor: copied ? '#059669' : '#5b52e0',
                            },
                          }}
                        >
                          {copied ? 'Đã chép' : 'Sao chép'}
                        </Button>
                      </InputAdornment>
                    ),
                  },
                }}
              />
            </Box>

            {/* Native Share Button (if supported) */}
            {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
              <Button
                variant="outlined"
                fullWidth
                onClick={handleNativeShare}
                startIcon={<OpenInNewIcon fontSize="small" />}
                sx={{
                  borderRadius: 2.5,
                  py: 1,
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  borderColor: 'rgba(108, 99, 255, 0.4)',
                  color: '#6c63ff',
                  '&:hover': {
                    borderColor: '#6c63ff',
                    bgcolor: 'rgba(108, 99, 255, 0.08)',
                  },
                }}
              >
                Chia sẻ qua ứng dụng khác
              </Button>
            )}
          </Stack>
        ) : (
          /* QR Code Tab */
          <Stack alignItems="center" spacing={2} sx={{ py: 1 }}>
            <Box
              sx={{
                p: 2,
                borderRadius: 3,
                bgcolor: '#ffffff',
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 200,
                height: 200,
              }}
            >
              {qrLoading && (
                <CircularProgress size={32} sx={{ position: 'absolute', color: '#6c63ff' }} />
              )}
              <Box
                component="img"
                src={qrImageUrl}
                alt="QR Code"
                onLoad={() => setQrLoading(false)}
                onError={() => setQrLoading(false)}
                sx={{
                  width: '100%',
                  height: '100%',
                  borderRadius: 1.5,
                  display: qrLoading ? 'none' : 'block',
                }}
              />
            </Box>

            <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', maxWidth: 260 }}>
              Quét mã QR bằng Camera điện thoại hoặc Zalo để mở và nghe bài hát ngay lập tức!
            </Typography>

            <Button
              variant="outlined"
              size="small"
              onClick={handleCopyLink}
              startIcon={copied ? <CheckIcon fontSize="small" /> : <CopyIcon fontSize="small" />}
              sx={{
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 700,
                color: copied ? '#10b981' : '#6c63ff',
                borderColor: copied ? '#10b981' : 'rgba(108, 99, 255, 0.4)',
              }}
            >
              {copied ? 'Đã sao chép liên kết!' : 'Sao chép liên kết'}
            </Button>
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
}
