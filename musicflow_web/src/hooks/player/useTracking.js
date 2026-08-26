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
    playEventId: null,
    listenedSeconds: 0,
    segmentStartedAt: null,
    submitted: false,
    feedbackReported: false,
    replayCount: 0,
  });

  /**
   * Reset tracking state when a new song starts.
   * @param {string|null} songId
   */
  const resetPlayTracking = useCallback((songId) => {
    playTrackingRef.current = {
      songId,
      playEventId: null,
      listenedSeconds: 0,
      segmentStartedAt: null,
      submitted: false,
      feedbackReported: false,
      replayCount: 0,
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
   * Submits Stage 1 play event when the user has listened long enough.
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
    clientSongsApi.trackPlay(activeSong._id).then((res) => {
      if (res.data?.success && res.data?.playEventId) {
        tracking.playEventId = res.data.playEventId;
      }
    }).catch(() => {
      tracking.submitted = false;
    });
  }, [audioRef, currentSongRef]);

  /**
   * Stage 2 Lifecycle: Finalize listening session and report feedback (playDuration, completionRate, skipped, completed).
   */
  const finishSessionAndReportFeedback = useCallback((reason = 'change') => {
    const tracking = playTrackingRef.current;
    const audio = audioRef.current;
    const activeSong = currentSongRef.current;

    if (!activeSong?._id || tracking.feedbackReported) return;

    finishListeningSegment();

    const totalDuration = tracking.listenedSeconds;
    // Filter out rapid clicks (< 2s)
    if (totalDuration < 2.0) {
      tracking.feedbackReported = true;
      return;
    }

    const knownDuration =
      Number.isFinite(audio?.duration) && audio.duration > 0
        ? audio.duration
        : Number(activeSong.duration) || 1;
    const completionRate = Math.min(1.0, Math.max(0, totalDuration / knownDuration));
    const completed = reason === 'ended' || completionRate >= 0.85;
    const skipped = totalDuration < 30 && completionRate < 0.30 && !completed;

    const payload = {
      playDuration: Math.round(totalDuration),
      completionRate: Number(completionRate.toFixed(2)),
      completed,
      skipped,
      replayCount: tracking.replayCount || 0,
    };

    tracking.feedbackReported = true;

    // Use sendBeacon if available for unload/pagehide, otherwise clientSongsApi
    if (tracking.playEventId) {
      const url = `/api/songs/${activeSong._id}/play-events/${tracking.playEventId}`;
      if (reason === 'unload' && navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
        navigator.sendBeacon(url, blob);
      } else {
        clientSongsApi.updatePlayFeedback(activeSong._id, tracking.playEventId, payload).catch(() => {});
      }
    }
  }, [audioRef, currentSongRef, finishListeningSegment]);

  return {
    playTrackingRef,
    resetPlayTracking,
    finishListeningSegment,
    startListeningSegment,
    maybeTrackQualifiedPlay,
    finishSessionAndReportFeedback,
  };
}

