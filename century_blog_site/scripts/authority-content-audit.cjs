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

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://centuryblogg.vercel.app";
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

function parseArgs(argv) {
  const args = {
    mode: "audit",
    limit: 0,
    only: [],
    reportOnly: false
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

  if (!parsed.title || !parsed.content) {
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
  } else if (auto && (words < 1100 || titleFlags.length || hasTemplateBoilerplate(post.content) || containsTruncatedArtifact(post.content))) {
    status = "IMPROVE";
    reasons.push("auto-post-needs-authority-rewrite");
  } else if (words < 800) {
    status = "IMPROVE";
    reasons.push("too-thin-for-publication-authority");
  } else if (words < 1000 && (titleFlags.length || isSensitivePost(post) || !hasSource)) {
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

  const response = await fetch(`${resource.secure_url}?t=${Date.now()}`, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Unable to fetch live posts store: ${response.status}`);
  }

  const payload = await response.json();
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
  const content = normalizeMarkdownContent(rewritten.content || "");
  const words = countWords(content);
  const requiredHeadings = [
    "## Why this story matters",
    "## Context and background",
    "## What happened",
    "## Why it matters now",
    "## Deeper analysis",
    "## What happens next",
    "## Final takeaway"
  ];

  for (const heading of requiredHeadings) {
    if (!content.includes(heading)) {
      throw new Error(`Rewrite validation failed for ${post.slug}: missing heading ${heading}`);
    }
  }

  if (words < 1100) {
    throw new Error(`Rewrite validation failed for ${post.slug}: article too short at ${words} words`);
  }

  if (words > 1600) {
    throw new Error(`Rewrite validation failed for ${post.slug}: article too long at ${words} words`);
  }

  if (!rewritten.metaDescription || rewritten.metaDescription.length < 120) {
    throw new Error(`Rewrite validation failed for ${post.slug}: weak meta description`);
  }

  if (!rewritten.excerpt || rewritten.excerpt.length < 90) {
    throw new Error(`Rewrite validation failed for ${post.slug}: weak excerpt`);
  }

  return {
    ...rewritten,
    content,
    wordCount: words
  };
}

async function rewriteWithGroq(post, allPosts) {
  const relatedLinks = buildRelatedLinks(post, allPosts, 3);
  const sourceLinks = Array.isArray(post.sourceLinks)
    ? post.sourceLinks.filter((item) => item?.url).map((item) => `${item.label || "Source"}: ${item.url}`)
    : [];

  const systemPrompt = [
    "You are rewriting a published Century Blog article into a stronger authority-style article for AdSense quality, SEO trust, and reader value.",
    "Return only valid JSON with title, seoTitle, metaDescription, excerpt, imageAlt, and content.",
    "Use clear British English, a human newsroom tone, and preserve factual accuracy.",
    "Do not invent quotes, statistics, interviews, or unverifiable details.",
    "Where facts are uncertain, use cautious phrasing such as 'according to reports' or 'the development suggests'.",
    "The article must be 1200 to 1400 words and written in Markdown.",
    "Use this H2 structure exactly: ## Why this story matters, ## Context and background, ## What happened, ## Why it matters now, ## Deeper analysis, ## What happens next, ## Final takeaway.",
    "Add a short ## Sources section only when real source links are provided.",
    "Keep paragraphs short and readable.",
    "Add 1 to 3 natural internal links using the provided Century Blog URLs where relevant.",
    "Do not change the category or slug.",
    "Do not use clickbait, gossip-heavy framing, or robotic filler.",
    "Make the opening paragraph explain why readers should care and include the main keyword naturally."
  ].join(" ");

  const userPrompt = JSON.stringify({
    publication: "Century Blog",
    slug: post.slug,
    currentTitle: post.title,
    currentExcerpt: post.excerpt,
    currentCategory: post.category,
    currentAuthor: post.author || "Century Blog Editorial Team",
    publishedAt: post.sitePublishedAt || post.publishedAt || post.updatedAt || "",
    sourceName: post.sourceName || "",
    sourceUrl: post.sourceUrl || "",
    sourceLinks,
    heroImageAltCurrent: post.imageAlt || "",
    relatedCenturyBlogLinks: relatedLinks,
    instructions: {
      strengthenAuthority: true,
      preserveFacts: true,
      avoidAIStyle: true,
      explainRealImpact: true,
      useInternalLinks: true
    },
    article: post.content
  });

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

  for (const candidate of candidates) {
    const requestBody =
      candidate.provider === "groq"
        ? {
            model: candidate.model,
            instructions: `${systemPrompt} Return no markdown fences and no extra commentary. Use exactly this plain-text format: TITLE: <title>\\nSEO_TITLE: <seo title>\\nMETA_DESCRIPTION: <meta description>\\nEXCERPT: <excerpt>\\nIMAGE_ALT: <hero image alt text>\\nCONTENT:\\n<full markdown article>.`,
            input: userPrompt
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

    for (let attempt = 1; attempt <= 5; attempt += 1) {
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
        candidate.provider === "groq"
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

      return validateAuthorityRewriteOutput(post, rewritten);
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
    const rewritten = await rewriteWithGroq(post, publishedPosts);
    const updatedPost = {
      ...post,
      title: rewritten.title,
      seoTitle: rewritten.seoTitle,
      metaDescription: rewritten.metaDescription,
      excerpt: rewritten.excerpt,
      imageAlt: rewritten.imageAlt,
      content: rewritten.content,
      readTime: estimateReadTime(rewritten.content),
      updatedAt: new Date().toISOString()
    };

    postMap.set(target.slug, updatedPost);
    rewrittenSlugs.add(target.slug);
    completedSinceCheckpoint += 1;

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
  console.log(`Markdown report: ${report.markdownPath}`);
  console.log(`JSON report: ${report.jsonPath}`);
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

  await runAuditMode(posts);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
