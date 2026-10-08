import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';

/// Animated Audio Equalizer / Visualizer with dancing frequency bars.
/// Smoothly animates when audio is active, and settles when paused.
class RiveAudioVisualizer extends StatefulWidget {
  final bool isPlaying;
  final double width;
  final double height;
  final Color? color;
  final Gradient? gradient;
  final int barCount;
  final double barWidth;
  final double spacing;

  const RiveAudioVisualizer({
    super.key,
    required this.isPlaying,
    this.width = 24,
    this.height = 18,
    this.color,
    this.gradient,
    this.barCount = 4,
    this.barWidth = 3.0,
    this.spacing = 2.5,
  });

  @override
  State<RiveAudioVisualizer> createState() => _RiveAudioVisualizerState();
}

class _RiveAudioVisualizerState extends State<RiveAudioVisualizer>
    with SingleTickerProviderStateMixin {
  late final AnimationController _animController;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    );

    if (widget.isPlaying) {
      _animController.repeat();
    }
  }

  @override
  void didUpdateWidget(covariant RiveAudioVisualizer oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.isPlaying != oldWidget.isPlaying) {
      if (widget.isPlaying) {
        if (!_animController.isAnimating) {
          _animController.repeat();
        }
      } else {
        _animController.animateTo(0.2, duration: const Duration(milliseconds: 300));
      }
    }
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final effectiveColor = widget.color ?? AppColors.secondary;

    return SizedBox(
      width: widget.width,
      height: widget.height,
      child: AnimatedBuilder(
        animation: _animController,
        builder: (context, _) {
          final time = _animController.value * 2 * math.pi;

          return Row(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.end,
            children: List.generate(widget.barCount, (index) {
              // Different phase & frequency for each equalizer bar
              final phase = index * (math.pi / 2.2);
              final rawHeight = widget.isPlaying
                  ? 0.25 + 0.70 * (0.5 + 0.5 * math.sin(time * 2.0 + phase))
                  : 0.20;

              final barH = (rawHeight * widget.height).clamp(3.0, widget.height);

              return Container(
                margin: EdgeInsets.symmetric(horizontal: widget.spacing / 2),
                width: widget.barWidth,
                height: barH,
                decoration: BoxDecoration(
                  color: widget.gradient == null ? effectiveColor : null,
                  gradient: widget.gradient,
                  borderRadius: BorderRadius.circular(widget.barWidth / 2),
                  boxShadow: widget.isPlaying
                      ? [
                          BoxShadow(
                            color: effectiveColor.withOpacity(0.4),
                            blurRadius: 4,
                            spreadRadius: 0.5,
                          ),
                        ]
                      : null,
                ),
              );
            }),
          );
        },
      ),
    );
  }
}
