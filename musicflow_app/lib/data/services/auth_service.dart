import 'dart:convert';
import 'dart:async';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../models/user_model.dart';

class AuthService {
  static const String baseUrl = "http://172.16.0.28:5000/api/auth";
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

  // ================= LOGOUT =================
  static Future<void> logout() async {
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
