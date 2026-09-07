const mongoose = require("mongoose");
const Song = require("../models/song.model");
const SongLyrics = require("../models/song-lyrics.model");
const { parseLrc, lrcToPlainText } = require("../utils/lrc-parser.util");

/**
 * Check ownership between song and the logged in artist/user.
 * @param {string} songId 
 * @param {string} userId 
 * @param {string} userRole 
 * @returns {Promise<{ song: import('mongoose').Document, artistId: string }>}
 */
async function resolveSongAndOwnership(songId, userId, userRole) {
  if (!mongoose.Types.ObjectId.isValid(songId)) {
    const err = new Error("ID bài hát không hợp lệ");
    err.status = 400;
    throw err;
  }

  const song = await Song.findById(songId).populate("artists", "_id name");
  if (!song) {
    const err = new Error("Không tìm thấy bài hát");
    err.status = 404;
    throw err;
  }

  const isUploader =
    song.uploadedBy &&
    (song.uploadedBy.toString() === userId || song.uploadedBy._id?.toString() === userId);

  const isArtist =
    song.artists &&
    song.artists.some(
      (a) => a.toString() === userId || a._id?.toString() === userId
    );

  if (!isUploader && !isArtist && userRole !== "admin") {
    const err = new Error("Bạn không có quyền quản lý lời bài hát này");
    err.status = 403;
    throw err;
  }

  // Resolve artistId from song's primary artist or uploader
  const primaryArtist = song.artists?.[0]?._id?.toString() || song.artists?.[0]?.toString();
  const artistId = isArtist ? userId : primaryArtist || userId;

  return { song, artistId };
}

/**
 * Get lyrics data for Artist Studio (including both Draft and Published snapshots)
 */
async function getSongLyricsForArtist(songId, userId, userRole) {
  const { song, artistId } = await resolveSongAndOwnership(songId, userId, userRole);

  let songLyrics = await SongLyrics.findOne({ songId });

  // If record doesn't exist yet, initialize draft from legacy Song.lyrics
  if (!songLyrics) {
    const legacyLyrics = song.lyrics || "";
    const parsedLegacy = parseLrc(legacyLegacyText(legacyLyrics), song.duration);

    return {
      songId: song._id,
      songTitle: song.title,
      songDuration: song.duration || 0,
      audioUrl: song.audioUrl,
      artistId,
      status: legacyLyrics ? "published" : "not_added",
      lyricsType: parsedLegacy.isSynced ? "synced" : "plain",
      plainLyrics: parsedLegacy.plainText || legacyLyrics,
      lrcData: parsedLegacy.isSynced ? legacyLyrics : "",
      syncedLines: parsedLegacy.syncedLines || [],
      publishedLyricsType: parsedLegacy.isSynced ? "synced" : (legacyLyrics ? "plain" : null),
      publishedPlainLyrics: parsedLegacy.plainText || legacyLyrics,
      publishedLrcData: parsedLegacy.isSynced ? legacyLyrics : "",
      publishedSyncedLines: parsedLegacy.syncedLines || [],
      publishedAt: legacyLyrics ? song.updatedAt : null,
      version: 1,
    };
  }

  return {
    songId: song._id,
    songTitle: song.title,
    songDuration: song.duration || 0,
    audioUrl: song.audioUrl,
    artistId: songLyrics.artistId,
    status: songLyrics.status,
    lyricsType: songLyrics.lyricsType,
    syncSource: songLyrics.syncSource || "manual",
    lastAlignmentJobId: songLyrics.lastAlignmentJobId || null,
    plainLyrics: songLyrics.plainLyrics || "",
    lrcData: songLyrics.lrcData || "",
    syncedLines: songLyrics.syncedLines || [],
    publishedLyricsType: songLyrics.publishedLyricsType,
    publishedPlainLyrics: songLyrics.publishedPlainLyrics || "",
    publishedLrcData: songLyrics.publishedLrcData || "",
    publishedSyncedLines: songLyrics.publishedSyncedLines || [],
    publishedAt: songLyrics.publishedAt,
    version: songLyrics.version || 1,
  };
}

/**
 * Helper to get clean legacy text
 */
function legacyLegacyText(text) {
  return typeof text === "string" ? text : "";
}

/**
 * Save draft lyrics without affecting client playback.
 */
async function saveDraftLyrics(songId, userId, userRole, payload = {}) {
  const { song, artistId } = await resolveSongAndOwnership(songId, userId, userRole);
  const { lyricsType = "plain", plainLyrics = "", lrcData = "" } = payload;

  const cleanPlain = String(plainLyrics || "").trim();
  const cleanLrc = String(lrcData || "").trim();

  // Parse draft LRC if synced mode
  let syncedLines = [];
  let warnings = [];
  if (lyricsType === "synced" && cleanLrc) {
    const parsed = parseLrc(cleanLrc, song.duration);
    syncedLines = parsed.syncedLines;
    warnings = parsed.warnings;
  }

  let songLyrics = await SongLyrics.findOne({ songId });
  if (!songLyrics) {
    songLyrics = new SongLyrics({
      songId: song._id,
      artistId,
      status: "draft",
      lyricsType,
      plainLyrics: cleanPlain,
      lrcData: cleanLrc,
      syncedLines,
      version: 1,
    });
  } else {
    songLyrics.lyricsType = lyricsType;
    songLyrics.plainLyrics = cleanPlain;
    songLyrics.lrcData = cleanLrc;
    songLyrics.syncedLines = syncedLines;
    if (songLyrics.status === "not_added") {
      songLyrics.status = "draft";
    }
    songLyrics.version = (songLyrics.version || 1) + 1;
  }

  await songLyrics.save();

  return {
    success: true,
    message: "Đã lưu bản nháp thành công",
    data: {
      status: songLyrics.status,
      lyricsType: songLyrics.lyricsType,
      plainLyrics: songLyrics.plainLyrics,
      lrcData: songLyrics.lrcData,
      syncedLines: songLyrics.syncedLines,
      version: songLyrics.version,
      warnings,
    },
  };
}

/**
 * Publish lyrics to Client Player and sync into Song.lyrics for Search & AI.
 */
async function publishLyrics(songId, userId, userRole, payload = {}) {
  const { song, artistId } = await resolveSongAndOwnership(songId, userId, userRole);
  const { lyricsType = "plain", plainLyrics = "", lrcData = "" } = payload;

  const cleanPlain = String(plainLyrics || "").trim();
  const cleanLrc = String(lrcData || "").trim();

  // Update or create SongLyrics
  let songLyrics = await SongLyrics.findOne({ songId });
  let existingSyncedLines = Array.isArray(songLyrics?.syncedLines) ? songLyrics.syncedLines : [];

  if (lyricsType === "plain") {
    if (!cleanPlain) {
      const err = new Error("Lời bài hát thường không được để trống khi xuất bản.");
      err.status = 400;
      throw err;
    }
    publishedPlain = cleanPlain;
  } else if (lyricsType === "synced") {
    if (!cleanLrc) {
      const err = new Error("Nội dung LRC không được để trống khi xuất bản.");
      err.status = 400;
      throw err;
    }
    const parsed = parseLrc(cleanLrc, song.duration);
    if (!parsed.syncedLines || parsed.syncedLines.length === 0) {
      const err = new Error("Không tìm thấy dòng lời bài hát có timestamp hợp lệ trong file LRC.");
      err.status = 400;
      throw err;
    }
    publishedLrc = cleanLrc;
    publishedSynced = parsed.syncedLines.map((line, idx) => {
      const matchedDraft = existingSyncedLines.find(
        (d) => Math.abs((d.startTime || 0) - (line.startTime || 0)) < 0.05 || (d.text && d.text.trim() === line.text.trim())
      );
      return {
        lineIndex: idx,
        startTime: line.startTime,
        endTime: line.endTime || matchedDraft?.endTime || line.startTime + 3.0,
        text: line.text,
        words: Array.isArray(matchedDraft?.words) ? matchedDraft.words : (Array.isArray(line.words) ? line.words : []),
      };
    });
    publishedPlain = cleanPlain || parsed.plainText || "";
    warnings = parsed.warnings;
  }

  if (!songLyrics) {
    songLyrics = new SongLyrics({
      songId: song._id,
      artistId,
      status: "published",
      lyricsType,
      plainLyrics: cleanPlain || publishedPlain,
      lrcData: cleanLrc,
      syncedLines: publishedSynced,
      publishedLyricsType: lyricsType,
      publishedPlainLyrics: publishedPlain,
      publishedLrcData: publishedLrc,
      publishedSyncedLines: publishedSynced,
      publishedAt: new Date(),
      version: 1,
    });
  } else {
    songLyrics.status = "published";
    songLyrics.lyricsType = lyricsType;
    songLyrics.plainLyrics = cleanPlain || publishedPlain;
    songLyrics.lrcData = cleanLrc;
    songLyrics.syncedLines = publishedSynced;

    songLyrics.publishedLyricsType = lyricsType;
    songLyrics.publishedPlainLyrics = publishedPlain;
    songLyrics.publishedLrcData = publishedLrc;
    songLyrics.publishedSyncedLines = publishedSynced;
    songLyrics.publishedAt = new Date();
    songLyrics.version = (songLyrics.version || 1) + 1;
  }

  await songLyrics.save();

  // Atomically sync into Song.lyrics for Search & AI compatibility
  song.lyrics = publishedPlain;
  await song.save();

  return {
    success: true,
    message: "Đã xuất bản lời bài hát thành công!",
    data: {
      status: "published",
      publishedLyricsType: lyricsType,
      publishedPlainLyrics: publishedPlain,
      publishedLrcData: publishedLrc,
      publishedSyncedLines: publishedSynced,
      publishedAt: songLyrics.publishedAt,
      version: songLyrics.version,
      warnings,
    },
  };
}

/**
 * Unpublish lyrics (Hides published lyrics from client, keeps draft intact).
 */
async function unpublishLyrics(songId, userId, userRole) {
  const { song } = await resolveSongAndOwnership(songId, userId, userRole);

  const songLyrics = await SongLyrics.findOne({ songId });
  if (!songLyrics || songLyrics.status !== "published") {
    const err = new Error("Bài hát này hiện chưa xuất bản lời bài hát");
    err.status = 400;
    throw err;
  }

  songLyrics.status = "draft";
  songLyrics.publishedLyricsType = null;
  songLyrics.publishedPlainLyrics = "";
  songLyrics.publishedLrcData = "";
  songLyrics.publishedSyncedLines = [];
  songLyrics.publishedAt = null;
  songLyrics.version = (songLyrics.version || 1) + 1;

  await songLyrics.save();

  // Clear public Song.lyrics
  song.lyrics = "";
  await song.save();

  return {
    success: true,
    message: "Đã hủy xuất bản lời bài hát. Bản nháp của bạn vẫn được lưu an toàn.",
    data: {
      status: "draft",
      version: songLyrics.version,
    },
  };
}

const LyricsAlignmentJob = require("../models/lyrics-alignment-job.model");
const alignmentConfig = require("../config/alignmentConfig");
const {
  normalizeLyricsText,
  computeLyricsContentHash,
  computeInputFingerprint,
  computePipelineFingerprint,
  computeCombinedFingerprint,
  computeAutoTranscribeInputFingerprint,
  computeAutoTranscribePipelineFingerprint,
} = require("../utils/alignment-fingerprint.util");

/**
 * Trigger an AI Lyric Alignment Job for a Song
 * @param {string} songId 
 * @param {string} userId 
 * @param {string} userRole 
 * @returns {Promise<object>}
 */
async function triggerAlignmentJob(songId, userId, userRole, payload = {}) {
  const forceRealign = Boolean(payload && payload.forceRealign);
  const { song, artistId } = await resolveSongAndOwnership(songId, userId, userRole);

  // 1. Validate Audio Asset
  const audioPublicId = song.audioPublicId || song.audioUrl;
  if (!audioPublicId || !song.audioUrl) {
    const err = new Error("Bài hát chưa có tệp âm thanh hợp lệ");
    err.status = 400;
    throw err;
  }

  // 2. Validate Song Duration Limit (Max 7 minutes for MVP VRAM safety)
  if (song.duration && song.duration > alignmentConfig.MAX_SONG_DURATION_SEC) {
    const err = new Error(
      `Độ dài bài hát (${Math.round(song.duration)}s) vượt quá giới hạn tối đa cho phép (${alignmentConfig.MAX_SONG_DURATION_SEC}s)`
    );
    err.status = 400;
    throw err;
  }

  // 3. Load or initialize SongLyrics
  let songLyrics = await SongLyrics.findOne({ songId });
  let plainLyrics = songLyrics?.plainLyrics;

  if (!plainLyrics) {
    // Fallback to legacy Song.lyrics if available
    const legacyText = song.lyrics || "";
    const parsed = parseLrc(legacyText, song.duration);
    plainLyrics = parsed.plainText || legacyText;
  }

  const normalizedLyrics = normalizeLyricsText(plainLyrics);
  if (!normalizedLyrics || normalizedLyrics.length < alignmentConfig.MIN_LYRICS_LENGTH) {
    const err = new Error(
      `Lời bài hát quá ngắn hoặc chưa có nội dung (tối thiểu ${alignmentConfig.MIN_LYRICS_LENGTH} ký tự)`
    );
    err.status = 400;
    throw err;
  }

  // If SongLyrics record didn't exist, create initial draft record now
  if (!songLyrics) {
    songLyrics = await SongLyrics.create({
      songId: song._id,
      artistId,
      lyricsType: "plain",
      status: "draft",
      plainLyrics: normalizedLyrics,
      version: 1,
    });
  }

  // 4. Compute deterministic Fingerprints
  const plainLyricsHash = computeLyricsContentHash(normalizedLyrics);
  const inputFingerprint = computeInputFingerprint(song._id, audioPublicId, normalizedLyrics);
  const pipelineFingerprint = computePipelineFingerprint(alignmentConfig);
  const combinedFingerprint = computeCombinedFingerprint(inputFingerprint, pipelineFingerprint);

  // 5. Check for active Job (Pending or Processing)
  const activeJob = await LyricsAlignmentJob.findOne({
    songId: song._id,
    fingerprint: combinedFingerprint,
    status: { $in: ["pending", "processing"] },
  });

  if (activeJob) {
    return {
      jobId: activeJob._id,
      songId: song._id,
      status: activeJob.status,
      fingerprint: activeJob.fingerprint,
      isCached: false,
      message: "Tác vụ tạo nhịp AI đang được xử lý",
      createdAt: activeJob.createdAt,
    };
  }

  // 6. Check for completed Job with identical Fingerprint (Idempotency Cache)
  if (!forceRealign) {
    const existingCompletedJob = await LyricsAlignmentJob.findOne({
      songId: song._id,
      fingerprint: combinedFingerprint,
      status: "succeeded",
    }).sort({ completedAt: -1 });

    if (existingCompletedJob) {
      if (existingCompletedJob.result?.lrcData) {
        songLyrics.lyricsType = "synced";
        songLyrics.syncSource = "ai_alignment";
        songLyrics.lastAlignmentJobId = existingCompletedJob._id;
        songLyrics.plainLyrics = normalizedLyrics;
        songLyrics.lrcData = existingCompletedJob.result.lrcData;
        songLyrics.syncedLines = existingCompletedJob.result.syncedLines || [];
        songLyrics.version = (songLyrics.version || 1) + 1;
        await songLyrics.save();
      }

      return {
        jobId: existingCompletedJob._id,
        songId: song._id,
        status: "succeeded",
        qualityStatus: existingCompletedJob.result?.qualityStatus || "GOOD",
        qualityNotes: existingCompletedJob.result?.qualityNotes || [],
        fingerprint: existingCompletedJob.fingerprint,
        isCached: true,
        result: existingCompletedJob.result,
        message: "Đã có kết quả AI căn nhịp trước đó với cùng nội dung",
        createdAt: existingCompletedJob.createdAt,
        completedAt: existingCompletedJob.completedAt,
      };
    }
  } else {
    // If force realign is requested, remove old jobs for this song and fingerprint so a fresh job runs
    await LyricsAlignmentJob.deleteMany({
      songId: song._id,
      status: { $in: ["succeeded", "failed"] },
    });
  }

  // 7. Create New Alignment Job with Optimistic Concurrency Snapshot
  try {
    const newJob = await LyricsAlignmentJob.create({
      songId: song._id,
      artistId,
      status: "pending",
      audioPublicId,
      plainLyricsHash,
      inputFingerprint,
      pipelineFingerprint,
      fingerprint: combinedFingerprint,
      expectedDraftVersion: songLyrics.version || 1,
      metadata: {
        separatorModel: alignmentConfig.SEPARATOR_MODEL,
        alignmentModel: alignmentConfig.ALIGNMENT_MODEL,
        pipelineVersion: alignmentConfig.PIPELINE_VERSION,
        postProcessVersion: alignmentConfig.POSTPROCESS_VERSION,
      },
    });

    return {
      jobId: newJob._id,
      songId: song._id,
      status: newJob.status,
      fingerprint: newJob.fingerprint,
      expectedDraftVersion: newJob.expectedDraftVersion,
      isCached: false,
      message: "Tạo tác vụ AI căn nhịp thành công",
      createdAt: newJob.createdAt,
    };
  } catch (error) {
    // Handle concurrent duplicate creation gracefully (E11000 partial index)
    if (error.code === 11000) {
      const concurrentJob = await LyricsAlignmentJob.findOne({
        songId: song._id,
        fingerprint: combinedFingerprint,
        status: { $in: ["pending", "processing"] },
      });
      if (concurrentJob) {
        return {
          jobId: concurrentJob._id,
          songId: song._id,
          status: concurrentJob.status,
          fingerprint: concurrentJob.fingerprint,
          isCached: false,
          message: "Tác vụ tạo nhịp AI đang được xử lý",
          createdAt: concurrentJob.createdAt,
        };
      }
    }
    throw error;
  }
}

/**
 * Get Alignment Job status for Artist Polling
 * @param {string} songId 
 * @param {string} userId 
 * @param {string} userRole 
 * @returns {Promise<object>}
 */
async function getAlignmentJobStatus(songId, userId, userRole) {
  const { song } = await resolveSongAndOwnership(songId, userId, userRole);

  const job = await LyricsAlignmentJob.findOne({ songId: song._id })
    .sort({ createdAt: -1 })
    .lean();

  if (!job) {
    return {
      hasJob: false,
      songId: song._id,
      status: "none",
    };
  }

  return {
    hasJob: true,
    jobId: job._id,
    songId: job.songId,
    status: job.status,
    stage: job.stage || (job.status === "succeeded" ? "COMPLETED" : (job.status === "processing" ? "ALIGNING" : "PENDING")),
    progressPercent: typeof job.progressPercent === "number" ? job.progressPercent : (job.status === "succeeded" ? 100 : (job.status === "processing" ? 50 : 0)),
    progressMessage: job.progressMessage || (job.status === "succeeded" ? "Hoàn tất tạo nhịp AI" : (job.status === "processing" ? "Đang xử lý căn nhịp âm học..." : "Đang chờ xử lý...")),
    qualityStatus: job.result?.qualityStatus || null,
    qualityNotes: job.result?.qualityNotes || [],
    errorCode: job.errorCode,
    errorMessage: job.errorMessage,
    attemptCount: job.attemptCount,
    createdAt: job.createdAt,
    processingStartedAt: job.processingStartedAt,
    completedAt: job.completedAt,
    failedAt: job.failedAt,
    result: job.status === "succeeded" ? job.result : null,
  };
}

/**
 * Public Client API: Get published lyrics for client audio player
 * @param {string} songId 
 * @returns {Promise<object>}
 */
async function getPublishedLyricsForClient(songId) {
  if (!mongoose.Types.ObjectId.isValid(songId)) {
    const err = new Error("ID bài hát không hợp lệ");
    err.status = 400;
    throw err;
  }

  const song = await Song.findById(songId)
    .select("_id title artists lyrics duration")
    .populate("artists", "name avatar");

  if (!song) {
    const err = new Error("Không tìm thấy bài hát");
    err.status = 404;
    throw err;
  }

  const songLyrics = await SongLyrics.findOne({ songId, status: "published" });

  if (songLyrics && songLyrics.publishedLyricsType) {
    const isSynced =
      songLyrics.publishedLyricsType === "synced" &&
      Array.isArray(songLyrics.publishedSyncedLines) &&
      songLyrics.publishedSyncedLines.length > 0;

    return {
      songId: song._id,
      title: song.title,
      artists: song.artists,
      duration: song.duration,
      lyrics: songLyrics.publishedPlainLyrics || song.lyrics || "",
      isSynced,
      syncSource: songLyrics.syncSource || "manual",
      syncedLines: isSynced ? songLyrics.publishedSyncedLines : [],
      status: "published",
    };
  }

  // Fallback to legacy Song.lyrics if exists
  const legacyLyrics = song.lyrics || "";
  const parsed = parseLrc(legacyLyrics, song.duration);

  return {
    songId: song._id,
    title: song.title,
    artists: song.artists,
    duration: song.duration,
    lyrics: parsed.plainText || legacyLyrics,
    isSynced: parsed.isSynced,
    syncSource: "manual",
    syncedLines: parsed.isSynced ? parsed.syncedLines : [],
    status: legacyLyrics ? "published" : "not_added",
  };
}

module.exports = {
  getSongLyricsForArtist,
  saveDraftLyrics,
  publishLyrics,
  unpublishLyrics,
  getPublishedLyricsForClient,
  triggerAlignmentJob,
  getAlignmentJobStatus,
};
