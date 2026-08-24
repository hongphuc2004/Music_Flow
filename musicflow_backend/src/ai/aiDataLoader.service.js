const fs = require("fs");
const path = require("path");

/**
 * AI Data Loader Service
 * Responsibilities:
 * - Reads external AI Prompts (.md), Knowledge Base (.md), and Rules (.json) from src/ai/
 * - Caches parsed file contents in RAM to ensure sub-millisecond access times without disk I/O per request
 * - Provides clean accessors: getPrompt(name), getKnowledge(name), getRule(name), clearCache()
 */

const AI_BASE_DIR = path.resolve(__dirname);

// In-memory cache map
const cache = {
  prompts: new Map(),
  knowledge: new Map(),
  rules: new Map(),
};

/**
 * Read text content from file path safely
 * @param {string} filePath 
 * @returns {string} Content string
 */
function readTextFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, "utf-8").trim();
    }
  } catch (err) {
    console.error(`[AIDataLoader] Error reading text file at ${filePath}:`, err.message);
  }
  return "";
}

/**
 * Read and parse JSON content safely
 * @param {string} filePath 
 * @returns {Object|Array} Parsed JSON object
 */
function readJsonFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(content);
    }
  } catch (err) {
    console.error(`[AIDataLoader] Error reading JSON file at ${filePath}:`, err.message);
  }
  return {};
}

/**
 * Get Markdown Prompt file content by name (e.g. 'system', 'personality', 'music-dj', 'safety')
 * @param {string} promptName 
 * @returns {string}
 */
function getPrompt(promptName) {
  if (cache.prompts.has(promptName)) {
    return cache.prompts.get(promptName);
  }

  const fileUri = path.join(AI_BASE_DIR, "prompts", `${promptName}.md`);
  const content = readTextFile(fileUri);
  cache.prompts.set(promptName, content);
  return content;
}

/**
 * Get Knowledge Base Markdown content by relative path (e.g. 'musicflow', 'features/user-guide', 'features/artist-guide')
 * @param {string} relativePath 
 * @returns {string}
 */
function getKnowledge(relativePath) {
  if (cache.knowledge.has(relativePath)) {
    return cache.knowledge.get(relativePath);
  }

  const fileUri = path.join(AI_BASE_DIR, "knowledge", `${relativePath}.md`);
  const content = readTextFile(fileUri);
  cache.knowledge.set(relativePath, content);
  return content;
}

/**
 * Get JSON Rule object by name (e.g. 'intent', 'mood', 'recommendation')
 * @param {string} ruleName 
 * @returns {Object}
 */
function getRule(ruleName) {
  if (cache.rules.has(ruleName)) {
    return cache.rules.get(ruleName);
  }

  const fileUri = path.join(AI_BASE_DIR, "rules", `${ruleName}.json`);
  const data = readJsonFile(fileUri);
  cache.rules.set(ruleName, data);
  return data;
}

/**
 * Clear in-memory cache (useful for testing or hot-reloading in dev)
 */
function clearCache() {
  cache.prompts.clear();
  cache.knowledge.clear();
  cache.rules.clear();
}

module.exports = {
  getPrompt,
  getKnowledge,
  getRule,
  clearCache,
};
