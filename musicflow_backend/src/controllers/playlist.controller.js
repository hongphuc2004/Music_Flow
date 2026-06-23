const Playlist = require("../models/playlist.model");
const PlaylistSong = require("../models/playlist-song.model");
const User = require("../models/user.model");

const PLAYLIST_SONG_SELECT =
  "title artists topicIds uploadedBy isPublic audioUrl duration imageUrl source allowDownload playCount likeCount createdAt";

// ================= GET SYSTEM PLAYLISTS (public) =================
exports.getSystemPlaylists = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);
    const skip = (page - 1) * limit;
    const filter = { isPublic: true };

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

    res.json({
      success: true,
      playlists,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
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
    if (playlist.userId._id.toString() !== req.userId && !playlist.isPublic) {
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
  try {
    const { name, description, isPublic, coverImage } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Tên playlist là bắt buộc",
      });
    }

    const playlist = await Playlist.create({
      name,
      description: description || "",
      userId: req.userId,
      isPublic: isPublic || false,
      coverImage: coverImage || "",
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
  }
};

// ================= UPDATE PLAYLIST (tên, mô tả, ảnh bìa, public/private) =================
exports.updatePlaylist = async (req, res) => {
  try {
    const { name, description, isPublic, coverImage } = req.body;

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
    if (isPublic !== undefined) playlist.isPublic = isPublic;
    if (coverImage !== undefined) playlist.coverImage = coverImage;

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
