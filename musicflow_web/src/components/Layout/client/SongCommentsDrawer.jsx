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
  ToggleButtonGroup,
  ToggleButton,
  Divider,
} from '@mui/material';
import {
  CloseRounded as CloseIcon,
  ChatBubbleOutlineRounded as CommentIcon,
  SendRounded as SendIcon,
  FavoriteRounded as FavoriteIcon,
  FavoriteBorderRounded as FavoriteBorderIcon,
  MoreHorizRounded as MoreIcon,
  ReplyRounded as ReplyIcon,
  EditRounded as EditIcon,
  DeleteOutlineRounded as DeleteIcon,
} from '@mui/icons-material';
import { useClientPlayer } from './ClientPlayerProvider';
import { clientCommentsApi } from '../../../services/api';
import useClientToast from './useClientToast';

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

function SongCommentsDrawer({ open, onClose, commentCount, onCommentCountChanged }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useClientToast();
  const { currentSong } = useClientPlayer();

  const currentUserId = localStorage.getItem('userId');
  const isLoggedIn = localStorage.getItem('role') === 'user';

  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sending, setSending] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('top');
  const [inputText, setInputText] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);

  // Menu control states
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [selectedCommentForMenu, setSelectedCommentForMenu] = useState(null);

  // Edit / Delete states
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editText, setEditText] = useState('');
  const [deleteConfirmComment, setDeleteConfirmComment] = useState(null);

  const listRef = useRef(null);

  const fetchComments = useCallback(async (reset = false) => {
    if (!currentSong?._id) return;

    if (reset) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const pageToFetch = reset ? 1 : page + 1;
      const response = await clientCommentsApi.getSongComments(currentSong._id, {
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
  }, [currentSong?._id, page, sort, onCommentCountChanged, showToast]);

  // Initial fetch or when song / sort changes
  useEffect(() => {
    if (open && currentSong?._id) {
      fetchComments(true);
    } else if (!open) {
      setComments([]);
      setReplyingTo(null);
      setEditingCommentId(null);
    }
  }, [open, currentSong?._id, sort, fetchComments]);

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

  const handleSend = async () => {
    if (!isLoggedIn) {
      triggerLogin();
      return;
    }

    if (!inputText.trim()) return;

    setSending(true);
    try {
      const response = await clientCommentsApi.create({
        songId: currentSong._id,
        content: inputText.trim(),
        parentCommentId: replyingTo ? replyingTo._id : null,
      });

      if (response.data?.success) {
        setInputText('');
        setReplyingTo(null);
        showToast({
          severity: 'success',
          title: 'Thành công',
          message: replyingTo ? 'Đã gửi câu trả lời.' : 'Đã đăng bình luận.',
        });
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

  const handleToggleLike = async (comment) => {
    if (!isLoggedIn) {
      triggerLogin();
      return;
    }

    const hasLiked = comment.reactions?.some((r) => String(r.userId) === String(currentUserId));

    // Optimistically update reactions to make the UI feel fast
    const updateReactionInTree = (nodes, targetId, wasLiked, userId) => {
      return nodes.map((node) => {
        if (node._id === targetId) {
          const nextReactions = wasLiked
            ? (node.reactions || []).filter((r) => String(r.userId) !== String(userId))
            : [...(node.reactions || []), { userId, type: 'like' }];
          const diff = wasLiked ? -1 : 1;
          const currentLikes = node.reactionSummary?.like || 0;
          return {
            ...node,
            reactions: nextReactions,
            reactionCount: Math.max(0, (node.reactionCount || 0) + diff),
            reactionSummary: {
              like: Math.max(0, currentLikes + diff),
            },
          };
        }
        if (node.replies && node.replies.length > 0) {
          return {
            ...node,
            replies: updateReactionInTree(node.replies, targetId, wasLiked, userId),
          };
        }
        return node;
      });
    };

    setComments((prev) => updateReactionInTree(prev, comment._id, hasLiked, currentUserId));

    try {
      if (hasLiked) {
        await clientCommentsApi.unreact(comment._id);
      } else {
        await clientCommentsApi.react(comment._id);
      }
    } catch {
      // Revert on error (re-fetch all comments to restore state)
      fetchComments(true);
    }
  };

  const handleOpenMenu = (event, comment) => {
    setMenuAnchor(event.currentTarget);
    setSelectedCommentForMenu(comment);
  };

  const handleCloseMenu = () => {
    setMenuAnchor(null);
    setSelectedCommentForMenu(null);
  };

  const handleTriggerEdit = () => {
    if (selectedCommentForMenu) {
      setEditingCommentId(selectedCommentForMenu._id);
      setEditText(selectedCommentForMenu.content);
    }
    handleCloseMenu();
  };

  const handleCancelEdit = () => {
    setEditingCommentId(null);
    setEditText('');
  };

  const handleSaveEdit = async (commentId) => {
    if (!editText.trim()) return;

    try {
      const response = await clientCommentsApi.update(commentId, {
        content: editText.trim(),
      });
      if (response.data?.success) {
        showToast({
          severity: 'success',
          title: 'Đã cập nhật',
          message: 'Bình luận đã được cập nhật thành công.',
        });
        setEditingCommentId(null);
        setEditText('');
        await fetchComments(true);
      }
    } catch (error) {
      showToast({
        severity: 'error',
        title: 'Lỗi cập nhật',
        message: error.response?.data?.message || 'Không thể lưu chỉnh sửa.',
      });
    }
  };

  const handleTriggerDelete = () => {
    if (selectedCommentForMenu) {
      setDeleteConfirmComment(selectedCommentForMenu);
    }
    handleCloseMenu();
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmComment) return;

    try {
      const response = await clientCommentsApi.delete(deleteConfirmComment._id);
      if (response.data?.success) {
        showToast({
          severity: 'success',
          title: 'Đã xóa',
          message: 'Đã xóa bình luận thành công.',
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

  const renderCommentNode = (comment, depth = 0) => {
    const isMine = currentUserId && String(comment.user?._id) === String(currentUserId);
    const hasLiked = comment.reactions?.some((r) => String(r.userId) === String(currentUserId));
    const likeIcon = hasLiked ? (
      <FavoriteIcon sx={{ fontSize: 15, color: '#fb7185' }} />
    ) : (
      <FavoriteBorderIcon sx={{ fontSize: 15 }} />
    );

    const isEditing = editingCommentId === comment._id;

    return (
      <Box
        key={comment._id}
        sx={{
          pl: depth > 0 ? { xs: 2, sm: 3 } : 0,
          mt: 1.5,
          position: 'relative',
        }}
      >
        {/* Reply vertical line indicator */}
        {depth > 0 && (
          <Box
            sx={{
              position: 'absolute',
              left: { xs: 8, sm: 12 },
              top: 0,
              bottom: 0,
              width: '1px',
              bgcolor: 'rgba(255, 255, 255, 0.06)',
            }}
          />
        )}

        <Stack direction="row" spacing={1.2} alignItems="flex-start">
          <Avatar
            src={comment.user?.avatar}
            sx={{
              width: depth > 0 ? 26 : 32,
              height: depth > 0 ? 26 : 32,
              bgcolor: 'rgba(255, 255, 255, 0.08)',
              border: isMine ? '1px solid #14b8a6' : 'none',
            }}
          >
            {comment.user?.name ? comment.user.name[0].toUpperCase() : 'U'}
          </Avatar>

          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            {/* Balloon content wrapper */}
            <Box
              sx={{
                bgcolor: 'rgba(255, 255, 255, 0.04)',
                borderRadius: 3,
                p: '8px 12px',
                display: 'inline-block',
                maxWidth: '100%',
                border: isMine ? '1px solid rgba(20, 184, 166, 0.15)' : 'none',
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.25 }}>
                <Typography
                  variant="caption"
                  fontWeight={700}
                  sx={{
                    color: isMine ? '#2dd4bf' : 'rgba(255, 255, 255, 0.9)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: 160,
                  }}
                >
                  {comment.user?.name || 'Vô danh'}
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.38)', fontSize: 10 }}>
                  • {formatDate(comment.createdAt)}
                </Typography>
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
                        color: '#fff',
                        bgcolor: 'rgba(0, 0, 0, 0.2)',
                        borderRadius: 2,
                      },
                    }}
                  />
                  <Stack direction="row" spacing={1} justifyContent="flex-end">
                    <Button size="small" onClick={handleCancelEdit} sx={{ color: '#94a3b8' }}>
                      Hủy
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => handleSaveEdit(comment._id)}
                      sx={{ bgcolor: '#14b8a6', '&:hover': { bgcolor: '#0f766e' } }}
                    >
                      Lưu
                    </Button>
                  </Stack>
                </Stack>
              ) : (
                <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.85)', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                  {comment.content}
                </Typography>
              )}
            </Box>

            {/* Action Bar: Reply, Like, Menu */}
            {!isEditing && (
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 0.5, pl: 0.5 }}>
                <Button
                  size="small"
                  startIcon={<ReplyIcon sx={{ fontSize: 14 }} />}
                  onClick={() => {
                    if (!isLoggedIn) {
                      triggerLogin();
                    } else {
                      setReplyingTo(comment);
                    }
                  }}
                  sx={{
                    color: 'rgba(255, 255, 255, 0.45)',
                    fontSize: 11,
                    textTransform: 'none',
                    p: 0,
                    minWidth: 0,
                    '&:hover': { color: '#14b8a6' },
                  }}
                >
                  Trả lời
                </Button>

                <Button
                  size="small"
                  startIcon={likeIcon}
                  onClick={() => handleToggleLike(comment)}
                  sx={{
                    color: hasLiked ? '#fb7185' : 'rgba(255, 255, 255, 0.45)',
                    fontSize: 11,
                    textTransform: 'none',
                    p: 0,
                    minWidth: 0,
                    '&:hover': { color: '#fb7185' },
                  }}
                >
                  Thích ({comment.reactionCount || 0})
                </Button>

                {isMine && (
                  <IconButton
                    size="small"
                    onClick={(e) => handleOpenMenu(e, comment)}
                    sx={{ color: 'rgba(255, 255, 255, 0.38)', p: 0.2 }}
                  >
                    <MoreIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                )}
              </Stack>
            )}
          </Box>
        </Stack>

        {/* Recursive replies rendering */}
        {comment.replies && comment.replies.map((reply) => renderCommentNode(reply, depth + 1))}
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
            width: { xs: '100%', sm: 400 },
            background: 'linear-gradient(180deg, #0f172a 0%, #080d1a 100%)',
            boxShadow: '-8px 0 30px rgba(0, 0, 0, 0.5)',
            borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
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
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(255, 255, 255, 0.01)',
          }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Stack direction="row" spacing={1} alignItems="center">
              <CommentIcon sx={{ color: '#14b8a6' }} />
              <Typography variant="h6" fontWeight={700} color="#fff">
                Bình luận ({commentCount})
              </Typography>
            </Stack>
            <IconButton onClick={onClose} sx={{ color: 'rgba(255, 255, 255, 0.6)' }}>
              <CloseIcon />
            </IconButton>
          </Stack>

          {currentSong && (
            <Typography variant="caption" display="block" sx={{ color: 'rgba(255,255,255,0.45)', mt: 0.5, noWrap: true }}>
              Bài hát: {currentSong.title} - {currentSong.artistText}
            </Typography>
          )}

          {/* Sort Toggles */}
          <Stack direction="row" justifyContent="flex-end" sx={{ mt: 1.5 }}>
            <ToggleButtonGroup
              size="small"
              value={sort}
              exclusive
              onChange={(_, value) => value && setSort(value)}
              sx={{
                bgcolor: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                '& .MuiToggleButtonGroup-grouped': {
                  border: 0,
                  px: 1.5,
                  py: 0.5,
                  color: 'rgba(255,255,255,0.5)',
                  textTransform: 'none',
                  fontSize: '0.75rem',
                  '&.Mui-selected': {
                    color: '#14b8a6',
                    bgcolor: 'rgba(20, 184, 166, 0.1)',
                    fontWeight: 700,
                  },
                },
              }}
            >
              <ToggleButton value="top">Hàng đầu</ToggleButton>
              <ToggleButton value="new">Mới nhất</ToggleButton>
            </ToggleButtonGroup>
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
            gap: 1,
            // Styling custom thin scrollbars
            '&::-webkit-scrollbar': { width: 5 },
            '&::-webkit-scrollbar-track': { bgcolor: 'transparent' },
            '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255, 255, 255, 0.12)', borderRadius: 10 },
          }}
        >
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
              <CircularProgress size={32} sx={{ color: '#14b8a6' }} />
            </Box>
          ) : comments.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8, px: 2 }}>
              <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.45)' }}>
                Chưa có bình luận nào. Hãy là người đầu tiên chia sẻ cảm nghĩ!
              </Typography>
            </Box>
          ) : (
            <>
              {comments.map((comment) => renderCommentNode(comment))}

              {hasMore && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3, mb: 1 }}>
                  <Button
                    size="small"
                    onClick={() => fetchComments(false)}
                    disabled={loadingMore}
                    sx={{ color: '#14b8a6', textTransform: 'none' }}
                  >
                    {loadingMore ? <CircularProgress size={16} sx={{ color: '#14b8a6' }} /> : 'Xem thêm bình luận'}
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
              p: '6px 16px',
              bgcolor: 'rgba(20, 184, 166, 0.08)',
              borderTop: '1px solid rgba(20, 184, 166, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Typography variant="caption" sx={{ color: '#2dd4bf' }}>
              Đang trả lời <strong>@{replyingTo.user?.name}</strong>
            </Typography>
            <IconButton size="small" onClick={() => setReplyingTo(null)} sx={{ color: 'rgba(255,255,255,0.5)' }}>
              <CloseIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Box>
        )}

        {/* Input Bar / Login CTA */}
        <Box
          sx={{
            p: 2,
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            bgcolor: 'rgba(0, 0, 0, 0.2)',
          }}
        >
          {isLoggedIn ? (
            <Stack direction="row" spacing={1} alignItems="flex-end">
              <TextField
                fullWidth
                multiline
                maxRows={4}
                size="small"
                placeholder={replyingTo ? 'Viết câu trả lời...' : 'Thêm bình luận...'}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                disabled={sending}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    bgcolor: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: 3,
                    color: '#fff',
                    fontSize: '0.875rem',
                    '& fieldset': {
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                    },
                    '&:hover fieldset': {
                      borderColor: 'rgba(255, 255, 255, 0.2)',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#14b8a6',
                    },
                  },
                }}
              />
              <IconButton
                onClick={handleSend}
                disabled={sending || !inputText.trim()}
                sx={{
                  bgcolor: '#14b8a6',
                  color: '#fff',
                  '&:hover': { bgcolor: '#0f766e' },
                  '&.Mui-disabled': {
                    bgcolor: 'rgba(255, 255, 255, 0.08)',
                    color: 'rgba(255, 255, 255, 0.3)',
                  },
                  width: 40,
                  height: 40,
                }}
              >
                {sending ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : <SendIcon sx={{ fontSize: 18 }} />}
              </IconButton>
            </Stack>
          ) : (
            <Box sx={{ textAlign: 'center', py: 0.5 }}>
              <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.5)', mb: 1.5 }}>
                Bạn cần đăng nhập để tham gia thảo luận và chia sẻ cảm nghĩ.
              </Typography>
              <Button
                variant="contained"
                fullWidth
                onClick={triggerLogin}
                sx={{
                  background: 'linear-gradient(135deg, #14b8a6 0%, #00bcd4 100%)',
                  color: '#fff',
                  borderRadius: 3,
                  fontWeight: 700,
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
            bgcolor: '#1e293b',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.08)',
            minWidth: 120,
            '& .MuiMenuItem-root': {
              fontSize: '0.875rem',
              py: 1,
              '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.08)' },
            },
          },
        }}
      >
        <MenuItem onClick={handleTriggerEdit}>
          <EditIcon sx={{ fontSize: 16, mr: 1, color: 'rgba(255,255,255,0.6)' }} />
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
            bgcolor: '#1e293b',
            color: '#fff',
            borderRadius: 3,
            border: '1px solid rgba(255,255,255,0.08)',
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Xóa bình luận?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.9rem' }}>
            Bạn có chắc chắn muốn xóa bình luận này? Hành động này sẽ xóa vĩnh viễn nội dung bình luận và tất cả các phản hồi liên quan.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteConfirmComment(null)} sx={{ color: 'rgba(255, 255, 255, 0.6)' }}>
            Hủy
          </Button>
          <Button variant="contained" onClick={handleDeleteConfirm} sx={{ bgcolor: '#fb7185', '&:hover': { bgcolor: '#e11d48' } }}>
            Xóa
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default SongCommentsDrawer;
