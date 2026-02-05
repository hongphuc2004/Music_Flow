import 'package:flutter/material.dart';
import 'package:musicflow_app/data/models/song_model.dart';
import 'package:musicflow_app/data/models/topic_model.dart';
import 'package:musicflow_app/data/services/topic_api_service.dart';

class AlbumDetailScreen extends StatefulWidget {
  final Topic topic;
  final Function(Song)? onSongTap;
  final Function(List<Song>, {int startIndex})? onPlayAll;

  const AlbumDetailScreen({
    super.key,
    required this.topic,
    this.onSongTap,
    this.onPlayAll,
  });

  @override
  State<AlbumDetailScreen> createState() => _AlbumDetailScreenState();
}

class _AlbumDetailScreenState extends State<AlbumDetailScreen> {
  List<Song> songs = [];
  bool isLoading = true;
  String? errorMessage;

  @override
  void initState() {
    super.initState();
    fetchSongs();
  }

  Future<void> fetchSongs() async {
    setState(() {
      isLoading = true;
      errorMessage = null;
    });

    try {
      final result = await TopicApiService.fetchSongsByTopic(widget.topic.id);
      setState(() {
        songs = result;
        isLoading = false;
      });
    } on TopicException catch (e) {
      setState(() {
        errorMessage = e.message;
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
    try {
      String hex = widget.topic.color.replaceAll('#', '');
      if (hex.length == 6) {
        hex = 'FF$hex';
      }
      return Color(int.parse(hex, radix: 16));
    } catch (e) {
      return Colors.green;
    }
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
          widget.topic.name,
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
                    child: widget.topic.imageUrl.isNotEmpty
                        ? Image.network(
                            widget.topic.imageUrl,
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
          Icons.album,
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
                'Chưa có bài hát nào trong album này',
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
    print('🎵 AlbumDetail: Playing song: ${song.title}');
    
    // Pop trước, rồi gọi callback sau để đảm bảo MainScreen đã hiển thị
    Navigator.pop(context);
    
    // Delay nhỏ để đảm bảo MainScreen đã render
    Future.delayed(const Duration(milliseconds: 50), () {
      // Nếu có index và onPlayAll, phát playlist từ vị trí đó
      if (index != null && widget.onPlayAll != null) {
        widget.onPlayAll!(songs, startIndex: index);
      } else if (widget.onSongTap != null) {
        widget.onSongTap!(song);
      } else {
        print('❌ AlbumDetail: No callback available!');
      }
    });
  }

  void _playAll() {
    if (songs.isEmpty) return;
    
    print('🎵 AlbumDetail: Playing all ${songs.length} songs');
    
    // Pop trước, rồi gọi callback sau
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
      trailing: IconButton(
        icon: const Icon(Icons.more_vert, color: Colors.grey),
        onPressed: () {},
      ),
      onTap: () => _playSong(song, index: index - 1),  // index - 1 vì index bắt đầu từ 1 trong UI
    );
  }
}
