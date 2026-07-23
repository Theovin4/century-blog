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
const VALID_CATEGORIES = new Set([
  "nigeria",
  "world",
  "business",
  "sports",
  "tech",
  "entertainment",
  "health",
  "lifestyle",
  "education",
  "daily-gist"
]);

const PROMPT_LEAK_REPAIRS = {
  "usmnt-jersey-shortages-reveal-flaws-in-global-sports-merchandising": {
    category: "sports",
    reviewNotes: "Prompt leakage removed and category corrected during AdSense editorial cleanup."
  },
  "gemini-north-telescope-peers-into-crystal-ball-nebula-what-it-means-for-nigeria": {
    category: "tech",
    reviewNotes: "Prompt leakage removed during AdSense editorial cleanup."
  },
  "ncdc-flags-lagos-fct-rivers-kano-and-nine-other-states-as-high-risk-for-ebola-importation": {
    category: "health",
    reviewNotes: "Prompt leakage removed during AdSense editorial cleanup."
  },
  "world-cup-2026-bellingham-and-kane-s-panama-triumph-secures-top-spot-for-england": {
    title: "England Clinch Group C at World Cup 2026 After Bellingham and Kane Sink Panama",
    seoTitle: "England Clinch Group C at World Cup 2026 After Panama Win",
    metaDescription:
      "England beat Panama 2-0 to finish top of Group C at the 2026 World Cup, with Jude Bellingham and Harry Kane shaping a result that matters for the knockout stage.",
    excerpt:
      "England finished top of Group C at World Cup 2026 after a 2-0 win over Panama. The result, shaped by Jude Bellingham and Harry Kane, strengthens England's knockout position and carries wider significance beyond the scoreline.",
    imageAlt:
      "England players celebrate after their 2-0 win over Panama in the 2026 World Cup group stage.",
    reviewNotes: "Editorial title and summary repaired during AdSense cleanup."
  }
};

const LOW_VALUE_SLUGS = [
  "vote-for-journal-star-boys-athlete-of-the-week-may-18-23-how-nigerians-can-join-the-fun",
  "how-to-participate-in-go-fest-2026-with-a-pok-mon-go-spoofer",
  "vote-for-livingston-daily-athlete-of-the-week-may-18-23-2026-how-nigerians-can-join-the-countdown",
  "lauren-phillips-hits-afl-star-rory-lobb-with-x-rated-insult-off-air-then-gets-called-out-live-on-radio",
  "waikato-expressway-sh1-closed-southbound-from-te-kauwhata-after-serious-crash",
  "how-nascar-star-gutted-out-racing-on-broken-leg-5-things-about-dover-race"
];

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

function normalizeMarkdownContent(content = "") {
  return String(content || "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripMarkdown(value = "") {
  return String(value || "")
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

function trimLength(value, max) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  if (!normalized || normalized.length <= max) {
    return normalized;
  }

  return `${normalized.slice(0, max - 1).trimEnd()}…`;
}

function defaultRegionFocus(category, explicit = "") {
  if (explicit) {
    return explicit;
  }

  return category === "world" ? "global" : "nigeria";
}

function getCoverStyle(category) {
  const styles = {
    nigeria: "cover-violet",
    world: "cover-cyan",
    business: "cover-gold",
    sports: "cover-cyan",
    tech: "cover-cyan",
    entertainment: "cover-warm",
    health: "cover-cyan",
    lifestyle: "cover-warm",
    education: "cover-gold",
    "daily-gist": "cover-violet"
  };

  return styles[category] || styles["daily-gist"];
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

      await sleep(attempt * 2500);
    }
  }

  throw lastError || new Error("Unable to fetch JSON payload.");
}

async function getLivePosts() {
  const resource = await cloudinary.api.resource(`${POSTS_PUBLIC_ID}.json`, {
    resource_type: "raw",
    type: "upload"
  });

  const payload = await fetchJsonWithRetry(`${resource.secure_url}?t=${Date.now()}`);

  if (!Array.isArray(payload)) {
    throw new Error("Live posts store did not return an array.");
  }

  return payload;
}

function getTimestampStamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function backupPostsStore(posts) {
  const stamp = getTimestampStamp();
  const tempPath = path.join(os.tmpdir(), `${crypto.randomUUID()}-editorial-cleanup-backup.json`);
  await fsp.writeFile(tempPath, JSON.stringify(posts, null, 2), "utf8");

  try {
    const result = await cloudinary.uploader.upload(tempPath, {
      resource_type: "raw",
      public_id: `${BACKUP_FOLDER}/editorial-cleanup-pre-${stamp}`,
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

function parseDelimitedRewrite(text = "") {
  const value = String(text || "");
  const patterns = {
    title: /(?:^|\n)TITLE:\s*([\s\S]*?)(?=\nSEO_TITLE:|\nMETA_DESCRIPTION:|\nEXCERPT:|\nIMAGE_ALT:|\nCONTENT:|$)/i,
    seoTitle: /(?:^|\n)SEO_TITLE:\s*([\s\S]*?)(?=\nMETA_DESCRIPTION:|\nEXCERPT:|\nIMAGE_ALT:|\nCONTENT:|$)/i,
    metaDescription: /(?:^|\n)META_DESCRIPTION:\s*([\s\S]*?)(?=\nEXCERPT:|\nIMAGE_ALT:|\nCONTENT:|$)/i,
    excerpt: /(?:^|\n)EXCERPT:\s*([\s\S]*?)(?=\nIMAGE_ALT:|\nCONTENT:|$)/i,
    imageAlt: /(?:^|\n)IMAGE_ALT:\s*([\s\S]*?)(?=\nCONTENT:|$)/i,
    content: /(?:^|\n)CONTENT:\s*([\s\S]*)$/i
  };

  const parsed = {};
  for (const [key, pattern] of Object.entries(patterns)) {
    parsed[key] = ((value.match(pattern) || [])[1] || "").trim();
  }

  return parsed;
}

function buildFirstParagraphExcerpt(content = "", fallback = "") {
  const paragraph = normalizeMarkdownContent(content).split("\n\n").find((entry) => !entry.trim().startsWith("#")) || "";
  const clean = stripMarkdown(paragraph);
  return trimLength(clean || fallback, 260);
}

function buildReviewNotes(current, addition) {
  const base = String(current || "").trim();
  const next = String(addition || "").trim();

  if (!next) {
    return base;
  }

  if (!base) {
    return next;
  }

  return base.includes(next) ? base : `${base} ${next}`.trim();
}

async function main() {
  assertEnv("CLOUDINARY_CLOUD_NAME");
  assertEnv("CLOUDINARY_API_KEY");
  assertEnv("CLOUDINARY_API_SECRET");

  const posts = await getLivePosts();
  const backupUrl = await backupPostsStore(posts);
  const postMap = new Map(posts.map((post) => [post.slug, post]));
  let repairedCount = 0;
  let draftedCount = 0;

  for (const [slug, overrides] of Object.entries(PROMPT_LEAK_REPAIRS)) {
    const current = postMap.get(slug);

    if (!current) {
      continue;
    }

    const parsed = parseDelimitedRewrite(current.content || "");
    const content = parsed.content ? normalizeMarkdownContent(parsed.content) : normalizeMarkdownContent(current.content || "");
    const title = trimLength(overrides.title || parsed.title || current.title, 140);
    const seoTitle = trimLength(overrides.seoTitle || parsed.seoTitle || current.seoTitle || title, 160);
    const metaDescription = trimLength(
      overrides.metaDescription || parsed.metaDescription || current.metaDescription || current.excerpt,
      160
    );
    const excerpt = trimLength(
      overrides.excerpt || parsed.excerpt || buildFirstParagraphExcerpt(content, current.excerpt || current.title),
      260
    );
    const imageAlt = trimLength(overrides.imageAlt || parsed.imageAlt || current.imageAlt || title, 180);
    const category = VALID_CATEGORIES.has(String(overrides.category || "").trim())
      ? String(overrides.category).trim()
      : current.category;

    postMap.set(slug, {
      ...current,
      title,
      seoTitle,
      metaDescription,
      excerpt,
      imageAlt,
      content,
      category,
      regionFocus: defaultRegionFocus(category, current.regionFocus || ""),
      coverStyle: getCoverStyle(category),
      reviewNotes: buildReviewNotes(current.reviewNotes, overrides.reviewNotes),
      readTime: estimateReadTime(content),
      updatedAt: new Date().toISOString()
    });

    repairedCount += 1;
  }

  for (const slug of LOW_VALUE_SLUGS) {
    const current = postMap.get(slug);

    if (!current || String(current.workflowStatus || "published") === "draft") {
      continue;
    }

    postMap.set(slug, {
      ...current,
      workflowStatus: "draft",
      reviewNotes: buildReviewNotes(
        current.reviewNotes,
        "Held from live publication during AdSense cleanup because the topic is low-value, thin, or not strong enough for indexation."
      ),
      updatedAt: new Date().toISOString()
    });

    draftedCount += 1;
  }

  const updatedPosts = posts.map((post) => postMap.get(post.slug) || post);
  await writePostsStore(updatedPosts);

  console.log(`Created safety backup: ${backupUrl || "backup-uploaded"}`);
  console.log(`Repaired published prompt-leak posts: ${repairedCount}`);
  console.log(`Demoted low-value posts to draft: ${draftedCount}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
