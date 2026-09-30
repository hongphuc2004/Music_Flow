const axios = require("axios");

// Simple in-memory cache to speed up playback for repeated assistant phrases
const ttsCache = new Map();
const MAX_CACHE_SIZE = 100;

/**
 * Splits text into chunks under maxLen characters without breaking words.
 */
function splitTextIntoChunks(text, maxLen = 180) {
  if (text.length <= maxLen) return [text];

  const sentences = text.split(/(?<=[.!?\n,;])\s+/);
  const chunks = [];
  let current = "";

  for (const sentence of sentences) {
    if ((current + " " + sentence).trim().length <= maxLen) {
      current = (current + " " + sentence).trim();
    } else {
      if (current) chunks.push(current);
      if (sentence.length <= maxLen) {
        current = sentence;
      } else {
        // Fallback: split by words
        const words = sentence.split(" ");
        current = "";
        for (const word of words) {
          if ((current + " " + word).trim().length <= maxLen) {
            current = (current + " " + word).trim();
          } else {
            if (current) chunks.push(current);
            current = word;
          }
        }
      }
    }
  }

  if (current) chunks.push(current);
  return chunks.filter(c => c.length > 0);
}

/**
 * Strips markdown, emojis, URLs, and code blocks to make text suitable for TTS.
 */
function cleanTextForSpeech(raw) {
  if (!raw || typeof raw !== "string") return "";

  let text = raw;
  // Remove URLs
  text = text.replace(/https?:\/\/\S+|www\.\S+/g, "");
  // Remove markdown code blocks and inline code
  text = text.replace(/```[\s\S]*?```/g, "").replace(/`[^`]*`/g, "");
  // Remove markdown bold, italic, headers, bullet points
  text = text.replace(/#{1,6}\s*/g, "");
  text = text.replace(/[*_~]{1,3}([^*_~]+)[*_~]{1,3}/g, "$1");
  text = text.replace(/^\s*[-*+]\s+/gm, "");
  text = text.replace(/^\s*\d+\.\s+/gm, "");
  // Remove emojis and special symbols
  text = text.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{FE00}-\u{FE0F}\u{200D}]/gu, "");
  // Collapse whitespace
  text = text.replace(/[ \t]+/g, " ").replace(/\n{2,}/g, "\n").trim();

  return text;
}

/**
 * GET /api/ai/tts?text=...&lang=vi
 * Synthesizes Vietnamese speech using Google Vietnamese TTS audio service.
 */
exports.synthesizeSpeech = async (req, res) => {
  try {
    const rawText = req.query.text || (req.body && req.body.text) || "";
    const lang = (req.query.lang || (req.body && req.body.lang) || "vi").trim().toLowerCase();

    const cleanText = cleanTextForSpeech(rawText);

    if (!cleanText) {
      return res.status(400).json({ success: false, message: "Text parameter is required." });
    }

    // Safety limit to prevent abuse
    if (cleanText.length > 1000) {
      return res.status(400).json({ success: false, message: "Text exceeds maximum allowed length of 1000 characters." });
    }

    const cacheKey = `${lang}:${cleanText}`;
    if (ttsCache.has(cacheKey)) {
      const cachedBuffer = ttsCache.get(cacheKey);
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Content-Length", cachedBuffer.length);
      res.setHeader("Cache-Control", "public, max-age=86400");
      return res.send(cachedBuffer);
    }

    const chunks = splitTextIntoChunks(cleanText, 180);
    const audioBuffers = [];

    for (const chunk of chunks) {
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${encodeURIComponent(lang)}&client=tw-ob&q=${encodeURIComponent(chunk)}`;
      const response = await axios.get(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          "Referer": "https://translate.google.com/",
        },
        responseType: "arraybuffer",
        timeout: 8000,
      });

      audioBuffers.push(Buffer.from(response.data));
    }

    const finalBuffer = Buffer.concat(audioBuffers);

    // Save in cache
    if (ttsCache.size >= MAX_CACHE_SIZE) {
      const firstKey = ttsCache.keys().next().value;
      ttsCache.delete(firstKey);
    }
    ttsCache.set(cacheKey, finalBuffer);

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Length", finalBuffer.length);
    res.setHeader("Cache-Control", "public, max-age=86400");
    return res.send(finalBuffer);
  } catch (error) {
    console.error("[TTSController] Error synthesizing speech:", error.message);
    return res.status(500).json({
      success: false,
      message: "Không thể tạo giọng đọc tiếng Việt lúc này. Vui lòng thử lại sau.",
      error: error.message,
    });
  }
};
