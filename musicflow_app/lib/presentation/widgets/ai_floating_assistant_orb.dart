import 'dart:math' as math;
import 'package:flutter/material.dart';
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
              child: SizedBox(
                width: 60,
                height: 60,
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    // Outer Pulsing Glow
                    Container(
                      width: 58,
                      height: 58,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(
                            color: const Color(0xFF7C3AED).withOpacity(0.55 * glow),
                            blurRadius: 18,
                            spreadRadius: 3,
                          ),
                          BoxShadow(
                            color: const Color(0xFF00E5FF).withOpacity(0.4 * glow),
                            blurRadius: 12,
                            spreadRadius: 1,
                          ),
                        ],
                      ),
                    ),
                    // Rotating Orbital Ring
                    Transform.rotate(
                      angle: _rotationController.value * 2 * math.pi,
                      child: Container(
                        width: 58,
                        height: 58,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(
                            width: 1.5,
                            color: const Color(0xFF00E5FF).withOpacity(0.6 * glow),
                          ),
                        ),
                      ),
                    ),
                    // Main Avatar Icon Image
                    ClipOval(
                      child: Image.asset(
                        'assets/images/ai_dj_icon.png',
                        width: 52,
                        height: 52,
                        fit: BoxFit.cover,
                      ),
                    ),
                    // Small Green Online Status Dot
                    Positioned(
                      top: 2,
                      right: 2,
                      child: Container(
                        width: 12,
                        height: 12,
                        decoration: BoxDecoration(
                          color: const Color(0xFF10B981),
                          shape: BoxShape.circle,
                          border: Border.all(color: const Color(0xFF0F172A), width: 2),
                          boxShadow: const [
                            BoxShadow(
                              color: Color(0xFF10B981),
                              blurRadius: 6,
                              spreadRadius: 1,
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}

