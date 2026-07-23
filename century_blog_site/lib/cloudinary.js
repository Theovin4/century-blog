import crypto from "node:crypto";
import fs from "node:fs/promises";
import https from "node:https";
import os from "node:os";
import path from "node:path";
import { v2 as cloudinary } from "cloudinary";

const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || "";
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY || "";
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET || "";

cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
  secure: true
});

function getTempFilePath(filename) {
  return path.join(os.tmpdir(), `${crypto.randomUUID()}-${filename}`);
}

function cleanupTempFile(filePath) {
  return fs.unlink(filePath).catch(() => undefined);
}

function readJsonFromRemoteUrl(url, { maxRedirects = 3 } = {}) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, (response) => {
      const statusCode = Number(response.statusCode || 0);

      if (
        statusCode >= 300 &&
        statusCode < 400 &&
        response.headers.location &&
        maxRedirects > 0
      ) {
        response.resume();
        const nextUrl = new URL(response.headers.location, url).toString();
        resolve(readJsonFromRemoteUrl(nextUrl, { maxRedirects: maxRedirects - 1 }));
        return;
      }

      if (statusCode === 404) {
        response.resume();
        resolve(null);
        return;
      }

      if (statusCode < 200 || statusCode >= 300) {
        response.resume();
        reject(new Error(`Unexpected Cloudinary JSON response (${statusCode}) for ${url}`));
        return;
      }

      let payload = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        payload += chunk;
      });
      response.on("end", () => {
        try {
          resolve(JSON.parse(payload));
        } catch (error) {
          reject(error);
        }
      });
    });

    request.on("error", reject);
    request.setTimeout(20000, () => {
      request.destroy(new Error(`Timed out while fetching Cloudinary JSON for ${url}`));
    });
  });
}

export function isCloudinaryConfigured() {
  return Boolean(CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET);
}

function normalizeRawResourcePublicId(publicId) {
  const normalized = String(publicId || "").trim().replace(/^\/+/, "");
  if (!normalized) {
    return normalized;
  }

  return normalized.endsWith(".json") ? normalized : `${normalized}.json`;
}

function normalizeCloudinaryPublicIdWithoutExtension(publicId) {
  return String(publicId || "").trim().replace(/^\/+/, "").replace(/\.json$/i, "");
}

async function getCloudinaryRawResource(publicId, { deliveryType = "upload" } = {}) {
  if (!isCloudinaryConfigured()) {
    return null;
  }

  return cloudinary.api.resource(normalizeRawResourcePublicId(publicId), {
    resource_type: "raw",
    type: deliveryType
  });
}

async function listCloudinaryRawResources(prefix, maxResults = 100) {
  if (!isCloudinaryConfigured()) {
    return [];
  }

  const response = await cloudinary.api.resources({
    resource_type: "raw",
    type: "upload",
    prefix: String(prefix || "").trim().replace(/^\/+/, ""),
    max_results: maxResults
  });

  return Array.isArray(response?.resources) ? response.resources : [];
}

export function requiresPersistentRemoteStorage() {
  return Boolean(process.env.VERCEL || process.env.NODE_ENV === "production");
}

export function isPersistentStorageReady() {
  return isCloudinaryConfigured() || !requiresPersistentRemoteStorage();
}

export function getPersistentStorageErrorMessage() {
  return "Persistent storage is not configured in production yet. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in Vercel.";
}

export function isCloudinaryUrl(value) {
  return /res\.cloudinary\.com/i.test(String(value || ""));
}

export function optimizeCloudinaryMediaUrl(url, mediaType = "") {
  const target = String(url || "");

  if (!isCloudinaryUrl(target)) {
    return target;
  }

  if (target.includes("/image/upload/") && !target.includes("/image/upload/f_auto,q_auto,dpr_auto/")) {
    return target.replace("/image/upload/", "/image/upload/f_auto,q_auto,dpr_auto/");
  }

  if (target.includes("/video/upload/") && !target.includes("/video/upload/f_auto,q_auto,vc_auto/")) {
    return target.replace("/video/upload/", "/video/upload/f_auto,q_auto,vc_auto/");
  }

  return target;
}

export function buildCloudinaryVideoPosterUrl(url) {
  const target = String(url || "");

  if (!isCloudinaryUrl(target) || !target.includes("/video/upload/")) {
    return "";
  }

  const poster = target.replace("/video/upload/", "/video/upload/so_0,f_jpg,q_auto/");
  return poster.replace(/\.[a-z0-9]+(\?|$)/i, ".jpg$1");
}

function getUploadFolder(mediaType) {
  return String(mediaType || "").startsWith("video/")
    ? "century-blog/blog/videos"
    : "century-blog/blog/images";
}

function buildMediaResponse(result, fallbackName = "") {
  const mediaType = result.resource_type === "video"
    ? `video/${result.format || "mp4"}`
    : `image/${result.format || "jpeg"}`;
  const originalUrl = result.secure_url;

  return {
    mediaUrl: optimizeCloudinaryMediaUrl(originalUrl, mediaType),
    originalMediaUrl: originalUrl,
    mediaType,
    mediaName: fallbackName || `${result.public_id}.${result.format || "jpg"}`,
    posterUrl: result.resource_type === "video" ? buildCloudinaryVideoPosterUrl(originalUrl) : ""
  };
}

async function uploadFromPath(filePath, options) {
  return cloudinary.uploader.upload(filePath, {
    resource_type: "auto",
    use_filename: false,
    unique_filename: false,
    overwrite: false,
    ...options
  });
}

function buildCloudinaryRawJsonUrl(publicId) {
  if (!CLOUDINARY_CLOUD_NAME || !publicId) {
    return "";
  }

  const normalized = String(publicId || "")
    .replace(/^\/+/, "")
    .replace(/\.json$/i, "");
  return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/raw/upload/${normalized}.json`;
}

function buildProtectedCloudinaryJsonDownloadUrl(publicId, deliveryType) {
  return cloudinary.utils.private_download_url(
    normalizeCloudinaryPublicIdWithoutExtension(publicId),
    "json",
    {
      resource_type: "raw",
      type: deliveryType,
      attachment: false,
      expires_at: Math.floor(Date.now() / 1000) + 60
    }
  );
}

export async function uploadMediaFile(file, slug) {
  if (!file) {
    return {
      mediaUrl: "",
      originalMediaUrl: "",
      mediaType: "",
      mediaName: "",
      posterUrl: ""
    };
  }

  if (!isCloudinaryConfigured()) {
    throw new Error(getPersistentStorageErrorMessage());
  }

  const extension = path.extname(file?.name || "") || (String(file?.type || "").startsWith("video/") ? ".mp4" : ".jpg");
  const tempPath = getTempFilePath(`${slug}${extension}`);
  const arrayBuffer = await file.arrayBuffer();
  await fs.writeFile(tempPath, Buffer.from(arrayBuffer));

  try {
    const result = await uploadFromPath(tempPath, {
      folder: getUploadFolder(file.type),
      public_id: `${slug}-${crypto.randomUUID()}`,
      resource_type: "auto"
    });

    return buildMediaResponse(result, file.name || "");
  } finally {
    await cleanupTempFile(tempPath);
  }
}

export async function uploadRemoteMedia(sourceUrl, slug, mediaType = "") {
  if (!sourceUrl || !isCloudinaryConfigured()) {
    return null;
  }

  const result = await cloudinary.uploader.upload(sourceUrl, {
    resource_type: "auto",
    folder: getUploadFolder(mediaType),
    public_id: `${slug}-${crypto.randomUUID()}`,
    overwrite: false,
    use_filename: false,
    unique_filename: false
  });

  return buildMediaResponse(result);
}

export async function readCloudinaryJson(publicId, { deliveryType = "upload", cacheBust = false } = {}) {
  if (!isCloudinaryConfigured()) {
    return null;
  }

  let directUrl = deliveryType === "upload"
    ? buildCloudinaryRawJsonUrl(publicId)
    : buildProtectedCloudinaryJsonDownloadUrl(publicId, deliveryType);

  try {
    const resource = await getCloudinaryRawResource(publicId, { deliveryType });
    if (resource?.secure_url) {
      directUrl = deliveryType === "upload"
        ? resource.secure_url
        : buildProtectedCloudinaryJsonDownloadUrl(publicId, deliveryType);
    }
  } catch {
    // Fall back to a signed or unversioned URL if metadata lookup fails.
  }

  const requestUrl = cacheBust
    ? `${directUrl}${directUrl.includes("?") ? "&" : "?"}t=${Date.now()}`
    : directUrl;
  return readJsonFromRemoteUrl(requestUrl);
}

export async function backupCloudinaryJson(publicId, backupFolder = "century-blog/backups", { deliveryType = "upload" } = {}) {
  if (!isCloudinaryConfigured()) {
    return null;
  }

  const resource = await getCloudinaryRawResource(publicId, { deliveryType }).catch(() => null);
  if (!resource?.secure_url && deliveryType === "upload") {
    return null;
  }

  const sourceUrl = deliveryType === "upload"
    ? resource?.secure_url
    : buildProtectedCloudinaryJsonDownloadUrl(publicId, deliveryType);

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const normalizedId = String(publicId || "").replace(/^\/+/, "").replace(/\.json$/i, "");
  const targetId = `${backupFolder}/${normalizedId}-${stamp}.json`;

  const result = await cloudinary.uploader.upload(sourceUrl, {
    resource_type: "raw",
    public_id: targetId,
    overwrite: false,
    use_filename: false,
    unique_filename: false,
    format: "json"
  });

  return {
    publicId: result.public_id || targetId,
    secureUrl: result.secure_url || "",
    bytes: Number(result.bytes || 0),
    createdAt: result.created_at || new Date().toISOString()
  };
}

export async function getLatestCloudinaryJsonBackup(publicId, backupFolder = "century-blog/backups") {
  if (!isCloudinaryConfigured()) {
    return null;
  }

  const normalizedId = String(publicId || "").replace(/^\/+/, "").replace(/\.json$/i, "");
  const prefix = `${backupFolder}/${normalizedId}-`;
  const resources = await listCloudinaryRawResources(prefix, 100);

  if (!resources.length) {
    return null;
  }

  const latest = [...resources].sort((left, right) => {
    const rightTime = new Date(right?.created_at || 0).getTime();
    const leftTime = new Date(left?.created_at || 0).getTime();
    return rightTime - leftTime;
  })[0];

  if (!latest) {
    return null;
  }

  return {
    publicId: latest.public_id || "",
    secureUrl: latest.secure_url || "",
    bytes: Number(latest.bytes || 0),
    createdAt: latest.created_at || ""
  };
}

export async function ensureCloudinaryJsonBackup(
  publicId,
  { backupFolder = "century-blog/backups", maxAgeHours = 24, force = false } = {}
) {
  if (!isCloudinaryConfigured()) {
    return {
      created: false,
      reason: "cloudinary-not-configured",
      latestBackup: null
    };
  }

  const latestBackup = await getLatestCloudinaryJsonBackup(publicId, backupFolder);
  const latestTimestamp = latestBackup?.createdAt ? new Date(latestBackup.createdAt).getTime() : 0;
  const maxAgeMs = Math.max(1, Number(maxAgeHours || 24)) * 60 * 60 * 1000;

  if (!force && latestTimestamp && Date.now() - latestTimestamp < maxAgeMs) {
    return {
      created: false,
      reason: "recent-backup-exists",
      latestBackup
    };
  }

  const backupResult = await backupCloudinaryJson(publicId, backupFolder);
  const refreshedLatestBackup = await getLatestCloudinaryJsonBackup(publicId, backupFolder);
  const fallbackLatestBackup = backupResult?.secureUrl
    ? {
      publicId: backupResult.publicId || "",
      secureUrl: backupResult.secureUrl || "",
      bytes: Number(backupResult.bytes || 0),
      createdAt: backupResult.createdAt || new Date().toISOString()
    }
    : null;

  return {
    created: Boolean(backupResult?.secureUrl),
    reason: backupResult?.secureUrl ? "backup-created" : "backup-create-returned-empty",
    secureUrl: backupResult?.secureUrl || "",
    latestBackup: refreshedLatestBackup || fallbackLatestBackup || latestBackup
  };
}

export async function deleteCloudinaryJson(publicId, { deliveryType = "upload" } = {}) {
  if (!isCloudinaryConfigured()) {
    throw new Error(getPersistentStorageErrorMessage());
  }

  return cloudinary.uploader.destroy(normalizeCloudinaryPublicIdWithoutExtension(publicId), {
    resource_type: "raw",
    type: deliveryType,
    invalidate: true
  });
}

export async function writeCloudinaryJson(publicId, payload, { deliveryType = "upload" } = {}) {
  if (!isCloudinaryConfigured()) {
    throw new Error(getPersistentStorageErrorMessage());
  }

  const tempPath = getTempFilePath(`${path.basename(publicId)}.json`);
  await fs.writeFile(tempPath, JSON.stringify(payload, null, 2), "utf8");

  try {
    const result = await cloudinary.uploader.upload(tempPath, {
      resource_type: "raw",
      public_id: publicId,
      type: deliveryType,
      access_mode: deliveryType === "authenticated" ? "authenticated" : undefined,
      overwrite: true,
      invalidate: true,
      use_filename: false,
      unique_filename: false,
      format: "json"
    });

    return result.secure_url;
  } finally {
    await cleanupTempFile(tempPath);
  }
}

export { cloudinary };
