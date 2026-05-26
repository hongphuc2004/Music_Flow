# Authentication — musicflow_app

## Storage

| Dữ liệu | Nơi lưu | Package |
|---------|---------|---------|
| `accessToken` | `flutter_secure_storage` | Mã hóa Keystore (Android) / Keychain (iOS) |
| `refreshToken` | `flutter_secure_storage` | Như trên |
| `userId`, `userName`, `userEmail`, `userAvatar`, `userRole` | `SharedPreferences` | Plain (không nhạy cảm) |

---

## AuthService (`data/services/auth_service.dart`)

```dart
class AuthService {
  static final FlutterSecureStorage _secureStorage = FlutterSecureStorage();
  static final SharedPreferences _prefs = ...;

  // Notifier cho UI rebuild khi login/logout
  static final ValueNotifier<User?> currentUserNotifier = ValueNotifier(null);
}
```

### Key methods

```dart
// Đăng ký
static Future<void> register(String name, String email, String password)
  → POST /api/auth/register
  → lưu tokens + user info

// Đăng nhập email
static Future<void> login(String email, String password)
  → POST /api/auth/login
  → lưu tokens + user info

// Đăng nhập Google
static Future<void> signInWithGoogle(String idToken)
  → POST /api/auth/google { token: idToken }
  → lưu tokens + user info

// Kiểm tra auth status (dùng trong SplashScreen)
static Future<bool> isLoggedIn()
  → đọc accessToken từ secure storage
  → kiểm tra không null + chưa hết hạn (decode JWT, check exp)

// Lấy access token (dùng trong mọi API call)
static Future<String?> getAccessToken()
  → đọc từ secure storage
  → nếu hết hạn → tryRefreshToken() trước

// Refresh token
static Future<bool> tryRefreshToken()
  → đọc refreshToken từ secure storage
  → POST /api/auth/refresh { refreshToken }
  → cập nhật accessToken mới
  → trả về false nếu refresh cũng hết hạn

// Đăng xuất
static Future<void> logout()
  → POST /api/auth/logout (xóa refresh token trên server)
  → xóa tất cả từ secure storage + SharedPreferences
  → currentUserNotifier.value = null
```

---

## Luồng đăng nhập Email

```
LoginScreen._loginWithEmail()
       │
       ▼
AuthService.login(email, password)
       │
       ▼
http.post('/api/auth/login', body: {email, password})
  timeout: 15s
       │
  200 OK
       ▼
_saveTokens(accessToken, refreshToken)
  → secureStorage.write('accessToken', ...)
  → secureStorage.write('refreshToken', ...)
       │
       ▼
_saveUserInfo(user)
  → SharedPreferences: userId, name, email, avatar, role
  → currentUserNotifier.value = user
       │
       ▼
Navigator.pushReplacement → MainScreen
```

---

## Luồng đăng nhập Google

```
LoginScreen._loginWithGoogle()
       │
       ▼
GoogleSignIn().signIn()
  → Google Sign-In dialog
  → Returns GoogleSignInAccount
       │
       ▼
googleAccount.authentication
  → Returns idToken (String)
       │
       ▼
AuthService.signInWithGoogle(idToken)
       │
       ▼
http.post('/api/auth/google', body: {token: idToken})
       │
  200 OK
       ▼
_saveTokens + _saveUserInfo (giống email login)
       │
       ▼
Navigator.pushReplacement → MainScreen
```

---

## Auto Token Refresh

Mỗi khi gọi API có auth:

```dart
// Trong service (ví dụ: song_api_service.dart)
Future<Map<String, String>> _getAuthHeaders() async {
  String? token = await AuthService.getAccessToken();

  if (token == null || AuthService.isTokenExpired(token)) {
    final refreshed = await AuthService.tryRefreshToken();
    if (!refreshed) {
      // Refresh cũng fail → logout
      await AuthService.logout();
      throw UnauthorizedException();
    }
    token = await AuthService.getAccessToken();
  }

  return {
    'Authorization': 'Bearer $token',
    'Content-Type': 'application/json',
  };
}
```

Khi nhận `401` từ server:
```dart
if (response.statusCode == 401) {
  final refreshed = await AuthService.tryRefreshToken();
  if (refreshed) {
    // retry request với token mới
    return _makeRequest();
  } else {
    await AuthService.logout();
    // navigate to LoginScreen
  }
}
```

---

## Token Expiry Check

```dart
static bool isTokenExpired(String token) {
  final parts = token.split('.');
  final payload = jsonDecode(
    utf8.decode(base64Url.decode(base64Url.normalize(parts[1])))
  );
  final exp = payload['exp'] as int;
  return DateTime.now().millisecondsSinceEpoch / 1000 >= exp;
}
```

---

## SplashScreen Auth Check

```dart
// splash_screen.dart
@override
void initState() {
  super.initState();
  _checkAuth();
}

Future<void> _checkAuth() async {
  await Future.delayed(Duration(seconds: 2));  // animation time

  final loggedIn = await AuthService.isLoggedIn();
  if (loggedIn) {
    // Preload user info
    await AuthService.loadCurrentUser();
    Navigator.pushReplacementNamed(context, '/main');
  } else {
    Navigator.pushReplacementNamed(context, '/login');
  }
}
```

---

## Đăng xuất

```dart
// SettingsScreen
TextButton(
  onPressed: () async {
    await AuthService.logout();
    Navigator.pushNamedAndRemoveUntil(context, '/login', (_) => false);
  },
  child: Text('Đăng xuất'),
)
```

`AuthService.logout()`:
1. Gọi `POST /api/auth/logout` với refreshToken
2. Xóa `accessToken`, `refreshToken` khỏi `flutter_secure_storage`
3. Xóa user info khỏi `SharedPreferences`
4. Set `currentUserNotifier.value = null`
5. `GlobalAudioState().reset()` → clear queue, current song
