# MusicFlow App — Danh sách màn hình & tính năng

## Màn hình chính (Bottom Navigation)

### 1. HomeScreen
`lib/presentation/screens/home/home_screen.dart`

- Greeting theo tên user đang đăng nhập
- **Hero section** — bài hát nổi bật + số lượng thư viện
- **Quick actions** — phát bài featured, mở playlist, phát gợi ý
- **Playlist carousel** — system playlists "Playlist cho hôm nay"
- **Recommended songs** — gợi ý dành cho bạn + nút làm mới
- **Artist carousel** — nghệ sĩ nổi bật (tối đa 6), tapping mở ArtistScreen
- **Danh sách bài hát** — toàn bộ thư viện
- Pull-to-refresh

---

### 2. SearchScreen
`lib/presentation/screens/search/search_screen.dart`

- Thanh tìm kiếm với debounce 500ms
- **Tìm kiếm giọng nói** (speech-to-text, tiếng Việt)
- **Topics grid** — duyệt nhạc theo chủ đề/vibe (2 cột)
- Tapping topic → danh sách bài hát theo topic
- **Lịch sử tìm kiếm** — lưu/xóa từng mục hoặc xóa tất cả
- **Kết quả tìm kiếm** — phân loại nghệ sĩ + bài hát; tapping nghệ sĩ → ArtistScreen

---

### 3. FlowchartScreen
`lib/presentation/screens/chart/flowchart_screen.dart`

- **Trending Spotlight** — top 3 bài hot nhất dạng card nổi bật
- **Top Flow** (nghe nhiều nhất) — bảng xếp hạng theo play count, expand/collapse top 10 → top 50
- **Top Rising** (tăng nhanh 24h) — rising score với màu xanh/cam theo chiều tăng/giảm, expand/collapse top 10 → top 50
- Auto-refresh mỗi 1 phút
- Tapping bài → phát với queue

---

### 4. AiDjScreen (Mood Music)
`lib/presentation/screens/ai_dj/ai_dj_screen.dart`

- **Chat interface** — nhập mood/cảm xúc, AI (Gemini) gợi ý playlist
- **Conversation chips** — chuyển qua lại các cuộc hội thoại mood cũ
- Nút "Mới" — tạo cuộc hội thoại mới
- Xóa conversation (confirm dialog)
- **Playlist card** — hiển thị playlist AI trả về, phát cả playlist hoặc từng bài
- Fallback indicator khi AI không khớp cảm xúc rõ ràng

---

### 5. LibraryScreen
`lib/presentation/screens/library/library_screen.dart`

- Menu điều hướng tới 4 sub-screen:
  - **Bài hát yêu thích** → FavoritesScreen
  - **Playlists** → PlaylistsScreen
  - **Bài hát của bạn** (uploads) → YourUploadsScreen
  - **Bài hát đã tải** (offline) → DownloadedSongsScreen
- **Nghe gần đây** — 3 bài hát mới nhất, "Xem tất cả" → HistoryScreen
- Truy cập nhanh Settings (icon góc phải)
- Pull-to-refresh

---

## PlayerScreen
`lib/presentation/screens/player/player_screen.dart`

- **Album art dạng đĩa xoay** (animation) với Hero transition
- **3 tabs swipe**: Đang phát / Lyrics / Danh sách chờ
- Progress bar + seek tới vị trí bất kỳ
- Điều khiển: Play/Pause, Next, Previous, Shuffle, Repeat (off / one / all)
- **Synced lyrics (LRC)** — highlight dòng theo thời gian, tap để seek; fallback estimated lyrics
- **Queue page** — danh sách bài đang chờ, tapping để phát bài bất kỳ
- **Bottom action bar**: Like (với like count), Comment (với comment count), Download offline, Share, More options
- More options menu: Thêm vào playlist, Yêu thích, Xem nghệ sĩ, Thông tin bài hát
- Sync với GlobalAudioState — tự cập nhật khi bài tự chuyển (auto-next)

---

## Sub-screens Library

### FavoritesScreen
`lib/presentation/screens/library/favorites_screen.dart`

- Danh sách bài hát đã yêu thích
- Phát từng bài hoặc play all

---

### PlaylistsScreen
`lib/presentation/screens/library/playlists_screen.dart`

- Danh sách playlist cá nhân
- Tạo playlist mới
- Tapping playlist → PlaylistDetailScreen

---

### PlaylistDetailScreen
`lib/presentation/screens/library/playlist_detail_screen.dart`

- Chi tiết playlist: tên, ảnh bìa, số bài
- Play all, Shuffle
- Danh sách bài hát trong playlist
- Xóa bài khỏi playlist

---

### YourUploadsScreen
`lib/presentation/screens/library/your_uploads_screen.dart`

- Danh sách bài hát user đã upload
- Phát từng bài hoặc play all

---

### DownloadedSongsScreen
`lib/presentation/screens/library/downloaded_songs_screen.dart`

- Danh sách bài hát đã tải offline (Hive)
- Phát offline không cần kết nối mạng

---

### HistoryScreen
`lib/presentation/screens/library/history_screen.dart`

- Toàn bộ lịch sử nghe nhạc
- Phát lại từng bài hoặc play all

---

### AlbumDetailScreen
`lib/presentation/screens/home/album_detail_screen.dart`

- Chi tiết system playlist/album
- Play all
- Danh sách bài hát trong album

---

## ArtistScreen
`lib/presentation/screens/artist/artist_screen.dart`

- **Header**: avatar, tên, số followers, nút Follow/Unfollow, Play All, Shuffle
- **Popular songs** — danh sách bài hát của artist, tapping phát với queue
- **Latest release** — bài release mới nhất
- **About section** — thông tin giới thiệu artist
- Pull-to-refresh

---

## Auth Screens

### SplashScreen
`lib/presentation/screens/splash/splash_screen.dart`

- Màn hình loading khởi động
- Kiểm tra token hợp lệ → điều hướng tự động vào app hoặc màn hình đăng nhập

---

### LoginScreen
`lib/presentation/screens/login/login_screen.dart`

- Đăng nhập bằng email + mật khẩu
- **Google Sign-In**
- Link chuyển sang RegisterScreen

---

### RegisterScreen
`lib/presentation/screens/login/register_screen.dart`

- Đăng ký tài khoản mới (name, email, password)

---

## Settings Screens

### SettingsScreen
`lib/presentation/screens/settings/settings_screen.dart`

- Hiển thị thông tin tài khoản (avatar, name, email)
- Chỉnh sửa profile → EditProfileScreen
- **Phát nhạc**: toggle Chất lượng cao, Hiển thị lyrics, Tự động phát
- **Tải xuống**: toggle Chỉ tải qua Wi-Fi
- **Bộ nhớ**: Xóa lịch sử phát, Xóa cache
- Về ứng dụng, Chính sách bảo mật, Điều khoản sử dụng
- Đăng xuất (confirm dialog)

---

### EditProfileScreen
`lib/presentation/screens/settings/edit_profile_screen.dart`

- Chỉnh sửa tên hiển thị
- Cập nhật avatar (chọn ảnh từ thư viện)
