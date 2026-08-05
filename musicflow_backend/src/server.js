const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const dotenv = require("dotenv");
const rateLimit = require("express-rate-limit");
const morgan = require("morgan");
const logger = require("./utils/logger");

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
const planRoute = require("./routes/plan.route");
const subscriptionRoute = require("./routes/subscription.route");
const adminPremiumRoute = require("./routes/admin-premium.route");

const adminRoute = require("./routes/admin.route");
const commentRoute = require("./routes/comment.route");
const artistRoute = require("./routes/artist.route");
const aiRoute = require("./routes/ai.route");
const assistantRoute = require("./routes/assistant.route");
const { cloudinaryRootFolder } = require("./config/cloudinaryFolders");
const { startMonthlyListenersJob } = require("./jobs/monthlyListeners.job");
const app = express();

const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:5173,http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

// Rate limiter — using express-rate-limit (proper in-process store with TTL cleanup).
// The previous custom implementation used a Map that was never cleaned up,
// causing a memory leak under sustained traffic.
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many authentication requests. Please try again later." },
});

const generalRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests. Please slow down." },
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

// HTTP Request logging using Morgan, piped to Winston
const morganFormat = process.env.NODE_ENV === "production" ? "combined" : "dev";
app.use(
  morgan(morganFormat, {
    stream: {
      write: (message) => logger.info(message.trim()),
    },
  })
);

app.use("/api/auth", authRateLimiter);
app.use("/api/admin/auth/login", authRateLimiter);
app.use("/api/artist/login", authRateLimiter);
app.use("/api/artist/google", authRateLimiter);

// Health check endpoint (no rate limit, no auth)
app.get("/health", (req, res) =>
  res.json({ status: "ok", uptime: Math.floor(process.uptime()) })
);

// General rate limit applies to all API routes
app.use("/api", generalRateLimiter);

// routes
app.use("/api/upload", uploadRoute);
app.use("/api/songs", songRoute);
app.use("/api/auth", authRoute);
app.use("/api/topics", topicRoute);
app.use("/api/playlists", playlistRoute);
app.use("/api/favorites", favoriteRoute);
app.use("/api/song-likes", songLikeRoute);
app.use("/api/users", userRoute);
app.use("/api/plans", planRoute);
app.use("/api/subscriptions", subscriptionRoute);
app.use("/api/admin/premium", adminPremiumRoute);
app.use("/api/admin", adminRoute);

app.use("/api/comments", commentRoute);

// Artist routes
app.use("/api/artist", artistRoute);

// AI DJ routes
app.use("/api/ai", aiRoute);

// Global AI Assistant routes
app.use("/api/ai/assistant", assistantRoute);

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

  logger.error("Unhandled server error: %s", err.stack || err.message || err);
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
    logger.info(`Environment: ${process.env.NODE_ENV}`);
    logger.info(`MongoDB connected: ${conn.connection.host}`);
    startMonthlyListenersJob();
  })
  .catch((err) => logger.error("MongoDB connection error on startup: %s", err.stack || err));

mongoose.connection.on('error', err => {
  logger.error('Mongoose connection error: %s', err.stack || err);
});

mongoose.connection.on('disconnected', () => {
  logger.info('Mongoose disconnected');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Env file: ${envFileName}`);
  logger.info(`Cloudinary folder: ${cloudinaryRootFolder}`);
});
