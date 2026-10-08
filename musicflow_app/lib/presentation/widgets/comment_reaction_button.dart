import 'dart:async';
import 'package:flutter/material.dart';
import '../../data/models/comment_model.dart';

class CommentReactionConfig {
  final String key;
  final String label;
  final String emoji;
  final Color color;

  const CommentReactionConfig({
    required this.key,
    required this.label,
    required this.emoji,
    required this.color,
  });
}

const List<CommentReactionConfig> kCommentReactions = [
  CommentReactionConfig(
    key: 'like',
    label: 'Thích',
    emoji: '👍',
    color: Color(0xFF2E89FF), // Xanh dương Facebook
  ),
  CommentReactionConfig(
    key: 'love',
    label: 'Yêu thích',
    emoji: '❤️',
    color: Color(0xFFFF2D55),
  ),
  CommentReactionConfig(
    key: 'haha',
    label: 'Haha',
    emoji: '😆',
    color: Color(0xFFF7B125),
  ),
  CommentReactionConfig(
    key: 'wow',
    label: 'Wow',
    emoji: '😮',
    color: Color(0xFFF7B125),
  ),
  CommentReactionConfig(
    key: 'sad',
    label: 'Buồn',
    emoji: '😢',
    color: Color(0xFFF7B125),
  ),
  CommentReactionConfig(
    key: 'angry',
    label: 'Tức giận',
    emoji: '😡',
    color: Color(0xFFE24B26),
  ),
];

/// Facebook-style Reaction Button with auto-hover popup bar on Web/Desktop
/// and long-press popup on Mobile.
class CommentReactionButton extends StatefulWidget {
  final SongComment comment;
  final String currentUserId;
  final ValueChanged<String> onSelectReaction;
  final VoidCallback onToggleLike;

  const CommentReactionButton({
    super.key,
    required this.comment,
    required this.currentUserId,
    required this.onSelectReaction,
    required this.onToggleLike,
  });

  @override
  State<CommentReactionButton> createState() => _CommentReactionButtonState();
}

class _CommentReactionButtonState extends State<CommentReactionButton> {
  final GlobalKey _buttonKey = GlobalKey();
  OverlayEntry? _overlayEntry;
  Timer? _hoverShowTimer;
  Timer? _hoverHideTimer;
  bool _isHoveringPopup = false;

  @override
  void dispose() {
    _cancelTimers();
    _removeOverlay();
    super.dispose();
  }

  void _cancelTimers() {
    _hoverShowTimer?.cancel();
    _hoverShowTimer = null;
    _hoverHideTimer?.cancel();
    _hoverHideTimer = null;
  }

  void _removeOverlay() {
    _overlayEntry?.remove();
    _overlayEntry = null;
  }

  void _showOverlay() {
    if (_overlayEntry != null || !mounted) return;

    final renderBox = _buttonKey.currentContext?.findRenderObject() as RenderBox?;
    if (renderBox == null) return;

    final position = renderBox.localToGlobal(Offset.zero);
    final mediaQuery = MediaQuery.of(context);
    final screenWidth = mediaQuery.size.width;

    const popupWidth = 248.0;
    const popupHeight = 48.0;

    // Can le de popup khong bao gio bi tran mep trai hoac mep phai
    final double left = (position.dx - 16.0).clamp(12.0, screenWidth - popupWidth - 12.0);
    // Cach nut 12px de tranh tro chuot bi cham nham khi popup vua bat len
    final double top = (position.dy - popupHeight - 12.0).clamp(36.0, mediaQuery.size.height - popupHeight - 12.0);

    _overlayEntry = OverlayEntry(
      builder: (ctx) {
        return Stack(
          clipBehavior: Clip.none,
          children: [
            // Barrier tap-to-dismiss
            Positioned.fill(
              child: GestureDetector(
                behavior: HitTestBehavior.translucent,
                onTap: _removeOverlay,
              ),
            ),
            // Floating reaction picker bar
            Positioned(
              left: left,
              top: top,
              child: MouseRegion(
                onEnter: (_) {
                  _isHoveringPopup = true;
                  _cancelTimers();
                },
                onExit: (_) {
                  _isHoveringPopup = false;
                  _scheduleHide();
                },
                child: Material(
                  color: Colors.transparent,
                  clipBehavior: Clip.none,
                  child: Container(
                    clipBehavior: Clip.none,
                    width: popupWidth,
                    height: popupHeight,
                    padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
                    decoration: BoxDecoration(
                      color: const Color(0xFF221A3E),
                      borderRadius: BorderRadius.circular(26),
                      border: Border.all(color: Colors.white.withOpacity(0.2)),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.6),
                          blurRadius: 18,
                          offset: const Offset(0, 6),
                        ),
                      ],
                    ),
                    child: Row(
                      children: kCommentReactions.map((reaction) {
                        return Expanded(
                          child: _HoverableEmojiItem(
                            reaction: reaction,
                            onTap: () {
                              _removeOverlay();
                              widget.onSelectReaction(reaction.key);
                            },
                          ),
                        );
                      }).toList(),
                    ),
                  ),
                ),
              ),
            ),
          ],
        );
      },
    );

    Overlay.of(context).insert(_overlayEntry!);
  }

  void _scheduleShow() {
    _cancelTimers();
    _hoverShowTimer = Timer(const Duration(milliseconds: 180), () {
      if (mounted) _showOverlay();
    });
  }

  void _scheduleHide() {
    _cancelTimers();
    _hoverHideTimer = Timer(const Duration(milliseconds: 220), () {
      if (!_isHoveringPopup && mounted) {
        _removeOverlay();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final myReaction = widget.comment.reactions.cast<CommentReaction?>().firstWhere(
      (r) => r?.userId == widget.currentUserId,
      orElse: () => null,
    );

    final myConfig = myReaction != null
        ? kCommentReactions.firstWhere(
            (c) => c.key == myReaction.type,
            orElse: () => kCommentReactions[0],
          )
        : null;

    final isLiked = myConfig != null;
    final textColor = isLiked ? myConfig.color : Colors.white60;
    final label = isLiked ? myConfig.label : 'Thích';

    return MouseRegion(
      onEnter: (_) => _scheduleShow(),
      onExit: (_) => _scheduleHide(),
      child: GestureDetector(
        key: _buttonKey,
        behavior: HitTestBehavior.opaque,
        onTap: () {
          _removeOverlay();
          widget.onToggleLike();
        },
        onLongPress: () {
          _cancelTimers();
          _showOverlay();
        },
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
          decoration: const BoxDecoration(
            color: Colors.transparent, // Nền trong suốt mặc định
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (isLiked && myConfig.key != 'like') ...[
                Text(myConfig.emoji, style: const TextStyle(fontSize: 12)),
                const SizedBox(width: 4),
              ] else ...[
                Icon(
                  isLiked ? Icons.thumb_up_alt_rounded : Icons.thumb_up_alt_outlined,
                  size: 13,
                  color: textColor,
                ),
                const SizedBox(width: 4),
              ],
              Text(
                label,
                style: TextStyle(
                  color: textColor,
                  fontSize: 11.5,
                  fontWeight: isLiked ? FontWeight.w700 : FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _HoverableEmojiItem extends StatefulWidget {
  final CommentReactionConfig reaction;
  final VoidCallback onTap;

  const _HoverableEmojiItem({
    required this.reaction,
    required this.onTap,
  });

  @override
  State<_HoverableEmojiItem> createState() => _HoverableEmojiItemState();
}

class _HoverableEmojiItemState extends State<_HoverableEmojiItem> {
  bool _isHovered = false;

  @override
  Widget build(BuildContext context) {
    return MouseRegion(
      cursor: SystemMouseCursors.click,
      onEnter: (_) => setState(() => _isHovered = true),
      onExit: (_) => setState(() => _isHovered = false),
      child: GestureDetector(
        onTap: widget.onTap,
        child: Center(
          child: Stack(
            clipBehavior: Clip.none,
            alignment: Alignment.center,
            children: [
              // Emoji icon with smooth scale & bounce
              AnimatedScale(
                scale: _isHovered ? 1.35 : 1.0,
                duration: const Duration(milliseconds: 140),
                curve: Curves.easeOutBack,
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 140),
                  transform: Matrix4.translationValues(0, _isHovered ? -4 : 0, 0),
                  padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 2),
                  child: Text(
                    widget.reaction.emoji,
                    style: const TextStyle(fontSize: 22),
                  ),
                ),
              ),
              // Facebook-style Floating Label pill (only visible when actively hovered)
              if (_isHovered)
                Positioned(
                  top: -32,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: Colors.black.withOpacity(0.85),
                      borderRadius: BorderRadius.circular(12),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.4),
                          blurRadius: 6,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: Text(
                      widget.reaction.label,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 0.2,
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
