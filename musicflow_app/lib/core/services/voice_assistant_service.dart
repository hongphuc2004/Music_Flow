import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:speech_to_text/speech_recognition_result.dart';
import 'package:speech_to_text/speech_to_text.dart';

/// Singleton service managing speech-to-text initialization, listening lifecycle,
/// and transcript extraction for Voice AI DJ and Voice Search.
class VoiceAssistantService {
  static final VoiceAssistantService _instance = VoiceAssistantService._internal();
  factory VoiceAssistantService() => _instance;
  VoiceAssistantService._internal();

  final SpeechToText _speechToText = SpeechToText();

  bool _isInitialized = false;
  bool _isListening = false;
  String _lastRecognizedWords = '';

  // Active session delegates to prevent stale closure issues in singleton
  Function(String status)? _currentOnStatus;
  Function(String errorMsg)? _currentOnError;

  bool get isListening => _isListening;
  bool get isInitialized => _isInitialized;
  String get lastRecognizedWords => _lastRecognizedWords;

  /// Initialize speech recognition engine on device
  Future<bool> initialize({
    Function(String status)? onStatus,
    Function(String errorMsg)? onError,
  }) async {
    _currentOnStatus = onStatus;
    _currentOnError = onError;

    if (_isInitialized) return true;

    try {
      _isInitialized = await _speechToText.initialize(
        onStatus: (status) {
          _isListening = status == 'listening';
          _currentOnStatus?.call(status);
        },
        onError: (errorNotification) {
          _isListening = false;
          final friendly = normalizeError(errorNotification.errorMsg);
          if (friendly.isNotEmpty) {
            _currentOnError?.call(friendly);
          }
        },
      );
      return _isInitialized;
    } catch (e) {
      _isInitialized = false;
      _isListening = false;
      onError?.call(normalizeError(e.toString()));
      return false;
    }
  }

  String? _resolvedVietnameseLocale;

  /// Detects the exact Vietnamese locale supported by the platform (e.g. vi-VN for Web/Chrome, vi_VN for Android)
  Future<String> getVietnameseLocale() async {
    if (_resolvedVietnameseLocale != null) return _resolvedVietnameseLocale!;

    try {
      final locales = await _speechToText.locales();
      for (final loc in locales) {
        final id = loc.localeId.toLowerCase();
        if (id == 'vi-vn' || id == 'vi_vn' || id.startsWith('vi')) {
          _resolvedVietnameseLocale = loc.localeId;
          debugPrint('[VoiceAssistantService] Found supported Vietnamese locale: $_resolvedVietnameseLocale');
          return _resolvedVietnameseLocale!;
        }
      }
    } catch (e) {
      debugPrint('[VoiceAssistantService] Error querying supported STT locales: $e');
    }

    _resolvedVietnameseLocale = kIsWeb ? 'vi-VN' : 'vi_VN';
    return _resolvedVietnameseLocale!;
  }

  /// Start active listening session
  Future<bool> startListening({
    required Function(String partialText) onResult,
    required Function(String finalText) onComplete,
    Function(String errorMsg)? onError,
    Function(String status)? onStatus,
    String localeId = 'vi_VN',
    ListenMode listenMode = ListenMode.dictation,
  }) async {
    _currentOnError = onError;
    _currentOnStatus = onStatus;

    if (_isListening) {
      await stopListening();
      await Future.delayed(const Duration(milliseconds: 150));
    }

    if (!_isInitialized) {
      final ok = await initialize(onError: onError, onStatus: onStatus);
      if (!ok) {
        onError?.call('Microphone hoặc dịch vụ nhận diện giọng nói chưa sẵn sàng.');
        return false;
      }
    }

    final targetLocale = (localeId == 'vi_VN' || localeId == 'vi-VN')
        ? await getVietnameseLocale()
        : localeId;

    _lastRecognizedWords = '';
    _isListening = true;

    try {
      await _speechToText.listen(
        onResult: (SpeechRecognitionResult result) {
          _lastRecognizedWords = result.recognizedWords;
          onResult(result.recognizedWords);

          if (result.finalResult) {
            _isListening = false;
            final finalWords = result.recognizedWords.trim();
            if (finalWords.length >= 2) {
              onComplete(finalWords);
            } else {
              onError?.call('Chưa nghe rõ giọng nói. Bạn hãy bấm Micro và thử nói lại nhé!');
            }
          }
        },
        localeId: targetLocale,
        cancelOnError: false,
        partialResults: true,
        listenMode: listenMode,
        pauseFor: const Duration(seconds: 4),
        listenFor: const Duration(seconds: 30),
      );
      return true;
    } catch (e) {
      _isListening = false;
      onError?.call(normalizeError(e.toString()));
      return false;
    }
  }

  /// Stop listening gracefully
  Future<void> stopListening() async {
    if (!_isListening) return;
    _isListening = false;
    try {
      await _speechToText.stop();
    } catch (_) {}
  }

  /// Cancel listening session
  Future<void> cancelListening() async {
    _isListening = false;
    try {
      await _speechToText.cancel();
    } catch (_) {}
  }

  /// Translates raw technical speech engine error codes into warm, human-friendly Vietnamese
  static String normalizeError(String rawError) {
    if (rawError.isEmpty) return '';
    final err = rawError.toLowerCase();

    if (err.contains('no-speech') ||
        err.contains('error_no_match') ||
        err.contains('error_speech_timeout')) {
      return 'Chưa nghe rõ giọng nói. Bạn hãy bấm Micro và thử nói lại nhé!';
    }
    if (err.contains('not-allowed') || err.contains('permission')) {
      return 'Trình duyệt chưa được cấp quyền Microphone. Vui lòng cho phép Micro trên thanh địa chỉ.';
    }
    if (err.contains('audio-capture')) {
      return 'Không tìm thấy thiết bị Microphone. Vui lòng kiểm tra lại mic máy tính.';
    }
    if (err.contains('network')) {
      return 'Lỗi kết nối mạng khi nhận diện giọng nói. Vui lòng kiểm tra đường truyền.';
    }
    if (err.contains('aborted')) {
      return '';
    }

    return 'Chưa nghe rõ câu nói. Bạn hãy bấm Micro thử lại nhé!';
  }
}
