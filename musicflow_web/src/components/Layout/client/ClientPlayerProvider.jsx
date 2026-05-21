import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { clientSongsApi, resolveSongStreamUrl } from '../../../services/api';
import { findActiveLyricIndex, parseLyrics } from '../../../utils/lyrics';

const ClientPlayerContext = createContext(null);
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
  }
}

function normalizeSong(song) {
  if (!song) return null;

  const artistText = Array.isArray(song.artists)
    ? song.artists.map((artist) => artist?.name).filter(Boolean).join(', ')
    : song.artist || '';

  return {
    _id: song._id,
    title: song.title || 'Unknown song',
    imageUrl: song.imageUrl || '',
    artistText,
    duration: song.duration || 0,
    streamUrl: resolveSongStreamUrl(song._id),
  };
}

export function ClientPlayerProvider({ children }) {
  const audioRef = useRef(null);
  const [currentSong, setCurrentSong] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [lyricsData, setLyricsData] = useState({ isSynced: false, lines: [], plainText: '' });

  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'metadata';
    audioRef.current = audio;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime || 0);
    const handleLoadedMetadata = () => setDuration(audio.duration || 0);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);

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

  const playSong = useCallback(async (song) => {
    const audio = audioRef.current;
    if (!audio || !song?._id) return;

    const nextSong = normalizeSong(song);
    const isSameSong = currentSong?._id === nextSong._id;

    if (!isSameSong) {
      audio.src = nextSong.streamUrl;
      setCurrentSong(nextSong);
      setCurrentTime(0);
      loadLyrics(nextSong._id);
    }

    saveRecentPlayedSong(song);

    try {
      await audio.play();
    } catch {
      setIsPlaying(false);
    }
  }, [currentSong?._id, loadLyrics]);

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

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.pause();
    audio.currentTime = 0;
    setCurrentTime(0);
    setIsPlaying(false);
  }, []);

  const activeLyricIndex = useMemo(() => {
    if (!lyricsData.isSynced) return -1;
    return findActiveLyricIndex(lyricsData.lines, currentTime);
  }, [currentTime, lyricsData]);

  const value = useMemo(() => ({
    currentSong,
    isPlaying,
    currentTime,
    duration,
    hasSong: Boolean(currentSong),
    lyricsLines: lyricsData.lines,
    hasSyncedLyrics: lyricsData.isSynced,
    lyricsText: lyricsData.plainText,
    activeLyricIndex,
    playSong,
    togglePlay,
    seekTo,
    stop,
  }), [
    currentSong,
    isPlaying,
    currentTime,
    duration,
    lyricsData.lines,
    lyricsData.isSynced,
    lyricsData.plainText,
    activeLyricIndex,
    playSong,
    togglePlay,
    seekTo,
    stop,
  ]);

  return (
    <ClientPlayerContext.Provider value={value}>
      {children}
    </ClientPlayerContext.Provider>
  );
}

export function useClientPlayer() {
  const context = useContext(ClientPlayerContext);
  if (!context) {
    throw new Error('useClientPlayer must be used within ClientPlayerProvider');
  }

  return context;
}
