const mongoose = require("mongoose");
const Song = require("../models/song.model");

const aiDataLoader = require("../ai/aiDataLoader.service");

/**
 * Default Configurable Strategy Weights and Options.
 * Easily overridable for A/B testing and benchmarking without modifying code logic.
 */
const recommendationRule = aiDataLoader.getRule("recommendation");
const DEFAULT_RECOMMENDATION_CONFIG = {
  weights: {
    matchingTopicWeight: 5.0,        // Score added if song matches user's preferred topics
    matchingArtistWeight: 8.0,       // Score added if song matches user's preferred artists
    isFavoriteOrLikedWeight: 10.0,   // Score added if song is favorited or liked by user
    recentlyPlayedPenalty: -3.0,     // Penalty score for songs played recently to reduce repeat fatigue
    skippedPenalty: -8.0,            // Penalty for songs recently skipped (<30s & <30%)
    completionBonus: 5.0,            // Bonus for songs listened to completion (>=85%)
    replayBonus: 3.0,                // Cautious early bonus for replayed songs
    ...(recommendationRule.phase2Config?.weights || {}),
    ...(recommendationRule.feedbackWeights || {}),
  },
  candidateLimit: 50,                // Maximum candidates fetched for Gemini context
  fallbackLimit: 30,                 // Candidate limit for cold-start popularity fallback
};

/**
 * Calculates candidate recommendation score for a single song object based on user profile and config.
 * 
 * @param {Object} song - Populated or raw Mongoose Song document
 * @param {Object} options
 * @param {Object} options.userProfile - User music profile
 * @param {Object} [options.config] - Scoring configuration
 * @returns {number} Final calculated score
 */
function calculateSongScore(song, { userProfile, config = DEFAULT_RECOMMENDATION_CONFIG } = {}) {
  if (!song || !userProfile || userProfile.isColdStart) {
    return 0;
  }

  const weights = {
    ...DEFAULT_RECOMMENDATION_CONFIG.weights,
    ...(config?.weights || {}),
  };

  let score = 0;
  const songIdStr = song._id ? song._id.toString() : song.toString();

  // 1. Topic Match Score
  if (Array.isArray(song.topicIds) && Array.isArray(userProfile.preferredTopicIds)) {
    const topicSet = new Set(userProfile.preferredTopicIds.map((id) => id.toString()));
    const topicMatches = song.topicIds.filter((t) => {
      const tId = t._id ? t._id.toString() : t.toString();
      return topicSet.has(tId);
    }).length;

    if (topicMatches > 0) {
      score += weights.matchingTopicWeight * topicMatches;
    }
  }

  // 2. Artist Match Score
  if (Array.isArray(song.artists) && Array.isArray(userProfile.preferredArtistIds)) {
    const artistSet = new Set(userProfile.preferredArtistIds.map((id) => id.toString()));
    const artistMatches = song.artists.filter((a) => {
      const aId = a._id ? a._id.toString() : a.toString();
      return artistSet.has(aId);
    }).length;

    if (artistMatches > 0) {
      score += weights.matchingArtistWeight * artistMatches;
    }
  }

  // 3. Favorite / Liked Song Score
  if (Array.isArray(userProfile.favoriteSongIds)) {
    const favSet = new Set(userProfile.favoriteSongIds.map((id) => id.toString()));
    if (favSet.has(songIdStr)) {
      score += weights.isFavoriteOrLikedWeight;
    }
  }

  // 4. Recently Played Penalty (prevents immediate repetition)
  if (Array.isArray(userProfile.recentlyPlayedSongIds)) {
    const recentSet = new Set(userProfile.recentlyPlayedSongIds.map((id) => id.toString()));
    if (recentSet.has(songIdStr)) {
      score += weights.recentlyPlayedPenalty;
    }
  }

  // 5. Skipped Song Penalty (Phase 4A Feedback Learning)
  if (Array.isArray(userProfile.skippedSongIds)) {
    const skipSet = new Set(userProfile.skippedSongIds.map((id) => id.toString()));
    if (skipSet.has(songIdStr)) {
      score += weights.skippedPenalty;
    }
  }

  // 6. Completed / Replayed Song Bonus (Phase 4A Feedback Learning)
  if (Array.isArray(userProfile.completedSongIds)) {
    const completedSet = new Set(userProfile.completedSongIds.map((id) => id.toString()));
    if (completedSet.has(songIdStr)) {
      score += weights.completionBonus;
    }
  }

  // 7. AI Semantic Song Intelligence Bonus (Phase 5A)
  if (song.aiAnalysis?.status === "completed" && Array.isArray(song.aiAnalysis.moodTags) && song.aiAnalysis.moodTags.length > 0) {
    score += (weights.semanticMoodBonus || 4.0);
  }

  return score;
}



/**
 * Retrieves personalized or cold-start candidate songs from MongoDB based on query criteria & user profile.
 * 
 * @param {Object} options
 * @param {Array<string|ObjectId>} [options.topicIds] - Topic IDs matched from query/mood
 * @param {Array<string|ObjectId>} [options.artistIds] - Artist IDs matched from query/mood
 * @param {Array<string>} [options.keywords] - Keywords extracted from query
 * @param {Object} [options.userProfile] - User music profile (from personalization.service)
 * @param {Object} [options.config] - Recommendation scoring configuration
 * @returns {Promise<Object>} Object containing candidates, isPersonalized, and scoring stats
 */
async function getPersonalizedCandidates({
  topicIds = [],
  artistIds = [],
  keywords = [],
  userProfile = null,
  config = DEFAULT_RECOMMENDATION_CONFIG,
} = {}) {
  const mergedConfig = {
    ...DEFAULT_RECOMMENDATION_CONFIG,
    ...config,
    weights: {
      ...DEFAULT_RECOMMENDATION_CONFIG.weights,
      ...(config?.weights || {}),
    },
  };

  const isColdStart = !userProfile || userProfile.isColdStart;

  // --- COLD START / FALLBACK PATH ---
  if (isColdStart) {
    const filter = { isPublic: true };
    const orConditions = [];

    if (topicIds.length > 0) {
      orConditions.push({ topicIds: { $in: topicIds } });
    }
    if (artistIds.length > 0) {
      orConditions.push({ artists: { $in: artistIds } });
    }
    if (orConditions.length > 0) {
      filter.$or = orConditions;
    }

    const fallbackSongs = await Song.find(filter)
      .populate("artists", "name avatar")
      .populate("topicIds", "name description")
      .sort({ playCount: -1, likeCount: -1, createdAt: -1 })
      .limit(mergedConfig.fallbackLimit)
      .lean();

    return {
      isPersonalized: false,
      reason: "cold_start_fallback",
      candidates: fallbackSongs,
      totalCandidates: fallbackSongs.length,
    };
  }

  // --- PERSONALIZED PATH ---
  // Combine query topic/artist criteria with User's preferred topics & artists
  const mergedTopicIds = Array.from(new Set([
    ...topicIds.map((id) => id.toString()),
    ...(userProfile.preferredTopicIds || []).map((id) => id.toString()),
  ])).map((id) => new mongoose.Types.ObjectId(id));

  const mergedArtistIds = Array.from(new Set([
    ...artistIds.map((id) => id.toString()),
    ...(userProfile.preferredArtistIds || []).map((id) => id.toString()),
  ])).map((id) => new mongoose.Types.ObjectId(id));

  const filter = { isPublic: true };
  const orConditions = [];

  if (mergedTopicIds.length > 0) {
    orConditions.push({ topicIds: { $in: mergedTopicIds } });
  }
  if (mergedArtistIds.length > 0) {
    orConditions.push({ artists: { $in: mergedArtistIds } });
  }
  if (userProfile.favoriteSongIds && userProfile.favoriteSongIds.length > 0) {
    const favObjIds = userProfile.favoriteSongIds.map((id) => new mongoose.Types.ObjectId(id));
    orConditions.push({ _id: { $in: favObjIds } });
  }

  if (orConditions.length > 0) {
    filter.$or = orConditions;
  }

  // Fetch raw candidate pool
  const candidatePool = await Song.find(filter)
    .populate("artists", "name avatar")
    .populate("topicIds", "name description")
    .limit(100)
    .lean();

  // Score & Rank each candidate song
  const scoredCandidates = candidatePool.map((song) => {
    const personalizationScore = calculateSongScore(song, { userProfile, config: mergedConfig });
    const popularityScore = (song.playCount || 0) * 0.05 + (song.likeCount || 0) * 0.1;
    const finalScore = personalizationScore + popularityScore;

    return {
      song,
      personalizationScore,
      popularityScore,
      finalScore,
    };
  });

  // Sort descending by finalScore
  scoredCandidates.sort((a, b) => b.finalScore - a.finalScore);

  const finalCandidates = scoredCandidates
    .slice(0, mergedConfig.candidateLimit)
    .map((item) => ({
      ...item.song,
      _personalizationScore: item.personalizationScore,
      _finalScore: item.finalScore,
    }));

  return {
    isPersonalized: true,
    reason: "personalized_scoring",
    candidates: finalCandidates,
    totalCandidates: finalCandidates.length,
    topScoredCount: finalCandidates.filter((s) => (s._personalizationScore || 0) > 0).length,
  };
}

// ---------------------------------------------------------------------------
// REST API Public Endpoints Helpers (Similar Songs & Random Recommendations)
// ---------------------------------------------------------------------------

const songRepo = require("../repositories/song.repository");

/**
 * Return `limit` songs that are similar to the target song.
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

  const candidates = await songRepo.findSimilarCandidates({
    excludeId: targetSong._id,
    artistIds: targetArtistIds,
    topicIds: targetTopicIds,
    limit: 200,
  });

  const targetArtistSet = new Set(targetArtistIds);
  const targetTopicSet = new Set(targetTopicIds);

  const scored = candidates.map((song) => {
    let score = 0;
    const hasArtistMatch = (song.artists || []).some((a) =>
      targetArtistSet.has(a._id ? a._id.toString() : a.toString())
    );
    if (hasArtistMatch) score += 5;

    const matchingTopics = (song.topicIds || []).filter((t) =>
      targetTopicSet.has(t._id ? t._id.toString() : t.toString())
    ).length;
    score += matchingTopics * 3;

    score += Math.log((song.playCount || 0) + 1) * 0.5;
    return { song, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const shuffled = scored
    .slice(0, 30)
    .map((item) => item.song)
    .sort(() => 0.5 - Math.random());

  return shuffled.slice(0, clampedLimit);
};

/**
 * Return `limit` randomly sampled public songs using MongoDB's $sample aggregation stage
 */
const getRecommendedSongs = async (limit = 12) => {
  const clampedLimit = Math.min(Math.max(Number(limit) || 12, 1), 50);

  const songs = await Song.aggregate([
    { $match: { isPublic: true } },
    { $sample: { size: clampedLimit } },
    {
      $project: {
        title: 1,
        slug: 1,
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
              slug: 1,
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

module.exports = {
  DEFAULT_RECOMMENDATION_CONFIG,
  calculateSongScore,
  getPersonalizedCandidates,
  getSimilarSongs,
  getRecommendedSongs,
};

