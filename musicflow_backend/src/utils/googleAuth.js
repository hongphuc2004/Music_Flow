const { OAuth2Client } = require("google-auth-library");

const googleClientId = process.env.GOOGLE_CLIENT_ID || "";
const oauthClient = new OAuth2Client(googleClientId || undefined);

function profileFromPayload(payload) {
  if (!payload) {
    const error = new Error("Invalid Google token payload");
    error.statusCode = 401;
    throw error;
  }

  const email = payload.email;
  const googleId = payload.sub;
  const name = payload.name;
  const avatar = payload.picture || "";
  const emailVerified = payload.email_verified ?? payload.verified_email;

  if (!email || !googleId || !name) {
    const error = new Error("Google token missing required profile fields");
    error.statusCode = 401;
    throw error;
  }

  if (emailVerified === false) {
    const error = new Error("Google account email is not verified");
    error.statusCode = 401;
    throw error;
  }

  return { googleId, email, name, avatar };
}

async function verifyIdTokenCredential(credential) {
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
  return profileFromPayload(payload);
}

async function verifyAccessTokenCredential(credential) {
  let response;
  try {
    response = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(credential)}`);
  } catch (networkError) {
    const error = new Error(`Unable to validate Google access token: ${networkError.message}`);
    error.statusCode = 401;
    throw error;
  }

  if (!response.ok) {
    const tokenInfoError = await response.text();
    const error = new Error(`Invalid Google access token: ${tokenInfoError}`);
    error.statusCode = 401;
    throw error;
  }

  const tokenInfo = await response.json();
  if (tokenInfo.aud !== googleClientId) {
    const error = new Error("Google access token audience mismatch");
    error.statusCode = 401;
    throw error;
  }

  let userInfoResponse;
  try {
    userInfoResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: {
        Authorization: `Bearer ${credential}`,
      },
    });
  } catch (networkError) {
    const error = new Error(`Unable to fetch Google user profile: ${networkError.message}`);
    error.statusCode = 401;
    throw error;
  }

  if (!userInfoResponse.ok) {
    const userInfoError = await userInfoResponse.text();
    const error = new Error(`Google profile request failed: ${userInfoError}`);
    error.statusCode = 401;
    throw error;
  }

  const userInfo = await userInfoResponse.json();
  return profileFromPayload(userInfo);
}

async function verifyGoogleCredential(credential, tokenType = null) {
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

  if (tokenType === "id_token") {
    return verifyIdTokenCredential(credential);
  }

  if (tokenType === "access_token") {
    return verifyAccessTokenCredential(credential);
  }

  try {
    return await verifyIdTokenCredential(credential);
  } catch (idTokenError) {
    return verifyAccessTokenCredential(credential);
  }
}

module.exports = {
  verifyGoogleCredential,
};
