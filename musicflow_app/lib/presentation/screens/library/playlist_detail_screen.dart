import 'package:flutter/material.dart';
import 'package:musicflow_app/data/models/song_model.dart';
import 'package:musicflow_app/data/models/playlist_model.dart';
import 'package:musicflow_app/data/services/playlist_api_service.dart';
import 'package:musicflow_app/presentation/widgets/song_options_menu.dart';
import 'package:musicflow_app/presentation/widgets/mini_player.dart';
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

  void _playAll() {
    if (_playlist.songs.isEmpty) return;
    widget.onPlayAll?.call(_playlist.songs, startIndex: 0);
  }

  void _playSong(Song song, int index) {
    if (widget.onPlayAll != null) {
      widget.onPlayAll!(_playlist.songs, startIndex: index);
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
          SnackBar(content: Text('Đã xóa "${song.title}" khỏi playlist')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          RefreshIndicator(
            onRefresh: _refreshPlaylist,
            color: Colors.greenAccent,
            child: CustomScrollView(
              slivers: [
                // App Bar with cover image
                SliverAppBar(
                  expandedHeight: 280,
                  pinned: true,
                  backgroundColor: Colors.black,
                  flexibleSpace: FlexibleSpaceBar(
                    title: Text(
                      _playlist.name,
                      style: const TextStyle(
                    fontWeight: FontWeight.bold,
                    shadows: [
                      Shadow(color: Colors.black, blurRadius: 10),
                    ],
                  ),
                ),
                background: Stack(
                  fit: StackFit.expand,
                  children: [
                    // Cover image
                    if (_playlist.displayCoverImage.isNotEmpty)
                      Image.network(
                        _playlist.displayCoverImage,
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => _buildDefaultCover(),
                      )
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
                            Colors.black.withOpacity(0.7),
                            Colors.black,
                          ],
                          stops: const [0.3, 0.7, 1.0],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              actions: [
                IconButton(
                  icon: const Icon(Icons.more_vert),
                  onPressed: _showPlaylistOptions,
                ),
              ],
            ),

            // Playlist info and play button
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (_playlist.description.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Text(
                          _playlist.description,
                          style: TextStyle(color: Colors.grey[400]),
                        ),
                      ),
                    
                    Row(
                      children: [
                        Text(
                          '${_playlist.songCount} bài hát',
                          style: TextStyle(color: Colors.grey[400]),
                        ),
                        const Spacer(),
                        
                        // Shuffle button
                        IconButton(
                          icon: const Icon(Icons.shuffle, color: Colors.greenAccent),
                          onPressed: _playlist.songs.isNotEmpty ? () {
                            // TODO: Shuffle play
                          } : null,
                        ),
                        
                        // Play all button
                        ElevatedButton.icon(
                          onPressed: _playlist.songs.isNotEmpty ? _playAll : null,
                          icon: const Icon(Icons.play_arrow),
                          label: const Text('Phát'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.greenAccent,
                            foregroundColor: Colors.black,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(20),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),

            // Song list
            if (_isLoading)
              const SliverToBoxAdapter(
                child: Center(
                  child: Padding(
                    padding: EdgeInsets.all(40),
                    child: CircularProgressIndicator(color: Colors.greenAccent),
                  ),
                ),
              )
            else if (_playlist.songs.isEmpty)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.all(40),
                  child: Column(
                    children: [
                      Icon(Icons.music_off, color: Colors.grey[600], size: 64),
                      const SizedBox(height: 16),
                      Text(
                        'Playlist trống',
                        style: TextStyle(color: Colors.grey[400], fontSize: 18),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Thêm bài hát vào playlist từ thư viện',
                        style: TextStyle(color: Colors.grey[600], fontSize: 14),
                      ),
                    ],
                  ),
                ),
              )
            else
              SliverList(
                delegate: SliverChildBuilderDelegate(
                  (context, index) {
                    final song = _playlist.songs[index];
                    return _buildSongTile(song, index);
                  },
                  childCount: _playlist.songs.length,
                ),
              ),

            // Bottom padding
            const SliverToBoxAdapter(
              child: SizedBox(height: 100),
            ),
          ],
        ),
      ),
          
          // Mini Player - hiển thị khi có bài hát đang phát
          if (_audioState.currentSong != null)
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: MiniPlayer(
                isPlaying: _audioState.isPlaying,
                songTitle: _audioState.currentSong!.title,
                artist: _audioState.currentSong!.artist,
                song: _audioState.currentSong,
                progress: _audioState.progress,
                playlist: _audioState.playlist,
                currentIndex: _audioState.currentIndex,
                onPlayPause: _audioState.togglePlayPause,
                onNext: _audioState.playNext,
                onPrevious: _audioState.playPrevious,
                onPlaylistItemTap: _audioState.playAtIndex,
                onClose: _audioState.stop,
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildDefaultCover() {
    return Container(
      color: Colors.grey[900],
      child: const Icon(
        Icons.queue_music,
        color: Colors.white24,
        size: 100,
      ),
    );
  }

  Widget _buildSongTile(Song song, int index) {
    return Dismissible(
      key: Key(song.id),
      direction: DismissDirection.endToStart,
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 20),
        color: Colors.red.withOpacity(0.2),
        child: const Icon(Icons.delete, color: Colors.redAccent),
      ),
      confirmDismiss: (direction) async {
        return await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            backgroundColor: const Color(0xFF1E1E1E),
            title: const Text('Xóa bài hát?', style: TextStyle(color: Colors.white)),
            content: Text(
              'Xóa "${song.title}" khỏi playlist?',
              style: TextStyle(color: Colors.grey[400]),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: const Text('Hủy', style: TextStyle(color: Colors.grey)),
              ),
              TextButton(
                onPressed: () => Navigator.pop(context, true),
                child: const Text('Xóa', style: TextStyle(color: Colors.redAccent)),
              ),
            ],
          ),
        ) ?? false;
      },
      onDismissed: (_) => _removeSong(song),
      child: ListTile(
        leading: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox(
              width: 24,
              child: Text(
                '${index + 1}',
                style: TextStyle(color: Colors.grey[500]),
              ),
            ),
            const SizedBox(width: 8),
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: Image.network(
                song.imageUrl,
                width: 45,
                height: 45,
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => Container(
                  width: 45,
                  height: 45,
                  color: Colors.grey[800],
                  child: const Icon(Icons.music_note, color: Colors.white54),
                ),
              ),
            ),
          ],
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
          currentPlaylistId: _playlist.id,
          onRemovedFromPlaylist: _refreshPlaylist,
        ),
        onTap: () => _playSong(song, index),
      ),
    );
  }

  void _showPlaylistOptions() {
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
            title: const Text('Chỉnh sửa playlist', style: TextStyle(color: Colors.white)),
            onTap: () {
              Navigator.pop(context);
              _showEditDialog();
            },
          ),
          ListTile(
            leading: const Icon(Icons.share, color: Colors.white70),
            title: const Text('Chia sẻ', style: TextStyle(color: Colors.white)),
            onTap: () {
              Navigator.pop(context);
              // TODO: Share playlist
            },
          ),
          ListTile(
            leading: const Icon(Icons.delete_outline, color: Colors.redAccent),
            title: const Text('Xóa playlist', style: TextStyle(color: Colors.redAccent)),
            onTap: () {
              Navigator.pop(context);
              _confirmDelete();
            },
          ),
          const SizedBox(height: 16),
        ],
      ),
    );
  }

  void _showEditDialog() {
    final nameController = TextEditingController(text: _playlist.name);
    final descController = TextEditingController(text: _playlist.description);
    
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF1E1E1E),
        title: const Text('Chỉnh sửa playlist', style: TextStyle(color: Colors.white)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: nameController,
              style: const TextStyle(color: Colors.white),
              decoration: InputDecoration(
                labelText: 'Tên playlist',
                labelStyle: TextStyle(color: Colors.grey[400]),
                enabledBorder: const UnderlineInputBorder(
                  borderSide: BorderSide(color: Colors.grey),
                ),
                focusedBorder: const UnderlineInputBorder(
                  borderSide: BorderSide(color: Colors.greenAccent),
                ),
              ),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: descController,
              style: const TextStyle(color: Colors.white),
              maxLines: 2,
              decoration: InputDecoration(
                labelText: 'Mô tả (tùy chọn)',
                labelStyle: TextStyle(color: Colors.grey[400]),
                enabledBorder: const UnderlineInputBorder(
                  borderSide: BorderSide(color: Colors.grey),
                ),
                focusedBorder: const UnderlineInputBorder(
                  borderSide: BorderSide(color: Colors.greenAccent),
                ),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Hủy', style: TextStyle(color: Colors.grey)),
          ),
          TextButton(
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
                    const SnackBar(content: Text('Đã cập nhật playlist')),
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

  void _confirmDelete() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF1E1E1E),
        title: const Text('Xóa playlist?', style: TextStyle(color: Colors.white)),
        content: Text(
          'Bạn có chắc muốn xóa "${_playlist.name}"?\nHành động này không thể hoàn tác.',
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
              
              final result = await PlaylistApiService.deletePlaylist(_playlist.id);
              
              if (result.success) {
                if (mounted) {
                  Navigator.pop(context); // Return to library
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
}
