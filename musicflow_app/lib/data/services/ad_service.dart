import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:musicflow_app/core/config/api_config.dart';
import 'package:musicflow_app/data/models/ad_model.dart';
import 'package:musicflow_app/data/services/auth_service.dart';

class AdDecision {
  final bool hasAd;
  final String tier;
  final AdModel? ad;
  final String? reason;

  const AdDecision({
    required this.hasAd,
    this.tier = 'basic',
    this.ad,
    this.reason,
  });
}

class AdService {
  static const Duration _timeout = Duration(seconds: 4);

  /// Kiểm tra xem Backend có yêu cầu phát quảng cáo xen kẽ không.
  /// Backend là nguồn duy nhất xác thực tier và quyết định quyền quảng cáo.
  static Future<AdDecision> checkNextAd({required int songsPlayedCount}) async {
    try {
      final token = await AuthService.getToken();
      final headers = <String, String>{
        'Content-Type': 'application/json',
      };
      if (token != null && token.isNotEmpty) {
        headers['Authorization'] = 'Bearer $token';
      }

      final response = await http
          .post(
            Uri.parse(ApiConfig.checkNextAdEndpoint),
            headers: headers,
            body: jsonEncode({'songsPlayedCount': songsPlayedCount}),
          )
          .timeout(_timeout);

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data['success'] == true && data['hasAd'] == true && data['ad'] != null) {
          return AdDecision(
            hasAd: true,
            tier: data['tier']?.toString() ?? 'basic',
            ad: AdModel.fromJson(data['ad']),
          );
        }
        return AdDecision(
          hasAd: false,
          tier: data['tier']?.toString() ?? 'basic',
          reason: data['reason']?.toString(),
        );
      }

      // Backend trả về non-200 -> Fallback an toàn tiếp tục nghe nhạc
      return const AdDecision(hasAd: false, reason: 'api_non_200_fallback');
    } catch (e) {
      debugPrint('[AdService] checkNextAd fallback error: $e');
      // Rule 5: Fallback an toàn tuyệt đối khi API lỗi hoặc timeout
      return const AdDecision(hasAd: false, reason: 'network_timeout_fallback');
    }
  }

  /// Lấy danh sách Banner quảng cáo cho màn hình
  static Future<List<AdModel>> getBannerAds() async {
    try {
      final token = await AuthService.getToken();
      final headers = <String, String>{};
      if (token != null && token.isNotEmpty) {
        headers['Authorization'] = 'Bearer $token';
      }

      final response = await http
          .get(Uri.parse(ApiConfig.bannerAdsEndpoint), headers: headers)
          .timeout(_timeout);

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data['success'] == true && data['data'] is List) {
          return (data['data'] as List)
              .map((item) => AdModel.fromJson(item))
              .toList();
        }
      }
      return [];
    } catch (_) {
      return [];
    }
  }

  /// Ghi nhận lượt hiển thị / nghe quảng cáo
  static Future<void> recordImpression(String adId) async {
    if (adId.isEmpty) return;
    try {
      await http.post(Uri.parse(ApiConfig.adImpressionEndpoint(adId))).timeout(const Duration(seconds: 2));
    } catch (_) {}
  }

  /// Ghi nhận lượt click quảng cáo
  static Future<void> recordClick(String adId) async {
    if (adId.isEmpty) return;
    try {
      await http.post(Uri.parse(ApiConfig.adClickEndpoint(adId))).timeout(const Duration(seconds: 2));
    } catch (_) {}
  }
}
