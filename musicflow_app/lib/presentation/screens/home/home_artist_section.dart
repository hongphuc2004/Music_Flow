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
      height: 154,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: artists.length + (allArtists.length > artists.length ? 1 : 0),
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
      HomePalette.primary,
      HomePalette.secondary,
      Color(0xFFFF8A5B),
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
      borderRadius: BorderRadius.circular(22),
      child: Container(
        width: 106,
        decoration: BoxDecoration(
          color: HomePalette.card(context),
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: HomePalette.cardBorder(context)),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 50,
              height: 50,
              decoration: BoxDecoration(
                color: HomePalette.primary.withValues(alpha: 0.12),
                shape: BoxShape.circle,
              ),
              child: Icon(
                Icons.arrow_forward_rounded,
                color: HomePalette.primary,
                size: 22,
              ),
            ),
            const SizedBox(height: 10),
            Text(
              'Xem tất cả',
              style: TextStyle(
                color: HomePalette.textPrimary(context),
                fontSize: 12,
                fontWeight: FontWeight.w800,
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
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return InkWell(
      onTap: () {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => ArtistScreen(artistName: artist.name),
          ),
        );
      },
      borderRadius: BorderRadius.circular(22),
      child: Container(
        width: 110,
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: HomePalette.card(context),
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: HomePalette.cardBorder(context)),
          boxShadow: [
            BoxShadow(
              color: accent.withValues(alpha: isDark ? 0.06 : 0.02),
              blurRadius: 16,
              offset: const Offset(0, 6),
            )
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.center,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Stack(
              children: [
                Container(
                  padding: const EdgeInsets.all(2.5),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(color: accent.withValues(alpha: 0.35), width: 1.5),
                  ),
                  child: ClipOval(
                    child: SizedBox(
                      width: 62,
                      height: 62,
                      child: artist.imageUrl.isNotEmpty
                          ? Image.network(
                              artist.imageUrl,
                              fit: BoxFit.cover,
                              errorBuilder: (_, __, ___) => _fallbackAvatar(context),
                            )
                          : _fallbackAvatar(context),
                    ),
                  ),
                ),
                if (artist.isVerified)
                  Positioned(
                    right: 2,
                    bottom: 2,
                    child: Container(
                      padding: const EdgeInsets.all(2),
                      decoration: const BoxDecoration(
                        color: HomePalette.secondary,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.check,
                        color: Colors.white,
                        size: 8,
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              artist.name,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: HomePalette.textPrimary(context),
                fontSize: 12,
                fontWeight: FontWeight.w800,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 2),
            Text(
              artist.followersCount > 0
                  ? '${_formatCompactNumber(artist.followersCount)} fan'
                  : 'Nghệ sĩ',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: HomePalette.textSecondary(context).withValues(alpha: 0.8),
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

  Widget _fallbackAvatar(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            accent.withValues(alpha: 0.85),
            Color.lerp(accent, Colors.black, 0.55) ?? accent,
          ],
        ),
      ),
      child: Center(
        child: Text(
          artist.name.isNotEmpty ? artist.name[0].toUpperCase() : 'A',
          style: const TextStyle(
            color: Colors.white,
            fontSize: 22,
            fontWeight: FontWeight.w900,
          ),
        ),
      ),
    );
  }
}
