import 'package:flutter/material.dart';
import 'package:musicflow_app/data/models/artist_profile_model.dart';
import 'package:musicflow_app/presentation/screens/artist/artist_shared.dart';

class ArtistHeaderSection extends StatelessWidget {
  final ArtistProfile artist;
  final bool isFollowing;
  final bool isFollowLoading;
  final VoidCallback onBack;
  final VoidCallback onPlayAll;
  final VoidCallback onShuffle;
  final VoidCallback onFollow;

  const ArtistHeaderSection({
    super.key,
    required this.artist,
    required this.isFollowing,
    required this.isFollowLoading,
    required this.onBack,
    required this.onPlayAll,
    required this.onShuffle,
    required this.onFollow,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(30),
        border: Border.all(color: Colors.white.withOpacity(0.06)),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color(0xFF1A2230),
            Color(0xFF10141C),
          ],
        ),
      ),
      child: Column(
        children: [
          Stack(
            children: [
              ClipRRect(
                borderRadius: const BorderRadius.vertical(top: Radius.circular(30)),
                child: SizedBox(
                  height: 210,
                  width: double.infinity,
                  child: artist.coverUrl.isNotEmpty
                      ? Image.network(
                          artist.coverUrl,
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) => _buildCoverFallback(),
                        )
                      : _buildCoverFallback(),
                ),
              ),
              Positioned.fill(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    borderRadius: const BorderRadius.vertical(top: Radius.circular(30)),
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [
                        Colors.black.withOpacity(0.16),
                        Colors.black.withOpacity(0.74),
                      ],
                    ),
                  ),
                ),
              ),
              Positioned(
                top: 12,
                left: 12,
                child: _CircleIconButton(
                  icon: Icons.arrow_back_rounded,
                  onTap: onBack,
                ),
              ),
            ],
          ),
          Transform.translate(
            offset: const Offset(0, -42),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 18),
              child: Column(
                children: [
                  ClipOval(
                    child: Container(
                      width: 92,
                      height: 92,
                      color: ArtistPalette.surfaceSoft,
                      child: artist.avatarUrl.isNotEmpty
                          ? Image.network(
                              artist.avatarUrl,
                              fit: BoxFit.cover,
                              errorBuilder: (context, error, stackTrace) {
                                // Fallback to first song image if avatar fails
                                if (artist.songs.isNotEmpty && artist.songs.first.imageUrl.isNotEmpty) {
                                  return Image.network(
                                    artist.songs.first.imageUrl,
                                    fit: BoxFit.cover,
                                    errorBuilder: (_, __, ___) => _buildTextFallback(),
                                  );
                                }
                                return _buildTextFallback();
                              },
                            )
                          : (artist.songs.isNotEmpty && artist.songs.first.imageUrl.isNotEmpty)
                              ? Image.network(
                                  artist.songs.first.imageUrl,
                                  fit: BoxFit.cover,
                                  errorBuilder: (_, __, ___) => _buildTextFallback(),
                                )
                              : _buildTextFallback(),
                    ),
                  ),
                  const SizedBox(height: 14),
                  Text(
                    artist.name,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 30,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    alignment: WrapAlignment.center,
                    spacing: 10,
                    runSpacing: 10,
                    children: [
                      ArtistStatChip(
                        icon: Icons.graphic_eq_rounded,
                        label: '${_formatCompactNumber(artist.monthlyListeners)} listeners',
                      ),
                      ArtistStatChip(
                        icon: Icons.favorite_outline_rounded,
                        label: '${_formatCompactNumber(artist.followers)} followers',
                      ),
                      ArtistStatChip(
                        icon: Icons.music_note_rounded,
                        label: '${artist.totalSongs} bai hat',
                      ),
                    ],
                  ),
                  const SizedBox(height: 18),
                  Wrap(
                    alignment: WrapAlignment.center,
                    spacing: 12,
                    runSpacing: 12,
                    children: [
                      ArtistPrimaryButton(
                        icon: Icons.play_arrow_rounded,
                        label: 'Phat tat ca',
                        onTap: onPlayAll,
                      ),
                      ArtistGhostButton(
                        icon: Icons.shuffle_rounded,
                        label: 'Ngau nhien',
                        onTap: onShuffle,
                      ),
                      ArtistGhostButton(
                        icon: isFollowLoading
                            ? Icons.hourglass_top_rounded
                            : isFollowing
                                ? Icons.check_circle_outline_rounded
                                : Icons.person_add_alt_1_rounded,
                        label: isFollowLoading
                            ? 'Dang cap nhat'
                            : isFollowing
                                ? 'Dang theo doi'
                                : 'Theo doi',
                        onTap: onFollow,
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTextFallback() {
    return Center(
      child: Text(
        artist.name.isNotEmpty ? artist.name[0].toUpperCase() : 'A',
        style: const TextStyle(
          color: Colors.white,
          fontSize: 28,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }

  Widget _buildCoverFallback() {
    if (artist.songs.isNotEmpty && artist.songs.first.imageUrl.isNotEmpty) {
      return Image.network(
        artist.songs.first.imageUrl,
        fit: BoxFit.cover,
        errorBuilder: (_, __, ___) => _defaultCoverGradient(),
      );
    }
    return _defaultCoverGradient();
  }

  Widget _defaultCoverGradient() {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color(0xFF22364D),
            Color(0xFF0E131B),
          ],
        ),
      ),
    );
  }

  String _formatCompactNumber(int value) {
    if (value >= 1000000) {
      return '${(value / 1000000).toStringAsFixed(1)}M';
    }
    if (value >= 1000) {
      return '${(value / 1000).toStringAsFixed(1)}K';
    }
    return '$value';
  }
}

class _CircleIconButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;

  const _CircleIconButton({
    required this.icon,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.black.withOpacity(0.35),
      shape: const CircleBorder(),
      child: InkWell(
        onTap: onTap,
        customBorder: const CircleBorder(),
        child: Padding(
          padding: const EdgeInsets.all(10),
          child: Icon(icon, color: Colors.white),
        ),
      ),
    );
  }
}

