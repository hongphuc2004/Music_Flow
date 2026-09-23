# Database Models — musicflow_backend

Tất cả models dùng **Mongoose + MongoDB**.
`timestamps: true` mặc định trên hầu hết schemas → tự động có `createdAt`, `updatedAt` (trừ bảng tối ưu append-only như `SongPlayEvent`).
Hiện tại backend có **24 Models** phục vụ toàn bộ hệ sinh thái MusicFlow.

---

## Danh sách 24 Models

1. [User](#1-user)
2. [Artist](#2-artist)
3. [Song](#3-song)
4. [Playlist](#4-playlist-user-playlists)
5. [PlaylistSong](#5-playlistsong-system-playlists)
6. [Topic](#6-topic)
7. [Comment](#7-comment)
8. [SongLike](#8-songlike)
9. [Favorite](#9-favorite)
10. [RefreshToken](#10-refreshtoken)
11. [Plan](#11-plan-premium-plans)
12. [Subscription](#12-subscription)
13. [Transaction](#13-transaction)
14. [Notification](#14-notification)
15. [SongLyrics](#15-songlyrics)
16. [LyricsAlignmentJob](#16-lyricsalignmentjob)
17. [AssistantConversation](#17-assistantconversation)
18. [AssistantMessage](#18-assistantmessage)
19. [MoodConversation](#19-moodconversation)
20. [MoodMessage](#20-moodmessage)
21. [MoodPlaylist](#21-moodplaylist)
22. [SongPlayEvent](#22-songplayevent)
23. [SongDownloadEvent](#23-songdownloadevent)
24. [SongShareEvent](#24-songshareevent)

---

## 1. User

Quản lý thông tin người dùng, quyền hạn, trạng thái Premium và hồ sơ sở thích AI.

```js
// src/models/user.model.js
{
  name:             String (required, trim)
  email:            String (required, unique, lowercase, trim)
  password:         String (minlength 6, optional cho Google login)
  googleId:         String (unique, sparse)
  provider:         enum ["local", "google"]  default: "local"
  role:             enum ["user", "admin"]    default: "user"
  avatar:           String  default: ""
  favoriteSongs:    [ObjectId → Song]
  playlists:        [ObjectId → Playlist]
  followedArtists:  [ObjectId → Artist]

  // 💎 Premium Subscription
  isPremium:        Boolean  default: false, indexed
  premiumExpiry:    Date     default: null
  premiumPlan:      ObjectId → Plan  default: null

  // 🧠 AI Memory & Personalized Preferences
  aiMemory: {
    topMoods:            [String]
    topThemes:           [String]
    preferredEnergy:     enum ["low", "medium", "high", "mixed"]  default: "mixed"
    timeSlotPreferences: {
      morning:   { moods: [String], energy: String }
      afternoon: { moods: [String], energy: String }
      evening:   { moods: [String], energy: String }
      night:     { moods: [String], energy: String }
    }
    lastCalculatedAt:    Date  default: null
  }
  customAiLimit:    Number  default: null
  bonusAiQuota:     Number  default: 0
}
```

**Methods & Hooks:**
- `pre("save")`: Hash password bằng bcryptjs nếu có thay đổi.
- `comparePassword(candidatePassword)`: Đối chiếu mật khẩu đăng nhập.
- `toJSON()`: Loại bỏ `password` trước khi serialize trả về client.

---

## 2. Artist

Hồ sơ nghệ sĩ, định danh qua slug, thống kê người theo dõi và lượt nghe hàng tháng.

```js
// src/models/artist.model.js
{
  name:             String (required, trim)
  slug:             String (indexed, auto-generated slug)
  email:            String (required, unique, lowercase, trim)
  password:         String (minlength 6)
  googleId:         String (unique, sparse)
  provider:         enum ["local", "google"]  default: "local"
  avatar:           String  default: ""
  bio:              String  default: ""
  role:             enum ["artist"]  default: "artist"
  isVerified:       Boolean  default: false
  followersCount:   Number   default: 0
  monthlyListeners: Number   default: 0
}
```

**Methods & Hooks:**
- `pre("save")`: Tự động tạo slug chuẩn không dấu (Vietnamese accent removal) khi đổi tên; hash password.
- `comparePassword(candidatePassword)`: Xác thực mật khẩu nghệ sĩ.
- `toJSON()`: Bỏ `password` khi trả về JSON.

---

## 3. Song

Trung tâm dữ liệu bài hát, bao gồm streaming metadata, chất lượng âm thanh, phân tích AI Intelligence, kiểm duyệt nội dung và thống kê.

```js
// src/models/song.model.js
{
  title:          String (required)
  slug:           String (indexed, phục vụ share SoundCloud-style)
  artists:        [ObjectId → Artist]
  topicIds:       [ObjectId → Topic]
  uploadedBy:     ObjectId → User (null = admin upload)
  isPublic:       Boolean  default: false

  // 🎵 Audio & Cloudinary
  audioUrl:       String (required)
  audioPublicId:  String  default: null
  duration:       Number (seconds)
  fileSize:       Number  default: 0
  audioMetadata: {
    format:               String   default: "mp3"
    bitrate:              Number   default: null
    hasHighQualitySource: Boolean  default: false
  }

  // 🖼️ Image
  imageUrl:       String  default: defaultSongImageUrl
  imagePublicId:  String  default: null

  // 📝 Lyrics legacy (plain/LRC)
  lyrics:         String  default: ""

  // 👤 Nguồn phát hành
  source:         enum ["admin", "artist", "user", "jamendo"]  default: "admin"
  sourceId:       String  default: null
  sourceUrl:      String  default: null
  allowDownload:  Boolean default: true

  // 📊 Thống kê tương tác
  playCount:      Number  default: 0
  likeCount:      Number  default: 0
  commentCount:   Number  default: 0
  shareCount:     Number  default: 0

  // 🧠 AI Song Intelligence (Auto-Tagging & Story)
  aiAnalysis: {
    status:           enum ["none", "pending", "completed", "failed"]  default: "none"
    genre:            String
    suggestedGenres:  [String]
    moodTags:         [String]
    energyLevel:      enum ["low", "medium", "high"]  default: "medium"
    themes:           [String]
    tags:             [String]
    storySummary:     String
    healingQuotes:    [String]
    confidence:       enum ["low", "medium", "high"]  default: "medium"
    retryCount:       Number  default: 0
    lastAttemptAt:    Date
    analyzedAt:       Date
  }

  // 🛡️ AI Content Moderation
  moderation: {
    status:           enum ["PENDING", "SAFE", "REVIEW", "BLOCK"]  default: "SAFE"
    riskLevel:        enum ["none", "low", "medium", "high"]      default: "none"
    flags:            [String]
    reason:           String
    confidence:       Number  default: 1.0
    source:           enum ["lyrics", "audio", "metadata", "manual", "none"]
    reviewedBy:       ObjectId → User
    reviewedAt:       Date
    autoModeratedAt:  Date
  }
}
```

---

## 4. Playlist (User Playlists)

Danh sách phát do người dùng tự tạo.

```js
// src/models/playlist.model.js
{
  name:        String (required, trim)
  description: String  default: ""
  userId:      ObjectId → User (required)
  songs:       [ObjectId → Song]
  coverImage:  String  default: ""
  isPublic:    Boolean  default: false
}
// Virtual: songCount
```

---

## 5. PlaylistSong (System Playlists)

Danh sách phát hệ thống hiển thị trang chủ do Admin biên tập (`system_playlist` collection).

```js
// src/models/playlist-song.model.js
{
  name:        String (required, trim)
  description: String  default: ""
  songs:       [ObjectId → Song]
  coverImage:  String  default: ""
  isPublic:    Boolean  default: true
  createdBy:   ObjectId → User (required)
}
// Virtual: songCount
```

---

## 6. Topic

Chủ đề và thể loại âm nhạc.

```js
// src/models/topic.model.js
{
  name:        String (required, unique, trim)
  description: String  default: ""
  avatar:      String  default: ""
}
```

---

## 7. Comment

Bình luận bài hát, hỗ trợ phân cấp cha/con (nested replies) và thả tim bình luận.

```js
// src/models/comment.model.js
{
  userId:          ObjectId → User (required, indexed)
  songId:          ObjectId → Song (required, indexed)
  content:         String (required, maxlength 1000)
  parentCommentId: ObjectId → Comment (null = root comment)
  reactions: [{
    userId: ObjectId → User
    type:   enum ["like"]
  }]
  reactionCount:   Number  default: 0
}
```

---

## 8. SongLike

Theo dõi lượt like bài hát của từng người dùng.

```js
// src/models/song-like.model.js
{
  userId: ObjectId → User (required)
  songId: ObjectId → Song (required)
}
// Compound unique index: (userId, songId)
```

---

## 9. Favorite

Theo dõi bài hát nằm trong thư viện yêu thích.

```js
// src/models/favorite.model.js
{
  userId: ObjectId → User (required)
  songId: ObjectId → Song (required)
}
// Compound unique index: (userId, songId)
```

---

## 10. RefreshToken

Quản lý refresh token bảo mật dạng SHA-256 hash.

```js
// src/models/refreshToken.model.js
{
  userId:    ObjectId → User (required)
  tokenHash: String (required, unique)
  expiresAt: Date (required)
}
```

---

## 11. Plan (Premium Plans)

Định nghĩa các gói cước nâng cấp dịch vụ nghe nhạc Premium.

```js
// src/models/plan.model.js
{
  name:           String (required, unique, trim)
  price:          Number (required, min 0)  // VND
  durationInDays: Number (required, min 1)
  description:    [String]
  isActive:       Boolean  default: true
}
```

---

## 12. Subscription

Lưu chu kỳ thuê bao của người dùng đối với một Plan cụ thể.

```js
// src/models/subscription.model.js
{
  user:        ObjectId → User (required, indexed)
  plan:        ObjectId → Plan (required)
  startDate:   Date  default: null
  endDate:     Date  default: null
  status:      enum ["pending", "active", "expired", "cancelled"]  default: "pending"
  transaction: ObjectId → Transaction (required, unique)
}
```

---

## 13. Transaction

Lịch sử giao dịch thanh toán qua cổng điện tử (VNPay hoặc Mock).

```js
// src/models/transaction.model.js
{
  user:            ObjectId → User (required, indexed)
  plan:            ObjectId → Plan (required)
  amount:          Number (required, min 0)
  paymentMethod:   enum ["mock", "vnpay"]  required
  transactionRef:  String (required, unique, indexed)
  status:          enum ["pending", "success", "failed", "cancelled"]  default: "pending"
  gatewayResponse: Mixed   default: {}
  paidAt:          Date    default: null
}
```

---

## 14. Notification

Hệ thống thông báo tức thời cho người dùng (thanh toán, AI quota, phát hành mới, kiểm duyệt).

```js
// src/models/notification.model.js
{
  user:      ObjectId → User (required, indexed)
  title:     String (required)
  content:   String (required)
  type:      enum [
               "subscription", "system", "general", "artist_release",
               "interaction", "artist_milestone", "ai_quota_reset",
               "song_moderation_result", "admin_moderation_alert"
             ]  default: "general"
  isRead:    Boolean  default: false, indexed
  uniqueKey: String (unique, sparse)
  metadata:  Mixed    default: {}
}
// Compound indexes: (user, createdAt: -1), (user, isRead, createdAt: -1)
```

---

## 15. SongLyrics

Lưu trữ lời bài hát chuyên sâu với 2 không gian tách biệt: **Draft** (nghệ sĩ soạn thảo) và **Published** (phục vụ client karaoke).

```js
// src/models/song-lyrics.model.js
{
  songId:               ObjectId → Song (required, unique, indexed)
  artistId:             ObjectId → Artist (required, indexed)
  lyricsType:           enum ["plain", "synced"]  default: "plain"
  status:               enum ["not_added", "draft", "ready", "published"]  default: "draft"
  syncSource:           enum ["manual", "lrclib", "ai_alignment", "ai_aligned"]  default: "manual"
  lastAlignmentJobId:   ObjectId → LyricsAlignmentJob  default: null

  // 📝 Draft Workspace
  plainLyrics:          String
  lrcData:              String
  syncedLines: [{
    startTime: Number (seconds float, required)
    endTime:   Number
    text:      String
    words: [{
      text:      String
      startTime: Number
      endTime:   Number
    }]
  }]

  // 🚀 Published Snapshot (Client hiển thị)
  publishedLyricsType:  enum ["plain", "synced", null]
  publishedPlainLyrics: String
  publishedLrcData:     String
  publishedSyncedLines: [{
    startTime: Number
    endTime:   Number
    text:      String
    words: [{
      text:      String
      startTime: Number
      endTime:   Number
    }]
  }]
  publishedAt:          Date
  version:              Number  default: 1 (Optimistic locking)
}
```

---

## 16. LyricsAlignmentJob

Hàng đợi tiến trình xử lý căn nhịp lời bài hát tự động bằng AI (phối hợp với `musicflow_lyrics_sync` Worker).

```js
// src/models/lyrics-alignment-job.model.js
{
  songId:                 ObjectId → Song (required, indexed)
  artistId:               ObjectId → Artist (required, indexed)
  status:                 enum ["pending", "processing", "succeeded", "failed", "cancelled"]
  stage:                  String  default: "PENDING"
  progressPercent:        Number  default: 0
  progressMessage:        String
  attemptCount:           Number  default: 0
  maxAttempts:            Number  default: 2
  workerId:               String
  processingStartedAt:    Date
  lastHeartbeatAt:        Date
  completedAt:            Date
  failedAt:               Date

  pipelineMode:           enum ["lyrics_provided", "auto_transcribe"]
  rawTranscript:          String
  normalizedTranscript:   String
  transcriptionConfidence:Number

  // Idempotency & Fingerprint
  audioPublicId:          String (required)
  plainLyricsHash:        String (required)
  inputFingerprint:       String (required)
  pipelineFingerprint:    String (required)
  fingerprint:            String (required, indexed)
  expectedDraftVersion:   Number (required)

  metadata: {
    separatorModel:       String
    alignmentModel:       String
    pipelineVersion:      String
    postProcessVersion:   String
  }

  result: {
    syncedLines:          [Object]
    lrcData:              String
    qualityStatus:        enum ["GOOD", "WARNING", "FAILED", null]
    qualityNotes:         [String]
  }

  errorCode:              String
  errorMessage:           String
}
```

---

## 17. AssistantConversation

Phiên hội thoại với Trợ lý thông minh toàn năng MusicFlow AI (hỗ trợ User và Artist).

```js
// src/models/assistant-conversation.model.js
{
  actorId:              ObjectId (required, refPath: "actorType", indexed)
  actorType:            enum ["User", "Artist"] (required)
  actorRole:            enum ["user", "artist", "admin"] (required)
  scope:                enum ["global", "mood"]  default: "global"
  title:                String  default: "Trợ lý MusicFlow"
  lastMessage:          String  default: ""
  contextSummary:       String  default: ""
  legacyConversationId: String (indexed)
}
```

---

## 18. AssistantMessage

Tin nhắn trong phiên hội thoại AI Assistant (bao gồm tool call metadata, intent actions và playlist snapshots).

```js
// src/models/assistant-message.model.js
{
  conversationId: ObjectId → AssistantConversation (required, indexed)
  role:           enum ["user", "model"] (required)
  content:        String (required)
  metadata:       Mixed  default: {}
}
```

---

## 19. MoodConversation

Phiên tạo playlist theo tâm trạng AI DJ legacy.

```js
// src/models/mood-conversation.model.js
{
  userId:      ObjectId → User (required, indexed)
  title:       String  default: "Mood Music"
  lastMood:    String  default: "chill"
  lastMessage: String  default: ""
}
```

---

## 20. MoodMessage

Lịch sử trò chuyện tạo playlist tâm trạng AI DJ.

```js
// src/models/mood-message.model.js
{
  conversationId: ObjectId → MoodConversation (required, indexed)
  userId:         ObjectId → User (required, indexed)
  role:           enum ["user", "assistant"] (required)
  content:        String (required)
  metadata:       Mixed  default: {}
}
```

---

## 21. MoodPlaylist

Snapshot playlist sinh ra từ AI DJ theo mood.

```js
// src/models/mood-playlist.model.js
{
  conversationId:   ObjectId → MoodConversation (required, indexed)
  userId:           ObjectId → User (required, indexed)
  title:            String  default: "Mood Music"
  description:      String  default: ""
  prompt:           String
  mood:             String  default: "chill"
  energy:           enum ["low", "medium", "high"]  default: "medium"
  inputKeywords:    [String]
  matchedTopicIds:  [ObjectId → Topic]
  matchedArtistIds: [ObjectId → Artist]
  matchStatus:      enum ["matched", "partial", "fallback"]  default: "fallback"
  source:           enum ["artist_match", "topic_match", "topic_partial", "fallback"]
  songs:            [ObjectId → Song]
  songSnapshots: [{
    songId:    ObjectId
    title:     String
    artists:   [String]
    imageUrl:  String
    audioUrl:  String
    duration:  Number
  }]
}
```

---

## 22. SongPlayEvent

Ghi nhận sự kiện phát nhạc phục vụ bảng xếp hạng thời gian thực và Flowchart (cooldown 30s per IP, stage 2 lifecycle).

```js
// src/models/song-play-event.model.js
{
  songId:   ObjectId → Song (required, indexed)
  playedAt: Date  default: Date.now
  // Index: (songId, playedAt)
  // timestamps: false (append-only)
}
```

---

## 23. SongDownloadEvent

Nhật ký tải bài hát về bộ nhớ thiết bị.

```js
// src/models/song-download-event.model.js
{
  userId:       ObjectId → User (required, indexed)
  songId:       ObjectId → Song (required, indexed)
  downloadedAt: Date  default: Date.now
}
```

---

## 24. SongShareEvent

Theo dõi tương tác chia sẻ liên kết mạng xã hội (Facebook, Zalo, Twitter/X, Telegram, QRCode).

```js
// src/models/share-event.model.js
{
  songId:    ObjectId → Song (required, indexed)
  source:    enum ["clipboard", "facebook", "zalo", "twitter", "x", "telegram", "qrcode", "other"]
  medium:    String  default: "share"
  campaign:  String  default: "social_sharing"
  si:        String (share tracking identifier)
  userId:    ObjectId → User (optional)
  ip:        String
  userAgent: String
}
// Index: (songId, createdAt: -1)
```

---

## Sơ đồ quan hệ giữa các Models chính

```
User ───────────── premiumPlan ──────→ Plan
User ───────────── favoriteSongs ────→ [Song]
User ───────────── playlists ────────→ [Playlist]
User ───────────── followedArtists ──→ [Artist]

Subscription ───── user ─────────────→ User
Subscription ───── plan ─────────────→ Plan
Subscription ───── transaction ──────→ Transaction

Song ───────────── artists ──────────→ [Artist]
Song ───────────── topicIds ─────────→ [Topic]
Song ───────────── uploadedBy ───────→ User

SongLyrics ─────── songId ───────────→ Song
SongLyrics ─────── artistId ─────────→ Artist
SongLyrics ─────── lastAlignmentJobId→ LyricsAlignmentJob

LyricsAlignmentJob songId ───────────→ Song
LyricsAlignmentJob artistId ─────────→ Artist

Comment ────────── userId ───────────→ User
Comment ────────── songId ───────────→ Song
Comment ────────── parentCommentId ──→ Comment (self-ref)

AssistantMessage ─ conversationId ───→ AssistantConversation
AssistantConv ──── actorId ──────────→ User / Artist (refPath)

Notification ───── user ─────────────→ User
SongShareEvent ─── songId ───────────→ Song
SongPlayEvent ──── songId ───────────→ Song
```
