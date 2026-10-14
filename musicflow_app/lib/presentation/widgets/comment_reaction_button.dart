import 'dart:math' as math;
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
    this.color = const Color(0xFFB7A4FF),
  });
}

/// 12 primary reactions from Lucian UX/UI Prompt #077
const List<CommentReactionConfig> kCommentReactions = [
  CommentReactionConfig(
    key: 'like',
    label: 'Like',
    emoji: '👍',
    color: Color(0xFF2E89FF),
  ),
  CommentReactionConfig(
    key: 'love',
    label: 'Heart',
    emoji: '❤️',
    color: Color(0xFFFF2D55),
  ),
  CommentReactionConfig(
    key: 'haha',
    label: 'Laugh',
    emoji: '😂',
    color: Color(0xFFF7B125),
  ),
  CommentReactionConfig(
    key: 'celebrate',
    label: 'Celebrate',
    emoji: '🎉',
    color: Color(0xFFFF7D8C),
  ),
  CommentReactionConfig(
    key: 'fire',
    label: 'Fire',
    emoji: '🔥',
    color: Color(0xFFFF5A2D),
  ),
  CommentReactionConfig(
    key: 'watching',
    label: 'Watching',
    emoji: '👀',
    color: Color(0xFF7DB4FF),
  ),
  CommentReactionConfig(
    key: 'thanks',
    label: 'Thanks',
    emoji: '🙏',
    color: Color(0xFFB7A4FF),
  ),
  CommentReactionConfig(
    key: 'done',
    label: 'Done',
    emoji: '✅',
    color: Color(0xFF119C72),
  ),
  CommentReactionConfig(
    key: 'idea',
    label: 'Idea',
    emoji: '💡',
    color: Color(0xFFFFD13B),
  ),
  CommentReactionConfig(
    key: 'wow',
    label: 'Wow',
    emoji: '😮',
    color: Color(0xFFF7B125),
  ),
  CommentReactionConfig(
    key: 'launch',
    label: 'Launch',
    emoji: '🚀',
    color: Color(0xFF3D8BFF),
  ),
  CommentReactionConfig(
    key: 'clap',
    label: 'Clap',
    emoji: '👏',
    color: Color(0xFFFFB26B),
  ),
  // Backward compatibility
  CommentReactionConfig(
    key: 'sad',
    label: 'Sad',
    emoji: '😢',
    color: Color(0xFFF7B125),
  ),
  CommentReactionConfig(
    key: 'angry',
    label: 'Angry',
    emoji: '😡',
    color: Color(0xFFE24B26),
  ),
];

/// The 12 emojis displayed in the MusicFlow frequently used reaction grid
final List<CommentReactionConfig> kMusicFlowReactionEmojis =
    kCommentReactions.take(12).toList();

CommentReactionConfig getCommentReactionConfig(String key) {
  return kCommentReactions.firstWhere(
    (c) => c.key == key,
    orElse: () => kCommentReactions[0],
  );
}

/// MusicFlow Song Comment Reaction Row & Floating Emoji Picker
class SongCommentReactions extends StatefulWidget {
  final SongComment comment;
  final String currentUserId;
  final ValueChanged<String> onSelectReaction;
  final VoidCallback onRemoveReaction;
  final VoidCallback? onReply;
  final String? timeAgo;

  const SongCommentReactions({
    super.key,
    required this.comment,
    required this.currentUserId,
    required this.onSelectReaction,
    required this.onRemoveReaction,
    this.onReply,
    this.timeAgo,
  });

  @override
  State<SongCommentReactions> createState() =>
      _SongCommentReactionsState();
}

class _SongCommentReactionsState extends State<SongCommentReactions> {
  final GlobalKey _addButtonKey = GlobalKey();
  OverlayEntry? _overlayEntry;
  bool _isPopupOpen = false;

  @override
  void dispose() {
    _closePopup();
    super.dispose();
  }

  void _closePopup() {
    if (_overlayEntry != null) {
      _overlayEntry?.remove();
      _overlayEntry = null;
      if (mounted) {
        setState(() => _isPopupOpen = false);
      }
    }
  }

  void _togglePopup() {
    if (_isPopupOpen) {
      _closePopup();
    } else {
      _openPopup();
    }
  }

  void _openPopup() {
    if (_overlayEntry != null || !mounted) return;

    final renderBox =
        _addButtonKey.currentContext?.findRenderObject() as RenderBox?;
    if (renderBox == null) return;

    final buttonPos = renderBox.localToGlobal(Offset.zero);
    final buttonSize = renderBox.size;
    final mediaQuery = MediaQuery.of(context);
    final screenWidth = mediaQuery.size.width;
    final screenHeight = mediaQuery.size.height;

    const popupWidth = 264.0;
    const popupHeight = 124.0;

    // Anchor X at the center of the add button
    final ax = buttonPos.dx + buttonSize.width / 2;
    final ay = buttonPos.dy;

    // Clamp horizontally so popup never clips off-screen
    final double left =
        (ax - 44.0).clamp(12.0, screenWidth - popupWidth - 12.0);

    // Determine whether popup shows above or below the button
    final bool showAbove = (ay - popupHeight - 10.0) >= 48.0;
    final double top = showAbove
        ? ay - popupHeight - 10.0
        : (ay + buttonSize.height + 10.0).clamp(
            12.0, screenHeight - popupHeight - 12.0);

    // Arrow offset inside the popup
    final double arrowX = (ax - left).clamp(20.0, popupWidth - 20.0);

    setState(() => _isPopupOpen = true);

    _overlayEntry = OverlayEntry(
      builder: (ctx) {
        return Stack(
          children: [
            // Outside tap dismiss
            Positioned.fill(
              child: GestureDetector(
                behavior: HitTestBehavior.translucent,
                onTap: _closePopup,
              ),
            ),
            // Floating Popup Card
            Positioned(
              left: left,
              top: top,
              child: Material(
                color: Colors.transparent,
                child: _Prompt077PickerPopup(
                  arrowX: arrowX,
                  isArrowAtBottom: showAbove,
                  onSelect: (type) {
                    _closePopup();
                    _handleReactionSelect(type);
                  },
                ),
              ),
            ),
          ],
        );
      },
    );

    Overlay.of(context).insert(_overlayEntry!);
  }

  void _handleReactionSelect(String type) {
    // Check if the user already has this specific reaction
    final myCurrentReaction = widget.comment.reactions
        .cast<CommentReaction?>()
        .firstWhere(
          (r) => r?.userId == widget.currentUserId,
          orElse: () => null,
        );

    if (myCurrentReaction != null && myCurrentReaction.type == type) {
      widget.onRemoveReaction();
    } else {
      widget.onSelectReaction(type);
    }
  }

  @override
  Widget build(BuildContext context) {
    final summary = widget.comment.reactionSummary;

    // Find current user's active reaction
    final myReaction = widget.comment.reactions
        .cast<CommentReaction?>()
        .firstWhere(
          (r) => r?.userId == widget.currentUserId,
          orElse: () => null,
        );
    final myReactionType = myReaction?.type;

    // Gather all active reaction keys with count > 0, plus user's reaction if not in summary
    final Set<String> activeKeys = {};
    summary.forEach((key, count) {
      if (count > 0) activeKeys.add(key);
    });
    if (myReactionType != null && myReactionType.isNotEmpty) {
      activeKeys.add(myReactionType);
    }

    return Padding(
      padding: const EdgeInsets.only(top: 6),
      child: Wrap(
        spacing: 6,
        runSpacing: 6,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          // Reaction chips (Prompt #077 .u077-chip)
          ...activeKeys.map((key) {
            final config = getCommentReactionConfig(key);
            final count = summary[key] ??
                (myReactionType == key ? 1 : 0);
            final isPressed = myReactionType == key;

            return _Prompt077Chip(
              config: config,
              count: count,
              isPressed: isPressed,
              onTap: () {
                if (isPressed) {
                  widget.onRemoveReaction();
                } else {
                  widget.onSelectReaction(key);
                }
              },
            );
          }),

          // Add reaction button (Prompt #077 .u077-add)
          _Prompt077AddButton(
            key: _addButtonKey,
            isExpanded: _isPopupOpen,
            onTap: _togglePopup,
          ),

          // Action: Reply button
          if (widget.onReply != null)
            GestureDetector(
              onTap: widget.onReply,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.transparent,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Text(
                  'Trả lời',
                  style: TextStyle(
                    color: Colors.white54,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),

          // Time ago
          if (widget.timeAgo != null && widget.timeAgo!.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(left: 2),
              child: Text(
                widget.timeAgo!,
                style: TextStyle(
                  color: Colors.white.withOpacity(0.35),
                  fontSize: 11,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// Prompt #077 Chip: Pill shape, count with tabular nums, spring pop bounce on toggle
class _Prompt077Chip extends StatefulWidget {
  final CommentReactionConfig config;
  final int count;
  final bool isPressed;
  final VoidCallback onTap;

  const _Prompt077Chip({
    required this.config,
    required this.count,
    required this.isPressed,
    required this.onTap,
  });

  @override
  State<_Prompt077Chip> createState() => _Prompt077ChipState();
}

class _Prompt077ChipState extends State<_Prompt077Chip>
    with SingleTickerProviderStateMixin {
  late AnimationController _animController;
  late Animation<double> _scaleAnimation;
  bool _isHovered = false;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 320),
    );

    _scaleAnimation = TweenSequence<double>([
      TweenSequenceItem(
        tween: Tween<double>(begin: 1.0, end: 1.25)
            .chain(CurveTween(curve: Curves.easeOut)),
        weight: 45,
      ),
      TweenSequenceItem(
        tween: Tween<double>(begin: 1.25, end: 1.0)
            .chain(CurveTween(curve: Curves.elasticOut)),
        weight: 55,
      ),
    ]).animate(_animController);
  }

  @override
  void didUpdateWidget(covariant _Prompt077Chip oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.isPressed != oldWidget.isPressed ||
        widget.count != oldWidget.count) {
      _animController.forward(from: 0.0);
    }
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isPressed = widget.isPressed;
    const accentColor = Color(0xFFB7A4FF);
    final accentSoft = accentColor.withOpacity(0.16);

    return MouseRegion(
      cursor: SystemMouseCursors.click,
      onEnter: (_) => setState(() => _isHovered = true),
      onExit: (_) => setState(() => _isHovered = false),
      child: GestureDetector(
        onTap: () {
          _animController.forward(from: 0.0);
          widget.onTap();
        },
        child: ScaleTransition(
          scale: _scaleAnimation,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            curve: Curves.easeOutCubic,
            height: 32,
            padding: const EdgeInsets.symmetric(horizontal: 10),
            decoration: BoxDecoration(
              color: isPressed
                  ? accentSoft
                  : (_isHovered
                      ? Colors.white.withOpacity(0.12)
                      : Colors.white.withOpacity(0.08)),
              borderRadius: BorderRadius.circular(999),
              border: Border.all(
                color: isPressed ? accentColor : Colors.white.withOpacity(0.06),
                width: 1.5,
              ),
              boxShadow: isPressed
                  ? [
                      BoxShadow(
                        color: accentColor.withOpacity(0.25),
                        blurRadius: 8,
                        offset: const Offset(0, 2),
                      ),
                    ]
                  : null,
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Text(
                  widget.config.emoji,
                  style: const TextStyle(fontSize: 14, height: 1.1),
                ),
                const SizedBox(width: 5),
                Text(
                  '${widget.count}',
                  style: TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w800,
                    color: isPressed ? accentColor : Colors.white70,
                    letterSpacing: -0.2,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Prompt #077 Add Reaction Button (.u077-add):
/// Circular 32x32 button with smiley outline icon
class _Prompt077AddButton extends StatefulWidget {
  final bool isExpanded;
  final VoidCallback onTap;

  const _Prompt077AddButton({
    super.key,
    required this.isExpanded,
    required this.onTap,
  });

  @override
  State<_Prompt077AddButton> createState() => _Prompt077AddButtonState();
}

class _Prompt077AddButtonState extends State<_Prompt077AddButton> {
  bool _isHovered = false;

  @override
  Widget build(BuildContext context) {
    final isActive = widget.isExpanded || _isHovered;

    return MouseRegion(
      cursor: SystemMouseCursors.click,
      onEnter: (_) => setState(() => _isHovered = true),
      onExit: (_) => setState(() => _isHovered = false),
      child: GestureDetector(
        onTap: widget.onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          width: 32,
          height: 32,
          decoration: BoxDecoration(
            color: isActive
                ? Colors.white.withOpacity(0.16)
                : Colors.white.withOpacity(0.08),
            shape: BoxShape.circle,
            border: Border.all(
              color: isActive
                  ? const Color(0xFFB7A4FF).withOpacity(0.4)
                  : Colors.white.withOpacity(0.06),
              width: 1,
            ),
          ),
          child: Center(
            child: CustomPaint(
              size: const Size(18, 18),
              painter: _SmileyIconPainter(
                color: isActive ? Colors.white : Colors.white70,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Custom painter for the exact Prompt #077 SVG smiley icon
class _SmileyIconPainter extends CustomPainter {
  final Color color;

  _SmileyIconPainter({required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final strokePaint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.6
      ..strokeCap = StrokeCap.round;

    final fillPaint = Paint()
      ..color = color
      ..style = PaintingStyle.fill;

    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width * 0.44;

    // Face circle
    canvas.drawCircle(center, radius, strokePaint);

    // Left eye dot
    canvas.drawCircle(
      Offset(center.dx - 3.2, center.dy - 1.8),
      1.1,
      fillPaint,
    );

    // Right eye dot
    canvas.drawCircle(
      Offset(center.dx + 3.2, center.dy - 1.8),
      1.1,
      fillPaint,
    );

    // Smile arc
    final smileRect = Rect.fromCenter(
      center: Offset(center.dx, center.dy + 1.2),
      width: 7.2,
      height: 4.8,
    );
    canvas.drawArc(smileRect, 0.2, math.pi - 0.4, false, strokePaint);
  }

  @override
  bool shouldRepaint(covariant _SmileyIconPainter oldDelegate) =>
      oldDelegate.color != color;
}

/// Prompt #077 Picker Popup Card (.u077-pop) with Beak & 12 Emoji Grid
class _Prompt077PickerPopup extends StatefulWidget {
  final double arrowX;
  final bool isArrowAtBottom;
  final ValueChanged<String> onSelect;

  const _Prompt077PickerPopup({
    required this.arrowX,
    required this.isArrowAtBottom,
    required this.onSelect,
  });

  @override
  State<_Prompt077PickerPopup> createState() => _Prompt077PickerPopupState();
}

class _Prompt077PickerPopupState extends State<_Prompt077PickerPopup>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _scaleAnimation;
  late Animation<double> _opacityAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 280),
    );

    _scaleAnimation = CurvedAnimation(
      parent: _controller,
      curve: Curves.easeOutBack,
    );

    _opacityAnimation = CurvedAnimation(
      parent: _controller,
      curve: Curves.easeOut,
    );

    _controller.forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    const cardBg = Color(0xFF14151E);
    const borderColor = Color(0x28FFFFFF);

    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        return Transform.scale(
          scale: _scaleAnimation.value,
          alignment: widget.isArrowAtBottom
              ? Alignment(
                  (widget.arrowX / 132.0) - 1.0,
                  1.0,
                )
              : Alignment(
                  (widget.arrowX / 132.0) - 1.0,
                  -1.0,
                ),
          child: Opacity(
            opacity: _opacityAnimation.value,
            child: child,
          ),
        );
      },
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          // Main rounded card
          Container(
            width: 264,
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
            decoration: BoxDecoration(
              color: cardBg,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: borderColor, width: 1),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.65),
                  blurRadius: 36,
                  offset: const Offset(0, 14),
                ),
                BoxShadow(
                  color: const Color(0xFF6C63FF).withOpacity(0.12),
                  blurRadius: 24,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Header: Frequently used / Thường dùng
                const Padding(
                  padding: EdgeInsets.only(left: 6, bottom: 6, top: 2),
                  child: Text(
                    'THƯỜNG DÙNG',
                    style: TextStyle(
                      fontSize: 10.5,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.8,
                      color: Colors.white38,
                    ),
                  ),
                ),

                // 12 Emojis grid: 2 rows of 6
                _buildEmojiGrid(),
              ],
            ),
          ),

          // Downward / Upward arrow beak
          Positioned(
            left: widget.arrowX - 6,
            bottom: widget.isArrowAtBottom ? -5 : null,
            top: widget.isArrowAtBottom ? null : -5,
            child: Transform.rotate(
              angle: 0.785398, // 45 degrees
              child: Container(
                width: 12,
                height: 12,
                decoration: BoxDecoration(
                  color: cardBg,
                  border: Border(
                    bottom: widget.isArrowAtBottom
                        ? const BorderSide(color: borderColor, width: 1)
                        : BorderSide.none,
                    right: widget.isArrowAtBottom
                        ? const BorderSide(color: borderColor, width: 1)
                        : BorderSide.none,
                    top: !widget.isArrowAtBottom
                        ? const BorderSide(color: borderColor, width: 1)
                        : BorderSide.none,
                    left: !widget.isArrowAtBottom
                        ? const BorderSide(color: borderColor, width: 1)
                        : BorderSide.none,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEmojiGrid() {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        // Row 1 (first 6)
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: kMusicFlowReactionEmojis.take(6).map((item) {
            return _EmojiGridButton(
              config: item,
              onTap: () => widget.onSelect(item.key),
            );
          }).toList(),
        ),
        const SizedBox(height: 2),
        // Row 2 (next 6)
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: kMusicFlowReactionEmojis.skip(6).take(6).map((item) {
            return _EmojiGridButton(
              config: item,
              onTap: () => widget.onSelect(item.key),
            );
          }).toList(),
        ),
      ],
    );
  }
}

/// Single emoji cell in the Prompt #077 grid with hover & tap scaling
class _EmojiGridButton extends StatefulWidget {
  final CommentReactionConfig config;
  final VoidCallback onTap;

  const _EmojiGridButton({
    required this.config,
    required this.onTap,
  });

  @override
  State<_EmojiGridButton> createState() => _EmojiGridButtonState();
}

class _EmojiGridButtonState extends State<_EmojiGridButton> {
  bool _isHovered = false;

  @override
  Widget build(BuildContext context) {
    return MouseRegion(
      cursor: SystemMouseCursors.click,
      onEnter: (_) => setState(() => _isHovered = true),
      onExit: (_) => setState(() => _isHovered = false),
      child: GestureDetector(
        onTap: widget.onTap,
        child: Tooltip(
          message: widget.config.label,
          waitDuration: const Duration(milliseconds: 300),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 160),
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: _isHovered
                  ? Colors.white.withOpacity(0.12)
                  : Colors.transparent,
              borderRadius: BorderRadius.circular(11),
            ),
            child: Center(
              child: AnimatedScale(
                scale: _isHovered ? 1.22 : 1.0,
                duration: const Duration(milliseconds: 180),
                curve: Curves.easeOutBack,
                child: Text(
                  widget.config.emoji,
                  style: const TextStyle(fontSize: 22, height: 1.1),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Backwards compatibility aliases
typedef CommentReactionButton = SongCommentReactions;
typedef CommentPrompt077Reactions = SongCommentReactions;
