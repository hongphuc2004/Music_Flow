import { useState } from 'react';
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
    id: 'facebook',
    name: 'Facebook',
    color: '#1877F2',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
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
    id: 'twitter',
    name: 'X (Twitter)',
    color: '#0f1419',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
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
];

export default function ShareSongModal({ open, onClose, song }) {
  const { showToast } = useAppToast();

  const [copied, setCopied] = useState(false);
  const [currentTab, setCurrentTab] = useState(0);
  const [qrLoading, setQrLoading] = useState(true);

  if (!song) return null;

  const songId = song._id || song.id;
  const clipboardShareUrl = createSongShareUrl(song, { source: 'clipboard', medium: 'share' });
  const qrShareUrl = createSongShareUrl(song, { source: 'qrcode', medium: 'offline' });
  const shareText = createSongShareText(song);
  const artistNames = Array.isArray(song.artists)
    ? song.artists.map((a) => (typeof a === 'object' ? a.name : a)).filter(Boolean).join(', ')
    : (song.artist || '');

  const trackShare = (source, medium) => {
    if (!songId) return;
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

  const handleSocialClick = async (platformId) => {
    const medium = 'social';
    trackShare(platformId, medium);
    const customUrl = createSongShareUrl(song, { source: platformId, medium });

    const isMobile =
      typeof navigator !== 'undefined' &&
      /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || '');

    // Trên điện thoại di động: Nếu bấm Zalo và hỗ trợ Web Share API, mở thẳng hộp thoại chia sẻ ứng dụng của điện thoại (Zalo App)
    if (platformId === 'zalo' && isMobile && typeof navigator.share === 'function') {
      const shared = await triggerNativeShare({
        title: song?.title || 'MusicFlow',
        text: shareText,
        url: customUrl,
      });
      if (shared) return;
    }

    const intentUrl = getSocialShareUrl(platformId, {
      url: customUrl,
      text: shareText,
      title: song.title,
    });

    if (intentUrl) {
      window.open(intentUrl, '_blank', 'noopener,noreferrer,width=600,height=560');
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

  const qrImageUrl = getQrCodeImageUrl(qrShareUrl, 240);

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
