#!/usr/bin/env node
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { v2: cloudinary } = require("cloudinary");

const ROOT_DIR = process.cwd();
const POSTS_PUBLIC_ID = "century-blog/data/posts";
const BACKUP_FOLDER = "century-blog/backups";
const LOCAL_POSTS_PATH = path.join(ROOT_DIR, "data", "posts.json");
const INLINE_IMAGE_HEADING_CANDIDATES = [
  "## Context and background",
  "## What happened",
  "## Introduction"
];
const QUERY_STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "before",
  "by",
  "for",
  "from",
  "how",
  "in",
  "into",
  "is",
  "it",
  "of",
  "on",
  "or",
  "the",
  "their",
  "this",
  "to",
  "what",
  "with",
  "you",
  "your"
]);

loadEnvFile(path.join(ROOT_DIR, ".env.local"));

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    if (!line || line.trim().startsWith("#")) {
      continue;
    }

    const index = line.indexOf("=");

    if (index === -1) {
      continue;
    }

    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();

    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function assertEnv(name) {
  if (!process.env[name]) {
    throw new Error(`Missing required env var: ${name}`);
  }
}

function parseArgs(argv) {
  const args = {
    limit: 0,
    only: []
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith("--")) {
      continue;
    }

    const [flag, inlineValue] = token.split("=", 2);
    const value = inlineValue ?? argv[index + 1];

    if (inlineValue === undefined) {
      index += 1;
    }

    if (flag === "--limit") {
      args.limit = Number(value || 0);
    }

    if (flag === "--only") {
      args.only = String(value || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }

  return args;
}

function getPexelsApiKey() {
  return process.env.PEXELS_API_KEY || "";
}

function getUnsplashAccessKey() {
  return process.env.UNSPLASH_ACCESS_KEY || "";
}

function getTimestampStamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function normalizeMarkdownContent(content = "") {
  return String(content || "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripMarkdown(value = "") {
  return String(value)
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[>*_~|-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function countWords(value = "") {
  const text = stripMarkdown(value);
  return text ? text.split(/\s+/).filter(Boolean).length : 0;
}

function estimateReadTime(content = "") {
  const minutes = Math.max(1, Math.ceil(countWords(content) / 220));
  return `${minutes} min read`;
}

function slugify(value = "") {
  return String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isImageMedia(value = "", mediaType = "") {
  const target = String(mediaType || value || "").toLowerCase();
  return target.startsWith("image/") || /\.(png|jpe?g|webp|gif|svg|avif)(\?|$)/.test(target);
}

function hasInlineArticleImage(content) {
  const text = String(content || "");
  return /!\[[^\]]*]\((?:https?:\/\/|\/)[^)]+\)/i.test(text) || /<img\b[^>]*src=["'](?:https?:\/\/|\/)[^"']+["'][^>]*>/i.test(text);
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sanitizeAltText(value) {
  return String(value || "")
    .replace(/[\r\n]+/g, " ")
    .replace(/\]/g, "")
    .trim();
}

function injectInlineSupportImage(content, { url = "", alt = "" } = {}) {
  const normalized = normalizeMarkdownContent(content);
  const targetUrl = String(url || "").trim();

  if (!normalized || !targetUrl || hasInlineArticleImage(normalized)) {
    return normalized;
  }

  const markdown = `![${sanitizeAltText(alt) || "Article image"}](${targetUrl})`;

  for (const heading of INLINE_IMAGE_HEADING_CANDIDATES) {
    const pattern = new RegExp(`(^${escapeRegExp(heading)}\\s*$\\n+)`, "mi");

    if (pattern.test(normalized)) {
      return normalizeMarkdownContent(
        normalized.replace(pattern, (match) => `${match}${markdown}\n\n`)
      );
    }
  }

  const firstBreak = normalized.indexOf("\n\n");

  if (firstBreak !== -1) {
    return normalizeMarkdownContent(
      `${normalized.slice(0, firstBreak + 2)}${markdown}\n\n${normalized.slice(firstBreak + 2)}`
    );
  }

  return normalizeMarkdownContent(`${normalized}\n\n${markdown}`);
}

async function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchJsonWithRetry(url, options = {}) {
  const attempts = Number(options.attempts || 4);
  const timeoutMs = Number(options.timeoutMs || 30000);
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...options,
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs)
      });

      if (!response.ok) {
        throw new Error(`Unable to fetch JSON payload: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      lastError = error;

      if (attempt === attempts) {
        break;
      }

      const waitMs = attempt * 2500;
      console.warn(`Fetch retry ${attempt} failed. Waiting ${waitMs}ms before retrying...`);
      await sleep(waitMs);
    }
  }

  throw lastError || new Error("Unable to fetch JSON payload.");
}

async function getLivePosts() {
  const resource = await cloudinary.api.resource(`${POSTS_PUBLIC_ID}.json`, {
    resource_type: "raw",
    type: "upload"
  });

  const payload = await fetchJsonWithRetry(`${resource.secure_url}?t=${Date.now()}`, {
    attempts: 4,
    timeoutMs: 30000
  });

  if (!Array.isArray(payload)) {
    throw new Error("Live posts store did not return an array.");
  }

  return payload;
}

async function backupPostsStore(posts) {
  const stamp = getTimestampStamp();
  const tempPath = path.join(os.tmpdir(), `${crypto.randomUUID()}-posts-backup.json`);
  await fsp.writeFile(tempPath, JSON.stringify(posts, null, 2), "utf8");

  try {
    const result = await cloudinary.uploader.upload(tempPath, {
      resource_type: "raw",
      public_id: `${BACKUP_FOLDER}/post-image-backfill-pre-${stamp}`,
      overwrite: false,
      use_filename: false,
      unique_filename: false,
      format: "json"
    });

    return result.secure_url || "";
  } finally {
    await fsp.unlink(tempPath).catch(() => undefined);
  }
}

async function writePostsStore(posts) {
  const tempPath = path.join(os.tmpdir(), `${crypto.randomUUID()}-posts.json`);
  await fsp.writeFile(tempPath, JSON.stringify(posts, null, 2), "utf8");

  try {
    await cloudinary.uploader.upload(tempPath, {
      resource_type: "raw",
      public_id: POSTS_PUBLIC_ID,
      overwrite: true,
      invalidate: true,
      use_filename: false,
      unique_filename: false,
      format: "json"
    });
    await fsp.writeFile(LOCAL_POSTS_PATH, JSON.stringify(posts, null, 2), "utf8");
  } finally {
    await fsp.unlink(tempPath).catch(() => undefined);
  }
}

function getCategoryLabel(category) {
  const labels = {
    nigeria: "Nigeria",
    world: "World",
    business: "Business",
    sports: "Sports",
    tech: "Technology",
    entertainment: "Entertainment",
    health: "Health",
    lifestyle: "Lifestyle",
    education: "Education",
    "daily-gist": "Daily Gist"
  };

  return labels[String(category || "").trim().toLowerCase()] || "News";
}

function buildHeroImageSearchQuery(post) {
  return buildHeroImageSearchQueries(post)[0] || "";
}

function extractQueryKeywords(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]+/g, " ")
    .split(/\s+/)
    .filter((token) => token && token.length > 2 && !QUERY_STOPWORDS.has(token))
    .slice(0, 8);
}

function buildHeroImageSearchQueries(post) {
  const regionLabel = String(post?.regionFocus || "").toLowerCase() === "nigeria" ? "Nigeria" : "world";
  const categoryLabel = getCategoryLabel(post?.category);
  const keywordString = extractQueryKeywords(post?.title).join(" ");
  const excerptKeywordString = extractQueryKeywords(post?.excerpt).slice(0, 6).join(" ");
  const queries = [
    [post?.title, categoryLabel, regionLabel].filter(Boolean).join(" "),
    [keywordString, categoryLabel, regionLabel].filter(Boolean).join(" "),
    [keywordString, categoryLabel].filter(Boolean).join(" "),
    [keywordString, excerptKeywordString].filter(Boolean).join(" "),
    [keywordString].filter(Boolean).join(" "),
    [categoryLabel, regionLabel].filter(Boolean).join(" ")
  ];

  return [...new Set(
    queries
      .map((query) => query.replace(/\s+/g, " ").trim())
      .filter(Boolean)
  )];
}

async function searchUnsplashImage(query) {
  const accessKey = getUnsplashAccessKey();

  if (!accessKey) {
    return null;
  }

  const payload = await fetchJsonWithRetry(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape&client_id=${accessKey}`, {
    attempts: 3,
    timeoutMs: 30000
  });
  const photo = payload?.results?.[0];

  if (!photo) {
    return null;
  }

  return {
    mediaUrl: photo.urls?.regular || photo.urls?.full || "",
    imageCreditName: photo.user?.name || "Unsplash",
    imageCreditUrl: photo.links?.html || "https://unsplash.com"
  };
}

async function searchPexelsImage(query) {
  const apiKey = getPexelsApiKey();

  if (!apiKey) {
    return null;
  }

  const payload = await fetchJsonWithRetry(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1`, {
    attempts: 3,
    timeoutMs: 30000,
    headers: {
      Authorization: apiKey
    }
  });
  const photo = payload?.photos?.[0];

  if (!photo) {
    return null;
  }

  return {
    mediaUrl: photo.src?.large2x || photo.src?.landscape || photo.src?.large || "",
    imageCreditName: photo.photographer || "Pexels",
    imageCreditUrl: photo.url || "https://www.pexels.com"
  };
}

async function resolveHeroImage(post) {
  const queries = buildHeroImageSearchQueries(post);

  for (const query of queries) {
    try {
      const image = (await searchUnsplashImage(query)) || (await searchPexelsImage(query));

      if (image?.mediaUrl) {
        return image;
      }
    } catch {
      // Move on to the next fallback query.
    }
  }

  return null;
}

async function uploadHeroToCloudinary(remoteUrl, slug) {
  const result = await cloudinary.uploader.upload(remoteUrl, {
    resource_type: "image",
    folder: "century-blog/blog/images",
    public_id: `${slug}-${crypto.randomUUID()}`,
    use_filename: false,
    unique_filename: false,
    overwrite: false
  });

  return {
    mediaUrl: result.secure_url,
    originalMediaUrl: result.secure_url,
    mediaType: `image/${result.format || "jpeg"}`,
    mediaName: `${result.public_id}.${result.format || "jpg"}`
  };
}

async function main() {
  assertEnv("CLOUDINARY_CLOUD_NAME");
  assertEnv("CLOUDINARY_API_KEY");
  assertEnv("CLOUDINARY_API_SECRET");

  const args = parseArgs(process.argv.slice(2));
  const posts = await getLivePosts();
  const allow = args.only.length ? new Set(args.only) : null;
  const publishedPosts = posts.filter((post) => String(post.workflowStatus || "published") === "published");
  const targets = publishedPosts.filter((post) => !allow || allow.has(post.slug));
  const limitedTargets = args.limit > 0 ? targets.slice(0, args.limit) : targets;
  const backupUrl = await backupPostsStore(posts);
  const postMap = new Map(posts.map((post) => [post.slug, post]));
  let heroAdded = 0;
  let inlineAdded = 0;
  let touched = 0;

  console.log(`Created safety backup: ${backupUrl || "backup-uploaded"}`);

  for (const target of limitedTargets) {
    const post = { ...(postMap.get(target.slug) || target) };
    let changed = false;

    if (!post.mediaUrl) {
      const hero = await resolveHeroImage(post);

      if (hero?.mediaUrl) {
        const upload = await uploadHeroToCloudinary(hero.mediaUrl, slugify(post.slug || post.title || `post-${Date.now()}`));
        post.mediaUrl = upload.mediaUrl;
        post.originalMediaUrl = upload.originalMediaUrl;
        post.mediaType = upload.mediaType;
        post.mediaName = upload.mediaName;
        post.posterUrl = "";
        post.imageCreditName = post.imageCreditName || hero.imageCreditName || "";
        post.imageCreditUrl = post.imageCreditUrl || hero.imageCreditUrl || "";
        post.imageAlt = post.imageAlt || post.title || "Century Blog article image";
        heroAdded += 1;
        changed = true;
        console.log(`Added hero image for ${post.slug}`);
      }
    }

    if (post.mediaUrl && isImageMedia(post.mediaUrl, post.mediaType) && !hasInlineArticleImage(post.content)) {
      post.content = injectInlineSupportImage(post.content, {
        url: post.mediaUrl,
        alt: post.imageAlt || post.title || "Century Blog article image"
      });
      post.readTime = estimateReadTime(post.content);
      inlineAdded += 1;
      changed = true;
      console.log(`Added inline image for ${post.slug}`);
    }

    if (changed) {
      post.updatedAt = new Date().toISOString();
      postMap.set(post.slug, post);
      touched += 1;
    }
  }

  if (!touched) {
    console.log("No published posts needed image backfill.");
    return;
  }

  const updatedPosts = posts.map((post) => postMap.get(post.slug) || post);
  await writePostsStore(updatedPosts);
  console.log(`Updated ${touched} posts. Hero images added: ${heroAdded}. Inline images added: ${inlineAdded}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
