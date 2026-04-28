import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import '../../../core/config/api_config.dart';
import '../../../data/models/song_model.dart';
import '../../../data/services/auth_service.dart';
import '../../widgets/song_options_menu.dart';

class AiDjScreen extends StatefulWidget {
  final Function(Song) onSongTap;
  final Function(List<Song>, {int startIndex}) onPlayAll;

  const AiDjScreen({super.key, required this.onSongTap, required this.onPlayAll});

  @override
  _AiDjScreenState createState() => _AiDjScreenState();
}

class _AiDjScreenState extends State<AiDjScreen> {
  final TextEditingController _promptController = TextEditingController();
  List<Song> _suggestedSongs = [];
  bool _isLoading = false;
  String _errorMessage = '';

  Future<void> _fetchAiPlaylist() async {
    final prompt = _promptController.text.trim();
    if (prompt.isEmpty) return;

    setState(() {
      _isLoading = true;
      _errorMessage = '';
      _suggestedSongs = [];
    });

    final token = await AuthService.getToken();

    if (token == null) {
      setState(() {
        _errorMessage = 'Yêu cầu đăng nhập để chat với AI!';
        _isLoading = false;
      });
      return;
    }

    try {
      final response = await http.post(
        Uri.parse(ApiConfig.aiPlaylistEndpoint),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: json.encode({'prompt': prompt}),
      );

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        if (data['songs'] != null) {
          setState(() {
            _suggestedSongs = (data['songs'] as List)
                .map((s) => Song.fromJson(s))
                .toList();
          });
        }
      } else if (response.statusCode == 401 || response.statusCode == 403) {
        setState(() {
          _errorMessage = 'Yêu cầu đăng nhập để chat với AI!';
        });
      } else {
        setState(() {
          _errorMessage =
              json.decode(response.body)['message'] ??
              'Đã xảy ra lỗi khi tạo playlist AI.';
        });
      }
    } catch (e) {
      setState(() {
        _errorMessage = 'Lỗi kết nối. Vui lòng thử lại sau.';
      });
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  Widget _buildSongTile(Song song) {
    return ListTile(
      leading: ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: Image.network(
          song.imageUrl,
          width: 48,
          height: 48,
          fit: BoxFit.cover,
          errorBuilder: (_, __, ___) => Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: Colors.grey.shade800,
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(Icons.music_note, color: Colors.white),
          ),
        ),
      ),
      title: Text(song.title, style: const TextStyle(color: Colors.white)),
      subtitle: Text(
        song.artists.join(', '),
        style: const TextStyle(color: Colors.grey),
      ),
      trailing: SongOptionsMenu(song: song),
      onTap: () {
        final index = _suggestedSongs.indexOf(song);
        widget.onPlayAll(_suggestedSongs, startIndex: index >= 0 ? index : 0);
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        title: const Text(
          'Mood Music',
          style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white),
        ),
        backgroundColor: Colors.transparent,
        elevation: 0,
        centerTitle: true,
        flexibleSpace: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              colors: [Colors.deepPurple, Colors.black],
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
            ),
          ),
        ),
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          children: [
            const Icon(
              Icons.auto_awesome,
              size: 64,
              color: Colors.purpleAccent,
            ),
            const SizedBox(height: 16),
            const Text(
              "Bạn đang cảm thấy thế nào?",
              style: TextStyle(
                color: Colors.white,
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _promptController,
              style: const TextStyle(color: Colors.white),
              decoration: InputDecoration(
                hintText: "Ví dụ: Nhạc buồn lofi cho đêm mưa...",
                hintStyle: TextStyle(color: Colors.grey),
                filled: true,
                fillColor: Colors.grey[900],
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(30),
                  borderSide: BorderSide.none,
                ),
                suffixIcon: IconButton(
                  icon: const Icon(Icons.send, color: Colors.purpleAccent),
                  onPressed: _fetchAiPlaylist,
                ),
              ),
              onSubmitted: (_) => _fetchAiPlaylist(),
            ),
            const SizedBox(height: 24),

            if (_isLoading)
              const Expanded(
                child: Center(
                  child: CircularProgressIndicator(color: Colors.purpleAccent),
                ),
              )
            else if (_errorMessage.isNotEmpty)
              Expanded(
                child: Center(
                  child: Text(
                    _errorMessage,
                    style: const TextStyle(color: Colors.redAccent),
                  ),
                ),
              )
            else if (_suggestedSongs.isEmpty)
              const Expanded(
                child: Center(
                  child: Text(
                    "Hãy nhập một dòng trạng thái để AI gợi ý nhạc cho bạn nhé!",
                    style: TextStyle(color: Colors.grey),
                    textAlign: TextAlign.center,
                  ),
                ),
              )
            else
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12.0),
                      child: Text(
                        "🎶 Dành riêng cho bạn:",
                        style: TextStyle(
                          color: Colors.white.withOpacity(0.9),
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                    Expanded(
                      child: ListView.builder(
                        itemCount: _suggestedSongs.length,
                        itemBuilder: (context, index) {
                          return _buildSongTile(_suggestedSongs[index]);
                        },
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}
