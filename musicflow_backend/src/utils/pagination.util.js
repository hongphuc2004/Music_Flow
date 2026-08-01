/**
 * pagination.util.js — Request pagination helpers.
 *
 * Extracted from song.controller.js so every route can reuse the same
 * safe-bounded page/limit parsing and response-header injection.
 */

/**
 * Parse `page` and `limit` from a query-string object.
 * Both values are clamped to sane bounds:
 *   - page  : minimum 1
 *   - limit : 1 … 50 (default 20, configurable via `defaultLimit`)
 *
 * Also computes the MongoDB `skip` value for convenience.
 *
 * @param {object} query       - req.query or equivalent
 * @param {number} [defaultLimit=20]
 * @returns {{ page: number, limit: number, skip: number }}
 */
const parsePagination = (query, defaultLimit = 20) => {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(
    Math.max(parseInt(query.limit, 10) || defaultLimit, 1),
    50
  );
  return { page, limit, skip: (page - 1) * limit };
};

/**
 * Inject standard pagination metadata into response headers.
 *
 * Headers set:
 *   X-Total-Count  — total number of matching documents
 *   X-Page         — current page number
 *   X-Limit        — page size used
 *   X-Total-Pages  — total number of pages
 *
 * @param {import('express').Response} res
 * @param {{ page: number, limit: number, total: number }} opts
 */
const setPaginationHeaders = (res, { page, limit, total }) => {
  res.set({
    "X-Total-Count": String(total),
    "X-Page": String(page),
    "X-Limit": String(limit),
    "X-Total-Pages": String(Math.ceil(total / limit)),
  });
};

module.exports = { parsePagination, setPaginationHeaders };
