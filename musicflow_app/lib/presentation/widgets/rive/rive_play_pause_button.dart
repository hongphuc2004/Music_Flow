import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';

/// Smooth, high-performance Play/Pause button with morphing animation and neon glow.
/// Fully cross-platform across Web, Mobile and Desktop with zero native driver dependencies.
class RivePlayPauseButton extends StatefulWidget {
  final bool isPlaying;
  final VoidCallback onTap;
  final double size;
  final double iconSize;
  final bool showBackground;
  final Gradient? backgroundGradient;
  final Color iconColor;
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
    this.networkUrl,
    this.assetPath = 'assets/animations/button.riv',
  });

  @override
  State<RivePlayPauseButton> createState() => _RivePlayPauseButtonState();
}

class _RivePlayPauseButtonState extends State<RivePlayPauseButton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _morphController;

  @override
  void initState() {
    super.initState();
    _morphController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 260),
      value: widget.isPlaying ? 1.0 : 0.0,
    );
  }

  @override
  void didUpdateWidget(covariant RivePlayPauseButton oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.isPlaying != oldWidget.isPlaying) {
      if (widget.isPlaying) {
        _morphController.forward();
      } else {
        _morphController.reverse();
      }
    }
  }

  @override
  void dispose() {
    _morphController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final buttonContent = AnimatedIcon(
      icon: AnimatedIcons.play_pause,
      progress: _morphController,
      color: widget.iconColor,
      size: widget.iconSize,
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

    return Container(
      width: widget.size,
      height: widget.size,
      decoration: BoxDecoration(
        gradient: widget.backgroundGradient ??
            const LinearGradient(
              colors: [AppColors.primary, AppColors.secondary],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
        shape: BoxShape.circle,
        boxShadow: AppShadows.neonGlow(AppColors.primary),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: widget.onTap,
          customBorder: const CircleBorder(),
          splashColor: Colors.white.withOpacity(0.2),
          child: Center(child: buttonContent),
        ),
      ),
    );
  }
}
