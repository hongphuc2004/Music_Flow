import 'dart:convert';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import '../../../core/theme/app_theme.dart';
import '../../../core/config/api_config.dart';
import '../../../data/models/song_model.dart';
import '../../../data/services/auth_service.dart';
import '../../widgets/song_options_menu.dart';
import '../library/favorites_screen.dart';
import '../library/downloaded_songs_screen.dart';
import '../library/your_uploads_screen.dart';
import '../library/playlists_screen.dart';
import '../settings/settings_screen.dart';

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
        _errorMessage = 'Yêu cầu đăng nhập để dùng Trợ lý nhạc AI.';
        _isHistoryLoading = false;
      });
      return;
    }

    try {
      final response = await http.get(
        Uri.parse(ApiConfig.assistantConversationsEndpoint),
        headers: headers,
      );
      final data = json.decode(response.body);

      if (response.statusCode == 200 && data['success'] == true) {
        final conversations = (data['data'] as List? ?? [])
            .whereType<Map>()
            .map(
              (item) =>
                  MoodConversation.fromJson(Map<String, dynamic>.from(item)),
            )
            .toList();

        setState(() {
          _conversations = conversations;
          _playlists = []; // Assistant playlists are loaded per-conversation details
          _isHistoryLoading = false;
          _errorMessage = '';
        });

        if (conversations.isNotEmpty) {
          _loadConversation(conversations.first.id);
        }
      } else {
        setState(() {
          _errorMessage = data['message'] ?? 'Không thể tải lịch sử AI.';
          _isHistoryLoading = false;
        });
      }
    } catch (_) {
      setState(() {
        _errorMessage = 'Lỗi kết nối lịch sử AI.';
        _isHistoryLoading = false;
      });
    }
  }

  Future<void> _loadConversation(String conversationId) async {
    final headers = await _authHeaders();
    if (headers == null) return;

    setState(() {
      _isLoading = true;
      _activeConversationId = conversationId;
      _messages = [];
    });

    try {
      final response = await http.get(
        Uri.parse('${ApiConfig.assistantConversationsEndpoint}/$conversationId'),
        headers: headers,
      );
      final data = json.decode(response.body);

      if (response.statusCode == 200 && data['success'] == true) {
        final detailData = data['data'] as Map? ?? {};
        final messages = (detailData['messages'] as List? ?? [])
            .whereType<Map>()
            .map(
              (item) => MoodMessage.fromJson(Map<String, dynamic>.from(item)),
            )
            .toList();
        final playlists = (detailData['playlists'] as List? ?? [])
            .whereType<Map>()
            .map(
              (item) => MoodPlaylist.fromJson(Map<String, dynamic>.from(item)),
            )
            .where((playlist) => playlist.songs.isNotEmpty)
            .toList();

        setState(() {
          _messages = messages;
          _playlists = playlists;
          _isLoading = false;
        });
        _scrollToBottom();
      } else {
        setState(() {
          _errorMessage = data['message'] ?? 'Lỗi tải cuộc hội thoại.';
          _isLoading = false;
        });
      }
    } catch (_) {
      setState(() {
        _errorMessage = 'Lỗi kết nối cuộc hội thoại.';
        _isLoading = false;
      });
    }
  }

  Future<void> _deleteConversation(String conversationId) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: AppRadius.mediumBorder),
        title: const Text('Xóa cuộc hội thoại?'),
        content: const Text('Bạn có chắc chắn muốn xóa cuộc hội thoại này?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Hủy'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.accentPink,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: AppRadius.smallBorder),
            ),
            child: const Text('Xóa'),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    final headers = await _authHeaders();
    if (headers == null) return;

    try {
      final response = await http.delete(
        Uri.parse('${ApiConfig.assistantConversationsEndpoint}/$conversationId'),
        headers: headers,
      );
      final data = json.decode(response.body);

      if (response.statusCode == 200 && data['success'] == true) {
        setState(() {
          _conversations.removeWhere((item) => item.id == conversationId);
          if (_activeConversationId == conversationId) {
            _startNewConversation();
          }
        });
      }
    } catch (_) {}
  }

  Future<void> _fetchAiPlaylist() async {
    final prompt = _promptController.text.trim();
    if (prompt.isEmpty) return;

    final headers = await _authHeaders();
    if (headers == null) {
      setState(() => _errorMessage = 'Yêu cầu đăng nhập để sử dụng.');
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = '';
      _messages.add(MoodMessage(role: 'user', content: prompt));
    });
    _scrollToBottom();

    try {
      final response = await http.post(
        Uri.parse(ApiConfig.assistantMessagesEndpoint),
        headers: headers,
        body: json.encode({
          'prompt': prompt,
          if (_activeConversationId != null)
            'conversationId': _activeConversationId,
        }),
      );
      final data = json.decode(response.body);

      if (response.statusCode == 200 && data['success'] == true) {
        final responseData = data['data'] as Map? ?? {};
        final newMessages = (responseData['messages'] as List? ?? [])
            .whereType<Map>()
            .map(
              (item) => MoodMessage.fromJson(Map<String, dynamic>.from(item)),
            )
            .toList();
        final responseSongs = (responseData['songs'] as List? ?? [])
            .whereType<Map>()
            .map((item) => Song.fromJson(Map<String, dynamic>.from(item)))
            .toList();
        final playlistJson = responseData['playlist'];
        final playlist = playlistJson is Map
            ? MoodPlaylist.fromJson(Map<String, dynamic>.from(playlistJson))
            : null;
        final conversation = responseData['conversation'] is Map
            ? MoodConversation.fromJson(
                Map<String, dynamic>.from(responseData['conversation']),
              )
            : null;
        final clientActions = responseData['clientActions'] as List?;

        setState(() {
          if (conversation != null) {
            _activeConversationId = conversation.id;
            final exists = _conversations.any(
              (item) => item.id == conversation.id,
            );
            if (!exists) _conversations = [conversation, ..._conversations];
          }
          if (_messages.isNotEmpty && _messages.last.role == 'user') {
            _messages.removeLast();
          }
          _messages.addAll(newMessages);

          if (playlist != null && playlist.songs.isNotEmpty) {
            _playlists = [playlist, ..._playlists];
          }
          _promptController.clear();
        });

        // Execute actions (like playing song, loading playlist, redirecting route)
        if (clientActions != null && clientActions.isNotEmpty) {
          _executeClientActions(clientActions);
        } else if (playlist == null && responseSongs.isNotEmpty) {
          widget.onPlayAll(responseSongs, startIndex: 0);
        }
        _scrollToBottom();
      } else if (response.statusCode == 401 || response.statusCode == 403) {
        setState(() => _errorMessage = 'Yêu cầu đăng nhập để chat với AI.');
      } else {
        setState(() {
          _errorMessage =
              data['message'] ?? 'Đã xảy ra lỗi khi trợ lý nhạc AI xử lý.';
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

  void _executeClientActions(List<dynamic>? actions) {
    if (actions == null || actions.isEmpty) return;

    for (final action in actions) {
      if (action is! Map) continue;
      final type = action['type']?.toString();
      final payload = action['payload'];

      if (type == 'PLAY_SONG' && payload is Map) {
        final songJson = payload['song'];
        if (songJson is Map) {
          final song = Song.fromJson(Map<String, dynamic>.from(songJson));
          final songsJson = payload['songs'] as List?;
          final songs = songsJson != null
              ? songsJson.whereType<Map>().map((item) => Song.fromJson(Map<String, dynamic>.from(item))).toList()
              : [song];
          widget.onPlayAll(songs, startIndex: 0);
        }
      } else if (type == 'LOAD_PLAYLIST' && payload is Map) {
        final songsJson = payload['songs'] as List?;
        if (songsJson != null && songsJson.isNotEmpty) {
          final songs = songsJson.whereType<Map>().map((item) => Song.fromJson(Map<String, dynamic>.from(item))).toList();
          widget.onPlayAll(songs, startIndex: 0);
        }
      } else if (type == 'OPEN_ROUTE' && payload is Map) {
        final route = payload['route']?.toString() ?? '';
        _handleRouteRedirect(route);
      }
    }
  }

  void _handleRouteRedirect(String route) {
    if (!mounted) return;
    final normalized = route.toLowerCase();

    if (normalized.contains('favorite')) {
      Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => const FavoritesScreen()),
      );
    } else if (normalized.contains('download')) {
      Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => const DownloadedSongsScreen()),
      );
    } else if (normalized.contains('upload')) {
      Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => YourUploadsScreen(onSongTap: widget.onSongTap, onPlayAll: widget.onPlayAll)),
      );
    } else if (normalized.contains('playlist')) {
      Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => PlaylistsScreen(onSongTap: widget.onSongTap, onPlayAll: widget.onPlayAll)),
      );
    } else if (normalized.contains('setting')) {
      Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => const SettingsScreen()),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Yêu cầu mở: $route'),
          duration: const Duration(seconds: 2),
        ),
      );
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
          duration: AppDurations.cardSlide,
          curve: Curves.easeOut,
        );
      }
    });
  }


  Widget _buildSongTile(List<Song> songs, Song song) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: ClipRRect(
        borderRadius: BorderRadius.circular(AppRadius.small),
        child: Image.network(
          song.imageUrl,
          width: 44,
          height: 44,
          fit: BoxFit.cover,
          errorBuilder: (_, __, ___) => Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: isDark ? AppColors.darkBorder : AppColors.lightBorder,
              borderRadius: BorderRadius.circular(AppRadius.small),
            ),
            child: const Icon(Icons.music_note_rounded, color: Colors.white30, size: 20),
          ),
        ),
      ),
      title: Text(
        song.title,
        style: theme.textTheme.titleMedium?.copyWith(fontSize: 14, fontWeight: FontWeight.w600),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
      subtitle: Text(
        song.artists.join(', '),
        style: TextStyle(color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary, fontSize: 12),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
      trailing: IconButton(
        icon: Icon(Icons.more_vert_rounded, color: isDark ? Colors.white30 : Colors.black38),
        onPressed: () {
          showModalBottomSheet(
            context: context,
            backgroundColor: Colors.transparent,
            builder: (context) => SongOptionsSheet(song: song),
          );
        },
      ),
      onTap: () {
        final index = songs.indexOf(song);
        widget.onPlayAll(songs, startIndex: index >= 0 ? index : 0);
      },
    );
  }

  Widget _buildConversationChips() {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

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
              avatar: const Icon(Icons.add_rounded, size: 16, color: Colors.white),
              label: const Text('Mới'),
              onPressed: _startNewConversation,
              backgroundColor: AppColors.primary,
              labelStyle: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.bold,
              ),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
            );
          }
          final conversation = _conversations[index - 1];
          final selected = conversation.id == _activeConversationId;
          return InputChip(
            label: Text(conversation.title, overflow: TextOverflow.ellipsis),
            selected: selected,
            onSelected: (_) => _loadConversation(conversation.id),
            onDeleted: () => _deleteConversation(conversation.id),
            deleteIcon: Icon(
              Icons.close_rounded,
              size: 16,
              color: selected ? Colors.white : (isDark ? Colors.white54 : Colors.black45),
            ),
            selectedColor: AppColors.secondary.withValues(alpha: 0.3),
            backgroundColor: isDark ? Colors.white.withValues(alpha: 0.04) : Colors.black.withValues(alpha: 0.03),
            labelStyle: TextStyle(
              color: selected
                  ? (isDark ? Colors.white : AppColors.lightTextPrimary)
                  : (isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary),
              fontWeight: selected ? FontWeight.bold : FontWeight.w500,
            ),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(20),
              side: BorderSide(
                color: selected ? AppColors.secondary : Colors.transparent,
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildBody() {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    if (_isHistoryLoading) {
      return const Expanded(
        child: Center(
          child: CircularProgressIndicator(color: AppColors.primary),
        ),
      );
    }

    if (_errorMessage.isNotEmpty && _messages.isEmpty && _playlists.isEmpty) {
      return Expanded(
        child: Center(
          child: Text(
            _errorMessage,
            style: const TextStyle(color: AppColors.accentPink, fontWeight: FontWeight.bold),
            textAlign: TextAlign.center,
          ),
        ),
      );
    }

    if (_messages.isEmpty && _playlists.isEmpty) {
      return Expanded(
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.auto_awesome_rounded,
                size: 56,
                color: isDark ? AppColors.darkTextSecondary.withValues(alpha: 0.4) : AppColors.lightTextSecondary.withValues(alpha: 0.4),
              ),
              const SizedBox(height: AppSpacing.md),
              Text(
                'Tôi có thể giúp bạn tìm nhạc, phát bài hát, thiết kế playlist và điều hướng ứng dụng bằng AI.',
                style: TextStyle(
                  color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      );
    }

    final playlistsById = <String, MoodPlaylist>{
      for (final playlist in _playlists) playlist.id: playlist,
    };
    final usedPlaylistIds = <String>{};
    final timelineWidgets = <Widget>[];

    for (final message in _messages) {
      timelineWidgets.add(_buildMessageBubble(message));

      final playlistId = message.playlistId;
      if (playlistId == null || playlistId.isEmpty) {
        continue;
      }

      final playlist = playlistsById[playlistId];
      if (playlist == null) {
        continue;
      }

      usedPlaylistIds.add(playlistId);
      timelineWidgets.add(_buildPlaylistCard(playlist));
    }

    for (final playlist in _playlists) {
      if (usedPlaylistIds.contains(playlist.id)) {
        continue;
      }
      timelineWidgets.add(_buildPlaylistCard(playlist));
    }

    return Expanded(
      child: ListView(
        controller: _scrollController,
        padding: const EdgeInsets.only(bottom: 24),
        children: [
          ...timelineWidgets,
          if (_isLoading)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 24),
              child: Center(
                child: SizedBox(
                  width: 24,
                  height: 24,
                  child: CircularProgressIndicator(
                    color: isDark ? Colors.white70 : Colors.black45,
                    strokeWidth: 2,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildMessageBubble(MoodMessage message) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final isUser = message.role == 'user';

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
      child: Align(
        alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
        child: Container(
          constraints: BoxConstraints(
            maxWidth: MediaQuery.of(context).size.width * 0.75,
          ),
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.sm),
          decoration: BoxDecoration(
            color: isUser
                ? AppColors.primary
                : (isDark ? Colors.white.withValues(alpha: 0.04) : Colors.black.withValues(alpha: 0.03)),
            borderRadius: BorderRadius.only(
              topLeft: const Radius.circular(16),
              topRight: const Radius.circular(16),
              bottomLeft: Radius.circular(isUser ? 16 : 0),
              bottomRight: Radius.circular(isUser ? 0 : 16),
            ),
            border: isUser
                ? null
                : Border.all(
                    color: isDark ? AppColors.darkBorder : AppColors.lightBorder,
                  ),
          ),
          child: Text(
            message.content,
            style: TextStyle(
              color: isUser ? Colors.white : (isDark ? Colors.white : AppColors.lightTextPrimary),
              fontSize: 14,
              height: 1.4,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildPlaylistCard(MoodPlaylist playlist) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final isFallback = playlist.matchStatus == 'fallback';

    return Container(
      margin: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: isDark ? Colors.white.withValues(alpha: 0.02) : Colors.black.withValues(alpha: 0.01),
        borderRadius: AppRadius.mediumBorder,
        border: Border.all(
          color: isFallback
              ? Colors.amber.withValues(alpha: 0.3)
              : AppColors.primary.withValues(alpha: 0.3),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                Icons.auto_awesome_rounded,
                color: isFallback ? Colors.amber : AppColors.primary,
                size: 20,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  playlist.title,
                  style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                ),
              ),
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [AppColors.primary, AppColors.secondary],
                  ),
                  shape: BoxShape.circle,
                ),
                child: IconButton(
                  padding: EdgeInsets.zero,
                  icon: const Icon(
                    Icons.play_arrow_rounded,
                    color: Colors.white,
                    size: 20,
                  ),
                  onPressed: () => widget.onPlayAll(playlist.songs),
                ),
              ),
            ],
          ),
          if (playlist.description.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 4, bottom: AppSpacing.xs),
              child: Text(
                playlist.description,
                style: TextStyle(
                  color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
                  fontSize: 12,
                  height: 1.4,
                ),
              ),
            ),
          const Divider(height: 16),
          ...playlist.songs
              .take(6)
              .map((song) => _buildSongTile(playlist.songs, song)),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(
        title: Text(
          'AI Music Assistant',
          style: theme.textTheme.titleLarge?.copyWith(fontSize: 20, fontWeight: FontWeight.w900),
        ),
        backgroundColor: Colors.transparent,
        elevation: 0,
        centerTitle: true,
      ),
      body: Padding(
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
        child: Column(
          children: [
            _buildConversationChips(),
            const SizedBox(height: AppSpacing.sm),
            _buildBody(),
            const SizedBox(height: AppSpacing.xs),
            Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.sm),
              child: Row(
                children: [
                  Expanded(
                    child: Container(
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(30),
                        boxShadow: _isLoading ? null : AppShadows.neonGlow(AppColors.primary),
                      ),
                      child: TextField(
                        controller: _promptController,
                        enabled: !_isLoading,
                        style: TextStyle(color: isDark ? Colors.white : AppColors.lightTextPrimary, fontSize: 14),
                        decoration: InputDecoration(
                          hintText: 'Nhập tin nhắn hoặc yêu cầu phát nhạc...',
                          hintStyle: TextStyle(
                            color: isDark ? AppColors.darkTextSecondary.withValues(alpha: 0.6) : AppColors.lightTextSecondary.withValues(alpha: 0.6),
                          ),
                          filled: true,
                          fillColor: isDark ? Colors.white.withValues(alpha: 0.04) : Colors.black.withValues(alpha: 0.02),
                          contentPadding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: AppSpacing.sm),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(30),
                            borderSide: BorderSide(
                              color: isDark ? AppColors.darkBorder : AppColors.lightBorder,
                            ),
                          ),
                          disabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(30),
                            borderSide: BorderSide(
                              color: isDark ? AppColors.darkBorder : AppColors.lightBorder,
                            ),
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(30),
                            borderSide: const BorderSide(
                              color: AppColors.primary,
                              width: 1.5,
                            ),
                          ),
                          suffixIcon: IconButton(
                            icon: Icon(
                              _isLoading ? Icons.hourglass_empty_rounded : Icons.send_rounded,
                              color: _isLoading ? AppColors.darkTextSecondary : AppColors.primary,
                            ),
                            onPressed: _isLoading ? null : _fetchAiPlaylist,
                          ),
                        ),
                        onSubmitted: (_) => _isLoading ? null : _fetchAiPlaylist(),
                      ),
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
