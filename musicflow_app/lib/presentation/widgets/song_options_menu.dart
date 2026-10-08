import 'package:flutter/material.dart';
import 'package:musicflow_app/core/audio/global_audio_state.dart';
import 'package:musicflow_app/data/models/song_model.dart';
import 'package:musicflow_app/data/models/playlist_model.dart';
import 'package:musicflow_app/data/services/playlist_api_service.dart';
import 'package:musicflow_app/data/services/auth_service.dart';
import 'package:musicflow_app/data/services/favorite_service.dart';
import 'package:musicflow_app/data/services/lyrics_api_service.dart';
import 'package:musicflow_app/presentation/screens/artist/artist_screen.dart';
import 'package:musicflow_app/presentation/widgets/song_share_sheet.dart';
import 'package:musicflow_app/presentation/widgets/rive/rive_heart_button.dart';
import 'package:musicflow_app/core/utils/app_toast.dart';



/// Widget hiển thị menu tùy chọn cho bài hát (3 chấm dọc)
class SongOptionsMenu extends StatelessWidget {
  final Song song;
  final VoidCallback? onAddToFavorite;
  final VoidCallback? onShare;
  final VoidCallback? onDownload;

  /// Playlist ID nếu bài hát đang được xem trong context của playlist
  final String? currentPlaylistId;

  /// Callback khi xóa bài hát khỏi playlist
  final VoidCallback? onRemovedFromPlaylist;

  /// Callback khi trạng thái yêu thích thay đổi
  final VoidCallback? onFavoriteChanged;

  const SongOptionsMenu({
    super.key,
    required this.song,
    this.onAddToFavorite,
    this.onShare,
    this.onDownload,
    this.currentPlaylistId,
    this.onRemovedFromPlaylist,
    this.onFavoriteChanged,
  });

  @override
  Widget build(BuildContext context) {
    return IconButton(
      icon: const Icon(Icons.more_vert, color: Colors.grey),
      onPressed: () => _showOptionsMenu(context),
    );
  }

  void _showOptionsMenu(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (context) => SongOptionsSheet(
        song: song,
        onAddToFavorite: onAddToFavorite,
        onShare: onShare,
        onDownload: onDownload,
        currentPlaylistId: currentPlaylistId,
        onRemovedFromPlaylist: onRemovedFromPlaylist,
        onFavoriteChanged: onFavoriteChanged,
      ),
    );
  }
}

class SongOptionsSheet extends StatefulWidget {
  final Song song;
  final VoidCallback? onAddToFavorite;
  final VoidCallback? onShare;
  final VoidCallback? onDownload;
  final String? currentPlaylistId;
  final VoidCallback? onRemovedFromPlaylist;
  final VoidCallback? onFavoriteChanged;

  const SongOptionsSheet({
    super.key,
    required this.song,
    this.onAddToFavorite,
    this.onShare,
    this.onDownload,
    this.currentPlaylistId,
    this.onRemovedFromPlaylist,
    this.onFavoriteChanged,
  });

  @override
  State<SongOptionsSheet> createState() => _SongOptionsSheetState();
}

class _SongOptionsSheetState extends State<SongOptionsSheet> {
  final GlobalAudioState _audioState = GlobalAudioState();
  bool _isFavorite = false;
  bool _isCheckingFavorite = true;

  @override
  void initState() {
    super.initState();
    _checkFavorite();
  }

  Future<void> _checkFavorite() async {
    final result = await FavoriteService.checkFavorite(widget.song.id);
    if (mounted) {
      setState(() {
        _isFavorite = result.isFavorite == true;
        _isCheckingFavorite = false;
      });
    }
  }

  Future<void> _toggleFavorite() async {
    final result = await FavoriteService.toggleFavorite(widget.song.id);
    if (result.success) {
      setState(() {
        _isFavorite = result.isFavorite ?? !_isFavorite;
      });
      // Gọi callback để refresh danh sách favorites
      widget.onFavoriteChanged?.call();
      if (mounted) {
        Navigator.pop(context);
        AppToast.showSuccess(
          context,
          result.message ?? (_isFavorite ? 'Đã thêm vào yêu thích' : 'Đã xóa khỏi yêu thích'),
        );
      }
    } else {
      if (mounted) {
        AppToast.showError(context, result.message ?? 'Đã xảy ra lỗi');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final maxSheetHeight = MediaQuery.of(context).size.height * 0.88;

    return Material(
      color: Colors.transparent,
      child: Container(
        constraints: BoxConstraints(maxHeight: maxSheetHeight),
        decoration: BoxDecoration(
          color: const Color(0xFF140F2D).withOpacity(0.97),
          borderRadius: const BorderRadius.vertical(top: Radius.circular(26)),
          border: Border.all(
            color: Colors.white.withOpacity(0.12),
            width: 1,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.6),
              blurRadius: 30,
              offset: const Offset(0, -10),
            ),
          ],
        ),
        child: SafeArea(
          top: false,
          child: SingleChildScrollView(
            physics: const BouncingScrollPhysics(),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
              // Handle bar
              Container(
                width: 38,
                height: 4,
                margin: const EdgeInsets.symmetric(vertical: 12),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.24),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),

              // Song info header
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                child: Row(
                  children: [
                    Container(
                      width: 58,
                      height: 58,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(
                          color: Colors.white.withOpacity(0.12),
                          width: 1,
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withOpacity(0.35),
                            blurRadius: 10,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(13),
                        child: (widget.song.imageUrl.trim().isEmpty || !widget.song.imageUrl.startsWith('http'))
                            ? Container(
                                color: Colors.white.withOpacity(0.06),
                                child: const Icon(
                                  Icons.music_note_rounded,
                                  color: Colors.white54,
                                  size: 26,
                                ),
                              )
                            : Image.network(
                                widget.song.imageUrl,
                                width: 58,
                                height: 58,
                                fit: BoxFit.cover,
                                errorBuilder: (_, __, ___) => Container(
                                  color: Colors.white.withOpacity(0.06),
                                  child: const Icon(
                                    Icons.music_note_rounded,
                                    color: Colors.white54,
                                    size: 26,
                                  ),
                                ),
                              ),
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            widget.song.title,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 16.5,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 0.2,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 4),
                          Text(
                            widget.song.artists.join(', '),
                            style: TextStyle(
                              color: Colors.white.withOpacity(0.6),
                              fontSize: 13.5,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: (widget.song.isHighQuality == true)
                            ? const Color(0xFF6C63FF).withOpacity(0.18)
                            : Colors.white.withOpacity(0.08),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(
                          color: (widget.song.isHighQuality == true)
                              ? const Color(0xFF6C63FF).withOpacity(0.35)
                              : Colors.white.withOpacity(0.15),
                          width: 1,
                        ),
                      ),
                      child: Text(
                        widget.song.qualityLabel,
                        style: TextStyle(
                          color: (widget.song.isHighQuality == true)
                              ? const Color(0xFF9E97FF)
                              : Colors.white70,
                          fontSize: 10.5,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              // Divider
              Container(
                height: 1,
                margin: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                color: Colors.white.withOpacity(0.08),
              ),

              // Options list
              if (widget.currentPlaylistId != null)
                _buildOptionTile(
                  icon: Icons.playlist_remove_rounded,
                  title: 'Xóa khỏi playlist',
                  subtitle: 'Gỡ bài hát khỏi playlist hiện tại',
                  accentColor: const Color(0xFFF43F5E),
                  onTap: () => _removeFromPlaylist(context),
                )
              else
                _buildOptionTile(
                  icon: Icons.playlist_add_rounded,
                  title: 'Thêm vào playlist',
                  subtitle: 'Lưu bài hát vào danh sách phát cá nhân',
                  accentColor: const Color(0xFF00BCD4),
                  onTap: () => _showAddToPlaylistDialog(context),
                ),

              _buildOptionTile(
                icon: _isFavorite ? Icons.favorite_rounded : Icons.favorite_border_rounded,
                leadingWidget: SizedBox(
                  width: 24,
                  height: 24,
                  child: RiveHeartButton(
                    isLiked: _isFavorite,
                    onTap: _isCheckingFavorite ? () {} : _toggleFavorite,
                    size: 24,
                    activeColor: const Color(0xFFFF2D55),
                    inactiveColor: Colors.white70,
                  ),
                ),
                title: _isFavorite ? 'Bỏ yêu thích' : 'Thêm vào yêu thích',
                subtitle: _isFavorite ? 'Đã lưu trong mục Yêu thích' : 'Lưu vào bài hát yêu thích',
                accentColor: const Color(0xFFFF2D55),
                onTap: _isCheckingFavorite ? null : _toggleFavorite,
                showChevron: false,
              ),

              _buildOptionTile(
                icon: Icons.queue_music_rounded,
                title: 'Thêm vào danh sách chờ',
                subtitle: 'Phát tiếp theo sau danh sách hiện tại',
                accentColor: const Color(0xFF6C63FF),
                onTap: _addToQueue,
              ),

              _buildOptionTile(
                icon: Icons.person_rounded,
                title: 'Xem nghệ sĩ',
                subtitle: widget.song.artists.isNotEmpty ? widget.song.artists.first : 'Trang thông tin nghệ sĩ',
                accentColor: const Color(0xFFA855F7),
                onTap: _openArtistScreen,
              ),

              _buildOptionTile(
                icon: Icons.share_rounded,
                title: 'Chia sẻ bài hát',
                subtitle: 'Gửi link hoặc mã QR cho bạn bè',
                accentColor: const Color(0xFF6366F1),
                onTap: () {
                  Navigator.pop(context);
                  if (widget.onShare != null) {
                    widget.onShare!();
                  } else {
                    SongShareSheet.show(context, widget.song);
                  }
                },
              ),

              _buildOptionTile(
                icon: Icons.info_outline_rounded,
                title: 'Thông tin bài hát',
                subtitle: 'Xem chi tiết tên bài, ca sĩ & lời bài hát',
                accentColor: const Color(0xFF06B6D4),
                onTap: () {
                  final rootContext = Navigator.of(context).context;
                  Navigator.pop(context);
                  _showSongInfo(rootContext);
                },
              ),

              const SizedBox(height: 14),
            ],
          ),
        ),
      ),
    ),
  );
  }

  Widget _buildOptionTile({
    required IconData icon,
    required String title,
    String? subtitle,
    VoidCallback? onTap,
    required Color accentColor,
    Widget? leadingWidget,
    bool showChevron = true,
  }) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        splashColor: accentColor.withOpacity(0.15),
        highlightColor: Colors.white.withOpacity(0.04),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8.5),
          child: Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: accentColor.withOpacity(0.14),
                  borderRadius: BorderRadius.circular(13),
                  border: Border.all(
                    color: accentColor.withOpacity(0.28),
                    width: 1,
                  ),
                ),
                child: Center(
                  child: leadingWidget ?? Icon(icon, color: accentColor, size: 21),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 14.5,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 0.1,
                      ),
                    ),
                    if (subtitle != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        subtitle,
                        style: TextStyle(
                          color: Colors.white.withOpacity(0.48),
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              if (showChevron)
                Icon(
                  Icons.chevron_right_rounded,
                  color: Colors.white.withOpacity(0.25),
                  size: 20,
                ),
            ],
          ),
        ),
      ),
    );
  }

  void _addToQueue() {
    final hadActiveQueue = _audioState.hasActiveQueue;
    final result = _audioState.addToQueue(widget.song);

    if (!mounted) return;

    Navigator.pop(context);
    if (result == -1) {
      AppToast.showInfo(
        context,
        'Bài hát "${widget.song.title}" đã có trong danh sách chờ',
      );
    } else {
      AppToast.showSuccess(
        context,
        hadActiveQueue
            ? 'Đã thêm vào danh sách phát tiếp theo'
            : 'Đã bắt đầu phát bài hát',
      );
    }
  }

  void _openArtistScreen() {
    final artistName = widget.song.artists.isNotEmpty
        ? widget.song.artists.first
        : '';
    if (artistName.isEmpty) return;

    Navigator.pop(context);
    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => ArtistScreen(artistName: artistName)),
    );
  }

  Future<void> _removeFromPlaylist(BuildContext context) async {
    Navigator.pop(context);

    if (widget.currentPlaylistId == null) return;

    final result = await PlaylistApiService.removeSongFromPlaylist(
      playlistId: widget.currentPlaylistId!,
      songId: widget.song.id,
    );

    if (context.mounted) {
      if (result.success) {
        AppToast.showSuccess(
          context,
          'Đã xóa "${widget.song.title}" khỏi playlist',
        );
        widget.onRemovedFromPlaylist?.call();
      } else {
        AppToast.showError(
          context,
          result.message ?? 'Xóa thất bại',
        );
      }
    }
  }

  void _showAddToPlaylistDialog(BuildContext context) async {
    // Lưu trước context ngoại vi qua Navigator để tránh lỗi mounted = false sau khi pop
    final rootContext = Navigator.of(context).context;

    // Đóng menu bottom sheet hiện tại
    Navigator.pop(context);

    // Check if logged in
    final isLoggedIn = await AuthService.isLoggedIn();
    if (!isLoggedIn) {
      if (rootContext.mounted) {
        AppToast.showInfo(
          rootContext,
          'Vui lòng đăng nhập để sử dụng tính năng này',
        );
      }
      return;
    }

    if (!rootContext.mounted) return;

    showModalBottomSheet(
      context: rootContext,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (context) => _PlaylistSelectionSheet(song: widget.song),
    );
  }

  Future<void> _showSongInfo(BuildContext context) async {
    final lyricsResult = await LyricsApiService.fetchLrcLyrics(
      songId: widget.song.id,
    );
    if (!context.mounted) return;

    final lyricsStatus = lyricsResult.success
        ? (lyricsResult.lyrics.trim().isNotEmpty ? 'Có' : 'Chưa có')
        : 'Không thể kiểm tra';

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF1B1536),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(22),
          side: BorderSide(color: Colors.white.withOpacity(0.12)),
        ),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(7),
              decoration: BoxDecoration(
                color: const Color(0xFF06B6D4).withOpacity(0.15),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.info_rounded, color: Color(0xFF06B6D4), size: 20),
            ),
            const SizedBox(width: 10),
            const Text(
              'Thông tin bài hát',
              style: TextStyle(
                color: Colors.white,
                fontSize: 17,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _infoRow('Tên bài hát', widget.song.title),
            _infoRow('Ca sĩ', widget.song.artists.join(', ')),
            _infoRow('Lời bài hát', lyricsStatus),
            _infoRow('Chất lượng', widget.song.qualityDetailedDescription),
            if (widget.song.fileSize > 0)
              _infoRow(
                'Dung lượng',
                '${(widget.song.fileSize / (1024 * 1024)).toStringAsFixed(1)} MB',
              ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            style: TextButton.styleFrom(
              foregroundColor: const Color(0xFF9E97FF),
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 8),
            ),
            child: const Text(
              'Đóng',
              style: TextStyle(fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }

  Widget _infoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '$label: ',
            style: TextStyle(color: Colors.white.withOpacity(0.55), fontSize: 13.5),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 13.5,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Sheet để chọn playlist
class _PlaylistSelectionSheet extends StatefulWidget {
  final Song song;

  const _PlaylistSelectionSheet({required this.song});

  @override
  State<_PlaylistSelectionSheet> createState() =>
      _PlaylistSelectionSheetState();
}

class _PlaylistSelectionSheetState extends State<_PlaylistSelectionSheet> {
  List<Playlist> _playlists = [];
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadPlaylists();
  }

  Future<void> _loadPlaylists() async {
    final result = await PlaylistApiService.getPlaylists();

    if (mounted) {
      setState(() {
        _isLoading = false;
        if (result.success) {
          _playlists = result.playlists ?? [];
        } else {
          _error = result.message;
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: MediaQuery.of(context).size.height * 0.65,
      decoration: BoxDecoration(
        color: const Color(0xFF140F2D).withOpacity(0.97),
        borderRadius: const BorderRadius.vertical(top: Radius.circular(26)),
        border: Border.all(color: Colors.white.withOpacity(0.12), width: 1),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.6),
            blurRadius: 30,
            offset: const Offset(0, -10),
          ),
        ],
      ),
      child: Column(
        children: [
          // Handle bar
          Container(
            width: 38,
            height: 4,
            margin: const EdgeInsets.symmetric(vertical: 12),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.24),
              borderRadius: BorderRadius.circular(2),
            ),
          ),

          // Header
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Thêm vào playlist',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                GestureDetector(
                  onTap: () => _showCreatePlaylistDialog(context),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                    decoration: BoxDecoration(
                      color: const Color(0xFF6C63FF),
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF6C63FF).withOpacity(0.35),
                          blurRadius: 8,
                          offset: const Offset(0, 3),
                        ),
                      ],
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.add, color: Colors.white, size: 16),
                        SizedBox(width: 4),
                        Text(
                          'Tạo mới',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),

          Container(
            height: 1,
            margin: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
            color: Colors.white.withOpacity(0.08),
          ),

          // Content
          Expanded(child: _buildContent()),
        ],
      ),
    );
  }

  Widget _buildContent() {
    if (_isLoading) {
      return const Center(
        child: CircularProgressIndicator(color: Color(0xFF6C63FF)),
      );
    }

    if (_error != null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.error_outline_rounded, color: Colors.red[300], size: 48),
            const SizedBox(height: 16),
            Text(
              _error!,
              style: TextStyle(color: Colors.white.withOpacity(0.6)),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () {
                setState(() {
                  _isLoading = true;
                  _error = null;
                });
                _loadPlaylists();
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF6C63FF),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
              child: const Text('Thử lại'),
            ),
          ],
        ),
      );
    }

    if (_playlists.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.queue_music_rounded, color: Colors.white.withOpacity(0.2), size: 64),
            const SizedBox(height: 16),
            const Text(
              'Chưa có playlist nào',
              style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 6),
            Text(
              'Tạo playlist mới để thêm bài hát vào bộ sưu tập',
              style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 13.5),
            ),
            const SizedBox(height: 20),
            ElevatedButton.icon(
              onPressed: () => _showCreatePlaylistDialog(context),
              icon: const Icon(Icons.add_rounded, size: 18),
              label: const Text('Tạo playlist ngay'),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF6C63FF),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 11),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              ),
            ),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
      itemCount: _playlists.length,
      itemBuilder: (context, index) {
        final playlist = _playlists[index];
        final hasSong = playlist.songs.any((s) => s.id == widget.song.id);

        return Container(
          margin: const EdgeInsets.symmetric(vertical: 4),
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.04),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: hasSong
                  ? const Color(0xFF00BCD4).withOpacity(0.3)
                  : Colors.white.withOpacity(0.06),
            ),
          ),
          child: ListTile(
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
            leading: ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: Container(
                width: 48,
                height: 48,
                color: const Color(0xFF6C63FF).withOpacity(0.18),
                child: playlist.displayCoverImage.isNotEmpty
                    ? Image.network(
                        playlist.displayCoverImage,
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => const Icon(
                          Icons.queue_music_rounded,
                          color: Color(0xFF9E97FF),
                          size: 24,
                        ),
                      )
                    : const Icon(
                        Icons.queue_music_rounded,
                        color: Color(0xFF9E97FF),
                        size: 24,
                      ),
              ),
            ),
            title: Text(
              playlist.name,
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w600,
                fontSize: 15,
              ),
            ),
            subtitle: Text(
              '${playlist.songCount} bài hát',
              style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 13),
            ),
            trailing: hasSong
                ? Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: const Color(0xFF00BCD4).withOpacity(0.15),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.check_rounded, color: Color(0xFF00BCD4), size: 18),
                  )
                : const Icon(Icons.add_circle_outline_rounded, color: Colors.white38, size: 22),
            onTap: hasSong ? null : () => _addToPlaylist(playlist),
          ),
        );
      },
    );
  }

  Future<void> _addToPlaylist(Playlist playlist) async {
    final result = await PlaylistApiService.addSongToPlaylist(
      playlistId: playlist.id,
      songId: widget.song.id,
    );

    if (mounted) {
      Navigator.pop(context);
      if (result.success) {
        AppToast.showSuccess(
          context,
          'Đã thêm vào playlist "${playlist.name}"',
        );
      } else {
        AppToast.showError(
          context,
          result.message ?? 'Thêm vào playlist thất bại',
        );
      }
    }
  }

  void _showCreatePlaylistDialog(BuildContext context) {
    final nameController = TextEditingController();

    showDialog(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: const Color(0xFF1B1536),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(22),
          side: BorderSide(color: Colors.white.withOpacity(0.12)),
        ),
        title: const Text(
          'Tạo playlist mới',
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
        ),
        content: TextField(
          controller: nameController,
          autofocus: true,
          style: const TextStyle(color: Colors.white),
          decoration: InputDecoration(
            hintText: 'Nhập tên playlist...',
            hintStyle: TextStyle(color: Colors.white.withOpacity(0.35)),
            enabledBorder: UnderlineInputBorder(
              borderSide: BorderSide(color: Colors.white.withOpacity(0.2)),
            ),
            focusedBorder: const UnderlineInputBorder(
              borderSide: BorderSide(color: Color(0xFF6C63FF), width: 2),
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: Text('Hủy', style: TextStyle(color: Colors.white.withOpacity(0.6))),
          ),
          ElevatedButton(
            onPressed: () async {
              if (nameController.text.trim().isEmpty) return;

              Navigator.pop(dialogContext);

              final result = await PlaylistApiService.createPlaylist(
                name: nameController.text.trim(),
              );

              if (result.success && result.playlist != null) {
                await PlaylistApiService.addSongToPlaylist(
                  playlistId: result.playlist!.id,
                  songId: widget.song.id,
                );

                if (mounted) {
                  Navigator.pop(context); // Close playlist selection sheet
                  AppToast.showSuccess(
                    context,
                    'Đã tạo và thêm vào playlist "${nameController.text.trim()}"',
                  );
                }
              } else {
                if (mounted) {
                  AppToast.showError(
                    context,
                    result.message ?? 'Tạo playlist thất bại',
                  );
                }
              }
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF6C63FF),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: const Text('Tạo'),
          ),
        ],
      ),
    );
  }
}
