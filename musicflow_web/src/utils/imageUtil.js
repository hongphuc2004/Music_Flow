/**
 * imageUtil.js — Cloudinary Image URL Optimization Utilities.
 *
 * Automatically injects Cloudinary transformations (f_auto, q_auto, width/height resize)
 * into image URLs based on UI context, reducing payload from 2-5MB to 20-50KB WebP/AVIF.
 *
 * Rules:
 *  - Only applies to Cloudinary image URLs.
 *  - NEVER modifies audio files or non-Cloudinary links.
 *  - Preserves aspect ratio and prevents image distortion.
 */

const PRESETS = {
  song_thumb: { width: 120, height: 120, crop: 'fill' },
  song_card: { width: 240, height: 240, crop: 'fill' },
  playlist_card: { width: 320, height: 320, crop: 'fill' },
  avatar: { width: 160, height: 160, crop: 'fill' },
  now_playing: { width: 180, height: 180, crop: 'fill' },
  hero: { width: 1200, height: 600, crop: 'limit' },
  raw: {},
};

/**
 * Optimizes an image URL for performance if hosted on Cloudinary.
 *
 * @param {string} url - Source image URL
 * @param {Object|string} optionsOrPreset - Preset name (e.g. 'song_card', 'avatar') or custom { width, height, crop, quality, format }
 * @returns {string} Optimized URL or original URL
 */
export function getOptimizedImageUrl(url, optionsOrPreset = 'song_card') {
  if (!url || typeof url !== 'string') return url || '';

  const trimmedUrl = url.trim();
  if (!trimmedUrl) return '';

  // Only transform Cloudinary image URLs
  const isCloudinaryImage =
    trimmedUrl.includes('res.cloudinary.com') &&
    trimmedUrl.includes('/image/upload/') &&
    !trimmedUrl.includes('/video/upload/');

  if (!isCloudinaryImage) {
    return trimmedUrl;
  }

  const options = typeof optionsOrPreset === 'string'
    ? (PRESETS[optionsOrPreset] || PRESETS.song_card)
    : { ...PRESETS.song_card, ...optionsOrPreset };

  // If already transformed with f_auto/q_auto, avoid double transformations
  if (trimmedUrl.includes('/f_auto') || trimmedUrl.includes(',f_auto')) {
    return trimmedUrl;
  }

  const parts = [];
  // Format & Quality
  parts.push(options.format ? `f_${options.format}` : 'f_auto');
  parts.push(options.quality ? `q_${options.quality}` : 'q_auto');

  // Crop & Dimensions
  const crop = options.crop || 'fill';
  if (options.width && options.height) {
    parts.push(`c_${crop},w_${options.width},h_${options.height}`);
  } else if (options.width) {
    parts.push(`c_${crop === 'fill' ? 'scale' : crop},w_${options.width}`);
  } else if (options.height) {
    parts.push(`c_${crop === 'fill' ? 'scale' : crop},h_${options.height}`);
  }

  const transformationStr = parts.join(',');

  // Insert transformation right after "/image/upload/"
  return trimmedUrl.replace('/image/upload/', `/image/upload/${transformationStr}/`);
}

export default getOptimizedImageUrl;
