import 'package:flutter/material.dart';
import 'package:musicflow_app/data/models/comment_model.dart';
import 'package:musicflow_app/data/services/auth_service.dart';
import 'package:musicflow_app/data/services/comment_service.dart';

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
  String? _statusMessage;
  bool _statusIsError = false;

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
        _statusIsError = true;
        _statusMessage = result.message ?? 'Khong tai duoc binh luan';
      });
      return;
    }

    setState(() {
      _isLoading = false;
      _isLoadingMore = false;
      _statusMessage = null;
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
      _setStatus('Vui long dang nhap de binh luan', isError: true);
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
      _setStatus(result.message ?? 'Gui binh luan that bai', isError: true);
      return;
    }

    _inputController.clear();
    setState(() => _replyingTo = null);
    _setStatus('Da gui binh luan', isError: false);
    await _loadComments(reset: true);
  }

  Future<void> _toggleLikeReaction(SongComment comment) async {
    final isLoggedIn = await AuthService.isLoggedIn();
    if (!isLoggedIn) {
      _setStatus('Vui long dang nhap de thao tac like', isError: true);
      return;
    }

    final hasLiked = comment.reactions.any(
      (reaction) => reaction.userId == _currentUserId && reaction.type == 'like',
    );

    final result = hasLiked
        ? await CommentService.removeReaction(comment.id)
      : await CommentService.reactToComment(commentId: comment.id);

    if (!mounted) return;

    if (!result.success) {
      _setStatus(result.message ?? 'Khong the cap nhat like', isError: true);
      return;
    }

    _setStatus(hasLiked ? 'Da bo like' : 'Da like binh luan', isError: false);
    await _loadComments(reset: true);
  }

  Future<void> _editComment(SongComment comment) async {
    final isLoggedIn = await AuthService.isLoggedIn();
    if (!isLoggedIn) {
      _setStatus('Vui long dang nhap de sua binh luan', isError: true);
      return;
    }

    final controller = TextEditingController(text: comment.content);

    final nextContent = await showDialog<String>(
      context: context,
      builder: (context) {
        return AlertDialog(
          backgroundColor: const Color(0xFF1B1B1B),
          title: const Text('Sua binh luan', style: TextStyle(color: Colors.white)),
          content: TextField(
            controller: controller,
            style: const TextStyle(color: Colors.white),
            maxLines: 4,
            decoration: const InputDecoration(
              hintText: 'Nhap noi dung',
              hintStyle: TextStyle(color: Colors.white38),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Huy'),
            ),
            ElevatedButton(
              onPressed: () => Navigator.pop(context, controller.text.trim()),
              child: const Text('Luu'),
            ),
          ],
        );
      },
    );

    controller.dispose();

    if (nextContent == null || nextContent.isEmpty) return;

    final result = await CommentService.updateComment(commentId: comment.id, content: nextContent);
    if (!mounted) return;

    _setStatus(result.message ?? 'Cap nhat binh luan', isError: !result.success);
    if (result.success) {
      await _loadComments(reset: true);
    }
  }

  Future<void> _deleteComment(SongComment comment) async {
    final isLoggedIn = await AuthService.isLoggedIn();
    if (!isLoggedIn) {
      _setStatus('Vui long dang nhap de xoa binh luan', isError: true);
      return;
    }

    final shouldDelete = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF1B1B1B),
        title: const Text('Xoa binh luan?', style: TextStyle(color: Colors.white)),
        content: const Text(
          'Binh luan va cac tra loi con se bi xoa.',
          style: TextStyle(color: Colors.white70),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Huy')),
          ElevatedButton(onPressed: () => Navigator.pop(context, true), child: const Text('Xoa')),
        ],
      ),
    );

    if (shouldDelete != true) return;

    final result = await CommentService.deleteComment(comment.id);
    if (!mounted) return;

    _setStatus(result.message ?? 'Xoa binh luan', isError: !result.success);
    if (result.success) {
      await _loadComments(reset: true);
    }
  }

  void _setStatus(String message, {required bool isError}) {
    if (!mounted) return;
    setState(() {
      _statusMessage = message;
      _statusIsError = isError;
    });

    final messenger = ScaffoldMessenger.maybeOf(context);
    messenger?.showSnackBar(
      SnackBar(
        content: Text(message),
        duration: const Duration(milliseconds: 1600),
        backgroundColor: isError ? Colors.redAccent.withOpacity(0.9) : null,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
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
                    'Binh luan ($_commentCount)',
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
                        child: CircularProgressIndicator(color: Colors.greenAccent),
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
                                    'Chua co binh luan nao',
                                    style: TextStyle(color: Colors.white54),
                                  ),
                                ),
                              ),
                            ..._comments.map(
                              (comment) => _buildCommentNode(comment, depth: 0),
                            ),
                            if (_hasMore)
                              Padding(
                                padding: const EdgeInsets.symmetric(vertical: 10),
                                child: TextButton(
                                  onPressed: _isLoadingMore ? null : _loadMore,
                                  child: _isLoadingMore
                                      ? const SizedBox(
                                          width: 16,
                                          height: 16,
                                          child: CircularProgressIndicator(strokeWidth: 2),
                                        )
                                      : const Text('Xem them binh luan'),
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
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.07),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          'Dang tra loi ${_replyingTo!.user.name}',
                          style: const TextStyle(color: Colors.white70, fontSize: 12),
                        ),
                      ),
                      GestureDetector(
                        onTap: () => setState(() => _replyingTo = null),
                        child: const Icon(Icons.close, color: Colors.white54, size: 16),
                      ),
                    ],
                  ),
                ),
              if (_statusMessage != null)
                Container(
                  width: double.infinity,
                  margin: const EdgeInsets.only(bottom: 8),
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  decoration: BoxDecoration(
                    color: _statusIsError
                        ? Colors.redAccent.withOpacity(0.15)
                        : Colors.greenAccent.withOpacity(0.12),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: _statusIsError
                          ? Colors.redAccent.withOpacity(0.5)
                          : Colors.greenAccent.withOpacity(0.4),
                    ),
                  ),
                  child: Text(
                    _statusMessage!,
                    style: TextStyle(
                      color: _statusIsError ? Colors.redAccent : Colors.greenAccent,
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                    ),
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
                          hintText: 'Viet binh luan...',
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
                          : const Icon(Icons.send_rounded, color: Colors.greenAccent),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildCommentNode(SongComment comment, {required int depth}) {
    final leftPadding = 8.0 + (depth * 16);
    final hasAvatar = comment.user.avatar.isNotEmpty;
    final isMine = _currentUserId.isNotEmpty && comment.user.id == _currentUserId;
    final hasLiked = comment.reactions.any(
      (reaction) => reaction.userId == _currentUserId && reaction.type == 'like',
    );

    final reactionText = '👍 ${comment.reactionSummary['like'] ?? 0}';

    return Padding(
      padding: EdgeInsets.only(left: leftPadding, right: 6, top: 8, bottom: 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CircleAvatar(
                radius: 14,
                backgroundColor: Colors.white12,
                backgroundImage: hasAvatar ? NetworkImage(comment.user.avatar) : null,
                child: hasAvatar
                    ? null
                    : const Icon(Icons.person, size: 15, color: Colors.white70),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.06),
                    borderRadius: BorderRadius.circular(12),
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
                                color: Colors.white,
                                fontWeight: FontWeight.w600,
                                fontSize: 13,
                              ),
                            ),
                          ),
                          if (isMine)
                            PopupMenuButton<String>(
                              icon: const Icon(Icons.more_horiz, color: Colors.white54, size: 18),
                              color: const Color(0xFF222222),
                              onSelected: (value) {
                                if (value == 'edit') {
                                  _editComment(comment);
                                }
                                if (value == 'delete') {
                                  _deleteComment(comment);
                                }
                              },
                              itemBuilder: (context) => const [
                                PopupMenuItem(value: 'edit', child: Text('Sua')),
                                PopupMenuItem(value: 'delete', child: Text('Xoa')),
                              ],
                            ),
                        ],
                      ),
                      const SizedBox(height: 3),
                      Text(
                        comment.content,
                        style: const TextStyle(color: Colors.white70, fontSize: 13),
                      ),
                      const SizedBox(height: 7),
                      Wrap(
                        spacing: 12,
                        runSpacing: 6,
                        children: [
                          GestureDetector(
                            onTap: () => setState(() => _replyingTo = comment),
                            child: const Text(
                              'Tra loi',
                              style: TextStyle(color: Colors.white54, fontSize: 11),
                            ),
                          ),
                          GestureDetector(
                            onTap: () => _toggleLikeReaction(comment),
                            child: Text(
                              hasLiked ? 'Bo like' : 'Like',
                              style: TextStyle(
                                color: hasLiked ? Colors.redAccent : Colors.greenAccent,
                                fontSize: 11,
                              ),
                            ),
                          ),
                          Text(
                            reactionText,
                            style: const TextStyle(color: Colors.white38, fontSize: 11),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          ...comment.replies.map((child) => _buildCommentNode(child, depth: depth + 1)),
        ],
      ),
    );
  }
}
