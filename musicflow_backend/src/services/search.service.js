/**
 * search.service.js — Hybrid Semantic & Full-Text Search Engine for MusicFlow.
 *
 * Architecture:
 *   1. Keyword Regex Layer: Exact/fuzzy token matching for title, artist, playlist, topic (accent-insensitive).
 *   2. Semantic Intent Layer: Natural language intent parser with Gemini Router + In-memory LRU TTL Cache.
 *   3. Multi-Signal Matcher: Matches both lyrics-rich songs and lyrics-empty songs (via aiAnalysis moodTags, themes, tags, genre).
 *   4. Hybrid Ranker: Blends keyword exactness, semantic relevance, and song popularity.
 *   5. Instant Fallback: Falls back gracefully to standard keyword search on AI timeout/failure.
 */

const mongoose = require("mongoose");
const Artist = require("../models/artist.model");
const Song = require("../models/song.model");
const Playlist = require("../models/playlist.model");
const aiDataLoader = require("../ai/aiDataLoader.service");
const geminiRouter = require("./geminiRouter.service");
const { buildSearchRegexes, normalizeText, extractCleanLyrics, escapeRegex } = require("../utils/string.util");
const { findArtistBySlugOrId } = require("../utils/artist.util");
const { SONG_PUBLIC_SELECT, ARTIST_POPULATE, TOPIC_POPULATE } = require("../repositories/song.repository");

// ---------------------------------------------------------------------------
// In-Memory LRU Cache for Search Intents
// ---------------------------------------------------------------------------
const INTENT_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_CACHE_ENTRIES = 500;
const intentCache = new Map();

function getCachedIntent(key) {
  const item = intentCache.get(key);
  if (!item) return null;
  if (Date.now() - item.timestamp > INTENT_CACHE_TTL_MS) {
    intentCache.delete(key);
    return null;
  }
  return item.data;
}

function setCachedIntent(key, data) {
  if (intentCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = intentCache.keys().next().value;
    if (oldestKey) intentCache.delete(oldestKey);
  }
  intentCache.set(key, { data, timestamp: Date.now() });
}

// ---------------------------------------------------------------------------
// Natural Query Detector & Heuristic Fallback
// ---------------------------------------------------------------------------

const NATURAL_INTENT_PATTERNS = [
  /\b(nhac|bai hat|ca khuc|giai dieu)\b/i,
  /\b(ve|cam giac|tam trang|nghe|luc|khi|ban|dem|ngay|mua|nang)\b/i,
  /\b(buon|chill|lofi|tam trang|chia tay|nho|khoc|co don|lang man|thu gian|nhe nhang|soi dong|nang luong|vibe)\b/i,
];

function isNaturalLanguageQuery(query = "") {
  const norm = normalizeText(query);
  const words = norm.split(" ").filter(Boolean);
  if (words.length >= 3) {
    return NATURAL_INTENT_PATTERNS.some((pattern) => pattern.test(norm));
  }
  if (words.length >= 2) {
    return /(buon|chill|lofi|chia tay|tam trang|nhe nhang|soi dong|co don|nho)/i.test(norm);
  }
  return false;
}

function heuristicExtractIntent(query = "") {
  const norm = normalizeText(query);
  const targetMoods = [];
  const targetThemes = [];
  let targetEnergy = "medium";
  const targetGenres = [];
  const semanticKeywords = [];

  if (/buon|khoc|co don|dau|suy/i.test(norm)) {
    targetMoods.push("buồn", "cô đơn");
    targetThemes.push("chia tay", "tình yêu");
    targetEnergy = "low";
  }
  if (/chill|lofi|thu gian|nhe nhang|em dem|cafe|dem/i.test(norm)) {
    targetMoods.push("chill", "xoa dịu", "tập trung");
    targetThemes.push("thư giãn", "đêm khuya");
    targetEnergy = "low";
  }
  if (/soi dong|nhay|party|tap gym|nang luong|chay/i.test(norm)) {
    targetMoods.push("năng lượng", "sảng khoái");
    targetThemes.push("tiệc tùng", "động lực");
    targetEnergy = "high";
  }
  if (/chia tay|nguoi yeu cu|that tinh|roi xa/i.test(norm)) {
    targetThemes.push("chia tay", "tình yêu", "người yêu cũ");
    targetMoods.push("buồn", "hoài niệm");
    semanticKeywords.push("chia tay", "người yêu cũ");
  }
  if (/dem|khuya|toi/i.test(norm)) {
    targetThemes.push("đêm khuya", "cô đơn");
    targetMoods.push("chill", "cô đơn");
  }

  return {
    isNaturalQuery: targetMoods.length > 0 || targetThemes.length > 0,
    targetMoods,
    targetThemes,
    targetGenres,
    targetEnergy,
    semanticKeywords,
  };
}

/**
 * Extract semantic search intent from natural language query.
 * @param {string} query
 * @returns {Promise<object>}
 */
async function extractSemanticSearchIntent(query = "") {
  const trimmed = query.trim();
  if (!trimmed) return heuristicExtractIntent("");

  const cacheKey = normalizeText(trimmed);
  const cached = getCachedIntent(cacheKey);
  if (cached) return cached;

  if (!isNaturalLanguageQuery(trimmed)) {
    const fastIntent = heuristicExtractIntent(trimmed);
    setCachedIntent(cacheKey, fastIntent);
    return fastIntent;
  }

  const systemPrompt = aiDataLoader.getPrompt("search-intent");
  const fullPrompt = `${systemPrompt}\n\nCÂU TÌM KIẾM CỦA NGƯỜI DÙNG: "${trimmed}"`;

  try {
    const { GoogleGenerativeAI } = require("@google/generative-ai");

    const responseText = await geminiRouter.executeWithModelRouter({
      userTier: "basic",
      requiresTools: false,
      task: async (modelName) => {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({
          model: modelName,
          systemInstruction: "You are a specialized music search intent parser. Output 100% valid JSON matching the requested schema without markdown wrapping.",
        });

        const result = await model.generateContent(fullPrompt);
        return result?.response?.text?.() || "";
      },
    });

    if (!responseText || !responseText.trim()) {
      throw new Error("Empty response from Search Intent Router");
    }

    let cleanJsonStr = responseText.trim();
    if (cleanJsonStr.startsWith("```")) {
      cleanJsonStr = cleanJsonStr.replace(/^```(json)?/i, "").replace(/```$/, "").trim();
    }

    const parsed = JSON.parse(cleanJsonStr);
    const intentResult = {
      isNaturalQuery: true,
      targetMoods: Array.isArray(parsed.targetMoods) ? parsed.targetMoods.map((s) => String(s).toLowerCase().trim()).filter(Boolean) : [],
      targetThemes: Array.isArray(parsed.targetThemes) ? parsed.targetThemes.map((s) => String(s).toLowerCase().trim()).filter(Boolean) : [],
      targetGenres: Array.isArray(parsed.targetGenres) ? parsed.targetGenres.map((s) => String(s).trim()).filter(Boolean) : [],
      targetEnergy: String(parsed.targetEnergy || "medium").toLowerCase(),
      semanticKeywords: Array.isArray(parsed.semanticKeywords) ? parsed.semanticKeywords.map((s) => String(s).toLowerCase().trim()).filter(Boolean) : [],
    };

    setCachedIntent(cacheKey, intentResult);
    return intentResult;
  } catch (error) {
    console.warn(`[SearchService] AI intent extraction failed (${error.message}). Using heuristic intent.`);
    const fallbackIntent = heuristicExtractIntent(trimmed);
    setCachedIntent(cacheKey, fallbackIntent);
    return fallbackIntent;
  }
}

// ---------------------------------------------------------------------------
// Hybrid Scoring & Ranking Logic
// ---------------------------------------------------------------------------

function scoreSongRelevance(song, query, regexes, intent, matchedArtists = [], extraTitleRegexes = []) {
  let score = 0;
  const songTitleNorm = normalizeText(song.title || "");
  const queryNorm = normalizeText(query || "");
  const rawTitle = String(song.title || "").trim().toLowerCase();
  const rawQuery = String(query || "").trim().toLowerCase();

  const artistsList = Array.isArray(song.artists) ? song.artists : [];
  const songArtistIds = artistsList.map((a) => String(typeof a === "object" ? a._id || a.id || "" : a)).filter(Boolean);
  const matchedArtistIdSet = new Set(matchedArtists.map((a) => String(a._id || a.id || "")));
  const isSongByMatchedArtist = matchedArtists.length > 0 && songArtistIds.some((id) => matchedArtistIdSet.has(id));

  // =========================================================================
  // 1. TITLE MATCHING (TIER 1 - HIGHEST PRIORITY)
  // =========================================================================
  const isFullWordPrefix = songTitleNorm.startsWith(queryNorm) &&
    (songTitleNorm.length === queryNorm.length || songTitleNorm[queryNorm.length] === " ");

  if (songTitleNorm === queryNorm) {
    // Exact full title match (e.g. "Ai Đợi Mình Được Mãi" === "Ai Đợi Mình Được Mãi")
    score += 650;
  } else if (isFullWordPrefix) {
    // Direct whole-word prefix match (e.g. "Ai Đợi Mình Được Mãi" starts with "ai đợi mình ")
    score += 500;
    // Extra bonus if Vietnamese accents match exactly
    if (rawTitle.startsWith(rawQuery)) {
      score += 50;
    }
  } else if (songTitleNorm.startsWith(queryNorm)) {
    // Partial-word prefix match
    score += 320;
  } else if (new RegExp(`(^|\\s)${escapeRegex(queryNorm)}(\\s|$)`, "i").test(songTitleNorm)) {
    // Word-boundary substring match (e.g. "Ai Đợi Mình Được Mãi" contains "đợi mình" as whole words)
    score += 350;
  } else if (songTitleNorm.includes(queryNorm) && queryNorm.length > 2) {
    // General substring match
    score += 240;
  } else if (regexes.length > 0) {
    for (const regex of regexes) {
      if (regex.test(song.title || "")) {
        score += 160;
        break;
      }
    }
  }

  // Token-level title match
  const queryTokens = queryNorm.split(" ").filter((t) => t.length > 0);
  const titleTokens = songTitleNorm.split(" ").filter((t) => t.length > 0);
  if (queryTokens.length > 1 && titleTokens.length > 0) {
    let matchedTokenCount = 0;
    let lastFoundIndex = -1;
    let inOrder = true;

    for (const qToken of queryTokens) {
      const idx = titleTokens.indexOf(qToken);
      if (idx !== -1) {
        matchedTokenCount++;
        if (idx < lastFoundIndex) {
          inOrder = false;
        }
        lastFoundIndex = idx;
      }
    }

    if (matchedTokenCount === queryTokens.length) {
      // All query tokens appear in the title
      score += inOrder ? 220 : 150;
    } else if (matchedTokenCount > 0) {
      score += Math.round((matchedTokenCount / queryTokens.length) * 100);
    }
  }

  // =========================================================================
  // 2. ARTIST MATCHING (TIER 2)
  // =========================================================================
  // Direct artist name match from song.artists list
  for (const artist of artistsList) {
    const artistName = typeof artist === "object" ? artist?.name : String(artist || "");
    const artistNameNorm = normalizeText(artistName);

    if (artistNameNorm === queryNorm) {
      // User typed the exact artist name (e.g. "MIN", "Thanh Hưng")
      score += 400;
      break;
    } else if (artistNameNorm.startsWith(queryNorm) && queryNorm.length >= 2) {
      score += 220;
      break;
    } else if (artistNameNorm.includes(queryNorm) && queryNorm.length >= 3) {
      score += 140;
      break;
    }
  }

  // Boost for songs by matched artist (when detected in multi-word queries like "Sơn Tùng Lạc Trôi")
  if (isSongByMatchedArtist) {
    if (extraTitleRegexes.length > 0) {
      for (const regex of extraTitleRegexes) {
        if (regex.test(song.title || "")) {
          score += 250;
          break;
        }
      }
    } else {
      score += 60;
    }
  }

  // =========================================================================
  // 3. LYRICS & CONTENT MATCHING (TIER 3)
  // =========================================================================
  const cleanLyricsNorm = normalizeText(extractCleanLyrics(song.lyrics || ""));
  if (cleanLyricsNorm && queryNorm.length >= 4) {
    if (cleanLyricsNorm.includes(queryNorm)) {
      score += 80;
    } else if (regexes.some((r) => r.test(song.lyrics || ""))) {
      score += 40;
    }
  }

  // =========================================================================
  // 4. SEMANTIC INTENT MATCHES (Moods, Themes, Genre)
  // =========================================================================
  if (intent && intent.isNaturalQuery) {
    const aiAnalysis = song.aiAnalysis || {};
    const songMoods = (aiAnalysis.moodTags || []).map((m) => String(m).toLowerCase());
    const songThemes = (aiAnalysis.themes || []).map((t) => String(t).toLowerCase());
    const songTags = (aiAnalysis.tags || []).map((t) => String(t).toLowerCase());
    const songGenre = String(aiAnalysis.genre || "").toLowerCase();

    for (const mood of intent.targetMoods || []) {
      if (songMoods.includes(mood)) score += 20;
      if (songTags.includes(mood)) score += 10;
    }

    for (const theme of intent.targetThemes || []) {
      if (songThemes.includes(theme)) score += 20;
      if (songTags.includes(theme)) score += 10;
      if (songTitleNorm.includes(theme)) score += 15;
    }

    for (const g of intent.targetGenres || []) {
      const gNorm = g.toLowerCase();
      if (songGenre.includes(gNorm) || songTags.includes(gNorm)) score += 15;
    }

    const storySummary = String(aiAnalysis.storySummary || "").toLowerCase();
    for (const kw of intent.semanticKeywords || []) {
      if (kw.length >= 2) {
        if (cleanLyricsNorm && cleanLyricsNorm.includes(kw)) score += 15;
        if (storySummary.includes(kw)) score += 15;
      }
    }
  }

  // =========================================================================
  // 5. POPULARITY (TIE-BREAKER ONLY)
  // =========================================================================
  const playCount = Number(song.playCount || 0);
  const likeCount = Number(song.likeCount || 0);
  const popularityBonus = Math.log10(1 + playCount) * 2 + Math.log10(1 + likeCount) * 1.5;
  score += Math.min(25, popularityBonus);

  return Math.max(0, Math.round(score * 10) / 10);
}

/**
 * Main Hybrid Search Function.
 *
 * @param {{
 *   query?: string,
 *   artistId?: string,
 *   topicId?: string,
 *   letter?: string,
 *   includeArtists?: boolean,
 *   includePlaylists?: boolean,
 *   enableSemantic?: boolean,
 * }} params
 * @returns {Promise<{ songs: object[], artists?: object[], playlists?: object[] }>}
 */
const searchSongs = async ({
  query,
  artistId,
  topicId,
  letter,
  includeArtists = false,
  includePlaylists = false,
  enableSemantic = true,
}) => {
  const conditions = [{ isPublic: true }];
  let matchedArtists = [];
  let matchedPlaylists = [];
  let regexes = [];
  let intent = null;
  let extraTitleRegexes = [];

  const rawQuery = String(query || "").trim();

  if (rawQuery) {
    regexes = buildSearchRegexes(rawQuery);

    if (regexes.length > 0) {
      // 1. Match Artist documents
      matchedArtists = await Artist.find({
        $or: regexes.map((regex) => ({ name: regex })),
      })
        .select("_id name avatar isVerified followersCount")
        .sort({ name: 1 })
        .limit(12)
        .lean();

      // If exact regex did not match artist, check if query contains artist's name AS WHOLE WORDS (preventing "min" matching "minh")
      if (matchedArtists.length === 0) {
        const allArtists = await Artist.find({}).select("_id name avatar isVerified followersCount").lean();
        const normQuery = normalizeText(rawQuery);

        matchedArtists = allArtists.filter((a) => {
          const normArtist = normalizeText(a.name);
          if (!normArtist || normArtist.length < 2) return false;

          // Short artist name (<= 3 chars, e.g. "MIN", "AI", "AN", "VU"):
          // Must ONLY match if query is an exact match to prevent false positives
          if (normArtist.length <= 3) {
            return normQuery === normArtist;
          }

          const artistWords = normArtist.split(" ").filter(Boolean);
          const artistPhrase = artistWords.join(" ");
          const wordBoundaryRegex = new RegExp(`(^|\\s)${escapeRegex(artistPhrase)}(\\s|$)`, "i");
          return wordBoundaryRegex.test(normQuery);
        });
      }

      // If artist matched, sort by relevance (exact match first) and extract remaining query for title keywords
      if (matchedArtists.length > 0) {
        const normQuery = normalizeText(rawQuery);
        matchedArtists.sort((a, b) => {
          const aNorm = normalizeText(a.name);
          const bNorm = normalizeText(b.name);
          const aExact = aNorm === normQuery ? 1 : 0;
          const bExact = bNorm === normQuery ? 1 : 0;
          if (aExact !== bExact) return bExact - aExact;
          const aStarts = aNorm.startsWith(normQuery) ? 1 : 0;
          const bStarts = bNorm.startsWith(normQuery) ? 1 : 0;
          if (aStarts !== bStarts) return bStarts - aStarts;
          return (b.followersCount || 0) - (a.followersCount || 0);
        });

        for (const a of matchedArtists) {
          const normArtist = normalizeText(a.name);
          const remaining = normQuery.replace(new RegExp(`(^|\\s)${escapeRegex(normArtist)}(\\s|$)`, "i"), " ").trim();
          if (remaining.length >= 2) {
            extraTitleRegexes.push(...buildSearchRegexes(remaining));
          }
        }
      }


      // 2. Match Playlists if requested
      if (includePlaylists) {
        const playlistOrConditions = regexes.flatMap((regex) => [
          { name: regex },
          { description: regex },
        ]);

        const playlists = await Playlist.find({
          isPublic: true,
          $or: playlistOrConditions,
        })
          .select("_id name description coverImage songs userId isSystem createdAt")
          .populate("userId", "name avatar")
          .sort({ createdAt: -1 })
          .limit(10)
          .lean();

        matchedPlaylists = playlists.map((p) => ({
          ...p,
          isSystem: !!p.isSystem,
          songCount: Array.isArray(p.songs) ? p.songs.length : 0,
          ownerName: p.isSystem ? "MusicFlow" : (p.userId?.name || "Người dùng"),
        }));
      }
    }

    // 3. Extract Semantic Intent if enabled and query has content
    if (enableSemantic) {
      try {
        intent = await extractSemanticSearchIntent(rawQuery);
      } catch (err) {
        console.warn("[SearchService] Semantic extraction fallback:", err.message);
        intent = heuristicExtractIntent(rawQuery);
      }
    }
  }

  // Build candidate query for songs
  if (rawQuery) {
    const titleConditions = regexes.map((regex) => ({ title: regex }));
    const lyricsConditions = regexes.map((regex) => ({ lyrics: regex }));
    const extraTitleConditions = extraTitleRegexes.map((regex) => ({ title: regex }));
    const queryOrConditions = [...titleConditions, ...lyricsConditions, ...extraTitleConditions];


    if (matchedArtists.length > 0) {
      queryOrConditions.push({
        artists: { $in: matchedArtists.map((a) => a._id) },
      });
    }

    // If semantic intent matched moods or themes, expand candidate search pool
    if (intent && intent.isNaturalQuery) {
      if (intent.targetMoods.length > 0) {
        queryOrConditions.push({ "aiAnalysis.moodTags": { $in: intent.targetMoods } });
      }
      if (intent.targetThemes.length > 0) {
        queryOrConditions.push({ "aiAnalysis.themes": { $in: intent.targetThemes } });
      }
      if (intent.semanticKeywords.length > 0) {
        for (const kw of intent.semanticKeywords) {
          const kwRegex = new RegExp(kw, "i");
          queryOrConditions.push({ "aiAnalysis.tags": kwRegex });
          queryOrConditions.push({ "aiAnalysis.storySummary": kwRegex });
        }
      }
    }

    if (queryOrConditions.length > 0) {
      conditions.push({ $or: queryOrConditions });
    }
  }

  if (artistId) {
    const matchedArtist = await findArtistBySlugOrId(artistId);
    if (matchedArtist) {
      conditions.push({ artists: matchedArtist._id });
    } else {
      // Artist was specified but not found -> return zero songs, never return the whole database!
      conditions.push({ artists: new mongoose.Types.ObjectId() });
    }
  }
  if (topicId) conditions.push({ topicIds: topicId });
  if (letter) conditions.push({ title: new RegExp(`^${letter}`, "i") });

  const filter = conditions.length === 1 ? conditions[0] : { $and: conditions };

  const candidateSongs = await Song.find(filter)
    .select(SONG_PUBLIC_SELECT + " aiAnalysis moderation lyrics playCount likeCount")
    .populate(ARTIST_POPULATE)
    .populate(TOPIC_POPULATE)
    .lean();

  // Score & Rank Candidates
  const scoredSongs = candidateSongs.map((song) => ({
    song,
    score: scoreSongRelevance(song, rawQuery, regexes, intent, matchedArtists, extraTitleRegexes),
  }));

  // Sort descending by Hybrid score
  scoredSongs.sort((a, b) => b.score - a.score);

  const rankedSongs = scoredSongs.map((item) => item.song);

  return {
    songs: rankedSongs,
    artists: matchedArtists,
    playlists: matchedPlaylists,
    intent: intent?.isNaturalQuery ? intent : null,
  };
};

// ---------------------------------------------------------------------------
// Search songs by artist id or artist name
// ---------------------------------------------------------------------------

const searchSongsByArtist = async ({
  artistId,
  artistName,
  search = "",
  page = 1,
  limit = 10,
}) => {
  const skip = (page - 1) * limit;
  let resolvedArtistId = artistId;

  if (!resolvedArtistId && artistName) {
    const artist = await Artist.findOne({
      name: { $regex: new RegExp(`^${String(artistName).trim()}$`, "i") },
    }).select("_id");
    resolvedArtistId = artist?._id?.toString();
  }

  if (!resolvedArtistId) {
    throw new Error("Missing artistId or artist name");
  }

  const query = {
    artists: resolvedArtistId,
    ...(search ? { title: { $regex: search, $options: "i" } } : {}),
  };

  const [rawSongs, total] = await Promise.all([
    Song.find(query)
      .populate("artists", "name avatar isVerified followersCount monthlyListeners")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Song.countDocuments(query),
  ]);

  const songs = rawSongs.map((doc) => {
    const song = doc.toObject();
    return {
      ...song,
      artist: Array.isArray(song.artists)
        ? song.artists.map((a) => a.name).filter(Boolean).join(", ")
        : "",
    };
  });

  return { songs, total, page, limit };
};

module.exports = {
  searchSongs,
  searchSongsByArtist,
  extractSemanticSearchIntent,
  scoreSongRelevance,
  heuristicExtractIntent,
  intentCache,
};
