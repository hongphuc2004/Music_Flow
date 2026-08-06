import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';

class MusicFlowBackdrop extends StatelessWidget {
  final Widget child;

  const MusicFlowBackdrop({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    if (!isDark) {
      // Soft, light gradients for Light Mode
      return Stack(
        children: [
          Container(color: AppColors.lightBackground),
          Positioned(
            top: -100,
            right: -50,
            child: _GlowOrb(
              size: 280,
              color: AppColors.primary.withOpacity(0.04),
            ),
          ),
          Positioned(
            top: 120,
            left: -80,
            child: _GlowOrb(
              size: 240,
              color: AppColors.secondary.withOpacity(0.03),
            ),
          ),
          Positioned(
            bottom: -50,
            right: -50,
            child: _GlowOrb(
              size: 240,
              color: AppColors.accentPink.withOpacity(0.02),
            ),
          ),
          child,
        ],
      );
    }

    // Luxurious dark neon glows for Dark Mode
    return Stack(
      children: [
        Container(color: AppColors.darkBackground),
        Positioned(
          top: -120,
          right: -60,
          child: _GlowOrb(
            size: 320,
            color: AppColors.primary.withOpacity(0.10),
          ),
        ),
        Positioned(
          top: 160,
          left: -100,
          child: _GlowOrb(
            size: 260,
            color: AppColors.secondary.withOpacity(0.08),
          ),
        ),
        Positioned(
          bottom: -80,
          right: -80,
          child: _GlowOrb(
            size: 300,
            color: AppColors.accentPink.withOpacity(0.05),
          ),
        ),
        child,
      ],
    );
  }
}

class _GlowOrb extends StatelessWidget {
  final double size;
  final Color color;

  const _GlowOrb({required this.size, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: RadialGradient(
          colors: [color, color.withOpacity(0)],
        ),
      ),
    );
  }
}
