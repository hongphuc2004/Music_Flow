/**
 * lrc-parser.util.js — Robust LRC Synchronized Lyrics Parser & Validator
 * 
 * Supports:
 * - Standard timestamps: [mm:ss.xx] (e.g. [00:12.50]) and [mm:ss.xxx] (e.g. [01:02.500])
 * - Multi-timestamp per line: [00:10.50][00:15.00] Chorus line
 * - Metadata tags filtering: [ti:], [ar:], [al:], [by:], [offset:], [length:], etc.
 * - Graceful error handling (does not crash on malformed lines)
 * - Validation of audio duration bounds
 */

// Regex to capture timestamp tags like [00:12.50] or [01:02.500]
const TIMESTAMP_TAG_REGEX = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;

// Metadata header tags like [ti:Title], [ar:Artist], [al:Album], etc.
const METADATA_TAG_REGEX = /^\[(ti|ar|al|by|offset|length|re|ve):([^\]]*)\]$/i;

/**
 * Convert minutes, seconds, milliseconds to seconds (float)
 * @param {string} minStr 
 * @param {string} secStr 
 * @param {string} fracStr 
 * @returns {number} seconds
 */
function parseTimeToSeconds(minStr, secStr, fracStr = "0") {
  const mins = parseInt(minStr, 10) || 0;
  const secs = parseInt(secStr, 10) || 0;
  
  // Pad or trim fraction to 3 decimals (milliseconds)
  const paddedFrac = fracStr.padEnd(3, "0").slice(0, 3);
  const frac = parseInt(paddedFrac, 10) / 1000;

  return Number((mins * 60 + secs + frac).toFixed(3));
}

/**
 * Parse raw LRC string into structured syncedLines and plainText.
 * @param {string} rawLrc 
 * @param {number|null} audioDuration — Optional audio duration in seconds
 * @returns {{ isSynced: boolean, syncedLines: Array<{ startTime: number, text: string }>, plainText: string, warnings: string[], errors: string[] }}
 */
function parseLrc(rawLrc, audioDuration = null) {
  const raw = typeof rawLrc === "string" ? rawLrc : "";
  const lines = raw.split(/\r?\n/);

  const syncedLines = [];
  const plainLines = [];
  const warnings = [];
  const errors = [];

  lines.forEach((originalLine, lineIndex) => {
    const trimmedLine = originalLine.trim();
    if (!trimmedLine) return; // Skip blank lines

    // Check for metadata tag (e.g. [ar: Taylor Swift])
    if (METADATA_TAG_REGEX.test(trimmedLine)) {
      return; // Skip metadata tags gracefully
    }

    // Find all timestamp tags in the line
    const matches = [...trimmedLine.matchAll(TIMESTAMP_TAG_REGEX)];

    if (matches.length > 0) {
      // Remove all timestamp tags to extract the lyric text
      const lyricText = trimmedLine.replace(TIMESTAMP_TAG_REGEX, "").trim();

      matches.forEach((match) => {
        const startTime = parseTimeToSeconds(match[1], match[2], match[3]);

        if (startTime < 0) {
          errors.push(`Dòng ${lineIndex + 1}: Timestamp âm không hợp lệ (${match[0]}).`);
          return;
        }

        if (audioDuration && audioDuration > 0 && startTime > audioDuration) {
          warnings.push(
            `Dòng ${lineIndex + 1}: Thời gian (${match[0]}) vượt quá độ dài bài hát (${audioDuration.toFixed(1)}s).`
          );
        }

        syncedLines.push({
          startTime,
          text: lyricText || "...",
        });
      });

      if (lyricText) {
        plainLines.push(lyricText);
      }
    } else {
      // Line without timestamp
      // If line contains bracket like [Verse 1] or invalid format
      if (trimmedLine.startsWith("[") && trimmedLine.endsWith("]")) {
        // Structural marker (e.g. [Verse 1], [Chorus])
        plainLines.push(trimmedLine);
      } else if (trimmedLine.includes("[") && trimmedLine.includes("]")) {
        warnings.push(`Dòng ${lineIndex + 1}: Chứa thẻ không đúng định dạng timestamp chuẩn [mm:ss.xx]: "${trimmedLine}"`);
        plainLines.push(trimmedLine);
      } else {
        plainLines.push(trimmedLine);
      }
    }
  });

  // Sort synced lines chronologically
  syncedLines.sort((a, b) => a.startTime - b.startTime);

  const isSynced = syncedLines.length > 0;
  const plainText = isSynced
    ? syncedLines.map((l) => l.text).join("\n")
    : plainLines.join("\n");

  return {
    isSynced,
    syncedLines,
    plainText,
    warnings,
    errors,
  };
}

/**
 * Extract clean plain-text lyrics from raw LRC or mixed format
 * @param {string} rawLrc 
 * @returns {string} Clean plain text
 */
function lrcToPlainText(rawLrc) {
  if (!rawLrc || typeof rawLrc !== "string") return "";
  const parsed = parseLrc(rawLrc);
  return parsed.plainText || "";
}

/**
 * Format seconds back to standard LRC timestamp [mm:ss.xx]
 * @param {number} seconds 
 * @returns {string} "[01:23.45]"
 */
function formatSecondsToLrcTag(seconds) {
  const total = Math.max(0, Number(seconds) || 0);
  const mins = Math.floor(total / 60);
  const secs = Math.floor(total % 60);
  const frac = Math.floor((total % 1) * 100);

  const minStr = String(mins).padStart(2, "0");
  const secStr = String(secs).padStart(2, "0");
  const fracStr = String(frac).padStart(2, "0");

  return `[${minStr}:${secStr}.${fracStr}]`;
}

module.exports = {
  parseLrc,
  lrcToPlainText,
  formatSecondsToLrcTag,
};
