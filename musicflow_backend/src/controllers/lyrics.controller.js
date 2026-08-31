const lyricsService = require("../services/lyrics.service");

function handleError(res, error, defaultMsg) {
  const status = error.status || 500;
  return res.status(status).json({
    success: false,
    message: error.message || defaultMsg,
  });
}

/**
 * GET /api/artist/songs/:id/lyrics
 */
exports.getSongLyrics = async (req, res) => {
  try {
    const data = await lyricsService.getSongLyricsForArtist(
      req.params.id,
      req.userId,
      req.userRole
    );
    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    return handleError(res, error, "Không thể tải thông tin lời bài hát");
  }
};

/**
 * PUT /api/artist/songs/:id/lyrics/draft
 */
exports.saveDraftLyrics = async (req, res) => {
  try {
    const result = await lyricsService.saveDraftLyrics(
      req.params.id,
      req.userId,
      req.userRole,
      req.body
    );
    return res.json(result);
  } catch (error) {
    return handleError(res, error, "Không thể lưu bản nháp lời bài hát");
  }
};

/**
 * POST /api/artist/songs/:id/lyrics/publish
 */
exports.publishLyrics = async (req, res) => {
  try {
    const result = await lyricsService.publishLyrics(
      req.params.id,
      req.userId,
      req.userRole,
      req.body
    );
    return res.json(result);
  } catch (error) {
    return handleError(res, error, "Không thể xuất bản lời bài hát");
  }
};

/**
 * POST /api/artist/songs/:id/lyrics/unpublish
 */
exports.unpublishLyrics = async (req, res) => {
  try {
    const result = await lyricsService.unpublishLyrics(
      req.params.id,
      req.userId,
      req.userRole
    );
    return res.json(result);
  } catch (error) {
    return handleError(res, error, "Không thể hủy xuất bản lời bài hát");
  }
};
