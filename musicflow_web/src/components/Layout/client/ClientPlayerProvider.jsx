/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { resolveSongStreamUrl } from '../../../services/client/client.service.js';
import { useAssistant } from '../../../features/assistant/AssistantProvider.jsx';

// Custom hooks extracted from this file
import { useTracking } from '../../../hooks/player/useTracking.js';
import { useLyrics } from '../../../hooks/player/useLyrics.js';
import { useAutoplay } from '../../../hooks/player/useAutoplay.js';

// ---------------------------------------------------------------------------
// Contexts
// ---------------------------------------------------------------------------

const ClientPlayerStateContext = createContext(null);
const ClientPlayerActionsContext = createContext(null);
const ClientPlayerMetaContext = createContext(null);

// ---------------------------------------------------------------------------
// Local helpers
// ---------------------------------------------------------------------------

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
      { ...song, playedAt: new Date().toISOString() },
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
    ? song.artists.map((a) => a?.name).filter(Boolean).join(', ')
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

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function ClientPlayerProvider({ children }) {
  // --- Core audio state ---
  const audioRef = useRef(null);
  const [currentSong, setCurrentSong] = useState(null);
  const [queue, setQueue] = useState([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [shuffle, setShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState('off');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const [autoplay, setAutoplay] = useState(
    () => localStorage.getItem('musicflow_autoplay') !== 'false'
  );

  // --- Refs kept in sync with state for use inside event callbacks ---
  const currentSongRef = useRef(null);
  const queueRef = useRef([]);
  const queueIndexRef = useRef(0);
  const shuffleRef = useRef(false);
  const repeatModeRef = useRef('off');
  const autoplayRef = useRef(autoplay);
  const lastTimelineUpdateRef = useRef(0);

  useEffect(() => { autoplayRef.current = autoplay; localStorage.setItem('musicflow_autoplay', String(autoplay)); }, [autoplay]);
  useEffect(() => { currentSongRef.current = currentSong; }, [currentSong]);
  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { queueIndexRef.current = queueIndex; }, [queueIndex]);
  useEffect(() => { shuffleRef.current = shuffle; }, [shuffle]);
  useEffect(() => { repeatModeRef.current = repeatMode; }, [repeatMode]);

  const toggleAutoplay = useCallback(() => setAutoplay((prev) => !prev), []);

  // --- Custom hooks ---
  const {
    resetPlayTracking,
    finishListeningSegment,
    startListeningSegment,
    maybeTrackQualifiedPlay,
  } = useTracking(audioRef, currentSongRef);

  const { lyricsData, loadLyrics, activeLyricIndex } = useLyrics(audioRef, currentTime);

  const {
    isPrefetchingAutoplayRef,
    prefetchedSongIdRef,
    prefetchAutoplaySongs,
    handleAutoplayEnd,
  } = useAutoplay({
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
  });

  // ---------------------------------------------------------------------------
  // Audio engine — create the HTMLAudioElement and wire all events
  // ---------------------------------------------------------------------------

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

      // PREFETCH AUTOPLAY TRIGGER at 80% progress on last queue item
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
    const handlePlaying = () => { setIsPlaying(true); startListeningSegment(); };
    const handlePause = () => { finishListeningSegment(); maybeTrackQualifiedPlay(); setIsPlaying(false); };
    const handleWaiting = () => { finishListeningSegment(); maybeTrackQualifiedPlay(); };

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
        do { nextIndex = Math.floor(Math.random() * activeQueue.length); }
        while (nextIndex === activeIndex);
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

      const nextSong = normalizeSong(activeQueue[nextIndex]);
      if (!nextSong?._id) { setIsPlaying(false); return; }

      queueIndexRef.current = nextIndex;
      currentSongRef.current = nextSong;
      resetPlayTracking(nextSong._id);
      audio.src = nextSong.streamUrl;
      setQueueIndex(nextIndex);
      setCurrentSong(nextSong);
      setCurrentTime(0);
      loadLyrics(nextSong._id);
      saveRecentPlayedSong(activeQueue[nextIndex]);
      audio.play().catch(() => setIsPlaying(false));
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('playing', handlePlaying);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('ended', handleEnded);
    const trackingTimer = window.setInterval(maybeTrackQualifiedPlay, 500);

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
  }, [
    finishListeningSegment,
    startListeningSegment,
    loadLyrics,
    maybeTrackQualifiedPlay,
    resetPlayTracking,
    handleAutoplayEnd,
    prefetchAutoplaySongs,
    isPrefetchingAutoplayRef,
    prefetchedSongIdRef,
  ]);

  // ---------------------------------------------------------------------------
  // Playback actions
  // ---------------------------------------------------------------------------

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

  const togglePlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !currentSong) return;
    if (audio.paused) {
      try { await audio.play(); } catch { setIsPlaying(false); }
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

    if (audio.currentTime > 3) { seekTo(0); return true; }

    const activeQueue = queueRef.current;
    const activeIndex = queueIndexRef.current;
    let previousIndex = null;

    if (shuffleRef.current && activeQueue.length > 1) {
      do { previousIndex = Math.floor(Math.random() * activeQueue.length); }
      while (previousIndex === activeIndex);
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
      do { nextIndex = Math.floor(Math.random() * activeQueue.length); }
      while (nextIndex === activeIndex);
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
    setShuffle((prev) => { const next = !prev; shuffleRef.current = next; return next; });
  }, []);

  const cycleRepeatMode = useCallback(() => {
    let nextMode = 'all';
    if (repeatModeRef.current === 'all') nextMode = 'one';
    if (repeatModeRef.current === 'one') nextMode = 'off';
    repeatModeRef.current = nextMode;
    setRepeatMode(nextMode);
    return nextMode;
  }, []);

  // ---------------------------------------------------------------------------
  // Assistant integration
  // ---------------------------------------------------------------------------

  let assistant = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    assistant = useAssistant();
  } catch {
    // Outside assistant provider boundary — safe to ignore.
  }

  useEffect(() => {
    if (!assistant) return;
    assistant.registerCapability('PLAY_SONG', (payload) => {
      if (payload?.song) playSong(payload.song, { queue: payload.songs || [payload.song] });
    });
    assistant.registerCapability('LOAD_PLAYLIST', (payload) => {
      if (payload?.songs?.length > 0) playSong(payload.songs[0], { queue: payload.songs });
    });
    return () => {
      assistant.unregisterCapability('PLAY_SONG');
      assistant.unregisterCapability('LOAD_PLAYLIST');
    };
  }, [assistant, playSong]);

  useEffect(() => {
    if (assistant) assistant.setCurrentSong(currentSong);
  }, [assistant, currentSong]);

  // ---------------------------------------------------------------------------
  // Context values
  // ---------------------------------------------------------------------------

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
    currentSong, queue, queueIndex, shuffle, repeatMode,
    isPlaying, currentTime, duration,
    lyricsData.lines, lyricsData.isSynced, activeLyricIndex, autoplay,
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
  }), [playSong, playPrevious, playNext, toggleShuffle, cycleRepeatMode, togglePlay, seekTo, toggleAutoplay]);

  const metaValue = useMemo(() => ({ hasSong: Boolean(currentSong) }), [currentSong]);

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

// ---------------------------------------------------------------------------
// Public hooks — unchanged interface
// ---------------------------------------------------------------------------

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
