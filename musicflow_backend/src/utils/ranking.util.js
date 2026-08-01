/**
 * ranking.util.js — Date-range and hourly-slot helpers for charts and
 * rankings endpoints.
 *
 * Extracted from song.controller.js so the logic can be unit-tested and
 * reused without importing the whole controller.
 */

const ONE_HOUR_MS = 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Period ranges
// ---------------------------------------------------------------------------

/**
 * Given a ranking period string ("today" | "week" | "month"), compute the
 * [start, end] for both the **current** period and the **previous** period
 * (used for trend / rise / drop calculations).
 *
 * @param {"today"|"week"|"month"} period
 * @returns {{
 *   currentStart: Date,
 *   currentEnd: Date,
 *   previousStart: Date,
 *   previousEnd: Date
 * }}
 */
const getRankingPeriodRange = (period) => {
  const now = new Date();
  const currentStart = new Date(now);

  if (period === "week") {
    const day = currentStart.getDay();
    const daysSinceMonday = day === 0 ? 6 : day - 1;
    currentStart.setDate(currentStart.getDate() - daysSinceMonday);
    currentStart.setHours(0, 0, 0, 0);
  } else if (period === "month") {
    currentStart.setDate(1);
    currentStart.setHours(0, 0, 0, 0);
  } else {
    // "today"
    currentStart.setHours(0, 0, 0, 0);
  }

  const previousStart = new Date(currentStart);
  if (period === "week") {
    previousStart.setDate(previousStart.getDate() - 7);
  } else if (period === "month") {
    previousStart.setMonth(previousStart.getMonth() - 1);
  } else {
    previousStart.setDate(previousStart.getDate() - 1);
  }

  return {
    currentStart,
    currentEnd: now,
    previousStart,
    previousEnd: currentStart,
  };
};

// ---------------------------------------------------------------------------
// Rank map
// ---------------------------------------------------------------------------

/**
 * Convert an ordered array of rank items into a Map of songId → rank number.
 * Rank 1 = first item (highest).
 *
 * @param {Array<{ songId: { toString(): string } }>} items
 * @returns {Map<string, number>}
 */
const buildRankMap = (items) =>
  new Map(items.map((item, index) => [item.songId.toString(), index + 1]));

// ---------------------------------------------------------------------------
// Hourly slots (for flowchart timelines)
// ---------------------------------------------------------------------------

/**
 * Truncate a Date to the start of its hour (minutes/seconds/ms = 0).
 *
 * @param {Date|string|number} date
 * @returns {Date}
 */
const truncateToHour = (date) => {
  const d = new Date(date);
  d.setMinutes(0, 0, 0);
  return d;
};

/**
 * Build an ordered array of `hours` Date values, each truncated to the top
 * of an hour, ending at the current hour.
 *
 * Used to create the X-axis slots for the flowchart chart series.
 *
 * @param {number} hours — number of hourly slots
 * @returns {Date[]}
 */
const buildHourlySlots = (hours) => {
  const nowHour = truncateToHour(new Date());
  return Array.from({ length: hours }, (_, index) => {
    const offset = hours - 1 - index;
    return new Date(nowHour.getTime() - offset * ONE_HOUR_MS);
  });
};

module.exports = {
  ONE_HOUR_MS,
  getRankingPeriodRange,
  buildRankMap,
  truncateToHour,
  buildHourlySlots,
};
