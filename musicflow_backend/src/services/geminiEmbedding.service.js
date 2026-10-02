const axios = require("axios");
const Song = require("../models/song.model");
const Artist = require("../models/artist.model");
const { getNextMidnightLA } = require("./geminiRouter.service");

// ---------------------------------------------------------------------------
// Model Configurations & Quota Constraints (Google AI Studio)
// ---------------------------------------------------------------------------
const EMBEDDING_MODELS = [
  {
    id: "gemini-embedding-2",
    apiName: "models/gemini-embedding-2",
    displayName: "Gemini Embedding 2",
    rpdLimit: 1000,
    rpmLimit: 100,
  },
  {
    id: "gemini-embedding-001",
    apiName: "models/gemini-embedding-001",
    displayName: "Gemini Embedding 1",
    rpdLimit: 1000,
    rpmLimit: 100,
  },
];

const OUTPUT_DIMENSIONALITY = 768; // Matryoshka dimension supported by both models

// ---------------------------------------------------------------------------
// In-Memory Daily & Minute Quota Tracker
// ---------------------------------------------------------------------------
const dailyUsageTracker = new Map(); // modelId -> count
const exhaustedUntil = new Map(); // modelId -> Date
const minuteTracker = new Map(); // modelId -> Array of timestamps

let nextDailyReset = getNextMidnightLA();

function checkAndResetDailyTracker() {
  const now = new Date();
  if (now >= nextDailyReset) {
    dailyUsageTracker.clear();
    exhaustedUntil.clear();
    minuteTracker.clear();
    nextDailyReset = getNextMidnightLA();
    console.log("[GeminiEmbedding] Daily quota tracker reset at LA midnight. Next reset:", nextDailyReset.toISOString());
  }
}

function getDailyUsage(modelId) {
  checkAndResetDailyTracker();
  return dailyUsageTracker.get(modelId) || 0;
}

function incrementDailyUsage(modelId) {
  checkAndResetDailyTracker();
  const current = dailyUsageTracker.get(modelId) || 0;
  dailyUsageTracker.set(modelId, current + 1);

  // Record minute timestamp
  const now = Date.now();
  const stamps = minuteTracker.get(modelId) || [];
  const oneMinAgo = now - 60 * 1000;
  const recent = stamps.filter((t) => t > oneMinAgo);
  recent.push(now);
  minuteTracker.set(modelId, recent);
}

function isModelAvailable(modelConfig) {
  checkAndResetDailyTracker();
  const modelId = modelConfig.id;

  // Check exhausted lock
  const lockedUntil = exhaustedUntil.get(modelId);
  if (lockedUntil && new Date() < lockedUntil) {
    return false;
  }

  // Check RPD limit
  const currentUsage = getDailyUsage(modelId);
  if (currentUsage >= modelConfig.rpdLimit) {
    return false;
  }

  // Check RPM limit
  const stamps = minuteTracker.get(modelId) || [];
  const oneMinAgo = Date.now() - 60 * 1000;
  const recent = stamps.filter((t) => t > oneMinAgo);
  if (recent.length >= modelConfig.rpmLimit) {
    return false; // Wait for next minute
  }

  return true;
}

function markModelExhausted(modelId, reason = "RPD_LIMIT_OR_429") {
  const resetTime = getNextMidnightLA();
  exhaustedUntil.set(modelId, resetTime);
  console.warn(`[GeminiEmbedding] Model '${modelId}' marked exhausted (${reason}). Unavailable until ${resetTime.toISOString()}`);
}

// ---------------------------------------------------------------------------
// In-Memory LRU Cache for Search Queries
// ---------------------------------------------------------------------------
const QUERY_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const MAX_QUERY_CACHE = 1000;
const queryVectorCache = new Map(); // normalizedText -> { vector, timestamp }

function getCachedVector(normText) {
  const item = queryVectorCache.get(normText);
  if (!item) return null;
  if (Date.now() - item.timestamp > QUERY_CACHE_TTL_MS) {
    queryVectorCache.delete(normText);
    return null;
  }
  return item.vector;
}

function setCachedVector(normText, vector) {
  if (queryVectorCache.size >= MAX_QUERY_CACHE) {
    const oldest = queryVectorCache.keys().next().value;
    if (oldest) queryVectorCache.delete(oldest);
  }
  queryVectorCache.set(normText, { vector, timestamp: Date.now() });
}

// ---------------------------------------------------------------------------
// Vector Math Utilities
// ---------------------------------------------------------------------------
/**
 * Fast Cosine Similarity between two numeric vectors.
 * Returns float between -1.0 and 1.0 (typically 0.0 to 1.0 for embeddings).
 */
function cosineSimilarity(vecA, vecB) {
  if (!Array.isArray(vecA) || !Array.isArray(vecB) || vecA.length !== vecB.length || vecA.length === 0) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    const a = vecA[i];
    const b = vecB[i];
    dotProduct += a * b;
    normA += a * a;
    normB += b * b;
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;
  return dotProduct / denominator;
}

// ---------------------------------------------------------------------------
// Core Embedding Functions
// ---------------------------------------------------------------------------
/**
 * Calls Google AI Studio embedContent API with model cascade & automatic quota fallback.
 *
 * @param {string} text - Input text to embed
 * @returns {Promise<{ vector: number[], model: string } | null>}
 */
async function getEmbedding(text) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !text || !text.trim()) {
    return null;
  }

  const cleanText = text.trim();
  const cacheKey = cleanText.toLowerCase();

  // 1. Check LRU Cache
  const cached = getCachedVector(cacheKey);
  if (cached) {
    return { vector: cached, model: "cache" };
  }

  // 2. Cascade through models (Gemini Embedding 2 -> Gemini Embedding 1)
  for (const modelConfig of EMBEDDING_MODELS) {
    if (!isModelAvailable(modelConfig)) {
      continue;
    }

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/${modelConfig.apiName}:embedContent?key=${apiKey}`;
      const payload = {
        content: {
          parts: [{ text: cleanText }],
        },
        outputDimensionality: OUTPUT_DIMENSIONALITY,
      };

      const response = await axios.post(url, payload, { timeout: 8000 });
      const values = response.data?.embedding?.values;

      if (Array.isArray(values) && values.length > 0) {
        incrementDailyUsage(modelConfig.id);
        setCachedVector(cacheKey, values);

        return {
          vector: values,
          model: modelConfig.id,
        };
      }
    } catch (error) {
      const status = error.response?.status;
      const errorMsg = error.response?.data?.error?.message || error.message;

      if (status === 429) {
        console.warn(`[GeminiEmbedding] Model '${modelConfig.id}' hit 429 Quota/Rate limit. Cascading to fallback model...`);
        markModelExhausted(modelConfig.id, "HTTP_429");
      } else if (status === 404) {
        console.warn(`[GeminiEmbedding] Model '${modelConfig.id}' not found (404). Cascading...`);
        markModelExhausted(modelConfig.id, "NOT_FOUND_404");
      } else {
        console.warn(`[GeminiEmbedding] Model '${modelConfig.id}' request failed (${status || errorMsg}). Cascading...`);
      }
    }
  }

  // 3. Fallback: Both models exhausted or failed
  console.warn("[GeminiEmbedding] All Gemini Embedding models exhausted or unavailable. Falling back to traditional logic.");
  return null;
}

/**
 * Builds a rich semantic text representation of a Song document for embedding.
 */
function buildSongEmbeddingText(song) {
  if (!song) return "";

  const title = song.title || "";
  const artists = Array.isArray(song.artists)
    ? song.artists.map((a) => (typeof a === "object" ? a.name : a)).filter(Boolean).join(", ")
    : "";

  const aiAnalysis = song.aiAnalysis || {};
  const genre = aiAnalysis.genre || "";
  const moodTags = Array.isArray(aiAnalysis.moodTags) ? aiAnalysis.moodTags.join(", ") : "";
  const themes = Array.isArray(aiAnalysis.themes) ? aiAnalysis.themes.join(", ") : "";
  const storySummary = aiAnalysis.storySummary || "";

  // Extract a concise clean snippet of lyrics (first 250 characters)
  let lyricsSnippet = "";
  if (song.lyrics) {
    lyricsSnippet = song.lyrics
      .replace(/\[\d{2}:\d{2}\.\d{2,3}\]/g, "")
      .replace(/[\r\n]+/g, " ")
      .slice(0, 250)
      .trim();
  }

  const parts = [
    title ? `Bài hát: ${title}` : "",
    artists ? `Nghệ sĩ: ${artists}` : "",
    genre ? `Thể loại: ${genre}` : "",
    moodTags ? `Tâm trạng: ${moodTags}` : "",
    themes ? `Chủ đề: ${themes}` : "",
    storySummary ? `Cảm xúc: ${storySummary}` : "",
    lyricsSnippet ? `Lời: ${lyricsSnippet}` : "",
  ].filter(Boolean);

  return parts.join(". ");
}

/**
 * Embeds a single song and saves the vector into MongoDB.
 */
async function embedAndSaveSong(songId) {
  const song = await Song.findById(songId)
    .populate("artists", "name")
    .select("+embedding.values");

  if (!song) return false;

  const textToEmbed = buildSongEmbeddingText(song);
  if (!textToEmbed) return false;

  const res = await getEmbedding(textToEmbed);
  if (!res || !res.vector) return false;

  await Song.updateOne(
    { _id: song._id },
    {
      $set: {
        "embedding.values": res.vector,
        "embedding.model": res.model,
        "embedding.dimension": res.vector.length,
        "embedding.updatedAt": new Date(),
      },
    }
  );

  return true;
}

/**
 * Finds top-k most similar songs to a target song using Cosine Similarity.
 * Returns array of { song, similarityScore }.
 */
async function findSimilarSongs(targetSongId, limit = 10) {
  const targetSong = await Song.findById(targetSongId)
    .select("+embedding.values")
    .lean();

  if (!targetSong?.embedding?.values || targetSong.embedding.values.length === 0) {
    return null; // Fallback to traditional recommendation logic
  }

  const targetVector = targetSong.embedding.values;

  // Retrieve candidate songs with embeddings
  const candidates = await Song.find({
    _id: { $ne: targetSong._id },
    isPublic: true,
    "embedding.values": { $exists: true, $ne: [] },
  })
    .select("+embedding.values title artists imageUrl audioUrl playCount likeCount aiAnalysis")
    .populate("artists", "name avatar")
    .limit(200)
    .lean();

  if (candidates.length === 0) {
    return null;
  }

  const scored = candidates.map((cand) => {
    const sim = cosineSimilarity(targetVector, cand.embedding.values);
    const { embedding, ...cleanSong } = cand; // Strip large vector from output
    return {
      song: cleanSong,
      similarityScore: Math.round(sim * 1000) / 1000,
    };
  });

  scored.sort((a, b) => b.similarityScore - a.similarityScore);
  return scored.slice(0, limit);
}

/**
 * Returns current health & quota status of Gemini Embedding models.
 */
function getEmbeddingStatus() {
  checkAndResetDailyTracker();

  return EMBEDDING_MODELS.map((model) => {
    const dailyUsed = getDailyUsage(model.id);
    const lockedUntil = exhaustedUntil.get(model.id);
    const isExhausted = Boolean(lockedUntil && new Date() < lockedUntil);

    return {
      id: model.id,
      displayName: model.displayName,
      dailyUsed,
      rpdLimit: model.rpdLimit,
      remainingDaily: Math.max(0, model.rpdLimit - dailyUsed),
      isAvailable: isModelAvailable(model),
      isExhausted,
      exhaustedUntil: isExhausted ? lockedUntil.toISOString() : null,
      nextResetTime: nextDailyReset.toISOString(),
    };
  });
}

/**
 * Background batch embedder for indexing songs in DB without exceeding rate limits.
 */
async function syncSongEmbeddings({ batchSize = 10, maxSongs = 50 } = {}) {
  const songsWithoutEmbed = await Song.find({
    isPublic: true,
    $or: [
      { "embedding.values": { $exists: false } },
      { "embedding.values": { $size: 0 } },
      { "embedding.values": null },
    ],
  })
    .populate("artists", "name")
    .limit(maxSongs)
    .select("title artists lyrics aiAnalysis")
    .lean();

  if (songsWithoutEmbed.length === 0) {
    return { count: 0, message: "Tất cả bài hát đã được nhúng vector." };
  }

  let processedCount = 0;
  for (const song of songsWithoutEmbed) {
    const status = getEmbeddingStatus();
    const hasAvailableModel = status.some((m) => m.isAvailable);
    if (!hasAvailableModel) {
      console.warn("[GeminiEmbedding] Rate limit / quota reached during batch sync. Stopping until next window.");
      break;
    }

    const success = await embedAndSaveSong(song._id);
    if (success) {
      processedCount++;
    }

    // Sleep 650ms between requests to respect 100 RPM (~1.6 req/s)
    await new Promise((resolve) => setTimeout(resolve, 650));
  }

  return {
    processedCount,
    totalTargeted: songsWithoutEmbed.length,
    status: getEmbeddingStatus(),
  };
}

module.exports = {
  getEmbedding,
  cosineSimilarity,
  buildSongEmbeddingText,
  embedAndSaveSong,
  findSimilarSongs,
  getEmbeddingStatus,
  syncSongEmbeddings,
  EMBEDDING_MODELS,
  OUTPUT_DIMENSIONALITY,
};
