# AI DJ — musicflow_app

File: `presentation/screens/ai_dj/ai_dj_screen.dart` (681 dòng)

---

## Tổng quan

AI DJ là màn hình chat với AI để tạo playlist theo mood. Người dùng nhập cảm xúc/tình huống bằng ngôn ngữ tự nhiên (hoặc dùng voice), AI phân tích và trả về playlist phù hợp.

---

## Data Models (nội bộ trong screen)

```dart
class MoodMessage {
  final String role;       // "user" | "assistant"
  final String content;    // nội dung tin nhắn
  final String? playlistId; // trỏ đến MoodPlaylist nếu có
}

class MoodPlaylist {
  final String id;
  final String title;
  final String description;
  final String matchStatus;   // "matched" | "partial" | "fallback"
  final List<Song> songs;
}

class MoodConversation {
  final String id;
  final String title;
}
```

---

## UI Layout

```
AiDjScreen
  ├─ AppBar ("AI DJ")
  │
  ├─ Conversation chips (horizontal scroll)
  │     └─ Chip("+ Mới") | Chip("Buổi tối chill") | Chip("Workout")
  │           └─ Tap → switch conversation
  │           └─ Long-press → delete với confirmation
  │
  ├─ Message ListView (scroll to bottom on new message)
  │     ├─ UserBubble (align right, màu primary)
  │     │     └─ Text content
  │     │
  │     └─ AssistantBubble (align left, màu surface)
  │           ├─ Text content (AI response)
  │           └─ [Nếu có playlist] PlaylistCard
  │                 ├─ Title + description
  │                 ├─ MatchStatus badge ("✓ Khớp" / "⚠ Gợi ý thay thế")
  │                 ├─ Nút "Phát tất cả" → onPlayAll(songs)
  │                 └─ SongList (3-5 bài preview)
  │                       └─ Tap → playSong
  │
  └─ InputBar (bottom)
        ├─ TextField (multiline, hint: "Bạn đang cảm thấy thế nào?")
        ├─ Mic button → SpeechToText
        └─ Send button
```

---

## State

```dart
// State chính trong AiDjScreen
List<MoodConversation> conversations = [];
String? activeConversationId;
List<MoodMessage> messages = [];
Map<String, MoodPlaylist> playlists = {};  // playlistId → MoodPlaylist
bool isLoading = false;
TextEditingController _controller;
```

---

## Luồng gửi tin nhắn

```dart
Future<void> _sendMessage(String prompt) async {
  if (prompt.trim().isEmpty) return;

  // 1. Hiển thị message user ngay
  setState(() {
    messages.add(MoodMessage(role: 'user', content: prompt));
    isLoading = true;
  });
  _scrollToBottom();
  _controller.clear();

  // 2. Gọi API
  final response = await http.post(
    Uri.parse('${ApiConfig.baseUrl}/api/ai/playlist'),
    headers: await _getAuthHeaders(),
    body: jsonEncode({
      'prompt': prompt,
      'conversationId': activeConversationId,
    }),
  );

  // 3. Parse response
  final data = jsonDecode(response.body)['data'];

  setState(() {
    // Cập nhật conversationId (nếu là conversation mới)
    activeConversationId = data['conversationId'];

    // Thêm messages từ server (user + assistant)
    for (final msg in data['messages']) {
      messages.add(MoodMessage.fromJson(msg));
    }

    // Lưu playlist
    if (data['playlist'] != null) {
      final playlist = MoodPlaylist.fromJson(data['playlist']);
      playlists[playlist.id] = playlist;
    }

    isLoading = false;
  });

  _scrollToBottom();
}
```

---

## Voice Input

```dart
// Mic button press
void _startListening() async {
  final available = await _speech.initialize();
  if (available) {
    _speech.listen(
      onResult: (result) {
        setState(() {
          _controller.text = result.recognizedWords;
        });
      },
      listenFor: Duration(seconds: 30),
      pauseFor: Duration(seconds: 3),
      localeId: 'vi_VN',  // tiếng Việt
    );
  }
}

// Tự động gửi khi dừng nói
_speech.listen(
  onResult: (result) {
    if (result.finalResult) {
      _sendMessage(result.recognizedWords);
    }
  },
);
```

---

## Load Conversation History

```dart
Future<void> _loadHistory() async {
  // GET /api/ai/mood/history → conversations + playlists gần đây
  final response = await http.get(
    Uri.parse('${ApiConfig.baseUrl}/api/ai/mood/history'),
    headers: await _getAuthHeaders(),
  );

  final data = jsonDecode(response.body)['data'];
  setState(() {
    conversations = (data['conversations'] as List)
      .map((c) => MoodConversation.fromJson(c))
      .toList();

    // Preload playlists
    for (final p in data['playlists'] ?? []) {
      final playlist = MoodPlaylist.fromJson(p);
      playlists[playlist.id] = playlist;
    }

    // Auto-select conversation gần nhất
    if (conversations.isNotEmpty) {
      activeConversationId = conversations.first.id;
      _loadConversation(activeConversationId!);
    }
  });
}
```

---

## Switch Conversation

```dart
Future<void> _loadConversation(String conversationId) async {
  // GET /api/ai/mood/conversations/:id
  final response = await http.get(...);
  final data = jsonDecode(response.body)['data'];

  setState(() {
    activeConversationId = conversationId;
    messages = (data['messages'] as List)
      .map((m) => MoodMessage.fromJson(m))
      .toList();

    // Load playlists của conversation này
    for (final p in data['playlists'] ?? []) {
      playlists[p['id']] = MoodPlaylist.fromJson(p);
    }
  });
  _scrollToBottom();
}
```

---

## Delete Conversation

```dart
void _deleteConversation(String conversationId) {
  showDialog(
    context: context,
    builder: (_) => AlertDialog(
      title: Text('Xóa cuộc trò chuyện?'),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: Text('Hủy')),
        TextButton(
          onPressed: () async {
            Navigator.pop(context);
            // DELETE /api/ai/mood/conversations/:id
            await http.delete(...);
            setState(() {
              conversations.removeWhere((c) => c.id == conversationId);
              if (activeConversationId == conversationId) {
                activeConversationId = conversations.isNotEmpty
                  ? conversations.first.id : null;
                messages.clear();
              }
            });
          },
          child: Text('Xóa', style: TextStyle(color: Colors.red)),
        ),
      ],
    ),
  );
}
```

---

## PlaylistCard Widget

```
PlaylistCard
  ├─ Header
  │     ├─ Title (e.g. "Nhạc buổi tối chill")
  │     ├─ Description (AI-generated text)
  │     └─ MatchStatus badge
  │           ├─ "matched"  → Icon check_circle (green) + "Khớp với yêu cầu"
  │           └─ "fallback" → Icon warning (orange) + "Gợi ý thay thế"
  │
  ├─ Songs preview (max 5 bài)
  │     └─ ListTile: ảnh bìa + tên bài + nghệ sĩ
  │           └─ Tap → GlobalAudioState.playSong(song, queue: allSongs)
  │
  └─ "Phát tất cả" button
        └─ widget.onPlayAll(playlist.songs)
              └─ GlobalAudioState.setQueue(songs)
              └─ GlobalAudioState.playSong(songs[0])
```

---

## onPlayAll callback

`AiDjScreen` nhận callback từ `MainScreen`:

```dart
// main.dart
AiDjScreen(
  onPlayAll: (List<Song> songs) {
    GlobalAudioState().setQueue(songs);
    GlobalAudioState().playSong(songs[0], queue: songs, index: 0);
  },
)
```

---

## matchStatus UI

```dart
// Widget badge màu sắc
Widget _buildMatchBadge(String status) {
  if (status == 'matched') {
    return Chip(
      label: Text('Khớp với yêu cầu'),
      avatar: Icon(Icons.check_circle, color: Colors.green),
      backgroundColor: Colors.green.withOpacity(0.1),
    );
  } else {
    return Chip(
      label: Text('Gợi ý thay thế'),
      avatar: Icon(Icons.warning_amber, color: Colors.orange),
      backgroundColor: Colors.orange.withOpacity(0.1),
    );
  }
}
```
