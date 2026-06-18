import 'dart:convert';
import 'dart:async';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:musicflow_app/core/config/api_config.dart';
import '../models/user_model.dart';

class AuthService {
  static const String baseUrl = ApiConfig.authEndpoint;
  static const Duration timeout = Duration(seconds: 15);

  // Keys cho SharedPreferences
  static const String _tokenKey = 'auth_token';
  static const String _refreshTokenKey = 'refresh_token';
  static const String _userKey = 'user_data';
  static const FlutterSecureStorage _secureStorage = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );
  static final ValueNotifier<User?> currentUserNotifier = ValueNotifier<User?>(
    null,
  );

  // ================= REGISTER =================
  static Future<AuthResult> register({
    required String name,
    required String email,
    required String password,
  }) async {
    try {
      final response = await http
          .post(
            Uri.parse("$baseUrl/register"),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({
              'name': name,
              'email': email,
              'password': password,
            }),
          )
          .timeout(timeout);

      final data = jsonDecode(response.body);

      if (response.statusCode == 201 && data['success'] == true) {
        // Lưu token, refresh token và user
        await _saveAuthData(data['token'], data['refreshToken'], data['user']);
        return AuthResult(
          success: true,
          message: data['message'],
          user: User.fromJson(data['user']),
          token: data['token'],
        );
      } else {
        return AuthResult(
          success: false,
          message: data['message'] ?? 'Đăng ký thất bại',
        );
      }
    } on TimeoutException {
      return AuthResult(success: false, message: 'Kết nối quá chậm');
    } on SocketException {
      return AuthResult(success: false, message: 'Không có kết nối mạng');
    } catch (e) {
      return AuthResult(success: false, message: 'Lỗi: $e');
    }
  }

  // ================= LOGIN =================
  static Future<AuthResult> login({
    required String email,
    required String password,
  }) async {
    try {
      final response = await http
          .post(
            Uri.parse("$baseUrl/login"),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({'email': email, 'password': password}),
          )
          .timeout(timeout);

      final data = jsonDecode(response.body);

      if (response.statusCode == 200 && data['success'] == true) {
        // Lưu token, refresh token và user
        await _saveAuthData(data['token'], data['refreshToken'], data['user']);
        return AuthResult(
          success: true,
          message: data['message'],
          user: User.fromJson(data['user']),
          token: data['token'],
        );
      } else {
        return AuthResult(
          success: false,
          message: data['message'] ?? 'Đăng nhập thất bại',
        );
      }
    } on TimeoutException {
      return AuthResult(success: false, message: 'Kết nối quá chậm');
    } on SocketException {
      return AuthResult(success: false, message: 'Không có kết nối mạng');
    } catch (e) {
      return AuthResult(success: false, message: 'Lỗi: $e');
    }
  }

  // ================= GOOGLE SIGN IN =================
  // Phải là Web client ID (cùng giá trị GOOGLE_CLIENT_ID trên backend)
  static const String _googleServerClientId =
      '1030096415860-tsli9gc3ba61m86svamuhp2npv6icubb.apps.googleusercontent.com';

  static final GoogleSignIn _googleSignIn = GoogleSignIn(
    clientId: kIsWeb ? _googleServerClientId : null,
    serverClientId: kIsWeb ? null : _googleServerClientId,
    scopes: ['openid', 'email', 'profile'],
  );

  static Future<AuthResult> signInWithGoogle() async {
    try {
      // Đăng xuất trước để đảm bảo chọn tài khoản mới
      await _googleSignIn.signOut();

      // Bắt đầu đăng nhập Google
      final GoogleSignInAccount? googleUser = await _googleSignIn.signIn();

      if (googleUser == null) {
        // User hủy đăng nhập
        return AuthResult(success: false, message: 'Đăng nhập đã bị hủy');
      }

      final googleAuth = await googleUser.authentication;
      final idToken = googleAuth.idToken;
      final accessToken = googleAuth.accessToken;
      final credential = (idToken != null && idToken.isNotEmpty)
          ? idToken
          : accessToken;
      final tokenType = (idToken != null && idToken.isNotEmpty)
          ? 'id_token'
          : 'access_token';

      if (credential == null || credential.isEmpty) {
        return AuthResult(
          success: false,
          message: 'Không lấy được Google token. Kiểm tra cấu hình OAuth.',
        );
      }

      // Gửi thông tin lên backend
      final response = await http
          .post(
            Uri.parse("$baseUrl/google"),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({
              'credential': credential,
              'tokenType': tokenType,
            }),
          )
          .timeout(timeout);

      final data = jsonDecode(response.body);

      if (response.statusCode == 200 && data['success'] == true) {
        // Lưu token và user
        await _saveAuthData(data['token'], data['refreshToken'], data['user']);

        return AuthResult(
          success: true,
          message: data['message'],
          user: User.fromJson(data['user']),
          token: data['token'],
        );
      } else {
        return AuthResult(
          success: false,
          message: data['message'] ?? 'Đăng nhập Google thất bại',
        );
      }
    } on TimeoutException {
      return AuthResult(success: false, message: 'Kết nối quá chậm');
    } on SocketException {
      return AuthResult(success: false, message: 'Không có kết nối mạng');
    } catch (e) {
      return AuthResult(success: false, message: 'Lỗi Google Sign-In: $e');
    }
  }

  // ================= LOGOUT =================
  static Future<void> logout() async {
    // Đăng xuất Google nếu đã đăng nhập
    try {
      await _googleSignIn.signOut();
    } catch (_) {}

    final prefs = await SharedPreferences.getInstance();
    await _secureStorage.delete(key: _tokenKey);
    await _secureStorage.delete(key: _refreshTokenKey);
    await prefs.remove(_userKey);
    currentUserNotifier.value = null;
  }

  // ================= CHECK LOGIN STATUS =================
  static Future<bool> isLoggedIn() async {
    final token = await getToken();
    if (token == null || token.isEmpty) return false;

    try {
      final parts = token.split('.');
      if (parts.length == 3) {
        final payload = jsonDecode(
          utf8.decode(base64Url.decode(base64Url.normalize(parts[1]))),
        );
        final exp = payload['exp'] as int?;
        if (exp != null) {
          final expiry = DateTime.fromMillisecondsSinceEpoch(exp * 1000);
          final now = DateTime.now();

          if (now.isAfter(expiry)) {
            print("Access token đã hết hạn, tự động gọi tryRefreshToken()...");
            return await tryRefreshToken();
          } else {
            getProfile(); // Gọi ngầm để cập nhật dữ liệu user mới nhất nếu có
          }
        }
      }
    } catch (_) {}

    return true;
  }

  // ================= GET TOKEN =================
  static Future<String?> getToken() async {
    return _secureStorage.read(key: _tokenKey);
  }

  // ================= GET CURRENT USER =================
  static Future<User?> getCurrentUser() async {
    final prefs = await SharedPreferences.getInstance();
    final userJson = prefs.getString(_userKey);
    if (userJson != null) {
      final user = User.fromJson(jsonDecode(userJson));
      currentUserNotifier.value = user;
      return user;
    }
    currentUserNotifier.value = null;
    return null;
  }

  static Future<void> updateStoredUser(User user) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_userKey, jsonEncode(user.toJson()));
    currentUserNotifier.value = user;
  }

  // ================= SAVE AUTH DATA =================
  static Future<void> _saveAuthData(
    String token,
    String? refreshToken,
    Map<String, dynamic> user,
  ) async {
    final prefs = await SharedPreferences.getInstance();
    await _secureStorage.write(key: _tokenKey, value: token);
    if (refreshToken != null) {
      await _secureStorage.write(key: _refreshTokenKey, value: refreshToken);
    }
    await prefs.setString(_userKey, jsonEncode(user));
    currentUserNotifier.value = User.fromJson(user);
  }

  static Future<String?> getRefreshToken() async {
    return _secureStorage.read(key: _refreshTokenKey);
  }

  static Future<void> clearAuthData() async {
    final prefs = await SharedPreferences.getInstance();
    await _secureStorage.delete(key: _tokenKey);
    await _secureStorage.delete(key: _refreshTokenKey);
    await prefs.remove(_userKey);
    currentUserNotifier.value = null;
  }

  // Hàm tự động refresh access token nếu hết hạn (401)
  static Future<bool> tryRefreshToken() async {
    final refreshToken = await getRefreshToken();
    if (refreshToken == null) return false;
    final response = await http.post(
      Uri.parse("$baseUrl/refresh"),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'refreshToken': refreshToken}),
    );
    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      await _saveAuthData(data['token'], data['refreshToken'], data['user']);
      return true;
    }
    // Refresh token hết hạn hoặc không hợp lệ
    await clearAuthData();
    return false;
  }

  // ================= GET PROFILE (với token) =================
  static Future<AuthResult> getProfile() async {
    try {
      final token = await getToken();
      if (token == null) {
        return AuthResult(success: false, message: 'Chưa đăng nhập');
      }

      final response = await http
          .get(
            Uri.parse("$baseUrl/profile"),
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer $token',
            },
          )
          .timeout(timeout);

      final data = jsonDecode(response.body);

      if (response.statusCode == 200 && data['success'] == true) {
        return AuthResult(success: true, user: User.fromJson(data['user']));
      } else {
        return AuthResult(
          success: false,
          message: data['message'] ?? 'Lỗi lấy thông tin',
        );
      }
    } catch (e) {
      return AuthResult(success: false, message: 'Lỗi: $e');
    }
  }
}

// ================= AUTH RESULT CLASS =================
class AuthResult {
  final bool success;
  final String? message;
  final User? user;
  final String? token;

  AuthResult({required this.success, this.message, this.user, this.token});
}
