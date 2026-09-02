import 'dart:convert';
import 'package:musicflow_app/core/config/api_config.dart';
import 'package:musicflow_app/core/config/api_client.dart';
import 'package:musicflow_app/data/models/plan_model.dart';
import 'package:musicflow_app/data/models/user_model.dart';
import 'package:musicflow_app/data/services/auth_service.dart';

class SubscriptionStatus {
  final bool isPremium;
  final String planName;
  final DateTime? startDate;
  final DateTime? endDate;
  final String status;
  final Map<String, dynamic>? activeSubscription;

  SubscriptionStatus({
    required this.isPremium,
    required this.planName,
    this.startDate,
    this.endDate,
    required this.status,
    this.activeSubscription,
  });

  String get formattedExpiry {
    if (endDate == null) return 'Không giới hạn';
    return '${endDate!.day.toString().padLeft(2, '0')}/${endDate!.month.toString().padLeft(2, '0')}/${endDate!.year}';
  }
}

class CheckoutResult {
  final bool success;
  final String message;
  final String? paymentUrl;
  final String? transactionRef;
  final Map<String, dynamic>? transaction;

  CheckoutResult({
    required this.success,
    required this.message,
    this.paymentUrl,
    this.transactionRef,
    this.transaction,
  });
}

class SubscriptionApiService {
  static String get plansUrl => ApiConfig.plansEndpoint;
  static String get subUrl => ApiConfig.subscriptionsEndpoint;

  /// Lấy danh sách các gói cước đang hoạt động
  static Future<List<Plan>> getActivePlans() async {
    try {
      final response = await ApiClient.get(Uri.parse(plansUrl));
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        if (data['success'] == true && data['data'] is List) {
          return (data['data'] as List)
              .map((e) => Plan.fromJson(e as Map<String, dynamic>))
              .toList();
        }
      }
      return [];
    } catch (e) {
      return [];
    }
  }

  /// Lấy thông tin gói Premium hiện tại của người dùng
  static Future<SubscriptionStatus?> getCurrentSubscription() async {
    try {
      final response = await ApiClient.get(Uri.parse('$subUrl/current'));
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        if (data['success'] == true && data['data'] != null) {
          final resData = data['data'];
          final activeSub = resData['activeSubscription'];
          final userMap = resData['user'];

          if (userMap != null) {
            // Cập nhật lại thông tin user local
            final updatedUser = User.fromJson(userMap);
            AuthService.currentUserNotifier.value = updatedUser;
          }

          if (activeSub != null) {
            return SubscriptionStatus(
              isPremium: true,
              planName: activeSub['plan']?['name'] ?? 'PREMIUM',
              startDate: activeSub['startDate'] != null
                  ? DateTime.tryParse(activeSub['startDate'].toString())
                  : null,
              endDate: activeSub['endDate'] != null
                  ? DateTime.tryParse(activeSub['endDate'].toString())
                  : null,
              status: activeSub['status'] ?? 'active',
              activeSubscription: activeSub,
            );
          }
        }
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  /// Khởi tạo thanh toán gói cước
  static Future<CheckoutResult> checkout({
    required String planId,
    String paymentMethod = 'mock',
  }) async {
    try {
      final response = await ApiClient.post(
        Uri.parse('$subUrl/checkout'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({
          'planId': planId,
          'paymentMethod': paymentMethod,
        }),
      );

      final data = json.decode(response.body);
      if (response.statusCode == 200 && data['success'] == true) {
        return CheckoutResult(
          success: true,
          message: data['message'] ?? 'Khởi tạo đơn hàng thành công',
          paymentUrl: data['paymentUrl'],
          transactionRef: data['transaction']?['transactionRef'],
          transaction: data['transaction'],
        );
      }
      return CheckoutResult(
        success: false,
        message: data['message'] ?? 'Khởi tạo thanh toán thất bại',
      );
    } catch (e) {
      return CheckoutResult(
        success: false,
        message: 'Lỗi kết nối máy chủ: $e',
      );
    }
  }

  /// Xác nhận thanh toán Mock (Kích hoạt tức thì)
  static Future<bool> mockConfirm({required String transactionRef}) async {
    try {
      final response = await ApiClient.post(
        Uri.parse('$subUrl/mock-confirm'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({'transactionRef': transactionRef}),
      );

      final data = json.decode(response.body);
      if (response.statusCode == 200 && data['success'] == true) {
        // Tự động load lại subscription để cập nhật state User
        await getCurrentSubscription();
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }
}
