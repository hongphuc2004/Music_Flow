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

const promptBuilder = require("../ai/promptBuilder.service");
const aiIntent = require("./aiIntent.service");


const DEFAULT_PLAYLIST_SONGS = 15;
const MAX_PLAYLIST_SONGS_LIMIT = 50;

const MOOD_TOPIC_MAP = promptBuilder.getMoodTopicMap();

function isPlaylistIntent(prompt = "") {
  const text = normalizeText(prompt);
  const actionMatch = /(tao|goi y|de xuat|lam|build|recommend|play|phat|mo|tim|cho|can|muon|nghe)/.test(text);
  const entityMatch = /(playlist|danh sach|mix|mood|nhac|bai hat|bai|ca khuc|track|album)/.test(text);
  const moodAnalysis = analyzeMood(prompt);
  const hasMoodMatch = moodAnalysis.score > 0;

  const strongIntent = actionMatch && (entityMatch || hasMoodMatch);
  const explicitPlaylist = /(tao playlist|goi y playlist|de xuat playlist|play playlist|phat nhac|goi y|goi y bai|goi y nhac|cho toi nhung bai|bai vui|bai hat vui|nhung bai)/.test(text);

  return strongIntent || explicitPlaylist || (actionMatch && hasMoodMatch) || hasMoodMatch;
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
  const allArtists = await Artist.find({}).select("name avatar isVerified followersCount").lean();

  // 1. Check alias dictionary
  const { ARTIST_ALIASES } = require("./aiIntent.service");
  for (const [alias, standardName] of Object.entries(ARTIST_ALIASES)) {
    const normAlias = normalizeText(alias);
    const aliasRegex = new RegExp(`(^|\\s)${escapeRegex(normAlias)}(\\s|$)`, "i");
    if (aliasRegex.test(normalizedPrompt)) {
      const found = allArtists.find(a => normalizeText(a.name) === normalizeText(standardName));
      if (found) return [found];
    }
  }

  // 2. Exact or word-boundary whole phrase match
  const matchedExact = allArtists.filter((artist) => {
    const artistName = normalizeText(artist.name);
    if (!artistName) return false;
    if (normalizedPrompt === artistName) return true;
    const wordBoundaryRegex = new RegExp(`(^|\\s)${escapeRegex(artistName)}(\\s|$)`, "i");
    return wordBoundaryRegex.test(normalizedPrompt);
  });
  if (matchedExact.length > 0) return matchedExact;

  // 3. Token-based overlap
  const terms = normalizedPrompt
    .replace(/\b(nhac|bai|hat|cua|di|cho|minh|toi|nghe|playlist|tao|goi|y|ve|theo|ca|si|singer|artist|ban|giup|co|the|la|ai|gi|hoi|nay|khong|hinh|tam|buc|thien|nhien)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter((word) => word.length >= 2);

  return allArtists.filter((artist) => {
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

async function findSongsByArtists(artists, limit = DEFAULT_PLAYLIST_SONGS) {
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

async function findSongsByArtistHint(prompt = "", limit = DEFAULT_PLAYLIST_SONGS) {
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
  limit = DEFAULT_PLAYLIST_SONGS,
  options = {}
) {
  const { strictTopicOnly = false } = options;
  const matchedTopicIds = matchedTopics.map((topic) => topic._id);
  const prioritizedTopicIdSet = new Set(
    prioritizedTopics.map((topic) => topic?._id?.toString()).filter(Boolean)
  );

  let topicSongs = [];
  if (matchedTopicIds.length > 0) {
    topicSongs = await Song.find({
      isPublic: true,
      topicIds: { $in: matchedTopicIds },
    })
      .populate("artists", "name avatar")
      .populate("topicIds", "name description")
      .lean();
  }

  if (topicSongs.length === 0) {
    topicSongs = await Song.find({ isPublic: true })
      .populate("artists", "name avatar")
      .populate("topicIds", "name description")
      .sort({ playCount: -1, likeCount: -1, createdAt: -1 })
      .limit(30)
      .lean();
  }

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

    // Apply adaptive/personalization score if user profile options are supplied
    if (options.userProfile && !options.userProfile.isColdStart) {
      const adaptiveService = require("./adaptiveRecommendation.service");
      const recommendationService = require("./recommendation.service");
      const adaptiveDetails = adaptiveService.calculateAdaptiveScore(song, {
        userProfile: options.userProfile,
        recentProfile: options.recentProfile || null,
      });
      score += (adaptiveDetails.finalScore > 0)
        ? adaptiveDetails.finalScore
        : recommendationService.calculateSongScore(song, { userProfile: options.userProfile });
    }

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

async function findSongsByTopicsSequential(topics = [], limit = DEFAULT_PLAYLIST_SONGS, minTarget = DEFAULT_PLAYLIST_SONGS) {
  const orderedTopics = topics.filter(Boolean);
  if (!orderedTopics.length) return [];

  const targetCount = limit || minTarget;
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
    return normalizedPrompt
      ? `Mình có thể giúp bạn tìm bài hát của nghệ sĩ! Dưới đây là các ca khúc nổi bật theo yêu cầu "${normalizedPrompt}". Nếu bạn đang nghĩ tới một bài cụ thể, hãy chia sẻ thêm một đoạn lời bài hát hoặc giai điệu nhé! 🎵`
      : "Mình có thể giúp bạn tìm bài hát của nghệ sĩ! Hãy chia sẻ thêm một đoạn lời bài hát hoặc giai điệu bạn nhớ nhé! 🎵";
  }
  if (matchStatus === "fallback") {
    return "Mình chưa tìm thấy bài hát phù hợp theo đúng keyword/topic từ yêu cầu của bạn trong thư viện MusicFlow. Bạn có thể gửi cho mình một đoạn lời bài hát (lyrics) để mình tìm giúp bạn nhé!";
  }
  if (matchStatus === "partial") {
    return normalizedPrompt
      ? `Mình đã lọc theo "${normalizedPrompt}" và tìm được một phần bài hát phù hợp. Bạn có thể chia sẻ thêm gợi ý để mình tìm chính xác hơn nhé! 🎵`
      : "Mình tìm được một vài bài hát theo keyword/topic bạn yêu cầu.";
  }
  return normalizedPrompt
    ? `Mình đã lọc theo "${normalizedPrompt}" và tạo playlist phù hợp nhất có thể.`
    : "Mình đã tạo playlist theo cảm xúc của bạn.";
}


// --- GEMINI INITIALIZATION & CANDIDATES ---

function extractRecentContextFromHistory(messages = []) {
  const context = {
    recentSongs: [],
    lastSong: null,
    lastPlaylistId: null,
    lastGenre: null,
    lastArtist: null,
  };

  if (!Array.isArray(messages) || messages.length === 0) return context;

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (!msg || !msg.metadata) continue;

    const meta = msg.metadata;

    if (Array.isArray(meta.songs) && meta.songs.length > 0 && context.recentSongs.length === 0) {
      context.recentSongs = meta.songs.map((s) => ({
        _id: s._id || s.songId,
        title: s.title || s.name || "",
        artists: s.artists || (s.artist ? [s.artist] : []),
      })).filter((s) => s.title);
    }

    if ((meta.songId || meta.song) && !context.lastSong) {
      const s = meta.song || {};
      context.lastSong = {
        _id: meta.songId || s._id,
        title: s.title || meta.title || "",
        artists: s.artists || (s.artist ? [s.artist] : []),
      };
    }

    if (meta.genre && !context.lastGenre) {
      context.lastGenre = meta.genre;
    }

    if ((meta.artistId || meta.artist || meta.query) && !context.lastArtist && (meta.type === "search_artist" || meta.type === "play_song_artist")) {
      context.lastArtist = meta.artist || meta.query;
    }

    if (meta.playlistId && !context.lastPlaylistId) {
      context.lastPlaylistId = meta.playlistId;
    }
  }

  if (!context.lastSong && context.recentSongs.length > 0) {
    context.lastSong = context.recentSongs[0];
  }

  return context;
}

function resolveContextualReference(prompt = "", context = {}) {
  const text = normalizeText(prompt);

  // Check ordinal references: "bài đầu tiên", "bài 1", "bài thứ 1", "bài thứ nhất"
  const isFirst = /\b(bai\s+(dau\s+tien|1|thu\s+1|thu\s+nhat))\b/.test(text) || /\b(mo|phat)\s+(bai\s+dau|bai\s+1)\b/.test(text);
  if (isFirst && context.recentSongs && context.recentSongs.length > 0) {
    return { type: "song", song: context.recentSongs[0], index: 0 };
  }

  // "bài thứ 2", "bài 2", "bài hai", "bài thứ hai"
  const isSecond = /\b(bai\s+(2|thu\s+2|hai|thu\s+hai))\b/.test(text) || /\b(mo|phat)\s+(bai\s+2)\b/.test(text);
  if (isSecond && context.recentSongs && context.recentSongs.length > 1) {
    return { type: "song", song: context.recentSongs[1], index: 1 };
  }

  // "bài thứ 3", "bài 3", "bài ba", "bài thứ ba"
  const isThird = /\b(bai\s+(3|thu\s+3|ba|thu\s+ba))\b/.test(text);
  if (isThird && context.recentSongs && context.recentSongs.length > 2) {
    return { type: "song", song: context.recentSongs[2], index: 2 };
  }

  // Pronouns: "bài này", "nó", "mở nó đi", "phát nó", "bài đó"
  const isPronoun = /\b(mo|phat|nghe)\s+(no|cai\s+do|bai\s+do|bai\s+nay)\b/.test(text) || /\b(bai\s+nay|cai\s+nay|no)\b/.test(text);
  if (isPronoun) {
    if (context.lastSong && context.lastSong.title) {
      return { type: "song", song: context.lastSong };
    }
    if (context.recentSongs && context.recentSongs.length > 0) {
      return { type: "song", song: context.recentSongs[0] };
    }
  }

  // Affirmative confirmations: "có", "bật đi", "phát đi", "mở đi", "ừ", "ok", "được", "nghe đi", "phát luôn đi", "bật luôn đi"
  const isAffirmative = /\b(co|bat di|phat di|mo di|u|ok|duoc|nghe di|phat luon di|bat luon di|mo luon)\b/.test(text);
  if (isAffirmative) {
    if (context.lastSong && context.lastSong.title) {
      return { type: "song", song: context.lastSong };
    }
    if (context.recentSongs && context.recentSongs.length > 0) {
      return { type: "song", song: context.recentSongs[0] };
    }
  }

  return null;
}

function extractLyricsSnippet(prompt = "") {
  let text = prompt.trim();
  const quoteMatch = text.match(/["'“]([^"'”]+)["'”]/);
  if (quoteMatch && quoteMatch[1].trim().length > 2) {
    return quoteMatch[1].trim();
  }

  if (text.includes(":")) {
    const afterColon = text.split(":").slice(1).join(":").trim();
    if (afterColon.length > 2) {
      return afterColon;
    }
  }

  let cleaned = text
    .replace(/^(tôi|mình|em|anh)?\s*(nhớ|biết|nghe)?\s*(1|một)?\s*(đoạn|câu)?\s*(lyrics|lyric|lời|lời bài hát|lời bài|giai điệu của bài hát|giai điệu bài hát|giai điệu)\s*(là|thế này|như này|sau|này)?\s*:?\s*/i, "")
    .replace(/^(bài gì|bài hát gì|bài nào|tìm bài|tìm bài hát|tìm bài có|có bài gì|có bài nào)?\s*(có|chứa|hát|lời)?\s*(câu|đoạn|lời|lyrics|giai điệu)?\s*:?\s*/i, "")
    .replace(/^(lời bài hát có câu|lời có câu|câu hát là|đoạn hát là|đoạn lời là|giai điệu là)\s*:?\s*/i, "")
    .replace(/\s*(là bài gì á|là bài gì thế|là bài gì|là bài nào|tên là gì|tên gì|thuộc bài nào|thuộc bài gì|hả bạn|hả cậu|\?)\s*$/i, "")
    .trim();

  return cleaned || text;
}

function isLyricsSearchQuery(prompt = "") {
  const norm = normalizeText(prompt);
  return (
    /\b(lyrics|lyric|loi bai hat|loi bai|doan loi|cau hat|doan hat|loi co cau|cau hat la|nho mot doan|nho 1 doan|bai gi co cau|bai nao co cau|bai hat co loi|bai hat co cau|tim bai theo loi|tim bai hat theo loi|giai dieu cua bai hat|giai dieu la|nhos giai dieu)\b/i.test(norm) ||
    /\b(la bai gi|thuoc bai nao|thuoc bai gi)\b/i.test(norm) ||
    /^(tim|kiem|tra)\s+theo\s+loi\b/i.test(norm)
  );
}


function cleanSearchQuery(prompt = "") {
  let text = prompt.trim();
  let cleaned = text
    .replace(/\b(tôi|mình|em|anh)?\s*(muốn|cần|hãy)?\s*(tìm|kiếm|cho tôi|mình muốn tìm|phát|bật|mở|nghe|có|cho nghe)\s*(1|một)?\s*(bài hát|bài|ca khúc|nhạc)?\s*(của|do)?\s*/gi, " ")
    .replace(/\b(bài hát đó của|bài đó của|bài của|ca khúc của|nhạc của|của)\b/gi, " ")
    .replace(/\b(và tên bài hát đó có từ|và tên bài có từ|tên bài hát đó có từ|tên bài có từ|tên bài hát là|tên bài là|tên bài hát đó|tên bài đó)\b/gi, " ")
    .replace(/\b(mà tôi|mà mình|mà em|tôi|mình|em)?\s*(chỉ nhớ được|chỉ nhớ là|chỉ nhớ mỗi|chỉ nhớ|nhớ được|nhớ là)\s*(từ|chữ|đoạn|câu)?\b/gi, " ")
    .replace(/\b(của tên bài hát đó thôi|của tên bài hát|trong tên bài hát|trong tên bài|của bài hát đó|trong bài hát đó|của bài đó|đó thôi|thôi|nha|nhé|đi|giúp mình|giúp tôi)\b/gi, " ")
    .replace(/\b(có chữ|có từ|tên là|tên|đoạn|chứa từ|chứa chữ|từ khóa|từ|chữ)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || text;
}




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

// System instructions built dynamically via PromptBuilder Service
function buildSystemInstruction(actorRole, options = {}) {
  return promptBuilder.buildSystemInstruction(actorRole, options);
}

// Define Tools (Function Declarations) dynamically for Gemini based on role
function getToolsForRole(actorRole) {
  const declarations = [
    {
      name: "search_music",
      description: "Tìm kiếm hoặc đề xuất âm nhạc theo bài hát, nghệ sĩ, thể loại / quốc gia (ví dụ: 'nhạc Trung' / 'Nhạc Hoa (C-Pop)', 'US-UK', 'V-Pop', 'Lofi', 'EDM', 'Sad', 'Chill'...), hoặc theo tâm trạng cảm xúc (buồn, chill, vui, tập trung...).",
      parameters: {
        type: "OBJECT",
        properties: {
          intent: {
            type: "STRING",
            description: "Ý định: 'SEARCH_SONG', 'SEARCH_ARTIST', 'SEARCH_GENRE', 'RECOMMEND_SONG', 'PLAY_MUSIC'",
            enum: ["SEARCH_SONG", "SEARCH_ARTIST", "SEARCH_GENRE", "RECOMMEND_SONG", "PLAY_MUSIC"],
          },
          songTitle: { type: "STRING", description: "Tên bài hát cần tìm (nếu có)." },
          artist: { type: "STRING", description: "Tên ca sĩ / nghệ sĩ (nếu có, ví dụ: 'Phi Nhung', 'Khánh Phương', 'Sơn Tùng M-TP')." },
          genre: { type: "STRING", description: "Thể loại hoặc quốc gia (nếu có, ví dụ: 'nhạc Trung', 'Nhạc Hoa (C-Pop)', 'US-UK', 'V-Pop', 'Lofi', 'EDM', 'Sad', 'Rock')." },
          mood: { type: "STRING", description: "Tâm trạng / cảm xúc (nếu có, ví dụ: 'sad', 'buồn', 'chill', 'vui')." },
          query: { type: "STRING", description: "Từ khóa tóm tắt ngắn gọn hoặc lời bài hát." },
          action: {
            type: "STRING",
            description: "Hành động: 'play' nếu phát ngay bài hát, 'search' nếu hiển thị danh sách kết quả để chọn.",
            enum: ["play", "search"],
          },
        },
      },
    },


    {
      name: "play_song",
      description: "Phát bài hát bằng tiêu đề, ca sĩ, hoặc theo số thứ tự (index: 1 cho bài đầu tiên trong danh sách vừa được AI đề xuất ở lượt trước, 2 cho bài thứ 2...).",
      parameters: {
        type: "OBJECT",
        properties: {
          index: { type: "NUMBER", description: "Thứ tự bài hát trong kết quả vừa đề xuất ở lượt trước (1 cho bài đầu tiên)." },
          title: { type: "STRING", description: "Tên bài hát cần phát." },
          artist: { type: "STRING", description: "Tên ca sĩ (nếu có)." },
        },
      },
    },
    {
      name: "get_song_story",
      description: "Giải thích ý nghĩa, câu chuyện hoặc thông điệp của một bài hát cụ thể (hoặc bài đang phát / bài trong hội thoại).",
      parameters: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING", description: "Tên bài hát cần giải thích ý nghĩa." },
        },
      },
    },
    {
      name: "open_route",
      description: "Chuyển hướng người dùng đến màn hình chức năng cụ thể trên ứng dụng.",
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
      name: "generate_image",
      description: "CHỈ DÙNG KHI người dùng có ý định trực tiếp yêu cầu tạo/vẽ/sinh HÌNH ẢNH hoặc ẢNH BÌA (ví dụ: 'vẽ cho tôi', 'tạo ảnh', 'generate image', 'tạo bức hình', 'vẽ tranh', 'thiết kế ảnh bìa'). KHÔNG ĐƯỢC CHỌN TOOL NÀY khi người dùng yêu cầu tạo playlist, đề xuất bài hát, tìm nhạc hoặc nghe nhạc.",
      parameters: {
        type: "OBJECT",
        properties: {
          prompt: { type: "STRING", description: "Mô tả chi tiết bằng tiếng Việt hoặc tiếng Anh về hình ảnh cần vẽ/tạo." },
          title: { type: "STRING", description: "Chủ đề hoặc tiêu đề ngắn gọn của bức ảnh." },
        },
        required: ["prompt"],
      },
    },
  ];

  // AI DJ (Mood Playlist) chỉ dành riêng cho User và Admin, KHÔNG cấp cho Artist
  if (actorRole !== "artist") {
    declarations.push({
      name: "create_mood_playlist",
      description: "Tạo danh sách phát nhạc (playlist) dựa trên cảm xúc, tâm trạng (sad, happy, chill, focus, energetic, romantic, sleep, party, angry), ca sĩ hoặc số lượng bài hát yêu cầu.",
      parameters: {
        type: "OBJECT",
        properties: {
          mood: {
            type: "STRING",
            description: "Tâm trạng hoặc cảm xúc của người dùng.",
            enum: ["sad", "happy", "chill", "focus", "energetic", "romantic", "sleep", "party", "angry"],
          },
          artist: { type: "STRING", description: "Tên ca sĩ chỉ định (nếu có)." },
          count: {
            type: "NUMBER",
            description: "Số lượng bài hát người dùng muốn có trong playlist (ví dụ: 10, 20, 25...). Không bắt buộc; nếu người dùng không yêu cầu số lượng cụ thể thì để trống (hệ thống sẽ tự mặc định là 15 bài).",
          },
        },
        required: ["mood"],
      },
    });
  }

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
   * Centralized structured music action executor.
   * Handles 8 intents, executes database search, formats natural responses,
   * attaches clientActions, and maintains contextual memory.
   */
  async executeMusicAction(params = {}) {
    const intentData = params.intentData || params;
    const {
      actorRole,
      cleanPrompt,
      recentContext = {},
      actorId,
      conversationId,
      activeModelName = null,
      userTier = "basic",
      mode = "chat",
    } = params;
    let assistantText = "";
    let clientActions = [];
    let playlist = null;
    let songs = [];
    let metadata = {};

    const searchService = require("./search.service");
    const aiIntent = require("./aiIntent.service");

    const intent = intentData.intent || params.intent || aiIntent.INTENTS.RECOMMEND_SONG;
    const action = intentData.action || params.action || "search";
    const songTitle = intentData.songTitle || params.songTitle || null;
    const artist = intentData.artist || intentData.artistName || params.artist || params.artistName || null;
    const genre = intentData.genre || params.genre || null;
    const mood = intentData.mood || params.mood || null;
    const query = intentData.query || params.query || cleanPrompt;
    const index = intentData.index || params.index || params.targetIndex || null;
    const referenceType = intentData.referenceType || params.referenceType || params.followUpType || null;
    const isLyrics = intentData.isLyrics ?? params.isLyrics ?? false;
    const lyricsSnippet = intentData.lyricsSnippet || params.lyricsSnippet || null;
    const count = intentData.count || params.count || null;

    // 1. FOLLOW_UP / ORDINAL / CONTEXTUAL REFERENCE
    if (intent === aiIntent.INTENTS.FOLLOW_UP || (referenceType && referenceType !== "none") || index) {
      if (index || referenceType === "first" || referenceType === "ordinal") {
        const targetIdx = index || (referenceType === "first" ? 1 : 1);
        const targetSong = recentContext?.recentSongs?.[targetIdx - 1];
        if (targetSong) {
          const fullSong = (await findSongByTitle(targetSong.title)) || targetSong;
          const artistList = artistNames(fullSong).join(", ");
          assistantText = `Được rồi, mình đang bật bài "${fullSong.title}"${artistList ? ` của ${artistList}` : ""} cho bạn thưởng thức nhé! 🎵`;
          clientActions.push({
            type: "PLAY_SONG",
            payload: { songId: fullSong._id, song: fullSong, songs: [fullSong] },
          });
          songs = [fullSong];
          metadata = { type: "play_song", songId: fullSong._id, song: fullSong, index: targetIdx };
          return { assistantText, clientActions, playlist, songs, metadata };
        } else {
          assistantText = `Trước đó mình chưa có danh sách bài hát nào để chọn bài số ${targetIdx}. Bạn muốn nghe bài hát hoặc thể loại gì nào? 🎵`;
          metadata = { type: "follow_up_no_context" };
          return { assistantText, clientActions, playlist, songs, metadata };
        }
      }

      if (referenceType === "more") {
        const lastGenre = recentContext?.lastGenre;
        const lastArtist = recentContext?.lastSong?.artists?.[0];
        let moreSongs = [];
        if (lastGenre) {
          const res = await searchService.searchSongs({ query: lastGenre, genre: lastGenre, limit: 15 });
          moreSongs = res?.songs || [];
        } else if (lastArtist) {
          const artistDoc = await findMatchedArtists(typeof lastArtist === "object" ? lastArtist.name : lastArtist);
          if (artistDoc.length > 0) {
            moreSongs = await findSongsByArtists(artistDoc, 15);
          }
        } else {
          const res = await searchService.searchSongs({ query: cleanPrompt, limit: 10 });
          moreSongs = res?.songs || [];
        }

        const existingIds = new Set((recentContext?.recentSongs || []).map(s => String(s._id || s.songId)));
        const filteredSongs = moreSongs.filter(s => !existingIds.has(String(s._id)));
        const candidates = filteredSongs.length > 0 ? filteredSongs : moreSongs;

        if (candidates.length > 0) {
          const titles = candidates.slice(0, 5).map((s, idx) => `${idx + 1}. ${s.title} - ${artistNames(s).join(", ")}`).join("\n");
          assistantText = `Dưới đây là một số bài hát tiếp theo dành cho bạn:\n\n${titles}\n\nBạn muốn nghe bài nào tiếp theo nhé? Bạn có thể bảo mình "phát bài đầu tiên" nhé! 🎵`;
          clientActions.push({
            type: "SHOW_SEARCH_RESULTS",
            payload: { query: "tiếp theo", songs: candidates },
          });
          songs = candidates;
          metadata = { type: "search_music", query: "more", songs: candidates };
          return { assistantText, clientActions, playlist, songs, metadata };
        } else {
          assistantText = `Đó là những ca khúc nổi bật nhất thuộc chủ đề này trong thư viện MusicFlow rồi. Bạn có muốn đổi sang một thể loại hay ca sĩ khác không? 🎵`;
          metadata = { type: "search_music_no_more" };
          return { assistantText, clientActions, playlist, songs, metadata };
        }
      }

      if (referenceType === "artist_ref") {
        const lastArtist = recentContext?.lastSong?.artists?.[0];
        const artistName = typeof lastArtist === "object" ? lastArtist.name : lastArtist;
        if (artistName) {
          const matched = await findMatchedArtists(artistName);
          const songsList = matched.length > 0 ? await findSongsByArtists(matched, 10) : [];
          if (songsList.length > 0) {
            const titles = songsList.slice(0, 5).map((s, idx) => `${idx + 1}. ${s.title}`).join("\n");
            assistantText = `Dưới đây là các ca khúc nổi bật khác của ca sĩ ${artistName}:\n\n${titles}\n\nBạn muốn nghe bài nào nhé? 🎵`;
            clientActions.push({
              type: "SHOW_SEARCH_RESULTS",
              payload: { query: artistName, songs: songsList },
            });
            songs = songsList;
            metadata = { type: "search_artist", artistId: matched[0]._id, songs: songsList };
            return { assistantText, clientActions, playlist, songs, metadata };
          }
        }
      }

      if (referenceType === "pronoun") {
        const targetSong = recentContext?.lastSong || recentContext?.recentSongs?.[0];
        if (targetSong) {
          const fullSong = (await findSongByTitle(targetSong.title)) || targetSong;
          const artistList = artistNames(fullSong).join(", ");
          assistantText = `Được rồi, mình đang bật bài "${fullSong.title}"${artistList ? ` của ${artistList}` : ""} cho bạn nghe nhé! 🎵`;
          clientActions.push({
            type: "PLAY_SONG",
            payload: { songId: fullSong._id, song: fullSong, songs: [fullSong] },
          });
          songs = [fullSong];
          metadata = { type: "play_song", songId: fullSong._id, song: fullSong };
          return { assistantText, clientActions, playlist, songs, metadata };
        } else {
          assistantText = `Hiện tại mình chưa thấy bài hát nào trong cuộc trò chuyện trước đó để phát. Bạn muốn nghe bài hát hoặc thể loại gì nào? 🎵`;
          metadata = { type: "follow_up_no_context" };
          return { assistantText, clientActions, playlist, songs, metadata };
        }
      }
    }

    // 2. SEARCH_GENRE / COUNTRY RECOMMENDATIONS
    if (intent === aiIntent.INTENTS.SEARCH_GENRE || (genre && intent !== aiIntent.INTENTS.CREATE_PLAYLIST && intent !== aiIntent.INTENTS.PLAY_MUSIC)) {
      const resolved = aiIntent.resolveGenreFromPrompt(genre || cleanPrompt);
      const targetGenre = resolved ? resolved.topicName : (genre || cleanPrompt);
      const searchRes = await searchService.searchSongs({ query: targetGenre, genre: targetGenre, limit: 15 });
      const songsList = searchRes?.songs || [];

      if (songsList.length > 0) {
        if (action === "play" || mode === "voice") {
          const firstSong = songsList[0];
          const artistStr = artistNames(firstSong).join(", ");
          assistantText = `Đang phát các ca khúc ${targetGenre} nổi bật cho bạn nghe nhé! Mở đầu là bài "${firstSong.title}"${artistStr ? ` của ${artistStr}` : ""}. 🎵`;
          clientActions.push({
            type: "PLAY_SONG",
            payload: { songId: firstSong._id, song: firstSong, songs: songsList },
          });
          songs = [firstSong];
          metadata = { type: "play_song_genre", genre: targetGenre, songId: firstSong._id, songs: songsList };
        } else {
          const titles = songsList.slice(0, 5).map((s, idx) => `${idx + 1}. ${s.title} - ${artistNames(s).join(", ")}`).join("\n");
          assistantText = `Nếu bạn muốn nghe nhạc ${targetGenre}, thư viện MusicFlow có những bài hát rất nổi bật:\n\n${titles}\n\nBạn muốn nghe bài nào trong các bài này? Bạn chỉ cần bảo mình "phát bài đầu tiên" hoặc nói tên bài nhé! 🎵`;
          clientActions.push({
            type: "SHOW_SEARCH_RESULTS",
            payload: { query: targetGenre, songs: songsList },
          });
          songs = songsList;
          metadata = { type: "search_genre", genre: targetGenre, songs: songsList, count: songsList.length };
        }
        return { assistantText, clientActions, playlist, songs, metadata };
      } else {
        assistantText = `Hiện tại trong thư viện MusicFlow chưa có ca khúc nào thuộc thể loại ${targetGenre}. Bạn có thể thử các thể loại phổ biến khác như Nhạc Hoa (C-Pop), V-Pop, Lofi, EDM hay Nhạc Âu Mỹ (US-UK) nhé! 🎵`;
        metadata = { type: "search_genre_empty", genre: targetGenre };
        return { assistantText, clientActions, playlist, songs, metadata };
      }
    }

    // 3. SEARCH_ARTIST
    if (intent === aiIntent.INTENTS.SEARCH_ARTIST || (artist && intent !== aiIntent.INTENTS.PLAY_MUSIC && intent !== aiIntent.INTENTS.CREATE_PLAYLIST)) {
      const targetArtist = artist || cleanPrompt;
      const matchedArtists = await findMatchedArtists(targetArtist);

      if (matchedArtists.length > 0) {
        const songsList = await findSongsByArtists(matchedArtists, 15);
        const artistNameStr = matchedArtists[0].name;

        if (songsList.length > 0) {
          if (action === "play" || (mode === "voice" && songsList.length === 1)) {
            const firstSong = songsList[0];
            const artistStr = artistNames(firstSong).join(", ");
            assistantText = `Đang phát các ca khúc của ca sĩ ${artistNameStr} cho bạn nhé! Mở đầu là bài "${firstSong.title}". 🎵`;
            clientActions.push({
              type: "PLAY_SONG",
              payload: { songId: firstSong._id, song: firstSong, songs: songsList },
            });
            songs = [firstSong];
            metadata = { type: "play_song_artist", artistId: matchedArtists[0]._id, songId: firstSong._id, songs: songsList, artist: artistNameStr };
          } else {
            const titles = songsList.slice(0, 5).map((s, idx) => `${idx + 1}. ${s.title}`).join("\n");
            assistantText = `Trong thư viện MusicFlow hiện có ${songsList.length} ca khúc của ca sĩ ${artistNameStr}:\n\n${titles}\n\nBạn muốn nghe bài nào trong các bài này? Bạn có thể bảo mình "phát bài đầu tiên" nhé! 🎵`;
            clientActions.push({
              type: "SHOW_SEARCH_RESULTS",
              payload: { query: artistNameStr, songs: songsList },
            });
            songs = songsList;
            metadata = { type: "search_artist", artistId: matchedArtists[0]._id, songs: songsList, count: songsList.length, artist: artistNameStr };
          }
          return { assistantText, clientActions, playlist, songs, metadata };
        } else {
          assistantText = `Ca sĩ ${artistNameStr} đã có thông tin trên MusicFlow nhưng hiện tại chưa có bài hát nào được tải lên. Bạn có thể thử tìm kiếm một nghệ sĩ khác nhé! 🎵`;
          metadata = { type: "artist_no_songs", artistId: matchedArtists[0]._id, artist: artistNameStr };
          return { assistantText, clientActions, playlist, songs, metadata };
        }
      } else {
        // Artist not in database: do NOT invent, report clearly and recommend available top artists
        const sampleArtists = await Artist.find({}).limit(3).select("name").lean();
        const sampleStr = sampleArtists.map(a => a.name).join(", ");
        assistantText = `Hiện tại trong thư viện MusicFlow chưa có bài hát nào của ca sĩ ${targetArtist}. Bạn có thể khám phá các nghệ sĩ nổi bật khác đang có trên hệ thống như ${sampleStr}, hoặc cho mình biết thể loại nhạc bạn muốn nghe nhé! 🎵`;
        metadata = { type: "artist_not_found", query: targetArtist };
        return { assistantText, clientActions, playlist, songs, metadata };
      }
    }

    // 4. PLAY_MUSIC (Specific song title or direct command)
    if (intent === aiIntent.INTENTS.PLAY_MUSIC) {
      const targetTitle = songTitle || cleanSearchQuery(cleanPrompt) || cleanPrompt;
      let targetSong = await findSongByTitle(targetTitle);
      if (!targetSong) {
        const searchRes = await searchService.searchSongs({ query: targetTitle, limit: 1 });
        targetSong = searchRes?.songs?.[0];
      }

      if (targetSong) {
        const artistStr = artistNames(targetSong).join(", ");
        assistantText = `Được rồi, mình đang bật bài "${targetSong.title}"${artistStr ? ` của ${artistStr}` : ""} cho bạn nghe nhé! 🎵`;
        clientActions.push({
          type: "PLAY_SONG",
          payload: { songId: targetSong._id, song: targetSong, songs: [targetSong] },
        });
        songs = [targetSong];
        metadata = { type: "play_song", songId: targetSong._id, song: targetSong };
        return { assistantText, clientActions, playlist, songs, metadata };
      } else {
        assistantText = `Hiện tại mình chưa tìm thấy bài hát "${targetTitle}" trong hệ thống MusicFlow. Bạn có thể kiểm tra lại tên bài hoặc gửi thêm tên ca sĩ để mình tìm giúp nhé! 🎵`;
        metadata = { type: "play_song_failed", query: targetTitle };
        return { assistantText, clientActions, playlist, songs, metadata };
      }
    }

    // 5. RECOMMEND_SONG / CREATE_PLAYLIST
    if (intent === aiIntent.INTENTS.CREATE_PLAYLIST || intent === aiIntent.INTENTS.RECOMMEND_SONG) {
      if (intent === aiIntent.INTENTS.CREATE_PLAYLIST) {
        if (actorRole === "artist") {
          assistantText = "Tính năng tạo danh sách phát (AI DJ) chỉ dành riêng cho tài khoản người nghe. Với vai trò Nghệ sĩ, bạn có thể yêu cầu mình phân tích số liệu bài hát, gợi ý ý tưởng sáng tác, hoặc tra cứu thông tin trong Studio nhé! 🎨";
          metadata = { type: "artist_forbidden_ai_dj" };
          return { assistantText, clientActions, playlist, songs, metadata };
        }

        const analysis = analyzeMood(cleanPrompt);
        const reqCount = count || aiIntent.extractRequestedCount(cleanPrompt);
        const resObj = await this.generatePlaylistInternal({
          prompt: cleanPrompt,
          mood: mood || analysis.mood,
          count: reqCount,
          userId: actorId,
          conversationId,
          activeModelName,
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
          mood: mood || analysis.mood,
          matchStatus: resObj.matchStatus,
          songs: songs,
        };
        return { assistantText, clientActions, playlist, songs, metadata };
      }

      // RECOMMEND_SONG by mood / vibe
      const targetMood = mood || analyzeMood(cleanPrompt).mood || "chill";
      const searchRes = await searchService.searchSongs({
        query: targetMood === "sad" ? "nhạc buồn" : (targetMood === "chill" ? "chill" : cleanPrompt),
        limit: 10,
      });
      const songsList = searchRes?.songs || [];

      if (songsList.length > 0) {
        const moodDesc = targetMood === "sad" ? "nhẹ nhàng, lắng đọng" : (targetMood === "chill" ? "thư giãn, chill nhẹ" : "phù hợp");
        const titles = songsList.slice(0, 5).map((s, idx) => `${idx + 1}. ${s.title} - ${artistNames(s).join(", ")}`).join("\n");
        assistantText = `Dưới đây là một số ca khúc ${moodDesc} với tâm trạng của bạn:\n\n${titles}\n\nBạn muốn nghe bài nào? Bạn có thể bảo mình "phát bài đầu tiên" nhé! 🎵`;
        clientActions.push({
          type: "SHOW_SEARCH_RESULTS",
          payload: { query: cleanPrompt, songs: songsList },
        });
        songs = songsList;
        metadata = { type: "recommend_songs", mood: targetMood, songs: songsList };
        return { assistantText, clientActions, playlist, songs, metadata };
      }
    }

    // 6. SEARCH_SONG (By lyrics or title)
    if (isLyrics || isLyricsSearchQuery(cleanPrompt)) {
      const snippet = lyricsSnippet || extractLyricsSnippet(cleanPrompt) || query;
      const searchRes = await searchService.searchSongs({ query: snippet, limit: 10 });
      const candidateSongs = searchRes?.songs || [];

      const { extractCleanLyrics } = require("../utils/string.util");
      const normSnippet = normalizeText(snippet);
      const foundSong = candidateSongs.find((s) => {
        const normLyrics = normalizeText(extractCleanLyrics(s.lyrics || ""));
        const normTitle = normalizeText(s.title || "");
        if (!normLyrics && !normTitle) return false;
        if (normLyrics.includes(normSnippet) || normTitle.includes(normSnippet)) return true;
        const snippetWords = normSnippet.split(" ").filter(w => w.length >= 2);
        if (snippetWords.length >= 3) {
          const overlap = snippetWords.filter(w => normLyrics.includes(w)).length;
          if (overlap / snippetWords.length >= 0.7) return true;
        }
        return false;
      });

      if (foundSong) {
        const artistStr = artistNames(foundSong).join(", ");
        assistantText = `Đoạn lời "${snippet}" thuộc bài hát "${foundSong.title}"${artistStr ? ` của ${artistStr}` : ""}. Mình đang phát bài hát này cho bạn thưởng thức nhé! 🎵`;
        clientActions.push({
          type: "PLAY_SONG",
          payload: { songId: foundSong._id, song: foundSong, songs: [foundSong] },
        });
        songs = [foundSong];
        metadata = { type: "play_song_by_lyrics", songId: foundSong._id, song: foundSong, query: snippet };
      } else {
        assistantText = `Hiện tại trong thư viện MusicFlow chưa có bài hát nào chứa đoạn lời "${snippet}". Bạn có thể thử một đoạn lời khác hoặc chia sẻ thêm tên ca sĩ để mình tìm giúp bạn nhé! 🎵`;
        metadata = { type: "search_lyrics_failed", query: snippet };
      }
      return { assistantText, clientActions, playlist, songs, metadata };
    }

    // 7. General search fallback by title / keyword
    const searchRes = await searchService.searchSongs({ query: songTitle || query || cleanPrompt, limit: 10 });
    const songsList = searchRes?.songs || [];

    if (songsList.length > 0) {
      const titles = songsList.slice(0, 5).map((s, idx) => `${idx + 1}. ${s.title} - ${artistNames(s).join(", ")}`).join("\n");
      assistantText = `Mình đã tìm thấy một số ca khúc phù hợp với yêu cầu "${songTitle || query}":\n\n${titles}\n\nBạn muốn nghe bài nào trong các bài này? 🎵`;
      clientActions.push({
        type: "SHOW_SEARCH_RESULTS",
        payload: { query: songTitle || query, songs: songsList },
      });
      songs = songsList;
      metadata = { type: "search_music", query: songTitle || query, songs: songsList, count: songsList.length };
    } else {
      assistantText = `Hiện tại trong thư viện MusicFlow chưa tìm thấy bài hát nào phù hợp với yêu cầu "${songTitle || query}". Bạn có thể thử tìm theo tên ca sĩ khác hoặc thể loại nhạc nhé! 🎵`;
      metadata = { type: "search_music_failed", query: songTitle || query };
    }

    return { assistantText, clientActions, playlist, songs, metadata };
  }

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
    mode = "chat",
  }) {
    const rawPrompt = typeof prompt === "string" ? prompt.trim() : "";
    const cleanPrompt = rawPrompt;
    if (!cleanPrompt) {
      throw new Error("Prompt is empty");
    }

    // Quota & Concurrency handling by role
    const aiQuotaService = require("./aiQuota.service");
    if (actorRole === "admin") {
      // Admin: Bypass toàn bộ quota nội bộ của MusicFlow và không áp dụng user lock 15s
    } else if (actorRole === "artist") {
      // Artist: Áp dụng lock và kiểm tra Artist Quota (30 requests / 24h)
      aiQuotaService.acquireLock(actorId, actorRole);
      try {
        await aiQuotaService.checkArtistQuota(actorId);
      } catch (err) {
        aiQuotaService.releaseLock(actorId);
        throw err;
      }
    } else {
      // User: Áp dụng lock và kiểm tra User Quota theo gói cước (Free: 5, GO: 10, PLUS: 15, PREMIUM: 20)
      aiQuotaService.acquireLock(actorId, actorRole);
      try {
        await aiQuotaService.checkQuota(actorId, actorRole);
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

      // 2. Fetch recent messages & extract context memory
      const recentMessages = await AssistantMessage.find({ conversationId: conversation._id })
        .sort({ createdAt: 1, _id: 1 })
        .limit(30)
        .lean();

      const recentContext = extractRecentContextFromHistory(recentMessages);

      let assistantText = "";
      let clientActions = [];
      let playlist = null;
      let songs = [];
      let metadata = {};

      // Determine user tier for targeted model routing & fetch user profile memory
      const aiQuotaService = require("./aiQuota.service");
      const personalizationService = require("./personalization.service");
      let userTier = "basic";
      let userProfile = null;
      if (actorType === "User" && actorId) {
        const userDoc = await User.findById(actorId).populate("premiumPlan").lean();
        userTier = aiQuotaService.getUserTier(userDoc);
        userProfile = await personalizationService.getUserMusicProfile(actorId);
      } else if (actorType === "Artist" && actorId) {
        const artistDoc = await Artist.findById(actorId).lean();
        const isPro = Boolean(artistDoc && artistDoc.isPro && artistDoc.proExpiry && new Date(artistDoc.proExpiry) > new Date());
        userTier = isPro ? "premium" : "basic";
      }

      // Prepare context summary string
      let contextMemorySummary = "";
      if (recentContext.recentSongs.length > 0) {
        const songListStr = recentContext.recentSongs
          .map((s, idx) => `${idx + 1}. ${s.title}${s.artists?.length ? ` (${s.artists.map(a => a.name || a).join(", ")})` : ""}`)
          .join(", ");
        contextMemorySummary += `[Context Memory - Recent Results: ${songListStr}] `;
      }
      if (recentContext.lastSong?.title) {
        contextMemorySummary += `[Context Memory - Current Song/Item: ${recentContext.lastSong.title}] `;
      }

      // 3. AI Preprocessing via Mistral Orchestrator & Gemini Model Router
      if (process.env.GEMINI_API_KEY) {
        const geminiRouter = require("./geminiRouter.service");
        const aiOrchestrator = require("./aiOrchestrator.service");
        const systemInstruction = buildSystemInstruction(actorRole, {
          aiMemory: userProfile?.aiMemory,
          mode,
        });

        // Preprocess prompt via Orchestrator (Bypass / Mistral Enricher / Fallback)
        const orchestration = await aiOrchestrator.processUserRequest({ userPrompt: cleanPrompt });
        let promptForGemini = orchestration.promptForGemini || cleanPrompt;
        if (contextMemorySummary) {
          promptForGemini = `${contextMemorySummary}\n${promptForGemini}`;
        }

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

                if (name === "generate_image") {
                  const normalizedPrompt = normalizeText(cleanPrompt);
                  const hasExplicitImageKeyword = /(anh|hinh|image|picture|photo|artwork|pic|ve|draw|tranh|bua)/i.test(normalizedPrompt);
                  const hasPlaylistKeyword = /(playlist|danh sach|nhac|bai hat|goi y|de xuat)/i.test(normalizedPrompt);

                  if (hasPlaylistKeyword && !hasExplicitImageKeyword) {
                    if (actorRole === "artist") {
                      assistantText = "Tính năng tạo danh sách phát (AI DJ) chỉ dành riêng cho tài khoản người nghe. Với vai trò Nghệ sĩ, bạn có thể yêu cầu mình phân tích số liệu bài hát, gợi ý ý tưởng sáng tác, hoặc tra cứu thông tin trong Studio nhé! 🎨";
                      metadata = { type: "artist_forbidden_ai_dj" };
                    } else {
                      const resObj = await this.generatePlaylistInternal({
                        prompt: cleanPrompt,
                        count: aiIntent.extractRequestedCount(cleanPrompt),
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
                        matchStatus: resObj.matchStatus,
                        songs: songs,
                      };
                    }
                  } else {
                    const imageService = require("./imageGenerator.service");
                    const imgRes = await imageService.generateImage({
                      prompt: args.prompt || cleanPrompt,
                      title: args.title || "Tác phẩm AI",
                    });

                    assistantText = "🎨 Mình đã sáng tạo xong bức ảnh AI cho bạn dựa trên mô tả của bạn:";
                    clientActions.push({
                      type: "SHOW_IMAGE",
                      payload: { imageUrl: imgRes.imageUrl, prompt: cleanPrompt, title: imgRes.title },
                    });
                    metadata = { type: "generate_image", imageUrl: imgRes.imageUrl, prompt: cleanPrompt, title: imgRes.title, provider: imgRes.provider, enrichedPrompt: imgRes.enrichedPrompt };
                  }
                } else if (name === "play_song") {
                  const result = await this.executeMusicAction({
                    intent: aiIntent.INTENTS.PLAY_MUSIC,
                    songTitle: args.title,
                    index: args.index,
                    cleanPrompt,
                    recentContext,
                    actorId,
                    actorRole,
                    conversationId: conversation._id,
                    userTier,
                    activeModelName: modelName,
                    mode,
                  });
                  assistantText = result.assistantText;
                  clientActions.push(...result.clientActions);
                  songs = result.songs;
                  metadata = result.metadata;
                } else if (name === "search_music" || name === "search_songs_natural") {
                  const derivedIntent = args.intent || (args.action === "play" ? aiIntent.INTENTS.PLAY_MUSIC : (args.genre ? aiIntent.INTENTS.SEARCH_GENRE : (args.artist ? aiIntent.INTENTS.SEARCH_ARTIST : aiIntent.INTENTS.SEARCH_SONG)));
                  const result = await this.executeMusicAction({
                    intent: derivedIntent,
                    songTitle: args.songTitle || args.title,
                    artistName: args.artist,
                    genre: args.genre,
                    mood: args.mood,
                    action: args.action,
                    query: args.query || cleanPrompt,
                    cleanPrompt,
                    recentContext,
                    actorId,
                    actorRole,
                    conversationId: conversation._id,
                    userTier,
                    activeModelName: modelName,
                    mode,
                  });
                  assistantText = result.assistantText;
                  clientActions.push(...result.clientActions);
                  songs = result.songs;
                  if (result.playlist) playlist = result.playlist;
                  metadata = result.metadata;
                } else if (name === "open_route") {
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
                  if (actorRole === "artist") {
                    assistantText = "Tính năng tạo danh sách phát (AI DJ) chỉ dành riêng cho tài khoản người nghe. Với vai trò Nghệ sĩ, bạn có thể yêu cầu mình phân tích số liệu bài hát, gợi ý ý tưởng sáng tác, hoặc tra cứu thông tin trong Studio nhé! 🎨";
                    metadata = { type: "artist_forbidden_ai_dj" };
                  } else {
                    const resObj = await this.generatePlaylistInternal({
                      prompt: cleanPrompt,
                      mood: args.mood,
                      artistHint: args.artist,
                      count: args.count || aiIntent.extractRequestedCount(cleanPrompt),
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
                      songs: songs,
                    };
                  }
                } else if (name === "get_song_story") {
                  let songTitle = args.title;
                  if (!songTitle || songTitle === "bài này" || songTitle === "nó") {
                    songTitle = recentContext.lastSong?.title || cleanPrompt;
                  }
                  const resMeaning = await resolveSongMeaning(songTitle);
                  assistantText = resMeaning.text;
                  metadata = resMeaning.metadata;
                  if (resMeaning.song) {
                    songs = [resMeaning.song];
                  }
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
                  metadata = { type: "get_artist_songs", count: songsList.length, songs: songsList };
                } else if (name === "search_accounts_admin" && actorRole === "admin") {
                  const accounts = await User.find({ role: "user" }).limit(10).lean();
                  const names = accounts.map((u, idx) => `${idx + 1}. ${u.name} (${u.email})`).join("\n");
                  assistantText = `Danh sách người dùng:\n${names}`;
                  clientActions.push({
                    type: "SHOW_ADMIN_ACCOUNTS",
                    payload: { accounts },
                  });
                  metadata = { type: "search_accounts", query: args };
                } else if (name === "generate_image") {
                  const imageService = require("./imageGenerator.service");
                  const imgRes = await imageService.generateImage({
                    prompt: args.prompt || cleanPrompt,
                    title: args.title || "Tác phẩm AI",
                  });

                  assistantText = "🎨 Mình đã sáng tạo xong bức ảnh AI cho bạn dựa trên mô tả của bạn:";
                  clientActions.push({
                    type: "SHOW_IMAGE",
                    payload: { imageUrl: imgRes.imageUrl, prompt: cleanPrompt, title: imgRes.title },
                  });
                  metadata = { type: "generate_image", imageUrl: imgRes.imageUrl, prompt: cleanPrompt, title: imgRes.title, provider: imgRes.provider, enrichedPrompt: imgRes.enrichedPrompt };
                } else {
                  assistantText = "Xin lỗi, chức năng này chưa thể thực hiện được hoặc bị từ chối do không đúng vai trò.";
                }
              } else {
                // Conversational response without tool call
                assistantText = response.text().trim();
                metadata = { type: "chat_only" };

                // Post-Gemini Validation: Detect when Gemini hallucinated a "not found"
                // response without actually searching the database.
                // If the user's prompt is clearly a music intent (play/search/artist/genre),
                // and Gemini returned text suggesting failure without calling any tool,
                // reset and let the Smart Fallback Engine handle it with real DB queries.
                const geminiNotFoundIndicators = /(chưa tìm thấy|không tìm thấy|không có trong|chưa có bài|rất tiếc|xin lỗi.*không.*tìm|sorry.*find|not found)/i;
                const isMusicIntent = /(phat|bat|mo|nghe|tim|kiem|co bai|co nhac|nhac cua|bai cua|bai hat|ca khuc|ca si|nghe si|nhac|the loai|playlist)/i.test(normalizeText(cleanPrompt));
                const isImageReq = /(draw|create image|generate image|artwork|tam hinh|tam anh|buc tranh|buc anh|buc hinh)/i.test(normalizeText(cleanPrompt)) || (/\b(tao|sinh|ve)\b.*?\b(anh|hinh|tranh)\b/i.test(normalizeText(cleanPrompt)) && !/\b(playlist|danh sach|nhac|bai hat|ca khuc|am nhac)\b/i.test(normalizeText(cleanPrompt)));
                if (geminiNotFoundIndicators.test(assistantText) && isMusicIntent) {
                  console.log("[Post-Gemini Validation] Gemini returned 'not found' text without tool call for music intent. Resetting to fallback engine.");
                  assistantText = "";
                  metadata = {};
                } else if (isImageReq) {
                  console.log("[Post-Gemini Validation] Gemini chatted instead of generating image. Resetting to fallback engine.");
                  assistantText = "";
                  metadata = {};
                }
              }
            }
          });
        } catch (err) {
          console.error("All candidates failed in Assistant processing:", err);
        }
      }

      // 4. Smart Fallback Engine (No Hard-coded canned greetings for specific queries)
      if (!assistantText) {
        const targetPrompt = rawPrompt || cleanPrompt;
        const normalizedTarget = normalizeText(targetPrompt);

        // 4.1 Social Chit-chat, Assistant Capabilities & Thanks
        const isThanks = /\b(cam on|cảm ơn|thank|thanks|cảm ơn nhé|cảm ơn bạn|cam on nhe)\b/.test(normalizedTarget);
        const isGreeting = /^(chao|xin chao|hi|hello|helo|hey|chao bạn|chao em|chao anh)\b/.test(normalizedTarget);
        const isCapabilityQuery = /(giup gi|lam duoc gi|khap nang|ban la ai|tro ly gi|chuc nang)/.test(normalizedTarget);
        const isPureEmotionalSharing = /(nay toi hoi buon|toi hoi buon|buon qua|mình hơi buồn|mệt mỏi quá)/.test(normalizedTarget) && !isPlaylistIntent(targetPrompt);

        const isImageGenReq = /(draw|create image|generate image|artwork|tam hinh|tam anh|buc tranh|buc anh|buc hinh)/i.test(normalizedTarget) || (/\b(tao|sinh|ve)\b.*?\b(anh|hinh|tranh)\b/i.test(normalizedTarget) && !/\b(playlist|danh sach|nhac|bai hat|ca khuc|am nhac)\b/i.test(normalizedTarget));

        if (isThanks) {
          assistantText = "Không có gì nè! Rất vui được hỗ trợ bạn. Chúc bạn nghe nhạc vui vẻ nhé! 🎧";
          metadata = { type: "chat_only" };
        } else if (isGreeting) {
          assistantText = "Xin chào! Mình là Trợ lý AI MusicFlow. Bạn muốn nghe bài hát nào, tạo playlist theo cảm xúc hay tìm kiếm ca sĩ gì hôm nay không? 🎵";
          metadata = { type: "chat_only" };
        } else if (isCapabilityQuery) {
          assistantText = "Mình là Trợ lý AI MusicFlow (MusicFlow Assistant)! Mình có thể giúp bạn:\n- 🎵 Gợi ý & phát bài hát theo tên hoặc ca sĩ.\n- 🎧 Tạo playlist theo cảm xúc & tâm trạng (chill, buồn, tập trung, sôi động...).\n- 📖 Trích xuất ý nghĩa & câu chuyện sâu sắc của bài hát.\n- 🎨 Sáng tạo ảnh bìa album AI nghệ thuật.\n- 🧭 Chuyển hướng đến các trang chức năng trên ứng dụng.\n\nBạn muốn mình giúp gì ngay bây giờ không? 😊";
          metadata = { type: "chat_only" };
        } else if (isPureEmotionalSharing) {
          assistantText = "Chia sẻ với bạn nhé! Nếu bạn cảm thấy mệt mỏi hay buồn phiền, âm nhạc có thể là một liều thuốc tinh thần rất tốt đấy. Bạn có muốn mình tạo một danh sách nhạc nhẹ nhàng / chill để thư giãn không? ☕🎵";
          metadata = { type: "chat_only" };
        } else if (isImageGenReq) {
          const imageService = require("./imageGenerator.service");
          const imgRes = await imageService.generateImage({
            prompt: cleanPrompt,
            title: "Tác phẩm AI",
          });

          assistantText = "🎨 Mình đã sáng tạo xong bức ảnh AI cho bạn dựa trên mô tả của bạn:";
          clientActions.push({
            type: "SHOW_IMAGE",
            payload: { imageUrl: imgRes.imageUrl, prompt: cleanPrompt, title: imgRes.title },
          });
          metadata = { type: "generate_image", imageUrl: imgRes.imageUrl, prompt: cleanPrompt, title: imgRes.title, provider: imgRes.provider, enrichedPrompt: imgRes.enrichedPrompt };
        } else {
          // 4.2 Multi-turn & Intent-driven execution via AI Intent Service & Central Action Executor
          const isSongMeaningReq = /(noi ve gi|y nghia|thong diep|cau chuyen|chua)/i.test(normalizedTarget);
          if (isSongMeaningReq) {
            const ctxRef = resolveContextualReference(targetPrompt, recentContext);
            let songTitle = "";
            if (ctxRef?.type === "song") {
              songTitle = ctxRef.song?.title;
            } else {
              const quoteMatch = targetPrompt.match(/["'“]([^"'”]+)["'”]/);
              songTitle = quoteMatch
                ? quoteMatch[1].trim()
                : (extractSongTitleFromPrompt(targetPrompt) || recentContext.lastSong?.title || targetPrompt.replace(/(bai hat|bai|noi ve gi|y nghia|la gi|chua|\?)/gi, "").trim());
            }
            const resMeaning = await resolveSongMeaning(songTitle);
            assistantText = resMeaning.text;
            metadata = resMeaning.metadata;
            if (resMeaning.song) songs = [resMeaning.song];
          } else {
            const intentAnalysis = aiIntent.analyzeIntent(cleanPrompt, recentContext);
            const actionResult = await this.executeMusicAction({
              intentData: intentAnalysis,
              ...intentAnalysis,
              query: intentAnalysis.cleanQuery || cleanPrompt,
              cleanPrompt,
              recentContext,
              actorId,
              actorRole,
              conversationId: conversation._id,
              userTier,
              mode,
            });

            assistantText = actionResult.assistantText;
            clientActions.push(...actionResult.clientActions);
            if (actionResult.playlist) playlist = actionResult.playlist;
            songs = actionResult.songs;
            metadata = actionResult.metadata;
          }
        }
      }

      // Save messages sequentially to guarantee userMsg is created before assistantMsg
      const userMsg = await AssistantMessage.create({
        conversationId: conversation._id,
        role: "user",
        content: cleanPrompt,
      });

      const assistantMsg = await AssistantMessage.create({
        conversationId: conversation._id,
        role: "model",
        content: assistantText,
        metadata,
        createdAt: new Date(Date.now() + 10),
      });

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
        assistantText,
        metadata: assistantMsg.metadata || metadata,
      };
    } finally {
      if (actorId) {
        const aiQuotaService = require("./aiQuota.service");
        aiQuotaService.releaseLock(actorId);
      }
    }
  }

  /**
   * Internal helper to create the actual playlist (Mood Playlist) in DB
   */
  async generatePlaylistInternal({
    prompt,
    mood,
    artistHint,
    count = null,
    userId,
    conversationId,
    activeModelName = null,
    userTier = "basic",
  }) {
    const aiIntent = require("./aiIntent.service");
    const requestedCount = count || aiIntent.extractRequestedCount(prompt) || aiIntent.extractRequestedCount(artistHint ? `${prompt} ${artistHint}` : prompt);
    const targetLimit = requestedCount
      ? Math.max(1, Math.min(Number(requestedCount), MAX_PLAYLIST_SONGS_LIMIT))
      : DEFAULT_PLAYLIST_SONGS;

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

    // 1. Fetch user memory profile for personalization
    let userProfile = null;
    let recentProfile = null;
    if (userId) {
      const personalizationService = require("./personalization.service");
      const adaptiveService = require("./adaptiveRecommendation.service");
      [userProfile, recentProfile] = await Promise.all([
        personalizationService.getUserMusicProfile(userId),
        adaptiveService.getRecentInterestProfile(userId),
      ]);
    }

    // 2. Artist flow if artist intent is detected
    if (allowArtistFlow && primaryArtist) {
      songs = await findSongsByArtists([primaryArtist], targetLimit);
      source = songs.length > 0 ? "artist_match" : "topic_only";
    }

    if (allowArtistFlow && songs.length === 0) {
      songs = await findSongsByArtistHint(mockPrompt, targetLimit);
      if (songs.length > 0) {
        source = "artist_match";
      }
    }

    // 3. Mood & Topic Flow (scored via findSongsByMood)
    if (!allowArtistFlow || songs.length === 0) {
      const moodSongs = await findSongsByMood(
        analysis,
        matchedTopics,
        prioritizedTopics,
        targetLimit,
        { strictTopicOnly: hasMoodSignal, userProfile, recentProfile }
      );
      if (moodSongs.length > 0) {
        if (songs.length === 0) {
          songs = moodSongs;
          source = songs.length < targetLimit ? "topic_partial" : "topic_match";
        } else {
          const seen = new Set(songs.map((s) => s?._id?.toString()).filter(Boolean));
          for (const s of moodSongs) {
            const sid = s?._id?.toString();
            if (!sid || seen.has(sid)) continue;
            songs.push(s);
            seen.add(sid);
            if (songs.length >= targetLimit) break;
          }
          source = "artist_then_topic";
        }
      }
    }

    // 4. Sequential fallback/supplement if still under targetLimit
    if (songs.length < targetLimit && orderedTopics.length > 0) {
      const topicSongs = await findSongsByTopicsSequential(
        orderedTopics,
        targetLimit,
        targetLimit
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
          if (songs.length >= targetLimit) break;
        }
        if (source === "artist_match") source = "artist_then_topic";
      }
    }

    // 5. Intelligent Library Fill if user explicitly asked for count and DB topics didn't reach it
    if (songs.length < targetLimit) {
      const remainingNeeded = targetLimit - songs.length;
      const seenIds = new Set(songs.map((s) => s?._id?.toString()).filter(Boolean));
      const fillerSongs = await Song.find({
        isPublic: true,
        _id: { $nin: Array.from(seenIds) },
      })
        .populate("artists", "name avatar")
        .populate("topicIds", "name description")
        .sort({ playCount: -1, likeCount: -1, createdAt: -1 })
        .limit(remainingNeeded)
        .lean();

      if (fillerSongs.length > 0) {
        songs.push(...fillerSongs);
      }
    }

    if (allowArtistFlow && songs.length === 0) {
      songs = [];
      source = "artist_match";
    }

    const matchStatus = songs.length === 0
      ? "fallback"
      : songs.length < targetLimit
        ? "partial"
        : "matched";

    // Text generation for playlist
    let assistantText = "";
    if (process.env.GEMINI_API_KEY) {
      const songList = songs
        .map((song, index) => `${index + 1}. ${song.title} - ${artistNames(song).join(", ") || "Unknown artist"}`)
        .join("\n");
      const aiDataLoader = require("../ai/aiDataLoader.service");
      const djInstruction = aiDataLoader.getPrompt("music-dj");
      const promptText = [
        djInstruction,
        `Yêu cầu user: ${prompt}`,
        `Mood phân tích: ${analysis.mood}`,
        `Ca sĩ mục tiêu (nếu có): ${primaryArtist?.name || "không"}`,
        `Số lượng bài yêu cầu: ${targetLimit}`,
        `Số lượng bài thực tế trong playlist: ${songs.length}`,
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

    const generatedTitle = primaryArtist
      ? `Tuyển tập ${primaryArtist.name}`
      : analysis.mood
        ? `Playlist Cảm Xúc: ${analysis.mood.charAt(0).toUpperCase() + analysis.mood.slice(1)}`
        : `Playlist MusicFlow - ${new Date().toLocaleDateString("vi-VN")}`;

    let playlist = await MoodPlaylist.create({
      conversationId,
      userId,
      title: generatedTitle,
      description: assistantText,
      imageUrl: "",
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

async function resolveSongMeaning(songTitleQuery) {
  const cleanTitle = songTitleQuery.replace(/["'“]/g, "").trim();
  const song = (await findSongByTitle(cleanTitle)) || (await findSongByTitle(songTitleQuery));
  if (!song) {
    return {
      text: `Mình chưa tìm thấy bài hát "${songTitleQuery}" trong hệ thống MusicFlow để giải thích ý nghĩa.`,
      song: null,
      metadata: { type: "get_song_story_failed", query: songTitleQuery }
    };
  }


  const analysis = song.aiAnalysis;
  const status = analysis?.status || "none";

  if (status === "completed" && analysis?.storySummary) {
    const quotesStr = Array.isArray(analysis.healingQuotes) && analysis.healingQuotes.length > 0
      ? `\n\n💬 **Trích dẫn đắt giá:**\n${analysis.healingQuotes.map(q => `> "${q}"`).join("\n")}`
      : "";
    const tagsStr = Array.isArray(analysis.moodTags) && analysis.moodTags.length > 0
      ? `\n🏷️ **Cảm xúc:** ${analysis.moodTags.join(", ")}`
      : "";

    return {
      text: `📖 **Ý nghĩa bài hát "${song.title}":**\n${analysis.storySummary}${quotesStr}${tagsStr}`,
      song,
      metadata: { type: "get_song_story_cached", songId: song._id }
    };
  }

  // If status is 'none' or missing, set status = 'pending' ONCE so Background Job processes it later
  if (status === "none" || !analysis?.status) {
    await Song.updateOne(
      { _id: song._id },
      { $set: { "aiAnalysis.status": "pending" } }
    );
  }

  const artistList = artistNames(song).join(", ");
  return {
    text: `📖 Bài hát "${song.title}"${artistList ? ` của ${artistList}` : ""} hiện đang được hệ thống phân tích ý nghĩa chuyên sâu. Bạn hãy quay lại sau ít phút nhé!`,
    song,
    metadata: { type: "get_song_story_pending", songId: song._id }
  };
}

module.exports = new AssistantService();

