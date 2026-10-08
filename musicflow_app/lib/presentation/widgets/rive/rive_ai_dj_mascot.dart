import 'dart:math' as math;
import 'package:flutter/foundation.dart' hide Factory;
import 'package:flutter/material.dart';
import 'package:rive/rive.dart' hide Animation, PaintingStyle;
import '../../../core/theme/app_theme.dart';

/// Interactive AI DJ Companion Mascot widget powered by Rive.
class RiveAiDjMascot extends StatefulWidget {
  final double size;
  final bool isThinking;
  final bool isListening;
  final VoidCallback? onTap;
  final String? networkUrl;
  final String assetPath;

  const RiveAiDjMascot({
    super.key,
    this.size = 120,
    this.isThinking = false,
    this.isListening = false,
    this.onTap,
    this.networkUrl,
    this.assetPath = 'assets/animations/little_machine.riv',
  });

  @override
  State<RiveAiDjMascot> createState() => _RiveAiDjMascotState();
}

class _RiveAiDjMascotState extends State<RiveAiDjMascot>
    with SingleTickerProviderStateMixin {
  FileLoader? _fileLoader;
  RiveWidgetController? _controller;
  BooleanInput? _isThinkingInput;
  BooleanInput? _isListeningInput;
  TriggerInput? _tapTrigger;
  bool _isRiveAvailable = false;
  late final AnimationController _pulseController;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2000),
    )..repeat();

    _initRive();
  }

  void _initRive() {
    if (kIsWeb) {
      _fileLoader = null;
      return;
    }
    try {
      if (widget.networkUrl != null && widget.networkUrl!.isNotEmpty) {
        _fileLoader = FileLoader.fromUrl(
          widget.networkUrl!,
          riveFactory: Factory.flutter,
        );
      } else {
        _fileLoader = FileLoader.fromAsset(
          widget.assetPath,
          riveFactory: Factory.flutter,
        );
      }
    } catch (_) {
      _fileLoader = null;
    }
  }

  @override
  void didUpdateWidget(covariant RiveAiDjMascot oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.isThinking != oldWidget.isThinking) {
      _isThinkingInput?.value = widget.isThinking;
    }
    if (widget.isListening != oldWidget.isListening) {
      _isListeningInput?.value = widget.isListening;
    }
  }

  @override
  void dispose() {
    _tapTrigger?.dispose();
    _isThinkingInput?.dispose();
    _isListeningInput?.dispose();
    _controller?.dispose();
    _fileLoader?.dispose();
    _pulseController.dispose();
    super.dispose();
  }

  void _onRiveLoaded(RiveLoaded state) {
    _controller = state.controller;
    try {
      _isThinkingInput = _controller?.stateMachine.boolean('thinking') ??
          _controller?.stateMachine.boolean('busy');
      _isListeningInput = _controller?.stateMachine.boolean('listening');
      _tapTrigger = _controller?.stateMachine.trigger('tap') ??
          _controller?.stateMachine.trigger('poke') ??
          _controller?.stateMachine.trigger('trigger');

      _isThinkingInput?.value = widget.isThinking;
      _isListeningInput?.value = widget.isListening;

      if (mounted) {
        setState(() {
          _isRiveAvailable = true;
        });
      }
    } catch (_) {}
  }

  void _handleTap() {
    _tapTrigger?.fire();
    widget.onTap?.call();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: _handleTap,
      child: SizedBox(
        width: widget.size,
        height: widget.size,
        child: Stack(
          alignment: Alignment.center,
          children: [
            // Ambient glow ring
            AnimatedBuilder(
              animation: _pulseController,
              builder: (context, _) {
                final scale = 0.85 + 0.15 * math.sin(_pulseController.value * 2 * math.pi);
                final opacity = widget.isThinking || widget.isListening ? 0.35 : 0.18;
                return Transform.scale(
                  scale: scale,
                  child: Container(
                    width: widget.size * 0.8,
                    height: widget.size * 0.8,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: (widget.isThinking
                                  ? AppColors.accentPink
                                  : AppColors.secondary)
                              .withOpacity(opacity),
                          blurRadius: 28,
                          spreadRadius: 6,
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),

            // Rive Animation or Futuristic Mascot Hologram
            if (_fileLoader != null && _isRiveAvailable)
              RiveWidgetBuilder(
                fileLoader: _fileLoader!,
                onLoaded: _onRiveLoaded,
                onFailed: (_, __) {
                  if (mounted) setState(() => _isRiveAvailable = false);
                },
                builder: (context, state) => switch (state) {
                  RiveLoaded() => RiveWidget(
                      controller: state.controller,
                      fit: Fit.contain,
                    ),
                  _ => _buildHoloFallback(),
                },
              )
            else
              _buildHoloFallback(),
          ],
        ),
      ),
    );
  }

  Widget _buildHoloFallback() {
    return Container(
      width: widget.size * 0.82,
      height: widget.size * 0.82,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: const RadialGradient(
          colors: [
            Color(0xFF2E1A47),
            Color(0xFF140D26),
          ],
        ),
        border: Border.all(
          color: widget.isThinking
              ? AppColors.accentPink
              : AppColors.secondary.withOpacity(0.6),
          width: 2.0,
        ),
        boxShadow: AppShadows.neonGlow(
          widget.isThinking ? AppColors.accentPink : AppColors.primary,
        ),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            widget.isListening
                ? Icons.graphic_eq_rounded
                : widget.isThinking
                    ? Icons.auto_awesome_rounded
                    : Icons.smart_toy_rounded,
            size: widget.size * 0.36,
            color: widget.isThinking ? AppColors.accentPink : AppColors.secondary,
          ),
          const SizedBox(height: 2),
          Text(
            widget.isThinking
                ? 'ĐANG NGHĨ...'
                : widget.isListening
                    ? 'ĐANG NGHE...'
                    : 'AI DJ',
            style: TextStyle(
              color: Colors.white70,
              fontSize: (widget.size * 0.08).clamp(9.0, 12.0),
              fontWeight: FontWeight.bold,
              letterSpacing: 1.2,
            ),
          ),
        ],
      ),
    );
  }
}
