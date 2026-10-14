import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';

/// Spring curve extracted from Lucian UX/UI Prompt #007
class SpringMorphCurve extends Curve {
  const SpringMorphCurve();

  @override
  double transformInternal(double t) {
    return 1.0 + 2.2 * math.pow(t - 1.0, 3) + 1.2 * math.pow(t - 1.0, 2);
  }
}

/// CustomPainter that interpolates the 2 SVG polygons between Play and Pause states
class PlayPauseMorphPainter extends CustomPainter {
  final double morphProgress; // 0.0 = Play, 1.0 = Pause
  final Color color;

  // Polygon coordinates in 40x40 coordinate space
  static const List<List<List<double>>> playPolygons = [
    [
      [13.0, 8.0],
      [22.5, 13.6],
      [22.5, 26.4],
      [13.0, 32.0],
    ],
    [
      [22.5, 13.6],
      [32.0, 20.0],
      [32.0, 20.0],
      [22.5, 26.4],
    ],
  ];

  static const List<List<List<double>>> pausePolygons = [
    [
      [11.0, 9.0],
      [17.0, 9.0],
      [17.0, 31.0],
      [11.0, 31.0],
    ],
    [
      [23.0, 9.0],
      [29.0, 9.0],
      [29.0, 31.0],
      [23.0, 31.0],
    ],
  ];

  const PlayPauseMorphPainter({
    required this.morphProgress,
    required this.color,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final scale = size.width / 40.0;
    final t = morphProgress;

    final fillPaint = Paint()
      ..color = color
      ..style = PaintingStyle.fill;

    final strokePaint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.4 * scale
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    for (int k = 0; k < 2; k++) {
      final path = Path();
      for (int j = 0; j < 4; j++) {
        final p = playPolygons[k][j];
        final q = pausePolygons[k][j];
        final x = (p[0] + (q[0] - p[0]) * t) * scale;
        final y = (p[1] + (q[1] - p[1]) * t) * scale;

        if (j == 0) {
          path.moveTo(x, y);
        } else {
          path.lineTo(x, y);
        }
      }
      path.close();

      // Draw stroke first for rounded joints, then fill
      canvas.drawPath(path, strokePaint);
      canvas.drawPath(path, fillPaint);
    }
  }

  @override
  bool shouldRepaint(covariant PlayPauseMorphPainter oldDelegate) {
    return oldDelegate.morphProgress != morphProgress ||
        oldDelegate.color != color;
  }
}

/// Circular progress ring painter around the button
class CircularProgressRingPainter extends CustomPainter {
  final double progress;
  final Gradient gradient;
  final Color trackColor;
  final double strokeWidth;

  const CircularProgressRingPainter({
    required this.progress,
    required this.gradient,
    required this.trackColor,
    this.strokeWidth = 3.0,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = (size.width - strokeWidth) / 2;

    // Track circle
    final trackPaint = Paint()
      ..color = trackColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth;
    canvas.drawCircle(center, radius, trackPaint);

    if (progress <= 0.0) return;

    // Active arc with gradient
    final rect = Rect.fromCircle(center: center, radius: radius);
    final sweepAngle = 2 * math.pi * progress.clamp(0.0, 1.0);

    final arcPaint = Paint()
      ..shader = gradient.createShader(rect)
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth + 0.5
      ..strokeCap = StrokeCap.round;

    // Rotate start angle to 12 o'clock (-pi/2)
    canvas.drawArc(
      rect,
      -math.pi / 2,
      sweepAngle,
      false,
      arcPaint,
    );
  }

  @override
  bool shouldRepaint(covariant CircularProgressRingPainter oldDelegate) {
    return oldDelegate.progress != progress ||
        oldDelegate.strokeWidth != strokeWidth ||
        oldDelegate.trackColor != trackColor;
  }
}

/// Smooth, high-performance Play/Pause button with:
/// - SVG polygon morphing interpolation (Play <-> Pause)
/// - Pulsing halo aura on active playback
/// - Optional circular progress ring
/// - Micro-interaction scale feedback
/// - Preserves MusicFlow system palette (AppColors.primary, AppColors.secondary)
class RivePlayPauseButton extends StatefulWidget {
  final bool isPlaying;
  final VoidCallback onTap;
  final double size;
  final double iconSize;
  final bool showBackground;
  final Gradient? backgroundGradient;
  final Color iconColor;
  final double? progress;
  final bool showProgressRing;
  final String? networkUrl;
  final String assetPath;

  const RivePlayPauseButton({
    super.key,
    required this.isPlaying,
    required this.onTap,
    this.size = 54,
    this.iconSize = 28,
    this.showBackground = true,
    this.backgroundGradient,
    this.iconColor = Colors.white,
    this.progress,
    this.showProgressRing = false,
    this.networkUrl,
    this.assetPath = 'assets/animations/button.riv',
  });

  @override
  State<RivePlayPauseButton> createState() => _RivePlayPauseButtonState();
}

class _RivePlayPauseButtonState extends State<RivePlayPauseButton>
    with TickerProviderStateMixin {
  AnimationController? _morphController;
  Animation<double>? _morphAnimation;

  AnimationController? _pulseController;
  Animation<double>? _pulseScaleAnimation;
  Animation<double>? _pulseOpacityAnimation;

  bool _isPressed = false;

  void _ensureInitialized() {
    if (_morphController != null) return;

    // 1. Morph animation controller
    _morphController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 400),
      value: widget.isPlaying ? 1.0 : 0.0,
    );

    _morphAnimation = CurvedAnimation(
      parent: _morphController!,
      curve: const SpringMorphCurve(),
      reverseCurve: const SpringMorphCurve(),
    );

    // 2. Pulse halo aura controller
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2400),
    );

    _pulseScaleAnimation = Tween<double>(begin: 0.9, end: 1.5).animate(
      CurvedAnimation(
        parent: _pulseController!,
        curve: const Cubic(0.2, 0.8, 0.2, 1.0),
      ),
    );

    _pulseOpacityAnimation = TweenSequence<double>([
      TweenSequenceItem(tween: Tween<double>(begin: 0.55, end: 0.25), weight: 50),
      TweenSequenceItem(tween: Tween<double>(begin: 0.25, end: 0.0), weight: 50),
    ]).animate(
      CurvedAnimation(
        parent: _pulseController!,
        curve: Curves.easeOut,
      ),
    );

    if (widget.isPlaying) {
      _pulseController!.repeat();
    }
  }

  @override
  void initState() {
    super.initState();
    _ensureInitialized();
  }

  @override
  void didUpdateWidget(covariant RivePlayPauseButton oldWidget) {
    super.didUpdateWidget(oldWidget);
    _ensureInitialized();
    if (widget.isPlaying != oldWidget.isPlaying) {
      if (widget.isPlaying) {
        _morphController?.forward();
        _pulseController?.repeat();
      } else {
        _morphController?.reverse();
        _pulseController?.stop();
        _pulseController?.reset();
      }
    }
  }

  @override
  void dispose() {
    _morphController?.dispose();
    _pulseController?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    _ensureInitialized();

    final gradient = widget.backgroundGradient ??
        const LinearGradient(
          colors: [AppColors.primary, AppColors.secondary],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        );

    final buttonContent = AnimatedBuilder(
      animation: _morphAnimation!,
      builder: (context, child) {
        return CustomPaint(
          size: Size(widget.iconSize, widget.iconSize),
          painter: PlayPauseMorphPainter(
            morphProgress: _morphAnimation!.value,
            color: widget.iconColor,
          ),
        );
      },
    );

    if (!widget.showBackground) {
      return Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: widget.onTap,
          borderRadius: BorderRadius.circular(widget.size / 2),
          child: SizedBox(
            width: widget.size,
            height: widget.size,
            child: Center(child: buttonContent),
          ),
        ),
      );
    }

    final hasRing = widget.showProgressRing && widget.progress != null;
    final buttonDimension = hasRing ? widget.size * 0.8 : widget.size;

    return SizedBox(
      width: widget.size,
      height: widget.size,
      child: Stack(
        alignment: Alignment.center,
        clipBehavior: Clip.none,
        children: [
          // 1. Circular Progress Ring (if enabled)
          if (hasRing)
            Positioned.fill(
              child: CustomPaint(
                painter: CircularProgressRingPainter(
                  progress: widget.progress ?? 0.0,
                  gradient: gradient,
                  trackColor: Colors.white.withOpacity(0.14),
                  strokeWidth: 3.0,
                ),
              ),
            ),

          // 2. Pulsing halo ring behind button
          if (widget.isPlaying && _pulseController != null)
            AnimatedBuilder(
              animation: _pulseController!,
              builder: (context, child) {
                return Transform.scale(
                  scale: _pulseScaleAnimation!.value,
                  child: Opacity(
                    opacity: _pulseOpacityAnimation!.value,
                    child: Container(
                      width: buttonDimension,
                      height: buttonDimension,
                      decoration: BoxDecoration(
                        gradient: gradient,
                        shape: BoxShape.circle,
                      ),
                    ),
                  ),
                );
              },
            ),

          // 3. Tactile interactive main button
          GestureDetector(
            onTapDown: (_) => setState(() => _isPressed = true),
            onTapUp: (_) {
              setState(() => _isPressed = false);
              widget.onTap();
            },
            onTapCancel: () => setState(() => _isPressed = false),
            child: AnimatedScale(
              scale: _isPressed ? 0.92 : 1.0,
              duration: const Duration(milliseconds: 180),
              curve: Curves.easeOutCubic,
              child: Container(
                width: buttonDimension,
                height: buttonDimension,
                decoration: BoxDecoration(
                  gradient: gradient,
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.primary.withOpacity(0.55),
                      blurRadius: widget.isPlaying ? 22.0 : 12.0,
                      spreadRadius: widget.isPlaying ? 2.0 : 0.0,
                      offset: const Offset(0, 4),
                    ),
                    BoxShadow(
                      color: AppColors.secondary.withOpacity(0.35),
                      blurRadius: 16.0,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: Center(
                  child: buttonContent,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
