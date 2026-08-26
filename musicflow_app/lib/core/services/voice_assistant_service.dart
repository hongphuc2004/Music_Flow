import 'dart:async';
import 'package:speech_to_text/speech_recognition_result.dart';
import 'package:speech_to_text/speech_to_text.dart';

/// Singleton service managing speech-to-text initialization, listening lifecycle,
/// and transcript extraction for Voice AI DJ without business logic coupling.
class VoiceAssistantService {
  static final VoiceAssistantService _instance = VoiceAssistantService._internal();
  factory VoiceAssistantService() => _instance;
  VoiceAssistantService._internal();

  final SpeechToText _speechToText = SpeechToText();

  bool _isInitialized = false;
  bool _isListening = false;
  String _lastRecognizedWords = '';

  bool get isListening => _isListening;
  bool get isInitialized => _isInitialized;
  String get lastRecognizedWords => _lastRecognizedWords;

  /// Initialize speech recognition engine on device
  Future<bool> initialize({
    Function(String status)? onStatus,
    Function(String errorMsg)? onError,
  }) async {
    if (_isInitialized) return true;

    try {
      _isInitialized = await _speechToText.initialize(
        onStatus: (status) {
          _isListening = status == 'listening';
          onStatus?.call(status);
        },
        onError: (errorNotification) {
          _isListening = false;
          onError?.call(errorNotification.errorMsg);
        },
      );
      return _isInitialized;
    } catch (e) {
      _isInitialized = false;
      _isListening = false;
      onError?.call(e.toString());
      return false;
    }
  }

  /// Start active listening session
  Future<bool> startListening({
    required Function(String partialText) onResult,
    required Function(String finalText) onComplete,
    Function(String errorMsg)? onError,
    String localeId = 'vi_VN',
  }) async {
    if (_isListening) return false;

    if (!_isInitialized) {
      final ok = await initialize(onError: onError);
      if (!ok) {
        onError?.call('Microphone hoặc dịch vụ nhận diện giọng nói chưa sẵn sàng.');
        return false;
      }
    }

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
              onError?.call('Chưa nghe rõ giọng nói, vui lòng thử lại.');
            }
          }
        },
        localeId: localeId,
        cancelOnError: true,
        partialResults: true,
        listenMode: ListenMode.confirmation,
      );
      return true;
    } catch (e) {
      _isListening = false;
      onError?.call('Lỗi bắt đầu lắng nghe: ${e.toString()}');
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
}
