# Tích hợp API Services — musicflow_app

Tài liệu mô tả tầng dịch vụ (`data/services/`) trong ứng dụng Flutter, sử dụng gói `http` để giao tiếp với backend Node.js.

---

## 1. Cấu hình Máy chủ & Interceptor Token

Tất cả các lệnh gọi API đều đi qua `ApiConfig.baseUrl`, tự động gắn tiêu đề xác thực nếu đã đăng nhập:

```dart
// lib/core/config/api_config.dart
class ApiConfig {
  static const String defaultUrl = 'http://10.0.2.2:5001';
  static String baseUrl = defaultUrl;
  
  static Map<String, String> headers([String? token]) => {
    'Content-Type': 'application/json',
    if (token != null) 'Authorization': 'Bearer $token',
  };
}
```

Token được bảo vệ trong `flutter_secure_storage` thông qua `AuthService`.

---

## 2. Danh sách các Services trong Ứng Dụng

| Service File | Trách nhiệm chính |
|--------------|-------------------|
| `auth_service.dart` | Đăng nhập email/mật khẩu, Google OAuth, Refresh token, Đăng xuất |
| `song_api_service.dart` | Tải danh sách bài hát, tìm kiếm, lấy vé nghe nhạc (Lossless), ghi nhận lượt nghe, chia sẻ |
| `playlist_api_service.dart` | Lấy playlist hệ thống, tạo và quản lý playlist cá nhân |
| `artist_api_service.dart` | Xem thông tin nghệ sĩ, danh sách bài hát của nghệ sĩ, theo dõi nghệ sĩ |
| `favorite_service.dart` | Thêm/xóa/kiểm tra bài hát yêu thích |
| `like_service.dart` | Thả tim bài hát |
| `comment_service.dart` | Lấy bình luận, gửi bình luận mới, thả tim bình luận |
| `topic_api_service.dart` | Danh mục thể loại / chủ đề âm nhạc |
| `lyrics_api_service.dart` | Tải lời bài hát đồng bộ (Synced LRC) từ server |
| `offline_song_service.dart` | Quản lý tải xuống và lưu trữ tệp bài hát cục bộ qua Hive NoSQL |
| `play_history_service.dart` | Lưu và đọc lịch sử nghe nhạc gần đây |
| `assistant_api_service.dart` | Gửi tin nhắn Trợ lý AI, kiểm tra hạn mức Quota, xác nhận hành động tự động |
| `subscription_api_service.dart` | Lấy danh sách gói cước, tạo yêu cầu thanh toán Premium, kiểm tra thuê bao |

---

## 3. Chi tiết các Endpoint mới được Tích hợp

### A. AssistantApiService (`assistant_api_service.dart`)
- **`sendMessage(String message, {String? conversationId})`**: Gửi tin nhắn tới trợ lý thông minh (`POST /api/ai/assistant/messages`).
- **`getQuota()`**: Lấy số lượt sử dụng AI còn lại trong ngày (`GET /api/ai/assistant/quota`).
- **`getConversations()` & `getConversationDetail(id)`**: Lấy danh sách và chi tiết các cuộc hội thoại cũ.
- **`confirmAction(String actionId)`**: Thực thi hành động do AI đề xuất (`POST /api/ai/assistant/actions/:id/confirm`).

### B. SubscriptionApiService (`subscription_api_service.dart`)
- **`getActivePlans()`**: Lấy danh sách các gói cước đang mở bán (`GET /api/plans`).
- **`checkout(String planId, String paymentMethod)`**: Khởi tạo giao dịch thanh toán (`POST /api/subscriptions/checkout`).
- **`getCurrentSubscription()`**: Kiểm tra quyền lợi và hạn sử dụng Premium hiện tại của người dùng (`GET /api/subscriptions/current`).
- **`mockConfirm(String transactionRef)`**: Xác nhận giao dịch Sandbox để kích hoạt ngay Premium khi thử nghiệm.

### C. SongApiService Nâng Cao (`song_api_service.dart`)
- **`issuePlaybackTicket(String songId)`**: Xin cấp vé phát nhạc (`GET /api/songs/:id/ticket`), tự động cấp link chất lượng cao HQ 320kbps nếu tài khoản là Premium.
- **`registerPlay(String songId)`**: Ghi nhận một lượt phát hợp lệ (Qualified play) để xếp hạng công bằng.
- **`updatePlayFeedback(String songId, String eventId, Map data)`**: Gửi thông số thời gian nghe thực tế nhằm huấn luyện hệ thống gợi ý thích ứng.
- **`recordShareEvent(String songId, String source)`**: Ghi nhận tương tác chia sẻ mạng xã hội (`POST /api/songs/:id/share-event`).
- **`getRankings()`**: Lấy bảng xếp hạng các bài hát thịnh hành theo tuần/tháng.
- **`getSimilarSongs(String songId)`**: Trạm phát radio bài hát tương đồng.
