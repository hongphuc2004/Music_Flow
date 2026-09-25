import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:musicflow_app/core/config/api_config.dart';
import '../../widgets/music_flow_backdrop.dart';

import '../../../core/theme/app_theme.dart';
import 'package:musicflow_app/data/models/song_model.dart';
import 'package:musicflow_app/data/models/playlist_model.dart';
import 'package:musicflow_app/data/services/playlist_api_service.dart';
import 'package:musicflow_app/presentation/widgets/song_options_menu.dart';
import 'package:musicflow_app/presentation/widgets/mini_player_wrapper.dart';
import 'package:musicflow_app/core/audio/global_audio_state.dart';

class PlaylistDetailScreen extends StatefulWidget {
  final Playlist playlist;
  final Function(Song)? onSongTap;
  final Function(List<Song>, {int startIndex})? onPlayAll;

  const PlaylistDetailScreen({
    super.key,
    required this.playlist,
    this.onSongTap,
    this.onPlayAll,
  });

  @override
  State<PlaylistDetailScreen> createState() => _PlaylistDetailScreenState();
}

class _PlaylistDetailScreenState extends State<PlaylistDetailScreen> {
  late Playlist _playlist;
  bool _isLoading = false;
  final GlobalAudioState _audioState = GlobalAudioState();
  String _searchQuery = '';
  final TextEditingController _searchController = TextEditingController();
  bool _isSearchVisible = false;

  @override
  void initState() {
    super.initState();
    _playlist = widget.playlist;
    _audioState.addListener(_onAudioStateChanged);
    _refreshPlaylist();
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

  Future<void> _refreshPlaylist() async {
    setState(() => _isLoading = true);

    final result = await PlaylistApiService.getPlaylist(_playlist.id);

    if (mounted) {
      setState(() {
        _isLoading = false;
        if (result.success && result.playlist != null) {
          _playlist = result.playlist!;
        }
      });
    }
  }

  List<Song> get _filteredSongs {
    if (_searchQuery.trim().isEmpty) return _playlist.songs;
    final q = _searchQuery.trim().toLowerCase();
    return _playlist.songs.where((s) {
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

  void _playSong(Song song, int index, List<Song> list) {
    if (widget.onPlayAll != null) {
      widget.onPlayAll!(list, startIndex: index);
    } else {
      widget.onSongTap?.call(song);
    }
  }

  Future<void> _removeSong(Song song) async {
    final result = await PlaylistApiService.removeSongFromPlaylist(
      playlistId: _playlist.id,
      songId: song.id,
    );

    if (result.success) {
      _refreshPlaylist();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Đã xóa "${song.title}" khỏi playlist'),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final songs = _filteredSongs;
    final totalDuration = _formatTotalDuration(_playlist.songs);
    final isPlayingPlaylist = _audioState.isPlaying &&
        _audioState.currentSong != null &&
        _playlist.songs.any((s) => s.id == _audioState.currentSong!.id);

    return MusicFlowBackdrop(
      child: Scaffold(
        backgroundColor: Colors.transparent,
        body: MiniPlayerWrapper(
          child: RefreshIndicator(
              onRefresh: _refreshPlaylist,
              color: AppColors.primary,
              child: CustomScrollView(
                slivers: [
                  // App Bar with cover image
                  SliverAppBar(
                    expandedHeight: 320,
                    pinned: true,
                    backgroundColor: isDark ? AppColors.darkBackground : AppColors.lightBackground,
                    elevation: 0,
                    leading: IconButton(
                      icon: Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: (isDark ? Colors.black : Colors.white).withValues(alpha: 0.4),
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          Icons.arrow_back_ios_new_rounded,
                          color: isDark ? Colors.white : AppColors.lightTextPrimary,
                          size: 18,
                        ),
                      ),
                      onPressed: () => Navigator.pop(context),
                    ),
                    actions: [
                      if (_playlist.songs.isNotEmpty)
                        Container(
                          margin: const EdgeInsets.only(right: 6),
                          decoration: BoxDecoration(
                            color: (isDark ? Colors.black : Colors.white).withValues(alpha: 0.4),
                            shape: BoxShape.circle,
                          ),
                          child: IconButton(
                            icon: Icon(
                              _isSearchVisible ? Icons.search_off_rounded : Icons.search_rounded,
                              color: isDark ? Colors.white : AppColors.lightTextPrimary,
                              size: 20,
                            ),
                            tooltip: 'Tìm kiếm bài hát',
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
                        ),
                      Container(
                        margin: const EdgeInsets.only(right: 8),
                        decoration: BoxDecoration(
                          color: (isDark ? Colors.black : Colors.white).withValues(alpha: 0.4),
                          shape: BoxShape.circle,
                        ),
                        child: IconButton(
                          icon: Icon(
                            Icons.more_vert_rounded,
                            color: isDark ? Colors.white : AppColors.lightTextPrimary,
                            size: 20,
                          ),
                          onPressed: _showPlaylistOptions,
                        ),
                      ),
                    ],
                    flexibleSpace: FlexibleSpaceBar(
                      background: Stack(
                        fit: StackFit.expand,
                        children: [
                          if (_playlist.displayCoverImage.isNotEmpty)
                            Image.network(_playlist.displayCoverImage, fit: BoxFit.cover)
                          else
                            _buildDefaultCover(),
                          // Gradient overlay
                          Container(
                            decoration: BoxDecoration(
                              gradient: LinearGradient(
                                begin: Alignment.topCenter,
                                end: Alignment.bottomCenter,
                                colors: [
                                  Colors.transparent,
                                  (isDark ? AppColors.darkBackground : AppColors.lightBackground).withValues(alpha: 0.6),
                                  isDark ? AppColors.darkBackground : AppColors.lightBackground,
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),

                  // Header details
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.xs),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _playlist.name,
                            style: theme.textTheme.displayLarge?.copyWith(
                              fontSize: 26,
                              fontWeight: FontWeight.w900,
                              color: isDark ? Colors.white : AppColors.lightTextPrimary,
                            ),
                          ),
                          if (_playlist.description.isNotEmpty) ...[
                            const SizedBox(height: 6),
                            Text(
                              _playlist.description,
                              style: TextStyle(
                                color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
                                fontSize: 13,
                                height: 1.4,
                              ),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                          const SizedBox(height: 8),
                          Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                decoration: BoxDecoration(
                                  color: AppColors.primary.withValues(alpha: 0.15),
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: const Text(
                                  'PLAYLIST',
                                  style: TextStyle(
                                    color: AppColors.primary,
                                    fontWeight: FontWeight.bold,
                                    fontSize: 10,
                                    letterSpacing: 0.8,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Icon(Icons.music_note_rounded, size: 14, color: isDark ? Colors.white54 : Colors.black45),
                              const SizedBox(width: 4),
                              Text(
                                '${_playlist.songs.length} bài hát',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
                                ),
                              ),
                              const SizedBox(width: 8),
                              Text('•', style: TextStyle(color: isDark ? Colors.white38 : Colors.black38)),
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
                          const SizedBox(height: AppSpacing.md),

                          // Action Toolbar (Play / Shuffle)
                          Row(
                            children: [
                              // Play all main button
                              Container(
                                height: 42,
                                decoration: BoxDecoration(
                                  gradient: const LinearGradient(
                                    colors: [AppColors.primary, AppColors.secondary],
                                  ),
                                  borderRadius: BorderRadius.circular(24),
                                  boxShadow: [
                                    BoxShadow(
                                      color: AppColors.primary.withValues(alpha: 0.35),
                                      blurRadius: 10,
                                      offset: const Offset(0, 3),
                                    ),
                                  ],
                                ),
                                child: ElevatedButton.icon(
                                  onPressed: _playlist.songs.isNotEmpty
                                      ? () {
                                          if (isPlayingPlaylist) {
                                            _audioState.togglePlayPause();
                                          } else {
                                            _playAll(shuffle: false);
                                          }
                                        }
                                      : null,
                                  icon: Icon(
                                    isPlayingPlaylist ? Icons.pause_rounded : Icons.play_arrow_rounded,
                                    color: Colors.white,
                                    size: 20,
                                  ),
                                  label: Text(
                                    isPlayingPlaylist ? 'Tạm dừng' : 'Phát tất cả',
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

                              // Shuffle button
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
                                  onPressed: _playlist.songs.isNotEmpty
                                      ? () => _playAll(shuffle: true)
                                      : null,
                                  icon: const Icon(Icons.shuffle_rounded, size: 18, color: AppColors.secondary),
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
                        ],
                      ),
                    ),
                  ),

                  // Search Bar if toggled
                  if (_isSearchVisible)
                    SliverToBoxAdapter(
                      child: Padding(
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
                              hintText: 'Tìm kiếm trong playlist này...',
                              hintStyle: TextStyle(
                                color: isDark ? AppColors.darkTextSecondary.withValues(alpha: 0.6) : AppColors.lightTextSecondary.withValues(alpha: 0.6),
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
                      ),
                    ),

                  // Song list
                  if (_isLoading)
                    const SliverToBoxAdapter(
                      child: Center(
                        child: Padding(
                          padding: EdgeInsets.all(40),
                          child: CircularProgressIndicator(
                            color: AppColors.primary,
                          ),
                        ),
                      ),
                    )
                  else if (_playlist.songs.isEmpty)
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.all(40),
                        child: Column(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(20),
                              decoration: BoxDecoration(
                                color: isDark ? Colors.white.withValues(alpha: 0.04) : Colors.black.withValues(alpha: 0.03),
                                shape: BoxShape.circle,
                              ),
                              child: Icon(
                                Icons.queue_music_rounded,
                                color: isDark ? Colors.white38 : Colors.black38,
                                size: 56,
                              ),
                            ),
                            const SizedBox(height: 16),
                            Text(
                              'Playlist hiện chưa có bài hát',
                              style: TextStyle(
                                color: isDark ? Colors.white : AppColors.lightTextPrimary,
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              'Thêm bài hát vào playlist này bằng cách nhấn nút 3 chấm trên bài hát bất kỳ',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
                                fontSize: 13,
                              ),
                            ),
                          ],
                        ),
                      ),
                    )
                  else if (songs.isEmpty)
                    SliverFillRemaining(
                      hasScrollBody: false,
                      child: Center(
                        child: Padding(
                          padding: const EdgeInsets.all(AppSpacing.xl),
                          child: Text(
                            'Không tìm thấy bài hát khớp với "$_searchQuery"',
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
                        delegate: SliverChildBuilderDelegate((context, index) {
                          final song = songs[index];
                          return _buildSongTile(song, index, songs);
                        }, childCount: songs.length),
                      ),
                    ),
                ],
              ),
          ),
        ),
      ),
    );
  }

  Widget _buildDefaultCover() {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [Color(0xFF4C1D95), Color(0xFF1E1B4B)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: const Center(
        child: Icon(Icons.queue_music_rounded, color: Colors.white30, size: 90),
      ),
    );
  }

  Widget _buildSongTile(Song song, int index, List<Song> list) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final isCurrent = _audioState.currentSong?.id == song.id;
    final isPlaying = isCurrent && _audioState.isPlaying;

    return Dismissible(
      key: Key('${song.id}_$index'),
      direction: DismissDirection.endToStart,
      background: Container(
        margin: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: 3),
        decoration: BoxDecoration(
          color: Colors.redAccent.withValues(alpha: 0.25),
          borderRadius: BorderRadius.circular(16),
        ),
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 20),
        child: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.delete_rounded, color: Colors.redAccent, size: 20),
            SizedBox(width: 6),
            Text('Xóa khỏi playlist', style: TextStyle(color: Colors.redAccent, fontWeight: FontWeight.bold, fontSize: 12)),
          ],
        ),
      ),
      confirmDismiss: (direction) async {
        return await showDialog<bool>(
              context: context,
              builder: (context) => AlertDialog(
                backgroundColor: isDark ? const Color(0xFF1B162E) : Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                title: Text(
                  'Xóa bài hát?',
                  style: TextStyle(
                    color: isDark ? Colors.white : AppColors.lightTextPrimary,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                content: Text(
                  'Xóa bài hát "${song.title}" khỏi playlist "${_playlist.name}"?',
                  style: TextStyle(
                    color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
                  ),
                ),
                actions: [
                  TextButton(
                    onPressed: () => Navigator.pop(context, false),
                    child: Text('Hủy', style: TextStyle(color: isDark ? Colors.white70 : Colors.black54)),
                  ),
                  ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.redAccent,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    ),
                    onPressed: () => Navigator.pop(context, true),
                    child: const Text('Xóa', style: TextStyle(fontWeight: FontWeight.bold)),
                  ),
                ],
              ),
            ) ??
            false;
      },
      onDismissed: (_) => _removeSong(song),
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: 3),
        decoration: BoxDecoration(
          color: isCurrent
              ? (isDark ? AppColors.primary.withValues(alpha: 0.12) : AppColors.primary.withValues(alpha: 0.08))
              : Colors.transparent,
          borderRadius: BorderRadius.circular(16),
        ),
        child: ListTile(
          contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
          leading: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              SizedBox(
                width: 24,
                child: isCurrent
                    ? Icon(
                        isPlaying ? Icons.equalizer_rounded : Icons.pause_circle_filled_rounded,
                        color: AppColors.primary,
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
                    child: const Icon(Icons.music_note_rounded, color: AppColors.primary, size: 22),
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
                  ? AppColors.primary
                  : (isDark ? Colors.white : AppColors.lightTextPrimary),
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          subtitle: Row(
            children: [
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
          trailing: SongOptionsMenu(
            song: song,
            currentPlaylistId: _playlist.id,
            onRemovedFromPlaylist: _refreshPlaylist,
          ),
          onTap: () => _playSong(song, index, list),
        ),
      ),
    );
  }

  void _showPlaylistOptions() {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    showModalBottomSheet(
      context: context,
      backgroundColor: isDark ? const Color(0xFF1B162E) : Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) => Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 40,
            height: 4,
            margin: const EdgeInsets.symmetric(vertical: 12),
            decoration: BoxDecoration(
              color: isDark ? Colors.white30 : Colors.black26,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          ListTile(
            leading: Icon(Icons.edit_rounded, color: isDark ? Colors.white70 : Colors.black87),
            title: Text(
              'Chỉnh sửa thông tin playlist',
              style: TextStyle(color: isDark ? Colors.white : AppColors.lightTextPrimary, fontWeight: FontWeight.w600),
            ),
            onTap: () {
              Navigator.pop(context);
              _showEditDialog();
            },
          ),
          ListTile(
            leading: Icon(Icons.share_rounded, color: isDark ? Colors.white70 : Colors.black87),
            title: Text(
              'Sao chép liên kết chia sẻ',
              style: TextStyle(color: isDark ? Colors.white : AppColors.lightTextPrimary, fontWeight: FontWeight.w600),
            ),
            onTap: () {
              Navigator.pop(context);
              final plUrl = '${ApiConfig.webBaseUrl}/client/playlists/${widget.playlist.id}';
              Clipboard.setData(ClipboardData(text: plUrl));
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('Đã sao chép liên kết playlist vào bộ nhớ tạm!'),
                  behavior: SnackBarBehavior.floating,
                  duration: Duration(seconds: 2),
                ),
              );
            },
          ),
          ListTile(
            leading: const Icon(Icons.delete_outline_rounded, color: Colors.redAccent),
            title: const Text(
              'Xóa playlist này',
              style: TextStyle(color: Colors.redAccent, fontWeight: FontWeight.w600),
            ),
            onTap: () {
              Navigator.pop(context);
              _confirmDelete();
            },
          ),
          const SizedBox(height: 20),
        ],
      ),
    );
  }

  void _showEditDialog() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final nameController = TextEditingController(text: _playlist.name);
    final descController = TextEditingController(text: _playlist.description);

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: isDark ? const Color(0xFF1B162E) : Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text(
          'Chỉnh sửa playlist',
          style: TextStyle(
            color: isDark ? Colors.white : AppColors.lightTextPrimary,
            fontWeight: FontWeight.bold,
          ),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: nameController,
              style: TextStyle(color: isDark ? Colors.white : AppColors.lightTextPrimary),
              decoration: InputDecoration(
                labelText: 'Tên playlist',
                labelStyle: TextStyle(color: isDark ? Colors.white70 : Colors.black54),
                focusedBorder: const UnderlineInputBorder(
                  borderSide: BorderSide(color: AppColors.primary, width: 2),
                ),
              ),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: descController,
              style: TextStyle(color: isDark ? Colors.white : AppColors.lightTextPrimary),
              maxLines: 2,
              decoration: InputDecoration(
                labelText: 'Mô tả (tùy chọn)',
                labelStyle: TextStyle(color: isDark ? Colors.white70 : Colors.black54),
                focusedBorder: const UnderlineInputBorder(
                  borderSide: BorderSide(color: AppColors.primary, width: 2),
                ),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text('Hủy', style: TextStyle(color: isDark ? Colors.white70 : Colors.black54)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            ),
            onPressed: () async {
              if (nameController.text.trim().isEmpty) return;
              Navigator.pop(context);

              final result = await PlaylistApiService.updatePlaylist(
                playlistId: _playlist.id,
                name: nameController.text.trim(),
                description: descController.text.trim(),
              );

              if (result.success && result.playlist != null) {
                setState(() {
                  _playlist = result.playlist!;
                });
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Đã cập nhật thông tin playlist'),
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

  void _confirmDelete() {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: isDark ? const Color(0xFF1B162E) : Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text(
          'Xóa playlist?',
          style: TextStyle(
            color: isDark ? Colors.white : AppColors.lightTextPrimary,
            fontWeight: FontWeight.bold,
          ),
        ),
        content: Text(
          'Bạn có chắc chắn muốn xóa playlist "${_playlist.name}"?\nHành động này không thể hoàn tác.',
          style: TextStyle(
            color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text('Hủy', style: TextStyle(color: isDark ? Colors.white70 : Colors.black54)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.redAccent,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            ),
            onPressed: () async {
              Navigator.pop(context);

              final result = await PlaylistApiService.deletePlaylist(
                _playlist.id,
              );

              if (result.success) {
                if (mounted) {
                  Navigator.pop(context); // Return to library
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
}
