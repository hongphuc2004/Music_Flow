import 'package:flutter/material.dart';
import '../../widgets/music_flow_backdrop.dart';
import '../../../core/theme/app_theme.dart';
import 'package:musicflow_app/data/models/song_model.dart';
import 'package:musicflow_app/data/models/playlist_model.dart';
import 'package:musicflow_app/data/services/playlist_api_service.dart';
import 'package:musicflow_app/data/services/auth_service.dart';
import 'package:musicflow_app/presentation/screens/library/playlist_detail_screen.dart';
import 'package:musicflow_app/presentation/screens/login/login_screen.dart';
import 'package:musicflow_app/presentation/widgets/mini_player_wrapper.dart';
import 'package:musicflow_app/core/audio/global_audio_state.dart';

class PlaylistsScreen extends StatefulWidget {
  final Function(Song)? onSongTap;
  final Function(List<Song>, {int startIndex})? onPlayAll;

  const PlaylistsScreen({super.key, this.onSongTap, this.onPlayAll});

  @override
  State<PlaylistsScreen> createState() => _PlaylistsScreenState();
}

class _PlaylistsScreenState extends State<PlaylistsScreen> {
  final GlobalAudioState _audioState = GlobalAudioState();
  List<Playlist> _playlists = [];
  bool _isLoading = false;
  bool _isLoggedIn = false;
  String _searchQuery = '';
  final TextEditingController _searchController = TextEditingController();
  bool _isSearchVisible = false;

  @override
  void initState() {
    super.initState();
    _loadData();
    _audioState.addListener(_onAudioChanged);
  }

  @override
  void dispose() {
    _searchController.dispose();
    _audioState.removeListener(_onAudioChanged);
    super.dispose();
  }

  void _onAudioChanged() {
    if (mounted) setState(() {});
  }

  Future<void> _loadData() async {
    await _checkLoginStatus();
    if (_isLoggedIn) {
      await _loadPlaylists();
    }
  }

  Future<void> _checkLoginStatus() async {
    final isLoggedIn = await AuthService.isLoggedIn();
    if (mounted) {
      setState(() => _isLoggedIn = isLoggedIn);
    }
  }

  Future<void> _loadPlaylists() async {
    setState(() => _isLoading = true);

    final result = await PlaylistApiService.getPlaylists();

    if (mounted) {
      setState(() {
        _isLoading = false;
        if (result.success) {
          _playlists = result.playlists ?? [];
        }
      });
    }
  }

  List<Playlist> get _filteredPlaylists {
    if (_searchQuery.trim().isEmpty) return _playlists;
    final q = _searchQuery.toLowerCase();
    return _playlists
        .where((p) => p.name.toLowerCase().contains(q) || p.description.toLowerCase().contains(q))
        .toList();
  }

  int get _totalSongsCount {
    return _playlists.fold(0, (sum, p) => sum + p.songCount);
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
            icon: Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: (isDark ? Colors.black : Colors.white).withValues(alpha: 0.3),
                shape: BoxShape.circle,
              ),
              child: Icon(
                Icons.arrow_back_ios_new_rounded,
                color: isDark ? Colors.white : AppColors.lightTextPrimary,
                size: 16,
              ),
            ),
            onPressed: () => Navigator.pop(context),
          ),
          title: Text(
            'Playlist của bạn',
            style: theme.textTheme.titleLarge?.copyWith(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: isDark ? Colors.white : AppColors.lightTextPrimary,
            ),
          ),
          actions: [
            if (_isLoggedIn && _playlists.isNotEmpty)
              IconButton(
                icon: Icon(
                  _isSearchVisible ? Icons.search_off_rounded : Icons.search_rounded,
                  color: isDark ? Colors.white70 : AppColors.lightTextSecondary,
                ),
                tooltip: 'Tìm kiếm playlist',
                onPressed: () {
                  setState(() {
                    _isSearchVisible = !_isSearchVisible;
                    if (!_isSearchVisible) {
                      _searchQuery = '';
                      _searchController.clear();
                    }
                  });
                },
              ),
            if (_isLoggedIn)
              Container(
                margin: const EdgeInsets.only(right: 12),
                child: IconButton(
                  icon: Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [AppColors.primary, AppColors.secondary],
                      ),
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.primary.withValues(alpha: 0.4),
                          blurRadius: 8,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: const Icon(Icons.add_rounded, color: Colors.white, size: 20),
                  ),
                  onPressed: _showCreatePlaylistDialog,
                  tooltip: 'Tạo playlist mới',
                ),
              ),
          ],
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
        child: CircularProgressIndicator(color: AppColors.primary),
      );
    }

    if (_playlists.isEmpty) {
      return _buildEmptyState();
    }

    final playlists = _filteredPlaylists;

    return RefreshIndicator(
      onRefresh: _loadPlaylists,
      color: AppColors.primary,
      child: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: [
          // Hero Header Card
          SliverToBoxAdapter(
            child: _buildHeroHeader(),
          ),

          // Search bar if toggled
          if (_isSearchVisible)
            SliverToBoxAdapter(
              child: _buildSearchBar(),
            ),

          // Quick Action Bar
          SliverToBoxAdapter(
            child: _buildActionBar(playlists),
          ),

          // Playlists List
          if (playlists.isEmpty)
            SliverFillRemaining(
              hasScrollBody: false,
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.all(AppSpacing.xl),
                  child: Text(
                    'Không tìm thấy playlist phù hợp với "$_searchQuery"',
                    style: const TextStyle(color: Colors.white54, fontSize: 14),
                    textAlign: TextAlign.center,
                  ),
                ),
              ),
            )
          else
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(AppSpacing.md, 0, AppSpacing.md, 24),
              sliver: SliverList(
                delegate: SliverChildBuilderDelegate(
                  (context, index) {
                    final playlist = playlists[index];
                    return _buildPlaylistCard(playlist, index);
                  },
                  childCount: playlists.length,
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildHeroHeader() {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.sm),
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(24),
          gradient: LinearGradient(
            colors: isDark
                ? [
                    const Color(0xFF2E134D).withValues(alpha: 0.9),
                    const Color(0xFF122344).withValues(alpha: 0.95),
                  ]
                : [
                    const Color(0xFFEDE9FE),
                    const Color(0xFFE0F7FA),
                  ],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          border: Border.all(
            color: isDark
                ? AppColors.primary.withValues(alpha: 0.3)
                : AppColors.primary.withValues(alpha: 0.2),
          ),
          boxShadow: [
            BoxShadow(
              color: AppColors.primary.withValues(alpha: isDark ? 0.25 : 0.08),
              blurRadius: 20,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: Row(
          children: [
            // Glowing Artwork Box
            Container(
              width: 88,
              height: 88,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(20),
                gradient: const LinearGradient(
                  colors: [AppColors.primary, AppColors.secondary],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.primary.withValues(alpha: 0.4),
                    blurRadius: 16,
                    offset: const Offset(0, 6),
                  ),
                ],
              ),
              child: const Center(
                child: Icon(
                  Icons.queue_music_rounded,
                  color: Colors.white,
                  size: 46,
                ),
              ),
            ),
            const SizedBox(width: AppSpacing.md),

            // Metadata info
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: AppColors.primary.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.library_music_rounded, color: AppColors.primary, size: 12),
                        SizedBox(width: 4),
                        Text(
                          'PLAYLIST CÁ NHÂN',
                          style: TextStyle(
                            color: AppColors.primary,
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 0.8,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Bộ sưu tập của bạn',
                    style: TextStyle(
                      color: isDark ? Colors.white : AppColors.lightTextPrimary,
                      fontWeight: FontWeight.bold,
                      fontSize: 18,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Text(
                        '${_playlists.length} playlist',
                        style: TextStyle(
                          color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      const SizedBox(width: 6),
                      Text('•', style: TextStyle(color: isDark ? Colors.white38 : Colors.black38)),
                      const SizedBox(width: 6),
                      Text(
                        '$_totalSongsCount bài hát',
                        style: TextStyle(
                          color: isDark ? AppColors.secondary : AppColors.primary,
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSearchBar() {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Padding(
      padding: const EdgeInsets.fromLTRB(AppSpacing.md, AppSpacing.xs, AppSpacing.md, AppSpacing.sm),
      child: Container(
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF1B162E) : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isDark ? AppColors.darkBorder : AppColors.lightBorder,
          ),
        ),
        child: TextField(
          controller: _searchController,
          autofocus: true,
          style: TextStyle(color: isDark ? Colors.white : AppColors.lightTextPrimary, fontSize: 14),
          decoration: InputDecoration(
            hintText: 'Tìm playlist theo tên...',
            hintStyle: TextStyle(
              color: isDark
                  ? AppColors.darkTextSecondary.withValues(alpha: 0.6)
                  : AppColors.lightTextSecondary.withValues(alpha: 0.6),
              fontSize: 13,
            ),
            prefixIcon: const Icon(Icons.search_rounded, size: 20, color: AppColors.primary),
            suffixIcon: _searchQuery.isNotEmpty
                ? IconButton(
                    icon: const Icon(Icons.clear_rounded, size: 18),
                    onPressed: () {
                      setState(() {
                        _searchQuery = '';
                        _searchController.clear();
                      });
                    },
                  )
                : null,
            border: InputBorder.none,
            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          ),
          onChanged: (val) {
            setState(() => _searchQuery = val);
          },
        ),
      ),
    );
  }

  Widget _buildActionBar(List<Playlist> playlists) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Padding(
      padding: const EdgeInsets.fromLTRB(AppSpacing.md, AppSpacing.xs, AppSpacing.md, AppSpacing.sm),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            'TẤT CẢ PLAYLIST (${playlists.length})',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.bold,
              letterSpacing: 0.8,
              color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
            ),
          ),
          InkWell(
            onTap: _showCreatePlaylistDialog,
            borderRadius: BorderRadius.circular(16),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.primary.withValues(alpha: 0.3)),
              ),
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.add_rounded, size: 14, color: AppColors.primary),
                  SizedBox(width: 4),
                  Text(
                    'Tạo mới',
                    style: TextStyle(
                      color: AppColors.primary,
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
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

  Widget _buildPlaylistCard(Playlist playlist, int index) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isPlayingAnyFromPlaylist = _audioState.isPlaying &&
        _audioState.currentSong != null &&
        playlist.songs.any((s) => s.id == _audioState.currentSong!.id);

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF18132A).withValues(alpha: 0.8) : Colors.white.withValues(alpha: 0.9),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: isPlayingAnyFromPlaylist
              ? AppColors.primary.withValues(alpha: 0.6)
              : (isDark ? AppColors.darkBorder.withValues(alpha: 0.5) : AppColors.lightBorder),
          width: isPlayingAnyFromPlaylist ? 1.5 : 1.0,
        ),
        boxShadow: [
          BoxShadow(
            color: isPlayingAnyFromPlaylist
                ? AppColors.primary.withValues(alpha: 0.15)
                : Colors.black.withValues(alpha: isDark ? 0.2 : 0.04),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(18),
          onTap: () => _openPlaylistDetail(playlist),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                // Cover Artwork
                Hero(
                  tag: 'playlist_cover_${playlist.id}',
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(14),
                    child: Container(
                      width: 64,
                      height: 64,
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [
                            AppColors.primary.withValues(alpha: 0.7),
                            AppColors.secondary.withValues(alpha: 0.7),
                          ],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                      ),
                      child: Stack(
                        fit: StackFit.expand,
                        children: [
                          if (playlist.displayCoverImage.isNotEmpty)
                            Image.network(
                              playlist.displayCoverImage,
                              fit: BoxFit.cover,
                              errorBuilder: (_, __, ___) => _buildFallbackCover(),
                            )
                          else
                            _buildFallbackCover(),

                          if (isPlayingAnyFromPlaylist)
                            Container(
                              color: Colors.black.withValues(alpha: 0.45),
                              child: const Center(
                                child: Icon(
                                  Icons.graphic_eq_rounded,
                                  color: AppColors.secondary,
                                  size: 26,
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 14),

                // Name & song count
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        playlist.name,
                        style: TextStyle(
                          color: isPlayingAnyFromPlaylist
                              ? (isDark ? AppColors.secondary : AppColors.primary)
                              : (isDark ? Colors.white : AppColors.lightTextPrimary),
                          fontWeight: FontWeight.bold,
                          fontSize: 15,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 5),
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.08),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              '${playlist.songCount} bài hát',
                              style: TextStyle(
                                color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                          if (playlist.description.isNotEmpty) ...[
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                playlist.description,
                                style: TextStyle(
                                  color: isDark ? Colors.white38 : Colors.black38,
                                  fontSize: 11,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ],
                  ),
                ),

                // Quick Play button
                if (playlist.songs.isNotEmpty)
                  IconButton(
                    icon: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: AppColors.primary.withValues(alpha: 0.15),
                        shape: BoxShape.circle,
                      ),
                      child: Icon(
                        isPlayingAnyFromPlaylist ? Icons.pause_rounded : Icons.play_arrow_rounded,
                        color: AppColors.primary,
                        size: 20,
                      ),
                    ),
                    onPressed: () {
                      if (isPlayingAnyFromPlaylist) {
                        _audioState.togglePlayPause();
                      } else {
                        widget.onPlayAll?.call(playlist.songs, startIndex: 0);
                      }
                    },
                    tooltip: isPlayingAnyFromPlaylist ? 'Tạm dừng' : 'Phát playlist',
                  ),

                // More options menu
                IconButton(
                  icon: Icon(
                    Icons.more_vert_rounded,
                    color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
                    size: 20,
                  ),
                  onPressed: () => _showPlaylistOptions(playlist),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildFallbackCover() {
    return const Center(
      child: Icon(
        Icons.queue_music_rounded,
        color: Colors.white70,
        size: 28,
      ),
    );
  }

  Widget _buildLoginPrompt() {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 96,
              height: 96,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [AppColors.primary, AppColors.secondary],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color: AppColors.primary.withValues(alpha: 0.4),
                    blurRadius: 20,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: const Icon(
                Icons.lock_rounded,
                size: 46,
                color: Colors.white,
              ),
            ),
            const SizedBox(height: 24),
            Text(
              'Đăng nhập để xem playlist',
              style: TextStyle(
                color: isDark ? Colors.white : AppColors.lightTextPrimary,
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              'Tạo và quản lý các danh sách bài hát yêu thích mang đậm phong cách riêng của bạn',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
                fontSize: 13,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 28),
            ElevatedButton(
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const LoginScreen()),
                ).then((_) => _loadData());
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 36, vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(25)),
                elevation: 6,
              ),
              child: const Text('Đăng nhập ngay', style: TextStyle(fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyState() {
    final isDark = Theme.of(context).brightness == Brightness.dark;

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
                color: AppColors.primary.withValues(alpha: 0.12),
                shape: BoxShape.circle,
                border: Border.all(color: AppColors.primary.withValues(alpha: 0.3)),
              ),
              child: const Icon(
                Icons.playlist_add_rounded,
                size: 52,
                color: AppColors.primary,
              ),
            ),
            const SizedBox(height: 24),
            Text(
              'Chưa có playlist nào',
              style: TextStyle(
                color: isDark ? Colors.white : AppColors.lightTextPrimary,
                fontSize: 20,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Tạo playlist riêng để sắp xếp những bài hát bạn yêu thích theo chủ đề hoặc tâm trạng',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
                fontSize: 14,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 28),
            Container(
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [AppColors.primary, AppColors.secondary],
                ),
                borderRadius: BorderRadius.circular(24),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.primary.withValues(alpha: 0.4),
                    blurRadius: 16,
                    offset: const Offset(0, 6),
                  ),
                ],
              ),
              child: ElevatedButton.icon(
                onPressed: _showCreatePlaylistDialog,
                icon: const Icon(Icons.add_rounded, color: Colors.white),
                label: const Text(
                  'Tạo playlist đầu tiên',
                  style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.transparent,
                  shadowColor: Colors.transparent,
                  padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _openPlaylistDetail(Playlist playlist) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => PlaylistDetailScreen(
          playlist: playlist,
          onSongTap: widget.onSongTap,
          onPlayAll: widget.onPlayAll,
        ),
      ),
    ).then((_) => _loadPlaylists());
  }

  void _showPlaylistOptions(Playlist playlist) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    showModalBottomSheet(
      context: context,
      backgroundColor: isDark ? const Color(0xFF1E1736) : Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 44,
              height: 4,
              margin: const EdgeInsets.symmetric(vertical: 12),
              decoration: BoxDecoration(
                color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.2),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            // Playlist Header
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
              child: Row(
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: Container(
                      width: 52,
                      height: 52,
                      decoration: const BoxDecoration(
                        gradient: LinearGradient(
                          colors: [AppColors.primary, AppColors.secondary],
                        ),
                      ),
                      child: playlist.displayCoverImage.isNotEmpty
                          ? Image.network(playlist.displayCoverImage, fit: BoxFit.cover)
                          : const Icon(Icons.queue_music, color: Colors.white70),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          playlist.name,
                          style: TextStyle(
                            color: isDark ? Colors.white : AppColors.lightTextPrimary,
                            fontWeight: FontWeight.bold,
                            fontSize: 16,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '${playlist.songCount} bài hát',
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
            ),
            Divider(
              color: isDark ? AppColors.darkBorder : AppColors.lightBorder,
              height: 1,
            ),
            if (playlist.songs.isNotEmpty)
              ListTile(
                leading: const Icon(Icons.play_circle_fill_rounded, color: AppColors.primary),
                title: Text(
                  'Phát playlist này',
                  style: TextStyle(
                    color: isDark ? Colors.white : AppColors.lightTextPrimary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                onTap: () {
                  Navigator.pop(context);
                  widget.onPlayAll?.call(playlist.songs, startIndex: 0);
                },
              ),
            ListTile(
              leading: Icon(
                Icons.edit_rounded,
                color: isDark ? Colors.white70 : AppColors.lightTextSecondary,
              ),
              title: Text(
                'Đổi tên playlist',
                style: TextStyle(color: isDark ? Colors.white : AppColors.lightTextPrimary),
              ),
              onTap: () {
                Navigator.pop(context);
                _showRenamePlaylistDialog(playlist);
              },
            ),
            ListTile(
              leading: const Icon(Icons.delete_outline_rounded, color: Colors.redAccent),
              title: const Text(
                'Xóa playlist',
                style: TextStyle(color: Colors.redAccent, fontWeight: FontWeight.w600),
              ),
              onTap: () {
                Navigator.pop(context);
                _confirmDeletePlaylist(playlist);
              },
            ),
            const SizedBox(height: 12),
          ],
        ),
      ),
    );
  }

  void _showRenamePlaylistDialog(Playlist playlist) {
    final controller = TextEditingController(text: playlist.name);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: isDark ? const Color(0xFF1E1736) : Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
        title: Text(
          'Đổi tên playlist',
          style: TextStyle(
            color: isDark ? Colors.white : AppColors.lightTextPrimary,
            fontWeight: FontWeight.bold,
          ),
        ),
        content: TextField(
          controller: controller,
          autofocus: true,
          style: TextStyle(color: isDark ? Colors.white : AppColors.lightTextPrimary),
          decoration: InputDecoration(
            hintText: 'Nhập tên mới...',
            hintStyle: TextStyle(
              color: isDark ? Colors.white38 : Colors.black38,
            ),
            filled: true,
            fillColor: isDark ? const Color(0xFF120E24) : const Color(0xFFF3F4F6),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: BorderSide.none,
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(
              'Hủy',
              style: TextStyle(
                color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
              ),
            ),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            ),
            onPressed: () async {
              if (controller.text.trim().isEmpty) return;
              Navigator.pop(context);

              final result = await PlaylistApiService.updatePlaylist(
                playlistId: playlist.id,
                name: controller.text.trim(),
              );

              if (result.success) {
                _loadPlaylists();
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Đã cập nhật tên playlist'),
                      behavior: SnackBarBehavior.floating,
                    ),
                  );
                }
              }
            },
            child: const Text('Lưu thay đổi', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  void _confirmDeletePlaylist(Playlist playlist) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: isDark ? const Color(0xFF1E1736) : Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
        title: Text(
          'Xóa playlist?',
          style: TextStyle(
            color: isDark ? Colors.white : AppColors.lightTextPrimary,
            fontWeight: FontWeight.bold,
          ),
        ),
        content: Text(
          'Bạn có chắc muốn xóa playlist "${playlist.name}"?\nHành động này không thể hoàn tác.',
          style: TextStyle(
            color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
            height: 1.4,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(
              'Hủy',
              style: TextStyle(
                color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
              ),
            ),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.redAccent,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            ),
            onPressed: () async {
              Navigator.pop(context);

              final result = await PlaylistApiService.deletePlaylist(playlist.id);

              if (result.success) {
                _loadPlaylists();
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Đã xóa playlist thành công'),
                      behavior: SnackBarBehavior.floating,
                    ),
                  );
                }
              }
            },
            child: const Text('Xóa', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  void _showCreatePlaylistDialog() {
    final controller = TextEditingController();
    final isDark = Theme.of(context).brightness == Brightness.dark;

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: isDark ? const Color(0xFF1E1736) : Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
        title: Text(
          'Tạo playlist mới',
          style: TextStyle(
            color: isDark ? Colors.white : AppColors.lightTextPrimary,
            fontWeight: FontWeight.bold,
          ),
        ),
        content: TextField(
          controller: controller,
          autofocus: true,
          style: TextStyle(color: isDark ? Colors.white : AppColors.lightTextPrimary),
          decoration: InputDecoration(
            hintText: 'Nhập tên playlist...',
            hintStyle: TextStyle(
              color: isDark ? Colors.white38 : Colors.black38,
            ),
            filled: true,
            fillColor: isDark ? const Color(0xFF120E24) : const Color(0xFFF3F4F6),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: BorderSide.none,
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(
              'Hủy',
              style: TextStyle(
                color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
              ),
            ),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            ),
            onPressed: () async {
              if (controller.text.trim().isEmpty) return;
              Navigator.pop(context);

              final result = await PlaylistApiService.createPlaylist(
                name: controller.text.trim(),
              );

              if (result.success) {
                _loadPlaylists();
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('Đã tạo playlist "${controller.text.trim()}"'),
                      behavior: SnackBarBehavior.floating,
                    ),
                  );
                }
              } else {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(result.message ?? 'Tạo playlist thất bại'),
                      backgroundColor: Colors.redAccent,
                      behavior: SnackBarBehavior.floating,
                    ),
                  );
                }
              }
            },
            child: const Text('Tạo playlist', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }
}
