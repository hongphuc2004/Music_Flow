import 'package:flutter/material.dart';

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
      margin: const EdgeInsets.symmetric(horizontal: 20),
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.06),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Colors.white.withOpacity(0.1)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _ActionMenuItem(
            icon: isLiked ? Icons.favorite : Icons.favorite_border,
            iconColor: isLiked ? Colors.redAccent : Colors.white70,
            label: _formatCount(likeCount),
            tooltip: 'Like',
            onPressed: onLikePressed,
          ),
          _ActionMenuItem(
            icon: Icons.chat_bubble_outline,
            iconColor: Colors.white70,
            label: _formatCount(commentCount),
            tooltip: 'Binh luan',
            onPressed: onCommentPressed,
          ),
          _ActionMenuItem(
            icon: Icons.download_outlined,
            iconColor: Colors.white70,
            label: 'Tai',
            tooltip: 'Tai bai hat',
            onPressed: onDownloadPressed,
          ),
          _ActionMenuItem(
            icon: Icons.share_outlined,
            iconColor: Colors.white70,
            label: 'Chia se',
            tooltip: 'Chia se',
            onPressed: onSharePressed,
          ),
          _ActionMenuItem(
            icon: Icons.more_vert,
            iconColor: Colors.white70,
            label: 'Them',
            tooltip: 'Them tuy chon',
            onPressed: onMorePressed,
          ),
        ],
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

class _ActionMenuItem extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String label;
  final String tooltip;
  final VoidCallback onPressed;

  const _ActionMenuItem({
    required this.icon,
    required this.iconColor,
    required this.label,
    required this.tooltip,
    required this.onPressed,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        IconButton(
          icon: Icon(icon, color: iconColor, size: 24),
          onPressed: onPressed,
          tooltip: tooltip,
          splashRadius: 22,
        ),
        Text(
          label,
          style: const TextStyle(
            color: Colors.white60,
            fontSize: 11,
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }
}