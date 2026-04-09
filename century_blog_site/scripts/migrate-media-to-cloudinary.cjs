const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { v2: cloudinary } = require("cloudinary");

const baseUrl = (process.env.MIGRATION_SOURCE_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://centuryblogg.vercel.app").replace(/\/$/, "");
const dataDir = path.join(process.cwd(), "data");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

function assertEnv(name) {
  if (!process.env[name]) {
    throw new Error(`Missing required env var: ${name}`);
  }
}

function isCloudinaryUrl(value) {
  return /res\.cloudinary\.com/i.test(String(value || ""));
}

function optimizeCloudinaryMediaUrl(url) {
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

function buildPosterUrl(url) {
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

async function writeTempJson(filename, payload) {
  const tempPath = path.join(os.tmpdir(), `${crypto.randomUUID()}-${filename}`);
  await fs.writeFile(tempPath, JSON.stringify(payload, null, 2), "utf8");
  return tempPath;
}

async function uploadJson(publicId, payload) {
  const tempPath = await writeTempJson(`${path.basename(publicId)}.json`, payload);

  try {
    await cloudinary.uploader.upload(tempPath, {
      resource_type: "raw",
      public_id: publicId,
      overwrite: true,
      invalidate: true,
      use_filename: false,
      unique_filename: false,
      format: "json"
    });
  } finally {
    await fs.unlink(tempPath).catch(() => undefined);
  }
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  return response.json();
}

async function migrateMediaForPost(post) {
  const currentUrl = post.originalMediaUrl || post.mediaUrl || post.legacyMediaUrl || "";

  if (!currentUrl || isCloudinaryUrl(currentUrl)) {
    const mediaUrl = optimizeCloudinaryMediaUrl(currentUrl);
    return {
      ...post,
      mediaUrl,
      originalMediaUrl: currentUrl,
      posterUrl: String(post.mediaType || "").startsWith("video/") ? buildPosterUrl(currentUrl) : post.posterUrl || ""
    };
  }

  const sourceUrl = currentUrl.startsWith("/") ? `${baseUrl}${currentUrl}` : currentUrl;
  const result = await cloudinary.uploader.upload(sourceUrl, {
    resource_type: "auto",
    folder: getUploadFolder(post.mediaType),
    public_id: `${post.slug}-${crypto.randomUUID()}`,
    overwrite: false,
    use_filename: false,
    unique_filename: false
  });

  const originalUrl = result.secure_url;
  const mediaType = result.resource_type === "video"
    ? `video/${result.format || "mp4"}`
    : `image/${result.format || "jpeg"}`;

  return {
    ...post,
    legacyMediaUrl: currentUrl,
    mediaUrl: optimizeCloudinaryMediaUrl(originalUrl),
    originalMediaUrl: originalUrl,
    mediaType,
    posterUrl: result.resource_type === "video" ? buildPosterUrl(originalUrl) : ""
  };
}

async function main() {
  assertEnv("CLOUDINARY_CLOUD_NAME");
  assertEnv("CLOUDINARY_API_KEY");
  assertEnv("CLOUDINARY_API_SECRET");

  const posts = await fetchJson(`${baseUrl}/api/posts`);
  const updatedPosts = [];
  const engagement = {};

  for (const post of posts) {
    const migratedPost = await migrateMediaForPost(post);
    updatedPosts.push(migratedPost);

    try {
      engagement[post.slug] = await fetchJson(`${baseUrl}/api/engagement/${post.slug}`);
    } catch {
      engagement[post.slug] = {
        slug: post.slug,
        likes: 0,
        comments: []
      };
    }
  }

  const submissionsPath = path.join(dataDir, "submissions.json");
  const localSubmissions = JSON.parse(await fs.readFile(submissionsPath, "utf8").catch(() => "[]"));

  await fs.writeFile(path.join(dataDir, "posts.json"), JSON.stringify(updatedPosts, null, 2), "utf8");
  await fs.writeFile(path.join(dataDir, "engagement.json"), JSON.stringify(engagement, null, 2), "utf8");

  await uploadJson("century-blog/data/posts", updatedPosts);
  await uploadJson("century-blog/data/engagement", engagement);
  await uploadJson("century-blog/data/submissions", localSubmissions);

  console.log(`Migrated ${updatedPosts.length} posts to Cloudinary and uploaded JSON stores.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
