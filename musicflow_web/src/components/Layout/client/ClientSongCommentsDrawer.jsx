import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Drawer,
  Box,
  Stack,
  Typography,
  IconButton,
  Avatar,
  TextField,
  Button,
  Menu,
  MenuItem,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Chip,
  Tooltip,
  useTheme,
  Collapse,
} from '@mui/material';
import {
  CloseRounded as CloseIcon,
  ChatBubbleRounded as CommentIcon,
  SendRounded as SendIcon,
  MoreHorizRounded as MoreIcon,
  ReplyRounded as ReplyIcon,
  EditRounded as EditIcon,
  DeleteOutlineRounded as DeleteIcon,
  PlayArrowRounded as PlayIcon,
  PauseRounded as PauseIcon,
  MusicNoteRounded as MusicNoteIcon,
  LocalFireDepartmentRounded as FireIcon,
  BoltRounded as BoltIcon,
  VerifiedRounded as VerifiedIcon,
  KeyboardArrowDownRounded as ArrowDownIcon,
  KeyboardArrowUpRounded as ArrowUpIcon,
  SubdirectoryArrowRightRounded as ReplyThreadIcon,
} from '@mui/icons-material';
import { useClientPlayer } from './ClientPlayerProvider';
import { clientCommentsApi } from '../../../services/client/client.service';
import useAppToast from '../../../components/common/js/useAppToast';
import SongCommentReactions from '../../../components/common/ui/SongCommentReactions';

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Vừa xong';
  if (diffMins < 60) return `${diffMins} phút trước`;
  if (diffHours < 24) return `${diffHours} giờ trước`;
  if (diffDays < 7) return `${diffDays} ngày trước`;

  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const QUICK_EMOJIS = ['❤️', '🔥', '👏', '🎵', '✨'];

function ClientSongCommentsDrawer({
  open,
  onClose,
  commentCount = 0,
  onCommentCountChanged,
  targetCommentId = null,
  onClearTargetComment,
  targetSong = null,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useAppToast();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { currentSong, playSong, isPlaying, togglePlayPause } = useClientPlayer();
  const activeSong = targetSong || currentSong;
  const isCurrentPlaying = Boolean(isPlaying && currentSong?._id === activeSong?._id);

  const currentUserId = localStorage.getItem('userId');
  const isLoggedIn = Boolean(localStorage.getItem('role'));
  const myAvatar = localStorage.getItem('avatar') || localStorage.getItem('userAvatar') || '';
  const myName = localStorage.getItem('name') || localStorage.getItem('userName') || 'Bạn';

  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sending, setSending] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('top');
  const [inputText, setInputText] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [expandedReplies, setExpandedReplies] = useState({});
  const [highlightedCommentId, setHighlightedCommentId] = useState(null);
  const handledTargetCommentRef = useRef(null);

  // Reset target tracking when drawer closes
  useEffect(() => {
    if (!open) {
      handledTargetCommentRef.current = null;
      setHighlightedCommentId(null);
    }
  }, [open]);

  const toggleReplies = (commentId) => {
    setExpandedReplies((prev) => ({
      ...prev,
      [commentId]: !prev[commentId],
    }));
  };

  const countAllReplies = (c) => {
    if (!c.replies || c.replies.length === 0) return 0;
    return c.replies.reduce((sum, r) => sum + 1 + countAllReplies(r), 0);
  };

  // Menu control states
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [selectedCommentForMenu, setSelectedCommentForMenu] = useState(null);

  // Edit / Delete states
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editText, setEditText] = useState('');
  const [deleteConfirmComment, setDeleteConfirmComment] = useState(null);

  const listRef = useRef(null);

  // Scroll and highlight target comment bubble once when drawer opens from notification
  useEffect(() => {
    if (!open || !targetCommentId || comments.length === 0) return;
    if (handledTargetCommentRef.current === targetCommentId) return;

    handledTargetCommentRef.current = targetCommentId;

    // Find and expand all parent branches so the target is fully visible
    const findParentChain = (nodes, targetId, chain = []) => {
      for (const node of nodes) {
        if (node._id === targetId) return chain;
        if (node.replies && node.replies.length > 0) {
          const res = findParentChain(node.replies, targetId, [...chain, node._id]);
          if (res) return res;
        }
      }
      return null;
    };

    const parentChain = findParentChain(comments, targetCommentId);
    if (parentChain && parentChain.length > 0) {
      setExpandedReplies((prev) => {
        const next = { ...prev };
        parentChain.forEach((id) => {
          next[id] = true;
        });
        return next;
      });
    }

    // Highlight only the targeted comment bubble
    setHighlightedCommentId(targetCommentId);

    const scrollTimer = setTimeout(() => {
      const el =
        document.getElementById(`comment-bubble-${targetCommentId}`) ||
        document.getElementById(`comment-${targetCommentId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 280);

    // Auto-fade highlight after 2.5s and clear targetComment
    const clearTimer = setTimeout(() => {
      setHighlightedCommentId(null);
      if (onClearTargetComment) {
        onClearTargetComment();
      }
    }, 2500);

    return () => {
      clearTimeout(scrollTimer);
      clearTimeout(clearTimer);
    };
  }, [open, targetCommentId, comments, onClearTargetComment]);

  const fetchComments = useCallback(async (reset = false) => {
    if (!activeSong?._id) return;

    if (reset) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const pageToFetch = reset ? 1 : page + 1;
      const response = await clientCommentsApi.getSongComments(activeSong._id, {
        sort,
        page: pageToFetch,
        limit: 10,
      });

      if (response.data?.success) {
        const fetched = response.data.comments || [];
        setComments((prev) => (reset ? fetched : [...prev, ...fetched]));
        setHasMore(response.data.hasMore || false);
        setPage(response.data.page || 1);
        if (onCommentCountChanged) {
          onCommentCountChanged(response.data.totalComments || 0);
        }
      }
    } catch (error) {
      showToast({
        severity: 'error',
        title: 'Lỗi tải bình luận',
        message: error.response?.data?.message || 'Không thể lấy danh sách bình luận.',
      });
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [activeSong?._id, page, sort, onCommentCountChanged, showToast]);

  // Initial fetch or when song / sort changes
  useEffect(() => {
    if (open && activeSong?._id) {
      fetchComments(true);
    } else if (!open) {
      setComments([]);
      setReplyingTo(null);
      setEditingCommentId(null);
    }
  }, [open, activeSong?._id, sort, fetchComments]);

  const triggerLogin = () => {
    const nextParams = new URLSearchParams(location.search);
    nextParams.set('auth', 'login');
    navigate(`${location.pathname}?${nextParams.toString()}`, { replace: true });
    showToast({
      severity: 'info',
      title: 'Yêu cầu đăng nhập',
      message: 'Vui lòng đăng nhập để bình luận hoặc tương tác.',
    });
  };

  const handleTogglePlaySong = () => {
    if (isCurrentPlaying) {
      togglePlayPause?.();
    } else if (activeSong && playSong) {
      playSong(activeSong);
    }
  };

  const handleSend = async () => {
    if (!isLoggedIn) {
      triggerLogin();
      return;
    }

    if (!inputText.trim() || !activeSong?._id) return;

    setSending(true);
    try {
      const response = await clientCommentsApi.create({
        songId: activeSong._id,
        content: inputText.trim(),
        parentCommentId: replyingTo ? replyingTo._id : null,
      });

      if (response.data?.success) {
        const parentId = replyingTo ? replyingTo._id : null;
        setInputText('');
        setReplyingTo(null);
        showToast({
          severity: 'success',
          title: 'Thành công',
          message: parentId ? 'Đã gửi câu trả lời.' : 'Đã đăng bình luận.',
        });
        if (parentId) {
          setExpandedReplies((prev) => ({ ...prev, [parentId]: true }));
        }
        await fetchComments(true);
      }
    } catch (error) {
      showToast({
        severity: 'error',
        title: 'Lỗi gửi bình luận',
        message: error.response?.data?.message || 'Không thể đăng bình luận.',
      });
    } finally {
      setSending(false);
    }
  };

  const handleSelectReaction = async (comment, reactionType) => {
    if (!isLoggedIn) {
      triggerLogin();
      return;
    }

    const currentReaction = comment.reactions?.find(
      (r) => String(r.userId) === String(currentUserId)
    );
    const prevType = currentReaction?.type;

    const updateInTree = (nodes) =>
      nodes.map((node) => {
        if (node._id === comment._id) {
          const nextReactions = (node.reactions || []).filter(
            (r) => String(r.userId) !== String(currentUserId)
          );
          nextReactions.push({ userId: currentUserId, type: reactionType });

          const nextSummary = { ...(node.reactionSummary || {}) };
          if (prevType && nextSummary[prevType]) {
            nextSummary[prevType] = Math.max(0, nextSummary[prevType] - 1);
          }
          nextSummary[reactionType] = (nextSummary[reactionType] || 0) + 1;

          return {
            ...node,
            reactions: nextReactions,
            reactionCount: prevType ? (node.reactionCount || 1) : ((node.reactionCount || 0) + 1),
            reactionSummary: nextSummary,
          };
        }
        if (node.replies && node.replies.length > 0) {
          return { ...node, replies: updateInTree(node.replies) };
        }
        return node;
      });

    setComments((prev) => updateInTree(prev));

    try {
      await clientCommentsApi.react(comment._id, reactionType);
    } catch (err) {
      console.warn('Failed to add reaction:', err);
      fetchComments(true);
    }
  };

  const handleRemoveReaction = async (comment) => {
    if (!isLoggedIn) return;

    const currentReaction = comment.reactions?.find(
      (r) => String(r.userId) === String(currentUserId)
    );
    if (!currentReaction) return;

    const prevType = currentReaction.type;

    const removeFromTree = (nodes) =>
      nodes.map((node) => {
        if (node._id === comment._id) {
          const nextReactions = (node.reactions || []).filter(
            (r) => String(r.userId) !== String(currentUserId)
          );

          const nextSummary = { ...(node.reactionSummary || {}) };
          if (prevType && nextSummary[prevType]) {
            nextSummary[prevType] = Math.max(0, nextSummary[prevType] - 1);
          }

          return {
            ...node,
            reactions: nextReactions,
            reactionCount: Math.max(0, (node.reactionCount || 1) - 1),
            reactionSummary: nextSummary,
          };
        }
        if (node.replies && node.replies.length > 0) {
          return { ...node, replies: removeFromTree(node.replies) };
        }
        return node;
      });

    setComments((prev) => removeFromTree(prev));

    try {
      await clientCommentsApi.removeReaction(comment._id);
    } catch (err) {
      console.warn('Failed to remove reaction:', err);
      fetchComments(true);
    }
  };

  // Dropdown menu trigger
  const handleOpenMenu = (event, comment) => {
    setMenuAnchor(event.currentTarget);
    setSelectedCommentForMenu(comment);
  };

  const handleCloseMenu = () => {
    setMenuAnchor(null);
    setSelectedCommentForMenu(null);
  };

  // Edit Comment actions
  const handleTriggerEdit = () => {
    if (!selectedCommentForMenu) return;
    setEditingCommentId(selectedCommentForMenu._id);
    setEditText(selectedCommentForMenu.content);
    handleCloseMenu();
  };

  const handleCancelEdit = () => {
    setEditingCommentId(null);
    setEditText('');
  };

  const handleSaveEdit = async (commentId) => {
    if (!editText.trim()) return;

    try {
      const response = await clientCommentsApi.update(commentId, editText.trim());
      if (response.data?.success) {
        setEditingCommentId(null);
        setEditText('');
        showToast({
          severity: 'success',
          title: 'Thành công',
          message: 'Đã cập nhật bình luận.',
        });
        await fetchComments(true);
      }
    } catch (error) {
      showToast({
        severity: 'error',
        title: 'Lỗi cập nhật bình luận',
        message: error.response?.data?.message || 'Không thể cập nhật bình luận.',
      });
    }
  };

  // Delete Comment actions
  const handleTriggerDelete = () => {
    if (!selectedCommentForMenu) return;
    setDeleteConfirmComment(selectedCommentForMenu);
    handleCloseMenu();
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmComment) return;

    try {
      const response = await clientCommentsApi.delete(deleteConfirmComment._id);
      if (response.data?.success) {
        showToast({
          severity: 'success',
          title: 'Thành công',
          message: 'Đã xóa bình luận.',
        });
        setDeleteConfirmComment(null);
        await fetchComments(true);
      }
    } catch (error) {
      showToast({
        severity: 'error',
        title: 'Lỗi xóa bình luận',
        message: error.response?.data?.message || 'Không thể xóa bình luận.',
      });
    }
  };

  // Render individual comment card (support threaded replies recursively)
  const renderCommentNode = (comment, depth = 0) => {
    const isMine = currentUserId && String(comment.user?._id) === String(currentUserId);
    const isEditing = editingCommentId === comment._id;
    const isSongArtist = Array.isArray(activeSong?.artists) && activeSong.artists.some(
      (a) => String(a?._id || a) === String(comment.user?._id)
    );

    const hasReplies = Boolean(comment.replies && comment.replies.length > 0);
    const isExpanded = Boolean(expandedReplies[comment._id]);
    const totalRepliesCount = hasReplies ? countAllReplies(comment) : 0;

    const avatarGradient = ((comment.user?._id?.charCodeAt(0) || 0) % 2 === 0)
      ? 'linear-gradient(135deg, #22C3A6, #0EA5E9)'
      : 'linear-gradient(135deg, #8B6CFF, #5B8CFF)';

    const isTargetHighlighted = highlightedCommentId === comment._id;

    return (
      <Box
        key={comment._id}
        id={`comment-${comment._id}`}
        sx={{
          pl: depth > 0 ? { xs: 2.2, sm: 3.5 } : 0,
          mt: depth > 0 ? 1.5 : 2,
          position: 'relative',
        }}
      >
        {/* Curved thread line indicator for nested replies */}
        {depth > 0 && (
          <Box
            sx={{
              position: 'absolute',
              left: { xs: 8, sm: 14 },
              top: -14,
              bottom: 'calc(100% - 20px)',
              width: { xs: 12, sm: 16 },
              borderLeft: '2px solid',
              borderBottom: '2px solid',
              borderColor: isDark ? 'rgba(20, 184, 166, 0.3)' : 'rgba(20, 184, 166, 0.35)',
              borderBottomLeftRadius: '12px',
              pointerEvents: 'none',
            }}
          />
        )}

        <Stack direction="row" spacing={1.25} alignItems="flex-start">
          <Avatar
            src={comment.user?.avatar}
            sx={{
              width: depth > 0 ? 32 : 38,
              height: depth > 0 ? 32 : 38,
              background: avatarGradient,
              boxShadow: isDark ? '0 4px 12px rgba(0, 0, 0, 0.4)' : '0 2px 8px rgba(0, 0, 0, 0.12)',
              fontSize: depth > 0 ? 12 : 14,
              fontWeight: 800,
              border: isSongArtist
                ? '2px solid #14b8a6'
                : (isMine ? '2px solid #00bcd4' : (isDark ? '1.5px solid rgba(255, 255, 255, 0.12)' : '1.5px solid rgba(0, 0, 0, 0.08)')),
              flexShrink: 0,
            }}
          >
            {comment.user?.name ? comment.user.name[0].toUpperCase() : 'U'}
          </Avatar>

          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            {/* MusicFlow Comment Bubble Card */}
            <div
              id={`comment-bubble-${comment._id}`}
              className={`mf-comment-bubble ${isMine ? 'is-mine' : ''} ${isTargetHighlighted ? 'is-target-highlighted' : ''}`}
            >
              <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" sx={{ mb: 0.75 }}>
                <Stack direction="row" spacing={0.75} alignItems="center" sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                  <Typography
                    sx={{
                      fontWeight: 750,
                      fontSize: '0.85rem',
                      color: isDark ? '#f8fafc' : '#0f172a',
                    }}
                  >
                    {comment.user?.name || 'Vô danh'}
                  </Typography>

                  {isSongArtist && (
                    <Box
                      sx={{
                        px: 0.8,
                        py: 0.15,
                        borderRadius: '6px',
                        background: 'linear-gradient(135deg, #14b8a6, #06b6d4)',
                        color: '#fff',
                        fontSize: '0.68rem',
                        fontWeight: 800,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.3,
                        boxShadow: '0 2px 6px rgba(20, 184, 166, 0.3)',
                      }}
                    >
                      <VerifiedIcon sx={{ fontSize: 11 }} /> Tác giả
                    </Box>
                  )}

                  {isMine && !isSongArtist && (
                    <Box
                      sx={{
                        px: 0.8,
                        py: 0.15,
                        borderRadius: '6px',
                        bgcolor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                        color: isDark ? 'rgba(255, 255, 255, 0.75)' : '#64748b',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                      }}
                    >
                      Bạn
                    </Box>
                  )}

                  <Typography
                    variant="caption"
                    sx={{
                      color: isDark ? 'rgba(255, 255, 255, 0.45)' : '#94a3b8',
                      fontSize: '0.72rem',
                      userSelect: 'none',
                    }}
                  >
                    • {formatDate(comment.createdAt)}
                  </Typography>
                </Stack>

                {isMine && !isEditing && (
                  <IconButton
                    size="small"
                    onClick={(e) => handleOpenMenu(e, comment)}
                    sx={{
                      color: isDark ? 'rgba(255, 255, 255, 0.45)' : 'rgba(0, 0, 0, 0.4)',
                      p: 0.3,
                      ml: 0.5,
                      mt: -0.5,
                      '&:hover': {
                        color: isDark ? '#fff' : '#0f172a',
                        bgcolor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                      },
                    }}
                  >
                    <MoreIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                )}
              </Stack>

              {isEditing ? (
                <Stack spacing={1} sx={{ mt: 1, minWidth: 200 }}>
                  <TextField
                    fullWidth
                    multiline
                    minRows={1}
                    maxRows={3}
                    size="small"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        fontSize: '0.875rem',
                        color: isDark ? '#fff' : '#0f172a',
                        bgcolor: isDark ? 'rgba(0, 0, 0, 0.25)' : 'rgba(0, 0, 0, 0.04)',
                        borderRadius: 2,
                        '& fieldset': {
                          borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)',
                        },
                      },
                    }}
                  />
                  <Stack direction="row" spacing={1} justifyContent="flex-end">
                    <Button
                      size="small"
                      onClick={handleCancelEdit}
                      sx={{ color: isDark ? '#94a3b8' : '#64748b', textTransform: 'none', fontWeight: 600 }}
                    >
                      Hủy
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => handleSaveEdit(comment._id)}
                      sx={{
                        background: 'linear-gradient(135deg, #14b8a6 0%, #00bcd4 100%)',
                        color: '#fff',
                        fontWeight: 750,
                        textTransform: 'none',
                        px: 1.8,
                        borderRadius: 2,
                      }}
                    >
                      Lưu
                    </Button>
                  </Stack>
                </Stack>
              ) : (
                <Typography
                  variant="body2"
                  sx={{
                    color: isDark ? '#F1F5F9' : '#1e293b',
                    wordBreak: 'break-word',
                    whiteSpace: 'pre-wrap',
                    fontSize: '0.875rem',
                    lineHeight: 1.55,
                  }}
                >
                  {comment.content}
                </Typography>
              )}
            </div>

            {/* MusicFlow Comment Reaction & Reply Bar */}
            {!isEditing && (
              <Box sx={{ mt: 0.5 }}>
                <SongCommentReactions
                  comment={comment}
                  currentUserId={currentUserId}
                  onSelectReaction={handleSelectReaction}
                  onRemoveReaction={handleRemoveReaction}
                  onReply={(c) => {
                    if (!isLoggedIn) {
                      triggerLogin();
                    } else {
                      setReplyingTo(c);
                      setExpandedReplies((prev) => ({ ...prev, [comment._id]: true }));
                    }
                  }}
                />
              </Box>
            )}

            {/* Toggle Replies Button */}
            {hasReplies && (
              <Box sx={{ mt: 0.8 }}>
                <Button
                  size="small"
                  onClick={() => toggleReplies(comment._id)}
                  startIcon={
                    isExpanded ? (
                      <ArrowUpIcon sx={{ fontSize: 16 }} />
                    ) : (
                      <ReplyThreadIcon sx={{ fontSize: 15 }} />
                    )
                  }
                  sx={{
                    textTransform: 'none',
                    fontSize: '0.75rem',
                    fontWeight: 750,
                    color: isDark ? '#2dd4bf' : '#0f766e',
                    p: '3px 10px',
                    minHeight: 28,
                    borderRadius: '14px',
                    bgcolor: isDark ? 'rgba(20, 184, 166, 0.08)' : 'rgba(20, 184, 166, 0.06)',
                    border: '1px solid',
                    borderColor: isDark ? 'rgba(20, 184, 166, 0.2)' : 'rgba(20, 184, 166, 0.25)',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      bgcolor: isDark ? 'rgba(20, 184, 166, 0.16)' : 'rgba(20, 184, 166, 0.12)',
                      borderColor: isDark ? 'rgba(20, 184, 166, 0.4)' : 'rgba(20, 184, 166, 0.45)',
                      transform: 'translateX(2px)',
                    },
                  }}
                >
                  {isExpanded
                    ? (totalRepliesCount === 1 ? 'Ẩn câu trả lời' : `Ẩn ${totalRepliesCount} câu trả lời`)
                    : (totalRepliesCount === 1 ? 'Xem 1 câu trả lời' : `Xem ${totalRepliesCount} câu trả lời`)}
                </Button>
              </Box>
            )}
          </Box>
        </Stack>

        {/* Recursive replies rendering with smooth Collapse */}
        {hasReplies && (
          <Collapse in={isExpanded} timeout="auto" unmountOnExit={false}>
            <Box sx={{ position: 'relative' }}>
              {comment.replies.map((reply) => renderCommentNode(reply, depth + 1))}
            </Box>
          </Collapse>
        )}
      </Box>
    );
  };

  return (
    <>
      <Drawer
        anchor="right"
        open={open}
        onClose={onClose}
        PaperProps={{
          sx: {
            width: { xs: '100%', sm: 420, md: 450 },
            background: isDark
              ? 'linear-gradient(180deg, #0d1424 0%, #080c16 100%)'
              : 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
            boxShadow: isDark ? '-12px 0 40px rgba(0, 0, 0, 0.65)' : '-12px 0 40px rgba(0, 0, 0, 0.1)',
            borderLeft: '1px solid',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          },
        }}
      >
        {/* Drawer Header */}
        <Box
          sx={{
            p: 2,
            borderBottom: '1px solid',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
            background: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)',
          }}
        >
          {/* Top Row: Title & Close */}
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Stack direction="row" spacing={1.25} alignItems="center">
              <Box
                sx={{
                  width: 34,
                  height: 34,
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, rgba(20, 184, 166, 0.2) 0%, rgba(0, 188, 212, 0.2) 100%)',
                  border: '1px solid rgba(20, 184, 166, 0.35)',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <CommentIcon sx={{ color: '#14b8a6', fontSize: 18 }} />
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 800, color: isDark ? '#fff' : '#0f172a', fontSize: '1.1rem' }}>
                Bình luận
              </Typography>
              <Chip
                label={commentCount}
                size="small"
                sx={{
                  height: 22,
                  px: 0.5,
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  background: isDark ? 'rgba(20, 184, 166, 0.15)' : 'rgba(20, 184, 166, 0.12)',
                  color: isDark ? '#2dd4bf' : '#0f766e',
                  border: '1px solid',
                  borderColor: isDark ? 'rgba(20, 184, 166, 0.3)' : 'rgba(20, 184, 166, 0.25)',
                }}
              />
            </Stack>

            <Tooltip title="Đóng (Esc)">
              <IconButton
                onClick={onClose}
                sx={{
                  color: isDark ? 'rgba(255, 255, 255, 0.6)' : '#64748b',
                  borderRadius: '50%',
                  p: 0.8,
                  '&:hover': {
                    bgcolor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                    color: isDark ? '#fff' : '#0f172a',
                    transform: 'scale(1.05)',
                  },
                }}
              >
                <CloseIcon sx={{ fontSize: 20 }} />
              </IconButton>
            </Tooltip>
          </Stack>

          {/* Song Info Preview Card */}
          {activeSong && (
            <Box
              sx={{
                mt: 1.5,
                p: 1.25,
                borderRadius: '16px',
                background: isDark
                  ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%)'
                  : 'linear-gradient(135deg, rgba(0, 0, 0, 0.035) 0%, rgba(0, 0, 0, 0.015) 100%)',
                border: '1px solid',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.07)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1.5,
              }}
            >
              <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0, flex: 1 }}>
                <Avatar
                  src={activeSong.imageUrl}
                  variant="rounded"
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: '10px',
                    bgcolor: '#14b8a6',
                    boxShadow: isDark ? '0 4px 12px rgba(0, 0, 0, 0.4)' : '0 2px 8px rgba(0, 0, 0, 0.1)',
                    flexShrink: 0,
                  }}
                >
                  <MusicNoteIcon sx={{ fontSize: 22, color: '#fff' }} />
                </Avatar>

                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 750,
                      color: isDark ? '#fff' : '#0f172a',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontSize: '0.875rem',
                      lineHeight: 1.3,
                    }}
                  >
                    {activeSong.title}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      color: isDark ? 'rgba(255, 255, 255, 0.55)' : '#64748b',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      display: 'block',
                      fontSize: '0.75rem',
                      mt: 0.2,
                    }}
                  >
                    {Array.isArray(activeSong.artists)
                      ? activeSong.artists.map((a) => a?.name).filter(Boolean).join(', ')
                      : (activeSong.artistText || activeSong.artist || 'Nghệ sĩ')}
                  </Typography>
                </Box>
              </Stack>

              {playSong && (
                <Button
                  size="small"
                  variant="contained"
                  startIcon={isCurrentPlaying ? <PauseIcon sx={{ fontSize: 16 }} /> : <PlayIcon sx={{ fontSize: 16 }} />}
                  onClick={handleTogglePlaySong}
                  sx={{
                    background: isCurrentPlaying
                      ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                      : 'linear-gradient(135deg, #14b8a6 0%, #00bcd4 100%)',
                    color: '#fff',
                    borderRadius: '20px',
                    textTransform: 'none',
                    fontSize: '0.78rem',
                    fontWeight: 750,
                    px: 1.6,
                    py: 0.6,
                    boxShadow: '0 4px 12px rgba(20, 184, 166, 0.3)',
                    flexShrink: 0,
                    '&:hover': {
                      boxShadow: '0 6px 18px rgba(20, 184, 166, 0.45)',
                      transform: 'scale(1.04)',
                    },
                  }}
                >
                  {isCurrentPlaying ? 'Đang phát' : 'Phát'}
                </Button>
              )}
            </Box>
          )}

          {/* Sort Filter Tabs */}
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 1.75 }}>
            <Typography variant="caption" sx={{ color: isDark ? 'rgba(255,255,255,0.5)' : '#64748b', fontWeight: 600 }}>
              Sắp xếp
            </Typography>

            <Box
              sx={{
                p: '3px',
                borderRadius: '24px',
                bgcolor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
                border: '1px solid',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
                display: 'inline-flex',
                gap: 0.5,
              }}
            >
              <Button
                size="small"
                onClick={() => setSort('top')}
                startIcon={<FireIcon sx={{ fontSize: 14 }} />}
                sx={{
                  borderRadius: '20px',
                  px: 1.4,
                  py: 0.35,
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  textTransform: 'none',
                  minWidth: 0,
                  bgcolor: sort === 'top' ? (isDark ? '#14b8a6' : '#0f766e') : 'transparent',
                  color: sort === 'top' ? '#fff' : (isDark ? 'rgba(255,255,255,0.6)' : '#64748b'),
                  boxShadow: sort === 'top' ? '0 2px 8px rgba(20, 184, 166, 0.35)' : 'none',
                  '&:hover': {
                    bgcolor: sort === 'top' ? (isDark ? '#0d9488' : '#115e59') : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
                  },
                }}
              >
                Hàng đầu
              </Button>
              <Button
                size="small"
                onClick={() => setSort('new')}
                startIcon={<BoltIcon sx={{ fontSize: 14 }} />}
                sx={{
                  borderRadius: '20px',
                  px: 1.4,
                  py: 0.35,
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  textTransform: 'none',
                  minWidth: 0,
                  bgcolor: sort === 'new' ? (isDark ? '#14b8a6' : '#0f766e') : 'transparent',
                  color: sort === 'new' ? '#fff' : (isDark ? 'rgba(255,255,255,0.6)' : '#64748b'),
                  boxShadow: sort === 'new' ? '0 2px 8px rgba(20, 184, 166, 0.35)' : 'none',
                  '&:hover': {
                    bgcolor: sort === 'new' ? (isDark ? '#0d9488' : '#115e59') : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
                  },
                }}
              >
                Mới nhất
              </Button>
            </Box>
          </Stack>
        </Box>

        {/* Scrollable list of comments */}
        <Box
          ref={listRef}
          sx={{
            flexGrow: 1,
            p: 2,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
            '&::-webkit-scrollbar': { width: 5 },
            '&::-webkit-scrollbar-track': { bgcolor: 'transparent' },
            '&::-webkit-scrollbar-thumb': {
              bgcolor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.15)',
              borderRadius: 10,
            },
          }}
        >
          {loading ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 10, gap: 2 }}>
              <CircularProgress size={32} sx={{ color: '#14b8a6' }} />
              <Typography variant="caption" sx={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : '#64748b' }}>
                Đang tải bình luận...
              </Typography>
            </Box>
          ) : comments.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 10, px: 3, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Box
                sx={{
                  width: 68,
                  height: 68,
                  borderRadius: '50%',
                  background: isDark
                    ? 'linear-gradient(135deg, rgba(20, 184, 166, 0.15) 0%, rgba(108, 99, 255, 0.15) 100%)'
                    : 'linear-gradient(135deg, rgba(20, 184, 166, 0.12) 0%, rgba(108, 99, 255, 0.08) 100%)',
                  border: '1px solid rgba(20, 184, 166, 0.3)',
                  display: 'grid',
                  placeItems: 'center',
                  mb: 2,
                  boxShadow: '0 0 24px rgba(20, 184, 166, 0.18)',
                }}
              >
                <CommentIcon sx={{ fontSize: 32, color: '#14b8a6' }} />
              </Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 750, color: isDark ? '#fff' : '#0f172a', mb: 0.5 }}>
                Chưa có bình luận nào
              </Typography>
              <Typography variant="body2" sx={{ color: isDark ? 'rgba(255, 255, 255, 0.55)' : '#64748b', maxWidth: 280, fontSize: '0.85rem' }}>
                Hãy là người đầu tiên chia sẻ cảm xúc và giai điệu yêu thích với cộng đồng!
              </Typography>
            </Box>
          ) : (
            <>
              {comments.map((comment) => renderCommentNode(comment))}

              {hasMore && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2, mb: 1 }}>
                  <Button
                    size="small"
                    onClick={() => fetchComments(false)}
                    disabled={loadingMore}
                    sx={{
                      color: isDark ? '#2dd4bf' : '#0f766e',
                      textTransform: 'none',
                      fontWeight: 700,
                      px: 2,
                      py: 0.75,
                      borderRadius: '20px',
                      bgcolor: isDark ? 'rgba(20, 184, 166, 0.08)' : 'rgba(20, 184, 166, 0.06)',
                      '&:hover': {
                        bgcolor: isDark ? 'rgba(20, 184, 166, 0.15)' : 'rgba(20, 184, 166, 0.12)',
                      },
                    }}
                  >
                    {loadingMore ? <CircularProgress size={16} sx={{ color: '#14b8a6' }} /> : 'Xem thêm bình luận cũ hơn'}
                  </Button>
                </Box>
              )}
            </>
          )}
        </Box>

        {/* Reply indicator banner */}
        {replyingTo && (
          <Box
            sx={{
              px: 2,
              py: 0.9,
              background: isDark
                ? 'linear-gradient(90deg, rgba(20, 184, 166, 0.16) 0%, rgba(15, 23, 42, 0.8) 100%)'
                : 'linear-gradient(90deg, rgba(20, 184, 166, 0.12) 0%, rgba(240, 253, 250, 0.8) 100%)',
              borderTop: '1px solid rgba(20, 184, 166, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1,
            }}
          >
            <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0, flex: 1 }}>
              <ReplyIcon sx={{ fontSize: 16, color: '#14b8a6' }} />
              <Typography variant="caption" sx={{ color: isDark ? '#2dd4bf' : '#0f766e', fontWeight: 650 }}>
                Đang trả lời <strong>@{replyingTo.user?.name || 'Vô danh'}</strong>
              </Typography>
            </Stack>
            <IconButton
              size="small"
              onClick={() => setReplyingTo(null)}
              sx={{ color: isDark ? 'rgba(255,255,255,0.6)' : '#64748b', p: 0.3 }}
            >
              <CloseIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Box>
        )}

        {/* Quick Emoji Bar */}
        {isLoggedIn && (
          <Box
            sx={{
              px: 2,
              pt: 1,
              pb: 0.5,
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              bgcolor: isDark ? 'rgba(13, 20, 36, 0.98)' : '#ffffff',
            }}
          >
            <Typography variant="caption" sx={{ color: isDark ? 'rgba(255,255,255,0.4)' : '#94a3b8', fontSize: '0.72rem', mr: 0.5 }}>
              Nhanh:
            </Typography>
            {QUICK_EMOJIS.map((emoji) => (
              <Box
                key={emoji}
                component="button"
                type="button"
                onClick={() => setInputText((prev) => `${prev ? prev + ' ' : ''}${emoji}`)}
                sx={{
                  border: '1px solid',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
                  bgcolor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                  borderRadius: '12px',
                  px: 0.9,
                  py: 0.3,
                  fontSize: '0.85rem',
                  lineHeight: 1,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  '&:hover': {
                    transform: 'scale(1.2)',
                    borderColor: 'rgba(20, 184, 166, 0.45)',
                    bgcolor: isDark ? 'rgba(20, 184, 166, 0.12)' : 'rgba(20, 184, 166, 0.08)',
                  },
                }}
              >
                {emoji}
              </Box>
            ))}
          </Box>
        )}

        {/* Composer Input Bar / Guest CTA */}
        <Box
          sx={{
            p: 2,
            pt: 0.75,
            borderTop: '1px solid',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
            bgcolor: isDark ? 'rgba(13, 20, 36, 0.98)' : '#ffffff',
            backdropFilter: 'blur(20px)',
          }}
        >
          {isLoggedIn ? (
            <Stack direction="row" spacing={1.25} alignItems="flex-end">
              <Avatar
                src={myAvatar}
                sx={{
                  width: 38,
                  height: 38,
                  border: '2px solid',
                  borderColor: isDark ? 'rgba(20, 184, 166, 0.5)' : '#14b8a6',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                  mb: 0.3,
                  fontSize: '0.85rem',
                  fontWeight: 800,
                  bgcolor: '#14b8a6',
                }}
              >
                {myName.charAt(0).toUpperCase()}
              </Avatar>

              <TextField
                fullWidth
                multiline
                maxRows={4}
                size="small"
                placeholder={replyingTo ? `Trả lời @${replyingTo.user?.name}...` : 'Chia sẻ cảm nghĩ về giai điệu này...'}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                disabled={sending}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    bgcolor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.035)',
                    borderRadius: '24px',
                    color: isDark ? '#fff' : '#0f172a',
                    fontSize: '0.875rem',
                    px: 1.8,
                    py: 0.9,
                    '& fieldset': {
                      border: '1px solid',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.12)',
                      transition: 'border-color 0.2s',
                    },
                    '&:hover fieldset': {
                      borderColor: 'rgba(20, 184, 166, 0.5)',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#14b8a6',
                      boxShadow: '0 0 16px rgba(20, 184, 166, 0.25)',
                    },
                  },
                }}
              />

              <IconButton
                onClick={handleSend}
                disabled={sending || !inputText.trim()}
                sx={{
                  background: 'linear-gradient(135deg, #14b8a6 0%, #00bcd4 100%)',
                  color: '#fff',
                  boxShadow: '0 4px 14px rgba(20, 184, 166, 0.35)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #0f766e 0%, #0097a7 100%)',
                    transform: 'scale(1.06)',
                    boxShadow: '0 6px 18px rgba(20, 184, 166, 0.45)',
                  },
                  '&.Mui-disabled': {
                    background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
                    color: isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.25)',
                    boxShadow: 'none',
                  },
                  width: 42,
                  height: 42,
                  flexShrink: 0,
                  mb: 0.2,
                  transition: 'all 0.2s cubic-bezier(0.34, 1.45, 0.64, 1)',
                }}
              >
                {sending ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : <SendIcon sx={{ fontSize: 18 }} />}
              </IconButton>
            </Stack>
          ) : (
            <Box
              sx={{
                textAlign: 'center',
                p: 2,
                borderRadius: '16px',
                background: isDark
                  ? 'linear-gradient(135deg, rgba(20, 184, 166, 0.08) 0%, rgba(108, 99, 255, 0.05) 100%)'
                  : 'linear-gradient(135deg, rgba(20, 184, 166, 0.06) 0%, rgba(108, 99, 255, 0.04) 100%)',
                border: '1px solid',
                borderColor: isDark ? 'rgba(20, 184, 166, 0.2)' : 'rgba(20, 184, 166, 0.15)',
              }}
            >
              <Typography
                variant="body2"
                sx={{
                  color: isDark ? 'rgba(255, 255, 255, 0.75)' : '#475569',
                  mb: 1.5,
                  fontSize: '0.85rem',
                  fontWeight: 500,
                }}
              >
                Đăng nhập để tham gia thảo luận và chia sẻ cảm nghĩ cùng người nghe khác.
              </Typography>
              <Button
                variant="contained"
                fullWidth
                onClick={triggerLogin}
                sx={{
                  background: 'linear-gradient(135deg, #14b8a6 0%, #00bcd4 100%)',
                  color: '#fff',
                  borderRadius: 3,
                  fontWeight: 750,
                  textTransform: 'none',
                  py: 1,
                  boxShadow: '0 8px 20px rgba(20, 184, 166, 0.25)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #0f766e 0%, #008ba3 100%)',
                    boxShadow: '0 8px 20px rgba(20, 184, 166, 0.35)',
                  },
                }}
              >
                Đăng nhập ngay
              </Button>
            </Box>
          )}
        </Box>
      </Drawer>

      {/* Dropdown Menu for Edit/Delete */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleCloseMenu}
        PaperProps={{
          sx: {
            bgcolor: isDark ? '#1e293b' : '#ffffff',
            color: isDark ? '#fff' : '#0f172a',
            border: '1px solid',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
            boxShadow: isDark ? '0 10px 30px rgba(0,0,0,0.5)' : '0 10px 30px rgba(0,0,0,0.12)',
            borderRadius: '12px',
            minWidth: 120,
            '& .MuiMenuItem-root': {
              fontSize: '0.875rem',
              py: 1,
              fontWeight: 600,
              '&:hover': {
                bgcolor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
              },
            },
          },
        }}
      >
        <MenuItem onClick={handleTriggerEdit}>
          <EditIcon sx={{ fontSize: 16, mr: 1, color: isDark ? 'rgba(255,255,255,0.6)' : '#64748b' }} />
          Sửa
        </MenuItem>
        <MenuItem onClick={handleTriggerDelete} sx={{ color: '#fb7185' }}>
          <DeleteIcon sx={{ fontSize: 16, mr: 1, color: '#fb7185' }} />
          Xóa
        </MenuItem>
      </Menu>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={Boolean(deleteConfirmComment)}
        onClose={() => setDeleteConfirmComment(null)}
        PaperProps={{
          sx: {
            bgcolor: isDark ? '#1e293b' : '#ffffff',
            color: isDark ? '#fff' : '#0f172a',
            borderRadius: 3,
            border: '1px solid',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 750 }}>Xóa bình luận?</DialogTitle>
        <DialogContent>
          <DialogContentText
            sx={{
              color: isDark ? 'rgba(255, 255, 255, 0.7)' : '#64748b',
              fontSize: '0.9rem',
            }}
          >
            Bạn có chắc chắn muốn xóa bình luận này? Hành động này sẽ xóa vĩnh viễn nội dung bình luận và tất cả các phản hồi liên quan.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={() => setDeleteConfirmComment(null)}
            sx={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : '#64748b', fontWeight: 600 }}
          >
            Hủy
          </Button>
          <Button
            variant="contained"
            onClick={handleDeleteConfirm}
            sx={{ bgcolor: '#fb7185', fontWeight: 700, '&:hover': { bgcolor: '#e11d48' } }}
          >
            Xóa
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default ClientSongCommentsDrawer;
