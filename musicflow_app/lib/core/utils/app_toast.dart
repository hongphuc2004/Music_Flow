import 'dart:ui';
import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

enum ToastType { success, error, info, warning }

class AppToast {
  static void showSuccess(
    BuildContext context,
    String message, {
    String? title,
    Duration duration = const Duration(milliseconds: 2500),
  }) {
    show(
      context,
      message,
      title: title ?? 'Thành công',
      type: ToastType.success,
      duration: duration,
    );
  }

  static void showError(
    BuildContext context,
    String message, {
    String? title,
    Duration duration = const Duration(milliseconds: 3000),
  }) {
    show(
      context,
      message,
      title: title ?? 'Đã xảy ra lỗi',
      type: ToastType.error,
      duration: duration,
    );
  }

  static void showInfo(
    BuildContext context,
    String message, {
    String? title,
    Duration duration = const Duration(milliseconds: 2500),
  }) {
    show(
      context,
      message,
      title: title,
      type: ToastType.info,
      duration: duration,
    );
  }

  static void show(
    BuildContext context,
    String message, {
    String? title,
    ToastType type = ToastType.info,
    Duration duration = const Duration(milliseconds: 2500),
  }) {
    final messenger = ScaffoldMessenger.maybeOf(context);
    if (messenger == null) return;

    messenger.hideCurrentSnackBar();

    Color primaryColor;
    Color secondaryColor;
    IconData iconData;

    switch (type) {
      case ToastType.success:
        primaryColor = const Color(0xFF10B981); // Emerald
        secondaryColor = const Color(0xFF00BCD4); // Cyan
        iconData = Icons.check_circle_rounded;
        break;
      case ToastType.error:
        primaryColor = const Color(0xFFF43F5E); // Rose Red
        secondaryColor = const Color(0xFFEC4899); // Hot Pink
        iconData = Icons.error_outline_rounded;
        break;
      case ToastType.warning:
        primaryColor = const Color(0xFFF59E0B); // Amber
        secondaryColor = const Color(0xFFF97316); // Orange
        iconData = Icons.warning_amber_rounded;
        break;
      case ToastType.info:
      default:
        primaryColor = AppColors.primary; // #6C63FF
        secondaryColor = AppColors.secondary; // #00BCD4
        iconData = Icons.music_note_rounded;
        break;
    }

    final isDark = Theme.of(context).brightness == Brightness.dark;

    messenger.showSnackBar(
      SnackBar(
        duration: duration,
        elevation: 0,
        behavior: SnackBarBehavior.floating,
        backgroundColor: Colors.transparent,
        padding: EdgeInsets.zero,
        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        content: _ToastCard(
          title: title,
          message: message,
          primaryColor: primaryColor,
          secondaryColor: secondaryColor,
          iconData: iconData,
          isDark: isDark,
        ),
      ),
    );
  }
}

class _ToastCard extends StatelessWidget {
  final String? title;
  final String message;
  final Color primaryColor;
  final Color secondaryColor;
  final IconData iconData;
  final bool isDark;

  const _ToastCard({
    this.title,
    required this.message,
    required this.primaryColor,
    required this.secondaryColor,
    required this.iconData,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: primaryColor.withOpacity(0.25),
            blurRadius: 18,
            offset: const Offset(0, 6),
          ),
          BoxShadow(
            color: Colors.black.withOpacity(0.35),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 16, sigmaY: 16),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(
              color: isDark
                  ? const Color(0xFF141026).withOpacity(0.92)
                  : Colors.white.withOpacity(0.95),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: primaryColor.withOpacity(0.35),
                width: 1.2,
              ),
            ),
            child: Row(
              children: [
                // Glowing Icon Pill
                Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [primaryColor, secondaryColor],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: primaryColor.withOpacity(0.4),
                        blurRadius: 8,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: Center(
                    child: Icon(
                      iconData,
                      color: Colors.white,
                      size: 20,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                // Text info
                Expanded(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (title != null && title!.isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 2),
                          child: Text(
                            title!,
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              letterSpacing: -0.2,
                              color: isDark ? Colors.white : Colors.black87,
                            ),
                          ),
                        ),
                      Text(
                        message,
                        style: TextStyle(
                          fontSize: title != null ? 12 : 13,
                          fontWeight: FontWeight.w500,
                          color: isDark
                              ? (title != null
                                  ? AppColors.darkTextSecondary
                                  : Colors.white)
                              : (title != null
                                  ? AppColors.lightTextSecondary
                                  : Colors.black87),
                          height: 1.25,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
