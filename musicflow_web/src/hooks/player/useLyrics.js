import { useState, useCallback, useMemo } from 'react';
import { parseLyrics, findActiveLyricIndex, findActiveWordIndex } from '../../utils/lyrics.js';
import { clientSongsApi } from '../../services/client/client.service.js';

/**
 * useLyrics — lyrics loading, line-level and word-level active timing hook.
 *
 * @param {React.RefObject<HTMLAudioElement>} audioRef
 * @param {number} currentTime — current playback time in seconds (from audio player state)
 */
export function useLyrics(audioRef, currentTime) {
  const [lyricsData, setLyricsData] = useState({
    isSynced: false,
    lines: [],
    plainText: '',
  });

  /**
   * Load and parse published lyrics for a song.
   * Only receives published snapshot from clientSongsApi.getLyrics.
   */
  const loadLyrics = useCallback(async (songId) => {
    if (!songId) {
      setLyricsData({ isSynced: false, lines: [], plainText: '' });
      return;
    }
    try {
      const response = await clientSongsApi.getLyrics(songId);
      const resData = response.data || {};

      if (resData.isSynced && Array.isArray(resData.syncedLines) && resData.syncedLines.length > 0) {
        setLyricsData({
          isSynced: true,
          lines: resData.syncedLines.map((line, idx) => {
            const lineStart = Math.max(0, Number(line.startTime ?? line.time) || 0);
            const lineEnd = Math.max(lineStart, Number(line.endTime) || (lineStart + 3.0));

            return {
              id: line._id || idx,
              time: lineStart,
              startTime: lineStart,
              endTime: lineEnd,
              text: String(line.text || '').trim(),
              words: Array.isArray(line.words)
                ? line.words
                    .map((w) => {
                      const wStart = Math.max(0, Number(w.startTime) || 0);
                      const wEnd = Math.max(wStart, Number(w.endTime) || (wStart + 0.3));
                      return {
                        text: String(w.text || ''),
                        startTime: wStart,
                        endTime: wEnd,
                        rawStartTime: Number(w.rawStartTime) || wStart,
                        rawEndTime: Number(w.rawEndTime) || wEnd,
                        tailExtensionAppliedSec: Number(w.tailExtensionAppliedSec) || 0,
                      };
                    })
                    .filter((w) => Boolean(w.text))
                : [],
            };
          }),
          plainText: resData.lyrics || '',
        });
      } else if (resData.lyrics) {
        // Fallback parse plain text / legacy LRC
        const parsed = parseLyrics(resData.lyrics);
        setLyricsData(parsed);
      } else {
        setLyricsData({ isSynced: false, lines: [], plainText: '' });
      }
    } catch {
      setLyricsData({ isSynced: false, lines: [], plainText: '' });
    }
  }, []);

  /**
   * Index of active lyric line based on currentTime (audio.currentTime).
   */
  const activeLyricIndex = useMemo(() => {
    if (!lyricsData.isSynced || !lyricsData.lines.length) return -1;
    return findActiveLyricIndex(lyricsData.lines, currentTime);
  }, [lyricsData.isSynced, lyricsData.lines, currentTime]);

  /**
   * Index of active word inside active line for word-level karaoke timing.
   */
  const activeWordIndex = useMemo(() => {
    if (activeLyricIndex < 0) return -1;
    const activeLine = lyricsData.lines[activeLyricIndex];
    if (!activeLine || !Array.isArray(activeLine.words) || !activeLine.words.length) return -1;
    return findActiveWordIndex(activeLine.words, currentTime);
  }, [activeLyricIndex, lyricsData.lines, currentTime]);

  return { lyricsData, loadLyrics, activeLyricIndex, activeWordIndex };
}
