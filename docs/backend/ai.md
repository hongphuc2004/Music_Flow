# AI DJ — Backend (Gemini Integration)

File: `src/controllers/ai.controller.js`

---

## Tổng quan

AI DJ là tính năng tạo playlist tự động dựa trên mood mà người dùng mô tả bằng ngôn ngữ tự nhiên. Backend dùng Google Gemini để:
1. Phân tích mood từ prompt
2. Match với topics/genres và artists trong DB
3. Tạo playlist
4. Sinh text response mang tính cá nhân hóa

---

## Gemini Model Chain

```js
// Thử lần lượt, dùng model đầu tiên hoạt động
const MODELS_TO_TRY = [
  process.env.GEMINI_MODEL,          // từ env (ưu tiên)
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash-latest"
];
```

---

## Luồng xử lý `POST /api/ai/playlist`

```
POST /api/ai/playlist
  { prompt: "nhạc buồn chill đi", conversationId: "optional" }
       │
       ▼
1. Tạo / lấy MoodConversation
       │
       ▼
2. analyzeMood(prompt)
   → Gemini: "Trả về JSON: { mood, keywords, topics, energy }"
   → mood: "sad" | "happy" | "chill" | "focus" | "energetic" |
            "romantic" | "sleep" | "party" | "angry"
       │
       ▼
3. findMatchedArtists(prompt)
   → Kiểm tra xem prompt có mention tên nghệ sĩ không
   → Nếu có → Artist.find({ name: /regex/ })
       │
       ├─ CÓ nghệ sĩ khớp?
       │    └─ findSongsByArtists() → source: "artist_match"
       │
       └─ KHÔNG có nghệ sĩ
            ▼
4. findMatchedTopics(mood, keywords)
   → Map mood → danh sách topic names
   → Topic.find({ name: { $in: topicNames } })
       │
       ├─ CÓ topics khớp?
       │    └─ Song.find({ topicIds: { $in: matchedTopicIds }, isPublic: true })
       │       → Shuffle + limit 10 → source: "topic_match"
       │
       └─ KHÔNG khớp topic
            └─ Song.find({ isPublic: true }).limit(10) → source: "fallback"
       │
       ▼
5. generateAssistantText(prompt, songs, mood)
   → Gemini: tạo text response tiếng Việt ngắn gọn, thân thiện
       │
       ▼
6. Lưu vào DB:
   - MoodMessage (role: "user")
   - MoodPlaylist { songs, songSnapshots, matchStatus, ... }
   - MoodMessage (role: "assistant", metadata: { playlistId })
       │
       ▼
7. Response: { conversationId, messages, playlist }
```

---

## Mood → Topic Mapping

```js
const MOOD_TOPIC_MAP = {
  sad:       ["Sad", "Lofi", "Piano", "Chill", "Acoustic"],
  happy:     ["Pop", "EDM", "Party"],
  chill:     ["Chill", "Lofi", "Piano", "Acoustic"],
  focus:     ["Study", "Piano", "Lofi", "Chill"],
  energetic: ["EDM", "Rock", "Party", "WorkOut", "Hip Hop & Rap"],
  romantic:  ["Pop", "Piano", "Chill", "Acoustic"],
  sleep:     ["Sleep", "Piano", "Lofi", "Chill"],
  party:     ["Party", "EDM", "Pop", "Hip Hop & Rap"],
  angry:     ["Rock", "Hip Hop & Rap", "EDM"],
};
```

---

## matchStatus

| Giá trị | Nghĩa |
|---------|-------|
| `matched` | Có songs khớp chính xác với artist/topic request |
| `partial` | Khớp một phần (chỉ 1-2 topic) |
| `fallback` | Không khớp gì, trả về random public songs |

---

## Multi-turn Conversation

Mỗi user có nhiều `MoodConversation`. Mỗi conversation lưu:
- Danh sách `MoodMessage` (user + assistant turns)
- Danh sách `MoodPlaylist` được generate

Khi gửi request mới với `conversationId`:
1. Load message history của conversation đó
2. Append context vào prompt gửi Gemini
3. Gemini biết ngữ cảnh từ các turn trước

---

## Pure Chat (không generate playlist)

Khi người dùng nhắn tin thông thường (không request playlist):

```js
generateConversationalReply(userMessage, conversationHistory)
  → Gemini: multi-turn chat, chỉ trả về text
  → Không tạo MoodPlaylist
  → Lưu 2 MoodMessage (user + assistant)
```

---

## Song Snapshot

Khi tạo `MoodPlaylist`, backend lưu `songSnapshots` — bản sao thông tin bài hát tại thời điểm đó:

```js
songSnapshots: [{
  songId, title, artists, imageUrl, audioUrl, duration
}]
```

Mục đích: nếu bài hát bị xóa sau này, playlist vẫn hiển thị được thông tin.

---

## Error handling AI

```js
// Nếu Gemini fail → trả về fallback response
// Không để AI error làm crash toàn bộ request
try {
  const text = await geminiModel.generateContent(prompt);
  return text;
} catch (err) {
  return "Đây là những bài hát tôi gợi ý cho bạn!"; // fallback text
}
```
