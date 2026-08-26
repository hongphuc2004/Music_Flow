const aiDataLoader = require("./aiDataLoader.service");

/**
 * Prompt Builder Service
 * Responsibilities:
 * - Assembles dynamic Gemini systemInstructions & prompts by combining external files:
 *   System Rules + Personality + Safety + Role Knowledge + User Profile / Adaptive Context
 * - Single source of truth for AI prompt formatting in MusicFlow
 */

/**
 * Formats a compact 1-line User AI Memory summary string for system instructions
 * @param {Object} aiMemory 
 * @returns {string}
 */
function formatAiMemoryContext(aiMemory) {
  if (!aiMemory) return "";
  const topMoods = Array.isArray(aiMemory.topMoods) ? aiMemory.topMoods.filter(Boolean) : [];
  const topThemes = Array.isArray(aiMemory.topThemes) ? aiMemory.topThemes.filter(Boolean) : [];
  
  if (topMoods.length === 0 && topThemes.length === 0) return "";

  const hour = new Date().getHours();
  let currentSlot = "night";
  if (hour >= 5 && hour < 12) currentSlot = "morning";
  else if (hour >= 12 && hour < 18) currentSlot = "afternoon";
  else if (hour >= 18 && hour < 23) currentSlot = "evening";

  const slotPref = aiMemory.timeSlotPreferences?.[currentSlot];
  const slotMoods = Array.isArray(slotPref?.moods) ? slotPref.moods.filter(Boolean) : [];
  const slotEnergy = slotPref?.energy || "mixed";

  const moodPart = topMoods.length > 0 ? `Moods: ${topMoods.slice(0, 3).join(", ")}` : "";
  const themePart = topThemes.length > 0 ? `Themes: ${topThemes.slice(0, 2).join(", ")}` : "";
  const slotPart = slotMoods.length > 0 ? `Current ${currentSlot}: ${slotMoods.slice(0, 2).join(", ")} (${slotEnergy} energy)` : "";

  const details = [moodPart, themePart, slotPart].filter(Boolean).join(" | ");
  if (!details) return "";

  return `[User Memory: ${details}]`;
}

/**
 * Builds complete System Instruction string for Gemini based on user role and optional user memory
 * @param {string} actorRole - 'user' | 'artist' | 'admin'
 * @param {Object} [options]
 * @param {Object} [options.aiMemory] - User.aiMemory object
 * @returns {string} Fully assembled system instruction
 */
function buildSystemInstruction(actorRole = "user", options = {}) {
  const systemBase = aiDataLoader.getPrompt("system");
  const personality = aiDataLoader.getPrompt("personality");
  const musicflowOverview = aiDataLoader.getKnowledge("musicflow");
  const safety = aiDataLoader.getPrompt("safety");

  const sections = [];

  if (systemBase) sections.push(systemBase);
  if (personality) sections.push(personality);

  const memoryContext = formatAiMemoryContext(options.aiMemory);
  if (memoryContext) sections.push(memoryContext);

  if (musicflowOverview) sections.push(`## Các Siêu năng lực hệ thống:\n${musicflowOverview}`);

  // Role-specific knowledge
  if (actorRole === "artist") {
    const artistGuide = aiDataLoader.getKnowledge("features/artist-guide");
    if (artistGuide) sections.push(artistGuide);
  } else if (actorRole === "admin") {
    sections.push(
      "Người dùng hiện tại là QUẢN TRỊ VIÊN (Admin). Hãy trả lời với thái độ hỗ trợ quản trị, cung cấp số liệu phân tích tổng quan và hướng dẫn họ tới các trang cấu hình phù hợp khi được yêu cầu."
    );
  } else {
    const userGuide = aiDataLoader.getKnowledge("features/user-guide");
    if (userGuide) sections.push(userGuide);
  }

  if (safety) sections.push(safety);

  return sections.filter(Boolean).join("\n\n");
}


/**
 * Gets Mood Topic Map rule object
 * @returns {Object}
 */
function getMoodTopicMap() {
  return aiDataLoader.getRule("mood");
}

/**
 * Gets Intent classification rules (EMOTIONAL, EXPLICIT, BYPASS)
 * @returns {Object}
 */
function getIntentRules() {
  return aiDataLoader.getRule("intent");
}

/**
 * Gets Recommendation Strategy Configuration for Phase 2 / Phase 3
 * @returns {Object}
 */
function getRecommendationRules() {
  return aiDataLoader.getRule("recommendation");
}

module.exports = {
  buildSystemInstruction,
  formatAiMemoryContext,
  getMoodTopicMap,
  getIntentRules,
  getRecommendationRules,
};

