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
const userRoute = require("./routes/user.route");

const adminRoute = require("./routes/admin.route");
const commentRoute = require("./routes/comment.route");
const artistRoute = require("./routes/artist.route");
const app = express();

const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:5173,http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

function createRateLimiter({ windowMs, max, message }) {
  const hitsByKey = new Map();

  return (req, res, next) => {
    const now = Date.now();
    const key = `${req.ip || "unknown"}:${req.path}`;
    const bucket = hitsByKey.get(key);

    if (!bucket || now > bucket.resetAt) {
      hitsByKey.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (bucket.count >= max) {
      return res.status(429).json({
        success: false,
        message,
      });
    }

    bucket.count += 1;
    return next();
  };
}

const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: "Too many authentication requests. Please try again later.",
});

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
}));
app.use(express.json());

app.use("/api/auth", authRateLimiter);
app.use("/api/admin/auth/login", authRateLimiter);
app.use("/api/artist/login", authRateLimiter);
app.use("/api/artist/google", authRateLimiter);

// routes
app.use("/api/upload", uploadRoute);
app.use("/api/songs", songRoute);
app.use("/api/auth", authRoute);
app.use("/api/topics", topicRoute);
app.use("/api/playlists", playlistRoute);
app.use("/api/favorites", favoriteRoute);
app.use("/api/song-likes", songLikeRoute);
app.use("/api/users", userRoute);
app.use("/api/admin", adminRoute);

app.use("/api/comments", commentRoute);

// Artist routes
app.use("/api/artist", artistRoute);

// Return JSON for unknown API routes so clients do not receive HTML error pages.
app.use("/api", (req, res) => {
  return res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// connect DB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error(err));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
