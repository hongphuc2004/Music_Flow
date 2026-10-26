import 'package:flutter/material.dart';
import 'package:musicflow_app/core/utils/app_toast.dart';
import 'package:musicflow_app/data/models/comment_model.dart';
import 'package:musicflow_app/data/models/song_model.dart';
import 'package:musicflow_app/data/models/user_model.dart';
import 'package:musicflow_app/data/services/auth_service.dart';
import 'package:musicflow_app/data/services/comment_service.dart';
import 'package:musicflow_app/presentation/widgets/comment_reaction_button.dart';

class SongCommentsSheet extends StatefulWidget {
  final String songId;
  final Song? song;
  final int initialCommentCount;
  final ValueChanged<int>? onCommentCountChanged;
  final String? targetCommentId;

  const SongCommentsSheet({
    super.key,
    required this.songId,
    this.song,
    this.initialCommentCount = 0,
    this.onCommentCountChanged,
    this.targetCommentId,
  });

  @override
  State<SongCommentsSheet> createState() => _SongCommentsSheetState();
}

class _SongCommentsSheetState extends State<SongCommentsSheet> {
  static const int _pageSize = 10;
  static const List<String> _quickEmojis = ['❤️', '🔥', '👏', '🎵', '✨'];

  final TextEditingController _inputController = TextEditingController();
  final FocusNode _inputFocusNode = FocusNode();

  User? _currentUser;
  String _currentUserId = '';
  bool _isLoggedIn = false;
  List<SongComment> _comments = [];

  int _commentCount = 0;
  int _currentPage = 1;
  bool _hasMore = false;
  bool _isLoading = true;
  bool _isLoadingMore = false;
  bool _isSending = false;
  String _sort = 'top'; // 'top' | 'new'

  SongComment? _replyingTo;
  final Set<String> _expandedReplyIds = {};
  String? _highlightedCommentId;

  @override
  void initState() {
    super.initState();
    _commentCount = widget.initialCommentCount;
    _inputController.addListener(_onInputChanged);
    _bootstrap();
  }

  @override
  void dispose() {
    _inputController.removeListener(_onInputChanged);
    _inputController.dispose();
    _inputFocusNode.dispose();
    super.dispose();
  }

  void _onInputChanged() {
    setState(() {});
  }

  Future<void> _bootstrap() async {
    final loggedIn = await AuthService.isLoggedIn();
    final user = await AuthService.getCurrentUser();
    if (mounted) {
      setState(() {
        _isLoggedIn = loggedIn;
        _currentUser = user;
        _currentUserId = user?.id ?? '';
      });
    }
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
      sort: _sort,
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

      if (widget.targetCommentId != null && _comments.isNotEmpty) {
        String? findParentId(List<SongComment> nodes, String targetId, [String? currentParent]) {
          for (final node in nodes) {
            if (node.id == targetId) return currentParent;
            if (node.replies.isNotEmpty) {
              final found = findParentId(node.replies, targetId, node.id);
              if (found != null) return found;
            }
          }
          return null;
        }

        final parentId = findParentId(_comments, widget.targetCommentId!);
        if (parentId != null) {
          _expandedReplyIds.add(parentId);
        }
        _highlightedCommentId = widget.targetCommentId;
        Future.delayed(const Duration(milliseconds: 3000), () {
          if (mounted) {
            setState(() {
              _highlightedCommentId = null;
            });
          }
        });
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

    final parentId = _replyingTo?.id;
    if (parentId != null) {
      _expandedReplyIds.add(parentId);
    }
    _inputController.clear();
    setState(() => _replyingTo = null);
    _setStatus('Đã gửi bình luận', isError: false);
    await _loadComments(reset: true);
  }

  void _insertQuickEmoji(String emoji) {
    final currentText = _inputController.text;
    _inputController.text = '$currentText$emoji';
    _inputController.selection = TextSelection.fromPosition(
      TextPosition(offset: _inputController.text.length),
    );
    _inputFocusNode.requestFocus();
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
    if (diff.inMinutes < 60) return '${diff.inMinutes}p trước';
    if (diff.inHours < 24) return '${diff.inHours}h trước';
    if (diff.inDays < 7) return '${diff.inDays} ngày trước';
    return '${time.day}/${time.month}/${time.year}';
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
          backgroundColor: const Color(0xFF1E1E2C),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: const Text(
            'Sửa bình luận',
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 17),
          ),
          content: TextFormField(
            initialValue: draftContent,
            style: const TextStyle(color: Colors.white, fontSize: 14),
            maxLines: 4,
            onChanged: (value) => draftContent = value,
            decoration: InputDecoration(
              hintText: 'Nhập nội dung mới...',
              hintStyle: const TextStyle(color: Colors.white38),
              filled: true,
              fillColor: Colors.white.withOpacity(0.06),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: BorderSide(color: Colors.white.withOpacity(0.1)),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: const BorderSide(color: Color(0xFF14B8A6)),
              ),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Hủy', style: TextStyle(color: Colors.white54)),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF14B8A6),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              onPressed: () => Navigator.pop(context, draftContent.trim()),
              child: const Text('Lưu thay đổi', style: TextStyle(fontWeight: FontWeight.w700)),
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
        backgroundColor: const Color(0xFF1E1E2C),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text(
          'Xóa bình luận?',
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 17),
        ),
        content: const Text(
          'Bình luận và toàn bộ phản hồi liên quan sẽ bị xóa vĩnh viễn.',
          style: TextStyle(color: Colors.white70, fontSize: 13.5),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Hủy', style: TextStyle(color: Colors.white54)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFFB7185),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Xóa', style: TextStyle(fontWeight: FontWeight.w700)),
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
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;
    final hasInput = _inputController.text.trim().isNotEmpty;

    return Container(
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF141221), Color(0xFF0C0A15)],
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
        ),
        borderRadius: const BorderRadius.vertical(top: Radius.circular(32)),
        border: Border.all(color: Colors.white.withOpacity(0.09), width: 1),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.75),
            blurRadius: 40,
            offset: const Offset(0, -10),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: EdgeInsets.only(
            left: 16,
            right: 16,
            top: 10,
            bottom: bottomInset > 0 ? bottomInset + 8 : 14,
          ),
          child: SizedBox(
            height: MediaQuery.of(context).size.height * 0.82,
            child: Column(
              children: [
                // Drag handle pill
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.25),
                      borderRadius: BorderRadius.circular(99),
                    ),
                  ),
                ),
                const SizedBox(height: 12),

                // Top Header Row
                Row(
                  children: [
                    Container(
                      width: 34,
                      height: 34,
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0x3314B8A6), Color(0x3306B6D4)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: const Color(0x5914B8A6)),
                      ),
                      child: const Icon(
                        Icons.chat_bubble_rounded,
                        color: Color(0xFF14B8A6),
                        size: 17,
                      ),
                    ),
                    const SizedBox(width: 10),
                    const Text(
                      'Bình luận',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.2,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: const Color(0x2614B8A6),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0x4D14B8A6)),
                      ),
                      child: Text(
                        '$_commentCount',
                        style: const TextStyle(
                          color: Color(0xFF2DD4BF),
                          fontWeight: FontWeight.w800,
                          fontSize: 12,
                        ),
                      ),
                    ),
                    const Spacer(),
                    Material(
                      color: Colors.transparent,
                      child: InkWell(
                        borderRadius: BorderRadius.circular(20),
                        onTap: () => Navigator.pop(context),
                        child: Container(
                          padding: const EdgeInsets.all(6),
                          decoration: BoxDecoration(
                            color: Colors.white.withOpacity(0.06),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(Icons.close_rounded, color: Colors.white70, size: 20),
                        ),
                      ),
                    ),
                  ],
                ),

                // Mini Song Preview Banner
                if (widget.song != null) ...[
                  const SizedBox(height: 10),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.04),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: Colors.white.withOpacity(0.07)),
                    ),
                    child: Row(
                      children: [
                        ClipRRect(
                          borderRadius: BorderRadius.circular(8),
                          child: Image.network(
                            widget.song!.imageUrl,
                            width: 36,
                            height: 36,
                            fit: BoxFit.cover,
                            errorBuilder: (_, __, ___) => Container(
                              width: 36,
                              height: 36,
                              color: const Color(0xFF1F1D2B),
                              child: const Icon(Icons.music_note_rounded, color: Colors.white54, size: 18),
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                widget.song!.title,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 12.5,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              const SizedBox(height: 1),
                              Text(
                                widget.song!.artists.join(', '),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  color: Colors.white54,
                                  fontSize: 11,
                                ),
                              ),
                            ],
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.all(6),
                          decoration: const BoxDecoration(
                            color: Color(0x1F14B8A6),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(
                            Icons.graphic_eq_rounded,
                            size: 16,
                            color: Color(0xFF14B8A6),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],

                // Sort Segmented Buttons Row
                Padding(
                  padding: const EdgeInsets.only(top: 10, bottom: 8),
                  child: Row(
                    children: [
                      const Text(
                        'Sắp xếp',
                        style: TextStyle(
                          color: Colors.white54,
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const Spacer(),
                      _buildSortPill(
                        label: 'Hàng đầu',
                        icon: Icons.local_fire_department_rounded,
                        value: 'top',
                      ),
                      const SizedBox(width: 6),
                      _buildSortPill(
                        label: 'Mới nhất',
                        icon: Icons.bolt_rounded,
                        value: 'new',
                      ),
                    ],
                  ),
                ),

                const Divider(color: Colors.white12, height: 1),

                // Main Comments List Area
                Expanded(
                  child: _isLoading
                      ? const Center(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              CircularProgressIndicator(
                                color: Color(0xFF14B8A6),
                                strokeWidth: 2.5,
                              ),
                              SizedBox(height: 14),
                              Text(
                                'Đang tải bình luận...',
                                style: TextStyle(color: Colors.white54, fontSize: 13),
                              ),
                            ],
                          ),
                        )
                      : RefreshIndicator(
                          color: const Color(0xFF14B8A6),
                          backgroundColor: const Color(0xFF1E1E2C),
                          onRefresh: () => _loadComments(reset: true),
                          child: ListView(
                            physics: const AlwaysScrollableScrollPhysics(
                              parent: BouncingScrollPhysics(),
                            ),
                            padding: const EdgeInsets.symmetric(vertical: 10),
                            children: [
                              if (_comments.isEmpty)
                                _buildEmptyState()
                              else
                                ..._comments.map(
                                  (comment) => _buildCommentNode(comment, depth: 0),
                                ),
                              if (_hasMore)
                                Padding(
                                  padding: const EdgeInsets.symmetric(vertical: 14),
                                  child: Center(
                                    child: ElevatedButton.icon(
                                      style: ElevatedButton.styleFrom(
                                        backgroundColor: Colors.white.withOpacity(0.06),
                                        foregroundColor: const Color(0xFF2DD4BF),
                                        elevation: 0,
                                        shape: RoundedRectangleBorder(
                                          borderRadius: BorderRadius.circular(20),
                                          side: BorderSide(
                                            color: const Color(0xFF14B8A6).withOpacity(0.3),
                                          ),
                                        ),
                                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                                      ),
                                      onPressed: _isLoadingMore ? null : _loadMore,
                                      icon: _isLoadingMore
                                          ? const SizedBox(
                                              width: 14,
                                              height: 14,
                                              child: CircularProgressIndicator(
                                                strokeWidth: 2,
                                                color: Color(0xFF14B8A6),
                                              ),
                                            )
                                          : const Icon(Icons.arrow_downward_rounded, size: 15),
                                      label: const Text(
                                        'Xem thêm bình luận cũ hơn',
                                        style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700),
                                      ),
                                    ),
                                  ),
                                ),
                            ],
                          ),
                        ),
                ),

                // Replying banner
                if (_replyingTo != null)
                  Container(
                    width: double.infinity,
                    margin: const EdgeInsets.only(bottom: 8),
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0x2614B8A6), Color(0x1A00BCD4)],
                      ),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0x4D14B8A6)),
                    ),
                    child: Row(
                      children: [
                        const Icon(
                          Icons.reply_rounded,
                          color: Color(0xFF2DD4BF),
                          size: 16,
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: RichText(
                            text: TextSpan(
                              style: const TextStyle(fontSize: 12, color: Colors.white70),
                              children: [
                                const TextSpan(text: 'Đang trả lời '),
                                TextSpan(
                                  text: '@${_replyingTo!.user.name}',
                                  style: const TextStyle(
                                    color: Color(0xFF2DD4BF),
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                        GestureDetector(
                          onTap: () => setState(() => _replyingTo = null),
                          child: Container(
                            padding: const EdgeInsets.all(3),
                            decoration: BoxDecoration(
                              color: Colors.white.withOpacity(0.1),
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(
                              Icons.close_rounded,
                              color: Colors.white70,
                              size: 14,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),

                // Quick Emojis Row
                Padding(
                  padding: const EdgeInsets.only(bottom: 8, top: 4),
                  child: Row(
                    children: [
                      const Text(
                        'Nhanh:',
                        style: TextStyle(
                          color: Colors.white38,
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: SingleChildScrollView(
                          scrollDirection: Axis.horizontal,
                          child: Row(
                            children: _quickEmojis.map((emoji) {
                              return Padding(
                                padding: const EdgeInsets.only(right: 8),
                                child: InkWell(
                                  borderRadius: BorderRadius.circular(16),
                                  onTap: () => _insertQuickEmoji(emoji),
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                    decoration: BoxDecoration(
                                      color: Colors.white.withOpacity(0.06),
                                      borderRadius: BorderRadius.circular(16),
                                      border: Border.all(
                                        color: Colors.white.withOpacity(0.09),
                                      ),
                                    ),
                                    child: Text(
                                      emoji,
                                      style: const TextStyle(fontSize: 15),
                                    ),
                                  ),
                                ),
                              );
                            }).toList(),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),

                // Input Bar (or Login CTA)
                if (!_isLoggedIn)
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.05),
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(color: Colors.white.withOpacity(0.08)),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.lock_outline_rounded, color: Colors.white54, size: 18),
                        const SizedBox(width: 10),
                        const Expanded(
                          child: Text(
                            'Đăng nhập để tham gia bình luận',
                            style: TextStyle(color: Colors.white70, fontSize: 13),
                          ),
                        ),
                        ElevatedButton(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF14B8A6),
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                          ),
                          onPressed: () {
                            Navigator.pop(context);
                            Navigator.pushNamed(context, '/login');
                          },
                          child: const Text('Đăng nhập', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5)),
                        ),
                      ],
                    ),
                  )
                else
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      // Current user avatar
                      Container(
                        width: 36,
                        height: 36,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          gradient: const LinearGradient(
                            colors: [Color(0xFF14B8A6), Color(0xFF00BCD4)],
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: const Color(0xFF14B8A6).withOpacity(0.35),
                              blurRadius: 8,
                            ),
                          ],
                        ),
                        clipBehavior: Clip.antiAlias,
                        child: (_currentUser?.avatar != null && _currentUser!.avatar.isNotEmpty)
                            ? Image.network(
                                _currentUser!.avatar,
                                width: 36,
                                height: 36,
                                fit: BoxFit.cover,
                                errorBuilder: (_, __, ___) => Center(
                                  child: Text(
                                    (_currentUser?.name.isNotEmpty == true)
                                        ? _currentUser!.name[0].toUpperCase()
                                        : 'U',
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
                                  (_currentUser?.name.isNotEmpty == true)
                                      ? _currentUser!.name[0].toUpperCase()
                                      : 'U',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w800,
                                    fontSize: 13,
                                  ),
                                ),
                              ),
                      ),
                      const SizedBox(width: 10),

                      // Floating pill text field
                      Expanded(
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 2),
                          decoration: BoxDecoration(
                            color: Colors.white.withOpacity(0.06),
                            borderRadius: BorderRadius.circular(24),
                            border: Border.all(
                              color: hasInput
                                  ? const Color(0xFF14B8A6).withOpacity(0.55)
                                  : Colors.white.withOpacity(0.12),
                            ),
                          ),
                          child: TextField(
                            controller: _inputController,
                            focusNode: _inputFocusNode,
                            style: const TextStyle(color: Colors.white, fontSize: 13.5),
                            minLines: 1,
                            maxLines: 3,
                            decoration: InputDecoration(
                              hintText: _replyingTo != null
                                  ? 'Trả lời @${_replyingTo!.user.name}...'
                                  : 'Chia sẻ cảm nghĩ về giai điệu này...',
                              hintStyle: const TextStyle(color: Colors.white38, fontSize: 13),
                              border: InputBorder.none,
                              isDense: true,
                              contentPadding: const EdgeInsets.symmetric(vertical: 10),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),

                      // Gradient Send Button
                      Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          gradient: hasInput
                              ? const LinearGradient(
                                  colors: [Color(0xFF14B8A6), Color(0xFF00BCD4)],
                                  begin: Alignment.topLeft,
                                  end: Alignment.bottomRight,
                                )
                              : null,
                          color: hasInput ? null : Colors.white.withOpacity(0.08),
                          boxShadow: hasInput
                              ? [
                                  BoxShadow(
                                    color: const Color(0xFF14B8A6).withOpacity(0.4),
                                    blurRadius: 12,
                                    offset: const Offset(0, 3),
                                  ),
                                ]
                              : null,
                        ),
                        child: IconButton(
                          padding: EdgeInsets.zero,
                          onPressed: (_isSending || !hasInput) ? null : _submitComment,
                          icon: _isSending
                              ? const SizedBox(
                                  width: 16,
                                  height: 16,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: Colors.white,
                                  ),
                                )
                              : Icon(
                                  Icons.send_rounded,
                                  color: hasInput ? Colors.white : Colors.white30,
                                  size: 18,
                                ),
                        ),
                      ),
                    ],
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildSortPill({
    required String label,
    required IconData icon,
    required String value,
  }) {
    final isSelected = _sort == value;
    return InkWell(
      borderRadius: BorderRadius.circular(16),
      onTap: () {
        if (_sort != value) {
          setState(() => _sort = value);
          _loadComments(reset: true);
        }
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          gradient: isSelected
              ? const LinearGradient(
                  colors: [Color(0xFF14B8A6), Color(0xFF06B6D4)],
                )
              : null,
          color: isSelected ? null : Colors.white.withOpacity(0.05),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isSelected ? const Color(0xFF14B8A6) : Colors.white.withOpacity(0.08),
          ),
          boxShadow: isSelected
              ? [
                  BoxShadow(
                    color: const Color(0xFF14B8A6).withOpacity(0.35),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ]
              : null,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: 13,
              color: isSelected ? Colors.white : Colors.white60,
            ),
            const SizedBox(width: 4),
            Text(
              label,
              style: TextStyle(
                fontSize: 11.5,
                fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                color: isSelected ? Colors.white : Colors.white60,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 48, horizontal: 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: const LinearGradient(
                  colors: [Color(0x2B14B8A6), Color(0x2B6C63FF)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                border: Border.all(color: const Color(0x4D14B8A6), width: 1.5),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x3314B8A6),
                    blurRadius: 24,
                    spreadRadius: 2,
                  ),
                ],
              ),
              child: const Icon(
                Icons.chat_bubble_outline_rounded,
                size: 32,
                color: Color(0xFF14B8A6),
              ),
            ),
            const SizedBox(height: 18),
            const Text(
              'Chưa có bình luận nào',
              style: TextStyle(
                color: Colors.white,
                fontSize: 16,
                fontWeight: FontWeight.w700,
                letterSpacing: -0.2,
              ),
            ),
            const SizedBox(height: 6),
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 24),
              child: Text(
                'Hãy là người đầu tiên chia sẻ cảm xúc và giai điệu yêu thích với cộng đồng!',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: Colors.white54,
                  fontSize: 12.5,
                  height: 1.45,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCommentNode(SongComment comment, {required int depth}) {
    final leftPadding = depth > 0 ? (depth * 20.0 + 8.0) : 0.0;
    final hasAvatar = comment.user.avatar.isNotEmpty;
    final isMine = _currentUserId.isNotEmpty && comment.user.id == _currentUserId;

    // Check if commenter is the artist
    final isSongArtist = widget.song?.artists.any(
          (a) => a.toLowerCase() == comment.user.name.toLowerCase() || a == comment.user.id,
        ) ??
        false;

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

    final avatarSize = depth > 0 ? 30.0 : 36.0;

    return Padding(
      padding: EdgeInsets.only(left: leftPadding, right: 0, top: 8, bottom: 4),
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          // Curved thread line for nested replies
          if (depth > 0)
            Positioned(
              left: -12,
              top: -8,
              bottom: 16,
              width: 14,
              child: CustomPaint(
                painter: _ThreadLinePainter(),
              ),
            ),

          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Avatar
                  Container(
                    width: avatarSize,
                    height: avatarSize,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: avatarGradient,
                      border: isSongArtist
                          ? Border.all(color: const Color(0xFF14B8A6), width: 1.8)
                          : (isMine
                              ? Border.all(color: const Color(0xFF00BCD4), width: 1.8)
                              : Border.all(color: Colors.white.withOpacity(0.12), width: 1)),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.35),
                          blurRadius: 6,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    clipBehavior: Clip.antiAlias,
                    child: hasAvatar
                        ? Image.network(
                            comment.user.avatar,
                            width: avatarSize,
                            height: avatarSize,
                            fit: BoxFit.cover,
                            errorBuilder: (_, __, ___) => Center(
                              child: Text(
                                comment.user.name.isNotEmpty
                                    ? comment.user.name[0].toUpperCase()
                                    : '?',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w800,
                                  fontSize: depth > 0 ? 11 : 13,
                                ),
                              ),
                            ),
                          )
                        : Center(
                            child: Text(
                              comment.user.name.isNotEmpty
                                  ? comment.user.name[0].toUpperCase()
                                  : '?',
                              style: TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.w800,
                                fontSize: depth > 0 ? 11 : 13,
                              ),
                            ),
                          ),
                  ),
                  const SizedBox(width: 10),

                  // Comment Bubble Card
                  Expanded(
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      decoration: BoxDecoration(
                        color: isMine
                            ? const Color(0xFF1B2333)
                            : const Color(0xFF181827),
                        borderRadius: const BorderRadius.only(
                          topLeft: Radius.circular(6),
                          topRight: Radius.circular(18),
                          bottomLeft: Radius.circular(18),
                          bottomRight: Radius.circular(18),
                        ),
                        border: Border.all(
                          color: (_highlightedCommentId == comment.id)
                              ? const Color(0xFF14B8A6)
                              : (isMine
                                  ? const Color(0x4D14B8A6)
                                  : Colors.white.withOpacity(0.08)),
                          width: (_highlightedCommentId == comment.id) ? 2.0 : 1.0,
                        ),
                        boxShadow: [
                          if (_highlightedCommentId == comment.id)
                            BoxShadow(
                              color: const Color(0xFF14B8A6).withOpacity(0.45),
                              blurRadius: 18,
                              spreadRadius: 2,
                            ),
                          BoxShadow(
                            color: Colors.black.withOpacity(0.3),
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
                              Text(
                                comment.user.name,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w800,
                                  fontSize: 13,
                                  letterSpacing: -0.1,
                                ),
                              ),
                              if (isSongArtist) ...[
                                const SizedBox(width: 6),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
                                  decoration: BoxDecoration(
                                    gradient: const LinearGradient(
                                      colors: [Color(0xFF14B8A6), Color(0xFF06B6D4)],
                                    ),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: const Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Icon(Icons.verified_rounded, size: 10, color: Colors.white),
                                      SizedBox(width: 2),
                                      Text(
                                        'Tác giả',
                                        style: TextStyle(
                                          color: Colors.white,
                                          fontSize: 9.5,
                                          fontWeight: FontWeight.w800,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                              if (isMine && !isSongArtist) ...[
                                const SizedBox(width: 6),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
                                  decoration: BoxDecoration(
                                    color: Colors.white.withOpacity(0.08),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: const Text(
                                    'Bạn',
                                    style: TextStyle(
                                      color: Colors.white70,
                                      fontSize: 9.5,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                ),
                              ],
                              const Spacer(),
                              if (isMine)
                                PopupMenuButton<String>(
                                  padding: EdgeInsets.zero,
                                  iconSize: 18,
                                  icon: const Icon(
                                    Icons.more_horiz_rounded,
                                    color: Colors.white54,
                                  ),
                                  color: const Color(0xFF222332),
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  onSelected: (value) => _handleOwnCommentAction(value, comment),
                                  itemBuilder: (context) => const [
                                    PopupMenuItem<String>(
                                      value: 'edit',
                                      child: Row(
                                        children: [
                                          Icon(Icons.edit_rounded, size: 16, color: Colors.white70),
                                          SizedBox(width: 8),
                                          Text('Sửa', style: TextStyle(color: Colors.white, fontSize: 13)),
                                        ],
                                      ),
                                    ),
                                    PopupMenuItem<String>(
                                      value: 'delete',
                                      child: Row(
                                        children: [
                                          Icon(Icons.delete_outline_rounded, size: 16, color: Color(0xFFFB7185)),
                                          SizedBox(width: 8),
                                          Text('Xóa', style: TextStyle(color: Color(0xFFFB7185), fontSize: 13)),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(
                            comment.content,
                            style: const TextStyle(
                              color: Color(0xFFF1F5F9),
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

              // Reaction and Action row
              Padding(
                padding: EdgeInsets.only(left: avatarSize + 10),
                child: SongCommentReactions(
                  comment: comment,
                  currentUserId: _currentUserId,
                  onSelectReaction: (type) => _sendReaction(comment, type),
                  onRemoveReaction: () => _removeReaction(comment),
                  onReply: () {
                    setState(() {
                      _replyingTo = comment;
                      _expandedReplyIds.add(comment.id);
                    });
                    _inputFocusNode.requestFocus();
                  },
                  timeAgo: _formatTimeAgo(comment.createdAt),
                ),
              ),

              // Toggle replies button
              if (comment.replies.isNotEmpty)
                Padding(
                  padding: EdgeInsets.only(left: avatarSize + 10, top: 4, bottom: 6),
                  child: Material(
                    color: Colors.transparent,
                    child: InkWell(
                      borderRadius: BorderRadius.circular(14),
                      onTap: () {
                        setState(() {
                          if (_expandedReplyIds.contains(comment.id)) {
                            _expandedReplyIds.remove(comment.id);
                          } else {
                            _expandedReplyIds.add(comment.id);
                          }
                        });
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: const Color(0x1414B8A6),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: const Color(0x3314B8A6)),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              _expandedReplyIds.contains(comment.id)
                                  ? Icons.keyboard_arrow_up_rounded
                                  : Icons.subdirectory_arrow_right_rounded,
                              size: 14,
                              color: const Color(0xFF2DD4BF),
                            ),
                            const SizedBox(width: 5),
                            Text(
                              _expandedReplyIds.contains(comment.id)
                                  ? (comment.replies.length == 1
                                      ? 'Ẩn câu trả lời'
                                      : 'Ẩn ${comment.replies.length} câu trả lời')
                                  : (comment.replies.length == 1
                                      ? 'Xem 1 câu trả lời'
                                      : 'Xem ${comment.replies.length} câu trả lời'),
                              style: const TextStyle(
                                fontSize: 11.5,
                                fontWeight: FontWeight.w700,
                                color: Color(0xFF2DD4BF),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),

              // Recursive Child replies
              if (comment.replies.isNotEmpty && _expandedReplyIds.contains(comment.id))
                ...comment.replies.map(
                  (child) => _buildCommentNode(child, depth: depth + 1),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Painter to draw curved connection line for threaded replies
class _ThreadLinePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = const Color(0x4D14B8A6)
      ..strokeWidth = 1.8
      ..style = PaintingStyle.stroke;

    final path = Path()
      ..moveTo(size.width * 0.4, 0)
      ..lineTo(size.width * 0.4, size.height - 12)
      ..quadraticBezierTo(
        size.width * 0.4,
        size.height,
        size.width,
        size.height,
      );

    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
