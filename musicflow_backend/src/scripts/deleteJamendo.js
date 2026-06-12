const dotenv = require("dotenv");

const target = process.argv[2] || "dev";
const envFile = target === "prod" ? ".env.prod" : ".env.dev";

dotenv.config({ path: envFile });

const mongoose = require("mongoose");
const Song = require("../models/song.model");

async function deleteJamendo() {
    try {
        console.log("Using env:", envFile);

        await mongoose.connect(process.env.MONGO_URI);
        console.log(`Connected to database`);

        const result = await Song.deleteMany({ source: "jamendo" });

        console.log("Deletion completed");
        console.log(`Deleted ${result.deletedCount} jamendo songs from the database.`);
    } catch (error) {
        console.error("Deletion failed:", error.message);
    } finally {
        await mongoose.disconnect();
        console.log("Disconnected");
    }
}

deleteJamendo();
