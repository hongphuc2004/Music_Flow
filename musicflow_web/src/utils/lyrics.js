export function parseLyrics(rawLyrics, structuredSyncedLines = []) {
  const raw = typeof rawLyrics === 'string' ? rawLyrics : '';
  const sourceLines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const syncedLines = [];
  const plainLines = [];

  sourceLines.forEach((line) => {
    const timeTags = [...line.matchAll(/\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g)];
    const lyricText = line.replace(/\[[^\]]+\]/g, '').trim();

    if (timeTags.length) {
      timeTags.forEach((tag) => {
        const mins = Number(tag[1]) || 0;
        const secs = Number(tag[2]) || 0;
        const fracRaw = tag[3] || '0';
        const frac = Number(fracRaw.padEnd(3, '0').slice(0, 3)) / 1000;
        const time = mins * 60 + secs + frac;

        // Check if we have matching structured line with word timestamps
        const matchedStruct = Array.isArray(structuredSyncedLines)
          ? structuredSyncedLines.find(
              (s) =>
                Math.abs((s.startTime || s.time || 0) - time) < 0.05 ||
                (s.text && s.text.trim() === lyricText)
            )
          : null;

        syncedLines.push({
          time,
          startTime: time,
          endTime: matchedStruct?.endTime || time + 3.0,
          text: lyricText || '...',
          words: Array.isArray(matchedStruct?.words) ? matchedStruct.words : [],
        });
      });
      return;
    }

    plainLines.push(line);
  });

  if (syncedLines.length) {
    syncedLines.sort((a, b) => a.time - b.time);
    const mergedPlain = syncedLines.map((line) => line.text).join('\n');

    return {
      isSynced: true,
      lines: syncedLines,
      plainText: mergedPlain,
    };
  }

  const fallbackLines = plainLines.length ? plainLines : (raw ? [raw] : []);

  return {
    isSynced: false,
    lines: fallbackLines.map((text, index) => ({ time: index, text, words: [] })),
    plainText: fallbackLines.join('\n'),
  };
}

export function findActiveLyricIndex(lines, currentTime) {
  if (!Array.isArray(lines) || !lines.length) return -1;

  const time = Number(currentTime) || 0;
  let activeIndex = -1;

  for (let index = 0; index < lines.length; index += 1) {
    if ((lines[index]?.time || lines[index]?.startTime || 0) <= time) {
      activeIndex = index;
    } else {
      break;
    }
  }

  return activeIndex;
}

export function findActiveWordIndex(words, currentTime) {
  if (!Array.isArray(words) || !words.length) return -1;
  const time = Number(currentTime) || 0;

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const wStart = Number(w.startTime) || 0;
    const wEnd = Number(w.endTime) || wStart + 0.3;
    if (time >= wStart && time <= wEnd) {
      return i;
    }
  }
  return -1;
}

