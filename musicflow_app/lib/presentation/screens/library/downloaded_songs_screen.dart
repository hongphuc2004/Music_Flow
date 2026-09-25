import 'dart:math';
import 'package:flutter/material.dart';
import '../../widgets/music_flow_backdrop.dart';
import '../../../core/theme/app_theme.dart';
import '../../../data/models/song_model.dart';
import '../../../data/services/offline_song_service.dart';
import '../../widgets/mini_player_wrapper.dart';
import '../../widgets/song_options_menu.dart';
import '../../../core/audio/global_audio_state.dart';

class DownloadedSongsScreen extends StatefulWidget {
  final Function(Song)? onSongTap;
  final Function(List<Song>, {int startIndex})? onPlayAll;

  const DownloadedSongsScreen({super.key, this.onSongTap, this.onPlayAll});

  @override
  State<DownloadedSongsScreen> createState() => _DownloadedSongsScreenState();
}

class _DownloadedSongsScreenState extends State<DownloadedSongsScreen> {
  final OfflineSongService _offlineService = OfflineSongService();
  final GlobalAudioState _audioState = GlobalAudioState();

  List<Song> _downloadedSongs = [];
  bool _isLoading = false;
  String _searchQuery = '';
  final TextEditingController _searchController = TextEditingController();
  bool _isSearchVisible = false;

  @override
  void initState() {
    super.initState();
    _audioState.addListener(_onAudioStateChanged);
    _loadDownloadedSongs();
  }

  @override
  void dispose() {
    _audioState.removeListener(_onAudioStateChanged);
    _searchController.dispose();
    super.dispose();
  }

  void _onAudioStateChanged() {
    if (mounted) {
      setState(() {});
    }
  }

  Future<void> _loadDownloadedSongs() async {
    setState(() => _isLoading = true);
    final songs = await _offlineService.getDownloadedSongsAsSongs();
    if (!mounted) return;
    setState(() {
      _isLoading = false;
      _downloadedSongs = songs;
    });
  }

  List<Song> get _filteredSongs {
    if (_searchQuery.trim().isEmpty) return _downloadedSongs;
    final q = _searchQuery.trim().toLowerCase();
    return _downloadedSongs.where((s) {
      final titleMatch = s.title.toLowerCase().contains(q);
      final artistMatch = s.artists.any((a) => a.toLowerCase().contains(q));
      return titleMatch || artistMatch;
    }).toList();
  }

  String _formatTotalDuration(List<Song> songs) {
    double totalSeconds = 0;
    for (final s in songs) {
      if (s.duration != null) {
        totalSeconds += s.duration!;
      }
    }
    final minutes = (totalSeconds / 60).round();
    if (minutes >= 60) {
      final hours = minutes ~/ 60;
      final remMinutes = minutes % 60;
      return '$hours giờ $remMinutes phút';
    }
    return '$minutes phút';
  }

  String _formatDuration(double? seconds) {
    if (seconds == null || seconds <= 0) return '--:--';
    final m = (seconds ~/ 60).toString().padLeft(2, '0');
    final s = ((seconds % 60).toInt()).toString().padLeft(2, '0');
    return '$m:$s';
  }

  void _playSong(Song song, int index, List<Song> list) {
    if (widget.onPlayAll != null) {
      widget.onPlayAll!(list, startIndex: index);
    } else {
      widget.onSongTap?.call(song);
    }
  }

  void _playAll({bool shuffle = false}) {
    final list = _filteredSongs;
    if (list.isEmpty) return;

    if (shuffle) {
      final shuffled = List<Song>.from(list)..shuffle(Random());
      widget.onPlayAll?.call(shuffled, startIndex: 0);
    } else {
      widget.onPlayAll?.call(list, startIndex: 0);
    }
  }

  Future<void> _removeDownloadedSong(Song song) async {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: isDark ? const Color(0xFF1B162E) : Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            const Icon(Icons.delete_forever_rounded, color: Colors.redAccent, size: 22),
            const SizedBox(width: 8),
            Text(
              'Xóa bản tải về?',
              style: TextStyle(
                color: isDark ? Colors.white : AppColors.lightTextPrimary,
                fontWeight: FontWeight.bold,
                fontSize: 18,
              ),
            ),
          ],
        ),
        content: Text(
          'Bài hát "${song.title}" sẽ được gỡ khỏi bộ nhớ máy. Bạn vẫn có thể nghe trực tuyến khi có kết nối Internet.',
          style: TextStyle(
            color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
            fontSize: 13,
            height: 1.4,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(
              'Giữ lại',
              style: TextStyle(color: isDark ? Colors.white70 : Colors.black54),
            ),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.redAccent,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            ),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Xóa', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    await _offlineService.removeDownloadedSong(song.id);
    if (!mounted) return;

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Đã xóa "${song.title}" khỏi bộ nhớ máy'),
        duration: const Duration(seconds: 2),
        behavior: SnackBarBehavior.floating,
      ),
    );

    await _loadDownloadedSongs();
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
            'Bài hát đã tải',
            style: theme.textTheme.titleLarge?.copyWith(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: isDark ? Colors.white : AppColors.lightTextPrimary,
            ),
          ),
          actions: [
            if (_downloadedSongs.isNotEmpty) ...[
              IconButton(
                icon: Icon(
                  _isSearchVisible ? Icons.search_off_rounded : Icons.search_rounded,
                  color: isDark ? Colors.white70 : AppColors.lightTextSecondary,
                ),
                tooltip: 'Tìm bài hát',
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
              IconButton(
                icon: Icon(
                  Icons.refresh_rounded,
                  color: isDark ? Colors.white70 : AppColors.lightTextSecondary,
                ),
                tooltip: 'Làm mới',
                onPressed: _loadDownloadedSongs,
              ),
            ],
          ],
        ),
        body: MiniPlayerWrapper(
          child: _isLoading
              ? const Center(
                  child: CircularProgressIndicator(color: Color(0xFF10B981)),
                )
              : _downloadedSongs.isEmpty
                  ? _buildEmptyState()
                  : _buildContent(),
        ),
      ),
    );
  }

  Widget _buildContent() {
    final songs = _filteredSongs;

    return RefreshIndicator(
      onRefresh: _loadDownloadedSongs,
      color: const Color(0xFF10B981),
      child: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: [
          // Hero Header Card
          SliverToBoxAdapter(
            child: _buildHeroHeader(),
          ),

          // Search Bar if toggled
          if (_isSearchVisible)
            SliverToBoxAdapter(
              child: _buildSearchBar(),
            ),

          // Action Toolbar
          SliverToBoxAdapter(
            child: _buildActionBar(songs),
          ),

          // List of songs
          if (songs.isEmpty)
            SliverFillRemaining(
              hasScrollBody: false,
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.all(AppSpacing.xl),
                  child: Text(
                    'Không tìm thấy bài hát đã tải nào khớp với "$_searchQuery"',
                    style: const TextStyle(color: Colors.white54, fontSize: 14),
                    textAlign: TextAlign.center,
                  ),
                ),
              ),
            )
          else
            SliverPadding(
              padding: const EdgeInsets.only(bottom: 90),
              sliver: SliverList(
                delegate: SliverChildBuilderDelegate(
                  (context, index) {
                    final song = songs[index];
                    return _buildSongTile(song, index, songs);
                  },
                  childCount: songs.length,
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildHeroHeader() {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final totalDuration = _formatTotalDuration(_downloadedSongs);

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.sm),
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(24),
          gradient: LinearGradient(
            colors: isDark
                ? [
                    const Color(0xFF063327).withValues(alpha: 0.85),
                    const Color(0xFF0F1E2C).withValues(alpha: 0.95),
                  ]
                : [
                    const Color(0xFFE6FBF2),
                    const Color(0xFFE0F2FE),
                  ],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          border: Border.all(
            color: isDark
                ? const Color(0xFF10B981).withValues(alpha: 0.3)
                : const Color(0xFF10B981).withValues(alpha: 0.2),
          ),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF10B981).withValues(alpha: isDark ? 0.2 : 0.08),
              blurRadius: 20,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: Row(
          children: [
            // Artwork Container
            Container(
              width: 88,
              height: 88,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(20),
                gradient: const LinearGradient(
                  colors: [Color(0xFF10B981), AppColors.secondary],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF10B981).withValues(alpha: 0.4),
                    blurRadius: 16,
                    offset: const Offset(0, 6),
                  ),
                ],
              ),
              child: const Center(
                child: Icon(
                  Icons.download_done_rounded,
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
                      color: const Color(0xFF10B981).withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.offline_pin_rounded, color: Color(0xFF10B981), size: 12),
                        SizedBox(width: 4),
                        Text(
                          'NGOẠI TUYẾN / OFFLINE',
                          style: TextStyle(
                            color: Color(0xFF10B981),
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
                    'Bài hát đã tải',
                    style: theme.textTheme.titleLarge?.copyWith(
                      fontSize: 20,
                      fontWeight: FontWeight.w900,
                      color: isDark ? Colors.white : AppColors.lightTextPrimary,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Icon(
                        Icons.check_circle_rounded,
                        size: 14,
                        color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        '${_downloadedSongs.length} bài hát',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        '•',
                        style: TextStyle(
                          color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        totalDuration,
                        style: TextStyle(
                          fontSize: 12,
                          color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
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
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.xs),
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
            hintText: 'Tìm bài hát offline...',
            hintStyle: TextStyle(
              color: isDark ? AppColors.darkTextSecondary.withValues(alpha: 0.6) : AppColors.lightTextSecondary.withValues(alpha: 0.6),
              fontSize: 13,
            ),
            prefixIcon: const Icon(Icons.search_rounded, size: 20, color: Color(0xFF10B981)),
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

  Widget _buildActionBar(List<Song> songs) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isPlayingOffline = _audioState.isPlaying &&
        _audioState.currentSong != null &&
        songs.any((s) => s.id == _audioState.currentSong!.id);

    return Padding(
      padding: const EdgeInsets.fromLTRB(AppSpacing.md, AppSpacing.sm, AppSpacing.md, AppSpacing.xs),
      child: Row(
        children: [
          // Play All Button
          Container(
            height: 42,
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF10B981), AppColors.secondary],
              ),
              borderRadius: BorderRadius.circular(24),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFF10B981).withValues(alpha: 0.35),
                  blurRadius: 10,
                  offset: const Offset(0, 3),
                ),
              ],
            ),
            child: ElevatedButton.icon(
              onPressed: () {
                if (isPlayingOffline) {
                  _audioState.togglePlayPause();
                } else {
                  _playAll(shuffle: false);
                }
              },
              icon: Icon(
                isPlayingOffline ? Icons.pause_rounded : Icons.play_arrow_rounded,
                color: Colors.white,
                size: 20,
              ),
              label: Text(
                isPlayingOffline ? 'Tạm dừng' : 'Phát offline',
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.transparent,
                shadowColor: Colors.transparent,
                padding: const EdgeInsets.symmetric(horizontal: 18),
              ),
            ),
          ),
          const SizedBox(width: 10),

          // Shuffle Button
          Container(
            height: 42,
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF1B162E) : Colors.white,
              borderRadius: BorderRadius.circular(24),
              border: Border.all(
                color: isDark ? AppColors.darkBorder : AppColors.lightBorder,
              ),
            ),
            child: OutlinedButton.icon(
              onPressed: () => _playAll(shuffle: true),
              icon: const Icon(Icons.shuffle_rounded, size: 18, color: Color(0xFF10B981)),
              label: Text(
                'Trộn bài',
                style: TextStyle(
                  color: isDark ? Colors.white : AppColors.lightTextPrimary,
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
              style: OutlinedButton.styleFrom(
                side: BorderSide.none,
                padding: const EdgeInsets.symmetric(horizontal: 14),
              ),
            ),
          ),

          const Spacer(),

          Text(
            '${songs.length} bài',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSongTile(Song song, int index, List<Song> list) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final isCurrent = _audioState.currentSong?.id == song.id;
    final isPlaying = isCurrent && _audioState.isPlaying;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: 3),
      decoration: BoxDecoration(
        color: isCurrent
            ? (isDark ? const Color(0xFF10B981).withValues(alpha: 0.12) : const Color(0xFF10B981).withValues(alpha: 0.08))
            : Colors.transparent,
        borderRadius: BorderRadius.circular(16),
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
        leading: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Index or Equalizer
            SizedBox(
              width: 24,
              child: isCurrent
                  ? Icon(
                      isPlaying ? Icons.equalizer_rounded : Icons.pause_circle_filled_rounded,
                      color: const Color(0xFF10B981),
                      size: 20,
                    )
                  : Text(
                      '${index + 1}'.padLeft(2, '0'),
                      style: TextStyle(
                        color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
            ),
            const SizedBox(width: 8),

            // Artwork
            ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: Image.network(
                song.imageUrl,
                width: 48,
                height: 48,
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: isDark ? const Color(0xFF1B162E) : Colors.grey[200],
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.music_note_rounded, color: Color(0xFF10B981), size: 22),
                ),
              ),
            ),
          ],
        ),
        title: Text(
          song.title,
          style: theme.textTheme.titleMedium?.copyWith(
            fontSize: 14,
            fontWeight: isCurrent ? FontWeight.bold : FontWeight.w600,
            color: isCurrent
                ? const Color(0xFF10B981)
                : (isDark ? Colors.white : AppColors.lightTextPrimary),
          ),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        subtitle: Row(
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
              decoration: BoxDecoration(
                color: const Color(0xFF10B981).withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(4),
              ),
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.check_rounded, color: Color(0xFF10B981), size: 10),
                  SizedBox(width: 2),
                  Text(
                    'Offline',
                    style: TextStyle(color: Color(0xFF10B981), fontSize: 9, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 6),
            Expanded(
              child: Text(
                song.artists.join(', '),
                style: TextStyle(
                  color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
                  fontSize: 12,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            const SizedBox(width: 8),
            Text(
              _formatDuration(song.duration),
              style: TextStyle(
                color: isDark ? AppColors.darkTextSecondary.withValues(alpha: 0.7) : AppColors.lightTextSecondary.withValues(alpha: 0.7),
                fontSize: 11,
              ),
            ),
          ],
        ),
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            IconButton(
              icon: const Icon(Icons.delete_outline_rounded, color: Colors.redAccent, size: 20),
              tooltip: 'Xóa bài tải',
              onPressed: () => _removeDownloadedSong(song),
            ),
            SongOptionsMenu(song: song),
          ],
        ),
        onTap: () => _playSong(song, index, list),
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
              width: 104,
              height: 104,
              decoration: BoxDecoration(
                color: const Color(0xFF10B981).withValues(alpha: 0.1),
                shape: BoxShape.circle,
                border: Border.all(
                  color: const Color(0xFF10B981).withValues(alpha: 0.3),
                  width: 2,
                ),
              ),
              child: const Center(
                child: Icon(
                  Icons.cloud_download_outlined,
                  size: 52,
                  color: Color(0xFF10B981),
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            Text(
              'Chưa có bài hát tải về',
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
                fontSize: 18,
                color: isDark ? Colors.white : AppColors.lightTextPrimary,
              ),
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              'Tải nhạc ngoại tuyến để có thể nghe ngay cả khi đi máy bay hoặc mất kết nối mạng Internet.',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
                fontSize: 13,
                height: 1.4,
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            ElevatedButton.icon(
              onPressed: () => Navigator.pop(context),
              icon: const Icon(Icons.explore_rounded, size: 18),
              label: const Text('Khám phá và tải nhạc', style: TextStyle(fontWeight: FontWeight.bold)),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
                padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 12),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
