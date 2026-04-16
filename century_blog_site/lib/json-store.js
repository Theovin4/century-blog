import fs from "node:fs/promises";
import path from "node:path";
import {
  getPersistentStorageErrorMessage,
  isCloudinaryConfigured,
  isPersistentStorageReady,
  readCloudinaryJson,
  writeCloudinaryJson
} from "@/lib/cloudinary";

const storeCache = new Map();

function getCacheKey(localFilePath, publicId) {
  return publicId || localFilePath;
}

function clonePayload(value) {
  return value === undefined ? value : JSON.parse(JSON.stringify(value));
}

function getItemKey(item, index) {
  if (item && typeof item === "object") {
    if (item.id) {
      return `id:${item.id}`;
    }

    if (item.slug) {
      return `slug:${item.slug}`;
    }
  }

  return `index:${index}`;
}

function getItemTimestamp(item) {
  if (!item || typeof item !== "object") {
    return 0;
  }

  const value = item.updatedAt || item.publishedAt || item.lastRunAt || "";
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function mergePayloads(primary, secondary) {
  if (Array.isArray(primary) && Array.isArray(secondary)) {
    const merged = new Map();

    primary.forEach((item, index) => {
      merged.set(getItemKey(item, index), item);
    });

    secondary.forEach((item, index) => {
      const key = getItemKey(item, index);

      if (!merged.has(key)) {
        merged.set(key, item);
        return;
      }

      const current = merged.get(key);
      const preferSecondary = getItemTimestamp(item) >= getItemTimestamp(current);
      merged.set(key, preferSecondary ? { ...current, ...item } : { ...item, ...current });
    });

    return [...merged.values()];
  }

  if (
    primary &&
    secondary &&
    typeof primary === "object" &&
    typeof secondary === "object" &&
    !Array.isArray(primary) &&
    !Array.isArray(secondary)
  ) {
    return { ...primary, ...secondary };
  }

  return primary ?? secondary;
}

export async function readJsonStore(localFilePath, publicId, fallbackValue) {
  const cacheKey = getCacheKey(localFilePath, publicId);

  if (storeCache.has(cacheKey)) {
    return clonePayload(storeCache.get(cacheKey));
  }

  if (publicId && isCloudinaryConfigured()) {
    try {
      const remote = await readCloudinaryJson(publicId);
      if (remote !== null) {
        try {
          const file = await fs.readFile(localFilePath, "utf8");
          const local = JSON.parse(file);
          const merged = mergePayloads(remote, local);
          storeCache.set(cacheKey, merged);
          return clonePayload(merged);
        } catch {
          storeCache.set(cacheKey, remote);
          return clonePayload(remote);
        }
      }
    } catch {
      // Fall through to local fallback.
    }
  }

  try {
    const file = await fs.readFile(localFilePath, "utf8");
    const parsed = JSON.parse(file);
    storeCache.set(cacheKey, parsed);
    return clonePayload(parsed);
  } catch {
    return fallbackValue;
  }
}

export async function writeJsonStore(localFilePath, publicId, payload) {
  const cacheKey = getCacheKey(localFilePath, publicId);
  storeCache.set(cacheKey, clonePayload(payload));

  try {
    await fs.mkdir(path.dirname(localFilePath), { recursive: true });
    await fs.writeFile(localFilePath, JSON.stringify(payload, null, 2), "utf8");
  } catch (error) {
    if (!process.env.VERCEL) {
      throw error;
    }
  }

  if (publicId) {
    if (!isPersistentStorageReady()) {
      throw new Error(getPersistentStorageErrorMessage());
    }

    if (isCloudinaryConfigured()) {
      await writeCloudinaryJson(publicId, payload);
    }
  }
}
