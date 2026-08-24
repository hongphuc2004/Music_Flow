const mistralProvider = require("./mistralProvider.service");

/**
 * System Prompt instructing Mistral to extract music intents and moods into strict JSON
 */
const ENRICHER_SYSTEM_PROMPT = `Bạn là trợ lý phân tích ngôn ngữ tự nhiên chuyên biệt cho ứng dụng âm nhạc MusicFlow.
Nhiệm vụ của bạn là phân tích câu hỏi/yêu cầu của người dùng và bóc tách thành đối tượng JSON duy nhất theo đúng định dạng Schema sau:

{
  "intent": "RECOMMEND_MUSIC" | "SEARCH" | "CREATE_PLAYLIST" | "CHAT" | "UNKNOWN",
  "mood": "sad" | "happy" | "energetic" | "chill" | "focus" | "romantic" | "sleep" | "party" | "angry" | "none",
  "genre": ["tên thể loại nhạc nếu có, ví dụ: pop, rock, ballad, lofi, v.v."],
  "activity": "hoạt động nếu có, ví dụ: chạy bộ, học bài, ngủ, lái xe, v.v. (nếu không có thì để \"\")",
  "keywords": ["từ khóa quan trọng liên quan đến cảm xúc/chủ đề"],
  "constraints": {
    "tempo": "fast" | "slow" | "medium" | "any",
    "language": "vi" | "en" | "any"
  }
}

Quy tắc BẮT BUỘC:
1. CHỈ trả về duy nhất một đối tượng JSON hợp lệ, KHÔNG kèm theo lời giải thích hay ký tự markdown ngoài JSON.
2. Giá trị "intent" phải thuộc một trong các enum: "RECOMMEND_MUSIC", "SEARCH", "CREATE_PLAYLIST", "CHAT", "UNKNOWN".
3. Giá trị "mood" phải thuộc một trong các enum: "sad", "happy", "energetic", "chill", "focus", "romantic", "sleep", "party", "angry", "none".
4. Trường "genre" và "keywords" BẮT BUỘC là mảng (Array).
5. Trường "constraints" BẮT BUỘC là đối tượng (Object).`;

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
    { role: "system", content: ENRICHER_SYSTEM_PROMPT },
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
  ENRICHER_SYSTEM_PROMPT,
};
