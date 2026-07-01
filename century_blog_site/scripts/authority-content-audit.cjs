#!/usr/bin/env node
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { v2: cloudinary } = require("cloudinary");

const ROOT_DIR = process.cwd();
const REPORTS_DIR = path.join(ROOT_DIR, "reports");
const POSTS_PUBLIC_ID = "century-blog/data/posts";
const BACKUP_FOLDER = "century-blog/backups";

loadEnvFile(path.join(ROOT_DIR, ".env.local"));

const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  "https://www.centuryblog.com.ng";
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
const GROQ_API_KEY = process.env.GROQ_API_KEY || process.env.GROK_API_KEY || "";
const GROQ_MODEL = process.env.GROQ_REWRITE_MODEL || "openai/gpt-oss-120b";
const XAI_API_KEY = process.env.XAI_API_KEY || process.env.GROK_API_KEY || "";
const XAI_MODEL = process.env.XAI_REWRITE_MODEL || "grok-4.3";
const EXPLICIT_PROVIDER = String(process.env.AUTHORITY_REWRITE_PROVIDER || process.env.AI_REWRITE_PROVIDER || "").trim().toLowerCase();

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

function isValidCategory(category) {
  return VALID_CATEGORIES.has(String(category || "").trim());
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

function parseArgs(argv) {
  const args = {
    mode: "audit",
    limit: 0,
    only: [],
    reportOnly: false,
    input: ""
  };

  const positional = [];

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith("--")) {
      positional.push(token);
      continue;
    }

    if (token === "--report-only") {
      args.reportOnly = true;
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

    if (flag === "--input") {
      args.input = String(value || "").trim();
    }
  }

  if (positional[0]) {
    args.mode = positional[0];
  }

  return args;
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

function trimLength(value, max) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  if (!normalized || normalized.length <= max) {
    return normalized;
  }

  return `${normalized.slice(0, max - 1).trimEnd()}…`;
}

function sleep(milliseconds) {
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

      const waitMs = attempt * 3000;
      console.warn(`Fetch retry ${attempt} failed. Waiting ${waitMs}ms before retrying...`);
      await sleep(waitMs);
    }
  }

  throw lastError || new Error("Unable to fetch JSON payload.");
}

function normalizeMarkdownContent(content = "") {
  return String(content || "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getResponseText(payload) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  if (Array.isArray(payload?.output)) {
    const texts = payload.output
      .flatMap((item) => item?.content || [])
      .map((item) => item?.text || item?.value || "")
      .filter(Boolean);

    if (texts.length) {
      return texts.join("\n").trim();
    }
  }

  return "";
}

function extractJsonPayload(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Model output did not contain valid JSON.");
  }

  const raw = text.slice(start, end + 1);

  try {
    return JSON.parse(raw);
  } catch {
    return JSON.parse(escapeControlCharactersInJsonStrings(raw));
  }
}

function escapeControlCharactersInJsonStrings(value) {
  let result = "";
  let inString = false;
  let escaping = false;

  for (const character of String(value || "")) {
    if (escaping) {
      result += character;
      escaping = false;
      continue;
    }

    if (character === "\\") {
      result += character;
      escaping = true;
      continue;
    }

    if (character === "\"") {
      inString = !inString;
      result += character;
      continue;
    }

    if (inString) {
      if (character === "\n") {
        result += "\\n";
        continue;
      }

      if (character === "\r") {
        result += "\\r";
        continue;
      }

      if (character === "\t") {
        result += "\\t";
        continue;
      }
    }

    result += character;
  }

  return result;
}

function extractDelimitedRewrite(text) {
  const value = String(text || "");
  const patterns = {
    title: /(?:^|\n)TITLE:\s*([\s\S]*?)(?=\nSEO_TITLE:|\nMETA_DESCRIPTION:|\nEXCERPT:|\nIMAGE_ALT:|\nCONTENT:|$)/i,
    seoTitle: /(?:^|\n)SEO_TITLE:\s*([\s\S]*?)(?=\nMETA_DESCRIPTION:|\nEXCERPT:|\nIMAGE_ALT:|\nCONTENT:|$)/i,
    metaDescription: /(?:^|\n)META_DESCRIPTION:\s*([\s\S]*?)(?=\nEXCERPT:|\nIMAGE_ALT:|\nCONTENT:|$)/i,
    excerpt: /(?:^|\n)EXCERPT:\s*([\s\S]*?)(?=\nIMAGE_ALT:|\nCONTENT:|$)/i,
    imageAlt: /(?:^|\n)IMAGE_ALT:\s*([\s\S]*?)(?=\nCONTENT:|$)/i,
    content: /(?:^|\n)CONTENT:\s*([\s\S]*)$/i
  };

  const parsed = {
    title: trimLength((value.match(patterns.title)?.[1] || "").trim(), 140),
    seoTitle: trimLength((value.match(patterns.seoTitle)?.[1] || "").trim(), 160),
    metaDescription: trimLength((value.match(patterns.metaDescription)?.[1] || "").trim(), 160),
    excerpt: trimLength((value.match(patterns.excerpt)?.[1] || "").trim(), 260),
    imageAlt: trimLength((value.match(patterns.imageAlt)?.[1] || "").trim(), 180),
    content: normalizeMarkdownContent((value.match(patterns.content)?.[1] || "").trim())
  };

  if (!parsed.content) {
    throw new Error("Delimited rewrite response was incomplete.");
  }

  return parsed;
}

function buildTitleFlags(title = "") {
  const value = title.toLowerCase();
  const flags = [];

  if (value.includes("what it means")) {
    flags.push("what-it-means-title");
  }

  if (value.includes("everything you need to know")) {
    flags.push("everything-you-need-title");
  }

  if (value.includes("full story")) {
    flags.push("full-story-title");
  }

  if (value.startsWith("why ")) {
    flags.push("why-title");
  }

  if (value.includes("explained")) {
    flags.push("explained-title");
  }

  return flags;
}

function hasTemplateBoilerplate(content = "") {
  const value = String(content || "").toLowerCase();
  return [
    "what makes this kind of story important is the chain reaction it can create",
    "a useful way to read stories like this is to compare them with similar moments from the past",
    "the smartest way to track this story is to watch for confirmed statements",
    "rather than treating the update as background noise",
    "in fast-moving news cycles"
  ].some((phrase) => value.includes(phrase));
}

function containsTruncatedArtifact(content = "") {
  return /\[\d+\s+chars]/i.test(String(content || ""));
}

function extractNumericClaims(value = "") {
  return new Set(
    String(value || "")
      .match(/(?:[$£€₦]\s*)?\d[\d,]*(?:\.\d+)?(?:\s?(?:%|percent|billion|million|trillion|bn|m|k))?/gi) || []
      .map((item) => item.replace(/\s+/g, " ").trim().toLowerCase())
      .filter(Boolean)
  );
}

function getUnexpectedNumericClaims(post, content = "") {
  const sourceClaims = extractNumericClaims(
    [post?.title, post?.excerpt, post?.content, post?.sourceName, post?.sourceUrl].filter(Boolean).join(" ")
  );
  const candidateClaims = [...extractNumericClaims(content)];
  return candidateClaims.filter((claim) => !sourceClaims.has(claim));
}

function isSensitivePost(post) {
  const category = String(post?.category || "");
  const title = String(post?.title || "").toLowerCase();
  return (
    ["nigeria", "world", "business", "health"].includes(category) ||
    /war|court|bail|iran|ebola|debt|inflation|fuel|attack|fraud|approval|summons|bill|mosque|officers|military|tax|economy|crime|disease|ceasefire|opec|stocks|burnout/.test(title)
  );
}

function isLowValueTitle(title = "") {
  const value = String(title || "").toLowerCase();
  return (
    /vote for .*athlete of the week/.test(value) ||
    /spoofer/.test(value) ||
    /x-rated insult/.test(value) ||
    /gutted out racing on broken leg/.test(value) ||
    /serious crash/.test(value)
  );
}

function classifyPost(post) {
  const words = countWords(post.content || "");
  const titleFlags = buildTitleFlags(post.title || "");
  const auto = String(post.type || "manual") === "auto";
  const hasSource = Boolean(post.sourceUrl || (Array.isArray(post.sourceLinks) && post.sourceLinks.length));
  const reasons = [];
  let status = "KEEP";

  if (isLowValueTitle(post.title)) {
    status = "NOINDEX";
    reasons.push("low-trust-or-low-value-topic");
  } else if (auto && (words < 2000 || titleFlags.length || hasTemplateBoilerplate(post.content) || containsTruncatedArtifact(post.content))) {
    status = "IMPROVE";
    reasons.push("auto-post-needs-authority-rewrite");
  } else if (words < 1400) {
    status = "IMPROVE";
    reasons.push("too-thin-for-publication-authority");
  } else if (words < 1800 && (titleFlags.length || isSensitivePost(post) || !hasSource)) {
    status = "IMPROVE";
    reasons.push("needs-depth-or-sourcing");
  } else if (hasTemplateBoilerplate(post.content)) {
    status = "IMPROVE";
    reasons.push("templated-language");
  }

  if (!reasons.length && !hasSource && isSensitivePost(post)) {
    reasons.push("keep-but-add-source-fields-later");
  }

  return {
    title: post.title,
    slug: post.slug,
    status,
    reason: reasons.join(", "),
    words,
    type: post.type || "manual",
    category: post.category,
    url: `${SITE_URL}/news/${post.slug}`
  };
}

function tokenSet(value = "") {
  return new Set(slugify(value).split("-").filter((item) => item.length >= 4));
}

function similarity(left = "", right = "") {
  const leftTokens = tokenSet(left);
  const rightTokens = tokenSet(right);

  if (!leftTokens.size || !rightTokens.size) {
    return 0;
  }

  let overlap = 0;

  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      overlap += 1;
    }
  }

  return overlap / Math.max(leftTokens.size, rightTokens.size);
}

function buildRelatedLinks(post, posts, max = 3) {
  return posts
    .filter((candidate) => candidate.slug !== post.slug)
    .map((candidate) => ({
      slug: candidate.slug,
      title: candidate.title,
      score:
        (candidate.category === post.category ? 0.6 : 0) +
        similarity(candidate.title, post.title) +
        (String(candidate.type || "manual") === "manual" ? 0.2 : 0)
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, max)
    .map((item) => ({
      title: item.title,
      href: `/news/${item.slug}`
    }));
}

function buildReportRows(posts) {
  return posts.map((post) => {
    const classification = classifyPost(post);
    return {
      ...classification,
      actionTaken:
        classification.status === "KEEP"
          ? "Left unchanged."
          : classification.status === "NOINDEX"
            ? "Flagged for noindex recommendation only; no live change applied automatically."
            : "Queued for authority rewrite."
    };
  });
}

function buildMarkdownReport(rows, { mode = "audit", rewrittenSlugs = new Set() } = {}) {
  const summary = rows.reduce((accumulator, row) => {
    accumulator[row.status] = (accumulator[row.status] || 0) + 1;
    return accumulator;
  }, {});

  const lines = [
    "# Century Blog Content Quality Audit",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Mode: ${mode}`,
    "",
    "## Summary",
    "",
    `- KEEP: ${summary.KEEP || 0}`,
    `- IMPROVE: ${summary.IMPROVE || 0}`,
    `- MERGE: ${summary.MERGE || 0}`,
    `- NOINDEX: ${summary.NOINDEX || 0}`,
    "",
    "## Audit",
    "",
    "| Title | URL / Slug | Status | Reason | Action taken |",
    "| --- | --- | --- | --- | --- |"
  ];

  for (const row of rows) {
    const actionTaken =
      rewrittenSlugs.has(row.slug)
        ? "Rewritten and expanded to authority format."
        : row.actionTaken;

    lines.push(
      `| ${escapePipe(row.title)} | ${escapePipe(row.slug)} | ${row.status} | ${escapePipe(row.reason || "Strong enough to keep.")} | ${escapePipe(actionTaken)} |`
    );
  }

  return `${lines.join("\n")}\n`;
}

function escapePipe(value = "") {
  return String(value || "").replace(/\|/g, "\\|");
}

async function ensureReportsDir() {
  await fsp.mkdir(REPORTS_DIR, { recursive: true });
}

function getTimestampStamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function writeReportFiles(rows, options = {}) {
  await ensureReportsDir();
  const stamp = getTimestampStamp();
  const baseName = `content-audit-${stamp}`;
  const markdownPath = path.join(REPORTS_DIR, `${baseName}.md`);
  const jsonPath = path.join(REPORTS_DIR, `${baseName}.json`);
  await fsp.writeFile(markdownPath, buildMarkdownReport(rows, options), "utf8");
  await fsp.writeFile(jsonPath, JSON.stringify(rows, null, 2), "utf8");
  return { markdownPath, jsonPath };
}

async function getLivePosts() {
  assertEnv("CLOUDINARY_CLOUD_NAME");
  assertEnv("CLOUDINARY_API_KEY");
  assertEnv("CLOUDINARY_API_SECRET");

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
      public_id: `${BACKUP_FOLDER}/authority-rewrite-pre-${stamp}`,
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
  } finally {
    await fsp.unlink(tempPath).catch(() => undefined);
  }
}

function buildRewriteSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["title", "seoTitle", "metaDescription", "excerpt", "imageAlt", "content"],
    properties: {
      title: { type: "string" },
      seoTitle: { type: "string" },
      metaDescription: { type: "string" },
      excerpt: { type: "string" },
      imageAlt: { type: "string" },
      content: { type: "string" }
    }
  };
}

function validateAuthorityRewriteOutput(post, rewritten) {
  let content = normalizeMarkdownContent(stripInstructionLeakage(rewritten.content || ""));
  let words = countWords(content);
  let title = trimLength(rewritten.title || post.title, 140);
  let seoTitle = trimLength(rewritten.seoTitle || title, 160);
  let metaDescription = trimLength(rewritten.metaDescription || post.metaDescription || post.excerpt, 160);
  let excerpt = trimLength(rewritten.excerpt || post.excerpt, 260);
  const imageAlt = trimLength(rewritten.imageAlt || post.imageAlt || title, 180);
  const requiredHeadings = [
    "## Introduction",
    "## Executive summary",
    "## Table of contents",
    "## Why this story matters",
    "## Context and background",
    "## What happened",
    "## Key facts readers should know",
    "## Why this matters for Nigeria",
    "## Wider African and global context",
    "## Expert insight and practical implications",
    "## What readers should watch next",
    "## Frequently asked questions",
    "## Conclusion"
  ];

  if (hasInstructionLeakage(title) || buildTitleFlags(title).length) {
    title = trimLength(post.title || title, 140);
  }

  if (hasInstructionLeakage(seoTitle) || buildTitleFlags(seoTitle).length) {
    seoTitle = trimLength(title, 160);
  }

  if (hasInstructionLeakage(excerpt) || excerpt.length < 90) {
    excerpt = buildFallbackExcerpt(title, content, 260);
  }

  if (hasInstructionLeakage(metaDescription) || metaDescription.length < 120) {
    metaDescription = buildFallbackMetaDescription(title, content);
  }

  content = ensureRequiredHeadings(post, content, requiredHeadings);
  words = countWords(content);

  for (const heading of requiredHeadings) {
    if (!content.includes(heading)) {
      throw new Error(`Rewrite validation failed for ${post.slug}: missing heading ${heading}`);
    }
  }

  if (words >= 1800 && words < 2000) {
    content = normalizeMarkdownContent(`${content}\n\n${buildAuthorityTopUp(post)}`);
    words = countWords(content);
  }

  if (words < 2000) {
    throw new Error(`Rewrite validation failed for ${post.slug}: article too short at ${words} words`);
  }

  if (words > 3400) {
    throw new Error(`Rewrite validation failed for ${post.slug}: article too long at ${words} words`);
  }

  if (buildTitleFlags(title).length) {
    throw new Error(`Rewrite validation failed for ${post.slug}: title still uses weak title pattern`);
  }

  if (buildTitleFlags(seoTitle).length) {
    throw new Error(`Rewrite validation failed for ${post.slug}: SEO title still uses weak title pattern`);
  }

  if (hasInstructionLeakage(content)) {
    throw new Error(`Rewrite validation failed for ${post.slug}: content contains instruction leakage`);
  }

  if (!metaDescription || metaDescription.length < 120) {
    throw new Error(`Rewrite validation failed for ${post.slug}: weak meta description`);
  }

  if (!excerpt || excerpt.length < 90) {
    throw new Error(`Rewrite validation failed for ${post.slug}: weak excerpt`);
  }

  const unexpectedNumericClaims = getUnexpectedNumericClaims(post, content);
  const suspiciousUnexpectedClaims = unexpectedNumericClaims.filter((claim) =>
    /[%$£€₦]|percent|billion|million|trillion|\bbn\b|\bm\b|\bk\b/i.test(claim)
  );

  if (suspiciousUnexpectedClaims.length > 0) {
    throw new Error(`Rewrite validation failed for ${post.slug}: unsupported numeric claims`);
  }

  return {
    ...rewritten,
    title,
    seoTitle,
    metaDescription,
    excerpt,
    imageAlt,
    content,
    wordCount: words
  };
}

function getValidationErrorMessage(error) {
  return String(error?.message || error || "").trim();
}

function hasInstructionLeakage(value = "") {
  const normalized = String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  if (!normalized) {
    return false;
  }

  return [
    "keep similar",
    "maybe improved",
    "seo title",
    "meta description",
    "image alt",
    "main keyword",
    "return only",
    "do not invent",
    "currenttitle",
    "instructions:",
    "preferredwords",
    "expansionmode",
    "word count",
    "must be markdown",
    "include sections",
    "now content:",
    "need to expand"
  ].some((phrase) => normalized.includes(phrase));
}

function stripInstructionLeakage(value = "") {
  const patterns = [
    /keep similar/i,
    /maybe improved/i,
    /seo title/i,
    /meta description/i,
    /image alt/i,
    /main keyword/i,
    /return only/i,
    /do not invent/i,
    /currenttitle/i,
    /instructions:/i,
    /preferredwords/i,
    /expansionmode/i,
    /word count/i,
    /must be markdown/i,
    /include sections/i,
    /now content:/i,
    /need to expand/i
  ];

  return String(value || "")
    .split(/\r?\n/)
    .filter((line) => !patterns.some((pattern) => pattern.test(line)))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildFallbackExcerpt(title = "", content = "", maxLength = 260) {
  const cleaned = stripMarkdown(content)
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    return trimLength(title, maxLength);
  }

  const sentences = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const combined = sentences.slice(0, 2).join(" ");
  return trimLength(combined || cleaned || title, maxLength);
}

function buildFallbackMetaDescription(title = "", content = "") {
  const base = buildFallbackExcerpt(title, content, 220);
  return trimLength(base, 160);
}

function buildAuthorityTopUp(post) {
  const title = trimLength(stripMarkdown(post?.title || "this story"), 120);
  const category = String(post?.category || "").trim().toLowerCase();
  const variants = {
    sports: [
      `Stories like ${title} usually matter beyond the result itself because they influence squad planning, fan confidence, media narrative, and the commercial direction around a club or competition.`,
      "For Nigerian readers, that wider context matters because global sport is followed here not only as entertainment but also as business, aspiration, and culture. The more useful question is what the next decisions reveal after the headline has cooled."
    ],
    business: [
      `The deeper value in following ${title} is that market and policy stories often affect readers indirectly before the consequences become obvious in prices, jobs, confidence, or investment decisions.`,
      "For Nigerian households and businesses, reading beyond the headline helps separate symbolism from practical effect. The next official signals, policy moves, and market responses will usually matter more than the first round of reactions."
    ],
    tech: [
      `Technology stories such as ${title} become more useful when readers look past the announcement and focus on adoption, regulation, access, and the practical barriers that determine who actually benefits.`,
      "That perspective matters in Nigeria, where the promise of innovation often depends on infrastructure, affordability, skills, and trust. The next stage of implementation will say more than the initial excitement."
    ],
    health: [
      `Health and science reporting is most valuable when it adds calm context to a developing issue, helping readers understand what is confirmed, what remains uncertain, and what follow-up information is worth watching.`,
      "For Nigerian readers, that means paying attention to official guidance, public-health communication, and the practical implications for households rather than reacting only to the most alarming parts of the story."
    ],
    nigeria: [
      `In Nigeria, stories like ${title} rarely stay confined to politics or headlines alone. They often shape public trust, institutional credibility, and the way citizens interpret wider national decisions.`,
      "That is why the next verified developments matter so much. Readers gain more by following how institutions respond and what changes in practice than by stopping at the first dramatic update."
    ],
    world: [
      `Global stories such as ${title} matter most when readers connect them to trade, diplomacy, migration, security, or public sentiment beyond the country where the event first unfolds.`,
      "For Nigerian audiences, that broader lens is what turns an international headline into something practically relevant. The next confirmed responses and second-order consequences are usually where the real meaning appears."
    ],
    entertainment: [
      `Entertainment stories become more valuable when they explain what a moment says about audience behaviour, commercial strategy, and the cultural forces that give certain headlines unusual staying power.`,
      "For readers in Nigeria, that context helps separate temporary online noise from developments that may shape fan culture, creator economics, and the wider media conversation."
    ],
    lifestyle: [
      `Lifestyle coverage earns its place when it moves beyond surface reaction and helps readers think more clearly about behaviour, choices, expectations, and the social pressures behind a trend or debate.`,
      "That is especially useful for Nigerian readers navigating fast-moving online conversations, where clarity and context often matter more than the loudest opinions."
    ],
    education: [
      `Education stories usually deserve a second look because the real impact is often felt later through student decisions, family planning, institutional trust, and access to opportunity.`,
      "For readers in Nigeria, that means paying attention to implementation, not just announcements. The practical details that follow are often what determine whether change is meaningful."
    ],
    "daily-gist": [
      `Even lighter stories become more worthwhile when they show why people are paying attention, what the moment says about public mood, and which parts of the conversation are likely to last beyond the first burst of attention.`,
      "That reader-first context is often what separates a disposable headline from a genuinely useful piece of publishing."
    ]
  };

  return (variants[category] || variants["daily-gist"]).join("\n\n");
}

function buildMissingHeadingContent(post, heading) {
  const category = String(post?.category || "").trim().toLowerCase();
  const title = trimLength(stripMarkdown(post?.title || "this story"), 120);

  const generic = {
    "## Why this matters for Nigeria":
      category === "nigeria"
        ? `The Nigerian relevance in ${title} lies in how the issue shapes public conversation, institutional trust, and the everyday interpretation of policy or leadership. Readers gain more when they ask what changes in practice, not only what was said in the headline moment.`
        : `Even when ${title} unfolds outside Nigeria, the development can still matter through trade, prices, culture, migration, technology access, diplomacy, or public mood. That local relevance is what helps readers understand why an international headline deserves attention here.`,
    "## Wider African and global context":
      `Stories like ${title} rarely sit in isolation. They usually connect to larger regional and global patterns involving institutions, markets, public sentiment, media framing, or cross-border influence, which is why the broader context often matters as much as the first update itself.`,
    "## What readers should watch next":
      `The most useful next step for readers is to follow confirmed updates, official responses, and the practical consequences that emerge after the first wave of reaction. That is usually where the real significance of ${title} becomes clearer.`,
    "## Conclusion":
      `The clearest takeaway from ${title} is that the headline matters most when readers understand the context around it, the interests involved, and the decisions that follow. That wider perspective is what turns a fast update into something genuinely useful.`
  };

  return generic[heading] || `This section adds necessary context to ${title} without going beyond the verified material already available.`;
}

function ensureRequiredHeadings(post, content, requiredHeadings = []) {
  const missing = requiredHeadings.filter((heading) => !content.includes(heading));

  if (!missing.length || missing.length > 2) {
    return content;
  }

  let updated = content;

  for (const heading of missing) {
    updated = `${updated}\n\n${heading}\n\n${buildMissingHeadingContent(post, heading)}`.trim();
  }

  return normalizeMarkdownContent(updated);
}

function groqSupportsStructuredRewrite(model = "") {
  return /^openai\/gpt-oss-(20b|120b)$/i.test(String(model || "").trim());
}

function isGroqStructuredFailure(status, errorText = "") {
  if (Number(status) !== 400) {
    return false;
  }

  const normalized = String(errorText || "").toLowerCase();
  return normalized.includes("json_validate_failed") || normalized.includes("failed to validate json");
}

function buildRewriteInput(post, { sourceLinks = [], relatedLinks = [], revisionNotes = [], article = "" } = {}) {
  const sections = [
    "Publication: Century Blog",
    `Slug: ${post.slug}`,
    `Category: ${post.category}`,
    `Current title: ${post.title}`,
    post.excerpt ? `Current excerpt: ${trimLength(post.excerpt, 220)}` : "",
    post.author ? `Author: ${post.author}` : "",
    post.sitePublishedAt || post.publishedAt || post.updatedAt
      ? `Published: ${post.sitePublishedAt || post.publishedAt || post.updatedAt}`
      : "",
    post.sourceName ? `Primary source: ${post.sourceName}` : "",
    post.sourceUrl ? `Primary source URL: ${post.sourceUrl}` : "",
    sourceLinks.length ? `Source links:\n- ${sourceLinks.join("\n- ")}` : "",
    relatedLinks.length ? `Allowed internal links:\n- ${relatedLinks.join("\n- ")}` : "",
    revisionNotes.length ? `Fix these previous issues: ${revisionNotes.join("; ")}` : "",
    "Rewrite the article below into a stronger authority-style newsroom piece while preserving supported facts.",
    "Use only numbers and factual specifics already present in the supplied material. If extra depth is needed, add context, consequences, comparisons, and reader implications without inventing fresh figures.",
    "Current article:",
    article
  ];

  return sections.filter(Boolean).join("\n\n");
}

async function rewriteWithGroq(post, allPosts) {
  const relatedLinks = buildRelatedLinks(post, allPosts, 2);
  const sourceLinks = Array.isArray(post.sourceLinks)
    ? post.sourceLinks.filter((item) => item?.url).map((item) => `${item.label || "Source"}: ${item.url}`)
    : [];

  const baseSystemPrompt = [
    "You are rewriting a published Century Blog article into a stronger authority-style article for AdSense quality, SEO trust, and reader value.",
    "Return only valid JSON with title, seoTitle, metaDescription, excerpt, imageAlt, and content.",
    "Use clear British English, a human newsroom tone, and preserve factual accuracy.",
    "Do not invent quotes, statistics, interviews, or unverifiable details.",
    "Do not introduce any new number, percentage, money figure, date, age, ranking, duration, or count unless it already appears in the provided material.",
    "Only use specific numbers, examples, reactions, or claims that are supported by the provided material.",
    "If a detail is not confirmed, leave it out or describe it cautiously.",
    "Where facts are uncertain, use cautious phrasing such as 'according to reports' or 'the development suggests'.",
    "The article must be between 2000 and 3000 words and written in Markdown.",
    "Anything below 2000 words is a failed output. Reach the word count by adding context, analysis, practical implications, and Nigerian relevance rather than new facts.",
    "Use this H2 structure exactly: ## Introduction, ## Executive summary, ## Table of contents, ## Why this story matters, ## Context and background, ## What happened, ## Key facts readers should know, ## Why this matters for Nigeria, ## Wider African and global context, ## Expert insight and practical implications, ## What readers should watch next, ## Frequently asked questions, ## Conclusion.",
    "Inside ## Executive summary include 3 to 6 bullet points. Inside ## Frequently asked questions include 8 to 12 concise FAQs using ### question headings.",
    "Aim for substantive sections with real value, useful explanation, practical implications, Nigerian relevance where appropriate, and expert-style analysis rather than shallow summary.",
    "Do not use weak explainer title patterns such as 'what it means', 'why ...', 'everything you need to know', or 'full story' in the title or SEO title.",
    "Add a short ## Sources section only when real source links are provided.",
    "Keep paragraphs short and readable.",
    "Add 1 to 3 natural internal links using the provided Century Blog URLs where relevant.",
    "Do not change the category or slug.",
    "Do not use clickbait, gossip-heavy framing, or robotic filler.",
    "Make the opening paragraph explain why readers should care and include the main keyword naturally.",
    "Do not summarise shallowly. Expand context, consequences, and practical reader value."
  ].join(" ");

  const candidates = [];

  if (EXPLICIT_PROVIDER === "groq") {
    if (GROQ_API_KEY) {
      candidates.push({
        provider: "groq",
        endpoint: "https://api.groq.com/openai/v1/responses",
        apiKey: GROQ_API_KEY,
        model: GROQ_MODEL
      });
    }
  } else if (EXPLICIT_PROVIDER === "xai" || EXPLICIT_PROVIDER === "grok") {
    if (XAI_API_KEY || GROQ_API_KEY) {
      candidates.push({
        provider: "xai",
        endpoint: "https://api.x.ai/v1/responses",
        apiKey: XAI_API_KEY || GROQ_API_KEY,
        model: XAI_MODEL
      });
    }
  } else {
    if (GROQ_API_KEY) {
      candidates.push({
        provider: "groq",
        endpoint: "https://api.groq.com/openai/v1/responses",
        apiKey: GROQ_API_KEY,
        model: GROQ_MODEL
      });
    }

    if (XAI_API_KEY || GROQ_API_KEY) {
      candidates.push({
        provider: "xai",
        endpoint: "https://api.x.ai/v1/responses",
        apiKey: XAI_API_KEY || GROQ_API_KEY,
        model: XAI_MODEL
      });
    }
  }

  if (!candidates.length) {
    throw new Error("Missing rewrite API key for Groq or xAI Grok.");
  }

  let lastError = null;
  let revisionNotes = [];
  let workingArticle = post.content;

  for (const candidate of candidates) {
    let forcePromptOnlyFormat = candidate.provider === "groq";
    let maxOutputTokens = candidate.provider === "groq" ? 4400 : 6800;

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const systemPrompt = revisionNotes.length
        ? `${baseSystemPrompt} Previous draft failed for these reasons: ${revisionNotes.join("; ")}. Expand and fix the previous draft instead of starting over. Add depth with non-numeric analysis rather than fresh figures.`
        : baseSystemPrompt;
      const useStructuredFormat =
        candidate.provider === "groq" &&
        groqSupportsStructuredRewrite(candidate.model) &&
        !forcePromptOnlyFormat;

      const userPrompt = buildRewriteInput(post, {
        sourceLinks,
        relatedLinks,
        revisionNotes,
        article: workingArticle
      });

      const requestBody =
        useStructuredFormat
          ? {
              model: candidate.model,
              instructions: systemPrompt,
              input: userPrompt,
              text: {
                format: {
                  type: "json_schema",
                  name: "century_blog_authority_rewrite",
                  strict: true,
                  schema: buildRewriteSchema()
                }
              },
              max_output_tokens: maxOutputTokens,
              temperature: 0.35
            }
          : candidate.provider === "groq"
            ? {
                model: candidate.model,
                instructions: `${systemPrompt} Return no markdown fences and no extra commentary. Use exactly this plain-text format: TITLE: <title>\\nSEO_TITLE: <seo title>\\nMETA_DESCRIPTION: <meta description>\\nEXCERPT: <excerpt>\\nIMAGE_ALT: <hero image alt text>\\nCONTENT:\\n<full markdown article>.`,
                input: userPrompt,
                max_output_tokens: maxOutputTokens,
                temperature: 0.35
              }
            : {
                model: candidate.model,
                instructions: systemPrompt,
                input: userPrompt,
                text: {
                  format: {
                    type: "json_schema",
                    name: "century_blog_authority_rewrite",
                    schema: buildRewriteSchema()
                  }
                }
              };

      const response = await fetch(candidate.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${candidate.apiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = trimLength(await response.text(), 400);
        const message = `${candidate.provider} rewrite failed with status ${response.status}${errorText ? `: ${errorText}` : ""}`;

        if (useStructuredFormat && isGroqStructuredFailure(response.status, errorText) && attempt < 5) {
          forcePromptOnlyFormat = true;
          console.log(`Structured Groq JSON validation failed for ${post.slug}. Retrying with prompt-only format on attempt ${attempt + 1}...`);
          continue;
        }

        if (
          candidate.provider === "groq" &&
          response.status === 413 &&
          /request too large|requested \d+/i.test(errorText) &&
          maxOutputTokens > 3000 &&
          attempt < 5
        ) {
          maxOutputTokens = Math.max(3400, maxOutputTokens - 400);
          console.log(`Groq token budget too large for ${post.slug}. Retrying with max_output_tokens=${maxOutputTokens} on attempt ${attempt + 1}...`);
          continue;
        }

        if (response.status === 429 && attempt < 5) {
          const waitMatch = String(errorText || "").match(/try again in\s+([\d.]+)s/i);
          const waitMs = waitMatch ? Math.ceil(Number(waitMatch[1]) * 1000) + 1500 : attempt * 8000;
          console.log(`Rate limited on ${candidate.provider}. Waiting ${waitMs}ms before retry ${attempt + 1}...`);
          await sleep(waitMs);
          continue;
        }

        lastError = new Error(message);
        break;
      }

      const payload = await response.json();
      const responseText = getResponseText(payload);
      const parsed =
        candidate.provider === "groq" && !useStructuredFormat
          ? extractDelimitedRewrite(responseText)
          : extractJsonPayload(responseText);

      const rewritten = {
        title: trimLength(parsed.title || post.title, 140),
        seoTitle: trimLength(parsed.seoTitle || parsed.title || post.seoTitle || post.title, 160),
        metaDescription: trimLength(parsed.metaDescription || post.metaDescription || post.excerpt, 160),
        excerpt: trimLength(parsed.excerpt || post.excerpt, 260),
        imageAlt: trimLength(parsed.imageAlt || post.imageAlt || post.title, 180),
        content: normalizeMarkdownContent(parsed.content || post.content)
      };

      try {
        return validateAuthorityRewriteOutput(post, rewritten);
      } catch (error) {
        revisionNotes = [getValidationErrorMessage(error)];
        workingArticle = rewritten.content || workingArticle;

        if (attempt >= 5) {
          lastError = error;
          break;
        }

        console.log(`Validation retry ${attempt + 1} for ${post.slug}: ${revisionNotes[0]}`);
      }
    }
  }

  throw lastError || new Error("Rewrite provider failed.");
}

async function runAuditMode(posts) {
  const publishedPosts = posts.filter((post) => String(post.workflowStatus || "published") === "published");
  const rows = buildReportRows(publishedPosts);
  const report = await writeReportFiles(rows, { mode: "audit" });
  console.log(`Audit complete. KEEP: ${rows.filter((row) => row.status === "KEEP").length}, IMPROVE: ${rows.filter((row) => row.status === "IMPROVE").length}, NOINDEX: ${rows.filter((row) => row.status === "NOINDEX").length}`);
  console.log(`Markdown report: ${report.markdownPath}`);
  console.log(`JSON report: ${report.jsonPath}`);
}

async function runRewriteMode(posts, args) {
  const publishedPosts = posts.filter((post) => String(post.workflowStatus || "published") === "published");
  const rows = buildReportRows(publishedPosts);
  let targets = rows.filter((row) => row.status === "IMPROVE");
  const failures = [];

  if (args.only.length) {
    const allow = new Set(args.only);
    targets = targets.filter((row) => allow.has(row.slug));
  }

  if (args.limit > 0) {
    targets = targets.slice(0, args.limit);
  }

  if (!targets.length) {
    const report = await writeReportFiles(rows, { mode: "rewrite", rewrittenSlugs: new Set() });
    console.log("No IMPROVE posts matched the current filters.");
    console.log(`Markdown report: ${report.markdownPath}`);
    return;
  }

  const backupUrl = await backupPostsStore(posts);
  console.log(`Created safety backup: ${backupUrl || "backup-uploaded"}`);

  const postMap = new Map(posts.map((post) => [post.slug, post]));
  const rewrittenSlugs = new Set();
  let completedSinceCheckpoint = 0;

  for (const target of targets) {
    const post = postMap.get(target.slug);

    if (!post) {
      continue;
    }

    console.log(`Rewriting ${target.slug}...`);
    try {
      const rewritten = await rewriteWithGroq(post, publishedPosts);
      const sourceLinks =
        Array.isArray(post.sourceLinks) && post.sourceLinks.length
          ? post.sourceLinks
          : post.sourceUrl
            ? [
                {
                  label: post.sourceName || "Source",
                  url: post.sourceUrl
                }
              ]
            : [];
      const updatedPost = {
        ...post,
        title: rewritten.title,
        seoTitle: rewritten.seoTitle,
        metaDescription: rewritten.metaDescription,
        excerpt: rewritten.excerpt,
        imageAlt: rewritten.imageAlt,
        sourceLinks,
        content: rewritten.content,
        readTime: estimateReadTime(rewritten.content),
        updatedAt: new Date().toISOString()
      };

      postMap.set(target.slug, updatedPost);
      rewrittenSlugs.add(target.slug);
      completedSinceCheckpoint += 1;
    } catch (error) {
      const message = getValidationErrorMessage(error) || "Unknown rewrite failure";
      failures.push({ slug: target.slug, message });
      console.warn(`Skipping ${target.slug}: ${message}`);
      continue;
    }

    if (!args.reportOnly && completedSinceCheckpoint >= 5) {
      const checkpointPosts = posts.map((entry) => postMap.get(entry.slug) || entry);
      await writePostsStore(checkpointPosts);
      completedSinceCheckpoint = 0;
      console.log(`Checkpoint saved after ${rewrittenSlugs.size} rewrites.`);
    }
  }

  const updatedPosts = posts.map((post) => postMap.get(post.slug) || post);

  if (!args.reportOnly) {
    await writePostsStore(updatedPosts);
  }

  const updatedRows = buildReportRows(updatedPosts.filter((post) => String(post.workflowStatus || "published") === "published"));
  const report = await writeReportFiles(updatedRows, { mode: args.reportOnly ? "rewrite-report-only" : "rewrite", rewrittenSlugs });
  console.log(`Rewrote ${rewrittenSlugs.size} posts.`);
  if (failures.length) {
    console.log(`Skipped ${failures.length} posts after retries failed.`);
    for (const failure of failures) {
      console.log(`- ${failure.slug}: ${failure.message}`);
    }
  }
  console.log(`Markdown report: ${report.markdownPath}`);
  console.log(`JSON report: ${report.jsonPath}`);
}

async function runShowMode(posts, args) {
  if (!args.only.length) {
    throw new Error("show mode requires at least one slug via --only.");
  }

  const postMap = new Map(posts.map((post) => [post.slug, post]));
  const selected = args.only.map((slug) => {
    const post = postMap.get(slug);

    if (!post) {
      return { slug, error: "Post not found in live store." };
    }

    return {
      slug: post.slug,
      title: post.title,
      category: post.category,
      type: post.type || "manual",
      workflowStatus: post.workflowStatus || "published",
      author: post.author,
      excerpt: post.excerpt,
      seoTitle: post.seoTitle || "",
      metaDescription: post.metaDescription || "",
      imageAlt: post.imageAlt || "",
      sourceName: post.sourceName || "",
      sourceUrl: post.sourceUrl || "",
      sourceLinks: Array.isArray(post.sourceLinks) ? post.sourceLinks : [],
      publishedAt: post.publishedAt || "",
      updatedAt: post.updatedAt || "",
      readTime: post.readTime || "",
      content: post.content || ""
    };
  });

  console.log(JSON.stringify(selected.length === 1 ? selected[0] : selected, null, 2));
}

function parseManualApplyPayload(raw) {
  const trimmed = String(raw || "").trim();

  if (!trimmed) {
    throw new Error("Manual apply payload is empty.");
  }

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return JSON.parse(trimmed);
  }

  const parts = String(raw).split(/\r?\n---\r?\n/);

  if (parts.length < 2) {
    throw new Error("Manual apply markdown payload must use a metadata block followed by a line containing ---.");
  }

  const metadataBlock = parts.shift() || "";
  const content = parts.join("\n---\n").trim();
  const entry = {};

  for (const line of metadataBlock.split(/\r?\n/)) {
    const normalized = line.trim();

    if (!normalized) {
      continue;
    }

    const index = normalized.indexOf(":");

    if (index === -1) {
      continue;
    }

    const key = normalized.slice(0, index).trim();
    const value = normalized.slice(index + 1).trim();

    if (key) {
      entry[key] = value;
    }
  }

  entry.content = content;
  return entry;
}

async function runApplyMode(posts, args) {
  if (!args.input) {
    throw new Error("apply mode requires a JSON file path via --input.");
  }

  const inputPath = path.resolve(ROOT_DIR, args.input);
  const raw = await fsp.readFile(inputPath, "utf8");
  const payload = parseManualApplyPayload(raw);
  const entries = Array.isArray(payload) ? payload : [payload];

  if (!entries.length) {
    throw new Error("apply mode received an empty payload.");
  }

  const postMap = new Map(posts.map((post) => [post.slug, post]));
  const backupUrl = await backupPostsStore(posts);
  console.log(`Created safety backup: ${backupUrl || "backup-uploaded"}`);

  for (const entry of entries) {
    const slug = String(entry.slug || args.only[0] || "").trim();

    if (!slug) {
      throw new Error("Each apply payload entry needs a slug.");
    }

    const post = postMap.get(slug);

    if (!post) {
      throw new Error(`Post not found in live store: ${slug}`);
    }

    const content = entry.content ? normalizeMarkdownContent(entry.content) : post.content;
    const nextCategory = isValidCategory(entry.category) ? String(entry.category).trim() : post.category;
    const sourceLinks = Array.isArray(entry.sourceLinks)
      ? entry.sourceLinks.filter((item) => item?.url)
      : entry.sourceUrl
        ? [
            {
              label: entry.sourceName || post.sourceName || "Source",
              url: entry.sourceUrl
            }
          ]
      : Array.isArray(post.sourceLinks)
        ? post.sourceLinks
        : [];
    const title = trimLength(entry.title || post.title, 140);
    const seoTitle = trimLength(entry.seoTitle || post.seoTitle || title, 160);
    const metaDescription = trimLength(entry.metaDescription || post.metaDescription || post.excerpt, 160);
    const excerpt = trimLength(entry.excerpt || post.excerpt, 260);
    const imageAlt = trimLength(entry.imageAlt || post.imageAlt || title, 180);

    postMap.set(slug, {
      ...post,
      title,
      seoTitle,
      metaDescription,
      excerpt,
      imageAlt,
      category: nextCategory,
      regionFocus: defaultRegionFocus(nextCategory, entry.regionFocus || post.regionFocus || ""),
      coverStyle: getCoverStyle(nextCategory),
      sourceName: entry.sourceName || post.sourceName || "",
      sourceUrl: entry.sourceUrl || post.sourceUrl || "",
      sourceLinks,
      content,
      readTime: estimateReadTime(content),
      updatedAt: new Date().toISOString()
    });

    console.log(`Prepared live update for ${slug}.`);
  }

  const updatedPosts = posts.map((post) => postMap.get(post.slug) || post);
  await writePostsStore(updatedPosts);
  console.log(`Applied ${entries.length} manual live update${entries.length === 1 ? "" : "s"}.`);
}

async function main() {
  assertEnv("CLOUDINARY_CLOUD_NAME");
  assertEnv("CLOUDINARY_API_KEY");
  assertEnv("CLOUDINARY_API_SECRET");

  const args = parseArgs(process.argv.slice(2));
  const posts = await getLivePosts();

  if (args.mode === "rewrite") {
    await runRewriteMode(posts, args);
    return;
  }

  if (args.mode === "show") {
    await runShowMode(posts, args);
    return;
  }

  if (args.mode === "apply") {
    await runApplyMode(posts, args);
    return;
  }

  await runAuditMode(posts);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
