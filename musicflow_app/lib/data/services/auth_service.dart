import 'dart:convert';
import 'dart:async';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:google_sign_in/google_sign_in.dart';
import '../models/user_model.dart';

class AuthService {
  static const String baseUrl = "http://10.29.58.153:5000/api/auth";
  static const Duration timeout = Duration(seconds: 15);
  
  // Keys cho SharedPreferences
  static const String _tokenKey = 'auth_token';
  static const String _userKey = 'user_data';

  // ================= REGISTER =================
  static Future<AuthResult> register({
    required String name,
    required String email,
    required String password,
  }) async {
    try {
      final response = await http.post(
        Uri.parse("$baseUrl/register"),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'name': name,
          'email': email,
          'password': password,
        }),
      ).timeout(timeout);

      final data = jsonDecode(response.body);

      if (response.statusCode == 201 && data['success'] == true) {
        // Lưu token và user
        await _saveAuthData(data['token'], data['user']);
        
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
      final response = await http.post(
        Uri.parse("$baseUrl/login"),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'email': email,
          'password': password,
        }),
      ).timeout(timeout);

      final data = jsonDecode(response.body);

      if (response.statusCode == 200 && data['success'] == true) {
        // Lưu token và user
        await _saveAuthData(data['token'], data['user']);
        
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
  static final GoogleSignIn _googleSignIn = GoogleSignIn(
    scopes: ['email', 'profile'],
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

      // Gửi thông tin lên backend
      final response = await http.post(
        Uri.parse("$baseUrl/google"),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'googleId': googleUser.id,
          'email': googleUser.email,
          'name': googleUser.displayName ?? googleUser.email.split('@').first,
          'avatar': googleUser.photoUrl ?? '',
        }),
      ).timeout(timeout);

      final data = jsonDecode(response.body);

      if (response.statusCode == 200 && data['success'] == true) {
        // Lưu token và user
        await _saveAuthData(data['token'], data['user']);
        
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
    await prefs.remove(_tokenKey);
    await prefs.remove(_userKey);
  }

  // ================= CHECK LOGIN STATUS =================
  static Future<bool> isLoggedIn() async {
    final token = await getToken();
    return token != null && token.isNotEmpty;
  }

  // ================= GET TOKEN =================
  static Future<String?> getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_tokenKey);
  }

  // ================= GET CURRENT USER =================
  static Future<User?> getCurrentUser() async {
    final prefs = await SharedPreferences.getInstance();
    final userJson = prefs.getString(_userKey);
    if (userJson != null) {
      return User.fromJson(jsonDecode(userJson));
    }
    return null;
  }

  // ================= SAVE AUTH DATA =================
  static Future<void> _saveAuthData(String token, Map<String, dynamic> user) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_tokenKey, token);
    await prefs.setString(_userKey, jsonEncode(user));
  }

  // ================= GET PROFILE (với token) =================
  static Future<AuthResult> getProfile() async {
    try {
      final token = await getToken();
      if (token == null) {
        return AuthResult(success: false, message: 'Chưa đăng nhập');
      }

      final response = await http.get(
        Uri.parse("$baseUrl/profile"),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      ).timeout(timeout);

      final data = jsonDecode(response.body);

      if (response.statusCode == 200 && data['success'] == true) {
        return AuthResult(
          success: true,
          user: User.fromJson(data['user']),
        );
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

  AuthResult({
    required this.success,
    this.message,
    this.user,
    this.token,
  });
}
