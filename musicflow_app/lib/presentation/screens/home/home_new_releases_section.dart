import 'package:flutter/material.dart';
import 'package:musicflow_app/data/models/playlist_model.dart';
import 'home_shared.dart';

class HomeNewReleasesSection extends StatelessWidget {
  final List<Playlist> playlists;
  final ValueChanged<Playlist> onPlaylistTap;

  const HomeNewReleasesSection({
    super.key,
    required this.playlists,
    required this.onPlaylistTap,
  });

  @override
  Widget build(BuildContext context) {
    if (playlists.isEmpty) return const SizedBox.shrink();

    // Sort by createdAt descending if dates are available, otherwise keep original order
    final sortedPlaylists = List<Playlist>.from(playlists)
      ..sort((a, b) {
        if (a.createdAt == null && b.createdAt == null) return 0;
        if (a.createdAt == null) return 1;
        if (b.createdAt == null) return -1;
        return b.createdAt!.compareTo(a.createdAt!);
      });

    // Display only top 6 new releases
    final newReleases = sortedPlaylists.take(6).toList();

    return SizedBox(
      height: 260,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: newReleases.length,
        separatorBuilder: (_, __) => const SizedBox(width: 14),
        itemBuilder: (context, index) {
          final playlist = newReleases[index];
          return _NewReleaseCard(
            playlist: playlist,
            index: index,
            onTap: () => onPlaylistTap(playlist),
          );
        },
      ),
    );
  }
}

class _NewReleaseCard extends StatelessWidget {
  final Playlist playlist;
  final int index;
  final VoidCallback onTap;

  const _NewReleaseCard({
    required this.playlist,
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
        borderRadius: BorderRadius.circular(24),
        child: Container(
          width: 168,
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: HomePalette.card(context),
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: HomePalette.cardBorder(context)),
            boxShadow: [
              BoxShadow(
                color: color.withValues(alpha: isDark ? 0.08 : 0.03),
                blurRadius: 18,
                offset: const Offset(0, 10),
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
                    size: 144,
                    borderRadius: 18,
                    iconSize: 42,
                    fallbackColor: color,
                    label: playlist.name,
                  ),
                  // Glowing "NEW" badge on the top left
                  Positioned(
                    left: 8,
                    top: 8,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFF6C63FF), Color(0xFF00BCD4)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(20),
                        boxShadow: [
                          BoxShadow(
                            color: const Color(0xFF6C63FF).withValues(alpha: 0.4),
                            blurRadius: 6,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: const Text(
                        'NEW',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 9,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ),
                  ),
                  Positioned(
                    right: 8,
                    top: 8,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.black.withValues(alpha: 0.55),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(
                            Icons.music_note_rounded,
                            color: Colors.white,
                            size: 10,
                          ),
                          const SizedBox(width: 2),
                          Text(
                            '${playlist.songCount}',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 9,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  Positioned(
                    bottom: 8,
                    right: 8,
                    child: Container(
                      padding: const EdgeInsets.all(6),
                      decoration: const BoxDecoration(
                        color: Colors.white,
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black26,
                            blurRadius: 6,
                          )
                        ],
                      ),
                      child: Icon(
                        Icons.play_arrow_rounded,
                        color: HomePalette.primary,
                        size: 16,
                      ),
                    ),
                  )
                ],
              ),
              const SizedBox(height: 10),
              Text(
                playlist.name,
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
                playlist.description.isNotEmpty
                    ? playlist.description
                    : 'Album mới phát hành tuyệt vời cho bạn.',
                style: TextStyle(
                  color: HomePalette.textSecondary(context),
                  fontSize: 11,
                  height: 1.3,
                ),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
