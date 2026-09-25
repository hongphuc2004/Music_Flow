import 'dart:io';
import 'dart:math';
import 'package:flutter/material.dart';
import '../../widgets/music_flow_backdrop.dart';
import '../../../core/theme/app_theme.dart';
import '../../../data/models/song_model.dart';
import '../../../data/services/song_api_service.dart';
import '../../../data/services/topic_api_service.dart';
import '../../../data/models/topic_model.dart';
import '../../../presentation/widgets/mini_player_wrapper.dart';
import 'package:file_picker/file_picker.dart';
import 'package:musicflow_app/core/audio/global_audio_state.dart';

class YourUploadsScreen extends StatefulWidget {
  final Function(Song)? onSongTap;
  final Function(List<Song>, {int startIndex})? onPlayAll;

  const YourUploadsScreen({super.key, this.onSongTap, this.onPlayAll});

  @override
  State<YourUploadsScreen> createState() => _YourUploadsScreenState();
}

class _YourUploadsScreenState extends State<YourUploadsScreen> {
  final GlobalAudioState _audioState = GlobalAudioState();
  List<Song> _uploadedSongs = [];
  bool _isLoading = false;
  String _searchQuery = '';
  final TextEditingController _searchController = TextEditingController();
  bool _isSearchVisible = false;

  @override
  void initState() {
    super.initState();
    _loadUploadedSongs();
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

  Future<void> _loadUploadedSongs() async {
    setState(() => _isLoading = true);

    final result = await SongApiService.getMyUploads();

    if (mounted) {
      setState(() {
        _isLoading = false;
        if (result.success) {
          _uploadedSongs = result.songs;
        }
      });
    }
  }

  List<Song> get _filteredSongs {
    if (_searchQuery.trim().isEmpty) return _uploadedSongs;
    final q = _searchQuery.toLowerCase();
    return _uploadedSongs
        .where((s) => s.title.toLowerCase().contains(q) || s.artists.any((a) => a.toLowerCase().contains(q)))
        .toList();
  }

  int get _publicCount => _uploadedSongs.where((s) => s.isPublic).length;
  int get _privateCount => _uploadedSongs.where((s) => !s.isPublic).length;

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

  Future<void> _togglePublic(Song song) async {
    final result = await SongApiService.togglePublic(song.id);

    if (result.success) {
      _showSnackBar(result.message);
      _loadUploadedSongs();
    } else {
      _showSnackBar(result.message, isError: true);
    }
  }

  Future<void> _deleteSong(Song song) async {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: isDark ? const Color(0xFF1E1736) : Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
        title: Text(
          'Xóa bài hát?',
          style: TextStyle(
            color: isDark ? Colors.white : AppColors.lightTextPrimary,
            fontWeight: FontWeight.bold,
          ),
        ),
        content: Text(
          'Bạn có chắc muốn xóa "${song.title}"?\nHành động này không thể hoàn tác.',
          style: TextStyle(
            color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
            height: 1.4,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(
              'Hủy',
              style: TextStyle(color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary),
            ),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.redAccent,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            ),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Xóa bài hát', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );

    if (confirm == true) {
      final result = await SongApiService.deleteSong(song.id);
      _showSnackBar(result.message, isError: !result.success);
      if (result.success) {
        _loadUploadedSongs();
      }
    }
  }

  void _showEditDialog(Song song) {
    final titleController = TextEditingController(text: song.title);
    final artistController = TextEditingController(
      text: song.artists.join(', '),
    );
    final lyricsController = TextEditingController(text: song.lyrics);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: isDark ? const Color(0xFF1E1736) : Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        title: Text(
          'Chỉnh sửa bài hát',
          style: TextStyle(
            color: isDark ? Colors.white : AppColors.lightTextPrimary,
            fontWeight: FontWeight.bold,
          ),
        ),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: titleController,
                style: TextStyle(color: isDark ? Colors.white : AppColors.lightTextPrimary),
                decoration: InputDecoration(
                  labelText: 'Tên bài hát',
                  labelStyle: TextStyle(
                    color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
                  ),
                  filled: true,
                  fillColor: isDark ? const Color(0xFF120E24) : const Color(0xFFF3F4F6),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
                  ),
                ),
              ),
              const SizedBox(height: 14),
              TextField(
                controller: artistController,
                style: TextStyle(color: isDark ? Colors.white : AppColors.lightTextPrimary),
                decoration: InputDecoration(
                  labelText: 'Nghệ sĩ thể hiện',
                  labelStyle: TextStyle(
                    color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
                  ),
                  filled: true,
                  fillColor: isDark ? const Color(0xFF120E24) : const Color(0xFFF3F4F6),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
                  ),
                ),
              ),
              const SizedBox(height: 14),
              TextField(
                controller: lyricsController,
                style: TextStyle(color: isDark ? Colors.white : AppColors.lightTextPrimary),
                maxLines: 4,
                decoration: InputDecoration(
                  labelText: 'Lời bài hát',
                  labelStyle: TextStyle(
                    color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
                  ),
                  filled: true,
                  fillColor: isDark ? const Color(0xFF120E24) : const Color(0xFFF3F4F6),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
                  ),
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(
              'Hủy',
              style: TextStyle(color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary),
            ),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            ),
            onPressed: () async {
              Navigator.pop(context);
              final result = await SongApiService.updateSong(
                songId: song.id,
                title: titleController.text.trim(),
                artist: artistController.text.trim(),
                lyrics: lyricsController.text.trim(),
              );
              _showSnackBar(result.message, isError: !result.success);
              if (result.success) {
                _loadUploadedSongs();
              }
            },
            child: const Text('Lưu thay đổi', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  void _showSongOptions(Song song) {
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
            // Header Info
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
                          colors: [AppColors.secondary, AppColors.primary],
                        ),
                      ),
                      child: song.imageUrl.isNotEmpty
                          ? Image.network(song.imageUrl, fit: BoxFit.cover, errorBuilder: (_, __, ___) => const Icon(Icons.music_note, color: Colors.white70))
                          : const Icon(Icons.music_note, color: Colors.white70),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          song.title,
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
                          song.artists.isNotEmpty ? song.artists.join(', ') : 'Bạn tải lên',
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
            Divider(color: isDark ? AppColors.darkBorder : AppColors.lightBorder, height: 1),

            ListTile(
              leading: Icon(
                song.isPublic ? Icons.lock_outline_rounded : Icons.public_rounded,
                color: song.isPublic ? AppColors.primary : AppColors.secondary,
              ),
              title: Text(
                song.isPublic ? 'Chuyển sang riêng tư' : 'Công khai bài hát',
                style: TextStyle(
                  color: isDark ? Colors.white : AppColors.lightTextPrimary,
                  fontWeight: FontWeight.w600,
                ),
              ),
              subtitle: Text(
                song.isPublic ? 'Chỉ riêng bạn mới thấy và nghe bài này' : 'Mọi người đều có thể tìm thấy và nghe',
                style: TextStyle(
                  color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
                  fontSize: 12,
                ),
              ),
              onTap: () {
                Navigator.pop(context);
                _togglePublic(song);
              },
            ),
            ListTile(
              leading: Icon(
                Icons.edit_rounded,
                color: isDark ? Colors.white70 : AppColors.lightTextSecondary,
              ),
              title: Text(
                'Sửa thông tin',
                style: TextStyle(color: isDark ? Colors.white : AppColors.lightTextPrimary),
              ),
              onTap: () {
                Navigator.pop(context);
                _showEditDialog(song);
              },
            ),
            ListTile(
              leading: const Icon(Icons.delete_outline_rounded, color: Colors.redAccent),
              title: const Text(
                'Xóa bài hát',
                style: TextStyle(color: Colors.redAccent, fontWeight: FontWeight.w600),
              ),
              onTap: () {
                Navigator.pop(context);
                _deleteSong(song);
              },
            ),
            const SizedBox(height: 12),
          ],
        ),
      ),
    );
  }

  void _showSnackBar(String message, {bool isError = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError ? Colors.redAccent : AppColors.primary,
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  Future<void> _startUpload() async {
    final result = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => const _UploadBottomSheet(),
    );

    if (result == true) {
      _loadUploadedSongs();
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
            'Bài hát của bạn',
            style: theme.textTheme.titleLarge?.copyWith(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: isDark ? Colors.white : AppColors.lightTextPrimary,
            ),
          ),
          actions: [
            if (_uploadedSongs.isNotEmpty)
              IconButton(
                icon: Icon(
                  _isSearchVisible ? Icons.search_off_rounded : Icons.search_rounded,
                  color: isDark ? Colors.white70 : AppColors.lightTextSecondary,
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
            Container(
              margin: const EdgeInsets.only(right: 12),
              child: IconButton(
                icon: Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [AppColors.secondary, AppColors.primary],
                    ),
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.secondary.withValues(alpha: 0.4),
                        blurRadius: 8,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: const Icon(Icons.upload_rounded, color: Colors.white, size: 20),
                ),
                onPressed: _startUpload,
                tooltip: 'Upload bài hát mới',
              ),
            ),
          ],
        ),
        body: MiniPlayerWrapper(
          child: _isLoading
              ? const Center(
                  child: CircularProgressIndicator(color: AppColors.primary),
                )
              : _uploadedSongs.isEmpty
              ? _buildEmptyState()
              : _buildSongList(),
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
                color: AppColors.secondary.withValues(alpha: 0.12),
                shape: BoxShape.circle,
                border: Border.all(color: AppColors.secondary.withValues(alpha: 0.3)),
              ),
              child: const Icon(
                Icons.cloud_upload_rounded,
                size: 52,
                color: AppColors.secondary,
              ),
            ),
            const SizedBox(height: 24),
            Text(
              'Chưa có bài hát nào',
              style: TextStyle(
                color: isDark ? Colors.white : AppColors.lightTextPrimary,
                fontSize: 20,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Tải lên các bài hát từ thiết bị của bạn\nđể thưởng thức âm nhạc mọi lúc mọi nơi',
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
                  colors: [AppColors.secondary, AppColors.primary],
                ),
                borderRadius: BorderRadius.circular(24),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.secondary.withValues(alpha: 0.4),
                    blurRadius: 16,
                    offset: const Offset(0, 6),
                  ),
                ],
              ),
              child: ElevatedButton.icon(
                onPressed: _startUpload,
                icon: const Icon(Icons.upload_rounded, color: Colors.white),
                label: const Text(
                  'Tải lên bài hát đầu tiên',
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

  Widget _buildSongList() {
    final songs = _filteredSongs;

    return RefreshIndicator(
      onRefresh: _loadUploadedSongs,
      color: AppColors.secondary,
      child: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: [
          // Hero Header Card
          SliverToBoxAdapter(
            child: _buildHeroHeader(),
          ),

          // Search bar if active
          if (_isSearchVisible)
            SliverToBoxAdapter(
              child: _buildSearchBar(),
            ),

          // Action toolbar
          SliverToBoxAdapter(
            child: _buildActionBar(songs),
          ),

          // Song List or empty search
          if (songs.isEmpty)
            SliverFillRemaining(
              hasScrollBody: false,
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.all(AppSpacing.xl),
                  child: Text(
                    'Không tìm thấy bài hát phù hợp với "$_searchQuery"',
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
                    const Color(0xFF0C2B3F).withValues(alpha: 0.9),
                    const Color(0xFF261244).withValues(alpha: 0.95),
                  ]
                : [
                    const Color(0xFFE0F7FA),
                    const Color(0xFFEDE9FE),
                  ],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          border: Border.all(
            color: isDark
                ? AppColors.secondary.withValues(alpha: 0.3)
                : AppColors.secondary.withValues(alpha: 0.2),
          ),
          boxShadow: [
            BoxShadow(
              color: AppColors.secondary.withValues(alpha: isDark ? 0.2 : 0.08),
              blurRadius: 20,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: Row(
          children: [
            // Glowing Artwork Container
            Container(
              width: 88,
              height: 88,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(20),
                gradient: const LinearGradient(
                  colors: [AppColors.secondary, AppColors.primary],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.secondary.withValues(alpha: 0.4),
                    blurRadius: 16,
                    offset: const Offset(0, 6),
                  ),
                ],
              ),
              child: const Center(
                child: Icon(
                  Icons.cloud_done_rounded,
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
                      color: AppColors.secondary.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.verified_user_rounded, color: AppColors.secondary, size: 12),
                        SizedBox(width: 4),
                        Text(
                          'KHO NHẠC TẢI LÊN',
                          style: TextStyle(
                            color: AppColors.secondary,
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
                        '${_uploadedSongs.length} bài hát',
                        style: TextStyle(
                          color: isDark ? Colors.white70 : Colors.black87,
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(width: 6),
                      Text('•', style: TextStyle(color: isDark ? Colors.white38 : Colors.black38)),
                      const SizedBox(width: 6),
                      Text(
                        '$_publicCount công khai',
                        style: const TextStyle(
                          color: AppColors.secondary,
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      const SizedBox(width: 6),
                      Text('•', style: TextStyle(color: isDark ? Colors.white38 : Colors.black38)),
                      const SizedBox(width: 6),
                      Text(
                        '$_privateCount riêng tư',
                        style: const TextStyle(
                          color: AppColors.primary,
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
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
            hintText: 'Tìm bài hát theo tên hoặc nghệ sĩ...',
            hintStyle: TextStyle(
              color: isDark
                  ? AppColors.darkTextSecondary.withValues(alpha: 0.6)
                  : AppColors.lightTextSecondary.withValues(alpha: 0.6),
              fontSize: 13,
            ),
            prefixIcon: const Icon(Icons.search_rounded, size: 20, color: AppColors.secondary),
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

    return Padding(
      padding: const EdgeInsets.fromLTRB(AppSpacing.md, AppSpacing.sm, AppSpacing.md, AppSpacing.md),
      child: Row(
        children: [
          // Play all button with signature gradient
          Expanded(
            child: Container(
              height: 48,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [AppColors.primary, AppColors.secondary],
                ),
                borderRadius: BorderRadius.circular(24),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.primary.withValues(alpha: 0.35),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: ElevatedButton.icon(
                onPressed: songs.isNotEmpty ? () => _playAll(shuffle: false) : null,
                icon: const Icon(Icons.play_arrow_rounded, color: Colors.white, size: 24),
                label: Text(
                  'Phát tất cả (${songs.length})',
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 14,
                  ),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.transparent,
                  shadowColor: Colors.transparent,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
                ),
              ),
            ),
          ),
          const SizedBox(width: 10),

          // Shuffle pill button
          Container(
            height: 48,
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF1B162E) : Colors.white,
              borderRadius: BorderRadius.circular(24),
              border: Border.all(
                color: isDark ? AppColors.darkBorder : AppColors.lightBorder,
              ),
            ),
            child: OutlinedButton.icon(
              onPressed: songs.isNotEmpty ? () => _playAll(shuffle: true) : null,
              icon: const Icon(Icons.shuffle_rounded, size: 18, color: AppColors.secondary),
              label: Text(
                'Trộn',
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
        ],
      ),
    );
  }

  Widget _buildSongTile(Song song, int index, List<Song> playlist) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isPlayingCurrent = _audioState.isPlaying &&
        _audioState.currentSong != null &&
        _audioState.currentSong!.id == song.id;

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: isDark
            ? (isPlayingCurrent ? AppColors.primary.withValues(alpha: 0.12) : const Color(0xFF18132A).withValues(alpha: 0.7))
            : (isPlayingCurrent ? AppColors.primary.withValues(alpha: 0.08) : Colors.white.withValues(alpha: 0.85)),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isPlayingCurrent
              ? AppColors.secondary.withValues(alpha: 0.6)
              : (isDark ? AppColors.darkBorder.withValues(alpha: 0.5) : AppColors.lightBorder),
          width: isPlayingCurrent ? 1.5 : 1.0,
        ),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: () {
            if (isPlayingCurrent) {
              _audioState.togglePlayPause();
            } else {
              widget.onPlayAll?.call(playlist, startIndex: index);
            }
          },
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            child: Row(
              children: [
                // Track number or playing equalizer
                SizedBox(
                  width: 24,
                  child: Center(
                    child: isPlayingCurrent
                        ? const Icon(Icons.graphic_eq_rounded, color: AppColors.secondary, size: 18)
                        : Text(
                            '${index + 1}',
                            style: TextStyle(
                              color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                  ),
                ),
                const SizedBox(width: 8),

                // Cover Artwork with public/private overlay badge
                Stack(
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(12),
                      child: Container(
                        width: 50,
                        height: 50,
                        decoration: const BoxDecoration(
                          gradient: LinearGradient(
                            colors: [AppColors.secondary, AppColors.primary],
                          ),
                        ),
                        child: song.imageUrl.isNotEmpty
                            ? Image.network(
                                song.imageUrl,
                                fit: BoxFit.cover,
                                errorBuilder: (_, __, ___) => const Center(
                                  child: Icon(Icons.music_note, color: Colors.white70, size: 24),
                                ),
                              )
                            : const Center(
                                child: Icon(Icons.music_note, color: Colors.white70, size: 24),
                              ),
                      ),
                    ),
                    Positioned(
                      right: 2,
                      bottom: 2,
                      child: Container(
                        padding: const EdgeInsets.all(3),
                        decoration: BoxDecoration(
                          color: song.isPublic ? AppColors.secondary : AppColors.primary,
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          song.isPublic ? Icons.public : Icons.lock,
                          size: 10,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(width: 14),

                // Title, Artist and Status badge
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        song.title,
                        style: TextStyle(
                          color: isPlayingCurrent
                              ? (isDark ? AppColors.secondary : AppColors.primary)
                              : (isDark ? Colors.white : AppColors.lightTextPrimary),
                          fontWeight: FontWeight.bold,
                          fontSize: 14,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              song.artists.isNotEmpty ? song.artists.join(', ') : 'Bạn tải lên',
                              style: TextStyle(
                                color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
                                fontSize: 12,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: song.isPublic
                                  ? AppColors.secondary.withValues(alpha: 0.15)
                                  : AppColors.primary.withValues(alpha: 0.15),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              song.isPublic ? 'Công khai' : 'Riêng tư',
                              style: TextStyle(
                                color: song.isPublic ? AppColors.secondary : AppColors.primary,
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),

                // Options menu button
                IconButton(
                  icon: Icon(
                    Icons.more_vert_rounded,
                    color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
                    size: 20,
                  ),
                  onPressed: () => _showSongOptions(song),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ==================== UPLOAD BOTTOM SHEET ====================
class _UploadBottomSheet extends StatefulWidget {
  const _UploadBottomSheet();

  @override
  State<_UploadBottomSheet> createState() => _UploadBottomSheetState();
}

class _UploadBottomSheetState extends State<_UploadBottomSheet> {
  final _formKey = GlobalKey<FormState>();
  final _titleController = TextEditingController();
  final _artistController = TextEditingController();
  final _lyricsController = TextEditingController();

  File? _audioFile;
  File? _imageFile;
  String? _audioFileName;

  List<Topic> _topics = [];
  Topic? _selectedTopic;
  bool _isLoadingTopics = true;
  bool _isUploading = false;
  bool _isPublic = false; // Mặc định riêng tư

  @override
  void initState() {
    super.initState();
    _loadTopics();
  }

  @override
  void dispose() {
    _titleController.dispose();
    _artistController.dispose();
    _lyricsController.dispose();
    super.dispose();
  }

  Future<void> _loadTopics() async {
    try {
      final topics = await TopicApiService.fetchTopics();
      if (mounted) {
        setState(() {
          _topics = topics;
          _isLoadingTopics = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoadingTopics = false);
      }
    }
  }

  Future<void> _pickAudioFile() async {
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.audio,
        allowMultiple: false,
      );

      if (result != null && result.files.isNotEmpty) {
        final file = result.files.first;
        if (file.path != null) {
          setState(() {
            _audioFile = File(file.path!);
            _audioFileName = file.name;
          });
        }
      }
    } catch (e) {
      _showError('Không thể chọn file audio');
    }
  }

  Future<void> _pickImageFile() async {
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.image,
        allowMultiple: false,
      );

      if (result != null && result.files.isNotEmpty) {
        final file = result.files.first;
        if (file.path != null) {
          setState(() {
            _imageFile = File(file.path!);
          });
        }
      }
    } catch (e) {
      _showError('Không thể chọn file ảnh');
    }
  }

  Future<void> _uploadSong() async {
    if (!_formKey.currentState!.validate()) return;

    if (_audioFile == null) {
      _showError('Vui lòng chọn file audio');
      return;
    }

    setState(() => _isUploading = true);

    final result = await SongApiService.uploadSong(
      audioFile: _audioFile!,
      imageFile: _imageFile,
      title: _titleController.text.trim(),
      artist: _artistController.text.trim(),
      topicId: _selectedTopic?.id,
      lyrics: _lyricsController.text.trim(),
      isPublic: _isPublic,
    );

    setState(() => _isUploading = false);

    if (result.success) {
      _showSuccess(result.message);
      if (mounted) {
        Navigator.of(context).pop(true);
      }
    } else {
      _showError(result.message);
    }
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: Colors.redAccent,
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  void _showSuccess(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: AppColors.primary,
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      height: MediaQuery.of(context).size.height * 0.9,
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1A1430) : Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(26)),
      ),
      child: Column(
        children: [
          // Handle bar
          Container(
            margin: const EdgeInsets.only(top: 12),
            width: 44,
            height: 4,
            decoration: BoxDecoration(
              color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.2),
              borderRadius: BorderRadius.circular(2),
            ),
          ),

          // Header
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: Text(
                    'Huỷ',
                    style: TextStyle(
                      color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                Text(
                  'Upload bài hát',
                  style: TextStyle(
                    color: isDark ? Colors.white : AppColors.lightTextPrimary,
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(width: 50),
              ],
            ),
          ),
          Divider(color: isDark ? AppColors.darkBorder : AppColors.lightBorder, height: 1),

          // Form Content
          Expanded(
            child: _isUploading
                ? _buildUploadingView()
                : SingleChildScrollView(
                    padding: const EdgeInsets.all(20),
                    child: Form(
                      key: _formKey,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Audio + Image pickers in row
                          Row(
                            children: [
                              // Image preview
                              GestureDetector(
                                onTap: _pickImageFile,
                                child: Container(
                                  width: 96,
                                  height: 96,
                                  decoration: BoxDecoration(
                                    color: isDark ? const Color(0xFF120E24) : const Color(0xFFF3F4F6),
                                    borderRadius: BorderRadius.circular(16),
                                    border: Border.all(
                                      color: isDark ? AppColors.darkBorder : AppColors.lightBorder,
                                    ),
                                    image: _imageFile != null
                                        ? DecorationImage(
                                            image: FileImage(_imageFile!),
                                            fit: BoxFit.cover,
                                          )
                                        : null,
                                  ),
                                  child: _imageFile == null
                                      ? Column(
                                          mainAxisAlignment: MainAxisAlignment.center,
                                          children: [
                                            const Icon(
                                              Icons.add_photo_alternate_rounded,
                                              color: AppColors.secondary,
                                              size: 32,
                                            ),
                                            const SizedBox(height: 4),
                                            Text(
                                              'Ảnh bìa',
                                              style: TextStyle(
                                                color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
                                                fontSize: 11,
                                                fontWeight: FontWeight.w500,
                                              ),
                                            ),
                                          ],
                                        )
                                      : null,
                                ),
                              ),
                              const SizedBox(width: 16),

                              // Audio picker
                              Expanded(
                                child: _buildFilePicker(
                                  icon: Icons.audio_file_rounded,
                                  label: _audioFileName ?? 'Chọn file nhạc audio (.mp3, .m4a)',
                                  isSelected: _audioFile != null,
                                  onTap: _pickAudioFile,
                                ),
                              ),
                            ],
                          ),

                          const SizedBox(height: 20),

                          // Title
                          _buildTextField(
                            controller: _titleController,
                            label: 'Tên bài hát (tuỳ chọn)',
                            hint: 'Bỏ trống để dùng tên file',
                          ),

                          const SizedBox(height: 16),

                          // Artist
                          _buildTextField(
                            controller: _artistController,
                            label: 'Nghệ sĩ (tuỳ chọn)',
                            hint: 'Nhập tên nghệ sĩ hoặc để trống',
                          ),

                          const SizedBox(height: 16),

                          // Topic
                          _buildLabel('Chủ đề (tuỳ chọn)'),
                          const SizedBox(height: 8),
                          _buildTopicDropdown(),

                          const SizedBox(height: 16),

                          // Lyrics
                          _buildTextField(
                            controller: _lyricsController,
                            label: 'Lời bài hát (tuỳ chọn)',
                            hint: 'Nhập lời bài hát (hỗ trợ định dạng LRC)...',
                            maxLines: 4,
                          ),

                          const SizedBox(height: 16),

                          // Public/Private toggle
                          Container(
                            decoration: BoxDecoration(
                              color: isDark ? const Color(0xFF120E24) : const Color(0xFFF3F4F6),
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(
                                color: isDark ? AppColors.darkBorder : AppColors.lightBorder,
                              ),
                            ),
                            child: SwitchListTile(
                              title: Text(
                                'Công khai bài hát',
                                style: TextStyle(
                                  color: isDark ? Colors.white : AppColors.lightTextPrimary,
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              subtitle: Text(
                                _isPublic
                                    ? 'Mọi người đều có thể nghe bài hát này'
                                    : 'Chỉ bạn mới có thể nghe bài hát này',
                                style: TextStyle(
                                  color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
                                  fontSize: 12,
                                ),
                              ),
                              value: _isPublic,
                              onChanged: (value) {
                                setState(() => _isPublic = value);
                              },
                              activeColor: AppColors.secondary,
                              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                            ),
                          ),

                          const SizedBox(height: 24),

                          // Upload button
                          Container(
                            width: double.infinity,
                            height: 52,
                            decoration: BoxDecoration(
                              gradient: const LinearGradient(
                                colors: [AppColors.secondary, AppColors.primary],
                              ),
                              borderRadius: BorderRadius.circular(26),
                              boxShadow: [
                                BoxShadow(
                                  color: AppColors.secondary.withValues(alpha: 0.35),
                                  blurRadius: 14,
                                  offset: const Offset(0, 4),
                                ),
                              ],
                            ),
                            child: ElevatedButton(
                              onPressed: _uploadSong,
                              style: ElevatedButton.styleFrom(
                                backgroundColor: Colors.transparent,
                                shadowColor: Colors.transparent,
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(26)),
                              ),
                              child: const Text(
                                'Tải lên ngay',
                                style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.white,
                                ),
                              ),
                            ),
                          ),

                          const SizedBox(height: 32),
                        ],
                      ),
                    ),
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildUploadingView() {
    return const Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          CircularProgressIndicator(color: AppColors.secondary),
          SizedBox(height: 24),
          Text(
            'Đang upload...',
            style: TextStyle(
              color: Colors.white,
              fontSize: 18,
              fontWeight: FontWeight.bold,
            ),
          ),
          SizedBox(height: 8),
          Text(
            'Vui lòng chờ trong giây lát',
            style: TextStyle(color: Colors.white54, fontSize: 14),
          ),
        ],
      ),
    );
  }

  Widget _buildLabel(String text) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Text(
      text,
      style: TextStyle(
        color: isDark ? Colors.white : AppColors.lightTextPrimary,
        fontSize: 14,
        fontWeight: FontWeight.w600,
      ),
    );
  }

  Widget _buildFilePicker({
    required IconData icon,
    required String label,
    required bool isSelected,
    required VoidCallback onTap,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        height: 96,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF120E24) : const Color(0xFFF3F4F6),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isSelected
                ? AppColors.secondary
                : (isDark ? AppColors.darkBorder : AppColors.lightBorder),
            width: isSelected ? 1.5 : 1.0,
          ),
        ),
        child: Row(
          children: [
            Icon(
              icon,
              color: isSelected ? AppColors.secondary : AppColors.primary,
              size: 28,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                label,
                style: TextStyle(
                  color: isSelected ? (isDark ? Colors.white : AppColors.lightTextPrimary) : (isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary),
                  fontSize: 13,
                  fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                ),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            Icon(
              isSelected ? Icons.check_circle_rounded : Icons.add_circle_outline_rounded,
              color: isSelected ? AppColors.secondary : (isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary),
              size: 20,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String label,
    required String hint,
    String? Function(String?)? validator,
    int maxLines = 1,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildLabel(label),
        const SizedBox(height: 8),
        TextFormField(
          controller: controller,
          validator: validator,
          maxLines: maxLines,
          style: TextStyle(color: isDark ? Colors.white : AppColors.lightTextPrimary, fontSize: 14),
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: TextStyle(
              color: isDark ? Colors.white38 : Colors.black38,
              fontSize: 13,
            ),
            filled: true,
            fillColor: isDark ? const Color(0xFF120E24) : const Color(0xFFF3F4F6),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: AppColors.secondary, width: 1.5),
            ),
            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          ),
        ),
      ],
    );
  }

  Widget _buildTopicDropdown() {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    if (_isLoadingTopics) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF120E24) : const Color(0xFFF3F4F6),
          borderRadius: BorderRadius.circular(14),
        ),
        child: const Row(
          children: [
            SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.secondary),
            ),
            SizedBox(width: 12),
            Text('Đang tải chủ đề...', style: TextStyle(color: Colors.grey, fontSize: 13)),
          ],
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF120E24) : const Color(0xFFF3F4F6),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: isDark ? AppColors.darkBorder : AppColors.lightBorder),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<Topic>(
          value: _selectedTopic,
          hint: Text('Chọn chủ đề', style: TextStyle(color: isDark ? Colors.white38 : Colors.black38, fontSize: 13)),
          isExpanded: true,
          dropdownColor: isDark ? const Color(0xFF1A1430) : Colors.white,
          icon: const Icon(Icons.arrow_drop_down_rounded, color: AppColors.secondary),
          items: _topics.map((topic) {
            return DropdownMenuItem<Topic>(
              value: topic,
              child: Text(
                topic.name,
                style: TextStyle(
                  color: isDark ? Colors.white : AppColors.lightTextPrimary,
                  fontSize: 14,
                ),
              ),
            );
          }).toList(),
          onChanged: (topic) => setState(() => _selectedTopic = topic),
        ),
      ),
    );
  }
}
