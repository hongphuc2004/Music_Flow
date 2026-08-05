/**
 * string.util.js — String helpers for Vietnamese text processing,
 * regex escaping, search query building, and input parsing.
 *
 * Extracted from song.controller.js to keep it a single source of truth.
 */

// ---------------------------------------------------------------------------
// Basic escaping / validators
// ---------------------------------------------------------------------------

/** Escape special RegExp characters in a string. */
const escapeRegex = (value) =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Same as escapeRegex — alias kept for clarity at call sites. */
const escapeRegexChar = (char) =>
  char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Returns true when value looks like a valid MongoDB ObjectId (24 hex chars). */
const isObjectIdLike = (value) =>
  /^[a-fA-F0-9]{24}$/.test(String(value || "").trim());

/** Returns true when value starts with http:// or https://. */
const isHttpUrl = (value) =>
  /^https?:\/\//i.test(String(value || "").trim());

// ---------------------------------------------------------------------------
// Text normalisation
// ---------------------------------------------------------------------------

/**
 * Trim and collapse internal whitespace.
 * Used to normalise raw search query strings.
 */
const normalizeSearchText = (value) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ");

/**
 * Full Unicode normalisation for Vietnamese text:
 *   - Lower-case
 *   - Strip diacritics (NFD decomposition)
 *   - Replace đ/Đ with d
 *   - Strip non-alphanumeric characters (keep spaces, & and -)
 *   - Collapse whitespace
 *
 * Used by assistant.service and search to compare user input against
 * stored Vietnamese strings without requiring exact accent matching.
 */
const normalizeText = (value = "") =>
  String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0111/g, "d")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s&-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// ---------------------------------------------------------------------------
// Vietnamese accent-insensitive regex
// ---------------------------------------------------------------------------

/**
 * Maps each plain Latin letter to the set of Vietnamese characters that
 * the user might mean when typing without accents, e.g. "a" → "aáàảãạ…".
 * Used to build flexible search regexes.
 */
const VIET_CHAR_GROUPS = {
  a: "aáàảãạăắằẳẵặâấầẩẫậ",
  A: "AÁÀẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬ",
  e: "eéèẻẽẹêếềểễệ",
  E: "EÉÈẺẼẸÊẾỀỂỄỆ",
  i: "iíìỉĩị",
  I: "IÍÌỈĨỊ",
  o: "oóòỏõọôốồổỗộơớờởỡợ",
  O: "OÓÒỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢ",
  u: "uúùủũụưứừửữự",
  U: "UÚÙỦŨỤƯỨỪỬỮỰ",
  y: "yýỳỷỹỵ",
  Y: "YÝỲỶỸỴ",
  d: "dđ",
  D: "DĐ",
};

/**
 * Converts plain-Latin text into a RegExp pattern string that matches
 * the same text with or without Vietnamese diacritics.
 *
 * e.g. "anh" → "[aáàảãạ…][nN][hH]"
 * e.g. " " (space) → "\\s+" (flexible whitespace)
 */
const toAccentInsensitivePattern = (text) =>
  String(text || "")
    .split("")
    .map((char) => {
      if (char === " ") return "\\s+";
      const grouped = VIET_CHAR_GROUPS[char];
      if (grouped) return `[${grouped}]`;
      return escapeRegexChar(char);
    })
    .join("");

/**
 * Build one or two search regexes from a raw query string:
 *   - Always returns a "phrase" regex (full query as a single pattern).
 *   - When the query has multiple tokens, also returns an "all-tokens" regex
 *     (lookahead-based AND match — every word must appear somewhere).
 *
 * Returns an empty array if the query is empty after normalisation.
 */
const buildSearchRegexes = (rawQuery) => {
  const normalized = normalizeSearchText(rawQuery);
  if (!normalized) return [];

  const phraseRegex = new RegExp(toAccentInsensitivePattern(normalized), "i");

  const tokens = normalized
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean)
    .map(toAccentInsensitivePattern);

  if (tokens.length <= 1) {
    return [phraseRegex];
  }

  const allTokensRegex = new RegExp(
    `^(?=.*${tokens.join(")(?=.*")}).*$`,
    "i"
  );
  return [phraseRegex, allTokensRegex];
};

// ---------------------------------------------------------------------------
// File name helpers
// ---------------------------------------------------------------------------

/**
 * Decode a Multer-parsed file name that may have been mangled from UTF-8 to
 * latin1 during multipart parsing. Falls back to the raw string on error.
 */
const decodeUploadFileName = (fileName) => {
  const raw = String(fileName || "").trim();
  if (!raw) return "";
  try {
    return Buffer.from(raw, "latin1").toString("utf8").trim();
  } catch {
    return raw;
  }
};

/**
 * Derive a safe song title from an uploaded file's original name:
 *   - Decode potential latin1 mangling.
 *   - Strip the file extension.
 *   - Collapse whitespace and limit to 255 chars.
 */
const toSafeSongTitleFromFileName = (originalName) => {
  const path = require("path");
  const decodedName = decodeUploadFileName(originalName);
  const baseName = path
    .basename(String(decodedName || ""), path.extname(String(decodedName || "")))
    .trim();
  if (!baseName) return "Untitled";
  return baseName.replace(/\s+/g, " ").slice(0, 255);
};

// ---------------------------------------------------------------------------
// Field-parsing helpers
// ---------------------------------------------------------------------------

/**
 * Parse a form field that may arrive as a JSON string, a plain string, or
 * already as an array. Returns a flat array of non-empty values.
 *
 * Common for `artists` and `topicIds` in multipart song forms.
 */
const parseArrayField = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed.filter(Boolean) : [trimmed];
    } catch {
      return [trimmed];
    }
  }
  return [];
};

/**
 * Return unique, non-falsy values from an array.
 * Extracted from assistant.service to share a single implementation.
 */
const unique = (values) => [...new Set(values.filter(Boolean))];

/**
 * Extract meaningful search terms from a user prompt.
 * Normalises text then splits into tokens of ≥2 characters.
 */
const extractPromptTerms = (prompt = "") => {
  const normalized = normalizeText(prompt);
  return unique(
    normalized
      .split(" ")
      .map((term) => term.trim())
      .filter((term) => term.length >= 2)
  );
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  escapeRegex,
  escapeRegexChar,
  isObjectIdLike,
  isHttpUrl,
  normalizeSearchText,
  normalizeText,
  VIET_CHAR_GROUPS,
  toAccentInsensitivePattern,
  buildSearchRegexes,
  decodeUploadFileName,
  toSafeSongTitleFromFileName,
  parseArrayField,
  unique,
  extractPromptTerms,
};
