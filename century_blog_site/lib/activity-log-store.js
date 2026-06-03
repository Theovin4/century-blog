import crypto from "node:crypto";
import path from "node:path";
import { readJsonStore, writeJsonStore } from "@/lib/json-store";

const localFilePath = path.join(process.env.INIT_CWD || process.cwd(), "data", "activity-logs.json");
const publicId = "century-blog/data/activity-logs";
const secureStoreOptions = { deliveryType: "authenticated" };

function normalizeLog(log) {
  return {
    id: String(log?.id || crypto.randomUUID()),
    action: String(log?.action || "").trim(),
    entityType: String(log?.entityType || "").trim(),
    entityId: String(log?.entityId || "").trim(),
    userId: String(log?.userId || "").trim(),
    userName: String(log?.userName || "").trim(),
    userRole: String(log?.userRole || "").trim(),
    status: String(log?.status || "info").trim(),
    ip: String(log?.ip || "").trim(),
    details: log?.details && typeof log.details === "object" ? log.details : {},
    createdAt: String(log?.createdAt || new Date().toISOString())
  };
}

async function readLogsSource() {
  const logs = await readJsonStore(localFilePath, publicId, [], secureStoreOptions);
  return Array.isArray(logs) ? logs.map(normalizeLog) : [];
}

async function writeLogsSource(logs) {
  await writeJsonStore(localFilePath, publicId, logs.map(normalizeLog).slice(0, 5000), secureStoreOptions);
}

export async function addActivityLog(entry) {
  const logs = await readLogsSource();
  const log = normalizeLog(entry);
  try {
    await writeLogsSource([log, ...logs]);
  } catch {
    return log;
  }
  return log;
}

export async function getActivityLogs({ query = "", action = "", userId = "" } = {}) {
  const logs = await readLogsSource();
  const normalizedQuery = String(query || "").trim().toLowerCase();
  const normalizedAction = String(action || "").trim().toLowerCase();
  const normalizedUserId = String(userId || "").trim();

  return logs.filter((log) => {
    const matchesQuery = normalizedQuery
      ? [log.action, log.entityType, log.entityId, log.userName, JSON.stringify(log.details)]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedQuery))
      : true;
    const matchesAction = normalizedAction ? String(log.action).toLowerCase().includes(normalizedAction) : true;
    const matchesUser = normalizedUserId ? String(log.userId) === normalizedUserId : true;

    return matchesQuery && matchesAction && matchesUser;
  });
}
