const { Mistral } = require("@mistralai/mistralai");

/**
 * Pure SDK Wrapper for Mistral AI
 * Responsibilities:
 * - Initialize SDK using process.env.MISTRAL_API_KEY
 * - Execute chat completion requests with timeout configured via process.env.MISTRAL_TIMEOUT_MS
 * - Normalize outputs into standardized response / error structures
 * - NO business logic, NO fallback decisions, NO hardcoded quotas
 */

/**
 * Classifies raw SDK / HTTP errors into standardized errorType categories
 * @param {Error|any} error 
 * @returns {"timeout" | "rate_limit" | "server_error" | "auth_error" | "unknown"}
 */
function classifyError(error) {
  if (!error) return "unknown";

  const statusCode = error.statusCode || error.status;
  const message = (error.message || "").toLowerCase();
  const bodyStr = typeof error.body === "string" ? error.body.toLowerCase() : "";

  if (error.name === "TimeoutError" || message.includes("timeout") || message.includes("timed out")) {
    return "timeout";
  }

  if (statusCode === 401 || message.includes("401") || message.includes("invalid api key") || bodyStr.includes("invalid api key")) {
    return "auth_error";
  }

  if (statusCode === 429 || message.includes("429") || message.includes("rate limit") || bodyStr.includes("rate_limited") || bodyStr.includes("1300")) {
    return "rate_limit";
  }

  if (statusCode >= 500 || message.includes("500") || message.includes("502") || message.includes("503") || message.includes("504") || message.includes("server error")) {
    return "server_error";
  }

  return "unknown";
}

/**
 * Executes a chat completion request to Mistral AI with configurable timeout
 * 
 * @param {Object} options
 * @param {string} [options.model="mistral-small-latest"] - Mistral model ID to use
 * @param {Array<Object>} options.messages - Array of chat message objects [{role, content}]
 * @param {Object} [options.responseFormat] - Optional response format (e.g. { type: "json_object" })
 * @param {number} [options.temperature=0.2] - Sampling temperature
 * @returns {Promise<Object>} Standardized result object
 */
async function chatCompletion({
  model = "mistral-small-latest",
  messages = [],
  responseFormat = null,
  temperature = 0.2,
} = {}) {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      provider: "mistral",
      errorType: "auth_error",
      message: "Missing process.env.MISTRAL_API_KEY",
    };
  }

  const timeoutMs = parseInt(process.env.MISTRAL_TIMEOUT_MS, 10) || 2000;

  try {
    const client = new Mistral({ apiKey });

    // Construct API params
    const params = {
      model,
      messages,
      temperature,
    };

    if (responseFormat) {
      params.responseFormat = responseFormat;
    }

    // Wrap execution with timeout constraint
    const timeoutPromise = new Promise((_, reject) => {
      const timer = setTimeout(() => {
        const err = new Error(`Mistral API request timed out after ${timeoutMs}ms`);
        err.name = "TimeoutError";
        reject(err);
      }, timeoutMs);
      
      // Ensure timer doesn't prevent Node process exit
      if (timer.unref) timer.unref();
    });

    const apiPromise = client.chat.complete(params);

    const response = await Promise.race([apiPromise, timeoutPromise]);

    const content = response?.choices?.[0]?.message?.content || "";

    return {
      success: true,
      provider: "mistral",
      model,
      data: {
        content,
        rawResponse: response,
        usage: response?.usage || null,
      },
    };
  } catch (err) {
    const errorType = classifyError(err);
    return {
      success: false,
      provider: "mistral",
      model,
      errorType,
      message: err.message || "Unknown error occurred during Mistral API call",
    };
  }
}

module.exports = {
  chatCompletion,
  classifyError,
};
