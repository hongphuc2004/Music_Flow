import 'package:flutter/material.dart';
import 'package:musicflow_app/data/models/playlist_model.dart';

import 'home_shared.dart';

class HomePlaylistCarousel extends StatelessWidget {
  final List<Playlist> playlists;
  final ValueChanged<Playlist> onPlaylistTap;

  const HomePlaylistCarousel({
    super.key,
    required this.playlists,
    required this.onPlaylistTap,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 278,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: playlists.length,
        separatorBuilder: (_, __) => const SizedBox(width: 14),
        itemBuilder: (context, index) {
          final playlist = playlists[index];
          return _PlaylistCard(
            playlist: playlist,
            index: index,
            onTap: () => onPlaylistTap(playlist),
          );
        },
      ),
    );
  }
}

class _PlaylistCard extends StatelessWidget {
  final Playlist playlist;
  final int index;
  final VoidCallback onTap;

  const _PlaylistCard({
    required this.playlist,
    required this.index,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final palette = [
      const Color(0xFF5BE584),
      const Color(0xFF76A9FF),
      const Color(0xFFFF8A5B),
      const Color(0xFFE66BFF),
    ];
    final color = palette[index % palette.length];

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(26),
      child: Container(
        width: 188,
        height: double.infinity,
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(26),
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              color.withOpacity(0.26),
              const Color(0xFF12161E),
              const Color(0xFF101115),
            ],
          ),
          border: Border.all(color: color.withOpacity(0.28)),
          boxShadow: [
            BoxShadow(
              color: color.withOpacity(0.14),
              blurRadius: 22,
              offset: const Offset(0, 14),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Stack(
              children: [
                HomeArtwork(
                  imageUrl: playlist.displayCoverImage,
                  size: 150,
                  borderRadius: 22,
                  iconSize: 46,
                  fallbackColor: color,
                  label: playlist.name,
                ),
                Positioned(
                  right: 10,
                  top: 10,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.black.withOpacity(0.42),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(
                          Icons.music_note_rounded,
                          color: Colors.white,
                          size: 14,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          '${playlist.songCount}',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    playlist.name,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    playlist.description.isNotEmpty
                        ? playlist.description
                        : 'Bo suu tap danh cho nhung khoanh khac can nhac hay.',
                    style: TextStyle(
                      color: Colors.grey[300],
                      fontSize: 12,
                      height: 1.35,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

