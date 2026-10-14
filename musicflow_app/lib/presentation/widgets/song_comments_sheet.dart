import 'package:flutter/material.dart';
import 'package:musicflow_app/core/utils/app_toast.dart';
import 'package:musicflow_app/data/models/comment_model.dart';
import 'package:musicflow_app/data/services/auth_service.dart';
import 'package:musicflow_app/data/services/comment_service.dart';
import 'package:musicflow_app/presentation/widgets/comment_reaction_button.dart';

class SongCommentsSheet extends StatefulWidget {
  final String songId;
  final int initialCommentCount;
  final ValueChanged<int>? onCommentCountChanged;

  const SongCommentsSheet({
    super.key,
    required this.songId,
    this.initialCommentCount = 0,
    this.onCommentCountChanged,
  });

  @override
  State<SongCommentsSheet> createState() => _SongCommentsSheetState();
}

class _SongCommentsSheetState extends State<SongCommentsSheet> {
  static const int _pageSize = 8;

  final TextEditingController _inputController = TextEditingController();

  String _currentUserId = '';
  List<SongComment> _comments = [];

  int _commentCount = 0;
  int _currentPage = 1;
  bool _hasMore = false;
  bool _isLoading = true;
  bool _isLoadingMore = false;
  bool _isSending = false;

  SongComment? _replyingTo;

  @override
  void initState() {
    super.initState();
    _commentCount = widget.initialCommentCount;
    _bootstrap();
  }

  @override
  void dispose() {
    _inputController.dispose();
    super.dispose();
  }

  Future<void> _bootstrap() async {
    final user = await AuthService.getCurrentUser();
    _currentUserId = user?.id ?? '';
    await _loadComments(reset: true);
  }

  Future<void> _loadComments({required bool reset}) async {
    if (reset) {
      setState(() {
        _isLoading = true;
        _currentPage = 1;
      });
    }

    final pageToFetch = reset ? 1 : _currentPage + 1;
    final result = await CommentService.getSongComments(
      widget.songId,
      page: pageToFetch,
      limit: _pageSize,
      sort: 'top',
    );

    if (!mounted) return;

    if (!result.success) {
      setState(() {
        _isLoading = false;
        _isLoadingMore = false;
      });
      _setStatus(result.message ?? 'Không tải được bình luận', isError: true);
      return;
    }

    setState(() {
      _isLoading = false;
      _isLoadingMore = false;
      _currentPage = result.page;
      _hasMore = result.hasMore;
      _commentCount = result.totalComments;
      if (reset) {
        _comments = result.comments;
      } else {
        _comments = [..._comments, ...result.comments];
      }
    });

    widget.onCommentCountChanged?.call(_commentCount);
  }

  Future<void> _loadMore() async {
    if (_isLoadingMore || !_hasMore) return;
    setState(() => _isLoadingMore = true);
    await _loadComments(reset: false);
  }

  Future<void> _submitComment() async {
    final isLoggedIn = await AuthService.isLoggedIn();
    if (!isLoggedIn) {
      _setStatus('Vui lòng đăng nhập để bình luận', isError: true);
      return;
    }

    final content = _inputController.text.trim();
    if (content.isEmpty) return;

    setState(() => _isSending = true);

    final result = await CommentService.createComment(
      songId: widget.songId,
      content: content,
      parentCommentId: _replyingTo?.id,
    );

    if (!mounted) return;

    setState(() => _isSending = false);

    if (!result.success) {
      _setStatus(result.message ?? 'Gửi bình luận thất bại', isError: true);
      return;
    }

    _inputController.clear();
    setState(() => _replyingTo = null);
    _setStatus('Đã gửi bình luận', isError: false);
    await _loadComments(reset: true);
  }



  Future<void> _sendReaction(SongComment comment, String type) async {
    final isLoggedIn = await AuthService.isLoggedIn();
    if (!isLoggedIn) {
      _setStatus('Vui lòng đăng nhập để tương tác cảm xúc', isError: true);
      return;
    }

    final result = await CommentService.reactToComment(
      commentId: comment.id,
      type: type,
    );

    if (!mounted) return;
    if (!result.success) {
      _setStatus(result.message ?? 'Không thể cập nhật cảm xúc', isError: true);
      return;
    }

    final config = kCommentReactions.firstWhere(
      (c) => c.key == type,
      orElse: () => kCommentReactions[0],
    );
    _setStatus('Đã thả cảm xúc ${config.emoji} ${config.label}', isError: false);
    await _loadComments(reset: true);
  }

  Future<void> _removeReaction(SongComment comment) async {
    final isLoggedIn = await AuthService.isLoggedIn();
    if (!isLoggedIn) {
      _setStatus('Vui lòng đăng nhập để tương tác cảm xúc', isError: true);
      return;
    }

    final result = await CommentService.removeReaction(comment.id);
    if (!mounted) return;
    if (!result.success) {
      _setStatus(result.message ?? 'Không thể gỡ cảm xúc', isError: true);
      return;
    }
    _setStatus('Đã gỡ cảm xúc', isError: false);
    await _loadComments(reset: true);
  }

  String _formatTimeAgo(DateTime? time) {
    if (time == null) return '';
    final diff = DateTime.now().difference(time);
    if (diff.inSeconds < 60) return 'Vừa xong';
    if (diff.inMinutes < 60) return '${diff.inMinutes}p';
    if (diff.inHours < 24) return '${diff.inHours}h';
    if (diff.inDays < 7) return '${diff.inDays}d';
    return '${time.day}/${time.month}';
  }

  Future<void> _editComment(SongComment comment) async {
    final isLoggedIn = await AuthService.isLoggedIn();
    if (!mounted) return;
    if (!isLoggedIn) {
      _setStatus('Vui lòng đăng nhập để sửa bình luận', isError: true);
      return;
    }
    if (_currentUserId.isEmpty || comment.user.id != _currentUserId) {
      _setStatus('Bạn không có quyền sửa bình luận này', isError: true);
      return;
    }
    String draftContent = comment.content;

    final nextContent = await showDialog<String>(
      context: context,
      builder: (context) {
        return AlertDialog(
          backgroundColor: const Color(0xFF1B1B1B),
          title: const Text(
            'Sửa bình luận',
            style: TextStyle(color: Colors.white),
          ),
          content: TextFormField(
            initialValue: draftContent,
            style: const TextStyle(color: Colors.white),
            maxLines: 4,
            onChanged: (value) => draftContent = value,
            decoration: const InputDecoration(
              hintText: 'Nhập nội dung',
              hintStyle: TextStyle(color: Colors.white38),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Huy'),
            ),
            ElevatedButton(
              onPressed: () => Navigator.pop(context, draftContent.trim()),
              child: const Text('Lưu'),
            ),
          ],
        );
      },
    );

    if (nextContent == null || nextContent.isEmpty) return;

    final result = await CommentService.updateComment(
      commentId: comment.id,
      content: nextContent,
    );
    if (!mounted) return;

    _setStatus(
      result.message ?? 'Cập nhật bình luận',
      isError: !result.success,
    );
    if (result.success) {
      await _loadComments(reset: true);
    }
  }

  Future<void> _deleteComment(SongComment comment) async {
    final isLoggedIn = await AuthService.isLoggedIn();
    if (!mounted) return;
    if (!isLoggedIn) {
      _setStatus('Vui lòng đăng nhập để xóa bình luận', isError: true);
      return;
    }
    if (_currentUserId.isEmpty || comment.user.id != _currentUserId) {
      _setStatus('Bạn không có quyền xóa bình luận này', isError: true);
      return;
    }

    final shouldDelete = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF1B1B1B),
        title: const Text(
          'Xóa bình luận?',
          style: TextStyle(color: Colors.white),
        ),
        content: const Text(
          'Bình luận và các trả lời con sẽ bị xóa.',
          style: TextStyle(color: Colors.white70),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Hủy'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Xóa'),
          ),
        ],
      ),
    );

    if (shouldDelete != true) return;

    final result = await CommentService.deleteComment(comment.id);
    if (!mounted) return;

    _setStatus(result.message ?? 'Xóa bình luận', isError: !result.success);
    if (result.success) {
      await _loadComments(reset: true);
    }
  }

  void _handleOwnCommentAction(String action, SongComment comment) {
    Future<void>.delayed(Duration.zero, () {
      if (!mounted) return;
      if (action == 'edit') {
        _editComment(comment);
      } else if (action == 'delete') {
        _deleteComment(comment);
      }
    });
  }

  void _setStatus(String message, {required bool isError}) {
    if (!mounted) return;
    if (isError) {
      AppToast.showError(context, message);
    } else {
      AppToast.showSuccess(context, message);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF140E26),
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
        border: Border.all(color: Colors.white.withOpacity(0.08)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.6),
            blurRadius: 30,
            offset: const Offset(0, -6),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: EdgeInsets.only(
            left: 16,
            right: 16,
            top: 12,
            bottom: MediaQuery.of(context).viewInsets.bottom + 12,
          ),
          child: SizedBox(
            height: MediaQuery.of(context).size.height * 0.76,
            child: Column(
            children: [
              Container(
                width: 42,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.white24,
                  borderRadius: BorderRadius.circular(99),
                ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  const Icon(Icons.chat_bubble_outline, color: Colors.white70),
                  const SizedBox(width: 8),
                  Text(
                    'Bình luận ($_commentCount)',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const Spacer(),
                  IconButton(
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.close, color: Colors.white70),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Expanded(
                child: _isLoading
                    ? const Center(
                        child: CircularProgressIndicator(
                          color: Colors.greenAccent,
                        ),
                      )
                    : RefreshIndicator(
                        onRefresh: () => _loadComments(reset: true),
                        child: ListView(
                          children: [
                            if (_comments.isEmpty)
                              const Padding(
                                padding: EdgeInsets.only(top: 32),
                                child: Center(
                                  child: Text(
                                    'Chưa có bình luận nào',
                                    style: TextStyle(color: Colors.white54),
                                  ),
                                ),
                              ),
                            ..._comments.map(
                              (comment) => _buildCommentNode(comment, depth: 0),
                            ),
                            if (_hasMore)
                              Padding(
                                padding: const EdgeInsets.symmetric(
                                  vertical: 10,
                                ),
                                child: TextButton(
                                  onPressed: _isLoadingMore ? null : _loadMore,
                                  child: _isLoadingMore
                                      ? const SizedBox(
                                          width: 16,
                                          height: 16,
                                          child: CircularProgressIndicator(
                                            strokeWidth: 2,
                                          ),
                                        )
                                      : const Text('Xem thêm bình luận'),
                                ),
                              ),
                          ],
                        ),
                      ),
              ),
              if (_replyingTo != null)
                Container(
                  width: double.infinity,
                  margin: const EdgeInsets.only(bottom: 8),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 8,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.07),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          'Đang trả lời ${_replyingTo!.user.name}',
                          style: const TextStyle(
                            color: Colors.white70,
                            fontSize: 12,
                          ),
                        ),
                      ),
                      GestureDetector(
                        onTap: () => setState(() => _replyingTo = null),
                        child: const Icon(
                          Icons.close,
                          color: Colors.white54,
                          size: 16,
                        ),
                      ),
                    ],
                  ),
                ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.06),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: Colors.white.withOpacity(0.1)),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _inputController,
                        style: const TextStyle(color: Colors.white),
                        minLines: 1,
                        maxLines: 3,
                        decoration: const InputDecoration(
                          hintText: 'Viết bình luận...',
                          hintStyle: TextStyle(color: Colors.white38),
                          border: InputBorder.none,
                          contentPadding: EdgeInsets.symmetric(horizontal: 10),
                        ),
                      ),
                    ),
                    IconButton(
                      onPressed: _isSending ? null : _submitComment,
                      icon: _isSending
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(
                              Icons.send_rounded,
                              color: Colors.greenAccent,
                            ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    ),
  );
  }

  Widget _buildCommentNode(SongComment comment, {required int depth}) {
    final leftPadding = 8.0 + (depth * 20);
    final hasAvatar = comment.user.avatar.isNotEmpty;
    final isMine =
        _currentUserId.isNotEmpty && comment.user.id == _currentUserId;

    // Gradient fallback matching Prompt #077 .u077-av
    final avatarGradient = (comment.user.id.hashCode % 2 == 0)
        ? const LinearGradient(
            colors: [Color(0xFF22C3A6), Color(0xFF0EA5E9)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          )
        : const LinearGradient(
            colors: [Color(0xFF8B6CFF), Color(0xFF5B8CFF)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          );

    return Padding(
      padding: EdgeInsets.only(left: leftPadding, right: 6, top: 10, bottom: 6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Prompt #077 Message: Avatar + Bubble (.u077-msg)
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Avatar (.u077-av: 34x34)
              Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: avatarGradient,
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.25),
                      blurRadius: 4,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                clipBehavior: Clip.antiAlias,
                child: hasAvatar
                    ? Image.network(
                        comment.user.avatar,
                        width: 34,
                        height: 34,
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => Center(
                          child: Text(
                            comment.user.name.isNotEmpty
                                ? comment.user.name[0].toUpperCase()
                                : '?',
                            style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w800,
                              fontSize: 13,
                            ),
                          ),
                        ),
                      )
                    : Center(
                        child: Text(
                          comment.user.name.isNotEmpty
                              ? comment.user.name[0].toUpperCase()
                              : '?',
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w800,
                            fontSize: 13,
                          ),
                        ),
                      ),
              ),
              const SizedBox(width: 10),
              // Message Bubble (.u077-bub: 6px 18px 18px 18px)
              Expanded(
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 10,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1A1B25),
                    borderRadius: const BorderRadius.only(
                      topLeft: Radius.circular(6),
                      topRight: Radius.circular(18),
                      bottomLeft: Radius.circular(18),
                      bottomRight: Radius.circular(18),
                    ),
                    border: Border.all(
                      color: Colors.white.withOpacity(0.08),
                      width: 1,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.25),
                        blurRadius: 10,
                        offset: const Offset(0, 3),
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              comment.user.name,
                              style: const TextStyle(
                                color: Color(0xFFDCD8E8),
                                fontWeight: FontWeight.w800,
                                fontSize: 12.5,
                                letterSpacing: -0.1,
                              ),
                            ),
                          ),
                          if (isMine)
                            PopupMenuButton<String>(
                              padding: EdgeInsets.zero,
                              iconSize: 18,
                              icon: const Icon(
                                Icons.more_horiz,
                                color: Colors.white54,
                              ),
                              color: const Color(0xFF222332),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                              onSelected: (value) =>
                                  _handleOwnCommentAction(value, comment),
                              itemBuilder: (context) => const [
                                PopupMenuItem<String>(
                                  value: 'edit',
                                  child: Text('Sửa'),
                                ),
                                PopupMenuItem<String>(
                                  value: 'delete',
                                  child: Text('Xóa'),
                                ),
                              ],
                            ),
                        ],
                      ),
                      const SizedBox(height: 3),
                      Text(
                        comment.content,
                        style: const TextStyle(
                          color: Color(0xFFF4F0E8),
                          fontSize: 13.5,
                          height: 1.45,
                          letterSpacing: -0.1,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),

          // MusicFlow Reaction row: Aligned under the bubble
          Padding(
            padding: const EdgeInsets.only(left: 44),
            child: SongCommentReactions(
              comment: comment,
              currentUserId: _currentUserId,
              onSelectReaction: (type) => _sendReaction(comment, type),
              onRemoveReaction: () => _removeReaction(comment),
              onReply: () => setState(() => _replyingTo = comment),
              timeAgo: _formatTimeAgo(comment.createdAt),
            ),
          ),

          // Child replies
          ...comment.replies.map(
            (child) => _buildCommentNode(child, depth: depth + 1),
          ),
        ],
      ),
    );
  }
}
