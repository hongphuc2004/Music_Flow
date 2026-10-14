import 'package:flutter/material.dart';

/// Nút Chuông Thông Báo với hiệu ứng Hover, Click & Sóng Radar Xanh Lá
/// Được tối ưu hóa cho cả Flutter Web, Desktop và Mobile
class NotificationBellButton extends StatefulWidget {
  final VoidCallback? onTap;
  final bool hasUnread;
  final int unreadCount;
  final double size;

  const NotificationBellButton({
    super.key,
    this.onTap,
    this.hasUnread = false,
    this.unreadCount = 0,
    this.size = 22,
  });

  @override
  State<NotificationBellButton> createState() => _NotificationBellButtonState();
}

class _NotificationBellButtonState extends State<NotificationBellButton>
    with TickerProviderStateMixin {
  AnimationController? _radarController;
  AnimationController? _ringController;
  Animation<double>? _ringAnimation;
  bool _isHovered = false;
  bool _isPressed = false;

  void _ensureControllers() {
    _radarController ??= AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..repeat();

    if (_ringController == null) {
      _ringController = AnimationController(
        vsync: this,
        duration: const Duration(milliseconds: 800),
      );

      _ringAnimation = TweenSequence<double>([
        TweenSequenceItem(tween: Tween(begin: 0.0, end: 0.05), weight: 15),
        TweenSequenceItem(tween: Tween(begin: 0.05, end: -0.045), weight: 20),
        TweenSequenceItem(tween: Tween(begin: -0.045, end: 0.035), weight: 20),
        TweenSequenceItem(tween: Tween(begin: 0.035, end: -0.02), weight: 20),
        TweenSequenceItem(tween: Tween(begin: -0.02, end: 0.01), weight: 15),
        TweenSequenceItem(tween: Tween(begin: 0.01, end: 0.0), weight: 10),
      ]).animate(CurvedAnimation(parent: _ringController!, curve: Curves.easeInOut));
    }
  }

  @override
  void initState() {
    super.initState();
    _ensureControllers();
    if (widget.unreadCount > 0) {
      _ringController?.forward(from: 0.0);
    }
  }

  @override
  void didUpdateWidget(NotificationBellButton oldWidget) {
    super.didUpdateWidget(oldWidget);
    _ensureControllers();
    if (widget.unreadCount > oldWidget.unreadCount) {
      _ringController?.forward(from: 0.0);
    }
  }

  @override
  void dispose() {
    _radarController?.dispose();
    _ringController?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    _ensureControllers();
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final showRadar = widget.hasUnread || widget.unreadCount > 0;

    // Màu nền & màu viền theo style loader người dùng cung cấp
    final bgColor = _isHovered
        ? const Color(0xFF1A1A1A)
        : (isDark ? const Color(0xFF3A3A3A) : const Color(0xFFE2E8F0));

    final iconColor = _isHovered
        ? Colors.white
        : (isDark ? Colors.white.withOpacity(0.7) : const Color(0xFF334155));

    return MouseRegion(
      cursor: SystemMouseCursors.click,
      onEnter: (_) => setState(() => _isHovered = true),
      onExit: (_) => setState(() => _isHovered = false),
      child: GestureDetector(
        onTapDown: (_) => setState(() => _isPressed = true),
        onTapUp: (_) => setState(() => _isPressed = false),
        onTapCancel: () => setState(() => _isPressed = false),
        onTap: widget.onTap,
        behavior: HitTestBehavior.opaque,
        child: AnimatedScale(
          scale: _isPressed ? 0.94 : (_isHovered ? 1.08 : 1.0),
          duration: const Duration(milliseconds: 180),
          curve: Curves.easeOutCubic,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            padding: const EdgeInsets.all(9),
            decoration: BoxDecoration(
              color: bgColor,
              borderRadius: BorderRadius.circular(9),
              border: Border.all(
                color: _isHovered
                    ? Colors.white.withOpacity(0.2)
                    : (isDark
                        ? Colors.white.withOpacity(0.08)
                        : Colors.black.withOpacity(0.06)),
                width: 1,
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(_isHovered ? 0.35 : 0.15),
                  blurRadius: _isHovered ? 12 : 6,
                  offset: const Offset(0, 3),
                ),
              ],
            ),
            child: Stack(
              clipBehavior: Clip.none,
              alignment: Alignment.center,
              children: [
                // Icon cái chuông với hiệu ứng đung đưa (swinging ring animation) từ Prompt #074
                AnimatedBuilder(
                  animation: _ringAnimation ?? const AlwaysStoppedAnimation(0.0),
                  builder: (context, child) {
                    final angle = (_ringAnimation?.value ?? 0.0) * 2 * 3.14159;
                    return Transform.rotate(
                      angle: angle,
                      origin: const Offset(0, -6),
                      child: child,
                    );
                  },
                  child: AnimatedScale(
                    scale: _isHovered ? 1.15 : 1.0,
                    duration: const Duration(milliseconds: 200),
                    child: Icon(
                      Icons.notifications_none_rounded,
                      color: iconColor,
                      size: widget.size,
                    ),
                  ),
                ),

                // Chấm xanh Radar phát sóng lan tỏa vô hạn (Point Radar Pulse)
                if (showRadar)
                  Positioned(
                    left: -4,
                    bottom: -4,
                    child: SizedBox(
                      width: 20,
                      height: 20,
                      child: Stack(
                        alignment: Alignment.center,
                        children: [
                          // Vòng sóng radar tỏa ra
                          AnimatedBuilder(
                            animation: _radarController ??
                                const AlwaysStoppedAnimation(0.0),
                            builder: (context, _) {
                              return CustomPaint(
                                size: const Size(20, 20),
                                painter: _RadarPulsePainter(
                                  progress: _radarController?.value ?? 0.0,
                                ),
                              );
                            },
                          ),
                          // Chấm lõi xanh neon trung tâm
                          Container(
                            width: 6,
                            height: 6,
                            decoration: const BoxDecoration(
                              color: Color(0xFF00FF00),
                              shape: BoxShape.circle,
                              boxShadow: [
                                BoxShadow(
                                  color: Color(0xFF00FF00),
                                  blurRadius: 5,
                                  spreadRadius: 1,
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),

                // Badge số lượng màu san hô (.u074-badge từ Prompt #074)
                Positioned(
                  right: -5,
                  top: -5,
                  child: AnimatedScale(
                    scale: widget.unreadCount > 0 ? 1.0 : 0.0,
                    duration: const Duration(milliseconds: 320),
                    curve: Curves.easeOutBack,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 5),
                      constraints: const BoxConstraints(
                        minWidth: 19,
                        minHeight: 19,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFF5A6E), // Prompt #074 coral red
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                          color: isDark ? const Color(0xFF141724) : Colors.white,
                          width: 2.0,
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: const Color(0xFFFF5A6E).withOpacity(0.45),
                            blurRadius: 8,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: Center(
                        child: Text(
                          widget.unreadCount > 99
                              ? '99+'
                              : '${widget.unreadCount}',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 10.5,
                            fontWeight: FontWeight.w900,
                            height: 1.1,
                          ),
                        ),
                      ),
                    ),
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

/// Painter vẽ vòng sóng radar xanh lá nở rộng và mờ dần
class _RadarPulsePainter extends CustomPainter {
  final double progress;

  _RadarPulsePainter({required this.progress});

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final maxRadius = size.width / 2;
    final currentRadius = maxRadius * progress;
    final opacity = (1.0 - progress).clamp(0.0, 1.0);

    final wavePaint = Paint()
      ..color = const Color(0xFF00FF00).withOpacity(opacity * 0.75)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5;

    canvas.drawCircle(center, currentRadius, wavePaint);
  }

  @override
  bool shouldRepaint(covariant _RadarPulsePainter oldDelegate) {
    return oldDelegate.progress != progress;
  }
}
