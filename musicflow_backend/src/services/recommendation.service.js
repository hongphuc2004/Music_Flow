/**
 * recommendation.service.js — Similar songs and random recommendations.
 *
 * Extracted from song.controller.js so the weighted scoring algorithm lives
 * in a single, testable place.
 */

const Song = require("../models/song.model");
const songRepo = require("../repositories/song.repository");

// ---------------------------------------------------------------------------
// Similar songs (weighted score + random top-N)
// ---------------------------------------------------------------------------

/**
 * Return `limit` songs that are similar to the target song.
 *
 * Scoring weights:
 *  +5   — at least one artist in common
 *  +3   — per matching topic
 *  +log — popularity bonus (log-scaled playCount, max contribution ~5)
 *
 * After scoring the top-30 candidates are shuffled so repeated calls
 * return varied orderings without compromising relevance.
 *
 * Performance: uses a $or pre-filter so only songs with at least one
 * matching artist or topic are loaded — avoids full collection scan.
 *
 * @param {string} songId   — id of the currently playing song
 * @param {number} [limit=12]
 * @returns {Promise<object[]>}
 */
const getSimilarSongs = async (songId, limit = 12) => {
  const clampedLimit = Math.min(Math.max(Number(limit) || 12, 1), 50);

  const targetSong = await songRepo.findByIdLean(songId);
  if (!targetSong) {
    const err = new Error("Không tìm thấy bài hát gốc");
    err.status = 404;
    throw err;
  }

  const targetArtistIds = (targetSong.artists || []).map((a) => a.toString());
  const targetTopicIds = (targetSong.topicIds || []).map((t) => t.toString());

  // Pre-filtered candidates — only songs sharing at least one artist or topic
  const candidates = await songRepo.findSimilarCandidates({
    excludeId: targetSong._id,
    artistIds: targetArtistIds,
    topicIds: targetTopicIds,
    limit: 200,
  });

  const targetArtistSet = new Set(targetArtistIds);
  const targetTopicSet = new Set(targetTopicIds);

  // Score each candidate
  const scored = candidates.map((song) => {
    let score = 0;

    // Artist match (+5)
    const hasArtistMatch = (song.artists || []).some((a) =>
      targetArtistSet.has(a._id ? a._id.toString() : a.toString())
    );
    if (hasArtistMatch) score += 5;

    // Topic match (+3 per topic)
    const matchingTopics = (song.topicIds || []).filter((t) =>
      targetTopicSet.has(t._id ? t._id.toString() : t.toString())
    ).length;
    score += matchingTopics * 3;

    // Popularity (+log-scaled)
    score += Math.log((song.playCount || 0) + 1) * 0.5;

    return { song, score };
  });

  // Sort by score, take top 30, shuffle, return limit
  scored.sort((a, b) => b.score - a.score);
  const shuffled = scored
    .slice(0, 30)
    .map((item) => item.song)
    .sort(() => 0.5 - Math.random());

  return shuffled.slice(0, clampedLimit);
};

// ---------------------------------------------------------------------------
// Random recommendation (aggregate $sample)
// ---------------------------------------------------------------------------

/**
 * Return `limit` randomly sampled public songs using MongoDB's $sample
 * aggregation stage (uniform distribution, no repetition bias).
 *
 * @param {number} [limit=12]
 * @returns {Promise<object[]>}
 */
const getRecommendedSongs = async (limit = 12) => {
  const clampedLimit = Math.min(Math.max(Number(limit) || 12, 1), 50);

  const songs = await Song.aggregate([
    { $match: { isPublic: true } },
    { $sample: { size: clampedLimit } },
    {
      $project: {
        title: 1,
        artists: 1,
        topicIds: 1,
        uploadedBy: 1,
        isPublic: 1,
        audioUrl: 1,
        duration: 1,
        imageUrl: 1,
        source: 1,
        allowDownload: 1,
        playCount: 1,
        likeCount: 1,
        createdAt: 1,
      },
    },
    {
      $lookup: {
        from: "artists",
        localField: "artists",
        foreignField: "_id",
        as: "artists",
        pipeline: [
          {
            $project: {
              name: 1,
              avatar: 1,
              isVerified: 1,
              followersCount: 1,
              monthlyListeners: 1,
            },
          },
        ],
      },
    },
    {
      $lookup: {
        from: "topics",
        localField: "topicIds",
        foreignField: "_id",
        as: "topicIds",
        pipeline: [{ $project: { name: 1, avatar: 1 } }],
      },
    },
  ]);

  return songs;
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = { getSimilarSongs, getRecommendedSongs };
