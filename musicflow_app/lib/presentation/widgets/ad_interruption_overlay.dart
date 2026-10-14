import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:musicflow_app/core/audio/ad_manager.dart';
import 'package:musicflow_app/core/audio/ad_playback_state.dart';
import 'package:musicflow_app/core/theme/app_theme.dart';
import 'package:musicflow_app/presentation/screens/premium/premium_screen.dart';
import 'package:url_launcher/url_launcher.dart';

/// Overlay hiển thị quảng cáo âm thanh dạng Interruption
/// Tự động xuất hiện đè lên Player khi có quảng cáo xen kẽ
class AdInterruptionOverlay extends StatelessWidget {
  const AdInterruptionOverlay({super.key});

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<AdPlaybackState>(
      valueListenable: AdManager.instance.playbackStateNotifier,
      builder: (context, adState, child) {
        if (!adState.isAdPlaying || adState.currentAd == null) {
          return const SizedBox.shrink();
        }

        final ad = adState.currentAd!;
        final remaining = adState.remainingSeconds;
        final canSkip = adState.canSkip;

        return Material(
            color: Colors.transparent,
            child: BackdropFilter(
              filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
              child: Container(
                color: Colors.black.withOpacity(0.88),
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 36),
                child: SafeArea(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      // Header: Badge & Countdown
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 4,
                            ),
                            decoration: BoxDecoration(
                              color: const Color(0xFFFFB300).withOpacity(0.2),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(
                                color: const Color(0xFFFFB300),
                                width: 1,
                              ),
                            ),
                            child: const Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(
                                  Icons.campaign_rounded,
                                  color: Color(0xFFFFB300),
                                  size: 16,
                                ),
                                SizedBox(width: 6),
                                Text(
                                  'QUẢNG CÁO',
                                  style: TextStyle(
                                    color: Color(0xFFFFB300),
                                    fontSize: 12,
                                    fontWeight: FontWeight.w800,
                                    letterSpacing: 0.5,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 10,
                                  vertical: 5,
                                ),
                                decoration: BoxDecoration(
                                  color: Colors.white.withOpacity(0.1),
                                  borderRadius: BorderRadius.circular(20),
                                ),
                                child: Text(
                                  remaining > 0
                                      ? '0:${remaining.toString().padLeft(2, '0')}'
                                      : '0:00',
                                  style: const TextStyle(
                                    color: Colors.white70,
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),
                              // Nút Tắt / Bỏ qua quảng cáo ở góc trên
                              InkWell(
                                onTap: () {
                                  AdManager.instance.skipAd();
                                },
                                borderRadius: BorderRadius.circular(20),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 10,
                                    vertical: 5,
                                  ),
                                  decoration: BoxDecoration(
                                    color: (canSkip || remaining <= 0)
                                        ? Colors.white
                                        : Colors.white.withOpacity(0.15),
                                    borderRadius: BorderRadius.circular(20),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Icon(
                                        Icons.close_rounded,
                                        size: 15,
                                        color: (canSkip || remaining <= 0)
                                            ? Colors.black
                                            : Colors.white70,
                                      ),
                                      const SizedBox(width: 4),
                                      Text(
                                        'Tắt',
                                        style: TextStyle(
                                          color: (canSkip || remaining <= 0)
                                              ? Colors.black
                                              : Colors.white70,
                                          fontSize: 12,
                                          fontWeight: FontWeight.w700,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),

                      // Body: Image & Title
                      Column(
                        children: [
                          if (ad.imageUrl.isNotEmpty)
                            Container(
                              width: 220,
                              height: 220,
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(24),
                                boxShadow: [
                                  BoxShadow(
                                    color: AppColors.primary.withOpacity(0.35),
                                    blurRadius: 30,
                                    offset: const Offset(0, 10),
                                  ),
                                ],
                              ),
                              child: ClipRRect(
                                borderRadius: BorderRadius.circular(24),
                                child: Image.network(
                                  ad.imageUrl,
                                  fit: BoxFit.cover,
                                  errorBuilder: (_, __, ___) => Container(
                                    color: const Color(0xFF1E1435),
                                    child: const Icon(
                                      Icons.music_note_rounded,
                                      color: Colors.white38,
                                      size: 64,
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          const SizedBox(height: 28),
                          Text(
                            ad.title,
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 20,
                              fontWeight: FontWeight.w800,
                              height: 1.3,
                            ),
                          ),
                          if (ad.description.isNotEmpty) ...[
                            const SizedBox(height: 10),
                            Text(
                              ad.description,
                              textAlign: TextAlign.center,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                color: Colors.white.withOpacity(0.65),
                                fontSize: 13.5,
                                height: 1.4,
                              ),
                            ),
                          ],
                        ],
                      ),

                      // Footer Actions: Skip Button & Upgrade CTA
                      Column(
                        children: [
                          // Nút đóng/bỏ qua quảng cáo
                          if (canSkip || remaining <= 0)
                            SizedBox(
                              width: double.infinity,
                              child: ElevatedButton.icon(
                                onPressed: () {
                                  AdManager.instance.skipAd();
                                },
                                icon: Icon(
                                  remaining <= 0
                                      ? Icons.check_circle_outline_rounded
                                      : Icons.skip_next_rounded,
                                  color: Colors.black,
                                ),
                                label: Text(
                                  remaining <= 0
                                      ? 'Đóng quảng cáo & Tiếp tục nghe nhạc'
                                      : 'Bỏ qua quảng cáo',
                                  style: const TextStyle(
                                    color: Colors.black,
                                    fontWeight: FontWeight.w800,
                                    fontSize: 15,
                                  ),
                                ),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: remaining <= 0
                                      ? const Color(0xFFFFB300)
                                      : Colors.white,
                                  padding: const EdgeInsets.symmetric(vertical: 14),
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(16),
                                  ),
                                ),
                              ),
                            )
                          else
                            Container(
                              width: double.infinity,
                              padding: const EdgeInsets.symmetric(
                                horizontal: 16,
                                vertical: 12,
                              ),
                              decoration: BoxDecoration(
                                color: Colors.white.withOpacity(0.08),
                                borderRadius: BorderRadius.circular(14),
                                border: Border.all(color: Colors.white12),
                              ),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  const SizedBox(
                                    width: 14,
                                    height: 14,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      color: Color(0xFFFFB300),
                                    ),
                                  ),
                                  const SizedBox(width: 10),
                                  Text(
                                    'Quảng cáo kết thúc sau 0:${remaining.toString().padLeft(2, '0')}',
                                    style: TextStyle(
                                      color: Colors.white.withOpacity(0.85),
                                      fontSize: 13,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          const SizedBox(height: 14),

                          // Nút CTA: Mua gói để tắt quảng cáo
                          TextButton(
                            onPressed: () {
                              if (ad.targetUrl.startsWith('http')) {
                                launchUrl(Uri.parse(ad.targetUrl));
                              } else {
                                Navigator.of(context).push(
                                  MaterialPageRoute(
                                    builder: (_) => const PremiumScreen(),
                                  ),
                                );
                              }
                            },
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Text(
                                  'Nâng cấp Gói PLUS (49.000đ/tháng)',
                                  style: TextStyle(
                                    color: AppColors.secondary,
                                    fontWeight: FontWeight.w700,
                                    fontSize: 13.5,
                                  ),
                                ),
                                const SizedBox(width: 6),
                                Icon(
                                  Icons.arrow_forward_rounded,
                                  color: AppColors.secondary,
                                  size: 16,
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),
          );
      },
    );
  }
}
