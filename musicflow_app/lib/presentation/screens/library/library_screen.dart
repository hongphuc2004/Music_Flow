import 'package:flutter/material.dart';

class LibraryScreen extends StatefulWidget {
  const LibraryScreen({super.key});

  @override
  State<LibraryScreen> createState() => _LibraryScreenState();
}

class _LibraryScreenState extends State<LibraryScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  // Mock data
  final List<String> playlists = [
    'Nhạc Chill',
    'Workout',
    'Nhạc Buồn',
  ];

  final List<Map<String, String>> favoriteSongs = [
    {'title': 'Lạc Trôi', 'artist': 'Sơn Tùng M-TP'},
    {'title': 'Hơn Cả Yêu', 'artist': 'Đức Phúc'},
  ];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        title: const Text('Thư viện'),
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: Colors.greenAccent,
          tabs: const [
            Tab(text: 'Playlist'),
            Tab(text: 'Yêu thích'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildPlaylistTab(),
          _buildFavoriteTab(),
        ],
      ),
    );
  }

  // 🎵 Playlist tab
  Widget _buildPlaylistTab() {
    return ListView.builder(
      itemCount: playlists.length,
      itemBuilder: (context, index) {
        return ListTile(
          leading: Container(
            width: 50,
            height: 50,
            decoration: BoxDecoration(
              color: Colors.grey.shade800,
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(Icons.queue_music, color: Colors.white),
          ),
          title: Text(
            playlists[index],
            style: const TextStyle(color: Colors.white),
          ),
          subtitle: const Text(
            'Playlist cá nhân',
            style: TextStyle(color: Colors.grey),
          ),
          onTap: () {
            // TODO: mở playlist
          },
        );
      },
    );
  }

  // ❤️ Favorite tab
  Widget _buildFavoriteTab() {
    return ListView.builder(
      itemCount: favoriteSongs.length,
      itemBuilder: (context, index) {
        final song = favoriteSongs[index];
        return ListTile(
          leading: Container(
            width: 50,
            height: 50,
            decoration: BoxDecoration(
              color: Colors.grey.shade800,
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(Icons.favorite, color: Colors.redAccent),
          ),
          title: Text(
            song['title']!,
            style: const TextStyle(color: Colors.white),
          ),
          subtitle: Text(
            song['artist']!,
            style: const TextStyle(color: Colors.grey),
          ),
          trailing: const Icon(Icons.more_vert, color: Colors.grey),
          onTap: () {
            // TODO: play song
          },
        );
      },
    );
  }
}
