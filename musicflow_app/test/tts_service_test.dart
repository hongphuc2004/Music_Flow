import 'package:flutter_test/flutter_test.dart';
import 'package:musicflow_app/core/services/tts_service.dart';

void main() {
  group('TtsService.sanitizeForSpeech', () {
    test('removes markdown formatting like bold, italic, headers, bullet points', () {
      const input = '### Chào bạn!\n* Mình đã chọn **5 bài Lofi** cực êm cho bạn.\n- Hãy cùng thưởng thức nhé!';
      final result = TtsService.sanitizeForSpeech(input);
      expect(result, contains('Chào bạn!'));
      expect(result, contains('Mình đã chọn 5 bài Lofi cực êm cho bạn.'));
      expect(result, contains('Hãy cùng thưởng thức nhé!'));
      expect(result.contains('*'), isFalse);
      expect(result.contains('#'), isFalse);
      expect(result.contains('-'), isFalse);
    });

    test('removes emojis cleanly without altering Vietnamese accents', () {
      const input = 'Đã tìm thấy bài hát của Sơn Tùng M-TP 🎵🎧! Cùng chill nhé ❤️☕';
      final result = TtsService.sanitizeForSpeech(input);
      expect(result, equals('Đã tìm thấy bài hát của Sơn Tùng M-TP ! Cùng chill nhé'));
    });

    test('removes URLs and code blocks', () {
      const input = 'Bạn có thể xem tại https://musicflow.vn ```code``` hoặc `inline`. Chúc bạn nghe nhạc vui vẻ!';
      final result = TtsService.sanitizeForSpeech(input);
      expect(result.contains('https'), isFalse);
      expect(result.contains('code'), isFalse);
      expect(result, equals('Bạn có thể xem tại hoặc . Chúc bạn nghe nhạc vui vẻ!'));
    });
  });
}
