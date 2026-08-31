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

  let publishedPlain = "";
  let publishedLrc = "";
  let publishedSynced = [];
  let warnings = [];

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
    publishedSynced = parsed.syncedLines;
    publishedPlain = cleanPlain || parsed.plainText || "";
    warnings = parsed.warnings;
  }

  // Update or create SongLyrics
  let songLyrics = await SongLyrics.findOne({ songId });
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

/**
 * Public Client API: Get published lyrics for client audio player
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
};
