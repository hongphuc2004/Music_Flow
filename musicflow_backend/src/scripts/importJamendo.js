const dotenv = require("dotenv");

const target = process.argv[2] || "dev";

const envFile = target === "prod" ? ".env.prod" : ".env.dev";

dotenv.config({ path: envFile });

const mongoose = require("mongoose");
const axios = require("axios");
const Song = require("../models/song.model");

async function importJamendo() {
    try {
        console.log("Using env:", envFile);

        await mongoose.connect(process.env.MONGO_URI);
        console.log(`Connected to ${target} database`);

        const response = await axios.get("https://api.jamendo.com/v3.0/tracks/", {
            params: {
                client_id: process.env.JAMENDO_CLIENT_ID,
                format: "json",
                limit: 200
            }
        });

        const tracks = response.data.results || [];

        let inserted = 0;
        let skipped = 0;

        for (const track of tracks) {
            const existed = await Song.findOne({
                source: "jamendo",
                sourceId: track.id
            });

            if (existed) {
                skipped++;
                continue;
            }

            await Song.create({
                title: track.name,

                source: "jamendo",
                sourceId: track.id,
                sourceUrl: track.shareurl,

                audioUrl: track.audio,
                audioPublicId: null,

                imageUrl: track.image,
                imagePublicId: null,

                duration: track.duration,
                lyrics: "",

                commentCount: 0,
                likeCount: 0,
                playCount: 0,
                shareCount: 0,

                allowDownload: track.audiodownload_allowed,
                isPublic: true,

                artists: [],
                topicIds: []
            });

            inserted++;
        }

        console.log("Import completed");
        console.log(`Inserted: ${inserted}`);
        console.log(`Skipped: ${skipped}`);
    } catch (error) {
        console.error("Import failed:", error.message);
    } finally {
        await mongoose.disconnect();
        console.log("Disconnected");
    }
}

importJamendo();