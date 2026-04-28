const normalizeFolderSegment = (value) =>
  String(value || "")
    .trim()
    .replace(/^\/+|\/+$/g, "");

const defaultRootFolder =
  process.env.NODE_ENV === "production" ? "musicflow_prod" : "musicflow";

const cloudinaryRootFolder = normalizeFolderSegment(
  process.env.CLOUDINARY_FOLDER || defaultRootFolder
);

const cloudinaryFolder = (subfolder) => {
  const normalizedSubfolder = normalizeFolderSegment(subfolder);
  return normalizedSubfolder
    ? `${cloudinaryRootFolder}/${normalizedSubfolder}`
    : cloudinaryRootFolder;
};

const defaultSongImageUrl = () => {
  if (process.env.CLOUDINARY_DEFAULT_SONG_IMAGE_URL) {
    return process.env.CLOUDINARY_DEFAULT_SONG_IMAGE_URL;
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || "dvhpcqpkq";
  return `https://res.cloudinary.com/${cloudName}/image/upload/${cloudinaryFolder("images")}/tgdfbp3zivuqoxqxpltj.jpg`;
};

module.exports = {
  cloudinaryFolder,
  cloudinaryRootFolder,
  defaultSongImageUrl,
};
