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

// Safe fallback pool (strictly active models as of today, no deprecated/shutdown models)
const SAFE_FALLBACK_POOL = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-1.5-flash-latest",
  "gemini-1.5-pro-latest",
];

const LAST_KNOWN_GOOD_PATH = path.join(__dirname, "../config/last_known_good_models.json");

// Helper to delay execution
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Calculates next midnight in America/Los_Angeles timezone (accounting for DST).
 * Returns a standard UTC Date object.
 */
function getNextMidnightLA() {
  const now = new Date();
  
  // Get current date components in America/Los_Angeles timezone
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

  // Construct a pseudo-UTC Date representing current LA time components
  const currentLAInUTC = Date.UTC(
    parseInt(map.year),
    parseInt(map.month) - 1, // 0-indexed
    parseInt(map.day),
    parseInt(map.hour),
    parseInt(map.minute),
    parseInt(map.second)
  );

  // Offset in milliseconds between UTC and LA time at this exact moment
  const offsetMs = now.getTime() - currentLAInUTC;

  // Tomorrow's midnight components in LA
  const tomorrowMidnightLAInUTC = Date.UTC(
    parseInt(map.year),
    parseInt(map.month) - 1,
    parseInt(map.day) + 1, // Next day
    0, 0, 0, 0
  );

  // Actual UTC timestamp of tomorrow's LA midnight
  const nextMidnightUTCTimestamp = tomorrowMidnightLAInUTC + offsetMs;

  return new Date(nextMidnightUTCTimestamp);
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
      // Extract model names and save to memory and disk cache
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
  
  // Format as mock API response structures
  return poolToUse.map((name) => {
    // If name doesn't start with models/, add it for compatibility
    const fullName = name.startsWith("models/") ? name : `models/${name}`;
    return {
      name: fullName,
      supportedGenerationMethods: ["generateContent"], // Assume basic content capability
      displayName: name,
    };
  });
}

/**
 * Checks if a model is currently marked as exhausted.
 */
function isModelExhausted(modelName) {
  if (exhaustedModels.has(modelName)) {
    const unavailableUntil = exhaustedModels.get(modelName);
    if (new Date() < unavailableUntil) {
      return true;
    }
    // Lock period expired
    exhaustedModels.delete(modelName);
  }
  return false;
}

/**
 * Ranks and scores models according to version, GA stability, and workload tier.
 */
function calculateModelScore(modelName) {
  const cleanName = modelName.replace(/^models\//, "");
  
  // 1. Version extraction
  let version = 1.0;
  const versionMatch = cleanName.match(/gemini-(\d+\.?\d*)/);
  if (versionMatch) {
    version = parseFloat(versionMatch[1]);
  }
  let score = version * 10;

  // 2. Adjust for Tier
  if (cleanName.includes("pro")) {
    score += 1.0; // Pro
  } else if (cleanName.includes("flash-lite")) {
    score += 0.2; // Lite
  } else if (cleanName.includes("flash")) {
    score += 0.5; // Standard Flash
  }

  // 3. Adjust for stability (Previews have penalty)
  if (cleanName.includes("-preview") || cleanName.includes("-experimental")) {
    score -= 0.1;
  }

  return score;
}

/**
 * Classifies the error thrown by the Gemini API.
 */
function classifyError(error) {
  const msg = (error.message || "").toLowerCase();
  const status = error.status || (error.response ? error.response.status : null);

  // 1. Not Found (404)
  if (status === 404 || msg.includes("not found") || msg.includes("404")) {
    return { action: "prune" };
  }

  // 2. Bad Request (400) - Client issue (no fallback/retry)
  if (status === 400 || msg.includes("400") || msg.includes("invalid argument") || msg.includes("invalid request")) {
    return { action: "throw" };
  }

  // 3. Quota Limit / Resource Exhausted (429)
  if (status === 429 || msg.includes("429") || msg.includes("resource_exhausted") || msg.includes("quota")) {
    const isDaily = (msg.includes("daily") || msg.includes("per day") || msg.includes("limit exceeded")) &&
                    !msg.includes("rpm") && !msg.includes("tpm") && !msg.includes("minute") && !msg.includes("request");
    if (isDaily) {
      return { action: "exhaust" };
    }
    
    // Extract Retry-After if available
    let retryAfterSecs = null;
    if (error.response && error.response.headers && error.response.headers["retry-after"]) {
      retryAfterSecs = parseInt(error.response.headers["retry-after"]);
    }
    return { action: "retry", delayMs: retryAfterSecs ? retryAfterSecs * 1000 : null };
  }

  // 4. Overloaded / Service Unavailable (503)
  if (status === 503 || msg.includes("503") || msg.includes("unavailable") || msg.includes("overloaded")) {
    return { action: "retry" };
  }

  // 5. Generic Error
  return { action: "fallback" };
}

/**
 * Resolves list of candidate models matching the requested capability.
 */
async function getCandidateModels({ requiresTools = false, preferredModel = null }) {
  const rawPool = await fetchModels();

  const filtered = rawPool.filter((m) => {
    const fullName = m.name;
    const cleanName = fullName.replace(/^models\//, "");

    // Must be in active pool
    if (prunedModels.has(fullName) || prunedModels.has(cleanName)) return false;
    if (isModelExhausted(fullName) || isModelExhausted(cleanName)) return false;

    // Rely on supportedGenerationMethods metadata
    if (Array.isArray(m.supportedGenerationMethods) && !m.supportedGenerationMethods.includes("generateContent")) {
      return false;
    }

    // Exclude special models (Image, TTS, robotics, computer-use, deep-research, embedding, live)
    const safetyBlacklist = [
      "-tts",
      "-image",
      "image-preview",
      "robotics",
      "lyria",
      "computer-use",
      "nano-banana",
      "deep-research",
      "antigravity",
      "embedding",
      "aqa",
      "text-embedding",
    ];
    if (safetyBlacklist.some((bad) => cleanName.toLowerCase().includes(bad))) {
      return false;
    }

    // If orchestration/tools required, filter out models that lack function calling support (like Gemma)
    if (requiresTools) {
      if (cleanName.startsWith("gemma")) return false;
    }

    return true;
  });

  // Calculate scores and sort
  const scored = filtered.map((m) => ({
    model: m.name,
    score: calculateModelScore(m.name),
  }));

  scored.sort((a, b) => b.score - a.score);
  let candidates = scored.map((item) => item.model);

  // If preferredModel is supplied, force it to the front of candidates (even if not in discovered list)
  if (preferredModel) {
    const cleanPref = preferredModel.replace(/^models\//, "");
    candidates = candidates.filter(c => c.replace(/^models\//, "") !== cleanPref);
    candidates.unshift(cleanPref);
  }

  // Ensure every returned name has models/ prefix removed to match GoogleGenerativeAI SDK expectations
  return candidates.map(name => name.replace(/^models\//, ""));
}

/**
 * Centralized wrapper to execute a block of Gemini code with routing, retries, and fallbacks.
 */
async function executeWithModelRouter({ task, requiresTools = true, preferredModel = null }) {
  const candidates = await getCandidateModels({ requiresTools, preferredModel });
  
  if (candidates.length === 0) {
    throw new Error("No Gemini models available in the pool");
  }

  let lastError = null;
  for (const modelName of candidates) {
    // Double check exhaustion (might have updated inside loop)
    if (isModelExhausted(modelName)) {
      continue;
    }

    let attempts = 0;
    const maxRetries = 2;
    let delayMs = 1000;

    while (attempts <= maxRetries) {
      try {
        // Run the task and return result immediately on success
        return await task(modelName);
      } catch (error) {
        const errorInfo = classifyError(error);

        if (errorInfo.action === "prune") {
          console.warn(`Pruning Gemini model ${modelName} due to 404/Not Found`);
          prunedModels.add(modelName);
          prunedModels.add(`models/${modelName}`);
          // Remove from local cache file if exists
          const goodPool = loadLastKnownGoodPool();
          if (goodPool) {
            const updatedPool = goodPool.filter(n => n !== modelName && n !== `models/${modelName}`);
            saveLastKnownGoodPool(updatedPool);
          }
          break; // Break retry loop, move to next model
        }

        if (errorInfo.action === "exhaust") {
          const resetTime = getNextMidnightLA();
          console.warn(`Daily quota limit hit for ${modelName}. Marking unavailable until LA midnight: ${resetTime.toISOString()}`);
          exhaustedModels.set(modelName, resetTime);
          exhaustedModels.set(`models/${modelName}`, resetTime);
          break; // Break retry loop, fallback to next model
        }

        if (errorInfo.action === "throw") {
          // Bad request, do not fallback or retry
          throw error;
        }

        if (errorInfo.action === "retry" && attempts < maxRetries) {
          attempts++;
          const waitTime = errorInfo.delayMs || delayMs;
          console.warn(`Gemini rate limit or 503 on ${modelName}. Retrying attempt ${attempts}/${maxRetries} in ${waitTime}ms...`);
          await sleep(waitTime);
          delayMs *= 2; // Exponential backoff (if custom delay was not supplied)
          continue; // Loop and retry same model
        }

        // Generic fallback or exhausted all retries for standard rate limit / 503
        console.warn(`Failed execution on ${modelName} (Attempts: ${attempts + 1}). Trying next candidate.`);
        lastError = error;
        break; // Break retry loop, fallback to next model
      }
    }
  }

  throw lastError || new Error("All Gemini models in pool failed to execute");
}

module.exports = {
  executeWithModelRouter,
  getNextMidnightLA,
  getCandidateModels,
  prunedModels,
  exhaustedModels,
  modelCache,
};
