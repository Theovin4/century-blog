import crypto from "node:crypto";
import path from "node:path";
import { readJsonStore, writeJsonStore } from "@/lib/json-store";

const localFilePath = path.join(process.env.INIT_CWD || process.cwd(), "data", "users.json");
const publicId = "century-blog/data/users";

export const roleOptions = ["super_admin", "admin", "moderator", "editor"];
export const userStatusOptions = ["active", "suspended", "deleted"];

function normalizeRole(role) {
  return roleOptions.includes(role) ? role : "moderator";
}

function normalizeStatus(status) {
  return userStatusOptions.includes(status) ? status : "active";
}

function serializeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    username: user.username,
    role: user.role,
    status: user.status,
    passwordHash: user.passwordHash,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastLoginAt: user.lastLoginAt || "",
    suspendedAt: user.suspendedAt || "",
    deletedAt: user.deletedAt || ""
  };
}

function normalizeUser(user) {
  if (!user || typeof user !== "object") {
    return null;
  }

  return {
    id: String(user.id || crypto.randomUUID()),
    name: String(user.name || "").trim(),
    email: String(user.email || "").trim().toLowerCase(),
    username: String(user.username || "").trim().toLowerCase(),
    role: normalizeRole(String(user.role || "moderator").trim()),
    status: normalizeStatus(String(user.status || "active").trim()),
    passwordHash: String(user.passwordHash || ""),
    createdAt: String(user.createdAt || new Date().toISOString()),
    updatedAt: String(user.updatedAt || user.createdAt || new Date().toISOString()),
    lastLoginAt: String(user.lastLoginAt || ""),
    suspendedAt: String(user.suspendedAt || ""),
    deletedAt: String(user.deletedAt || "")
  };
}

export function sanitizeUserForClient(user) {
  if (!user) {
    return null;
  }

  const normalized = normalizeUser(user);

  return {
    id: normalized.id,
    name: normalized.name,
    email: normalized.email,
    username: normalized.username,
    role: normalized.role,
    status: normalized.status,
    createdAt: normalized.createdAt,
    updatedAt: normalized.updatedAt,
    lastLoginAt: normalized.lastLoginAt,
    suspendedAt: normalized.suspendedAt,
    deletedAt: normalized.deletedAt
  };
}

function envSuperAdmin() {
  const username = String(process.env.ADMIN_USERNAME || "").trim().toLowerCase();

  if (!username) {
    return null;
  }

  return {
    id: "env-super-admin",
    name: "Century Blog Super Admin",
    email: process.env.ADMIN_EMAIL ? String(process.env.ADMIN_EMAIL).trim().toLowerCase() : "admin@centuryblogg.vercel.app",
    username,
    role: "super_admin",
    status: "active",
    passwordHash: "",
    createdAt: process.env.ADMIN_CREATED_AT || "2026-01-01T00:00:00.000Z",
    updatedAt: process.env.ADMIN_CREATED_AT || "2026-01-01T00:00:00.000Z",
    lastLoginAt: "",
    suspendedAt: "",
    deletedAt: ""
  };
}

async function readUsersSource() {
  const users = await readJsonStore(localFilePath, publicId, []);
  return Array.isArray(users) ? users.map(normalizeUser).filter(Boolean) : [];
}

async function writeUsersSource(users) {
  await writeJsonStore(localFilePath, publicId, users.map(serializeUser));
}

export async function getStoredUsers() {
  return readUsersSource();
}

export async function getAllUsers() {
  const stored = await readUsersSource();
  const superAdmin = envSuperAdmin();

  if (!superAdmin) {
    return stored;
  }

  return [superAdmin, ...stored.filter((user) => user.username !== superAdmin.username)];
}

export async function getUserById(id) {
  const users = await getAllUsers();
  return users.find((user) => String(user.id) === String(id)) || null;
}

export async function getUserByUsername(username) {
  const normalizedUsername = String(username || "").trim().toLowerCase();

  if (!normalizedUsername) {
    return null;
  }

  const users = await getAllUsers();
  return users.find((user) => user.username === normalizedUsername) || null;
}

export async function getUserByEmail(email) {
  const normalizedEmail = String(email || "").trim().toLowerCase();

  if (!normalizedEmail) {
    return null;
  }

  const users = await getAllUsers();
  return users.find((user) => user.email === normalizedEmail) || null;
}

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");

  const derivedKey = await new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (error, key) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(key.toString("hex"));
    });
  });

  return `scrypt:${salt}:${derivedKey}`;
}

export async function verifyPassword(password, passwordHash) {
  const [algorithm, salt, storedKey] = String(passwordHash || "").split(":");

  if (algorithm !== "scrypt" || !salt || !storedKey) {
    return false;
  }

  const derivedKey = await new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (error, key) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(key.toString("hex"));
    });
  });

  const left = Buffer.from(derivedKey, "hex");
  const right = Buffer.from(storedKey, "hex");

  if (left.length !== right.length) {
    return false;
  }

  return crypto.timingSafeEqual(left, right);
}

export async function createUser(input) {
  const users = await readUsersSource();
  const username = String(input.username || "").trim().toLowerCase();
  const email = String(input.email || "").trim().toLowerCase();

  if (!username || !email || !input.password) {
    throw new Error("Name, email, username, and password are required.");
  }

  if (users.some((user) => user.username === username) || envSuperAdmin()?.username === username) {
    throw new Error("That username is already in use.");
  }

  if (users.some((user) => user.email === email) || envSuperAdmin()?.email === email) {
    throw new Error("That email is already in use.");
  }

  const now = new Date().toISOString();
  const user = normalizeUser({
    id: crypto.randomUUID(),
    name: input.name,
    email,
    username,
    role: input.role,
    status: "active",
    passwordHash: await hashPassword(String(input.password)),
    createdAt: now,
    updatedAt: now
  });

  await writeUsersSource([user, ...users]);
  return user;
}

export async function updateUser(id, patch) {
  const users = await readUsersSource();
  const index = users.findIndex((user) => String(user.id) === String(id));

  if (index === -1) {
    return null;
  }

  const current = users[index];
  const username = patch.username ? String(patch.username).trim().toLowerCase() : current.username;
  const email = patch.email ? String(patch.email).trim().toLowerCase() : current.email;

  if (users.some((user, userIndex) => userIndex !== index && user.username === username)) {
    throw new Error("That username is already in use.");
  }

  if (users.some((user, userIndex) => userIndex !== index && user.email === email)) {
    throw new Error("That email is already in use.");
  }

  const next = normalizeUser({
    ...current,
    ...patch,
    username,
    email,
    updatedAt: new Date().toISOString()
  });

  users[index] = next;
  await writeUsersSource(users);
  return next;
}

export async function resetUserPassword(id, nextPassword) {
  if (!nextPassword) {
    throw new Error("A new password is required.");
  }

  return updateUser(id, {
    passwordHash: await hashPassword(String(nextPassword))
  });
}

export async function touchUserLastLogin(id) {
  if (!id || String(id) === "env-super-admin") {
    return envSuperAdmin();
  }

  return updateUser(id, { lastLoginAt: new Date().toISOString() });
}
