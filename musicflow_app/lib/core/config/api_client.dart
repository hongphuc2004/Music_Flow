import 'dart:convert';
import 'dart:async';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:musicflow_app/data/services/auth_service.dart';

class NetworkException implements Exception {
  final String message;
  NetworkException(this.message);

  @override
  String toString() => message;
}

class ApiClient {
  static const Duration defaultTimeout = Duration(seconds: 15);
  static const int maxRetries = 3;

  /// Helper to generate common headers including optional JWT authentication token
  static Future<Map<String, String>> _getHeaders({
    bool requireAuth = true,
    Map<String, String>? extraHeaders,
  }) async {
    final headers = <String, String>{
      'Content-Type': 'application/json',
    };

    if (requireAuth) {
      final token = await AuthService.getToken();
      if (token != null && token.isNotEmpty) {
        headers['Authorization'] = 'Bearer $token';
      }
    }

    if (extraHeaders != null) {
      headers.addAll(extraHeaders);
    }
    return headers;
  }

  /// Sends a generalized HTTP request with automatic retries and custom timeout
  static Future<http.Response> request({
    required String method,
    required Uri uri,
    dynamic body,
    bool requireAuth = true,
    Map<String, String>? headers,
    Duration timeout = defaultTimeout,
  }) async {
    int attempts = 0;
    final allHeaders = await _getHeaders(requireAuth: requireAuth, extraHeaders: headers);
    final String? bodyStr = body != null ? jsonEncode(body) : null;

    while (attempts < maxRetries) {
      try {
        attempts++;
        late http.Response response;
        if (method == 'GET') {
          response = await http.get(uri, headers: allHeaders).timeout(timeout);
        } else if (method == 'POST') {
          response = await http.post(uri, headers: allHeaders, body: bodyStr).timeout(timeout);
        } else if (method == 'PUT') {
          response = await http.put(uri, headers: allHeaders, body: bodyStr).timeout(timeout);
        } else if (method == 'DELETE') {
          response = await http.delete(uri, headers: allHeaders, body: bodyStr).timeout(timeout);
        } else if (method == 'PATCH') {
          response = await http.patch(uri, headers: allHeaders, body: bodyStr).timeout(timeout);
        }
        return response;
      } on TimeoutException {
        if (attempts >= maxRetries) {
          throw NetworkException('Kết nối quá chậm. Vui lòng kiểm tra mạng.');
        }
      } on SocketException {
        if (attempts >= maxRetries) {
          throw NetworkException('Không có kết nối mạng.');
        }
      } catch (e) {
        if (attempts >= maxRetries) {
          throw NetworkException('Lỗi kết nối: $e');
        }
      }

      // Delay before retrying using exponential backoff
      await Future.delayed(Duration(milliseconds: 500 * attempts));
    }

    throw NetworkException('Không thể kết nối sau $maxRetries lần thử.');
  }

  static Future<http.Response> get(
    Uri uri, {
    bool requireAuth = false,
    Map<String, String>? headers,
    Duration timeout = defaultTimeout,
  }) {
    return request(
      method: 'GET',
      uri: uri,
      requireAuth: requireAuth,
      headers: headers,
      timeout: timeout,
    );
  }

  static Future<http.Response> post(
    Uri uri, {
    dynamic body,
    bool requireAuth = true,
    Map<String, String>? headers,
    Duration timeout = defaultTimeout,
  }) {
    return request(
      method: 'POST',
      uri: uri,
      body: body,
      requireAuth: requireAuth,
      headers: headers,
      timeout: timeout,
    );
  }

  static Future<http.Response> put(
    Uri uri, {
    dynamic body,
    bool requireAuth = true,
    Map<String, String>? headers,
    Duration timeout = defaultTimeout,
  }) {
    return request(
      method: 'PUT',
      uri: uri,
      body: body,
      requireAuth: requireAuth,
      headers: headers,
      timeout: timeout,
    );
  }

  static Future<http.Response> delete(
    Uri uri, {
    dynamic body,
    bool requireAuth = true,
    Map<String, String>? headers,
    Duration timeout = defaultTimeout,
  }) {
    return request(
      method: 'DELETE',
      uri: uri,
      body: body,
      requireAuth: requireAuth,
      headers: headers,
      timeout: timeout,
    );
  }

  static Future<http.Response> patch(
    Uri uri, {
    dynamic body,
    bool requireAuth = true,
    Map<String, String>? headers,
    Duration timeout = defaultTimeout,
  }) {
    return request(
      method: 'PATCH',
      uri: uri,
      body: body,
      requireAuth: requireAuth,
      headers: headers,
      timeout: timeout,
    );
  }
}
