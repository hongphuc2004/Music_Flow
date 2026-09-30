import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter_tts/flutter_tts.dart';
import 'package:just_audio/just_audio.dart';
import '../config/api_config.dart';

/// Singleton service managing Text-To-Speech (TTS) engine, lifecycle,
/// and speech callbacks.
///
/// Primary: High-fidelity Google Vietnamese TTS audio streamed directly
/// from Backend (/api/ai/tts), ensuring consistent, 100% natural Vietnamese
/// pronunciation on all devices (Web Chrome, iOS, Android, Desktop) without
/// relying on OS-level English speech fallback.
///
/// Secondary: Local OS engine via flutter_tts as an offline fallback.
class TtsService {
  static final TtsService _instance = TtsService._internal();
  factory TtsService() => _instance;
  TtsService._internal();

  final FlutterTts _flutterTts = FlutterTts();
  final AudioPlayer _audioPlayer = AudioPlayer();
  StreamSubscription<PlayerState>? _playerSubscription;

  bool _isInitialized = false;
  bool _isSpeaking = false;
  bool _usingStreamingAudio = false;

  VoidCallback? onStart;
  VoidCallback? onCompletion;
  VoidCallback? onCancel;
  Function(String errorMsg)? onError;

  bool get isSpeaking => _isSpeaking;
  bool get isInitialized => _isInitialized;

  /// Initializes the TTS engine and configures local fallback voice
  Future<bool> initialize() async {
    if (_isInitialized) return true;

    try {
      _flutterTts.setStartHandler(() {
        if (!_usingStreamingAudio) {
          _isSpeaking = true;
          onStart?.call();
        }
      });

      _flutterTts.setCompletionHandler(() {
        if (!_usingStreamingAudio) {
          _isSpeaking = false;
          onCompletion?.call();
        }
      });

      _flutterTts.setCancelHandler(() {
        if (!_usingStreamingAudio) {
          _isSpeaking = false;
          onCancel?.call();
        }
      });

      _flutterTts.setErrorHandler((dynamic message) {
        if (!_usingStreamingAudio) {
          _isSpeaking = false;
          onError?.call(message?.toString() ?? 'Lỗi không xác định từ TTS');
        }
      });

      // Try setting Vietnamese language for local fallback
      final dynamic isLanguageAvailable =
          await _flutterTts.isLanguageAvailable("vi-VN");

      if (isLanguageAvailable == true || isLanguageAvailable == 1) {
        await _flutterTts.setLanguage("vi-VN");
      } else {
        await _flutterTts.setLanguage("vi");
      }

      final double naturalRate = kIsWeb ? 0.95 : 0.52;
      await _flutterTts.setSpeechRate(naturalRate);
      await _flutterTts.setPitch(1.0);
      await _flutterTts.setVolume(1.0);

      await _configureVietnameseVoice();

      _isInitialized = true;
      return true;
    } catch (e) {
      debugPrint('[TtsService] Initialization error: $e');
      _isInitialized = false;
      _isSpeaking = false;
      return false;
    }
  }

  bool _voiceConfigured = false;
  Map<String, String>? _selectedVoice;

  /// Scans available system voices to find and bind a natural Vietnamese voice for fallback
  Future<void> _configureVietnameseVoice() async {
    try {
      await _flutterTts.setLanguage("vi-VN");

      final dynamic voices = await _flutterTts.getVoices;
      if (voices is List && voices.isNotEmpty) {
        dynamic matchedVoice;

        dynamic naturalVoice;
        dynamic googleVoice;
        dynamic standardViVoice;

        for (final v in voices) {
          if (v is Map) {
            final locale = (v['locale'] ?? v['lang'] ?? '').toString().toLowerCase();
            final name = (v['name'] ?? '').toString().toLowerCase();

            final isViLocale = locale == 'vi-vn' || locale == 'vi_vn' || locale.startsWith('vi');
            final isViName = name.contains('vietnam') || name.contains('tiếng việt') || name.contains('vietnamese');

            if (isViLocale || isViName) {
              if (name.contains('natural') || name.contains('online') || name.contains('neural')) {
                naturalVoice ??= v;
              } else if (name.contains('google')) {
                googleVoice ??= v;
              } else {
                standardViVoice ??= v;
              }
            }
          }
        }

        matchedVoice = naturalVoice ?? googleVoice ?? standardViVoice;

        if (matchedVoice != null) {
          final voiceMap = <String, String>{
            'name': matchedVoice['name']?.toString() ?? '',
            'locale': matchedVoice['locale']?.toString() ?? matchedVoice['lang']?.toString() ?? 'vi-VN',
          };
          _selectedVoice = voiceMap;
          await _flutterTts.setVoice(voiceMap);
          await _flutterTts.setLanguage(voiceMap['locale']!);

          final double naturalRate = kIsWeb ? 0.95 : 0.52;
          await _flutterTts.setSpeechRate(naturalRate);

          _voiceConfigured = true;
          debugPrint('[TtsService] Local fallback voice configured: $voiceMap');
        }
      }
    } catch (e) {
      debugPrint('[TtsService] Voice configuration error: $e');
    }
  }

  /// Speaks the given text.
  /// First attempts Google Vietnamese TTS streaming from backend for natural pronunciation;
  /// falls back to local flutter_tts if offline or unreachable.
  Future<void> speak(String text) async {
    final cleanText = sanitizeForSpeech(text);
    if (cleanText.isEmpty) {
      onCompletion?.call();
      return;
    }

    if (!_isInitialized) {
      await initialize();
    }

    await stop();

    // 1. PRIMARY: High-quality Google Vietnamese TTS via Backend stream
    try {
      final ttsStreamUrl = ApiConfig.ttsUrl(cleanText);
      debugPrint('[TtsService] Speaking via Google Vietnamese TTS: "$cleanText"');

      _usingStreamingAudio = true;
      _isSpeaking = true;
      onStart?.call();

      _playerSubscription?.cancel();
      _playerSubscription = _audioPlayer.playerStateStream.listen((state) {
        if (state.processingState == ProcessingState.completed) {
          debugPrint('[TtsService] Streaming TTS playback completed.');
          _isSpeaking = false;
          _usingStreamingAudio = false;
          _playerSubscription?.cancel();
          _playerSubscription = null;
          onCompletion?.call();
        }
      });

      await _audioPlayer.setUrl(ttsStreamUrl);
      await _audioPlayer.play();
      return;
    } catch (e) {
      debugPrint('[TtsService] Streaming TTS error: $e. Switching to local fallback.');
      _playerSubscription?.cancel();
      _playerSubscription = null;
      _usingStreamingAudio = false;
    }

    // 2. FALLBACK: Local system TTS
    await _speakViaLocalFlutterTts(cleanText);
  }

  Future<void> _speakViaLocalFlutterTts(String cleanText) async {
    if (!_voiceConfigured) {
      await _configureVietnameseVoice();
    }

    try {
      _usingStreamingAudio = false;
      _isSpeaking = true;
      debugPrint('[TtsService] Fallback to local TTS: "$cleanText" (Voice: ${_selectedVoice?['name'] ?? 'default'})');
      await _flutterTts.speak(cleanText);
    } catch (e) {
      _isSpeaking = false;
      debugPrint('[TtsService] Local TTS speak error: $e');
      onError?.call(e.toString());
      onCompletion?.call();
    }
  }

  /// Stops current speech output immediately (both network audio and local engine)
  Future<void> stop() async {
    try {
      _isSpeaking = false;
      _playerSubscription?.cancel();
      _playerSubscription = null;
      await _audioPlayer.stop();
      await _flutterTts.stop();
      _usingStreamingAudio = false;
      onCancel?.call();
    } catch (e) {
      debugPrint('[TtsService] Stop error: $e');
    }
  }

  /// Pauses current speech output
  Future<void> pause() async {
    try {
      if (_usingStreamingAudio) {
        await _audioPlayer.pause();
      } else {
        await _flutterTts.pause();
      }
    } catch (e) {
      debugPrint('[TtsService] Pause error: $e');
    }
  }

  /// Cleans raw response text, removing markdown symbols, emojis, and code formatting
  /// to produce smooth, natural spoken audio.
  static String sanitizeForSpeech(String raw) {
    if (raw.isEmpty) return '';

    var text = raw;

    // 1. Remove URLs (http, https, www)
    text = text.replaceAll(RegExp(r'https?:\/\/\S+|www\.\S+'), '');

    // 2. Remove code blocks ```...``` and inline code `...`
    text = text.replaceAll(RegExp(r'```[\s\S]*?```'), '');
    text = text.replaceAll(RegExp(r'`[^`]*`'), '');

    // 3. Remove Markdown header syntax (###, ##, #)
    text = text.replaceAll(RegExp(r'^\s*#{1,6}\s*', multiLine: true), '');

    // 4. Remove Markdown bold, italic, strikethrough (**, *, __, _, ~~)
    text = text.replaceAllMapped(RegExp(r'\*\*([^*]+)\*\*'), (m) => m[1] ?? '');
    text = text.replaceAllMapped(RegExp(r'\*([^*]+)\*'), (m) => m[1] ?? '');
    text = text.replaceAllMapped(RegExp(r'__([^_]+)__'), (m) => m[1] ?? '');
    text = text.replaceAllMapped(RegExp(r'_([^_]+)_'), (m) => m[1] ?? '');
    text = text.replaceAllMapped(RegExp(r'~~([^~]+)~~'), (m) => m[1] ?? '');

    // 5. Remove list bullets (- , * , 1. )
    text = text.replaceAll(RegExp(r'^\s*[-*+]\s+', multiLine: true), '');
    text = text.replaceAll(RegExp(r'^\s*\d+\.\s+', multiLine: true), '');

    // 6. Remove common emojis, special unicode symbols, variation selectors, and ZWJ
    text = text.replaceAll(
      RegExp(
        r'[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{FE00}-\u{FE0F}\u{200D}]',
        unicode: true,
      ),
      '',
    );

    // 7. Collapse multiple spaces and trim
    text = text.replaceAll(RegExp(r'[ \t]+'), ' ');
    text = text.replaceAll(RegExp(r'\n{2,}'), '\n');

    return text.trim();
  }
}
