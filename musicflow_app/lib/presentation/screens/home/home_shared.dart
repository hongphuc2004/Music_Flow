import 'dart:math' as math;
import 'package:flutter/material.dart';

class HomePalette {
  static const Color primary = Color(0xFF6C63FF); // Deep purple/indigo matching React web theme
  static const Color secondary = Color(0xFF00BCD4); // Cyan matching React web secondary theme

  // Legacy fallback compatibility
  static Color get accent => primary;
  static Color get secondaryAccent => secondary;

  // Theme-aware dynamic colors
  static Color background(BuildContext context) => Theme.of(context).scaffoldBackgroundColor;
  
  static Color card(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark 
        ? const Color(0xFF161922) 
        : Colors.white;
  }
  
  static Color cardBorder(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark 
        ? const Color(0xFF262C3A) 
        : const Color(0xFFE5E9F0);
  }
  
  static Color textPrimary(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark 
        ? Colors.white 
        : const Color(0xFF1A202C);
  }
  
  static Color textSecondary(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark 
        ? const Color(0xFF8E9BAE) 
        : const Color(0xFF718096);
  }
}

class HomeBackdrop extends StatelessWidget {
  const HomeBackdrop({super.key});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    if (!isDark) {
      // Soft, light gradients for Light Mode
      return IgnorePointer(
        child: Stack(
          children: [
            Container(color: const Color(0xFFF6F8FA)),
            Positioned(
              top: -100,
              right: -50,
              child: _Glow(size: 280, color: const Color(0xFF6C63FF).withValues(alpha: 0.05)),
            ),
            Positioned(
              top: 120,
              left: -80,
              child: _Glow(size: 240, color: const Color(0xFF00BCD4).withValues(alpha: 0.04)),
            ),
          ],
        ),
      );
    }
    
    // Luxurious dark neon glows for Dark Mode
    return IgnorePointer(
      child: Stack(
        children: [
          Container(color: const Color(0xFF0A0D14)),
          Positioned(
            top: -140,
            right: -60,
            child: _Glow(size: 320, color: const Color(0xFF6C63FF).withValues(alpha: 0.12)),
          ),
          Positioned(
            top: 160,
            left: -100,
            child: _Glow(size: 260, color: const Color(0xFF00BCD4).withValues(alpha: 0.10)),
          ),
          Positioned(
            bottom: 80,
            right: -120,
            child: _Glow(size: 300, color: const Color(0xFF6C63FF).withValues(alpha: 0.05)),
          ),
        ],
      ),
    );
  }
}

class _Glow extends StatelessWidget {
  final double size;
  final Color color;

  const _Glow({required this.size, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: RadialGradient(colors: [color, color.withValues(alpha: 0)]),
      ),
    );
  }
}

class HomeSectionHeader extends StatelessWidget {
  final String title;
  final String subtitle;
  final Widget? trailing;

  const HomeSectionHeader({
    super.key,
    required this.title,
    required this.subtitle,
    this.trailing,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: TextStyle(
                  color: HomePalette.textPrimary(context),
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.5,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                subtitle,
                style: TextStyle(
                  color: HomePalette.textSecondary(context),
                  fontSize: 13,
                ),
              ),
            ],
          ),
        ),
        if (trailing != null) ...[const SizedBox(width: 12), trailing!],
      ],
    );
  }
}

class HomeGhostButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  const HomeGhostButton({
    super.key,
    required this.icon,
    required this.label,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: isDark ? Colors.white.withValues(alpha: 0.04) : Colors.black.withValues(alpha: 0.03),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isDark ? Colors.white.withValues(alpha: 0.06) : Colors.black.withValues(alpha: 0.05),
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 16, color: HomePalette.textPrimary(context).withValues(alpha: 0.8)),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                color: HomePalette.textPrimary(context),
                fontSize: 12,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class HomeCountBadge extends StatelessWidget {
  final String label;

  const HomeCountBadge({super.key, required this.label});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: isDark ? Colors.white.withValues(alpha: 0.04) : Colors.black.withValues(alpha: 0.03),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isDark ? Colors.white.withValues(alpha: 0.06) : Colors.black.withValues(alpha: 0.05),
        ),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: HomePalette.textPrimary(context).withValues(alpha: 0.8),
          fontSize: 12,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class HomeTag extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color background;
  final Color foreground;

  const HomeTag({
    super.key,
    required this.icon,
    required this.label,
    required this.background,
    required this.foreground,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: foreground, size: 14),
          const SizedBox(width: 5),
          Text(
            label,
            style: TextStyle(
              color: foreground,
              fontSize: 11,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}

class HomeMetaPill extends StatelessWidget {
  final IconData icon;
  final String label;

  const HomeMetaPill({super.key, required this.icon, required this.label});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.black.withValues(alpha: 0.04),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(
          color: isDark ? Colors.white.withValues(alpha: 0.06) : Colors.black.withValues(alpha: 0.05),
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: HomePalette.textSecondary(context), size: 14),
          const SizedBox(width: 6),
          Text(
            label,
            style: TextStyle(
              color: HomePalette.textSecondary(context),
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

class HomeMiniInfo extends StatelessWidget {
  final IconData icon;
  final String label;

  const HomeMiniInfo({super.key, required this.icon, required this.label});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
      decoration: BoxDecoration(
        color: Theme.of(context).brightness == Brightness.dark 
            ? Colors.white.withValues(alpha: 0.04)
            : Colors.black.withValues(alpha: 0.03),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: HomePalette.textSecondary(context)),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(
              color: HomePalette.textSecondary(context),
              fontSize: 11,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class HomeArtwork extends StatelessWidget {
  final String imageUrl;
  final double size;
  final double borderRadius;
  final double iconSize;
  final Color fallbackColor;
  final String? label;

  const HomeArtwork({
    super.key,
    required this.imageUrl,
    required this.size,
    required this.borderRadius,
    required this.iconSize,
    this.fallbackColor = HomePalette.primary,
    this.label,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(borderRadius),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.15),
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(borderRadius),
        child: imageUrl.isNotEmpty
            ? Image.network(
                imageUrl,
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => _ArtworkFallback(
                  color: fallbackColor,
                  iconSize: iconSize,
                  label: label,
                ),
              )
            : _ArtworkFallback(
                color: fallbackColor,
                iconSize: iconSize,
                label: label,
              ),
      ),
    );
  }
}

class _ArtworkFallback extends StatelessWidget {
  final Color color;
  final double iconSize;
  final String? label;

  const _ArtworkFallback({
    required this.color,
    required this.iconSize,
    required this.label,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            color.withValues(alpha: 0.90),
            Color.lerp(color, Colors.black, 0.55) ?? color,
          ],
        ),
      ),
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(10),
          child: label == null
              ? Icon(
                  Icons.music_note_rounded,
                  size: iconSize,
                  color: Colors.white70,
                )
              : Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      Icons.queue_music_rounded,
                      size: math.max(iconSize - 8, 24),
                      color: Colors.white70,
                    ),
                    const SizedBox(height: 6),
                    Text(
                      label!,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
        ),
      ),
    );
  }
}
