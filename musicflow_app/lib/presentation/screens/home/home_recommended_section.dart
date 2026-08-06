import 'package:flutter/material.dart';
import 'package:musicflow_app/data/models/song_model.dart';
import 'package:musicflow_app/presentation/widgets/song_options_menu.dart';
import 'home_shared.dart';

class HomeRecommendedList extends StatelessWidget {
  final List<Song> songs;
  final String Function(Duration?) formatDuration;
  final void Function(List<Song> songs, {int startIndex})? onPlayAll;

  const HomeRecommendedList({
    super.key,
    required this.songs,
    required this.formatDuration,
    required this.onPlayAll,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 220,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: songs.length,
        separatorBuilder: (_, __) => const SizedBox(width: 14),
        itemBuilder: (context, index) {
          final song = songs[index];
          return _RecommendedCard(
            song: song,
            index: index,
            onTap: () => onPlayAll?.call(songs, startIndex: index),
          );
        },
      ),
    );
  }
}

class _RecommendedCard extends StatelessWidget {
  final Song song;
  final int index;
  final VoidCallback onTap;

  const _RecommendedCard({
    required this.song,
    required this.index,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final palette = [
      HomePalette.primary,
      HomePalette.secondary,
      const Color(0xFFFF8A5B),
      const Color(0xFFE66BFF),
    ];
    final color = palette[index % palette.length];
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(22),
        child: Container(
          width: 136,
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: HomePalette.card(context),
            borderRadius: BorderRadius.circular(22),
            border: Border.all(color: HomePalette.cardBorder(context)),
            boxShadow: [
              BoxShadow(
                color: color.withValues(alpha: isDark ? 0.05 : 0.02),
                blurRadius: 16,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Stack(
                children: [
                  HomeArtwork(
                    imageUrl: song.imageUrl,
                    size: 116,
                    borderRadius: 16,
                    iconSize: 34,
                    fallbackColor: color,
                  ),
                  Positioned(
                    bottom: 6,
                    right: 6,
                    child: Container(
                      padding: const EdgeInsets.all(5),
                      decoration: const BoxDecoration(
                        color: Colors.white,
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black26,
                            blurRadius: 4,
                          )
                        ],
                      ),
                      child: Icon(
                        Icons.play_arrow_rounded,
                        color: HomePalette.primary,
                        size: 14,
                      ),
                    ),
                  ),
                  Positioned(
                    top: 6,
                    right: 6,
                    child: Material(
                      color: Colors.transparent,
                      child: SongOptionsMenu(
                        song: song,
                      ),
                    ),
                  )
                ],
              ),
              const SizedBox(height: 8),
              Text(
                song.title,
                style: TextStyle(
                  color: HomePalette.textPrimary(context),
                  fontSize: 13,
                  fontWeight: FontWeight.w800,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 2),
              Text(
                song.artists.join(', '),
                style: TextStyle(
                  color: HomePalette.textSecondary(context),
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 4),
              Row(
                children: [
                  Icon(
                    Icons.favorite_rounded,
                    size: 11,
                    color: HomePalette.primary.withValues(alpha: 0.8),
                  ),
                  const SizedBox(width: 3),
                  Text(
                    '${song.likeCount}',
                    style: TextStyle(
                      color: HomePalette.textSecondary(context),
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              )
            ],
          ),
        ),
      ),
    );
  }
}
