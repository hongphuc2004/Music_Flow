import 'package:flutter/material.dart';
import 'rive_audio_visualizer.dart';

/// Interactive animated icon for MusicFlow Bottom Navigation Bar.
class RiveNavIcon extends StatefulWidget {
  final int index;
  final bool isSelected;
  final IconData icon;
  final IconData activeIcon;
  final Color activeColor;
  final Color inactiveColor;
  final double size;

  const RiveNavIcon({
    super.key,
    required this.index,
    required this.isSelected,
    required this.icon,
    required this.activeIcon,
    required this.activeColor,
    required this.inactiveColor,
    this.size = 24,
  });

  @override
  State<RiveNavIcon> createState() => _RiveNavIconState();
}

class _RiveNavIconState extends State<RiveNavIcon>
    with SingleTickerProviderStateMixin {
  late final AnimationController _animController;
  late final Animation<double> _bounceAnimation;
  late final Animation<double> _rotationAnimation;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 400),
    );

    _bounceAnimation = TweenSequence<double>([
      TweenSequenceItem(
        tween: Tween<double>(begin: 1.0, end: 1.3).chain(CurveTween(curve: Curves.easeOutBack)),
        weight: 50,
      ),
      TweenSequenceItem(
        tween: Tween<double>(begin: 1.3, end: 1.15).chain(CurveTween(curve: Curves.easeInOut)),
        weight: 50,
      ),
    ]).animate(_animController);

    _rotationAnimation = TweenSequence<double>([
      TweenSequenceItem(
        tween: Tween<double>(begin: 0.0, end: -0.15).chain(CurveTween(curve: Curves.easeOut)),
        weight: 30,
      ),
      TweenSequenceItem(
        tween: Tween<double>(begin: -0.15, end: 0.15).chain(CurveTween(curve: Curves.easeInOut)),
        weight: 40,
      ),
      TweenSequenceItem(
        tween: Tween<double>(begin: 0.15, end: 0.0).chain(CurveTween(curve: Curves.easeIn)),
        weight: 30,
      ),
    ]).animate(_animController);

    if (widget.isSelected) {
      _animController.value = 1.0;
    }
  }

  @override
  void didUpdateWidget(covariant RiveNavIcon oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.isSelected && !oldWidget.isSelected) {
      _animController.forward(from: 0.0);
    } else if (!widget.isSelected && oldWidget.isSelected) {
      _animController.reverse();
    }
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _animController,
      builder: (context, child) {
        final scale = widget.isSelected ? _bounceAnimation.value : 1.0;
        final rotation = widget.isSelected ? _rotationAnimation.value : 0.0;

        // Custom specialized animation per tab
        if (widget.index == 1 && widget.isSelected) {
          // Trending: Mini dancing visualizer bars
          return Transform.scale(
            scale: scale,
            child: SizedBox(
              width: widget.size,
              height: widget.size,
              child: Center(
                child: RiveAudioVisualizer(
                  isPlaying: true,
                  barCount: 3,
                  width: widget.size - 2,
                  height: widget.size - 4,
                  color: widget.activeColor,
                  barWidth: 3.5,
                  spacing: 2.0,
                ),
              ),
            ),
          );
        }

        if (widget.index == 3 && widget.isSelected) {
          // AI Assistant: Sparkle rotating and glowing
          return Transform.scale(
            scale: scale,
            child: Transform.rotate(
              angle: rotation * 2.0,
              child: Container(
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF00E5FF).withOpacity(0.4),
                      blurRadius: 10,
                      spreadRadius: 2,
                    ),
                  ],
                ),
                child: Icon(
                  widget.activeIcon,
                  size: widget.size,
                  color: widget.activeColor,
                ),
              ),
            ),
          );
        }

        // Generic bounce & subtle tilt for other tabs (Home, Search, Library)
        return Transform.scale(
          scale: scale,
          child: Transform.rotate(
            angle: rotation,
            child: Icon(
              widget.isSelected ? widget.activeIcon : widget.icon,
              size: widget.size,
              color: widget.isSelected ? widget.activeColor : widget.inactiveColor,
            ),
          ),
        );
      },
    );
  }
}
