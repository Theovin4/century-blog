import crypto from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { addActivityLog } from "@/lib/activity-log-store";
import { getNotificationsForUser } from "@/lib/notifications-store";
import {
  getUserById,
  getUserByUsername,
  roleOptions,
  sanitizeUserForClient,
  touchUserLastLogin,
  verifyPassword
} from "@/lib/users-store";

const DEFAULT_SECRET = "change-this-secret";
const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || DEFAULT_SECRET;
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

export const editorialRoles = {
  super_admin: {
    label: "Super Admin",
    permissions: [
      "analytics:view",
      "articles:approve",
      "articles:create",
      "articles:delete",
      "articles:edit:any",
      "articles:feature",
      "articles:publish",
      "articles:review",
      "articles:settings",
      "articles:submit",
      "logs:view",
      "moderators:manage",
      "notifications:view",
      "users:reset-password",
      "users:suspend"
    ]
  },
  admin: {
    label: "Admin",
    permissions: [
      "analytics:view",
      "articles:approve",
      "articles:create",
      "articles:delete",
      "articles:edit:any",
      "articles:feature",
      "articles:publish",
      "articles:review",
      "articles:submit",
      "notifications:view"
    ]
  },
  moderator: {
    label: "Moderator",
    permissions: ["articles:create", "articles:edit:own", "articles:submit", "notifications:view"]
  },
  editor: {
    label: "Editor",
    permissions: ["articles:create", "articles:edit:own", "articles:submit", "notifications:view"]
  }
};

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function buildSessionSignature(payload) {
  return crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");
}

export function isSessionSecretConfiguredSecurely() {
  return Boolean(SESSION_SECRET && SESSION_SECRET !== DEFAULT_SECRET);
}

export function createSessionToken(user) {
  const timestamp = Date.now().toString();
  const payload = `${user.id}:${user.role}:${user.username}:${timestamp}`;
  return `${payload}:${buildSessionSignature(payload)}`;
}

function parseToken(token) {
  const parts = String(token || "").split(":");

  if (parts.length === 5) {
    const [userId, role, username, timestamp, signature] = parts;
    return { userId, role, username, timestamp, signature, legacy: false };
  }

  if (parts.length === 3) {
    const [username, timestamp, signature] = parts;
    return { userId: "env-super-admin", role: "super_admin", username, timestamp, signature, legacy: true };
  }

  return null;
}

export async function getAuthenticatedUser(token) {
  const parsed = parseToken(token);

  if (!parsed) {
    return null;
  }

  if (process.env.NODE_ENV === "production" && !isSessionSecretConfiguredSecurely()) {
    return null;
  }

  const payload = parsed.legacy
    ? `${parsed.username}:${parsed.timestamp}`
    : `${parsed.userId}:${parsed.role}:${parsed.username}:${parsed.timestamp}`;
  const expected = buildSessionSignature(payload);
  const issuedAt = Number(parsed.timestamp);
  const isFresh = Number.isFinite(issuedAt) && Date.now() - issuedAt < SESSION_TTL_MS;

  if (!isFresh || !safeEqual(parsed.signature, expected)) {
    return null;
  }

  if (parsed.userId === "env-super-admin") {
    const envUsername = String(process.env.ADMIN_USERNAME || "").trim().toLowerCase();

    if (envUsername && envUsername === String(parsed.username || "").trim().toLowerCase()) {
      return sanitizeUserForClient({
        id: "env-super-admin",
        name: "Century Blog Super Admin",
        email: process.env.ADMIN_EMAIL || "admin@centuryblogg.vercel.app",
        username: envUsername,
        role: "super_admin",
        status: "active",
        createdAt: process.env.ADMIN_CREATED_AT || "2026-01-01T00:00:00.000Z",
        updatedAt: process.env.ADMIN_CREATED_AT || "2026-01-01T00:00:00.000Z",
        lastLoginAt: "",
        suspendedAt: "",
        deletedAt: ""
      });
    }
  }

  const user = await getUserById(parsed.userId);

  if (!user || user.status !== "active") {
    return null;
  }

  return sanitizeUserForClient(user);
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  return getAuthenticatedUser(cookieStore.get("century_admin_session")?.value);
}

export async function authenticateUser(username, password) {
  const normalizedUsername = String(username || "").trim().toLowerCase();
  const normalizedPassword = String(password || "");
  const envUsername = String(process.env.ADMIN_USERNAME || "").trim().toLowerCase();
  const envPassword = String(process.env.ADMIN_PASSWORD || "");

  if (!normalizedUsername || !normalizedPassword) {
    return null;
  }

  if (envUsername && envPassword && normalizedUsername === envUsername && safeEqual(normalizedPassword, envPassword)) {
    return {
      id: "env-super-admin",
      name: "Century Blog Super Admin",
      email: process.env.ADMIN_EMAIL || "admin@centuryblogg.vercel.app",
      username: envUsername,
      role: "super_admin",
      status: "active",
      createdAt: process.env.ADMIN_CREATED_AT || "2026-01-01T00:00:00.000Z",
      updatedAt: process.env.ADMIN_CREATED_AT || "2026-01-01T00:00:00.000Z",
      lastLoginAt: "",
      suspendedAt: "",
      deletedAt: ""
    };
  }

  const user = await getUserByUsername(normalizedUsername);

  if (!user || user.status !== "active") {
    return null;
  }

  const valid = await verifyPassword(normalizedPassword, user.passwordHash);

  if (!valid) {
    return null;
  }

  await touchUserLastLogin(user.id);
  return sanitizeUserForClient(user);
}

export function hasPermission(user, permission) {
  if (!user) {
    return false;
  }

  const permissions = editorialRoles[user.role]?.permissions || [];
  return permissions.includes(permission);
}

export function canEditPost(user, post) {
  if (!user || !post) {
    return false;
  }

  if (hasPermission(user, "articles:edit:any")) {
    return true;
  }

  if (!hasPermission(user, "articles:edit:own")) {
    return false;
  }

  return String(post.createdBy || "") === String(user.id);
}

export function requirePermission(user, permission) {
  if (hasPermission(user, permission)) {
    return null;
  }

  return NextResponse.json({ message: "Forbidden" }, { status: 403 });
}

export async function logActivity(request, user, entry) {
  return addActivityLog({
    userId: user?.id || "",
    userName: user?.name || user?.username || "Unknown user",
    userRole: user?.role || "",
    ip: request ? request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "" : "",
    ...entry
  });
}

export async function getDashboardNotifications(user) {
  const notifications = await getNotificationsForUser(user);
  return notifications.map((notification) => ({
    ...notification,
    read: notification.readBy.includes(String(user.id))
  }));
}

export function getRoleLabel(role) {
  return editorialRoles[role]?.label || role;
}

export function getRoleOptions() {
  return roleOptions.map((role) => ({
    value: role,
    label: getRoleLabel(role)
  }));
}
