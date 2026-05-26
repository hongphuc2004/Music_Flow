const express = require("express");
const router = express.Router();
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");
const cloudinary = require("../config/cloudinary");
const { cloudinaryFolder, defaultSongImageUrl } = require("../config/cloudinaryFolders");
const Song = require("../models/song.model");
const SongPlayEvent = require("../models/song-play-event.model");
const SongDownloadEvent = require("../models/song-download-event.model");
const Artist = require("../models/artist.model");
const User = require("../models/user.model");
const authMiddleware = require("../middleware/auth.middleware");
const { downloadSong } = require("../controllers/song.controller");

const ONE_HOUR_MS = 60 * 60 * 1000;
const TRACK_PLAY_COOLDOWN_MS = 30 * 1000;
const recentPlayTrackByKey = new Map();
const SONG_PUBLIC_SELECT =
  "title artists topicIds uploadedBy isPublic audioUrl duration imageUrl lyrics source allowDownload playCount likeCount commentCount shareCount createdAt updatedAt";

const truncateToHour = (date) => {
  const d = new Date(date);
  d.setMinutes(0, 0, 0);
  return d;
};

const buildHourlySlots = (hours) => {
  const nowHour = truncateToHour(new Date());
  return Array.from({ length: hours }, (_, index) => {
    const offset = hours - 1 - index;
    return new Date(nowHour.getTime() - offset * ONE_HOUR_MS);
  });
};

const shouldTrackPlayRequest = (songId, ipAddress) => {
  const key = `${songId}:${ipAddress || "unknown"}`;
  const now = Date.now();
  const lastTrackedAt = recentPlayTrackByKey.get(key) || 0;

  if (now - lastTrackedAt < TRACK_PLAY_COOLDOWN_MS) {
    return false;
  }

  recentPlayTrackByKey.set(key, now);
  return true;
};

// 📋 GET SONGS BY ARTIST NAME (PUBLIC + ADMIN UPLOAD)
// Tìm bài hát theo artistId (ObjectId)
router.get("/by-artist", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = String(req.query.search || "").trim();
    const skip = (page - 1) * limit;
    const { artistId, name } = req.query;

    let resolvedArtistId = artistId;
    if (!resolvedArtistId && name) {
      const artist = await Artist.findOne({
        name: { $regex: new RegExp(`^${String(name).trim()}$`, "i") },
      }).select("_id");
      resolvedArtistId = artist?._id?.toString();
    }

    if (!resolvedArtistId) {
      return res.status(400).json({ message: "Missing artistId or artist name" });
    }

    const query = {
      artists: resolvedArtistId,
      ...(search
        ? {
            title: { $regex: search, $options: "i" },
          }
        : {}),
    };

    const [songs, total] = await Promise.all([
      Song.find(query)
        .populate("artists", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Song.countDocuments(query),
    ]);

    const serializedSongs = songs.map((song) => {
      const plainSong = song.toObject();
      return {
        ...plainSong,
        artist: Array.isArray(plainSong.artists)
          ? plainSong.artists.map((artist) => artist.name).filter(Boolean).join(", ")
          : "",
      };
    });

    res.json({
      success: true,
      songs: serializedSongs,
      count: total,
      total,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Get songs by artist failed",
      error: error.message,
    });
  }
});

// ================= MULTER CONFIG =================
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

const safeUnlink = (filePath) => {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
  }
};

const parseArrayField = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed.filter(Boolean) : [trimmed];
    } catch (error) {
      return [trimmed];
    }
  }
  return [];
};
const escapeRegex = (value) => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const isObjectIdLike = (value) => /^[a-fA-F0-9]{24}$/.test(String(value || "").trim());

const resolveArtistIds = async (rawArtists) => {
  const tokens = parseArrayField(rawArtists)
    .flatMap((item) => String(item || "").split(","))
    .map((item) => item.trim())
    .filter(Boolean);

  if (tokens.length === 0) return [];

  const idTokens = [...new Set(tokens.filter(isObjectIdLike))];
  const textTokens = [...new Set(tokens.filter((item) => !isObjectIdLike(item)))];

  const [byIds, byText] = await Promise.all([
    idTokens.length
      ? Artist.find({ _id: { $in: idTokens } }).select("_id").lean()
      : Promise.resolve([]),
    textTokens.length
      ? Artist.find({
          $or: textTokens.map((token) => ({
            $or: [
              { name: { $regex: new RegExp(`^${escapeRegex(token)}$`, "i") } },
              { email: { $regex: new RegExp(`^${escapeRegex(token)}$`, "i") } },
            ],
          })),
        })
          .select("_id")
          .lean()
      : Promise.resolve([]),
  ]);

  return [...new Set([...byIds, ...byText].map((artist) => String(artist._id)))];
};

const isHttpUrl = (value) => /^https?:\/\//i.test(String(value || "").trim());
const normalizeSearchText = (value) => String(value || "").trim().replace(/\s+/g, " ");
const escapeRegexChar = (char) => char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const VIET_CHAR_GROUPS = {
  a: "aáàảãạăắằẳẵặâấầẩẫậ",
  A: "AÁÀẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬ",
  e: "eéèẻẽẹêếềểễệ",
  E: "EÉÈẺẼẸÊẾỀỂỄỆ",
  i: "iíìỉĩị",
  I: "IÍÌỈĨỊ",
  o: "oóòỏõọôốồổỗộơớờởỡợ",
  O: "OÓÒỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢ",
  u: "uúùủũụưứừửữự",
  U: "UÚÙỦŨỤƯỨỪỬỮỰ",
  y: "yýỳỷỹỵ",
  Y: "YÝỲỶỸỴ",
  d: "dđ",
  D: "DĐ",
};
const toAccentInsensitivePattern = (text) =>
  String(text || "")
    .split("")
    .map((char) => {
      if (char === " ") return "\\s+";
      const grouped = VIET_CHAR_GROUPS[char];
      if (grouped) {
        return `[${grouped}]`;
      }
      return escapeRegexChar(char);
    })
    .join("");
const buildSearchRegexes = (rawQuery) => {
  const normalized = normalizeSearchText(rawQuery);
  if (!normalized) return [];

  const phraseRegex = new RegExp(toAccentInsensitivePattern(normalized), "i");

  const tokens = normalized
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean)
    .map(toAccentInsensitivePattern);

  if (tokens.length <= 1) {
    return [phraseRegex];
  }

  const allTokensRegex = new RegExp(`^(?=.*${tokens.join(")(?=.*")}).*$`, "i");
  return [phraseRegex, allTokensRegex];
};
const decodeUploadFileName = (fileName) => {
  const raw = String(fileName || "").trim();
  if (!raw) return "";
  try {
    return Buffer.from(raw, "latin1").toString("utf8").trim();
  } catch (error) {
    return raw;
  }
};
const toSafeSongTitleFromFileName = (originalName) => {
  const decodedName = decodeUploadFileName(originalName);
  const baseName = path
    .basename(String(decodedName || ""), path.extname(String(decodedName || "")))
    .trim();
  if (!baseName) return "Untitled";
  return baseName.replace(/\s+/g, " ").slice(0, 255);
};

const resolveAuthenticatedRole = async (req) => {
  const tokenRole = String(req.userRole || "").trim().toLowerCase();
  if (tokenRole === "admin" || tokenRole === "user" || tokenRole === "artist") {
    return tokenRole;
  }

  const user = await User.findById(req.userId).select("role").lean();
  if (user?.role) return String(user.role).trim().toLowerCase();

  const artist = await Artist.findById(req.userId).select("role").lean();
  if (artist?.role) return String(artist.role).trim().toLowerCase();

  return "user";
};

// =================================================
// 📈 GET FLOWCHART DATA (REAL HOURLY STREAM COUNTS)
router.get("/flowchart", async (req, res) => {
  try {
    const requestedHours = parseInt(req.query.hours, 10);
    const requestedLimit = parseInt(req.query.limit, 10);
    const requestedMode = String(req.query.mode || "flow").trim().toLowerCase();
    const rankingMode = requestedMode === "rising" ? "rising" : "flow";

    const hours = Number.isFinite(requestedHours)
      ? Math.min(Math.max(requestedHours, 6), 48)
      : 12;
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 10), 50)
      : 50;

    const publicSongs = await Song.find({ isPublic: true })
      .select("_id playCount likeCount")
      .lean();

    const songIds = publicSongs.map((song) => song._id.toString());
    const now = new Date();
    const day24Ms = 24 * ONE_HOUR_MS;
    const startLast24h = new Date(now.getTime() - day24Ms);
    const startPrev24h = new Date(now.getTime() - 2 * day24Ms);

    const defaultMetricsBySongId = new Map(
      publicSongs.map((song) => [song._id.toString(), {
        last24h: 0,
        previous24h: 0,
        risingScore: 0,
      }])
    );

    if (songIds.length > 0) {
      const recentEvents = await SongPlayEvent.find({
        songId: { $in: songIds },
        playedAt: { $gte: startPrev24h },
      })
        .select("songId playedAt -_id")
        .lean();

      for (const event of recentEvents) {
        const songId = event.songId?.toString();
        if (!songId || !defaultMetricsBySongId.has(songId)) {
          continue;
        }

        const metric = defaultMetricsBySongId.get(songId);
        const playedAt = new Date(event.playedAt);
        if (playedAt >= startLast24h) {
          metric.last24h += 1;
        } else {
          metric.previous24h += 1;
        }
      }

      for (const metric of defaultMetricsBySongId.values()) {
        metric.risingScore = metric.last24h - metric.previous24h;
      }
    }

    const rankedSongIds = [...publicSongs]
      .sort((a, b) => {
        const songAId = a._id.toString();
        const songBId = b._id.toString();
        const metricA = defaultMetricsBySongId.get(songAId) || {
          last24h: 0,
          previous24h: 0,
          risingScore: 0,
        };
        const metricB = defaultMetricsBySongId.get(songBId) || {
          last24h: 0,
          previous24h: 0,
          risingScore: 0,
        };

        if (rankingMode === "rising") {
          if (metricB.risingScore !== metricA.risingScore) {
            return metricB.risingScore - metricA.risingScore;
          }
          if (metricB.last24h !== metricA.last24h) {
            return metricB.last24h - metricA.last24h;
          }
        }

        if (b.playCount !== a.playCount) {
          return b.playCount - a.playCount;
        }
        return (b.likeCount || 0) - (a.likeCount || 0);
      })
      .slice(0, limit)
      .map((song) => song._id.toString());

    const rankedSongs = await Song.find({ _id: { $in: rankedSongIds } })
      .populate("artists")
      .populate("topicIds");

    const songById = new Map(rankedSongs.map((song) => [song._id.toString(), song]));
    const topSongs = rankedSongIds
      .map((songId) => songById.get(songId))
      .filter(Boolean);

    if (topSongs.length === 0) {
      return res.json({
        rankingMode,
        hours,
        limit,
        timeSlots: [],
        timeSlotTimestamps: [],
        topSongs: [],
        chartSeries: [],
        songMetrics: [],
        generatedAt: new Date().toISOString(),
      });
    }

    const slots = buildHourlySlots(hours);
    const startTime = slots[0];
    const songIdSet = topSongs.map((song) => song._id.toString());

    const events = await SongPlayEvent.find({
      songId: { $in: songIdSet },
      playedAt: { $gte: startTime },
    })
      .select("songId playedAt -_id")
      .lean();

    const seriesBySongId = new Map(
      songIdSet.map((songId) => [songId, Array(hours).fill(0)])
    );

    for (const event of events) {
      const songId = event.songId?.toString();
      if (!songId || !seriesBySongId.has(songId)) {
        continue;
      }

      const eventHour = truncateToHour(event.playedAt).getTime();
      const index = Math.floor((eventHour - startTime.getTime()) / ONE_HOUR_MS);
      if (index < 0 || index >= hours) {
        continue;
      }

      const points = seriesBySongId.get(songId);
      points[index] += 1;
    }

    const chartSeries = topSongs.map((song) => {
      const songId = song._id.toString();
      return {
        songId,
        points: seriesBySongId.get(songId) || Array(hours).fill(0),
      };
    });

    const songMetrics = topSongs.map((song) => {
      const songId = song._id.toString();
      const metric = defaultMetricsBySongId.get(songId) || {
        last24h: 0,
        previous24h: 0,
        risingScore: 0,
      };
      return {
        songId,
        last24h: metric.last24h,
        previous24h: metric.previous24h,
        risingScore: metric.risingScore,
      };
    });

    res.json({
      rankingMode,
      hours,
      limit,
      timeSlots: slots.map((slot) => slot.getHours().toString().padStart(2, "0")),
      timeSlotTimestamps: slots.map((slot) => slot.toISOString()),
      topSongs,
      chartSeries,
      songMetrics,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Get flowchart data error:", error);
    res.status(500).json({
      message: "Get flowchart data failed",
      error: error.message,
    });
  }
});

// =================================================
// 🎤 GET LYRICS BY SONG ID
router.get("/:id/lyrics", async (req, res) => {
  try {
    const { id } = req.params;

    const song = await Song.findById(id).select("_id title artists lyrics").populate("artists", "name");
    if (!song) {
      return res.status(404).json({
        success: false,
        message: "Khong tim thay bai hat",
      });
    }

    return res.status(200).json({
      success: true,
      songId: song._id,
      title: song.title,
      artists: song.artists,
      lyrics: song.lyrics || "",
    });
  } catch (error) {
    console.error("Get lyrics error:", error);
    return res.status(500).json({
      success: false,
      message: "Khong the tai lyrics",
      error: error.message,
    });
  }
});

// =================================================
// 🎵 AUDIO STREAMING - HTTP Range Requests (HTTP 206)
// Hỗ trợ seek/tua nhanh mà không cần tải lại từ đầu
router.get("/:id/stream", async (req, res) => {
  try {
    const { id } = req.params;
    
    const song = await Song.findById(id);
    if (!song) {
      return res.status(404).json({ message: "Song not found" });
    }

    const ipAddress = req.ip || req.headers["x-forwarded-for"] || "unknown";
    const shouldTrackPlay = shouldTrackPlayRequest(id, ipAddress);
    if (shouldTrackPlay) {
      Song.updateOne({ _id: id }, { $inc: { playCount: 1 } }).catch((err) => {
        console.error("Increase playCount failed:", err.message);
      });

      SongPlayEvent.create({ songId: id, playedAt: new Date() }).catch((err) => {
        console.error("Create song play event failed:", err.message);
      });
    }

    const audioUrl = song.audioUrl;
    
    // Parse URL để xác định protocol
    const urlObj = new URL(audioUrl);
    const protocol = urlObj.protocol === "https:" ? https : http;
    
    // Forward Range header nếu có
    const range = req.headers.range;
    const headers = {
      "User-Agent": "MusicFlow-Streaming/1.0",
    };
    
    if (range) {
      headers["Range"] = range;
    }

    // Proxy request đến Cloudinary
    const proxyReq = protocol.get(audioUrl, { headers }, (proxyRes) => {
      const contentType = proxyRes.headers["content-type"] || "audio/mpeg";
      const contentLength = proxyRes.headers["content-length"];
      const contentRange = proxyRes.headers["content-range"];
      const acceptRanges = proxyRes.headers["accept-ranges"] || "bytes";
      
      // Set response headers cho streaming
      const responseHeaders = {
        "Content-Type": contentType,
        "Accept-Ranges": acceptRanges,
        "Cache-Control": "public, max-age=86400", // Cache 1 ngày
        "X-Content-Duration": song.duration || 0,
      };
      
      if (contentLength) {
        responseHeaders["Content-Length"] = contentLength;
      }
      
      if (contentRange) {
        responseHeaders["Content-Range"] = contentRange;
      }
      
      // HTTP 206 Partial Content nếu có Range request
      const statusCode = range && proxyRes.statusCode === 206 ? 206 : 200;
      
      res.writeHead(statusCode, responseHeaders);
      
      // Pipe stream từ Cloudinary đến client
      proxyRes.pipe(res);
    });
    
    proxyReq.on("error", (err) => {
      console.error("Stream proxy error:", err);
      if (!res.headersSent) {
        res.status(500).json({ message: "Streaming failed" });
      }
    });
    
    // Cleanup khi client disconnect
    req.on("close", () => {
      proxyReq.destroy();
    });
    
  } catch (error) {
    console.error("Stream error:", error);
    if (!res.headersSent) {
      res.status(500).json({ message: "Streaming failed", error: error.message });
    }
  }
});

// =================================================
// ⬇️ DOWNLOAD SONG (AUTH REQUIRED)
router.post("/:songId/download", authMiddleware, downloadSong);

// =================================================
// 📌 GET ALL SONGS (PUBLIC ONLY)
router.get("/", async (req, res) => {
  try {
    res.set("Cache-Control", "public, max-age=30");
    // Public thực sự cho cả admin và user upload
    const songs = await Song.find({ isPublic: true })
      .select(SONG_PUBLIC_SELECT)
      .sort({ createdAt: -1 })
      .populate("artists", "name avatar")
      .populate("topicIds", "name avatar")
      .lean();

    res.json(songs);
  } catch (error) {
    console.error("Get songs error:", error);
    res.status(500).json({ message: "Get songs failed", error: error.message });
  }
});

// =================================================
// 🎲 GET RECOMMENDED SONGS (Random - PUBLIC ONLY)
router.get("/recommended", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 12;
    res.set("Cache-Control", "public, max-age=30");
    
    // Public thực sự cho cả admin và user upload
    const songs = await Song.aggregate([
      { $match: { isPublic: true } },
      { $sample: { size: limit } },
      {
        $project: {
          title: 1,
          artists: 1,
          topicIds: 1,
          uploadedBy: 1,
          isPublic: 1,
          audioUrl: 1,
          duration: 1,
          imageUrl: 1,
          lyrics: 1,
          source: 1,
          allowDownload: 1,
          playCount: 1,
          likeCount: 1,
          commentCount: 1,
          shareCount: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      },
      {
        $lookup: {
          from: "artists",
          localField: "artists",
          foreignField: "_id",
          as: "artists",
          pipeline: [{ $project: { name: 1, avatar: 1 } }],
        }
      },
      {
        $lookup: {
          from: "topics",
          localField: "topicIds",
          foreignField: "_id",
          as: "topicIds",
          pipeline: [{ $project: { name: 1, avatar: 1 } }],
        }
      }
    ]);
    
    res.json(songs);
  } catch (error) {
    console.error("Get recommended songs error:", error);
    res.status(500).json({ message: "Get recommended songs failed", error: error.message });
  }
});

// =================================================
// 🔍 SEARCH SONGS (PUBLIC ONLY)
router.get("/search", async (req, res) => {
  try {
    const { query, artistId, topicId, letter } = req.query;
    const includeArtists = String(req.query.includeArtists || "").toLowerCase() === "true";

    const conditions = [{ isPublic: true }];
    let matchedArtists = [];

    if (query) {
      const regexes = buildSearchRegexes(query);
      if (regexes.length > 0) {
        matchedArtists = await Artist.find({
          $or: regexes.map((regex) => ({ name: regex })),
        })
          .select("_id name avatar")
          .sort({ name: 1 })
          .limit(12)
          .lean();
      }

      if (regexes.length > 0) {
        const titleConditions = regexes.map((regex) => ({ title: regex }));
        const queryOrConditions = [...titleConditions];

        if (matchedArtists.length > 0) {
          queryOrConditions.push({
            artists: { $in: matchedArtists.map((artist) => artist._id) },
          });
        }

        conditions.push({
          $or: queryOrConditions,
        });
      }
    }

    if (artistId) {
      conditions.push({ artists: artistId });
    }

    if (topicId) {
      conditions.push({ topicIds: topicId });
    }

    if (letter) {
      conditions.push({ title: new RegExp(`^${letter}`, "i") });
    }

    const filter = conditions.length === 1 ? conditions[0] : { $and: conditions };

    const songs = await Song.find(filter)
      .select(SONG_PUBLIC_SELECT)
      .sort({ createdAt: -1 })
      .populate("artists", "name avatar")
      .populate("topicIds", "name avatar")
      .lean();
    if (includeArtists) {
      return res.json({
        songs,
        artists: matchedArtists,
      });
    }

    res.json(songs);
  } catch (error) {
    console.error("Search songs error:", error);
    res.status(500).json({ message: "Search failed", error: error.message });
  }
});

// =================================================
// 📁 GET MY UPLOADS (User's uploaded songs - AUTH REQUIRED)
router.get("/my-uploads", authMiddleware, async (req, res) => {
  try {
    const songs = await Song.find({ uploadedBy: req.userId })
      .populate("artists")
      .sort({ createdAt: -1 });

    const sanitizedSongs = songs.map((songDoc) => {
      const song = songDoc.toObject();
      if (song.source === "user") {
        song.artists = [];
      }
      return song;
    });
    
    res.json({
      success: true,
      songs: sanitizedSongs,
      count: sanitizedSongs.length
    });
  } catch (error) {
    console.error("Get my uploads error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Lấy danh sách thất bại" 
    });
  }
});

// =================================================
// ⬇️ GET MY DOWNLOAD HISTORY (AUTH REQUIRED)
router.get("/download-history", authMiddleware, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);

    const events = await SongDownloadEvent.find({ userId: req.userId })
      .sort({ downloadedAt: -1 })
      .populate({
        path: "songId",
        match: { isPublic: true },
        populate: { path: "artists" },
      })
      .limit(400)
      .lean();

    const uniqueSongs = [];
    const seenSongIds = new Set();

    for (const event of events) {
      const song = event.songId;
      if (!song?._id) continue;
      const songId = String(song._id);
      if (seenSongIds.has(songId)) continue;
      seenSongIds.add(songId);
      uniqueSongs.push({
        ...song,
        downloadedAt: event.downloadedAt,
      });
      if (uniqueSongs.length >= limit) break;
    }

    return res.json({
      success: true,
      songs: uniqueSongs,
      count: uniqueSongs.length,
    });
  } catch (error) {
    console.error("Get download history error:", error);
    return res.status(500).json({
      success: false,
      message: "Lay lich su tai bai hat that bai",
      error: error.message,
    });
  }
});

// =================================================
// 🔄 SYNC MY DOWNLOAD HISTORY FROM CLIENT (AUTH REQUIRED)
router.post("/download-history/sync", authMiddleware, async (req, res) => {
  try {
    const songIds = Array.isArray(req.body?.songIds) ? req.body.songIds : [];
    const normalizedSongIds = [...new Set(
      songIds
        .map((id) => String(id || "").trim())
        .filter((id) => isObjectIdLike(id))
    )];

    if (normalizedSongIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Danh sach songIds khong hop le",
      });
    }

    const existingEvents = await SongDownloadEvent.find({
      userId: req.userId,
      songId: { $in: normalizedSongIds },
    }).select("songId").lean();

    const existingSongIdSet = new Set(existingEvents.map((event) => String(event.songId)));
    const missingSongIds = normalizedSongIds.filter((id) => !existingSongIdSet.has(id));

    if (missingSongIds.length > 0) {
      const existingSongs = await Song.find({ _id: { $in: missingSongIds } }).select("_id").lean();
      const existingSongIds = new Set(existingSongs.map((song) => String(song._id)));
      const docs = missingSongIds
        .filter((id) => existingSongIds.has(id))
        .map((songId) => ({
          userId: req.userId,
          songId,
          downloadedAt: new Date(),
        }));

      if (docs.length > 0) {
        await SongDownloadEvent.insertMany(docs, { ordered: false });
      }
    }

    return res.json({
      success: true,
      synced: missingSongIds.length,
      totalReceived: normalizedSongIds.length,
      message: "Dong bo lich su tai bai hat thanh cong",
    });
  } catch (error) {
    console.error("Sync download history error:", error);
    return res.status(500).json({
      success: false,
      message: "Dong bo lich su tai bai hat that bai",
      error: error.message,
    });
  }
});

// =================================================
// 🎵 UPLOAD SONG (AUTH REQUIRED)
router.post(
  "/",
  authMiddleware,
  upload.fields([
    { name: "audio", maxCount: 1 },
    { name: "image", maxCount: 1 },
  ]),
  async (req, res) => {
    const audioFile = req.files?.audio?.[0] || null;
    const imageFile = req.files?.image?.[0] || null;
    try {
      const { title, lyrics, isPublic } = req.body;
      const accountRole = await resolveAuthenticatedRole(req);
      const artists = accountRole === "user"
        ? []
        : await resolveArtistIds(req.body.artists);
      const topicIds = parseArrayField(req.body.topicIds);
      const imageUrlInput = typeof req.body.imageUrl === "string" ? req.body.imageUrl.trim() : "";

      if (!audioFile) {
        return res.status(400).json({
          message: "Audio file is required",
        });
      }

      const normalizedTitle = String(title || "").trim() || toSafeSongTitleFromFileName(audioFile.originalname);

      // ================= CLOUDINARY UPLOAD =================
      const audioUpload = await cloudinary.uploader.upload(
        audioFile.path,
        {
          resource_type: "video", 
          folder: cloudinaryFolder("audio"),
        }
      );

      // Upload image nếu có, không thì dùng ảnh mặc định
      let imageUrl = defaultSongImageUrl();
      let imagePublicId = null;
      
      if (imageFile) {
        const imageUpload = await cloudinary.uploader.upload(
          imageFile.path,
          {
            folder: cloudinaryFolder("images"),
          }
        );
        imageUrl = imageUpload.secure_url;
        imagePublicId = imageUpload.public_id;
        fs.unlinkSync(imageFile.path);
      } else if (imageUrlInput && isHttpUrl(imageUrlInput)) {
        const imageUpload = await cloudinary.uploader.upload(imageUrlInput, {
          folder: cloudinaryFolder("images"),
        });
        imageUrl = imageUpload.secure_url;
        imagePublicId = imageUpload.public_id;
      }

      // Xoá file tạm sau khi upload
      fs.unlinkSync(audioFile.path);

      // ================= SAVE MONGODB =================
      const source = accountRole === "admin"
        ? "admin"
        : accountRole === "artist"
          ? "artist"
          : "user";
      const songData = {
        title: normalizedTitle,
        artists,
        topicIds,
        lyrics,
        source,
        uploadedBy: req.userId,
        isPublic: isPublic === 'true' || isPublic === true,
        audioUrl: audioUpload.secure_url,
        audioPublicId: audioUpload.public_id,
        duration: audioUpload.duration,
        imageUrl: imageUrl,
        imagePublicId: imagePublicId,
      };

      const song = await Song.create(songData);

      res.status(201).json({
        success: true,
        message: "Upload thành công",
        song,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        success: false,
        message: "Upload thất bại",
        error: error.message,
      });
    }
  }
);

// =================================================
// ✏️ UPDATE SONG (AUTH REQUIRED - OWNER OR ARTIST)
router.put(
  "/:id",
  authMiddleware,
  upload.fields([
    { name: "audio", maxCount: 1 },
    { name: "image", maxCount: 1 },
  ]),
  async (req, res) => {
    const audioFile = req.files?.audio?.[0] || null;
    const imageFile = req.files?.image?.[0] || null;

    try {
      const { id } = req.params;
      const body = req.body || {};
      const song = await Song.findById(id);

      if (!song) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy bài hát",
        });
      }

      // Kiểm tra quyền sở hữu
      const isUploader = song.uploadedBy && (song.uploadedBy.toString() === req.userId || song.uploadedBy._id?.toString() === req.userId);
      const isArtist = song.artists && song.artists.some((a) => a.toString() === req.userId || a._id?.toString() === req.userId);

      if (!isUploader && !isArtist) {
        return res.status(403).json({
          success: false,
          message: "Bạn không có quyền sửa bài hát này",
        });
      }

      const accountRole = await resolveAuthenticatedRole(req);
      const canEditArtists = accountRole === "admin" || accountRole === "artist";
      const parsedArtists = canEditArtists
        ? await resolveArtistIds(body.artists)
        : song.artists;
      const parsedTopicIds = parseArrayField(body.topicIds);
      const imageUrlInput =
        typeof body.imageUrl === "string" ? body.imageUrl.trim() : "";

      if (typeof body.title !== "undefined") {
        song.title = String(body.title).trim();
      }
      if (typeof body.artists !== "undefined" && canEditArtists) {
        song.artists = parsedArtists;
      }
      if (typeof body.lyrics !== "undefined") {
        song.lyrics = body.lyrics;
      }
      if (typeof body.topicIds !== "undefined") {
        song.topicIds = parsedTopicIds;
      }
      if (typeof body.isPublic !== "undefined") {
        song.isPublic = body.isPublic === "true" || body.isPublic === true;
      }

      if (audioFile) {
        const audioUpload = await cloudinary.uploader.upload(audioFile.path, {
          resource_type: "video",
          folder: cloudinaryFolder("audio"),
        });
        song.audioUrl = audioUpload.secure_url;
        song.audioPublicId = audioUpload.public_id;
        song.duration = audioUpload.duration;
      }

      if (imageFile) {
        const imageUpload = await cloudinary.uploader.upload(imageFile.path, {
          folder: cloudinaryFolder("images"),
        });
        song.imageUrl = imageUpload.secure_url;
        song.imagePublicId = imageUpload.public_id;
      } else if (imageUrlInput && isHttpUrl(imageUrlInput)) {
        const imageUpload = await cloudinary.uploader.upload(imageUrlInput, {
          folder: cloudinaryFolder("images"),
        });
        song.imageUrl = imageUpload.secure_url;
        song.imagePublicId = imageUpload.public_id;
      }

      await song.save();

      res.json({
        success: true,
        message: "Cập nhật thành công",
        song,
      });
    } catch (error) {
      console.error("Update song error:", error);
      res.status(500).json({
        success: false,
        message: "Cập nhật thất bại",
        error: error.message,
      });
    } finally {
      safeUnlink(audioFile?.path);
      safeUnlink(imageFile?.path);
    }
  }
);

// =================================================
// 🔄 TOGGLE PUBLIC/PRIVATE (AUTH REQUIRED - OWNER OR ARTIST)
router.patch("/:id/toggle-public", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const song = await Song.findById(id);
    
    if (!song) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy bài hát"
      });
    }

    // Kiểm tra quyền sở hữu
    const isUploader = song.uploadedBy && (song.uploadedBy.toString() === req.userId || song.uploadedBy._id?.toString() === req.userId);
    const isArtist = song.artists && song.artists.some(a => a.toString() === req.userId || a._id?.toString() === req.userId);

    if (!isUploader && !isArtist) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền thay đổi"
      });
    }

    song.isPublic = !song.isPublic;
    await song.save();

    res.json({
      success: true,
      message: song.isPublic ? "Đã công khai bài hát" : "Đã chuyển sang riêng tư",
      isPublic: song.isPublic
    });
  } catch (error) {
    console.error("Toggle public error:", error);
    res.status(500).json({
      success: false,
      message: "Thay đổi thất bại"
    });
  }
});

// =================================================
// 🗑️ DELETE SONG (AUTH REQUIRED - OWNER OR ARTIST)
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const song = await Song.findById(id);
    
    if (!song) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy bài hát"
      });
    }

    // Kiểm tra quyền sở hữu
    const isUploader = song.uploadedBy && (song.uploadedBy.toString() === req.userId || song.uploadedBy._id?.toString() === req.userId);
    const isArtist = song.artists && song.artists.some(a => a.toString() === req.userId || a._id?.toString() === req.userId);

    if (!isUploader && !isArtist) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền xóa bài hát này"
      });
    }

    // Xóa file trên Cloudinary
    try {
      await cloudinary.uploader.destroy(song.audioPublicId, { resource_type: "video" });
      await cloudinary.uploader.destroy(song.imagePublicId);
    } catch (cloudErr) {
      console.error("Cloudinary delete error:", cloudErr);
    }

    // Xóa khỏi database
    await Song.findByIdAndDelete(id);

    res.json({
      success: true,
      message: "Đã xóa bài hát"
    });
  } catch (error) {
    console.error("Delete song error:", error);
    res.status(500).json({
      success: false,
      message: "Xóa thất bại"
    });
  }
});

module.exports = router;
