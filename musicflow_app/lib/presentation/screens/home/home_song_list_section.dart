import 'package:flutter/material.dart';
import 'package:musicflow_app/data/models/song_model.dart';
import 'package:musicflow_app/presentation/widgets/song_options_menu.dart';

import 'home_shared.dart';

class HomeSongList extends StatelessWidget {
  final List<Song> songs;
  final ValueChanged<Song> onSongTap;
  final String Function(Duration?) formatDuration;

  const HomeSongList({
    super.key,
    required this.songs,
    required this.onSongTap,
    required this.formatDuration,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: songs.asMap().entries.map((entry) {
        final index = entry.key;
        final song = entry.value;
        return Padding(
          padding: EdgeInsets.only(bottom: index == songs.length - 1 ? 0 : 10),
          child: _SongRow(
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

class _SongRow extends StatelessWidget {
  final Song song;
  final int index;
  final ValueChanged<Song> onSongTap;
  final String Function(Duration?) formatDuration;

  const _SongRow({
    required this.song,
    required this.index,
    required this.onSongTap,
    required this.formatDuration,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () => onSongTap(song),
      borderRadius: BorderRadius.circular(22),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: HomePalette.card.withOpacity(0.92),
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: HomePalette.cardBorder),
        ),
        child: Row(
          children: [
            SizedBox(
              width: 34,
              child: Text(
                '${index + 1}',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: Colors.grey[500],
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            HomeArtwork(
              imageUrl: song.imageUrl,
              size: 58,
              borderRadius: 16,
              iconSize: 26,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    song.title,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    song.artists.isNotEmpty
                        ? song.artists.join(', ')
                        : 'Unknown artist',
                    style: TextStyle(color: Colors.grey[400], fontSize: 13),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 6,
                    children: [
                      HomeMiniInfo(
                        icon: Icons.schedule,
                        label: formatDuration(song.durationAsDuration),
                      ),
                      HomeMiniInfo(
                        icon: Icons.favorite_border,
                        label: '${song.likeCount}',
                      ),
                    ],
                  ),
                ],
              ),
            ),
            SongOptionsMenu(song: song),
          ],
        ),
      ),
    );
  }
}
