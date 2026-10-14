import 'package:flutter/material.dart';
import 'package:musicflow_app/presentation/screens/premium/premium_screen.dart';
import 'package:musicflow_app/presentation/widgets/premium_badge.dart';

class PremiumRequiredDialog extends StatelessWidget {
  const PremiumRequiredDialog({super.key});

  static Future<void> show(BuildContext context) {
    return showDialog<void>(
      context: context,
      barrierDismissible: true,
      barrierColor: Colors.black.withOpacity(0.75),
      builder: (context) => const PremiumRequiredDialog(),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: const Color(0xFF1E212D),
      elevation: 24,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(24),
        side: BorderSide(color: Colors.white.withOpacity(0.1), width: 1),
      ),
      insetPadding: const EdgeInsets.symmetric(horizontal: 24),
      child: Stack(
        children: [
          // Close button in top right
          Positioned(
            top: 12,
            right: 12,
            child: IconButton(
              icon: const Icon(Icons.close_rounded, color: Colors.white70, size: 22),
              onPressed: () => Navigator.of(context).pop(),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(24, 28, 24, 28),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Header: MusicFlow + PREMIUM
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: const [
                    Text(
                      'MusicFlow',
                      style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w900,
                        fontSize: 17,
                        letterSpacing: -0.3,
                      ),
                    ),
                    SizedBox(width: 8),
                    PremiumBadge(
                      fontSize: 10,
                      padding: EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                    ),
                  ],
                ),
                const SizedBox(height: 20),

                // Center illustration: headphones + music waves
                Container(
                  width: 140,
                  height: 110,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFF6C63FF).withOpacity(0.25),
                        blurRadius: 40,
                        spreadRadius: 10,
                      ),
                    ],
                  ),
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      Container(
                        width: 90,
                        height: 90,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: const Color(0xFF2A2D3D),
                          border: Border.all(
                            color: const Color(0xFFE5AC18).withOpacity(0.4),
                            width: 2,
                          ),
                        ),
                        child: const Icon(
                          Icons.headphones_rounded,
                          color: Color(0xFFE5AC18),
                          size: 46,
                        ),
                      ),
                      const Positioned(
                        top: 12,
                        right: 18,
                        child: Text('♫', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                      ),
                      const Positioned(
                        bottom: 12,
                        left: 18,
                        child: Text('♪', style: TextStyle(color: Color(0xFF818CF8), fontSize: 20, fontWeight: FontWeight.bold)),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 18),

                // Title
                const Text(
                  'NÂNG CẤP PREMIUM ĐỂ NGHE TRỌN BÀI',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 17.5,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 0.3,
                    height: 1.3,
                  ),
                ),
                const SizedBox(height: 12),

                // Description
                Text(
                  'Theo yêu cầu của đơn vị sở hữu bản quyền, bạn cần tài khoản PREMIUM để nghe trọn vẹn bài hát này',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: Colors.white.withOpacity(0.72),
                    fontSize: 13.5,
                    height: 1.5,
                  ),
                ),
                const SizedBox(height: 24),

                // Action Button
                SizedBox(
                  width: 200,
                  height: 48,
                  child: ElevatedButton(
                    onPressed: () {
                      Navigator.of(context).pop();
                      Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => const PremiumScreen()),
                      );
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFE5AC18),
                      elevation: 8,
                      shadowColor: const Color(0xFFE5AC18).withOpacity(0.5),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(30),
                      ),
                    ),
                    child: const Text(
                      'NÂNG CẤP',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 15,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
