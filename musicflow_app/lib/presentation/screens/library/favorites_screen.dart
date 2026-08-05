import 'package:flutter/material.dart';
import '../../widgets/music_flow_backdrop.dart';
import '../../../core/theme/app_theme.dart';
import '../../../data/models/song_model.dart';
import '../../../data/services/favorite_service.dart';
import '../../../data/services/auth_service.dart';
import '../../widgets/song_options_menu.dart';
import '../../widgets/mini_player_wrapper.dart';
import '../login/login_screen.dart';

class FavoritesScreen extends StatefulWidget {
  final Function(Song)? onSongTap;
  final Function(List<Song>, {int startIndex})? onPlayAll;

  const FavoritesScreen({super.key, this.onSongTap, this.onPlayAll});

  @override
  State<FavoritesScreen> createState() => _FavoritesScreenState();
}

class _FavoritesScreenState extends State<FavoritesScreen> {
  List<Song> _favoriteSongs = [];
  bool _isLoading = false;
  bool _isLoggedIn = false;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    await _checkLoginStatus();
    if (_isLoggedIn) {
      await _loadFavorites();
    }
  }

  Future<void> _checkLoginStatus() async {
    final isLoggedIn = await AuthService.isLoggedIn();
    if (mounted) {
      setState(() => _isLoggedIn = isLoggedIn);
    }
  }

  Future<void> _loadFavorites() async {
    setState(() => _isLoading = true);
    final result = await FavoriteService.getFavorites();
    if (mounted) {
      setState(() {
        _isLoading = false;
        if (result.success) {
          _favoriteSongs = result.favorites ?? [];
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return MusicFlowBackdrop(
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: AppBar(
          backgroundColor: Colors.transparent,
          elevation: 0,
          leading: IconButton(
            icon: Icon(
              Icons.arrow_back_ios_new_rounded,
              color: isDark ? Colors.white : AppColors.lightTextPrimary,
              size: 20,
            ),
            onPressed: () => Navigator.pop(context),
          ),
          title: Text(
            'Bài hát yêu thích',
            style: theme.textTheme.titleLarge?.copyWith(fontSize: 18),
          ),
        ),
        body: MiniPlayerWrapper(child: _buildBody()),
      ),
    );
  }

  Widget _buildBody() {
    if (!_isLoggedIn) {
      return _buildLoginPrompt();
    }

    if (_isLoading) {
      return const Center(
        child: CircularProgressIndicator(color: AppColors.accentPink),
      );
    }

    if (_favoriteSongs.isEmpty) {
      return _buildEmptyState();
    }

    return RefreshIndicator(
      onRefresh: _loadFavorites,
      color: AppColors.accentPink,
      child: Column(
        children: [
          // Play all button
          Padding(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: Row(
              children: [
                Expanded(
                  child: Container(
                    height: 44,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [AppColors.primary, AppColors.secondary],
                      ),
                      borderRadius: AppRadius.smallBorder,
                      boxShadow: AppShadows.neonGlow(AppColors.primary),
                    ),
                    child: ElevatedButton.icon(
                      onPressed: () => widget.onPlayAll?.call(_favoriteSongs, startIndex: 0),
                      icon: const Icon(Icons.play_arrow_rounded, color: Colors.white),
                      label: const Text(
                        'Phát tất cả',
                        style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.transparent,
                        shadowColor: Colors.transparent,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.only(bottom: 24),
              itemCount: _favoriteSongs.length,
              itemBuilder: (context, index) {
                final song = _favoriteSongs[index];
                return _buildSongTile(song, index);
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLoginPrompt() {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.favorite_rounded,
              size: 64,
              color: AppColors.accentPink.withOpacity(0.4),
            ),
            const SizedBox(height: AppSpacing.md),
            Text(
              'Yêu cầu đăng nhập',
              style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              'Đăng nhập để xem danh sách bài hát đã yêu thích của bạn',
              textAlign: TextAlign.center,
              style: TextStyle(color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary),
            ),
            const SizedBox(height: AppSpacing.lg),
            ElevatedButton(
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (context) => const LoginScreen()),
                ).then((_) => _loadData());
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: AppRadius.badgeBorder),
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl, vertical: AppSpacing.sm),
              ),
              child: const Text('Đăng nhập'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyState() {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 100,
              height: 100,
              decoration: BoxDecoration(
                color: isDark ? Colors.white.withOpacity(0.03) : Colors.black.withOpacity(0.02),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.favorite_outline_rounded,
                size: 48,
                color: AppColors.accentPink,
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            Text(
              'Chưa có bài hát yêu thích',
              style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              'Nhấn vào biểu tượng ❤️ trên bài hát\nđể thêm vào danh sách yêu thích',
              textAlign: TextAlign.center,
              style: TextStyle(color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary, fontSize: 13),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSongTile(Song song, int index) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: 2),
      leading: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox(
            width: 24,
            child: Text(
              '${index + 1}',
              style: TextStyle(
                color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
                fontSize: 13,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.xs),
          ClipRRect(
            borderRadius: BorderRadius.circular(AppRadius.small),
            child: Image.network(
              song.imageUrl,
              width: 48,
              height: 48,
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => Container(
                width: 48,
                height: 48,
                color: isDark ? AppColors.darkBorder : AppColors.lightBorder,
                child: const Icon(Icons.favorite_rounded, color: AppColors.accentPink, size: 20),
              ),
            ),
          ),
        ],
      ),
      title: Text(
        song.title,
        style: theme.textTheme.titleMedium?.copyWith(
          fontSize: 14,
          fontWeight: FontWeight.w600,
        ),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
      subtitle: Text(
        song.artists.join(', '),
        style: TextStyle(
          color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
          fontSize: 12,
        ),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
      trailing: SongOptionsMenu(song: song, onFavoriteChanged: _loadFavorites),
      onTap: () => widget.onSongTap?.call(song),
    );
  }
}
