const mongoose = require("mongoose");
const SongPlayEvent = require("../models/song-play-event.model");
const Favorite = require("../models/favorite.model");
const SongLike = require("../models/song-like.model");
const User = require("../models/user.model");
const Song = require("../models/song.model");

// Simple in-memory profile cache with TTL
const profileCache = new Map();

/**
 * Computes or retrieves from cache the personalized music profile for a user.
 * Combines listening history (SongPlayEvent), explicit favorites (Favorite, SongLike),
 * and followed artists (User) without modifying any DB schemas.
 * 
 * @param {string|ObjectId} userId 
 * @param {Object} [options]
 * @param {number} [options.windowDays=30] - History time window in days
 * @param {number} [options.topicLimit=5] - Number of top preferred topics
 * @param {number} [options.artistLimit=5] - Number of top preferred artists
 * @param {number} [options.cacheTTLSeconds=300] - Cache TTL in seconds (default 5 mins)
 * @returns {Promise<Object>} User music profile
 */
async function getUserMusicProfile(userId, options = {}) {
  const {
    windowDays = 30,
    topicLimit = 5,
    artistLimit = 5,
    cacheTTLSeconds = 300,
  } = options;

  const defaultColdStart = {
    userId: userId ? userId.toString() : null,
    isColdStart: true,
    preferredTopicIds: [],
    preferredArtistIds: [],
    recentlyPlayedSongIds: [],
    favoriteSongIds: [],
    computedAt: new Date(),
  };

  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    return defaultColdStart;
  }

  const userKey = userId.toString();
  const now = Date.now();

  // 1. Check in-memory cache
  if (profileCache.has(userKey)) {
    const cached = profileCache.get(userKey);
    if (now - cached.timestamp < cacheTTLSeconds * 1000) {
      return cached.profile;
    }
  }

  try {
    const userObjId = new mongoose.Types.ObjectId(userKey);
    const windowDate = new Date(now - windowDays * 24 * 60 * 60 * 1000);

    // 2. Execute parallel queries on existing models
    const [playEvents, favorites, likes, userDoc] = await Promise.all([
      SongPlayEvent.find({ userId: userObjId, playedAt: { $gte: windowDate } })
        .sort({ playedAt: -1 })
        .limit(100)
        .populate({
          path: "songId",
          select: "topicIds artists",
        })
        .lean(),
      Favorite.find({ userId: userObjId }).select("songId").lean(),
      SongLike.find({ userId: userObjId }).select("songId").lean(),
      User.findById(userObjId).select("favoriteSongs followedArtists").lean(),
    ]);

    // Track recently played song IDs (up to 10)
    const recentlyPlayedSongIds = [];
    const recentSeen = new Set();
    for (const evt of playEvents) {
      const sId = evt.songId?._id ? evt.songId._id.toString() : evt.songId?.toString();
      if (sId && !recentSeen.has(sId)) {
        recentSeen.add(sId);
        recentlyPlayedSongIds.push(sId);
        if (recentlyPlayedSongIds.length >= 10) break;
      }
    }

    // Collect all favorite & liked song IDs
    const favSet = new Set();
    if (userDoc?.favoriteSongs) {
      userDoc.favoriteSongs.forEach((id) => favSet.add(id.toString()));
    }
    favorites.forEach((f) => favSet.add(f.songId.toString()));
    likes.forEach((l) => favSet.add(l.songId.toString()));
    const favoriteSongIds = Array.from(favSet);

    // Topic & Artist frequency scoring counters
    const topicFrequencyMap = new Map();
    const artistFrequencyMap = new Map();

    function addTopicCount(tId, count = 1) {
      if (!tId) return;
      const key = tId.toString();
      topicFrequencyMap.set(key, (topicFrequencyMap.get(key) || 0) + count);
    }

    function addArtistCount(aId, count = 1) {
      if (!aId) return;
      const key = aId.toString();
      artistFrequencyMap.set(key, (artistFrequencyMap.get(key) || 0) + count);
    }

    // Add weights from followed artists
    if (userDoc?.followedArtists) {
      userDoc.followedArtists.forEach((aId) => addArtistCount(aId, 3));
    }

    // Process play events (more recent events get higher frequency count)
    playEvents.forEach((evt) => {
      if (evt.artistId) addArtistCount(evt.artistId, 2);
      if (evt.artistIds && Array.isArray(evt.artistIds)) {
        evt.artistIds.forEach((aId) => addArtistCount(aId, 2));
      }

      if (evt.songId && typeof evt.songId === "object") {
        if (Array.isArray(evt.songId.topicIds)) {
          evt.songId.topicIds.forEach((tId) => addTopicCount(tId, 2));
        }
        if (Array.isArray(evt.songId.artists)) {
          evt.songId.artists.forEach((aId) => addArtistCount(aId, 2));
        }
      }
    });

    // If favorite songs exist, fetch their topics & artists to enhance preference scoring
    if (favoriteSongIds.length > 0) {
      const favSongs = await Song.find({ _id: { $in: favoriteSongIds.slice(0, 30) } })
        .select("topicIds artists")
        .lean();
      
      favSongs.forEach((song) => {
        if (Array.isArray(song.topicIds)) {
          song.topicIds.forEach((tId) => addTopicCount(tId, 3));
        }
        if (Array.isArray(song.artists)) {
          song.artists.forEach((aId) => addArtistCount(aId, 3));
        }
      });
    }

    // Sort topics by score descending
    const sortedTopicIds = Array.from(topicFrequencyMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, topicLimit)
      .map((item) => item[0]);

    // Sort artists by score descending
    const sortedArtistIds = Array.from(artistFrequencyMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, artistLimit)
      .map((item) => item[0]);

    const isColdStart = playEvents.length === 0 && favoriteSongIds.length === 0 && (userDoc?.followedArtists?.length || 0) === 0;

    const profile = {
      userId: userKey,
      isColdStart,
      preferredTopicIds: sortedTopicIds,
      preferredArtistIds: sortedArtistIds,
      recentlyPlayedSongIds,
      favoriteSongIds,
      computedAt: new Date(),
    };

    // Store in cache
    profileCache.set(userKey, {
      profile,
      timestamp: now,
    });

    return profile;
  } catch (err) {
    console.warn("[Personalization Service] Error computing profile, returning cold-start fallback:", err.message);
    return defaultColdStart;
  }
}

/**
 * Clears cached profile for a user (useful during tests or when profile is updated)
 */
function clearUserCache(userId) {
  if (userId) {
    profileCache.delete(userId.toString());
  } else {
    profileCache.clear();
  }
}

module.exports = {
  getUserMusicProfile,
  clearUserCache,
};
