import 'package:flutter/material.dart';
import 'package:musicflow_app/data/models/playlist_model.dart';
import 'package:musicflow_app/data/models/song_model.dart';
import 'package:musicflow_app/data/services/playlist_api_service.dart';
import 'package:musicflow_app/presentation/widgets/song_options_menu.dart';

class AlbumDetailScreen extends StatefulWidget {
  final Playlist playlist;
  final Function(Song)? onSongTap;
  final Function(List<Song>, {int startIndex})? onPlayAll;

  const AlbumDetailScreen({
    super.key,
    required this.playlist,
    this.onSongTap,
    this.onPlayAll,
  });

  @override
  State<AlbumDetailScreen> createState() => _AlbumDetailScreenState();
}

class _AlbumDetailScreenState extends State<AlbumDetailScreen> {
  List<Song> songs = [];
  Playlist? playlistDetail;
  bool isLoading = true;
  String? errorMessage;

  @override
  void initState() {
    super.initState();
    playlistDetail = widget.playlist;
    songs = widget.playlist.songs;
    fetchSongs();
  }

  Future<void> fetchSongs() async {
    setState(() {
      isLoading = true;
      errorMessage = null;
    });

    try {
      final result = await PlaylistApiService.getSystemPlaylist(widget.playlist.id);
      if (!result.success || result.playlist == null) {
        throw Exception(result.message ?? 'Không thể tải playlist hệ thống');
      }
      setState(() {
        playlistDetail = result.playlist;
        songs = result.playlist!.songs;
        isLoading = false;
      });
    } catch (e) {
      setState(() {
        errorMessage = 'Đã xảy ra lỗi: $e';
        isLoading = false;
      });
    }
  }

  Color get albumColor {
    // Default color since we no longer store color in Topic
    return const Color(0xFF6c63ff);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: CustomScrollView(
        slivers: [
          _buildSliverAppBar(),
          _buildBody(),
        ],
      ),
    );
  }

  Widget _buildSliverAppBar() {
    return SliverAppBar(
      expandedHeight: 280,
      pinned: true,
      backgroundColor: albumColor.withOpacity(0.8),
      flexibleSpace: FlexibleSpaceBar(
        title: Text(
          playlistDetail?.name ?? widget.playlist.name,
          style: const TextStyle(
            fontWeight: FontWeight.bold,
            shadows: [
              Shadow(
                offset: Offset(0, 1),
                blurRadius: 4,
                color: Colors.black54,
              ),
            ],
          ),
        ),
        background: Stack(
          fit: StackFit.expand,
          children: [
            // Background gradient
            Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    albumColor,
                    albumColor.withOpacity(0.6),
                    Colors.black87,
                  ],
                ),
              ),
            ),
            // Album cover
            Center(
              child: Padding(
                padding: const EdgeInsets.only(bottom: 40),
                child: Container(
                  width: 180,
                  height: 180,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(12),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.4),
                        blurRadius: 20,
                        offset: const Offset(0, 10),
                      ),
                    ],
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: (playlistDetail?.displayCoverImage ?? widget.playlist.displayCoverImage).isNotEmpty
                        ? Image.network(
                            playlistDetail?.displayCoverImage ?? widget.playlist.displayCoverImage,
                            fit: BoxFit.cover,
                            errorBuilder: (_, __, ___) => _buildPlaceholderCover(),
                          )
                        : _buildPlaceholderCover(),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPlaceholderCover() {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            albumColor.withOpacity(0.8),
            albumColor.withOpacity(0.4),
          ],
        ),
      ),
      child: Center(
        child: Icon(
          Icons.queue_music,
          size: 80,
          color: Colors.white.withOpacity(0.8),
        ),
      ),
    );
  }

  Widget _buildBody() {
    if (isLoading) {
      return const SliverFillRemaining(
        child: Center(
          child: CircularProgressIndicator(color: Colors.greenAccent),
        ),
      );
    }

    if (errorMessage != null) {
      return SliverFillRemaining(
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline, size: 48, color: Colors.grey),
              const SizedBox(height: 16),
              Text(
                errorMessage!,
                style: const TextStyle(color: Colors.grey),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: fetchSongs,
                style: ElevatedButton.styleFrom(
                  backgroundColor: albumColor,
                ),
                child: const Text('Thử lại'),
              ),
            ],
          ),
        ),
      );
    }

    if (songs.isEmpty) {
      return const SliverFillRemaining(
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.music_off, size: 64, color: Colors.grey),
              SizedBox(height: 16),
              Text(
                'Chưa có bài hát nào trong playlist này',
                style: TextStyle(color: Colors.grey, fontSize: 16),
              ),
            ],
          ),
        ),
      );
    }

    return SliverPadding(
      padding: const EdgeInsets.only(bottom: 80),
      sliver: SliverList(
        delegate: SliverChildBuilderDelegate(
          (context, index) {
            if (index == 0) {
              return _buildPlayAllButton();
            }
            final song = songs[index - 1];
            return _buildSongTile(song, index);
          },
          childCount: songs.length + 1,
        ),
      ),
    );
  }

  void _playSong(Song song, {int? index}) {
    Navigator.pop(context);
    
    Future.delayed(const Duration(milliseconds: 50), () {
      if (index != null && widget.onPlayAll != null) {
        widget.onPlayAll!(songs, startIndex: index);
      } else if (widget.onSongTap != null) {
        widget.onSongTap!(song);
      }
    });
  }

  void _playAll() {
    if (songs.isEmpty) return;
    
    Navigator.pop(context);
    
    Future.delayed(const Duration(milliseconds: 50), () {
      if (widget.onPlayAll != null) {
        widget.onPlayAll!(songs, startIndex: 0);
      } else if (widget.onSongTap != null) {
        widget.onSongTap!(songs.first);
      }
    });
  }

  Widget _buildPlayAllButton() {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          Text(
            '${songs.length} bài hát',
            style: TextStyle(
              color: Colors.grey[400],
              fontSize: 14,
            ),
          ),
          const Spacer(),
          ElevatedButton.icon(
            onPressed: songs.isNotEmpty ? _playAll : null,
            icon: const Icon(Icons.play_arrow),
            label: const Text('Phát tất cả'),
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
    );
  }

  Widget _buildSongTile(Song song, int index) {
    return ListTile(
      leading: SizedBox(
        width: 50,
        child: Row(
          children: [
            SizedBox(
              width: 20,
              child: Text(
                '$index',
                style: TextStyle(
                  color: Colors.grey[500],
                  fontSize: 14,
                ),
              ),
            ),
            const SizedBox(width: 8),
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: Image.network(
                song.imageUrl,
                width: 22,
                height: 22,
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => Container(
                  width: 22,
                  height: 22,
                  color: albumColor.withOpacity(0.3),
                  child: const Icon(Icons.music_note, size: 14, color: Colors.white54),
                ),
              ),
            ),
          ],
        ),
      ),
      title: Text(
        song.title,
        style: const TextStyle(
          fontWeight: FontWeight.w500,
        ),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
      subtitle: Text(
        song.artist,
        style: TextStyle(
          color: Colors.grey[400],
          fontSize: 13,
        ),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
      trailing: SongOptionsMenu(song: song),
      onTap: () => _playSong(song, index: index - 1),  // Click anywhere to play
    );
  }
}
