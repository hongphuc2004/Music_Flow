import 'package:flutter/material.dart';

class LiquidGlassFollowButton extends StatefulWidget {
  final bool isFollowing;
  final bool isLoading;
  final VoidCallback onTap;
  final double height;
  final double expandedWidth;
  final String followingText;
  final String followText;

  const LiquidGlassFollowButton({
    super.key,
    required this.isFollowing,
    this.isLoading = false,
    required this.onTap,
    this.height = 42,
    this.expandedWidth = 118,
    this.followingText = 'Đang theo dõi',
    this.followText = 'Quan tâm',
  });

  @override
  State<LiquidGlassFollowButton> createState() => _LiquidGlassFollowButtonState();
}

class _LiquidGlassFollowButtonState extends State<LiquidGlassFollowButton>
    with SingleTickerProviderStateMixin {
  bool _isPressed = false;
  bool _showSuccessCheck = false;
  late final AnimationController _sheenController;

  @override
  void initState() {
    super.initState();
    _sheenController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2400),
    )..repeat(reverse: true);
  }

  @override
  void didUpdateWidget(covariant LiquidGlassFollowButton oldWidget) {
    super.didUpdateWidget(oldWidget);
    // When loading transitions to false and follow state changed, trigger success check
    if (oldWidget.isLoading && !widget.isLoading) {
      setState(() => _showSuccessCheck = true);
      Future.delayed(const Duration(milliseconds: 1400), () {
        if (mounted) setState(() => _showSuccessCheck = false);
      });
    }
  }

  @override
  void dispose() {
    _sheenController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isShrunk = widget.isLoading;
    final currentWidth = isShrunk ? widget.height : widget.expandedWidth;

    return GestureDetector(
      onTapDown: (_) => setState(() => _isPressed = true),
      onTapUp: (_) {
        setState(() => _isPressed = false);
        if (!widget.isLoading) widget.onTap();
      },
      onTapCancel: () => setState(() => _isPressed = false),
      child: AnimatedScale(
        scale: _isPressed ? 0.93 : 1.0,
        duration: const Duration(milliseconds: 160),
        curve: const Cubic(0.2, 0.8, 0.2, 1.0),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 550),
          curve: const Cubic(0.2, 0.8, 0.2, 1.0),
          width: currentWidth,
          height: widget.height,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(999),
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: widget.isFollowing
                  ? [
                      const Color(0x386C63FF),
                      const Color(0x2213141C),
                      const Color(0x3300BCD4),
                    ]
                  : [
                      Colors.white.withOpacity(0.28),
                      Colors.white.withOpacity(0.08),
                      Colors.white.withOpacity(0.18),
                    ],
            ),
            border: Border.all(
              color: widget.isFollowing
                  ? const Color(0xFF8C85FF).withOpacity(0.55)
                  : Colors.white.withOpacity(0.45),
              width: 1.2,
            ),
            boxShadow: [
              BoxShadow(
                color: widget.isFollowing
                    ? const Color(0xFF6C63FF).withOpacity(0.35)
                    : Colors.black.withOpacity(0.28),
                blurRadius: 18,
                offset: const Offset(0, 6),
              ),
              BoxShadow(
                color: Colors.white.withOpacity(0.12),
                blurRadius: 4,
                offset: const Offset(0, -1),
              ),
            ],
          ),
          clipBehavior: Clip.antiAlias,
          child: Stack(
            alignment: Alignment.center,
            children: [
              // Liquid top specular highlight curved shape
              Positioned(
                top: 2,
                left: 10,
                right: 10,
                height: widget.height * 0.42,
                child: Container(
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(999),
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [
                        Colors.white.withOpacity(0.40),
                        Colors.white.withOpacity(0.0),
                      ],
                    ),
                  ),
                ),
              ),

              // Animated light sheen sweep reflection
              AnimatedBuilder(
                animation: _sheenController,
                builder: (context, child) {
                  return Transform.translate(
                    offset: Offset(
                      (_sheenController.value * 2 - 1) * (widget.expandedWidth + 40),
                      0,
                    ),
                    child: Transform.rotate(
                      angle: -0.22,
                      child: Container(
                        width: 28,
                        height: widget.height * 2,
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: [
                              Colors.transparent,
                              Colors.white.withOpacity(0.32),
                              Colors.transparent,
                            ],
                          ),
                        ),
                      ),
                    ),
                  );
                },
              ),

              // Content switcher: Spinner (water drop) vs Success Check vs Idle text
              Center(
                child: AnimatedSwitcher(
                  duration: const Duration(milliseconds: 300),
                  child: widget.isLoading
                      ? SizedBox(
                          key: const ValueKey('spinner'),
                          width: 18,
                          height: 18,
                          child: const CircularProgressIndicator(
                            strokeWidth: 2.2,
                            valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                          ),
                        )
                      : _showSuccessCheck
                          ? Row(
                              key: const ValueKey('success'),
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Container(
                                  width: 20,
                                  height: 20,
                                  decoration: const BoxDecoration(
                                    shape: BoxShape.circle,
                                    color: Color(0xFF10B981),
                                  ),
                                  child: const Icon(
                                    Icons.check_rounded,
                                    size: 13,
                                    color: Colors.white,
                                  ),
                                ),
                                const SizedBox(width: 6),
                                Text(
                                  widget.isFollowing ? 'Đã quan tâm' : 'Đã bỏ quan tâm',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 13,
                                    fontWeight: FontWeight.w800,
                                    letterSpacing: -0.2,
                                  ),
                                ),
                              ],
                            )
                          : Row(
                              key: ValueKey(widget.isFollowing ? 'following' : 'idle'),
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(
                                  widget.isFollowing
                                      ? Icons.check_rounded
                                      : Icons.add_rounded,
                                  size: 15,
                                  color: Colors.white,
                                ),
                                const SizedBox(width: 5),
                                Text(
                                  widget.isFollowing
                                      ? widget.followingText
                                      : widget.followText,
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 13.5,
                                    fontWeight: FontWeight.w800,
                                    letterSpacing: -0.2,
                                  ),
                                ),
                              ],
                            ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
