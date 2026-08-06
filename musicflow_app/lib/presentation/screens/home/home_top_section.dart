import 'dart:async';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:musicflow_app/data/models/song_model.dart';
import 'home_shared.dart';

class HomeTopBar extends StatelessWidget {
  final String displayName;
  final VoidCallback? onSearchTap;

  const HomeTopBar({super.key, required this.displayName, this.onSearchTap});

  @override
  Widget build(BuildContext context) {
    final now = TimeOfDay.now();
    final greeting = now.hour < 12
        ? 'Chào buổi sáng'
        : now.hour < 18
            ? 'Chào buổi chiều'
            : 'Chào buổi tối';

    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: isDark ? Colors.white.withValues(alpha: 0.03) : Colors.black.withValues(alpha: 0.02),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: isDark ? Colors.white.withValues(alpha: 0.06) : Colors.black.withValues(alpha: 0.04),
        ),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: HomePalette.primary.withValues(alpha: 0.12),
              shape: BoxShape.circle,
            ),
            child: Image.asset(
              'assets/images/logo.png',
              width: 26,
              height: 26,
              errorBuilder: (_, __, ___) => const Icon(
                Icons.music_note,
                color: HomePalette.primary,
                size: 26,
              ),
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
                    color: HomePalette.textSecondary(context),
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  displayName,
                  style: TextStyle(
                    color: HomePalette.textPrimary(context),
                    fontSize: 18,
                    fontWeight: FontWeight.w900,
                    letterSpacing: -0.5,
                  ),
                ),
              ],
            ),
          ),
          Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: onSearchTap,
              borderRadius: BorderRadius.circular(16),
              child: Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: isDark ? Colors.white.withValues(alpha: 0.04) : Colors.black.withValues(alpha: 0.03),
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: isDark ? Colors.white.withValues(alpha: 0.06) : Colors.black.withValues(alpha: 0.04),
                  ),
                ),
                child: Icon(
                  Icons.search_rounded,
                  color: HomePalette.textPrimary(context),
                  size: 20,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class HomeMoodFilter extends StatelessWidget {
  final String selectedMood;
  final ValueChanged<String> onMoodChanged;

  const HomeMoodFilter({
    super.key,
    required this.selectedMood,
    required this.onMoodChanged,
  });

  @override
  Widget build(BuildContext context) {
    final moods = ['🎯 Tất cả', '🌿 Chill', '🔥 Hype', '⚡ Focus', '🎸 Acoustic', '💤 Sleep'];
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return SizedBox(
      height: 38,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: moods.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (context, index) {
          final mood = moods[index];
          final isSelected = mood == selectedMood;

          return Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: () => onMoodChanged(mood),
              borderRadius: BorderRadius.circular(20),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                decoration: BoxDecoration(
                  gradient: isSelected
                      ? const LinearGradient(
                          colors: [HomePalette.primary, HomePalette.secondary],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        )
                      : null,
                  color: isSelected
                      ? null
                      : isDark
                          ? Colors.white.withValues(alpha: 0.04)
                          : Colors.black.withValues(alpha: 0.03),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: isSelected
                        ? Colors.transparent
                        : isDark
                            ? Colors.white.withValues(alpha: 0.06)
                            : Colors.black.withValues(alpha: 0.04),
                  ),
                  boxShadow: isSelected
                      ? [
                          BoxShadow(
                            color: HomePalette.primary.withValues(alpha: 0.3),
                            blurRadius: 8,
                            offset: const Offset(0, 3),
                          )
                        ]
                      : null,
                ),
                child: Center(
                  child: Text(
                    mood,
                    style: TextStyle(
                      color: isSelected
                          ? Colors.white
                          : HomePalette.textPrimary(context).withValues(alpha: 0.8),
                      fontSize: 13,
                      fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                    ),
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

class HomeHeroCarousel extends StatefulWidget {
  final List<Song> recommendedSongs;
  final ValueChanged<Song> onPlaySong;
  final VoidCallback? onPlayRecommended;

  const HomeHeroCarousel({
    super.key,
    required this.recommendedSongs,
    required this.onPlaySong,
    required this.onPlayRecommended,
  });

  @override
  State<HomeHeroCarousel> createState() => _HomeHeroCarouselState();
}

class _HomeHeroCarouselState extends State<HomeHeroCarousel> {
  late PageController _pageController;
  int _currentPage = 0;
  Timer? _autoPlayTimer;

  @override
  void initState() {
    super.initState();
    _pageController = PageController(viewportFraction: 0.9, initialPage: 0);
    _startAutoPlay();
  }

  @override
  void dispose() {
    _stopAutoPlay();
    _pageController.dispose();
    super.dispose();
  }

  void _startAutoPlay() {
    _autoPlayTimer = Timer.periodic(const Duration(seconds: 5), (timer) {
      if (widget.recommendedSongs.length <= 1) return;
      int nextPage = _currentPage + 1;
      if (nextPage >= widget.recommendedSongs.length || nextPage >= 4) {
        nextPage = 0;
      }
      if (_pageController.hasClients) {
        _pageController.animateToPage(
          nextPage,
          duration: const Duration(milliseconds: 600),
          curve: Curves.easeInOutCubic,
        );
      }
    });
  }

  void _stopAutoPlay() {
    _autoPlayTimer?.cancel();
  }

  @override
  Widget build(BuildContext context) {
    final songsToShow = widget.recommendedSongs.take(4).toList();
    if (songsToShow.isEmpty) return const SizedBox.shrink();

    return Column(
      children: [
        SizedBox(
          height: 198,
          child: PageView.builder(
            controller: _pageController,
            onPageChanged: (page) {
              setState(() {
                _currentPage = page;
              });
            },
            itemCount: songsToShow.length,
            itemBuilder: (context, index) {
              final song = songsToShow[index];
              return AnimatedBuilder(
                animation: _pageController,
                builder: (context, child) {
                  double value = 1.0;
                  if (_pageController.position.haveDimensions) {
                    value = (_pageController.page ?? 0) - index;
                    value = (1 - (value.abs() * 0.08)).clamp(0.0, 1.0);
                  } else {
                    value = index == 0 ? 1.0 : 0.92;
                  }
                  return Transform.scale(
                    scale: value,
                    child: child,
                  );
                },
                child: _HeroCard(
                  song: song,
                  songs: widget.recommendedSongs,
                  onPlaySong: widget.onPlaySong,
                  onPlayRecommended: widget.onPlayRecommended,
                ),
              );
            },
          ),
        ),
        const SizedBox(height: 12),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: List.generate(
            songsToShow.length,
            (index) => AnimatedContainer(
              duration: const Duration(milliseconds: 300),
              margin: const EdgeInsets.symmetric(horizontal: 4),
              width: _currentPage == index ? 18 : 6,
              height: 6,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(3),
                gradient: _currentPage == index
                    ? const LinearGradient(colors: [HomePalette.primary, HomePalette.secondary])
                    : null,
                color: _currentPage == index
                    ? null
                    : Theme.of(context).disabledColor.withValues(alpha: 0.3),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _HeroCard extends StatelessWidget {
  final Song song;
  final List<Song> songs;
  final ValueChanged<Song> onPlaySong;
  final VoidCallback? onPlayRecommended;

  const _HeroCard({
    required this.song,
    required this.songs,
    required this.onPlaySong,
    required this.onPlayRecommended,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return ClipRRect(
      borderRadius: BorderRadius.circular(28),
      child: Stack(
        children: [
          // Blurred background image
          Positioned.fill(
            child: song.imageUrl.isNotEmpty
                ? Image.network(song.imageUrl, fit: BoxFit.cover)
                : Container(color: HomePalette.primary),
          ),
          Positioned.fill(
            child: BackdropFilter(
              filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
              child: Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      (isDark ? Colors.black : Colors.white).withValues(alpha: 0.55),
                      (isDark ? Colors.black : Colors.white).withValues(alpha: 0.85),
                    ],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                ),
              ),
            ),
          ),
          // Glow effect on borders
          Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(28),
              border: Border.all(
                color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.08),
              ),
            ),
          ),
          // Content
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      HomeTag(
                        icon: Icons.auto_awesome,
                        label: 'GỢI Ý TOP 1',
                        background: HomePalette.primary.withValues(alpha: 0.15),
                        foreground: HomePalette.primary,
                      ),
                      const SizedBox(height: 12),
                      Text(
                        song.title,
                        style: TextStyle(
                          color: HomePalette.textPrimary(context),
                          fontSize: 20,
                          fontWeight: FontWeight.w900,
                          letterSpacing: -0.5,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        song.artists.join(', '),
                        style: TextStyle(
                          color: HomePalette.textSecondary(context),
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 16),
                      Row(
                        children: [
                          Expanded(
                            child: Material(
                              color: Colors.transparent,
                              child: InkWell(
                                onTap: () => onPlaySong(song),
                                borderRadius: BorderRadius.circular(14),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(vertical: 10),
                                  decoration: BoxDecoration(
                                    gradient: const LinearGradient(
                                      colors: [HomePalette.primary, HomePalette.secondary],
                                    ),
                                    borderRadius: BorderRadius.circular(14),
                                    boxShadow: [
                                      BoxShadow(
                                        color: HomePalette.primary.withValues(alpha: 0.3),
                                        blurRadius: 8,
                                        offset: const Offset(0, 3),
                                      ),
                                    ],
                                  ),
                                  child: const Row(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Icon(Icons.play_arrow_rounded, color: Colors.white, size: 18),
                                      SizedBox(width: 4),
                                      Text(
                                        'Phát',
                                        style: TextStyle(
                                          color: Colors.white,
                                          fontSize: 13,
                                          fontWeight: FontWeight.w800,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: onPlayRecommended,
                              icon: Icon(
                                Icons.shuffle_rounded,
                                size: 14,
                                color: HomePalette.textPrimary(context).withValues(alpha: 0.8),
                              ),
                              label: Text(
                                'Mix gợi ý',
                                style: TextStyle(
                                  fontSize: 12,
                                  color: HomePalette.textPrimary(context),
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              style: OutlinedButton.styleFrom(
                                side: BorderSide(
                                  color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.15),
                                ),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(14),
                                ),
                                padding: const EdgeInsets.symmetric(vertical: 10),
                              ),
                            ),
                          ),
                        ],
                      )
                    ],
                  ),
                ),
                const SizedBox(width: 14),
                HomeArtwork(
                  imageUrl: song.imageUrl,
                  size: 110,
                  borderRadius: 20,
                  iconSize: 38,
                ),
              ],
            ),
          )
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
            title: 'Phát nhanh',
            subtitle: 'AI chọn lọc',
            color: HomePalette.primary,
            onTap: featuredSong == null ? null : onPlayFeatured,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _QuickActionCard(
            icon: Icons.library_music_rounded,
            title: 'Playlists',
            subtitle: '$playlistCount album',
            color: HomePalette.secondary,
            onTap: playlistCount == 0 ? null : onOpenPlaylists,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _QuickActionCard(
            icon: Icons.auto_awesome_motion_rounded,
            title: 'Mix bộ lọc',
            subtitle: '$recommendedCount bài',
            color: const Color(0xFFFF8A5B),
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
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(22),
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: isDark ? Colors.white.withValues(alpha: 0.03) : Colors.black.withValues(alpha: 0.02),
            borderRadius: BorderRadius.circular(22),
            border: Border.all(
              color: isDark ? Colors.white.withValues(alpha: 0.06) : Colors.black.withValues(alpha: 0.04),
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, color: color, size: 20),
              ),
              const SizedBox(height: 12),
              Text(
                title,
                style: TextStyle(
                  color: HomePalette.textPrimary(context),
                  fontSize: 13,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                subtitle,
                style: TextStyle(
                  color: HomePalette.textSecondary(context),
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class HomeAiDjBanner extends StatelessWidget {
  final VoidCallback onTap;

  const HomeAiDjBanner({super.key, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(24),
        child: Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(24),
            gradient: LinearGradient(
              colors: isDark
                  ? [
                      const Color(0xFF6C63FF).withValues(alpha: 0.85),
                      const Color(0xFF00BCD4).withValues(alpha: 0.75),
                      const Color(0xFFFF8A5B).withValues(alpha: 0.65),
                    ]
                  : [
                      const Color(0xFF6C63FF).withValues(alpha: 0.15),
                      const Color(0xFF00BCD4).withValues(alpha: 0.12),
                      const Color(0xFFFF8A5B).withValues(alpha: 0.10),
                    ],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            border: Border.all(
              color: isDark
                  ? Colors.white.withValues(alpha: 0.12)
                  : const Color(0xFF6C63FF).withValues(alpha: 0.15),
            ),
            boxShadow: isDark
                ? [
                    BoxShadow(
                      color: const Color(0xFF6C63FF).withValues(alpha: 0.25),
                      blurRadius: 20,
                      offset: const Offset(0, 8),
                    )
                  ]
                : [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.05),
                      blurRadius: 12,
                      offset: const Offset(0, 6),
                    )
                  ],
          ),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                          decoration: BoxDecoration(
                            color: isDark ? Colors.white.withValues(alpha: 0.15) : const Color(0xFF6C63FF).withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                Icons.auto_awesome,
                                size: 12,
                                color: isDark ? Colors.white : const Color(0xFF6C63FF),
                              ),
                              const SizedBox(width: 4),
                              Text(
                                'AI DJ CHAT',
                                style: TextStyle(
                                  color: isDark ? Colors.white : const Color(0xFF6C63FF),
                                  fontSize: 9,
                                  fontWeight: FontWeight.w900,
                                  letterSpacing: 0.5,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Text(
                      'Tạo playlist theo tâm trạng cùng Gemini AI',
                      style: TextStyle(
                        color: isDark ? Colors.white : const Color(0xFF1A202C),
                        fontSize: 16,
                        fontWeight: FontWeight.w900,
                        height: 1.25,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Nói chuyện với AI DJ để nhận ngay danh sách nhạc phù hợp nhất!',
                      style: TextStyle(
                        color: isDark ? Colors.white.withValues(alpha: 0.8) : const Color(0xFF4A5568),
                        fontSize: 12,
                        height: 1.3,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 14),
              Container(
                width: 48,
                height: 48,
                decoration: const BoxDecoration(
                  color: Colors.white,
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black12,
                      blurRadius: 8,
                    )
                  ],
                ),
                child: Icon(
                  Icons.chat_bubble_outline_rounded,
                  color: HomePalette.primary,
                  size: 22,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
