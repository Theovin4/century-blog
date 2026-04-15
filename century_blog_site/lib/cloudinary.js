import crypto from "node:crypto";
import fs from "node:fs/promises";
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

export function isCloudinaryConfigured() {
  return Boolean(CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET);
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
    throw new Error("Cloudinary is not configured.");
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

async function resolveRawResource(publicId) {
  const candidates = [publicId, `${publicId}.json`];

  for (const candidate of candidates) {
    try {
      const resource = await cloudinary.api.resource(candidate, {
        resource_type: "raw",
        type: "upload"
      });
      return resource;
    } catch (error) {
      if (error?.http_code === 404 || /not found/i.test(String(error?.message || ""))) {
        continue;
      }

      throw error;
    }
  }

  return null;
}

export async function readCloudinaryJson(publicId) {
  if (!isCloudinaryConfigured()) {
    return null;
  }

  const resource = await resolveRawResource(publicId);

  if (!resource) {
    return null;
  }

  const versionedUrl = resource.version
    ? `${resource.secure_url}${resource.secure_url.includes("?") ? "&" : "?"}v=${resource.version}`
    : resource.secure_url;
  const response = await fetch(versionedUrl, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Unable to fetch Cloudinary JSON for ${publicId}`);
  }

  return response.json();
}

export async function writeCloudinaryJson(publicId, payload) {
  if (!isCloudinaryConfigured()) {
    throw new Error("Cloudinary is not configured.");
  }

  const tempPath = getTempFilePath(`${path.basename(publicId)}.json`);
  await fs.writeFile(tempPath, JSON.stringify(payload, null, 2), "utf8");

  try {
    const result = await cloudinary.uploader.upload(tempPath, {
      resource_type: "raw",
      public_id: publicId,
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
