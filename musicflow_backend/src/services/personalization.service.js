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
          select: "topicIds artists aiAnalysis title",
        })
        .lean(),
      Favorite.find({ userId: userObjId }).select("songId").lean(),
      SongLike.find({ userId: userObjId }).select("songId").lean(),
      User.findById(userObjId).select("favoriteSongs followedArtists aiMemory").lean(),
    ]);


    // Track recently played, skipped, and completed song IDs
    const recentlyPlayedSongIds = [];
    const recentSeen = new Set();
    const skippedSongSet = new Set();
    const completedSongSet = new Set();

    for (const evt of playEvents) {
      const sId = evt.songId?._id ? evt.songId._id.toString() : evt.songId?.toString();
      if (sId) {
        if (!recentSeen.has(sId)) {
          recentSeen.add(sId);
          recentlyPlayedSongIds.push(sId);
        }
        if (evt.skipped) {
          skippedSongSet.add(sId);
        }
        if (evt.completed || (evt.replayCount || 0) > 0) {
          completedSongSet.add(sId);
        }
      }
    }
    const skippedSongIds = Array.from(skippedSongSet);
    const completedSongIds = Array.from(completedSongSet);


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

    // Calculate or retrieve User.aiMemory
    let aiMemory = userDoc?.aiMemory || null;
    if (!isColdStart && playEvents.length >= 5) {
      aiMemory = await computeAndUpdateUserAiMemory(userKey, userObjId, playEvents, userDoc);
    } else if (!aiMemory) {
      aiMemory = {
        topMoods: [],
        topThemes: [],
        preferredEnergy: "mixed",
        timeSlotPreferences: {
          morning: { moods: [], energy: "mixed" },
          afternoon: { moods: [], energy: "mixed" },
          evening: { moods: [], energy: "mixed" },
          night: { moods: [], energy: "mixed" },
        },
        lastCalculatedAt: new Date(),
      };
    }

    const profile = {
      userId: userKey,
      isColdStart,
      preferredTopicIds: sortedTopicIds,
      preferredArtistIds: sortedArtistIds,
      recentlyPlayedSongIds,
      skippedSongIds,
      completedSongIds,
      favoriteSongIds,
      aiMemory,
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

// Configurable memory weights for preference calculation
const MEMORY_WEIGHTS = {
  completed: 3.0,
  normalPlay: 1.0,
  skipped: -2.0,
  replay: 3.0,
};

// In-memory lock map for deduplicating concurrent memory updates per user
const activeMemoryCalculationMap = new Map();

function getTimeSlot(date = new Date()) {
  const hour = new Date(date).getHours();
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  if (hour >= 18 && hour < 23) return "evening";
  return "night"; // 23:00 - 04:59
}

async function computeAndUpdateUserAiMemory(userKey, userObjId, playEvents, userDoc) {
  if (activeMemoryCalculationMap.has(userKey)) {
    return activeMemoryCalculationMap.get(userKey);
  }

  const calcPromise = (async () => {
    try {
      const moodScores = new Map();
      const themeScores = new Map();
      const energyScores = new Map();

      const timeSlotMaps = {
        morning: { moods: new Map(), energy: new Map() },
        afternoon: { moods: new Map(), energy: new Map() },
        evening: { moods: new Map(), energy: new Map() },
        night: { moods: new Map(), energy: new Map() },
      };

      for (const evt of playEvents) {
        const song = evt.songId && typeof evt.songId === "object" ? evt.songId : null;
        if (!song || !song.aiAnalysis || song.aiAnalysis.status !== "completed") continue;

        let weight = MEMORY_WEIGHTS.normalPlay;
        if (evt.skipped) {
          weight = MEMORY_WEIGHTS.skipped;
        } else if (evt.completed) {
          weight = MEMORY_WEIGHTS.completed;
        }
        if ((evt.replayCount || 0) > 0) {
          weight += MEMORY_WEIGHTS.replay;
        }

        const slot = getTimeSlot(evt.playedAt || evt.createdAt || new Date());
        const analysis = song.aiAnalysis;

        // Process moodTags
        if (Array.isArray(analysis.moodTags)) {
          analysis.moodTags.forEach((m) => {
            const tag = m.trim().toLowerCase();
            if (!tag) return;
            moodScores.set(tag, (moodScores.get(tag) || 0) + weight);
            if (weight > 0) {
              const slotMoods = timeSlotMaps[slot].moods;
              slotMoods.set(tag, (slotMoods.get(tag) || 0) + weight);
            }
          });
        }

        // Process themes
        if (Array.isArray(analysis.themes)) {
          analysis.themes.forEach((t) => {
            const theme = t.trim().toLowerCase();
            if (!theme) return;
            themeScores.set(theme, (themeScores.get(theme) || 0) + weight);
          });
        }

        // Process energyLevel
        if (analysis.energyLevel) {
          const energy = analysis.energyLevel.toLowerCase();
          energyScores.set(energy, (energyScores.get(energy) || 0) + weight);
          if (weight > 0) {
            const slotEnergy = timeSlotMaps[slot].energy;
            slotEnergy.set(energy, (slotEnergy.get(energy) || 0) + weight);
          }
        }
      }

      // Sort & extract top items
      const topMoods = Array.from(moodScores.entries())
        .filter(([_, score]) => score > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([tag]) => tag);

      const topThemes = Array.from(themeScores.entries())
        .filter(([_, score]) => score > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([theme]) => theme);

      const preferredEnergy = Array.from(energyScores.entries())
        .filter(([_, score]) => score > 0)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || "mixed";

      const timeSlotPreferences = {};
      ["morning", "afternoon", "evening", "night"].forEach((slot) => {
        const slotMoods = Array.from(timeSlotMaps[slot].moods.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([m]) => m);

        const slotEnergy = Array.from(timeSlotMaps[slot].energy.entries())
          .sort((a, b) => b[1] - a[1])[0]?.[0] || "mixed";

        timeSlotPreferences[slot] = { moods: slotMoods, energy: slotEnergy };
      });

      const aiMemory = {
        topMoods,
        topThemes,
        preferredEnergy,
        timeSlotPreferences,
        lastCalculatedAt: new Date(),
      };

      // Async background DB update to prevent blocking response latency
      User.updateOne({ _id: userObjId }, { $set: { aiMemory } }).catch((err) =>
        console.warn("[Personalization Service] User.aiMemory update failed:", err.message)
      );

      return aiMemory;
    } catch (err) {
      console.warn("[Personalization Service] Error in computeAndUpdateUserAiMemory:", err.message);
      return userDoc?.aiMemory || {
        topMoods: [],
        topThemes: [],
        preferredEnergy: "mixed",
        timeSlotPreferences: {
          morning: { moods: [], energy: "mixed" },
          afternoon: { moods: [], energy: "mixed" },
          evening: { moods: [], energy: "mixed" },
          night: { moods: [], energy: "mixed" },
        },
        lastCalculatedAt: new Date(),
      };
    }
  })();

  activeMemoryCalculationMap.set(userKey, calcPromise);
  try {
    return await calcPromise;
  } finally {
    activeMemoryCalculationMap.delete(userKey);
  }
}

module.exports = {
  getUserMusicProfile,
  clearUserCache,
  MEMORY_WEIGHTS,
  getTimeSlot,
};

