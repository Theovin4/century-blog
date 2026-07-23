import { getCategoryMeta, normalizeMarkdownContent } from "@/lib/site";

const PEXELS_API_KEY = process.env.PEXELS_API_KEY || "";
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY || "";
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

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sanitizeAltText(value) {
  return String(value || "")
    .replace(/[\r\n]+/g, " ")
    .replace(/\]/g, "")
    .trim();
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Image provider request failed with status ${response.status}`);
  }

  return response.json();
}

async function searchPexelsImage(query) {
  if (!PEXELS_API_KEY) {
    return null;
  }

  const payload = await fetchJson(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1`, {
    headers: {
      Authorization: PEXELS_API_KEY
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

async function searchUnsplashImage(query) {
  if (!UNSPLASH_ACCESS_KEY) {
    return null;
  }

  const payload = await fetchJson(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape&client_id=${UNSPLASH_ACCESS_KEY}`);
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

export function hasInlineArticleImage(content) {
  const text = String(content || "");
  return /!\[[^\]]*]\((?:https?:\/\/|\/)[^)]+\)/i.test(text) || /<img\b[^>]*src=["'](?:https?:\/\/|\/)[^"']+["'][^>]*>/i.test(text);
}

export function buildHeroImageSearchQuery(postLike) {
  return buildHeroImageSearchQueries(postLike)[0] || "";
}

function extractQueryKeywords(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]+/g, " ")
    .split(/\s+/)
    .filter((token) => token && token.length > 2 && !QUERY_STOPWORDS.has(token))
    .slice(0, 8);
}

export function buildHeroImageSearchQueries(postLike) {
  const categoryLabel = getCategoryMeta(postLike?.category).label;
  const regionLabel = String(postLike?.regionFocus || "").toLowerCase() === "nigeria" ? "Nigeria" : "world";
  const keywordString = extractQueryKeywords(postLike?.title).join(" ");
  const excerptKeywordString = extractQueryKeywords(postLike?.excerpt).slice(0, 6).join(" ");
  const queries = [
    [postLike?.title, categoryLabel, regionLabel].filter(Boolean).join(" "),
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

export async function resolveFallbackHeroImage(postLike) {
  const queries = buildHeroImageSearchQueries(postLike);

  for (const query of queries) {
    try {
      const image = (await searchUnsplashImage(query)) || (await searchPexelsImage(query));

      if (image?.mediaUrl) {
        return image;
      }
    } catch {
      // Try the next safer fallback query.
    }
  }

  return null;
}

export function injectInlineSupportImage(content, { url = "", alt = "" } = {}) {
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
