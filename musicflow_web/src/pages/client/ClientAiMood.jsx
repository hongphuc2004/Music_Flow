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
  ExpandMoreRounded as ChevronIcon,
  MusicNoteRounded as MusicIcon,
  ChevronLeftRounded as CollapseIcon,
  HistoryRounded as HistoryIcon,
} from '@mui/icons-material';
import ClientLayout from '../../components/Layout/client/ClientLayout';
import { clientAiApi } from '../../services/api';
import { useClientPlayerActions } from '../../components/Layout/client/ClientPlayerProvider';
import useClientToast from '../../components/Layout/client/useClientToast';
import useClientSession from '../../hooks/useClientSession';

const QUICK_PROMPTS = [
  { emoji: '🌧️', label: 'Nhạc buồn lofi', prompt: 'Nhạc buồn lofi cho đêm mưa' },
  { emoji: '⚡', label: 'Nhạc hứng khởi', prompt: 'Nhạc sôi động năng lượng cao' },
  { emoji: '☕', label: 'Nhạc thư giãn', prompt: 'Nhạc chill nhẹ nhàng thư giãn' },
  { emoji: '🎯', label: 'Nhạc tập trung', prompt: 'Nhạc tập trung học bài làm việc' },
  { emoji: '💜', label: 'Nhạc lãng mạn', prompt: 'Nhạc tình yêu lãng mạn ngọt ngào' },
  { emoji: '🎉', label: 'Nhạc party', prompt: 'Nhạc sàn EDM party bùng nổ' },
];

// Gemini API model names (as of mid-2025)
const AI_MODELS = [
  { id: 'gemini-2.5-flash-preview-05-20', label: 'Gemini 2.5 Flash', badge: 'Mới nhất', desc: 'Nhanh + thông minh nhất' },
  { id: 'gemini-2.5-pro-preview-06-05',   label: 'Gemini 2.5 Pro',   badge: 'Mạnh nhất', desc: 'Suy luận sâu, chậm hơn' },
  { id: 'gemini-2.0-flash',               label: 'Gemini 2.0 Flash', badge: '',           desc: 'Ổn định, nhanh' },
  { id: 'gemini-1.5-flash-latest',        label: 'Gemini 1.5 Flash', badge: '',           desc: 'Phiên bản cũ ổn định' },
];

function formatSongDuration(seconds) {
  if (!seconds) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function PlaylistCard({ playlist, onPlaySong, onPlayAll }) {
  const isFallback = playlist.matchStatus === 'fallback';
  const songs = playlist.songs || [];

  return (
    <Paper
      sx={{
        mt: 1.5,
        borderRadius: 3,
        overflow: 'hidden',
        border: '1px solid',
        borderColor: isFallback ? 'rgba(251, 191, 36, 0.35)' : 'rgba(139, 92, 246, 0.35)',
        bgcolor: (theme) =>
          theme.palette.mode === 'dark' ? 'rgba(17, 24, 39, 0.65)' : 'rgba(245, 243, 255, 0.8)',
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Header */}
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{
          px: 2,
          py: 1.5,
          background: isFallback
            ? 'linear-gradient(135deg, rgba(251,191,36,0.12), rgba(245,158,11,0.06))'
            : 'linear-gradient(135deg, rgba(139,92,246,0.18), rgba(99,102,241,0.08))',
        }}
      >
        <SparklesIcon sx={{ color: isFallback ? '#f59e0b' : '#8b5cf6', fontSize: 20 }} />
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography fontWeight={800} fontSize={14} noWrap>
            {playlist.title}
          </Typography>
          {playlist.description && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }} noWrap>
              {playlist.description}
            </Typography>
          )}
        </Box>
        {isFallback && (
          <Chip
            label="Gợi ý thay thế"
            size="small"
            sx={{ bgcolor: 'rgba(251,191,36,0.15)', color: '#f59e0b', fontWeight: 700, fontSize: 10 }}
          />
        )}
        {!isFallback && songs.length > 0 && (
          <Chip
            label="Phù hợp"
            size="small"
            sx={{ bgcolor: 'rgba(139,92,246,0.15)', color: '#8b5cf6', fontWeight: 700, fontSize: 10 }}
          />
        )}
        {songs.length > 0 && (
          <Tooltip title="Phát tất cả">
            <IconButton
              size="small"
              onClick={() => onPlayAll(songs)}
              sx={{ color: '#8b5cf6', '&:hover': { bgcolor: 'rgba(139,92,246,0.12)' } }}
            >
              <PlayAllIcon />
            </IconButton>
          </Tooltip>
        )}
      </Stack>

      <Divider />

      {/* Song list */}
      <Stack spacing={0}>
        {songs.slice(0, 15).map((song, idx) => (
          <Stack
            key={song._id || idx}
            direction="row"
            alignItems="center"
            spacing={1.5}
            onClick={() => onPlaySong(song, songs)}
            sx={{
              px: 2,
              py: 1,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              '&:hover': {
                bgcolor: (theme) =>
                  theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
              },
              '&:hover .song-play-indicator': { opacity: 1 },
            }}
          >
            <Avatar
              src={song.imageUrl || undefined}
              variant="rounded"
              sx={{
                width: 40,
                height: 40,
                borderRadius: 1.5,
                flexShrink: 0,
                bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(124, 58, 237, 0.08)' : 'rgba(124, 58, 237, 0.04)',
                color: '#7c3aed',
              }}
            >
              <MusicIcon sx={{ fontSize: 22 }} />
            </Avatar>
            <Box sx={{ minWidth: 0, flexGrow: 1 }}>
              <Typography variant="body2" fontWeight={700} noWrap fontSize={13}>
                {song.title}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                {Array.isArray(song.artists)
                  ? song.artists.map((a) => a?.name || a).filter(Boolean).join(', ')
                  : 'Nghệ sĩ ẩn danh'}
              </Typography>
            </Box>
            <Typography
              variant="caption"
              color="text.secondary"
              className="song-play-indicator"
              sx={{ opacity: 0.7, minWidth: 36, textAlign: 'right', transition: 'opacity 0.2s' }}
            >
              {formatSongDuration(song.duration)}
            </Typography>
            <PlayIcon
              className="song-play-indicator"
              sx={{ opacity: 0, fontSize: 18, color: '#8b5cf6', transition: 'opacity 0.2s', flexShrink: 0 }}
            />
          </Stack>
        ))}
        {songs.length === 0 && (
          <Typography color="text.secondary" variant="caption" sx={{ px: 2, py: 1.5 }}>
            Chưa có bài hát trong playlist này.
          </Typography>
        )}
      </Stack>
    </Paper>
  );
}

function MessageBubble({ message, playlists, onPlaySong, onPlayAll }) {
  const isUser = message.role === 'user';
  const userAvatar = localStorage.getItem('userAvatar') || '';
  const linkedPlaylist = message.playlistId
    ? playlists.find((p) => p._id === message.playlistId || p.id === message.playlistId)
    : null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start', mb: 2 }}>
      <Stack direction={isUser ? 'row-reverse' : 'row'} spacing={1} alignItems="flex-start">
        {/* Avatar */}
        <Avatar
          src={isUser && userAvatar ? userAvatar : undefined}
          sx={{
            width: 34,
            height: 34,
            flexShrink: 0,
            background: isUser
              ? 'linear-gradient(135deg, #7c3aed, #4f46e5)'
              : 'linear-gradient(135deg, #3b82f6, #8b5cf6, #ec4899)',
            border: 'none',
            boxShadow: (theme) => theme.palette.mode === 'dark' 
              ? '0 2px 8px rgba(0,0,0,0.4)' 
              : '0 2px 8px rgba(124,58,237,0.15)',
          }}
        >
          {isUser ? (
            <UserIcon sx={{ fontSize: 18, color: '#fff' }} />
          ) : (
            <SparklesIcon sx={{ fontSize: 16, color: '#fff' }} />
          )}
        </Avatar>

        {/* Content */}
        <Box sx={{ maxWidth: { xs: '85%', md: '72%' } }}>
          <Paper
            elevation={0}
            sx={{
              px: 2,
              py: 1.25,
              borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
              background: isUser
                ? 'linear-gradient(135deg, #7c3aed, #6366f1)'
                : (theme) =>
                    theme.palette.mode === 'dark'
                      ? 'rgba(31, 41, 55, 0.8)'
                      : 'rgba(255,255,255,0.85)',
              border: isUser ? 'none' : '1px solid',
              borderColor: 'divider',
              backdropFilter: 'blur(10px)',
            }}
          >
            <Typography
              variant="body2"
              sx={{
                color: isUser ? '#fff' : 'text.primary',
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {message.content}
            </Typography>
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
    <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ mb: 2 }}>
      <Avatar
        sx={{
          width: 34,
          height: 34,
          background: 'linear-gradient(135deg, #3b82f6, #8b5cf6, #ec4899)',
          boxShadow: (theme) => theme.palette.mode === 'dark' 
            ? '0 2px 8px rgba(0,0,0,0.4)' 
            : '0 2px 8px rgba(124,58,237,0.15)',
        }}
      >
        <SparklesIcon sx={{ fontSize: 16, color: '#fff' }} />
      </Avatar>
      <Paper
        elevation={0}
        sx={{
          px: 2.5,
          py: 1.5,
          borderRadius: '18px 18px 18px 4px',
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(31,41,55,0.8)' : 'rgba(255,255,255,0.85)',
        }}
      >
        <Stack direction="row" spacing={0.5} alignItems="center">
          {[0, 1, 2].map((i) => (
            <Box
              key={i}
              sx={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                bgcolor: '#8b5cf6',
                animation: 'bounce 1.2s ease-in-out infinite',
                animationDelay: `${i * 0.18}s`,
                '@keyframes bounce': {
                  '0%, 80%, 100%': { transform: 'scale(0.6)', opacity: 0.4 },
                  '40%': { transform: 'scale(1)', opacity: 1 },
                },
              }}
            />
          ))}
        </Stack>
      </Paper>
    </Stack>
  );
}

export default function ClientAiMood() {
  const { playSong } = useClientPlayerActions();
  const { showToast } = useClientToast();
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  // State
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [prompt, setPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState(AI_MODELS[0].id);
  const [isLoading, setIsLoading] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [historyPanelOpen, setHistoryPanelOpen] = useState(
    () => localStorage.getItem('musicflow-ai-history-open') !== 'false'
  );

  const setHistoryPanelVisibility = (open) => {
    setHistoryPanelOpen(open);
    localStorage.setItem('musicflow-ai-history-open', String(open));
  };

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    });
  }, []);

  const { isLoggedIn, userId } = useClientSession();

  // Load history on mount or when session changes
  useEffect(() => {
    if (!isLoggedIn || !userId) {
      setConversations([]);
      setMessages([]);
      setPlaylists([]);
      setActiveConversationId(null);
      setError('');
      setIsHistoryLoading(false);
      return;
    }

    const load = async () => {
      setIsHistoryLoading(true);
      try {
        const res = await clientAiApi.getHistory();
        const data = res.data;
        if (data.success) {
          const convs = data.conversations || [];
          const pls = (data.playlists || []).filter((p) => (p.songs || []).length > 0);
          setConversations(convs);
          setPlaylists(pls);
          if (convs.length > 0) {
            setActiveConversationId(convs[0]._id);
            await loadConversation(convs[0]._id, pls);
          } else {
            setActiveConversationId(null);
            setMessages([]);
            setPlaylists([]);
          }
        }
      } catch {
        setError('Không thể tải lịch sử. Vui lòng thử lại.');
      } finally {
        setIsHistoryLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, userId]);

  const loadConversation = async (conversationId, existingPlaylists) => {
    try {
      const res = await clientAiApi.getConversation(conversationId);
      const data = res.data;
      if (data.success) {
        const msgs = (data.messages || []).map((m) => ({
          ...m,
          playlistId: m.metadata?.playlistId || null,
        }));
        const pls = (data.playlists || []).filter((p) => (p.songs || []).length > 0);
        setMessages(msgs);
        setPlaylists(pls.length > 0 ? pls : (existingPlaylists || []));
        setActiveConversationId(conversationId);
        setError('');
        setTimeout(scrollToBottom, 100);
      }
    } catch {
      // silent fail for conversation switch
    }
  };

  const handleSend = async (overridePrompt) => {
    const text = (overridePrompt || prompt).trim();
    if (!text || isLoading) return;

    setIsLoading(true);
    setError('');
    setPrompt('');

    // Optimistic user message
    const tempUserMsg = { role: 'user', content: text, _id: `tmp-${Date.now()}`, playlistId: null };
    setMessages((prev) => [...prev, tempUserMsg]);
    setTimeout(scrollToBottom, 50);

    try {
      const payload = { prompt: text };
      if (activeConversationId) payload.conversationId = activeConversationId;
      // Pass selected model so backend can prefer it in the cascade
      if (selectedModel) payload.model = selectedModel;

      const res = await clientAiApi.sendPrompt(payload);
      const data = res.data;

      if (data.success) {
        const newMsgs = (data.messages || []).map((m) => ({
          ...m,
          playlistId: m.metadata?.playlistId || null,
        }));
        const conv = data.conversation;
        const playlist = data.playlist;

        setMessages((prev) => {
          // Replace temp user msg + append new messages
          const without = prev.filter((m) => m._id !== tempUserMsg._id);
          return [...without, ...newMsgs];
        });

        if (playlist && (playlist.songs || []).length > 0) {
          setPlaylists((prev) => {
            const exists = prev.some((p) => p._id === playlist._id);
            return exists ? prev : [playlist, ...prev];
          });
        }

        if (conv) {
          setActiveConversationId(conv._id);
          setConversations((prev) => {
            const exists = prev.some((c) => c._id === conv._id);
            return exists ? prev : [conv, ...prev];
          });
        }

        // Auto-play: play song immediately if matchStatus is chat_play, OR if user used a play keyword and songs are returned
        const cleanText = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const hasPlayVerb = /\b(phat|bat|mo|nghe|play|chay)\b/i.test(cleanText);
        const isChatPlay = data.matchStatus === 'chat_play' || 
                           (hasPlayVerb && (data.songs || []).length > 0) ||
                           (!playlist && (data.songs || []).length > 0);

        if (isChatPlay && (data.songs || []).length > 0) {
          const songToPlay = data.songs[0];
          if (songToPlay?._id) {
            playSong(songToPlay, { queue: data.songs });
            const title = songToPlay.title || 'bài hát';
            showToast({ severity: 'success', title: '🎵 Đang phát', message: `"${title}" đang được phát!` });
          }
        }

        setTimeout(scrollToBottom, 100);
      } else {
        setMessages((prev) => prev.filter((m) => m._id !== tempUserMsg._id));
        setError(data.message || 'AI không thể phản hồi lúc này.');
      }
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m._id !== tempUserMsg._id));
      const status = err?.response?.status;
      if (status === 401 || status === 403) {
        setError('Bạn cần đăng nhập để sử dụng AI Mood Music.');
      } else {
        setError('Lỗi kết nối. Vui lòng thử lại sau.');
      }
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleNewConversation = () => {
    setActiveConversationId(null);
    setMessages([]);
    setPlaylists([]);
    setError('');
    setPrompt('');
    inputRef.current?.focus();
  };

  const handleDeleteConversation = async (convId) => {
    try {
      await clientAiApi.deleteConversation(convId);
      setConversations((prev) => prev.filter((c) => c._id !== convId));
      if (activeConversationId === convId) {
        const remaining = conversations.filter((c) => c._id !== convId);
        if (remaining.length > 0) {
          await loadConversation(remaining[0]._id);
        } else {
          handleNewConversation();
        }
      }
      showToast({ severity: 'success', title: 'Đã xóa', message: 'Đã xóa cuộc trò chuyện.' });
    } catch {
      showToast({ severity: 'error', title: 'Lỗi', message: 'Không thể xóa cuộc trò chuyện.' });
    }
  };

  const handlePlaySong = (song, queue) => {
    playSong(song, { queue: queue || [song] });
  };

  const handlePlayAll = (songs) => {
    if (songs.length > 0) {
      playSong(songs[0], { queue: songs });
      showToast({ severity: 'success', title: 'Đang phát', message: `Phát ${songs.length} bài hát.` });
    }
  };

  const isEmpty = messages.length === 0 && playlists.length === 0 && !isHistoryLoading;

  return (
    <ClientLayout title="AI Mood Music">
      <Box
        sx={{
          display: 'flex',
          gap: 2.5,
          height: 'calc(100vh - 140px)',
          minHeight: 500,
        }}
      >
        {/* ── LEFT PANEL: Conversation History ── */}
        {historyPanelOpen && (
        <Paper
          sx={{
            width: { xs: 0, md: 280 },
            display: { xs: 'none', md: 'flex' },
            flexDirection: 'column',
            borderRadius: 3,
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          {/* Header */}
          <Stack
            direction="row"
            alignItems="center"
            spacing={1}
            sx={{
              px: 2,
              py: 1.75,
              background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(99,102,241,0.08))',
              borderBottom: '1px solid',
              borderColor: 'divider',
            }}
          >
            <SparklesIcon sx={{ color: '#8b5cf6', fontSize: 20 }} />
            <Typography fontWeight={800} fontSize={14} sx={{ flexGrow: 1 }}>
              Cuộc trò chuyện
            </Typography>
            <Tooltip title="Cuộc trò chuyện mới">
              <IconButton
                size="small"
                onClick={handleNewConversation}
                sx={{
                  color: '#8b5cf6',
                  '&:hover': { bgcolor: 'rgba(139,92,246,0.12)' },
                }}
              >
                <AddIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Đóng lịch sử trò chuyện">
              <IconButton
                size="small"
                onClick={() => setHistoryPanelVisibility(false)}
                sx={{ color: 'text.secondary' }}
              >
                <CollapseIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>

          {/* List */}
          <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 1 }}>
            {isHistoryLoading ? (
              <Stack spacing={1} sx={{ p: 1 }}>
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} variant="rounded" height={48} sx={{ borderRadius: 2 }} />
                ))}
              </Stack>
            ) : conversations.length === 0 ? (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 4 }}>
                Chưa có cuộc trò chuyện nào
              </Typography>
            ) : (
              <Stack spacing={0.5}>
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
                        py: 1.25,
                        borderRadius: 2,
                        cursor: 'pointer',
                        bgcolor: isActive
                          ? 'rgba(139,92,246,0.12)'
                          : 'transparent',
                        borderLeft: isActive ? '3px solid #8b5cf6' : '3px solid transparent',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          bgcolor: isActive
                            ? 'rgba(139,92,246,0.15)'
                            : (theme) => theme.palette.mode === 'dark'
                              ? 'rgba(255,255,255,0.04)'
                              : 'rgba(0,0,0,0.03)',
                        },
                      }}
                    >
                      <Typography
                        variant="body2"
                        fontWeight={isActive ? 700 : 500}
                        noWrap
                        sx={{
                          flexGrow: 1,
                          fontSize: 13,
                          color: isActive ? '#8b5cf6' : 'text.primary',
                        }}
                      >
                        {conv.title || 'Mood Music'}
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={(e) => { e.stopPropagation(); handleDeleteConversation(conv._id); }}
                        sx={{
                          opacity: 0,
                          ml: 0.5,
                          color: 'text.secondary',
                          '.MuiStack-root:hover &': { opacity: 1 },
                          '&:hover': { color: '#ef4444' },
                          transition: 'opacity 0.15s ease',
                        }}
                      >
                        <DeleteIcon sx={{ fontSize: 15 }} />
                      </IconButton>
                    </Stack>
                  );
                })}
              </Stack>
            )}
          </Box>
        </Paper>
        )}

        {/* ── RIGHT PANEL: Chat Area ── */}
        <Stack sx={{ flexGrow: 1, minWidth: 0 }} spacing={0}>
          <Paper
            sx={{
              flexGrow: 1,
              display: 'flex',
              flexDirection: 'column',
              borderRadius: 3,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.paper',
              overflow: 'hidden',
            }}
          >
            {/* Chat header */}
            <Stack
              direction="row"
              alignItems="center"
              spacing={1.5}
              sx={{
                px: 2.5,
                py: 1.75,
                background: 'linear-gradient(135deg, rgba(139,92,246,0.12), rgba(20,184,166,0.06))',
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
                      color: '#8b5cf6',
                      bgcolor: 'rgba(139,92,246,0.1)',
                      '&:hover': { bgcolor: 'rgba(139,92,246,0.18)' },
                    }}
                  >
                    <HistoryIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  bgcolor: 'rgba(139,92,246,0.15)',
                  border: '1px solid rgba(139,92,246,0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <SparklesIcon sx={{ color: '#8b5cf6', fontSize: 20 }} />
              </Box>
              <Box sx={{ flexGrow: 1 }}>
                <Typography fontWeight={800} fontSize={15}>
                  AI Mood Music
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Mô tả cảm xúc · AI gợi ý nhạc từ thư viện · Kiến thức có thể chưa cập nhật sự kiện mới nhất
                </Typography>
              </Box>

              {/* Model selector */}
              <Box sx={{ position: 'relative' }}>
                <Button
                  size="small"
                  variant="outlined"
                  endIcon={<ChevronIcon />}
                  onClick={() => setShowModelPicker((v) => !v)}
                  sx={{
                    borderColor: 'rgba(139,92,246,0.4)',
                    color: '#8b5cf6',
                    fontSize: 11,
                    fontWeight: 700,
                    borderRadius: 2,
                    textTransform: 'none',
                    '&:hover': { borderColor: '#8b5cf6', bgcolor: 'rgba(139,92,246,0.08)' },
                  }}
                >
                  {AI_MODELS.find((m) => m.id === selectedModel)?.label || 'Model AI'}
                </Button>
                {showModelPicker && (
                  <Paper
                    elevation={8}
                    sx={{
                      position: 'absolute',
                      top: 'calc(100% + 6px)',
                      right: 0,
                      minWidth: 200,
                      borderRadius: 2.5,
                      overflow: 'hidden',
                      border: '1px solid',
                      borderColor: 'divider',
                      zIndex: 100,
                    }}
                  >
                    {AI_MODELS.map((model) => (
                      <Stack
                        key={model.id}
                        direction="row"
                        alignItems="center"
                        spacing={1}
                        onClick={() => { setSelectedModel(model.id); setShowModelPicker(false); }}
                        sx={{
                          px: 2,
                          py: 1.25,
                          cursor: 'pointer',
                          bgcolor: selectedModel === model.id ? 'rgba(139,92,246,0.1)' : 'transparent',
                          '&:hover': { bgcolor: 'rgba(139,92,246,0.08)' },
                          transition: 'background 0.15s',
                        }}
                      >
                        <Box sx={{ flexGrow: 1 }}>
                          <Stack direction="row" alignItems="center" spacing={0.75}>
                            <Typography variant="body2" fontWeight={selectedModel === model.id ? 700 : 500} sx={{ fontSize: 13 }}>
                              {model.label}
                            </Typography>
                            {model.badge && (
                              <Chip label={model.badge} size="small" sx={{ fontSize: 9, height: 18, bgcolor: 'rgba(139,92,246,0.15)', color: '#8b5cf6' }} />
                            )}
                          </Stack>
                          {model.desc && (
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10, display: 'block' }}>
                              {model.desc}
                            </Typography>
                          )}
                        </Box>
                        {selectedModel === model.id && (
                          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#8b5cf6', flexShrink: 0 }} />
                        )}
                      </Stack>
                    ))}
                  </Paper>
                )}
              </Box>
            </Stack>

            {/* Messages area */}
            <Box
              sx={{
                flexGrow: 1,
                overflowY: 'auto',
                p: { xs: 1.5, md: 2.5 },
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {isHistoryLoading ? (
                <Stack spacing={2} sx={{ p: 1 }}>
                  {[1, 2, 3].map((i) => (
                    <Stack key={i} direction={i % 2 === 0 ? 'row-reverse' : 'row'} spacing={1} alignItems="flex-start">
                      <Skeleton variant="circular" width={32} height={32} />
                      <Skeleton variant="rounded" width={`${40 + i * 12}%`} height={48} sx={{ borderRadius: 3 }} />
                    </Stack>
                  ))}
                </Stack>
              ) : isEmpty ? (
                /* Empty state */
                <Stack alignItems="center" justifyContent="center" sx={{ flexGrow: 1, py: 4, textAlign: 'center' }}>
                  <Box
                    sx={{
                      width: 80,
                      height: 80,
                      borderRadius: '50%',
                      bgcolor: 'rgba(139,92,246,0.1)',
                      border: '2px solid rgba(139,92,246,0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mb: 2.5,
                      animation: 'pulse 2s ease-in-out infinite',
                      '@keyframes pulse': {
                        '0%, 100%': { boxShadow: '0 0 0 0 rgba(139,92,246,0.3)' },
                        '50%': { boxShadow: '0 0 0 12px rgba(139,92,246,0)' },
                      },
                    }}
                  >
                    <SparklesIcon sx={{ fontSize: 40, color: '#8b5cf6' }} />
                  </Box>
                  <Typography variant="h6" fontWeight={800} gutterBottom>
                    Bạn đang cảm thấy thế nào?
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 380, mb: 3 }}>
                    Hãy mô tả cảm xúc hoặc trạng thái của bạn, AI sẽ phân tích và gợi ý những bài nhạc phù hợp nhất từ thư viện MusicFlow.
                  </Typography>

                  {/* Quick prompts */}
                  <Stack direction="row" flexWrap="wrap" gap={1} justifyContent="center" sx={{ maxWidth: 480 }}>
                    {QUICK_PROMPTS.map((qp) => (
                      <Chip
                        key={qp.label}
                        label={`${qp.emoji} ${qp.label}`}
                        onClick={() => handleSend(qp.prompt)}
                        clickable
                        sx={{
                          fontWeight: 600,
                          fontSize: 13,
                          borderRadius: 3,
                          border: '1px solid',
                          borderColor: 'rgba(139,92,246,0.3)',
                          bgcolor: 'rgba(139,92,246,0.06)',
                          color: 'text.primary',
                          '&:hover': {
                            bgcolor: 'rgba(139,92,246,0.14)',
                            borderColor: '#8b5cf6',
                          },
                        }}
                      />
                    ))}
                  </Stack>
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
              <div ref={chatEndRef} />
            </Box>

            {/* Error */}
            {error && (
              <Alert
                severity="error"
                onClose={() => setError('')}
                sx={{ mx: 2, mb: 1, borderRadius: 2 }}
              >
                {error}
              </Alert>
            )}

            {/* Input area */}
            <Box
              sx={{
                px: { xs: 1.5, md: 2.5 },
                pb: 2,
                pt: 1.5,
                borderTop: '1px solid',
                borderColor: 'divider',
                flexShrink: 0,
              }}
            >
              {/* Quick prompts when chat is active */}
              {!isEmpty && (
                <Stack direction="row" spacing={0.75} sx={{ mb: 1.25, flexWrap: 'wrap', gap: 0.75 }}>
                  {QUICK_PROMPTS.slice(0, 4).map((qp) => (
                    <Chip
                      key={qp.label}
                      label={`${qp.emoji} ${qp.label}`}
                      size="small"
                      onClick={() => handleSend(qp.prompt)}
                      clickable
                      disabled={isLoading}
                      sx={{
                        fontSize: 11,
                        fontWeight: 600,
                        borderRadius: 2,
                        border: '1px solid',
                        borderColor: 'divider',
                        '&:hover': { borderColor: '#8b5cf6', bgcolor: 'rgba(139,92,246,0.08)' },
                      }}
                    />
                  ))}
                </Stack>
              )}

              <Stack direction="row" spacing={1.25} alignItems="flex-end">
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
                  placeholder="Ví dụ: Nhạc buồn lofi cho đêm mưa, hoặc nhạc của Sơn Tùng..."
                  InputProps={{
                    sx: {
                      borderRadius: 3,
                      fontSize: 14,
                    },
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      '&:hover fieldset': { borderColor: '#8b5cf6' },
                      '&.Mui-focused fieldset': { borderColor: '#8b5cf6' },
                    },
                  }}
                />
                <IconButton
                  onClick={() => handleSend()}
                  disabled={!prompt.trim() || isLoading}
                  sx={{
                    width: 46,
                    height: 46,
                    bgcolor: prompt.trim() && !isLoading ? '#7c3aed' : 'action.disabledBackground',
                    color: '#fff',
                    borderRadius: 2.5,
                    flexShrink: 0,
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      bgcolor: '#6d28d9',
                      transform: 'scale(1.05)',
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
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75, pl: 0.5 }}>
                Nhấn Enter để gửi · Shift+Enter để xuống dòng · Model: {AI_MODELS.find((m) => m.id === selectedModel)?.label}
              </Typography>
            </Box>
          </Paper>
        </Stack>
      </Box>
    </ClientLayout>
  );
}
