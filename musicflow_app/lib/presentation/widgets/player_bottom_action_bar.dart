import 'dart:ui';
import 'package:flutter/material.dart';
import 'rive/rive_heart_button.dart';

class PlayerBottomActionBar extends StatelessWidget {
  final bool isLiked;
  final int likeCount;
  final int commentCount;
  final VoidCallback onLikePressed;
  final VoidCallback onCommentPressed;
  final VoidCallback onDownloadPressed;
  final VoidCallback onSharePressed;
  final VoidCallback onMorePressed;

  const PlayerBottomActionBar({
    super.key,
    required this.isLiked,
    required this.likeCount,
    required this.commentCount,
    required this.onLikePressed,
    required this.onCommentPressed,
    required this.onDownloadPressed,
    required this.onSharePressed,
    required this.onMorePressed,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 18),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(26),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 24, sigmaY: 24),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  Colors.white.withOpacity(0.14),
                  Colors.white.withOpacity(0.04),
                ],
              ),
              borderRadius: BorderRadius.circular(26),
              border: Border.all(
                color: Colors.white.withOpacity(0.18),
                width: 1.1,
              ),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFF6C63FF).withOpacity(0.15),
                  blurRadius: 20,
                  offset: const Offset(0, 4),
                ),
                BoxShadow(
                  color: Colors.black.withOpacity(0.42),
                  blurRadius: 28,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _ActionItemWrapper(
                  onTap: onLikePressed,
                  tooltip: 'Yêu thích',
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      SizedBox(
                        height: 38,
                        child: Center(
                          child: RiveHeartButton(
                            isLiked: isLiked,
                            onTap: onLikePressed,
                            size: 24,
                            activeColor: const Color(0xFFFF4B6E),
                            inactiveColor: Colors.white.withOpacity(0.75),
                          ),
                        ),
                      ),
                      Text(
                        _formatCount(likeCount),
                        style: TextStyle(
                          color: isLiked
                              ? const Color(0xFFFF7597)
                              : Colors.white.withOpacity(0.75),
                          fontSize: 11,
                          fontWeight:
                              isLiked ? FontWeight.w700 : FontWeight.w500,
                          letterSpacing: 0.2,
                        ),
                      ),
                    ],
                  ),
                ),
                _ActionItemWrapper(
                  onTap: onCommentPressed,
                  tooltip: 'Bình luận',
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      SizedBox(
                        height: 38,
                        child: Center(
                          child: Icon(
                            Icons.chat_bubble_outline_rounded,
                            color: Colors.white.withOpacity(0.8),
                            size: 22,
                          ),
                        ),
                      ),
                      Text(
                        _formatCount(commentCount),
                        style: TextStyle(
                          color: Colors.white.withOpacity(0.75),
                          fontSize: 11,
                          fontWeight: FontWeight.w500,
                          letterSpacing: 0.2,
                        ),
                      ),
                    ],
                  ),
                ),
                _ActionItemWrapper(
                  onTap: onDownloadPressed,
                  tooltip: 'Tải bài hát',
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      SizedBox(
                        height: 38,
                        child: Center(
                          child: Icon(
                            Icons.download_rounded,
                            color: Colors.white.withOpacity(0.8),
                            size: 23,
                          ),
                        ),
                      ),
                      Text(
                        'Tải',
                        style: TextStyle(
                          color: Colors.white.withOpacity(0.75),
                          fontSize: 11,
                          fontWeight: FontWeight.w500,
                          letterSpacing: 0.2,
                        ),
                      ),
                    ],
                  ),
                ),
                _ActionItemWrapper(
                  onTap: onSharePressed,
                  tooltip: 'Chia sẻ',
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      SizedBox(
                        height: 38,
                        child: Center(
                          child: Icon(
                            Icons.share_outlined,
                            color: Colors.white.withOpacity(0.8),
                            size: 22,
                          ),
                        ),
                      ),
                      Text(
                        'Chia sẻ',
                        style: TextStyle(
                          color: Colors.white.withOpacity(0.75),
                          fontSize: 11,
                          fontWeight: FontWeight.w500,
                          letterSpacing: 0.2,
                        ),
                      ),
                    ],
                  ),
                ),
                _ActionItemWrapper(
                  onTap: onMorePressed,
                  tooltip: 'Thêm tùy chọn',
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      SizedBox(
                        height: 38,
                        child: Center(
                          child: Icon(
                            Icons.more_horiz_rounded,
                            color: Colors.white.withOpacity(0.8),
                            size: 24,
                          ),
                        ),
                      ),
                      Text(
                        'Thêm',
                        style: TextStyle(
                          color: Colors.white.withOpacity(0.75),
                          fontSize: 11,
                          fontWeight: FontWeight.w500,
                          letterSpacing: 0.2,
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

  static String _formatCount(int value) {
    if (value >= 1000000) {
      return '${(value / 1000000).toStringAsFixed(1)}M';
    }
    if (value >= 1000) {
      return '${(value / 1000).toStringAsFixed(1)}K';
    }
    return value.toString();
  }
}

class _ActionItemWrapper extends StatelessWidget {
  final Widget child;
  final VoidCallback onTap;
  final String tooltip;

  const _ActionItemWrapper({
    required this.child,
    required this.onTap,
    required this.tooltip,
  });

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(16),
          splashColor: Colors.white.withOpacity(0.12),
          highlightColor: Colors.white.withOpacity(0.06),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            child: child,
          ),
        ),
      ),
    );
  }
}

