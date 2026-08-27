/**
 * Image Generator Service — MusicFlow
 * 
 * Provides professional image prompt enrichment and a multi-provider adapter architecture
 * for generating high-quality realistic, cinematic, or stylized music album covers and artwork.
 */

const axios = require("axios");

// In-memory cache for generated prompt URLs (TTL: 1 hour)
const imageCache = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000;

/**
 * Removes Vietnamese accents/diacritics from text to prevent CLIP tokenizer errors.
 * @param {string} str 
 * @returns {string}
 */
function removeVietnameseTones(str = "") {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .trim();
}

/**
 * Detects the intended visual style from user description.
 * @param {string} prompt 
 * @returns {"realistic" | "cinematic" | "anime" | "illustration" | "fantasy" | "cyberpunk" | "album_art"}
 */
function detectStyle(prompt = "") {
  const text = removeVietnameseTones(prompt).toLowerCase();
  if (/\b(anime|manga|chibi|ghibli|2d)\b/.test(text)) return "anime";
  if (/\b(ve|minh hoa|illustration|drawing|sketch|painting|artistic)\b/.test(text) && !/\b(chup|anh that|chankhat|photoreal)\b/.test(text)) return "illustration";
  if (/\b(fantasy|huyen ao|magic|than thoai|co tich)\b/.test(text)) return "fantasy";
  if (/\b(cyberpunk|neon|sci-fi|tuong lai|futuristic)\b/.test(text)) return "cyberpunk";
  if (/\b(real|realistic|photorealistic|chup|anh that|nhan vat that|doi thuong)\b/.test(text)) return "realistic";
  if (/\b(bia album|album cover|nhac|music|cover)\b/.test(text)) return "album_art";
  return "cinematic";
}

/**
 * Uses Gemini LLM to accurately translate any Vietnamese prompt (short or complex)
 * into a vivid, descriptive English prompt for AI Image Generation.
 * 
 * @param {string} vietnamesePrompt 
 * @returns {Promise<string|null>}
 */
async function translatePromptToEnglishWithGemini(vietnamesePrompt = "") {
  if (!vietnamesePrompt || !vietnamesePrompt.trim()) return null;

  try {
    const geminiRouter = require("./geminiRouter.service");
    const systemPrompt = "You are an expert AI image prompt engineer. Translate the following Vietnamese image description into a concise, vivid English prompt suitable for AI image generation (SDXL/Flux). Output ONLY the English prompt, no preamble, no markdown, no quotes.";

    const result = await geminiRouter.executeWithModelRouter({
      contents: [
        {
          role: "user",
          parts: [{ text: `${systemPrompt}\n\nVietnamese Description: "${vietnamesePrompt.trim()}"\nEnglish Image Prompt:` }]
        }
      ],
      modelTier: "basic",
    });

    const text = result?.response?.text()?.trim();
    if (text && text.length >= 3) {
      const cleaned = text.replace(/^["']|["']$/g, "").trim();
      // Ensure no Vietnamese accents remain
      if (!/[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]/i.test(cleaned)) {
        return cleaned;
      }
    }
  } catch (err) {
    console.warn("[ImageGenerator] Gemini AI prompt translation unavailable, using dictionary fallback:", err.message);
  }
  return null;
}

/**
 * Robust Vietnamese to English Keyword Dictionary Mapping (Fallback)
 */
const dictionary = [
  { vi: /bau troi|bầu trời|troi|trời/gi, en: "serene blue sky with soft fluffy white clouds" },
  { vi: /ngan ha|ngân hà|dai ngan ha|dải ngân hà|galaxy/gi, en: "glowing milky way galaxy" },
  { vi: /day sao|đầy sao|vi sao|vì sao|starry/gi, en: "twinkling starry night" },
  { vi: /anh trang|ánh trăng|trang|trăng|moonlight|moon/gi, en: "radiant moonlight" },
  { vi: /buc tranh|bức tranh|tranh/gi, en: "artistic painting" },
  { vi: /nghe thuat|nghệ thuật/gi, en: "artistic aesthetic" },
  { vi: /thien nhien|thiên nhiên/gi, en: "serene raw nature landscape with lush vegetation and misty mountains" },
  { vi: /bien|biển|dai duong|đại dương/gi, en: "breathtaking ocean coastline with turquoise waves" },
  { vi: /hoang hon|hoàng hôn/gi, en: "golden hour warm sunset horizon" },
  { vi: /binh minh|bình minh/gi, en: "golden morning sunrise" },
  { vi: /dem mua|đêm mưa|troi mua|trời mưa/gi, en: "rainy moody night with ambient neon reflections" },
  { vi: /nhac chill|chill/gi, en: "aesthetic cozy lofi relaxing atmosphere" },
  { vi: /nhac buon|sad/gi, en: "melancholic emotional solitude scene" },
  { vi: /thanh pho|thành phố/gi, en: "modern urban city skyline under dramatic sky" },
  { vi: /rung|rừng/gi, en: "mystical ancient forest with god rays" },
  { vi: /ban dem|ban đêm|đêm|dem/gi, en: "atmospheric night scene" },
  { vi: /bia album|bìa album|album/gi, en: "music album cover art" },
  { vi: /hoa|bong hoa|bông hoa/gi, en: "vibrant blooming flora" },
  { vi: /xe|o to|ô tô|xe hoi|xe hơi/gi, en: "sports car vehicle" },
  { vi: /ca si|ca sĩ|singer/gi, en: "vocalist music artist performing" },
  { vi: /san khau|sân khấu/gi, en: "concert stage with spot lights" },
  { vi: /co gai|cô gái|thieu nu|thiếu nữ/gi, en: "young woman" },
];

/**
 * Translates Vietnamese image description into clean, professional English subject (Fallback).
 * @param {string} vietnameseText 
 * @returns {string}
 */
function translateSubjectToEnglish(vietnameseText = "") {
  let cleanUser = vietnameseText
    .replace(/tạo (cho tôi |giúp tôi )?(1 |một )?(bức |tấm |hình )?(ảnh|hình|hinh|pic|photo)?\s*(về|chủ đề)?/gi, "")
    .replace(/vẽ (cho tôi |giúp tôi )?(1 |một )?(bức |tấm |hình )?(ảnh|hình|hinh|pic|photo)?\s*(về|chủ đề)?/gi, "")
    .replace(/make|create|draw|generate/gi, "")
    .replace(/\b(mot|di|dum|cho|toi|ve|cu|cung|cùng|lap lanh|lấp lánh|ket hop|kết hợp|huyen ao|huyền ảo|nhe ngang|nhẹ nhàng|chieu roi|chiếu rọi|phong cach|phong cách|tinh te|tinh tế)\b/gi, " ")
    .trim();

  if (!cleanUser) {
    return "a serene atmospheric scenery";
  }

  // Apply Dictionary Translations
  dictionary.forEach(({ vi, en }) => {
    cleanUser = cleanUser.replace(vi, en);
  });

  // Strip remaining un-translated Vietnamese words to prevent CLIP model confusion
  let stripped = removeVietnameseTones(cleanUser)
    .replace(/\b(mot|di|dum|cho|toi|ve|cu|cung|lap|lanh|ket|hop|huyen|ao|nhe|ngang|chieu|roi|phong|cach|tinh|te|xanh|tham|trong|vat|voi|vai|dam|may|trang|xop|mem|mai|troi|lung|lo|anh|nang|vang|diu|nghe|nghe|thuat|ky|thuat|so|tuoi|sang|va|binh|yen)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!stripped || stripped.length < 3) {
    stripped = "serene blue sky visual landscape with soft clouds and golden sunlight";
  }

  return stripped;
}

/**
 * Translates/expands user descriptions into professional, highly-detailed English image prompts.
 * 
 * @param {string} userPrompt 
 * @param {string} [title=""] 
 * @returns {Promise<string>} Enhanced Prompt
 */
async function buildEnrichedPrompt(userPrompt = "", title = "") {
  const style = detectStyle(userPrompt);

  // 1. Try Gemini AI Translation First
  let EnglishSubject = await translatePromptToEnglishWithGemini(userPrompt);

  // 2. Fallback to dictionary translation
  if (!EnglishSubject) {
    EnglishSubject = translateSubjectToEnglish(userPrompt);
  }

  // Style modifiers according to detected style
  let styleModifiers = "";

  switch (style) {
    case "realistic":
      styleModifiers = "award-winning photorealism, shot on 35mm lens, f/1.8 aperture, intricate texture, natural skin tones, ultra-realistic lighting, 8k resolution, raw photo quality";
      break;
    case "anime":
      styleModifiers = "studio ghibli aesthetic, anime concept art, vibrant cel shading, detailed background, atmospheric lighting, masterpiece";
      break;
    case "illustration":
      styleModifiers = "digital art illustration, refined brushstrokes, rich color palette, creative composition, artistic mood";
      break;
    case "fantasy":
      styleModifiers = "epic fantasy concept art, ethereal magical aura, intricate detail, glowing runes, cinematic scale, unreal engine 5 render style";
      break;
    case "cyberpunk":
      styleModifiers = "cyberpunk aesthetic, glowing neon lights, futuristic cyan and magenta hues, rainy street reflections, high contrast, cinematic depth";
      break;
    case "album_art":
      styleModifiers = "professional music album cover design, minimalist elegant typography framing, striking visual focal point, artistic aesthetic, 8k resolution";
      break;
    case "cinematic":
    default:
      styleModifiers = "cinematic film still, volumetric lighting, rich color grading, dramatic depth of field, professional photography, high detail, masterpiece";
      break;
  }

  const qualityBoosters = "highly detailed, 8k resolution, crisp focus, clean composition, professional lighting";

  const fullPrompt = `${EnglishSubject}, ${styleModifiers}, ${qualityBoosters}`;
  return fullPrompt;
}

/**
 * Image Generation Provider: Pollinations AI with Flux Model
 * @param {string} enrichedPrompt 
 * @param {Object} options 
 * @returns {Promise<string>} Image URL
 */
async function generateViaPollinations(enrichedPrompt, options = {}) {
  const model = process.env.IMAGE_MODEL || "flux";
  const width = options.width || 1024;
  const height = options.height || 1024;
  const seed = Math.floor(Math.random() * 1000000);

  // Sanitize prompt for Pollinations URL
  const cleanEnglishPrompt = enrichedPrompt.replace(/[^\x00-\x7F]/g, "").trim();
  const encodedPrompt = encodeURIComponent(cleanEnglishPrompt);
  const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&model=${model}&seed=${seed}&nologo=true&enhance=true`;

  return imageUrl;
}

/**
 * Main Image Generation Entry Point with Provider Architecture & Fallback
 * 
 * @param {Object} params
 * @param {string} params.prompt - Raw user prompt / description
 * @param {string} [params.title="Tác phẩm AI"] - Optional image title
 * @param {number} [params.width=1024]
 * @param {number} [params.height=1024]
 * @returns {Promise<{ success: boolean, imageUrl: string, prompt: string, title: string, provider: string, enrichedPrompt: string }>}
 */
async function generateImage({ prompt, title = "Tác phẩm AI", width = 1024, height = 1024 } = {}) {
  if (!prompt || !prompt.trim()) {
    throw new Error("Prompt must be a non-empty string");
  }

  const cleanPrompt = prompt.trim();
  const cacheKey = `${cleanPrompt.toLowerCase()}_${width}x${height}`;

  // Check Cache
  const cached = imageCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return {
      success: true,
      imageUrl: cached.imageUrl,
      prompt: cleanPrompt,
      title,
      provider: cached.provider,
      enrichedPrompt: cached.enrichedPrompt,
      isCached: true,
    };
  }

  const enrichedPrompt = await buildEnrichedPrompt(cleanPrompt, title);
  let imageUrl = "";
  let provider = process.env.IMAGE_PROVIDER || "pollinations";

  try {
    // Primary Provider Call
    imageUrl = await generateViaPollinations(enrichedPrompt, { width, height });
  } catch (err) {
    console.warn("[ImageGenerator] Primary provider failed, attempting fallback:", err.message);
    const safeEnglish = translateSubjectToEnglish(cleanPrompt);
    const safeEncoded = encodeURIComponent(safeEnglish);
    imageUrl = `https://image.pollinations.ai/prompt/${safeEncoded}?width=${width}&height=${height}&nologo=true`;
    provider = "pollinations_fallback";
  }

  // Save to Cache
  imageCache.set(cacheKey, {
    imageUrl,
    provider,
    enrichedPrompt,
    timestamp: Date.now(),
  });

  return {
    success: true,
    imageUrl,
    prompt: cleanPrompt,
    title,
    provider,
    enrichedPrompt,
  };
}

module.exports = {
  detectStyle,
  removeVietnameseTones,
  translateSubjectToEnglish,
  translatePromptToEnglishWithGemini,
  buildEnrichedPrompt,
  generateImage,
  imageCache,
};
