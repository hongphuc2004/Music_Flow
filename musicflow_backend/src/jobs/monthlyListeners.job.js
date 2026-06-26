const Artist = require("../models/artist.model");
const Song = require("../models/song.model");
const SongPlayEvent = require("../models/song-play-event.model");

async function updateAllArtistsMonthlyListeners() {
  try {
    const start = Date.now();
    console.log("[Job] Bat dau cap nhat luot nghe hang thang (monthly listeners)...");

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // 1. Nhom toan bo luot nghe trong 30 ngay qua theo songId
    const playCounts = await SongPlayEvent.aggregate([
      { $match: { playedAt: { $gte: thirtyDaysAgo } } },
      { $group: { _id: "$songId", count: { $sum: 1 } } }
    ]);

    console.log(`[Job] Da tim thay ${playCounts.length} bai hat co luot nghe trong 30 ngay.`);

    // Map songId -> count
    const songPlayMap = new Map(
      playCounts.map((item) => [item._id.toString(), item.count])
    );

    // 2. Lay toan bo bai hat dang hoat dong cung danh sach nghe si lien quan
    const songs = await Song.find({ isPublic: true })
      .select("_id artists")
      .lean();

    // 3. Cong don so luot nghe cho tung nghe si
    const artistCountMap = {};
    for (const song of songs) {
      const songIdStr = song._id.toString();
      const count = songPlayMap.get(songIdStr) || 0;

      if (count > 0 && Array.isArray(song.artists)) {
        for (const artistId of song.artists) {
          if (artistId) {
            const aIdStr = artistId.toString();
            artistCountMap[aIdStr] = (artistCountMap[aIdStr] || 0) + count;
          }
        }
      }
    }

    // 4. Chuan bi bulk update cho toan bo nghe si trong database
    const allArtists = await Artist.find({}).select("_id").lean();
    const bulkOps = [];

    for (const artist of allArtists) {
      const aIdStr = artist._id.toString();
      const count = artistCountMap[aIdStr] || 0;

      bulkOps.push({
        updateOne: {
          filter: { _id: artist._id },
          update: { $set: { monthlyListeners: count } },
        },
      });
    }

    if (bulkOps.length > 0) {
      const result = await Artist.bulkWrite(bulkOps, { ordered: false });
      console.log(
        `[Job] Hoan thanh bulkWrite cap nhat nghe si: matched=${result.matchedCount}, modified=${result.modifiedCount}`
      );
    }

    console.log(
      `[Job] Cap nhat monthly listeners hoan tat trong ${Date.now() - start}ms.`
    );
  } catch (error) {
    console.error("[Job] Loi cap nhat monthly listeners:", error);
  }
}

function startMonthlyListenersJob() {
  // Chay ngay lap tuc khi khoi dong server
  updateAllArtistsMonthlyListeners();

  // Dat lich chay dinh ky moi 24 gio (86400000 ms)
  const INTERVAL_24H = 24 * 60 * 60 * 1000;
  setInterval(() => {
    updateAllArtistsMonthlyListeners();
  }, INTERVAL_24H);

  console.log("[Job] Da lap lich chay Job Monthly Listeners (Chu ky 24 gio).");
}

module.exports = {
  updateAllArtistsMonthlyListeners,
  startMonthlyListenersJob,
};
