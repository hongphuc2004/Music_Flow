const { GoogleGenerativeAI } = require("@google/generative-ai");
const mongoose = require("mongoose");

const Song = require("../models/song.model");
const Topic = require("../models/topic.model");
const Artist = require("../models/artist.model");
const MoodConversation = require("../models/mood-conversation.model");
const MoodMessage = require("../models/mood-message.model");
const MoodPlaylist = require("../models/mood-playlist.model");

const MAX_PLAYLIST_SONGS = 15;

const MOOD_TOPIC_MAP = {
  sad: {
    topics: ["Sad", "Lofi", "Piano", "Chill", "Acoustic"],
    keywords: ["buon", "sad", "co don", "tam trang", "chia tay", "that tinh", "nho", "nuoc mat", "mua"],
  },
  happy: {
    topics: ["Pop", "EDM", "Party"],
    keywords: ["vui", "happy", "hanh phuc", "yeu doi", "tuoi sang", "soi dong", "dance"],
  },
  chill: {
    topics: ["Chill", "Lofi", "Piano", "Acoustic"],
    keywords: ["chill", "thu gian", "relax", "nhe nhang", "binh yen", "cafe", "acoustic"],
  },
  focus: {
    topics: ["Study", "Lofi", "Piano", "Chill"],
    keywords: ["tap trung", "focus", "hoc bai", "study", "lam viec", "work", "productive"],
  },
  energetic: {
    topics: ["EDM", "Rock", "Party", "WorkOut", "Hip Hop & Rap"],
    keywords: ["nang luong", "energetic", "soi dong", "manh me", "bung no", "hype", "gym"],
  },
  romantic: {
    topics: ["Pop", "Piano", "Chill", "Acoustic"],
    keywords: ["tinh yeu", "romantic", "lang man", "yeu", "nho nhung", "ngot ngao", "love"],
  },
  sleep: {
    topics: ["Sleep", "Piano", "Lofi", "Chill"],
    keywords: ["ngu", "sleep", "dem", "yen tinh", "calm", "ru ngu"],
  },
  party: {
    topics: ["Party", "EDM", "Pop", "Hip Hop & Rap"],
    keywords: ["party", "tiec", "vu truong", "dance", "dj", "club", "remix", "bass"],
  },
  angry: {
    topics: ["Rock", "Hip Hop & Rap", "EDM"],
    keywords: ["tuc gian", "angry", "buc", "rock", "metal", "rage", "aggressive"],
  },
};

function normalizeText(value = "") {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0111/g, "d")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s&-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function analyzeMood(prompt) {
  const input = normalizeText(prompt);
  let bestMood = "chill";
  let bestScore = 0;
  const matchedKeywords = [];

  for (const [mood, data] of Object.entries(MOOD_TOPIC_MAP)) {
    let score = input.includes(mood) ? 2 : 0;
    for (const keyword of data.keywords) {
      if (input.includes(normalizeText(keyword))) {
        score += 1;
        matchedKeywords.push(keyword);
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMood = mood;
    }
  }

  const words = input
    .split(" ")
    .filter((word) => word.length >= 3)
    .slice(0, 8);
  const mapped = MOOD_TOPIC_MAP[bestMood] || MOOD_TOPIC_MAP.chill;
  const lowEnergy = ["sad", "sleep", "chill", "focus"];
  const highEnergy = ["energetic", "party", "angry"];

  return {
    mood: bestMood,
    keywords: unique([...matchedKeywords, ...words, ...mapped.keywords]).slice(0, 18),
    topics: mapped.topics,
    energy: highEnergy.includes(bestMood) ? "high" : lowEnergy.includes(bestMood) ? "low" : "medium",
  };
}

function topicMatches(topic, terms) {
  const haystack = normalizeText(`${topic.name || ""} ${topic.description || ""}`);
  return terms.some((term) => {
    const normalized = normalizeText(term);
    return normalized && haystack.includes(normalized);
  });
}

async function findMatchedTopics(analysis, allTopics) {
  const terms = unique([...analysis.topics, ...analysis.keywords, analysis.mood]);
  const exactTopicNames = analysis.topics.map(normalizeText);

  return allTopics.filter((topic) => {
    const topicName = normalizeText(topic.name);
    return exactTopicNames.includes(topicName) || topicMatches(topic, terms);
  });
}

async function findMatchedArtists(prompt) {
  const normalizedPrompt = normalizeText(prompt);
  const terms = normalizedPrompt
    .replace(/\b(nhac|bai|hat|cua|di|cho|minh|toi|nghe)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter((word) => word.length >= 2);

  const artists = await Artist.find({}).select("name avatar").lean();
  return artists.filter((artist) => {
    const artistName = normalizeText(artist.name);
    if (!artistName) return false;
    if (normalizedPrompt.includes(artistName)) return true;
    return terms.length >= 2 && terms.every((term) => artistName.includes(term));
  });
}

async function findSongsByArtists(artists, limit = MAX_PLAYLIST_SONGS) {
  if (!artists.length) return [];

  return Song.find({
    isPublic: true,
    artists: { $in: artists.map((artist) => artist._id) },
  })
    .populate("artists", "name avatar")
    .populate("topicIds", "name description")
    .sort({ playCount: -1, likeCount: -1, createdAt: -1 })
    .limit(limit)
    .lean();
}

async function findSongsByMood(analysis, matchedTopics, limit = MAX_PLAYLIST_SONGS) {
  const matchedTopicIds = matchedTopics.map((topic) => topic._id);
  const keywordRegexes = analysis.keywords
    .map((keyword) => normalizeText(keyword))
    .filter(Boolean)
    .slice(0, 12)
    .map((keyword) => new RegExp(escapeRegex(keyword), "i"));

  const songMap = new Map();

  if (matchedTopicIds.length > 0) {
    const topicSongs = await Song.find({
      isPublic: true,
      topicIds: { $in: matchedTopicIds },
    })
      .populate("artists", "name avatar")
      .populate("topicIds", "name description")
      .lean();

    for (const song of topicSongs) {
      songMap.set(song._id.toString(), { ...song, _source: "topic" });
    }
  }

  if (keywordRegexes.length > 0) {
    const keywordSongs = await Song.find({
      isPublic: true,
      $or: [
        { title: { $in: keywordRegexes } },
        { lyrics: { $in: keywordRegexes } },
      ],
    })
      .populate("artists", "name avatar")
      .populate("topicIds", "name description")
      .lean();

    for (const song of keywordSongs) {
      const id = song._id.toString();
      if (!songMap.has(id)) {
        songMap.set(id, { ...song, _source: "keyword" });
      }
    }
  }

  const scoredSongs = Array.from(songMap.values()).map((song) => {
    const topicNames = (song.topicIds || []).map((topic) => normalizeText(topic.name));
    const title = normalizeText(song.title);
    const lyrics = normalizeText(song.lyrics);
    let score = song._source === "topic" ? 8 : 2;

    for (const topic of matchedTopics) {
      if (topicNames.includes(normalizeText(topic.name))) score += 4;
    }
    for (const keyword of analysis.keywords) {
      const term = normalizeText(keyword);
      if (term && title.includes(term)) score += 3;
      if (term && lyrics.includes(term)) score += 1;
    }

    score += Math.min((song.playCount || 0) / 100, 3);
    score += Math.min((song.likeCount || 0) / 50, 2);
    return { ...song, _score: score };
  });

  scoredSongs.sort((a, b) => {
    if (b._score !== a._score) return b._score - a._score;
    return (b.playCount || 0) - (a.playCount || 0);
  });

  return scoredSongs.slice(0, limit).map(({ _score, _source, ...song }) => song);
}

async function findFallbackSongs(limit = MAX_PLAYLIST_SONGS) {
  return Song.aggregate([
    { $match: { isPublic: true } },
    { $sort: { playCount: -1, likeCount: -1, createdAt: -1 } },
    { $limit: limit },
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

function artistNames(song) {
  return (song.artists || [])
    .map((artist) => typeof artist === "string" ? artist : artist?.name)
    .filter(Boolean);
}

function createSongSnapshots(songs) {
  return songs.map((song) => ({
    songId: song._id,
    title: song.title,
    artists: artistNames(song),
    imageUrl: song.imageUrl || "",
    audioUrl: song.audioUrl || "",
    duration: song.duration || null,
  }));
}

function playlistTitle(prompt, analysis) {
  const trimmed = prompt.trim().slice(0, 42);
  if (trimmed.length >= 12) return `Mood: ${trimmed}`;
  return `Mood ${analysis.mood}`;
}

function fallbackAssistantText(matchStatus, songCount, source = "") {
  if (source === "artist_match") {
    return "Mình tìm được một vài bài hát của nghệ sĩ bạn muốn nghe.";
  }
  if (matchStatus === "fallback") {
    return "Mình chưa tìm thấy bài hát nào khớp rõ với cảm xúc này trong thư viện MusicFlow. Dưới đây là một vài bài gợi ý khác bạn có thể thử nghe.";
  }
  if (matchStatus === "partial") {
    return "Mình tìm được một vài bài hát gần với cảm xúc của bạn.";
  }
  return "Mình đã tạo một playlist dựa trên cảm xúc và keyword bạn vừa nhập.";
}

async function generateAssistantText({ prompt, analysis, songs, matchStatus, source = "" }) {
  if (!process.env.GEMINI_API_KEY) {
    return fallbackAssistantText(matchStatus, songs.length, source);
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const songList = songs
      .map((song, index) => `${index + 1}. ${song.title} - ${artistNames(song).join(", ") || "Unknown artist"}`)
      .join("\n");
    const result = await model.generateContent(
      [
        "Bạn là Mood Music assistant trong app nghe nhạc.",
        "Trả lời bằng tiếng Việt, ngắn gọn, thân thiện, tối đa 2 câu.",
        `Cảm xúc user: ${prompt}`,
        `Mood phân tích: ${analysis.mood}`,
        `Trạng thái match: ${matchStatus}`,
        `Playlist:\n${songList}`,
      ].join("\n")
    );
    const text = result.response.text().trim();
    return text || fallbackAssistantText(matchStatus, songs.length, source);
  } catch (error) {
    console.error("Gemini mood response error:", error.message);
    return fallbackAssistantText(matchStatus, songs.length, source);
  }
}

async function serializeConversation(conversationId, userId) {
  const [conversation, messages, playlists] = await Promise.all([
    MoodConversation.findOne({ _id: conversationId, userId }).lean(),
    MoodMessage.find({ conversationId, userId }).sort({ createdAt: 1 }).lean(),
    MoodPlaylist.find({ conversationId, userId })
      .populate({
        path: "songs",
        match: { isPublic: true },
        populate: [
          { path: "artists", select: "name avatar" },
          { path: "topicIds", select: "name description" },
        ],
      })
      .populate("matchedTopicIds", "name description")
      .populate("matchedArtistIds", "name avatar")
      .sort({ createdAt: 1 })
      .lean(),
  ]);

  return { conversation, messages, playlists };
}

exports.aiPlaylist = async (req, res) => {
  try {
    const { prompt, conversationId } = req.body;
    const userId = req.userId;
    const cleanPrompt = typeof prompt === "string" ? prompt.trim() : "";

    if (!cleanPrompt) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập mô tả cảm xúc hoặc trạng thái của bạn.",
      });
    }

    let conversation = null;
    if (conversationId && mongoose.Types.ObjectId.isValid(conversationId)) {
      conversation = await MoodConversation.findOne({ _id: conversationId, userId });
    }

    const allTopics = await Topic.find({}).lean();
    const analysis = analyzeMood(cleanPrompt);
    const matchedTopics = await findMatchedTopics(analysis, allTopics);
    const matchedArtists = await findMatchedArtists(cleanPrompt);
    let songs = await findSongsByArtists(matchedArtists, MAX_PLAYLIST_SONGS);
    let source = songs.length > 0 ? "artist_match" : "fallback";

    if (songs.length === 0 && matchedArtists.length === 0) {
      songs = await findSongsByMood(analysis, matchedTopics, MAX_PLAYLIST_SONGS);
      source = songs.length > 0
        ? songs.length < MAX_PLAYLIST_SONGS ? "topic_partial" : "topic_match"
        : "fallback";
    }

    let matchStatus = songs.length === 0 ? "fallback" : songs.length < MAX_PLAYLIST_SONGS ? "partial" : "matched";

    if (songs.length === 0) {
      songs = await findFallbackSongs(MAX_PLAYLIST_SONGS);
      matchStatus = "fallback";
      source = "fallback";
    }

    const assistantText = await generateAssistantText({
      prompt: cleanPrompt,
      analysis,
      songs,
      matchStatus,
      source,
    });

    if (!conversation) {
      conversation = await MoodConversation.create({
        userId,
        title: playlistTitle(cleanPrompt, analysis),
        lastMood: analysis.mood,
        lastMessage: cleanPrompt,
      });
    } else {
      conversation.title = conversation.title || playlistTitle(cleanPrompt, analysis);
      conversation.lastMood = analysis.mood;
      conversation.lastMessage = cleanPrompt;
      await conversation.save();
    }

    const matchedTopicIds = matchedTopics.map((topic) => topic._id);
    const matchedArtistIds = matchedArtists.map((artist) => artist._id);
    const playlist = await MoodPlaylist.create({
      conversationId: conversation._id,
      userId,
      title: playlistTitle(cleanPrompt, analysis),
      description: assistantText,
      prompt: cleanPrompt,
      mood: analysis.mood,
      energy: analysis.energy,
      inputKeywords: analysis.keywords,
      matchedTopicIds,
      matchedArtistIds,
      matchStatus,
      source,
      songs: songs.map((song) => song._id),
      songSnapshots: createSongSnapshots(songs),
    });

    const userMessage = await MoodMessage.create({
      conversationId: conversation._id,
      userId,
      role: "user",
      content: cleanPrompt,
    });

    const assistantMessage = await MoodMessage.create({
      conversationId: conversation._id,
      userId,
      role: "assistant",
      content: assistantText,
      metadata: {
        playlistId: playlist._id,
        mood: analysis.mood,
        energy: analysis.energy,
        matchStatus,
        matchedTopicIds,
        matchedArtistIds,
        matchedArtists: matchedArtists.map((artist) => artist.name),
        keywords: analysis.keywords,
      },
    });

    await MoodConversation.updateOne(
      { _id: conversation._id },
      { lastMood: analysis.mood, lastMessage: assistantText }
    );

    return res.status(200).json({
      success: true,
      conversation,
      messages: [userMessage, assistantMessage],
      playlist: {
        ...playlist.toObject(),
        songs,
        matchedTopicIds: matchedTopics,
        matchedArtistIds: matchedArtists,
      },
      mood: analysis.mood,
      keywords: analysis.keywords,
      topics: matchedTopics.map((topic) => topic.name),
      artists: matchedArtists.map((artist) => artist.name),
      energy: analysis.energy,
      matchStatus,
      assistantMessage: assistantText,
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

exports.getMoodHistory = async (req, res) => {
  try {
    const userId = req.userId;
    const conversations = await MoodConversation.find({ userId })
      .sort({ updatedAt: -1 })
      .limit(20)
      .lean();

    const conversationIds = conversations.map((item) => item._id);
    const playlists = await MoodPlaylist.find({
      userId,
      conversationId: { $in: conversationIds },
    })
      .populate({
        path: "songs",
        match: { isPublic: true },
        populate: [
          { path: "artists", select: "name avatar" },
          { path: "topicIds", select: "name description" },
        ],
      })
      .populate("matchedTopicIds", "name description")
      .populate("matchedArtistIds", "name avatar")
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      conversations,
      playlists,
    });
  } catch (error) {
    console.error("Mood history error:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể tải lịch sử Mood Music.",
    });
  }
};

exports.getMoodConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({
        success: false,
        message: "Conversation không hợp lệ.",
      });
    }

    const data = await serializeConversation(conversationId, req.userId);
    if (!data.conversation) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy hội thoại.",
      });
    }

    return res.json({
      success: true,
      ...data,
    });
  } catch (error) {
    console.error("Mood conversation error:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể tải hội thoại Mood Music.",
    });
  }
};

exports.deleteMoodConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({
        success: false,
        message: "Conversation không hợp lệ.",
      });
    }

    const existing = await MoodConversation.findOne({
      _id: conversationId,
      userId: req.userId,
    }).select("_id");

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy hội thoại.",
      });
    }

    await Promise.all([
      MoodMessage.deleteMany({ conversationId, userId: req.userId }),
      MoodPlaylist.deleteMany({ conversationId, userId: req.userId }),
      MoodConversation.deleteOne({ _id: conversationId, userId: req.userId }),
    ]);

    return res.json({
      success: true,
      message: "Đã xóa mood conversation.",
    });
  } catch (error) {
    console.error("Delete mood conversation error:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể xóa hội thoại Mood Music.",
    });
  }
};
