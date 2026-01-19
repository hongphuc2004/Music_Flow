import 'package:flutter/material.dart';

class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key});

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  final TextEditingController _searchController = TextEditingController();

  // Mock data (sau này thay bằng API)
  final List<Map<String, String>> _songs = [
    {
      'title': 'Lạc Trôi',
      'artist': 'Sơn Tùng M-TP',
    },
    {
      'title': 'Hơn Cả Yêu',
      'artist': 'Đức Phúc',
    },
    {
      'title': 'Bước Qua Mùa Cô Đơn',
      'artist': 'Vũ',
    },
  ];

  List<Map<String, String>> _filteredSongs = [];

  @override
  void initState() {
    super.initState();
    _filteredSongs = _songs;
  }

  void _onSearch(String query) {
    setState(() {
      _filteredSongs = _songs.where((song) {
        final title = song['title']!.toLowerCase();
        final artist = song['artist']!.toLowerCase();
        final input = query.toLowerCase();
        return title.contains(input) || artist.contains(input);
      }).toList();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        child: Column(
          children: [
            _buildSearchBar(),
            Expanded(child: _buildSearchResult()),
          ],
        ),
      ),
    );
  }

  // 🔍 Search bar
  Widget _buildSearchBar() {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: TextField(
        controller: _searchController,
        onChanged: _onSearch,
        style: const TextStyle(color: Colors.white),
        decoration: InputDecoration(
          hintText: 'Tìm bài hát, nghệ sĩ...',
          hintStyle: const TextStyle(color: Colors.grey),
          prefixIcon: const Icon(Icons.search, color: Colors.grey),
          filled: true,
          fillColor: Colors.grey.shade900,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide.none,
          ),
        ),
      ),
    );
  }

  // 📄 Danh sách kết quả
  Widget _buildSearchResult() {
    if (_filteredSongs.isEmpty) {
      return const Center(
        child: Text(
          'Không tìm thấy kết quả',
          style: TextStyle(color: Colors.grey),
        ),
      );
    }

    return ListView.builder(
      itemCount: _filteredSongs.length,
      itemBuilder: (context, index) {
        final song = _filteredSongs[index];
        return ListTile(
          leading: Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: Colors.grey.shade800,
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(Icons.music_note, color: Colors.white),
          ),
          title: Text(
            song['title']!,
            style: const TextStyle(color: Colors.white),
          ),
          subtitle: Text(
            song['artist']!,
            style: const TextStyle(color: Colors.grey),
          ),
          onTap: () {
            // TODO: play song
          },
        );
      },
    );
  }
}
