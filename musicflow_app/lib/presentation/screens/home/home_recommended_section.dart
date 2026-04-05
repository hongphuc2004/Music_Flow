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
    final featured = songs.take(4).toList();

    return Column(
      children: featured.asMap().entries.map((entry) {
        final index = entry.key;
        final song = entry.value;
        return Padding(
          padding: EdgeInsets.only(bottom: index == featured.length - 1 ? 0 : 12),
          child: _RecommendedSongCard(
            song: song,
            index: index,
            songs: songs,
            formatDuration: formatDuration,
            onPlayAll: onPlayAll,
          ),
        );
      }).toList(),
    );
  }
}

class _RecommendedSongCard extends StatelessWidget {
  final Song song;
  final int index;
  final List<Song> songs;
  final String Function(Duration?) formatDuration;
  final void Function(List<Song> songs, {int startIndex})? onPlayAll;

  const _RecommendedSongCard({
    required this.song,
    required this.index,
    required this.songs,
    required this.formatDuration,
    required this.onPlayAll,
  });

  @override
  Widget build(BuildContext context) {
    final palette = [
      HomePalette.accent,
      const Color(0xFF76A9FF),
      HomePalette.secondaryAccent,
      const Color(0xFFE66BFF),
    ];
    final color = palette[index % palette.length];
    final songIndex = songs.indexOf(song);

    return InkWell(
      onTap: () => onPlayAll?.call(songs, startIndex: songIndex),
      borderRadius: BorderRadius.circular(24),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: HomePalette.card.withOpacity(0.95),
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: color.withOpacity(0.24)),
        ),
        child: Row(
          children: [
            HomeArtwork(
              imageUrl: song.imageUrl,
              size: 72,
              borderRadius: 18,
              iconSize: 28,
              fallbackColor: color,
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      HomeTag(
                        icon: Icons.bolt,
                        label: 'Goi y ${index + 1}',
                        background: color.withOpacity(0.14),
                        foreground: color,
                      ),
                      const Spacer(),
                      Text(
                        formatDuration(song.durationAsDuration),
                        style: TextStyle(
                          color: Colors.grey[500],
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Text(
                    song.title,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    song.artists.join(', '),
                    style: TextStyle(
                      color: Colors.grey[400],
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Icon(Icons.favorite_border, size: 14, color: Colors.grey[500]),
                      const SizedBox(width: 4),
                      Text(
                        '${song.likeCount}',
                        style: TextStyle(
                          color: Colors.grey[500],
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Column(
              children: [
                Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: color.withOpacity(0.14),
                    shape: BoxShape.circle,
                  ),
                  child: IconButton(
                    onPressed: () => onPlayAll?.call(songs, startIndex: songIndex),
                    icon: Icon(Icons.play_arrow_rounded, color: color),
                  ),
                ),
                SongOptionsMenu(song: song),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
