import { useRef, useCallback } from 'react';
import { clientSongsApi } from '../../services/client/client.service.js';

/**
 * useAutoplay — prefetch and append autoplay songs hook.
 *
 * When the queue runs out and autoplay is enabled, this hook fetches
 * similar songs and appends them to the queue so playback continues
 * seamlessly.
 *
 * @param {{
 *   audioRef: React.RefObject<HTMLAudioElement>,
 *   currentSongRef: React.RefObject<object|null>,
 *   queueRef: React.RefObject<object[]>,
 *   queueIndexRef: React.RefObject<number>,
 *   autoplayRef: React.RefObject<boolean>,
 *   normalizeSong: (song: object) => object | null,
 *   resetPlayTracking: (songId: string) => void,
 *   loadLyrics: (songId: string) => Promise<void>,
 *   saveRecentPlayedSong: (song: object) => void,
 *   setQueue: React.Dispatch,
 *   setQueueIndex: React.Dispatch,
 *   setCurrentSong: React.Dispatch,
 *   setCurrentTime: React.Dispatch,
 *   setIsPlaying: React.Dispatch,
 * }} deps
 */
export function useAutoplay({
  currentSongRef,
  queueRef,
  queueIndexRef,
  normalizeSong,
  resetPlayTracking,
  loadLyrics,
  saveRecentPlayedSong,
  setQueue,
  setQueueIndex,
  setCurrentSong,
  setCurrentTime,
  setIsPlaying,
}) {
  const isPrefetchingAutoplayRef = useRef(false);
  const prefetchedSongIdRef = useRef(null);
  const prefetchedSongsRef = useRef([]);
  const abortControllerRef = useRef(null);

  /**
   * Append a batch of autoplay-fetched songs to the queue and immediately
   * start playing the next one.
   */
  const appendAutoplaySongs = useCallback(
    (songsList, audioInstance) => {
      const activeQueue = [...queueRef.current];
      const activeIndex = queueIndexRef.current;

      const existingIds = new Set(activeQueue.map((s) => s._id));
      const newSongs = songsList.filter((s) => !existingIds.has(s._id));

      if (newSongs.length === 0) {
        setIsPlaying(false);
        return;
      }

      const updatedQueue = [...activeQueue, ...newSongs];
      const nextIndex = activeIndex + 1;
      const nextSong = normalizeSong(updatedQueue[nextIndex]);

      if (!nextSong?._id) {
        setIsPlaying(false);
        return;
      }

      setQueue(updatedQueue);
      setQueueIndex(nextIndex);
      queueRef.current = updatedQueue;
      queueIndexRef.current = nextIndex;

      currentSongRef.current = nextSong;
      resetPlayTracking(nextSong._id);

      if (audioInstance) {
        audioInstance.src = nextSong.streamUrl;
        audioInstance.currentTime = 0;
        setCurrentSong(nextSong);
        setCurrentTime(0);
        loadLyrics(nextSong._id);
        saveRecentPlayedSong(updatedQueue[nextIndex]);
        audioInstance.play().catch(() => setIsPlaying(false));
      }
    },
    [
      queueRef, queueIndexRef, normalizeSong, resetPlayTracking,
      loadLyrics, saveRecentPlayedSong, setQueue, setQueueIndex,
      setCurrentSong, setCurrentTime, setIsPlaying, currentSongRef,
    ]
  );

  /**
   * Prefetch similar songs in the background when the current song is 80%
   * through and it's the last song in the queue.
   */
  const prefetchAutoplaySongs = useCallback(
    async (songId) => {
      if (isPrefetchingAutoplayRef.current) return;
      isPrefetchingAutoplayRef.current = true;
      prefetchedSongsRef.current = [];

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      try {
        const response = await clientSongsApi.getSimilar(
          songId,
          { limit: 10 },
          { signal: abortControllerRef.current.signal }
        );
        if (response.data?.success && Array.isArray(response.data?.data)) {
          prefetchedSongsRef.current = response.data.data;
          prefetchedSongIdRef.current = songId;
        }
      } catch (err) {
        if (err.name !== 'CanceledError' && err.name !== 'AbortError') {
          console.warn('Failed to prefetch autoplay songs:', err.message);
        }
      } finally {
        isPrefetchingAutoplayRef.current = false;
      }
    },
    []
  );

  /**
   * Called when the queue ends and autoplay is enabled.
   * Uses pre-fetched songs if available; otherwise fetches on the spot.
   */
  const handleAutoplayEnd = useCallback(
    async (audioInstance) => {
      const activeSong = currentSongRef.current;
      if (!activeSong?._id) {
        setIsPlaying(false);
        return;
      }

      if (
        prefetchedSongIdRef.current === activeSong._id &&
        prefetchedSongsRef.current.length > 0
      ) {
        const listToAppend = prefetchedSongsRef.current;
        prefetchedSongsRef.current = [];
        prefetchedSongIdRef.current = null;
        appendAutoplaySongs(listToAppend, audioInstance);
        return;
      }

      if (isPrefetchingAutoplayRef.current) return;
      isPrefetchingAutoplayRef.current = true;
      if (abortControllerRef.current) abortControllerRef.current.abort();
      abortControllerRef.current = new AbortController();

      try {
        const response = await clientSongsApi.getSimilar(
          activeSong._id,
          { limit: 10 },
          { signal: abortControllerRef.current.signal }
        );
        if (
          response.data?.success &&
          Array.isArray(response.data?.data) &&
          response.data.data.length > 0
        ) {
          appendAutoplaySongs(response.data.data, audioInstance);
        } else {
          setIsPlaying(false);
        }
      } catch (err) {
        if (err.name !== 'CanceledError' && err.name !== 'AbortError') {
          console.warn('Autoplay fetch failed:', err.message);
        }
        setIsPlaying(false);
      } finally {
        isPrefetchingAutoplayRef.current = false;
      }
    },
    [appendAutoplaySongs, currentSongRef, setIsPlaying]
  );

  return {
    isPrefetchingAutoplayRef,
    prefetchedSongIdRef,
    prefetchAutoplaySongs,
    appendAutoplaySongs,
    handleAutoplayEnd,
  };
}
