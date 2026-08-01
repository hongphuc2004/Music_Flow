import { useState, useCallback } from 'react';
import { parseLyrics, findActiveLyricIndex } from '../../utils/lyrics.js';
import { clientSongsApi } from '../../services/client/client.service.js';

/**
 * useLyrics — lyrics loading and active-line tracking hook.
 *
 * @param {React.RefObject<HTMLAudioElement>} audioRef
 * @param {number} currentTime — current playback time (from state)
 */
export function useLyrics(audioRef, currentTime) {
  const [lyricsData, setLyricsData] = useState({
    isSynced: false,
    lines: [],
    plainText: '',
  });

  /**
   * Load and parse lyrics for a song.
   * Resets to empty on missing id or API error.
   */
  const loadLyrics = useCallback(async (songId) => {
    if (!songId) {
      setLyricsData({ isSynced: false, lines: [], plainText: '' });
      return;
    }
    try {
      const response = await clientSongsApi.getLyrics(songId);
      const parsed = parseLyrics(response.data?.lyrics || '');
      setLyricsData(parsed);
    } catch {
      setLyricsData({ isSynced: false, lines: [], plainText: '' });
    }
  }, []);

  /**
   * Index of the lyric line that corresponds to the current playback time.
   * Returns -1 when lyrics are not synced (plain text only).
   */
  const activeLyricIndex = lyricsData.isSynced
    ? findActiveLyricIndex(lyricsData.lines, currentTime)
    : -1;

  return { lyricsData, loadLyrics, activeLyricIndex };
}
