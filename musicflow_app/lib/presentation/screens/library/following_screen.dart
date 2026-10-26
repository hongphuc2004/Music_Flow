import 'package:flutter/material.dart';
import '../../widgets/music_flow_backdrop.dart';
import '../../../core/theme/app_theme.dart';
import '../../../data/models/song_model.dart';
import '../../../data/services/artist_api_service.dart';
import '../../../data/services/auth_service.dart';
import '../../widgets/mini_player_wrapper.dart';
import '../artist/artist_screen.dart';
import '../login/login_screen.dart';
import '../../../core/utils/app_toast.dart';

class FollowingScreen extends StatefulWidget {
  final Function(Song)? onSongTap;
  final Function(List<Song>, {int startIndex})? onPlayAll;

  const FollowingScreen({super.key, this.onSongTap, this.onPlayAll});

  @override
  State<FollowingScreen> createState() => _FollowingScreenState();
}

class _FollowingScreenState extends State<FollowingScreen> {
  List<FollowingArtist> _artists = [];
  bool _isLoading = true;
  bool _isLoggedIn = false;
  String _searchQuery = '';
  int _selectedFilterIndex = 0; // 0: Tất cả, 1: Đã xác minh, 2: Phổ biến
  final TextEditingController _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _checkLoginAndLoad();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _checkLoginAndLoad() async {
    final loggedIn = await AuthService.isLoggedIn();
    if (!mounted) return;
    setState(() {
      _isLoggedIn = loggedIn;
    });

    if (loggedIn) {
      await _loadFollowing();
    } else {
      setState(() {
        _isLoading = false;
      });
    }
  }

  Future<void> _loadFollowing({String search = ''}) async {
    setState(() => _isLoading = true);
    try {
      final list = await ArtistApiService.fetchFollowingArtists(search: search);
      if (mounted) {
        setState(() {
          _artists = list;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _toggleFollow(FollowingArtist artist) async {
    final prevStatus = artist.isFollowing;
    setState(() {
      artist.isFollowing = !prevStatus;
    });

    final res = await ArtistApiService.toggleFollowArtist(artist.id);
    if (!res.success) {
      if (mounted) {
        setState(() {
          artist.isFollowing = prevStatus;
        });
        AppToast.show(context, res.message ?? 'Không thể cập nhật theo dõi', type: ToastType.error);
      }
      return;
    }

    if (mounted) {
      if (res.isFollowing == false) {
        AppToast.show(
          context,
          'Đã bỏ theo dõi ${artist.name}',
          type: ToastType.info,
        );
      } else {
        AppToast.show(
          context,
          'Đang theo dõi ${artist.name}',
          type: ToastType.success,
        );
      }
    }
  }

  List<FollowingArtist> get _filteredArtists {
    var list = _artists;
    if (_searchQuery.trim().isNotEmpty) {
      final q = _searchQuery.trim().toLowerCase();
      list = list.where((a) {
        return a.name.toLowerCase().contains(q) ||
            a.slug.toLowerCase().contains(q) ||
            a.bio.toLowerCase().contains(q);
      }).toList();
    }

    if (_selectedFilterIndex == 1) {
      // Đã xác minh
      list = list.where((a) => a.isVerified).toList();
    } else if (_selectedFilterIndex == 2) {
      // Phổ biến (nhiều followers)
      final sorted = List<FollowingArtist>.from(list);
      sorted.sort((a, b) => b.followersCount.compareTo(a.followersCount));
      return sorted;
    }

    return list;
  }

  String _formatCount(int count) {
    if (count >= 1000000) {
      return '${(count / 1000000).toStringAsFixed(1)}M';
    } else if (count >= 1000) {
      return '${(count / 1000).toStringAsFixed(1)}K';
    }
    return '$count';
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return MusicFlowBackdrop(
      child: Scaffold(
        backgroundColor: Colors.transparent,
        body: MiniPlayerWrapper(
          child: SafeArea(
            bottom: false,
            child: Column(
              children: [
                _buildHeader(theme, isDark),
                _buildSearchBar(theme, isDark),
                _buildFilterChips(theme, isDark),
                Expanded(
                  child: _buildBody(theme, isDark),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(ThemeData theme, bool isDark) {
    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm,
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              Material(
                color: Colors.transparent,
                child: InkWell(
                  onTap: () => Navigator.pop(context),
                  borderRadius: BorderRadius.circular(12),
                  child: Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: isDark
                          ? Colors.white.withOpacity(0.08)
                          : Colors.black.withOpacity(0.04),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: isDark
                            ? Colors.white.withOpacity(0.08)
                            : Colors.black.withOpacity(0.05),
                      ),
                    ),
                    child: Icon(
                      Icons.arrow_back_ios_new_rounded,
                      color: isDark ? AppColors.darkTextPrimary : AppColors.lightTextPrimary,
                      size: 18,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    'Đang theo dõi',
                    style: theme.textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w900,
                      fontSize: 20,
                      letterSpacing: -0.5,
                    ),
                  ),
                  if (_artists.isNotEmpty)
                    Text(
                      '${_artists.length} nghệ sĩ trong thư viện của bạn',
                      style: TextStyle(
                        fontSize: 12,
                        color: isDark
                            ? AppColors.darkTextSecondary
                            : AppColors.lightTextSecondary,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                ],
              ),
            ],
          ),

          // Count badge chip with gradient
          if (_artists.isNotEmpty)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [AppColors.primary, AppColors.secondary],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(20),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.primary.withOpacity(0.3),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.people_alt_rounded, color: Colors.white, size: 14),
                  const SizedBox(width: 4),
                  Text(
                    '${_artists.length}',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildSearchBar(ThemeData theme, bool isDark) {
    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.xs,
      ),
      child: Container(
        height: 46,
        decoration: BoxDecoration(
          color: isDark
              ? const Color(0xFF1B172E).withOpacity(0.65)
              : Colors.white.withOpacity(0.85),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: isDark
                ? AppColors.primary.withOpacity(0.25)
                : Colors.black.withOpacity(0.08),
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(isDark ? 0.2 : 0.04),
              blurRadius: 10,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        child: TextField(
          controller: _searchController,
          onChanged: (val) {
            setState(() {
              _searchQuery = val;
            });
          },
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w500,
            color: isDark ? AppColors.darkTextPrimary : AppColors.lightTextPrimary,
          ),
          decoration: InputDecoration(
            hintText: 'Tìm kiếm theo tên, handle, thông tin...',
            hintStyle: TextStyle(
              fontSize: 13,
              color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
            ),
            prefixIcon: const Icon(
              Icons.search_rounded,
              size: 20,
              color: AppColors.secondary,
            ),
            suffixIcon: _searchQuery.isNotEmpty
                ? IconButton(
                    icon: const Icon(Icons.close_rounded, size: 18),
                    onPressed: () {
                      _searchController.clear();
                      setState(() {
                        _searchQuery = '';
                      });
                    },
                  )
                : null,
            border: InputBorder.none,
            contentPadding: const EdgeInsets.symmetric(vertical: 12),
          ),
        ),
      ),
    );
  }

  Widget _buildFilterChips(ThemeData theme, bool isDark) {
    final filters = [
      {'label': 'Tất cả (${_artists.length})', 'icon': Icons.all_inclusive_rounded},
      {'label': 'Đã xác minh', 'icon': Icons.verified_rounded},
      {'label': 'Phổ biến nhất', 'icon': Icons.trending_up_rounded},
    ];

    return Container(
      height: 38,
      margin: const EdgeInsets.only(top: 6, bottom: 8),
      child: ListView.separated(
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
        scrollDirection: Axis.horizontal,
        itemCount: filters.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (context, index) {
          final isSelected = _selectedFilterIndex == index;
          final item = filters[index];

          return GestureDetector(
            onTap: () {
              setState(() {
                _selectedFilterIndex = index;
              });
            },
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                gradient: isSelected
                    ? const LinearGradient(
                        colors: [AppColors.primary, AppColors.secondary],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      )
                    : null,
                color: isSelected
                    ? null
                    : (isDark
                        ? Colors.white.withOpacity(0.05)
                        : Colors.black.withOpacity(0.04)),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                  color: isSelected
                      ? Colors.transparent
                      : (isDark
                          ? Colors.white.withOpacity(0.08)
                          : Colors.black.withOpacity(0.06)),
                ),
                boxShadow: isSelected
                    ? [
                        BoxShadow(
                          color: AppColors.primary.withOpacity(0.25),
                          blurRadius: 8,
                          offset: const Offset(0, 2),
                        ),
                      ]
                    : null,
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    item['icon'] as IconData,
                    size: 14,
                    color: isSelected
                        ? Colors.white
                        : (isDark
                            ? AppColors.darkTextSecondary
                            : AppColors.lightTextSecondary),
                  ),
                  const SizedBox(width: 5),
                  Text(
                    item['label'] as String,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: isSelected ? FontWeight.bold : FontWeight.w600,
                      color: isSelected
                          ? Colors.white
                          : (isDark
                              ? AppColors.darkTextPrimary
                              : AppColors.lightTextPrimary),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildBody(ThemeData theme, bool isDark) {
    if (!_isLoggedIn) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.xl),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: AppColors.primary.withOpacity(0.12),
                ),
                child: const Icon(
                  Icons.lock_outline_rounded,
                  size: 40,
                  color: AppColors.primary,
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              Text(
                'Đăng nhập để xem danh sách',
                style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                'Theo dõi những nghệ sĩ bạn yêu thích và nhận thông báo khi có bài hát mới.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
                  fontSize: 13,
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              ElevatedButton(
                onPressed: () async {
                  await Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const LoginScreen()),
                  );
                  _checkLoginAndLoad();
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(20),
                  ),
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 10),
                ),
                child: const Text('Đăng nhập ngay', style: TextStyle(fontWeight: FontWeight.bold)),
              ),
            ],
          ),
        ),
      );
    }

    if (_isLoading) {
      return const Center(
        child: CircularProgressIndicator(color: AppColors.primary),
      );
    }

    final list = _filteredArtists;

    if (list.isEmpty) {
      return RefreshIndicator(
        onRefresh: _loadFollowing,
        color: AppColors.primary,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            SizedBox(height: MediaQuery.of(context).size.height * 0.18),
            Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 84,
                    height: 84,
                    decoration: BoxDecoration(
                      color: AppColors.primary.withOpacity(0.12),
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: AppColors.primary.withOpacity(0.2),
                        width: 2,
                      ),
                    ),
                    child: const Icon(
                      Icons.person_outline_rounded,
                      size: 42,
                      color: AppColors.primary,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  Text(
                    _searchQuery.isNotEmpty
                        ? 'Không tìm thấy nghệ sĩ phù hợp'
                        : 'Bạn chưa theo dõi nghệ sĩ nào',
                    style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    _searchQuery.isNotEmpty
                        ? 'Thử tìm với từ khóa khác hoặc xóa bộ lọc'
                        : 'Hãy khám phá các tác phẩm và nhấn Theo dõi nghệ sĩ bạn yêu thích!',
                    style: TextStyle(
                      color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
                      fontSize: 13,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadFollowing,
      color: AppColors.primary,
      child: ListView.builder(
        padding: const EdgeInsets.only(
          top: 4,
          bottom: 24,
        ),
        physics: const AlwaysScrollableScrollPhysics(),
        itemCount: list.length,
        itemBuilder: (context, index) {
          final artist = list[index];
          return _buildArtistCard(artist, theme, isDark);
        },
      ),
    );
  }

  Widget _buildArtistCard(FollowingArtist artist, ThemeData theme, bool isDark) {
    final handle = artist.slug.isNotEmpty
        ? '@${artist.slug}'
        : '@${artist.name.toLowerCase().replaceAll(RegExp(r'\s+'), '')}';

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: 5),
      decoration: BoxDecoration(
        color: isDark
            ? const Color(0xFF161328).withOpacity(0.7)
            : Colors.white.withOpacity(0.85),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isDark
              ? Colors.white.withOpacity(0.07)
              : Colors.black.withOpacity(0.04),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(isDark ? 0.2 : 0.03),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () {
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => ArtistScreen(
                  artistName: artist.name,
                  onSongTap: widget.onSongTap,
                  onPlayAll: widget.onPlayAll,
                ),
              ),
            );
          },
          borderRadius: BorderRadius.circular(16),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                // Glowing Avatar with Gradient Ring
                Stack(
                  alignment: Alignment.center,
                  children: [
                    Container(
                      width: 58,
                      height: 58,
                      decoration: const BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: LinearGradient(
                          colors: [AppColors.primary, AppColors.secondary],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                      ),
                    ),
                    CircleAvatar(
                      radius: 26,
                      backgroundColor: isDark
                          ? const Color(0xFF1C1930)
                          : const Color(0xFFE2E8F0),
                      backgroundImage: artist.avatarUrl.isNotEmpty
                          ? NetworkImage(artist.avatarUrl)
                          : null,
                      child: artist.avatarUrl.isEmpty
                          ? Text(
                              artist.name.isNotEmpty ? artist.name[0].toUpperCase() : 'A',
                              style: const TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                                color: AppColors.primary,
                              ),
                            )
                          : null,
                    ),
                    if (artist.isVerified)
                      Positioned(
                        right: 0,
                        bottom: 0,
                        child: Container(
                          padding: const EdgeInsets.all(2),
                          decoration: BoxDecoration(
                            color: isDark ? const Color(0xFF161328) : Colors.white,
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(
                            Icons.verified_rounded,
                            size: 15,
                            color: AppColors.secondary,
                          ),
                        ),
                      ),
                  ],
                ),
                const SizedBox(width: AppSpacing.md),

                // Name, Handle and Stats Chips
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Row(
                        children: [
                          Flexible(
                            child: Text(
                              artist.name,
                              style: theme.textTheme.titleMedium?.copyWith(
                                fontWeight: FontWeight.bold,
                                fontSize: 15,
                                letterSpacing: -0.2,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          if (artist.isPro) ...[
                            const SizedBox(width: 4),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                              decoration: BoxDecoration(
                                gradient: const LinearGradient(
                                  colors: [Color(0xFFFFB300), Color(0xFFFF7043)],
                                ),
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: const Text(
                                'PRO',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 9,
                                  fontWeight: FontWeight.w900,
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(
                        handle,
                        style: TextStyle(
                          fontSize: 12.5,
                          color: isDark
                              ? AppColors.darkTextSecondary.withOpacity(0.85)
                              : AppColors.lightTextSecondary,
                          fontWeight: FontWeight.w500,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 6),

                      // Info Badges (Followers & Songs)
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                            decoration: BoxDecoration(
                              color: isDark
                                  ? Colors.white.withOpacity(0.06)
                                  : Colors.black.withOpacity(0.04),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(Icons.people_outline_rounded, size: 12, color: AppColors.secondary),
                                const SizedBox(width: 3),
                                Text(
                                  '${_formatCount(artist.followersCount)} follow',
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w600,
                                    color: isDark ? Colors.white70 : Colors.black87,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          if (artist.songsCount > 0) ...[
                            const SizedBox(width: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                              decoration: BoxDecoration(
                                color: isDark
                                    ? Colors.white.withOpacity(0.06)
                                    : Colors.black.withOpacity(0.04),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(Icons.music_note_rounded, size: 12, color: AppColors.accentPink),
                                const SizedBox(width: 3),
                                Text(
                                  '${artist.songsCount} bài',
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w600,
                                    color: isDark ? Colors.white70 : Colors.black87,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                        ],
                      ),
                    ],
                  ),
                ),

                const SizedBox(width: AppSpacing.sm),

                // Trailing Follow Toggle Button (styled with glow and icon feedback)
                _buildFollowingButton(artist, isDark),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildFollowingButton(FollowingArtist artist, bool isDark) {
    final isFollowing = artist.isFollowing;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => _toggleFollow(artist),
        borderRadius: BorderRadius.circular(10),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 220),
          width: isFollowing ? 64 : 76,
          height: 36,
          decoration: BoxDecoration(
            gradient: isFollowing
                ? null
                : const LinearGradient(
                    colors: [AppColors.primary, AppColors.secondary],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
            color: isFollowing
                ? (isDark
                    ? Colors.white.withOpacity(0.08)
                    : Colors.black.withOpacity(0.05))
                : null,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: isFollowing
                  ? (isDark
                      ? Colors.white.withOpacity(0.18)
                      : Colors.black.withOpacity(0.12))
                  : Colors.transparent,
              width: 1.2,
            ),
            boxShadow: !isFollowing
                ? [
                    BoxShadow(
                      color: AppColors.primary.withOpacity(0.35),
                      blurRadius: 8,
                      offset: const Offset(0, 2),
                    ),
                  ]
                : null,
          ),
          alignment: Alignment.center,
          child: isFollowing
              ? Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      Icons.person_rounded,
                      size: 15,
                      color: isDark ? Colors.white : Colors.black87,
                    ),
                    const SizedBox(width: 2),
                    const Icon(
                      Icons.check_rounded,
                      size: 14,
                      color: Color(0xFF10B981), // Emerald green check
                    ),
                  ],
                )
              : const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      Icons.add_rounded,
                      size: 15,
                      color: Colors.white,
                    ),
                    SizedBox(width: 2),
                    Text(
                      'Follow',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                  ],
                ),
        ),
      ),
    );
  }
}
