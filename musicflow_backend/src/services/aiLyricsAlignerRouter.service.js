/**
 * aiLyricsAlignerRouter.service.js
 * Fallback Guardian for MusicFlow AI Lyrics Alignment.
 * 
 * CORE PRINCIPLE:
 * Worker (Wav2Vec2 CTC ONNX INT8) is the SOLE authority to claim jobs:
 *   pending -> Worker claim -> processing -> succeeded
 * 
 * Guardian NEVER eagerly changes status from pending to processing.
 * Guardian only observes the job and activates fallback when:
 * 1. Worker does not claim the job after grace period (~20s), OR
 * 2. Worker claims job but crashes / heartbeats stop (>60s timeout), OR
 * 3. Worker marks job as failed.
 * 
 * Fallback cascade order:
 * Tier 0: LOCAL_ALIGNMENT_URL (only when configured in dev/docker)
 * Tier 1: MODAL_ALIGNMENT_URL (serverless webhook, if configured)
 * Tier 2: Google Gemini Audio API (emergency fallback of last resort)
 */

const axios = require("axios");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const LyricsAlignmentJob = require("../models/lyrics-alignment-job.model");
const SongLyrics = require("../models/song-lyrics.model");
const Song = require("../models/song.model");

const GEMINI_SAFE_MODELS = [
  "gemini-2.0-flash",
  "gemini-1.5-flash-latest",
  "gemini-2.5-flash",
  "gemini-1.5-pro-latest",
];

const GRACE_PERIOD_MS = 20000;          // 20s for Worker to claim pending job
const HEARTBEAT_TIMEOUT_MS = 60000;     // 60s of silence before considering Worker dead
const MONITOR_INTERVAL_MS = 10000;      // 10s polling interval for Guardian watch loop
const MAX_TOTAL_MONITOR_MS = 600000;    // 10 minutes maximum tracking time for long tracks

function formatLrcTimestamp(seconds) {
  if (typeof seconds !== "number" || isNaN(seconds) || seconds < 0) {
    seconds = 0;
  }
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(2);
  return `[${String(mins).padStart(2, "0")}:${secs.padStart(5, "0")}]`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Schedules fallback monitoring for a newly created alignment job.
 * Allows the dedicated ONNX INT8 worker to claim and process the job naturally.
 * @param {string} jobId
 */
async function scheduleAlignmentFallback(jobId) {
  // Run asynchronously in the background
  setImmediate(async () => {
    try {
      await runFallbackGuardian(jobId);
    } catch (err) {
      console.error(`[FallbackGuardian] Unexpected error watching job ${jobId}:`, err);
    }
  });
}

/**
 * Guardian loop: Monitors worker lifecycle and triggers fallback only when worker fails.
 * @param {string} jobId 
 */
async function runFallbackGuardian(jobId) {
  console.log(`[FallbackGuardian] Started monitoring job ${jobId}. Waiting ${GRACE_PERIOD_MS / 1000}s grace period for Worker...`);

  // Phase 1: Grace Period — Give Worker time to claim from MongoDB queue
  await sleep(GRACE_PERIOD_MS);

  let job = await LyricsAlignmentJob.findById(jobId);
  if (!job) {
    console.log(`[FallbackGuardian] Job ${jobId} not found. Stopping guardian.`);
    return;
  }

  // If worker finished already during grace period
  if (job.status === "succeeded") {
    console.log(`[FallbackGuardian] ✅ Job ${jobId} completed successfully by Worker ${job.workerId || "native"}. No fallback needed.`);
    return;
  }

  // Phase 2: If job is STILL "pending" after grace period -> Worker did not claim job!
  if (job.status === "pending") {
    console.warn(`[FallbackGuardian] ⚠️ Job ${jobId} is still pending after ${GRACE_PERIOD_MS / 1000}s. No Worker claimed the job. Activating Fallback Cascade...`);
    await executeFallbackCascade(jobId, "WORKER_UNAVAILABLE_OR_OFFLINE");
    return;
  }

  // Phase 3: If job was explicitly marked failed by worker
  if (job.status === "failed") {
    console.warn(`[FallbackGuardian] ⚠️ Job ${jobId} was marked failed by worker (${job.errorMessage || "Unknown"}). Activating Fallback Cascade...`);
    await executeFallbackCascade(jobId, "WORKER_REPORTED_FAILURE");
    return;
  }

  // Phase 4: Job is "processing" with active workerId -> Worker is processing!
  // Monitor heartbeats until completion or crash. DO NOT abort just because it takes time.
  const guardianStartTime = Date.now();
  console.log(`[FallbackGuardian] 🔍 Job ${jobId} is being processed by Worker (${job.workerId}). Monitoring heartbeats...`);

  while (true) {
    await sleep(MONITOR_INTERVAL_MS);

    job = await LyricsAlignmentJob.findById(jobId);
    if (!job) return;

    if (job.status === "succeeded") {
      console.log(`[FallbackGuardian] ✅ Job ${jobId} finished successfully by Worker (${job.workerId}). Guardian exiting cleanly.`);
      return;
    }

    if (job.status === "failed") {
      console.warn(`[FallbackGuardian] ⚠️ Job ${jobId} failed during worker execution. Activating Fallback Cascade...`);
      await executeFallbackCascade(jobId, "WORKER_PROCESSING_FAILED");
      return;
    }

    if (job.status === "cancelled") {
      console.log(`[FallbackGuardian] Job ${jobId} was cancelled. Stopping guardian.`);
      return;
    }

    // Check Worker Heartbeat
    const lastHeartbeat = job.lastHeartbeatAt ? new Date(job.lastHeartbeatAt).getTime() : new Date(job.processingStartedAt || job.createdAt).getTime();
    const timeSinceHeartbeat = Date.now() - lastHeartbeat;

    if (timeSinceHeartbeat > HEARTBEAT_TIMEOUT_MS) {
      console.error(`[FallbackGuardian] 🚨 Worker (${job.workerId}) stopped sending heartbeats for ${Math.round(timeSinceHeartbeat / 1000)}s (> ${HEARTBEAT_TIMEOUT_MS / 1000}s). Worker crashed! Activating Fallback Cascade...`);
      await executeFallbackCascade(jobId, "WORKER_HEARTBEAT_TIMEOUT");
      return;
    }

    // Safety guard against infinite loops
    if (Date.now() - guardianStartTime > MAX_TOTAL_MONITOR_MS) {
      console.error(`[FallbackGuardian] 🚨 Maximum total monitoring time exceeded (${MAX_TOTAL_MONITOR_MS / 1000}s) for job ${jobId}.`);
      await executeFallbackCascade(jobId, "GLOBAL_ALIGNMENT_TIMEOUT");
      return;
    }

    // Worker is alive, keep monitoring quietly
  }
}

/**
 * Fallback Cascade: Only invoked when Worker is dead, offline, or failed.
 * Tier 0: LOCAL_ALIGNMENT_URL (if configured)
 * Tier 1: Modal Serverless Webhook (if configured)
 * Tier 2: Google Gemini Audio API (last resort emergency fallback)
 * @param {string} jobId
 * @param {string} triggerReason
 */
async function executeFallbackCascade(jobId, triggerReason) {
  const job = await LyricsAlignmentJob.findById(jobId);
  if (!job || job.status === "succeeded") return;

  const song = await Song.findById(job.songId);
  if (!song || !song.audioUrl) {
    job.status = "failed";
    job.errorMessage = "Không tìm thấy tệp âm thanh của bài hát";
    job.failedAt = new Date();
    await job.save();
    return;
  }

  const songLyrics = await SongLyrics.findOne({ songId: song._id });
  const plainLyrics = songLyrics?.plainLyrics || song.lyrics || "";
  if (!plainLyrics.trim()) {
    job.status = "failed";
    job.errorMessage = "Không tìm thấy nội dung lời bài hát";
    job.failedAt = new Date();
    await job.save();
    return;
  }

  // Now taking over job for Fallback execution
  job.status = "processing";
  job.stage = "PREPROCESSING";
  job.progressPercent = 35;
  job.progressMessage = "Đang chuyển tiếp sang bộ xử lý dự phòng...";
  job.workerId = `fallback-guardian-${triggerReason.toLowerCase()}`;
  job.lastHeartbeatAt = new Date();
  await job.save();

  let alignmentResult = null;
  let usedProvider = null;
  let errors = [];

  // ==========================================
  // TIER 0: Local/Docker HTTP Service (chỉ chạy khi LOCAL_ALIGNMENT_URL được cấu hình)
  // ==========================================
  if (process.env.LOCAL_ALIGNMENT_URL) {
    const candidateUrls = [
      process.env.LOCAL_ALIGNMENT_URL,
    ].filter(Boolean);

    for (const url of candidateUrls) {
      if (alignmentResult) break;
      try {
        console.log(`[FallbackGuardian] [Tier 0 Local/Docker] Trying HTTP service: ${url}...`);
        job.stage = "ALIGNING";
        job.progressMessage = "Đang xử lý qua cổng dự phòng nội bộ...";
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
          usedProvider = "local_http";
          console.log(`[FallbackGuardian] ✅ Local HTTP fallback succeeded on ${url}!`);
          break;
        }
      } catch (err) {
        errors.push(`Local HTTP (${url}): ${err.message}`);
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

    console.log(`[FallbackGuardian] 🎉 Song ${song._id} aligned successfully via fallback provider: ${usedProvider}`);
  } else {
    const isDev = process.env.NODE_ENV !== "production";
    job.status = "failed";
    job.stage = "FAILED";
    job.progressPercent = 100;
    job.progressMessage = "Không thể hoàn tất căn nhịp lúc này";
    job.errorCode = "ALL_ALIGNMENT_PROVIDERS_FAILED";
    job.errorMessage = isDev 
      ? "Worker AI chưa bật và các cổng fallback không khả dụng."
      : "Không thể kết nối dịch vụ AI căn nhịp lúc này. Vui lòng thử lại sau giây lát.";
    job.failedAt = new Date();
    await job.save();
    console.error(`[FallbackGuardian] ❌ Job ${jobId} failed across all fallback providers:`, errors);
  }
}

module.exports = {
  scheduleAlignmentFallback,
  processAlignmentWithFallback: scheduleAlignmentFallback, // backwards-compatible alias
  executeFallbackCascade,
};
