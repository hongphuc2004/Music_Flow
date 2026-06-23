const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const dotenv = require("dotenv");

const envFileFromVar = process.env.ENV_FILE;
const envFileName = envFileFromVar
  || (process.env.NODE_ENV === "production" ? ".env.prod" : ".env.dev");
const envPath = path.resolve(__dirname, "..", envFileName);
const envFallbackPath = path.resolve(__dirname, "..", ".env");

dotenv.config({ path: envPath });
if (!process.env.GEMINI_API_KEY || !process.env.JWT_SECRET) {
  dotenv.config({ path: envFallbackPath });
}

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
const aiRoute = require("./routes/ai.route");
const { cloudinaryRootFolder } = require("./config/cloudinaryFolders");
const { startMonthlyListenersJob } = require("./jobs/monthlyListeners.job");
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
  exposedHeaders: ["X-Total-Count", "X-Page", "X-Limit", "X-Total-Pages"],
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

// AI DJ routes
app.use("/api/ai", aiRoute);

// Return JSON for unknown API routes so clients do not receive HTML error pages.
app.use("/api", (req, res) => {
  return res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// Normalize multipart and unexpected server errors into JSON for frontend.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      success: false,
      message: `Upload error: ${err.message}`,
    });
  }

  if (typeof err?.message === "string" && err.message.includes("Multipart: Boundary not found")) {
    return res.status(400).json({
      success: false,
      message: "Upload error: multipart boundary is missing. Please submit FormData without overriding Content-Type.",
    });
  }

  console.error("Unhandled server error:", err);
  return res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

// connect DB
mongoose
  .connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 5000
  })
  .then((conn) => {
    console.log(`Environment: ${process.env.NODE_ENV}`);
    console.log(`MongoDB connected: ${conn.connection.host}`);
    startMonthlyListenersJob();
  })
  .catch((err) => console.error("MongoDB connection error on startup:", err));

mongoose.connection.on('error', err => {
  console.error('Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('Mongoose disconnected');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Env file: ${envFileName}`);
  console.log(`Cloudinary folder: ${cloudinaryRootFolder}`);
});
