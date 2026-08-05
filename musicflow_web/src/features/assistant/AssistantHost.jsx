import { useEffect, useRef, useState } from 'react';
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
} from '@mui/icons-material';
import { useAssistant } from './AssistantProvider';

export default function AssistantHost() {
  const {
    isOpen,
    setIsOpen,
    conversations,
    activeConversationId,
    messages,
    isLoading,
    sendMessage,
    loadConversationDetail,
    startNewConversation,
    deleteConversation,
  } = useAssistant();

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [inputText, setInputText] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const messagesEndRef = useRef(null);

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
  const hasPlayer = userRole === 'user'; // Client player is active for regular user role

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

  const getQuickPrompts = () => {
    if (userRole === 'artist') {
      return [
        { label: '📊 Thống kê lượt nghe', text: 'Thống kê lượt nghe của tôi' },
        { label: '🎵 Nhạc đã đăng', text: 'Danh sách nhạc tôi đã upload' },
        { label: '📤 Tải bài hát mới', text: 'Mở trang upload nhạc' },
      ];
    }
    if (userRole === 'admin') {
      return [
        { label: '📈 Stats hệ thống', text: 'Hệ thống có bao nhiêu bài hát' },
        { label: '👥 Quản lý tài khoản', text: 'Tìm tài khoản email admin@musicflow.com' },
        { label: '⚙️ Trang Dashboard', text: 'Mở trang Dashboard admin' },
      ];
    }
    return [
      { label: '🌧️ Nhạc buồn lofi', text: 'Gợi ý playlist nhạc buồn lofi tâm trạng' },
      { label: '☕ Nhạc chill', text: 'Bật cho mình một bài hát chill nhẹ nhàng' },
      { label: '❤️ Bài hát yêu thích', text: 'Mở trang danh sách bài hát yêu thích' },
    ];
  };

  return (
    <Box sx={{ position: 'fixed', zIndex: 9999 }}>
      {/* LAUNCHER BUTTON */}
      {!isOpen && (
        <Tooltip title="Trợ lý AI MusicFlow" placement="left">
          <IconButton
            onPointerDown={handlePointerDown}
            onClick={handleButtonClick}
            sx={{
              position: 'fixed',
              bottom: hasPlayer ? '104px' : '24px', // Shift up on client view to clear player bar
              right: '24px',
              width: 56,
              height: 56,
              bgcolor: 'primary.main',
              color: 'white',
              boxShadow: '0 8px 32px rgba(108, 99, 255, 0.4)',
              transform: `translate(${position.x}px, ${position.y}px)`,
              cursor: isDragging ? 'grabbing' : 'pointer',
              touchAction: 'none',
              transition: 'background-color 0.2s, box-shadow 0.2s, color 0.2s',
              '&:hover': {
                bgcolor: 'primary.dark',
                transform: `translate(${position.x}px, ${position.y}px) scale(1.1) rotate(10deg)`,
                boxShadow: '0 12px 40px rgba(108, 99, 255, 0.6)',
              },
              '&:active': {
                transform: `translate(${position.x}px, ${position.y}px) scale(0.95)`,
              },
            }}
          >
            <SparklesIcon sx={{ fontSize: 28 }} />
          </IconButton>
        </Tooltip>
      )}

      {/* CHAT PANEL */}
      <Collapse in={isOpen}>
        <Paper
          elevation={24}
          sx={{
            position: 'fixed',
            bottom: isMobile ? 0 : (hasPlayer ? '104px' : '24px'),
            right: isMobile ? 0 : '24px',
            width: isMobile ? '100vw' : 400,
            height: isMobile ? '100vh' : 600,
            borderRadius: isMobile ? 0 : 4,
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
                sx={{
                  bgcolor: 'primary.main',
                  background: 'linear-gradient(135deg, #6c63ff 0%, #00bcd4 100%)',
                  width: 38,
                  height: 38,
                }}
              >
                <SparklesIcon sx={{ fontSize: 20, color: 'white' }} />
              </Avatar>
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
                          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5 }}>
                            {msg.content}
                          </Typography>
                        </Paper>
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

              {/* Text Input */}
              <TextField
                fullWidth
                size="small"
                placeholder="Nhắn tin cho trợ lý..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyPress}
                disabled={isLoading}
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
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
                      borderRadius: 4,
                      pr: 1.5,
                    },
                  },
                }}
              />
            </Box>
          )}
        </Paper>
      </Collapse>
    </Box>
  );
}
