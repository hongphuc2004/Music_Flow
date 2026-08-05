import 'package:flutter/material.dart';
import 'package:musicflow_app/data/models/song_model.dart';
import 'package:musicflow_app/presentation/widgets/song_options_menu.dart';
import 'home_shared.dart';

class HomeTrendingChart extends StatelessWidget {
  final List<Song> songs;
  final ValueChanged<Song> onSongTap;
  final String Function(Duration?) formatDuration;

  const HomeTrendingChart({
    super.key,
    required this.songs,
    required this.onSongTap,
    required this.formatDuration,
  });

  @override
  Widget build(BuildContext context) {
    // Only display up to top 5 songs for chart
    final top5 = songs.take(5).toList();

    return Column(
      children: top5.asMap().entries.map((entry) {
        final index = entry.key;
        final song = entry.value;
        return Padding(
          padding: EdgeInsets.only(bottom: index == top5.length - 1 ? 0 : 8),
          child: _TrendingSongRow(
            song: song,
            index: index,
            onSongTap: onSongTap,
            formatDuration: formatDuration,
          ),
        );
      }).toList(),
    );
  }
}

class _TrendingSongRow extends StatelessWidget {
  final Song song;
  final int index;
  final ValueChanged<Song> onSongTap;
  final String Function(Duration?) formatDuration;

  const _TrendingSongRow({
    required this.song,
    required this.index,
    required this.onSongTap,
    required this.formatDuration,
  });

  Color _getRankColor(int rank) {
    switch (rank) {
      case 0:
        return const Color(0xFFFFD700); // Gold
      case 1:
        return const Color(0xFFC0C0C0); // Silver
      case 2:
        return const Color(0xFFCD7F32); // Bronze
      default:
        return HomePalette.secondary; // Cyan for Rank 4 and 5
    }
  }

  @override
  Widget build(BuildContext context) {
    final rankColor = _getRankColor(index);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => onSongTap(song),
        borderRadius: BorderRadius.circular(18),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: HomePalette.card(context).withValues(alpha: 0.95),
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: HomePalette.cardBorder(context)),
          ),
          child: Row(
            children: [
              // Glowing Rank Number
              SizedBox(
                width: 32,
                child: Center(
                  child: Text(
                    '#${index + 1}',
                    style: TextStyle(
                      color: rankColor,
                      fontSize: 14,
                      fontWeight: FontWeight.w900,
                      shadows: [
                        BoxShadow(
                          color: rankColor.withValues(alpha: 0.4),
                          blurRadius: 6,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              HomeArtwork(
                imageUrl: song.imageUrl,
                size: 52,
                borderRadius: 12,
                iconSize: 22,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      song.title,
                      style: TextStyle(
                        color: HomePalette.textPrimary(context),
                        fontSize: 14,
                        fontWeight: FontWeight.w800,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 3),
                    Text(
                      song.artists.isNotEmpty
                          ? song.artists.join(', ')
                          : 'Nghệ sĩ ẩn danh',
                      style: TextStyle(
                        color: HomePalette.textSecondary(context),
                        fontSize: 11,
                        fontWeight: FontWeight.w500,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        HomeMiniInfo(
                          icon: Icons.schedule,
                          label: formatDuration(song.durationAsDuration),
                        ),
                        const SizedBox(width: 6),
                        HomeMiniInfo(
                          icon: Icons.favorite_rounded,
                          label: '${song.likeCount}',
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              SongOptionsMenu(song: song),
            ],
          ),
        ),
      ),
    );
  }
}
