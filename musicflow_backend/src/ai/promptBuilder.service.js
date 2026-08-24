const aiDataLoader = require("./aiDataLoader.service");

/**
 * Prompt Builder Service
 * Responsibilities:
 * - Assembles dynamic Gemini systemInstructions & prompts by combining external files:
 *   System Rules + Personality + Safety + Role Knowledge + User Profile / Adaptive Context
 * - Single source of truth for AI prompt formatting in MusicFlow
 */

/**
 * Builds complete System Instruction string for Gemini based on user role
 * @param {string} actorRole - 'user' | 'artist' | 'admin'
 * @returns {string} Fully assembled system instruction
 */
function buildSystemInstruction(actorRole = "user") {
  const systemBase = aiDataLoader.getPrompt("system");
  const personality = aiDataLoader.getPrompt("personality");
  const musicflowOverview = aiDataLoader.getKnowledge("musicflow");
  const safety = aiDataLoader.getPrompt("safety");

  const sections = [];

  if (systemBase) sections.push(systemBase);
  if (personality) sections.push(personality);
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
  getMoodTopicMap,
  getIntentRules,
  getRecommendationRules,
};
