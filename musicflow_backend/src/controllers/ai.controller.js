const Song = require("../models/song.model");
const Topic = require("../models/topic.model");

// ─── Mood → Topic mapping table ─────────────────────────────────────────────────
const MOOD_TOPIC_MAP = {
  sad: {
    topics: ["Sad", "Lofi", "Piano", "Chill"],
    keywords: ["buồn", "sad", "nhớ", "cô đơn", "tâm trạng", "sâu lắng", "nước mắt", "chia tay", "mất mát"],
  },
  happy: {
    topics: ["Pop", "EDM", "Party"],
    keywords: ["vui", "happy", "hạnh phúc", "yêu đời", "tươi sáng", "sôi động", "dance",],
  },
  chill: {
    topics: ["Chill", "Lofi", "Piano"],
    keywords: ["chill", "thư giãn", "relax", "nhẹ nhàng", "bình yên", "café", "acoustic"],
  },
  energetic: {
    topics: ["EDM", "Rock", "Party", "WorkOut", "Hip Hop & Rap"],
    keywords: ["năng lượng", "energetic", "sôi động", "mạnh mẽ", "bùng nổ", "power", "hype"],
  },
  romantic: {
    topics: ["Pop", "Piano", "Chill"],
    keywords: ["tình yêu", "romantic", "lãng mạn", "yêu", "nhớ nhung", "ngọt ngào", "love"],
  },
  focus: {
    topics: ["Study", "Lofi", "Piano", "Chill"],
    keywords: ["tập trung", "focus", "học bài", "study", "làm việc", "work", "productive"],
  },
  sleep: {
    topics: ["Sleep", "Piano", "Lofi", "Chill"],
    keywords: ["ngủ", "sleep", "ru ngủ", "đêm", "yên tĩnh", "lullaby", "calm", "giấc ngủ"],
  },
  angry: {
    topics: ["Rock", "Hip Hop & Rap", "EDM"],
    keywords: ["tức giận", "angry", "bực", "rock", "metal", "rage", "aggressive"],
  },
  nostalgic: {
    topics: ["Pop", "Sad", "Piano", "Chill"],
    keywords: ["nhớ", "nostalgic", "kỷ niệm", "ngày xưa", "hoài niệm", "quá khứ", "tuổi thơ"],
  },
  party: {
    topics: ["Party", "EDM", "Pop", "Hip Hop & Rap"],
    keywords: ["party", "tiệc", "vũ trường", "dance", "DJ", "club", "remix", "bass"],
  },
  workout: {
    topics: ["WorkOut", "EDM", "Rock", "Hip Hop & Rap"],
    keywords: ["tập gym", "workout", "chạy bộ", "running", "gym", "exercise", "pump", "motivation"],
  },
  lofi: {
    topics: ["Lofi", "Chill", "Study"],
    keywords: ["lofi", "lo-fi", "beats", "chill beats", "study beats", "coffee", "rain"],
  },
  melancholy: {
    topics: ["Sad", "Piano", "Lofi", "Chill"],
    keywords: ["u sầu", "melancholy", "trầm", "buồn man mác", "sương", "mưa", "đêm"],
  },
  stress: {
    topics: ["Chill", "Lofi", "Sleep", "Piano"],
    keywords: ["stress", "căng thẳng", "áp lực", "mệt mỏi", "giải tỏa", "relief", "calm down"],
  },
  confident: {
    topics: ["Hip Hop & Rap", "Pop", "EDM", "Rock"],
    keywords: ["tự tin", "confident", "swagger", "boss", "powerful", "strong", "rap"],
  },
};

// ─── Local mood analysis ────────────────────────────────────────────────────────
function analyzeMood(prompt) {
  const input = prompt.toLowerCase();

  // Score each mood by how many keywords match
  let bestMood = "chill";
  let bestScore = 0;

  for (const [mood, data] of Object.entries(MOOD_TOPIC_MAP)) {
    let score = 0;
    for (const kw of data.keywords) {
      if (input.includes(kw.toLowerCase())) {
        score += 1;
      }
    }
    // Also check the mood name itself
    if (input.includes(mood)) {
      score += 2;
    }
    if (score > bestScore) {
      bestScore = score;
      bestMood = mood;
    }
  }

  const mapped = MOOD_TOPIC_MAP[bestMood] || MOOD_TOPIC_MAP["chill"];

  // Determine energy
  const lowEnergy = ["sad", "sleep", "melancholy", "chill", "lofi", "focus", "stress"];
  const highEnergy = ["energetic", "party", "workout", "angry", "confident"];
  let energy = "medium";
  if (lowEnergy.includes(bestMood)) energy = "low";
  if (highEnergy.includes(bestMood)) energy = "high";

  return {
    mood: bestMood,
    keywords: mapped.keywords,
    topics: mapped.topics,
    energy,
  };
}

// ─── Search songs by topic IDs + keyword boost ──────────────────────────────────
async function searchSongsByAnalysis(analysis, topicDocs, limit = 20) {
  const { topics: topicNames = [], keywords = [] } = analysis;

  // 1) Resolve topic names → ObjectIds
  const matchedTopicIds = topicDocs
    .filter((t) => topicNames.some((name) => name.toLowerCase() === t.name.toLowerCase()))
    .map((t) => t._id);

  // ── Primary query: songs belonging to matched topics ──
  let primarySongs = [];
  if (matchedTopicIds.length > 0) {
    primarySongs = await Song.find({
      isPublic: true,
      topicIds: { $in: matchedTopicIds },
    })
      .populate("artists", "name avatar")
      .populate("topicIds", "name")
      .lean();
  }

  // ── Secondary query: keyword‑based search on title & lyrics ──
  let secondarySongs = [];
  if (keywords.length > 0) {
    const keywordConditions = keywords.map((kw) => ({
      $or: [
        { title: { $regex: kw, $options: "i" } },
        { lyrics: { $regex: kw, $options: "i" } },
      ],
    }));

    secondarySongs = await Song.find({
      isPublic: true,
      $or: keywordConditions,
    })
      .populate("artists", "name avatar")
      .populate("topicIds", "name")
      .lean();
  }

  // ── Merge & deduplicate ──
  const songMap = new Map();
  for (const song of primarySongs) {
    songMap.set(song._id.toString(), song);
  }
  for (const song of secondarySongs) {
    const id = song._id.toString();
    if (!songMap.has(id)) {
      songMap.set(id, song);
    }
  }

  const allSongs = Array.from(songMap.values());

  // ── Score each song ──
  const allTerms = [...new Set([...keywords, ...topicNames])];

  const scoredSongs = allSongs.map((song) => {
    let score = 0;

    // Topic match = highest priority
    const songTopicNames = (song.topicIds || []).map((t) =>
      (t.name || "").toLowerCase()
    );
    for (const tName of topicNames) {
      if (songTopicNames.includes(tName.toLowerCase())) {
        score += 5;
      }
    }

    // Primary topic (first in list) gets extra weight
    if (topicNames.length > 0 && songTopicNames.includes(topicNames[0].toLowerCase())) {
      score += 3;
    }

    // Title keyword match
    const titleLower = (song.title || "").toLowerCase();
    for (const kw of keywords) {
      if (titleLower.includes(kw.toLowerCase())) score += 3;
    }

    // Lyrics keyword match
    const lyricsLower = (song.lyrics || "").toLowerCase();
    for (const kw of keywords.slice(0, 5)) {
      if (lyricsLower.includes(kw.toLowerCase())) score += 1;
    }

    // Popularity bonus (capped)
    score += Math.min((song.playCount || 0) / 100, 2);
    score += Math.min((song.likeCount || 0) / 50, 1);

    return { ...song, _relevanceScore: score };
  });

  // ── Sort by relevance → popularity ──
  scoredSongs.sort((a, b) => {
    if (b._relevanceScore !== a._relevanceScore) {
      return b._relevanceScore - a._relevanceScore;
    }
    return (b.playCount || 0) - (a.playCount || 0);
  });

  // ── Return cleaned results ──
  return scoredSongs
    .slice(0, limit)
    .map(({ _relevanceScore, ...song }) => song);
}

// ─── Controller: POST /api/ai/playlist ──────────────────────────────────────────
exports.aiPlaylist = async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập mô tả cảm xúc hoặc trạng thái của bạn.",
      });
    }

    // ── Load all topics from DB ──
    const allTopics = await Topic.find({}).lean();

    // ── Step 1: Analyze mood ──
    let analysis = analyzeMood(prompt.trim());

    // Validate topic names against real DB topics
    const validTopicNames = allTopics.map((t) => t.name.toLowerCase());
    analysis.topics = analysis.topics.filter((t) =>
      validTopicNames.includes(t.toLowerCase())
    );

    // ── Step 2: Search songs ──
    let songs = await searchSongsByAnalysis(analysis, allTopics, 20);

    // Fallback: random public songs if nothing matched
    if (songs.length === 0) {
      songs = await Song.aggregate([
        { $match: { isPublic: true } },
        { $sample: { size: 15 } },
        {
          $lookup: {
            from: "artists",
            localField: "artists",
            foreignField: "_id",
            as: "artists",
          },
        },
        {
          $lookup: {
            from: "topics",
            localField: "topicIds",
            foreignField: "_id",
            as: "topicIds",
          },
        },
      ]);
    }

    // ── Step 3: Return ──
    return res.status(200).json({
      success: true,
      mood: analysis.mood,
      keywords: analysis.keywords,
      topics: analysis.topics,
      energy: analysis.energy,
      songs,
    });
  } catch (error) {
    console.error("AI Playlist error:", error);
    return res.status(500).json({
      success: false,
      message: "Đã xảy ra lỗi khi tạo playlist AI.",
    });
  }
};
