import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:musicflow_app/core/theme/app_theme.dart';
import 'package:musicflow_app/core/utils/app_toast.dart';
import 'package:musicflow_app/data/models/plan_model.dart';
import 'package:musicflow_app/data/services/auth_service.dart';
import 'package:musicflow_app/data/services/subscription_api_service.dart';
import 'package:url_launcher/url_launcher.dart';

class PremiumScreen extends StatefulWidget {
  const PremiumScreen({super.key});

  @override
  State<PremiumScreen> createState() => _PremiumScreenState();
}

class _PremiumScreenState extends State<PremiumScreen> {
  List<Plan> _plans = [];
  SubscriptionStatus? _currentSub;
  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final results = await Future.wait([
        SubscriptionApiService.getActivePlans(),
        SubscriptionApiService.getCurrentSubscription(),
      ]);

      if (mounted) {
        setState(() {
          _plans = results[0] as List<Plan>;
          _currentSub = results[1] as SubscriptionStatus?;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = 'Không thể tải thông tin gói cước';
          _isLoading = false;
        });
      }
    }
  }

  void _showCheckoutSheet(Plan plan) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => _CheckoutModal(
        plan: plan,
        onPaymentSuccess: () {
          _loadData();
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final user = AuthService.currentUserNotifier.value;
    final isPremium = _currentSub?.isPremium ?? user?.hasActivePremium ?? false;

    return Scaffold(
      backgroundColor: const Color(0xFF0A0716),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.white),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFFF59E0B), Color(0xFFFFD700)],
                ),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(
                Icons.workspace_premium_rounded,
                size: 16,
                color: Color(0xFF090D1A),
              ),
            ),
            const SizedBox(width: 8),
            const Text(
              'MusicFlow Premium',
              style: TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w800,
                fontSize: 18,
              ),
            ),
          ],
        ),
        centerTitle: true,
      ),
      body: _isLoading
          ? const Center(
              child: CircularProgressIndicator(
                valueColor: AlwaysStoppedAnimation<Color>(Color(0xFFF59E0B)),
              ),
            )
          : _errorMessage != null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        _errorMessage!,
                        style: const TextStyle(color: Colors.white70),
                      ),
                      const SizedBox(height: 12),
                      ElevatedButton(
                        onPressed: _loadData,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF6C63FF),
                        ),
                        child: const Text('Thử lại'),
                      ),
                    ],
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _loadData,
                  color: const Color(0xFFF59E0B),
                  child: SingleChildScrollView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        // 1. Hero Banner
                        _buildHeroBanner(isPremium),
                        const SizedBox(height: 20),

                        // 2. Active Subscription Status Card (nếu đã có gói)
                        if (isPremium) ...[
                          _buildActiveSubscriptionCard(),
                          const SizedBox(height: 24),
                        ],

                        // 3. Section Title
                        Text(
                          isPremium ? 'GIA HẠN / ĐỔI GÓI CƯỚC' : 'CHỌN GÓI PREMIUM CỦA BẠN',
                          style: const TextStyle(
                            color: Color(0xFFF59E0B),
                            fontSize: 13,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 1.2,
                          ),
                        ),
                        const SizedBox(height: 12),

                        // 4. Plans List
                        ..._plans.map((plan) => Padding(
                              padding: const EdgeInsets.only(bottom: 16),
                              child: _buildPlanCard(plan, isPremium),
                            )),

                        const SizedBox(height: 16),

                        // 5. Bento Perks Grid
                        _buildPerksSection(),

                        const SizedBox(height: 40),
                      ],
                    ),
                  ),
                ),
    );
  }

  Widget _buildHeroBanner(bool isPremium) {
    return Container(
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: isPremium
              ? [
                  const Color(0xFF2E1A0A),
                  const Color(0xFF1E1408),
                  const Color(0xFF0F0B05),
                ]
              : [
                  const Color(0xFF1E163B),
                  const Color(0xFF140E28),
                  const Color(0xFF0E0B1A),
                ],
        ),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: isPremium
              ? const Color(0xFFF59E0B).withOpacity(0.4)
              : const Color(0xFF6C63FF).withOpacity(0.35),
        ),
        boxShadow: [
          BoxShadow(
            color: isPremium
                ? const Color(0xFFF59E0B).withOpacity(0.15)
                : const Color(0xFF6C63FF).withOpacity(0.12),
            blurRadius: 24,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: const LinearGradient(
                colors: [Color(0xFFF59E0B), Color(0xFFFFD700)],
              ),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFFF59E0B).withOpacity(0.45),
                  blurRadius: 20,
                  spreadRadius: 2,
                ),
              ],
            ),
            child: const Icon(
              Icons.workspace_premium_rounded,
              size: 36,
              color: Color(0xFF090D1A),
            ),
          ),
          const SizedBox(height: 14),
          Text(
            isPremium ? 'Đặc Quyền VIP Đang Hoạt Động' : 'Âm Nhạc Đỉnh Cao Không Giới Hạn',
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 20,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.5,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            isPremium
                ? 'Tận hưởng chất lượng 320kbps, AI DJ không giới hạn và dung lượng lưu trữ 1GB'
                : 'Mở khóa âm thanh chất lượng cao, tải ngoại tuyến và trải nghiệm AI DJ thông minh',
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: Colors.white70,
              fontSize: 13,
              height: 1.4,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActiveSubscriptionCard() {
    final planName = _currentSub?.planName ?? 'PREMIUM';
    final expiry = _currentSub?.formattedExpiry ?? 'Không xác định';

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFF59E0B).withOpacity(0.08),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFF59E0B).withOpacity(0.35)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: const Color(0xFFF59E0B).withOpacity(0.2),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(
              Icons.stars_rounded,
              color: Color(0xFFF59E0B),
              size: 24,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      'Gói $planName',
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                        fontSize: 15,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: const Color(0xFF10B981).withOpacity(0.2),
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: const Color(0xFF10B981).withOpacity(0.4)),
                      ),
                      child: const Text(
                        'ĐANG HOẠT ĐỘNG',
                        style: TextStyle(
                          color: Color(0xFF10B981),
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  'Hết hạn vào: $expiry',
                  style: const TextStyle(
                    color: Colors.white60,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPlanCard(Plan plan, bool isPremiumUser) {
    final isPopular = plan.name.toUpperCase().contains('PLUS');
    final isVip = plan.name.toUpperCase().contains('PREMIUM');

    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: isVip
              ? [
                  const Color(0xFF2A1E0E),
                  const Color(0xFF1A1309),
                ]
              : [
                  const Color(0xFF1A162B),
                  const Color(0xFF120E1E),
                ],
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: isVip
              ? const Color(0xFFF59E0B).withOpacity(0.55)
              : isPopular
                  ? const Color(0xFF00E5FF).withOpacity(0.45)
                  : Colors.white.withOpacity(0.12),
          width: isVip || isPopular ? 1.5 : 1.0,
        ),
        boxShadow: [
          if (isVip)
            BoxShadow(
              color: const Color(0xFFF59E0B).withOpacity(0.12),
              blurRadius: 16,
              offset: const Offset(0, 4),
            ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header Row: Plan name & Badge
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  plan.name,
                  style: TextStyle(
                    color: isVip ? const Color(0xFFFFD700) : Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                if (plan.badge.isNotEmpty)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      gradient: isVip
                          ? const LinearGradient(
                              colors: [Color(0xFFF59E0B), Color(0xFFFFD700)],
                            )
                          : const LinearGradient(
                              colors: [Color(0xFF00E5FF), Color(0xFF6C63FF)],
                            ),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      plan.badge,
                      style: const TextStyle(
                        color: Color(0xFF090D1A),
                        fontSize: 10,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 12),

            // Price Row
            Row(
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              children: [
                Text(
                  plan.formattedPrice,
                  style: TextStyle(
                    color: isVip ? const Color(0xFFFFD700) : Colors.white,
                    fontSize: 26,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(width: 6),
                Text(
                  '/ ${plan.durationInDays} ngày',
                  style: const TextStyle(
                    color: Colors.white54,
                    fontSize: 13,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),

            const Divider(color: Colors.white12, height: 1),
            const SizedBox(height: 14),

            // Benefits checklist
            ...plan.benefits.map((benefit) => Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Row(
                    children: [
                      Icon(
                        Icons.check_circle_rounded,
                        size: 16,
                        color: isVip
                            ? const Color(0xFFF59E0B)
                            : const Color(0xFF00E5FF),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          benefit,
                          style: const TextStyle(
                            color: Colors.white70,
                            fontSize: 13,
                          ),
                        ),
                      ),
                    ],
                  ),
                )),

            const SizedBox(height: 14),

            // Action Button
            SizedBox(
              width: double.infinity,
              height: 44,
              child: ElevatedButton(
                onPressed: () => _showCheckoutSheet(plan),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.transparent,
                  shadowColor: Colors.transparent,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                  padding: EdgeInsets.zero,
                ),
                child: Ink(
                  decoration: BoxDecoration(
                    gradient: isVip
                        ? const LinearGradient(
                            colors: [Color(0xFFF59E0B), Color(0xFFFFD700)],
                          )
                        : const LinearGradient(
                            colors: [Color(0xFF6C63FF), Color(0xFF00BCD4)],
                          ),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Container(
                    alignment: Alignment.center,
                    child: Text(
                      isPremiumUser ? 'Gia Hạn Ngay' : 'Nâng Cấp Ngay',
                      style: const TextStyle(
                        color: Color(0xFF090D1A),
                        fontWeight: FontWeight.w800,
                        fontSize: 14,
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPerksSection() {
    final perks = [
      {
        'icon': Icons.high_quality_rounded,
        'title': 'Chất lượng HQ 320kbps',
        'desc': 'Âm thanh chân thực, sống động từng chi tiết',
      },
      {
        'icon': Icons.download_for_offline_rounded,
        'title': 'Tải Nhạc Offline 1GB',
        'desc': 'Lưu bài hát không giới hạn để nghe mọi lúc',
      },
      {
        'icon': Icons.auto_awesome_rounded,
        'title': 'AI DJ Trợ Lý 24/7',
        'desc': 'Gợi ý playlist theo cảm xúc không giới hạn',
      },
      {
        'icon': Icons.verified_rounded,
        'title': 'Huy Hiệu VIP Vàng',
        'desc': 'Nổi bật hồ sơ cá nhân trong cộng đồng',
      },
    ];

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.04),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withOpacity(0.08)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'ĐẶC QUYỀN HỘI VIÊN PREMIUM',
            style: TextStyle(
              color: Colors.white,
              fontSize: 14,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.5,
            ),
          ),
          const SizedBox(height: 14),
          ...perks.map((p) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF59E0B).withOpacity(0.15),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Icon(
                        p['icon'] as IconData,
                        color: const Color(0xFFF59E0B),
                        size: 20,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            p['title'] as String,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          Text(
                            p['desc'] as String,
                            style: const TextStyle(
                              color: Colors.white54,
                              fontSize: 11,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              )),
        ],
      ),
    );
  }
}

class _CheckoutModal extends StatefulWidget {
  final Plan plan;
  final VoidCallback onPaymentSuccess;

  const _CheckoutModal({
    required this.plan,
    required this.onPaymentSuccess,
  });

  @override
  State<_CheckoutModal> createState() => _CheckoutModalState();
}

class _CheckoutModalState extends State<_CheckoutModal> {
  String _paymentMethod = 'mock'; // 'mock' hoặc 'vnpay'
  bool _isProcessing = false;

  Future<void> _handleConfirmPayment() async {
    setState(() => _isProcessing = true);

    try {
      final res = await SubscriptionApiService.checkout(
        planId: widget.plan.id,
        paymentMethod: _paymentMethod,
      );

      if (!res.success) {
        if (mounted) {
          AppToast.showError(context, res.message);
        }
        return;
      }

      if (_paymentMethod == 'vnpay') {
        // Mở URL VNPay Sandbox
        if (res.paymentUrl != null) {
          final uri = Uri.parse(res.paymentUrl!);
          if (await canLaunchUrl(uri)) {
            await launchUrl(uri, mode: LaunchMode.externalApplication);
            if (mounted) {
              Navigator.of(context).pop();
              AppToast.showInfo(
                context,
                'Đã mở cổng thanh toán VNPay. Vui lòng hoàn tất giao dịch.',
              );
            }
          }
        }
      } else {
        // Mock Instant Activation
        final ref = res.transactionRef;
        if (ref != null) {
          final success = await SubscriptionApiService.mockConfirm(transactionRef: ref);
          if (success) {
            if (mounted) {
              Navigator.of(context).pop();
              AppToast.showSuccess(
                context,
                'Nâng cấp thành công gói ${widget.plan.name}!',
              );
              widget.onPaymentSuccess();
            }
          } else {
            if (mounted) {
              AppToast.showError(context, 'Xác nhận thanh toán thất bại');
            }
          }
        }
      }
    } catch (e) {
      if (mounted) {
        AppToast.showError(context, 'Lỗi thanh toán: $e');
      }
    } finally {
      if (mounted) setState(() => _isProcessing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      decoration: const BoxDecoration(
        color: Color(0xFF140F24),
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Drag handle
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.white24,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Title
          const Text(
            'Xác nhận đơn hàng',
            style: TextStyle(
              color: Colors.white,
              fontSize: 18,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 14),

          // Order summary card
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.05),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.white.withOpacity(0.1)),
            ),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Gói dịch vụ', style: TextStyle(color: Colors.white60)),
                    Text(
                      widget.plan.name,
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Thời hạn', style: TextStyle(color: Colors.white60)),
                    Text(
                      '${widget.plan.durationInDays} ngày',
                      style: const TextStyle(color: Colors.white),
                    ),
                  ],
                ),
                const Divider(color: Colors.white12, height: 16),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Tổng thanh toán', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                    Text(
                      widget.plan.formattedPrice,
                      style: const TextStyle(
                        color: Color(0xFFFFD700),
                        fontWeight: FontWeight.w900,
                        fontSize: 18,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Payment method choice
          const Text(
            'Phương thức thanh toán',
            style: TextStyle(
              color: Colors.white70,
              fontSize: 13,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 8),

          _buildPaymentOption(
            id: 'mock',
            title: 'Kích hoạt thử nghiệm (Tức thì)',
            subtitle: 'Thanh toán mô phỏng 0đ kích hoạt VIP ngay',
            icon: Icons.flash_on_rounded,
            iconColor: const Color(0xFFF59E0B),
          ),
          const SizedBox(height: 8),
          _buildPaymentOption(
            id: 'vnpay',
            title: 'Cổng thanh toán VNPay',
            subtitle: 'Thẻ ATM / QR Pay / Visa qua VNPay Sandbox',
            icon: Icons.account_balance_wallet_rounded,
            iconColor: const Color(0xFF00E5FF),
          ),

          const SizedBox(height: 20),

          // Confirm button
          SizedBox(
            height: 48,
            child: ElevatedButton(
              onPressed: _isProcessing ? null : _handleConfirmPayment,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFF59E0B),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
              ),
              child: _isProcessing
                  ? const SizedBox(
                      width: 24,
                      height: 24,
                      child: CircularProgressIndicator(
                        strokeWidth: 2.5,
                        color: Color(0xFF090D1A),
                      ),
                    )
                  : const Text(
                      'Xác Nhận Thanh Toán',
                      style: TextStyle(
                        color: Color(0xFF090D1A),
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPaymentOption({
    required String id,
    required String title,
    required String subtitle,
    required IconData icon,
    required Color iconColor,
  }) {
    final isSelected = _paymentMethod == id;

    return InkWell(
      onTap: () => setState(() => _paymentMethod = id),
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: isSelected
              ? iconColor.withOpacity(0.12)
              : Colors.white.withOpacity(0.04),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: isSelected ? iconColor : Colors.white.withOpacity(0.08),
            width: isSelected ? 1.5 : 1.0,
          ),
        ),
        child: Row(
          children: [
            Icon(icon, color: iconColor, size: 24),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w700,
                      fontSize: 13,
                    ),
                  ),
                  Text(
                    subtitle,
                    style: const TextStyle(
                      color: Colors.white54,
                      fontSize: 11,
                    ),
                  ),
                ],
              ),
            ),
            Icon(
              isSelected
                  ? Icons.radio_button_checked_rounded
                  : Icons.radio_button_off_rounded,
              color: isSelected ? iconColor : Colors.white30,
              size: 20,
            ),
          ],
        ),
      ),
    );
  }
}
