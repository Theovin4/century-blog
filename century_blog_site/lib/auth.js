import crypto from "node:crypto";

const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || "century-blog-secret";

export function validateAdminCredentials(username, password) {
  const validUsername = process.env.ADMIN_USERNAME || "admin";
  const validPassword = process.env.ADMIN_PASSWORD || "century123";

  return username === validUsername && password === validPassword;
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

  const payload = `${username}:${timestamp}`;
  const expected = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");
  const isFresh = Date.now() - Number(timestamp) < 1000 * 60 * 60 * 24 * 7;

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected)) && isFresh;
}
