import { useRef, useCallback } from 'react';
import { clientSongsApi } from '../../services/client/client.service.js';

/**
 * useTracking — play listen-time tracking hook.
 *
 * Tracks how many seconds the user has listened to the current song and
 * submits a server-side play event when the qualify threshold is met
 * (30% of song duration OR 15 seconds, whichever is smaller).
 *
 * @param {React.RefObject<HTMLAudioElement>} audioRef
 * @param {React.RefObject<object|null>} currentSongRef  — ref to current normalized song
 */
export function useTracking(audioRef, currentSongRef) {
  const playTrackingRef = useRef({
    songId: null,
    listenedSeconds: 0,
    segmentStartedAt: null,
    submitted: false,
  });

  /**
   * Reset tracking state when a new song starts.
   * @param {string|null} songId
   */
  const resetPlayTracking = useCallback((songId) => {
    playTrackingRef.current = {
      songId,
      listenedSeconds: 0,
      segmentStartedAt: null,
      submitted: false,
    };
  }, []);

  /**
   * Called on pause / waiting — finalizes the current listening segment
   * and accumulates the seconds into `listenedSeconds`.
   */
  const finishListeningSegment = useCallback(() => {
    const tracking = playTrackingRef.current;
    if (tracking.segmentStartedAt === null) return;

    tracking.listenedSeconds += Math.max(
      0,
      (performance.now() - tracking.segmentStartedAt) / 1000
    );
    tracking.segmentStartedAt = null;
  }, []);

  /**
   * Called on play start — marks the beginning of a new listening segment.
   * Only starts if the song hasn't been submitted yet.
   */
  const startListeningSegment = useCallback(() => {
    const tracking = playTrackingRef.current;
    if (
      tracking.songId === currentSongRef.current?._id &&
      tracking.segmentStartedAt === null
    ) {
      tracking.segmentStartedAt = performance.now();
    }
  }, [currentSongRef]);

  /**
   * Called periodically (every 500 ms) and on pause/ended.
   * Submits a play event when the user has listened long enough.
   */
  const maybeTrackQualifiedPlay = useCallback(() => {
    const tracking = playTrackingRef.current;
    const audio = audioRef.current;
    const activeSong = currentSongRef.current;
    if (!audio || !activeSong?._id || tracking.submitted) return;
    if (tracking.songId !== activeSong._id) return;

    const activeSegmentSeconds =
      tracking.segmentStartedAt === null
        ? 0
        : Math.max(0, (performance.now() - tracking.segmentStartedAt) / 1000);
    const listenedSeconds = tracking.listenedSeconds + activeSegmentSeconds;
    const knownDuration =
      Number.isFinite(audio.duration) && audio.duration > 0
        ? audio.duration
        : Number(activeSong.duration) || 0;
    const thresholdSeconds =
      knownDuration > 0 ? Math.min(15, knownDuration * 0.3) : 15;

    if (listenedSeconds < thresholdSeconds) return;

    tracking.submitted = true;
    clientSongsApi.trackPlay(activeSong._id).catch(() => {
      // Allow a retry during the same listening session if the request fails.
      tracking.submitted = false;
    });
  }, [audioRef, currentSongRef]);

  return {
    playTrackingRef,
    resetPlayTracking,
    finishListeningSegment,
    startListeningSegment,
    maybeTrackQualifiedPlay,
  };
}
