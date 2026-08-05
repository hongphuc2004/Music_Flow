/**
 * search.service.js — All song / artist search logic in one place.
 *
 * Extracted from song.controller.js so the controller only handles
 * request parsing and response formatting, not query-building algorithms.
 */

const Artist = require("../models/artist.model");
const Song = require("../models/song.model");
const { buildSearchRegexes, isObjectIdLike } = require("../utils/string.util");
const { SONG_PUBLIC_SELECT, ARTIST_POPULATE, TOPIC_POPULATE } = require("../repositories/song.repository");

// ---------------------------------------------------------------------------
// Search by free-text query (+ optional filters)
// ---------------------------------------------------------------------------

/**
 * Full-text song search with accent-insensitive Vietnamese support.
 *
 * Behaviour:
 *  - If `query` is provided, builds one or two regex patterns (phrase + all-tokens)
 *    and matches against song titles AND against artist names.
 *  - If `artistId` / `topicId` / `letter` filters are provided they are ANDed in.
 *  - When `includeArtists` is true the matched artist documents are returned alongside.
 *
 * @param {{
 *   query?: string,
 *   artistId?: string,
 *   topicId?: string,
 *   letter?: string,
 *   includeArtists?: boolean,
 * }} params
 * @returns {Promise<{ songs: object[], artists?: object[] }>}
 */
const searchSongs = async ({ query, artistId, topicId, letter, includeArtists = false }) => {
  const conditions = [{ isPublic: true }];
  let matchedArtists = [];

  if (query) {
    const regexes = buildSearchRegexes(query);

    if (regexes.length > 0) {
      // Match artist names (for "include artists in results" and for song lookup)
      matchedArtists = await Artist.find({
        $or: regexes.map((regex) => ({ name: regex })),
      })
        .select("_id name avatar")
        .sort({ name: 1 })
        .limit(12)
        .lean();

      // Match song titles OR songs by matched artists
      const titleConditions = regexes.map((regex) => ({ title: regex }));
      const queryOrConditions = [...titleConditions];

      if (matchedArtists.length > 0) {
        queryOrConditions.push({
          artists: { $in: matchedArtists.map((a) => a._id) },
        });
      }

      conditions.push({ $or: queryOrConditions });
    }
  }

  if (artistId) conditions.push({ artists: artistId });
  if (topicId) conditions.push({ topicIds: topicId });
  if (letter) conditions.push({ title: new RegExp(`^${letter}`, "i") });

  const filter = conditions.length === 1 ? conditions[0] : { $and: conditions };

  const songs = await Song.find(filter)
    .select(SONG_PUBLIC_SELECT)
    .sort({ createdAt: -1 })
    .populate(ARTIST_POPULATE)
    .populate(TOPIC_POPULATE)
    .lean();

  return includeArtists ? { songs, artists: matchedArtists } : { songs };
};

// ---------------------------------------------------------------------------
// Search songs by artist id or artist name
// ---------------------------------------------------------------------------

/**
 * Return paginated songs for a given artist.
 * Resolves the artist by id if provided; otherwise looks up by name.
 *
 * @param {{
 *   artistId?: string,
 *   artistName?: string,
 *   search?: string,
 *   page?: number,
 *   limit?: number,
 * }} params
 * @returns {Promise<{ songs: object[], total: number, page: number, limit: number }>}
 */
const searchSongsByArtist = async ({
  artistId,
  artistName,
  search = "",
  page = 1,
  limit = 10,
}) => {
  const skip = (page - 1) * limit;
  let resolvedArtistId = artistId;

  if (!resolvedArtistId && artistName) {
    const artist = await Artist.findOne({
      name: { $regex: new RegExp(`^${String(artistName).trim()}$`, "i") },
    }).select("_id");
    resolvedArtistId = artist?._id?.toString();
  }

  if (!resolvedArtistId) {
    throw new Error("Missing artistId or artist name");
  }

  const query = {
    artists: resolvedArtistId,
    ...(search ? { title: { $regex: search, $options: "i" } } : {}),
  };

  const [rawSongs, total] = await Promise.all([
    Song.find(query)
      .populate("artists", "name avatar isVerified followersCount monthlyListeners")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Song.countDocuments(query),
  ]);

  const songs = rawSongs.map((doc) => {
    const song = doc.toObject();
    return {
      ...song,
      artist: Array.isArray(song.artists)
        ? song.artists.map((a) => a.name).filter(Boolean).join(", ")
        : "",
    };
  });

  return { songs, total, page, limit };
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = { searchSongs, searchSongsByArtist };
