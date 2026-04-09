import 'package:flutter/material.dart';
import 'package:musicflow_app/presentation/screens/artist/artist_screen.dart';
import 'package:musicflow_app/presentation/screens/home/home_artist_section.dart';
import 'package:musicflow_app/presentation/screens/home/home_shared.dart';

class HomeAllArtistsScreen extends StatelessWidget {
  final List<HomeArtistPreview> artists;

  const HomeAllArtistsScreen({
    super.key,
    required this.artists,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        foregroundColor: Colors.black,
        elevation: 0,
        title: const Text(
          'Tat ca nghe si',
          style: TextStyle(
            color: Colors.black,
            fontWeight: FontWeight.w800,
          ),
        ),
      ),
      body: GridView.builder(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          crossAxisSpacing: 14,
          mainAxisSpacing: 18,
          childAspectRatio: 0.78,
        ),
        itemCount: artists.length,
        itemBuilder: (context, index) {
          return _AllArtistGridCard(
            artist: artists[index],
            accent: _accentFor(index),
          );
        },
      ),
    );
  }

  Color _accentFor(int index) {
    const palette = [
      HomePalette.accent,
      Color(0xFF4D83FF),
      HomePalette.secondaryAccent,
      Color(0xFFB365FF),
      Color(0xFFFF8F5A),
      Color(0xFF4F89FF),
    ];
    return palette[index % palette.length];
  }
}

class _AllArtistGridCard extends StatelessWidget {
  final HomeArtistPreview artist;
  final Color accent;

  const _AllArtistGridCard({
    required this.artist,
    required this.accent,
  });

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
      borderRadius: BorderRadius.circular(16),
      child: Column(
        children: [
          Expanded(
            child: Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    accent.withOpacity(0.82),
                    Color.lerp(accent, Colors.black, 0.20) ?? accent,
                  ],
                ),
              ),
              child: Stack(
                children: [
                  Positioned(
                    left: 10,
                    top: 10,
                    child: Icon(
                      Icons.auto_awesome_rounded,
                      color: Colors.white.withOpacity(0.28),
                      size: 14,
                    ),
                  ),
                  Center(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(18, 18, 18, 42),
                      child: Container(
                        width: 116,
                        height: 116,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white.withOpacity(0.35), width: 3),
                        ),
                        child: ClipOval(
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
                  ),
                  Positioned(
                    left: 12,
                    right: 12,
                    bottom: 12,
                    child: Text(
                      artist.name,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 14,
                        fontWeight: FontWeight.w800,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _fallbackAvatar() {
    return Container(
      color: Colors.white.withOpacity(0.14),
      child: Center(
        child: Text(
          artist.name.isNotEmpty ? artist.name[0].toUpperCase() : 'A',
          style: const TextStyle(
            color: Colors.white,
            fontSize: 32,
            fontWeight: FontWeight.w900,
          ),
        ),
      ),
    );
  }
}
