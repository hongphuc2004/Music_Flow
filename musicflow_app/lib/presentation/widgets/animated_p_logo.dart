import 'package:flutter/material.dart';

/// Animated MusicFlow Logo Widget.
/// Combines a glowing vector stroke path-tracing animation with a seamless
/// cross-fade into the official MusicFlow logo asset (`assets/images/logo.png`).
class AnimatedPLogo extends StatelessWidget {
  final double strokeProgress; // 0.0 -> 1.0: path drawing
  final double fillProgress; // 0.0 -> 1.0: reveal of full official logo
  final double size;
  final bool isStatic; // If true, displays full logo immediately
  final double? animationValue; // Backward-compatible single progress

  const AnimatedPLogo({
    super.key,
    this.strokeProgress = 1.0,
    this.fillProgress = 1.0,
    this.size = 140,
    this.isStatic = false,
    this.animationValue,
  });

  @override
  Widget build(BuildContext context) {
    if (isStatic) {
      return Image.asset(
        'assets/images/logo.png',
        width: size,
        height: size,
        fit: BoxFit.contain,
      );
    }

    final double effectiveStroke;
    final double effectiveFill;

    if (animationValue != null) {
      // Compatibility mapping
      effectiveStroke = (animationValue! / 0.65).clamp(0.0, 1.0);
      effectiveFill = animationValue! > 0.50
          ? ((animationValue! - 0.50) / 0.50).clamp(0.0, 1.0)
          : 0.0;
    } else {
      effectiveStroke = strokeProgress.clamp(0.0, 1.0);
      effectiveFill = fillProgress.clamp(0.0, 1.0);
    }

    return SizedBox(
      width: size,
      height: size,
      child: Stack(
        alignment: Alignment.center,
        children: [
          // 1. Ambient Glow behind the logo as fill appears
          if (effectiveFill > 0.01)
            Opacity(
              opacity: effectiveFill,
              child: Container(
                width: size * 0.85,
                height: size * 0.85,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF00E5FF).withOpacity(0.35 * effectiveFill),
                      blurRadius: 36,
                      spreadRadius: 6,
                    ),
                    BoxShadow(
                      color: const Color(0xFF6C63FF).withOpacity(0.25 * effectiveFill),
                      blurRadius: 48,
                      spreadRadius: 10,
                    ),
                  ],
                ),
              ),
            ),

          // 2. Full Official MusicFlow Logo (Cross-fade in)
          if (effectiveFill > 0.01)
            Opacity(
              opacity: effectiveFill,
              child: Transform.scale(
                scale: 0.94 + 0.06 * effectiveFill,
                child: Image.asset(
                  'assets/images/logo.png',
                  width: size,
                  height: size,
                  fit: BoxFit.contain,
                ),
              ),
            ),

          // 3. Path-tracing Stroke Animation (Visible while stroke is drawing & fades out during fill)
          if (effectiveFill < 1.0 && effectiveStroke > 0.0)
            Opacity(
              opacity: (1.0 - effectiveFill).clamp(0.0, 1.0),
              child: CustomPaint(
                size: Size(size, size),
                painter: _MusicFlowLogoStrokePainter(
                  progress: effectiveStroke,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _MusicFlowLogoStrokePainter extends CustomPainter {
  final double progress;

  _MusicFlowLogoStrokePainter({required this.progress});

  @override
  void paint(Canvas canvas, Size size) {
    if (progress <= 0.0) return;

    final w = size.width;
    final h = size.height;

    // Glowing cyan stroke paint
    final glowPaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 4.2
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..color = const Color(0xFF00E5FF).withOpacity(0.75)
      ..maskFilter = const MaskFilter.blur(BlurStyle.solid, 4.0);

    // Sharp white core stroke paint
    final corePaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.4
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..color = Colors.white;

    // Glowing spark for tracing pen tip
    final tipGlow = Paint()
      ..color = const Color(0xFF00E5FF).withOpacity(0.95)
      ..maskFilter = const MaskFilter.blur(BlurStyle.solid, 5.0);

    final tipCore = Paint()
      ..color = Colors.white;

    final paths = [
      _buildPOuter(w, h),
      _buildNoteHead(w, h),
      _buildNoteStem(w, h),
      ..._buildSoundWaves(w, h),
    ];

    for (final path in paths) {
      for (final metric in path.computeMetrics()) {
        final length = metric.length;
        final currentLength = length * progress;
        final extracted = metric.extractPath(0.0, currentLength);

        canvas.drawPath(extracted, glowPaint);
        canvas.drawPath(extracted, corePaint);

        // Animated laser spark at the tip of the drawn stroke
        if (progress > 0.01 && progress < 0.99) {
          final tangent = metric.getTangentForOffset(currentLength);
          if (tangent != null) {
            canvas.drawCircle(tangent.position, 4.0, tipGlow);
            canvas.drawCircle(tangent.position, 2.0, tipCore);
          }
        }
      }
    }
  }

  /// Stylized letter "P" outer silhouette matching MusicFlow logo
  Path _buildPOuter(double w, double h) {
    final p = Path();
    p.moveTo(w * 0.28, h * 0.88);
    // Stem left edge
    p.cubicTo(w * 0.20, h * 0.70, w * 0.20, h * 0.40, w * 0.24, h * 0.22);
    // Top crest curve
    p.cubicTo(w * 0.28, h * 0.11, w * 0.40, h * 0.08, w * 0.58, h * 0.09);
    // Round bulbous right edge
    p.cubicTo(w * 0.75, h * 0.10, w * 0.88, h * 0.22, w * 0.88, h * 0.42);
    p.cubicTo(w * 0.88, h * 0.62, w * 0.76, h * 0.74, w * 0.52, h * 0.75);
    // Lower stem junction
    p.cubicTo(w * 0.47, h * 0.75, w * 0.45, h * 0.82, w * 0.45, h * 0.87);
    p.cubicTo(w * 0.45, h * 0.94, w * 0.36, h * 0.95, w * 0.28, h * 0.88);
    p.close();
    return p;
  }

  /// Center music note head
  Path _buildNoteHead(double w, double h) {
    final p = Path();
    p.addOval(
      Rect.fromCenter(
        center: Offset(w * 0.44, h * 0.58),
        width: w * 0.20,
        height: h * 0.15,
      ),
    );
    return p;
  }

  /// Center music note stem and flag
  Path _buildNoteStem(double w, double h) {
    final p = Path();
    p.moveTo(w * 0.51, h * 0.56);
    p.lineTo(w * 0.51, h * 0.20);
    // Flag curving down and outward
    p.cubicTo(w * 0.62, h * 0.22, w * 0.65, h * 0.34, w * 0.62, h * 0.47);
    p.cubicTo(w * 0.58, h * 0.41, w * 0.55, h * 0.32, w * 0.51, h * 0.28);
    return p;
  }

  /// Acoustic sound wave arcs radiating around the "P"
  List<Path> _buildSoundWaves(double w, double h) {
    final waves = <Path>[];

    // 1. Top-left outer acoustic waves
    waves.add(
      Path()
        ..addArc(
          Rect.fromCircle(center: Offset(w * 0.32, h * 0.28), radius: w * 0.24),
          -2.6,
          0.9,
        ),
    );
    waves.add(
      Path()
        ..addArc(
          Rect.fromCircle(center: Offset(w * 0.32, h * 0.28), radius: w * 0.33),
          -2.7,
          0.8,
        ),
    );

    // 2. Inner waves left of the note
    waves.add(
      Path()
        ..addArc(
          Rect.fromCircle(center: Offset(w * 0.44, h * 0.58), radius: w * 0.17),
          2.1,
          1.7,
        ),
    );
    waves.add(
      Path()
        ..addArc(
          Rect.fromCircle(center: Offset(w * 0.44, h * 0.58), radius: w * 0.25),
          2.0,
          1.6,
        ),
    );

    // 3. Bottom-right acoustic waves
    waves.add(
      Path()
        ..addArc(
          Rect.fromCircle(center: Offset(w * 0.68, h * 0.68), radius: w * 0.24),
          0.5,
          0.75,
        ),
    );
    waves.add(
      Path()
        ..addArc(
          Rect.fromCircle(center: Offset(w * 0.68, h * 0.68), radius: w * 0.32),
          0.5,
          0.75,
        ),
    );

    return waves;
  }

  @override
  bool shouldRepaint(covariant _MusicFlowLogoStrokePainter oldDelegate) {
    return oldDelegate.progress != progress;
  }
}
