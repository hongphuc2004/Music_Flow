import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:musicflow_app/core/audio/global_audio_state.dart';
import 'package:musicflow_app/core/theme/app_theme.dart';
import 'package:musicflow_app/core/utils/app_toast.dart';
import 'package:musicflow_app/data/models/song_model.dart';
import 'package:musicflow_app/data/services/assistant_api_service.dart';
import 'package:musicflow_app/data/services/auth_service.dart';
import 'package:musicflow_app/presentation/screens/premium/premium_screen.dart';
import 'package:musicflow_app/presentation/widgets/voice_ai_dj_sheet.dart';

class AiAssistantScreen extends StatefulWidget {
  final Function(Song)? onSongTap;
  final Function(List<Song>, {int startIndex})? onPlayAll;

  const AiAssistantScreen({
    super.key,
    this.onSongTap,
    this.onPlayAll,
  });

  @override
  State<AiAssistantScreen> createState() => _AiAssistantScreenState();
}

class _AiAssistantScreenState extends State<AiAssistantScreen> {
  final TextEditingController _textController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  final GlobalAudioState _globalAudioState = GlobalAudioState();

  List<AssistantMessage> _messages = [];
  List<AssistantConversation> _conversations = [];
  String? _activeConversationId;
  AssistantQuota? _quota;
  bool _isLoading = false;
  bool _isSending = false;

  final List<String> _quickPrompts = [
    'Gợi ý playlist nhạc chill thư giãn cuối tuần',
    'Nhạc tập trung học tập & làm việc năng suất',
    'Tìm những bài hát hay nhất của Khang Việt',
    'Nhạc acoustic acoustic nhẹ nhàng lúc trời mưa',
    'Tạo playlist nhạc sôi động cho buổi tập gym',
  ];

  @override
  void initState() {
    super.initState();
    _loadInitialData();
  }

  @override
  void dispose() {
    _textController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _loadInitialData() async {
    setState(() => _isLoading = true);

    try {
      final results = await Future.wait([
        AssistantApiService.getQuota(),
        AssistantApiService.getConversations(),
      ]);

      if (mounted) {
        setState(() {
          _quota = results[0] as AssistantQuota?;
          _conversations = results[1] as List<AssistantConversation>;
          _isLoading = false;
        });

        // Tự động tải cuộc hội thoại gần nhất nếu có
        if (_conversations.isNotEmpty) {
          _selectConversation(_conversations.first.id);
        }
      }
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _selectConversation(String conversationId) async {
    setState(() {
      _activeConversationId = conversationId;
      _isLoading = true;
    });

    try {
      final msgs = await AssistantApiService.getConversationMessages(conversationId);
      if (mounted) {
        setState(() {
          _messages = msgs;
          _isLoading = false;
        });
        _scrollToBottom();
      }
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _startNewConversation() {
    setState(() {
      _activeConversationId = null;
      _messages = [];
    });
  }

  Future<void> _sendMessage(String text) async {
    final cleanText = text.trim();
    if (cleanText.isEmpty || _isSending) return;

    _textController.clear();

    // Thêm tin nhắn tạm thời của user
    final tempUserMsg = AssistantMessage(
      id: 'temp-user-${DateTime.now().millisecondsSinceEpoch}',
      role: 'user',
      content: cleanText,
      createdAt: DateTime.now(),
    );

    setState(() {
      _messages.add(tempUserMsg);
      _isSending = true;
    });
    _scrollToBottom();

    try {
      final res = await AssistantApiService.sendMessage(
        prompt: cleanText,
        conversationId: _activeConversationId,
      );

      if (res.success && res.assistantMessage != null) {
        if (mounted) {
          setState(() {
            _activeConversationId = res.conversationId;
            _messages.add(res.assistantMessage!);
            _isSending = false;
          });
          _scrollToBottom();

          // Thực thi smart clientActions nếu có
          _handleClientActions(res);

          // Cập nhật lại quota và danh sách hội thoại
          AssistantApiService.getQuota().then((q) {
            if (mounted && q != null) setState(() => _quota = q);
          });
          AssistantApiService.getConversations().then((convs) {
            if (mounted) setState(() => _conversations = convs);
          });
        }
      } else {
        if (mounted) {
          setState(() => _isSending = false);
          if (res.isQuotaExceeded) {
            _showQuotaExceededSheet();
          } else {
            AppToast.showError(context, res.message);
          }
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isSending = false);
        AppToast.showError(context, 'Lỗi gửi tin nhắn: $e');
      }
    }
  }

  void _handleClientActions(AssistantSendResult res) {
    if (res.songs.isNotEmpty && res.clientActions.isNotEmpty) {
      for (final action in res.clientActions) {
        final type = action is Map ? action['type']?.toString() : null;
        if (type == 'play_song') {
          final targetSong = res.songs.first;
          _playSong(targetSong);
          break;
        } else if (type == 'play_playlist') {
          _playAllSongs(res.songs);
          break;
        } else if (type == 'add_to_queue') {
          for (final s in res.songs) {
            _globalAudioState.addToQueue(s, playNext: false);
          }
          AppToast.showInfo(context, 'Đã thêm ${res.songs.length} bài hát vào danh sách phát');
          break;
        }
      }
    }
  }

  void _playSong(Song song) {
    if (widget.onSongTap != null) {
      widget.onSongTap!(song);
    } else {
      _globalAudioState.playSong(song);
    }
  }

  void _playAllSongs(List<Song> songs, {int startIndex = 0}) {
    if (songs.isEmpty) return;
    if (widget.onPlayAll != null) {
      widget.onPlayAll!(songs, startIndex: startIndex);
    } else {
      _globalAudioState.playPlaylist(songs, startIndex: startIndex);
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent + 120,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  void _openVoiceInput() {
    VoiceAiDjSheet.show(
      context,
      conversationId: _activeConversationId,
      onExecuteActions: (actions, songs) {
        if (songs.isNotEmpty) {
          if (actions != null && actions.isNotEmpty) {
            final firstAction = actions.first;
            final type = firstAction is Map ? firstAction['type']?.toString() : null;
            if (type == 'play_playlist') {
              _playAllSongs(songs);
            } else {
              _playSong(songs.first);
            }
          } else {
            _playSong(songs.first);
          }
        }

        // Tải lại tin nhắn mới từ cuộc hội thoại
        if (_activeConversationId != null) {
          _selectConversation(_activeConversationId!);
        } else {
          _loadInitialData();
        }
      },
    );
  }

  void _showConversationsHistorySheet() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => Container(
        height: MediaQuery.of(context).size.height * 0.65,
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
        decoration: const BoxDecoration(
          color: Color(0xFF140E26),
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.white24,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Lịch sử trò chuyện',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                TextButton.icon(
                  onPressed: () {
                    Navigator.pop(context);
                    _startNewConversation();
                  },
                  icon: const Icon(Icons.add_rounded, size: 18, color: Color(0xFF00E5FF)),
                  label: const Text(
                    'Đoạn chat mới',
                    style: TextStyle(color: Color(0xFF00E5FF), fontWeight: FontWeight.bold),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Expanded(
              child: _conversations.isEmpty
                  ? const Center(
                      child: Text(
                        'Chưa có cuộc trò chuyện nào',
                        style: TextStyle(color: Colors.white54),
                      ),
                    )
                  : ListView.builder(
                      itemCount: _conversations.length,
                      itemBuilder: (context, index) {
                        final conv = _conversations[index];
                        final isCurrent = conv.id == _activeConversationId;

                        return Container(
                          margin: const EdgeInsets.only(bottom: 8),
                          decoration: BoxDecoration(
                            color: isCurrent
                                ? const Color(0xFF6C63FF).withOpacity(0.18)
                                : Colors.white.withOpacity(0.04),
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(
                              color: isCurrent
                                  ? const Color(0xFF6C63FF).withOpacity(0.4)
                                  : Colors.white.withOpacity(0.06),
                            ),
                          ),
                          child: ListTile(
                            leading: const Icon(
                              Icons.chat_bubble_outline_rounded,
                              color: Color(0xFF00E5FF),
                              size: 20,
                            ),
                            title: Text(
                              conv.title,
                              style: TextStyle(
                                color: isCurrent ? const Color(0xFF00E5FF) : Colors.white,
                                fontWeight: isCurrent ? FontWeight.bold : FontWeight.normal,
                                fontSize: 14,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            trailing: IconButton(
                              icon: const Icon(Icons.delete_outline_rounded, color: Colors.white38, size: 18),
                              onPressed: () async {
                                final success = await AssistantApiService.deleteConversation(conv.id);
                                if (success && mounted) {
                                  setState(() {
                                    _conversations.removeWhere((c) => c.id == conv.id);
                                    if (_activeConversationId == conv.id) {
                                      _startNewConversation();
                                    }
                                  });
                                }
                              },
                            ),
                            onTap: () {
                              Navigator.pop(context);
                              _selectConversation(conv.id);
                            },
                          ),
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }

  void _showQuotaExceededSheet() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (_) => Container(
        padding: const EdgeInsets.all(24),
        decoration: const BoxDecoration(
          color: Color(0xFF160E2E),
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFFF59E0B).withOpacity(0.18),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.workspace_premium_rounded, color: Color(0xFFF59E0B), size: 36),
            ),
            const SizedBox(height: 16),
            const Text(
              'Hết lượt yêu cầu AI hôm nay',
              style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            const Text(
              'Bạn đã sử dụng hết lượt yêu cầu AI miễn phí. Nâng cấp lên gói MusicFlow Premium để nhận thêm lượt trò chuyện và mở khóa AI 24/7.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.white70, fontSize: 13, height: 1.4),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              height: 46,
              child: ElevatedButton(
                onPressed: () {
                  Navigator.pop(context);
                  Navigator.push(context, MaterialPageRoute(builder: (_) => const PremiumScreen()));
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFF59E0B),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
                child: const Text(
                  'Nâng Cấp Premium Ngay',
                  style: TextStyle(color: Color(0xFF090D1A), fontWeight: FontWeight.w800, fontSize: 14),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A0716),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF6C63FF), Color(0xFF00E5FF)],
                ),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.auto_awesome_rounded, size: 18, color: Colors.white),
            ),
            const SizedBox(width: 10),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'MusicFlow AI',
                  style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 16),
                ),
                Row(
                  children: [
                    Container(
                      width: 6,
                      height: 6,
                      decoration: const BoxDecoration(
                        color: Color(0xFF10B981),
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 4),
                    const Text(
                      'Trợ lý âm nhạc 24/7',
                      style: TextStyle(color: Colors.white54, fontSize: 10),
                    ),
                  ],
                ),
              ],
            ),
          ],
        ),
        actions: [
          // Quota Badge
          if (_quota != null)
            GestureDetector(
              onTap: () {
                Navigator.push(context, MaterialPageRoute(builder: (_) => const PremiumScreen()));
              },
              child: Container(
                margin: const EdgeInsets.symmetric(vertical: 12),
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: _quota!.isPremium
                      ? const Color(0xFFF59E0B).withOpacity(0.18)
                      : Colors.white.withOpacity(0.08),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: _quota!.isPremium
                        ? const Color(0xFFF59E0B).withOpacity(0.4)
                        : Colors.white.withOpacity(0.12),
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      _quota!.isPremium ? Icons.workspace_premium_rounded : Icons.flash_on_rounded,
                      size: 13,
                      color: _quota!.isPremium ? const Color(0xFFF59E0B) : const Color(0xFF00E5FF),
                    ),
                    const SizedBox(width: 4),
                    Text(
                      _quota!.isUnlimited ? 'VIP ∞' : '${_quota!.remaining}/${_quota!.limit}',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        color: _quota!.isPremium ? const Color(0xFFF59E0B) : Colors.white70,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          // History Button
          IconButton(
            icon: const Icon(Icons.history_rounded, color: Colors.white70),
            onPressed: _showConversationsHistorySheet,
            tooltip: 'Lịch sử trò chuyện',
          ),
          // New Chat Button
          IconButton(
            icon: const Icon(Icons.add_comment_outlined, color: Colors.white70),
            onPressed: _startNewConversation,
            tooltip: 'Đoạn chat mới',
          ),
        ],
      ),
      body: Column(
        children: [
          // Message list / Empty Starter
          Expanded(
            child: _isLoading
                ? const Center(
                    child: CircularProgressIndicator(
                      valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF6C63FF)),
                    ),
                  )
                : _messages.isEmpty
                    ? _buildStarterView()
                    : ListView.builder(
                        controller: _scrollController,
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                        itemCount: _messages.length + (_isSending ? 1 : 0),
                        itemBuilder: (context, index) {
                          if (index == _messages.length && _isSending) {
                            return _buildTypingIndicator();
                          }
                          final msg = _messages[index];
                          return _buildMessageBubble(msg);
                        },
                      ),
          ),

          // Bottom Input Bar
          _buildInputBar(),
        ],
      ),
    );
  }

  Widget _buildStarterView() {
    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      child: Column(
        children: [
          const SizedBox(height: 20),
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF6C63FF), Color(0xFF00E5FF)],
              ),
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFF6C63FF).withOpacity(0.4),
                  blurRadius: 28,
                  spreadRadius: 2,
                ),
              ],
            ),
            child: const Icon(Icons.auto_awesome_rounded, size: 40, color: Colors.white),
          ),
          const SizedBox(height: 18),
          const Text(
            'Trợ lý âm nhạc MusicFlow AI',
            style: TextStyle(
              color: Colors.white,
              fontSize: 20,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.3,
            ),
          ),
          const SizedBox(height: 6),
          const Text(
            'Yêu cầu bài hát, tạo playlist theo cảm xúc, tìm hiểu nghệ sĩ hoặc giải thích lời bài hát ngay tức thì.',
            textAlign: TextAlign.center,
            style: TextStyle(color: Colors.white60, fontSize: 13, height: 1.4),
          ),
          const SizedBox(height: 24),

          // Quick Suggestion Chips
          Align(
            alignment: Alignment.centerLeft,
            child: Text(
              'GỢI Ý YÊU CẦU NHANH',
              style: TextStyle(
                color: const Color(0xFF00E5FF).withOpacity(0.9),
                fontSize: 11,
                fontWeight: FontWeight.w800,
                letterSpacing: 1.0,
              ),
            ),
          ),
          const SizedBox(height: 10),
          ..._quickPrompts.map((prompt) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: InkWell(
                  onTap: () => _sendMessage(prompt),
                  borderRadius: BorderRadius.circular(14),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.04),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: Colors.white.withOpacity(0.08)),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.flash_on_rounded, size: 16, color: Color(0xFF00E5FF)),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            prompt,
                            style: const TextStyle(color: Colors.white70, fontSize: 13),
                          ),
                        ),
                        const Icon(Icons.arrow_forward_ios_rounded, size: 12, color: Colors.white30),
                      ],
                    ),
                  ),
                ),
              )),
        ],
      ),
    );
  }

  Widget _buildMessageBubble(AssistantMessage msg) {
    final isAssistant = msg.isAssistant;

    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: isAssistant ? CrossAxisAlignment.start : CrossAxisAlignment.end,
        children: [
          Row(
            mainAxisAlignment: isAssistant ? MainAxisAlignment.start : MainAxisAlignment.end,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (isAssistant) ...[
                Container(
                  padding: const EdgeInsets.all(6),
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(colors: [Color(0xFF6C63FF), Color(0xFF00E5FF)]),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.auto_awesome_rounded, size: 14, color: Colors.white),
                ),
                const SizedBox(width: 8),
              ],
              Flexible(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  decoration: BoxDecoration(
                    gradient: isAssistant
                        ? null
                        : const LinearGradient(colors: [Color(0xFF6C63FF), Color(0xFF5A4FE0)]),
                    color: isAssistant ? Colors.white.withOpacity(0.06) : null,
                    borderRadius: BorderRadius.circular(18).copyWith(
                      bottomLeft: isAssistant ? const Radius.circular(4) : const Radius.circular(18),
                      bottomRight: !isAssistant ? const Radius.circular(4) : const Radius.circular(18),
                    ),
                    border: isAssistant ? Border.all(color: Colors.white.withOpacity(0.1)) : null,
                  ),
                  child: Text(
                    msg.content,
                    style: const TextStyle(color: Colors.white, fontSize: 14, height: 1.45),
                  ),
                ),
              ),
            ],
          ),

          // Embedded Songs / Playlist Card if generated
          if (isAssistant && msg.songs.isNotEmpty) ...[
            const SizedBox(height: 10),
            _buildEmbeddedPlaylistCard(msg),
          ],
        ],
      ),
    );
  }

  Widget _buildEmbeddedPlaylistCard(AssistantMessage msg) {
    final songs = msg.songs;
    final playlistTitle = msg.metadata['playlist']?['title'] ?? 'Danh sách phát AI DJ đề xuất';

    return Container(
      margin: const EdgeInsets.only(left: 30),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF1E153A),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFF6C63FF).withOpacity(0.4)),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF6C63FF).withOpacity(0.15),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      playlistTitle,
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                        fontSize: 14,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    Text(
                      '${songs.length} bài hát gợi ý',
                      style: const TextStyle(color: Color(0xFF00E5FF), fontSize: 11),
                    ),
                  ],
                ),
              ),
              ElevatedButton.icon(
                onPressed: () => _playAllSongs(songs),
                icon: const Icon(Icons.play_arrow_rounded, size: 16, color: Color(0xFF090D1A)),
                label: const Text(
                  'Phát tất cả',
                  style: TextStyle(color: Color(0xFF090D1A), fontWeight: FontWeight.w800, fontSize: 12),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF00E5FF),
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          const Divider(color: Colors.white12, height: 1),
          const SizedBox(height: 6),

          // Top 3 preview songs
          ...songs.take(4).map((s) => ListTile(
                dense: true,
                contentPadding: EdgeInsets.zero,
                leading: ClipRRect(
                  borderRadius: BorderRadius.circular(6),
                  child: Image.network(
                    s.imageUrl,
                    width: 36,
                    height: 36,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => Container(
                      width: 36,
                      height: 36,
                      color: Colors.grey[800],
                      child: const Icon(Icons.music_note, size: 18, color: Colors.white54),
                    ),
                  ),
                ),
                title: Text(
                  s.title,
                  style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                subtitle: Text(
                  s.artists.join(', '),
                  style: const TextStyle(color: Colors.white54, fontSize: 11),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                trailing: IconButton(
                  icon: const Icon(Icons.play_circle_fill_rounded, color: Color(0xFF6C63FF), size: 28),
                  onPressed: () => _playSong(s),
                ),
                onTap: () => _playSong(s),
              )),
        ],
      ),
    );
  }

  Widget _buildTypingIndicator() {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(6),
            decoration: const BoxDecoration(
              gradient: LinearGradient(colors: [Color(0xFF6C63FF), Color(0xFF00E5FF)]),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.auto_awesome_rounded, size: 14, color: Colors.white),
          ),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.06),
              borderRadius: BorderRadius.circular(16),
            ),
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                SizedBox(
                  width: 14,
                  height: 14,
                  child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF00E5FF)),
                ),
                SizedBox(width: 8),
                Text(
                  'AI đang suy nghĩ và tìm kiếm nhạc...',
                  style: TextStyle(color: Colors.white60, fontSize: 12),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInputBar() {
    final bottomPadding = MediaQuery.of(context).viewInsets.bottom > 0
        ? 8.0
        : MediaQuery.of(context).padding.bottom + 8.0;

    return Container(
      padding: EdgeInsets.only(
        left: 12,
        right: 12,
        top: 8,
        bottom: bottomPadding,
      ),
      decoration: BoxDecoration(
        color: const Color(0xFF120C22),
        border: Border(top: BorderSide(color: Colors.white.withOpacity(0.08))),
      ),
      child: Row(
        children: [
          // Voice button
          IconButton(
            icon: const Icon(Icons.mic_rounded, color: Color(0xFF00E5FF)),
            onPressed: _openVoiceInput,
            tooltip: 'Nói với AI',
          ),

          // Text Field
          Expanded(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.06),
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: Colors.white.withOpacity(0.1)),
              ),
              child: TextField(
                controller: _textController,
                style: const TextStyle(color: Colors.white, fontSize: 14),
                decoration: const InputDecoration(
                  hintText: 'Hỏi trợ lý AI hoặc yêu cầu nhạc...',
                  hintStyle: TextStyle(color: Colors.white38, fontSize: 13),
                  border: InputBorder.none,
                  contentPadding: EdgeInsets.symmetric(vertical: 10),
                ),
                onSubmitted: _sendMessage,
              ),
            ),
          ),
          const SizedBox(width: 8),

          // Send Button
          Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(colors: [Color(0xFF6C63FF), Color(0xFF00E5FF)]),
              shape: BoxShape.circle,
            ),
            child: IconButton(
              icon: const Icon(Icons.send_rounded, color: Colors.white, size: 18),
              onPressed: () => _sendMessage(_textController.text),
            ),
          ),
        ],
      ),
    );
  }
}
