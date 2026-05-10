/* eslint-disable no-console */
const path = require("path");
const mongoose = require("mongoose");
const dotenv = require("dotenv");

const Song = require("../models/song.model");
const User = require("../models/user.model");
const Artist = require("../models/artist.model");

const args = process.argv.slice(2);
const shouldApply = args.includes("--apply");
const envArg = args.find((arg) => arg.startsWith("--env="));
const envName = envArg ? envArg.split("=")[1].trim() : "dev";

const envFileByName = {
  dev: ".env.dev",
  prod: ".env.prod",
};

const envFileName = envFileByName[envName] || ".env.dev";
const envPath = path.resolve(__dirname, "../../", envFileName);
dotenv.config({ path: envPath });

if (!process.env.MONGO_URI) {
  console.error(`Missing MONGO_URI in ${envFileName}`);
  process.exit(1);
}

const resolveSourceByUploader = async (uploadedBy) => {
  if (!uploadedBy) return "admin";

  const uploaderId = String(uploadedBy);

  const user = await User.findById(uploaderId).select("role").lean();
  if (user?.role === "admin") return "admin";
  if (user?.role === "user") return "user";

  const artist = await Artist.findById(uploaderId).select("role").lean();
  if (artist?.role === "artist") return "artist";

  return "user";
};

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log(`Connected DB via ${envFileName}`);
  console.log(`Mode: ${shouldApply ? "APPLY" : "DRY-RUN"}`);

  const songs = await Song.find({}).select("_id title source uploadedBy").lean();

  let unchanged = 0;
  let toUpdate = 0;
  const updates = [];
  const byTargetSource = { admin: 0, artist: 0, user: 0 };

  for (const song of songs) {
    const nextSource = await resolveSourceByUploader(song.uploadedBy);
    byTargetSource[nextSource] += 1;

    if (song.source === nextSource) {
      unchanged += 1;
      continue;
    }

    toUpdate += 1;
    updates.push({
      updateOne: {
        filter: { _id: song._id },
        update: { $set: { source: nextSource } },
      },
    });
  }

  console.log(`Total songs: ${songs.length}`);
  console.log(`Unchanged: ${unchanged}`);
  console.log(`Will update: ${toUpdate}`);
  console.log("Target source counts:", byTargetSource);

  if (!shouldApply) {
    console.log("Dry-run done. Re-run with --apply to write changes.");
    await mongoose.disconnect();
    return;
  }

  if (updates.length > 0) {
    const result = await Song.bulkWrite(updates, { ordered: false });
    console.log("Bulk write result:", {
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
    });
  } else {
    console.log("No updates needed.");
  }

  await mongoose.disconnect();
  console.log("Done.");
};

run().catch(async (error) => {
  console.error("Migration failed:", error);
  try {
    await mongoose.disconnect();
  } catch (disconnectError) {
  }
  process.exit(1);
});

