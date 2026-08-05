/**
 * logger.js — Winston-based logger setup for structured log outputs.
 *
 * Configured with:
 *   - Console logging (colorized format for development / stdout capture).
 *   - File logging to logs/error.log (for error level only).
 *   - File logging to logs/combined.log (all logs).
 */

const winston = require("winston");
const path = require("path");

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: logFormat,
  defaultMeta: { service: "musicflow-backend" },
  transports: [
    new winston.transports.File({
      filename: path.join(__dirname, "..", "..", "logs", "error.log"),
      level: "error",
    }),
    new winston.transports.File({
      filename: path.join(__dirname, "..", "..", "logs", "combined.log"),
    }),
  ],
});

// If we are not in production or running locally, log to console as well
if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    })
  );
} else {
  // Production console logging for container logs (Docker/K8s/Render logs tab)
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
    })
  );
}

module.exports = logger;
