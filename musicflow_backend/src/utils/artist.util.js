const mongoose = require("mongoose");
const Artist = require("../models/artist.model");

/**
 * Normalizes artist name to ZingMP3-style slug (e.g. "Mr. Siro" -> "Mr-Siro")
 * @param {string} name
 * @returns {string}
 */
function toZingArtistSlug(name = "") {
  if (!name) return "artist";
  const noAccents = String(name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, (m) => (m === "Đ" ? "D" : "d"))
    .trim();

  const words = noAccents.split(/[\s._-]+/).filter(Boolean);
  if (!words.length) return "artist";

  const slug = words
    .map((w) => {
      if (w === w.toUpperCase() && w.length > 1) return w;
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join("-");

  return slug.replace(/[^a-zA-Z0-9-]/g, "") || "artist";
}

/**
 * Resiliently finds an Artist document by:
 * 1. MongoDB ObjectId
 * 2. Exact or case-insensitive slug (e.g. "Mr-Siro")
 * 3. Name with flexible punctuation / spaces regex (e.g. "Mr. Siro", "Mr Siro")
 * 4. Accent-insensitive unaccented comparison
 * @param {string} idOrSlug
 * @returns {Promise<Document|null>}
 */
async function findArtistBySlugOrId(idOrSlug) {
  if (!idOrSlug) return null;
  const raw = String(idOrSlug).trim();

  // 1. Direct MongoDB ObjectId
  if (mongoose.Types.ObjectId.isValid(raw) && raw.length === 24) {
    const byId = await Artist.findById(raw).select("-password");
    if (byId) return byId;
  }

  const decoded = decodeURIComponent(raw).trim();

  // 2. Direct slug match (e.g. "Mr-Siro", "Da-LAB", "ERIK")
  let artist = await Artist.findOne({
    $or: [
      { slug: decoded },
      { slug: { $regex: new RegExp(`^${decoded}$`, "i") } },
      { name: { $regex: new RegExp(`^${decoded}$`, "i") } },
    ],
  }).select("-password");
  if (artist) return artist;

  // 3. Flexible punctuation/space tokens match:
  // e.g. "Mr-Siro" -> tokens ["Mr", "Siro"] -> matches "Mr. Siro" or "Mr Siro"
  const tokens = decoded.split(/[\s._-]+/).filter(Boolean);
  if (tokens.length > 0) {
    const escapedTokens = tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const flexPattern = `^${escapedTokens.join("[\\s._-]*")}[\\s._-]*$`;
    artist = await Artist.findOne({
      name: { $regex: new RegExp(flexPattern, "i") },
    }).select("-password");
    if (artist) return artist;
  }

  // 4. Accent-insensitive unaccented comparison across all artists
  const slugTarget = toZingArtistSlug(decoded).toLowerCase();
  const allArtists = await Artist.find().select("name slug").lean();
  for (const a of allArtists) {
    const aSlug = (a.slug || toZingArtistSlug(a.name)).toLowerCase();
    if (aSlug === slugTarget) {
      return await Artist.findById(a._id).select("-password");
    }
  }

  return null;
}

module.exports = {
  toZingArtistSlug,
  findArtistBySlugOrId,
};
