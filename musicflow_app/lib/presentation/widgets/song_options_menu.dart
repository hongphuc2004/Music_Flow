import 'package:flutter/material.dart';
import 'package:musicflow_app/data/models/song_model.dart';
import 'package:musicflow_app/data/models/playlist_model.dart';
import 'package:musicflow_app/data/services/playlist_api_service.dart';
import 'package:musicflow_app/data/services/auth_service.dart';

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

  const SongOptionsMenu({
    super.key,
    required this.song,
    this.onAddToFavorite,
    this.onShare,
    this.onDownload,
    this.currentPlaylistId,
    this.onRemovedFromPlaylist,
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
      builder: (context) => _SongOptionsSheet(
        song: song,
        onAddToFavorite: onAddToFavorite,
        onShare: onShare,
        onDownload: onDownload,
        currentPlaylistId: currentPlaylistId,
        onRemovedFromPlaylist: onRemovedFromPlaylist,
      ),
    );
  }
}

class _SongOptionsSheet extends StatefulWidget {
  final Song song;
  final VoidCallback? onAddToFavorite;
  final VoidCallback? onShare;
  final VoidCallback? onDownload;
  final String? currentPlaylistId;
  final VoidCallback? onRemovedFromPlaylist;

  const _SongOptionsSheet({
    required this.song,
    this.onAddToFavorite,
    this.onShare,
    this.onDownload,
    this.currentPlaylistId,
    this.onRemovedFromPlaylist,
  });

  @override
  State<_SongOptionsSheet> createState() => _SongOptionsSheetState();
}

class _SongOptionsSheetState extends State<_SongOptionsSheet> {
  List<Playlist> _playlists = [];
  bool _isLoadingPlaylists = false;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Color(0xFF1E1E1E),
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Handle bar
          Container(
            width: 40,
            height: 4,
            margin: const EdgeInsets.symmetric(vertical: 12),
            decoration: BoxDecoration(
              color: Colors.grey[600],
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          
          // Song info header
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
            child: Row(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: Image.network(
                    widget.song.imageUrl,
                    width: 56,
                    height: 56,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => Container(
                      width: 56,
                      height: 56,
                      color: Colors.grey[800],
                      child: const Icon(Icons.music_note, color: Colors.white54),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        widget.song.title,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        widget.song.artist,
                        style: TextStyle(
                          color: Colors.grey[400],
                          fontSize: 14,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          
          const Divider(color: Colors.grey, height: 1),
          
          // Options list - Show remove or add based on context
          if (widget.currentPlaylistId != null)
            _buildOptionTile(
              icon: Icons.playlist_remove,
              title: 'Xóa khỏi playlist',
              onTap: () => _removeFromPlaylist(context),
              iconColor: Colors.redAccent,
            )
          else
            _buildOptionTile(
              icon: Icons.playlist_add,
              title: 'Thêm vào playlist',
              onTap: () => _showAddToPlaylistDialog(context),
            ),
          _buildOptionTile(
            icon: Icons.favorite_border,
            title: 'Thêm vào yêu thích',
            onTap: () {
              Navigator.pop(context);
              widget.onAddToFavorite?.call();
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('Đã thêm vào yêu thích'),
                  duration: Duration(seconds: 2),
                ),
              );
            },
          ),
          _buildOptionTile(
            icon: Icons.queue_music,
            title: 'Thêm vào danh sách chờ',
            onTap: () {
              Navigator.pop(context);
              // TODO: Implement add to queue
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('Đã thêm vào danh sách chờ'),
                  duration: Duration(seconds: 2),
                ),
              );
            },
          ),
          _buildOptionTile(
            icon: Icons.share,
            title: 'Chia sẻ',
            onTap: () {
              Navigator.pop(context);
              widget.onShare?.call();
            },
          ),
          _buildOptionTile(
            icon: Icons.info_outline,
            title: 'Thông tin bài hát',
            onTap: () {
              Navigator.pop(context);
              _showSongInfo(context);
            },
          ),
          
          const SizedBox(height: 16),
        ],
      ),
    );
  }

  Widget _buildOptionTile({
    required IconData icon,
    required String title,
    required VoidCallback onTap,
    Color? iconColor,
  }) {
    return ListTile(
      leading: Icon(icon, color: iconColor ?? Colors.white70),
      title: Text(
        title,
        style: const TextStyle(color: Colors.white),
      ),
      onTap: onTap,
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
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            result.success 
                ? 'Đã xóa "${widget.song.title}" khỏi playlist' 
                : result.message ?? 'Xóa thất bại',
          ),
          duration: const Duration(seconds: 2),
        ),
      );
      
      if (result.success) {
        widget.onRemovedFromPlaylist?.call();
      }
    }
  }

  void _showAddToPlaylistDialog(BuildContext context) async {
    Navigator.pop(context); // Close bottom sheet first
    
    // Check if logged in
    final isLoggedIn = await AuthService.isLoggedIn();
    if (!isLoggedIn) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Vui lòng đăng nhập để sử dụng tính năng này'),
            duration: Duration(seconds: 2),
          ),
        );
      }
      return;
    }

    if (!context.mounted) return;
    
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (context) => _PlaylistSelectionSheet(
        song: widget.song,
      ),
    );
  }

  void _showSongInfo(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF1E1E1E),
        title: const Text(
          'Thông tin bài hát',
          style: TextStyle(color: Colors.white),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _infoRow('Tên bài hát', widget.song.title),
            _infoRow('Ca sĩ', widget.song.artist),
            if (widget.song.lyrics.isNotEmpty)
              _infoRow('Lời bài hát', 'Có'),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Đóng', style: TextStyle(color: Colors.greenAccent)),
          ),
        ],
      ),
    );
  }

  Widget _infoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '$label: ',
            style: TextStyle(color: Colors.grey[400], fontSize: 14),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(color: Colors.white, fontSize: 14),
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
  State<_PlaylistSelectionSheet> createState() => _PlaylistSelectionSheetState();
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
      height: MediaQuery.of(context).size.height * 0.6,
      decoration: const BoxDecoration(
        color: Color(0xFF1E1E1E),
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        children: [
          // Handle bar
          Container(
            width: 40,
            height: 4,
            margin: const EdgeInsets.symmetric(vertical: 12),
            decoration: BoxDecoration(
              color: Colors.grey[600],
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
                    fontWeight: FontWeight.bold,
                  ),
                ),
                TextButton.icon(
                  onPressed: () => _showCreatePlaylistDialog(context),
                  icon: const Icon(Icons.add, color: Colors.greenAccent),
                  label: const Text(
                    'Tạo mới',
                    style: TextStyle(color: Colors.greenAccent),
                  ),
                ),
              ],
            ),
          ),
          
          const Divider(color: Colors.grey, height: 1),
          
          // Content
          Expanded(
            child: _buildContent(),
          ),
        ],
      ),
    );
  }

  Widget _buildContent() {
    if (_isLoading) {
      return const Center(
        child: CircularProgressIndicator(color: Colors.greenAccent),
      );
    }

    if (_error != null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.error_outline, color: Colors.red[300], size: 48),
            const SizedBox(height: 16),
            Text(
              _error!,
              style: TextStyle(color: Colors.grey[400]),
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
                backgroundColor: Colors.greenAccent,
                foregroundColor: Colors.black,
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
            Icon(Icons.queue_music, color: Colors.grey[600], size: 64),
            const SizedBox(height: 16),
            Text(
              'Chưa có playlist nào',
              style: TextStyle(color: Colors.grey[400], fontSize: 16),
            ),
            const SizedBox(height: 8),
            Text(
              'Tạo playlist mới để thêm bài hát',
              style: TextStyle(color: Colors.grey[600], fontSize: 14),
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: () => _showCreatePlaylistDialog(context),
              icon: const Icon(Icons.add),
              label: const Text('Tạo playlist'),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.greenAccent,
                foregroundColor: Colors.black,
              ),
            ),
          ],
        ),
      );
    }

    return ListView.builder(
      itemCount: _playlists.length,
      itemBuilder: (context, index) {
        final playlist = _playlists[index];
        final hasSong = playlist.songs.any((s) => s.id == widget.song.id);
        
        return ListTile(
          leading: Container(
            width: 50,
            height: 50,
            decoration: BoxDecoration(
              color: Colors.grey[800],
              borderRadius: BorderRadius.circular(8),
              image: playlist.displayCoverImage.isNotEmpty
                  ? DecorationImage(
                      image: NetworkImage(playlist.displayCoverImage),
                      fit: BoxFit.cover,
                    )
                  : null,
            ),
            child: playlist.displayCoverImage.isEmpty
                ? const Icon(Icons.queue_music, color: Colors.white54)
                : null,
          ),
          title: Text(
            playlist.name,
            style: const TextStyle(color: Colors.white),
          ),
          subtitle: Text(
            '${playlist.songCount} bài hát',
            style: TextStyle(color: Colors.grey[400]),
          ),
          trailing: hasSong
              ? const Icon(Icons.check_circle, color: Colors.greenAccent)
              : null,
          onTap: hasSong ? null : () => _addToPlaylist(playlist),
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
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            result.success 
                ? 'Đã thêm vào "${playlist.name}"' 
                : result.message ?? 'Thêm thất bại',
          ),
          duration: const Duration(seconds: 2),
        ),
      );
    }
  }

  void _showCreatePlaylistDialog(BuildContext context) {
    final nameController = TextEditingController();
    
    showDialog(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: const Color(0xFF1E1E1E),
        title: const Text(
          'Tạo playlist mới',
          style: TextStyle(color: Colors.white),
        ),
        content: TextField(
          controller: nameController,
          autofocus: true,
          style: const TextStyle(color: Colors.white),
          decoration: InputDecoration(
            hintText: 'Tên playlist',
            hintStyle: TextStyle(color: Colors.grey[600]),
            enabledBorder: const UnderlineInputBorder(
              borderSide: BorderSide(color: Colors.grey),
            ),
            focusedBorder: const UnderlineInputBorder(
              borderSide: BorderSide(color: Colors.greenAccent),
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Hủy', style: TextStyle(color: Colors.grey)),
          ),
          TextButton(
            onPressed: () async {
              if (nameController.text.trim().isEmpty) return;
              
              Navigator.pop(dialogContext);
              
              final result = await PlaylistApiService.createPlaylist(
                name: nameController.text.trim(),
              );

              if (result.success && result.playlist != null) {
                // Add song to the new playlist
                await PlaylistApiService.addSongToPlaylist(
                  playlistId: result.playlist!.id,
                  songId: widget.song.id,
                );
                
                if (mounted) {
                  Navigator.pop(context); // Close playlist selection sheet
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('Đã tạo và thêm vào "${nameController.text.trim()}"'),
                      duration: const Duration(seconds: 2),
                    ),
                  );
                }
              } else {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(result.message ?? 'Tạo playlist thất bại'),
                      duration: const Duration(seconds: 2),
                    ),
                  );
                }
              }
            },
            child: const Text('Tạo', style: TextStyle(color: Colors.greenAccent)),
          ),
        ],
      ),
    );
  }
}
