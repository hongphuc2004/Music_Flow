const Song = require("../models/song.model");
const aiDataLoader = require("../ai/aiDataLoader.service");
const geminiRouter = require("./geminiRouter.service");
const { extractCleanLyrics } = require("../utils/string.util");

const VALID_MOOD_TAXONOMY = [
  "buồn", "chill", "lofi", "sảng khoái", "năng lượng",
  "lãng mạn", "tập trung", "xoa dịu", "hoài niệm", "rực rỡ", "cô đơn"
];

/**
 * Validates structured JSON returned by Gemini for Song Auto-Tagging.
 * @param {object} raw
 * @param {boolean} hasLyrics
 * @returns {object} Clean validated auto-tagging object
 */
function validateAutoTaggingResult(raw, hasLyrics = false) {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid JSON structure returned by AI Auto-Tagging");
  }

  const genre = typeof raw.genre === "string" && raw.genre.trim()
    ? raw.genre.trim()
    : "V-Pop";

  const suggestedGenres = Array.isArray(raw.suggestedGenres)
    ? raw.suggestedGenres.map((g) => String(g).trim()).filter(Boolean)
    : [genre];

  const moodTags = Array.isArray(raw.moodTags)
    ? raw.moodTags
        .map((m) => String(m).trim().toLowerCase())
        .filter((m) => VALID_MOOD_TAXONOMY.includes(m) || m.length >= 2)
    : ["chill"];

  const rawEnergy = String(raw.energyLevel || "medium").toLowerCase().trim();
  const energyLevel = ["low", "medium", "high"].includes(rawEnergy)
    ? rawEnergy
    : "medium";

  const themes = Array.isArray(raw.themes)
    ? raw.themes.map((t) => String(t).trim()).filter(Boolean)
    : ["âm nhạc"];

  const tags = Array.isArray(raw.tags)
    ? raw.tags.map((t) => String(t).trim()).filter(Boolean)
    : [genre, ...moodTags];

  const storySummary = typeof raw.storySummary === "string" && raw.storySummary.trim()
    ? raw.storySummary.trim()
    : "Bài hát với giai điệu mượt mà và cảm xúc sâu lắng.";

  // Rule: Do NOT hallucinate quotes if no real lyrics exist
  let healingQuotes = [];
  if (hasLyrics && Array.isArray(raw.healingQuotes)) {
    healingQuotes = raw.healingQuotes.map((q) => String(q).trim()).filter(Boolean);
  }

  const rawConf = String(raw.confidence || (hasLyrics ? "high" : "medium")).toLowerCase().trim();
  const confidence = ["low", "medium", "high"].includes(rawConf)
    ? (hasLyrics ? rawConf : (rawConf === "high" ? "medium" : rawConf))
    : (hasLyrics ? "high" : "medium");

  return {
    genre,
    suggestedGenres,
    moodTags: moodTags.length > 0 ? moodTags : ["chill"],
    energyLevel,
    themes: themes.length > 0 ? themes : ["âm nhạc"],
    tags: tags.length > 0 ? tags : [genre, "nhạc trẻ"],
    storySummary,
    healingQuotes,
    confidence,
  };
}

/**
 * Heuristic fallback for Auto-Tagging when AI API is unavailable.
 */
function heuristicAutoTaggingFallback({ title = "", artistNames = [], topicNames = [], hasLyrics = false }) {
  const combined = `${title} ${artistNames.join(" ")} ${topicNames.join(" ")}`.toLowerCase();

  let genre = "V-Pop";
  let moodTags = ["chill"];
  let energyLevel = "medium";
  let themes = ["cuộc sống"];

  if (combined.includes("remix") || combined.includes("edm") || combined.includes("vinahouse")) {
    genre = "EDM / Remix";
    moodTags = ["năng lượng", "sảng khoái"];
    energyLevel = "high";
    themes = ["sôi động", "tiệc tùng"];
  } else if (combined.includes("buồn") || combined.includes("khóc") || combined.includes("chia tay") || combined.includes("lỡ")) {
    genre = "Ballad";
    moodTags = ["buồn", "cô đơn", "hoài niệm"];
    energyLevel = "low";
    themes = ["tình yêu", "chia tay"];
  } else if (combined.includes("lofi") || combined.includes("chill") || combined.includes("acoustic") || combined.includes("mưa")) {
    genre = "Lofi / Acoustic";
    moodTags = ["chill", "xoa dịu", "tập trung"];
    energyLevel = "low";
    themes = ["thư giãn", "hoài niệm"];
  } else if (combined.includes("rap") || combined.includes("hiphop") || combined.includes("cypher")) {
    genre = "Hip-Hop / Rap";
    moodTags = ["năng lượng", "sảng khoái"];
    energyLevel = "high";
    themes = ["tuổi trẻ", "động lực"];
  }

  const tags = Array.from(new Set([genre, ...moodTags, ...themes, ...topicNames]));

  return {
    genre,
    suggestedGenres: [genre, "V-Pop"],
    moodTags,
    energyLevel,
    themes,
    tags: tags.slice(0, 5),
    storySummary: `Bài hát "${title || "Không tên"}" mang giai điệu ${genre} đầy cảm xúc.`,
    healingQuotes: [],
    confidence: hasLyrics ? "medium" : "low",
  };
}

/**
 * Analyze and auto-tag song metadata and musical attributes.
 * @param {object} params
 * @param {string} params.title
 * @param {string} [params.lyrics]
 * @param {string[]} [params.artistNames]
 * @param {string[]} [params.topicNames]
 * @param {object} [params.audioMetadata]
 * @returns {Promise<object>}
 */
async function analyzeSongTags({ title, lyrics = "", artistNames = [], topicNames = [], audioMetadata = {} }) {
  const cleanLyrics = extractCleanLyrics(lyrics);
  const hasLyrics = cleanLyrics.length >= 30;
  const titleText = String(title || "").trim();
  const artistsText = Array.isArray(artistNames) ? artistNames.filter(Boolean).join(", ") : String(artistNames || "");
  const topicsText = Array.isArray(topicNames) ? topicNames.filter(Boolean).join(", ") : String(topicNames || "");

  const systemPrompt = aiDataLoader.getPrompt("song-auto-tagging");

  const songMetadataDetails = [
    `Tiêu đề: "${titleText}"`,
    artistsText ? `Ca sĩ: "${artistsText}"` : null,
    topicsText ? `Chủ đề/Thể loại gợi ý ban đầu: "${topicsText}"` : null,
    audioMetadata?.format ? `Định dạng audio: ${audioMetadata.format} (Bitrate: ${audioMetadata.bitrate || "standard"})` : null,
    hasLyrics ? `Lời bài hát:\n${cleanLyrics.slice(0, 3000)}` : "Lời bài hát: (Bản nhạc không lời / Chưa có lyrics)",
  ].filter(Boolean).join("\n\n");

  const fullPrompt = `${systemPrompt}\n\n--- THÔNG TIN BÀI HÁT CẦN GẮN THẺ ---\n${songMetadataDetails}`;

  try {
    const { GoogleGenerativeAI } = require("@google/generative-ai");

    const responseText = await geminiRouter.executeWithModelRouter({
      userTier: "basic",
      requiresTools: false,
      task: async (modelName) => {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({
          model: modelName,
          systemInstruction: "You are an expert music tagging and metadata analysis AI. Output 100% valid JSON matching the exact schema without any markdown formatting or surrounding text.",
        });

        const result = await model.generateContent(fullPrompt);
        return result?.response?.text?.() || "";
      },
    });

    if (!responseText || !responseText.trim()) {
      throw new Error("Empty response from AI Auto-Tagging Router");
    }

    let cleanJsonStr = responseText.trim();
    if (cleanJsonStr.startsWith("```")) {
      cleanJsonStr = cleanJsonStr.replace(/^```(json)?/i, "").replace(/```$/, "").trim();
    }

    const parsed = JSON.parse(cleanJsonStr);
    return validateAutoTaggingResult(parsed, hasLyrics);
  } catch (error) {
    console.warn(`[AIAutoTagging] AI auto-tagging failed (${error.message}). Falling back to heuristic classifier.`);
    return heuristicAutoTaggingFallback({
      title: titleText,
      artistNames: Array.isArray(artistNames) ? artistNames : [artistsText],
      topicNames: Array.isArray(topicNames) ? topicNames : [topicsText],
      hasLyrics,
    });
  }
}

/**
 * Process auto-tagging for a Song document by ID.
 * Persists aiAnalysis to database.
 * @param {string} songId
 * @returns {Promise<object>} Updated Song document
 */
async function processSongAutoTagging(songId) {
  const song = await Song.findById(songId)
    .populate("artists", "name")
    .populate("topicIds", "name");

  if (!song) {
    throw new Error(`Song not found for auto-tagging: ${songId}`);
  }

  const artistNames = Array.isArray(song.artists)
    ? song.artists.map((a) => (typeof a === "object" ? a?.name : a)).filter(Boolean)
    : [];

  const topicNames = Array.isArray(song.topicIds)
    ? song.topicIds.map((t) => (typeof t === "object" ? t?.name : t)).filter(Boolean)
    : [];

  const tagResult = await analyzeSongTags({
    title: song.title,
    lyrics: song.lyrics || "",
    artistNames,
    topicNames,
    audioMetadata: song.audioMetadata,
  });

  song.aiAnalysis = {
    status: "completed",
    genre: tagResult.genre,
    suggestedGenres: tagResult.suggestedGenres,
    moodTags: tagResult.moodTags,
    energyLevel: tagResult.energyLevel,
    themes: tagResult.themes,
    tags: tagResult.tags,
    storySummary: tagResult.storySummary,
    healingQuotes: tagResult.healingQuotes,
    confidence: tagResult.confidence,
    retryCount: Number(song.aiAnalysis?.retryCount || 0),
    lastAttemptAt: new Date(),
    analyzedAt: new Date(),
  };

  return await song.save();
}

module.exports = {
  VALID_MOOD_TAXONOMY,
  validateAutoTaggingResult,
  heuristicAutoTaggingFallback,
  analyzeSongTags,
  processSongAutoTagging,
};
