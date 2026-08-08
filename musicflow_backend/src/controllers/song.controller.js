/**
 * song.controller.js — Thin HTTP handler layer for song routes.
 *
 * Each handler:
 *   1. Parses / validates request parameters.
 *   2. Delegates to the appropriate service.
 *   3. Formats and returns the HTTP response.
 *
 * No business logic, no Mongoose queries, no Cloudinary SDK calls here.
 */

const songService = require("../services/song.service");
const searchService = require("../services/search.service");
const recommendService = require("../services/recommendation.service");
const songRepo = require("../repositories/song.repository");
const { parsePagination, setPaginationHeaders } = require("../utils/pagination.util");
const { isObjectIdLike } = require("../utils/string.util");

// ---------------------------------------------------------------------------
// Shared error responder
// ---------------------------------------------------------------------------

/**
 * Map a service-layer error (with optional `.status`) to the HTTP response.
 * Falls back to 500 when no status is set.
 */
const handleError = (res, error, fallbackMessage = "Internal server error") => {
  console.error(error);
  const status = error.status || 500;
  return res.status(status).json({
    success: false,
    message: error.message || fallbackMessage,
  });
};

// ---------------------------------------------------------------------------
// ⬇️ DOWNLOAD SONG (AUTH REQUIRED)
// ---------------------------------------------------------------------------

exports.downloadSong = async (req, res) => {
  try {
    const result = await songService.downloadSong(req.params.songId, req.userId || null);
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return handleError(res, error, "Không thể xử lý yêu cầu tải bài hát");
  }
};

// ---------------------------------------------------------------------------
// 📋 GET SONGS BY ARTIST NAME (PUBLIC)
// ---------------------------------------------------------------------------

exports.getSongsByArtist = async (req, res) => {
  try {
    const { page, limit } = parsePagination(req.query);
    const { artistId, name: artistName, search } = req.query;

    const result = await searchService.searchSongsByArtist({
      artistId,
      artistName,
      search: String(search || "").trim(),
      page,
      limit,
    });

    res.json({
      success: true,
      songs: result.songs,
      count: result.total,
      total: result.total,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit),
      },
    });
  } catch (error) {
    handleError(res, error, "Get songs by artist failed");
  }
};

// ---------------------------------------------------------------------------
// 📈 GET FLOWCHART DATA (REAL HOURLY STREAM COUNTS)
// ---------------------------------------------------------------------------

exports.getFlowchart = async (req, res) => {
  try {
    const data = await songService.getFlowchart({
      hours: req.query.hours,
      limit: req.query.limit,
      mode: req.query.mode,
    });
    res.json(data);
  } catch (error) {
    handleError(res, error, "Get flowchart data failed");
  }
};

// ---------------------------------------------------------------------------
// 🏆 GET RANKINGS
// ---------------------------------------------------------------------------

exports.getRankings = async (req, res) => {
  try {
    const data = await songService.getRankings({ period: req.query.period });
    return res.json({ success: true, ...data });
  } catch (error) {
    return handleError(res, error, "Get rankings failed");
  }
};

// ---------------------------------------------------------------------------
// 🎤 GET LYRICS BY SONG ID
// ---------------------------------------------------------------------------

exports.getSongLyrics = async (req, res) => {
  try {
    const data = await songService.getLyrics(req.params.id);
    return res.status(200).json({ success: true, ...data });
  } catch (error) {
    return handleError(res, error, "Không thể tải lyrics");
  }
};

// ---------------------------------------------------------------------------
// ▶️ REGISTER PLAY (after client reaches listen threshold)
// ---------------------------------------------------------------------------

exports.registerPlay = async (req, res) => {
  try {
    const result = await songService.registerPlay(req.params.id, req);
    return res.json({ success: true, ...result });
  } catch (error) {
    return handleError(res, error, "Track play failed");
  }
};

// ---------------------------------------------------------------------------
// 🎫 ISSUE PLAYBACK TICKET
// ---------------------------------------------------------------------------
exports.issuePlaybackTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const { quality = "std" } = req.query;
    
    // Đọc token xác thực tùy chọn từ headers
    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }

    const result = await songService.issuePlaybackTicket(id, quality, token);
    return res.status(200).json({
      success: true,
      ticket: result.ticket
    });
  } catch (error) {
    if (error.code === "PREMIUM_REQUIRED") {
      return res.status(403).json({
        success: false,
        code: "PREMIUM_REQUIRED",
        message: error.message
      });
    }
    if (error.code === "HQ_NOT_AVAILABLE") {
      return res.status(400).json({
        success: false,
        code: "HQ_NOT_AVAILABLE",
        message: error.message
      });
    }
    return handleError(res, error, "Không thể cấp vé nghe nhạc");
  }
};

// ---------------------------------------------------------------------------
// 📻 STREAM SONG (redirect to Cloudinary URL using verified playback ticket)
// ---------------------------------------------------------------------------

exports.streamSong = async (req, res) => {
  try {
    const { id } = req.params;
    const { ticket } = req.query;

    const streamUrl = await songService.resolveStreamUrlByTicket(id, ticket);
    return res.redirect(302, streamUrl);
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Truyền phát nhạc thất bại"
    });
  }
};

// ---------------------------------------------------------------------------
// 📌 GET ALL SONGS (PUBLIC ONLY)
// ---------------------------------------------------------------------------

exports.getAllSongs = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    res.set("Cache-Control", "public, max-age=30");

    const [songs, total] = await Promise.all([
      songRepo.findPublicWithPopulate({}, { skip, limit }),
      songRepo.countPublic(),
    ]);

    setPaginationHeaders(res, { page, limit, total });
    res.json(songs);
  } catch (error) {
    handleError(res, error, "Get songs failed");
  }
};

// ---------------------------------------------------------------------------
// 🎲 GET RECOMMENDED SONGS (Random - PUBLIC ONLY)
// ---------------------------------------------------------------------------

exports.getRecommendedSongs = async (req, res) => {
  try {
    const refresh = String(req.query.refresh || "").toLowerCase() === "true";
    res.set("Cache-Control", refresh ? "no-store" : "public, max-age=30");

    const songs = await recommendService.getRecommendedSongs(req.query.limit);
    res.json(songs);
  } catch (error) {
    handleError(res, error, "Get recommended songs failed");
  }
};

// ---------------------------------------------------------------------------
// 🔍 SEARCH SONGS (PUBLIC ONLY)
// ---------------------------------------------------------------------------

exports.searchSongs = async (req, res) => {
  try {
    const includeArtists =
      String(req.query.includeArtists || "").toLowerCase() === "true";

    const result = await searchService.searchSongs({
      query: req.query.query,
      artistId: req.query.artistId,
      topicId: req.query.topicId,
      letter: req.query.letter,
      includeArtists,
    });

    if (includeArtists) {
      return res.json(result);
    }
    res.json(result.songs);
  } catch (error) {
    handleError(res, error, "Search failed");
  }
};

// ---------------------------------------------------------------------------
// 📁 GET MY UPLOADS (User's uploaded songs - AUTH REQUIRED)
// ---------------------------------------------------------------------------

exports.getMyUploads = async (req, res) => {
  try {
    const Song = require("../models/song.model");
    const songs = await Song.find({ uploadedBy: req.userId })
      .populate("artists")
      .sort({ createdAt: -1 });

    const sanitizedSongs = songs.map((doc) => {
      const song = doc.toObject();
      if (song.source === "user") song.artists = [];
      return song;
    });

    res.json({ success: true, songs: sanitizedSongs, count: sanitizedSongs.length });
  } catch (error) {
    handleError(res, error, "Lấy danh sách thất bại");
  }
};

// ---------------------------------------------------------------------------
// ⬇️ GET MY DOWNLOAD HISTORY (AUTH REQUIRED)
// ---------------------------------------------------------------------------

exports.getDownloadHistory = async (req, res) => {
  try {
    const songs = await songService.getDownloadHistory(req.userId, req.query.limit);
    return res.json({ success: true, songs, count: songs.length });
  } catch (error) {
    return handleError(res, error, "Lấy lịch sử tải bài hát thất bại");
  }
};

// ---------------------------------------------------------------------------
// 🗑️ REMOVE DOWNLOAD HISTORY
// ---------------------------------------------------------------------------

exports.removeFromDownloadHistory = async (req, res) => {
  try {
    const deletedCount = await songService.removeFromDownloadHistory(
      req.userId,
      req.params.songId
    );
    return res.json({ success: true, deletedCount, message: "Đã xoá bài hát khỏi danh sách đã tải" });
  } catch (error) {
    return handleError(res, error, "Xoá bài hát đã tải thất bại");
  }
};

// ---------------------------------------------------------------------------
// 🔄 SYNC MY DOWNLOAD HISTORY FROM CLIENT (AUTH REQUIRED)
// ---------------------------------------------------------------------------

exports.syncDownloadHistory = async (req, res) => {
  try {
    const result = await songService.syncDownloadHistory(
      req.userId,
      req.body?.songIds
    );
    return res.json({ success: true, ...result, message: "Đồng bộ lịch sử tải bài hát thành công" });
  } catch (error) {
    return handleError(res, error, "Đồng bộ lịch sử tải bài hát thất bại");
  }
};

// ---------------------------------------------------------------------------
// 🎵 UPLOAD SONG (AUTH REQUIRED)
// ---------------------------------------------------------------------------

exports.uploadSong = async (req, res) => {
  try {
    const userRole = await songService.resolveAuthenticatedRole(req);
    const song = await songService.uploadSong(req.body, req.files, req.userId, userRole);
    return res.status(201).json({ success: true, message: "Upload thành công", song });
  } catch (error) {
    return handleError(res, error, "Upload thất bại");
  }
};

// ---------------------------------------------------------------------------
// ✏️ UPDATE SONG (AUTH REQUIRED - OWNER OR ARTIST)
// ---------------------------------------------------------------------------

exports.updateSong = async (req, res) => {
  try {
    const userRole = await songService.resolveAuthenticatedRole(req);
    const song = await songService.updateSong(
      req.params.id,
      req.body,
      req.files,
      req.userId,
      userRole
    );
    return res.json({ success: true, message: "Cập nhật thành công", song });
  } catch (error) {
    return handleError(res, error, "Cập nhật thất bại");
  }
};

// ---------------------------------------------------------------------------
// 🔄 TOGGLE PUBLIC/PRIVATE (AUTH REQUIRED - OWNER OR ARTIST)
// ---------------------------------------------------------------------------

exports.togglePublic = async (req, res) => {
  try {
    const result = await songService.togglePublic(req.params.id, req.userId);
    return res.json({ success: true, ...result });
  } catch (error) {
    return handleError(res, error, "Thay đổi thất bại");
  }
};

// ---------------------------------------------------------------------------
// 🗑️ DELETE SONG (AUTH REQUIRED - OWNER OR ARTIST)
// ---------------------------------------------------------------------------

exports.deleteSong = async (req, res) => {
  try {
    await songService.deleteSong(req.params.id, req.userId);
    return res.json({ success: true, message: "Đã xoá bài hát" });
  } catch (error) {
    return handleError(res, error, "Xoá thất bại");
  }
};

// ---------------------------------------------------------------------------
// 📻 GET SIMILAR SONGS / SONG RADIO
// ---------------------------------------------------------------------------

exports.getSimilarSongs = async (req, res) => {
  try {
    const data = await recommendService.getSimilarSongs(
      req.params.id,
      req.query.limit
    );
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể lấy danh sách bài hát tương tự");
  }
};
