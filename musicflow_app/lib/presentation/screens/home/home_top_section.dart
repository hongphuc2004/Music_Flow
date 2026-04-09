import 'package:flutter/material.dart';
import 'package:musicflow_app/data/models/song_model.dart';

import 'home_shared.dart';

class HomeTopBar extends StatelessWidget {
  final String displayName;

  const HomeTopBar({
    super.key,
    required this.displayName,
  });

  @override
  Widget build(BuildContext context) {
    final now = TimeOfDay.now();
    final greeting = now.hour < 12
        ? 'Chao buoi sang'
        : now.hour < 18
            ? 'Chao buoi chieu'
            : 'Chao buoi toi';

    return Row(
      children: [
        Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.06),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: Colors.white.withOpacity(0.06)),
          ),
          child: Image.asset(
            'assets/images/logo.png',
            width: 28,
            height: 28,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                greeting,
                style: TextStyle(
                  color: Colors.grey[400],
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                displayName,
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
        ),
        Container(
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.05),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: Colors.white.withOpacity(0.06)),
          ),
          child: IconButton(
            onPressed: () {},
            icon: const Icon(Icons.search_rounded, color: Colors.white),
            tooltip: 'Tim kiem',
          ),
        ),
      ],
    );
  }
}

class HomeHeroSection extends StatelessWidget {
  final Song featuredSong;
  final int librarySongCount;
  final List<Song> recommendedSongs;
  final ValueChanged<Song> onPlaySong;
  final VoidCallback? onPlayRecommended;

  const HomeHeroSection({
    super.key,
    required this.featuredSong,
    required this.librarySongCount,
    required this.recommendedSongs,
    required this.onPlaySong,
    required this.onPlayRecommended,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(28),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color(0xFF1B2330),
            Color(0xFF10141C),
            Color(0xFF18121A),
          ],
        ),
        border: Border.all(color: Colors.white.withOpacity(0.08)),
        boxShadow: [
          BoxShadow(
            color: HomePalette.accent.withOpacity(0.10),
            blurRadius: 30,
            offset: const Offset(0, 18),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              HomeTag(
                icon: Icons.auto_awesome,
                label: 'Noi bat',
                background: HomePalette.accent.withOpacity(0.18),
                foreground: HomePalette.accent,
              ),
              const SizedBox(width: 8),
              HomeTag(
                icon: Icons.graphic_eq,
                label: 'Tap trung',
                background: HomePalette.secondaryAccent.withOpacity(0.14),
                foreground: HomePalette.secondaryAccent,
              ),
            ],
          ),
          const SizedBox(height: 18),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      featuredSong.title,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 28,
                        height: 1.05,
                        fontWeight: FontWeight.w900,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 10),
                    Text(
                      featuredSong.artists.join(', '),
                      style: TextStyle(
                        color: Colors.grey[300],
                        fontSize: 14,
                        fontWeight: FontWeight.w500,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 16),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        HomeMetaPill(
                          icon: Icons.music_note_rounded,
                          label: '$librarySongCount bai trong thu vien',
                        ),
                        HomeMetaPill(
                          icon: Icons.favorite_outline,
                          label: '${featuredSong.likeCount} luot thich',
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 16),
              HomeArtwork(
                imageUrl: featuredSong.imageUrl,
                size: 122,
                borderRadius: 24,
                iconSize: 44,
              ),
            ],
          ),
          const SizedBox(height: 18),
          Text(
            'Bat dau buoi nghe voi bai hat noi bat, hoac phat luon danh sach goi y da duoc chuan bi san cho ban.',
            style: TextStyle(
              color: Colors.grey[400],
              fontSize: 13,
              height: 1.45,
            ),
          ),
          const SizedBox(height: 18),
          Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: () => onPlaySong(featuredSong),
                  icon: const Icon(Icons.play_arrow_rounded),
                  label: const Text('Phat ngay'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: HomePalette.accent,
                    foregroundColor: Colors.black,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(18),
                    ),
                    textStyle: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: recommendedSongs.isEmpty ? null : onPlayRecommended,
                  icon: const Icon(Icons.shuffle_rounded),
                  label: const Text('Mix goi y'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.white,
                    side: BorderSide(color: Colors.white.withOpacity(0.12)),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(18),
                    ),
                    textStyle: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class HomeQuickActions extends StatelessWidget {
  final Song? featuredSong;
  final int playlistCount;
  final int recommendedCount;
  final VoidCallback? onPlayFeatured;
  final VoidCallback? onOpenPlaylists;
  final VoidCallback? onPlayRecommended;

  const HomeQuickActions({
    super.key,
    required this.featuredSong,
    required this.playlistCount,
    required this.recommendedCount,
    required this.onPlayFeatured,
    required this.onOpenPlaylists,
    required this.onPlayRecommended,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: _QuickActionCard(
            icon: Icons.play_circle_fill_rounded,
            title: 'Phat nhanh',
            subtitle: 'Bai noi bat',
            color: HomePalette.accent,
            onTap: featuredSong == null ? null : onPlayFeatured,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _QuickActionCard(
            icon: Icons.library_music_rounded,
            title: 'Playlist',
            subtitle: '$playlistCount bo suu tap',
            color: const Color(0xFF76A9FF),
            onTap: playlistCount == 0 ? null : onOpenPlaylists,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _QuickActionCard(
            icon: Icons.auto_awesome_motion_rounded,
            title: 'Goi y',
            subtitle: '$recommendedCount bai hat',
            color: HomePalette.secondaryAccent,
            onTap: recommendedCount == 0 ? null : onPlayRecommended,
          ),
        ),
      ],
    );
  }
}

class _QuickActionCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final Color color;
  final VoidCallback? onTap;

  const _QuickActionCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(20),
      child: Ink(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(0.04),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: Colors.white.withOpacity(0.06)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: color.withOpacity(0.16),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(icon, color: color),
            ),
            const SizedBox(height: 18),
            Text(
              title,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 15,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              subtitle,
              style: TextStyle(
                color: Colors.grey[400],
                fontSize: 12,
                fontWeight: FontWeight.w500,
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }
}
