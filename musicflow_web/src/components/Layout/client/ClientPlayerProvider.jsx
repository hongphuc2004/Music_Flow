/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { clientSongsApi, resolveSongStreamUrl } from '../../../services/client/client.service';
import { findActiveLyricIndex, parseLyrics } from '../../../utils/lyrics';
import { useAssistant } from '../../../features/assistant/AssistantProvider';

const ClientPlayerStateContext = createContext(null);
const ClientPlayerActionsContext = createContext(null);
const ClientPlayerMetaContext = createContext(null);
const MAX_RECENT_PLAYED = 40;

function getRecentPlayedStorageKey() {
  const userId = localStorage.getItem('userId') || 'anonymous';
  return `musicflow_recent_played_${userId}`;
}

function saveRecentPlayedSong(song) {
  if (!song?._id) return;
  try {
    const key = getRecentPlayedStorageKey();
    const current = JSON.parse(localStorage.getItem(key) || '[]');
    const next = [
      {
        ...song,
        playedAt: new Date().toISOString(),
      },
      ...current.filter((item) => item?._id !== song._id),
    ].slice(0, MAX_RECENT_PLAYED);
    localStorage.setItem(key, JSON.stringify(next));
  } catch {
    // Ignore malformed localStorage history and start a fresh list next time.
  }
}

function normalizeSong(song) {
  if (!song) return null;

  const artistText = Array.isArray(song.artists)
    ? song.artists.map((artist) => artist?.name).filter(Boolean).join(', ')
    : song.artistText || song.artist || '';

  return {
    _id: song._id,
    title: song.title || 'Unknown song',
    imageUrl: song.imageUrl || '',
    artistText,
    duration: song.duration || 0,
    streamUrl: song._id
      ? resolveSongStreamUrl(song._id)
      : song.streamUrl || song.audioUrl || '',
  };
}

export function ClientPlayerProvider({ children }) {
  const audioRef = useRef(null);
  const [currentSong, setCurrentSong] = useState(null);
  const [queue, setQueue] = useState([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [shuffle, setShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState('off');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [lyricsData, setLyricsData] = useState({ isSynced: false, lines: [], plainText: '' });

  const [autoplay, setAutoplay] = useState(() => {
    return localStorage.getItem('musicflow_autoplay') !== 'false';
  });

  const autoplayRef = useRef(autoplay);
  useEffect(() => {
    autoplayRef.current = autoplay;
    localStorage.setItem('musicflow_autoplay', String(autoplay));
  }, [autoplay]);

  const isPrefetchingAutoplayRef = useRef(false);
  const prefetchedSongIdRef = useRef(null);
  const prefetchedSongsRef = useRef([]);
  const abortControllerRef = useRef(null);

  const currentSongRef = useRef(null);
  const queueRef = useRef([]);
  const queueIndexRef = useRef(0);
  const shuffleRef = useRef(false);
  const repeatModeRef = useRef('off');
  const lastTimelineUpdateRef = useRef(0);
  const playTrackingRef = useRef({
    songId: null,
    listenedSeconds: 0,
    segmentStartedAt: null,
    submitted: false,
  });

  const resetPlayTracking = useCallback((songId) => {
    playTrackingRef.current = {
      songId,
      listenedSeconds: 0,
      segmentStartedAt: null,
      submitted: false,
    };
  }, []);

  const toggleAutoplay = useCallback(() => {
    setAutoplay((prev) => !prev);
  }, []);

  const prefetchAutoplaySongs = useCallback(async (songId) => {
    if (isPrefetchingAutoplayRef.current) return;
    isPrefetchingAutoplayRef.current = true;
    prefetchedSongsRef.current = [];

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      const response = await clientSongsApi.getSimilar(songId, { limit: 10 }, {
        signal: abortControllerRef.current.signal
      });
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
  }, []);

  const appendAutoplaySongs = useCallback((songsList, audioInstance) => {
    const activeQueue = [...queueRef.current];
    const activeIndex = queueIndexRef.current;

    const existingIds = new Set(activeQueue.map(s => s._id));
    const newSongs = songsList.filter(s => !existingIds.has(s._id));

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
  }, [resetPlayTracking, loadLyrics]);

  const handleAutoplayEnd = useCallback(async (audioInstance) => {
    const activeSong = currentSongRef.current;
    if (!activeSong?._id) {
      setIsPlaying(false);
      return;
    }

    if (prefetchedSongIdRef.current === activeSong._id && prefetchedSongsRef.current.length > 0) {
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
      const response = await clientSongsApi.getSimilar(activeSong._id, { limit: 10 }, {
        signal: abortControllerRef.current.signal
      });
      if (response.data?.success && Array.isArray(response.data?.data) && response.data.data.length > 0) {
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
  }, [appendAutoplaySongs]);

  const finishListeningSegment = useCallback(() => {
    const tracking = playTrackingRef.current;
    if (tracking.segmentStartedAt === null) return;

    tracking.listenedSeconds += Math.max(
      0,
      (performance.now() - tracking.segmentStartedAt) / 1000
    );
    tracking.segmentStartedAt = null;
  }, []);

  const maybeTrackQualifiedPlay = useCallback(() => {
    const tracking = playTrackingRef.current;
    const audio = audioRef.current;
    const activeSong = currentSongRef.current;
    if (!audio || !activeSong?._id || tracking.submitted) return;
    if (tracking.songId !== activeSong._id) return;

    const activeSegmentSeconds = tracking.segmentStartedAt === null
      ? 0
      : Math.max(0, (performance.now() - tracking.segmentStartedAt) / 1000);
    const listenedSeconds = tracking.listenedSeconds + activeSegmentSeconds;
    const knownDuration = Number.isFinite(audio.duration) && audio.duration > 0
      ? audio.duration
      : Number(activeSong.duration) || 0;
    const thresholdSeconds = knownDuration > 0
      ? Math.min(15, knownDuration * 0.3)
      : 15;

    if (listenedSeconds < thresholdSeconds) return;

    tracking.submitted = true;
    clientSongsApi.trackPlay(activeSong._id).catch(() => {
      // Allow a retry during the same listening session if the request fails.
      tracking.submitted = false;
    });
  }, []);

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

  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.crossOrigin = 'anonymous';
    audioRef.current = audio;

    const handleTimeUpdate = () => {
      const now = performance.now();
      if (now - lastTimelineUpdateRef.current < 400 && !audio.ended) return;
      lastTimelineUpdateRef.current = now;
      setCurrentTime(audio.currentTime || 0);

      // PREFETCH AUTOPLAY TRIGGER (80% progress on last song in queue)
      const activeSong = currentSongRef.current;
      const durationVal = audio.duration || activeSong?.duration || 0;
      if (
        autoplayRef.current &&
        activeSong?._id &&
        durationVal > 0 &&
        audio.currentTime / durationVal >= 0.8 &&
        prefetchedSongIdRef.current !== activeSong._id &&
        !isPrefetchingAutoplayRef.current &&
        queueIndexRef.current === queueRef.current.length - 1
      ) {
        prefetchAutoplaySongs(activeSong._id);
      }
    };
    const handleLoadedMetadata = () => setDuration(audio.duration || 0);
    const handlePlaying = () => {
      setIsPlaying(true);
      const tracking = playTrackingRef.current;
      if (tracking.songId === currentSongRef.current?._id && tracking.segmentStartedAt === null) {
        tracking.segmentStartedAt = performance.now();
      }
    };
    const handlePause = () => {
      finishListeningSegment();
      maybeTrackQualifiedPlay();
      setIsPlaying(false);
    };
    const handleWaiting = () => {
      finishListeningSegment();
      maybeTrackQualifiedPlay();
    };
    const handleEnded = () => {
      finishListeningSegment();
      maybeTrackQualifiedPlay();
      const activeQueue = queueRef.current;
      const activeIndex = queueIndexRef.current;
      const activeRepeatMode = repeatModeRef.current;

      if (activeRepeatMode === 'one') {
        resetPlayTracking(currentSongRef.current?._id || null);
        audio.currentTime = 0;
        audio.play().catch(() => setIsPlaying(false));
        return;
      }

      let nextIndex = null;
      if (shuffleRef.current && activeQueue.length > 1) {
        do {
          nextIndex = Math.floor(Math.random() * activeQueue.length);
        } while (nextIndex === activeIndex);
      } else if (activeIndex < activeQueue.length - 1) {
        nextIndex = activeIndex + 1;
      } else if (activeRepeatMode === 'all' && activeQueue.length > 0) {
        nextIndex = 0;
      }

      if (nextIndex === null) {
        if (autoplayRef.current && currentSongRef.current?._id) {
          handleAutoplayEnd(audio);
          return;
        }
        setIsPlaying(false);
        return;
      }

      const nextSong = activeQueue[nextIndex];
      const normalizedSong = normalizeSong(nextSong);
      if (!normalizedSong?._id) {
        setIsPlaying(false);
        return;
      }

      queueIndexRef.current = nextIndex;
      currentSongRef.current = normalizedSong;
      resetPlayTracking(normalizedSong._id);
      audio.src = normalizedSong.streamUrl;
      setQueueIndex(nextIndex);
      setCurrentSong(normalizedSong);
      setCurrentTime(0);
      loadLyrics(normalizedSong._id);
      saveRecentPlayedSong(nextSong);
      audio.play().catch(() => setIsPlaying(false));
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    const trackingTimer = window.setInterval(maybeTrackQualifiedPlay, 500);
    audio.addEventListener('playing', handlePlaying);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.pause();
      window.clearInterval(trackingTimer);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('playing', handlePlaying);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [finishListeningSegment, loadLyrics, maybeTrackQualifiedPlay, resetPlayTracking]);

  useEffect(() => {
    currentSongRef.current = currentSong;
  }, [currentSong]);


  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  useEffect(() => {
    queueIndexRef.current = queueIndex;
  }, [queueIndex]);

  useEffect(() => {
    shuffleRef.current = shuffle;
  }, [shuffle]);

  useEffect(() => {
    repeatModeRef.current = repeatMode;
  }, [repeatMode]);

  const playSong = useCallback(async (song, options = {}) => {
    const audio = audioRef.current;
    if (!audio || !song?._id) return;

    const nextSong = normalizeSong(song);
    const nextQueue = Array.isArray(options.queue) && options.queue.length > 0
      ? options.queue
      : [song];
    const nextIndex = Math.max(0, nextQueue.findIndex((item) => item?._id === song._id));
    const isSameSong = currentSongRef.current?._id === nextSong._id;

    setQueue(nextQueue);
    setQueueIndex(nextIndex);
    queueRef.current = nextQueue;
    queueIndexRef.current = nextIndex;

    if (!isSameSong) {
      finishListeningSegment();
      resetPlayTracking(nextSong._id);
      audio.src = nextSong.streamUrl;
      setCurrentSong(nextSong);
      currentSongRef.current = nextSong;
      setCurrentTime(0);
      loadLyrics(nextSong._id);
    } else if (audio.ended || audio.currentTime < 1) {
      resetPlayTracking(nextSong._id);
    }

    saveRecentPlayedSong(song);

    try {
      await audio.play();
    } catch {
      setIsPlaying(false);
    }
  }, [finishListeningSegment, loadLyrics, resetPlayTracking]);

  // Try to use assistant context if available
  let assistant = null;
  try {
    assistant = useAssistant();
  } catch (e) {
    // Outside assistant provider boundary
  }

  // Register capabilities and sync current song with assistant
  useEffect(() => {
    if (assistant) {
      assistant.registerCapability('PLAY_SONG', (payload) => {
        if (payload?.song) {
          playSong(payload.song, { queue: payload.songs || [payload.song] });
        }
      });
      assistant.registerCapability('LOAD_PLAYLIST', (payload) => {
        if (payload?.songs && payload.songs.length > 0) {
          playSong(payload.songs[0], { queue: payload.songs });
        }
      });
      
      return () => {
        assistant.unregisterCapability('PLAY_SONG');
        assistant.unregisterCapability('LOAD_PLAYLIST');
      };
    }
  }, [assistant, playSong]);

  useEffect(() => {
    if (assistant) {
      assistant.setCurrentSong(currentSong);
    }
  }, [assistant, currentSong]);

  const playSongAtIndex = useCallback(async (nextIndex) => {
    const activeQueue = queueRef.current;
    const audio = audioRef.current;
    if (!audio || nextIndex < 0 || nextIndex >= activeQueue.length) return false;

    const nextSong = normalizeSong(activeQueue[nextIndex]);
    if (!nextSong?._id) return false;

    queueIndexRef.current = nextIndex;
    currentSongRef.current = nextSong;
    finishListeningSegment();
    resetPlayTracking(nextSong._id);
    audio.src = nextSong.streamUrl;
    setQueueIndex(nextIndex);
    setCurrentSong(nextSong);
    setCurrentTime(0);
    loadLyrics(nextSong._id);
    saveRecentPlayedSong(activeQueue[nextIndex]);

    try {
      await audio.play();
      return true;
    } catch {
      setIsPlaying(false);
      return false;
    }
  }, [finishListeningSegment, loadLyrics, resetPlayTracking]);

  const togglePlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !currentSong) return;

    if (audio.paused) {
      try {
        await audio.play();
      } catch {
        setIsPlaying(false);
      }
    } else {
      audio.pause();
    }
  }, [currentSong]);

  const seekTo = useCallback((nextTime) => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.currentTime = Number(nextTime) || 0;
    setCurrentTime(audio.currentTime || 0);
  }, []);

  const playPrevious = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return false;

    if (audio.currentTime > 3) {
      seekTo(0);
      return true;
    }

    const activeQueue = queueRef.current;
    const activeIndex = queueIndexRef.current;
    let previousIndex = null;

    if (shuffleRef.current && activeQueue.length > 1) {
      do {
        previousIndex = Math.floor(Math.random() * activeQueue.length);
      } while (previousIndex === activeIndex);
    } else if (activeIndex > 0) {
      previousIndex = activeIndex - 1;
    } else if (repeatModeRef.current === 'all' && activeQueue.length > 0) {
      previousIndex = activeQueue.length - 1;
    }

    return previousIndex === null ? false : playSongAtIndex(previousIndex);
  }, [playSongAtIndex, seekTo]);

  const playNext = useCallback(async () => {
    const activeQueue = queueRef.current;
    const activeIndex = queueIndexRef.current;
    let nextIndex = null;

    if (shuffleRef.current && activeQueue.length > 1) {
      do {
        nextIndex = Math.floor(Math.random() * activeQueue.length);
      } while (nextIndex === activeIndex);
    } else if (activeIndex < activeQueue.length - 1) {
      nextIndex = activeIndex + 1;
    } else if (repeatModeRef.current === 'all' && activeQueue.length > 0) {
      nextIndex = 0;
    }

    if (nextIndex === null) {
      if (autoplayRef.current && currentSongRef.current?._id) {
        await handleAutoplayEnd(audioRef.current);
        return true;
      }
      return false;
    }

    return playSongAtIndex(nextIndex);
  }, [playSongAtIndex, handleAutoplayEnd]);

  const toggleShuffle = useCallback(() => {
    setShuffle((prev) => {
      const next = !prev;
      shuffleRef.current = next;
      return next;
    });
  }, []);

  const cycleRepeatMode = useCallback(() => {
    let nextMode = 'all';
    if (repeatModeRef.current === 'all') nextMode = 'one';
    if (repeatModeRef.current === 'one') nextMode = 'off';

    repeatModeRef.current = nextMode;
    setRepeatMode(nextMode);
    return nextMode;
  }, []);


  const activeLyricIndex = useMemo(() => {
    if (!lyricsData.isSynced) return -1;
    return findActiveLyricIndex(lyricsData.lines, currentTime);
  }, [currentTime, lyricsData]);

  const stateValue = useMemo(() => ({
    currentSong,
    queue,
    queueIndex,
    shuffle,
    repeatMode,
    isPlaying,
    currentTime,
    duration,
    hasSong: Boolean(currentSong),
    lyricsLines: lyricsData.lines,
    hasSyncedLyrics: lyricsData.isSynced,
    activeLyricIndex,
    autoplay,
  }), [
    currentSong,
    queue,
    queueIndex,
    shuffle,
    repeatMode,
    isPlaying,
    currentTime,
    duration,
    lyricsData.lines,
    lyricsData.isSynced,
    activeLyricIndex,
    autoplay,
  ]);

  const actionsValue = useMemo(() => ({
    playSong,
    playPrevious,
    playNext,
    toggleShuffle,
    cycleRepeatMode,
    togglePlay,
    seekTo,
    toggleAutoplay,
  }), [
    playSong,
    playPrevious,
    playNext,
    toggleShuffle,
    cycleRepeatMode,
    togglePlay,
    seekTo,
    toggleAutoplay,
  ]);

  const metaValue = useMemo(() => ({
    hasSong: Boolean(currentSong),
  }), [currentSong]);

  return (
    <ClientPlayerMetaContext.Provider value={metaValue}>
      <ClientPlayerActionsContext.Provider value={actionsValue}>
        <ClientPlayerStateContext.Provider value={stateValue}>
          {children}
        </ClientPlayerStateContext.Provider>
      </ClientPlayerActionsContext.Provider>
    </ClientPlayerMetaContext.Provider>
  );
}

export function useClientPlayer() {
  const state = useContext(ClientPlayerStateContext);
  const actions = useContext(ClientPlayerActionsContext);
  const meta = useContext(ClientPlayerMetaContext);
  if (!state || !actions || !meta) {
    throw new Error('useClientPlayer must be used within ClientPlayerProvider');
  }

  return { ...state, ...actions, ...meta };
}

export function useClientPlayerActions() {
  const context = useContext(ClientPlayerActionsContext);
  if (!context) {
    throw new Error('useClientPlayerActions must be used within ClientPlayerProvider');
  }

  return context;
}

export function useClientPlayerMeta() {
  const context = useContext(ClientPlayerMetaContext);
  if (!context) {
    throw new Error('useClientPlayerMeta must be used within ClientPlayerProvider');
  }

  return context;
}
