# Screens & Navigation — musicflow_app

## Navigation Map

```
SplashScreen (/)
  ├─ → LoginScreen          (nếu chưa đăng nhập)
  │       └─ → RegisterScreen
  └─ → MainScreen           (nếu đã đăng nhập)
         ├─ Tab 0: HomeScreen
         │       └─ → PlayerScreen (modal fullscreen)
         │       └─ → ArtistScreen
         │       └─ → HomePlaylistDetailScreen
         ├─ Tab 1: FlowchartScreen
         │       └─ → PlayerScreen
         ├─ Tab 2: SearchScreen
         │       └─ → PlayerScreen
         │       └─ → ArtistScreen
         ├─ Tab 3: AiDjScreen
         │       └─ → PlayerScreen
         └─ Tab 4: LibraryScreen
                 ├─ → FavoritesScreen
                 ├─ → PlaylistsScreen → PlaylistDetailScreen
                 ├─ → HistoryScreen
                 ├─ → DownloadedSongsScreen
                 └─ → YourUploadsScreen
```

---

## SplashScreen

**File:** `presentation/screens/splash/splash_screen.dart` (83 dòng)

**Chức năng:**
- Hiển thị logo/animation trong khi check auth
- `AuthService.isLoggedIn()` → đọc token từ `flutter_secure_storage`
- Nếu có token hợp lệ → `Navigator.pushReplacement('/main')`
- Nếu không → `Navigator.pushReplacement('/login')`

```
SplashScreen
  └─ Lottie animation hoặc logo
  └─ initState: AuthService.checkAuthStatus()
        ├─ token tồn tại + chưa hết hạn → MainScreen
        └─ không có/hết hạn → LoginScreen
```

---

## LoginScreen

**File:** `presentation/screens/login/login_screen.dart` (230 dòng)

**Chức năng:**
- Form email + password với validation
- Nút Google Sign-In (sử dụng `google_sign_in`)
- Toggle hiển thị password
- Link đến RegisterScreen
- Xử lý lỗi bằng SnackBar

**Luồng:**
```
LoginScreen
  ├─ _loginWithEmail()
  │     └─ AuthService.login(email, password)
  │           └─ POST /api/auth/login
  │                 ├─ OK → lưu tokens → MainScreen
  │                 └─ Lỗi → SnackBar "Email hoặc mật khẩu sai"
  │
  └─ _loginWithGoogle()
        └─ GoogleSignIn().signIn() → idToken
              └─ AuthService.signInWithGoogle(idToken)
                    └─ POST /api/auth/google
                          ├─ OK → lưu tokens → MainScreen
                          └─ Lỗi → SnackBar
```

---

## MainScreen

**File:** `main.dart`

**Chức năng:** Bottom navigation với 5 tabs, dùng `IndexedStack` (tabs không bị dispose khi chuyển tab).

```dart
IndexedStack(
  index: _currentIndex,
  children: [
    HomeScreen(),
    FlowchartScreen(),
    SearchScreen(),
    AiDjScreen(onPlayAll: _handlePlayAll),
    LibraryScreen(),
  ],
)
```

Bao bọc bởi `MiniPlayerWrapper` → MiniPlayer luôn visible.

---

## HomeScreen

**File:** `presentation/screens/home/home_screen.dart` (473 dòng)

**Sections:**
1. **Top Section** — Banner bài hát nổi bật (horizontal scroll)
2. **System Playlists** — Carousel do admin tạo
3. **Recommended Songs** — 12 bài random
4. **Featured Artists** — Avatar + tên, tap → ArtistScreen
5. **All Songs** — Grid view toàn bộ bài hát public

**API calls:**
- `GET /api/playlists/system` → system playlists
- `GET /api/songs/recommended` → 12 bài random
- `GET /api/songs` → tất cả bài
- `GET /api/artist/profile?name=...` → avatar nghệ sĩ (pre-fetch)

**Sub-files:**
```
home/
├─ home_screen.dart              ← Orchestrator
├─ home_top_section.dart         ← Banner bài nổi bật
├─ home_playlist_section.dart    ← Carousel system playlists
├─ home_recommended_section.dart ← 12 bài random
├─ home_artist_section.dart      ← Featured artists
├─ home_song_list_section.dart   ← All songs grid
├─ home_playlist_detail_screen.dart ← Chi tiết 1 playlist
└─ home_shared.dart              ← Shared widgets (SongTile, etc.)
```

---

## FlowchartScreen

**File:** `presentation/screens/chart/flowchart_screen.dart`

**Chức năng:**
- Hiển thị top bài hát trending theo thời gian
- Dữ liệu từ `GET /api/songs/flowchart` → play counts theo giờ
- Chart visualization (bar chart hoặc list với rank)

---

## SearchScreen

**File:** `presentation/screens/search/search_screen.dart` (939 dòng)

**3 states:**

**State 1: Topic grid** (mặc định, không có query)
```
TopicGrid
  └─ GET /api/topics → 2-column grid
       └─ Tap topic → lấy songs theo topic
            └─ GET /api/topics/:id/songs
```

**State 2: Text search**
```
TextField input (debounce 500ms)
  └─ GET /api/songs/search?q=...
       └─ Kết quả: Artists + Songs mixed
```

**State 3: Voice search**
```
Mic button
  └─ speech_to_text: startListening()
       └─ onResult → điền vào TextField → trigger search
```

**Search History:**
- Lưu 10 queries gần nhất vào `SharedPreferences`
- Hiển thị dưới search bar khi focus

---

## PlayerScreen

**File:** `presentation/screens/player/player_screen.dart` (1125 dòng) — màn hình lớn nhất.

**Layout:** PageView ngang với 3 pages

### Page 1: Album Art
```
Column
  ├─ AppBar (back button, title "Now Playing", share)
  ├─ AnimatedContainer
  │     └─ Hero(tag: "albumArt")
  │           └─ ClipRRect → NetworkImage (ảnh bìa xoay khi phát)
  ├─ Song title + Artist
  └─ Playback Controls
        ├─ Shuffle button
        ├─ Previous button
        ├─ Play/Pause button (lớn)
        ├─ Next button
        └─ Repeat button
  └─ Progress bar (Slider)
  └─ Time stamps (current / total)
```

### Page 2: Lyrics
```
SyncedLyricsView
  └─ LyricsApiService.getLyrics(songId)
       └─ GET /api/songs/:id/lyrics → LRC text
            └─ LrcParser.parse() → List<LrcLine>
                 └─ ListView với highlight dòng hiện tại
                      └─ Scroll auto-follow vị trí phát
```

### Page 3: Queue
```
ListView.builder
  └─ queue songs
       └─ Tap → GlobalAudioState.skipToIndex(i)
       └─ Drag to reorder (ReorderableListView)
```

**Bottom Action Bar (PlayerBottomActionBar widget):**
```
Row
  ├─ Like button    → LikeService.toggle(songId)
  ├─ Comment button → showModalBottomSheet(SongCommentsSheet)
  ├─ Download button→ OfflineSongService.download(song)
  └─ Share button   → Share.share(songUrl)
```

**Spinning disc animation:**
```dart
// Khi isPlaying = true → disc xoay liên tục
AnimationController(vsync: this, duration: Duration(seconds: 10))
  ..repeat();
// Khi pause → controller.stop()
```

---

## AiDjScreen

**File:** `presentation/screens/ai_dj/ai_dj_screen.dart` (681 dòng)

Xem chi tiết tại [ai-dj.md](./ai-dj.md).

---

## LibraryScreen

**File:** `presentation/screens/library/library_screen.dart`

**Menu items:**
```
LibraryScreen
  ├─ Yêu thích      → FavoritesScreen
  ├─ Playlist       → PlaylistsScreen → PlaylistDetailScreen
  ├─ Lịch sử        → HistoryScreen
  ├─ Đã tải xuống   → DownloadedSongsScreen
  └─ Bài hát của tôi→ YourUploadsScreen
```

### FavoritesScreen
- `GET /api/favorites` → danh sách bài yêu thích
- SongTile với swipe-to-remove

### PlaylistsScreen
- `GET /api/playlists` → user playlists
- Nút tạo playlist mới → Dialog đặt tên
- `POST /api/playlists`

### PlaylistDetailScreen
- `GET /api/playlists/:id` → songs list
- Drag to reorder → `PUT /api/playlists/:id/reorder`
- Add songs → search + add

### HistoryScreen
- `PlayHistoryService.getHistory()` → local SharedPreferences
- Lịch sử 50 bài gần nhất, có timestamp

### DownloadedSongsScreen
- `OfflineSongService.getDownloadedSongs()` → Hive
- Hiển thị bài đã download với kích thước file
- Swipe to delete → xóa file + Hive record

### YourUploadsScreen
- `GET /api/songs/my-uploads` → bài user đã upload
- Toggle public/private → `PATCH /api/songs/:id/toggle-public`
- Upload bài mới → FilePicker + `POST /api/songs`

---

## ArtistScreen

**File:** `presentation/screens/artist/artist_screen.dart`

**Sections:**
```
artist/
├─ artist_screen.dart          ← Orchestrator
├─ artist_header_section.dart  ← Avatar, tên, followers, nút follow
├─ artist_popular_section.dart ← Top songs của nghệ sĩ
├─ artist_release_section.dart ← Albums/releases
├─ artist_about_section.dart   ← Bio text
└─ artist_shared.dart          ← Shared widgets
```

**API:**
- `GET /api/artist/profile?name=<name>` → ArtistProfile
- `GET /api/artist/:id/follow-status` → following?
- `POST /api/artist/:id/follow` → toggle follow

---

## SettingsScreen

**File:** `presentation/screens/settings/settings_screen.dart`

- Hiển thị thông tin profile
- Link đến EditProfileScreen
- Đăng xuất → `AuthService.logout()` → xóa tokens → LoginScreen

### EditProfileScreen
- Đổi tên → `PUT /api/users/update { name }`
- Đổi avatar → `image_picker` → `PUT /api/users/update { avatar }`

---

## Widgets chia sẻ

### MiniPlayer (`mini_player.dart`)
```
Card (elevation 4)
  └─ Row
       ├─ NetworkImage (ảnh bìa, 50x50)
       ├─ Column (tên bài, nghệ sĩ — 1 line, ellipsis)
       └─ Row (Like, Previous, Play/Pause, Next)
```
Tap → `Navigator.push(PlayerScreen)`

### MiniPlayerWrapper (`mini_player_wrapper.dart`)
```
Stack
  ├─ child (nội dung screen)
  └─ Positioned(bottom: 0)
       └─ Consumer<GlobalAudioState>
            └─ AnimatedSlide (hiện/ẩn khi có/không có currentSong)
                 └─ MiniPlayer
```

### SongOptionsMenu (`song_options_menu.dart`)
Bottom sheet xuất hiện khi long-press bài hát:
- Thêm vào playlist
- Thêm vào yêu thích
- Tải xuống
- Chia sẻ
- Xem nghệ sĩ

### SongCommentsSheet (`song_comments_sheet.dart`)
- Comment list với threading (replies)
- TextField để gửi comment mới
- Long-press → sửa/xóa (nếu là chủ comment)
- Reaction (like) bằng double-tap

### SyncedLyricsView (`synced_lyrics_view.dart`)
- Nhận `List<LrcLine>` + `Duration position`
- Highlight dòng hiện tại dựa trên timestamp
- Auto-scroll mượt mà
- Tap vào dòng → seek đến timestamp đó
- Label "Lời ước tính" nếu lyrics không có timestamp
