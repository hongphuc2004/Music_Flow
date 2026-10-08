import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../../../core/audio/global_audio_state.dart';
import '../../../core/theme/app_theme.dart';

/// Animated Shuffle button with spring bounce, rotation and neon glow.
class RiveShuffleButton extends StatefulWidget {
  final bool isEnabled;
  final VoidCallback? onTap;
  final double size;
  final Color activeColor;
  final Color inactiveColor;

  const RiveShuffleButton({
    super.key,
    required this.isEnabled,
    this.onTap,
    this.size = 28,
    this.activeColor = AppColors.secondary,
    this.inactiveColor = Colors.white54,
  });

  @override
  State<RiveShuffleButton> createState() => _RiveShuffleButtonState();
}

class _RiveShuffleButtonState extends State<RiveShuffleButton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _animController;
  late final Animation<double> _scaleAnimation;
  late final Animation<double> _rotationAnimation;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 350),
    );

    _scaleAnimation = TweenSequence<double>([
      TweenSequenceItem(
        tween: Tween<double>(begin: 1.0, end: 1.3).chain(CurveTween(curve: Curves.easeOutBack)),
        weight: 50,
      ),
      TweenSequenceItem(
        tween: Tween<double>(begin: 1.3, end: 1.0).chain(CurveTween(curve: Curves.easeIn)),
        weight: 50,
      ),
    ]).animate(_animController);

    _rotationAnimation = Tween<double>(begin: 0.0, end: math.pi).chain(
      CurveTween(curve: Curves.easeInOutBack),
    ).animate(_animController);
  }

  @override
  void didUpdateWidget(covariant RiveShuffleButton oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.isEnabled != oldWidget.isEnabled) {
      _animController.forward(from: 0.0);
    }
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  void _handleTap() {
    if (widget.onTap == null) return;
    _animController.forward(from: 0.0);
    widget.onTap!();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: widget.onTap != null ? _handleTap : null,
      behavior: HitTestBehavior.opaque,
      child: SizedBox(
        width: 48,
        height: 48,
        child: Center(
          child: AnimatedBuilder(
            animation: _animController,
            builder: (context, child) {
              return Transform.scale(
                scale: _scaleAnimation.value,
                child: Transform.rotate(
                  angle: _rotationAnimation.value,
                  child: Container(
                    decoration: widget.isEnabled
                        ? BoxDecoration(
                            shape: BoxShape.circle,
                            boxShadow: [
                              BoxShadow(
                                color: widget.activeColor.withOpacity(0.35),
                                blurRadius: 10,
                                spreadRadius: 1,
                              ),
                            ],
                          )
                        : null,
                    child: Icon(
                      Icons.shuffle_rounded,
                      size: widget.size,
                      color: widget.isEnabled ? widget.activeColor : widget.inactiveColor,
                    ),
                  ),
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}

/// Animated Repeat button with mode morphing, pop bounce and active indicators.
class RiveRepeatButton extends StatefulWidget {
  final PlaybackRepeatMode repeatMode;
  final VoidCallback? onTap;
  final double size;
  final Color activeColor;
  final Color inactiveColor;

  const RiveRepeatButton({
    super.key,
    required this.repeatMode,
    this.onTap,
    this.size = 28,
    this.activeColor = AppColors.secondary,
    this.inactiveColor = Colors.white54,
  });

  @override
  State<RiveRepeatButton> createState() => _RiveRepeatButtonState();
}

class _RiveRepeatButtonState extends State<RiveRepeatButton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _animController;
  late final Animation<double> _scaleAnimation;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 320),
    );

    _scaleAnimation = TweenSequence<double>([
      TweenSequenceItem(
        tween: Tween<double>(begin: 1.0, end: 1.35).chain(CurveTween(curve: Curves.easeOutBack)),
        weight: 50,
      ),
      TweenSequenceItem(
        tween: Tween<double>(begin: 1.35, end: 1.0).chain(CurveTween(curve: Curves.easeIn)),
        weight: 50,
      ),
    ]).animate(_animController);
  }

  @override
  void didUpdateWidget(covariant RiveRepeatButton oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.repeatMode != oldWidget.repeatMode) {
      _animController.forward(from: 0.0);
    }
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  void _handleTap() {
    if (widget.onTap == null) return;
    _animController.forward(from: 0.0);
    widget.onTap!();
  }

  @override
  Widget build(BuildContext context) {
    final isOff = widget.repeatMode == PlaybackRepeatMode.off;
    final isOne = widget.repeatMode == PlaybackRepeatMode.one;
    final isAll = widget.repeatMode == PlaybackRepeatMode.all;

    return GestureDetector(
      onTap: widget.onTap != null ? _handleTap : null,
      behavior: HitTestBehavior.opaque,
      child: SizedBox(
        width: 48,
        height: 48,
        child: Center(
          child: AnimatedBuilder(
            animation: _scaleAnimation,
            builder: (context, child) {
              return Transform.scale(
                scale: _scaleAnimation.value,
                child: Stack(
                  clipBehavior: Clip.none,
                  alignment: Alignment.center,
                  children: [
                    Container(
                      decoration: !isOff
                          ? BoxDecoration(
                              shape: BoxShape.circle,
                              boxShadow: [
                                BoxShadow(
                                  color: widget.activeColor.withOpacity(0.35),
                                  blurRadius: 10,
                                  spreadRadius: 1,
                                ),
                              ],
                            )
                          : null,
                      child: Icon(
                        isOne ? Icons.repeat_one_rounded : Icons.repeat_rounded,
                        size: widget.size,
                        color: isOff ? widget.inactiveColor : widget.activeColor,
                      ),
                    ),
                    if (isAll)
                      Positioned(
                        right: 2,
                        top: 2,
                        child: Container(
                          width: 6,
                          height: 6,
                          decoration: BoxDecoration(
                            color: widget.activeColor,
                            shape: BoxShape.circle,
                            boxShadow: [
                              BoxShadow(
                                color: widget.activeColor.withOpacity(0.6),
                                blurRadius: 4,
                              ),
                            ],
                          ),
                        ),
                      ),
                  ],
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}
