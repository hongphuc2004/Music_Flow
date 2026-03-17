const Song = require("../models/song.model");

exports.downloadSong = async (req, res) => {
  try {
    const { songId } = req.params;

    const song = await Song.findById(songId).select(
      "_id title source allowDownload audioUrl"
    );

    if (!song) {
      return res.status(404).json({
        success: false,
        message: "Khong tim thay bai hat",
      });
    }

    if (song.source === "user" || song.allowDownload === false) {
      return res.status(403).json({
        success: false,
        message: "Bai hat nay khong duoc phep tai xuong",
      });
    }

    return res.status(200).json({
      success: true,
      songId: song._id,
      title: song.title,
      audioUrl: song.audioUrl,
    });
  } catch (error) {
    console.error("Download song error:", error);
    return res.status(500).json({
      success: false,
      message: "Khong the xu ly yeu cau tai bai hat",
      error: error.message,
    });
  }
};
