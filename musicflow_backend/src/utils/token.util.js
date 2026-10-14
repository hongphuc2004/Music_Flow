const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const RefreshToken = require("../models/refreshToken.model");

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("Missing JWT_SECRET environment variable");
  }
  return secret;
};

const JWT_EXPIRES_IN = "2h";
const REFRESH_EXPIRES_IN = 30; // days
const getRefreshCookieName = () => process.env.REFRESH_COOKIE_NAME || "mf_refresh_token";
const isProduction = () => process.env.NODE_ENV === "production";

function parseCookies(req) {
  const rawCookie = req?.headers?.cookie;
  if (!rawCookie) return {};

  return rawCookie.split(";").reduce((acc, part) => {
    const [name, ...valueParts] = part.trim().split("=");
    if (!name) return acc;
    acc[name] = decodeURIComponent(valueParts.join("="));
    return acc;
  }, {});
}

function setRefreshCookie(res, refreshToken) {
  res.cookie(getRefreshCookieName(), refreshToken, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: isProduction() ? "none" : "lax",
    maxAge: REFRESH_EXPIRES_IN * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

function clearRefreshCookie(res) {
  res.clearCookie(getRefreshCookieName(), {
    httpOnly: true,
    secure: isProduction(),
    sameSite: isProduction() ? "none" : "lax",
    path: "/",
  });
}

function generateRefreshToken() {
  const token = crypto.randomBytes(64).toString("hex");
  const expiresAt = new Date(
    Date.now() + REFRESH_EXPIRES_IN * 24 * 60 * 60 * 1000
  );
  return { token, expiresAt };
}

function hashRefreshToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

function signAccessToken(userId) {
  return jwt.sign({ userId }, getJwtSecret(), {
    expiresIn: JWT_EXPIRES_IN,
  });
}

async function rotateRefreshToken(userId, existingToken = null) {
  if (existingToken) {
    await RefreshToken.deleteOne({ tokenHash: hashRefreshToken(existingToken) });
  } else {
    await RefreshToken.findOneAndDelete({ userId });
  }

  const { token, expiresAt } = generateRefreshToken();
  await RefreshToken.create({ userId, tokenHash: hashRefreshToken(token), expiresAt });
  return token;
}

module.exports = {
  get JWT_SECRET() {
    return process.env.JWT_SECRET || "";
  },
  get REFRESH_COOKIE_NAME() {
    return getRefreshCookieName();
  },
  JWT_EXPIRES_IN,
  REFRESH_EXPIRES_IN,
  parseCookies,
  setRefreshCookie,
  clearRefreshCookie,
  generateRefreshToken,
  hashRefreshToken,
  signAccessToken,
  rotateRefreshToken,
};
