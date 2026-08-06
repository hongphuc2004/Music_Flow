import 'package:flutter/material.dart';
import '../../widgets/music_flow_backdrop.dart';
import '../../../core/theme/app_theme.dart';
import '../../../data/models/song_model.dart';
import '../../../data/services/offline_song_service.dart';
import '../../widgets/mini_player_wrapper.dart';

class DownloadedSongsScreen extends StatefulWidget {
  final Function(Song)? onSongTap;
  final Function(List<Song>, {int startIndex})? onPlayAll;

  const DownloadedSongsScreen({super.key, this.onSongTap, this.onPlayAll});

  @override
  State<DownloadedSongsScreen> createState() => _DownloadedSongsScreenState();
}

class _DownloadedSongsScreenState extends State<DownloadedSongsScreen> {
  final OfflineSongService _offlineService = OfflineSongService();

  List<Song> _downloadedSongs = [];
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _loadDownloadedSongs();
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

  Future<void> _removeDownloadedSong(Song song) async {
    await _offlineService.removeDownloadedSong(song.id);
    if (!mounted) return;

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Đã xóa bài hát tải về: ${song.title}'),
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
            style: theme.textTheme.titleLarge?.copyWith(fontSize: 18),
          ),
        ),
        body: MiniPlayerWrapper(
          child: _isLoading
              ? const Center(
                  child: CircularProgressIndicator(color: AppColors.primary),
                )
              : _downloadedSongs.isEmpty
                  ? _buildEmptyState()
                  : RefreshIndicator(
                      onRefresh: _loadDownloadedSongs,
                      color: AppColors.primary,
                      child: Column(
                        children: [
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
                                      onPressed: () {
                                        widget.onPlayAll?.call(
                                          _downloadedSongs,
                                          startIndex: 0,
                                        );
                                      },
                                      icon: const Icon(Icons.play_arrow_rounded, color: Colors.white),
                                      label: Text(
                                        'Phát tất cả (${_downloadedSongs.length})',
                                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
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
                              itemCount: _downloadedSongs.length,
                              itemBuilder: (context, index) {
                                final song = _downloadedSongs[index];
                                return _buildSongTile(song, index);
                              },
                            ),
                          ),
                        ],
                      ),
                    ),
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
                Icons.download_for_offline_outlined,
                size: 48,
                color: AppColors.secondary,
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            Text(
              'Không có nhạc tải xuống',
              style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              'Bạn có thể tải nhạc offline để thưởng thức\nngay cả khi không kết nối mạng',
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
                child: const Icon(Icons.download_done_rounded, color: AppColors.secondary, size: 20),
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
      trailing: IconButton(
        icon: const Icon(Icons.delete_outline_rounded, color: AppColors.accentPink),
        onPressed: () => _removeDownloadedSong(song),
        tooltip: 'Xóa bản tải xuống',
      ),
      onTap: () => widget.onSongTap?.call(song),
    );
  }
}
