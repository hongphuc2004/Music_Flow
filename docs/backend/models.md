# Database Models — musicflow_backend

Tất cả models dùng Mongoose + MongoDB. `timestamps: true` mặc định → tự có `createdAt`, `updatedAt`.

---

## User

```js
// src/models/user.model.js
{
  name:             String (required)
  email:            String (required, unique, lowercase)
  password:         String (minlength 6, optional cho Google login)
  googleId:         String (unique, sparse)
  provider:         enum ["local", "google"]  default: "local"
  role:             enum ["user", "admin"]    default: "user"
  avatar:           String  default: ""
  favoriteSongs:    [ObjectId → Song]
  playlists:        [ObjectId → Playlist]
  followedArtists:  [ObjectId → Artist]
}
```

**Methods:**
- `comparePassword(plain)` → bcrypt so sánh
- `toJSON()` → bỏ trường `password` khỏi output

---

## Artist

```js
// src/models/artist.model.js
{
  name:     String (required)
  email:    String (required, unique, lowercase)
  password: String (minlength 6)
  googleId: String (unique, sparse)
  provider: enum ["local", "google"]
  avatar:   String  default: ""
  bio:      String  default: ""
  role:     String  default: "artist"  (fixed)
}
```

---

## Song

```js
// src/models/song.model.js
{
  title:          String (required)
  artists:        [ObjectId → Artist]
  topicIds:       [ObjectId → Topic]
  uploadedBy:     ObjectId → User  (null = admin upload)
  isPublic:       Boolean  default: false
  audioUrl:       String (required)  ← Cloudinary URL
  audioPublicId:  String             ← Cloudinary public_id
  duration:       Number             ← seconds, từ Cloudinary metadata
  imageUrl:       String  default: defaultSongImageUrl
  imagePublicId:  String
  lyrics:         String  default: ""  ← nội dung LRC
  source:         enum ["admin", "artist", "user"]  default: "admin"
  allowDownload:  Boolean  default: true
  playCount:      Number  default: 0
  likeCount:      Number  default: 0
  commentCount:   Number  default: 0
  shareCount:     Number  default: 0
}
```

**Indexes:** isPublic, artists, topicIds, uploadedBy, title (text search)

---

## Playlist (User playlists)

```js
// src/models/playlist.model.js
{
  name:        String (required)
  description: String  default: ""
  userId:      ObjectId → User (required)
  songs:       [ObjectId → Song]
  coverImage:  String  default: ""
  isPublic:    Boolean  default: false
}
// Virtual: songCount
```

---

## Playlist-Song (System playlists do Admin tạo)

```js
// src/models/playlist-song.model.js
// Collection: "system_playlist"
{
  name:        String (required)
  description: String
  songs:       [ObjectId → Song]
  coverImage:  String
  isPublic:    Boolean  default: true
  createdBy:   ObjectId → User (required)
}
// Virtual: songCount
```

---

## Topic

```js
// src/models/topic.model.js
{
  name:        String (required, unique)
  description: String  default: ""
  avatar:      String  default: ""
}
```

---

## Comment

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
  reactionCount: Number  default: 0
}
```

**Indexes:**
- `(songId, parentCommentId, createdAt)` — lấy replies
- `(songId, reactionCount, createdAt)` — sort by popular

---

## SongLike

```js
// src/models/song-like.model.js
{
  userId: ObjectId → User (required)
  songId: ObjectId → Song (required)
}
// Unique index: (userId, songId)
```

---

## Favorite

```js
// src/models/favorite.model.js
{
  userId: ObjectId → User (required)
  songId: ObjectId → Song (required)
}
// Unique index: (userId, songId)
```

---

## RefreshToken

```js
// src/models/refreshToken.model.js
{
  userId:    ObjectId → User (required)
  tokenHash: String (required, unique)  ← SHA256(token)
  expiresAt: Date (required)
}
```

---

## MoodConversation

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

## MoodMessage

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

## MoodPlaylist

```js
// src/models/mood-playlist.model.js
{
  conversationId:   ObjectId → MoodConversation (required, indexed)
  userId:           ObjectId → User (required, indexed)
  title:            String  default: "Mood Music"
  description:      String  default: ""
  prompt:           String  ← câu người dùng nhập
  mood:             String  default: "chill"
  energy:           enum ["low", "medium", "high"]  default: "medium"
  inputKeywords:    [String]
  matchedTopicIds:  [ObjectId → Topic]
  matchedArtistIds: [ObjectId → Artist]
  matchStatus:      enum ["matched", "partial", "fallback"]  default: "fallback"
  source:           enum ["artist_match", "topic_match", "topic_partial", "fallback"]
  songs:            [ObjectId → Song]
  songSnapshots: [{  ← bản sao snapshot tại thời điểm tạo
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

## SongPlayEvent

```js
// src/models/song-play-event.model.js
{
  songId:   ObjectId → Song (required, indexed)
  playedAt: Date  default: now
}
// Index: (songId, playedAt)
// timestamps: false
```

> Dùng để tính flowchart trending theo giờ. Mỗi lần play → 1 document. Có cooldown 30s per IP.

---

## SongDownloadEvent

```js
// src/models/song-download-event.model.js
{
  userId:       ObjectId → User (required, indexed)
  songId:       ObjectId → Song (required, indexed)
  downloadedAt: Date  default: now
}
// Indexes: (userId, downloadedAt), (userId, songId, downloadedAt)
```

---

## Quan hệ giữa các models

```
User ──────────── favoriteSongs ──→ [Song]
User ──────────── playlists ──────→ [Playlist]
User ──────────── followedArtists → [Artist]

Song ──────────── artists ────────→ [Artist]
Song ──────────── topicIds ───────→ [Topic]
Song ──────────── uploadedBy ─────→ User

Playlist ─────── userId ──────────→ User
Playlist ─────── songs ───────────→ [Song]

Comment ──────── userId ──────────→ User
Comment ──────── songId ──────────→ Song
Comment ──────── parentCommentId ─→ Comment (self-ref)

MoodConversation ─ userId ─────────→ User
MoodMessage ────── conversationId ─→ MoodConversation
MoodPlaylist ───── conversationId ─→ MoodConversation
MoodPlaylist ───── songs ──────────→ [Song]
```
