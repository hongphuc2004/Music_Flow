const axios = require("axios");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const LyricsAlignmentJob = require("../models/lyrics-alignment-job.model");
const SongLyrics = require("../models/song-lyrics.model");
const Song = require("../models/song.model");

// Gemini Model Cascade
const GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
];

/**
 * Format seconds to standard LRC timestamp [mm:ss.xx]
 * @param {number} seconds 
 * @returns {string}
 */
function formatLrcTimestamp(seconds) {
  if (typeof seconds !== "number" || isNaN(seconds) || seconds < 0) {
    seconds = 0;
  }
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(2);
  const formattedSecs = secs.padStart(5, "0");
  return `[${String(mins).padStart(2, "0")}:${formattedSecs}]`;
}

/**
 * Align plain lyrics to audio using Gemini Multimodal Audio API
 * @param {string} jobId 
 */
async function processGeminiAlignmentJob(jobId) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured on server");
  }

  const job = await LyricsAlignmentJob.findById(jobId);
  if (!job) return;

  try {
    // 1. Mark Job as processing
    job.status = "processing";
    job.stage = "DOWNLOADING_AUDIO";
    job.progressPercent = 15;
    job.progressMessage = "Đang tải tệp âm thanh...";
    job.processingStartedAt = new Date();
    job.lastHeartbeatAt = new Date();
    await job.save();

    // 2. Fetch Song and SongLyrics
    const song = await Song.findById(job.songId);
    if (!song || !song.audioUrl) {
      throw new Error("Không tìm thấy tệp âm thanh của bài hát");
    }

    const songLyrics = await SongLyrics.findOne({ songId: song._id });
    const plainLyrics = songLyrics?.plainLyrics || song.lyrics || "";
    if (!plainLyrics.trim()) {
      throw new Error("Không tìm thấy nội dung lời bài hát");
    }

    // 3. Download audio file to buffer
    const audioResponse = await axios.get(song.audioUrl, {
      responseType: "arraybuffer",
      timeout: 30000,
    });
    const audioBuffer = Buffer.from(audioResponse.data);
    const audioBase64 = audioBuffer.toString("base64");

    // Detect mime type
    let mimeType = "audio/mp3";
    if (song.audioUrl.endsWith(".wav")) mimeType = "audio/wav";
    else if (song.audioUrl.endsWith(".ogg")) mimeType = "audio/ogg";
    else if (song.audioUrl.endsWith(".m4a")) mimeType = "audio/m4a";

    // 4. Update progress
    job.stage = "ALIGNING";
    job.progressPercent = 45;
    job.progressMessage = "Gemini AI đang lắng nghe và bắt nhịp từng câu...";
    job.lastHeartbeatAt = new Date();
    await job.save();

    const genAI = new GoogleGenerativeAI(apiKey);

    const prompt = `You are a high-precision audio lyrics alignment engine (Karaoke LRC Sync) specialized in Vietnamese and international music.

Task:
1. Listen carefully to the vocal track of the attached audio.
2. Synchronize the provided plain lyrics with the audio.
3. For EVERY non-empty line in the provided lyrics, calculate its exact start and end time in seconds.
4. For every line, provide word-level timestamps (word, startTime, endTime).
5. Ensure timestamps are strictly increasing and match the singing rhythm.

Provided Plain Lyrics:
"""
${plainLyrics}
"""

Return ONLY a JSON object with this exact structure (no markdown fences, no explanatory text):
{
  "syncedLines": [
    {
      "lineIndex": 0,
      "text": "Line text",
      "startTime": 12.34,
      "endTime": 16.50,
      "words": [
        {
          "text": "Word",
          "startTime": 12.34,
          "endTime": 12.80
        }
      ]
    }
  ],
  "lrcData": "[00:12.34]Line text\\n[00:16.80]Next line..."
}`;

    let parsedResult = null;
    let usedModel = null;
    let lastError = null;

    for (const modelName of GEMINI_MODELS) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.1,
          },
        });

        const result = await model.generateContent([
          {
            inlineData: {
              data: audioBase64,
              mimeType,
            },
          },
          prompt,
        ]);

        const text = result.response.text();
        // Clean any accidental markdown codeblock wrapper
        const cleanJson = text.replace(/```json/gi, "").replace(/```/g, "").trim();
        parsedResult = JSON.parse(cleanJson);
        usedModel = modelName;
        break;
      } catch (err) {
        console.warn(`[GeminiLyrics] Model ${modelName} failed: ${err.message}. Trying next model...`);
        lastError = err;
      }
    }

    if (!parsedResult || !Array.isArray(parsedResult.syncedLines) || parsedResult.syncedLines.length === 0) {
      throw new Error(`Gemini không thể căn nhịp tệp âm thanh: ${lastError?.message || "Dữ liệu trả về không hợp lệ"}`);
    }

    // 5. Post-process & reconstruct standard LRC if needed
    const formattedSyncedLines = parsedResult.syncedLines.map((line, idx) => {
      const lineStart = typeof line.startTime === "number" ? line.startTime : 0;
      const lineEnd = typeof line.endTime === "number" ? line.endTime : lineStart + 3.0;
      const lineText = String(line.text || "").trim();

      const words = Array.isArray(line.words)
        ? line.words.map((w) => ({
            text: String(w.text || "").trim(),
            startTime: typeof w.startTime === "number" ? w.startTime : lineStart,
            endTime: typeof w.endTime === "number" ? w.endTime : lineEnd,
            rawStartTime: typeof w.startTime === "number" ? w.startTime : lineStart,
            rawEndTime: typeof w.endTime === "number" ? w.endTime : lineEnd,
            tailExtensionAppliedSec: 0,
          }))
        : [];

      return {
        lineIndex: idx,
        startTime: lineStart,
        endTime: lineEnd,
        text: lineText,
        words,
      };
    });

    let generatedLrc = parsedResult.lrcData || "";
    if (!generatedLrc.trim()) {
      generatedLrc = formattedSyncedLines
        .map((l) => `${formatLrcTimestamp(l.startTime)}${l.text}`)
        .join("\n");
    }

    // 6. Update Job as succeeded
    job.status = "succeeded";
    job.stage = "COMPLETED";
    job.progressPercent = 100;
    job.progressMessage = "Hoàn tất tạo nhịp AI";
    job.completedAt = new Date();
    job.metadata = {
      ...job.metadata,
      alignmentModel: `google/${usedModel}`,
      pipelineVersion: "3.5.0-gemini",
    };
    job.result = {
      syncedLines: formattedSyncedLines,
      lrcData: generatedLrc,
      qualityStatus: "GOOD",
      qualityNotes: [`Bắt nhịp AI chính xác bằng ${usedModel}`],
    };
    await job.save();

    // 7. Update draft SongLyrics
    if (songLyrics) {
      songLyrics.lyricsType = "synced";
      songLyrics.syncSource = "ai_alignment";
      songLyrics.lastAlignmentJobId = job._id;
      songLyrics.plainLyrics = plainLyrics;
      songLyrics.lrcData = generatedLrc;
      songLyrics.syncedLines = formattedSyncedLines;
      songLyrics.version = (songLyrics.version || 1) + 1;
      await songLyrics.save();
    }

    console.log(`[GeminiLyrics] Successfully aligned song ${song._id} with ${usedModel} in job ${job._id}`);
  } catch (err) {
    console.error(`[GeminiLyrics] Job ${jobId} failed:`, err);
    job.status = "failed";
    job.stage = "FAILED";
    job.progressPercent = 100;
    job.progressMessage = `Lỗi: ${err.message}`;
    job.errorCode = "GEMINI_ALIGNMENT_FAILED";
    job.errorMessage = err.message;
    job.failedAt = new Date();
    await job.save();
  }
}

module.exports = {
  processGeminiAlignmentJob,
};
