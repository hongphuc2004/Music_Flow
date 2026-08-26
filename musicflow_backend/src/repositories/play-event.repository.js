/**
 * play-event.repository.js — All Mongoose queries for SongPlayEvent and
 * SongDownloadEvent in one place.
 *
 * Separating query logic from business logic lets us:
 *  - Optimise queries (projections, indexes) without touching services
 *  - Easily mock persistence in unit tests
 */

const SongPlayEvent = require("../models/song-play-event.model");
const SongDownloadEvent = require("../models/song-download-event.model");

// ---------------------------------------------------------------------------
// Play events
// ---------------------------------------------------------------------------

/**
 * Check whether the same listener played a song within the cooldown window.
 *
 * @param {string} songId
 * @param {{ userId?: string|null, anonymousKey?: string|null }} listenerFilter
 * @param {Date} cooldownStart  — events after this date count as "recent"
 * @returns {Promise<object|null>}  lean doc or null
 */
const findRecentPlay = (songId, listenerFilter, cooldownStart) =>
  SongPlayEvent.findOne({
    songId,
    ...listenerFilter,
    playedAt: { $gte: cooldownStart },
  })
    .select("_id")
    .lean();

/**
 * Create a new play event document.
 *
 * @param {{ songId, artistId?, artistIds?, userId?, anonymousKey?, playedAt }} data
 * @returns {Promise<import('mongoose').Document>}
 */
const createPlayEvent = (data) => SongPlayEvent.create(data);

/**
 * Update a play event feedback with strict listener ownership verification.
 * @param {string} eventId
 * @param {object} listenerFilter - { userId } or { anonymousKey }
 * @param {object} feedbackData - { playDuration, completionRate, completed, skipped, replayCount }
 */
const updatePlayEventFeedback = (eventId, listenerFilter, feedbackData) =>
  SongPlayEvent.findOneAndUpdate(
    { _id: eventId, ...listenerFilter },
    { $set: feedbackData },
    { new: true }
  ).lean();

/**
 * Delete a play event by id (used to roll back on subsequent failure).

 *
 * @param {string} id
 */
const deletePlayEventById = (id) =>
  SongPlayEvent.deleteOne({ _id: id }).catch(() => {});

/**
 * Find play events for a set of songs within a date range.
 * Returns lean objects with only `songId` and `playedAt`.
 *
 * Used by getFlowchart and getRankings.
 *
 * @param {string[]} songIds
 * @param {Date} from
 * @param {Date} [to]   — omit to include up to now
 */
const findPlayEventsInRange = (songIds, from, to) => {
  const playedAtFilter = to
    ? { $gte: from, $lt: to }
    : { $gte: from };
  return SongPlayEvent.find({
    songId: { $in: songIds },
    playedAt: playedAtFilter,
  })
    .select("songId playedAt -_id")
    .lean();
};

/**
 * Aggregate play counts grouped by songId and bucketed into "current" /
 * "previous" periods. Used by getRankings.
 *
 * @param {Date} periodStart  — start of the **previous** period
 * @param {Date} periodEnd    — end of the **current** period (= now)
 * @param {Date} currentStart — boundary between previous and current
 */
const aggregatePeriodCounts = (periodStart, periodEnd, currentStart) =>
  SongPlayEvent.aggregate([
    {
      $match: {
        playedAt: { $gte: periodStart, $lt: periodEnd },
      },
    },
    {
      $group: {
        _id: {
          songId: "$songId",
          bucket: {
            $cond: [{ $gte: ["$playedAt", currentStart] }, "current", "previous"],
          },
        },
        count: { $sum: 1 },
      },
    },
  ]);

// ---------------------------------------------------------------------------
// Download events
// ---------------------------------------------------------------------------

/**
 * Find a user's download history, newest first.
 * The `songId` field is populated with the Song document (only public songs).
 *
 * @param {string} userId
 * @param {number} [fetchLimit=400]  — fetch extra to allow deduplication
 */
const findDownloadHistory = (userId, fetchLimit = 400) =>
  SongDownloadEvent.find({ userId })
    .sort({ downloadedAt: -1 })
    .populate({
      path: "songId",
      match: { isPublic: true },
      populate: { path: "artists" },
    })
    .limit(fetchLimit)
    .lean();

/**
 * Find existing download event ids for a user + song list combo.
 * Used for sync operations to avoid creating duplicates.
 *
 * @param {string} userId
 * @param {string[]} songIds
 */
const findExistingDownloads = (userId, songIds) =>
  SongDownloadEvent.find({
    userId,
    songId: { $in: songIds },
  })
    .select("songId")
    .lean();

/**
 * Bulk-insert download events. Uses `ordered: false` so partial failures
 * don't abort the rest.
 *
 * @param {Array<{ userId, songId, downloadedAt }>} docs
 */
const insertManyDownloads = (docs) =>
  SongDownloadEvent.insertMany(docs, { ordered: false });

/**
 * Delete all download events for a user + song combination.
 *
 * @param {string} userId
 * @param {string} songId
 */
const deleteDownloads = (userId, songId) =>
  SongDownloadEvent.deleteMany({ userId, songId });

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  // Play events
  findRecentPlay,
  createPlayEvent,
  updatePlayEventFeedback,
  deletePlayEventById,
  findPlayEventsInRange,
  aggregatePeriodCounts,


  // Download events
  findDownloadHistory,
  findExistingDownloads,
  insertManyDownloads,
  deleteDownloads,
};
