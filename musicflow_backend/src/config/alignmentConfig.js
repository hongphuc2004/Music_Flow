/**
 * alignmentConfig.js — Configuration for AI Lyric Alignment Pipeline
 */

module.exports = {
  SEPARATOR_MODEL: process.env.ALIGNMENT_SEPARATOR_MODEL || "htdemucs",
  ALIGNMENT_MODEL: process.env.ALIGNMENT_MODEL || "nguyenvulebinh/wav2vec2-base-vietnamese-250h",
  PIPELINE_VERSION: process.env.ALIGNMENT_PIPELINE_VERSION || "3.0.0",
  POSTPROCESS_VERSION: process.env.ALIGNMENT_POSTPROCESS_VERSION || "3.0.0",

  // Auto-Transcription Provider
  TRANSCRIPTION_PROVIDER: process.env.ALIGNMENT_TRANSCRIPTION_PROVIDER || "whisper",
  TRANSCRIPTION_MODEL: process.env.ALIGNMENT_TRANSCRIPTION_MODEL || "whisper-base",
  TRANSCRIPTION_VERSION: process.env.ALIGNMENT_TRANSCRIPTION_VERSION || "1.0.0",
  ALLOW_EXTERNAL_TRANSCRIPTION: process.env.ALLOW_EXTERNAL_TRANSCRIPTION === "true",

  // Hard boundaries & resource safety
  MAX_SONG_DURATION_SEC: 420, // 7 minutes maximum song duration
  MIN_LYRICS_LENGTH: 10,      // Minimum plain lyrics character length
  MAX_JOB_ATTEMPTS: 2,        // Maximum worker retries per job
  JOB_TIMEOUT_SEC: 300,       // 5 minutes execution timeout
  STALE_LOCK_SEC: 600,        // 10 minutes stale lock reclamation threshold
};
