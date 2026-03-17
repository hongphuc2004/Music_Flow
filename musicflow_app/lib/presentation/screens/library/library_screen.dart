import 'package:flutter/material.dart';
import 'package:musicflow_app/data/models/song_model.dart';
import 'package:musicflow_app/data/models/playlist_model.dart';
import 'package:musicflow_app/data/services/playlist_api_service.dart';
import 'package:musicflow_app/data/services/play_history_service.dart';
import 'package:musicflow_app/data/services/auth_service.dart';
import 'package:musicflow_app/data/services/favorite_service.dart';
import 'package:musicflow_app/data/services/song_api_service.dart';
import 'package:musicflow_app/data/services/offline_song_service.dart';
import 'package:musicflow_app/presentation/widgets/song_options_menu.dart';
import 'package:musicflow_app/presentation/screens/library/history_screen.dart';
import 'package:musicflow_app/presentation/screens/settings/settings_screen.dart';
import 'package:musicflow_app/presentation/screens/library/your_uploads_screen.dart';
import 'package:musicflow_app/presentation/screens/library/favorites_screen.dart';
import 'package:musicflow_app/presentation/screens/library/playlists_screen.dart';
import 'package:musicflow_app/presentation/screens/library/downloaded_songs_screen.dart';

class LibraryScreen extends StatefulWidget {
  final Function(Song)? onSongTap;
  final Function(List<Song>, {int startIndex})? onPlayAll;

  const LibraryScreen({
    super.key,
    this.onSongTap,
    this.onPlayAll,
  });

  @override
  State<LibraryScreen> createState() => LibraryScreenState();
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
    _loadData();
  }

  /// Refresh all data - có thể gọi từ bên ngoài
  Future<void> refresh() async {
    await _loadData();
  }

  /// Chỉ refresh favorites - dùng khi toggle favorite
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
      });
    }
  }

  Future<void> _loadPlaylists() async {
    if (!_isLoggedIn) return;
    
    final result = await PlaylistApiService.getPlaylists();
    
    if (mounted && result.success) {
      setState(() {
        _playlists = result.playlists ?? [];
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

  Future<void> _loadFavorites() async {
    if (!_isLoggedIn) return;
    
    final result = await FavoriteService.getFavorites();
    
    if (mounted && result.success) {
      setState(() {
        _favoriteSongs = result.favorites ?? [];
      });
    }
  }

  Future<void> _loadUploadedSongsCount() async {
    if (!_isLoggedIn) return;
    
    final result = await SongApiService.getMyUploads();
    
    if (mounted && result.success) {
      setState(() {
        _uploadedSongsCount = result.songs.length;
      });
    }
  }

  Future<void> _loadDownloadedSongsCount() async {
    final count = await OfflineSongService().getDownloadedSongsCount();

    if (mounted) {
      setState(() {
        _downloadedSongsCount = count;
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
                  // Menu Section (like SoundCloud)
                  _buildMenuSection(),
                  
                  const SizedBox(height: 24),
                  
                  // Recently Played Section
                  _buildRecentlyPlayedSection(),
                  
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

  // ==================== MENU SECTION ====================
  Widget _buildMenuSection() {
    return Column(
      children: [
        _buildMenuItem(
          icon: Icons.favorite,
          iconColor: Colors.red,
          title: 'Bài hát yêu thích',
          subtitle: _favoriteSongs.isNotEmpty ? '${_favoriteSongs.length} bài hát' : null,
          onTap: _openFavorites,
        ),
        _buildMenuItem(
          icon: Icons.queue_music,
          iconColor: Colors.greenAccent,
          title: 'Playlists',
          subtitle: _playlists.isNotEmpty ? '${_playlists.length} playlist' : null,
          onTap: _openPlaylists,
        ),
        _buildMenuItem(
          icon: Icons.cloud_upload,
          iconColor: Colors.blueAccent,
          title: 'Bài hát của bạn',
          subtitle: _uploadedSongsCount > 0 ? '$_uploadedSongsCount bài hát' : null,
          onTap: _openYourUploads,
        ),
        _buildMenuItem(
          icon: Icons.download_done,
          iconColor: Colors.greenAccent,
          title: 'Bài hát đã tải',
          subtitle: _downloadedSongsCount > 0 ? '$_downloadedSongsCount bài hát' : null,
          onTap: _openDownloadedSongs,
        ),
      ],
    );
  }

  Widget _buildMenuItem({
    required IconData icon,
    required Color iconColor,
    required String title,
    String? subtitle,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          border: Border(
            bottom: BorderSide(color: Colors.grey[900]!, width: 0.5),
          ),
        ),
        child: Row(
          children: [
            Icon(icon, color: iconColor, size: 24),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 16,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  if (subtitle != null)
                    Text(
                      subtitle,
                      style: TextStyle(
                        color: Colors.grey[500],
                        fontSize: 12,
                      ),
                    ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, color: Colors.grey),
          ],
        ),
      ),
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
      trailing: SongOptionsMenu(
        song: song,
        onFavoriteChanged: isFavorite ? refreshFavorites : null,
      ),
      onTap: () => widget.onSongTap?.call(song),
    );
  }
}
