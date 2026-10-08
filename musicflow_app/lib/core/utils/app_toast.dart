import 'dart:async';
import 'dart:math' as math;
import 'dart:ui';
import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

enum ToastType { success, error, info, warning }

/// High-end Toast system with slide in/out animations at the top-right corner.
class AppToast {
  static OverlayEntry? _activeEntry;
  static Timer? _activeTimer;

  static void showSuccess(
    BuildContext context,
    String message, {
    String? title,
    Duration duration = const Duration(milliseconds: 2800),
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
    Duration duration = const Duration(milliseconds: 3500),
  }) {
    show(
      context,
      message,
      title: title ?? 'Đã xảy ra lỗi',
      type: ToastType.error,
      duration: duration,
    );
  }

  static void showWarning(
    BuildContext context,
    String message, {
    String? title,
    Duration duration = const Duration(milliseconds: 3000),
  }) {
    show(
      context,
      message,
      title: title ?? 'Cảnh báo',
      type: ToastType.warning,
      duration: duration,
    );
  }

  static void showInfo(
    BuildContext context,
    String message, {
    String? title,
    Duration duration = const Duration(milliseconds: 2800),
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
    Duration duration = const Duration(milliseconds: 2800),
  }) {
    final overlayState = Overlay.maybeOf(context, rootOverlay: true);
    if (overlayState == null) return;

    // Dismiss existing toast cleanly
    _activeTimer?.cancel();
    _activeEntry?.remove();
    _activeEntry = null;

    late OverlayEntry entry;
    entry = OverlayEntry(
      builder: (ctx) => _TopRightToastOverlay(
        title: title,
        message: message,
        type: type,
        duration: duration,
        onDismiss: () {
          if (_activeEntry == entry) {
            _activeEntry?.remove();
            _activeEntry = null;
          }
        },
      ),
    );

    _activeEntry = entry;
    overlayState.insert(entry);
  }
}

class _TopRightToastOverlay extends StatefulWidget {
  final String? title;
  final String message;
  final ToastType type;
  final Duration duration;
  final VoidCallback onDismiss;

  const _TopRightToastOverlay({
    this.title,
    required this.message,
    required this.type,
    required this.duration,
    required this.onDismiss,
  });

  @override
  State<_TopRightToastOverlay> createState() => _TopRightToastOverlayState();
}

class _TopRightToastOverlayState extends State<_TopRightToastOverlay>
    with SingleTickerProviderStateMixin {
  late final AnimationController _animController;
  late final Animation<Offset> _slideAnimation;
  late final Animation<double> _fadeAnimation;
  Timer? _autoDismissTimer;
  bool _isDismissing = false;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 340),
    );

    // Slide in from right edge (+1.25) to 0.0 with cubic ease
    _slideAnimation = Tween<Offset>(
      begin: const Offset(1.25, 0.0),
      end: Offset.zero,
    ).animate(CurvedAnimation(
      parent: _animController,
      curve: Curves.easeOutCubic,
      reverseCurve: Curves.easeInCubic,
    ));

    _fadeAnimation = Tween<double>(
      begin: 0.0,
      end: 1.0,
    ).animate(CurvedAnimation(
      parent: _animController,
      curve: Curves.easeOut,
    ));

    // Play slide in
    _animController.forward();

    // Setup auto dismiss timer
    _autoDismissTimer = Timer(widget.duration, _triggerDismiss);
  }

  void _triggerDismiss() {
    if (_isDismissing || !mounted) return;
    _isDismissing = true;
    _autoDismissTimer?.cancel();

    _animController.reverse().then((_) {
      if (mounted) {
        widget.onDismiss();
      }
    });
  }

  @override
  void dispose() {
    _autoDismissTimer?.cancel();
    _animController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    Color primaryColor;
    Color secondaryColor;
    IconData iconData;

    switch (widget.type) {
      case ToastType.success:
        primaryColor = const Color(0xFF10B981); // Emerald Green
        secondaryColor = const Color(0xFF00BCD4); // Cyan
        iconData = Icons.check_circle_rounded;
      case ToastType.error:
        primaryColor = const Color(0xFFF43F5E); // Rose Red
        secondaryColor = const Color(0xFFEC4899); // Hot Pink
        iconData = Icons.error_outline_rounded;
      case ToastType.warning:
        primaryColor = const Color(0xFFF59E0B); // Amber
        secondaryColor = const Color(0xFFF97316); // Orange
        iconData = Icons.warning_amber_rounded;
      case ToastType.info:
        primaryColor = AppColors.primary; // Purple
        secondaryColor = AppColors.secondary; // Cyan
        iconData = Icons.music_note_rounded;
    }

    final mediaQuery = MediaQuery.of(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final topPadding = mediaQuery.padding.top + 16.0;
    final maxToastWidth = math.min(360.0, mediaQuery.size.width - 32.0);

    return Positioned(
      top: topPadding,
      right: 16.0,
      child: Material(
        color: Colors.transparent,
        child: SlideTransition(
          position: _slideAnimation,
          child: FadeTransition(
            opacity: _fadeAnimation,
            child: Dismissible(
              key: UniqueKey(),
              direction: DismissDirection.endToStart,
              onDismissed: (_) => widget.onDismiss(),
              child: SizedBox(
                width: maxToastWidth,
                child: _ToastCardContent(
                  title: widget.title,
                  message: widget.message,
                  primaryColor: primaryColor,
                  secondaryColor: secondaryColor,
                  iconData: iconData,
                  isDark: isDark,
                  duration: widget.duration,
                  onClose: _triggerDismiss,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _ToastCardContent extends StatefulWidget {
  final String? title;
  final String message;
  final Color primaryColor;
  final Color secondaryColor;
  final IconData iconData;
  final bool isDark;
  final Duration duration;
  final VoidCallback onClose;

  const _ToastCardContent({
    this.title,
    required this.message,
    required this.primaryColor,
    required this.secondaryColor,
    required this.iconData,
    required this.isDark,
    required this.duration,
    required this.onClose,
  });

  @override
  State<_ToastCardContent> createState() => _ToastCardContentState();
}

class _ToastCardContentState extends State<_ToastCardContent>
    with SingleTickerProviderStateMixin {
  late final AnimationController _progressController;

  @override
  void initState() {
    super.initState();
    _progressController = AnimationController(
      vsync: this,
      duration: widget.duration,
    )..forward();
  }

  @override
  void dispose() {
    _progressController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: widget.primaryColor.withOpacity(0.28),
            blurRadius: 20,
            offset: const Offset(0, 6),
          ),
          BoxShadow(
            color: Colors.black.withOpacity(0.4),
            blurRadius: 14,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 16, sigmaY: 16),
          child: Container(
            decoration: BoxDecoration(
              color: widget.isDark
                  ? const Color(0xFF140E26).withOpacity(0.92)
                  : Colors.white.withOpacity(0.95),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: widget.primaryColor.withOpacity(0.4),
                width: 1.2,
              ),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      // Glowing Icon Circle
                      Container(
                        width: 38,
                        height: 38,
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: [widget.primaryColor, widget.secondaryColor],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                          shape: BoxShape.circle,
                          boxShadow: [
                            BoxShadow(
                              color: widget.primaryColor.withOpacity(0.45),
                              blurRadius: 10,
                              offset: const Offset(0, 2),
                            ),
                          ],
                        ),
                        child: Center(
                          child: Icon(
                            widget.iconData,
                            color: Colors.white,
                            size: 20,
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),

                      // Title and Message
                      Expanded(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            if (widget.title != null && widget.title!.isNotEmpty)
                              Padding(
                                padding: const EdgeInsets.only(bottom: 2),
                                child: Text(
                                  widget.title!,
                                  style: TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w700,
                                    color: widget.isDark ? Colors.white : Colors.black87,
                                  ),
                                ),
                              ),
                            Text(
                              widget.message,
                              style: TextStyle(
                                fontSize: widget.title != null ? 12 : 13,
                                fontWeight: FontWeight.w500,
                                color: widget.isDark
                                    ? (widget.title != null
                                        ? AppColors.darkTextSecondary
                                        : Colors.white)
                                    : (widget.title != null
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

                      // Close icon button
                      IconButton(
                        icon: Icon(
                          Icons.close_rounded,
                          size: 18,
                          color: widget.isDark ? Colors.white60 : Colors.black45,
                        ),
                        onPressed: widget.onClose,
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
                        splashRadius: 16,
                      ),
                    ],
                  ),
                ),

                // Animated countdown progress bar
                AnimatedBuilder(
                  animation: _progressController,
                  builder: (context, _) {
                    return Align(
                      alignment: Alignment.centerLeft,
                      child: Container(
                        height: 2.5,
                        width: MediaQuery.of(context).size.width,
                        color: Colors.transparent,
                        child: FractionallySizedBox(
                          alignment: Alignment.centerLeft,
                          widthFactor: (1.0 - _progressController.value).clamp(0.0, 1.0),
                          child: Container(
                            decoration: BoxDecoration(
                              gradient: LinearGradient(
                                colors: [widget.primaryColor, widget.secondaryColor],
                              ),
                            ),
                          ),
                        ),
                      ),
                    );
                  },
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
