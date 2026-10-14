import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  IconButton,
  Paper,
  Typography,
  Stack,
  TextField,
  InputAdornment,
  Avatar,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  Divider,
  Collapse,
  Button,
  useTheme,
  useMediaQuery,
  Tooltip,
  Dialog,
  DialogContent,
} from '@mui/material';
import {
  AutoAwesomeRounded as SparklesIcon,
  SendRounded as SendIcon,
  AddRounded as AddIcon,
  DeleteOutlineRounded as DeleteIcon,
  CloseRounded as CloseIcon,
  HistoryRounded as HistoryIcon,
  ChatBubbleOutlineRounded as ChatIcon,
  ChevronLeftRounded as BackIcon,
  MusicNoteRounded as MusicIcon,
  PlayArrowRounded as PlayIcon,
  PauseRounded as PauseIcon,
  DownloadRounded as DownloadIcon,
  OpenInNewRounded as OpenIcon,
  MicRounded as MicIcon,
} from '@mui/icons-material';
import { useAssistant } from './AssistantProvider';
import { useClientPlayer, useClientPlayerActions } from '../../components/Layout/client/ClientPlayerProvider';
import useVoiceRecognition from '../../hooks/useVoiceRecognition';

export default function AssistantHost() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    isOpen,
    setIsOpen,
    conversations,
    activeConversationId,
    messages,
    playlists,
    isLoading,
    sendMessage,
    loadConversationDetail,
    startNewConversation,
    deleteConversation,
    executeCapability,
    upgradeDialogOpen,
    setUpgradeDialogOpen,
  } = useAssistant();

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [inputText, setInputText] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const messagesEndRef = useRef(null);

  const { isPlaying } = useClientPlayer();
  const { pauseSong, resumeSong } = useClientPlayerActions();
  const wasPlayingRef = useRef(false);

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
      alert('Trình duyệt của bạn chưa hỗ trợ nhận diện giọng nói Web Speech API.');
      return;
    }

    if (isPlaying) {
      wasPlayingRef.current = true;
      pauseSong?.();
    } else {
      wasPlayingRef.current = false;
    }

    startVoiceListening({
      lang: 'vi-VN',
      silenceTimeoutMs: 1400,
      onResult: (text) => {
        setInputText(text);
      },
      onEnd: (cleanedText, rawText) => {
        if (wasPlayingRef.current) {
          wasPlayingRef.current = false;
          resumeSong?.();
        }
        const text = cleanedText || rawText || '';
        if (text) {
          setInputText(text);
        }
      },
      onError: (err) => {
        if (wasPlayingRef.current) {
          wasPlayingRef.current = false;
          resumeSong?.();
        }
        console.warn('Assistant voice error:', err.message);
      },
    });
  };

  // Drag and drop state & handlers for floating launcher button
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const buttonPosRef = useRef({ x: 0, y: 0 });
  const dragThreshold = 5;

  const handlePointerDown = (e) => {
    if (e.button !== 0) return;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    buttonPosRef.current = { ...position };

    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.addEventListener('pointermove', handlePointerMove);
    e.currentTarget.addEventListener('pointerup', handlePointerUp);
    e.currentTarget.addEventListener('pointercancel', handlePointerUp);
  };

  const handlePointerMove = (e) => {
    const deltaX = e.clientX - dragStartRef.current.x;
    const deltaY = e.clientY - dragStartRef.current.y;

    if (!isDragging && (Math.abs(deltaX) > dragThreshold || Math.abs(deltaY) > dragThreshold)) {
      setIsDragging(true);
    }

    let newX = buttonPosRef.current.x + deltaX;
    let newY = buttonPosRef.current.y + deltaY;

    const btnSize = 56;
    const padding = 12;
    const nativeRight = 24;
    const nativeBottom = hasPlayer ? 104 : 24;

    const maxRight = nativeRight - padding;
    const maxLeft = -(window.innerWidth - nativeRight - btnSize - padding);
    const maxBottom = nativeBottom - padding;
    const maxTop = -(window.innerHeight - nativeBottom - btnSize - padding);

    newX = Math.max(maxLeft, Math.min(maxRight, newX));
    newY = Math.max(maxTop, Math.min(maxBottom, newY));

    setPosition({ x: newX, y: newY });
  };

  const handlePointerUp = (e) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    e.currentTarget.removeEventListener('pointermove', handlePointerMove);
    e.currentTarget.removeEventListener('pointerup', handlePointerUp);
    e.currentTarget.removeEventListener('pointercancel', handlePointerUp);

    setTimeout(() => {
      setIsDragging(false);
    }, 50);
  };

  const handleButtonClick = (e) => {
    if (isDragging) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    setIsOpen(true);
  };

  const userRole = localStorage.getItem('role');
  const hasPlayer = location.pathname.startsWith('/client');

  // Scroll to bottom of chat
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  if (!userRole) return null; // Only show for logged in users

  const handleSend = () => {
    if (!inputText.trim()) return;
    sendMessage(inputText.trim());
    setInputText('');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getActorRole = () => {
    if (location.pathname.startsWith('/artist')) return 'artist';
    if (location.pathname.startsWith('/client') || location.pathname.startsWith('/ai-mood')) return 'user';
    if (location.pathname.startsWith('/admin')) return 'admin';
    if (location.pathname === '/') {
      return userRole === 'admin' ? 'admin' : 'user';
    }
    return userRole || 'user';
  };

  const getQuickPrompts = () => {
    const actor = getActorRole();
    if (actor === 'artist') {
      return [
        { label: '📊 Thống kê lượt nghe', text: 'Thống kê lượt nghe của tôi' },
        { label: '🎵 Nhạc đã đăng', text: 'Danh sách nhạc tôi đã upload' },
        { label: '📤 Tải bài hát mới', text: 'Mở trang upload nhạc' },
      ];
    }
    if (actor === 'admin') {
      return [
        { label: '📈 Stats hệ thống', text: 'Hệ thống có bao nhiêu bài hát' },
        { label: '👥 Quản lý tài khoản', text: 'Tìm tài khoản email admin@musicflow.com' },
        { label: '⚙️ Trang Dashboard', text: 'Mở trang Dashboard admin' },
      ];
    }
    return [
      { label: '🌧️ Nhạc buồn lofi', text: 'Gợi ý playlist nhạc buồn lofi tâm trạng' },
      { label: '☕ Nhạc chill thư giãn', text: 'Bật cho mình một bài hát chill nhẹ nhàng' },
      { label: '🔥 Nhạc thịnh hành', text: 'Gợi ý cho mình các bài hát đang thịnh hành' },
      { label: '❤️ Bài hát yêu thích', text: 'Mở trang danh sách bài hát yêu thích' },
    ];
  };

  return (
    <Box sx={{ position: 'fixed', zIndex: 9999 }}>
      {/* LAUNCHER BUTTON */}
      {!isOpen && (
        <Tooltip title="Trợ lý AI MusicFlow (Bấm để trò chuyện, Kéo để di chuyển)" placement="left">
          <Box
            sx={{
              position: 'fixed',
              bottom: hasPlayer ? '104px' : '24px', // Shift up on client view to clear player bar
              right: '24px',
              transform: `translate(${position.x}px, ${position.y}px)`,
              cursor: isDragging ? 'grabbing' : 'pointer',
              touchAction: 'none',
              zIndex: 9999,
            }}
          >
            {/* Outer Breathing Glow Halo */}
            <Box
              sx={{
                position: 'absolute',
                inset: -6,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 40%, #06b6d4 100%)',
                opacity: 0.55,
                filter: 'blur(10px)',
                animation: 'aiHaloPulse 2.8s ease-in-out infinite',
                '@keyframes aiHaloPulse': {
                  '0%, 100%': { transform: 'scale(0.92)', opacity: 0.4 },
                  '50%': { transform: 'scale(1.18)', opacity: 0.8 },
                },
                pointerEvents: 'none',
              }}
            />

            {/* Main Interactive Button */}
            <IconButton
              onPointerDown={handlePointerDown}
              onClick={handleButtonClick}
              sx={{
                position: 'relative',
                width: 60,
                height: 60,
                p: 0,
                borderRadius: '50%',
                boxShadow: '0 10px 32px rgba(124, 58, 237, 0.55), 0 0 20px rgba(6, 182, 212, 0.4)',
                transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                border: '2px solid rgba(255, 255, 255, 0.65)',
                overflow: 'hidden',
                bgcolor: 'transparent',
                '&:hover': {
                  transform: 'scale(1.12) rotate(6deg)',
                  boxShadow: '0 14px 44px rgba(124, 58, 237, 0.8), 0 0 32px rgba(6, 182, 212, 0.65)',
                  border: '2px solid rgba(255, 255, 255, 0.95)',
                },
                '&:active': {
                  transform: 'scale(0.95)',
                },
              }}
            >
              <Box
                component="img"
                src="/ai-assistant-icon.png"
                alt="AI Assistant"
                sx={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                  pointerEvents: 'none',
                }}
              />
            </IconButton>

            {/* Glowing Online Status Dot */}
            <Box
              sx={{
                position: 'absolute',
                top: 1,
                right: 1,
                width: 14,
                height: 14,
                borderRadius: '50%',
                bgcolor: '#10b981',
                border: '2.5px solid #0f172a',
                boxShadow: '0 0 10px #10b981',
                pointerEvents: 'none',
              }}
            />
          </Box>
        </Tooltip>
      )}

      {/* CHAT PANEL */}
      <Collapse in={isOpen}>
        <Paper
          elevation={24}
          sx={{
            position: 'fixed',
            bottom: isMobile ? 0 : (hasPlayer ? '104px' : '24px'),
            top: isMobile ? 0 : 'auto',
            right: isMobile ? 0 : '24px',
            width: isMobile ? '100vw' : 400,
            height: isMobile ? '100dvh' : 600,
            borderRadius: isMobile ? 0 : '16px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            border: '1px solid',
            borderColor: 'divider',
            backdropFilter: 'blur(20px)',
            bgcolor: (theme) =>
              theme.palette.mode === 'dark'
                ? 'rgba(17, 24, 39, 0.92)'
                : 'rgba(255, 255, 255, 0.95)',
            boxShadow: '0 16px 48px rgba(0, 0, 0, 0.25)',
          }}
        >
          {/* HEADER */}
          <Box
            sx={{
              p: 2,
              background: 'linear-gradient(135deg, rgba(108,99,255,0.15) 0%, rgba(0,188,212,0.1) 100%)',
              borderBottom: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <Avatar
                src="/ai-assistant-icon.png"
                sx={{
                  width: 40,
                  height: 40,
                  boxShadow: '0 2px 10px rgba(124, 58, 237, 0.4)',
                  border: '1.5px solid rgba(255, 255, 255, 0.3)',
                }}
              />
              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Typography variant="subtitle1" fontWeight={800} noWrap>
                  Trợ lý MusicFlow
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap>
                  {isLoading ? 'Đang xử lý...' : 'Trực tuyến'}
                </Typography>
              </Box>

              {/* Toolbar Actions */}
              <Stack direction="row" spacing={0.5}>
                {showHistory ? (
                  <Tooltip title="Quay lại">
                    <IconButton size="small" onClick={() => setShowHistory(false)}>
                      <BackIcon />
                    </IconButton>
                  </Tooltip>
                ) : (
                  <>
                    <Tooltip title="Cuộc trò chuyện mới">
                      <IconButton size="small" onClick={() => startNewConversation('global')}>
                        <AddIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Lịch sử chat">
                      <IconButton size="small" onClick={() => setShowHistory(true)}>
                        <HistoryIcon />
                      </IconButton>
                    </Tooltip>
                  </>
                )}
                <IconButton size="small" onClick={() => setIsOpen(false)}>
                  <CloseIcon />
                </IconButton>
              </Stack>
            </Stack>
          </Box>

          {/* MAIN PANEL CONTENT */}
          <Box sx={{ flexGrow: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            {showHistory ? (
              /* HISTORY VIEW */
              <Box sx={{ p: 1.5 }}>
                <Typography variant="overline" color="text.secondary" sx={{ px: 1, display: 'block', mb: 1 }}>
                  Lịch sử hội thoại
                </Typography>
                {conversations.length === 0 ? (
                  <Stack spacing={2} alignItems="center" justifyContent="center" sx={{ py: 8, color: 'text.secondary' }}>
                    <ChatIcon sx={{ fontSize: 40, opacity: 0.5 }} />
                    <Typography variant="body2">Chưa có cuộc hội thoại nào.</Typography>
                  </Stack>
                ) : (
                  <List disablePadding>
                    {conversations.map((conv) => (
                      <ListItem
                        key={conv._id}
                        disablePadding
                        secondaryAction={
                          <IconButton
                            edge="end"
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteConversation(conv._id);
                            }}
                            sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' } }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        }
                        sx={{
                          mb: 0.5,
                          borderRadius: 2,
                          overflow: 'hidden',
                          bgcolor: activeConversationId === conv._id ? 'action.selected' : 'transparent',
                        }}
                      >
                        <ListItemButton
                          onClick={async () => {
                            setShowHistory(false);
                            await loadConversationDetail(conv._id);
                          }}
                        >
                          <ListItemText
                            primary={conv.title || 'Hội thoại không tiêu đề'}
                            secondary={conv.lastMessage || 'Trống'}
                            primaryTypographyProps={{
                              noWrap: true,
                              fontSize: 14,
                              fontWeight: activeConversationId === conv._id ? 700 : 500,
                            }}
                            secondaryTypographyProps={{
                              noWrap: true,
                              fontSize: 12,
                            }}
                          />
                        </ListItemButton>
                      </ListItem>
                    ))}
                  </List>
                )}
              </Box>
            ) : (
              /* CHAT MESSAGES VIEW */
              <Box sx={{ p: 2, flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {messages.length === 0 ? (
                  <Stack
                    spacing={2.5}
                    alignItems="center"
                    justifyContent="center"
                    sx={{ flexGrow: 1, py: 6, textAlign: 'center', px: 2 }}
                  >
                    <SparklesIcon sx={{ fontSize: 48, color: 'primary.main', opacity: 0.8 }} />
                    <Box>
                      <Typography variant="subtitle1" fontWeight={800} gutterBottom>
                        Mình có thể giúp gì cho bạn?
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Hỏi mình về thông tin âm nhạc, yêu cầu phát bài hát, hoặc tạo danh sách nhạc theo tâm trạng nhé.
                      </Typography>
                    </Box>
                  </Stack>
                ) : (
                  messages.map((msg) => {
                    const isAssistant = msg.role === 'assistant';
                    const imageUrl = isAssistant ? (msg.metadata?.imageUrl || 
                      msg.metadata?.image || 
                      (msg.content && msg.content.match(/\((https:\/\/image\.pollinations\.ai[^)]+)\)/)?.[1])) : null;
                    const cleanContent = msg.content 
                      ? msg.content.replace(/!\[.*?\]\(https:\/\/.*?\)/g, '').trim() 
                      : '';

                    return (
                      <Stack
                        key={msg._id}
                        direction="row"
                        justifyContent={isAssistant ? 'flex-start' : 'flex-end'}
                        spacing={1}
                        sx={{ maxWidth: '85%', alignSelf: isAssistant ? 'flex-start' : 'flex-end' }}
                      >
                        {isAssistant && (
                          <Avatar
                            sx={{
                              bgcolor: 'primary.main',
                              width: 28,
                              height: 28,
                              fontSize: 12,
                            }}
                          >
                            <SparklesIcon sx={{ fontSize: 14 }} />
                          </Avatar>
                        )}
                        <Stack spacing={1} sx={{ minWidth: 0, flexGrow: 1 }}>
                          <Paper
                            sx={{
                              p: 1.5,
                              borderRadius: isAssistant ? '0px 14px 14px 14px' : '14px 0px 14px 14px',
                              bgcolor: isAssistant
                                ? (theme) => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : '#f1f5f9')
                                : 'primary.main',
                              color: isAssistant ? 'text.primary' : 'white',
                              border: isAssistant ? '1px solid' : 'none',
                              borderColor: 'divider',
                            }}
                          >
                            {cleanContent && (
                              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5 }}>
                                {cleanContent}
                              </Typography>
                            )}

                            {/* Render AI Generated Image Preview if available */}
                            {imageUrl && (
                              <Box
                                sx={{
                                  mt: cleanContent ? 1.5 : 0,
                                  borderRadius: 2.5,
                                  overflow: 'hidden',
                                  border: '1px solid rgba(139,92,246,0.35)',
                                  boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                                  width: '100%',
                                }}
                              >
                                <Box
                                  sx={{
                                    position: 'relative',
                                    width: '100%',
                                    paddingTop: '100%', // 1:1 Aspect Ratio Square
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
                                    alt={msg.metadata?.prompt || 'AI Artwork'}
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
                                      startIcon={<OpenIcon sx={{ fontSize: 14 }} />}
                                      sx={{
                                        borderRadius: 20,
                                        bgcolor: 'rgba(255,255,255,0.9)',
                                        color: '#0f172a',
                                        fontWeight: 700,
                                        fontSize: 11,
                                        textTransform: 'none',
                                        px: 1.5,
                                        '&:hover': { bgcolor: '#ffffff' },
                                      }}
                                    >
                                      Xem full HD
                                    </Button>
                                  </Box>
                                </Box>

                                {/* Bottom Action Footer Bar */}
                                <Stack
                                  direction="row"
                                  alignItems="center"
                                  justifyContent="space-between"
                                  sx={{
                                    px: 1.5,
                                    py: 1,
                                    bgcolor: (theme) =>
                                      theme.palette.mode === 'dark' ? 'rgba(15, 23, 42, 0.95)' : '#f1f5f9',
                                    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                                  }}
                                >
                                  <Stack direction="row" spacing={0.5} alignItems="center">
                                    <SparklesIcon sx={{ fontSize: 13, color: '#a855f7' }} />
                                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: 10 }}>
                                      AI Cover (1024×1024)
                                    </Typography>
                                  </Stack>

                                  <Button
                                    variant="contained"
                                    size="small"
                                    startIcon={<DownloadIcon sx={{ fontSize: 13 }} />}
                                    onClick={() => window.open(imageUrl, '_blank')}
                                    sx={{
                                      borderRadius: 10,
                                      background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                                      color: '#fff',
                                      fontWeight: 700,
                                      fontSize: 10,
                                      textTransform: 'none',
                                      px: 1.25,
                                      py: 0.25,
                                      minWidth: 0,
                                      boxShadow: '0 2px 6px rgba(124, 58, 237, 0.35)',
                                      '&:hover': {
                                        background: 'linear-gradient(135deg, #6d28d9, #4338ca)',
                                      },
                                    }}
                                  >
                                    Tải về
                                  </Button>
                                </Stack>
                              </Box>
                            )}
                          </Paper>
                          {isAssistant && msg.playlistId && (
                            <CompactPlaylistCard
                              playlistId={msg.playlistId}
                              playlists={playlists}
                              onPlaySong={(song, songs) => executeCapability('PLAY_SONG', { song, songs })}
                              onPlayAll={(songs) => executeCapability('LOAD_PLAYLIST', { songs })}
                            />
                          )}

                        </Stack>
                      </Stack>
                    );
                  })
                )}

                {/* Loader Pulse bubble */}
                {isLoading && (
                  <Stack direction="row" spacing={1} sx={{ maxWidth: '85%', alignSelf: 'flex-start' }}>
                    <Avatar sx={{ bgcolor: 'primary.main', width: 28, height: 28 }}>
                      <SparklesIcon sx={{ fontSize: 14 }} />
                    </Avatar>
                    <Paper
                      sx={{
                        p: 1.5,
                        borderRadius: '0px 14px 14px 14px',
                        bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : '#f1f5f9'),
                        border: '1px solid',
                        borderColor: 'divider',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: 60,
                      }}
                    >
                      <CircularProgress size={16} color="primary" />
                    </Paper>
                  </Stack>
                )}
                <div ref={messagesEndRef} />
              </Box>
            )}
          </Box>

          {/* COMPOSER & QUICK ACTIONS */}
          {!showHistory && (
            <Box
              sx={{
                p: 2,
                borderTop: '1px solid',
                borderColor: 'divider',
                bgcolor: (theme) =>
                  theme.palette.mode === 'dark'
                    ? 'rgba(31, 41, 55, 0.4)'
                    : 'rgba(248, 250, 252, 0.8)',
              }}
            >
              {/* Quick Actions Tags */}
              {messages.length === 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, fontWeight: 700 }}>
                    Gợi ý nhanh:
                  </Typography>
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ gap: 1 }}>
                    {getQuickPrompts().map((prompt, idx) => (
                      <Button
                        key={idx}
                        variant="outlined"
                        size="small"
                        onClick={() => sendMessage(prompt.text)}
                        sx={{
                          borderRadius: 4,
                          textTransform: 'none',
                          fontSize: 11,
                          py: 0.5,
                          px: 1.5,
                          color: 'text.secondary',
                          borderColor: 'divider',
                          '&:hover': {
                            color: 'primary.main',
                            borderColor: 'primary.main',
                            bgcolor: 'primary.lighter',
                          },
                        }}
                      >
                        {prompt.label}
                      </Button>
                    ))}
                  </Stack>
                </Box>
              )}

              {/* Live Voice Indicator Banner */}
              {isVoiceListening && (
                <Box
                  sx={{
                    mb: 1,
                    px: 1.5,
                    py: 0.75,
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    bgcolor: (theme) =>
                      theme.palette.mode === 'dark' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                  }}
                >
                  <MicIcon
                    sx={{
                      fontSize: 16,
                      color: '#ef4444',
                      animation: 'pulseVoiceAssistant 1.4s infinite ease-in-out',
                      '@keyframes pulseVoiceAssistant': {
                        '0%': { transform: 'scale(1)' },
                        '50%': { transform: 'scale(1.2)' },
                        '100%': { transform: 'scale(1)' },
                      },
                    }}
                  />
                  <Typography variant="caption" sx={{ color: 'text.primary', fontWeight: 600, flexGrow: 1 }} noWrap>
                    {inputText ? `"${inputText}"` : 'Đang lắng nghe câu hỏi của bạn...'}
                  </Typography>
                  <Button
                    size="small"
                    color="error"
                    onClick={stopVoiceListening}
                    sx={{ minWidth: 0, p: 0, fontSize: 11, fontWeight: 700, textTransform: 'none' }}
                  >
                    Xong
                  </Button>
                </Box>
              )}

              {/* Text Input */}
              <TextField
                fullWidth
                size="small"
                placeholder={isVoiceListening ? "Đang lắng nghe bạn nói..." : "Nhắn tin cho trợ lý..."}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyPress}
                disabled={isLoading}
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <Tooltip title={isVoiceListening ? "Đang nghe... Bấm để dừng" : "Nói chuyện bằng giọng nói"}>
                          <IconButton
                            size="small"
                            onClick={handleToggleVoice}
                            disabled={isLoading}
                            sx={{
                              mr: 0.5,
                              color: isVoiceListening ? '#ef4444' : 'text.secondary',
                              bgcolor: isVoiceListening ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
                              animation: isVoiceListening ? 'pulseVoiceAssistantBtn 1.4s infinite ease-in-out' : 'none',
                              '@keyframes pulseVoiceAssistantBtn': {
                                '0%': { transform: 'scale(1)', boxShadow: '0 0 0 0 rgba(239, 68, 68, 0.6)' },
                                '50%': { transform: 'scale(1.15)', boxShadow: '0 0 0 6px rgba(239, 68, 68, 0)' },
                                '100%': { transform: 'scale(1)', boxShadow: '0 0 0 0 rgba(239, 68, 68, 0)' },
                              },
                              '&:hover': {
                                color: isVoiceListening ? '#dc2626' : 'primary.main',
                                bgcolor: isVoiceListening ? 'rgba(239, 68, 68, 0.25)' : 'rgba(108, 99, 255, 0.1)',
                              },
                            }}
                          >
                            <MicIcon sx={{ fontSize: 19 }} />
                          </IconButton>
                        </Tooltip>
                        <IconButton
                          edge="end"
                          color="primary"
                          onClick={handleSend}
                          disabled={!inputText.trim() || isLoading}
                        >
                          <SendIcon />
                        </IconButton>
                      </InputAdornment>
                    ),
                    sx: {
                      borderRadius: '24px',
                      pr: 1.5,
                    },
                  },
                }}
              />
            </Box>
          )}
        </Paper>
      </Collapse>

      {/* Dialog Nâng cấp cước khi hết hạn mức AI */}
      <Dialog
        open={upgradeDialogOpen}
        onClose={() => setUpgradeDialogOpen(false)}
        PaperProps={{
          sx: {
            background: 'rgba(21, 21, 35, 0.95)',
            backdropFilter: 'blur(10px)',
            borderRadius: '16px',
            border: '1px solid rgba(108, 99, 255, 0.2)',
            color: 'white',
            maxWidth: '400px',
            width: '100%',
            p: 1,
            zIndex: 1400,
          }
        }}
      >
        <DialogContent sx={{ textAlign: 'center', p: 3 }}>
          <Box
            sx={{
              width: 54,
              height: 54,
              borderRadius: '50%',
              bgcolor: 'rgba(108, 99, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              border: '1px solid rgba(108, 99, 255, 0.3)',
            }}
          >
            <SparklesIcon sx={{ color: '#ffd700', fontSize: 28 }} />
          </Box>
          
          <Typography variant="h6" fontWeight={850} gutterBottom sx={{
            background: 'linear-gradient(90deg, #6c63ff, #00bcd4)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            Hết hạn mức AI hôm nay
          </Typography>
          
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
            {localStorage.getItem('role') === 'artist'
              ? 'Tài khoản Nghệ sĩ của bạn đã đạt giới hạn yêu cầu trợ lý AI Studio trong 24 giờ. Nâng cấp Artist Studio Pro để nhận 70 lượt/24h và mở rộng kho lưu trữ 5GB!'
              : 'Tài khoản của bạn đã sử dụng hết số lượt yêu cầu trợ lý AI trong ngày. Nâng cấp các gói cước Premium để mở rộng hạn mức và trò chuyện AI không giới hạn!'}
          </Typography>

          <Stack spacing={1}>
            <Button
              variant="contained"
              fullWidth
              onClick={() => {
                setUpgradeDialogOpen(false);
                setIsOpen(false);
                if (localStorage.getItem('role') === 'artist') {
                  navigate('/artist/pro');
                } else {
                  navigate('/premium');
                }
              }}
              sx={{
                bgcolor: '#6c63ff',
                '&:hover': { bgcolor: '#574feb' },
                fontWeight: 700,
                borderRadius: '8px',
                py: 1,
                textTransform: 'none',
              }}
            >
              {localStorage.getItem('role') === 'artist' ? 'Nâng cấp Artist Studio Pro' : 'Nâng cấp tài khoản ngay'}
            </Button>
            <Button
              variant="text"
              fullWidth
              onClick={() => setUpgradeDialogOpen(false)}
              sx={{
                color: 'text.secondary',
                fontWeight: 600,
                borderRadius: '8px',
                textTransform: 'none',
              }}
            >
              Để sau
            </Button>
          </Stack>
        </DialogContent>
      </Dialog>
    </Box>
  );
}

// Hỗ trợ hiển thị Playlist thu nhỏ trong khung chat trợ lý
function CompactPlaylistCard({ playlistId, playlists, onPlaySong, onPlayAll }) {
  const playlist = playlists.find(p => p._id === playlistId || p.id === playlistId);
  const { currentSong, isPlaying, executeCapability } = useAssistant();
  const containerRef = useRef(null);
  
  const songs = playlist?.songs || [];

  const isCurrentPlaylistPlaying = (() => {
    if (!isPlaying || !currentSong) return false;
    return songs.some(song => song._id === currentSong._id || song.id === currentSong._id);
  })();

  useEffect(() => {
    if (!currentSong || !containerRef.current) return;

    // Find the element of the currently playing song inside our container
    const activeElement = containerRef.current.querySelector('.active-song-item');
    if (activeElement) {
      const container = containerRef.current;
      const parentRect = container.getBoundingClientRect();
      const childRect = activeElement.getBoundingClientRect();

      // Check if the playing song element is out of the container's visible area
      const isOutOfView = childRect.top < parentRect.top || childRect.bottom > parentRect.bottom;

      if (isOutOfView) {
        activeElement.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest'
        });
      }
    }
  }, [currentSong]);

  const handlePlayAllClick = (e) => {
    e.stopPropagation();
    if (isCurrentPlaylistPlaying) {
      executeCapability('TOGGLE_PLAY');
    } else {
      const isSongInPlaylist = currentSong && songs.some(song => song._id === currentSong._id || song.id === currentSong._id);
      if (isSongInPlaylist) {
        executeCapability('TOGGLE_PLAY');
      } else {
        onPlayAll(songs);
      }
    }
  };

  return (
    <Paper
      elevation={2}
      sx={{
        mt: 1,
        p: 1.5,
        borderRadius: 2.5,
        border: '1px solid rgba(139, 92, 246, 0.25)',
        background: (theme) => theme.palette.mode === 'dark' ? 'rgba(30, 41, 59, 0.7)' : '#f8fafc',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <SparklesIcon sx={{ color: '#8b5cf6', fontSize: 16 }} />
        <Typography variant="caption" fontWeight={850} noWrap sx={{ flexGrow: 1, color: 'text.primary' }}>
          {playlist.title}
        </Typography>

        {songs.length > 0 && (
          <Tooltip title={isCurrentPlaylistPlaying ? "Tạm dừng" : "Phát tất cả"}>
            <IconButton
              size="small"
              onClick={handlePlayAllClick}
              sx={{
                color: '#8b5cf6',
                p: 0.5,
                bgcolor: 'rgba(139, 92, 246, 0.1)',
                '&:hover': {
                  bgcolor: 'rgba(139, 92, 246, 0.2)',
                }
              }}
            >
              {isCurrentPlaylistPlaying ? (
                <PauseIcon sx={{ fontSize: 18 }} />
              ) : (
                <PlayIcon sx={{ fontSize: 18 }} />
              )}
            </IconButton>
          </Tooltip>
        )}
      </Stack>
      <Divider sx={{ my: 0.75 }} />
      <Stack
        ref={containerRef}
        spacing={0.5}
        sx={{
          maxHeight: '30vh',
          overflowY: 'auto',
          pr: 0.5,
          '&::-webkit-scrollbar': {
            width: '4px',
          },
          '&::-webkit-scrollbar-track': {
            background: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            background: 'rgba(139, 92, 246, 0.3)',
            borderRadius: '4px',
          },
          '&::-webkit-scrollbar-thumb:hover': {
            background: 'rgba(139, 92, 246, 0.5)',
          },
        }}
      >
        {songs.map((song, index) => {
          if (!song) return null;
          const artistName = Array.isArray(song.artists)
            ? song.artists.map((a) => a?.name || a).filter(Boolean).join(', ')
            : 'Nghệ sĩ ẩn danh';

          const isCurrentSong = currentSong && (currentSong._id === song._id || currentSong.id === song._id);

          return (
            <Stack
              key={song._id || index}
              direction="row"
              alignItems="center"
              spacing={1}
              onClick={() => onPlaySong(song, songs)}
              className={isCurrentSong ? 'active-song-item' : ''}
              sx={{
                p: 0.5,
                borderRadius: 1,
                cursor: 'pointer',
                bgcolor: isCurrentSong ? 'rgba(139, 92, 246, 0.12)' : 'transparent',
                transition: 'all 0.2s ease',
                '&:hover': {
                  bgcolor: isCurrentSong ? 'rgba(139, 92, 246, 0.2)' : 'action.hover'
                }
              }}
            >
              <Avatar
                src={song.imageUrl}
                variant="rounded"
                sx={{ width: 24, height: 24, borderRadius: 0.5 }}
              >
                <MusicIcon sx={{ fontSize: 14 }} />
              </Avatar>
              <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                <Typography
                  variant="caption"
                  fontWeight={isCurrentSong ? 850 : 700}
                  noWrap
                  sx={{
                    display: 'block',
                    fontSize: 11,
                    lineHeight: 1.2,
                    color: isCurrentSong ? '#8b5cf6' : 'text.primary'
                  }}
                >
                  {song.title}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', fontSize: 9, lineHeight: 1 }}>
                  {artistName}
                </Typography>
              </Box>
            </Stack>
          );
        })}
        {songs.length === 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', p: 1, textAlign: 'center' }}>
            Chưa có bài hát nào.
          </Typography>
        )}
      </Stack>
    </Paper>
  );
}
