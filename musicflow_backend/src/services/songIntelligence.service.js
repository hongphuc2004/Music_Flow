const Song = require("../models/song.model");
const aiDataLoader = require("../ai/aiDataLoader.service");
const geminiRouter = require("./geminiRouter.service");
const aiAutoTaggingService = require("./aiAutoTagging.service");

/**
 * Validates structured JSON returned by Gemini against required schema.
 * @param {object} raw
 * @returns {object} Clean validated analysis object
 */
function validateAnalysisResult(raw) {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid JSON structure returned by AI");
  }

  const moodTags = Array.isArray(raw.moodTags)
    ? raw.moodTags.map((s) => String(s).trim().toLowerCase()).filter(Boolean)
    : [];

  const validEnergy = ["low", "medium", "high"].includes(String(raw.energyLevel).toLowerCase())
    ? String(raw.energyLevel).toLowerCase()
    : "medium";

  const themes = Array.isArray(raw.themes)
    ? raw.themes.map((s) => String(s).trim()).filter(Boolean)
    : [];

  const storySummary = typeof raw.storySummary === "string" ? raw.storySummary.trim() : "";
  if (!storySummary) {
    throw new Error("Missing storySummary in AI response");
  }

  const healingQuotes = Array.isArray(raw.healingQuotes)
    ? raw.healingQuotes.map((s) => String(s).trim()).filter(Boolean)
    : [];

  const genre = typeof raw.genre === "string" && raw.genre.trim() ? raw.genre.trim() : "V-Pop";
  const tags = Array.isArray(raw.tags) ? raw.tags.map((s) => String(s).trim()).filter(Boolean) : [genre, ...moodTags];

  return {
    genre,
    moodTags,
    energyLevel: validEnergy,
    themes,
    tags,
    storySummary,
    healingQuotes,
    confidence: "high",
  };
}

/**
 * Calls Gemini via geminiRouter to analyze song lyrics.
 * @param {string} title
 * @param {string} lyrics
 * @returns {Promise<object>}
 */
async function analyzeSongLyrics(title, lyrics) {
  const systemPrompt = aiDataLoader.getPrompt("song-intelligence");
  const fullPrompt = `${systemPrompt}\n\nTHÔNG TIN BÀI HÁT:\nTiêu đề: "${title}"\nLời bài hát:\n${lyrics.slice(0, 3000)}`;

  const responseText = await geminiRouter.executeWithModelRouter({
    userTier: "basic",
    requiresTools: false,
    task: async (modelName) => {
      const { GoogleGenerativeAI } = require("@google/generative-ai");
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: "You are a professional music analyst. Always output 100% valid JSON matching the exact schema requested.",
      });

      const result = await model.generateContent(fullPrompt);
      return result?.response?.text?.() || "";
    },
  });

  if (!responseText) {
    throw new Error("Empty response from Gemini Router");
  }

  let cleanJsonStr = responseText.trim();
  if (cleanJsonStr.startsWith("```")) {
    cleanJsonStr = cleanJsonStr.replace(/^```(json)?/i, "").replace(/```$/, "").trim();
  }

  const parsed = JSON.parse(cleanJsonStr);
  return validateAnalysisResult(parsed);
}

/**
 * Processes song analysis safely with error handling and retry tracking.
 * @param {string} songId
 * @returns {Promise<object>} Updated Song document
 */
async function processSongAnalysis(songId) {
  const song = await Song.findById(songId);
  if (!song) {
    throw new Error(`Song not found: ${songId}`);
  }

  // Handle songs with missing or very short lyrics (< 40 chars)
  const lyricsText = String(song.lyrics || "").trim();
  if (lyricsText.length < 40) {
    song.aiAnalysis = {
      status: "completed",
      genre: "Hòa tấu",
      suggestedGenres: ["Hòa tấu", "Instrumental"],
      moodTags: ["chill"],
      energyLevel: "medium",
      themes: ["âm nhạc"],
      tags: ["hòa tấu", "instrumental", "chill"],
      storySummary: `Bài hát "${song.title}" không có lời thoại chi tiết hoặc là bản nhạc hòa tấu.`,
      healingQuotes: [],
      confidence: "medium",
      retryCount: 0,
      lastAttemptAt: new Date(),
      analyzedAt: new Date(),
    };
    return await song.save();
  }

  const currentRetry = Number(song.aiAnalysis?.retryCount || 0);

  try {
    const analysisResult = await analyzeSongLyrics(song.title, lyricsText);

    song.aiAnalysis = {
      status: "completed",
      genre: analysisResult.genre || "V-Pop",
      suggestedGenres: [analysisResult.genre || "V-Pop"],
      moodTags: analysisResult.moodTags,
      energyLevel: analysisResult.energyLevel,
      themes: analysisResult.themes,
      tags: analysisResult.tags || [analysisResult.genre || "V-Pop", ...analysisResult.moodTags],
      storySummary: analysisResult.storySummary,
      healingQuotes: analysisResult.healingQuotes,
      confidence: "high",
      retryCount: currentRetry,
      lastAttemptAt: new Date(),
      analyzedAt: new Date(),
    };

    return await song.save();
  } catch (error) {
    console.warn(`[SongIntelligence] Analysis failed for song "${song.title}" (${song._id}):`, error.message);

    // If live API fails, use heuristic fallback from aiAutoTaggingService
    const fallback = aiAutoTaggingService.heuristicAutoTaggingFallback({
      title: song.title,
      hasLyrics: lyricsText.length >= 40,
    });

    song.aiAnalysis = {
      status: "completed",
      genre: fallback.genre,
      suggestedGenres: fallback.suggestedGenres,
      moodTags: fallback.moodTags,
      energyLevel: fallback.energyLevel,
      themes: fallback.themes,
      tags: fallback.tags,
      storySummary: fallback.storySummary,
      healingQuotes: fallback.healingQuotes,
      confidence: fallback.confidence,
      retryCount: currentRetry + 1,
      lastAttemptAt: new Date(),
      analyzedAt: new Date(),
    };

    return await song.save();
  }
}

module.exports = {
  validateAnalysisResult,
  analyzeSongLyrics,
  processSongAnalysis,
};
