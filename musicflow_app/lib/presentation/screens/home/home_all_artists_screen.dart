import 'package:flutter/material.dart';
import 'package:musicflow_app/presentation/screens/artist/artist_screen.dart';
import 'package:musicflow_app/presentation/screens/home/home_artist_section.dart';
import 'package:musicflow_app/presentation/screens/home/home_shared.dart';

class HomeAllArtistsScreen extends StatefulWidget {
  final List<HomeArtistPreview> artists;

  const HomeAllArtistsScreen({super.key, required this.artists});

  @override
  State<HomeAllArtistsScreen> createState() => _HomeAllArtistsScreenState();
}

class _HomeAllArtistsScreenState extends State<HomeAllArtistsScreen> {
  late List<HomeArtistPreview> _filteredArtists;

  @override
  void initState() {
    super.initState();
    _filteredArtists = widget.artists;
  }

  void _filterArtists(String query) {
    setState(() {
      if (query.trim().isEmpty) {
        _filteredArtists = widget.artists;
      } else {
        _filteredArtists = widget.artists
            .where((artist) =>
                artist.name.toLowerCase().contains(query.trim().toLowerCase()))
            .toList();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: HomePalette.background(context),
      appBar: AppBar(
        backgroundColor: HomePalette.background(context),
        foregroundColor: HomePalette.textPrimary(context),
        elevation: 0,
        title: Text(
          'Tất cả nghệ sĩ',
          style: TextStyle(
            color: HomePalette.textPrimary(context),
            fontWeight: FontWeight.w900,
            letterSpacing: -0.5,
          ),
        ),
      ),
      body: Stack(
        children: [
          const HomeBackdrop(),
          Column(
            children: [
              // Search Input field
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 14),
                child: Container(
                  decoration: BoxDecoration(
                    color: HomePalette.card(context),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: HomePalette.cardBorder(context)),
                  ),
                  child: TextField(
                    onChanged: _filterArtists,
                    style: TextStyle(color: HomePalette.textPrimary(context)),
                    decoration: InputDecoration(
                      hintText: 'Tìm kiếm nghệ sĩ...',
                      hintStyle: TextStyle(
                        color: HomePalette.textSecondary(context).withValues(alpha: 0.7),
                      ),
                      prefixIcon: Icon(
                        Icons.search_rounded,
                        color: HomePalette.textSecondary(context),
                      ),
                      border: InputBorder.none,
                      contentPadding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                  ),
                ),
              ),
              // Artists Grid View
              Expanded(
                child: _filteredArtists.isEmpty
                    ? Center(
                        child: Text(
                          'Không tìm thấy nghệ sĩ nào',
                          style: TextStyle(
                            color: HomePalette.textSecondary(context),
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      )
                    : GridView.builder(
                        padding: const EdgeInsets.fromLTRB(16, 0, 16, 30),
                        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 2,
                          crossAxisSpacing: 12,
                          mainAxisSpacing: 12,
                          childAspectRatio: 0.86,
                        ),
                        itemCount: _filteredArtists.length,
                        itemBuilder: (context, index) {
                          final artist = _filteredArtists[index];
                          return _AllArtistGridCard(
                            artist: artist,
                            accent: _accentFor(index),
                          );
                        },
                      ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Color _accentFor(int index) {
    const palette = [
      HomePalette.primary,
      HomePalette.secondary,
      Color(0xFFFF8A5B),
      Color(0xFFE66BFF),
      Color(0xFF5BE584),
    ];
    return palette[index % palette.length];
  }
}

class _AllArtistGridCard extends StatelessWidget {
  final HomeArtistPreview artist;
  final Color accent;

  const _AllArtistGridCard({required this.artist, required this.accent});

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
      borderRadius: BorderRadius.circular(24),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: HomePalette.card(context),
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: HomePalette.cardBorder(context)),
          boxShadow: [
            BoxShadow(
              color: accent.withValues(alpha: isDark ? 0.05 : 0.01),
              blurRadius: 14,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Stack(
              alignment: Alignment.center,
              children: [
                Container(
                  padding: const EdgeInsets.all(3),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(color: accent.withValues(alpha: 0.35), width: 1.5),
                  ),
                  child: ClipOval(
                    child: SizedBox(
                      width: 68,
                      height: 68,
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
            const SizedBox(height: 10),
            Text(
              artist.name,
              style: TextStyle(
                color: HomePalette.textPrimary(context),
                fontSize: 13,
                fontWeight: FontWeight.w900,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 2),
            Text(
              artist.followersCount > 0
                  ? '${_formatCompactNumber(artist.followersCount)} người theo dõi'
                  : 'Nghệ sĩ',
              style: TextStyle(
                color: HomePalette.textSecondary(context),
                fontSize: 10,
                fontWeight: FontWeight.w500,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
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
            fontSize: 24,
            fontWeight: FontWeight.w900,
          ),
        ),
      ),
    );
  }
}
