import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import '../../core/config/api_config.dart';
import '../../core/services/voice_assistant_service.dart';
import '../../core/theme/app_theme.dart';
import '../../data/models/song_model.dart';
import '../../data/services/auth_service.dart';

enum VoiceState { idle, listening, processing, responding, error }

class VoiceAiDjSheet extends StatefulWidget {
  final Function(List<dynamic>? actions, List<Song> songs)? onExecuteActions;
  final String? conversationId;

  const VoiceAiDjSheet({
    super.key,
    this.onExecuteActions,
    this.conversationId,
  });

  static Future<void> show(
    BuildContext context, {
    Function(List<dynamic>? actions, List<Song> songs)? onExecuteActions,
    String? conversationId,
  }) async {
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => VoiceAiDjSheet(
        onExecuteActions: onExecuteActions,
        conversationId: conversationId,
      ),
    );
  }

  @override
  State<VoiceAiDjSheet> createState() => _VoiceAiDjSheetState();
}

class _VoiceAiDjSheetState extends State<VoiceAiDjSheet>
    with SingleTickerProviderStateMixin {
  final VoiceAssistantService _voiceService = VoiceAssistantService();

  VoiceState _state = VoiceState.idle;
  String _liveTranscript = '';
  String _assistantReply = '';
  String _errorMessage = '';
  List<Song> _actionSongs = [];
  bool _isSubmitting = false;

  late AnimationController _pulseController;
  late Animation<double> _pulseAnimation;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat(reverse: true);

    _pulseAnimation = Tween<double>(begin: 1.0, end: 1.25).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );

    // Auto-start listening on modal open
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _startVoiceSession();
    });
  }

  @override
  void dispose() {
    _pulseController.dispose();
    _voiceService.cancelListening();
    super.dispose();
  }

  Future<void> _startVoiceSession() async {
    if (!mounted || _isSubmitting) return;
    setState(() {
      _state = VoiceState.listening;
      _liveTranscript = '';
      _assistantReply = '';
      _errorMessage = '';
      _actionSongs = [];
    });

    final success = await _voiceService.startListening(
      onResult: (partialText) {
        if (!mounted || _isSubmitting) return;
        setState(() {
          _liveTranscript = partialText;
        });
      },
      onComplete: (finalText) {
        if (!mounted || _isSubmitting) return;
        _sendTranscriptToAssistant(finalText);
      },
      onError: (errorMsg) {
        if (!mounted || _isSubmitting) return;
        setState(() {
          _state = VoiceState.error;
          _errorMessage = errorMsg;
        });
      },
    );

    if (!success && mounted && _state != VoiceState.error) {
      setState(() {
        _state = VoiceState.error;
        _errorMessage = 'Không thể bật Micro. Bạn vui lòng kiểm tra quyền ứng dụng.';
      });
    }
  }

  Future<void> _stopAndSubmit() async {
    if (_isSubmitting) return;
    await _voiceService.stopListening();
    if (_liveTranscript.trim().length >= 2) {
      _sendTranscriptToAssistant(_liveTranscript.trim());
    } else if (mounted) {
      setState(() {
        _state = VoiceState.error;
        _errorMessage = 'Chưa nghe rõ câu nói. Bạn hãy bấm Micro thử lại nhé!';
      });
    }
  }

  Future<void> _sendTranscriptToAssistant(String prompt) async {
    final cleanPrompt = prompt.trim();
    if (cleanPrompt.length < 2 || _isSubmitting || !mounted) return;

    _isSubmitting = true;
    _voiceService.stopListening();

    setState(() {
      _state = VoiceState.processing;
      _liveTranscript = cleanPrompt;
    });

    final token = await AuthService.getToken();

    if (token == null || token.isEmpty) {
      if (!mounted) return;
      setState(() {
        _state = VoiceState.error;
        _errorMessage = 'Vui lòng đăng nhập để dùng trợ lý giọng nói AI.';
        _isSubmitting = false;
      });
      return;
    }

    try {
      final response = await http.post(
        Uri.parse(ApiConfig.assistantMessagesEndpoint),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: json.encode({
          'prompt': cleanPrompt,
          if (widget.conversationId != null) 'conversationId': widget.conversationId,
        }),
      );

      final data = json.decode(response.body);

      if (response.statusCode == 200 && data['success'] == true) {
        final responseData = data['data'] as Map? ?? {};
        final assistantText = responseData['assistantMessage']?.toString() ??
            (responseData['messages'] is List && (responseData['messages'] as List).isNotEmpty
                ? (responseData['messages'] as List).last['content']?.toString() ?? ''
                : '');

        final responseSongs = (responseData['songs'] as List? ?? [])
            .whereType<Map>()
            .map((item) => Song.fromJson(Map<String, dynamic>.from(item)))
            .toList();

        final actions = responseData['clientActions'] as List?;

        if (!mounted) return;
        setState(() {
          _state = VoiceState.responding;
          _assistantReply = assistantText.isNotEmpty
              ? assistantText
              : 'Đã nhận lệnh thành công!';
          _actionSongs = responseSongs;
        });

        // Trigger action callbacks (PLAY_SONG, LOAD_PLAYLIST)
        if (widget.onExecuteActions != null) {
          widget.onExecuteActions!(actions, responseSongs);
        }
      } else {
        if (!mounted) return;
        setState(() {
          _state = VoiceState.error;
          _errorMessage = data['message'] ?? 'Rất tiếc, AI chưa thể xử lý yêu cầu lúc này.';
        });
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _state = VoiceState.error;
        _errorMessage = 'Lỗi kết nối mạng. Vui lòng thử lại sau.';
      });
    } finally {
      if (mounted) {
        setState(() => _isSubmitting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
      decoration: BoxDecoration(
        color: AppColors.darkSurface.withValues(alpha: 0.95),
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
        border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
      ),
      child: SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Top Drag Handle Indicator
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.white30,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 20),

            // Header Title
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Row(
                  children: [
                    Icon(Icons.graphic_eq, color: AppColors.secondary, size: 24),
                    SizedBox(width: 8),
                    Text(
                      'MusicFlow Voice AI DJ',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
                IconButton(
                  icon: const Icon(Icons.close, color: Colors.white70),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
            const SizedBox(height: 24),

            // Main Content Area based on State
            _buildStateContent(),

            const SizedBox(height: 28),

            // Bottom Action Controls
            _buildActionControls(),
          ],
        ),
      ),
    );
  }

  Widget _buildStateContent() {
    switch (_state) {
      case VoiceState.listening:
        return Column(
          children: [
            ScaleTransition(
              scale: _pulseAnimation,
              child: Container(
                width: 84,
                height: 84,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: const LinearGradient(
                    colors: [
                      AppColors.primary,
                      AppColors.secondary,
                    ],
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.secondary.withValues(alpha: 0.4),
                      blurRadius: 20,
                      spreadRadius: 4,
                    ),
                  ],
                ),
                child: const Icon(Icons.mic, color: Colors.white, size: 40),
              ),
            ),
            const SizedBox(height: 20),
            const Text(
              'Đang lắng nghe giọng nói của bạn...',
              style: TextStyle(color: Colors.white70, fontSize: 14),
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.05),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.white10),
              ),
              child: Text(
                _liveTranscript.isNotEmpty
                    ? '"$_liveTranscript"'
                    : 'Hãy nói: "Bật nhạc chill", "Phát bài Sơn Tùng"...',
                style: TextStyle(
                  color: _liveTranscript.isNotEmpty ? Colors.white : Colors.white38,
                  fontSize: 15,
                  fontStyle: FontStyle.italic,
                ),
                textAlign: TextAlign.center,
              ),
            ),
          ],
        );

      case VoiceState.processing:
        return Column(
          children: [
            const CircularProgressIndicator(color: AppColors.primary),
            const SizedBox(height: 20),
            Text(
              'AI đang xử lý yêu cầu: "${_liveTranscript.trim()}"',
              style: const TextStyle(color: Colors.white, fontSize: 14),
              textAlign: TextAlign.center,
            ),
          ],
        );

      case VoiceState.responding:
        return Column(
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.primary.withValues(alpha: 0.3)),
              ),
              child: Column(
                children: [
                  const Row(
                    children: [
                      Icon(Icons.auto_awesome, color: AppColors.secondary, size: 20),
                      SizedBox(width: 8),
                      Text(
                        'Phản hồi từ AI DJ:',
                        style: TextStyle(
                          color: AppColors.secondary,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    _assistantReply,
                    style: const TextStyle(color: Colors.white, fontSize: 15, height: 1.4),
                    textAlign: TextAlign.left,
                  ),
                ],
              ),
            ),
            if (_actionSongs.isNotEmpty) ...[
              const SizedBox(height: 12),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.music_note, color: Colors.greenAccent, size: 18),
                  const SizedBox(width: 6),
                  Text(
                    'Đang sẵn sàng phát ${_actionSongs.length} bài hát',
                    style: const TextStyle(color: Colors.greenAccent, fontSize: 13),
                  ),
                ],
              ),
            ],
          ],
        );

      case VoiceState.error:
        return Column(
          children: [
            const Icon(Icons.error_outline, color: AppColors.accentPink, size: 48),
            const SizedBox(height: 12),
            Text(
              _errorMessage.isNotEmpty
                  ? _errorMessage
                  : 'Đã xảy ra lỗi không xác định.',
              style: const TextStyle(color: Colors.white, fontSize: 14),
              textAlign: TextAlign.center,
            ),
          ],
        );

      case VoiceState.idle:
        return const SizedBox.shrink();
    }
  }

  Widget _buildActionControls() {
    if (_state == VoiceState.listening) {
      return Row(
        children: [
          Expanded(
            child: OutlinedButton.icon(
              onPressed: () {
                _voiceService.cancelListening();
                Navigator.pop(context);
              },
              icon: const Icon(Icons.close, color: Colors.white70),
              label: const Text('Hủy', style: TextStyle(color: Colors.white70)),
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: Colors.white24),
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: ElevatedButton.icon(
              onPressed: _stopAndSubmit,
              icon: const Icon(Icons.send, color: Colors.white),
              label: const Text('Gửi', style: TextStyle(color: Colors.white)),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
            ),
          ),
        ],
      );
    }

    if (_state == VoiceState.error) {
      return SizedBox(
        width: double.infinity,
        child: ElevatedButton.icon(
          onPressed: _startVoiceSession,
          icon: const Icon(Icons.refresh, color: Colors.white),
          label: const Text('Thử nói lại', style: TextStyle(color: Colors.white)),
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.primary,
            padding: const EdgeInsets.symmetric(vertical: 14),
          ),
        ),
      );
    }

    if (_state == VoiceState.responding) {
      return Row(
        children: [
          Expanded(
            child: OutlinedButton.icon(
              onPressed: _startVoiceSession,
              icon: const Icon(Icons.mic, color: AppColors.secondary),
              label: const Text('Nói câu khác', style: TextStyle(color: AppColors.secondary)),
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: AppColors.secondary),
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: ElevatedButton(
              onPressed: () => Navigator.pop(context),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
              child: const Text('Đóng', style: TextStyle(color: Colors.white)),
            ),
          ),
        ],
      );
    }

    return const SizedBox.shrink();
  }
}
