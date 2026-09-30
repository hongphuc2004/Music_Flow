import 'dart:async';
import 'package:flutter/material.dart';
import 'package:speech_to_text/speech_to_text.dart';
import '../../core/services/voice_assistant_service.dart';
import '../../core/theme/app_theme.dart';

/// A sleek, dedicated bottom sheet for Speech-to-Text Voice Search.
/// Focuses purely on capturing search queries via voice with rich visual feedback.
class VoiceSearchSheet extends StatefulWidget {
  const VoiceSearchSheet({super.key});

  /// Opens the Voice Search sheet and returns the recognized query string or null if cancelled.
  static Future<String?> show(BuildContext context) async {
    return await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      barrierColor: Colors.black.withOpacity(0.65),
      builder: (context) => const VoiceSearchSheet(),
    );
  }

  @override
  State<VoiceSearchSheet> createState() => _VoiceSearchSheetState();
}

class _VoiceSearchSheetState extends State<VoiceSearchSheet>
    with SingleTickerProviderStateMixin {
  final VoiceAssistantService _voiceService = VoiceAssistantService();

  late AnimationController _pulseController;
  late Animation<double> _pulseAnimation;

  bool _isListening = false;
  String _liveTranscript = '';
  String? _friendlyErrorMessage;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..repeat(reverse: true);

    _pulseAnimation = Tween<double>(begin: 1.0, end: 1.25).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );

    // Wait for the modal transition to complete before starting speech capture
    Future.delayed(const Duration(milliseconds: 350), () {
      if (mounted) {
        _startListening();
      }
    });
  }

  @override
  void dispose() {
    _pulseController.dispose();
    _voiceService.stopListening();
    super.dispose();
  }

  Future<void> _startListening() async {
    if (!mounted) return;

    setState(() {
      _isListening = true;
      _friendlyErrorMessage = null;
      _liveTranscript = '';
    });

    final success = await _voiceService.startListening(
      listenMode: ListenMode.dictation,
      onResult: (partialText) {
        if (!mounted) return;
        setState(() {
          _liveTranscript = partialText;
          _friendlyErrorMessage = null;
        });
      },
      onComplete: (finalText) {
        if (!mounted) return;
        setState(() {
          _isListening = false;
          _liveTranscript = finalText;
        });
        _completeAndReturn(finalText);
      },
      onError: (errorMsg) {
        if (!mounted) return;
        setState(() {
          _isListening = false;
          _friendlyErrorMessage = errorMsg.isNotEmpty
              ? errorMsg
              : 'Chưa nghe rõ giọng nói. Bạn hãy bấm Micro thử lại nhé!';
        });
      },
    );

    if (!success && mounted) {
      setState(() {
        _isListening = false;
        _friendlyErrorMessage = 'Không thể bật Micro. Vui lòng cấp quyền truy cập Micro trên trình duyệt.';
      });
    }
  }

  void _completeAndReturn(String query) {
    final cleanQuery = query.trim();
    if (cleanQuery.isNotEmpty && mounted) {
      Future.delayed(const Duration(milliseconds: 300), () {
        if (mounted) {
          Navigator.of(context).pop(cleanQuery);
        }
      });
    }
  }

  void _manualSubmit() {
    if (_liveTranscript.trim().isNotEmpty) {
      _voiceService.stopListening();
      _completeAndReturn(_liveTranscript);
    } else {
      _startListening();
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final hasError = _friendlyErrorMessage != null && _friendlyErrorMessage!.isNotEmpty;

    return Container(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.md,
        AppSpacing.lg,
        AppSpacing.xl,
      ),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1B1B26) : Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.35),
            blurRadius: 30,
            spreadRadius: 5,
            offset: const Offset(0, -5),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Drag handle bar
            Center(
              child: Container(
                width: 44,
                height: 4,
                margin: const EdgeInsets.only(bottom: AppSpacing.md),
                decoration: BoxDecoration(
                  color: isDark ? Colors.white24 : Colors.black12,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),

            // Top Header: Title & Close Button
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: AppColors.primary.withOpacity(0.12),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(
                        Icons.mic_rounded,
                        color: AppColors.primary,
                        size: 20,
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Text(
                      'Tìm kiếm bằng giọng nói',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.bold,
                            color: isDark
                                ? AppColors.darkTextPrimary
                                : AppColors.lightTextPrimary,
                          ),
                    ),
                  ],
                ),
                IconButton(
                  icon: const Icon(Icons.close_rounded),
                  color: isDark ? Colors.white70 : Colors.black54,
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ],
            ),

            const SizedBox(height: AppSpacing.lg),

            // Animated Mic Button with Ripple Effect
            Center(
              child: GestureDetector(
                onTap: _isListening
                    ? () {
                        _voiceService.stopListening();
                        setState(() => _isListening = false);
                        if (_liveTranscript.trim().isNotEmpty) {
                          _completeAndReturn(_liveTranscript);
                        }
                      }
                    : _startListening,
                child: AnimatedBuilder(
                  animation: _pulseAnimation,
                  builder: (context, child) {
                    final scale = _isListening ? _pulseAnimation.value : 1.0;
                    return Stack(
                      alignment: Alignment.center,
                      children: [
                        // Outer glowing ripple
                        if (_isListening)
                          Container(
                            width: 104 * scale,
                            height: 104 * scale,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: AppColors.primary.withOpacity(0.18),
                            ),
                          ),
                        // Inner circle button
                        Container(
                          width: 84,
                          height: 84,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            gradient: LinearGradient(
                              colors: _isListening
                                  ? [AppColors.primary, AppColors.secondary]
                                  : (hasError
                                      ? [
                                          const Color(0xFFE57373),
                                          const Color(0xFFEF5350),
                                        ]
                                      : [
                                          isDark
                                              ? const Color(0xFF33334D)
                                              : const Color(0xFFE2E4EB),
                                          isDark
                                              ? const Color(0xFF252538)
                                              : const Color(0xFFCFD2DC),
                                        ]),
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            ),
                            boxShadow: [
                              BoxShadow(
                                color: _isListening
                                    ? AppColors.primary.withOpacity(0.45)
                                    : (hasError
                                        ? Colors.redAccent.withOpacity(0.25)
                                        : Colors.black.withOpacity(0.12)),
                                blurRadius: _isListening ? 22 : 10,
                                spreadRadius: _isListening ? 3 : 0,
                              ),
                            ],
                          ),
                          child: Icon(
                            _isListening
                                ? Icons.mic_rounded
                                : (hasError ? Icons.mic_off_rounded : Icons.mic_rounded),
                            size: 38,
                            color: Colors.white,
                          ),
                        ),
                      ],
                    );
                  },
                ),
              ),
            ),

            const SizedBox(height: AppSpacing.md),

            // Status Badge / Text
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
              decoration: BoxDecoration(
                color: _isListening
                    ? AppColors.primary.withOpacity(0.12)
                    : (hasError ? Colors.amber.withOpacity(0.12) : Colors.transparent),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                _isListening
                    ? 'Đang lắng nghe...'
                    : (hasError ? 'Chưa nghe rõ' : 'Nhấn vào Micro để nói'),
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: _isListening
                      ? AppColors.primary
                      : (hasError
                          ? Colors.amber.shade400
                          : (isDark ? Colors.white60 : Colors.black54)),
                ),
              ),
            ),

            const SizedBox(height: AppSpacing.sm),

            // Live Transcript or Friendly Guidance
            Container(
              constraints: const BoxConstraints(minHeight: 56),
              alignment: Alignment.center,
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
              child: hasError
                  ? Text(
                      _friendlyErrorMessage!,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 13,
                        color: isDark ? Colors.white70 : Colors.black54,
                        height: 1.4,
                      ),
                    )
                  : Text(
                      _liveTranscript.isNotEmpty
                          ? '"$_liveTranscript"'
                          : 'Hãy nói tên bài hát, nghệ sĩ hoặc giai điệu bạn muốn tìm...',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: _liveTranscript.isNotEmpty ? 17 : 14,
                        fontWeight: _liveTranscript.isNotEmpty
                            ? FontWeight.bold
                            : FontWeight.normal,
                        color: _liveTranscript.isNotEmpty
                            ? (isDark ? Colors.white : AppColors.lightTextPrimary)
                            : (isDark ? Colors.white38 : Colors.black38),
                        fontStyle: _liveTranscript.isEmpty
                            ? FontStyle.italic
                            : FontStyle.normal,
                      ),
                    ),
            ),

            const SizedBox(height: AppSpacing.md),

            // Action row: manual submit or retry button
            if (hasError) ...[
              ElevatedButton.icon(
                onPressed: _startListening,
                icon: const Icon(Icons.refresh_rounded, size: 18),
                label: const Text('Thử lại'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(24),
                  ),
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.xl,
                    vertical: AppSpacing.sm,
                  ),
                ),
              ),
            ] else if (_liveTranscript.trim().isNotEmpty) ...[
              TextButton.icon(
                onPressed: _manualSubmit,
                icon: const Icon(Icons.search_rounded, size: 18),
                label: const Text('Tìm kiếm ngay'),
                style: TextButton.styleFrom(
                  foregroundColor: AppColors.primary,
                  textStyle: const TextStyle(fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
