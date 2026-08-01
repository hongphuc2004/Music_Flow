/**
 * song.repository.js — All Mongoose queries for the Song model in one place.
 *
 * Controllers and services should import from here instead of calling
 * Song.find() / Song.findById() directly. This makes queries:
 *  - Easy to locate and optimise (indexes, projections)
 *  - Mockable in unit tests
 *  - Consistent across the codebase
 */

const Song = require("../models/song.model");

// ---------------------------------------------------------------------------
// Select constants
// ---------------------------------------------------------------------------

/** Fields returned for public song listings. */
const SONG_PUBLIC_SELECT =
  "title artists topicIds uploadedBy isPublic audioUrl duration imageUrl " +
  "source allowDownload playCount likeCount createdAt";

/** Standard populate options for public-facing responses. */
const ARTIST_POPULATE = {
  path: "artists",
  select: "name avatar isVerified followersCount monthlyListeners",
};
const TOPIC_POPULATE = { path: "topicIds", select: "name avatar" };

// ---------------------------------------------------------------------------
// Read — single
// ---------------------------------------------------------------------------

/**
 * Find a public song by id. Returns `null` when not found.
 *
 * @param {string} id
 * @param {string} [select]
 */
const findPublicById = (id, select = "") =>
  Song.findOne({ _id: id, isPublic: true })
    .select(select)
    .lean();

/**
 * Find any song by id (no public filter).
 *
 * @param {string} id
 * @param {string} [select]
 */
const findById = (id, select = "") =>
  Song.findById(id).select(select);

/**
 * Find any song by id, return as a lean plain object.
 *
 * @param {string} id
 * @param {string} [select]
 */
const findByIdLean = (id, select = "") =>
  Song.findById(id).select(select).lean();

// ---------------------------------------------------------------------------
// Read — many
// ---------------------------------------------------------------------------

/**
 * Find public songs with artist + topic populated, sorted newest first.
 *
 * @param {object} filter  — additional Mongoose filter
 * @param {{ skip: number, limit: number }} opts
 */
const findPublicWithPopulate = (filter = {}, { skip = 0, limit = 20 } = {}) =>
  Song.find({ isPublic: true, ...filter })
    .select(SONG_PUBLIC_SELECT)
    .populate(ARTIST_POPULATE)
    .populate(TOPIC_POPULATE)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

/**
 * Count public songs matching an optional filter.
 *
 * @param {object} [filter]
 */
const countPublic = (filter = {}) =>
  Song.countDocuments({ isPublic: true, ...filter });

/**
 * Find all public songs with minimal fields for in-memory ranking operations.
 * Returns lean array: [{_id, playCount, likeCount}].
 */
const findPublicForRanking = () =>
  Song.find({ isPublic: true }).select("_id playCount likeCount").lean();

/**
 * Find all public songs with full populate for ranking responses.
 */
const findPublicForRankingFull = () =>
  Song.find({ isPublic: true })
    .select(SONG_PUBLIC_SELECT)
    .populate("artists", "name avatar")
    .populate("topicIds", "name avatar")
    .lean();

/**
 * Find songs by an array of ids, preserving order.
 */
const findByIds = (ids) =>
  Song.find({ _id: { $in: ids } })
    .populate("artists")
    .populate("topicIds");

/**
 * Find all public songs that match at least one of the given artists or topics.
 * Excludes a specific song id. Used by getSimilarSongs.
 *
 * @param {{ excludeId, artistIds: string[], topicIds: string[], limit?: number }}
 */
const findSimilarCandidates = ({ excludeId, artistIds = [], topicIds = [], limit = 200 }) =>
  Song.find({
    _id: { $ne: excludeId },
    isPublic: true,
    ...(artistIds.length || topicIds.length
      ? {
          $or: [
            ...(artistIds.length ? [{ artists: { $in: artistIds } }] : []),
            ...(topicIds.length ? [{ topicIds: { $in: topicIds } }] : []),
          ],
        }
      : {}),
  })
    .populate(ARTIST_POPULATE)
    .populate(TOPIC_POPULATE)
    .limit(limit)
    .lean();

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

/**
 * Create and persist a new song document.
 *
 * @param {object} data
 * @returns {Promise<import('mongoose').Document>}
 */
const create = (data) => Song.create(data);

/**
 * Apply an atomic update to a song by id.
 *
 * @param {string} id
 * @param {object} update  — Mongoose update expression
 */
const updateById = (id, update) =>
  Song.updateOne({ _id: id }, update);

/**
 * Delete a song document by id.
 *
 * @param {string} id
 */
const deleteById = (id) => Song.findByIdAndDelete(id);

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  SONG_PUBLIC_SELECT,
  ARTIST_POPULATE,
  TOPIC_POPULATE,
  findPublicById,
  findById,
  findByIdLean,
  findPublicWithPopulate,
  countPublic,
  findPublicForRanking,
  findPublicForRankingFull,
  findByIds,
  findSimilarCandidates,
  create,
  updateById,
  deleteById,
};
