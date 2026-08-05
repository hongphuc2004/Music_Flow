/**
 * song.service.js — Business logic for song CRUD, streaming, play tracking,
 * download management, flowchart, and rankings.
 *
 * The controller delegates entirely to this service and only formats HTTP
 * responses. Database access goes through repositories; Cloudinary access
 * goes through cloudinary.util.
 */

const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const Song = require("../models/song.model");
const Artist = require("../models/artist.model");
const User = require("../models/user.model");
const songRepo = require("../repositories/song.repository");
const playEventRepo = require("../repositories/play-event.repository");

const { safeUnlink, uploadAudioToCloudinary, uploadImageFileToCloudinary, uploadImageUrlToCloudinary, deleteFromCloudinary } = require("../utils/cloudinary.util");
const { isObjectIdLike, isHttpUrl, parseArrayField, toSafeSongTitleFromFileName } = require("../utils/string.util");
const { ONE_HOUR_MS, getRankingPeriodRange, buildRankMap, buildHourlySlots } = require("../utils/ranking.util");

const TRACK_PLAY_COOLDOWN_MS = 3 * 60 * 1000;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Resolve an optional JWT user id from the Authorization header. */
const resolveOptionalUserId = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ") || !process.env.JWT_SECRET) return null;
  try {
    const decoded = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET);
    return decoded.userId || decoded.id || decoded._id || null;
  } catch {
    return null;
  }
};

/** Build an anonymous listener key from IP + User-Agent for cooldown checks. */
const buildAnonymousListenerKey = (req) => {
  const ipAddress = req.ip || req.socket?.remoteAddress || "unknown";
  const userAgent = String(req.headers["user-agent"] || "unknown");
  return crypto
    .createHash("sha256")
    .update(`${ipAddress}|${userAgent}`)
    .digest("hex");
};

/**
 * Resolve the role of an authenticated request.
 * Falls back to a DB lookup when the JWT role field is missing / unexpected.
 */
const resolveAuthenticatedRole = async (req) => {
  const tokenRole = String(req.userRole || "").trim().toLowerCase();
  if (["admin", "user", "artist"].includes(tokenRole)) return tokenRole;

  const user = await User.findById(req.userId).select("role").lean();
  if (user?.role) return String(user.role).trim().toLowerCase();

  const artist = await Artist.findById(req.userId).select("role").lean();
  if (artist?.role) return String(artist.role).trim().toLowerCase();

  return "user";
};

/**
 * Resolve artist ObjectId array from a mixed input (ids, names, comma-list).
 * Used when creating / updating songs.
 */
const resolveArtistIds = async (rawArtists) => {
  const { escapeRegex } = require("../utils/string.util");
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

  return [...new Set([...byIds, ...byText].map((a) => String(a._id)))];
};

// ---------------------------------------------------------------------------
// Stream
// ---------------------------------------------------------------------------

/**
 * Resolve the Cloudinary audio URL for a public song.
 *
 * @param {string} songId
 * @returns {Promise<string>}  the audio URL
 */
const resolveSongStreamUrl = async (songId) => {
  const song = await songRepo.findPublicById(songId, "audioUrl");
  if (!song) {
    const err = new Error("Song not found");
    err.status = 404;
    throw err;
  }
  if (!song.audioUrl || !isHttpUrl(song.audioUrl)) {
    const err = new Error("Audio source not found");
    err.status = 404;
    throw err;
  }
  return song.audioUrl;
};

// ---------------------------------------------------------------------------
// Play tracking
// ---------------------------------------------------------------------------

/**
 * Record a qualified play event for a song.
 * Applies a per-listener cooldown to avoid inflating counts.
 *
 * @param {string} songId
 * @param {import('express').Request} req
 * @returns {Promise<{ counted: boolean, reason?: string }>}
 */
const registerPlay = async (songId, req) => {
  const song = await songRepo.findPublicById(songId, "_id artists");
  if (!song) {
    const err = new Error("Song not found");
    err.status = 404;
    throw err;
  }

  const userId = resolveOptionalUserId(req);
  const anonymousKey = userId ? null : buildAnonymousListenerKey(req);
  const cooldownStart = new Date(Date.now() - TRACK_PLAY_COOLDOWN_MS);
  const listenerFilter = userId ? { userId } : { anonymousKey };

  const recentPlay = await playEventRepo.findRecentPlay(song._id, listenerFilter, cooldownStart);
  if (recentPlay) return { counted: false, reason: "cooldown" };

  const artistIds = Array.isArray(song.artists) ? song.artists.filter(Boolean) : [];

  const playEvent = await playEventRepo.createPlayEvent({
    songId: song._id,
    artistId: artistIds[0] || null,
    artistIds,
    userId: userId || null,
    anonymousKey,
    playedAt: new Date(),
  });

  try {
    await songRepo.updateById(song._id, { $inc: { playCount: 1 } });
  } catch (error) {
    await playEventRepo.deletePlayEventById(playEvent._id);
    throw error;
  }

  return { counted: true };
};

// ---------------------------------------------------------------------------
// Download
// ---------------------------------------------------------------------------

/**
 * Validate that a song is downloadable and log the download event.
 *
 * @param {string} songId
 * @param {string|null} userId
 * @returns {Promise<{ songId: string, title: string, audioUrl: string }>}
 */
const downloadSong = async (songId, userId) => {
  const song = await Song.findById(songId).select("_id title source allowDownload audioUrl fileSize");
  if (!song) {
    const err = new Error("Không tìm thấy bài hát");
    err.status = 404;
    throw err;
  }

  if (song.source === "user" || song.allowDownload === false) {
    const err = new Error("Bài hát này không được phép tải xuống");
    err.status = 403;
    throw err;
  }

  const SongDownloadEvent = require("../models/song-download-event.model");

  if (userId) {
    // Kiểm tra hạn mức Download (100MB) cho tài khoản Free
    const user = await User.findById(userId).select("isPremium premiumExpiry");
    const { hasPremiumAccess } = require("../utils/premium.util");
    if (!user || !hasPremiumAccess(user)) {
      const downloads = await SongDownloadEvent.find({ userId }).populate("songId", "fileSize");
      const seenSongIds = new Set();
      let totalDownloadedBytes = 0;
      
      for (const event of downloads) {
        if (!event.songId) continue;
        const sId = String(event.songId._id);
        if (seenSongIds.has(sId)) continue;
        seenSongIds.add(sId);
        totalDownloadedBytes += event.songId.fileSize && event.songId.fileSize > 0
          ? event.songId.fileSize
          : 4.5 * 1024 * 1024; // Fallback 4.5MB
      }

      // Chỉ tính thêm dung lượng nếu bài hát này chưa từng được tải về
      if (!seenSongIds.has(String(song._id))) {
        const newDownloadSize = song.fileSize && song.fileSize > 0
          ? song.fileSize
          : 4.5 * 1024 * 1024; // Fallback 4.5MB
        const downloadLimitBytes = 100 * 1024 * 1024; // 100MB
        if (totalDownloadedBytes + newDownloadSize > downloadLimitBytes) {
          const err = new Error(`Tài khoản miễn phí bị giới hạn 100MB dung lượng tải xuống. Bạn đã dùng ${(totalDownloadedBytes / (1024 * 1024)).toFixed(1)}MB, tệp cần tải mới là ${(newDownloadSize / (1024 * 1024)).toFixed(1)}MB. Vui lòng nâng cấp Premium để tải xuống không giới hạn.`);
          err.status = 403;
          throw err;
        }
      }
    }

    SongDownloadEvent.create({
      userId,
      songId: song._id,
      downloadedAt: new Date(),
    }).catch((err) => {
      console.error("Create song download event failed:", err.message);
    });
  }

  return { songId: song._id, title: song.title, audioUrl: song.audioUrl };
};

/**
 * Return a user's unique download history (newest first, deduplicated).
 *
 * @param {string} userId
 * @param {number} [limit=50]
 * @returns {Promise<object[]>}
 */
const getDownloadHistory = async (userId, limit = 50) => {
  const clampedLimit = Math.min(parseInt(limit, 10) || 50, 200);
  const events = await playEventRepo.findDownloadHistory(userId, 400);

  const uniqueSongs = [];
  const seenSongIds = new Set();

  for (const event of events) {
    const song = event.songId;
    if (!song?._id) continue;
    const songId = String(song._id);
    if (seenSongIds.has(songId)) continue;
    seenSongIds.add(songId);
    uniqueSongs.push({ ...song, downloadedAt: event.downloadedAt });
    if (uniqueSongs.length >= clampedLimit) break;
  }

  return uniqueSongs;
};

/**
 * Remove all download events for a user + song.
 *
 * @param {string} userId
 * @param {string} songId
 * @returns {Promise<number>}  deletedCount
 */
const removeFromDownloadHistory = async (userId, songId) => {
  if (!isObjectIdLike(songId)) {
    const err = new Error("SongId không hợp lệ");
    err.status = 400;
    throw err;
  }
  const result = await playEventRepo.deleteDownloads(userId, songId);
  return result.deletedCount || 0;
};

/**
 * Bulk-sync a list of song ids into the user's download history.
 * Skips ids that already exist.
 *
 * @param {string} userId
 * @param {string[]} songIds
 * @returns {Promise<{ synced: number, totalReceived: number }>}
 */
const syncDownloadHistory = async (userId, songIds) => {
  const normalizedIds = [
    ...new Set(
      (Array.isArray(songIds) ? songIds : [])
        .map((id) => String(id || "").trim())
        .filter((id) => isObjectIdLike(id))
    ),
  ];

  if (normalizedIds.length === 0) {
    const err = new Error("Danh sách songIds không hợp lệ");
    err.status = 400;
    throw err;
  }

  const existing = await playEventRepo.findExistingDownloads(userId, normalizedIds);
  const existingSet = new Set(existing.map((e) => String(e.songId)));
  const missing = normalizedIds.filter((id) => !existingSet.has(id));

  if (missing.length > 0) {
    const existingSongs = await Song.find({ _id: { $in: missing } }).select("_id").lean();
    const validIds = new Set(existingSongs.map((s) => String(s._id)));
    const docs = missing
      .filter((id) => validIds.has(id))
      .map((songId) => ({ userId, songId, downloadedAt: new Date() }));

    if (docs.length > 0) {
      await playEventRepo.insertManyDownloads(docs);
    }
  }

  return { synced: missing.length, totalReceived: normalizedIds.length };
};

// ---------------------------------------------------------------------------
// Upload / Update / Delete
// ---------------------------------------------------------------------------

/**
 * Upload a new song (audio + optional image) to Cloudinary and save metadata.
 *
 * @param {object} body       — req.body
 * @param {object} files      — req.files ({ audio: [], image: [] })
 * @param {string} userId     — req.userId
 * @param {string} userRole   — resolved role string
 * @returns {Promise<import('mongoose').Document>}
 */
const uploadSong = async (body, files, userId, userRole) => {
  const audioFile = files?.audio?.[0] || null;
  const imageFile = files?.image?.[0] || null;

  if (!audioFile) {
    const err = new Error("Audio file is required");
    err.status = 400;
    throw err;
  }

  // Kiểm tra hạn mức Upload (50MB) của tài khoản Free
  if (userRole === "user") {
    const user = await User.findById(userId).select("isPremium premiumExpiry");
    const { hasPremiumAccess } = require("../utils/premium.util");
    if (!user || !hasPremiumAccess(user)) {
      const userSongs = await Song.find({ uploadedBy: userId, source: "user" }).select("fileSize");
      const totalUploadedBytes = userSongs.reduce((sum, s) => sum + (s.fileSize && s.fileSize > 0 ? s.fileSize : 4.8 * 1024 * 1024), 0); // Fallback 4.8MB
      const newFileSize = audioFile.size || 0;
      const uploadLimitBytes = 50 * 1024 * 1024; // 50MB
      
      if (totalUploadedBytes + newFileSize > uploadLimitBytes) {
        // Dọn dẹp các tệp tạm thời multer
        safeUnlink(audioFile.path);
        if (imageFile) safeUnlink(imageFile.path);
        
        const err = new Error(`Tài khoản miễn phí bị giới hạn 50MB dung lượng tải lên. Bạn đã dùng ${(totalUploadedBytes / (1024 * 1024)).toFixed(1)}MB, tệp tải lên mới là ${(newFileSize / (1024 * 1024)).toFixed(1)}MB. Vui lòng nâng cấp Premium để tải lên không giới hạn.`);
        err.status = 403;
        throw err;
      }
    }
  }

  const artists =
    userRole === "user" ? [] : await resolveArtistIds(body.artists);
  const topicIds = parseArrayField(body.topicIds);
  const imageUrlInput = typeof body.imageUrl === "string" ? body.imageUrl.trim() : "";
  const normalizedTitle =
    String(body.title || "").trim() ||
    toSafeSongTitleFromFileName(audioFile.originalname);

  try {
    // Upload audio
    const audio = await uploadAudioToCloudinary(audioFile.path);
    safeUnlink(audioFile.path);

    // Upload image (file > url > default)
    let imageUrl = require("../config/cloudinaryFolders").defaultSongImageUrl();
    let imagePublicId = null;

    if (imageFile) {
      const img = await uploadImageFileToCloudinary(imageFile.path);
      imageUrl = img.secure_url;
      imagePublicId = img.public_id;
      safeUnlink(imageFile.path);
    } else if (imageUrlInput && isHttpUrl(imageUrlInput)) {
      const img = await uploadImageUrlToCloudinary(imageUrlInput);
      imageUrl = img.secure_url;
      imagePublicId = img.public_id;
    }

    const source =
      userRole === "admin" ? "admin" : userRole === "artist" ? "artist" : "user";

    const song = await songRepo.create({
      title: normalizedTitle,
      artists,
      topicIds,
      lyrics: body.lyrics,
      source,
      uploadedBy: userId,
      isPublic: body.isPublic === "true" || body.isPublic === true,
      audioUrl: audio.secure_url,
      audioPublicId: audio.public_id,
      duration: audio.duration,
      fileSize: audioFile.size || 0,
      imageUrl,
      imagePublicId,
    });

    return song;
  } catch (error) {
    safeUnlink(audioFile?.path);
    safeUnlink(imageFile?.path);
    throw error;
  }
};

/**
 * Update an existing song's metadata and/or files.
 * Only the uploader or an artist listed on the song may update it.
 *
 * @param {string} songId
 * @param {object} body    — req.body
 * @param {object} files   — req.files
 * @param {string} userId  — req.userId
 * @param {string} userRole — resolved role string
 * @returns {Promise<import('mongoose').Document>}
 */
const updateSong = async (songId, body, files, userId, userRole) => {
  const audioFile = files?.audio?.[0] || null;
  const imageFile = files?.image?.[0] || null;

  const song = await songRepo.findById(songId);
  if (!song) {
    const err = new Error("Không tìm thấy bài hát");
    err.status = 404;
    throw err;
  }

  const isUploader =
    song.uploadedBy &&
    (song.uploadedBy.toString() === userId ||
      song.uploadedBy._id?.toString() === userId);
  const isArtist =
    song.artists &&
    song.artists.some(
      (a) => a.toString() === userId || a._id?.toString() === userId
    );

  if (!isUploader && !isArtist) {
    const err = new Error("Bạn không có quyền sửa bài hát này");
    err.status = 403;
    throw err;
  }

  const canEditArtists = userRole === "admin" || userRole === "artist";
  const parsedArtists = canEditArtists
    ? await resolveArtistIds(body.artists)
    : song.artists;
  const parsedTopicIds = parseArrayField(body.topicIds);
  const imageUrlInput = typeof body.imageUrl === "string" ? body.imageUrl.trim() : "";

  if (typeof body.title !== "undefined") song.title = String(body.title).trim();
  if (typeof body.artists !== "undefined" && canEditArtists)
    song.artists = parsedArtists;
  if (typeof body.lyrics !== "undefined") song.lyrics = body.lyrics;
  if (typeof body.topicIds !== "undefined") song.topicIds = parsedTopicIds;
  if (typeof body.isPublic !== "undefined")
    song.isPublic = body.isPublic === "true" || body.isPublic === true;

  try {
    if (audioFile) {
      const audio = await uploadAudioToCloudinary(audioFile.path);
      song.audioUrl = audio.secure_url;
      song.audioPublicId = audio.public_id;
      song.duration = audio.duration;
    }

    if (imageFile) {
      const img = await uploadImageFileToCloudinary(imageFile.path);
      song.imageUrl = img.secure_url;
      song.imagePublicId = img.public_id;
    } else if (imageUrlInput && isHttpUrl(imageUrlInput)) {
      const img = await uploadImageUrlToCloudinary(imageUrlInput);
      song.imageUrl = img.secure_url;
      song.imagePublicId = img.public_id;
    }

    await song.save();
    return song;
  } finally {
    safeUnlink(audioFile?.path);
    safeUnlink(imageFile?.path);
  }
};

/**
 * Toggle a song's isPublic flag.
 * Only the uploader or an artist on the song may do this.
 *
 * @param {string} songId
 * @param {string} userId
 * @returns {Promise<{ isPublic: boolean, message: string }>}
 */
const togglePublic = async (songId, userId) => {
  const song = await songRepo.findById(songId);
  if (!song) {
    const err = new Error("Không tìm thấy bài hát");
    err.status = 404;
    throw err;
  }

  const isUploader =
    song.uploadedBy &&
    (song.uploadedBy.toString() === userId ||
      song.uploadedBy._id?.toString() === userId);
  const isArtist =
    song.artists &&
    song.artists.some(
      (a) => a.toString() === userId || a._id?.toString() === userId
    );

  if (!isUploader && !isArtist) {
    const err = new Error("Bạn không có quyền thay đổi");
    err.status = 403;
    throw err;
  }

  song.isPublic = !song.isPublic;
  await song.save();

  return {
    isPublic: song.isPublic,
    message: song.isPublic ? "Đã công khai bài hát" : "Đã chuyển sang riêng tư",
  };
};

/**
 * Delete a song from DB and Cloudinary.
 * Only the uploader or an artist on the song may do this.
 *
 * @param {string} songId
 * @param {string} userId
 * @returns {Promise<void>}
 */
const deleteSong = async (songId, userId) => {
  const song = await songRepo.findById(songId, "_id uploadedBy artists audioPublicId imagePublicId");
  if (!song) {
    const err = new Error("Không tìm thấy bài hát");
    err.status = 404;
    throw err;
  }

  const isUploader =
    song.uploadedBy &&
    (song.uploadedBy.toString() === userId ||
      song.uploadedBy._id?.toString() === userId);
  const isArtist =
    song.artists &&
    song.artists.some(
      (a) => a.toString() === userId || a._id?.toString() === userId
    );

  if (!isUploader && !isArtist) {
    const err = new Error("Bạn không có quyền xóa bài hát này");
    err.status = 403;
    throw err;
  }

  // Delete Cloudinary assets (non-blocking errors logged, not thrown)
  try {
    if (song.audioPublicId)
      await deleteFromCloudinary(song.audioPublicId, "video");
    if (song.imagePublicId)
      await deleteFromCloudinary(song.imagePublicId, "image");
  } catch (cloudErr) {
    console.error("Cloudinary delete error:", cloudErr);
  }

  await songRepo.deleteById(songId);
};

// ---------------------------------------------------------------------------
// Lyrics
// ---------------------------------------------------------------------------

/**
 * @param {string} songId
 * @returns {Promise<{ songId, title, artists, lyrics }>}
 */
const getLyrics = async (songId) => {
  const song = await Song.findById(songId)
    .select("_id title artists lyrics")
    .populate("artists", "name");

  if (!song) {
    const err = new Error("Không tìm thấy bài hát");
    err.status = 404;
    throw err;
  }

  return {
    songId: song._id,
    title: song.title,
    artists: song.artists,
    lyrics: song.lyrics || "",
  };
};

// ---------------------------------------------------------------------------
// Flowchart
// ---------------------------------------------------------------------------

/**
 * Compute hourly-stream chart data for the top songs over a sliding window.
 *
 * @param {{ hours?: number, limit?: number, mode?: string }} opts
 */
const getFlowchart = async ({ hours: rawHours, limit: rawLimit, mode: rawMode } = {}) => {
  const requestedHours = parseInt(rawHours, 10);
  const requestedLimit = parseInt(rawLimit, 10);
  const requestedMode = String(rawMode || "flow").trim().toLowerCase();
  const rankingMode = requestedMode === "rising" ? "rising" : "flow";

  const hours = Number.isFinite(requestedHours)
    ? Math.min(Math.max(requestedHours, 6), 48)
    : 12;
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 10), 50)
    : 50;

  const publicSongs = await songRepo.findPublicForRanking();
  const songIds = publicSongs.map((s) => s._id.toString());

  const now = new Date();
  const day24Ms = 24 * ONE_HOUR_MS;
  const startLast24h = new Date(now.getTime() - day24Ms);
  const startPrev24h = new Date(now.getTime() - 2 * day24Ms);

  const defaultMetricsBySongId = new Map(
    publicSongs.map((s) => [
      s._id.toString(),
      { last24h: 0, previous24h: 0, risingScore: 0 },
    ])
  );

  if (songIds.length > 0) {
    const recentEvents = await playEventRepo.findPlayEventsInRange(songIds, startPrev24h);

    for (const event of recentEvents) {
      const songId = event.songId?.toString();
      if (!songId || !defaultMetricsBySongId.has(songId)) continue;

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
      const mA = defaultMetricsBySongId.get(a._id.toString()) || { last24h: 0, previous24h: 0, risingScore: 0 };
      const mB = defaultMetricsBySongId.get(b._id.toString()) || { last24h: 0, previous24h: 0, risingScore: 0 };

      if (rankingMode === "rising") {
        if (mB.risingScore !== mA.risingScore) return mB.risingScore - mA.risingScore;
        if (mB.last24h !== mA.last24h) return mB.last24h - mA.last24h;
      }
      if (b.playCount !== a.playCount) return b.playCount - a.playCount;
      return (b.likeCount || 0) - (a.likeCount || 0);
    })
    .slice(0, limit)
    .map((s) => s._id.toString());

  const rankedSongs = await songRepo.findByIds(rankedSongIds);
  const songById = new Map(rankedSongs.map((s) => [s._id.toString(), s]));
  const topSongs = rankedSongIds.map((id) => songById.get(id)).filter(Boolean);

  if (topSongs.length === 0) {
    return { rankingMode, hours, limit, timeSlots: [], timeSlotTimestamps: [], topSongs: [], chartSeries: [], songMetrics: [], generatedAt: new Date().toISOString() };
  }

  const slots = buildHourlySlots(hours);
  const startTime = slots[0];
  const songIdSet = topSongs.map((s) => s._id.toString());

  const events = await playEventRepo.findPlayEventsInRange(songIdSet, startTime);

  const { truncateToHour } = require("../utils/ranking.util");
  const seriesBySongId = new Map(songIdSet.map((id) => [id, Array(hours).fill(0)]));

  for (const event of events) {
    const songId = event.songId?.toString();
    if (!songId || !seriesBySongId.has(songId)) continue;
    const eventHour = truncateToHour(event.playedAt).getTime();
    const index = Math.floor((eventHour - startTime.getTime()) / ONE_HOUR_MS);
    if (index < 0 || index >= hours) continue;
    seriesBySongId.get(songId)[index] += 1;
  }

  const chartSeries = topSongs.map((song) => ({
    songId: song._id.toString(),
    points: seriesBySongId.get(song._id.toString()) || Array(hours).fill(0),
  }));

  const songMetrics = topSongs.map((song) => {
    const metric = defaultMetricsBySongId.get(song._id.toString()) || { last24h: 0, previous24h: 0, risingScore: 0 };
    return { songId: song._id.toString(), ...metric };
  });

  return {
    rankingMode, hours, limit,
    timeSlots: slots.map((s) => s.getHours().toString().padStart(2, "0")),
    timeSlotTimestamps: slots.map((s) => s.toISOString()),
    topSongs, chartSeries, songMetrics,
    generatedAt: new Date().toISOString(),
  };
};

// ---------------------------------------------------------------------------
// Rankings
// ---------------------------------------------------------------------------

/**
 * Compute period-based rankings with trend indicators.
 *
 * @param {{ period?: string }} opts
 */
const getRankings = async ({ period: rawPeriod } = {}) => {
  const period = ["today", "week", "month"].includes(rawPeriod) ? rawPeriod : "today";
  const { currentStart, currentEnd, previousStart, previousEnd } = getRankingPeriodRange(period);

  const eventCounts = await playEventRepo.aggregatePeriodCounts(previousStart, currentEnd, currentStart);

  const countsBySongId = new Map();
  for (const item of eventCounts) {
    const songId = item._id.songId?.toString();
    if (!songId) continue;
    if (!countsBySongId.has(songId)) countsBySongId.set(songId, { current: 0, previous: 0 });
    countsBySongId.get(songId)[item._id.bucket] = item.count;
  }

  const publicSongs = await songRepo.findPublicForRankingFull();

  const toRankItem = (song, bucket) => ({
    songId: song._id,
    count: countsBySongId.get(song._id.toString())?.[bucket] || 0,
    totalPlayCount: song.playCount || 0,
    likeCount: song.likeCount || 0,
  });
  const sortRankItems = (a, b) =>
    b.count - a.count || b.totalPlayCount - a.totalPlayCount || b.likeCount - a.likeCount;

  const rankedCurrent = publicSongs.map((s) => toRankItem(s, "current")).sort(sortRankItems);
  const rankedPrevious = publicSongs
    .map((s) => toRankItem(s, "previous"))
    .filter((i) => i.count > 0)
    .sort(sortRankItems);

  const previousRankMap = buildRankMap(rankedPrevious);
  const songById = new Map(publicSongs.map((s) => [s._id.toString(), s]));

  const rankings = rankedCurrent.slice(0, 30).map((item, index) => {
    const songId = item.songId.toString();
    const previousRank = previousRankMap.get(songId);
    const rank = index + 1;
    let trend = "stable";
    let difference = 0;

    if (item.count > 0 && previousRank === undefined) {
      trend = "new";
    } else if (previousRank !== undefined && rank < previousRank) {
      trend = "rise";
      difference = previousRank - rank;
    } else if (previousRank !== undefined && rank > previousRank) {
      trend = "drop";
      difference = rank - previousRank;
    }

    return {
      ...songById.get(songId),
      rank,
      periodPlayCount: item.count,
      previousPeriodPlayCount: countsBySongId.get(songId)?.previous || 0,
      trend,
      difference,
    };
  });

  const artistStats = new Map();
  for (const item of rankedCurrent) {
    const song = songById.get(item.songId.toString());
    if (!song || !Array.isArray(song.artists)) continue;
    for (const artist of song.artists) {
      const artistId = artist?._id?.toString();
      if (!artistId) continue;
      if (!artistStats.has(artistId)) {
        artistStats.set(artistId, {
          _id: artist._id,
          name: artist.name || "Nghệ sĩ ẩn danh",
          avatar: artist.avatar || "",
          periodPlayCount: 0,
          songCount: 0,
        });
      }
      const stat = artistStats.get(artistId);
      stat.periodPlayCount += item.count;
      stat.songCount += 1;
    }
  }

  const trendingArtists = [...artistStats.values()]
    .filter((a) => a.periodPlayCount > 0)
    .sort((a, b) => b.periodPlayCount - a.periodPlayCount || b.songCount - a.songCount)
    .slice(0, 5);

  const newReleases = [...publicSongs]
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, 5);

  return {
    period,
    range: { currentStart, currentEnd, previousStart, previousEnd },
    rankings,
    trendingArtists,
    newReleases,
    generatedAt: new Date().toISOString(),
  };
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  resolveSongStreamUrl,
  registerPlay,
  downloadSong,
  getDownloadHistory,
  removeFromDownloadHistory,
  syncDownloadHistory,
  uploadSong,
  updateSong,
  togglePublic,
  deleteSong,
  getLyrics,
  getFlowchart,
  getRankings,
  // helpers needed by controller for role resolution
  resolveAuthenticatedRole,
};
