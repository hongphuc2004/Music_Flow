const mongoose = require("mongoose");
const Song = require("../models/song.model");
const SongPlayEvent = require("../models/song-play-event.model");
const SongLike = require("../models/song-like.model");
const Favorite = require("../models/favorite.model");
const PlaylistSong = require("../models/playlist-song.model");
const User = require("../models/user.model");

/**
 * Calculate Date Ranges for Current Period (T) and Previous Period (T-1)
 */
function getDateRanges(timeRange = "30d") {
  const now = new Date();
  let days = 30;

  if (timeRange === "7d") days = 7;
  else if (timeRange === "30d") days = 30;
  else if (timeRange === "90d") days = 90;
  else if (timeRange === "year") days = 365;

  const currentEnd = new Date(now);
  const currentStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const prevEnd = new Date(currentStart.getTime() - 1);
  const prevStart = new Date(currentStart.getTime() - days * 24 * 60 * 60 * 1000);

  return { currentStart, currentEnd, prevStart, prevEnd, days };
}

/**
 * Calculate Growth % with Strict Edge Case Rules
 */
function calculateGrowth(current = 0, previous = 0) {
  const curr = Number(current) || 0;
  const prev = Number(previous) || 0;

  if (prev === 0 && curr > 0) {
    return { value: null, status: "new", label: "Mới" };
  }
  if (prev === 0 && curr === 0) {
    return { value: 0, status: "no_change", label: "0%" };
  }
  if (curr === 0 && prev > 0) {
    return { value: -100, status: "down", label: "-100%" };
  }

  const rate = ((curr - prev) / prev) * 100;
  const rounded = Number(rate.toFixed(1));
  if (rounded > 0) {
    return { value: rounded, status: "up", label: `+${rounded}%` };
  }
  if (rounded < 0) {
    return { value: rounded, status: "down", label: `${rounded}%` };
  }
  return { value: 0, status: "no_change", label: "0%" };
}

/**
 * 1. Get Summary KPIs with Growth Comparison
 */
async function getSummary(artistId, timeRange = "30d") {
  const artistObjectId = new mongoose.Types.ObjectId(artistId);
  const { currentStart, currentEnd, prevStart, prevEnd } = getDateRanges(timeRange);

  // Get all song IDs of this artist
  const artistSongs = await Song.find({
    $or: [{ artists: artistObjectId }, { uploadedBy: artistObjectId }],
  }).select("_id");
  const songIds = artistSongs.map((s) => s._id);

  // A. Plays & Unique Listeners (Current Period vs Previous Period)
  const [currentPlayMetrics] = await SongPlayEvent.aggregate([
    {
      $match: {
        $or: [{ artistIds: artistObjectId }, { songId: { $in: songIds } }],
        playedAt: { $gte: currentStart, $lte: currentEnd },
      },
    },
    {
      $group: {
        _id: null,
        totalPlays: { $sum: 1 },
        uniqueUsers: { $addToSet: { $ifNull: ["$userId", "$anonymousKey"] } },
      },
    },
    {
      $project: {
        totalPlays: 1,
        uniqueListeners: { $size: "$uniqueUsers" },
      },
    },
  ]);

  const [prevPlayMetrics] = await SongPlayEvent.aggregate([
    {
      $match: {
        $or: [{ artistIds: artistObjectId }, { songId: { $in: songIds } }],
        playedAt: { $gte: prevStart, $lte: prevEnd },
      },
    },
    {
      $group: {
        _id: null,
        totalPlays: { $sum: 1 },
        uniqueUsers: { $addToSet: { $ifNull: ["$userId", "$anonymousKey"] } },
      },
    },
    {
      $project: {
        totalPlays: 1,
        uniqueListeners: { $size: "$uniqueUsers" },
      },
    },
  ]);

  const currPlays = currentPlayMetrics?.totalPlays || 0;
  const prevPlays = prevPlayMetrics?.totalPlays || 0;
  const currListeners = currentPlayMetrics?.uniqueListeners || 0;
  const prevListeners = prevPlayMetrics?.uniqueListeners || 0;

  // B. Likes
  const [currLikes, prevLikes] = await Promise.all([
    SongLike.countDocuments({
      songId: { $in: songIds },
      createdAt: { $gte: currentStart, $lte: currentEnd },
    }),
    SongLike.countDocuments({
      songId: { $in: songIds },
      createdAt: { $gte: prevStart, $lte: prevEnd },
    }),
  ]);

  // C. Saves (Favorites + Playlist adds)
  const [currFavs, prevFavs, currPlaylists, prevPlaylists] = await Promise.all([
    Favorite.countDocuments({
      songId: { $in: songIds },
      createdAt: { $gte: currentStart, $lte: currentEnd },
    }),
    Favorite.countDocuments({
      songId: { $in: songIds },
      createdAt: { $gte: prevStart, $lte: prevEnd },
    }),
    PlaylistSong.countDocuments({
      songId: { $in: songIds },
      createdAt: { $gte: currentStart, $lte: currentEnd },
    }),
    PlaylistSong.countDocuments({
      songId: { $in: songIds },
      createdAt: { $gte: prevStart, $lte: prevEnd },
    }),
  ]);

  const currSaves = currFavs + currPlaylists;
  const prevSaves = prevFavs + prevPlaylists;

  // D. Followers (Current snapshot)
  const currentFollowers = await User.countDocuments({ followedArtists: artistObjectId });

  // E. Catalog Snapshot
  const totalCatalogSongs = await Song.countDocuments({
    $or: [{ artists: artistObjectId }, { uploadedBy: artistObjectId }],
    isPublic: true,
  });

  const latestSong = await Song.findOne({
    $or: [{ artists: artistObjectId }, { uploadedBy: artistObjectId }],
    isPublic: true,
  })
    .sort({ createdAt: -1 })
    .select("createdAt");

  // Conversion Rates
  const likeRate = currPlays > 0 ? Number(((currLikes / currPlays) * 100).toFixed(1)) : null;
  const saveRate = currPlays > 0 ? Number(((currSaves / currPlays) * 100).toFixed(1)) : null;

  return {
    timeRange,
    kpis: {
      totalPlays: {
        current: currPlays,
        previous: prevPlays,
        growth: calculateGrowth(currPlays, prevPlays),
      },
      uniqueListeners: {
        current: currListeners,
        previous: prevListeners,
        growth: calculateGrowth(currListeners, prevListeners),
      },
      likes: {
        current: currLikes,
        previous: prevLikes,
        rate: likeRate,
        growth: calculateGrowth(currLikes, prevLikes),
      },
      saves: {
        current: currSaves,
        previous: prevSaves,
        rate: saveRate,
        growth: calculateGrowth(currSaves, prevSaves),
      },
      followers: {
        current: currentFollowers,
        growth: null, // Historical follower snapshot not available prior to event log
      },
      catalog: {
        totalSongs: totalCatalogSongs,
        latestReleaseDate: latestSong?.createdAt || null,
      },
    },
  };
}

/**
 * 2. Get Time-series Aggregation (Daily, Weekly, Monthly)
 */
async function getTimeseries(artistId, timeRange = "30d", interval = "daily") {
  const artistObjectId = new mongoose.Types.ObjectId(artistId);
  const { currentStart, currentEnd } = getDateRanges(timeRange);

  const artistSongs = await Song.find({
    $or: [{ artists: artistObjectId }, { uploadedBy: artistObjectId }],
  }).select("_id");
  const songIds = artistSongs.map((s) => s._id);

  let dateFormat = "%Y-%m-%d";
  if (interval === "weekly") dateFormat = "%Y-W%V";
  else if (interval === "monthly") dateFormat = "%Y-%m";

  const rawPlays = await SongPlayEvent.aggregate([
    {
      $match: {
        $or: [{ artistIds: artistObjectId }, { songId: { $in: songIds } }],
        playedAt: { $gte: currentStart, $lte: currentEnd },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: dateFormat, date: "$playedAt" } },
        plays: { $sum: 1 },
        uniqueUsers: { $addToSet: { $ifNull: ["$userId", "$anonymousKey"] } },
      },
    },
    {
      $project: {
        date: "$_id",
        plays: 1,
        listeners: { $size: "$uniqueUsers" },
      },
    },
    { $sort: { date: 1 } },
  ]);

  const rawLikes = await SongLike.aggregate([
    {
      $match: {
        songId: { $in: songIds },
        createdAt: { $gte: currentStart, $lte: currentEnd },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: dateFormat, date: "$createdAt" } },
        likes: { $sum: 1 },
      },
    },
  ]);

  const likesMap = new Map();
  rawLikes.forEach((l) => likesMap.set(l._id, l.likes));

  const result = rawPlays.map((item) => ({
    date: item.date,
    plays: item.plays || 0,
    listeners: item.listeners || 0,
    likes: likesMap.get(item.date) || 0,
  }));

  return {
    interval,
    timeRange,
    data: result,
  };
}

/**
 * 3. Get Top Songs with Multi-Metric Sort & Growth
 */
async function getTopSongs(artistId, options = {}) {
  const {
    timeRange = "30d",
    sortBy = "plays",
    order = "desc",
    page = 1,
    limit = 20,
  } = options;

  const artistObjectId = new mongoose.Types.ObjectId(artistId);
  const { currentStart, currentEnd, prevStart, prevEnd } = getDateRanges(timeRange);

  const songs = await Song.find({
    $or: [{ artists: artistObjectId }, { uploadedBy: artistObjectId }],
  }).select("_id title imageUrl duration createdAt playCount likeCount");

  const songIds = songs.map((s) => s._id);
  if (songIds.length === 0) {
    return { songs: [], total: 0, page: Number(page), limit: Number(limit) };
  }

  // Aggregate current period metrics per song
  const currAgg = await SongPlayEvent.aggregate([
    {
      $match: {
        songId: { $in: songIds },
        playedAt: { $gte: currentStart, $lte: currentEnd },
      },
    },
    {
      $group: {
        _id: "$songId",
        plays: { $sum: 1 },
        uniqueUsers: { $addToSet: { $ifNull: ["$userId", "$anonymousKey"] } },
      },
    },
  ]);

  const prevAgg = await SongPlayEvent.aggregate([
    {
      $match: {
        songId: { $in: songIds },
        playedAt: { $gte: prevStart, $lte: prevEnd },
      },
    },
    {
      $group: {
        _id: "$songId",
        plays: { $sum: 1 },
      },
    },
  ]);

  const currLikesAgg = await SongLike.aggregate([
    {
      $match: {
        songId: { $in: songIds },
        createdAt: { $gte: currentStart, $lte: currentEnd },
      },
    },
    {
      $group: {
        _id: "$songId",
        likes: { $sum: 1 },
      },
    },
  ]);

  const currSavesAgg = await Favorite.aggregate([
    {
      $match: {
        songId: { $in: songIds },
        createdAt: { $gte: currentStart, $lte: currentEnd },
      },
    },
    {
      $group: {
        _id: "$songId",
        saves: { $sum: 1 },
      },
    },
  ]);

  const currMap = new Map();
  currAgg.forEach((a) => currMap.set(a._id.toString(), { plays: a.plays, listeners: a.uniqueUsers.length }));

  const prevMap = new Map();
  prevAgg.forEach((a) => prevMap.set(a._id.toString(), a.plays));

  const likesMap = new Map();
  currLikesAgg.forEach((a) => likesMap.set(a._id.toString(), a.likes));

  const savesMap = new Map();
  currSavesAgg.forEach((a) => savesMap.set(a._id.toString(), a.saves));

  const enriched = songs.map((s) => {
    const sId = s._id.toString();
    const currData = currMap.get(sId) || { plays: 0, listeners: 0 };
    const prevPlays = prevMap.get(sId) || 0;
    const likes = likesMap.get(sId) || 0;
    const saves = savesMap.get(sId) || 0;

    return {
      _id: s._id,
      title: s.title,
      imageUrl: s.imageUrl,
      duration: s.duration,
      releaseDate: s.createdAt,
      totalAllTimePlays: s.playCount || 0,
      totalAllTimeLikes: s.likeCount || 0,
      plays: currData.plays,
      uniqueListeners: currData.listeners,
      likes,
      saves,
      growth: calculateGrowth(currData.plays, prevPlays),
    };
  });

  // Sorting
  enriched.sort((a, b) => {
    let valA = a[sortBy] ?? 0;
    let valB = b[sortBy] ?? 0;
    if (sortBy === "growth") {
      valA = a.growth.value ?? -999;
      valB = b.growth.value ?? -999;
    }
    return order === "asc" ? valA - valB : valB - valA;
  });

  // Pagination & Rank
  const total = enriched.length;
  const skip = (page - 1) * limit;
  const paginated = enriched.slice(skip, skip + Number(limit)).map((item, idx) => ({
    ...item,
    rank: skip + idx + 1,
  }));

  return {
    songs: paginated,
    total,
    page: Number(page),
    limit: Number(limit),
  };
}

/**
 * 4. Get Discovery / Traffic Sources (No Fake Data)
 */
async function getDiscoverySources(artistId, timeRange = "30d") {
  const artistObjectId = new mongoose.Types.ObjectId(artistId);
  const { currentStart, currentEnd } = getDateRanges(timeRange);

  const artistSongs = await Song.find({
    $or: [{ artists: artistObjectId }, { uploadedBy: artistObjectId }],
  }).select("_id");
  const songIds = artistSongs.map((s) => s._id);

  const rawSources = await SongPlayEvent.aggregate([
    {
      $match: {
        $or: [{ artistIds: artistObjectId }, { songId: { $in: songIds } }],
        playedAt: { $gte: currentStart, $lte: currentEnd },
        source: { $ne: null },
      },
    },
    {
      $group: {
        _id: "$source",
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
  ]);

  const totalSourceEvents = rawSources.reduce((acc, cur) => acc + cur.count, 0);

  if (totalSourceEvents === 0) {
    return {
      hasEnoughData: false,
      sources: [],
      message: "Chưa đủ dữ liệu nguồn phát trong khoảng thời gian này.",
    };
  }

  const labelMap = {
    search: "Tìm kiếm bài hát (Search)",
    home_recommendation: "Gợi ý trang chủ (Home Discovery)",
    playlist: "Danh sách phát (Playlists)",
    artist_profile: "Trang cá nhân nghệ sĩ (Artist Profile)",
    ai_dj: "AI DJ Mood Music",
    ranking: "Bảng xếp hạng (Rankings)",
    other: "Nguồn khác",
  };

  const sources = rawSources.map((item) => ({
    key: item._id,
    label: labelMap[item._id] || item._id,
    count: item.count,
    percentage: Number(((item.count / totalSourceEvents) * 100).toFixed(1)),
  }));

  return {
    hasEnoughData: true,
    totalPlaysRecorded: totalSourceEvents,
    sources,
  };
}

module.exports = {
  getSummary,
  getTimeseries,
  getTopSongs,
  getDiscoverySources,
};
