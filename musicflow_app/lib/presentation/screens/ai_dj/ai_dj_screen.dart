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

  const AiDjScreen({
    super.key,
    required this.onSongTap,
    required this.onPlayAll,
  });

  @override
  State<AiDjScreen> createState() => _AiDjScreenState();
}

class MoodMessage {
  final String role;
  final String content;
  final String? playlistId;

  MoodMessage({required this.role, required this.content, this.playlistId});

  factory MoodMessage.fromJson(Map<String, dynamic> json) {
    final metadata = json['metadata'] is Map ? json['metadata'] as Map : {};
    return MoodMessage(
      role: json['role']?.toString() ?? 'assistant',
      content: json['content']?.toString() ?? '',
      playlistId: metadata['playlistId']?.toString(),
    );
  }
}

class MoodPlaylist {
  final String id;
  final String title;
  final String description;
  final String matchStatus;
  final List<Song> songs;

  MoodPlaylist({
    required this.id,
    required this.title,
    required this.description,
    required this.matchStatus,
    required this.songs,
  });

  factory MoodPlaylist.fromJson(Map<String, dynamic> json) {
    final rawSongs = json['songs'] is List ? json['songs'] as List : [];
    return MoodPlaylist(
      id: json['_id']?.toString() ?? '',
      title: json['title']?.toString() ?? 'Mood Music',
      description: json['description']?.toString() ?? '',
      matchStatus: json['matchStatus']?.toString() ?? 'matched',
      songs: rawSongs
          .whereType<Map>()
          .map((song) => Song.fromJson(Map<String, dynamic>.from(song)))
          .toList(),
    );
  }
}

class MoodConversation {
  final String id;
  final String title;

  MoodConversation({required this.id, required this.title});

  factory MoodConversation.fromJson(Map<String, dynamic> json) {
    return MoodConversation(
      id: json['_id']?.toString() ?? '',
      title: json['title']?.toString() ?? 'Mood Music',
    );
  }
}

class _AiDjScreenState extends State<AiDjScreen> {
  final TextEditingController _promptController = TextEditingController();
  final ScrollController _scrollController = ScrollController();

  List<MoodConversation> _conversations = [];
  List<MoodMessage> _messages = [];
  List<MoodPlaylist> _playlists = [];
  String? _activeConversationId;
  bool _isLoading = false;
  bool _isHistoryLoading = true;
  String _errorMessage = '';

  @override
  void initState() {
    super.initState();
    _loadHistory();
  }

  @override
  void dispose() {
    _promptController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<Map<String, String>?> _authHeaders() async {
    final token = await AuthService.getToken();
    if (token == null) return null;
    return {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer $token',
    };
  }

  Future<void> _loadHistory() async {
    final headers = await _authHeaders();
    if (headers == null) {
      if (!mounted) return;
      setState(() {
        _errorMessage = 'Yêu cầu đăng nhập để dùng Mood Music.';
        _isHistoryLoading = false;
      });
      return;
    }

    try {
      final response = await http.get(
        Uri.parse(ApiConfig.aiMoodHistoryEndpoint),
        headers: headers,
      );
      final data = json.decode(response.body);

      if (response.statusCode == 200 && data['success'] == true) {
        final conversations = (data['conversations'] as List? ?? [])
            .whereType<Map>()
            .map((item) => MoodConversation.fromJson(Map<String, dynamic>.from(item)))
            .toList();
        final playlists = (data['playlists'] as List? ?? [])
            .whereType<Map>()
            .map((item) => MoodPlaylist.fromJson(Map<String, dynamic>.from(item)))
            .where((playlist) => playlist.songs.isNotEmpty)
            .toList();

        if (!mounted) return;
        setState(() {
          _conversations = conversations;
          _playlists = playlists;
          _activeConversationId = conversations.isNotEmpty ? conversations.first.id : null;
          _isHistoryLoading = false;
        });

        if (_activeConversationId != null) {
          await _loadConversation(_activeConversationId!);
        }
      } else {
        if (!mounted) return;
        setState(() {
          _errorMessage = data['message'] ?? 'Không thể tải lịch sử Mood Music.';
          _isHistoryLoading = false;
        });
      }
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _errorMessage = 'Lỗi kết nối. Vui lòng thử lại sau.';
        _isHistoryLoading = false;
      });
    }
  }

  Future<void> _loadConversation(String conversationId) async {
    final headers = await _authHeaders();
    if (headers == null) return;

    try {
      final response = await http.get(
        Uri.parse('${ApiConfig.aiMoodConversationEndpoint}/$conversationId'),
        headers: headers,
      );
      final data = json.decode(response.body);
      if (response.statusCode == 200 && data['success'] == true) {
        final messages = (data['messages'] as List? ?? [])
            .whereType<Map>()
            .map((item) => MoodMessage.fromJson(Map<String, dynamic>.from(item)))
            .toList();
        final playlists = (data['playlists'] as List? ?? [])
            .whereType<Map>()
            .map((item) => MoodPlaylist.fromJson(Map<String, dynamic>.from(item)))
            .where((playlist) => playlist.songs.isNotEmpty)
            .toList();

        if (!mounted) return;
        setState(() {
          _activeConversationId = conversationId;
          _messages = messages;
          _playlists = playlists;
          _errorMessage = '';
        });
        _scrollToBottom();
      }
    } catch (_) {}
  }

  Future<void> _fetchAiPlaylist() async {
    final prompt = _promptController.text.trim();
    if (prompt.isEmpty) return;

    setState(() {
      _isLoading = true;
      _errorMessage = '';
    });

    final headers = await _authHeaders();
    if (headers == null) {
      setState(() {
        _errorMessage = 'Yêu cầu đăng nhập để chat với AI.';
        _isLoading = false;
      });
      return;
    }

    try {
      final response = await http.post(
        Uri.parse(ApiConfig.aiPlaylistEndpoint),
        headers: headers,
        body: json.encode({
          'prompt': prompt,
          if (_activeConversationId != null) 'conversationId': _activeConversationId,
        }),
      );
      final data = json.decode(response.body);

      if (response.statusCode == 200 && data['success'] == true) {
        final newMessages = (data['messages'] as List? ?? [])
            .whereType<Map>()
            .map((item) => MoodMessage.fromJson(Map<String, dynamic>.from(item)))
            .toList();
        final playlistJson = data['playlist'];
        final playlist = playlistJson is Map
            ? MoodPlaylist.fromJson(Map<String, dynamic>.from(playlistJson))
            : null;
        final conversation = data['conversation'] is Map
            ? MoodConversation.fromJson(Map<String, dynamic>.from(data['conversation']))
            : null;

        setState(() {
          if (conversation != null) {
            _activeConversationId = conversation.id;
            final exists = _conversations.any((item) => item.id == conversation.id);
            if (!exists) _conversations = [conversation, ..._conversations];
          }
          _messages.addAll(newMessages);
          if (playlist != null && playlist.songs.isNotEmpty) {
            _playlists = [playlist, ..._playlists];
          }
          _promptController.clear();
        });
        _scrollToBottom();
      } else if (response.statusCode == 401 || response.statusCode == 403) {
        setState(() => _errorMessage = 'Yêu cầu đăng nhập để chat với AI.');
      } else {
        setState(() {
          _errorMessage = data['message'] ?? 'Đã xảy ra lỗi khi tạo playlist AI.';
        });
      }
    } catch (_) {
      setState(() {
        _errorMessage = 'Lỗi kết nối. Vui lòng thử lại sau.';
      });
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  void _startNewConversation() {
    setState(() {
      _activeConversationId = null;
      _messages = [];
      _playlists = [];
      _errorMessage = '';
      _promptController.clear();
    });
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 260),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Widget _buildMessageBubble(MoodMessage message) {
    final isUser = message.role == 'user';
    return Align(
      alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        constraints: BoxConstraints(
          maxWidth: MediaQuery.of(context).size.width * 0.78,
        ),
        decoration: BoxDecoration(
          color: isUser ? Colors.purpleAccent : Colors.grey.shade900,
          borderRadius: BorderRadius.circular(18),
          border: isUser ? null : Border.all(color: Colors.white10),
        ),
        child: Text(
          message.content,
          style: TextStyle(
            color: isUser ? Colors.black : Colors.white,
            fontWeight: isUser ? FontWeight.w600 : FontWeight.w400,
          ),
        ),
      ),
    );
  }

  Widget _buildSongTile(List<Song> songs, Song song) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
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
        final index = songs.indexOf(song);
        widget.onPlayAll(songs, startIndex: index >= 0 ? index : 0);
      },
    );
  }

  Widget _buildPlaylistCard(MoodPlaylist playlist) {
    final isFallback = playlist.matchStatus == 'fallback';
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.grey.shade800,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: isFallback ? Colors.amber.withValues(alpha: 0.45) : Colors.purpleAccent.withValues(alpha: 0.35),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  playlist.title,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              IconButton(
                icon: const Icon(Icons.play_circle_fill, color: Colors.purpleAccent),
                onPressed: () => widget.onPlayAll(playlist.songs),
              ),
            ],
          ),
          if (playlist.description.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Text(
                playlist.description,
                style: const TextStyle(color: Colors.grey, height: 1.4),
              ),
            ),
          if (isFallback)
            const Padding(
              padding: EdgeInsets.only(bottom: 8),
              child: Text(
                'Chưa có bài khớp rõ cảm xúc này, đây là gợi ý thay thế.',
                style: TextStyle(color: Colors.amber, fontSize: 12),
              ),
            ),
          ...playlist.songs.take(15).map((song) => _buildSongTile(playlist.songs, song)),
        ],
      ),
    );
  }

  Widget _buildConversationChips() {
    if (_conversations.isEmpty) return const SizedBox.shrink();
    return SizedBox(
      height: 42,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: _conversations.length + 1,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (context, index) {
          if (index == 0) {
            return ActionChip(
              label: const Text('Mới'),
              avatar: const Icon(Icons.add, size: 18),
              onPressed: _startNewConversation,
              backgroundColor: Colors.purpleAccent,
              labelStyle: const TextStyle(color: Colors.black, fontWeight: FontWeight.bold),
            );
          }
          final conversation = _conversations[index - 1];
          final selected = conversation.id == _activeConversationId;
          return ChoiceChip(
            label: Text(conversation.title, overflow: TextOverflow.ellipsis),
            selected: selected,
            onSelected: (_) => _loadConversation(conversation.id),
            selectedColor: Colors.purpleAccent,
            backgroundColor: Colors.grey.shade900,
            labelStyle: TextStyle(
              color: selected ? Colors.black : Colors.white,
              fontWeight: selected ? FontWeight.bold : FontWeight.w500,
            ),
          );
        },
      ),
    );
  }

  Widget _buildBody() {
    if (_isHistoryLoading) {
      return const Expanded(
        child: Center(child: CircularProgressIndicator(color: Colors.purpleAccent)),
      );
    }

    if (_errorMessage.isNotEmpty && _messages.isEmpty && _playlists.isEmpty) {
      return Expanded(
        child: Center(
          child: Text(
            _errorMessage,
            style: const TextStyle(color: Colors.redAccent),
            textAlign: TextAlign.center,
          ),
        ),
      );
    }

    if (_messages.isEmpty && _playlists.isEmpty) {
      return const Expanded(
        child: Center(
          child: Text(
            'Hãy nhập một dòng cảm xúc để AI gợi ý nhạc cho bạn nhé.',
            style: TextStyle(color: Colors.grey),
            textAlign: TextAlign.center,
          ),
        ),
      );
    }

    return Expanded(
      child: ListView(
        controller: _scrollController,
        children: [
          ..._messages.map(_buildMessageBubble),
          const SizedBox(height: 8),
          ..._playlists.map(_buildPlaylistCard),
          if (_isLoading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 18),
              child: Center(child: CircularProgressIndicator(color: Colors.purpleAccent)),
            ),
        ],
      ),
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
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            _buildConversationChips(),
            const SizedBox(height: 12),
            const Icon(Icons.auto_awesome, size: 48, color: Colors.purpleAccent),
            const SizedBox(height: 10),
            const Text(
              'Bạn đang cảm thấy thế nào?',
              style: TextStyle(
                color: Colors.white,
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 14),
            TextField(
              controller: _promptController,
              enabled: !_isLoading,
              style: const TextStyle(color: Colors.white),
              decoration: InputDecoration(
                hintText: 'Ví dụ: Nhạc buồn lofi cho đêm mưa...',
                hintStyle: const TextStyle(color: Colors.grey),
                filled: true,
                fillColor: Colors.grey[900],
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(30),
                  borderSide: BorderSide.none,
                ),
                suffixIcon: IconButton(
                  icon: Icon(
                    _isLoading ? Icons.hourglass_top : Icons.send,
                    color: Colors.purpleAccent,
                  ),
                  onPressed: _isLoading ? null : _fetchAiPlaylist,
                ),
              ),
              onSubmitted: (_) => _isLoading ? null : _fetchAiPlaylist(),
            ),
            if (_errorMessage.isNotEmpty && (_messages.isNotEmpty || _playlists.isNotEmpty))
              Padding(
                padding: const EdgeInsets.only(top: 10),
                child: Text(
                  _errorMessage,
                  style: const TextStyle(color: Colors.redAccent),
                  textAlign: TextAlign.center,
                ),
              ),
            const SizedBox(height: 18),
            _buildBody(),
          ],
        ),
      ),
    );
  }
}
