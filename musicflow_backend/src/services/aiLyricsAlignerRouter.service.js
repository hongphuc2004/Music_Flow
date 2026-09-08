/**
 * aiLyricsAlignerRouter.service.js
 * Multi-Provider High-Availability Cascading Router for MusicFlow AI Lyrics Alignment.
 * Tier 0: Local CPU Service (Dev)
 * Tier 1: Modal Serverless Webhook (5GB RAM, Scales to 0)
 * Tier 2: Google Gemini Audio API (Free $0 fallback)
 */

const axios = require("axios");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const LyricsAlignmentJob = require("../models/lyrics-alignment-job.model");
const SongLyrics = require("../models/song-lyrics.model");
const Song = require("../models/song.model");

const DEFAULT_MODAL_URL = process.env.MODAL_ALIGNMENT_URL || null; // Tắt Modal mặc định để ưu tiên Render/Local
const GEMINI_SAFE_MODELS = ["gemini-1.5-flash-latest", "gemini-1.5-pro-latest", "gemini-2.0-flash-exp"];

function formatLrcTimestamp(seconds) {
  if (typeof seconds !== "number" || isNaN(seconds) || seconds < 0) {
    seconds = 0;
  }
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(2);
  return `[${String(mins).padStart(2, "0")}:${secs.padStart(5, "0")}]`;
}

/**
 * Executes alignment with automatic fallback across all providers
 * @param {string} jobId 
 */
async function processAlignmentWithFallback(jobId) {
  const job = await LyricsAlignmentJob.findById(jobId);
  if (!job || job.status === "succeeded") return;

  const song = await Song.findById(job.songId);
  if (!song || !song.audioUrl) {
    job.status = "failed";
    job.errorMessage = "Không tìm thấy tệp âm thanh của bài hát";
    await job.save();
    return;
  }

  const songLyrics = await SongLyrics.findOne({ songId: song._id });
  const plainLyrics = songLyrics?.plainLyrics || song.lyrics || "";
  if (!plainLyrics.trim()) {
    job.status = "failed";
    job.errorMessage = "Không tìm thấy nội dung lời bài hát";
    await job.save();
    return;
  }

  job.status = "processing";
  job.stage = "PREPROCESSING";
  job.progressPercent = 25;
  job.progressMessage = "Đang nạp và chuẩn bị âm thanh...";
  job.processingStartedAt = new Date();
  job.lastHeartbeatAt = new Date();
  await job.save();

  let alignmentResult = null;
  let usedProvider = null;
  let errors = [];

  const isDev = process.env.NODE_ENV !== "production";

  // ==========================================
  // TIER 0: Local CPU Service (Chạy trực tiếp máy local trên port 8000 hoặc 8080)
  // ==========================================
  if (isDev) {
    const candidateUrls = [
      process.env.LOCAL_ALIGNMENT_URL,
      "http://127.0.0.1:8000/align",
      "http://127.0.0.1:8080/align",
      "http://localhost:8000/align",
      "http://localhost:8080/align",
    ].filter(Boolean);

    // Lọc bỏ URL trùng lặp
    const uniqueUrls = [...new Set(candidateUrls)];

    for (const url of uniqueUrls) {
      if (alignmentResult) break;
      try {
        console.log(`[AlignRouter] [Tier 0 Local] Checking local CPU service: ${url}...`);
        job.stage = "ALIGNING";
        job.progressMessage = "Đang xử lý căn nhịp trực tiếp bằng CPU máy...";
        job.progressPercent = 45;
        await job.save();

        const localRes = await axios.post(
          url,
          {
            audioUrl: song.audioUrl,
            plainLyrics: plainLyrics,
          },
          { timeout: 120000 }
        );

        if (localRes.data && localRes.data.success && localRes.data.syncedLines?.length > 0) {
          alignmentResult = localRes.data;
          usedProvider = "local_cpu";
          console.log(`[AlignRouter] ✅ Local CPU alignment succeeded on ${url} in ${localRes.data.elapsedSeconds || "?"}s!`);
          break;
        }
      } catch (err) {
        errors.push(`Local CPU (${url}): ${err.message}`);
      }
    }
  }

  // ==========================================
  // TIER 1: Modal Serverless Webhook
  // ==========================================
  if (!alignmentResult && DEFAULT_MODAL_URL) {
    try {
      console.log(`[AlignRouter] [Tier 1 Modal] Calling Modal Serverless: ${DEFAULT_MODAL_URL}...`);
      job.stage = "ALIGNING";
      job.progressMessage = "AI đang phân tích giai điệu và nhận diện giọng hát...";
      job.progressPercent = 55;
      await job.save();

      const modalRes = await axios.post(
        DEFAULT_MODAL_URL,
        {
          audioUrl: song.audioUrl,
          plainLyrics: plainLyrics,
        },
        { timeout: 180000 }
      );

      if (modalRes.data && modalRes.data.success && modalRes.data.syncedLines?.length > 0) {
        alignmentResult = modalRes.data;
        usedProvider = "modal_serverless";
        console.log(`[AlignRouter] ✅ Modal Serverless alignment succeeded in ${modalRes.data.elapsedSeconds || "?"}s!`);
      } else {
        throw new Error(modalRes.data?.error || "Modal returned invalid alignment data");
      }
    } catch (err) {
      console.warn(`[AlignRouter] ⚠️ Modal Serverless failed: ${err.message}. Cascading to Gemini Audio Fallback...`);
      errors.push(`Modal: ${err.message}`);
    }
  }

  // ==========================================
  // TIER 2: Google Gemini Audio Fallback
  // ==========================================
  if (!alignmentResult && process.env.GEMINI_API_KEY) {
    try {
      console.log(`[AlignRouter] [Tier 2] Calling Gemini Audio API fallback...`);
      job.stage = "POSTPROCESSING";
      job.progressMessage = "Đang tinh chỉnh và hoàn thiện các mốc thời gian...";
      job.progressPercent = 85;
      await job.save();

      const audioResponse = await axios.get(song.audioUrl, {
        responseType: "arraybuffer",
        timeout: 30000,
      });
      const audioBase64 = Buffer.from(audioResponse.data).toString("base64");

      let mimeType = "audio/mp3";
      if (song.audioUrl.endsWith(".wav")) mimeType = "audio/wav";
      else if (song.audioUrl.endsWith(".ogg")) mimeType = "audio/ogg";
      else if (song.audioUrl.endsWith(".m4a")) mimeType = "audio/m4a";

      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

      const prompt = `You are a high-precision audio lyrics alignment engine (Karaoke LRC Sync).
Synchronize the provided plain lyrics with the attached audio.
For EVERY non-empty line, calculate exact startTime and endTime in seconds.
Provide word-level timestamps (word, startTime, endTime).

Plain Lyrics:
"""
${plainLyrics}
"""

Return ONLY JSON:
{
  "syncedLines": [
    {
      "lineIndex": 0,
      "text": "...",
      "startTime": 12.34,
      "endTime": 16.50,
      "words": [{ "text": "...", "startTime": 12.34, "endTime": 12.80 }]
    }
  ],
  "lrcData": "[00:12.34]...\\n[00:16.80]..."
}`;

      for (const modelName of GEMINI_SAFE_MODELS) {
        try {
          const model = genAI.getGenerativeModel({
            model: modelName,
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.1,
            },
          });

          const result = await model.generateContent([
            { inlineData: { data: audioBase64, mimeType } },
            prompt,
          ]);

          const cleanJson = result.response.text().replace(/```json/gi, "").replace(/```/g, "").trim();
          const parsed = JSON.parse(cleanJson);
          if (parsed && Array.isArray(parsed.syncedLines) && parsed.syncedLines.length > 0) {
            alignmentResult = {
              success: true,
              syncedLines: parsed.syncedLines.map((l, idx) => ({
                lineIndex: idx,
                startTime: typeof l.startTime === "number" ? l.startTime : 0,
                endTime: typeof l.endTime === "number" ? l.endTime : 0,
                text: String(l.text || "").trim(),
                words: Array.isArray(l.words)
                  ? l.words.map((w) => ({
                      text: String(w.text || "").trim(),
                      startTime: typeof w.startTime === "number" ? w.startTime : 0,
                      endTime: typeof w.endTime === "number" ? w.endTime : 0,
                      rawStartTime: typeof w.startTime === "number" ? w.startTime : 0,
                      rawEndTime: typeof w.endTime === "number" ? w.endTime : 0,
                      tailExtensionAppliedSec: 0,
                    }))
                  : [],
              })),
              lrcData: parsed.lrcData || "",
              qualityStatus: "GOOD",
              qualityNotes: [`Căn nhịp bằng AI (${modelName})`],
            };
            usedProvider = `gemini_${modelName}`;
            break;
          }
        } catch (mErr) {
          console.warn(`[AlignRouter] Gemini ${modelName} attempt failed: ${mErr.message}`);
        }
      }
    } catch (gErr) {
      console.warn(`[AlignRouter] ⚠️ Gemini Audio fallback failed: ${gErr.message}`);
      errors.push(`Gemini: ${gErr.message}`);
    }
  }

  // ==========================================
  // APPLY RESULT OR RECORD FAILURE
  // ==========================================
  if (alignmentResult && alignmentResult.syncedLines?.length > 0) {
    let finalLrc = alignmentResult.lrcData || "";
    if (!finalLrc.trim()) {
      finalLrc = alignmentResult.syncedLines
        .map((l) => `${formatLrcTimestamp(l.startTime)}${l.text}`)
        .join("\n");
    }

    job.status = "succeeded";
    job.stage = "COMPLETED";
    job.progressPercent = 100;
    job.progressMessage = "Hoàn tất tạo nhịp karaoke!";
    job.completedAt = new Date();
    job.metadata = {
      ...job.metadata,
      alignmentModel: usedProvider,
      pipelineVersion: "4.0.0-multi-cloud",
    };
    job.result = {
      syncedLines: alignmentResult.syncedLines,
      lrcData: finalLrc,
      qualityStatus: alignmentResult.qualityStatus || "GOOD",
      qualityNotes: alignmentResult.qualityNotes || [`Xử lý thành công qua ${usedProvider}`],
    };
    await job.save();

    if (songLyrics) {
      songLyrics.lyricsType = "synced";
      songLyrics.syncSource = "ai_alignment";
      songLyrics.lastAlignmentJobId = job._id;
      songLyrics.plainLyrics = plainLyrics;
      songLyrics.lrcData = finalLrc;
      songLyrics.syncedLines = alignmentResult.syncedLines;
      songLyrics.version = (songLyrics.version || 1) + 1;
      await songLyrics.save();
    }

    console.log(`[AlignRouter] 🎉 Song ${song._id} aligned successfully via provider: ${usedProvider}`);
  } else {
    job.status = "failed";
    job.stage = "FAILED";
    job.progressPercent = 100;
    job.progressMessage = "Không thể hoàn tất căn nhịp lúc này";
    job.errorCode = "ALL_ALIGNMENT_PROVIDERS_FAILED";
    job.errorMessage = isDev 
      ? "Chưa bật service căn nhịp local hoặc kiểm tra kết nối mạng tới dịch vụ AI."
      : "Không thể kết nối dịch vụ AI căn nhịp lúc này. Vui lòng thử lại sau giây lát.";
    job.failedAt = new Date();
    await job.save();
    console.error(`[AlignRouter] ❌ Job ${jobId} failed across all providers:`, errors);
  }
}

module.exports = {
  processAlignmentWithFallback,
};
