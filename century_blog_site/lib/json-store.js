import fs from "node:fs/promises";
import path from "node:path";
import {
  backupCloudinaryJson,
  deleteCloudinaryJson,
  getPersistentStorageErrorMessage,
  isCloudinaryConfigured,
  isPersistentStorageReady,
  requiresPersistentRemoteStorage,
  readCloudinaryJson,
  writeCloudinaryJson
} from "@/lib/cloudinary";

const STORE_CACHE_TTL_MS = 5000;
const storeCache = new Map();

function getCacheKey(localFilePath, publicId) {
  return publicId || localFilePath;
}

function clonePayload(value) {
  return value === undefined ? value : JSON.parse(JSON.stringify(value));
}

function getCachedPayload(cacheKey) {
  const entry = storeCache.get(cacheKey);

  if (!entry) {
    return undefined;
  }

  if (entry.expiresAt <= Date.now()) {
    storeCache.delete(cacheKey);
    return undefined;
  }

  return clonePayload(entry.value);
}

function setCachedPayload(cacheKey, value) {
  storeCache.set(cacheKey, {
    value: clonePayload(value),
    expiresAt: Date.now() + STORE_CACHE_TTL_MS
  });
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

  const value =
    item.updatedAt ||
    item.sitePublishedAt ||
    item.publishedAt ||
    item.createdAt ||
    item.scheduledFor ||
    item.lastRunAt ||
    "";
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function isPostsStore(publicId, localFilePath) {
  return String(publicId || "").includes("/posts") || /posts\.json$/i.test(String(localFilePath || ""));
}

function isStaleLocalPostsPayload(payload) {
  if (!Array.isArray(payload) || payload.length === 0) {
    return true;
  }

  const latestTimestamp = payload.reduce((max, item) => Math.max(max, getItemTimestamp(item)), 0);
  if (!latestTimestamp) {
    return true;
  }

  return latestTimestamp < Date.now() - (72 * 60 * 60 * 1000);
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

function normalizeStoreOptions(options) {
  return {
    deliveryType: String(options?.deliveryType || "upload").trim() || "upload",
    migrateLegacyUpload: options?.migrateLegacyUpload !== false
  };
}

export async function readJsonStore(localFilePath, publicId, fallbackValue, options) {
  const cacheKey = getCacheKey(localFilePath, publicId);
  const cached = getCachedPayload(cacheKey);
  const storeOptions = normalizeStoreOptions(options);

  if (cached !== undefined) {
    return cached;
  }

  if (publicId && isCloudinaryConfigured()) {
    try {
      let remote = await readCloudinaryJson(publicId, { deliveryType: storeOptions.deliveryType });

      if (remote === null && storeOptions.deliveryType !== "upload" && storeOptions.migrateLegacyUpload) {
        const legacyRemote = await readCloudinaryJson(publicId, { deliveryType: "upload" });

        if (legacyRemote !== null) {
          remote = legacyRemote;

          try {
            await writeCloudinaryJson(publicId, legacyRemote, { deliveryType: storeOptions.deliveryType });
            await deleteCloudinaryJson(publicId, { deliveryType: "upload" });
          } catch (migrationError) {
            console.warn(`[json-store] Unable to migrate ${publicId} to ${storeOptions.deliveryType}:`, migrationError?.message || migrationError);
          }
        }
      }

      if (remote !== null) {
        if (requiresPersistentRemoteStorage()) {
          setCachedPayload(cacheKey, remote);
          return clonePayload(remote);
        }

        try {
          const file = await fs.readFile(localFilePath, "utf8");
          const local = JSON.parse(file);
          const merged = mergePayloads(remote, local);
          setCachedPayload(cacheKey, merged);
          return clonePayload(merged);
        } catch {
          setCachedPayload(cacheKey, remote);
          return clonePayload(remote);
        }
      }
    } catch (error) {
      console.error(`[json-store] Remote read failed for ${publicId}:`, error?.message || error);

      if (requiresPersistentRemoteStorage()) {
        try {
          const file = await fs.readFile(localFilePath, "utf8");
          const parsed = JSON.parse(file);

          if (isPostsStore(publicId, localFilePath) && isStaleLocalPostsPayload(parsed)) {
            throw new Error(`Remote store unavailable and local fallback is stale for ${publicId}.`);
          }

          setCachedPayload(cacheKey, parsed);
          return clonePayload(parsed);
        } catch (localError) {
          throw localError;
        }
      }
    }
  }

  try {
    const file = await fs.readFile(localFilePath, "utf8");
    const parsed = JSON.parse(file);
    setCachedPayload(cacheKey, parsed);
    return clonePayload(parsed);
  } catch {
    return fallbackValue;
  }
}

export async function writeJsonStore(localFilePath, publicId, payload, options) {
  const cacheKey = getCacheKey(localFilePath, publicId);
  setCachedPayload(cacheKey, payload);
  const storeOptions = normalizeStoreOptions(options);

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
      if (isPostsStore(publicId, localFilePath)) {
        try {
          await backupCloudinaryJson(publicId, "century-blog/backups", { deliveryType: storeOptions.deliveryType });
        } catch (error) {
          console.warn(`[json-store] Unable to create backup for ${publicId}:`, error?.message || error);
        }
      }

      await writeCloudinaryJson(publicId, payload, { deliveryType: storeOptions.deliveryType });
    }
  }
}
