/**
 * aiIntent.service.js — Advanced Music Intent & Context Engine for MusicFlow.
 * 
 * Responsibilities:
 * 1. Accurately identifies 8 core music assistant intents:
 *    - SEARCH_SONG: Tìm bài hát cụ thể (theo tiêu đề, câu từ, lời bài hát / lyrics).
 *    - SEARCH_ARTIST: Tìm kiếm thông tin & bài hát của nghệ sĩ / ca sĩ.
 *    - SEARCH_GENRE: Tìm bài hát theo thể loại, chủ đề hoặc quốc gia (Nhạc Trung / C-Pop, US-UK, V-Pop, Lofi, EDM...).
 *    - RECOMMEND_SONG: Đề xuất bài hát theo sở thích, cảm xúc hoặc tâm trạng (buồn, chill, thư giãn...).
 *    - CREATE_PLAYLIST: Yêu cầu tạo playlist / danh sách phát nhạc.
 *    - PLAY_MUSIC: Yêu cầu phát nhạc cụ thể ngay lập tức.
 *    - FOLLOW_UP: Hội thoại tiếp nối dựa trên ngữ cảnh ("phát bài đầu tiên", "còn bài nào khác không", "bài của ca sĩ đó").
 *    - GENERAL_CHAT: Trò chuyện xã giao, chào hỏi, cảm ơn, hỏi năng lực AI.
 * 
 * 2. Normalizes typos, abbreviations, accents, and aliases.
 * 3. Extracts structured query objects: { intent, songTitle, artistName, genre, mood, keywords, index, referenceType, isLyrics, lyricsSnippet }.
 */

const { normalizeText, escapeRegex } = require("../utils/string.util");

const INTENTS = {
  SEARCH_SONG: "SEARCH_SONG",
  SEARCH_ARTIST: "SEARCH_ARTIST",
  SEARCH_GENRE: "SEARCH_GENRE",
  RECOMMEND_SONG: "RECOMMEND_SONG",
  CREATE_PLAYLIST: "CREATE_PLAYLIST",
  PLAY_MUSIC: "PLAY_MUSIC",
  FOLLOW_UP: "FOLLOW_UP",
  GENERAL_CHAT: "GENERAL_CHAT",
};

/**
 * Genre & Country Topic Mapping Dictionary
 * Maps natural Vietnamese variations & slang to standardized Topic names in DB.
 */
const GENRE_TOPIC_MAP = {
  "Nhạc Hoa (C-Pop)": [
    "trung", "trung quoc", "nhac trung", "nhac hoa", "hoa", "c-pop", "cpop",
    "hoa ngu", "co phong", "cổ phong", "tieng trung", "c pop", "nhac hoa ngu"
  ],
  "Nhạc Âu Mỹ (US-UK)": [
    "au my", "âu mỹ", "us-uk", "us uk", "usuk", "tieng anh", "tiếng anh",
    "nhac anh", "nhac tay", "nhạc tây", "ngoai quoc", "ngoại quốc", "english", "pop au my"
  ],
  "V-Pop": [
    "viet", "việt", "viet nam", "việt nam", "v-pop", "vpop", "nhac tre",
    "nhạc trẻ", "nhac viet", "nhạc việt", "nhac que huong"
  ],
  "Việt Nam": [
    "viet nam", "việt nam", "nhac viet", "nhac que huong", "nhac cach mang", "nhac do"
  ],
  "Lofi": [
    "lofi", "lo-fi", "lo fi", "nhac lofi"
  ],
  "EDM": [
    "edm", "nhac san", "nhạc sàn", "nhac quay", "nhạc quẩy", "dien tu",
    "điện tử", "remix", "vinahouse", "vinahey", "dance"
  ],
  "Rock": [
    "rock", "nhac rock", "metal", "hard rock"
  ],
  "Chill": [
    "chill", "thu gian", "thư giãn", "nhe nhang", "nhẹ nhàng", "em dem",
    "êm đềm", "acoustic", "nhe", "nhe nhang"
  ],
  "Sad": [
    "sad", "buon", "buồn", "that tinh", "thất tình", "chia tay", "tam trang",
    "tâm trạng", "suy", "khoc", "khóc", "dau long", "đau lòng", "co don", "cô đơn"
  ],
  "Hip Hop & Rap": [
    "rap", "hip hop", "hiphop", "hip-hop", "rapper"
  ],
  "Piano": [
    "piano", "khong loi", "không lời", "hoa tau", "hòa tấu", "co dien", "cổ điển"
  ],
  "Study": [
    "study", "hoc", "học", "hoc bai", "học bài", "tap trung", "tập trung",
    "lam viec", "làm việc", "doc sach", "đọc sách"
  ],
  "Sleep": [
    "sleep", "ngu", "ngủ", "ru ngu", "ru ngủ", "ngu ngon", "ngủ ngon", "dem khuya"
  ],
  "WorkOut": [
    "workout", "work out", "gym", "tap gym", "tập gym", "chay bo", "chạy bộ",
    "the thao", "thể thao", "nang luong", "năng lượng", "dong luc", "động lực"
  ],
  "Party": [
    "party", "tiec", "tiệc", "tiec tung", "tiệc tùng", "quay banh noc"
  ],
};

/**
 * Standard Artist Aliases for resilient fuzzy matching
 */
const ARTIST_ALIASES = {
  "sơn tùng": "Sơn Tùng M-TP",
  "sơn tùng m-tp": "Sơn Tùng M-TP",
  "sơn tùng mtp": "Sơn Tùng M-TP",
  "son tung": "Sơn Tùng M-TP",
  "sontung": "Sơn Tùng M-TP",
  "mtp": "Sơn Tùng M-TP",
  "m-tp": "Sơn Tùng M-TP",
  "jack": "JACK - J97",
  "j97": "JACK - J97",
  "jack - j97": "JACK - J97",
  "đen": "Đen",
  "đen vâu": "Đen",
  "den vau": "Đen",
  "den": "Đen",
  "charlie puth": "Charlie Puth",
  "charlie": "Charlie Puth",
  "charli puth": "Charlie Puth",
  "trung quân": "Trung Quân",
  "trung quân idol": "Trung Quân",
  "trung quan": "Trung Quân",
  "b ray": "B Ray",
  "bray": "B Ray",
  "soobin": "Soobin Hoàng Sơn",
  "soobin hoàng sơn": "Soobin Hoàng Sơn",
  "vicetone": "Vicetone",
  "viceton": "Vicetone",
  "thefatrat": "TheFatRat",
  "the fat rat": "TheFatRat",
  "noo phước thịnh": "Noo Phước Thịnh",
  "noo": "Noo Phước Thịnh",
  "hà anh tuấn": "Hà Anh Tuấn",
  "phan mạnh quỳnh": "Phan Mạnh Quỳnh",
  "khánh phương": "Khánh Phương",
  "vũ": "Vũ",
  "hoàng thái vũ": "Vũ",
  "erik": "ERIK",
  "đức phúc": "Đức Phúc",
  "duc phuc": "Đức Phúc",
  "phi nhung": "Phi Nhung",
  "silence wang": "Silence Wang 汪苏泷",
  "uông tô lang": "Silence Wang 汪苏泷",
  "li yuanjie": "Li Yuanjie 李袁杰",
  "lý viên kiệt": "Li Yuanjie 李袁杰",
};

/**
 * Normalizes input text and common Vietnamese chat abbreviations/slang
 */
function cleanText(text = "") {
  if (!text || typeof text !== "string") return "";
  let s = text.trim();

  // Normalize common Vietnamese chat shorthands
  s = s.replace(/\b(ko|k|hok|hổng)\b/gi, "không")
       .replace(/\b(đc|dc)\b/gi, "được")
       .replace(/\b(vs)\b/gi, "với")
       .replace(/\b(bùn|bun)\b/gi, "buồn")
       .replace(/\b(đê|nhe|nhó)\b/gi, "đi")
       .replace(/\b(cx)\b/gi, "cũng")
       .replace(/\b(ntn)\b/gi, "như thế nào")
       .replace(/\b(thui)\b/gi, "thôi")
       .replace(/\s+/g, " ");

  return s;
}

/**
 * Extracts lyrics snippet if user is asking to find song by lyrics
 */
function extractLyricsSnippet(prompt = "") {
  const text = prompt.trim();
  const quoteMatch = text.match(/["'“]([^"'”]+)["'”]/);
  if (quoteMatch && quoteMatch[1].trim().length >= 3) {
    return quoteMatch[1].trim();
  }

  if (text.includes(":")) {
    const afterColon = text.split(":").slice(1).join(":").trim();
    if (afterColon.length >= 3) {
      return afterColon;
    }
  }

  const cleaned = text
    .replace(/^(tôi|mình|em|anh)?\s*(nhớ|biết|nghe)?\s*(1|một)?\s*(đoạn|câu)?\s*(lyrics|lyric|lời|lời bài hát|lời bài|giai điệu của bài hát|giai điệu bài hát|giai điệu)\s*(là|thế này|như này|sau|này)?\s*:?\s*/i, "")
    .replace(/^(bài gì|bài hát gì|bài nào|tìm bài|tìm bài hát|tìm bài có|có bài gì|có bài nào)?\s*(có|chứa|hát|lời)?\s*(câu|đoạn|lời|lyrics|giai điệu)?\s*:?\s*/i, "")
    .replace(/^(lời bài hát có câu|lời có câu|câu hát là|đoạn hát là|đoạn lời là|giai điệu là)\s*:?\s*/i, "")
    .replace(/\s*(là bài gì á|là bài gì thế|là bài gì|là bài nào|tên là gì|tên gì|thuộc bài nào|thuộc bài gì|hả bạn|hả cậu|\?)\s*$/i, "")
    .trim();

  return cleaned || text;
}

/**
 * Resolves matched Topic / Genre from prompt using synonym/alias table
 */
function resolveGenreFromPrompt(prompt = "") {
  const norm = normalizeText(prompt);

  // Exact word / phrase boundary check to avoid partial false positives
  for (const [topicName, aliases] of Object.entries(GENRE_TOPIC_MAP)) {
    for (const alias of aliases) {
      const normAlias = normalizeText(alias);
      if (!normAlias) continue;

      // Word boundary regex check
      const pattern = new RegExp(`(^|\\s)${escapeRegex(normAlias)}(\\s|$)`, "i");
      if (pattern.test(norm)) {
        return {
          topicName,
          matchedKeyword: alias,
        };
      }
    }
  }

  return null;
}

/**
 * Resolves Artist name from prompt using alias dictionary or keywords
 */
function resolveArtistFromPrompt(prompt = "") {
  const norm = normalizeText(prompt);

  // 1. Direct alias check
  for (const [alias, standardName] of Object.entries(ARTIST_ALIASES)) {
    const normAlias = normalizeText(alias);
    const pattern = new RegExp(`(^|\\s)${escapeRegex(normAlias)}(\\s|$)`, "i");
    if (pattern.test(norm)) {
      return standardName;
    }
  }

  // 2. Pattern extraction: "ca sĩ X có bài nào không", "nhạc của X", "bài của X"
  const artistMatch = prompt.match(/(?:ca\s+sĩ|ca\s+si|nghệ\s+sĩ|nghe\s+si|nhạc\s+của|nhac\s+cua|bài\s+của|bai\s+cua)\s+([A-ZÀ-Ỹa-zà-ỹ0-9\s._-]+?)(?:\s+có\s+|\s+hát\s+|\s+không|\s+k\b|\s+ko\b|\s*\?|$)/i);
  if (artistMatch && artistMatch[1]) {
    const candidate = artistMatch[1].trim();
    if (candidate.length >= 2 && !/(nhạc|bài|gì|nào|đó|kia|thế)/i.test(candidate)) {
      return candidate;
    }
  }

  return null;
}

/**
 * Extracts ordinal or contextual follow-up reference
 */
function extractContextReference(prompt = "", context = {}) {
  const text = normalizeText(prompt);

  // 1. Ordinal: "bài đầu tiên", "bài 1", "bài thứ 1", "bài thứ nhất"
  const isFirst = /\b(bai\s+(dau\s+tien|1|thu\s+1|thu\s+nhat))\b/.test(text) ||
                  /\b(mo|phat|nghe|bat)\s+(bai\s+dau|bai\s+1|bai\s+dau\s+tien)\b/.test(text);
  if (isFirst) {
    return {
      referenceType: "first",
      index: 1,
      targetSong: context?.recentSongs?.[0] || null,
    };
  }

  // "bài thứ 2", "bài 2", "bài hai", "bài thứ hai"
  const isSecond = /\b(bai\s+(2|thu\s+2|hai|thu\s+hai))\b/.test(text) ||
                   /\b(mo|phat|nghe|bat)\s+(bai\s+2|bai\s+thu\s+2)\b/.test(text);
  if (isSecond) {
    return {
      referenceType: "ordinal",
      index: 2,
      targetSong: context?.recentSongs?.[1] || null,
    };
  }

  // "bài thứ 3", "bài 3", "bài ba", "bài thứ ba"
  const isThird = /\b(bai\s+(3|thu\s+3|ba|thu\s+ba))\b/.test(text) ||
                  /\b(mo|phat|nghe|bat)\s+(bai\s+3|bai\s+thu\s+3)\b/.test(text);
  if (isThird) {
    return {
      referenceType: "ordinal",
      index: 3,
      targetSong: context?.recentSongs?.[2] || null,
    };
  }

  // "còn bài nào khác không", "gợi ý thêm bài", "thêm bài khác", "bài khác đi"
  const isMore = /\b(con\s+bai\s+nao\s+(khac|nua)|bai\s+khac|them\s+bai|goi\s+y\s+them)\b/.test(text);
  if (isMore) {
    return {
      referenceType: "more",
    };
  }

  // "bài của ca sĩ đó ấy", "của ca sĩ đó", "của người đó"
  const isArtistRef = /\b(cua\s+ca\s+si\s+do|cua\s+nguoi\s+do|cua\s+ca\s+si\s+nay)\b/.test(text);
  if (isArtistRef) {
    return {
      referenceType: "artist_ref",
      lastArtist: context?.lastSong?.artists?.[0] || null,
    };
  }

  // Pronoun: "mở nó đi", "phát nó", "bài này", "bài đó"
  const isPronoun = /\b(mo|phat|nghe|bat)\s+(no|cai\s+do|bai\s+do|bai\s+nay)\b/.test(text) ||
                    /\b(bai\s+nay|cai\s+nay|no)\b/.test(text);
  if (isPronoun) {
    return {
      referenceType: "pronoun",
      targetSong: context?.lastSong || context?.recentSongs?.[0] || null,
    };
  }

  // Affirmative confirmations: "có", "bật đi", "phát đi", "mở đi", "ừ", "ok", "nghe luôn"
  const isConfirm = /\b(bat di|phat di|mo di|nghe di|phat luon|bat luon|mo luon)\b/.test(text);
  if (isConfirm) {
    return {
      referenceType: "pronoun",
      targetSong: context?.lastSong || context?.recentSongs?.[0] || null,
    };
  }

  return null;
}

/**
 * Master Intent Analyzer
 * Takes raw prompt and conversation context, returns structured Intent & Entities.
 */
function analyzeIntent(prompt = "", context = {}) {
  const clean = cleanText(prompt);
  const norm = normalizeText(clean);

  // 1. General Social Chit-Chat / Capabilities / Gratitude
  const isThanks = /\b(cam on|cảm ơn|thank|thanks|cảm ơn nhé|cảm ơn bạn|cam on nhe)\b/.test(norm);
  const isGreeting = /^(chao|xin chao|hi|hello|helo|hey|chao ban|chao em|chao anh)\b/.test(norm);
  const isCapability = /(giup gi|lam duoc gi|khap nang|ban la ai|tro ly gi|chuc nang|co the giup gi)/.test(norm);

  if (isThanks || isGreeting || isCapability) {
    return {
      intent: INTENTS.GENERAL_CHAT,
      subType: isThanks ? "thanks" : isGreeting ? "greeting" : "capability",
      prompt: clean,
    };
  }

  // 2. Multi-turn Follow-up Context Check
  const followUpRef = extractContextReference(clean, context);
  if (followUpRef) {
    return {
      intent: INTENTS.FOLLOW_UP,
      referenceType: followUpRef.referenceType,
      index: followUpRef.index || null,
      targetSong: followUpRef.targetSong || null,
      lastArtist: followUpRef.lastArtist || null,
      prompt: clean,
    };
  }

  // 3. Lyrics Search Check
  const isLyrics = /\b(lyrics|lyric|loi bai hat|loi bai|doan loi|cau hat|doan hat|loi co cau|cau hat la|nho mot doan|nho 1 doan|bai gi co cau|bai nao co cau|bai hat co loi|tim bai theo loi)\b/i.test(norm) ||
                   /\b(la bai gi|thuoc bai nao|thuoc bai gi)\b/i.test(norm);
  if (isLyrics) {
    const snippet = extractLyricsSnippet(clean);
    return {
      intent: INTENTS.SEARCH_SONG,
      isLyrics: true,
      lyricsSnippet: snippet,
      query: snippet,
      prompt: clean,
    };
  }

  // 4. Create Playlist Intent
  const moodPattern = /\b(buon|sad|chill|vui|happy|soi dong|energetic|tap trung|focus|ngu|sleep|lang man|romantic|party|thu gian)\b/i;
  const isCreatePlaylist = /\b(tao playlist|tao danh sach|lap playlist|lam playlist|build playlist|tao 1 playlist|tao mot playlist|goi y playlist|de xuat playlist)\b/i.test(norm) ||
    (/\b(cho toi|cho minh|cho em|nghe)\s+(nhac|playlist|1 playlist|mot playlist)\b/i.test(norm) && moodPattern.test(norm));
  if (isCreatePlaylist) {
    const genreInfo = resolveGenreFromPrompt(clean);
    const moodMatch = norm.match(moodPattern);
    return {
      intent: INTENTS.CREATE_PLAYLIST,
      genre: genreInfo ? genreInfo.topicName : null,
      mood: moodMatch ? moodMatch[1] : null,
      prompt: clean,
    };
  }

  // 5. Search by Artist
  // e.g. "Ca sĩ Phi Nhung có bài nào không?", "có nhạc Sơn Tùng không?", "bài của Đen Vâu"
  const isArtistQuery = /\b(ca si|nghe si|artist|singer|nhac cua|bai cua|bai hat cua|ca khuc cua)\b/i.test(norm) ||
                        /\b(co bai nao khong|co nhac cua|co bai cua)\b/i.test(norm);
  const detectedArtist = resolveArtistFromPrompt(clean);
  if (isArtistQuery && detectedArtist) {
    const isPlayDirect = /\b(phat|bat|mo|play)\b/i.test(norm);
    return {
      intent: INTENTS.SEARCH_ARTIST,
      artistName: detectedArtist,
      action: isPlayDirect ? "play" : "search",
      prompt: clean,
    };
  }

  // 8. Play Specific Music Command (Checked before generic genre match if it specifies a title)
  // e.g. "phát bài Lạc Trôi", "bật bài Nơi Này Có Anh", "mở ca khúc Ánh Nắng Của Anh", "phát nhạc Sơn Tùng"
  const isPlayCommand = /^(phat|phát|bat|bật|mo|mở|play)\s+(bai|bài|ca\s+khuc|ca\s+khúc|bai\s+hat|bài\s+hát|nhac|nhạc)?\s+/i.test(clean);
  if (isPlayCommand) {
    const rawTitle = clean
      .replace(/^(phat|phát|bat|bật|mo|mở|play)\s+(bai|bài|ca\s+khuc|ca\s+khúc|bai\s+hat|bài\s+hát|nhac|nhạc)?\s+/i, "")
      .replace(/\s*(di|đi|luon|luôn|nghe|nha|nhé)\s*$/i, "")
      .trim();

    // Check if the target is actually an artist or genre (e.g. "phát nhạc Trung", "phát nhạc Sơn Tùng")
    const genreInPlay = resolveGenreFromPrompt(rawTitle);
    const artistInPlay = resolveArtistFromPrompt(rawTitle);

    if (genreInPlay) {
      return {
        intent: INTENTS.PLAY_MUSIC,
        genre: genreInPlay.topicName,
        action: "play",
        prompt: clean,
      };
    }
    if (artistInPlay) {
      return {
        intent: INTENTS.PLAY_MUSIC,
        artistName: artistInPlay,
        action: "play",
        prompt: clean,
      };
    }

    return {
      intent: INTENTS.PLAY_MUSIC,
      songTitle: rawTitle,
      query: rawTitle,
      action: "play",
      prompt: clean,
    };
  }

  // 6. Search by Genre / Country / Category
  // e.g. "Muốn nghe nhạc Trung thì nghe bài nào?", "gợi ý nhạc US-UK", "nhạc EDM nghe bài nào"
  const genreMatch = resolveGenreFromPrompt(clean);
  if (genreMatch) {
    const isPlayDirect = /\b(phat|phát|bat|bật|mo|mở|play)\b/i.test(norm);
    const isRecommend = /\b(goi y|gợi ý|de xuat|đề xuất|recommend|nghe bai nao|nghe bài nào|co bai gi|có bài gì|bai nao hay|bài nào hay|muon nghe|muốn nghe)\b/i.test(norm);
    return {
      intent: isRecommend ? INTENTS.RECOMMEND_SONG : (isPlayDirect ? INTENTS.PLAY_MUSIC : INTENTS.SEARCH_GENRE),
      genre: genreMatch.topicName,
      genreKeyword: genreMatch.matchedKeyword,
      mood: genreMatch.topicName === "Sad" ? "sad" : (genreMatch.topicName === "Chill" ? "chill" : null),
      action: isPlayDirect ? "play" : "search",
      prompt: clean,
    };
  }

  // 7. Recommend Songs by Mood / Feelings
  // e.g. "Có bài nào buồn buồn không?", "có bài chill nào không?", "cho xin vài bài nghe lúc tâm trạng"
  const isMoodRecommend = /\b(bai nao|co bai|goi y|de xuat|cho|muon nghe|nghe bai)\b/i.test(norm) &&
                          /\b(buon|buon buon|chill|vui|tam trang|suy|thu gian|nhe nhang|nhe|soi dong)\b/i.test(norm);
  if (isMoodRecommend) {
    let targetMood = "chill";
    if (/\b(buon|buon buon|suy|tam trang|khoc|that tinh)\b/i.test(norm)) targetMood = "sad";
    else if (/\b(vui|soi dong|quay|nang luong)\b/i.test(norm)) targetMood = "energetic";
    else if (/\b(tap trung|hoc)\b/i.test(norm)) targetMood = "focus";

    return {
      intent: INTENTS.RECOMMEND_SONG,
      mood: targetMood,
      genre: targetMood === "sad" ? "Sad" : (targetMood === "chill" ? "Chill" : null),
      prompt: clean,
    };
  }

  // 9. Specific Song Search by Title
  // e.g. "tìm bài Lạc Trôi", "bài Em Của Ngày Hôm Qua"
  const isSongSearch = /\b(tim|kiem|co bai|ten la|co ten)\b/i.test(norm);
  if (isSongSearch) {
    const cleanedTitle = clean
      .replace(/\b(tìm|kiếm|cho tôi|bài hát|bài|ca khúc|tên là|có tên|có chữ)\b/gi, "")
      .trim();
    return {
      intent: INTENTS.SEARCH_SONG,
      songTitle: cleanedTitle || clean,
      query: cleanedTitle || clean,
      action: "search",
      prompt: clean,
    };
  }

  // Default: Treat as general music recommendation / search
  return {
    intent: detectedArtist ? INTENTS.SEARCH_ARTIST : INTENTS.RECOMMEND_SONG,
    artistName: detectedArtist || null,
    query: clean,
    prompt: clean,
  };
}

module.exports = {
  INTENTS,
  GENRE_TOPIC_MAP,
  ARTIST_ALIASES,
  cleanText,
  resolveGenreFromPrompt,
  resolveArtistFromPrompt,
  extractContextReference,
  extractLyricsSnippet,
  analyzeIntent,
};
