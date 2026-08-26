const mistralProvider = require("./mistralProvider.service");
const aiDataLoader = require("../ai/aiDataLoader.service");

/**
 * System Prompt instructing Mistral to extract music intents and moods into strict JSON
 */
const getEnricherSystemPrompt = () => aiDataLoader.getPrompt("mistral-enricher");


/**
 * Validates whether the parsed JSON object strictly conforms to the expected MusicFlow Enricher Schema
 * @param {any} obj 
 * @returns {{ valid: boolean, error?: string }}
 */
function validateEnricherSchema(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    return { valid: false, error: "Response is not a valid JSON object" };
  }

  const validIntents = ["RECOMMEND_MUSIC", "SEARCH", "CREATE_PLAYLIST", "CHAT", "UNKNOWN"];
  const validMoods = ["sad", "happy", "energetic", "chill", "focus", "romantic", "sleep", "party", "angry", "none"];

  if (typeof obj.intent !== "string" || !validIntents.includes(obj.intent.toUpperCase())) {
    return { valid: false, error: `Invalid or missing field "intent": ${obj.intent}` };
  }

  if (typeof obj.mood !== "string" || !validMoods.includes(obj.mood.toLowerCase())) {
    return { valid: false, error: `Invalid or missing field "mood": ${obj.mood}` };
  }

  if (!Array.isArray(obj.genre)) {
    return { valid: false, error: `Field "genre" must be an Array` };
  }

  if (typeof obj.activity !== "string") {
    return { valid: false, error: `Field "activity" must be a string` };
  }

  if (!Array.isArray(obj.keywords)) {
    return { valid: false, error: `Field "keywords" must be an Array` };
  }

  if (!obj.constraints || typeof obj.constraints !== "object" || Array.isArray(obj.constraints)) {
    return { valid: false, error: `Field "constraints" must be an Object` };
  }

  return { valid: true };
}

/**
 * Enriches user prompt using Mistral AI by extracting structured Intent, Mood, Genre, and Keywords
 * 
 * @param {Object} options
 * @param {string} options.userPrompt - Raw user prompt string
 * @param {string} [options.model="mistral-small-latest"] - Mistral model ID (supports parameterization for benchmarking)
 * @returns {Promise<Object>} Normalized result object
 */
async function enrichPrompt({
  userPrompt,
  model = "mistral-small-latest",
} = {}) {
  if (!userPrompt || typeof userPrompt !== "string" || !userPrompt.trim()) {
    return {
      success: false,
      provider: "mistral",
      model,
      errorType: "invalid_input",
      message: "User prompt must be a non-empty string",
    };
  }

  const messages = [
    { role: "system", content: getEnricherSystemPrompt() },
    { role: "user", content: userPrompt.trim() },
  ];


  // Call pure provider SDK wrapper
  const providerResult = await mistralProvider.chatCompletion({
    model,
    messages,
    responseFormat: { type: "json_object" },
    temperature: 0.1,
  });

  if (!providerResult.success) {
    return {
      success: false,
      provider: "mistral",
      model,
      errorType: providerResult.errorType || "unknown",
      message: providerResult.message || "Provider call failed",
    };
  }

  const rawContent = providerResult.data?.content || "";

  // Parse JSON safely
  let parsedObj = null;
  try {
    // Sanitize in case model wraps output in markdown ```json ... ```
    let sanitizedContent = rawContent.trim();
    if (sanitizedContent.startsWith("```")) {
      sanitizedContent = sanitizedContent.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    }
    parsedObj = JSON.parse(sanitizedContent);
  } catch (err) {
    return {
      success: false,
      provider: "mistral",
      model,
      errorType: "invalid_json_schema",
      message: `Failed to parse JSON output: ${err.message}. Raw output: "${rawContent}"`,
    };
  }

  // Validate JSON schema
  const schemaValidation = validateEnricherSchema(parsedObj);
  if (!schemaValidation.valid) {
    return {
      success: false,
      provider: "mistral",
      model,
      errorType: "invalid_json_schema",
      message: `JSON schema validation failed: ${schemaValidation.error}`,
    };
  }

  // Standardize schema values
  const normalizedData = {
    intent: parsedObj.intent.toUpperCase(),
    mood: parsedObj.mood.toLowerCase(),
    genre: parsedObj.genre.map((g) => String(g).toLowerCase()),
    activity: String(parsedObj.activity || "").toLowerCase(),
    keywords: parsedObj.keywords.map((k) => String(k).toLowerCase()),
    constraints: {
      tempo: String(parsedObj.constraints?.tempo || "any").toLowerCase(),
      language: String(parsedObj.constraints?.language || "any").toLowerCase(),
    },
  };

  return {
    success: true,
    provider: "mistral",
    model,
    data: normalizedData,
    usage: providerResult.data?.usage || null,
  };
}

module.exports = {
  enrichPrompt,
  validateEnricherSchema,
  getEnricherSystemPrompt,
  get ENRICHER_SYSTEM_PROMPT() {
    return getEnricherSystemPrompt();
  },
};

