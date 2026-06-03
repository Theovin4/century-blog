import crypto from "node:crypto";
import path from "node:path";
import { readJsonStore, writeJsonStore } from "@/lib/json-store";

const localFilePath = path.join(process.env.INIT_CWD || process.cwd(), "data", "notifications.json");
const publicId = "century-blog/data/notifications";
const secureStoreOptions = { deliveryType: "authenticated" };

function normalizeNotification(notification) {
  return {
    id: String(notification?.id || crypto.randomUUID()),
    type: String(notification?.type || "info").trim(),
    title: String(notification?.title || "").trim(),
    message: String(notification?.message || "").trim(),
    targetRole: String(notification?.targetRole || "").trim(),
    targetUserId: String(notification?.targetUserId || "").trim(),
    readBy: Array.isArray(notification?.readBy) ? notification.readBy.map((value) => String(value)) : [],
    createdAt: String(notification?.createdAt || new Date().toISOString())
  };
}

async function readNotificationsSource() {
  const notifications = await readJsonStore(localFilePath, publicId, [], secureStoreOptions);
  return Array.isArray(notifications) ? notifications.map(normalizeNotification) : [];
}

async function writeNotificationsSource(notifications) {
  await writeJsonStore(localFilePath, publicId, notifications.map(normalizeNotification).slice(0, 500), secureStoreOptions);
}

export async function addNotification(entry) {
  const notifications = await readNotificationsSource();
  const notification = normalizeNotification(entry);
  try {
    await writeNotificationsSource([notification, ...notifications]);
  } catch {
    return notification;
  }
  return notification;
}

export async function getNotificationsForUser(user) {
  if (!user) {
    return [];
  }

  const notifications = await readNotificationsSource();
  return notifications.filter((notification) => {
    const roleMatch = notification.targetRole
      ? notification.targetRole === user.role || (user.role === "super_admin" && notification.targetRole === "admin")
      : true;
    const userMatch = notification.targetUserId ? notification.targetUserId === user.id : true;
    return roleMatch && userMatch;
  });
}

export async function markNotificationRead(notificationId, userId) {
  const notifications = await readNotificationsSource();
  const index = notifications.findIndex((notification) => String(notification.id) === String(notificationId));

  if (index === -1) {
    return null;
  }

  const current = notifications[index];

  if (!current.readBy.includes(String(userId))) {
    current.readBy = [...current.readBy, String(userId)];
  }

  notifications[index] = current;
  await writeNotificationsSource(notifications);
  return current;
}
