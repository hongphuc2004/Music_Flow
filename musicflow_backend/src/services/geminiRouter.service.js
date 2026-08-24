const axios = require("axios");
const fs = require("fs");
const path = require("path");

// Memory cache for models
let modelCache = null;
let cacheExpiry = 0; // timestamp
const CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour

// Memory structures for model state
const exhaustedModels = new Map(); // modelName -> unavailableUntil Date
const prunedModels = new Set(); // modelNames that returned 404

// Local RPD limits configured directly from Google AI Studio Rate Limit Dashboard
const MODEL_ROUTING_RPD_LIMITS = {
  "gemini-3.5-flash-lite": 500,
  "gemini-3.1-flash-lite": 500,
  "gemini-3.7-flash": 20,
  "gemini-3.5-flash": 20,
  "gemini-2.5-flash": 20,
  "gemini-3.6-flash": 20,
  "gemini-3-flash-preview": 20,
  "gemini-2.5-flash-lite": 20,
};

// Model pools mapped strictly per MusicFlow subscription tier
const TIER_MODEL_POOLS = {
  premium: ["gemini-3.5-flash-lite", "gemini-3.7-flash"],
  plus: ["gemini-3.5-flash", "gemini-3.1-flash-lite"],
  go: ["gemini-2.5-flash", "gemini-3.6-flash", "gemini-3-flash-preview"],
  basic: ["gemini-2.5-flash-lite"],
};

// Safe fallback pool for offline/emergency fallback
const SAFE_FALLBACK_POOL = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-1.5-flash-latest",
  "gemini-1.5-pro-latest",
];

// Store outside src/ so nodemon does NOT watch it and restart the server on every Gemini model fetch
const LAST_KNOWN_GOOD_PATH = path.join(__dirname, "../../data/last_known_good_models.json");

// Helper to delay execution
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Calculates next midnight in America/Los_Angeles timezone (accounting for DST).
 * Returns a standard UTC Date object.
 */
function getNextMidnightLA() {
  const now = new Date();
  
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const map = {};
  parts.forEach((p) => {
    map[p.type] = p.value;
  });

  const currentLAInUTC = Date.UTC(
    parseInt(map.year),
    parseInt(map.month) - 1,
    parseInt(map.day),
    parseInt(map.hour),
    parseInt(map.minute),
    parseInt(map.second)
  );

  const offsetMs = now.getTime() - currentLAInUTC;

  const tomorrowMidnightLAInUTC = Date.UTC(
    parseInt(map.year),
    parseInt(map.month) - 1,
    parseInt(map.day) + 1,
    0, 0, 0, 0
  );

  const nextMidnightUTCTimestamp = tomorrowMidnightLAInUTC + offsetMs;
  return new Date(nextMidnightUTCTimestamp);
}

// Local RPD usage tracking counter (modelCleanName -> localUsedCount)
const modelRpdTracker = new Map();
let nextResetDate = getNextMidnightLA();

/**
 * Resets local RPD usage tracker if LA midnight has passed.
 */
function checkAndResetRpdTracker() {
  if (new Date() >= nextResetDate) {
    modelRpdTracker.clear();
    nextResetDate = getNextMidnightLA();
    console.log("modelRpdTracker reset at America/Los_Angeles midnight:", nextResetDate.toISOString());
  }
}

/**
 * Calculates remaining RPD for a given model clean name based on local usage tracker.
 */
function getRemainingRpd(modelName) {
  checkAndResetRpdTracker();
  const cleanName = modelName.replace(/^models\//, "");
  const limit = MODEL_ROUTING_RPD_LIMITS[cleanName] ?? 20;
  const used = modelRpdTracker.get(cleanName) || 0;
  return Math.max(0, limit - used);
}

/**
 * Increments local RPD usage tracker when an API request is actually dispatched.
 */
function incrementRpdUsage(modelName) {
  checkAndResetRpdTracker();
  const cleanName = modelName.replace(/^models\//, "");
  const current = modelRpdTracker.get(cleanName) || 0;
  modelRpdTracker.set(cleanName, current + 1);
}

/**
 * Marks a model as RPD exhausted until LA midnight.
 */
function markRpdExhausted(modelName) {
  checkAndResetRpdTracker();
  const cleanName = modelName.replace(/^models\//, "");
  const limit = MODEL_ROUTING_RPD_LIMITS[cleanName] ?? 20;
  modelRpdTracker.set(cleanName, limit); // Set remaining RPD to 0
  const resetTime = getNextMidnightLA();
  exhaustedModels.set(cleanName, resetTime);
  exhaustedModels.set(`models/${cleanName}`, resetTime);
}

/**
 * Persists a list of model names to the Last Known Good file.
 */
function saveLastKnownGoodPool(modelNames) {
  try {
    const configDir = path.dirname(LAST_KNOWN_GOOD_PATH);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    fs.writeFileSync(LAST_KNOWN_GOOD_PATH, JSON.stringify(modelNames, null, 2), "utf8");
  } catch (err) {
    console.error("Failed to save last known good models:", err.message);
  }
}

/**
 * Loads model names from the Last Known Good file.
 */
function loadLastKnownGoodPool() {
  try {
    if (fs.existsSync(LAST_KNOWN_GOOD_PATH)) {
      const data = fs.readFileSync(LAST_KNOWN_GOOD_PATH, "utf8");
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn("Failed to read last known good models, falling back to safe fallback:", err.message);
  }
  return null;
}

/**
 * Fetches available models from Gemini API or falls back to caches.
 */
async function fetchModels() {
  const now = Date.now();
  if (modelCache && now < cacheExpiry) {
    return modelCache;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("No GEMINI_API_KEY env variable found. Using fallback pool.");
    return loadFallbackPool();
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const response = await axios.get(url, { timeout: 8000 });
    
    if (response.data && Array.isArray(response.data.models)) {
      const modelsList = response.data.models;
      const rawModelNames = modelsList.map(m => m.name);
      saveLastKnownGoodPool(rawModelNames);

      modelCache = modelsList;
      cacheExpiry = now + CACHE_DURATION_MS;
      return modelCache;
    }
  } catch (err) {
    console.warn("Failed to fetch live Gemini model pool, trying fallback levels:", err.message);
  }

  return loadFallbackPool();
}

/**
 * Loads models from local file or safe hardcoded list, formatted as mock API response.
 */
function loadFallbackPool() {
  const goodPool = loadLastKnownGoodPool();
  const poolToUse = goodPool || SAFE_FALLBACK_POOL;
  
  return poolToUse.map((name) => {
    const fullName = name.startsWith("models/") ? name : `models/${name}`;
    return {
      name: fullName,
      supportedGenerationMethods: ["generateContent"],
      displayName: name,
    };
  });
}

/**
 * Checks if a model is currently marked as exhausted.
 */
function isModelExhausted(modelName) {
  const cleanName = modelName.replace(/^models\//, "");
  if (exhaustedModels.has(cleanName) || exhaustedModels.has(`models/${cleanName}`)) {
    const unavailableUntil = exhaustedModels.get(cleanName) || exhaustedModels.get(`models/${cleanName}`);
    if (new Date() < unavailableUntil) {
      return true;
    }
    exhaustedModels.delete(cleanName);
    exhaustedModels.delete(`models/${cleanName}`);
  }
  return false;
}

/**
 * Classifies the error thrown by the Gemini API.
 */
function classifyError(error) {
  const msg = (error.message || "").toLowerCase();
  const status = error.status || (error.response ? error.response.status : null);
  const responseData = error.response ? JSON.stringify(error.response.data || "").toLowerCase() : "";
  const fullText = `${msg} ${responseData}`;

  // 1. Not Found (404)
  if (status === 404 || fullText.includes("not found") || fullText.includes("404")) {
    return { action: "prune" };
  }

  // 2. Bad Request (400) - Client issue (no fallback/retry)
  if (status === 400 || fullText.includes("400") || fullText.includes("invalid argument") || fullText.includes("invalid request")) {
    return { action: "throw" };
  }

  // 3. Quota / Rate Limit (429)
  if (status === 429 || fullText.includes("429") || fullText.includes("resource_exhausted") || fullText.includes("quota")) {
    // Explicit Daily Quota / RPD check
    const isDailyQuota =
      (fullText.includes("daily") || fullText.includes("per day") || fullText.includes("requests per day") || fullText.includes("day quota")) &&
      !fullText.includes("rpm") &&
      !fullText.includes("tpm") &&
      !fullText.includes("per minute") &&
      !fullText.includes("requests per minute") &&
      !fullText.includes("tokens per minute");

    if (isDailyQuota) {
      return { action: "exhaust" };
    }

    const isRpmOrTpm =
      fullText.includes("rpm") ||
      fullText.includes("tpm") ||
      fullText.includes("per minute") ||
      fullText.includes("requests per minute") ||
      fullText.includes("tokens per minute");

    let retryAfterSecs = null;
    if (error.response && error.response.headers && error.response.headers["retry-after"]) {
      retryAfterSecs = parseInt(error.response.headers["retry-after"]);
    }

    if (isRpmOrTpm) {
      return { action: "retry", subType: "rpm_tpm", delayMs: retryAfterSecs ? retryAfterSecs * 1000 : null };
    }

    // Uncertain 429: DO NOT mark RPD exhausted! Retry/backoff first.
    return { action: "retry", subType: "uncertain", delayMs: retryAfterSecs ? retryAfterSecs * 1000 : null };
  }

  // 4. Overloaded / Service Unavailable (503)
  if (status === 503 || fullText.includes("503") || fullText.includes("unavailable") || fullText.includes("overloaded")) {
    return { action: "retry", subType: "503" };
  }

  // 5. Generic Error
  return { action: "fallback" };
}

/**
 * Resolves list of candidate models matching the user subscription tier.
 */
async function getCandidateModels({ requiresTools = false, preferredModel = null, userTier = "basic" }) {
  const rawPool = await fetchModels();

  const normalizedTier = (userTier || "basic").toLowerCase();
  const poolNames = TIER_MODEL_POOLS[normalizedTier] || TIER_MODEL_POOLS.basic;

  const availableSet = new Set(
    rawPool
      .filter((m) => {
        const cleanName = m.name.replace(/^models\//, "");
        if (Array.isArray(m.supportedGenerationMethods) && !m.supportedGenerationMethods.includes("generateContent")) {
          return false;
        }
        if (requiresTools && cleanName.startsWith("gemma")) {
          return false;
        }
        return true;
      })
      .map((m) => m.name.replace(/^models\//, ""))
  );

  const candidateList = [];

  for (const modelName of poolNames) {
    const cleanName = modelName.replace(/^models\//, "");

    if (prunedModels.has(cleanName) || prunedModels.has(`models/${cleanName}`)) continue;
    if (isModelExhausted(cleanName) || isModelExhausted(`models/${cleanName}`)) continue;

    const remainingRpd = getRemainingRpd(cleanName);
    if (remainingRpd <= 0) continue;

    candidateList.push({
      cleanName,
      remainingRpd,
      isAvailableInApi: availableSet.has(cleanName),
    });
  }

  // Fallback to poolNames if fetchModels was empty / mocked, filtering pruned & exhausted
  const validCandidates = candidateList.length > 0
    ? candidateList
    : poolNames
        .map((name) => name.replace(/^models\//, ""))
        .filter((cleanName) => {
          if (prunedModels.has(cleanName) || isModelExhausted(cleanName)) return false;
          return getRemainingRpd(cleanName) > 0;
        })
        .map((cleanName) => ({ cleanName, remainingRpd: getRemainingRpd(cleanName) }));

  // Sort descending by remaining RPD
  validCandidates.sort((a, b) => b.remainingRpd - a.remainingRpd);

  let candidates = validCandidates.map((c) => c.cleanName);

  // If preferredModel is supplied and belongs to current tier pool, force it to front
  if (preferredModel) {
    const cleanPref = preferredModel.replace(/^models\//, "");
    if (poolNames.some((n) => n.replace(/^models\//, "") === cleanPref)) {
      candidates = candidates.filter((c) => c !== cleanPref);
      candidates.unshift(cleanPref);
    }
  }

  return candidates;
}

/**
 * Centralized wrapper to execute a block of Gemini code with routing, retries, and fallbacks.
 */
async function executeWithModelRouter({ task, requiresTools = true, preferredModel = null, userTier = "basic" }) {
  const candidates = await getCandidateModels({ requiresTools, preferredModel, userTier });
  
  if (candidates.length === 0) {
    throw new Error(`Không có Gemini model khả dụng nào thuộc gói tài khoản ${userTier}`);
  }

  let lastError = null;
  for (const modelName of candidates) {
    if (isModelExhausted(modelName) || getRemainingRpd(modelName) <= 0) {
      continue;
    }

    let attempts = 0;
    const maxRetries = 2;
    let delayMs = 1000;

    while (attempts <= maxRetries) {
      try {
        // Increment local RPD tracker ONLY when an actual HTTP request task is executed
        incrementRpdUsage(modelName);

        // Run the task and return result immediately on success
        return await task(modelName);
      } catch (error) {
        const errorInfo = classifyError(error);

        if (errorInfo.action === "prune") {
          console.warn(`Pruning Gemini model ${modelName} due to 404/Not Found`);
          prunedModels.add(modelName);
          prunedModels.add(`models/${modelName}`);
          const goodPool = loadLastKnownGoodPool();
          if (goodPool) {
            const updatedPool = goodPool.filter(n => n !== modelName && n !== `models/${modelName}`);
            saveLastKnownGoodPool(updatedPool);
          }
          break; // Fallback to next candidate in tier
        }

        if (errorInfo.action === "exhaust") {
          console.warn(`Daily RPD quota limit hit for ${modelName}. Marking unavailable until LA midnight.`);
          markRpdExhausted(modelName);
          break; // Fallback immediately to next model in tier
        }

        if (errorInfo.action === "throw") {
          throw error; // Bad request, do not retry or fallback
        }

        if (errorInfo.action === "retry" && attempts < maxRetries) {
          attempts++;
          const waitTime = errorInfo.delayMs || delayMs;
          console.warn(`Gemini API retry on ${modelName} (Reason: ${errorInfo.subType || "rate_limit"}). Attempt ${attempts}/${maxRetries} in ${waitTime}ms...`);
          await sleep(waitTime);
          delayMs *= 2;
          continue; // Loop and retry same model
        }

        // Generic fallback or exhausted retries for RPM/TPM/503/uncertain
        console.warn(`Failed execution on ${modelName} (Attempts: ${attempts + 1}). Fallback to next candidate in tier.`);
        lastError = error;
        break; // Break retry loop, move to next model in tier
      }
    }
  }

  throw lastError || new Error(`Tất cả Gemini model thuộc gói ${userTier} đều không thể phản hồi`);
}

module.exports = {
  executeWithModelRouter,
  getNextMidnightLA,
  getCandidateModels,
  getRemainingRpd,
  incrementRpdUsage,
  markRpdExhausted,
  MODEL_ROUTING_RPD_LIMITS,
  TIER_MODEL_POOLS,
  prunedModels,
  exhaustedModels,
  modelCache,
};
