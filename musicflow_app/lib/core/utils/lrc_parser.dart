import 'package:musicflow_app/data/models/lrc_line_model.dart';

class LrcParser {
  static final RegExp _timestampRegExp = RegExp(
    r'\[(\d{1,2})\s*:\s*(\d{1,2})(?:[\.,](\d{1,3}))?\]',
  );

  static List<LrcLine> parse(String lrcContent) {
    if (lrcContent.trim().isEmpty) {
      return const [];
    }

    // Normalize line endings and handle literal "\\n" copied from some editors/APIs.
    var normalized = lrcContent
        .replaceAll('\r\n', '\n')
        .replaceAll('\r', '\n');
    if (!normalized.contains('\n') && normalized.contains(r'\n')) {
      normalized = normalized.replaceAll(r'\n', '\n');
    }

    final List<LrcLine> parsed = [];
    final lines = normalized.split('\n');

    for (final rawLine in lines) {
      final line = rawLine.trim();
      if (line.isEmpty) {
        continue;
      }

      final matches = _timestampRegExp.allMatches(line).toList();
      if (matches.isEmpty) {
        continue;
      }

      final text = line.replaceAll(_timestampRegExp, '').trim();

      for (final match in matches) {
        final minute = int.tryParse(match.group(1) ?? '0') ?? 0;
        final second = int.tryParse(match.group(2) ?? '0') ?? 0;
        final fractionRaw = match.group(3) ?? '0';
        final millisecond = _fractionToMilliseconds(fractionRaw);

        parsed.add(
          LrcLine(
            timestamp: Duration(
              minutes: minute,
              seconds: second,
              milliseconds: millisecond,
            ),
            text: text,
          ),
        );
      }
    }

    parsed.sort((a, b) => a.timestamp.compareTo(b.timestamp));
    return parsed;
  }

  static int _fractionToMilliseconds(String fraction) {
    if (fraction.length == 1) {
      return int.parse(fraction) * 100;
    }
    if (fraction.length == 2) {
      return int.parse(fraction) * 10;
    }
    return int.parse(fraction.substring(0, 3));
  }
}
