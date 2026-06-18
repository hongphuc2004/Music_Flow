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
    final pages = <List<Song>>[];
    for (var i = 0; i < songs.length; i += 2) {
      final end = (i + 2) > songs.length ? songs.length : i + 2;
      pages.add(songs.sublist(i, end));
    }

    return SizedBox(
      height: 238,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.only(right: 4),
        itemCount: pages.length,
        separatorBuilder: (_, __) => const SizedBox(width: 14),
        itemBuilder: (context, pageIndex) {
          return _RecommendedGroupCard(
            songs: songs,
            groupSongs: pages[pageIndex],
            pageIndex: pageIndex,
            formatDuration: formatDuration,
            onPlayAll: onPlayAll,
          );
        },
      ),
    );
  }
}

class _RecommendedGroupCard extends StatelessWidget {
  final List<Song> songs;
  final List<Song> groupSongs;
  final int pageIndex;
  final String Function(Duration?) formatDuration;
  final void Function(List<Song> songs, {int startIndex})? onPlayAll;

  const _RecommendedGroupCard({
    required this.songs,
    required this.groupSongs,
    required this.pageIndex,
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
    final color = palette[pageIndex % palette.length];

    return Container(
      width: MediaQuery.of(context).size.width * 0.82,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: HomePalette.card.withOpacity(0.95),
        borderRadius: BorderRadius.circular(26),
        border: Border.all(color: color.withOpacity(0.24)),
      ),
      child: Column(
        children: List.generate(
          groupSongs.length,
          (index) => Expanded(
            child: Padding(
              padding: EdgeInsets.only(
                bottom: index == groupSongs.length - 1 ? 0 : 12,
              ),
              child: _RecommendedSongTile(
                song: groupSongs[index],
                songs: songs,
                color: color,
                formatDuration: formatDuration,
                onPlayAll: onPlayAll,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _RecommendedSongTile extends StatelessWidget {
  final Song song;
  final List<Song> songs;
  final Color color;
  final String Function(Duration?) formatDuration;
  final void Function(List<Song> songs, {int startIndex})? onPlayAll;

  const _RecommendedSongTile({
    required this.song,
    required this.songs,
    required this.color,
    required this.formatDuration,
    required this.onPlayAll,
  });

  @override
  Widget build(BuildContext context) {
    final songIndex = songs.indexOf(song);

    return InkWell(
      onTap: () => onPlayAll?.call(songs, startIndex: songIndex),
      borderRadius: BorderRadius.circular(20),
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(0.03),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: Colors.white.withOpacity(0.05)),
        ),
        child: Row(
          children: [
            HomeArtwork(
              imageUrl: song.imageUrl,
              size: 56,
              borderRadius: 14,
              iconSize: 22,
              fallbackColor: color,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    song.title,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 3),
                  Text(
                    song.artists.join(', '),
                    style: TextStyle(
                      color: Colors.grey[400],
                      fontSize: 11,
                      fontWeight: FontWeight.w500,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 6),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 3,
                        ),
                        decoration: BoxDecoration(
                          color: color.withOpacity(0.14),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Text(
                          formatDuration(song.durationAsDuration),
                          style: TextStyle(
                            color: color,
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                      const SizedBox(width: 6),
                      Icon(
                        Icons.favorite_border,
                        size: 12,
                        color: Colors.grey[500],
                      ),
                      const SizedBox(width: 4),
                      Text(
                        '${song.likeCount}',
                        style: TextStyle(
                          color: Colors.grey[500],
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(width: 4),
            SongOptionsMenu(song: song),
          ],
        ),
      ),
    );
  }
}
