import crypto from "node:crypto";

const DEFAULT_SECRET = "change-this-secret";
const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || DEFAULT_SECRET;
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function validateAdminCredentials(username, password) {
  const validUsername = process.env.ADMIN_USERNAME;
  const validPassword = process.env.ADMIN_PASSWORD;

  if (!validUsername || !validPassword) {
    return false;
  }

  return safeEqual(username, validUsername) && safeEqual(password, validPassword);
}

export function createAdminSessionToken(username) {
  const timestamp = Date.now().toString();
  const payload = `${username}:${timestamp}`;
  const signature = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");
  return `${payload}:${signature}`;
}

export function isAdminAuthenticated(token) {
  if (!token) {
    return false;
  }

  const [username, timestamp, signature] = token.split(":");

  if (!username || !timestamp || !signature) {
    return false;
  }

  if (process.env.NODE_ENV === "production" && SESSION_SECRET === DEFAULT_SECRET) {
    return false;
  }

  const payload = `${username}:${timestamp}`;
  const expected = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");
  const issuedAt = Number(timestamp);
  const isFresh = Number.isFinite(issuedAt) && Date.now() - issuedAt < SESSION_TTL_MS;

  return isFresh && safeEqual(signature, expected);
}
