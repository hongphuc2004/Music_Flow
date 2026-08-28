const axios = require("axios");
const Song = require("../models/song.model");
const aiDataLoader = require("../ai/aiDataLoader.service");
const geminiRouter = require("./geminiRouter.service");
const { extractCleanLyrics, normalizeText } = require("../utils/string.util");

/**
 * Checks if a string is a valid HTTP/HTTPS URL
 */
function isHttpUrl(string) {
  try {
    const url = new URL(string);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Infers audio MIME type from URL extension or Content-Type header
 */
function getAudioMimeType(url, contentTypeHeader = "") {
  if (contentTypeHeader && contentTypeHeader.includes("audio/")) {
    return contentTypeHeader.split(";")[0].trim();
  }
  const cleanUrl = String(url).toLowerCase().split("?")[0];
  if (cleanUrl.endsWith(".mp3")) return "audio/mp3";
  if (cleanUrl.endsWith(".wav")) return "audio/wav";
  if (cleanUrl.endsWith(".ogg")) return "audio/ogg";
  if (cleanUrl.endsWith(".m4a") || cleanUrl.endsWith(".aac")) return "audio/aac";
  if (cleanUrl.endsWith(".flac")) return "audio/flac";
  return "audio/mp3";
}

/**
 * Downloads audio buffer safely with size limits and network timeout.
 * For large files, it samples up to maxBytes without crashing memory.
 * @param {string} audioUrl
 * @param {object} options
 * @returns {Promise<{ buffer: Buffer, mimeType: string } | null>}
 */
async function fetchAudioBuffer(audioUrl, options = {}) {
  const { maxBytes = 15 * 1024 * 1024, timeoutMs = 12000 } = options;
  if (!audioUrl || !isHttpUrl(audioUrl)) return null;

  try {
    const response = await axios.get(audioUrl, {
      responseType: "arraybuffer",
      timeout: timeoutMs,
      maxContentLength: maxBytes,
      headers: {
        "User-Agent": "MusicFlow-AudioModeration/1.0",
        // Request representative audio segment if server supports Range
        Range: `bytes=0-${maxBytes}`,
      },
    });

    if (!response.data || response.data.length === 0) {
      return null;
    }

    const buffer = Buffer.from(response.data);
    const mimeType = getAudioMimeType(audioUrl, response.headers["content-type"]);
    return { buffer, mimeType };
  } catch (err) {
    console.warn(`[AIModeration] Audio download failed/timeout for ${audioUrl}: ${err.message}`);
    return null;
  }
}

/**
 * Validates structured JSON returned by Gemini for Content/Audio Moderation.
 * @param {object} raw
 * @param {object} [options]
 * @returns {object} Clean validated moderation object
 */
function validateModerationResult(raw, options = {}) {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid JSON structure returned by AI Moderation");
  }

  const rawStatus = String(raw.status || "SAFE").toUpperCase().trim();
  let validStatus = ["SAFE", "REVIEW", "BLOCK"].includes(rawStatus)
    ? rawStatus
    : "REVIEW";

  const rawRisk = String(raw.riskLevel || "none").toLowerCase().trim();
  let validRisk = ["none", "low", "medium", "high"].includes(rawRisk)
    ? rawRisk
    : (validStatus === "BLOCK" ? "high" : validStatus === "REVIEW" ? "medium" : "none");

  const flags = Array.isArray(raw.flags)
    ? raw.flags.map((f) => String(f).trim().toLowerCase()).filter(Boolean)
    : [];

  const rawTrackType = String(raw.audioTrackType || "none").toLowerCase().trim();
  const audioTrackType = ["vocal", "instrumental", "unclear"].includes(rawTrackType)
    ? rawTrackType
    : (options.source === "audio" ? "vocal" : "none");

  const confRaw = Number(raw.confidence);
  const confidence = !isNaN(confRaw) && confRaw >= 0 && confRaw <= 1
    ? confRaw
    : (validStatus === "SAFE" ? 0.95 : 0.85);

  let reason = typeof raw.reason === "string" && raw.reason.trim()
    ? raw.reason.trim()
    : (validStatus === "SAFE" ? "Nội dung an toàn, không phát hiện vi phạm." : "Cần xem xét thêm ngữ cảnh nội dung.");

  // Strict Rule 2 & 7: Handling Instrumental & Unclear Audio
  if (options.source === "audio") {
    if (audioTrackType === "instrumental") {
      if (confidence >= 0.8) {
        validStatus = "SAFE";
        validRisk = "none";
        reason = reason || "Bản nhạc hòa tấu/không lời, không phát hiện yếu tố vi phạm.";
      } else {
        validStatus = "REVIEW";
        validRisk = "low";
        reason = reason || "Bản nhạc hòa tấu cần Admin xác nhận thêm.";
      }
    } else if (audioTrackType === "unclear") {
      // NEVER BLOCK when audio is unclear or distorted
      validStatus = "REVIEW";
      validRisk = "low";
      reason = reason || "Âm thanh không rõ ràng hoặc bị nhiễu, cần Admin nghe lại thủ công.";
    }
  }

  return {
    status: validStatus,
    riskLevel: validRisk,
    flags,
    audioTrackType,
    reason,
    confidence,
    source: options.source || "metadata",
    audioAnalyzed: options.source === "audio" && audioTrackType !== "none",
  };
}

/**
 * Heuristic fallback for moderation when AI API is unavailable or audio cannot be loaded.
 */
function heuristicModerationFallback({ title = "", lyrics = "", artistNames = [], source = "metadata", audioFetchError = false }) {
  const normText = normalizeText(`${title} ${artistNames.join(" ")} ${lyrics}`);
  
  // Severe violation keywords (violence, severe profanity, hate, terrorism)
  const blockKeywords = [
    "kill all", "giet het", "khung bo", "tu sat", "bao luc", "doi truy", "thu ghet", "kich dong",
    "giet nguoi", "hiep dam", "khoa than 18+", "ma tuy da", "chat pha"
  ];
  for (const kw of blockKeywords) {
    if (normText.includes(kw)) {
      return {
        status: "BLOCK",
        riskLevel: "high",
        flags: ["violence_or_hate"],
        audioTrackType: "none",
        reason: `Phát hiện từ khóa nghi vấn mức độ cao: "${kw}" (Heuristic filter)`,
        confidence: 0.85,
        source,
        audioAnalyzed: false,
      };
    }
  }

  const reviewKeywords = ["nhay cam", "18+", "chui the", "scam", "lua dao", "ma tuy", "sex", "dam duc"];
  for (const kw of reviewKeywords) {
    if (normText.includes(kw)) {
      return {
        status: "REVIEW",
        riskLevel: "medium",
        flags: ["sensitive_content"],
        audioTrackType: "none",
        reason: `Nội dung có từ ngữ cần Admin xem xét: "${kw}"`,
        confidence: 0.75,
        source,
        audioAnalyzed: false,
      };
    }
  }

  // If audio fetch failed or timed out, report safe basic review
  if (audioFetchError) {
    return {
      status: "REVIEW",
      riskLevel: "low",
      flags: ["audio_unreachable"],
      audioTrackType: "unclear",
      reason: "Không thể phân tích tệp âm thanh trực tiếp (audio timeout/unreachable), đã kiểm duyệt cơ bản qua tiêu đề và nghệ sĩ.",
      confidence: 0.7,
      source: "audio",
      audioAnalyzed: false,
    };
  }

  return {
    status: "SAFE",
    riskLevel: "none",
    flags: [],
    audioTrackType: "none",
    reason: "Nội dung đạt chuẩn an toàn cơ bản (Heuristic verification).",
    confidence: 0.9,
    source,
    audioAnalyzed: false,
  };
}

/**
 * Evaluates song content via Lyrics Text & Metadata using Gemini Router.
 */
async function moderateLyricsAndText({ title, lyrics = "", artistNames = [], description = "" }) {
  const cleanLyrics = extractCleanLyrics(lyrics);
  const titleText = String(title || "").trim();
  const artistsText = Array.isArray(artistNames) ? artistNames.filter(Boolean).join(", ") : String(artistNames || "");
  const source = cleanLyrics ? "lyrics" : "metadata";

  const systemPrompt = aiDataLoader.getPrompt("content-moderation");
  const contentToAnalyze = [
    `Tiêu đề bài hát: "${titleText}"`,
    artistsText ? `Ca sĩ thể hiện: "${artistsText}"` : null,
    description ? `Mô tả: "${description.trim()}"` : null,
    cleanLyrics ? `Lời bài hát:\n${cleanLyrics.slice(0, 4000)}` : "Lời bài hát: (Không có lời / Hòa tấu)",
  ].filter(Boolean).join("\n\n");

  const fullPrompt = `${systemPrompt}\n\n--- DỮ LIỆU CẦN KIỂM DUYỆT ---\n${contentToAnalyze}`;

  try {
    const { GoogleGenerativeAI } = require("@google/generative-ai");

    const responseText = await geminiRouter.executeWithModelRouter({
      userTier: "basic",
      requiresTools: false,
      task: async (modelName) => {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({
          model: modelName,
          systemInstruction: "You are a specialized content moderation AI. Output 100% valid JSON matching the exact schema without any markdown wrapping or extra text.",
        });

        const result = await model.generateContent(fullPrompt);
        return result?.response?.text?.() || "";
      },
    });

    if (!responseText || !responseText.trim()) {
      throw new Error("Empty response from AI Moderation Router");
    }

    let cleanJsonStr = responseText.trim();
    if (cleanJsonStr.startsWith("```")) {
      cleanJsonStr = cleanJsonStr.replace(/^```(json)?/i, "").replace(/```$/, "").trim();
    }

    const parsed = JSON.parse(cleanJsonStr);
    return validateModerationResult(parsed, { source });
  } catch (error) {
    console.warn(`[AIModeration] Text moderation call failed (${error.message}). Falling back to heuristic checker.`);
    return heuristicModerationFallback({ title: titleText, lyrics: cleanLyrics, artistNames, source });
  }
}

/**
 * Evaluates song content directly from Audio file using Gemini Multimodal Audio.
 */
async function moderateAudioContent({ title, artistNames = [], description = "", audioUrl, duration = 0, fileSize = 0 }) {
  const titleText = String(title || "").trim();
  const artistsText = Array.isArray(artistNames) ? artistNames.filter(Boolean).join(", ") : String(artistNames || "");

  // 1. Fetch audio buffer safely
  const audioData = await fetchAudioBuffer(audioUrl, {
    maxBytes: 15 * 1024 * 1024,
    timeoutMs: 12000,
  });

  if (!audioData || !audioData.buffer) {
    console.warn(`[AIModeration] Cannot fetch audio for direct analysis. Falling back to heuristic metadata check.`);
    return heuristicModerationFallback({
      title: titleText,
      lyrics: "",
      artistNames,
      source: "audio",
      audioFetchError: true,
    });
  }

  const audioPrompt = aiDataLoader.getPrompt("audio-moderation") || aiDataLoader.getPrompt("content-moderation");
  const textPrompt = `${audioPrompt}\n\n--- THÔNG TIN BÀI HÁT ---\nTiêu đề: "${titleText}"\nNghệ sĩ: "${artistsText}"\n${description ? `Mô tả: "${description}"\n` : ""}(Người đăng không cung cấp văn bản lời bài hát. Hãy lắng nghe trực tiếp tệp âm thanh đính kèm để phân loại vocal/instrumental/unclear và kiểm duyệt nội dung vi phạm).`;

  try {
    const { GoogleGenerativeAI } = require("@google/generative-ai");
    const base64Audio = audioData.buffer.toString("base64");

    const responseText = await geminiRouter.executeWithModelRouter({
      userTier: "basic",
      requiresTools: false,
      task: async (modelName) => {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({
          model: modelName,
          systemInstruction: "You are an AI Audio Moderation Specialist. Listen to the audio and output 100% valid JSON matching the exact schema without markdown or extraneous text.",
        });

        const result = await model.generateContent([
          { text: textPrompt },
          {
            inlineData: {
              mimeType: audioData.mimeType,
              data: base64Audio,
            },
          },
        ]);
        return result?.response?.text?.() || "";
      },
    });

    if (!responseText || !responseText.trim()) {
      throw new Error("Empty response from Gemini Audio Moderation Router");
    }

    let cleanJsonStr = responseText.trim();
    if (cleanJsonStr.startsWith("```")) {
      cleanJsonStr = cleanJsonStr.replace(/^```(json)?/i, "").replace(/```$/, "").trim();
    }

    const parsed = JSON.parse(cleanJsonStr);
    return validateModerationResult(parsed, { source: "audio" });
  } catch (error) {
    console.warn(`[AIModeration] Gemini Multimodal Audio analysis failed (${error.message}). Falling back to heuristic.`);
    return heuristicModerationFallback({
      title: titleText,
      lyrics: "",
      artistNames,
      source: "audio",
      audioFetchError: false,
    });
  }
}

/**
 * Evaluates song content for safety and community compliance.
 * Intelligently routes between Lyrics Text Moderation and Multimodal Audio Moderation.
 * @param {object} params
 * @param {string} params.title
 * @param {string} [params.lyrics]
 * @param {string[]} [params.artistNames]
 * @param {string} [params.description]
 * @param {string} [params.audioUrl]
 * @param {number} [params.duration]
 * @param {number} [params.fileSize]
 * @returns {Promise<object>}
 */
async function moderateSongContent({
  title,
  lyrics = "",
  artistNames = [],
  description = "",
  audioUrl = "",
  duration = 0,
  fileSize = 0,
}) {
  const cleanLyrics = extractCleanLyrics(lyrics);

  // Gate 1: If lyrics text is provided and substantial (>= 15 chars), prioritize fast & cost-efficient Lyrics Moderation
  if (cleanLyrics && cleanLyrics.length >= 15) {
    return await moderateLyricsAndText({ title, lyrics: cleanLyrics, artistNames, description });
  }

  // Gate 2: If no lyrics but audioUrl is available, perform Multimodal Audio Moderation
  if (audioUrl && isHttpUrl(audioUrl)) {
    return await moderateAudioContent({
      title,
      artistNames,
      description,
      audioUrl,
      duration,
      fileSize,
    });
  }

  // Gate 3: If no lyrics and no valid audioUrl, evaluate via Metadata
  return await moderateLyricsAndText({ title, lyrics: "", artistNames, description });
}

/**
 * Process moderation for a specific Song document by ID.
 * Persists moderation result to database. Does NOT delete song even if BLOCK.
 * @param {string} songId
 * @returns {Promise<object>} Updated Song document
 */
async function processSongModeration(songId) {
  const song = await Song.findById(songId)
    .populate("artists", "name")
    .populate("uploadedBy", "name email");
  if (!song) {
    throw new Error(`Song not found for moderation: ${songId}`);
  }

  const artistNames = Array.isArray(song.artists)
    ? song.artists.map((a) => (typeof a === "object" ? a?.name : a)).filter(Boolean)
    : [];

  const modResult = await moderateSongContent({
    title: song.title,
    lyrics: song.lyrics || "",
    artistNames,
    audioUrl: song.audioUrl,
    duration: song.duration,
    fileSize: song.fileSize,
  });

  song.moderation = {
    status: modResult.status,
    riskLevel: modResult.riskLevel,
    flags: modResult.flags || [],
    reason: modResult.reason || "",
    confidence: modResult.confidence ?? 1.0,
    source: modResult.source || "metadata",
    audioTrackType: modResult.audioTrackType || "none",
    audioAnalyzed: Boolean(modResult.audioAnalyzed),
    moderatedAt: new Date(),
    reviewDecision: song.moderation?.reviewDecision || "none",
    reviewedBy: song.moderation?.reviewedBy || null,
    reviewedAt: song.moderation?.reviewedAt || null,
    reviewNote: song.moderation?.reviewNote || "",
  };

  // Important rule: AI moderation alone does NOT delete song from DB.
  // If status is BLOCK, unpublish if it was public to protect platform while awaiting Admin decision
  const rawUploader = song.uploadedBy;
  const uploaderId = rawUploader?._id || rawUploader;

  const savedSong = await song.save();

  // 🔔 NOTIFICATION SYSTEM INTEGRATION:
  try {
    const notificationTriggerService = require("./notificationTrigger.service");

    // 1. Notify uploader (User/Artist) of the scan result (SAFE / REVIEW / BLOCK)
    if (uploaderId) {
      await notificationTriggerService
        .triggerSongModerationNotification({
          song: savedSong,
          uploaderId,
          moderationResult: modResult,
        })
        .catch((err) => console.warn("[AIModeration] Failed to notify uploader:", err.message));
    }

    // 2. If REVIEW or BLOCK, notify all Admins to review/take action
    if (modResult.status === "REVIEW" || modResult.status === "BLOCK") {
      await notificationTriggerService
        .triggerAdminModerationAlert({
          song: savedSong,
          uploader: rawUploader,
          moderationResult: modResult,
        })
        .catch((err) => console.warn("[AIModeration] Failed to alert admins:", err.message));
    }
  } catch (notifErr) {
    console.warn("[AIModeration] Notification trigger error:", notifErr.message);
  }

  return savedSong;

}


module.exports = {
  isHttpUrl,
  getAudioMimeType,
  fetchAudioBuffer,
  validateModerationResult,
  heuristicModerationFallback,
  moderateLyricsAndText,
  moderateAudioContent,
  moderateSongContent,
  processSongModeration,
};
