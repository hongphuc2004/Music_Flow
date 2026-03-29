const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const uploadRoute = require("./routes/upload.route");
const songRoute = require("./routes/song.route");
const authRoute = require("./routes/auth.route");
const topicRoute = require("./routes/topic.route");
const playlistRoute = require("./routes/playlist.route");
const favoriteRoute = require("./routes/favorite.route");
const songLikeRoute = require("./routes/song-like.route");

const adminRoute = require("./routes/admin.route");
const commentRoute = require("./routes/comment.route");
const artistRoute = require("./routes/artist.route");
const youtubeRoute = require("./routes/youtube.route");
const app = express();

app.use(cors());
app.use(express.json());

// routes
app.use("/api/upload", uploadRoute);
app.use("/api/songs", songRoute);
app.use("/api/auth", authRoute);
app.use("/api/topics", topicRoute);
app.use("/api/playlists", playlistRoute);
app.use("/api/favorites", favoriteRoute);
app.use("/api/song-likes", songLikeRoute);
app.use("/api/admin", adminRoute);

app.use("/api/comments", commentRoute);
app.use("/api", youtubeRoute);

// Artist routes
app.use("/api/artist", artistRoute);

// connect DB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error(err));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
