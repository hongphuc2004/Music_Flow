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
const { isObjectIdLike, isHttpUrl, parseArrayField, toSafeSongTitleFromFileName, slugify, escapeRegex } = require("../utils/string.util");

const { ONE_HOUR_MS, getRankingPeriodRange, buildRankMap, buildHourlySlots } = require("../utils/ranking.util");
const { cache, CACHE_TTL } = require("../utils/cache.util");
const mm = require("music-metadata");

const TRACK_PLAY_COOLDOWN_MS = 3 * 60 * 1000;

/**
 * Thăm dò siêu dữ liệu tập tin âm thanh (format, bitrate, và độ sẵn sàng HQ).
 * 
 * @param {string} filePath 
 * @returns {Promise<{ format: string, bitrate: number|null, hasHighQualitySource: boolean }>}
 */
const probeAudioMetadata = async (filePath) => {
  let format = "mp3";
  let bitrate = null;
  let hasHighQualitySource = false;

  if (!filePath) {
    return { format, bitrate, hasHighQualitySource };
  }

  try {
    const metadata = await mm.parseFile(filePath);
    if (metadata && metadata.format) {
      format = metadata.format.container || "mp3";
      bitrate = metadata.format.bitrate || null;
      
      const lowerFormat = format.toLowerCase();
      const isLossless = lowerFormat.includes("wav") || lowerFormat.includes("flac") || lowerFormat.includes("alac");
      const isHQBitrate = bitrate && bitrate >= 320000;
      
      if (isLossless || isHQBitrate) {
        hasHighQualitySource = true;
      }
    }
  } catch (err) {
    console.error("Error reading audio metadata via music-metadata:", err);
  }

  return { format, bitrate, hasHighQualitySource };
};

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
    const updatedSong = await Song.findByIdAndUpdate(
      song._id,
      { $inc: { playCount: 1 } },
      { new: true, select: "title artists playCount" }
    ).lean();

    if (updatedSong) {
      const newPlayCount = updatedSong.playCount || 0;
      const oldPlayCount = newPlayCount - 1;
      const milestones = [1000, 10000, 50000, 100000, 500000, 1000000];
      const crossedMilestone = milestones.find((m) => oldPlayCount < m && newPlayCount >= m);

      if (crossedMilestone && Array.isArray(updatedSong.artists) && updatedSong.artists.length > 0) {
        const notificationTriggerService = require("./notificationTrigger.service");
        for (const aId of updatedSong.artists) {
          notificationTriggerService.triggerMilestoneNotification({
            artistId: aId,
            songId: updatedSong._id,
            milestoneCount: crossedMilestone,
            songTitle: updatedSong.title,
          }).catch((err) => console.error("Milestone notification trigger error:", err.message));
        }
      }
    }
  } catch (error) {
    await playEventRepo.deletePlayEventById(playEvent._id);
    throw error;
  }

  return { counted: true, playEventId: playEvent._id };
};

/**
 * Update feedback metadata for an existing play event (Stage 2 Lifecycle).
 * Verifies strict listener ownership (userId or anonymousKey).
 */
const updatePlayFeedback = async (songId, eventId, req, body = {}) => {
  const userId = resolveOptionalUserId(req);
  const anonymousKey = userId ? null : buildAnonymousListenerKey(req);
  const listenerFilter = userId ? { userId } : { anonymousKey };

  const playDuration = Math.max(0, Number(body.playDuration) || 0);
  const completionRate = Math.min(1.0, Math.max(0, Number(body.completionRate) || 0));
  const replayCount = Math.max(0, Number(body.replayCount) || 0);

  // Standardized Rules:
  const completed = Boolean(body.completed || completionRate >= 0.85);
  const skipped = Boolean(body.skipped || (playDuration < 30 && completionRate < 0.30 && !completed));

  const updatedEvent = await playEventRepo.updatePlayEventFeedback(eventId, listenerFilter, {
    playDuration,
    completionRate,
    completed,
    skipped,
    replayCount,
  });

  if (!updatedEvent) {
    const err = new Error("Play event not found or unauthorized listener");
    err.status = 403;
    throw err;
  }

  return { success: true, event: updatedEvent };
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
    const user = await User.findById(userId).populate("premiumPlan");
    const { hasPremiumAccess } = require("../utils/premium.util");

    let downloadLimitBytes = 100 * 1024 * 1024; // Mặc định Free: 100MB
    let planLabel = "miễn phí";

    if (user && hasPremiumAccess(user)) {
      const planName = user.premiumPlan?.name || "";
      if (planName === "Gói GO") {
        downloadLimitBytes = 300 * 1024 * 1024; // GO: 300MB
        planLabel = "Premium GO";
      } else if (planName === "Gói PLUS") {
        downloadLimitBytes = 700 * 1024 * 1024; // PLUS: 700MB
        planLabel = "Premium PLUS";
      } else {
        downloadLimitBytes = 1024 * 1024 * 1024; // PREMIUM: 1GB (1024MB)
        planLabel = "Premium";
      }
    }

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
      if (totalDownloadedBytes + newDownloadSize > downloadLimitBytes) {
        const limitMbStr = downloadLimitBytes >= 1024 * 1024 * 1024
          ? `${(downloadLimitBytes / (1024 * 1024 * 1024)).toFixed(0)}GB`
          : `${(downloadLimitBytes / (1024 * 1024)).toFixed(0)}MB`;

        const err = new Error(`Tài khoản ${planLabel} bị giới hạn ${limitMbStr} dung lượng tải xuống. Bạn đã dùng ${(totalDownloadedBytes / (1024 * 1024)).toFixed(1)}MB, tệp cần tải mới là ${(newDownloadSize / (1024 * 1024)).toFixed(1)}MB. Vui lòng nâng cấp gói cao hơn để tải xuống thêm.`);
        err.status = 403;
        throw err;
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

  // Kiểm tra hạn mức Upload theo gói cước
  if (userRole === "user") {
    const user = await User.findById(userId).populate("premiumPlan");
    const { hasPremiumAccess } = require("../utils/premium.util");
    
    let uploadLimitBytes = 100 * 1024 * 1024; // Free: 100MB
    let planLabel = "miễn phí";

    if (user && hasPremiumAccess(user)) {
      const planName = user.premiumPlan?.name || "";
      if (planName === "Gói GO") {
        uploadLimitBytes = 250 * 1024 * 1024; // GO: 250MB
        planLabel = "Premium GO";
      } else if (planName === "Gói PLUS") {
        uploadLimitBytes = 500 * 1024 * 1024; // PLUS: 500MB
        planLabel = "Premium PLUS";
      } else {
        uploadLimitBytes = 1024 * 1024 * 1024; // PREMIUM: 1GB (1024MB)
        planLabel = "Premium";
      }
    }

    const userSongs = await Song.find({ uploadedBy: userId, source: "user" }).select("fileSize");
    const totalUploadedBytes = userSongs.reduce((sum, s) => sum + (s.fileSize && s.fileSize > 0 ? s.fileSize : 4.8 * 1024 * 1024), 0); // Fallback 4.8MB
    const newFileSize = audioFile.size || 0;
    
    if (totalUploadedBytes + newFileSize > uploadLimitBytes) {
      // Dọn dẹp các tệp tạm thời multer
      safeUnlink(audioFile.path);
      if (imageFile) safeUnlink(imageFile.path);
      
      const limitMbStr = uploadLimitBytes >= 1024 * 1024 * 1024
        ? `${(uploadLimitBytes / (1024 * 1024 * 1024)).toFixed(0)}GB`
        : `${(uploadLimitBytes / (1024 * 1024)).toFixed(0)}MB`;
      const err = new Error(`Tài khoản ${planLabel} bị giới hạn ${limitMbStr} dung lượng tải lên. Bạn đã dùng ${(totalUploadedBytes / (1024 * 1024)).toFixed(1)}MB, tệp tải lên mới là ${(newFileSize / (1024 * 1024)).toFixed(1)}MB. Vui lòng nâng cấp gói cao hơn để tải thêm.`);
      err.status = 403;
      throw err;
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
    // Thăm dò siêu dữ liệu tập tin âm thanh trước khi upload
    const audioMetadata = await probeAudioMetadata(audioFile.path);

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
      audioMetadata,
      imageUrl,
      imagePublicId,
    });

    // Trigger non-blocking AI Content Moderation
    const aiModerationService = require("./aiModeration.service");
    aiModerationService.processSongModeration(song._id).catch((err) =>
      console.warn("[AIModeration] Async moderation error on upload:", err.message)
    );

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
      const audioMetadata = await probeAudioMetadata(audioFile.path);
      const audio = await uploadAudioToCloudinary(audioFile.path);
      song.audioUrl = audio.secure_url;
      song.audioPublicId = audio.public_id;
      song.duration = audio.duration;
      song.audioMetadata = audioMetadata;
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

    // Trigger non-blocking AI Content Moderation
    const aiModerationService = require("./aiModeration.service");
    aiModerationService.processSongModeration(song._id).catch((err) =>
      console.warn("[AIModeration] Async moderation error on update:", err.message)
    );

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

  const cacheKey = `flowchart:${hours}:${limit}:${rankingMode}`;

  return cache.wrap(cacheKey, CACHE_TTL.FLOWCHART, async () => {
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
  });
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
  const cacheKey = `rankings:${period}`;

  return cache.wrap(cacheKey, CACHE_TTL.RANKINGS, async () => {
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
  });
};

/**
 * Cấp vé phát nhạc ngắn hạn (60 giây) để bắt đầu stream.
 * Hỗ trợ Optional Auth: nếu có Token, kiểm tra phân quyền Premium.
 * 
 * @param {string} songId 
 * @param {string} quality 'hq' | 'std'
 * @param {string|null} token Authorization token truyền từ header
 * @returns {Promise<{ ticket: string }>}
 */
const issuePlaybackTicket = async (songId, quality, token) => {
  const Song = require("../models/song.model");
  const User = require("../models/user.model");
  const { hasPremiumAccess } = require("../utils/premium.util");

  const song = await Song.findById(songId);
  if (!song) {
    const err = new Error("Song not found");
    err.status = 404;
    throw err;
  }

  // Phân giải thông tin user từ token nếu có
  let user = null;
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const resolvedUserId = decoded.userId || decoded.id || decoded._id || null;
      if (resolvedUserId) {
        user = await User.findById(resolvedUserId);
      }
    } catch (err) {
      console.warn("JWT verification in ticket issuance failed:", err.message);
    }
  }

  const isPremium = user && hasPremiumAccess(user);

  // Nếu người dùng yêu cầu chất lượng cao (HQ 320kbps)
  if (quality === "hq") {
    if (!isPremium) {
      const err = new Error("Yêu cầu tài khoản Premium để nghe chất lượng HQ.");
      err.status = 403;
      err.code = "PREMIUM_REQUIRED";
      throw err;
    }

    if (!song.audioPublicId || !song.audioMetadata || !song.audioMetadata.hasHighQualitySource) {
      const err = new Error("Chất lượng HQ không khả dụng cho bài hát này.");
      err.status = 400;
      err.code = "HQ_NOT_AVAILABLE";
      throw err;
    }
  }

  const PLAYBACK_TICKET_SECRET = process.env.PLAYBACK_TICKET_SECRET || process.env.JWT_SECRET;
  if (!PLAYBACK_TICKET_SECRET) {
    throw new Error("Missing PLAYBACK_TICKET_SECRET and JWT_SECRET environment variables");
  }

  // Ký vé ngắn hạn có type: "playback", songId, permittedQuality
  const ticket = jwt.sign(
    {
      type: "playback",
      songId: song._id.toString(),
      permittedQuality: quality === "hq" ? "hq" : "std",
      userId: user ? user._id.toString() : null
    },
    PLAYBACK_TICKET_SECRET,
    { expiresIn: 60 } // Thời gian sống 60 giây cho handshake/redirect
  );

  return { ticket };
};

/**
 * Phân giải đường dẫn stream Cloudinary bằng vé phát nhạc hợp lệ.
 * 
 * @param {string} songId 
 * @param {string} ticket Vé phát nhạc ngắn hạn nhận được từ Query string
 * @returns {Promise<string>}
 */
const resolveStreamUrlByTicket = async (songId, ticket) => {
  if (!ticket) {
    const err = new Error("Không tìm thấy vé phát nhạc");
    err.status = 410;
    throw err;
  }

  const PLAYBACK_TICKET_SECRET = process.env.PLAYBACK_TICKET_SECRET || process.env.JWT_SECRET;
  if (!PLAYBACK_TICKET_SECRET) {
    throw new Error("Missing PLAYBACK_TICKET_SECRET and JWT_SECRET environment variables");
  }

  let decoded;
  try {
    decoded = jwt.verify(ticket, PLAYBACK_TICKET_SECRET);
  } catch (err) {
    const error = new Error("Vé phát nhạc hết hạn hoặc không hợp lệ");
    error.status = 410;
    throw error;
  }

  // Xác thực các dải thông tin bắt buộc trong vé
  if (
    decoded.type !== "playback" ||
    decoded.songId !== songId
  ) {
    const error = new Error("Vé phát nhạc không hợp lệ");
    error.status = 403;
    throw error;
  }

  const Song = require("../models/song.model");
  const song = await Song.findById(songId);
  if (!song) {
    const error = new Error("Song not found");
    error.status = 404;
    throw error;
  }

  let streamUrl = song.audioUrl;
  
  if (song.audioPublicId) {
    const cloudinary = require("../config/cloudinary");
    const targetBitrate = decoded.permittedQuality === "hq" ? "320k" : "128k";
    streamUrl = cloudinary.url(song.audioPublicId, {
      resource_type: "video",
      secure: true,
      transformation: [{ bit_rate: targetBitrate }]
    });
  }

  return streamUrl;
};

/**
 * Lấy chi tiết bài hát công khai theo ID (bao gồm thông tin artist, topic và relatedSongs).
 */
const getSongById = async (songId) => {
  if (!songId || !isObjectIdLike(songId)) {
    const error = new Error("Mã bài hát không hợp lệ");
    error.status = 400;
    throw error;
  }

  const song = await Song.findById(songId)
    .populate("artists", "name avatar bio")
    .populate("topicIds", "name")
    .populate("uploadedBy", "name")
    .lean();

  if (!song) {
    const error = new Error("Bài hát không tồn tại");
    error.status = 404;
    throw error;
  }

  // Security checks:
  if (!song.isPublic) {
    const error = new Error("Bài hát này hiện ở chế độ riêng tư hoặc chưa được phát hành công khai");
    error.status = 403;
    throw error;
  }

  if (song.moderation && String(song.moderation.status).toUpperCase() === "BLOCK") {
    const error = new Error("Bài hát này đã bị tạm dừng phát hành do vi phạm tiêu chuẩn cộng đồng");
    error.status = 403;
    throw error;
  }

  // Fetch up to 6 related songs (from same artist or same topics)
  let relatedSongs = [];
  try {
    const artistIds = Array.isArray(song.artists)
      ? song.artists.map((a) => a?._id || a).filter(Boolean)
      : [];
    const topicIds = Array.isArray(song.topicIds)
      ? song.topicIds.map((t) => t?._id || t).filter(Boolean)
      : [];

    relatedSongs = await Song.find({
      _id: { $ne: song._id },
      isPublic: true,
      "moderation.status": { $ne: "BLOCK" },
      $or: [
        { artists: { $in: artistIds } },
        { topicIds: { $in: topicIds } },
      ],
    })
      .populate("artists", "name avatar")
      .populate("topicIds", "name")
      .sort({ playCount: -1, createdAt: -1 })
      .limit(6)
      .lean();
  } catch (err) {
    console.warn("Failed to fetch related songs for song detail:", err.message);
  }

  return { song, relatedSongs };
};

/**
 * Lấy chi tiết bài hát công khai theo artistSlug và songSlug (SoundCloud-style).
 */
const getSongBySlug = async (artistSlug, songSlug) => {
  if (!artistSlug || !songSlug) {
    const error = new Error("Đường dẫn bài hát không hợp lệ");
    error.status = 400;
    throw error;
  }

  const cleanArtistSlug = String(artistSlug).trim().toLowerCase();
  const cleanSongSlug = String(songSlug).trim().toLowerCase();

  // 1. Find matching artist (by slug or computed slugify)
  let artists = await Artist.find({
    $or: [
      { slug: cleanArtistSlug },
      { name: new RegExp(`^${escapeRegex(cleanArtistSlug.replace(/-/g, " "))}$`, "i") },
    ],
  }).lean();

  if (!artists || artists.length === 0) {
    const allArtists = await Artist.find({}).select("_id name slug").lean();
    artists = allArtists.filter((a) => (a.slug || slugify(a.name)) === cleanArtistSlug);
  }

  const artistIds = artists.map((a) => a._id);

  // 2. Query candidate songs by artist or all songs
  const query = artistIds.length > 0 ? { artists: { $in: artistIds } } : {};
  let candidateSongs = await Song.find(query)
    .populate("artists", "name avatar bio slug")
    .populate("topicIds", "name")
    .populate("uploadedBy", "name")
    .lean();

  let matchedSong = candidateSongs.find(
    (s) => s.slug === cleanSongSlug || slugify(s.title) === cleanSongSlug
  );

  if (!matchedSong) {
    const allSongs = await Song.find({})
      .populate("artists", "name avatar bio slug")
      .populate("topicIds", "name")
      .populate("uploadedBy", "name")
      .lean();

    matchedSong = allSongs.find(
      (s) => (s.slug === cleanSongSlug || slugify(s.title) === cleanSongSlug) &&
             Array.isArray(s.artists) &&
             s.artists.some((a) => (a.slug || slugify(a.name)) === cleanArtistSlug)
    ) || allSongs.find((s) => s.slug === cleanSongSlug || slugify(s.title) === cleanSongSlug);
  }

  if (!matchedSong) {
    const error = new Error("Bài hát không tồn tại hoặc đã bị ẩn");
    error.status = 404;
    throw error;
  }

  // Security checks:
  if (!matchedSong.isPublic) {
    const error = new Error("Bài hát này hiện ở chế độ riêng tư hoặc chưa được phát hành công khai");
    error.status = 403;
    throw error;
  }

  if (matchedSong.moderation && String(matchedSong.moderation.status).toUpperCase() === "BLOCK") {
    const error = new Error("Bài hát này đã bị tạm dừng phát hành do vi phạm tiêu chuẩn cộng đồng");
    error.status = 403;
    throw error;
  }

  // Fetch related songs
  let relatedSongs = [];
  try {
    const matchedArtistIds = Array.isArray(matchedSong.artists)
      ? matchedSong.artists.map((a) => a?._id || a).filter(Boolean)
      : [];
    const topicIds = Array.isArray(matchedSong.topicIds)
      ? matchedSong.topicIds.map((t) => t?._id || t).filter(Boolean)
      : [];

    const conditions = [];
    if (matchedArtistIds.length > 0) conditions.push({ artists: { $in: matchedArtistIds } });
    if (topicIds.length > 0) conditions.push({ topicIds: { $in: topicIds } });

    const relatedFilter = {
      _id: { $ne: matchedSong._id },
      isPublic: true,
      "moderation.status": { $ne: "BLOCK" },
    };
    if (conditions.length > 0) {
      relatedFilter.$or = conditions;
    }

    relatedSongs = await Song.find(relatedFilter)
      .populate("artists", "name avatar slug")
      .populate("topicIds", "name")
      .sort({ playCount: -1, createdAt: -1 })
      .limit(6)
      .lean();
  } catch (err) {
    console.warn("Failed to fetch related songs for slug:", err.message);
  }

  return { song: matchedSong, relatedSongs };
};


/**
 * Ghi nhận sự kiện chia sẻ bài hát (Share Event Tracking).
 */
const recordShareEvent = async ({ songId, source, medium, campaign, si, userId, ip, userAgent }) => {
  if (!songId || !isObjectIdLike(songId)) return null;

  try {
    const SongShareEvent = require("../models/share-event.model");
    const [event] = await Promise.all([
      SongShareEvent.create({
        songId,
        source: source || "clipboard",
        medium: medium || "share",
        campaign: campaign || "social_sharing",
        si: si || null,
        userId: userId || null,
        ip: ip || null,
        userAgent: userAgent || null,
      }),
      Song.findByIdAndUpdate(songId, { $inc: { shareCount: 1 } }),
    ]);
    return event;
  } catch (err) {
    console.warn("Failed to record song share event:", err.message);
    return null;
  }
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  getSongById,
  getSongBySlug,
  recordShareEvent,
  resolveSongStreamUrl,
  issuePlaybackTicket,
  resolveStreamUrlByTicket,
  registerPlay,
  updatePlayFeedback,
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
  resolveAuthenticatedRole,
};

