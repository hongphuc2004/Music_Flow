export function parseLyrics(rawLyrics) {
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

        syncedLines.push({
          time,
          text: lyricText || '...',
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
    lines: fallbackLines.map((text, index) => ({ time: index, text })),
    plainText: fallbackLines.join('\n'),
  };
}

export function findActiveLyricIndex(lines, currentTime) {
  if (!Array.isArray(lines) || !lines.length) return -1;

  const time = Number(currentTime) || 0;
  let activeIndex = -1;

  for (let index = 0; index < lines.length; index += 1) {
    if ((lines[index]?.time || 0) <= time) {
      activeIndex = index;
    } else {
      break;
    }
  }

  return activeIndex;
}
