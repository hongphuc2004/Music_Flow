/**
 * cache.util.js — Lightweight In-Memory TTL Cache with Memory Bound and Invalidation.
 *
 * Designed for caching public, low-frequency mutation data (Topics, System Playlists, Rankings, Flowchart).
 * DOES NOT cache user-specific data, stream tokens, or audio binaries.
 */

class InMemoryTtlCache {
  constructor({ maxEntries = 500, defaultTtlMs = 5 * 60 * 1000 } = {}) {
    this.store = new Map();
    this.maxEntries = maxEntries;
    this.defaultTtlMs = defaultTtlMs;

    // Periodic sweep every 2 minutes to free memory from expired keys
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpired();
    }, 2 * 60 * 1000);

    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Set a key with value and TTL.
   *
   * @param {string} key
   * @param {*} value
   * @param {number} [ttlMs]
   */
  set(key, value, ttlMs = this.defaultTtlMs) {
    if (this.store.size >= this.maxEntries) {
      // Evict oldest inserted entry
      const firstKey = this.store.keys().next().value;
      if (firstKey) this.store.delete(firstKey);
    }

    const expiresAt = Date.now() + ttlMs;
    this.store.set(key, { value, expiresAt });
  }

  /**
   * Get value by key. Returns null if expired or missing.
   *
   * @param {string} key
   * @returns {*|null}
   */
  get(key) {
    const item = this.store.get(key);
    if (!item) return null;

    if (Date.now() > item.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return item.value;
  }

  /**
   * Invalidate a single key or all keys matching a prefix.
   *
   * @param {string} keyOrPrefix
   */
  invalidate(keyOrPrefix) {
    if (!keyOrPrefix) {
      this.store.clear();
      return;
    }

    for (const key of this.store.keys()) {
      if (key === keyOrPrefix || key.startsWith(keyOrPrefix)) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Helper to wrap an async fetch function with caching.
   *
   * @param {string} key
   * @param {number} ttlMs
   * @param {Function} fetchFn - Async function returning data
   * @returns {Promise<*>}
   */
  async wrap(key, ttlMs, fetchFn) {
    const cached = this.get(key);
    if (cached !== null && cached !== undefined) {
      return cached;
    }

    const freshData = await fetchFn();
    if (freshData !== null && freshData !== undefined) {
      this.set(key, freshData, ttlMs);
    }
    return freshData;
  }

  /**
   * Remove expired keys to keep heap clean.
   */
  cleanupExpired() {
    const now = Date.now();
    for (const [key, item] of this.store.entries()) {
      if (now > item.expiresAt) {
        this.store.delete(key);
      }
    }
  }
}

// Global shared instances
const cache = new InMemoryTtlCache();

const CACHE_TTL = {
  TOPICS: 10 * 60 * 1000,         // 10 minutes
  SYSTEM_PLAYLISTS: 5 * 60 * 1000, // 5 minutes
  RANKINGS: 3 * 60 * 1000,        // 3 minutes
  FLOWCHART: 3 * 60 * 1000,       // 3 minutes
};

module.exports = {
  InMemoryTtlCache,
  cache,
  CACHE_TTL,
};
