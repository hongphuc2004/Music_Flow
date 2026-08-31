const Song = require("../models/song.model");
const songIntelligenceService = require("../services/songIntelligence.service");

const MAX_RETRIES = 3;
const RETRY_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour cooldown between retries
const BATCH_SIZE = 3;
const JOB_INTERVAL_MS = 15 * 60 * 1000; // Run every 15 minutes

// In-memory set to prevent processing the same song concurrently
const activeProcessingSet = new Set();

async function runSongIntelligenceBatch() {
  try {
    const oneHourAgo = new Date(Date.now() - RETRY_COOLDOWN_MS);

    // Query candidates: status is 'pending', 'none', missing, or failed with retryCount < 3 and cooldown passed
    const candidateSongs = await Song.find({
      isPublic: true,
      $or: [
        { "aiAnalysis.status": "pending" },
        { "aiAnalysis.status": "none" },
        { "aiAnalysis.status": { $exists: false } },
        {
          "aiAnalysis.status": "failed",
          "aiAnalysis.retryCount": { $lt: MAX_RETRIES },
          "aiAnalysis.lastAttemptAt": { $lte: oneHourAgo },
        },
      ],
    })
      .select("_id title lyrics aiAnalysis")
      .limit(BATCH_SIZE * 2)
      .lean();

    if (candidateSongs.length === 0) {
      return;
    }

    // Filter out songs currently in processingSet
    const processQueue = candidateSongs
      .filter((s) => !activeProcessingSet.has(s._id.toString()))
      .slice(0, BATCH_SIZE);

    if (processQueue.length === 0) return;

    console.log(`[SongIntelligenceJob] Processing batch of ${processQueue.length} song(s)...`);

    for (const songDoc of processQueue) {
      const songIdStr = songDoc._id.toString();
      activeProcessingSet.add(songIdStr);

      try {
        await songIntelligenceService.processSongAnalysis(songDoc._id);
      } catch (err) {
        console.error(`[SongIntelligenceJob] Batch item error for ${songIdStr}:`, err.message);
      } finally {
        activeProcessingSet.delete(songIdStr);
      }
    }
  } catch (error) {
    console.error("[SongIntelligenceJob] Batch processing error:", error.message);
  }
}

function startSongIntelligenceJob() {
  // Execute small batch after server startup delay (90s delay to allow DB & server boot stabilization)
  setTimeout(() => {
    runSongIntelligenceBatch().catch(() => {});
  }, 90000);

  // Interval execution every 15 minutes
  setInterval(() => {
    runSongIntelligenceBatch().catch(() => {});
  }, JOB_INTERVAL_MS);

  console.log("[Job] Song Intelligence Background Job initialized (15m interval, batch size 3).");
}

module.exports = {
  runSongIntelligenceBatch,
  startSongIntelligenceJob,
  MAX_RETRIES,
};
