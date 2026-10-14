import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  InputAdornment,
  Paper,
  Skeleton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  AutoAwesomeRounded as SparklesIcon,
  SendRounded as SendIcon,
  AddRounded as AddIcon,
  DeleteOutlineRounded as DeleteIcon,
  PlayArrowRounded as PlayIcon,
  PlayCircleRounded as PlayAllIcon,
  PersonRounded as UserIcon,
  MusicNoteRounded as MusicIcon,
  ChevronLeftRounded as CollapseIcon,
  HistoryRounded as HistoryIcon,
  DownloadRounded as DownloadIcon,
  OpenInNewRounded as OpenIcon,
  MicRounded as MicIcon,
  GraphicEqRounded as EqualizerIcon,
  HeadphonesRounded as HeadphonesIcon,
  QueueMusicRounded as PlaylistIcon,
} from '@mui/icons-material';
import ClientLayout from '../../components/Layout/client/ClientLayout';
import { useAssistant } from '../../features/assistant/AssistantProvider';
import { useClientPlayer, useClientPlayerActions } from '../../components/Layout/client/ClientPlayerProvider';
import useClientSession from '../../hooks/useClientSession';
import useVoiceRecognition from '../../hooks/useVoiceRecognition';

const QUICK_PROMPTS = [
  { emoji: '🌧️', label: 'Nhạc buồn lofi', prompt: 'Nhạc buồn lofi cho đêm mưa' },
  { emoji: '⚡', label: 'Nhạc hứng khởi', prompt: 'Nhạc sôi động năng lượng cao' },
  { emoji: '☕', label: 'Nhạc thư giãn', prompt: 'Nhạc chill nhẹ nhàng thư giãn' },
  { emoji: '🎯', label: 'Nhạc tập trung', prompt: 'Nhạc tập trung học bài làm việc' },
  { emoji: '💜', label: 'Nhạc lãng mạn', prompt: 'Nhạc tình yêu lãng mạn ngọt ngào' },
  { emoji: '🎉', label: 'Nhạc party', prompt: 'Nhạc sàn EDM party bùng nổ' },
];

function _formatSongDuration(seconds) {
  if (!seconds) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Format bot message content into structured music chips & highlighted cards
function FormattedBotContent({ content }) {
  if (!content) return null;
  const lines = content.split('\n');

  return (
    <Stack spacing={0.75} sx={{ width: '100%' }}>
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <Box key={idx} sx={{ height: 4 }} />;
        }

        // Check if line is numbered song list: e.g. "1. Cô Đơn Trong Nhà Mình - Hoài Lâm"
        const numberedMatch = trimmed.match(/^(\d+)[\.\)]\s*(.+)$/);
        if (numberedMatch) {
          const num = numberedMatch[1];
          const rawTitle = numberedMatch[2];
          const parts = rawTitle.split(/\s*-\s*/);
          const title = parts[0];
          const artist = parts.slice(1).join(' - ');

          return (
            <Box
              key={idx}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.25,
                p: '8px 12px',
                borderRadius: '12px',
                bgcolor: (theme) =>
                  theme.palette.mode === 'dark' ? 'rgba(139, 92, 246, 0.1)' : 'rgba(139, 92, 246, 0.06)',
                border: '1px solid',
                borderColor: (theme) =>
                  theme.palette.mode === 'dark' ? 'rgba(139, 92, 246, 0.22)' : 'rgba(139, 92, 246, 0.14)',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': {
                  bgcolor: (theme) =>
                    theme.palette.mode === 'dark' ? 'rgba(139, 92, 246, 0.18)' : 'rgba(139, 92, 246, 0.12)',
                  borderColor: '#8b5cf6',
                  transform: 'translateX(4px)',
                  boxShadow: '0 4px 14px rgba(139, 92, 246, 0.15)',
                },
              }}
            >
              <Box
                sx={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                  color: '#ffffff',
                  fontSize: 11,
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: '0 2px 6px rgba(124, 58, 237, 0.35)',
                }}
              >
                {num}
              </Box>
              <MusicIcon sx={{ fontSize: 16, color: '#8b5cf6', flexShrink: 0 }} />
              <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                <Typography
                  component="span"
                  sx={{
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    color: 'text.primary',
                  }}
                >
                  {title}
                </Typography>
                {artist && (
                  <Typography
                    component="span"
                    sx={{
                      ml: 1,
                      fontSize: '0.82rem',
                      color: (theme) => (theme.palette.mode === 'dark' ? '#c084fc' : '#6b21a8'),
                      fontWeight: 600,
                    }}
                  >
                    — {artist}
                  </Typography>
                )}
              </Box>
            </Box>
          );
        }

        // Bullet point lines: e.g. "• Một đoạn lời bài hát..."
        if (/^[•\-\*]\s*(.+)$/.test(trimmed)) {
          const bulletText = trimmed.replace(/^[•\-\*]\s*/, '');
          return (
            <Stack key={idx} direction="row" spacing={1.25} alignItems="flex-start" sx={{ pl: 0.5, py: 0.25 }}>
              <Box
                sx={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  bgcolor: '#8b5cf6',
                  mt: '8px',
                  flexShrink: 0,
                  boxShadow: '0 0 8px rgba(139, 92, 246, 0.8)',
                }}
              />
              <Typography
                variant="body2"
                sx={{
                  lineHeight: 1.6,
                  fontSize: '0.9rem',
                  color: 'text.primary',
                  wordBreak: 'break-word',
                }}
              >
                {bulletText}
              </Typography>
            </Stack>
          );
        }

        // Quote line or lyrics mention
        if (
          trimmed.startsWith('Đoạn lời') ||
          trimmed.startsWith('Lời bài hát') ||
          trimmed.startsWith('>')
        ) {
          return (
            <Box
              key={idx}
              sx={{
                p: '10px 14px',
                borderRadius: '10px',
                borderLeft: '4px solid #8b5cf6',
                bgcolor: (theme) =>
                  theme.palette.mode === 'dark' ? 'rgba(139, 92, 246, 0.12)' : 'rgba(139, 92, 246, 0.08)',
                my: 0.5,
              }}
            >
              <Typography
                variant="body2"
                sx={{
                  lineHeight: 1.6,
                  fontSize: '0.92rem',
                  color: 'text.primary',
                  fontStyle: 'italic',
                }}
              >
                {trimmed.replace(/^>\s*/, '')}
              </Typography>
            </Box>
          );
        }

        // Regular text
        return (
          <Typography
            key={idx}
            variant="body2"
            sx={{
              lineHeight: 1.65,
              fontSize: '0.925rem',
              color: 'text.primary',
              wordBreak: 'break-word',
            }}
          >
            {trimmed}
          </Typography>
        );
      })}
    </Stack>
  );
}

function PlaylistCard({ playlist, onPlaySong, onPlayAll }) {
  if (!playlist) return null;
  const isFallback = playlist.matchStatus === 'fallback';
  const songs = playlist.songs || [];

  return (
    <Paper
      elevation={0}
      sx={{
        mt: 2,
        borderRadius: 3.5,
        overflow: 'hidden',
        border: '1px solid',
        borderColor: (theme) =>
          theme.palette.mode === 'dark' ? 'rgba(139, 92, 246, 0.35)' : 'rgba(139, 92, 246, 0.25)',
        background: (theme) =>
          theme.palette.mode === 'dark'
            ? 'linear-gradient(135deg, rgba(26, 20, 56, 0.75) 0%, rgba(15, 23, 42, 0.9) 100%)'
            : 'linear-gradient(135deg, #ffffff 0%, #f5f3ff 100%)',
        backdropFilter: 'blur(16px)',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.25)',
      }}
    >
      {/* Header */}
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{
          px: 2.25,
          py: 1.5,
          background: (theme) =>
            theme.palette.mode === 'dark'
              ? 'linear-gradient(90deg, rgba(124, 58, 237, 0.25) 0%, rgba(6, 182, 212, 0.1) 100%)'
              : 'linear-gradient(90deg, rgba(124, 58, 237, 0.12) 0%, rgba(6, 182, 212, 0.05) 100%)',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Stack direction="row" spacing={1.25} alignItems="center">
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(139, 92, 246, 0.4)',
            }}
          >
            <PlaylistIcon sx={{ fontSize: 18, color: '#fff' }} />
          </Box>
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, fontSize: '0.92rem', lineHeight: 1.2 }}>
              {playlist.title || 'Mood Playlist'}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 11 }}>
              {songs.length} bài hát được gợi ý
            </Typography>
          </Box>
        </Stack>

        <Stack direction="row" spacing={1} alignItems="center">
          {isFallback && (
            <Chip
              label="Gợi ý gần nhất"
              size="small"
              sx={{ bgcolor: 'rgba(251,191,36,0.18)', color: '#f59e0b', fontWeight: 800, fontSize: 10.5 }}
            />
          )}
          {!isFallback && songs.length > 0 && (
            <Chip
              label="Khớp tâm trạng"
              size="small"
              sx={{ bgcolor: 'rgba(139,92,246,0.2)', color: '#a78bfa', fontWeight: 800, fontSize: 10.5 }}
            />
          )}
          {songs.length > 0 && (
            <Button
              size="small"
              variant="contained"
              startIcon={<PlayAllIcon sx={{ fontSize: 16 }} />}
              onClick={() => onPlayAll(songs)}
              sx={{
                borderRadius: '20px',
                background: 'linear-gradient(135deg, #7c3aed, #6366f1)',
                color: '#fff',
                fontSize: 12,
                fontWeight: 700,
                textTransform: 'none',
                px: 1.75,
                py: 0.5,
                boxShadow: '0 4px 12px rgba(124, 58, 237, 0.4)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #6d28d9, #4f46e5)',
                  boxShadow: '0 6px 16px rgba(124, 58, 237, 0.6)',
                  transform: 'scale(1.02)',
                },
              }}
            >
              Phát tất cả
            </Button>
          )}
        </Stack>
      </Stack>

      {/* Song list */}
      <Stack spacing={0} sx={{ maxHeight: 320, overflowY: 'auto' }}>
        {songs.slice(0, 15).map((song, idx) => (
          <Stack
            key={song._id || idx}
            direction="row"
            alignItems="center"
            spacing={1.5}
            onClick={() => onPlaySong(song, songs)}
            sx={{
              px: 2,
              py: 1.25,
              cursor: 'pointer',
              borderBottom: '1px solid',
              borderColor: 'rgba(255, 255, 255, 0.04)',
              transition: 'all 0.2s ease',
              '&:hover': {
                bgcolor: (theme) =>
                  theme.palette.mode === 'dark' ? 'rgba(139, 92, 246, 0.12)' : 'rgba(139, 92, 246, 0.08)',
              },
              '&:hover .song-play-indicator': { opacity: 1, transform: 'scale(1.05)' },
            }}
          >
            <Box
              sx={{
                width: 22,
                fontSize: 12,
                fontWeight: 700,
                color: 'text.secondary',
                textAlign: 'center',
                flexShrink: 0,
              }}
            >
              {idx + 1}
            </Box>

            <Avatar
              src={song.imageUrl || undefined}
              variant="rounded"
              sx={{
                width: 44,
                height: 44,
                borderRadius: 2,
                flexShrink: 0,
                bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(124, 58, 237, 0.15)' : 'rgba(124, 58, 237, 0.08)'),
                color: '#7c3aed',
                border: '1px solid rgba(139, 92, 246, 0.2)',
              }}
            >
              <MusicIcon sx={{ fontSize: 22 }} />
            </Avatar>

            <Box sx={{ minWidth: 0, flexGrow: 1 }}>
              <Typography variant="body2" noWrap sx={{ fontWeight: 700, fontSize: '0.88rem' }}>
                {song.title}
              </Typography>
              <Typography variant="caption" noWrap sx={{ color: 'text.secondary', display: 'block', fontSize: '0.78rem' }}>
                {(song.artists || []).map((a) => a.name || a).join(', ') || 'Nhiều nghệ sĩ'}
              </Typography>
            </Box>

            <Box
              className="song-play-indicator"
              sx={{
                opacity: 0,
                transform: 'scale(0.9)',
                transition: 'all 0.2s ease',
                flexShrink: 0,
              }}
            >
              <IconButton
                size="small"
                sx={{
                  color: '#fff',
                  bgcolor: '#7c3aed',
                  boxShadow: '0 2px 8px rgba(124, 58, 237, 0.4)',
                  '&:hover': { bgcolor: '#6d28d9' },
                }}
              >
                <PlayIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Box>
          </Stack>
        ))}
      </Stack>
    </Paper>
  );
}

function MessageBubble({ message, playlists, onPlaySong, onPlayAll }) {
  const isUser = message.role === 'user';
  const userAvatar = localStorage.getItem('userAvatar') || '';
  const linkedPlaylist = !isUser && message.playlistId
    ? playlists.find((p) => p._id === message.playlistId || p.id === message.playlistId)
    : null;

  const imageUrl = !isUser ? (message.metadata?.imageUrl || 
    message.metadata?.image || 
    (message.content && message.content.match(/\((https:\/\/image\.pollinations\.ai[^)]+)\)/)?.[1])) : null;

  const cleanContent = message.content 
    ? message.content.replace(/!\[.*?\]\(https:\/\/.*?\)/g, '').trim() 
    : '';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start', mb: 3 }}>
      <Stack direction={isUser ? 'row-reverse' : 'row'} spacing={1.5} alignItems="flex-start" sx={{ maxWidth: '100%' }}>
        {/* Avatar */}
        <Avatar
          src={isUser ? (userAvatar || undefined) : '/ai-assistant-icon.png'}
          sx={{
            width: 40,
            height: 40,
            flexShrink: 0,
            background: isUser
              ? 'linear-gradient(135deg, #7c3aed, #4f46e5)'
              : 'transparent',
            boxShadow: isUser
              ? '0 4px 14px rgba(124, 58, 237, 0.35)'
              : '0 4px 18px rgba(139, 92, 246, 0.45)',
            border: isUser ? '2px solid rgba(255,255,255,0.2)' : '2px solid rgba(255, 255, 255, 0.4)',
          }}
        >
          {isUser && <UserIcon sx={{ fontSize: 20, color: '#fff' }} />}
        </Avatar>

        {/* Content Box */}
        <Box sx={{ maxWidth: imageUrl ? { xs: '100%', sm: 460 } : { xs: '90%', md: '80%' } }}>
          <Paper
            elevation={0}
            sx={{
              p: imageUrl ? 1.75 : 2.25,
              borderRadius: isUser ? '22px 4px 22px 22px' : '4px 22px 22px 22px',
              background: isUser
                ? 'linear-gradient(135deg, #7c3aed 0%, #6366f1 100%)'
                : (theme) =>
                    theme.palette.mode === 'dark'
                      ? 'linear-gradient(135deg, rgba(22, 27, 46, 0.85) 0%, rgba(15, 23, 42, 0.95) 100%)'
                      : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
              border: isUser ? 'none' : '1px solid',
              borderColor: (theme) =>
                theme.palette.mode === 'dark' ? 'rgba(139, 92, 246, 0.25)' : 'rgba(226, 232, 240, 0.85)',
              boxShadow: (theme) =>
                isUser
                  ? '0 6px 20px rgba(124, 58, 237, 0.3)'
                  : theme.palette.mode === 'dark'
                  ? '0 10px 30px rgba(0, 0, 0, 0.35), 0 0 12px rgba(139, 92, 246, 0.08)'
                  : '0 4px 20px rgba(0, 0, 0, 0.06)',
              backdropFilter: 'blur(16px)',
            }}
          >
            {cleanContent && (
              isUser ? (
                <Typography
                  variant="body2"
                  sx={{
                    color: '#ffffff',
                    lineHeight: 1.65,
                    fontSize: '0.94rem',
                    fontWeight: 500,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {cleanContent}
                </Typography>
              ) : (
                <FormattedBotContent content={cleanContent} />
              )
            )}

            {/* Render AI Generated Image Showcase Card */}
            {imageUrl && (
              <Box
                sx={{
                  borderRadius: 3,
                  overflow: 'hidden',
                  border: '1px solid rgba(139, 92, 246, 0.35)',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
                  bgcolor: 'rgba(15, 23, 42, 0.6)',
                  width: '100%',
                  mt: cleanContent ? 1.5 : 0,
                }}
              >
                <Box
                  sx={{
                    position: 'relative',
                    width: '100%',
                    paddingTop: '100%', // 1:1 Aspect Ratio
                    overflow: 'hidden',
                    bgcolor: '#0f172a',
                    cursor: 'pointer',
                    '&:hover .artwork-overlay': { opacity: 1 },
                    '&:hover .artwork-img': { transform: 'scale(1.04)' },
                  }}
                  onClick={() => window.open(imageUrl, '_blank')}
                >
                  <Box
                    className="artwork-img"
                    component="img"
                    src={imageUrl}
                    alt={message.metadata?.prompt || 'AI Artwork'}
                    sx={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                  />
                  
                  {/* Glassmorphic Overlay on Hover */}
                  <Box
                    className="artwork-overlay"
                    sx={{
                      position: 'absolute',
                      inset: 0,
                      bgcolor: 'rgba(15, 23, 42, 0.45)',
                      backdropFilter: 'blur(4px)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: 0,
                      transition: 'opacity 0.25s ease',
                    }}
                  >
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<OpenIcon sx={{ fontSize: 16 }} />}
                      sx={{
                        borderRadius: 20,
                        bgcolor: 'rgba(255,255,255,0.9)',
                        color: '#0f172a',
                        fontWeight: 700,
                        fontSize: 12,
                        textTransform: 'none',
                        px: 2,
                        boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
                        '&:hover': { bgcolor: '#ffffff', transform: 'scale(1.05)' },
                      }}
                    >
                      Xem ảnh full HD
                    </Button>
                  </Box>
                </Box>

                {/* Bottom Action Footer Bar */}
                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  sx={{
                    px: 1.75,
                    py: 1.25,
                    bgcolor: (theme) =>
                      theme.palette.mode === 'dark' ? 'rgba(15, 23, 42, 0.95)' : '#f1f5f9',
                    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                  }}
                >
                  <Stack direction="row" spacing={0.75} alignItems="center">
                    <SparklesIcon sx={{ fontSize: 15, color: '#a855f7' }} />
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: 11 }}>
                      AI Cover Artwork 
                    </Typography>
                  </Stack>
                  
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<DownloadIcon sx={{ fontSize: 15 }} />}
                    onClick={() => window.open(imageUrl, '_blank')}
                    sx={{
                      borderRadius: 12,
                      background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: 11,
                      textTransform: 'none',
                      px: 1.75,
                      py: 0.5,
                      boxShadow: '0 2px 8px rgba(124, 58, 237, 0.35)',
                      '&:hover': {
                        background: 'linear-gradient(135deg, #6d28d9, #4338ca)',
                        boxShadow: '0 4px 12px rgba(124, 58, 237, 0.5)',
                      },
                    }}
                  >
                    Tải về
                  </Button>
                </Stack>
              </Box>
            )}
          </Paper>

          {/* Linked Playlist */}
          {linkedPlaylist && (
            <PlaylistCard
              playlist={linkedPlaylist}
              onPlaySong={onPlaySong}
              onPlayAll={onPlayAll}
            />
          )}
        </Box>
      </Stack>
    </Box>
  );
}

function ThinkingBubble() {
  return (
    <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ mb: 2.5 }}>
      <Avatar
        src="/ai-assistant-icon.png"
        sx={{
          width: 40,
          height: 40,
          boxShadow: '0 4px 16px rgba(139, 92, 246, 0.4)',
          border: '2px solid rgba(255, 255, 255, 0.35)',
        }}
      />
      <Paper
        elevation={0}
        sx={{
          px: 2.5,
          py: 1.75,
          borderRadius: '4px 20px 20px 20px',
          border: '1px solid',
          borderColor: 'rgba(139, 92, 246, 0.25)',
          background: (theme) =>
            theme.palette.mode === 'dark'
              ? 'linear-gradient(135deg, rgba(22, 27, 46, 0.85), rgba(15, 23, 42, 0.95))'
              : 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(16px)',
          boxShadow: '0 6px 20px rgba(0, 0, 0, 0.2)',
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          {/* Animated sound wave bars */}
          <Stack direction="row" spacing={0.4} alignItems="center" sx={{ height: 18 }}>
            {[0.4, 0.9, 0.6, 1.0, 0.5].map((h, i) => (
              <Box
                key={i}
                sx={{
                  width: 3,
                  height: 16,
                  borderRadius: 2,
                  background: 'linear-gradient(to top, #7c3aed, #06b6d4)',
                  animation: `equalizerWave 1.2s ease-in-out infinite alternate`,
                  animationDelay: `${i * 0.18}s`,
                  '@keyframes equalizerWave': {
                    '0%': { transform: 'scaleY(0.3)' },
                    '100%': { transform: 'scaleY(1)' },
                  },
                }}
              />
            ))}
          </Stack>
          <Typography variant="body2" sx={{ fontSize: 13, fontWeight: 600, color: '#a78bfa' }}>
            AI DJ đang phân tích cảm xúc & tìm kiếm giai điệu phù hợp...
          </Typography>
        </Stack>
      </Paper>
    </Stack>
  );
}

export default function ClientAiMood() {
  const { isPlaying } = useClientPlayer();
  const { playSong, pauseSong, resumeSong } = useClientPlayerActions();
  const wasPlayingRef = useRef(false);
  const messagesContainerRef = useRef(null);
  const inputRef = useRef(null);

  const {
    conversations,
    activeConversationId,
    messages,
    playlists,
    isLoading,
    setScope,
    sendMessage,
    loadConversations,
    loadConversationDetail,
    startNewConversation,
    deleteConversation,
  } = useAssistant();

  const [prompt, setPrompt] = useState('');
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [error, setError] = useState('');
  const [historyPanelOpen, setHistoryPanelOpen] = useState(
    () => localStorage.getItem('musicflow-ai-history-open') !== 'false'
  );

  const {
    isSupported: isVoiceSupported,
    isListening: isVoiceListening,
    startListening: startVoiceListening,
    stopListening: stopVoiceListening,
  } = useVoiceRecognition();

  const handleToggleVoice = () => {
    if (isVoiceListening) {
      stopVoiceListening();
      if (wasPlayingRef.current) {
        wasPlayingRef.current = false;
        resumeSong?.();
      }
      return;
    }
    if (!isVoiceSupported) {
      setError('Trình duyệt của bạn chưa hỗ trợ nhận diện giọng nói Web Speech API.');
      return;
    }

    if (isPlaying) {
      wasPlayingRef.current = true;
      pauseSong?.();
    } else {
      wasPlayingRef.current = false;
    }

    setError('');
    startVoiceListening({
      lang: 'vi-VN',
      silenceTimeoutMs: 1400,
      onResult: (text) => {
        setPrompt(text);
      },
      onEnd: (cleanedText, rawText) => {
        if (wasPlayingRef.current) {
          wasPlayingRef.current = false;
          resumeSong?.();
        }
        const text = cleanedText || rawText || '';
        if (text) {
          setPrompt(text);
          inputRef.current?.focus();
        }
      },
      onError: (err) => {
        if (wasPlayingRef.current) {
          wasPlayingRef.current = false;
          resumeSong?.();
        }
        setError(err.message);
      },
    });
  };

  const setHistoryPanelVisibility = (open) => {
    setHistoryPanelOpen(open);
    localStorage.setItem('musicflow-ai-history-open', String(open));
  };

  // Cuộn nội bộ trong container tin nhắn, KHÔNG gọi scrollIntoView để tránh làm trôi cả trang web
  const scrollToBottom = useCallback((smooth = true) => {
    requestAnimationFrame(() => {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTo({
          top: messagesContainerRef.current.scrollHeight,
          behavior: smooth ? 'smooth' : 'auto',
        });
      }
    });
  }, []);

  const { isLoggedIn, userId } = useClientSession();
  const hasInitializedRef = useRef(false);

  // Load history on mount or when session changes
  useEffect(() => {
    let isSubscribed = true;
    if (!isLoggedIn || !userId) {
      requestAnimationFrame(() => {
        if (isSubscribed) setIsHistoryLoading(false);
      });
      return;
    }

    setScope('mood');
    loadConversations('mood')
      .then((convs) => {
        if (
          isSubscribed &&
          Array.isArray(convs) &&
          convs.length > 0 &&
          !hasInitializedRef.current &&
          !activeConversationId
        ) {
          hasInitializedRef.current = true;
          loadConversationDetail(convs[0]._id);
        }
      })
      .finally(() => {
        if (isSubscribed) {
          setIsHistoryLoading(false);
        }
      });

    return () => {
      isSubscribed = false;
    };
  }, [isLoggedIn, userId, setScope, loadConversations, loadConversationDetail]);

  const loadConversation = async (conversationId) => {
    await loadConversationDetail(conversationId);
    // Khi người dùng bấm chọn 1 cuộc hội thoại cũ, giữ nguyên viewport trang web (không ép cuộn màn hình)
  };

  const handleSend = async (overridePrompt) => {
    const text = (overridePrompt || prompt).trim();
    if (!text || isLoading) return;

    setPrompt('');
    setError('');
    
    await sendMessage(text);
    setTimeout(() => scrollToBottom(true), 100);
  };

  const handleNewConversation = () => {
    startNewConversation('mood');
    setError('');
    setPrompt('');
    inputRef.current?.focus();
  };

  const handleDeleteConversation = async (convId) => {
    await deleteConversation(convId);
  };

  const handlePlaySong = (song, queue) => {
    playSong(song, { queue: queue || [song] });
  };

  const handlePlayAll = (songs) => {
    if (songs.length > 0) {
      playSong(songs[0], { queue: songs });
    }
  };

  const isEmpty = messages.length === 0 && playlists.length === 0 && !isHistoryLoading;

  return (
    <ClientLayout title="AI Mood DJ">
      <Box
        sx={{
          display: 'flex',
          gap: 2.5,
          height: 'calc(100vh - 130px)',
          minHeight: 560,
          position: 'relative',
        }}
      >
        {/* ── LEFT PANEL: Conversation History ── */}
        {historyPanelOpen && (
          <Paper
            elevation={0}
            sx={{
              width: { xs: 0, md: 290 },
              display: { xs: 'none', md: 'flex' },
              flexDirection: 'column',
              borderRadius: 4,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: (theme) =>
                theme.palette.mode === 'dark' ? 'rgba(15, 20, 36, 0.75)' : 'rgba(255, 255, 255, 0.8)',
              backdropFilter: 'blur(16px)',
              overflow: 'hidden',
              flexShrink: 0,
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25)',
            }}
          >
            {/* Header */}
            <Stack
              direction="row"
              alignItems="center"
              spacing={1}
              sx={{
                px: 2.25,
                py: 2,
                background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.15) 0%, rgba(6, 182, 212, 0.08) 100%)',
                borderBottom: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(124, 58, 237, 0.4)',
                }}
              >
                <HistoryIcon sx={{ color: '#fff', fontSize: 18 }} />
              </Box>
              <Typography fontWeight={800} fontSize={14.5} sx={{ flexGrow: 1, letterSpacing: -0.2 }}>
                Lịch sử cuộc trò chuyện
              </Typography>

              <Tooltip title="Thu gọn danh sách">
                <IconButton
                  size="small"
                  onClick={() => setHistoryPanelVisibility(false)}
                  sx={{
                    color: 'text.secondary',
                    borderRadius: '8px',
                    '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.08)' },
                  }}
                >
                  <CollapseIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>

            {/* New Conversation Button */}
            <Box sx={{ p: 1.5, pb: 1 }}>
              <Button
                fullWidth
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleNewConversation}
                sx={{
                  py: 1.1,
                  borderRadius: 3,
                  background: 'linear-gradient(135deg, #7c3aed 0%, #6366f1 100%)',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: 13,
                  textTransform: 'none',
                  boxShadow: '0 4px 16px rgba(124, 58, 237, 0.35)',
                  transition: 'all 0.25s ease',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #6d28d9 0%, #4f46e5 100%)',
                    transform: 'translateY(-1px)',
                    boxShadow: '0 6px 20px rgba(124, 58, 237, 0.5)',
                  },
                }}
              >
                Cuộc trò chuyện mới
              </Button>
            </Box>

            {/* List */}
            <Box
              sx={{
                flexGrow: 1,
                overflowY: 'auto',
                px: 1.25,
                py: 0.5,
                '&::-webkit-scrollbar': { width: '4px' },
                '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(139, 92, 246, 0.25)', borderRadius: '4px' },
              }}
            >
              {isHistoryLoading ? (
                <Stack spacing={1} sx={{ p: 1 }}>
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} variant="rounded" height={44} sx={{ borderRadius: 2.5 }} />
                  ))}
                </Stack>
              ) : conversations.length === 0 ? (
                <Stack alignItems="center" justifyContent="center" sx={{ height: '60%', textAlign: 'center', px: 2 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: 12 }}>
                    Chưa có cuộc trò chuyện nào. Hãy bắt đầu chia sẻ tâm trạng của bạn!
                  </Typography>
                </Stack>
              ) : (
                <Stack spacing={0.75}>
                  {conversations.map((conv) => {
                    const isActive = conv._id === activeConversationId;
                    return (
                      <Stack
                        key={conv._id}
                        direction="row"
                        alignItems="center"
                        onClick={() => loadConversation(conv._id)}
                        sx={{
                          px: 1.5,
                          py: 1.2,
                          borderRadius: 2.5,
                          cursor: 'pointer',
                          bgcolor: isActive
                            ? (theme) =>
                                theme.palette.mode === 'dark'
                                  ? 'rgba(139, 92, 246, 0.2)'
                                  : 'rgba(139, 92, 246, 0.12)'
                            : 'transparent',
                          border: '1px solid',
                          borderColor: isActive ? 'rgba(139, 92, 246, 0.45)' : 'transparent',
                          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                          '&:hover': {
                            bgcolor: isActive
                              ? 'rgba(139, 92, 246, 0.25)'
                              : (theme) =>
                                  theme.palette.mode === 'dark'
                                    ? 'rgba(255, 255, 255, 0.05)'
                                    : 'rgba(0, 0, 0, 0.04)',
                            transform: 'translateX(2px)',
                          },
                        }}
                      >
                        <MusicIcon
                          sx={{
                            fontSize: 16,
                            color: isActive ? '#a78bfa' : 'text.secondary',
                            mr: 1,
                            flexShrink: 0,
                          }}
                        />
                        <Typography
                          variant="body2"
                          fontWeight={isActive ? 700 : 500}
                          noWrap
                          sx={{
                            flexGrow: 1,
                            fontSize: 13,
                            color: isActive ? (theme) => (theme.palette.mode === 'dark' ? '#c084fc' : '#6b21a8') : 'text.primary',
                          }}
                        >
                          {conv.title || 'Mood Music'}
                        </Typography>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteConversation(conv._id);
                          }}
                          sx={{
                            opacity: 0,
                            p: 0.5,
                            ml: 0.5,
                            color: 'text.secondary',
                            '.MuiStack-root:hover &': { opacity: 1 },
                            '&:hover': { color: '#ef4444', bgcolor: 'rgba(239, 68, 68, 0.1)' },
                            transition: 'opacity 0.15s ease',
                          }}
                        >
                          <DeleteIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Stack>
                    );
                  })}
                </Stack>
              )}
            </Box>
          </Paper>
        )}

        {/* ── RIGHT PANEL: Main Chat Area ── */}
        <Stack sx={{ flexGrow: 1, minWidth: 0 }} spacing={0}>
          <Paper
            elevation={0}
            sx={{
              flexGrow: 1,
              display: 'flex',
              flexDirection: 'column',
              borderRadius: 4,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: (theme) =>
                theme.palette.mode === 'dark' ? 'rgba(13, 17, 31, 0.85)' : 'rgba(255, 255, 255, 0.85)',
              backdropFilter: 'blur(20px)',
              overflow: 'hidden',
              boxShadow: '0 12px 40px rgba(0, 0, 0, 0.3)',
            }}
          >
            {/* Chat header */}
            <Stack
              direction="row"
              alignItems="center"
              spacing={1.75}
              sx={{
                px: { xs: 2, md: 3 },
                py: 2,
                background: (theme) =>
                  theme.palette.mode === 'dark'
                    ? 'linear-gradient(135deg, rgba(124, 58, 237, 0.16) 0%, rgba(6, 182, 212, 0.08) 100%)'
                    : 'linear-gradient(135deg, rgba(124, 58, 237, 0.08) 0%, rgba(6, 182, 212, 0.04) 100%)',
                borderBottom: '1px solid',
                borderColor: 'divider',
                flexShrink: 0,
              }}
            >
              {!historyPanelOpen && (
                <Tooltip title="Mở lịch sử trò chuyện">
                  <IconButton
                    size="small"
                    onClick={() => setHistoryPanelVisibility(true)}
                    sx={{
                      color: '#a78bfa',
                      bgcolor: 'rgba(139, 92, 246, 0.15)',
                      borderRadius: 2.5,
                      p: 1,
                      '&:hover': { bgcolor: 'rgba(139, 92, 246, 0.25)', transform: 'scale(1.05)' },
                    }}
                  >
                    <HistoryIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}

              <Box
                sx={{
                  position: 'relative',
                  width: 46,
                  height: 46,
                  borderRadius: '50%',
                  boxShadow: '0 4px 16px rgba(124, 58, 237, 0.45)',
                  flexShrink: 0,
                  border: '2px solid rgba(255, 255, 255, 0.45)',
                  overflow: 'hidden',
                }}
              >
                <Box
                  component="img"
                  src="/ai-assistant-icon.png"
                  alt="AI Mood DJ"
                  sx={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                  }}
                />
                {/* Active Indicator Pulse */}
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    bgcolor: '#10b981',
                    border: '2px solid #0f172a',
                    boxShadow: '0 0 8px #10b981',
                  }}
                />
              </Box>

              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Typography fontWeight={900} fontSize={{ xs: 15, md: 17 }} sx={{ letterSpacing: -0.3 }}>
                    AI Mood Music DJ
                  </Typography>
                  <Chip
                    label="GEMINI 2.5"
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: 10,
                      fontWeight: 800,
                      background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.25), rgba(6, 182, 212, 0.25))',
                      color: '#a78bfa',
                      border: '1px solid rgba(139, 92, 246, 0.35)',
                    }}
                  />
                </Stack>
                <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', fontSize: 12, mt: 0.2 }}>
                  Mô tả cảm xúc · AI gợi ý nhạc chuẩn xác từ kho MusicFlow theo thời gian thực
                </Typography>
              </Box>

              <Tooltip title="Bắt đầu phiên trò chuyện mới">
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<AddIcon />}
                  onClick={handleNewConversation}
                  sx={{
                    borderRadius: 20,
                    borderColor: 'rgba(139, 92, 246, 0.4)',
                    color: (theme) => (theme.palette.mode === 'dark' ? '#c084fc' : '#7c3aed'),
                    textTransform: 'none',
                    fontWeight: 700,
                    fontSize: 12,
                    px: 1.75,
                    display: { xs: 'none', sm: 'inline-flex' },
                    '&:hover': {
                      borderColor: '#7c3aed',
                      bgcolor: 'rgba(139, 92, 246, 0.1)',
                    },
                  }}
                >
                  Đoạn chat mới
                </Button>
              </Tooltip>
            </Stack>

            {/* Messages area */}
            <Box
              ref={messagesContainerRef}
              sx={{
                flexGrow: 1,
                overflowY: 'auto',
                p: { xs: 2, md: 3 },
                display: 'flex',
                flexDirection: 'column',
                '&::-webkit-scrollbar': { width: '5px' },
                '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(139, 92, 246, 0.2)', borderRadius: '4px' },
              }}
            >
              {isHistoryLoading ? (
                <Stack spacing={2.5} sx={{ p: 1 }}>
                  {[1, 2, 3].map((i) => (
                    <Stack key={i} direction={i % 2 === 0 ? 'row-reverse' : 'row'} spacing={1.5} alignItems="flex-start">
                      <Skeleton variant="circular" width={40} height={40} />
                      <Skeleton variant="rounded" width={`${45 + i * 15}%`} height={64} sx={{ borderRadius: 3 }} />
                    </Stack>
                  ))}
                </Stack>
              ) : isEmpty ? (
                /* Hero Empty state */
                <Stack alignItems="center" justifyContent="center" sx={{ flexGrow: 1, py: { xs: 3, md: 6 }, textAlign: 'center' }}>
                  {/* Glowing Pulse Aura with AI Headset Icon */}
                  <Box
                    sx={{
                      position: 'relative',
                      width: 96,
                      height: 96,
                      borderRadius: '50%',
                      p: 0.5,
                      border: '3px solid rgba(255, 255, 255, 0.45)',
                      boxShadow: '0 10px 40px rgba(124, 58, 237, 0.55), 0 0 25px rgba(6, 182, 212, 0.35)',
                      mb: 3,
                      animation: 'heroPulse 3s infinite ease-in-out',
                      '@keyframes heroPulse': {
                        '0%, 100%': { transform: 'scale(1)', boxShadow: '0 10px 40px rgba(124, 58, 237, 0.55)' },
                        '50%': { transform: 'scale(1.06)', boxShadow: '0 14px 50px rgba(6, 182, 212, 0.65)' },
                      },
                    }}
                  >
                    <Box
                      component="img"
                      src="/ai-assistant-icon.png"
                      alt="AI DJ"
                      sx={{
                        width: '100%',
                        height: '100%',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        display: 'block',
                      }}
                    />
                  </Box>

                  <Typography variant="h5" fontWeight={900} gutterBottom sx={{ letterSpacing: -0.5 }}>
                    Hôm nay tâm trạng của bạn thế nào?
                  </Typography>

                  <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 520, mb: 4, lineHeight: 1.6, fontSize: '0.96rem' }}>
                    Hãy chia sẻ một câu chuyện, cảm xúc hoặc giai điệu bạn đang nhớ — AI DJ sẽ lắng nghe và gợi ý những bản nhạc chạm đúng trái tim bạn.
                  </Typography>

                  {/* Quick Prompts Grid */}
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: 'repeat(1, 1fr)', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
                      gap: 1.5,
                      maxWidth: 640,
                      width: '100%',
                    }}
                  >
                    {QUICK_PROMPTS.map((qp) => (
                      <Paper
                        key={qp.label}
                        onClick={() => handleSend(qp.prompt)}
                        elevation={0}
                        sx={{
                          p: 1.75,
                          borderRadius: 3,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.5,
                          border: '1px solid',
                          borderColor: (theme) =>
                            theme.palette.mode === 'dark' ? 'rgba(139, 92, 246, 0.25)' : 'rgba(139, 92, 246, 0.15)',
                          bgcolor: (theme) =>
                            theme.palette.mode === 'dark' ? 'rgba(26, 21, 51, 0.6)' : 'rgba(245, 243, 255, 0.7)',
                          backdropFilter: 'blur(10px)',
                          transition: 'all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
                          '&:hover': {
                            borderColor: '#8b5cf6',
                            transform: 'translateY(-3px)',
                            bgcolor: (theme) =>
                              theme.palette.mode === 'dark' ? 'rgba(139, 92, 246, 0.2)' : 'rgba(139, 92, 246, 0.12)',
                            boxShadow: '0 8px 24px rgba(124, 58, 237, 0.25)',
                          },
                        }}
                      >
                        <Typography sx={{ fontSize: 24 }}>{qp.emoji}</Typography>
                        <Box sx={{ textAlign: 'left', minWidth: 0 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: 13.5 }}>
                            {qp.label}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 11, display: 'block' }} noWrap>
                            {qp.prompt}
                          </Typography>
                        </Box>
                      </Paper>
                    ))}
                  </Box>
                </Stack>
              ) : (
                <>
                  {messages.map((msg, idx) => (
                    <MessageBubble
                      key={msg._id || idx}
                      message={msg}
                      playlists={playlists}
                      onPlaySong={handlePlaySong}
                      onPlayAll={handlePlayAll}
                    />
                  ))}
                  {isLoading && <ThinkingBubble />}
                </>
              )}
            </Box>

            {/* Error banner */}
            {error && (
              <Alert
                severity="error"
                onClose={() => setError('')}
                sx={{ mx: 2.5, mb: 1.5, borderRadius: 3 }}
              >
                {error}
              </Alert>
            )}

            {/* Input Dock */}
            <Box
              sx={{
                px: { xs: 2, md: 3 },
                pb: 2.5,
                pt: 1.5,
                borderTop: '1px solid',
                borderColor: 'divider',
                flexShrink: 0,
                background: (theme) =>
                  theme.palette.mode === 'dark'
                    ? 'linear-gradient(180deg, rgba(13, 17, 31, 0.4) 0%, rgba(13, 17, 31, 0.95) 100%)'
                    : 'linear-gradient(180deg, rgba(255, 255, 255, 0.4) 0%, rgba(255, 255, 255, 0.95) 100%)',
              }}
            >
              {/* Quick Mood Pills while in active conversation */}
              {!isEmpty && (
                <Stack direction="row" spacing={1} sx={{ mb: 1.5, flexWrap: 'wrap', gap: 0.75 }}>
                  {QUICK_PROMPTS.slice(0, 4).map((qp) => (
                    <Chip
                      key={qp.label}
                      label={`${qp.emoji} ${qp.label}`}
                      size="small"
                      onClick={() => handleSend(qp.prompt)}
                      clickable
                      disabled={isLoading}
                      sx={{
                        fontSize: 11.5,
                        fontWeight: 700,
                        py: 1.8,
                        px: 0.5,
                        borderRadius: '9999px',
                        border: '1px solid',
                        borderColor: (theme) =>
                          theme.palette.mode === 'dark' ? 'rgba(139, 92, 246, 0.3)' : 'rgba(139, 92, 246, 0.2)',
                        bgcolor: (theme) =>
                          theme.palette.mode === 'dark' ? 'rgba(139, 92, 246, 0.08)' : 'rgba(139, 92, 246, 0.05)',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          borderColor: '#8b5cf6',
                          bgcolor: 'rgba(139, 92, 246, 0.18)',
                          transform: 'translateY(-1px)',
                        },
                      }}
                    />
                  ))}
                </Stack>
              )}

              {/* Live Voice Status Banner */}
              {isVoiceListening && (
                <Box
                  sx={{
                    mb: 1.5,
                    p: 1.5,
                    borderRadius: 3,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.75,
                    background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(139, 92, 246, 0.15))',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    boxShadow: '0 4px 20px rgba(239, 68, 68, 0.15)',
                  }}
                >
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      bgcolor: 'error.main',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      animation: 'pulseVoice 1.4s infinite ease-in-out',
                      '@keyframes pulseVoice': {
                        '0%': { transform: 'scale(1)', boxShadow: '0 0 0 0 rgba(239, 68, 68, 0.6)' },
                        '50%': { transform: 'scale(1.12)', boxShadow: '0 0 0 10px rgba(239, 68, 68, 0)' },
                        '100%': { transform: 'scale(1)', boxShadow: '0 0 0 0 rgba(239, 68, 68, 0)' },
                      },
                    }}
                  >
                    <MicIcon sx={{ fontSize: 20 }} />
                  </Box>
                  <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 800, color: 'text.primary', fontSize: 13.5 }}>
                      AI DJ đang lắng nghe cảm xúc của bạn...
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 12 }}>
                      {prompt ? `"${prompt}"` : 'Hãy nói câu hát, tên ca sĩ hoặc tâm trạng hiện tại của bạn...'}
                    </Typography>
                  </Box>
                  <Button
                    size="small"
                    variant="contained"
                    color="error"
                    onClick={stopVoiceListening}
                    sx={{ borderRadius: 20, fontSize: 11.5, fontWeight: 700, textTransform: 'none', px: 2 }}
                  >
                    Hoàn tất
                  </Button>
                </Box>
              )}

              {/* Main Text Input & Actions */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  gap: 1.25,
                  p: '6px 8px 6px 14px',
                  borderRadius: 4,
                  bgcolor: (theme) =>
                    theme.palette.mode === 'dark' ? 'rgba(25, 30, 50, 0.7)' : 'rgba(241, 245, 249, 0.9)',
                  border: '1.5px solid',
                  borderColor: (theme) =>
                    theme.palette.mode === 'dark' ? 'rgba(139, 92, 246, 0.3)' : 'rgba(139, 92, 246, 0.2)',
                  transition: 'all 0.25s ease',
                  '&:focus-within': {
                    borderColor: '#8b5cf6',
                    bgcolor: (theme) =>
                      theme.palette.mode === 'dark' ? 'rgba(25, 30, 50, 0.95)' : '#ffffff',
                    boxShadow: '0 0 20px rgba(139, 92, 246, 0.3)',
                  },
                }}
              >
                <TextField
                  inputRef={inputRef}
                  fullWidth
                  multiline
                  maxRows={4}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  disabled={isLoading}
                  placeholder={
                    isVoiceListening
                      ? 'Đang nhận diện giọng nói của bạn...'
                      : 'Ví dụ: Nhạc buồn lofi cho đêm mưa, hoặc bài hát có lời Điều anh hối tiếc nhất...'
                  }
                  variant="standard"
                  InputProps={{
                    disableUnderline: true,
                    sx: {
                      fontSize: 14.5,
                      py: 0.75,
                    },
                  }}
                />

                {/* Voice Mic Button */}
                <Tooltip title={isVoiceListening ? 'Đang nghe... Bấm để dừng' : 'Trò chuyện bằng giọng nói'}>
                  <IconButton
                    onClick={handleToggleVoice}
                    disabled={isLoading}
                    sx={{
                      width: 44,
                      height: 44,
                      borderRadius: 3,
                      flexShrink: 0,
                      background: isVoiceListening
                        ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                        : (theme) => (theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)'),
                      color: isVoiceListening ? '#fff' : 'text.primary',
                      boxShadow: isVoiceListening ? '0 0 16px rgba(239, 68, 68, 0.5)' : 'none',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        background: isVoiceListening
                          ? 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)'
                          : 'rgba(139, 92, 246, 0.18)',
                        color: isVoiceListening ? '#fff' : '#8b5cf6',
                        transform: 'scale(1.06)',
                      },
                    }}
                  >
                    <MicIcon fontSize="small" />
                  </IconButton>
                </Tooltip>

                {/* Send Button */}
                <IconButton
                  onClick={() => handleSend()}
                  disabled={!prompt.trim() || isLoading}
                  sx={{
                    width: 44,
                    height: 44,
                    background:
                      prompt.trim() && !isLoading
                        ? 'linear-gradient(135deg, #7c3aed 0%, #6366f1 100%)'
                        : 'action.disabledBackground',
                    color: '#ffffff',
                    borderRadius: 3,
                    flexShrink: 0,
                    transition: 'all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    boxShadow: prompt.trim() && !isLoading ? '0 4px 16px rgba(124, 58, 237, 0.45)' : 'none',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #6d28d9 0%, #4f46e5 100%)',
                      transform: 'scale(1.08) rotate(-4deg)',
                      boxShadow: '0 6px 22px rgba(124, 58, 237, 0.6)',
                    },
                    '&.Mui-disabled': { color: 'action.disabled' },
                  }}
                >
                  {isLoading ? (
                    <CircularProgress size={20} sx={{ color: '#fff' }} />
                  ) : (
                    <SendIcon fontSize="small" />
                  )}
                </IconButton>
              </Box>

              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, pl: 0.5, fontSize: 11.5 }}>
                Nhấn <b>Enter</b> để gửi · <b>Shift+Enter</b> để xuống dòng · Nhấn biểu tượng <b>Micro</b> để nói
              </Typography>
            </Box>
          </Paper>
        </Stack>
      </Box>
    </ClientLayout>
  );
}
