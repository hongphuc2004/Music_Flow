import 'dart:math' as math;
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:musicflow_app/core/theme/app_theme.dart';
import 'package:musicflow_app/data/models/song_model.dart';
import 'package:musicflow_app/presentation/screens/ai_assistant/ai_assistant_screen.dart';

import 'package:musicflow_app/core/services/app_settings_service.dart';
import 'package:musicflow_app/core/utils/app_toast.dart';

class AiFloatingAssistantOrb extends StatefulWidget {
  final Function(Song)? onSongTap;
  final Function(List<Song>, {int startIndex})? onPlayAll;

  const AiFloatingAssistantOrb({
    super.key,
    this.onSongTap,
    this.onPlayAll,
  });

  @override
  State<AiFloatingAssistantOrb> createState() => _AiFloatingAssistantOrbState();
}

class _AiFloatingAssistantOrbState extends State<AiFloatingAssistantOrb>
    with TickerProviderStateMixin {
  late AnimationController _pulseController;
  late AnimationController _rotationController;
  late Animation<double> _pulseAnimation;
  late Animation<double> _glowAnimation;

  // Draggable position
  Offset _position = const Offset(-1, -1);
  bool _isDragging = false;

  @override
  void initState() {
    super.initState();

    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2200),
    )..repeat(reverse: true);

    _rotationController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 8),
    )..repeat();

    _pulseAnimation = Tween<double>(begin: 0.95, end: 1.06).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOutSine),
    );

    _glowAnimation = Tween<double>(begin: 0.35, end: 0.85).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _pulseController.dispose();
    _rotationController.dispose();
    super.dispose();
  }

  void _openAssistant() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => ClipRRect(
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
        child: SizedBox(
          height: MediaQuery.of(context).size.height * 0.88,
          child: AiAssistantScreen(
            onSongTap: widget.onSongTap,
            onPlayAll: widget.onPlayAll,
          ),
        ),
      ),
    );
  }

  void _hideOrb() {
    AppSettingsService().setFloatingAiEnabled(false);
    AppToast.showInfo(
      context,
      'Đã ẩn nút Trợ lý AI. Bạn có thể bật lại trong Cài đặt.',
    );
  }

  @override
  Widget build(BuildContext context) {
    final screenSize = MediaQuery.of(context).size;
    final padding = MediaQuery.of(context).padding;

    // Initial position: Bottom right above mini player
    if (_position == const Offset(-1, -1)) {
      _position = Offset(screenSize.width - 76, screenSize.height - 210);
    }

    return Positioned(
      left: _position.dx,
      top: _position.dy,
      child: GestureDetector(
        onPanStart: (_) => setState(() => _isDragging = true),
        onPanUpdate: (details) {
          setState(() {
            double newX = _position.dx + details.delta.dx;
            double newY = _position.dy + details.delta.dy;

            // Bounds constraint: can float freely on top of whole screen
            newX = newX.clamp(10.0, screenSize.width - 66);
            newY = newY.clamp(padding.top + 8, screenSize.height - padding.bottom - 70);

            _position = Offset(newX, newY);
          });
        },
        onPanEnd: (_) {
          setState(() => _isDragging = false);
        },
        onTap: _openAssistant,
        onLongPress: () {
          showDialog(
            context: context,
            builder: (ctx) => AlertDialog(
              backgroundColor: const Color(0xFF160E2E),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
              title: const Text('Ẩn nút Trợ lý AI?', style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.bold)),
              content: const Text(
                'Bạn có muốn ẩn nút trợ lý AI nổi trên màn hình không? Bạn có thể bật lại trong mục Cài đặt bất kỳ lúc nào.',
                style: TextStyle(color: Colors.white70, fontSize: 13),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(ctx),
                  child: const Text(
                    'Hủy',
                    style: TextStyle(color: Colors.white60, fontWeight: FontWeight.w600),
                  ),
                ),
                ElevatedButton(
                  onPressed: () {
                    Navigator.pop(ctx);
                    _hideOrb();
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF6C63FF),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
                  ),
                  child: const Text(
                    'Ẩn nút',
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                      fontSize: 14,
                    ),
                  ),
                ),
              ],
            ),
          );
        },
        child: AnimatedBuilder(
          animation: Listenable.merge([_pulseAnimation, _glowAnimation, _rotationController]),
          builder: (context, child) {
            final pulse = _pulseAnimation.value;
            final glow = _glowAnimation.value;

            return Transform.scale(
              scale: _isDragging ? 1.12 : pulse,
              child: Material(
                type: MaterialType.transparency,
                child: CustomPaint(
                  size: const Size(56, 56),
                  painter: _HolographicAiOrbPainter(
                    glowIntensity: glow,
                    rotation: _rotationController.value * 2 * math.pi,
                  ),
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}

class _HolographicAiOrbPainter extends CustomPainter {
  final double glowIntensity;
  final double rotation;

  _HolographicAiOrbPainter({
    required this.glowIntensity,
    required this.rotation,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2;

    // 1. Outermost Multi-color Breathing Neon Halo
    final outerGlowPaint = Paint()
      ..shader = RadialGradient(
        colors: [
          const Color(0xFF00E5FF).withOpacity(0.45 * glowIntensity),
          const Color(0xFF6C63FF).withOpacity(0.35 * glowIntensity),
          const Color(0xFFFF007F).withOpacity(0.15 * glowIntensity),
          Colors.transparent,
        ],
        stops: const [0.2, 0.55, 0.8, 1.0],
      ).createShader(Rect.fromCircle(center: center, radius: radius * 1.5))
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 8);

    canvas.drawCircle(center, radius * 1.35, outerGlowPaint);

    // 2. Rotating Futuristic Outer Orbital Ring with Accent Dots
    final ringPaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.4
      ..shader = SweepGradient(
        colors: const [
          Color(0xFF00E5FF),
          Color(0xFF6C63FF),
          Color(0xFFFF007F),
          Color(0xFFFFD700),
          Color(0xFF00E5FF),
        ],
        transform: GradientRotation(rotation),
      ).createShader(Rect.fromCircle(center: center, radius: radius - 2));

    canvas.drawCircle(center, radius - 3, ringPaint);

    // Orbital satellites (particles)
    for (int i = 0; i < 3; i++) {
      final angle = rotation + (i * 2 * math.pi / 3);
      final satPos = Offset(
        center.dx + (radius - 3) * math.cos(angle),
        center.dy + (radius - 3) * math.sin(angle),
      );
      final satPaint = Paint()
        ..color = (i == 0 ? const Color(0xFF00E5FF) : (i == 1 ? const Color(0xFFFFD700) : const Color(0xFFFF007F)))
        ..maskFilter = const MaskFilter.blur(BlurStyle.solid, 2);
      canvas.drawCircle(satPos, 2.2, satPaint);
    }

    // 3. Main Orb Sphere Gradient
    final orbPaint = Paint()
      ..shader = const RadialGradient(
        center: Alignment(-0.3, -0.3),
        radius: 0.9,
        colors: [
          Color(0xFF3B2A6B),
          Color(0xFF1E1442),
          Color(0xFF0D0824),
        ],
        stops: [0.0, 0.6, 1.0],
      ).createShader(Rect.fromCircle(center: center, radius: radius - 4));

    canvas.drawCircle(center, radius - 5, orbPaint);

    // 4. Internal Cyber Waveform Audio Resonance (3 sound wave curves)
    final wavePaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeWidth = 1.6
      ..shader = const LinearGradient(
        colors: [Color(0xFF00E5FF), Color(0xFF6C63FF), Color(0xFFFF77E9)],
      ).createShader(Rect.fromCircle(center: center, radius: radius));

    // Wave 1
    canvas.drawLine(
      Offset(center.dx - 10, center.dy),
      Offset(center.dx - 10, center.dy - 6 * (0.8 + 0.4 * math.sin(rotation * 2))),
      wavePaint,
    );
    canvas.drawLine(
      Offset(center.dx - 10, center.dy),
      Offset(center.dx - 10, center.dy + 6 * (0.8 + 0.4 * math.sin(rotation * 2))),
      wavePaint,
    );

    // Wave 2 (Center highest)
    canvas.drawLine(
      Offset(center.dx, center.dy),
      Offset(center.dx, center.dy - 12 * (0.8 + 0.3 * math.cos(rotation * 3))),
      wavePaint,
    );
    canvas.drawLine(
      Offset(center.dx, center.dy),
      Offset(center.dx, center.dy + 12 * (0.8 + 0.3 * math.cos(rotation * 3))),
      wavePaint,
    );

    // Wave 3
    canvas.drawLine(
      Offset(center.dx + 10, center.dy),
      Offset(center.dx + 10, center.dy - 7 * (0.8 + 0.4 * math.sin(rotation * 2.5))),
      wavePaint,
    );
    canvas.drawLine(
      Offset(center.dx + 10, center.dy),
      Offset(center.dx + 10, center.dy + 7 * (0.8 + 0.4 * math.sin(rotation * 2.5))),
      wavePaint,
    );

    // 5. Central 4-Point Prism Star (Gemini AI Core)
    final starPath = Path();
    final starCenter = Offset(center.dx, center.dy);
    const starOuterRadius = 9.0;
    const starInnerRadius = 2.8;

    for (int i = 0; i < 8; i++) {
      final r = i.isEven ? starOuterRadius : starInnerRadius;
      final a = (i * math.pi / 4) - math.pi / 2;
      final x = starCenter.dx + r * math.cos(a);
      final y = starCenter.dy + r * math.sin(a);
      if (i == 0) {
        starPath.moveTo(x, y);
      } else {
        starPath.lineTo(x, y);
      }
    }
    starPath.close();

    final starPaint = Paint()
      ..shader = const LinearGradient(
        colors: [Color(0xFFFFFFFF), Color(0xFF00E5FF), Color(0xFFFFD700)],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ).createShader(Rect.fromCircle(center: starCenter, radius: starOuterRadius));

    canvas.drawPath(starPath, starPaint);

    // 6. Glass Refraction Highlight (Top curved sheen)
    final sheenPaint = Paint()
      ..shader = LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [
          Colors.white.withOpacity(0.55),
          Colors.white.withOpacity(0.0),
        ],
      ).createShader(Rect.fromLTWH(center.dx - 12, center.dy - radius + 7, 24, 12));

    canvas.drawOval(
      Rect.fromLTWH(center.dx - 11, center.dy - radius + 7, 22, 10),
      sheenPaint,
    );
  }

  @override
  bool shouldRepaint(covariant _HolographicAiOrbPainter oldDelegate) {
    return oldDelegate.glowIntensity != glowIntensity || oldDelegate.rotation != rotation;
  }
}
