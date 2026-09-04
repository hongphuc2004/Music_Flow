/**
 * alignment-fingerprint.util.js — Deterministic Hashing Utilities for Idempotent AI Alignment
 */

const crypto = require("crypto");
const config = require("../config/alignmentConfig");

/**
 * Deterministically normalize plain lyrics text:
 * - NFC Unicode normalization
 * - Strip BOM and control characters
 * - Trim and collapse multiple whitespaces
 * - Unify newline characters
 * @param {string} text 
 * @returns {string}
 */
function normalizeLyricsText(text) {
  if (typeof text !== "string") return "";
  return text
    .normalize("NFC")
    .replace(/^\uFEFF/, "") // Strip BOM
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/\s+/g, " "))
    .filter(Boolean)
    .join("\n");
}

/**
 * SHA-256 hash helper
 * @param {string} input 
 * @returns {string} hex digest
 */
function sha256(input) {
  return crypto.createHash("sha256").update(String(input), "utf8").digest("hex");
}

/**
 * Compute Content Hash for plain lyrics
 * @param {string} plainLyrics 
 * @returns {string}
 */
function computeLyricsContentHash(plainLyrics) {
  const normalized = normalizeLyricsText(plainLyrics);
  return sha256(normalized);
}

/**
 * Compute Input Fingerprint:
 * SHA256(songId + audioPublicId + SHA256(normalize(plainLyrics)))
 * @param {string|mongoose.Types.ObjectId} songId 
 * @param {string} audioPublicId 
 * @param {string} plainLyrics 
 * @returns {string}
 */
function computeInputFingerprint(songId, audioPublicId, plainLyrics) {
  const sId = String(songId || "").trim();
  const audioId = String(audioPublicId || "").trim();
  const lyricsHash = computeLyricsContentHash(plainLyrics);
  return sha256(`${sId}:${audioId}:${lyricsHash}`);
}

/**
 * Compute Pipeline Fingerprint:
 * SHA256(separatorModel + alignmentModel + pipelineVersion + postProcessVersion)
 * @param {object} [customConfig] 
 * @returns {string}
 */
function computePipelineFingerprint(customConfig = config) {
  const sep = String(customConfig.SEPARATOR_MODEL || "").trim();
  const align = String(customConfig.ALIGNMENT_MODEL || "").trim();
  const pipeVer = String(customConfig.PIPELINE_VERSION || "").trim();
  const postVer = String(customConfig.POSTPROCESS_VERSION || "").trim();
  return sha256(`${sep}:${align}:${pipeVer}:${postVer}`);
}

/**
 * Compute Combined Fingerprint
 * SHA256(inputFingerprint + pipelineFingerprint)
 * @param {string} inputFingerprint 
 * @param {string} pipelineFingerprint 
 * @returns {string}
 */
function computeCombinedFingerprint(inputFingerprint, pipelineFingerprint) {
  return sha256(`${inputFingerprint}:${pipelineFingerprint}`);
}

/**
 * Compute Input Fingerprint for Auto-Transcription:
 * SHA256(songId + audioPublicId + "auto_transcribe")
 * @param {string|mongoose.Types.ObjectId} songId 
 * @param {string} audioPublicId 
 * @returns {string}
 */
function computeAutoTranscribeInputFingerprint(songId, audioPublicId) {
  const sId = String(songId || "").trim();
  const audioId = String(audioPublicId || "").trim();
  return sha256(`${sId}:${audioId}:auto_transcribe`);
}

/**
 * Compute Pipeline Fingerprint for Auto-Transcription:
 * SHA256(separatorModel + alignmentModel + pipelineVersion + postProcessVersion + provider + model + version)
 * @param {object} [customConfig] 
 * @returns {string}
 */
function computeAutoTranscribePipelineFingerprint(customConfig = config) {
  const sep = String(customConfig.SEPARATOR_MODEL || "").trim();
  const align = String(customConfig.ALIGNMENT_MODEL || "").trim();
  const pipeVer = String(customConfig.PIPELINE_VERSION || "").trim();
  const postVer = String(customConfig.POSTPROCESS_VERSION || "").trim();
  const provider = String(customConfig.TRANSCRIPTION_PROVIDER || "whisper").trim();
  const model = String(customConfig.TRANSCRIPTION_MODEL || "whisper-base").trim();
  const transVer = String(customConfig.TRANSCRIPTION_VERSION || "1.0.0").trim();
  return sha256(`${sep}:${align}:${pipeVer}:${postVer}:${provider}:${model}:${transVer}`);
}

module.exports = {
  normalizeLyricsText,
  sha256,
  computeLyricsContentHash,
  computeInputFingerprint,
  computePipelineFingerprint,
  computeCombinedFingerprint,
  computeAutoTranscribeInputFingerprint,
  computeAutoTranscribePipelineFingerprint,
};
