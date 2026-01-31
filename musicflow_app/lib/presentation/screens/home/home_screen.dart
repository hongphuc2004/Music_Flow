import 'package:flutter/material.dart';
import 'package:musicflow_app/data/models/song_model.dart';
import 'package:musicflow_app/data/services/song_api_service.dart';

class HomeScreen extends StatefulWidget {
  final Function(Song)? onSongTap;  
  
  const HomeScreen({super.key, this.onSongTap});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  List<Song> songs = [];
  bool isLoading = true;
  String? errorMessage;  // Lưu lỗi để hiển thị

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
      final result = await SongApiService.fetchSongs();
      setState(() {
        songs = result;
        isLoading = false;
      });
    } on NetworkException catch (e) {
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
      onRefresh: fetchSongs,
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
              onPressed: fetchSongs,
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
    return SizedBox(
      height: 180,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.all(12),
        itemCount: songs.length,
        itemBuilder: (context, index) {
          final song = songs[index];

          return GestureDetector(
            onTap: () => _onSongTap(song),  // Gọi callback
            child: Container(
              width: 140,
              margin: const EdgeInsets.only(right: 12),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                image: DecorationImage(
                  image: NetworkImage(song.imageUrl),
                  fit: BoxFit.cover,
                  onError: (_, __) {},  // Handle ảnh lỗi
                ),
              ),
            ),
          );
        },
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
          trailing: const Icon(Icons.play_arrow),
          onTap: () => _onSongTap(song),  // Gọi callback
        );
      },
    );
  }
}