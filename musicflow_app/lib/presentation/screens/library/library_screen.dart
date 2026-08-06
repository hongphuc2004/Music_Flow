import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';
import '../../../data/models/song_model.dart';
import '../../../data/models/playlist_model.dart';
import '../../../data/services/playlist_api_service.dart';
import '../../../data/services/play_history_service.dart';
import '../../../data/services/auth_service.dart';
import '../../../data/services/favorite_service.dart';
import '../../../data/services/song_api_service.dart';
import '../../../data/services/offline_song_service.dart';
import '../../widgets/song_options_menu.dart';
import '../library/history_screen.dart';
import '../settings/settings_screen.dart';
import '../library/your_uploads_screen.dart';
import '../library/favorites_screen.dart';
import '../library/playlists_screen.dart';
import '../library/downloaded_songs_screen.dart';

class LibraryScreen extends StatefulWidget {
  final Function(Song)? onSongTap;
  final Function(List<Song>, {int startIndex})? onPlayAll;

  const LibraryScreen({super.key, this.onSongTap, this.onPlayAll});

  @override
  State<LibraryScreen> createState() => LibraryScreenState();
}

class _MenuData {
  final IconData icon;
  final Color color;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  _MenuData({
    required this.icon,
    required this.color,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });
}

class LibraryScreenState extends State<LibraryScreen> {
  List<Playlist> _playlists = [];
  List<Song> _recentHistory = [];
  List<Song> _favoriteSongs = [];
  int _uploadedSongsCount = 0;
  int _downloadedSongsCount = 0;

  bool _isLoadingHistory = false;
  bool _isLoggedIn = false;

  @override
  void initState() {
    super.initState();
    AuthService.currentUserNotifier.addListener(_handleAuthChanged);
    _loadData();
  }

  @override
  void dispose() {
    AuthService.currentUserNotifier.removeListener(_handleAuthChanged);
    super.dispose();
  }

  Future<void> refresh() async {
    await _loadData();
  }

  Future<void> refreshFavorites() async {
    await _loadFavorites();
  }

  Future<void> _loadData() async {
    await _checkLoginStatus();
    await Future.wait([
      _loadPlaylists(),
      _loadRecentHistory(),
      _loadFavorites(),
      _loadUploadedSongsCount(),
      _loadDownloadedSongsCount(),
    ]);
  }

  Future<void> _checkLoginStatus() async {
    final isLoggedIn = await AuthService.isLoggedIn();
    if (mounted) {
      setState(() {
        _isLoggedIn = isLoggedIn;
        if (!isLoggedIn) {
          _clearUserScopedData();
        }
      });
    }
  }

  void _handleAuthChanged() {
    final isLoggedIn = AuthService.currentUserNotifier.value != null;
    if (!mounted) return;

    setState(() {
      _isLoggedIn = isLoggedIn;
      if (!isLoggedIn) {
        _clearUserScopedData();
      }
    });
  }

  void _clearUserScopedData() {
    _playlists = [];
    _favoriteSongs = [];
    _uploadedSongsCount = 0;
    _downloadedSongsCount = 0;
  }

  Future<void> _loadPlaylists() async {
    if (!_isLoggedIn) {
      if (mounted) {
        setState(() {
          _playlists = [];
        });
      }
      return;
    }

    final result = await PlaylistApiService.getPlaylists();

    if (mounted && result.success) {
      setState(() {
        _playlists = result.playlists ?? [];
      });
    }
  }

  Future<void> _loadRecentHistory() async {
    setState(() => _isLoadingHistory = true);

    final history = await PlayHistoryService.getRecentHistory(limit: 6);

    if (mounted) {
      setState(() {
        _isLoadingHistory = false;
        _recentHistory = history;
      });
    }
  }

  Future<void> _loadFavorites() async {
    if (!_isLoggedIn) {
      if (mounted) {
        setState(() {
          _favoriteSongs = [];
        });
      }
      return;
    }

    final result = await FavoriteService.getFavorites();

    if (mounted && result.success) {
      setState(() {
        _favoriteSongs = result.favorites ?? [];
      });
    }
  }

  Future<void> _loadUploadedSongsCount() async {
    if (!_isLoggedIn) {
      if (mounted) {
        setState(() {
          _uploadedSongsCount = 0;
        });
      }
      return;
    }

    final result = await SongApiService.getMyUploads();

    if (mounted && result.success) {
      setState(() {
        _uploadedSongsCount = result.songs.length;
      });
    }
  }

  Future<void> _loadDownloadedSongsCount() async {
    if (!_isLoggedIn) {
      if (mounted) {
        setState(() {
          _downloadedSongsCount = 0;
        });
      }
      return;
    }

    final count = await OfflineSongService().getDownloadedSongsCount();

    if (mounted) {
      setState(() {
        _downloadedSongsCount = count;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: RefreshIndicator(
        onRefresh: _loadData,
        color: theme.colorScheme.primary,
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverAppBar(
              backgroundColor: Colors.transparent,
              elevation: 0,
              floating: true,
              title: Text(
                'Thư viện',
                style: theme.textTheme.titleLarge?.copyWith(
                  fontSize: 24,
                  fontWeight: FontWeight.w900,
                ),
              ),
              actions: [
                IconButton(
                  icon: Icon(
                    Icons.settings_rounded,
                    color: isDark ? Colors.white : AppColors.lightTextPrimary,
                  ),
                  onPressed: _openSettings,
                  tooltip: 'Cài đặt',
                ),
              ],
            ),
            SliverToBoxAdapter(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: AppSpacing.sm),
                  _buildMenuSection(),
                  const SizedBox(height: AppSpacing.lg),
                  _buildRecentlyPlayedSection(),
                  const SizedBox(height: AppSpacing.lg),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMenuSection() {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    final items = [
      _MenuData(
        icon: Icons.favorite_rounded,
        color: AppColors.accentPink,
        title: 'Bài hát yêu thích',
        subtitle: _favoriteSongs.isNotEmpty ? '${_favoriteSongs.length} bài hát' : '0 bài hát',
        onTap: _openFavorites,
      ),
      _MenuData(
        icon: Icons.playlist_play_rounded,
        color: AppColors.secondary,
        title: 'Playlists',
        subtitle: _playlists.isNotEmpty ? '${_playlists.length} playlist' : '0 playlist',
        onTap: _openPlaylists,
      ),
      _MenuData(
        icon: Icons.cloud_upload_rounded,
        color: AppColors.primary,
        title: 'Bài hát của bạn',
        subtitle: _uploadedSongsCount > 0 ? '$_uploadedSongsCount bài hát' : '0 bài hát',
        onTap: _openYourUploads,
      ),
      _MenuData(
        icon: Icons.download_done_rounded,
        color: AppColors.secondary,
        title: 'Bài hát đã tải',
        subtitle: _downloadedSongsCount > 0 ? '$_downloadedSongsCount bài hát' : '0 bài hát',
        onTap: _openDownloadedSongs,
      ),
    ];

    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        crossAxisSpacing: AppSpacing.md,
        mainAxisSpacing: AppSpacing.md,
        childAspectRatio: 1.35,
      ),
      itemCount: items.length,
      itemBuilder: (context, index) {
        final item = items[index];
        return GestureDetector(
          onTap: item.onTap,
          child: Container(
            padding: const EdgeInsets.all(AppSpacing.md),
            decoration: BoxDecoration(
              color: isDark ? AppColors.darkSurfaceGlass : AppColors.lightSurfaceGlass,
              borderRadius: AppRadius.mediumBorder,
              border: Border.all(
                color: isDark ? AppColors.darkBorderGlass : AppColors.lightBorderGlass,
              ),
              boxShadow: isDark
                  ? [
                      BoxShadow(
                        color: item.color.withOpacity(0.04),
                        blurRadius: 10,
                        offset: const Offset(0, 4),
                      )
                    ]
                  : [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.02),
                        blurRadius: 8,
                        offset: const Offset(0, 4),
                      )
                    ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  padding: const EdgeInsets.all(AppSpacing.xs),
                  decoration: BoxDecoration(
                    color: item.color.withOpacity(0.12),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(item.icon, color: item.color, size: 24),
                ),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  item.title,
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                    fontSize: 14,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  item.subtitle,
                  style: TextStyle(
                    color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
                    fontSize: 11,
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildRecentlyPlayedSection() {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.xs),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  const Icon(
                    Icons.history_rounded,
                    color: AppColors.secondary,
                    size: 24,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    'Nghe gần đây',
                    style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                  ),
                ],
              ),
              TextButton(
                onPressed: _openFullHistory,
                child: Text(
                  'Xem tất cả',
                  style: TextStyle(color: isDark ? AppColors.secondary : AppColors.primary),
                ),
              ),
            ],
          ),
        ),

        if (_isLoadingHistory)
          const Center(
            child: Padding(
              padding: EdgeInsets.all(20),
              child: CircularProgressIndicator(color: AppColors.primary),
            ),
          )
        else if (_recentHistory.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: 12),
            child: Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: isDark ? AppColors.darkSurface : AppColors.lightSurface,
                borderRadius: AppRadius.mediumBorder,
              ),
              child: Row(
                children: [
                  Icon(Icons.music_note_rounded, color: theme.disabledColor, size: 36),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Text(
                      'Chưa có lịch sử phát nhạc.\nHãy phát một bài hát!',
                      style: TextStyle(
                        color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
                        fontSize: 13,
                        height: 1.4,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          )
        else
          SizedBox(
            height: 146,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
              itemCount: _recentHistory.length,
              itemBuilder: (context, index) {
                final song = _recentHistory[index];
                return GestureDetector(
                  onTap: () => widget.onSongTap?.call(song),
                  child: Container(
                    width: 100,
                    margin: const EdgeInsets.only(right: AppSpacing.md),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        ClipRRect(
                          borderRadius: AppRadius.smallBorder,
                          child: Stack(
                            children: [
                              Image.network(
                                song.imageUrl,
                                width: 100,
                                height: 100,
                                fit: BoxFit.cover,
                                errorBuilder: (_, __, ___) => Container(
                                  width: 100,
                                  height: 100,
                                  color: isDark ? AppColors.darkBorder : AppColors.lightBorder,
                                  child: const Icon(Icons.music_note_rounded, color: Colors.white24),
                                ),
                              ),
                              Positioned(
                                right: 6,
                                bottom: 6,
                                child: Container(
                                  padding: const EdgeInsets.all(4),
                                  decoration: const BoxDecoration(
                                    color: Colors.black54,
                                    shape: BoxShape.circle,
                                  ),
                                  child: const Icon(
                                    Icons.play_arrow_rounded,
                                    color: Colors.white,
                                    size: 14,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          song.title,
                          style: theme.textTheme.bodyMedium?.copyWith(
                            fontWeight: FontWeight.bold,
                            fontSize: 12,
                            color: isDark ? Colors.white : AppColors.lightTextPrimary,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        Text(
                          song.artists.join(', '),
                          style: TextStyle(
                            color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
                            fontSize: 10,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
      ],
    );
  }

  void _openFullHistory() async {
    final allHistory = await PlayHistoryService.getHistory();
    if (!mounted) return;

    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => HistoryScreen(
          history: allHistory,
          onSongTap: widget.onSongTap,
          onPlayAll: widget.onPlayAll,
        ),
      ),
    ).then((_) => _loadRecentHistory());
  }

  void _openSettings() {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => SettingsScreen(
          onLogout: () {
            _loadData();
          },
        ),
      ),
    ).then((_) => _loadData());
  }

  void _openYourUploads() {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => YourUploadsScreen(
          onSongTap: widget.onSongTap,
          onPlayAll: widget.onPlayAll,
        ),
      ),
    ).then((_) => _loadUploadedSongsCount());
  }

  void _openFavorites() {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => FavoritesScreen(
          onSongTap: widget.onSongTap,
          onPlayAll: widget.onPlayAll,
        ),
      ),
    ).then((_) => _loadFavorites());
  }

  void _openPlaylists() {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => PlaylistsScreen(
          onSongTap: widget.onSongTap,
          onPlayAll: widget.onPlayAll,
        ),
      ),
    ).then((_) => _loadPlaylists());
  }

  void _openDownloadedSongs() {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => DownloadedSongsScreen(
          onSongTap: widget.onSongTap,
          onPlayAll: widget.onPlayAll,
        ),
      ),
    ).then((_) => _loadDownloadedSongsCount());
  }
}
