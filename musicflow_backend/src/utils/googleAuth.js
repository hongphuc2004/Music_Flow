const { OAuth2Client } = require("google-auth-library");

const googleClientId = process.env.GOOGLE_CLIENT_ID || "";
const oauthClient = new OAuth2Client(googleClientId || undefined);

async function verifyGoogleCredential(credential) {
  if (!googleClientId) {
    const error = new Error("GOOGLE_CLIENT_ID is not configured on server");
    error.statusCode = 500;
    throw error;
  }

  if (!credential) {
    const error = new Error("Missing Google credential token");
    error.statusCode = 400;
    throw error;
  }

  let ticket;
  try {
    ticket = await oauthClient.verifyIdToken({
      idToken: credential,
      audience: googleClientId,
    });
  } catch (verifyError) {
    const error = new Error(`Invalid Google token: ${verifyError.message}`);
    error.statusCode = 401;
    throw error;
  }

  const payload = ticket.getPayload();
  if (!payload) {
    const error = new Error("Invalid Google token payload");
    error.statusCode = 401;
    throw error;
  }

  if (!payload.email || !payload.sub || !payload.name) {
    const error = new Error("Google token missing required profile fields");
    error.statusCode = 401;
    throw error;
  }

  if (payload.email_verified === false) {
    const error = new Error("Google account email is not verified");
    error.statusCode = 401;
    throw error;
  }

  return {
    googleId: payload.sub,
    email: payload.email,
    name: payload.name,
    avatar: payload.picture || "",
  };
}

module.exports = {
  verifyGoogleCredential,
};
