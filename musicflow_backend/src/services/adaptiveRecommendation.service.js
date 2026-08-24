const mongoose = require("mongoose");
const SongPlayEvent = require("../models/song-play-event.model");
const Song = require("../models/song.model");
const recommendationService = require("./recommendation.service");

// In-memory recent interest profile cache with TTL
const recentProfileCache = new Map();

/**
 * Default Configurable Strategy Weights for Phase 3 Adaptive Recommendation Engine.
 * Easily benchmarked and tuned without modifying core business logic.
 */
const DEFAULT_ADAPTIVE_CONFIG = {
  strategyWeights: {
    longTermWeight: 0.70,      // 70% Long-term profile match (Phase 2 30-day window)
    recentInterestWeight: 0.20, // 20% Recent interest trend (7-day window)
    explorationWeight: 0.10,   // 10% Exploration / Discovery of fresh unplayed songs
  },
  recentWindowDays: 7,          // Time window for recent interest (days)
  longTermWindowDays: 30,       // Time window for long-term profile (days)
  recentTopicLimit: 3,          // Max top topics for recent interest
  recentArtistLimit: 3,         // Max top artists for recent interest
  candidateLimit: 50,           // Max candidates returned for Gemini context
  cacheTTLSeconds: 180,         // Cache TTL in seconds (3 minutes)
};

/**
 * Computes or retrieves from cache the recent interest profile (last 7 days) for a user.
 * 
 * @param {string|ObjectId} userId 
 * @param {Object} [options]
 * @param {number} [options.windowDays=7]
 * @param {number} [options.recentTopicLimit=3]
 * @param {number} [options.recentArtistLimit=3]
 * @param {number} [options.cacheTTLSeconds=180]
 * @returns {Promise<Object>} Recent interest profile
 */
async function getRecentInterestProfile(userId, options = {}) {
  const {
    windowDays = 7,
    recentTopicLimit = 3,
    recentArtistLimit = 3,
    cacheTTLSeconds = 180,
  } = options;

  const defaultColdStart = {
    userId: userId ? userId.toString() : null,
    isColdStart: true,
    recentTopicIds: [],
    recentArtistIds: [],
    recentPlayedSongIds: [],
    computedAt: new Date(),
  };

  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    return defaultColdStart;
  }

  const userKey = `recent_${userId.toString()}`;
  const now = Date.now();

  // 1. Check in-memory cache
  if (recentProfileCache.has(userKey)) {
    const cached = recentProfileCache.get(userKey);
    if (now - cached.timestamp < cacheTTLSeconds * 1000) {
      return cached.profile;
    }
  }

  try {
    const userObjId = new mongoose.Types.ObjectId(userId.toString());
    const windowDate = new Date(now - windowDays * 24 * 60 * 60 * 1000);

    // 2. Reuse pre-fetched playEvents if passed in options, otherwise execute MongoDB query
    let recentPlayEvents = options.playEvents || null;
    if (!recentPlayEvents) {
      recentPlayEvents = await SongPlayEvent.find({
        userId: userObjId,
        playedAt: { $gte: windowDate },
      })
        .sort({ playedAt: -1 })
        .limit(50)
        .populate({
          path: "songId",
          select: "topicIds artists",
        })
        .lean();
    } else {
      // Filter pre-fetched events for the 7-day window
      recentPlayEvents = recentPlayEvents.filter((evt) => evt.playedAt && new Date(evt.playedAt) >= windowDate);
    }


    if (!recentPlayEvents || recentPlayEvents.length === 0) {
      return defaultColdStart;
    }

    const topicFreqMap = new Map();
    const artistFreqMap = new Map();
    const recentPlayedSongIds = [];
    const seenSongs = new Set();

    recentPlayEvents.forEach((evt) => {
      const sId = evt.songId?._id ? evt.songId._id.toString() : evt.songId?.toString();
      if (sId && !seenSongs.has(sId)) {
        seenSongs.add(sId);
        recentPlayedSongIds.push(sId);
      }

      if (evt.artistId) {
        const aId = evt.artistId.toString();
        artistFreqMap.set(aId, (artistFreqMap.get(aId) || 0) + 3);
      }

      if (evt.songId && typeof evt.songId === "object") {
        if (Array.isArray(evt.songId.topicIds)) {
          evt.songId.topicIds.forEach((tId) => {
            const key = tId.toString();
            topicFreqMap.set(key, (topicFreqMap.get(key) || 0) + 3);
          });
        }
        if (Array.isArray(evt.songId.artists)) {
          evt.songId.artists.forEach((aId) => {
            const key = aId.toString();
            artistFreqMap.set(key, (artistFreqMap.get(key) || 0) + 2);
          });
        }
      }
    });

    const recentTopicIds = Array.from(topicFreqMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, recentTopicLimit)
      .map((item) => item[0]);

    const recentArtistIds = Array.from(artistFreqMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, recentArtistLimit)
      .map((item) => item[0]);

    const profile = {
      userId: userId.toString(),
      isColdStart: false,
      recentTopicIds,
      recentArtistIds,
      recentPlayedSongIds: recentPlayedSongIds.slice(0, 10),
      computedAt: new Date(),
    };

    // Store in cache
    recentProfileCache.set(userKey, {
      profile,
      timestamp: now,
    });

    return profile;
  } catch (err) {
    console.warn("[Adaptive Recommendation] Error computing recent profile, fallback:", err.message);
    return defaultColdStart;
  }
}

/**
 * Calculates adaptive score for a candidate song combining:
 * 1. Long-term preference score (Phase 2)
 * 2. Recent 7-day interest score (Phase 3)
 * 3. Exploration / Discovery score (Phase 3)
 * 
 * @param {Object} song 
 * @param {Object} options
 * @param {Object} options.userProfile - Long-term profile from Phase 2
 * @param {Object} [options.recentProfile] - Recent interest profile (7 days)
 * @param {Object} [options.config] - Adaptive configuration weights
 * @returns {Object} Score details Breakdown
 */
function calculateAdaptiveScore(song, { userProfile, recentProfile = null, config = DEFAULT_ADAPTIVE_CONFIG } = {}) {
  if (!song || (!userProfile && !recentProfile)) {
    return { finalScore: 0, longTermScore: 0, recentInterestScore: 0, explorationScore: 0 };
  }

  const weights = {
    ...DEFAULT_ADAPTIVE_CONFIG.strategyWeights,
    ...(config?.strategyWeights || {}),
  };

  const songIdStr = song._id ? song._id.toString() : song.toString();

  // 1. Long-Term Profile Score (Exploitation - Phase 2)
  const longTermRawScore = userProfile && !userProfile.isColdStart
    ? recommendationService.calculateSongScore(song, { userProfile, config })
    : 0;

  // 2. Recent Interest Score (7-day Listen Trends)
  let recentInterestRawScore = 0;
  if (recentProfile && !recentProfile.isColdStart) {
    const recentTopicSet = new Set((recentProfile.recentTopicIds || []).map((id) => id.toString()));
    const recentArtistSet = new Set((recentProfile.recentArtistIds || []).map((id) => id.toString()));

    if (Array.isArray(song.topicIds)) {
      song.topicIds.forEach((t) => {
        const tId = t._id ? t._id.toString() : t.toString();
        if (recentTopicSet.has(tId)) recentInterestRawScore += 10.0;
      });
    }

    if (Array.isArray(song.artists)) {
      song.artists.forEach((a) => {
        const aId = a._id ? a._id.toString() : a.toString();
        if (recentArtistSet.has(aId)) recentInterestRawScore += 15.0;
      });
    }
  }

  // 3. Exploration Score (Fresh Music Discovery within preferred topics)
  let explorationRawScore = 0;
  const isFavoriteOrLiked = userProfile?.favoriteSongIds?.includes(songIdStr);
  const isRecentlyPlayed = (userProfile?.recentlyPlayedSongIds?.includes(songIdStr)) ||
                           (recentProfile?.recentPlayedSongIds?.includes(songIdStr));

  // If song is NOT favorited and NOT recently played BUT matches preferred topics -> Exploration Bonus!
  if (!isFavoriteOrLiked && !isRecentlyPlayed) {
    const preferredTopics = new Set([
      ...(userProfile?.preferredTopicIds || []),
      ...(recentProfile?.recentTopicIds || []),
    ].map((id) => id.toString()));

    if (Array.isArray(song.topicIds)) {
      const topicMatches = song.topicIds.filter((t) => {
        const tId = t._id ? t._id.toString() : t.toString();
        return preferredTopics.has(tId);
      }).length;

      if (topicMatches > 0) {
        explorationRawScore = 12.0 * topicMatches;
      }
    }
  }

  // Final Weighted Score
  const finalScore =
    (longTermRawScore * weights.longTermWeight) +
    (recentInterestRawScore * weights.recentInterestWeight) +
    (explorationRawScore * weights.explorationWeight);

  return {
    finalScore,
    longTermScore: longTermRawScore * weights.longTermWeight,
    recentInterestScore: recentInterestRawScore * weights.recentInterestWeight,
    explorationScore: explorationRawScore * weights.explorationWeight,
  };
}

/**
 * Retrieves candidate songs scored & ranked by the Phase 3 Adaptive Recommendation Engine.
 * 
 * @param {Object} options
 * @param {Array<string|ObjectId>} [options.topicIds]
 * @param {Array<string|ObjectId>} [options.artistIds]
 * @param {Object} [options.userProfile] - Phase 2 Long-Term Profile
 * @param {Object} [options.recentProfile] - Phase 3 Recent Interest Profile
 * @param {Object} [options.config] - Adaptive configuration
 * @returns {Promise<Object>} Adaptive recommendation result
 */
async function getAdaptiveCandidates({
  topicIds = [],
  artistIds = [],
  userProfile = null,
  recentProfile = null,
  config = DEFAULT_ADAPTIVE_CONFIG,
} = {}) {
  const mergedConfig = {
    ...DEFAULT_ADAPTIVE_CONFIG,
    ...config,
    strategyWeights: {
      ...DEFAULT_ADAPTIVE_CONFIG.strategyWeights,
      ...(config?.strategyWeights || {}),
    },
  };

  const isColdStart = (!userProfile || userProfile.isColdStart) && (!recentProfile || recentProfile.isColdStart);

  // --- COLD START FALLBACK ---
  if (isColdStart) {
    const phase2Fallback = await recommendationService.getPersonalizedCandidates({
      topicIds,
      artistIds,
      userProfile: { isColdStart: true },
      config: mergedConfig,
    });

    return {
      isAdaptive: false,
      reason: "cold_start_fallback",
      candidates: phase2Fallback.candidates,
      totalCandidates: phase2Fallback.totalCandidates,
    };
  }

  // --- ADAPTIVE CANDIDATE QUERY ---
  // Merge topic & artist search criteria from long-term + recent profiles
  const mergedTopicIds = Array.from(new Set([
    ...topicIds.map((id) => id.toString()),
    ...(userProfile?.preferredTopicIds || []).map((id) => id.toString()),
    ...(recentProfile?.recentTopicIds || []).map((id) => id.toString()),
  ])).map((id) => new mongoose.Types.ObjectId(id));

  const mergedArtistIds = Array.from(new Set([
    ...artistIds.map((id) => id.toString()),
    ...(userProfile?.preferredArtistIds || []).map((id) => id.toString()),
    ...(recentProfile?.recentArtistIds || []).map((id) => id.toString()),
  ])).map((id) => new mongoose.Types.ObjectId(id));

  const filter = { isPublic: true };
  const orConditions = [];

  if (mergedTopicIds.length > 0) {
    orConditions.push({ topicIds: { $in: mergedTopicIds } });
  }
  if (mergedArtistIds.length > 0) {
    orConditions.push({ artists: { $in: mergedArtistIds } });
  }

  if (orConditions.length > 0) {
    filter.$or = orConditions;
  }

  const candidatePool = await Song.find(filter)
    .populate("artists", "name avatar")
    .populate("topicIds", "name description")
    .limit(100)
    .lean();

  // Score candidates with Adaptive Strategy
  const scoredCandidates = candidatePool.map((song) => {
    const scoreDetails = calculateAdaptiveScore(song, {
      userProfile,
      recentProfile,
      config: mergedConfig,
    });

    const popularityScore = (song.playCount || 0) * 0.05 + (song.likeCount || 0) * 0.1;
    const finalScore = scoreDetails.finalScore + popularityScore;

    return {
      song,
      scoreDetails,
      popularityScore,
      finalScore,
    };
  });

  scoredCandidates.sort((a, b) => b.finalScore - a.finalScore);

  const finalCandidates = scoredCandidates
    .slice(0, mergedConfig.candidateLimit)
    .map((item) => ({
      ...item.song,
      _adaptiveScore: item.scoreDetails.finalScore,
      _scoreDetails: item.scoreDetails,
      _finalScore: item.finalScore,
    }));

  return {
    isAdaptive: true,
    reason: "adaptive_scoring",
    candidates: finalCandidates,
    totalCandidates: finalCandidates.length,
    strategyWeights: mergedConfig.strategyWeights,
  };
}

/**
 * Clears recent profile cache
 */
function clearRecentProfileCache(userId) {
  if (userId) {
    recentProfileCache.delete(`recent_${userId.toString()}`);
  } else {
    recentProfileCache.clear();
  }
}

module.exports = {
  DEFAULT_ADAPTIVE_CONFIG,
  getRecentInterestProfile,
  calculateAdaptiveScore,
  getAdaptiveCandidates,
  clearRecentProfileCache,
};
