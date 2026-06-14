/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { clientSongsApi, resolveSongStreamUrl } from '../../../services/api';
import { findActiveLyricIndex, parseLyrics } from '../../../utils/lyrics';

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
    streamUrl: song.audioUrl || song.streamUrl || resolveSongStreamUrl(song._id),
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

  const currentSongRef = useRef(null);
  const queueRef = useRef([]);
  const queueIndexRef = useRef(0);
  const shuffleRef = useRef(false);
  const repeatModeRef = useRef('off');

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

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime || 0);
    const handleLoadedMetadata = () => setDuration(audio.duration || 0);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      const activeQueue = queueRef.current;
      const activeIndex = queueIndexRef.current;
      const activeRepeatMode = repeatModeRef.current;

      if (activeRepeatMode === 'one') {
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
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [loadLyrics]);

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
      audio.src = nextSong.streamUrl;
      setCurrentSong(nextSong);
      currentSongRef.current = nextSong;
      setCurrentTime(0);
      loadLyrics(nextSong._id);
    }

    saveRecentPlayedSong(song);

    try {
      await audio.play();
    } catch {
      setIsPlaying(false);
    }
  }, [loadLyrics]);

  const playSongAtIndex = useCallback(async (nextIndex) => {
    const activeQueue = queueRef.current;
    const audio = audioRef.current;
    if (!audio || nextIndex < 0 || nextIndex >= activeQueue.length) return false;

    const nextSong = normalizeSong(activeQueue[nextIndex]);
    if (!nextSong?._id) return false;

    queueIndexRef.current = nextIndex;
    currentSongRef.current = nextSong;
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
  }, [loadLyrics]);

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

    return nextIndex === null ? false : playSongAtIndex(nextIndex);
  }, [playSongAtIndex]);

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
  ]);

  const actionsValue = useMemo(() => ({
    playSong,
    playPrevious,
    playNext,
    toggleShuffle,
    cycleRepeatMode,
    togglePlay,
    seekTo,
  }), [
    playSong,
    playPrevious,
    playNext,
    toggleShuffle,
    cycleRepeatMode,
    togglePlay,
    seekTo,
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
