const { GoogleGenerativeAI } = require("@google/generative-ai");
const mongoose = require("mongoose");
const Song = require("../models/song.model");
const Topic = require("../models/topic.model");
const Artist = require("../models/artist.model");
const AssistantConversation = require("../models/assistant-conversation.model");
const AssistantMessage = require("../models/assistant-message.model");
const MoodPlaylist = require("../models/mood-playlist.model");
const User = require("../models/user.model");
const { normalizeText, unique, escapeRegex, extractPromptTerms } = require("../utils/string.util");

const MAX_PLAYLIST_SONGS = 20;
const PLAYLIST_MIN_TARGET_SONGS = 15;

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
    topics: ["Study", "Piano", "Lofi", "Chill"],
    keywords: ["tap trung", "focus", "hoc bai", "study", " piano", "lam viec", "work", "productive"],
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
    keywords: ["ngu", "sleep", "dem", "yen tinh", "calm", "ru ngu", "piano"],
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

function isPlaylistIntent(prompt = "") {
  const text = normalizeText(prompt);
  const strongIntent =
    /(tao|goi y|de xuat|lam|build|recommend|play|phat|mo)/.test(text) &&
    /(playlist|danh sach|mix|mood|nhac|bai hat)/.test(text);
  const explicitPlaylist = /(tao playlist|goi y playlist|de xuat playlist|play playlist|phat nhac)/.test(text);
  return strongIntent || explicitPlaylist;
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
    score: bestScore,
    keywords: unique([...matchedKeywords, ...words, ...mapped.keywords]).slice(0, 18),
    topics: mapped.topics,
    energy: highEnergy.includes(bestMood) ? "high" : lowEnergy.includes(bestMood) ? "low" : "medium",
  };
}

function resolveStrictMoodTopics(allTopics, analysis) {
  const mappedNames = (MOOD_TOPIC_MAP[analysis.mood]?.topics || []).map(normalizeText);
  if (!mappedNames.length) return [];
  const byName = new Map(allTopics.map((topic) => [normalizeText(topic.name), topic]));
  return mappedNames.map((name) => byName.get(name)).filter(Boolean);
}

function mergeTopicsInOrder(primaryTopics = [], secondaryTopics = []) {
  const seen = new Set();
  const merged = [];
  for (const topic of [...primaryTopics, ...secondaryTopics]) {
    const id = topic?._id?.toString();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    merged.push(topic);
  }
  return merged;
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

function rankTopicsByPromptTerms(matchedTopics, promptTerms) {
  if (!matchedTopics.length) return [];
  const termSet = new Set(promptTerms.map(normalizeText).filter(Boolean));

  return [...matchedTopics]
    .map((topic) => {
      const topicName = normalizeText(topic.name || "");
      const topicDesc = normalizeText(topic.description || "");
      let score = 0;

      for (const term of termSet) {
        if (!term) continue;
        if (topicName === term) score += 5;
        if (topicName.includes(term)) score += 3;
        if (topicDesc.includes(term)) score += 1;
      }

      return { topic, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((item) => item.topic);
}

function findExplicitTopicsFromPrompt(allTopics, promptTerms) {
  if (!allTopics.length || !promptTerms.length) return [];
  const termSet = new Set(promptTerms.map(normalizeText).filter(Boolean));

  return allTopics.filter((topic) => {
    const topicName = normalizeText(topic.name || "");
    const topicDesc = normalizeText(topic.description || "");
    for (const term of termSet) {
      if (!term) continue;
      if (topicName === term) return true;
      if (topicName.includes(term)) return true;
      if (topicDesc.includes(term)) return true;
    }
    return false;
  });
}

async function findMatchedArtists(prompt) {
  const normalizedPrompt = normalizeText(prompt);
  const terms = normalizedPrompt
    .replace(/\b(nhac|bai|hat|cua|di|cho|minh|toi|nghe|playlist|tao|goi|y|ve|theo|ca|si|singer|artist)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter((word) => word.length >= 2);

  const artists = await Artist.find({}).select("name avatar").lean();
  return artists.filter((artist) => {
    const artistName = normalizeText(artist.name);
    if (!artistName) return false;
    if (normalizedPrompt.includes(artistName)) return true;
    const artistNameTerms = artistName.split(" ").filter((w) => w.length >= 2);
    if (terms.length >= 2 && terms.every((term) => artistName.includes(term))) return true;
    const overlap = terms.filter((term) => artistNameTerms.includes(term)).length;
    if (terms.length >= 2 && overlap >= 2) return true;
    return artistNameTerms.length >= 2 && artistNameTerms.slice(0, 2).every((part) => normalizedPrompt.includes(part));
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

function extractArtistHintFromPrompt(prompt = "") {
  const normalized = normalizeText(prompt);
  const artistHint = normalized
    .replace(/\b(tao|cho|toi|minh|mot|1|playlist|nhac|bai|hat|luon|di|ve|theo|ca|si|artist|singer|nghe)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const terms = artistHint.split(" ").filter((w) => w.length >= 2);
  return { artistHint, terms };
}

async function findSongsByArtistHint(prompt = "", limit = MAX_PLAYLIST_SONGS) {
  const { terms } = extractArtistHintFromPrompt(prompt);
  if (terms.length < 2) return [];

  const songs = await Song.find({ isPublic: true })
    .populate("artists", "name avatar")
    .populate("topicIds", "name description")
    .lean();

  const scored = songs
    .map((song) => {
      const artistText = normalizeText(artistNames(song).join(" "));
      if (!artistText) return null;
      const overlap = terms.filter((t) => artistText.includes(t)).length;
      if (overlap < 2) return null;
      const score = overlap * 10 + Math.min((song.playCount || 0) / 100, 5) + Math.min((song.likeCount || 0) / 50, 4);
      return { song, score };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.song);

  return scored;
}

async function findSongsByMood(
  analysis,
  matchedTopics,
  prioritizedTopics = [],
  limit = MAX_PLAYLIST_SONGS,
  options = {}
) {
  const { strictTopicOnly = false } = options;
  const matchedTopicIds = matchedTopics.map((topic) => topic._id);
  if (matchedTopicIds.length === 0) {
    return [];
  }
  const prioritizedTopicIdSet = new Set(
    prioritizedTopics.map((topic) => topic?._id?.toString()).filter(Boolean)
  );

  const topicSongs = await Song.find({
    isPublic: true,
    topicIds: { $in: matchedTopicIds },
  })
    .populate("artists", "name avatar")
    .populate("topicIds", "name description")
    .lean();

  const scoredSongs = topicSongs.map((song) => {
    const topicNames = (song.topicIds || []).map((topic) => normalizeText(topic.name));
    const title = normalizeText(song.title);
    const lyrics = normalizeText(song.lyrics);
    let score = 8;

    for (const topic of matchedTopics) {
      if (topicNames.includes(normalizeText(topic.name))) score += 4;
    }
    const hasPriorityTopic = (song.topicIds || []).some((topic) =>
      prioritizedTopicIdSet.has(topic?._id?.toString())
    );
    if (hasPriorityTopic) {
      score += 8;
    }
    if (!strictTopicOnly) {
      for (const keyword of analysis.keywords) {
        const term = normalizeText(keyword);
        if (term && title.includes(term)) score += 3;
        if (term && lyrics.includes(term)) score += 1;
      }
    }

    score += Math.min((song.playCount || 0) / 100, 3);
    score += Math.min((song.likeCount || 0) / 50, 2);
    return { ...song, _score: score, _hasPriorityTopic: hasPriorityTopic ? 1 : 0 };
  });

  scoredSongs.sort((a, b) => {
    if (b._hasPriorityTopic !== a._hasPriorityTopic) {
      return b._hasPriorityTopic - a._hasPriorityTopic;
    }
    if (b._score !== a._score) return b._score - a._score;
    return (b.playCount || 0) - (a.playCount || 0);
  });

  return scoredSongs.slice(0, limit).map(({ _score, _hasPriorityTopic, ...song }) => song);
}

async function findSongsByTopicsSequential(topics = [], limit = MAX_PLAYLIST_SONGS, minTarget = PLAYLIST_MIN_TARGET_SONGS) {
  const orderedTopics = topics.filter(Boolean);
  if (!orderedTopics.length) return [];

  const targetCount = Math.min(limit, minTarget);
  const chosen = [];
  const seenSongIds = new Set();

  for (const topic of orderedTopics) {
    if (chosen.length >= targetCount) break;
    const topicSongs = await Song.find({
      isPublic: true,
      topicIds: topic._id,
    })
      .populate("artists", "name avatar")
      .populate("topicIds", "name description")
      .sort({ playCount: -1, likeCount: -1, createdAt: -1 })
      .lean();

    for (const song of topicSongs) {
      const songId = song?._id?.toString();
      if (!songId || seenSongIds.has(songId)) continue;
      seenSongIds.add(songId);
      chosen.push(song);
      if (chosen.length >= targetCount) break;
    }
  }

  return chosen.slice(0, limit);
}

function shouldPrioritizeArtistFlow(prompt = "") {
  const text = normalizeText(prompt);
  const hasArtistPhrase =
    /\b(ca si|artist|singer|nhac cua|bai cua|ve)\b/.test(text) ||
    /\btheo\b/.test(text);
  return hasArtistPhrase;
}

function hasArtistHintTokens(prompt = "") {
  const { terms } = extractArtistHintFromPrompt(prompt);
  return terms.length >= 2;
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

function rankArtistsByPrompt(artists = [], prompt = "") {
  const text = normalizeText(prompt);
  const promptTerms = new Set(
    text
      .split(" ")
      .map((w) => w.trim())
      .filter((w) => w.length >= 2)
  );

  return [...artists]
    .map((artist) => {
      const name = normalizeText(artist.name || "");
      const nameTerms = name.split(" ").filter((w) => w.length >= 2);
      let score = 0;
      if (name && text.includes(name)) score += 10;
      for (const term of promptTerms) {
        if (nameTerms.includes(term)) score += 2;
        else if (name.includes(term)) score += 1;
      }
      return { artist, score, nameTermsCount: nameTerms.length };
    })
    .sort((a, b) => b.score - a.score);
}

function hasStrongArtistSignal(prompt = "", rankedMatches = []) {
  if (!rankedMatches.length) return false;
  const text = normalizeText(prompt);
  const top = rankedMatches[0];
  if (!top || !top.artist) return false;

  const topName = normalizeText(top.artist.name || "");
  const topNameParts = topName.split(" ").filter((w) => w.length >= 2);

  const partialNameMatch =
    topNameParts.length >= 2 &&
    topNameParts
      .slice(0, 2)
      .every((part) => text.includes(part));

  return top.score >= 4 || text.includes(topName) || partialNameMatch;
}

function buildPlaylistContextPrompt(currentPrompt = "", historyMessages = []) {
  const current = String(currentPrompt || "").trim();
  if (!current) return "";

  const normalizedCurrent = normalizeText(current);
  const needsContextCarry =
    /(tao|lam|goi y|de xuat).*(playlist)/.test(normalizedCurrent) ||
    isPlayIntent(normalizedCurrent);
  if (!needsContextCarry) return current;

  const recentUserHints = historyMessages
    .filter((m) => m?.role === "user" && typeof m.content === "string")
    .map((m) => m.content.trim())
    .filter(Boolean)
    .slice(-4)
    .reverse()
    .find((text) => {
      const n = normalizeText(text);
      return !isPlaylistIntent(n) && !isPlayIntent(n);
    });

  if (!recentUserHints) return current;
  return `${recentUserHints}. ${current}`;
}

function isPlayIntent(prompt = "") {
  const text = normalizeText(prompt);
  const hasPlayVerb = /\b(bat|phat|mo|nghe|play)\b/.test(text);
  const hasRandomKw = /\b(ngau nhien|random|1 bai|mot bai|bai nao|luon di)\b/.test(text);
  const isQuickPlay = /\b(bat|phat|mo)\s*(di|luon|len|nao|gio)\b/.test(text);
  return (hasPlayVerb && hasRandomKw) || isQuickPlay;
}

function isSpecificSongIntent(prompt = "") {
  const text = normalizeText(prompt);
  return /\b(phat|bat|mo|cho nghe|nghe|play)\s+(?:bai\s+hat\s+|ca\s+khuc\s+|bai\s+|nhac\s+)?([a-z0-9])/i.test(text);
}

function extractSongTitleFromPrompt(prompt = "") {
  const text = normalizeText(prompt);
  const match = text.match(/\b(?:phat|bat|mo|cho nghe|nghe|play)\s+(?:bai\s+hat\s+|ca\s+khuc\s+|bai\s+|nhac\s+)?(.+)/i);
  if (match) {
    let title = match[1].trim();
    title = title.replace(/\s+(di|luon|gium|ho|voi|nhe|gap|nhanh)$/i, "").trim();
    return title;
  }
  return null;
}

async function findSongByTitle(titleQuery) {
  if (!titleQuery || titleQuery.length < 2) return null;

  const normalized = normalizeText(titleQuery);
  const terms = normalized.split(" ").filter((w) => w.length >= 2);
  if (!terms.length) return null;

  const songs = await Song.find({ isPublic: true })
    .populate("artists", "name avatar")
    .populate("topicIds", "name description")
    .lean();

  const scored = songs
    .map((song) => {
      const titleNorm = normalizeText(song.title || "");
      let score = 0;
      if (titleNorm === normalized) score += 100;
      else if (titleNorm.includes(normalized)) score += 60;
      else {
        const overlap = terms.filter((t) => titleNorm.includes(t)).length;
        if (overlap === terms.length) score += 40;
        else if (overlap > 0) score += overlap * 10;
      }
      if (score > 0) {
        score += Math.min((song.playCount || 0) / 200, 5);
      }
      return { song, score };
    })
    .filter((x) => x.score >= 10)
    .sort((a, b) => b.score - a.score);

  return scored[0]?.song || null;
}

function pickRandomSong(songs = []) {
  if (!songs.length) return null;
  const randomIndex = Math.floor(Math.random() * songs.length);
  return songs[randomIndex] || null;
}

function fallbackAssistantText(matchStatus, songCount, source = "", prompt = "") {
  const normalizedPrompt = prompt?.trim();
  if (source === "artist_match") {
    return "Mình tìm được một vài bài hát của nghệ sĩ bạn muốn nghe.";
  }
  if (matchStatus === "fallback") {
    return "Mình chưa tìm thấy bài hát phù hợp theo đúng keyword/topic từ yêu cầu của bạn trong thư viện MusicFlow.";
  }
  if (matchStatus === "partial") {
    return normalizedPrompt
      ? `Mình đã lọc theo "${normalizedPrompt}" và tìm được một phần bài hát phù hợp.`
      : "Mình tìm được một vài bài hát theo keyword/topic bạn yêu cầu.";
  }
  return normalizedPrompt
    ? `Mình đã lọc theo "${normalizedPrompt}" và tạo playlist phù hợp nhất có thể.`
    : "Mình đã tạo playlist theo cảm xúc của bạn.";
}

// --- GEMINI INITIALIZATION & CANDIDATES ---

function toGeminiRole(role) {
  return role === "model" ? "model" : "user";
}

function buildGeminiHistory(messages = []) {
  return messages
    .filter((m) => m && typeof m.content === "string" && m.content.trim())
    .map((m) => ({
      role: toGeminiRole(m.role),
      parts: [{ text: m.content.trim() }],
    }));
}

// System instructions that change depending on user role
function buildSystemInstruction(actorRole) {
  const base = [
    "Bạn là trợ lý AI (MusicFlow Assistant) thân thiện trong ứng dụng nghe nhạc MusicFlow.",
    "Trả lời bằng tiếng Việt, ngắn gọn, tự nhiên như hai người đang trò chuyện.",
    "Bạn được tích hợp hệ thống Google Search để tìm kiếm thông tin bên ngoài và công cụ nội bộ để tương tác với trình phát nhạc và tìm bài hát.",
  ];

  if (actorRole === "artist") {
    base.push(
      "Người dùng hiện tại là NGHỆ SĨ (Artist). Bạn có thể giúp họ xem thống kê nhạc của họ, xem các bài hát đã tải lên hoặc hướng dẫn họ tải nhạc lên ứng dụng."
    );
  } else if (actorRole === "admin") {
    base.push(
      "Người dùng hiện tại là QUẢN TRỊ VIÊN (Admin). Hãy trả lời với thái độ hỗ trợ quản trị, cung cấp số liệu phân tích tổng quan và hướng dẫn họ tới các trang cấu hình phù hợp khi được yêu cầu."
    );
  } else {
    base.push(
      "Người dùng hiện tại là NGƯỜI NGHE (User). Bạn có thể đề xuất nhạc, tạo playlist theo cảm xúc/mood, phát nhạc trực tiếp hoặc đưa họ đến trang nhạc yêu thích/thư viện."
    );
  }

  return base.join("\n");
}

// Define Tools (Function Declarations) dynamically for Gemini based on role
function getToolsForRole(actorRole) {
  const declarations = [
    {
      name: "play_song",
      description: "Phát trực tiếp một bài hát bằng cách tìm kiếm tiêu đề bài hát hoặc ca sĩ.",
      parameters: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING", description: "Tên bài hát hoặc cụm từ tìm kiếm tiêu đề bài hát." },
          artist: { type: "STRING", description: "Tên ca sĩ hát bài đó (nếu được đề cập)." },
        },
        required: ["title"],
      },
    },
    {
      name: "create_mood_playlist",
      description: "Tạo danh sách phát nhạc (playlist) dựa trên cảm xúc, tâm trạng (mood), hoạt động, thể loại hoặc một ca sĩ cụ thể.",
      parameters: {
        type: "OBJECT",
        properties: {
          mood: {
            type: "STRING",
            description: "Tâm trạng hoặc cảm xúc của người dùng.",
            enum: ["sad", "happy", "chill", "focus", "energetic", "romantic", "sleep", "party", "angry"],
          },
          artist: { type: "STRING", description: "Tên ca sĩ mục tiêu nếu người dùng chỉ định nghe ca sĩ đó." },
        },
        required: ["mood"],
      },
    },
    {
      name: "open_route",
      description: "Chuyển hướng người dùng đến một màn hình chức năng cụ thể trên ứng dụng.",
      parameters: {
        type: "OBJECT",
        properties: {
          route: {
            type: "STRING",
            description: "Đường dẫn client cần mở.",
            enum: [
              "/client/home",
              "/client/discover",
              "/client/favorites",
              "/client/library",
              "/client/rankings",
              "/client/ai-mood",
              "/artist/dashboard",
              "/artist/songs",
              "/artist/analytics",
              "/artist/profile",
              "/admin/dashboard",
              "/admin/accounts",
              "/admin/songs",
              "/admin/topics",
              "/admin/playlists",
            ],
          },
        },
        required: ["route"],
      },
    },
    {
      name: "search_songs_natural",
      description: "Tìm kiếm các bài hát trong thư viện bằng ngôn ngữ tự nhiên, tìm theo lyrics, tên bài hát, ca sĩ, thể loại hoặc tâm trạng.",
      parameters: {
        type: "OBJECT",
        properties: {
          query: { type: "STRING", description: "Từ khóa tìm kiếm chung hoặc trích dẫn lời bài hát/lyrics." },
          artist: { type: "STRING", description: "Tên ca sĩ hát bài đó nếu được nhắc đến." },
          mood: { type: "STRING", description: "Tâm trạng mong muốn." },
          intent: {
            type: "STRING",
            description: "Mục đích của người dùng: 'play' nếu muốn phát nhạc ngay lập tức, 'search' nếu chỉ muốn tìm kiếm và hiển thị danh sách bài hát.",
            enum: ["play", "search"],
          },
        },
        required: ["query"],
      },
    },
  ];

  if (actorRole === "artist") {
    declarations.push(
      {
        name: "get_artist_analytics",
        description: "Xem thống kê phân tích của chính ca sĩ hiện tại (lượt nghe, followers).",
        parameters: { type: "OBJECT", properties: {} },
      },
      {
        name: "get_artist_songs",
        description: "Xem danh sách các bài hát đã tải lên của chính ca sĩ hiện tại.",
        parameters: { type: "OBJECT", properties: {} },
      }
    );
  } else if (actorRole === "admin") {
    declarations.push(
      {
        name: "get_system_stats",
        description: "Xem thống kê tổng quan toàn hệ thống (tổng số bài hát, người dùng, lượt nghe).",
        parameters: { type: "OBJECT", properties: {} },
      },
      {
        name: "search_accounts",
        description: "Tìm kiếm các tài khoản người dùng trong hệ thống theo email hoặc role.",
        parameters: {
          type: "OBJECT",
          properties: {
            email: { type: "STRING", description: "Email của tài khoản cần tìm." },
            role: {
              type: "STRING",
              description: "Vai trò của tài khoản cần tìm.",
              enum: ["admin", "user", "artist"],
            },
          },
        },
      }
    );
  }

  return [{ functionDeclarations: declarations }];
}

// --- CORE SERVICE IMPLEMENTATION ---
class AssistantService {
  /**
   * Main entry point to process a message
   */
  async processMessage({
    prompt,
    conversationId,
    actorId,
    actorType,
    actorRole,
    scope = "global",
    preferredModel = null,
  }) {
    const cleanPrompt = typeof prompt === "string" ? prompt.trim() : "";
    if (!cleanPrompt) {
      throw new Error("Prompt is empty");
    }

    // Kiểm tra cước AIDJ / Assistant nếu là tài khoản User
    if (actorType === "User") {
      const aiQuotaService = require("./aiQuota.service");
      aiQuotaService.acquireLock(actorId);
      try {
        await aiQuotaService.checkQuota(actorId);
      } catch (err) {
        aiQuotaService.releaseLock(actorId);
        throw err;
      }
    }

    try {
      // 1. Resolve or Create Conversation
      let conversation = null;
      if (conversationId && mongoose.Types.ObjectId.isValid(conversationId)) {
        conversation = await AssistantConversation.findOne({ _id: conversationId, actorId });
      }

      if (!conversation) {
        conversation = await AssistantConversation.create({
          actorId,
          actorType,
          actorRole,
          scope,
          title: scope === "mood" ? `Mood: ${cleanPrompt.slice(0, 32)}` : `Hội thoại: ${cleanPrompt.slice(0, 32)}`,
          lastMessage: cleanPrompt,
        });
      }

      // 2. Fetch recent messages
      const recentMessages = await AssistantMessage.find({ conversationId: conversation._id })
        .sort({ createdAt: 1 })
        .limit(30)
        .lean();

      let assistantText = "";
      let clientActions = [];
      let playlist = null;
      let songs = [];
      let metadata = {};

      // Determine user tier for targeted model routing
      const aiQuotaService = require("./aiQuota.service");
      let userTier = "basic";
      if (actorType === "User" && actorId) {
        const userDoc = await User.findById(actorId).populate("premiumPlan").lean();
        userTier = aiQuotaService.getUserTier(userDoc);
      }

      // 3. AI Preprocessing via Mistral Orchestrator & Gemini Model Router
      if (process.env.GEMINI_API_KEY) {
        const geminiRouter = require("./geminiRouter.service");
        const aiOrchestrator = require("./aiOrchestrator.service");
        const systemInstruction = buildSystemInstruction(actorRole);

        // Preprocess prompt via Orchestrator (Bypass / Mistral Enricher / Fallback)
        const orchestration = await aiOrchestrator.processUserRequest({ userPrompt: cleanPrompt });
        const promptForGemini = orchestration.promptForGemini || cleanPrompt;

        try {
          await geminiRouter.executeWithModelRouter({
            preferredModel,
            userTier,
            requiresTools: true,
            task: async (modelName) => {
              const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
              const model = genAI.getGenerativeModel({
                model: modelName,
                systemInstruction,
                tools: getToolsForRole(actorRole),
              });

              // Convert history
              const chatHistory = buildGeminiHistory(recentMessages);
              const chat = model.startChat({ history: chatHistory });

              const result = await chat.sendMessage(promptForGemini);
              const response = result.response;
              const functionCalls = response.functionCalls();


              // Check if Gemini invoked any tool
              if (functionCalls && functionCalls.length > 0) {
                const call = functionCalls[0];
                const { name, args } = call;

                if (name === "play_song") {
                  const song = await findSongByTitle(args.title);
                  if (song) {
                    const artistList = artistNames(song).join(", ");
                    assistantText = `Được rồi, mình đang bật bài "${song.title}"${
                      artistList ? ` của ${artistList}` : ""
                    } cho bạn nghe!`;
                    clientActions.push({
                      type: "PLAY_SONG",
                      payload: { songId: song._id, song, songs: [song] },
                    });
                    songs = [song];
                    metadata = { type: "play_song", songId: song._id };
                  } else {
                    assistantText = `Mình không tìm thấy bài hát "${args.title}" trong thư viện MusicFlow, nhưng bạn có thể thử tìm một bài hát khác nhé!`;
                    metadata = { type: "play_song_failed", query: args.title };
                  }
                } else if (name === "search_songs_natural") {
                  const queryStr = args.query || "";
                  const artistQuery = args.artist || "";
                  const intent = args.intent || "search";

                  const filter = { isPublic: true };
                  if (queryStr) {
                    filter.$text = { $search: queryStr };
                  }

                  let songsList = [];

                  // 1. Try matching queryStr or artistQuery against artists in DB first
                  const targetArtistQuery = queryStr || artistQuery;
                  if (targetArtistQuery) {
                    const matchedArtistsList = await findMatchedArtists(targetArtistQuery);
                    if (matchedArtistsList.length > 0) {
                      songsList = await findSongsByArtists(matchedArtistsList, 20);
                    }
                  }

                  // 2. If no songs found by artist, fallback to text search
                  if (songsList.length === 0 && queryStr) {
                    songsList = await Song.find(filter)
                      .populate("artists", "name avatar")
                      .populate("topicIds", "name")
                      .sort({ score: { $meta: "textScore" } })
                      .limit(10)
                      .lean();
                  }

                  // 3. Fallback to regex search on title/lyrics
                  if (songsList.length === 0 && queryStr) {
                    const regex = new RegExp(escapeRegex(queryStr), "i");
                    const regexFilter = {
                      isPublic: true,
                      $or: [
                        { title: regex },
                        { lyrics: regex }
                      ]
                    };
                    songsList = await Song.find(regexFilter)
                      .populate("artists", "name avatar")
                      .populate("topicIds", "name")
                      .sort({ playCount: -1 })
                      .limit(10)
                      .lean();
                  }

                  if (artistQuery && songsList.length > 0 && !targetArtistQuery) {
                    const artistRegex = new RegExp(escapeRegex(artistQuery), "i");
                    songsList = songsList.filter(s => 
                      (s.artists || []).some(a => artistRegex.test(a.name || ""))
                    );
                  }

                  const displayQuery = queryStr || artistQuery || "tìm kiếm";

                  if (songsList.length > 0) {
                    if (intent === "play") {
                      const firstSong = songsList[0];
                      const artistStr = (firstSong.artists || []).map(a => a.name).join(", ");
                      assistantText = `Mình đã tìm thấy bài hát phù hợp và đang phát bài "${firstSong.title}"${artistStr ? ` của ${artistStr}` : ""} cho bạn nhé!`;
                      clientActions.push({
                        type: "PLAY_SONG",
                        payload: { songId: firstSong._id, song: firstSong, songs: songsList },
                      });
                      songs = [firstSong];
                      metadata = { type: "play_song_natural", songId: firstSong._id, query: displayQuery };
                    } else {
                      const songTitles = songsList.slice(0, 5).map((s, idx) => `${idx + 1}. ${s.title} - ${(s.artists || []).map(a => a.name).join(", ")}`).join("\n");
                      assistantText = `Mình đã tìm thấy một số bài hát phù hợp với yêu cầu "${displayQuery}" của bạn:\n${songTitles}`;
                      clientActions.push({
                        type: "SHOW_SEARCH_RESULTS",
                        payload: { query: displayQuery, songs: songsList },
                      });
                      songs = songsList;
                      metadata = { type: "search_songs_natural", query: displayQuery, count: songsList.length };
                    }
                  } else {
                    assistantText = `Mình đã tìm kiếm khắp nơi nhưng không thấy bài hát nào khớp với yêu cầu "${displayQuery}" của bạn. Bạn thử tìm kiếm một từ khóa khác nhé!`;
                    metadata = { type: "search_songs_natural_failed", query: displayQuery };
                  }
                } else if (name === "open_route") {
                  // Ensure route fits the user's role
                  let allowed = true;
                  if (args.route.startsWith("/artist") && actorRole !== "artist") allowed = false;
                  if (args.route.startsWith("/admin") && actorRole !== "admin") allowed = false;

                  if (allowed) {
                    assistantText = `Mình đang chuyển hướng bạn sang trang này nhé.`;
                    clientActions.push({
                      type: "OPEN_ROUTE",
                      payload: { route: args.route },
                    });
                    metadata = { type: "open_route", route: args.route };
                  } else {
                    assistantText = "Xin lỗi, bạn không có quyền truy cập vào màn hình này.";
                  }
                } else if (name === "create_mood_playlist") {
                  // Pass activeModelName to reuse active model and prevent nested routers/fallbacks
                  const resObj = await this.generatePlaylistInternal({
                    prompt: cleanPrompt,
                    mood: args.mood,
                    artistHint: args.artist,
                    userId: actorId,
                    conversationId: conversation._id,
                    activeModelName: modelName,
                    userTier,
                  });

                  playlist = resObj.playlist;
                  songs = resObj.songs;
                  assistantText = resObj.assistantText;
                  clientActions.push({
                    type: "LOAD_PLAYLIST",
                    payload: { playlistId: playlist._id, playlist, songs },
                  });
                  metadata = {
                    type: "create_mood_playlist",
                    playlistId: playlist._id,
                    mood: args.mood,
                    matchStatus: resObj.matchStatus,
                  };
                } else if (name === "get_artist_analytics" && actorRole === "artist") {
                  const artist = await Artist.findById(actorId).lean();
                  if (artist) {
                    assistantText = `Dưới đây là thống kê của ca sĩ ${artist.name}:\n- Lượt nghe hàng tháng: ${artist.monthlyListeners || 0} người nghe\n- Lượt theo dõi: ${artist.followersCount || 0} người theo dõi.`;
                    clientActions.push({
                      type: "SHOW_ARTIST_ANALYTICS",
                      payload: {
                        name: artist.name,
                        monthlyListeners: artist.monthlyListeners || 0,
                        followersCount: artist.followersCount || 0,
                      },
                    });
                    metadata = { type: "get_artist_analytics", artistId: artist._id };
                  } else {
                    assistantText = "Không tìm thấy thông tin ca sĩ.";
                  }
                } else if (name === "get_artist_songs" && actorRole === "artist") {
                  const songsList = await Song.find({ artists: actorId, isPublic: true })
                    .limit(10)
                    .lean();

                  const titles = songsList.map((s, idx) => `${idx + 1}. ${s.title}`).join("\n");
                  assistantText = songsList.length > 0
                    ? `Dưới đây là một số bài hát của bạn đã tải lên:\n${titles}`
                    : "Bạn chưa tải bài hát nào lên.";
                  clientActions.push({
                    type: "SHOW_ARTIST_SONGS",
                    payload: { songs: songsList },
                  });
                  metadata = { type: "get_artist_songs", count: songsList.length };
                } else if (name === "search_accounts_admin" && actorRole === "admin") {
                  const accounts = await User.find({ role: "user" }).limit(10).lean();
                  const names = accounts.map((u, idx) => `${idx + 1}. ${u.name} (${u.email})`).join("\n");
                  assistantText = `Danh sách người dùng:\n${names}`;
                  clientActions.push({
                    type: "SHOW_ADMIN_ACCOUNTS",
                    payload: { accounts },
                  });
                  metadata = { type: "search_accounts", query: args };
                } else {
                  assistantText = "Xin lỗi, chức năng này chưa thể thực hiện được hoặc bị từ chối do không đúng vai trò.";
                }
              } else {
                // Conversational response without tool call
                assistantText = response.text().trim();
                metadata = { type: "chat_only" };
              }
            }
          });
        } catch (err) {
          console.error("All candidates failed in Assistant processing:", err);
        }
      }

      // 4. Fallbacks (If Gemini was not initialized or failed completely)
      if (!assistantText) {
        // Direct regex fallback matching the original backend behavior
        const isPlaylistReq = isPlaylistIntent(cleanPrompt);
        const isPlayReq = isPlayIntent(cleanPrompt);
        const isSongReq = isSpecificSongIntent(cleanPrompt);

        if (isSongReq) {
          const titleQuery = extractSongTitleFromPrompt(cleanPrompt);
          const song = await findSongByTitle(titleQuery);
          if (song) {
            const artistList = artistNames(song).join(", ");
            assistantText = `Được rồi, mình đang bật bài "${song.title}"${
              artistList ? ` của ${artistList}` : ""
            } cho bạn nghe!`;
            clientActions.push({
              type: "PLAY_SONG",
              payload: { songId: song._id, song, songs: [song] },
            });
            songs = [song];
            metadata = { type: "play_song", songId: song._id };
          } else {
            assistantText = `Mình chưa tìm thấy bài hát "${titleQuery}" trong hệ thống.`;
          }
        } else if (isPlayReq) {
          const songsList = await Song.find({ isPublic: true })
            .populate("artists", "name avatar")
            .limit(20)
            .lean();
          const rand = pickRandomSong(songsList);
          if (rand) {
            assistantText = `Mình đang bật ngẫu nhiên bài "${rand.title}" cho bạn nghe nhé.`;
            clientActions.push({
              type: "PLAY_SONG",
              payload: { songId: rand._id, song: rand, songs: [rand] },
            });
            songs = [rand];
          } else {
            assistantText = "Hiện không có bài hát nào sẵn sàng.";
          }
        } else if (isPlaylistReq) {
          const analysis = analyzeMood(cleanPrompt);
          const resObj = await this.generatePlaylistInternal({
            prompt: cleanPrompt,
            mood: analysis.mood,
            userId: actorId,
            conversationId: conversation._id,
          });

          playlist = resObj.playlist;
          songs = resObj.songs;
          assistantText = resObj.assistantText;
          clientActions.push({
            type: "LOAD_PLAYLIST",
            payload: { playlistId: playlist._id, playlist, songs },
          });
          metadata = {
            type: "create_mood_playlist",
            playlistId: playlist._id,
            mood: analysis.mood,
            matchStatus: resObj.matchStatus,
          };
        } else {
          assistantText = "Xin chào, mình có thể giúp gì cho bạn? Hãy thử yêu cầu mình bật nhạc hoặc tạo một playlist theo tâm trạng xem.";
          metadata = { type: "chat_only" };
        }
      }

      // Save messages (Two-Step Commit)
      const [userMsg, assistantMsg] = await Promise.all([
        AssistantMessage.create({
          conversationId: conversation._id,
          role: "user",
          content: cleanPrompt,
        }),
        AssistantMessage.create({
          conversationId: conversation._id,
          role: "model",
          content: assistantText,
          metadata,
        })
      ]);

      // Update conversation properties
      conversation.lastMessage = assistantText;
      await conversation.save();

      return {
        conversation,
        messages: [userMsg, assistantMsg],
        playlist,
        songs,
        clientActions,
        assistantMessage: assistantText,
      };
    } finally {
      if (actorType === "User") {
        const aiQuotaService = require("./aiQuota.service");
        aiQuotaService.releaseLock(actorId);
      }
    }
  }

  /**
   * Internal helper to create the actual playlist (Mood Playlist) in DB
   */
  async generatePlaylistInternal({ prompt, mood, artistHint, userId, conversationId, activeModelName = null, userTier = "basic" }) {
    const allTopics = await Topic.find({}).lean();
    const mockPrompt = artistHint ? `${prompt} ${artistHint}` : prompt;
    const analysis = analyzeMood(mockPrompt);
    // Overwrite mood from Gemini tool choice if available
    if (mood) {
      analysis.mood = mood;
    }

    const promptTerms = extractPromptTerms(mockPrompt);
    const explicitTopics = findExplicitTopicsFromPrompt(allTopics, promptTerms);
    const strictMoodTopics = resolveStrictMoodTopics(allTopics, analysis);
    const hasMoodSignal = analysis.score > 0;
    const matchedTopics = hasMoodSignal
      ? strictMoodTopics
      : explicitTopics.length > 0
        ? explicitTopics
        : await findMatchedTopics(analysis, allTopics);

    const orderedTopics = mergeTopicsInOrder(explicitTopics, matchedTopics);
    const prioritizedTopics = rankTopicsByPromptTerms(matchedTopics, promptTerms);
    const matchedArtists = await findMatchedArtists(mockPrompt);
    const rankedArtistMatches = rankArtistsByPrompt(matchedArtists, mockPrompt);
    const rankedArtists = rankedArtistMatches.map((item) => item.artist);
    const primaryArtist = rankedArtists[0] || null;
    const allowArtistFlow =
      shouldPrioritizeArtistFlow(mockPrompt) ||
      hasStrongArtistSignal(mockPrompt, rankedArtistMatches) ||
      hasArtistHintTokens(mockPrompt);

    let songs = [];
    let source = "topic_only";

    if (allowArtistFlow && primaryArtist) {
      songs = await findSongsByArtists([primaryArtist], MAX_PLAYLIST_SONGS);
      source = songs.length > 0 ? "artist_match" : "topic_only";
    }

    if (allowArtistFlow && songs.length === 0) {
      songs = await findSongsByArtistHint(mockPrompt, MAX_PLAYLIST_SONGS);
      if (songs.length > 0) {
        source = "artist_match";
      }
    }

    if (!(allowArtistFlow && songs.length > 0) && songs.length < PLAYLIST_MIN_TARGET_SONGS) {
      const topicSongs = await findSongsByTopicsSequential(
        orderedTopics,
        MAX_PLAYLIST_SONGS,
        PLAYLIST_MIN_TARGET_SONGS
      );
      if (songs.length === 0) {
        songs = topicSongs;
        source = songs.length > 0 ? "topic_sequence" : "topic_only";
      } else if (topicSongs.length > 0) {
        const seen = new Set(songs.map((s) => s?._id?.toString()).filter(Boolean));
        for (const song of topicSongs) {
          const id = song?._id?.toString();
          if (!id || seen.has(id)) continue;
          songs.push(song);
          seen.add(id);
          if (songs.length >= MAX_PLAYLIST_SONGS) break;
        }
        source = "artist_then_topic";
      }
    }

    if (songs.length === 0 && matchedArtists.length === 0) {
      songs = await findSongsByMood(
        analysis,
        matchedTopics,
        prioritizedTopics,
        MAX_PLAYLIST_SONGS,
        { strictTopicOnly: hasMoodSignal }
      );
      source = songs.length > 0 ? songs.length < MAX_PLAYLIST_SONGS ? "topic_partial" : "topic_match" : "topic_only";
    }

    if (allowArtistFlow && songs.length === 0) {
      songs = [];
      source = "artist_match";
    }

    const matchStatus = songs.length === 0
      ? "fallback"
      : songs.length < PLAYLIST_MIN_TARGET_SONGS
        ? "partial"
        : "matched";

    // Text generation for playlist
    let assistantText = "";
    if (process.env.GEMINI_API_KEY) {
      const songList = songs
        .map((song, index) => `${index + 1}. ${song.title} - ${artistNames(song).join(", ") || "Unknown artist"}`)
        .join("\n");
      const promptText = [
        "Bạn là Mood Music assistant trong app nghe nhạc.",
        "Trả lời bằng tiếng Việt, ngắn gọn, thân thiện, tối đa 2 câu.",
        "Câu 1: trả lời trực tiếp ý user vừa hỏi. Câu 2: mới nói về playlist đã tạo.",
        "Chỉ mô tả đúng kết quả tìm được theo keyword/topic của user, không nói thêm bài ngoài phạm vi.",
        `Yêu cầu user: ${prompt}`,
        `Mood phân tích: ${analysis.mood}`,
        `Ca sĩ mục tiêu (nếu có): ${primaryArtist?.name || "không"}`,
        `Trạng thái match: ${matchStatus}`,
        `Playlist:\n${songList}`,
      ].join("\n");

      try {
        if (activeModelName) {
          // Direct execution: reuse active model from orchestration context to prevent nested routers
          const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
          const model = genAI.getGenerativeModel({ model: activeModelName });
          const result = await model.generateContent(promptText);
          assistantText = result.response.text().trim();
        } else {
          // No activeModelName: wrap in model router
          const geminiRouter = require("./geminiRouter.service");
          assistantText = await geminiRouter.executeWithModelRouter({
            requiresTools: false,
            userTier,
            task: async (modelName) => {
              const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
              const model = genAI.getGenerativeModel({ model: modelName });
              const result = await model.generateContent(promptText);
              return result.response.text().trim();
            }
          });
        }
      } catch (err) {
        console.warn("Failed playlist text generation via Gemini:", err.message);
      }
    }

    if (!assistantText) {
      assistantText = fallbackAssistantText(matchStatus, songs.length, source, prompt);
    }

    const matchedTopicIds = matchedTopics.map((topic) => topic._id);
    const matchedArtistIds = matchedArtists.map((artist) => artist._id);

    const dbSource = ["artist_match", "topic_match", "topic_partial", "fallback"].includes(source)
      ? source
      : (source === "topic_sequence" || source === "artist_then_topic")
        ? "topic_match"
        : "fallback";

    let playlist = await MoodPlaylist.create({
      conversationId,
      userId,
      title: playlistTitle(prompt, analysis),
      description: assistantText,
      prompt,
      mood: analysis.mood,
      energy: analysis.energy,
      inputKeywords: analysis.keywords,
      matchedTopicIds,
      matchedArtistIds,
      matchStatus,
      source: dbSource,
      songs: songs.map((song) => song._id),
      songSnapshots: createSongSnapshots(songs),
    });

    // Nạp đầy đủ thông tin các bài hát cho giao diện người dùng
    playlist = await MoodPlaylist.findById(playlist._id)
      .populate({
        path: "songs",
        populate: [
          { path: "artists", select: "name avatar" },
          { path: "topicIds", select: "name description" },
        ],
      })
      .populate("matchedTopicIds", "name description")
      .populate("matchedArtistIds", "name avatar");

    return {
      playlist,
      songs,
      assistantText,
      matchStatus,
    };
  }
}

module.exports = new AssistantService();
