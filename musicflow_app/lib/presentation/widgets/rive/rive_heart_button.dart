import 'dart:math' as math;
import 'package:flutter/material.dart';

/// Animated Heart / Like button with particle burst effect and spring bounce.
/// Pure Flutter implementation that runs reliably across Web, Mobile and Desktop.
class RiveHeartButton extends StatefulWidget {
  final bool isLiked;
  final VoidCallback onTap;
  final double size;
  final Color activeColor;
  final Color inactiveColor;
  final String? networkUrl;
  final String assetPath;

  const RiveHeartButton({
    super.key,
    required this.isLiked,
    required this.onTap,
    this.size = 28,
    this.activeColor = const Color(0xFFFF2D55),
    this.inactiveColor = Colors.white70,
    this.networkUrl,
    this.assetPath = 'assets/animations/rating.riv',
  });

  @override
  State<RiveHeartButton> createState() => _RiveHeartButtonState();
}

class _RiveHeartButtonState extends State<RiveHeartButton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _burstController;
  late final Animation<double> _scaleAnimation;

  @override
  void initState() {
    super.initState();
    _burstController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    );

    _scaleAnimation = TweenSequence<double>([
      TweenSequenceItem(
        tween: Tween<double>(begin: 1.0, end: 1.35)
            .chain(CurveTween(curve: Curves.easeOut)),
        weight: 35,
      ),
      TweenSequenceItem(
        tween: Tween<double>(begin: 1.35, end: 0.85)
            .chain(CurveTween(curve: Curves.easeInOut)),
        weight: 35,
      ),
      TweenSequenceItem(
        tween: Tween<double>(begin: 0.85, end: 1.0)
            .chain(CurveTween(curve: Curves.easeIn)),
        weight: 30,
      ),
    ]).animate(_burstController);
  }

  @override
  void didUpdateWidget(covariant RiveHeartButton oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!oldWidget.isLiked && widget.isLiked) {
      _burstController.forward(from: 0.0);
    } else if (oldWidget.isLiked && !widget.isLiked) {
      _burstController.reset();
    }
  }

  @override
  void dispose() {
    _burstController.dispose();
    super.dispose();
  }

  void _handleTap() {
    if (!widget.isLiked) {
      _burstController.forward(from: 0.0);
    }
    widget.onTap();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: _handleTap,
      behavior: HitTestBehavior.opaque,
      child: SizedBox(
        width: widget.size * 1.5,
        height: widget.size * 1.5,
        child: Stack(
          alignment: Alignment.center,
          children: [
            // Particle burst ring
            if (_burstController.isAnimating)
              AnimatedBuilder(
                animation: _burstController,
                builder: (context, _) {
                  return CustomPaint(
                    size: Size(widget.size * 1.5, widget.size * 1.5),
                    painter: _ParticleBurstPainter(
                      progress: _burstController.value,
                      color: widget.activeColor,
                    ),
                  );
                },
              ),

            // Animated Heart Icon
            ScaleTransition(
              scale: _burstController.isAnimating
                  ? _scaleAnimation
                  : const AlwaysStoppedAnimation(1.0),
              child: Icon(
                widget.isLiked
                    ? Icons.favorite_rounded
                    : Icons.favorite_border_rounded,
                color: widget.isLiked
                    ? widget.activeColor
                    : widget.inactiveColor,
                size: widget.size,
                shadows: widget.isLiked
                    ? [
                        BoxShadow(
                          color: widget.activeColor.withOpacity(0.45),
                          blurRadius: 10,
                          spreadRadius: 1,
                        )
                      ]
                    : null,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ParticleBurstPainter extends CustomPainter {
  final double progress;
  final Color color;

  _ParticleBurstPainter({required this.progress, required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    const count = 7;
    final maxRadius = size.width * 0.45;
    final currentRadius = maxRadius * progress;
    final opacity = (1.0 - progress).clamp(0.0, 1.0);
    final particleSize = (3.5 * (1.0 - progress * 0.7)).clamp(1.0, 3.5);

    final paint = Paint()
      ..color = color.withOpacity(opacity)
      ..style = PaintingStyle.fill;

    for (int i = 0; i < count; i++) {
      final angle = (i * (2 * math.pi / count)) + (progress * 0.3);
      final offset = Offset(
        center.dx + currentRadius * math.cos(angle),
        center.dy + currentRadius * math.sin(angle),
      );
      canvas.drawCircle(offset, particleSize, paint);
    }
  }

  @override
  bool shouldRepaint(covariant _ParticleBurstPainter oldDelegate) {
    return oldDelegate.progress != progress;
  }
}
