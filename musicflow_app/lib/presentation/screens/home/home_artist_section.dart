import 'package:flutter/material.dart';
import 'package:musicflow_app/presentation/screens/artist/artist_screen.dart';
import 'package:musicflow_app/presentation/screens/home/home_all_artists_screen.dart';

import 'home_shared.dart';

class HomeArtistPreview {
  final String name;
  final String imageUrl;
  final bool isVerified;
  final int followersCount;

  const HomeArtistPreview({
    required this.name,
    required this.imageUrl,
    this.isVerified = false,
    this.followersCount = 0,
  });
}

class HomeArtistCarousel extends StatelessWidget {
  final List<HomeArtistPreview> artists;
  final List<HomeArtistPreview> allArtists;

  const HomeArtistCarousel({
    super.key,
    required this.artists,
    required this.allArtists,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 168,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount:
            artists.length + (allArtists.length > artists.length ? 1 : 0),
        separatorBuilder: (_, __) => const SizedBox(width: 14),
        itemBuilder: (context, index) {
          if (index == artists.length && allArtists.length > artists.length) {
            return _ViewAllCard(
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => HomeAllArtistsScreen(artists: allArtists),
                  ),
                );
              },
            );
          }

          final artist = artists[index];
          return _ArtistCard(artist: artist, accent: _accentFor(index));
        },
      ),
    );
  }

  Color _accentFor(int index) {
    const palette = [
      HomePalette.accent,
      Color(0xFF76A9FF),
      HomePalette.secondaryAccent,
      Color(0xFFE66BFF),
    ];
    return palette[index % palette.length];
  }
}

class _ViewAllCard extends StatelessWidget {
  final VoidCallback onTap;

  const _ViewAllCard({required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(24),
      child: Container(
        width: 118,
        decoration: BoxDecoration(
          color: HomePalette.card.withOpacity(0.96),
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: Colors.white.withOpacity(0.08)),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 62,
              height: 62,
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.08),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.arrow_forward_rounded,
                color: Colors.white,
                size: 28,
              ),
            ),
            const SizedBox(height: 14),
            Text(
              'Xem tất cả',
              style: TextStyle(
                color: Colors.grey[300],
                fontSize: 14,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ArtistCard extends StatelessWidget {
  final HomeArtistPreview artist;
  final Color accent;

  const _ArtistCard({required this.artist, required this.accent});

  String _formatCompactNumber(int value) {
    if (value >= 1000000) {
      return '${(value / 1000000).toStringAsFixed(1)}M';
    }
    if (value >= 1000) {
      return '${(value / 1000).toStringAsFixed(1)}K';
    }
    return '$value';
  }

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => ArtistScreen(artistName: artist.name),
          ),
        );
      },
      borderRadius: BorderRadius.circular(24),
      child: Container(
        width: 146,
        padding: const EdgeInsets.fromLTRB(14, 14, 14, 12),
        decoration: BoxDecoration(
          color: HomePalette.card.withOpacity(0.96),
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: accent.withOpacity(0.24)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Stack(
              children: [
                Container(
                  padding: const EdgeInsets.all(4),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(color: accent.withOpacity(0.28)),
                  ),
                  child: ClipOval(
                    child: SizedBox(
                      width: 86,
                      height: 86,
                      child: artist.imageUrl.isNotEmpty
                          ? Image.network(
                              artist.imageUrl,
                              fit: BoxFit.cover,
                              errorBuilder: (_, __, ___) => _fallbackAvatar(),
                            )
                          : _fallbackAvatar(),
                    ),
                  ),
                ),
                if (artist.isVerified)
                  Positioned(
                    right: 4,
                    bottom: 4,
                    child: Container(
                      padding: const EdgeInsets.all(2),
                      decoration: const BoxDecoration(
                        color: Color(0xFF1E88E5),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.check,
                        color: Colors.white,
                        size: 10,
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              artist.name,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 14,
                fontWeight: FontWeight.w800,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 4),
            Text(
              artist.followersCount > 0
                  ? '${_formatCompactNumber(artist.followersCount)} followers'
                  : 'Nghệ sĩ',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: Colors.white.withOpacity(0.5),
                fontSize: 10,
                fontWeight: FontWeight.w500,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }

  Widget _fallbackAvatar() {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            accent.withOpacity(0.88),
            Color.lerp(accent, Colors.black, 0.55) ?? accent,
          ],
        ),
      ),
      child: Center(
        child: Text(
          artist.name.isNotEmpty ? artist.name[0].toUpperCase() : 'A',
          style: const TextStyle(
            color: Colors.white,
            fontSize: 28,
            fontWeight: FontWeight.w900,
          ),
        ),
      ),
    );
  }
}
