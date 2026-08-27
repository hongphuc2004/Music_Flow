const mistralEnricher = require("./mistralEnricher.service");

/**
 * AI Orchestrator Service
 * Responsibilities:
 * - Refined Rule Engine: Route Explicit Music Queries to Gemini Raw (Bypass) for 1.5s fast latency,
 *   while Routing Emotional / Implicit / Complex Context to Mistral Enricher.
 * - Manages Graceful Fallback to raw user prompt if Mistral fails (timeout/429/5xx/auth/invalid JSON).
 * - Ensures Mistral failure NEVER crashes Gemini requests.
 * - NO business logic / MongoDB queries, NO extra user quotas.
 */

const aiDataLoader = require("../ai/aiDataLoader.service");

const intentRule = aiDataLoader.getRule("intent");

// Personal feelings, stories, complex emotional states, or implicit context
const EMOTIONAL_CONTEXT_SIGNALS = intentRule.emotionalSignals || [
  "tôi buồn", "mình buồn", "em buồn", "anh buồn", "tôi thấy buồn",
  "mệt mỏi", "áp lực", "crush", "sếp mắng", "bị mắng", "tâm trạng tệ",
  "căng thẳng", "cô đơn", "khóc", "đau lòng", "bế tắc", "tôi mệt",
  "yêu đời", "vui quá", "nhận lương", "bình tâm", "bình tĩnh",
  "xoa dịu", "chữa lành", "gương vỡ", "stress", "tôi vừa", "vừa bị",
  "tôi vừa chia tay", "mình vừa chia tay", "vừa chia tay",
  "tôi thất tình", "mình thất tình", "vừa thất tình"
];

// Direct music commands asking for music/playlists/artists without personal emotional context
const EXPLICIT_MUSIC_PATTERNS = (intentRule.explicitMusicPatterns || []).map(p => new RegExp(p, "i"));

// Pure conversational & system command bypass signals
const BYPASS_PATTERNS = (intentRule.bypassPatterns || []).map(p => new RegExp(p, "i"));



/**
 * Determines whether a user prompt genuinely requires Music Intent/Mood Enrichment.
 * 
 * Rules:
 * 1. Greetings, system commands, non-music chat -> BYPASS (false)
 * 2. Personal emotional context / implicit state / mixed emotion -> ENRICH (true)
 * 3. Direct explicit music queries (e.g. "nhạc buồn", "playlist chạy bộ") -> BYPASS (false)
 * 
 * @param {string} userPrompt 
 * @returns {boolean}
 */
function shouldEnrichPrompt(userPrompt) {
  if (!userPrompt || typeof userPrompt !== "string") return false;
  const cleaned = userPrompt.trim().toLowerCase();
  if (!cleaned) return false;

  // Rule 1: Non-music greeting, system commands & explicit non-music tool commands (e.g. image generation) -> BYPASS
  for (const pattern of BYPASS_PATTERNS) {
    if (pattern.test(cleaned)) {
      return false;
    }
  }

  const isImageReq = /(tao|ve|draw|create|generate|sinh|make).*(anh|hinh|image|picture|photo|artwork|pic)/i.test(cleaned);
  if (isImageReq) {
    return false;
  }

  // Rule 2: Emotional / Implicit / Complex Context -> ENRICH
  const hasEmotionalContext = EMOTIONAL_CONTEXT_SIGNALS.some((signal) => cleaned.includes(signal));
  if (hasEmotionalContext) {
    return true;
  }

  // Rule 3: Explicit Music Queries without personal emotional story -> BYPASS
  const isExplicitMusicQuery = EXPLICIT_MUSIC_PATTERNS.some((pattern) => pattern.test(cleaned));
  if (isExplicitMusicQuery) {
    return false;
  }

  // Rule 4: Short queries (<= 3 words) without explicit emotional signals -> BYPASS
  const wordCount = cleaned.split(/\s+/).length;
  if (wordCount <= 3) {
    return false;
  }

  // Default to true for long ambiguous prompts to allow Mistral enrichment
  return true;
}

/**
 * Formats enriched JSON data into a clean context string to be appended for Gemini AI DJ
 * 
 * @param {Object} data - Standardized enriched data object
 * @returns {string}
 */
function formatEnrichedContext(data) {
  if (!data) return "";
  const parts = [];
  if (data.intent) parts.push(`Intent: ${data.intent}`);
  if (data.mood && data.mood !== "none") parts.push(`Mood: ${data.mood}`);
  if (data.genre && data.genre.length > 0) parts.push(`Genre: ${data.genre.join(", ")}`);
  if (data.activity) parts.push(`Activity: ${data.activity}`);
  if (data.keywords && data.keywords.length > 0) parts.push(`Keywords: ${data.keywords.join(", ")}`);
  if (data.constraints?.tempo && data.constraints.tempo !== "any") parts.push(`Tempo: ${data.constraints.tempo}`);
  if (data.constraints?.language && data.constraints.language !== "any") parts.push(`Language: ${data.constraints.language}`);

  return parts.length > 0 ? `[AI Context: ${parts.join(" | ")}]` : "";
}

/**
 * Orchestrates prompt preprocessing with Mistral and prepares the prompt/context for Gemini AI DJ.
 * Guarantees graceful fallback on ANY Mistral failure.
 * 
 * @param {Object} options
 * @param {string} options.userPrompt - Original raw user prompt
 * @param {string} [options.model="mistral-small-latest"] - Production model candidate
 * @returns {Promise<Object>} Orchestrated result
 */
async function processUserRequest({
  userPrompt,
  model = "mistral-small-latest",
} = {}) {
  const rawPrompt = (userPrompt || "").trim();

  // 1. Refined Routing Check (Bypass vs Enrich)
  if (!shouldEnrichPrompt(rawPrompt)) {
    return {
      enriched: false,
      reason: "bypass",
      promptForGemini: rawPrompt,
      enrichedContext: "",
      enrichedData: null,
    };
  }

  // 2. Execute Mistral Enrichment (Single attempt)
  try {
    const enrichResult = await mistralEnricher.enrichPrompt({
      userPrompt: rawPrompt,
      model,
    });

    // 3. Check Success & Schema Validity
    if (enrichResult.success && enrichResult.data) {
      const enrichedContext = formatEnrichedContext(enrichResult.data);
      const combinedPrompt = enrichedContext ? `${enrichedContext}\nUser Request: ${rawPrompt}` : rawPrompt;

      return {
        enriched: true,
        reason: "success",
        promptForGemini: combinedPrompt,
        enrichedContext,
        enrichedData: enrichResult.data,
        usage: enrichResult.usage || null,
      };
    }

    // 4. Graceful Fallback on Failure (timeout/429/5xx/auth/invalid JSON)
    console.warn(`[AI Orchestrator] Mistral enrichment fallback (Reason: ${enrichResult.errorType || "failed"}). Using raw prompt.`);
    return {
      enriched: false,
      reason: enrichResult.errorType || "enrichment_failed",
      promptForGemini: rawPrompt,
      enrichedContext: "",
      enrichedData: null,
      errorDetails: enrichResult.message,
    };
  } catch (err) {
    // Catch-all safety guard to NEVER crash Gemini request
    console.warn("[AI Orchestrator] Unhandled error during orchestration, falling back to raw prompt:", err.message);
    return {
      enriched: false,
      reason: "exception_fallback",
      promptForGemini: rawPrompt,
      enrichedContext: "",
      enrichedData: null,
      errorDetails: err.message,
    };
  }
}

module.exports = {
  shouldEnrichPrompt,
  formatEnrichedContext,
  processUserRequest,
  EMOTIONAL_CONTEXT_SIGNALS,
  EXPLICIT_MUSIC_PATTERNS,
  BYPASS_PATTERNS,
};
