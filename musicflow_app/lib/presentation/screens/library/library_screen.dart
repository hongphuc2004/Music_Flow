import 'package:flutter/material.dart';
import 'package:musicflow_app/data/models/song_model.dart';
import 'package:musicflow_app/data/models/playlist_model.dart';
import 'package:musicflow_app/data/services/playlist_api_service.dart';
import 'package:musicflow_app/data/services/play_history_service.dart';
import 'package:musicflow_app/data/services/auth_service.dart';
import 'package:musicflow_app/presentation/widgets/song_options_menu.dart';
import 'package:musicflow_app/presentation/screens/library/playlist_detail_screen.dart';
import 'package:musicflow_app/presentation/screens/library/history_screen.dart';
import 'package:musicflow_app/presentation/screens/settings/settings_screen.dart';
import 'package:musicflow_app/presentation/screens/login/login_screen.dart';

class LibraryScreen extends StatefulWidget {
  final Function(Song)? onSongTap;
  final Function(List<Song>, {int startIndex})? onPlayAll;

  const LibraryScreen({
    super.key,
    this.onSongTap,
    this.onPlayAll,
  });

  @override
  State<LibraryScreen> createState() => _LibraryScreenState();
}

class _LibraryScreenState extends State<LibraryScreen> {
  List<Playlist> _playlists = [];
  List<Song> _recentHistory = [];
  List<Song> _favoriteSongs = []; // TODO: Implement favorites from API
  
  bool _isLoadingPlaylists = false;
  bool _isLoadingHistory = false;
  bool _isLoggedIn = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    await _checkLoginStatus();
    await Future.wait([
      _loadPlaylists(),
      _loadRecentHistory(),
    ]);
  }

  Future<void> _checkLoginStatus() async {
    final isLoggedIn = await AuthService.isLoggedIn();
    if (mounted) {
      setState(() {
        _isLoggedIn = isLoggedIn;
      });
    }
  }

  Future<void> _loadPlaylists() async {
    if (!_isLoggedIn) return;
    
    setState(() => _isLoadingPlaylists = true);
    
    final result = await PlaylistApiService.getPlaylists();
    
    if (mounted) {
      setState(() {
        _isLoadingPlaylists = false;
        if (result.success) {
          _playlists = result.playlists ?? [];
        } else {
          _errorMessage = result.message;
        }
      });
    }
  }

  Future<void> _loadRecentHistory() async {
    setState(() => _isLoadingHistory = true);
    
    final history = await PlayHistoryService.getRecentHistory(limit: 3);
    
    if (mounted) {
      setState(() {
        _isLoadingHistory = false;
        _recentHistory = history;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: RefreshIndicator(
        onRefresh: _loadData,
        color: Colors.greenAccent,
        child: CustomScrollView(
          slivers: [
            // App Bar
            SliverAppBar(
              backgroundColor: Colors.black,
              floating: true,
              title: const Text(
                'Thư viện',
                style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                ),
              ),
              actions: [
                IconButton(
                  icon: const Icon(Icons.settings),
                  onPressed: _openSettings,
                  tooltip: 'Cài đặt',
                ),
              ],
            ),

            // Content
            SliverToBoxAdapter(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Recently Played Section
                  _buildRecentlyPlayedSection(),
                  
                  const SizedBox(height: 24),
                  
                  // Playlists Section
                  _buildPlaylistsSection(),
                  
                  const SizedBox(height: 24),
                  
                  // Favorites Section
                  _buildFavoritesSection(),
                  
                  // Bottom padding for mini player
                  const SizedBox(height: 100),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ==================== RECENTLY PLAYED ====================
  Widget _buildRecentlyPlayedSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  const Icon(Icons.history, color: Colors.greenAccent, size: 24),
                  const SizedBox(width: 8),
                  const Text(
                    'Nghe gần đây',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
              TextButton(
                onPressed: _openFullHistory,
                child: const Text(
                  'Xem tất cả',
                  style: TextStyle(color: Colors.greenAccent),
                ),
              ),
            ],
          ),
        ),
        
        if (_isLoadingHistory)
          const Center(
            child: Padding(
              padding: EdgeInsets.all(20),
              child: CircularProgressIndicator(color: Colors.greenAccent),
            ),
          )
        else if (_recentHistory.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
            child: Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.grey[900],
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: [
                  Icon(Icons.music_note, color: Colors.grey[600], size: 40),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Text(
                      'Chưa có lịch sử phát nhạc.\nHãy phát một bài hát!',
                      style: TextStyle(color: Colors.grey[400], fontSize: 14),
                    ),
                  ),
                ],
              ),
            ),
          )
        else
          ListView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: _recentHistory.length,
            itemBuilder: (context, index) {
              final song = _recentHistory[index];
              return _buildSongTile(song);
            },
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
    ).then((_) => _loadRecentHistory()); // Refresh on return
  }

  void _openSettings() {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => SettingsScreen(
          onLogout: () {
            // Reload data after logout
            _loadData();
          },
        ),
      ),
    ).then((_) => _loadData()); // Refresh on return
  }

  // ==================== PLAYLISTS ====================
  Widget _buildPlaylistsSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(
            children: [
              const Icon(Icons.queue_music, color: Colors.greenAccent, size: 24),
              const SizedBox(width: 8),
              const Expanded(
                child: Text(
                  'Playlist của bạn',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              if (_isLoggedIn)
                IconButton(
                  icon: const Icon(Icons.add_circle_outline, color: Colors.greenAccent),
                  onPressed: _showCreatePlaylistDialog,
                  tooltip: 'Tạo playlist mới',
                ),
            ],
          ),
        ),
        
        if (!_isLoggedIn)
          _buildLoginPrompt()
        else if (_isLoadingPlaylists)
          const Center(
            child: Padding(
              padding: EdgeInsets.all(20),
              child: CircularProgressIndicator(color: Colors.greenAccent),
            ),
          )
        else if (_playlists.isEmpty)
          _buildEmptyPlaylistState()
        else
          ListView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: _playlists.length,
            itemBuilder: (context, index) {
              final playlist = _playlists[index];
              return _buildPlaylistTile(playlist);
            },
          ),
      ],
    );
  }

  Widget _buildLoginPrompt() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [Colors.greenAccent.withOpacity(0.2), Colors.teal.withOpacity(0.1)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.greenAccent.withOpacity(0.3)),
        ),
        child: Column(
          children: [
            const Icon(Icons.lock_outline, color: Colors.greenAccent, size: 40),
            const SizedBox(height: 12),
            const Text(
              'Đăng nhập để xem playlist',
              style: TextStyle(
                color: Colors.white,
                fontSize: 16,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Tạo và quản lý playlist cá nhân của bạn',
              style: TextStyle(color: Colors.grey[400], fontSize: 14),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const LoginScreen()),
                ).then((_) => _loadData()); // Refresh after login
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.greenAccent,
                foregroundColor: Colors.black,
                padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 12),
              ),
              child: const Text('Đăng nhập'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyPlaylistState() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Colors.grey[900],
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          children: [
            Icon(Icons.playlist_add, color: Colors.grey[600], size: 48),
            const SizedBox(height: 12),
            const Text(
              'Chưa có playlist nào',
              style: TextStyle(
                color: Colors.white,
                fontSize: 16,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Tạo playlist để lưu những bài hát yêu thích',
              style: TextStyle(color: Colors.grey[400], fontSize: 14),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            OutlinedButton.icon(
              onPressed: _showCreatePlaylistDialog,
              icon: const Icon(Icons.add),
              label: const Text('Tạo playlist'),
              style: OutlinedButton.styleFrom(
                foregroundColor: Colors.greenAccent,
                side: const BorderSide(color: Colors.greenAccent),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPlaylistTile(Playlist playlist) {
    return ListTile(
      leading: Container(
        width: 56,
        height: 56,
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
            ? const Icon(Icons.queue_music, color: Colors.white54, size: 28)
            : null,
      ),
      title: Text(
        playlist.name,
        style: const TextStyle(
          color: Colors.white,
          fontWeight: FontWeight.w500,
        ),
      ),
      subtitle: Text(
        '${playlist.songCount} bài hát',
        style: TextStyle(color: Colors.grey[400]),
      ),
      trailing: IconButton(
        icon: const Icon(Icons.more_vert, color: Colors.grey),
        onPressed: () => _showPlaylistOptions(playlist),
      ),
      onTap: () => _openPlaylistDetail(playlist),
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
    ).then((_) => _loadPlaylists()); // Refresh on return
  }

  void _showPlaylistOptions(Playlist playlist) {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF1E1E1E),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 40,
            height: 4,
            margin: const EdgeInsets.symmetric(vertical: 12),
            decoration: BoxDecoration(
              color: Colors.grey[600],
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          ListTile(
            leading: const Icon(Icons.edit, color: Colors.white70),
            title: const Text('Đổi tên playlist', style: TextStyle(color: Colors.white)),
            onTap: () {
              Navigator.pop(context);
              _showRenamePlaylistDialog(playlist);
            },
          ),
          ListTile(
            leading: const Icon(Icons.delete_outline, color: Colors.redAccent),
            title: const Text('Xóa playlist', style: TextStyle(color: Colors.redAccent)),
            onTap: () {
              Navigator.pop(context);
              _confirmDeletePlaylist(playlist);
            },
          ),
          const SizedBox(height: 16),
        ],
      ),
    );
  }

  void _showRenamePlaylistDialog(Playlist playlist) {
    final controller = TextEditingController(text: playlist.name);
    
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF1E1E1E),
        title: const Text('Đổi tên playlist', style: TextStyle(color: Colors.white)),
        content: TextField(
          controller: controller,
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
            onPressed: () => Navigator.pop(context),
            child: const Text('Hủy', style: TextStyle(color: Colors.grey)),
          ),
          TextButton(
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
                    const SnackBar(content: Text('Đã đổi tên playlist')),
                  );
                }
              }
            },
            child: const Text('Lưu', style: TextStyle(color: Colors.greenAccent)),
          ),
        ],
      ),
    );
  }

  void _confirmDeletePlaylist(Playlist playlist) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF1E1E1E),
        title: const Text('Xóa playlist?', style: TextStyle(color: Colors.white)),
        content: Text(
          'Bạn có chắc muốn xóa "${playlist.name}"?\nHành động này không thể hoàn tác.',
          style: TextStyle(color: Colors.grey[400]),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Hủy', style: TextStyle(color: Colors.grey)),
          ),
          TextButton(
            onPressed: () async {
              Navigator.pop(context);
              
              final result = await PlaylistApiService.deletePlaylist(playlist.id);
              
              if (result.success) {
                _loadPlaylists();
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Đã xóa playlist')),
                  );
                }
              }
            },
            child: const Text('Xóa', style: TextStyle(color: Colors.redAccent)),
          ),
        ],
      ),
    );
  }

  void _showCreatePlaylistDialog() async {
    if (!_isLoggedIn) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Vui lòng đăng nhập để tạo playlist')),
      );
      return;
    }
    
    final controller = TextEditingController();
    
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF1E1E1E),
        title: const Text('Tạo playlist mới', style: TextStyle(color: Colors.white)),
        content: TextField(
          controller: controller,
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
            onPressed: () => Navigator.pop(context),
            child: const Text('Hủy', style: TextStyle(color: Colors.grey)),
          ),
          TextButton(
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
                    SnackBar(content: Text('Đã tạo "${controller.text.trim()}"')),
                  );
                }
              } else {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text(result.message ?? 'Tạo playlist thất bại')),
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

  // ==================== FAVORITES ====================
  Widget _buildFavoritesSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(
            children: [
              const Icon(Icons.favorite, color: Colors.redAccent, size: 24),
              const SizedBox(width: 8),
              const Text(
                'Bài hát yêu thích',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
        ),
        
        if (_favoriteSongs.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.grey[900],
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: [
                  Icon(Icons.favorite_border, color: Colors.grey[600], size: 40),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Text(
                      'Chưa có bài hát yêu thích.\nNhấn ❤️ để thêm vào danh sách.',
                      style: TextStyle(color: Colors.grey[400], fontSize: 14),
                    ),
                  ),
                ],
              ),
            ),
          )
        else
          ListView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: _favoriteSongs.length,
            itemBuilder: (context, index) {
              final song = _favoriteSongs[index];
              return _buildSongTile(song, isFavorite: true);
            },
          ),
      ],
    );
  }

  // ==================== COMMON ====================
  Widget _buildSongTile(Song song, {bool isFavorite = false}) {
    return ListTile(
      leading: ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: Image.network(
          song.imageUrl,
          width: 50,
          height: 50,
          fit: BoxFit.cover,
          errorBuilder: (_, __, ___) => Container(
            width: 50,
            height: 50,
            color: Colors.grey[800],
            child: Icon(
              isFavorite ? Icons.favorite : Icons.music_note,
              color: isFavorite ? Colors.redAccent : Colors.white54,
            ),
          ),
        ),
      ),
      title: Text(
        song.title,
        style: const TextStyle(color: Colors.white),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
      subtitle: Text(
        song.artist,
        style: TextStyle(color: Colors.grey[400]),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
      trailing: SongOptionsMenu(song: song),
      onTap: () => widget.onSongTap?.call(song),
    );
  }
}
