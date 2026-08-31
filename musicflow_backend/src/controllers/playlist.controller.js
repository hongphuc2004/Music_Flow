const Playlist = require("../models/playlist.model");
const PlaylistSong = require("../models/playlist-song.model");
const User = require("../models/user.model");
const axios = require("axios");
const cloudinary = require("../config/cloudinary");
const { cloudinaryFolder } = require("../config/cloudinaryFolders");
const fs = require("fs");

const safeUnlink = (filePath) => {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (_) {}
};

// Simple short-term memory cache for Unsplash search
let randomCoversCache = null;
let randomCoversCacheExpiry = 0;
const CACHE_LIFETIME_MS = 5 * 60 * 1000; // 5 minutes

async function triggerUnsplashDownload(photoId) {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey || !photoId || photoId.startsWith("fallback-")) return;

  try {
    // 1. Fetch photo details directly from Unsplash using validated photoId (SSRF safe!)
    const detailsUrl = `https://api.unsplash.com/photos/${photoId}`;
    const detailsResponse = await axios.get(detailsUrl, {
      headers: {
        Authorization: `Client-ID ${accessKey}`,
      },
      timeout: 5000,
    });

    // 2. Extract download_location from trusted Unsplash API response
    const downloadLocation = detailsResponse.data?.links?.download_location;
    if (downloadLocation) {
      // 3. Trigger the verified download_location endpoint
      await axios.get(downloadLocation, {
        headers: {
          Authorization: `Client-ID ${accessKey}`,
        },
        timeout: 5000,
      });
      console.log(`Successfully triggered Unsplash download tracking for photo: ${photoId}`);
    }
  } catch (err) {
    console.warn(`Failed to trigger Unsplash download tracking for photo ${photoId}:`, err.message);
  }
}

const { cache, CACHE_TTL } = require("../utils/cache.util");

const PLAYLIST_SONG_SELECT =
  "title artists topicIds uploadedBy isPublic audioUrl duration imageUrl source allowDownload playCount likeCount createdAt";

// ================= GET SYSTEM PLAYLISTS (public) =================
exports.getSystemPlaylists = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);
    const skip = (page - 1) * limit;
    const filter = { isPublic: true };
    const cacheKey = `system_playlists:${page}:${limit}`;

    const data = await cache.wrap(cacheKey, CACHE_TTL.SYSTEM_PLAYLISTS, async () => {
      const [playlists, total] = await Promise.all([
        PlaylistSong.aggregate([
          { $match: filter },
          { $sort: { createdAt: -1 } },
          { $skip: skip },
          { $limit: limit },
          {
            $project: {
              name: 1,
              description: 1,
              coverImage: 1,
              isPublic: 1,
              createdBy: 1,
              createdAt: 1,
              updatedAt: 1,
              songCount: { $size: { $ifNull: ["$songs", []] } },
            },
          },
        ]),
        PlaylistSong.countDocuments(filter),
      ]);

      return {
        playlists,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    });

    res.json({
      success: true,
      ...data,
    });
  } catch (error) {
    console.error("Get system playlists error:", error);
    res.status(500).json({
      success: false,
      message: "Lấy playlist hệ thống thất bại",
      error: error.message,
    });
  }
};

// ================= GET SINGLE SYSTEM PLAYLIST (public) =================
exports.getSystemPlaylistById = async (req, res) => {
  try {
    const playlist = await PlaylistSong.findById(req.params.id)
      .populate({
        path: "songs",
        match: { isPublic: true },
        select: PLAYLIST_SONG_SELECT,
        populate: { path: "artists", select: "name avatar" },
      })
      .lean();

    if (!playlist || !playlist.isPublic) {
      return res.status(404).json({
        success: false,
        message: "Playlist hệ thống không tồn tại",
      });
    }

    res.json({
      success: true,
      playlist,
    });
  } catch (error) {
    console.error("Get system playlist error:", error);
    res.status(500).json({
      success: false,
      message: "Lấy chi tiết playlist hệ thống thất bại",
      error: error.message,
    });
  }
};

// ================= GET ALL PLAYLISTS (của user hiện tại) =================
exports.getUserPlaylists = async (req, res) => {
  try {
    const playlists = await Playlist.find({ userId: req.userId })
      .populate({ path: "songs", populate: { path: "artists" } })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      playlists,
    });
  } catch (error) {
    console.error("Get playlists error:", error);
    res.status(500).json({
      success: false,
      message: "Lấy danh sách playlist thất bại",
      error: error.message,
    });
  }
};

// ================= GET SINGLE PLAYLIST =================
exports.getPlaylistById = async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id)
      .populate({ path: "songs", populate: { path: "artists" } })
      .populate("userId", "name email");

    if (!playlist) {
      return res.status(404).json({
        success: false,
        message: "Playlist không tồn tại",
      });
    }

    // Kiểm tra quyền truy cập (chỉ chủ sở hữu hoặc playlist public)
    const ownerId = playlist.userId?._id ? playlist.userId._id.toString() : (playlist.userId ? playlist.userId.toString() : null);
    if (ownerId !== req.userId && !playlist.isPublic) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền truy cập playlist này",
      });
    }

    res.json({
      success: true,
      playlist,
    });
  } catch (error) {
    console.error("Get playlist error:", error);
    res.status(500).json({
      success: false,
      message: "Lấy playlist thất bại",
      error: error.message,
    });
  }
};

// ================= CREATE PLAYLIST =================
exports.createPlaylist = async (req, res) => {
  let tempFilePath = null;
  try {
    const { name, description, isPublic, coverImage, coverSource, photoId, photographer, photographerUrl, unsplashUrl } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Tên playlist là bắt buộc",
      });
    }

    let finalCoverImage = coverImage || "";
    let finalCoverSource = "";
    let finalCoverMetadata = {
      photoId: "",
      photographer: "",
      photographerUrl: "",
      unsplashUrl: ""
    };

    if (req.file) {
      // 1. Custom Upload file
      tempFilePath = req.file.path;
      const uploadResult = await cloudinary.uploader.upload(tempFilePath, {
        folder: cloudinaryFolder("playlists"),
      });
      finalCoverImage = uploadResult.secure_url;
      finalCoverSource = "upload";
    } else if (coverSource === "unsplash" && photoId) {
      // 2. Select Unsplash cover
      finalCoverImage = coverImage || "";
      finalCoverSource = "unsplash";
      finalCoverMetadata = {
        photoId: photoId || "",
        photographer: photographer || "",
        photographerUrl: photographerUrl || "",
        unsplashUrl: unsplashUrl || ""
      };

      // Trigger download tracking ngầm (SSRF safe)
      triggerUnsplashDownload(photoId);
    } else {
      // 3. Defaults
      finalCoverImage = coverImage || "";
      finalCoverSource = coverSource || "";
    }

    const playlist = await Playlist.create({
      name,
      description: description || "",
      userId: req.userId,
      isPublic: isPublic === "true" || isPublic === true,
      coverImage: finalCoverImage,
      coverSource: finalCoverSource,
      coverMetadata: finalCoverMetadata,
      songs: [],
    });

    // Thêm playlist ID vào user
    await User.findByIdAndUpdate(req.userId, {
      $push: { playlists: playlist._id },
    });

    res.status(201).json({
      success: true,
      message: "Tạo playlist thành công",
      playlist,
    });
  } catch (error) {
    console.error("Create playlist error:", error);
    res.status(500).json({
      success: false,
      message: "Tạo playlist thất bại",
      error: error.message,
    });
  } finally {
    if (tempFilePath) safeUnlink(tempFilePath);
  }
};

// ================= UPDATE PLAYLIST (tên, mô tả, ảnh bìa, public/private) =================
exports.updatePlaylist = async (req, res) => {
  let tempFilePath = null;
  try {
    const { name, description, isPublic, coverImage, coverSource, photoId, photographer, photographerUrl, unsplashUrl } = req.body;

    const playlist = await Playlist.findById(req.params.id);

    if (!playlist) {
      return res.status(404).json({
        success: false,
        message: "Playlist không tồn tại",
      });
    }

    // Kiểm tra quyền sở hữu
    if (playlist.userId.toString() !== req.userId && playlist.userId._id?.toString() !== req.userId) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền sửa bài hát trong playlist này",
      });
    }

    // Cập nhật các trường được gửi lên
    if (name !== undefined) playlist.name = name;
    if (description !== undefined) playlist.description = description;
    if (isPublic !== undefined) {
      playlist.isPublic = isPublic === "true" || isPublic === true;
    }

    if (req.file) {
      // 1. Upload local file
      tempFilePath = req.file.path;
      const uploadResult = await cloudinary.uploader.upload(tempFilePath, {
        folder: cloudinaryFolder("playlists"),
      });
      playlist.coverImage = uploadResult.secure_url;
      playlist.coverSource = "upload";
      
      // Xóa hoàn toàn metadata Unsplash cũ khi đổi nguồn
      playlist.coverMetadata = {
        photoId: "",
        photographer: "",
        photographerUrl: "",
        unsplashUrl: ""
      };
    } else if (coverSource === "unsplash" && photoId) {
      // 2. Select Unsplash cover
      playlist.coverImage = coverImage || "";
      playlist.coverSource = "unsplash";
      playlist.coverMetadata = {
        photoId: photoId || "",
        photographer: photographer || "",
        photographerUrl: photographerUrl || "",
        unsplashUrl: unsplashUrl || ""
      };

      // Trigger download tracking ngầm (SSRF safe)
      triggerUnsplashDownload(photoId);
    } else if (coverSource === "") {
      // 3. Clear cover or resets
      if (coverImage !== undefined) playlist.coverImage = coverImage;
      playlist.coverSource = "";
      playlist.coverMetadata = {
        photoId: "",
        photographer: "",
        photographerUrl: "",
        unsplashUrl: ""
      };
    } else {
      // 4. Legacy compatibility: if client didn't send coverSource, preserve existing source/metadata
      if (coverImage !== undefined) {
        playlist.coverImage = coverImage;
      }
    }

    await playlist.save();
    await playlist.populate({ path: "songs", populate: { path: "artists" } });

    res.json({
      success: true,
      message: "Cập nhật playlist thành công",
      playlist,
    });
  } catch (error) {
    console.error("Update playlist error:", error);
    res.status(500).json({
      success: false,
      message: "Cập nhật playlist thất bại",
      error: error.message,
    });
  } finally {
    if (tempFilePath) safeUnlink(tempFilePath);
  }
};

// ================= DELETE PLAYLIST =================
exports.deletePlaylist = async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id);

    if (!playlist) {
      return res.status(404).json({
        success: false,
        message: "Playlist không tồn tại",
      });
    }

    // Kiểm tra quyền sở hữu
    if (playlist.userId.toString() !== req.userId && playlist.userId._id?.toString() !== req.userId) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền xóa playlist này",
      });
    }

    // Xóa playlist ID khỏi user
    await User.findByIdAndUpdate(req.userId, {
      $pull: { playlists: playlist._id },
    });

    await Playlist.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: "Xóa playlist thành công",
    });
  } catch (error) {
    console.error("Delete playlist error:", error);
    res.status(500).json({
      success: false,
      message: "Xóa playlist thất bại",
      error: error.message,
    });
  }
};

// ================= ADD SONG TO PLAYLIST =================
exports.addSongToPlaylist = async (req, res) => {
  try {
    const { songId } = req.body;

    if (!songId) {
      return res.status(400).json({
        success: false,
        message: "Song ID là bắt buộc",
      });
    }

    const playlist = await Playlist.findById(req.params.id);

    if (!playlist) {
      return res.status(404).json({
        success: false,
        message: "Playlist không tồn tại",
      });
    }

    // Kiểm tra quyền sở hữu
    if (playlist.userId.toString() !== req.userId && playlist.userId._id.toString() !== req.userId) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền thêm bài hát vào playlist này",
      });
    }

    // Kiểm tra bài hát đã có trong playlist chưa
    if (playlist.songs.includes(songId)) {
      return res.status(400).json({
        success: false,
        message: "Bài hát đã có trong playlist",
      });
    }

    playlist.songs.push(songId);
    await playlist.save();
    await playlist.populate({ path: "songs", populate: { path: "artists" } });

    res.json({
      success: true,
      message: "Thêm bài hát vào playlist thành công",
      playlist,
    });
  } catch (error) {
    console.error("Add song to playlist error:", error);
    res.status(500).json({
      success: false,
      message: "Thêm bài hát thất bại",
      error: error.message,
    });
  }
};

// ================= REMOVE SONG FROM PLAYLIST =================
exports.removeSongFromPlaylist = async (req, res) => {
  try {
    const { id, songId } = req.params;

    const playlist = await Playlist.findById(id);

    if (!playlist) {
      return res.status(404).json({
        success: false,
        message: "Playlist không tồn tại",
      });
    }

    // Kiểm tra quyền sở hữu
    if (playlist.userId.toString() !== req.userId && playlist.userId._id?.toString() !== req.userId) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền xóa bài hát khỏi playlist này",
      });
    }

    // Xóa bài hát khỏi playlist
    playlist.songs = playlist.songs.filter(
      (id) => id.toString() !== songId
    );
    await playlist.save();
    await playlist.populate({ path: "songs", populate: { path: "artists" } });

    res.json({
      success: true,
      message: "Xóa bài hát khỏi playlist thành công",
      playlist,
    });
  } catch (error) {
    console.error("Remove song from playlist error:", error);
    res.status(500).json({
      success: false,
      message: "Xóa bài hát thất bại",
      error: error.message,
    });
  }
};

// ================= REORDER SONGS IN PLAYLIST =================
exports.reorderPlaylistSongs = async (req, res) => {
  try {
    const { songIds } = req.body;

    if (!songIds || !Array.isArray(songIds)) {
      return res.status(400).json({
        success: false,
        message: "Danh sách songIds là bắt buộc",
      });
    }

    const playlist = await Playlist.findById(req.params.id);

    if (!playlist) {
      return res.status(404).json({
        success: false,
        message: "Playlist không tồn tại",
      });
    }

    // Kiểm tra quyền sở hữu
    if (playlist.userId.toString() !== req.userId && playlist.userId._id?.toString() !== req.userId) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền sắp xếp lại playlist này",
      });
    }

    playlist.songs = songIds;
    await playlist.save();
    await playlist.populate({ path: "songs", populate: { path: "artists" } });

    res.json({
      success: true,
      message: "Sắp xếp lại playlist thành công",
      playlist,
    });
  } catch (error) {
    console.error("Reorder playlist error:", error);
    res.status(500).json({
      success: false,
      message: "Sắp xếp lại thất bại",
      error: error.message,
    });
  }
};

// ================= GET RANDOM COVERS FOR PRESETS (Unsplash API) =================
exports.getRandomCovers = async (req, res) => {
  const now = Date.now();
  if (randomCoversCache && now < randomCoversCacheExpiry) {
    return res.json({
      success: true,
      covers: randomCoversCache,
    });
  }

  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) {
    console.warn("Missing UNSPLASH_ACCESS_KEY env variable. Using fallback covers.");
    return res.json({
      success: true,
      covers: getLocalFallbackCovers(),
    });
  }

  try {
    const queries = ["music", "concert", "singer", "retro", "synthwave", "lofi", "ambient", "pop", "jazz", "acoustic"];
    const randomQuery = queries[Math.floor(Math.random() * queries.length)];
    const randomPage = Math.floor(Math.random() * 5) + 1;

    const url = `https://api.unsplash.com/search/photos?query=${randomQuery}&per_page=12&page=${randomPage}`;
    const response = await axios.get(url, {
      headers: {
        Authorization: `Client-ID ${accessKey}`,
      },
      timeout: 5000,
    });

    if (response.data && Array.isArray(response.data.results)) {
      const results = response.data.results;
      const covers = results.map(item => ({
        id: item.id || "",
        thumbnailUrl: item.urls?.small || "",
        coverUrl: item.urls?.regular || "",
        photographer: item.user?.name || "Photographer",
        photographerUrl: item.user?.links?.html || "",
        unsplashUrl: item.links?.html || "",
      })).filter(c => c.thumbnailUrl && c.coverUrl);

      // Cache the result
      randomCoversCache = covers;
      randomCoversCacheExpiry = now + CACHE_LIFETIME_MS;

      return res.json({
        success: true,
        covers,
      });
    }
    
    throw new Error("Invalid Unsplash response format");
  } catch (error) {
    console.error("Get random covers from Unsplash failed:", error.message);
    return res.json({
      success: true,
      covers: getLocalFallbackCovers(),
    });
  }
};

function getLocalFallbackCovers() {
  return [
    {
      id: "fallback-1",
      thumbnailUrl: "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=400&auto=format&fit=crop&q=80",
      coverUrl: "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=800&auto=format&fit=crop&q=80",
      photographer: "Marc-Olivier Jodoin",
      photographerUrl: "https://unsplash.com/@marcojodoin",
      unsplashUrl: "https://unsplash.com/photos/NqOsy5m8uug",
    },
    {
      id: "fallback-2",
      thumbnailUrl: "https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=400&auto=format&fit=crop&q=80",
      coverUrl: "https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=800&auto=format&fit=crop&q=80",
      photographer: "Jens The缺失",
      photographerUrl: "https://unsplash.com/@jensthe缺失",
      unsplashUrl: "https://unsplash.com/photos/d-m4r2W5tMc",
    },
    {
      id: "fallback-3",
      thumbnailUrl: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=400&auto=format&fit=crop&q=80",
      coverUrl: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=800&auto=format&fit=crop&q=80",
      photographer: "Allexxandar",
      photographerUrl: "https://unsplash.com/@allexxandar",
      unsplashUrl: "https://unsplash.com/photos/some-id",
    },
    {
      id: "fallback-4",
      thumbnailUrl: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&auto=format&fit=crop&q=80",
      coverUrl: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&auto=format&fit=crop&q=80",
      photographer: "Sven Brandsma",
      photographerUrl: "https://unsplash.com/@svenbrandsma",
      unsplashUrl: "https://unsplash.com/photos/G15-C8yJ_rA",
    },
    {
      id: "fallback-5",
      thumbnailUrl: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&auto=format&fit=crop&q=80",
      coverUrl: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&auto=format&fit=crop&q=80",
      photographer: "Sunset Rock",
      photographerUrl: "https://unsplash.com",
      unsplashUrl: "https://unsplash.com",
    },
    {
      id: "fallback-6",
      thumbnailUrl: "https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&auto=format&fit=crop&q=80",
      coverUrl: "https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=800&auto=format&fit=crop&q=80",
      photographer: "Studio Session",
      photographerUrl: "https://unsplash.com",
      unsplashUrl: "https://unsplash.com",
    },
    {
      id: "fallback-7",
      thumbnailUrl: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&auto=format&fit=crop&q=80",
      coverUrl: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&auto=format&fit=crop&q=80",
      photographer: "Singing Artist",
      photographerUrl: "https://unsplash.com",
      unsplashUrl: "https://unsplash.com",
    },
    {
      id: "fallback-8",
      thumbnailUrl: "https://images.unsplash.com/photo-1458560871784-56d23406c091?w=400&auto=format&fit=crop&q=80",
      coverUrl: "https://images.unsplash.com/photo-1458560871784-56d23406c091?w=800&auto=format&fit=crop&q=80",
      photographer: "Record Player",
      photographerUrl: "https://unsplash.com",
      unsplashUrl: "https://unsplash.com",
    },
    {
      id: "fallback-9",
      thumbnailUrl: "https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=400&auto=format&fit=crop&q=80",
      coverUrl: "https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=800&auto=format&fit=crop&q=80",
      photographer: "Neon Stage",
      photographerUrl: "https://unsplash.com",
      unsplashUrl: "https://unsplash.com",
    },
    {
      id: "fallback-10",
      thumbnailUrl: "https://images.unsplash.com/photo-1494232410401-ad00d5433cfa?w=400&auto=format&fit=crop&q=80",
      coverUrl: "https://images.unsplash.com/photo-1494232410401-ad00d5433cfa?w=800&auto=format&fit=crop&q=80",
      photographer: "Cassette Retro",
      photographerUrl: "https://unsplash.com",
      unsplashUrl: "https://unsplash.com",
    }
  ];
}
