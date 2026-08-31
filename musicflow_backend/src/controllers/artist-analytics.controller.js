const artistAnalyticsService = require("../services/artist-analytics.service");

function handleError(res, error, defaultMsg) {
  const status = error.status || 500;
  return res.status(status).json({
    success: false,
    message: error.message || defaultMsg,
  });
}

/**
 * GET /api/artist/analytics/summary
 */
exports.getSummary = async (req, res) => {
  try {
    const { timeRange = "30d" } = req.query;
    const data = await artistAnalyticsService.getSummary(req.userId, timeRange);
    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    return handleError(res, error, "Không thể tải tổng quan phân tích nghệ sĩ");
  }
};

/**
 * GET /api/artist/analytics/timeseries
 */
exports.getTimeseries = async (req, res) => {
  try {
    const { timeRange = "30d", interval = "daily" } = req.query;
    const data = await artistAnalyticsService.getTimeseries(
      req.userId,
      timeRange,
      interval
    );
    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    return handleError(res, error, "Không thể tải biểu đồ chuỗi thời gian");
  }
};

/**
 * GET /api/artist/analytics/top-songs
 */
exports.getTopSongs = async (req, res) => {
  try {
    const data = await artistAnalyticsService.getTopSongs(req.userId, req.query);
    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    return handleError(res, error, "Không thể tải bảng xếp hạng bài hát");
  }
};

/**
 * GET /api/artist/analytics/discovery-sources
 */
exports.getDiscoverySources = async (req, res) => {
  try {
    const { timeRange = "30d" } = req.query;
    const data = await artistAnalyticsService.getDiscoverySources(
      req.userId,
      timeRange
    );
    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    return handleError(res, error, "Không thể tải nguồn khám phá âm nhạc");
  }
};
