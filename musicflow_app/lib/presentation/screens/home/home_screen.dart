import 'package:flutter/material.dart';
import 'package:musicflow_app/data/models/song_model.dart';
import 'package:musicflow_app/data/models/topic_model.dart';
import 'package:musicflow_app/data/services/song_api_service.dart';
import 'package:musicflow_app/data/services/topic_api_service.dart';
import 'package:musicflow_app/presentation/screens/home/album_detail_screen.dart';
import 'package:musicflow_app/presentation/widgets/song_options_menu.dart';

class HomeScreen extends StatefulWidget {
  final Function(Song)? onSongTap;
  final Function(List<Song>, {int startIndex})? onPlayAll;
  
  const HomeScreen({super.key, this.onSongTap, this.onPlayAll});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  List<Song> songs = [];
  List<Topic> topics = [];
  bool isLoading = true;
  String? errorMessage;

  @override
  void initState() {
    super.initState();
    fetchData();
  }

  Future<void> fetchData() async {
    setState(() {
      isLoading = true;
      errorMessage = null;
    });
    
    try {
      // Fetch songs và topics song song
      final results = await Future.wait([
        SongApiService.fetchSongs(),
        TopicApiService.fetchTopics(),
      ]);
      
      setState(() {
        songs = results[0] as List<Song>;
        topics = results[1] as List<Topic>;
        isLoading = false;
      });
    } on NetworkException catch (e) {
      setState(() {
        errorMessage = e.message;
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

  void _onSongTap(Song song) {
    // Gọi callback để MainScreen biết và hiện MiniPlayer
    widget.onSongTap?.call(song);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            Image.asset('assets/images/logo.png', width: 28, height: 28),
            const SizedBox(width: 8),
            const Text('MusicFlow'),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.search),
            onPressed: () {},
          ),
        ],
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    // Loading
    if (isLoading) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            CircularProgressIndicator(color: Colors.greenAccent),
            SizedBox(height: 16),
            Text('Đang tải...', style: TextStyle(color: Colors.grey)),
          ],
        ),
      );
    }

    // Error
    if (errorMessage != null) {
      return _buildErrorWidget();
    }

    // Content với Pull to Refresh
    return RefreshIndicator(
      onRefresh: fetchData,
      color: Colors.greenAccent,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.only(bottom: 80),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildHeader(),
            _songList(),
          ],
        ),
      ),
    );
  }

  Widget _buildErrorWidget() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.wifi_off, size: 64, color: Colors.grey),
            const SizedBox(height: 16),
            Text(
              errorMessage!,
              style: const TextStyle(color: Colors.white70, fontSize: 16),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: fetchData,
              icon: const Icon(Icons.refresh),
              label: const Text('Thử lại'),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.greenAccent,
                foregroundColor: Colors.black,
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    if (topics.isEmpty) {
      return const SizedBox.shrink();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.fromLTRB(16, 16, 16, 12),
          child: Text(
            'Albums',
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.bold,
              color: Colors.white,
            ),
          ),
        ),
        SizedBox(
          height: 200,
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            itemCount: topics.length,
            itemBuilder: (context, index) {
              final topic = topics[index];
              return _buildAlbumCard(topic);
            },
          ),
        ),
        const SizedBox(height: 16),
        const Padding(
          padding: EdgeInsets.fromLTRB(16, 0, 16, 8),
          child: Text(
            'Tất cả bài hát',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: Colors.white,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildAlbumCard(Topic topic) {
    // Parse color từ hex string
    Color albumColor;
    try {
      String hex = topic.color.replaceAll('#', '');
      if (hex.length == 6) {
        hex = 'FF$hex';
      }
      albumColor = Color(int.parse(hex, radix: 16));
    } catch (e) {
      albumColor = Colors.green;
    }

    return GestureDetector(
      onTap: () => _onAlbumTap(topic),
      child: Container(
        width: 150,
        margin: const EdgeInsets.only(right: 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Album cover
            Container(
              width: 150,
              height: 150,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(8),
                color: albumColor.withOpacity(0.3),
                boxShadow: [
                  BoxShadow(
                    color: albumColor.withOpacity(0.3),
                    blurRadius: 8,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: topic.imageUrl.isNotEmpty
                    ? Image.network(
                        topic.imageUrl,
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => _buildPlaceholderCover(albumColor, topic.name),
                      )
                    : _buildPlaceholderCover(albumColor, topic.name),
              ),
            ),
            const SizedBox(height: 8),
            // Album name
            Text(
              topic.name,
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: Colors.white,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            // Description
            if (topic.description.isNotEmpty)
              Text(
                topic.description,
                style: TextStyle(
                  fontSize: 12,
                  color: Colors.grey[400],
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildPlaceholderCover(Color color, String name) {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            color,
            color.withOpacity(0.6),
          ],
        ),
      ),
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.album,
              size: 48,
              color: Colors.white.withOpacity(0.8),
            ),
            const SizedBox(height: 8),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8),
              child: Text(
                name,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  color: Colors.white.withOpacity(0.9),
                ),
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _onAlbumTap(Topic topic) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => AlbumDetailScreen(
          topic: topic,
          onSongTap: widget.onSongTap,
          onPlayAll: widget.onPlayAll,
        ),
      ),
    );
  }

  Widget _songList() {
    return ListView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: songs.length,
      itemBuilder: (context, index) {
        final song = songs[index];

        return ListTile(
          leading: CircleAvatar(
            backgroundImage: NetworkImage(song.imageUrl),
            onBackgroundImageError: (_, __) {},  // Handle ảnh lỗi
            child: song.imageUrl.isEmpty 
                ? const Icon(Icons.music_note, color: Colors.white70)
                : null,
          ),
          title: Text(song.title),
          subtitle: Text(song.artist),
          trailing: SongOptionsMenu(song: song),
          onTap: () => _onSongTap(song),  // Click anywhere to play
        );
      },
    );
  }
}