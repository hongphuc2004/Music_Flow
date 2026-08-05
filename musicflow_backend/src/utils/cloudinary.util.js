/**
 * cloudinary.util.js — Cloudinary upload/delete helpers.
 *
 * Extracted from song.controller.js so upload logic lives in one place,
 * can be reused by multiple controllers, and is easy to mock in tests.
 *
 * All functions are async and throw on failure — callers should wrap in
 * try/catch and clean up temp files in a `finally` block.
 */

const fs = require("fs");
const cloudinary = require("../config/cloudinary");
const { cloudinaryFolder } = require("../config/cloudinaryFolders");

// ---------------------------------------------------------------------------
// Temp-file helpers
// ---------------------------------------------------------------------------

/**
 * Delete a temporary file from disk without throwing.
 * Safe to call with a null/undefined path.
 *
 * @param {string|null|undefined} filePath
 */
const safeUnlink = (filePath) => {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error("safeUnlink error:", error.message);
  }
};

// ---------------------------------------------------------------------------
// Audio upload
// ---------------------------------------------------------------------------

/**
 * Upload an audio file to Cloudinary.
 *
 * @param {string} filePath — absolute path to the local temp file
 * @returns {Promise<{ secure_url: string, public_id: string, duration: number }>}
 */
const uploadAudioToCloudinary = async (filePath) => {
  const result = await cloudinary.uploader.upload(filePath, {
    resource_type: "video",
    folder: cloudinaryFolder("audio"),
  });
  return {
    secure_url: result.secure_url,
    public_id: result.public_id,
    duration: result.duration || 0,
  };
};

// ---------------------------------------------------------------------------
// Image upload
// ---------------------------------------------------------------------------

/**
 * Upload an image to Cloudinary from a local file path.
 *
 * @param {string} filePath — absolute path to the local temp file
 * @returns {Promise<{ secure_url: string, public_id: string }>}
 */
const uploadImageFileToCloudinary = async (filePath) => {
  const result = await cloudinary.uploader.upload(filePath, {
    folder: cloudinaryFolder("images"),
  });
  return { secure_url: result.secure_url, public_id: result.public_id };
};

/**
 * Upload an image to Cloudinary from a remote URL.
 * Cloudinary fetches and re-hosts the image.
 *
 * @param {string} url — publicly accessible image URL
 * @returns {Promise<{ secure_url: string, public_id: string }>}
 */
const uploadImageUrlToCloudinary = async (url) => {
  const result = await cloudinary.uploader.upload(url, {
    folder: cloudinaryFolder("images"),
  });
  return { secure_url: result.secure_url, public_id: result.public_id };
};

/**
 * Delete a resource from Cloudinary by its public_id.
 *
 * @param {string} publicId
 * @param {"image"|"video"|"raw"} [resourceType="image"]
 * @returns {Promise<void>}
 */
const deleteFromCloudinary = async (publicId, resourceType = "image") => {
  if (!publicId) return;
  await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  safeUnlink,
  uploadAudioToCloudinary,
  uploadImageFileToCloudinary,
  uploadImageUrlToCloudinary,
  deleteFromCloudinary,
};
