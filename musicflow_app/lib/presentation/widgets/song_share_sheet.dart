import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:musicflow_app/data/models/song_model.dart';
import 'package:musicflow_app/core/theme/app_theme.dart';
import 'package:musicflow_app/core/config/api_config.dart';
import 'package:musicflow_app/core/utils/app_toast.dart';


class SongShareSheet extends StatefulWidget {
  final Song song;

  const SongShareSheet({super.key, required this.song});

  static void show(BuildContext context, Song song) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => SongShareSheet(song: song),
    );
  }

  @override
  State<SongShareSheet> createState() => _SongShareSheetState();
}

class _SongShareSheetState extends State<SongShareSheet> {
  bool _copied = false;

  String get _shareUrl => ApiConfig.songShareUrl(
        widget.song.id,
        title: widget.song.title,
        artistName: widget.song.artists.isNotEmpty ? widget.song.artists.first : null,
      );

  Future<void> _copyToClipboard() async {
    await Clipboard.setData(ClipboardData(text: _shareUrl));
    if (!mounted) return;
    setState(() => _copied = true);

    AppToast.showSuccess(
      context,
      'Đã sao chép liên kết bài hát vào bộ nhớ tạm!',
    );

    Future.delayed(const Duration(seconds: 2), () {
      if (mounted) setState(() => _copied = false);
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E1B4B) : Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        border: Border.all(
          color: isDark ? Colors.white10 : Colors.black12,
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Drag handle
          Container(
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: Colors.grey.withAlpha(100),
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(height: 16),

          // Header
          Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: AppColors.primary.withAlpha(40),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.share_rounded, color: AppColors.primary, size: 20),
              ),
              const SizedBox(width: 12),
              Text(
                'Chia sẻ bài hát',
                style: theme.textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
              ),
              const Spacer(),
              IconButton(
                icon: const Icon(Icons.close_rounded),
                onPressed: () => Navigator.pop(context),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // Song Info Preview
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: isDark ? Colors.white.withAlpha(15) : Colors.black.withAlpha(10),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: Image.network(
                    widget.song.imageUrl,
                    width: 48,
                    height: 48,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => Container(
                      width: 48,
                      height: 48,
                      color: AppColors.primary.withAlpha(40),
                      child: const Icon(Icons.music_note, color: AppColors.primary),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        widget.song.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        widget.song.artists.join(', '),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 12,
                          color: isDark ? Colors.white70 : Colors.black54,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // Share link box with copy button
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: isDark ? Colors.black26 : const Color(0xFFF1F5F9),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: isDark ? Colors.white12 : Colors.black12,
              ),
            ),
            child: Row(
              children: [
                const Icon(Icons.link_rounded, size: 20, color: Colors.grey),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    _shareUrl,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 13,
                      fontFamily: 'monospace',
                      color: isDark ? Colors.white70 : Colors.black87,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                ElevatedButton.icon(
                  onPressed: _copyToClipboard,
                  icon: Icon(
                    _copied ? Icons.check_rounded : Icons.copy_rounded,
                    size: 16,
                  ),
                  label: Text(_copied ? 'Đã chép' : 'Sao chép'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _copied ? Colors.green : AppColors.primary,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }
}
