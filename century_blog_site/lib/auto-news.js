import { isPersistentStorageReady } from "@/lib/cloudinary";
import { createAutoPost, getPosts } from "@/lib/posts-store";
import { getAutomationSettings, markAutomationRun } from "@/lib/automation-store";
import { saveAutoDraft } from "@/lib/auto-drafts-store";
import { categoryMeta, isValidCategory, normalizeMarkdownContent, slugify } from "@/lib/site";

const NEWS_API_KEY = process.env.NEWS_API_KEY || "";
const GNEWS_API_KEY = process.env.GNEWS_API_KEY || "";
const PEXELS_API_KEY = process.env.PEXELS_API_KEY || "";
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY || "";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_REWRITE_MODEL = process.env.OPENAI_REWRITE_MODEL || "gpt-5-mini";
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const GROQ_REWRITE_MODEL = process.env.GROQ_REWRITE_MODEL || "openai/gpt-oss-120b";
const AI_REWRITE_PROVIDER = String(
  process.env.AI_REWRITE_PROVIDER || process.env.AUTHORITY_REWRITE_PROVIDER || ""
).trim().toLowerCase();

const NEWS_LOOKBACK_MS = 1000 * 60 * 60 * 72;
const MIN_SOURCE_SCORE = 4;
const MIN_ARTICLE_WORDS = 1250;
const MAX_ARTICLE_WORDS = 1450;
const MAX_REWRITE_ATTEMPTS = 3;
const REQUIRED_HEADINGS = [
  "## Why this story matters",
  "## Context and background",
  "## What happened",
  "## Why it matters now",
  "## Deeper analysis",
  "## What happens next",
  "## Final takeaway"
];
const OPTIONAL_SOURCES_HEADING = "## Sources";
const SECTION_MIN_WORDS = {
  "## Why this story matters": 150,
  "## Context and background": 170,
  "## What happened": 180,
  "## Why it matters now": 150,
  "## Deeper analysis": 240,
  "## What happens next": 130,
  "## Final takeaway": 90
};
const GENERIC_FILLER_PATTERNS = [
  /in today's digital world/i,
  /it is important to note that/i,
  /this article explores/i,
  /delve into/i,
  /in conclusion[, ]/i,
  /without further ado/i
];
const CLICKBAIT_PATTERNS = [
  /\byou won't believe\b/i,
  /\bshocking\b/i,
  /\bbreaks the internet\b/i,
  /\bgoes viral\b/i,
  /\bmust see\b/i
];
const BOILERPLATE_PATTERNS = [
  /what makes this kind of story important is the chain reaction it can create/i,
  /for everyday readers, the practical insight is simple: look for the consequence, not just the noise/i,
  /the clearest takeaway is that .* matters because it combines timing with consequence/i,
  /fast headlines create momentum, but careful reading creates understanding/i,
  /the smartest way to track this story is to watch for confirmed statements/i
];
const SOURCE_TRUNCATION_PATTERNS = [
  /\[\+\d+\s+chars\]/i,
  /\.\.\.\s+rather than treating the update as background noise/i,
  /\.\.\.\s+in fast-moving news cycles/i
];
const WEAK_TITLE_PATTERNS = [
  /\bwhat it means\b/i,
  /\beverything you need to know\b/i,
  /\bfull story\b/i,
  /^\s*why\b/i,
  /\bexplained\b/i
];
const NIGERIA_FALLBACK_QUERY = "Nigeria OR Lagos OR Abuja OR naira OR Super Eagles";
const GLOBAL_FALLBACK_QUERY = "world news OR global economy OR technology OR politics";

function stripHtml(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sentenceCase(value) {
  const text = String(value || "").trim();

  if (!text) {
    return "";
  }

  return text.charAt(0).toUpperCase() + text.slice(1);
}

function mapTopicToCategory(article) {
  const haystack = `${article.title} ${article.description} ${article.sourceName} ${article.section}`.toLowerCase();

  if (/tech|startup|ai|software|cyber|digital|gadget/.test(haystack)) {
    return "tech";
  }

  if (/market|stock|inflation|economy|naira|finance|business|trade|bank/.test(haystack)) {
    return "business";
  }

  if (/music|movie|film|celebrity|artist|actor|showbiz|entertainment/.test(haystack)) {
    return "entertainment";
  }

  if (/health|hospital|disease|wellness|medical|outbreak/.test(haystack)) {
    return "health";
  }

  if (/education|school|student|university|admission|exam|jamb|scholarship/.test(haystack)) {
    return "education";
  }

  if (/lifestyle|fashion|wellness|relationship|travel|culture/.test(haystack)) {
    return "lifestyle";
  }

  if (/nigeria|abuja|lagos|port harcourt|kano|ibadan/.test(haystack) || article.regionFocus === "nigeria") {
    return "nigeria";
  }

  return article.regionFocus === "global" ? "world" : "nigeria";
}

function computeTrendingScore(article) {
  const freshnessHours = Math.max(1, (Date.now() - new Date(article.publishedAt).getTime()) / (1000 * 60 * 60));
  const freshnessScore = Math.max(0, 40 - freshnessHours);
  const nigeriaBoost = article.regionFocus === "nigeria" ? 30 : 10;
  const imageBoost = article.mediaUrl ? 8 : 0;
  return Math.round(freshnessScore + nigeriaBoost + imageBoost);
}

function createExcerpt(article) {
  const hook = sentenceCase(article.description || article.title);
  return hook.length > 220 ? `${hook.slice(0, 217).trim()}...` : hook;
}

function trimToLength(value, maxLength) {
  const text = String(value || "").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 3).trim()}...` : text;
}

function countWords(value) {
  const normalized = normalizeMarkdownContent(value);
  return normalized ? normalized.split(/\s+/).filter(Boolean).length : 0;
}

function sanitizeGeneratedArticleContent(content) {
  return String(content || "")
    .replace(/^\s*!\[[^\]]*]\(https?:\/\/source\.unsplash\.com\/[^)]+\)\s*$/gim, "")
    .replace(/^\s*https?:\/\/source\.unsplash\.com\/\S+\s*$/gim, "")
    .replace(/<img\b[^>]*src=["']https?:\/\/source\.unsplash\.com\/[^"'<>]+["'][^>]*>/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function hasInstructionLeakage(value) {
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
    "return only valid json",
    "strict content rules",
    "current quality issues",
    "revision notes",
    "story angle questions"
  ].some((phrase) => normalized.includes(phrase));
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

function usesWeakTitlePattern(value) {
  const text = String(value || "").trim();
  return WEAK_TITLE_PATTERNS.some((pattern) => pattern.test(text));
}

function isSensitiveAutoCandidate(article, category = "") {
  const haystack = `${article?.title || ""} ${article?.description || ""} ${article?.content || ""}`.toLowerCase();
  const normalizedCategory = String(category || "").trim().toLowerCase();

  return (
    ["nigeria", "world", "business", "health"].includes(normalizedCategory) ||
    /war|crime|court|bail|military|attack|fraud|health|disease|outbreak|ebola|budget|inflation|naira|fuel|tax|election|president|governor|senate|policy|hospital|ceasefire|oil|market|economy|security/i.test(haystack)
  );
}

function extractSentences(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function buildSourceSummary(article) {
  return [
    article.description,
    article.content,
    `${article.sourceName} reported the story on ${new Date(article.publishedAt).toLocaleString("en-NG", {
      day: "numeric",
      month: "short",
      year: "numeric"
    })}.`,
    article.sourceUrl ? `Primary source link: ${article.sourceUrl}` : ""
  ]
    .flatMap((value) => extractSentences(value).slice(0, 2))
    .filter(Boolean)
    .slice(0, 5);
}

function getNigeriaRelevance(article, category) {
  if (article.regionFocus === "nigeria" || category === "nigeria") {
    return "Explain clearly what this means for Nigerians, including everyday impact, public reaction, and any policy, money, education, safety, or lifestyle implications.";
  }

  return "Explain why a Nigerian reader should care, whether through prices, jobs, migration, technology access, education, diplomacy, culture, or wider African relevance.";
}

function getCategoryWritingRule(category) {
  const rules = {
    business: "Focus on money, market impact, pricing, jobs, business confidence, and the practical takeaway for workers or entrepreneurs.",
    tech: "Explain the product, use case, adoption barrier, and why the development matters beyond the announcement itself.",
    health: "Be cautious, clear, and non-sensational. Focus on verified guidance, practical safety information, and what readers should or should not do.",
    nigeria: "Ground the article in local context, everyday implications, and why the issue matters now for people in Nigeria.",
    world: "Explain the global development clearly, then connect it to why a Nigerian reader should care right now.",
    education: "Emphasise students, schools, deadlines, opportunities, and the practical consequences of the update.",
    entertainment: "Focus on the cultural angle, audience reaction, career significance, and why the story has momentum.",
    lifestyle: "Make the piece useful and relatable, with clear real-life application instead of vague inspiration.",
    "daily-gist": "Keep the writing lively but still useful, contextual, and specific. Avoid empty buzz or gossip-style filler."
  };

  return rules[category] || rules.nigeria;
}

function scoreSourceArticle(article) {
  let score = 0;
  const reasons = [];
  const description = String(article.description || "").trim();
  const content = String(article.content || "").trim();
  const title = String(article.title || "").trim();

  if (title.length >= 30 && !CLICKBAIT_PATTERNS.some((pattern) => pattern.test(title))) {
    score += 1;
  } else {
    reasons.push("weak-title");
  }

  if (description.length >= 120) {
    score += 2;
  } else {
    reasons.push("thin-description");
  }

  if (content.length >= 220) {
    score += 2;
  } else {
    reasons.push("thin-source-content");
  }

  if (article.regionFocus === "nigeria") {
    score += 1;
  }

  if (article.sourceUrl) {
    score += 1;
  } else {
    reasons.push("missing-source-url");
  }

  if (article.mediaUrl) {
    score += 1;
  }

  return { score, reasons };
}

function tokenSet(value = "") {
  return new Set(slugify(value).split("-").filter((item) => item.length >= 4));
}

function titleSimilarity(left = "", right = "") {
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

function buildRelatedLinks(article, posts = [], max = 3) {
  const currentTitle = String(article?.title || "").trim();

  return posts
    .filter((post) => String(post?.workflowStatus || "published") === "published")
    .filter((post) => String(post?.title || "").trim() && String(post?.title || "").trim() !== currentTitle)
    .map((post) => ({
      title: post.title,
      href: `/news/${post.slug}`,
      score:
        (post.category === mapTopicToCategory(article) ? 0.6 : 0) +
        titleSimilarity(post.title, currentTitle) +
        ((post.type || "manual") === "manual" ? 0.15 : 0)
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, max)
    .map((item) => ({
      title: item.title,
      href: item.href
    }));
}

function deriveImageSearchQuery(article, candidate) {
  const category = candidate?.category || mapTopicToCategory(article);
  const titleTokens = slugify(candidate?.title || article.title || "")
    .split("-")
    .filter((token) => token.length > 3)
    .slice(0, 4);
  const fallback = `${article.title} ${article.regionFocus === "nigeria" ? "Nigeria" : "Africa"}`;

  if (/champions league|premier league|football|match|stadium|goal/i.test(article.title)) {
    return `${titleTokens.slice(0, 2).join(" ")} football stadium`.trim();
  }

  if (category === "business") {
    return `${titleTokens.slice(0, 3).join(" ")} market africa`.trim() || fallback;
  }

  if (category === "tech") {
    return `${titleTokens.slice(0, 3).join(" ")} technology africa`.trim() || fallback;
  }

  if (category === "health") {
    return `${titleTokens.slice(0, 3).join(" ")} healthcare africa`.trim() || fallback;
  }

  return titleTokens.length ? `${titleTokens.join(" ")} ${article.regionFocus === "nigeria" ? "Nigeria" : "Africa"}` : fallback;
}

function buildTargetAudience(article) {
  return article.regionFocus === "nigeria"
    ? "Nigerians, students, workers, entrepreneurs, and everyday readers"
    : "General news readers, professionals, students, and internationally aware audiences";
}

function buildPrimaryKeyword(article) {
  return trimToLength(article.title || "", 90);
}

function buildSecondaryKeywords(article, category) {
  return [
    `${category} news`,
    article.regionFocus === "nigeria" ? "Nigeria news" : "world news",
    article.sourceCountry || "",
    article.sourceName || "",
    article.section || ""
  ].filter(Boolean);
}

function buildArticleContent(article) {
  const title = article.title;
  const sourceName = article.sourceName || "international wires";
  const description = stripHtml(article.description || article.content || article.title);
  const context = stripHtml(article.content || article.description || article.title);
  const nigeriaImpactLine = article.regionFocus === "nigeria"
    ? "For readers in Nigeria, the immediate question is how the development could affect public life, daily choices, institutional trust, or the direction of policy and conversation."
    : "For readers in Nigeria, the useful angle is how an international development like this could affect prices, jobs, travel, technology access, diplomacy, culture, or public debate.";
  const whatNextLine = article.regionFocus === "nigeria"
    ? "That usually means watching how officials respond, how quickly facts become clearer, and whether the issue begins to influence everyday decisions for households, workers, students, businesses, or communities."
    : "That usually means watching whether the story stays external or starts to shape local decisions through markets, migration, consumer costs, energy, security, or wider regional implications.";
  const sourceSection = article.sourceUrl
    ? [
        "",
        OPTIONAL_SOURCES_HEADING,
        "",
        `- [${sourceName}](${article.sourceUrl})`
      ]
    : [];

  return [
    "## Why this story matters",
    "",
    `${title} matters because it is not only a headline about a single event. It is part of a wider chain of consequences that readers are likely to feel through public discussion, market behaviour, social reaction, institutional response, or practical day-to-day decision-making.`,
    "",
    `${description} ${nigeriaImpactLine}`,
    "",
    "## Context and background",
    "",
    `${context} The first version of a breaking story often carries the biggest emotional force, but it rarely carries the full explanation. The background usually reveals whether the development is part of a longer pattern, a one-off disruption, or a sign of deeper pressure building underneath the surface.`,
    "",
    `That context is especially useful when the issue touches politics, business, education, health, technology, or security, because those are the stories where timing alone does not explain why readers should care. Background turns a fast update into something people can actually understand.`,
    "",
    "## What happened",
    "",
    `According to reporting from ${sourceName}, the core development is that ${description.charAt(0).toLowerCase()}${description.slice(1)}. That basic summary is useful, but it only answers the first question. Readers also need clarity on what changed, who moved first, what evidence is already public, and what still depends on confirmation or follow-up reporting.`,
    "",
    `In stories like this, the difference between noise and useful reporting often comes down to sequence. What happened first, what reaction followed, and what remains unresolved are usually the details that shape how seriously the public takes the story.`,
    "",
    `That is why a clear timeline matters. A single update can sound dramatic at first, but its real meaning becomes sharper when readers can see whether the development is escalating, stabilising, or already prompting formal response from the people involved.`,
    "",
    "## Why it matters now",
    "",
    `This matters now because timing changes impact. A business development can shape pricing and confidence. A political or legal development can shift public trust. A health story can influence caution and behaviour. A technology or education story can alter opportunity, access, and expectation very quickly once people believe the change is real.`,
    "",
    `${whatNextLine}`,
    "",
    "## Deeper analysis",
    "",
    `The deeper issue is usually not the headline alone, but the pressure around it. Readers should ask whether the development points to a structural problem, a temporary disruption, or a turning point. That question matters because stories with real staying power tend to reveal weakness or change in systems, not just drama in a single moment.`,
    "",
    `For Nigerian readers, analysis becomes useful when it moves from summary to consequence. Does this affect costs, jobs, schools, health decisions, investor confidence, civic trust, or social behaviour? Does it point to a wider regional pattern? Does it expose a gap between public messaging and lived reality? Those are the questions that give the story weight.`,
    "",
    `This is also the point where credibility matters most. Readers are better served by cautious interpretation than exaggerated certainty. Where details are still developing, it is more honest to note what is known, what is disputed, and what must still be confirmed by official statements or clearer evidence.`,
    "",
    "## What happens next",
    "",
    `The next stage of the story will likely be shaped by verification, response, and fallout. Readers should watch for updated statements, confirmed figures, policy moves, institutional reaction, market response, or public pressure depending on the category of the story. Those follow-up signals usually tell us whether the development is fading or becoming more serious.`,
    "",
    `The strongest follow-up reporting will not just repeat the original headline. It will show what changed after the attention arrived. That is where readers usually find the most useful insight.`,
    "",
    "## Final takeaway",
    "",
    `${title} is worth following closely because the real value of the story lies in what it changes for readers, institutions, or wider public life. The headline may pull attention first, but the consequence is what gives it lasting meaning.`,
    ...sourceSection
  ].join("\n");
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error(`Failed request: ${response.status} ${url}`);
  }

  return response.json();
}

async function fetchJsonSafe(url, options = {}) {
  try {
    const payload = await fetchJson(url, options);
    return { ok: true, payload, error: "" };
  } catch (error) {
    return {
      ok: false,
      payload: null,
      error: error?.message || "Request failed"
    };
  }
}

function isFreshEnough(article) {
  const publishedAt = new Date(article.publishedAt).getTime();

  if (!publishedAt || Number.isNaN(publishedAt)) {
    return false;
  }

  return Date.now() - publishedAt <= NEWS_LOOKBACK_MS;
}

function normalizeNewsApiArticle(article, regionFocus) {
  const publishedAt = article.publishedAt || new Date().toISOString();
  return {
    title: String(article.title || "").trim(),
    description: String(article.description || article.content || "").trim(),
    content: stripHtml(article.content || article.description || ""),
    sourceName: String(article.source?.name || "NewsAPI").trim(),
    sourceUrl: String(article.url || "").trim(),
    autoSourceId: String(article.url || article.title || "").trim(),
    autoProvider: "newsapi",
    sourceCountry: regionFocus === "nigeria" ? "Nigeria" : "Global",
    regionFocus,
    mediaUrl: String(article.urlToImage || "").trim(),
    mediaType: "image/jpeg",
    publishedAt,
    section: "general"
  };
}

function normalizeGNewsArticle(article, regionFocus) {
  const publishedAt = article.publishedAt || new Date().toISOString();
  return {
    title: String(article.title || "").trim(),
    description: String(article.description || article.content || "").trim(),
    content: stripHtml(article.content || article.description || ""),
    sourceName: String(article.source?.name || "GNews").trim(),
    sourceUrl: String(article.url || "").trim(),
    autoSourceId: String(article.url || article.title || "").trim(),
    autoProvider: "gnews",
    sourceCountry: regionFocus === "nigeria" ? "Nigeria" : "Global",
    regionFocus,
    mediaUrl: String(article.image || "").trim(),
    mediaType: "image/jpeg",
    publishedAt,
    section: "general"
  };
}

async function fetchNewsApiStories(regionFocus) {
  if (!NEWS_API_KEY) {
    return { articles: [], diagnostics: { provider: "newsapi", regionFocus, enabled: false, requests: [] } };
  }

  const requests = [];
  const endpoints = regionFocus === "nigeria"
    ? [
        `https://newsapi.org/v2/top-headlines?country=ng&language=en&pageSize=12&apiKey=${NEWS_API_KEY}`,
        `https://newsapi.org/v2/everything?q=${encodeURIComponent(NIGERIA_FALLBACK_QUERY)}&language=en&sortBy=publishedAt&pageSize=12&apiKey=${NEWS_API_KEY}`
      ]
    : [
        `https://newsapi.org/v2/top-headlines?language=en&pageSize=12&apiKey=${NEWS_API_KEY}`,
        `https://newsapi.org/v2/everything?q=${encodeURIComponent(GLOBAL_FALLBACK_QUERY)}&language=en&sortBy=publishedAt&pageSize=12&apiKey=${NEWS_API_KEY}`
      ];

  const articles = [];

  for (const endpoint of endpoints) {
    const result = await fetchJsonSafe(endpoint);
    requests.push({
      endpoint,
      ok: result.ok,
      count: result.ok ? Number(result.payload?.articles?.length || 0) : 0,
      error: result.ok ? "" : result.error
    });

    if (result.ok) {
      articles.push(...(result.payload?.articles || []).map((article) => normalizeNewsApiArticle(article, regionFocus)));
    }
  }

  return {
    articles,
    diagnostics: {
      provider: "newsapi",
      regionFocus,
      enabled: true,
      requests
    }
  };
}

async function fetchGNewsStories(regionFocus) {
  if (!GNEWS_API_KEY) {
    return { articles: [], diagnostics: { provider: "gnews", regionFocus, enabled: false, requests: [] } };
  }

  const requests = [];
  const endpoints = regionFocus === "nigeria"
    ? [
        `https://gnews.io/api/v4/top-headlines?country=ng&lang=en&max=10&apikey=${GNEWS_API_KEY}`,
        `https://gnews.io/api/v4/search?q=${encodeURIComponent(NIGERIA_FALLBACK_QUERY)}&lang=en&max=10&sortby=publishedAt&apikey=${GNEWS_API_KEY}`
      ]
    : [
        `https://gnews.io/api/v4/top-headlines?lang=en&max=10&apikey=${GNEWS_API_KEY}`,
        `https://gnews.io/api/v4/search?q=${encodeURIComponent(GLOBAL_FALLBACK_QUERY)}&lang=en&max=10&sortby=publishedAt&apikey=${GNEWS_API_KEY}`
      ];

  const articles = [];

  for (const endpoint of endpoints) {
    const result = await fetchJsonSafe(endpoint);
    requests.push({
      endpoint,
      ok: result.ok,
      count: result.ok ? Number(result.payload?.articles?.length || 0) : 0,
      error: result.ok ? "" : result.error
    });

    if (result.ok) {
      articles.push(...(result.payload?.articles || []).map((article) => normalizeGNewsArticle(article, regionFocus)));
    }
  }

  return {
    articles,
    diagnostics: {
      provider: "gnews",
      regionFocus,
      enabled: true,
      requests
    }
  };
}

function dedupeArticles(articles) {
  const seen = new Set();

  return articles.filter((article) => {
    const key = article.sourceUrl || slugify(article.title);

    if (!article.title || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return isFreshEnough(article);
  });
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

async function resolveImage(article, preferredQuery = "") {
  if (article.mediaUrl) {
    return {
      mediaUrl: article.mediaUrl,
      imageCreditName: article.sourceName,
      imageCreditUrl: article.sourceUrl
    };
  }

  const searchQuery = String(preferredQuery || "").trim() || `${article.title} ${article.regionFocus === "nigeria" ? "Nigeria" : "world"}`;
  return (await searchPexelsImage(searchQuery)) || (await searchUnsplashImage(searchQuery)) || {
    mediaUrl: "",
    imageCreditName: "",
    imageCreditUrl: ""
  };
}

function chooseArticles(nigeriaArticles, globalArticles, settings) {
  const maxPostsPerRun = Math.max(1, Number(settings.maxPostsPerRun || 2));
  const nigeriaTarget = Math.max(1, Math.round(maxPostsPerRun * Number(settings.nigeriaShareTarget || 0.7)));
  const globalTarget = Math.max(0, maxPostsPerRun - nigeriaTarget);

  const pickedNigeria = nigeriaArticles.slice(0, nigeriaTarget);
  const pickedGlobal = globalArticles.slice(0, globalTarget);
  const combined = [...pickedNigeria, ...pickedGlobal];

  if (combined.length < maxPostsPerRun) {
    const extra = [...nigeriaArticles.slice(nigeriaTarget), ...globalArticles.slice(globalTarget)]
      .slice(0, maxPostsPerRun - combined.length);
    return [...combined, ...extra];
  }

  return combined;
}

function withSourceFallback(filteredArticles, allArticles) {
  if (filteredArticles.length) {
    return filteredArticles;
  }

  return allArticles.slice(0, Math.max(1, Math.min(3, allArticles.length)));
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
    throw new Error("AI rewrite did not return JSON.");
  }

  return JSON.parse(text.slice(start, end + 1));
}

function getAiRewriteProvider() {
  if (AI_REWRITE_PROVIDER === "groq" && GROQ_API_KEY) {
    return "groq";
  }

  if (AI_REWRITE_PROVIDER === "openai" && OPENAI_API_KEY) {
    return "openai";
  }

  if (GROQ_API_KEY) {
    return "groq";
  }

  if (OPENAI_API_KEY) {
    return "openai";
  }

  return "";
}

function isOpenAiRewriteEnabled() {
  return Boolean(getAiRewriteProvider());
}

function buildRewriteJsonSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["title", "seoTitle", "metaDescription", "excerpt", "content", "category", "author", "unsplashImages"],
    properties: {
      title: { type: "string" },
      seoTitle: { type: "string" },
      metaDescription: { type: "string" },
      excerpt: { type: "string" },
      content: { type: "string" },
      category: {
        type: "string",
        enum: ["nigeria", "world", "business", "tech", "entertainment", "health", "lifestyle", "education", "daily-gist"]
      },
      author: { type: "string" },
      unsplashImages: {
        type: "object",
        additionalProperties: false,
        required: ["featuredImage", "supportingImage1", "supportingImage2", "supportingImage3"],
        properties: {
          featuredImage: {
            type: "object",
            additionalProperties: false,
            required: ["searchQuery", "altText", "filename", "placement"],
            properties: {
              searchQuery: { type: "string" },
              altText: { type: "string" },
              filename: { type: "string" },
              placement: { type: "string" }
            }
          },
          supportingImage1: {
            type: "object",
            additionalProperties: false,
            required: ["searchQuery", "altText", "filename", "placement"],
            properties: {
              searchQuery: { type: "string" },
              altText: { type: "string" },
              filename: { type: "string" },
              placement: { type: "string" }
            }
          },
          supportingImage2: {
            type: "object",
            additionalProperties: false,
            required: ["searchQuery", "altText", "filename", "placement"],
            properties: {
              searchQuery: { type: "string" },
              altText: { type: "string" },
              filename: { type: "string" },
              placement: { type: "string" }
            }
          },
          supportingImage3: {
            type: "object",
            additionalProperties: false,
            required: ["searchQuery", "altText", "filename", "placement"],
            properties: {
              searchQuery: { type: "string" },
              altText: { type: "string" },
              filename: { type: "string" },
              placement: { type: "string" }
            }
          }
        }
      }
    }
  };
}

function getAiRewriteConfig() {
  const provider = getAiRewriteProvider();

  if (provider === "groq") {
    return {
      provider,
      endpoint: "https://api.groq.com/openai/v1/responses",
      apiKey: GROQ_API_KEY,
      model: GROQ_REWRITE_MODEL
    };
  }

  if (provider === "openai") {
    return {
      provider,
      endpoint: "https://api.openai.com/v1/responses",
      apiKey: OPENAI_API_KEY,
      model: OPENAI_REWRITE_MODEL
    };
  }

  return null;
}

function createAiRewriteMeta({
  attempted = false,
  provider = "",
  model = "",
  status = "idle",
  succeeded = false,
  failedAttempts = 0,
  error = ""
} = {}) {
  return {
    attempted,
    provider,
    model,
    status,
    succeeded,
    failedAttempts,
    error
  };
}

function appendQualityReason(qualityReport, reason, { blocking = false } = {}) {
  const nextReport = {
    ...qualityReport,
    reasons: Array.isArray(qualityReport?.reasons) ? [...qualityReport.reasons] : [],
    blockingReasons: Array.isArray(qualityReport?.blockingReasons) ? [...qualityReport.blockingReasons] : []
  };

  if (reason && !nextReport.reasons.includes(reason)) {
    nextReport.reasons.push(reason);
  }

  if (blocking && reason && !nextReport.blockingReasons.includes(reason)) {
    nextReport.blockingReasons.push(reason);
  }

  nextReport.passed = nextReport.blockingReasons.length === 0 && Boolean(nextReport.passed);
  return nextReport;
}

function findRepeatedPhrase(content) {
  const repeatedSentenceMap = new Map();
  const repeatedParagraphMap = new Map();
  const normalized = normalizeMarkdownContent(content);

  const sentences = normalized
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.replace(/\s+/g, " ").trim().toLowerCase())
    .filter((sentence) => sentence.length >= 70);

  for (const sentence of sentences) {
    const count = (repeatedSentenceMap.get(sentence) || 0) + 1;
    repeatedSentenceMap.set(sentence, count);

    if (count >= 2) {
      return sentence;
    }
  }

  const paragraphs = normalized
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim().toLowerCase())
    .filter((paragraph) => paragraph.length >= 140 && !paragraph.startsWith("## "));

  for (const paragraph of paragraphs) {
    const count = (repeatedParagraphMap.get(paragraph) || 0) + 1;
    repeatedParagraphMap.set(paragraph, count);

    if (count >= 2) {
      return paragraph;
    }
  }

  return "";
}

function getSectionContent(content, heading) {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`${escapedHeading}\\s*([\\s\\S]*?)(?=\\n## |$)`, "i");
  const match = String(content || "").match(pattern);
  return String(match?.[1] || "").trim();
}

function hasVisibleSourceSection(content) {
  const sources = getSectionContent(content, OPTIONAL_SOURCES_HEADING);
  return Boolean(
    sources &&
    (/\[[^\]]+]\(https?:\/\/[^)]+\)/i.test(sources) || /https?:\/\/\S+/i.test(sources))
  );
}

function extractNumericClaims(value) {
  return new Set(
    String(value || "")
      .match(/(?:[$£€₦]\s*)?\d[\d,]*(?:\.\d+)?(?:\s?(?:%|percent|billion|million|trillion|bn|m|k))?/gi) || []
      .map((item) => item.replace(/\s+/g, " ").trim().toLowerCase())
      .filter(Boolean)
  );
}

function getUnexpectedNumericClaims(article, candidateContent) {
  const sourceClaims = extractNumericClaims(
    [article?.title, article?.description, article?.content, article?.sourceName].filter(Boolean).join(" ")
  );
  const candidateClaims = [...extractNumericClaims(candidateContent)];
  return candidateClaims.filter((claim) => !sourceClaims.has(claim));
}

function evaluateCandidateQuality(article, candidate) {
  const content = String(candidate?.content || "").trim();
  const wordCount = countWords(content);
  const title = trimToLength(candidate?.title || "", 140);
  const seoTitle = trimToLength(candidate?.seoTitle || title, 160);
  const excerpt = trimToLength(candidate?.excerpt || "", 280);
  const metaDescription = trimToLength(candidate?.metaDescription || excerpt, 160);
  const reasons = [];
  const blockingReasons = [];
  let score = 10;

  if (!content) {
    reasons.push("missing-content");
    blockingReasons.push("missing-content");
    return { passed: false, score: 0, reasons, blockingReasons, wordCount };
  }

  for (const heading of REQUIRED_HEADINGS) {
    if (!content.includes(heading)) {
      const reason = `missing-heading:${heading.replace("## ", "")}`;
      reasons.push(reason);
      blockingReasons.push(reason);
      score -= 2;
    }
  }

  if (wordCount < MIN_ARTICLE_WORDS) {
    reasons.push("too-short");
    blockingReasons.push("too-short");
    score -= 3;
  }

  if (wordCount > MAX_ARTICLE_WORDS) {
    reasons.push("too-long");
    blockingReasons.push("too-long");
    score -= 2;
  }

  if (usesWeakTitlePattern(title)) {
    reasons.push("weak-title-pattern");
    blockingReasons.push("weak-title-pattern");
    score -= 2;
  }

  if (usesWeakTitlePattern(seoTitle)) {
    reasons.push("weak-seo-title-pattern");
    blockingReasons.push("weak-seo-title-pattern");
    score -= 2;
  }

  if (hasInstructionLeakage(title)) {
    reasons.push("title-instruction-leakage");
    blockingReasons.push("title-instruction-leakage");
    score -= 3;
  }

  if (hasInstructionLeakage(seoTitle)) {
    reasons.push("seotitle-instruction-leakage");
    blockingReasons.push("seotitle-instruction-leakage");
    score -= 2;
  }

  if (hasInstructionLeakage(metaDescription)) {
    reasons.push("meta-instruction-leakage");
    blockingReasons.push("meta-instruction-leakage");
    score -= 2;
  }

  if (hasInstructionLeakage(excerpt)) {
    reasons.push("excerpt-instruction-leakage");
    blockingReasons.push("excerpt-instruction-leakage");
    score -= 2;
  }

  const repeatedPhrase = findRepeatedPhrase(content);

  if (repeatedPhrase) {
    reasons.push("repeated-phrases");
    blockingReasons.push("repeated-phrases");
    score -= 2;
  }

  if (GENERIC_FILLER_PATTERNS.some((pattern) => pattern.test(content))) {
    reasons.push("generic-filler");
    blockingReasons.push("generic-filler");
    score -= 2;
  }

  if (BOILERPLATE_PATTERNS.some((pattern) => pattern.test(content))) {
    reasons.push("template-boilerplate");
    blockingReasons.push("template-boilerplate");
    score -= 3;
  }

  if (SOURCE_TRUNCATION_PATTERNS.some((pattern) => pattern.test(content))) {
    reasons.push("truncated-source-copy");
    blockingReasons.push("truncated-source-copy");
    score -= 3;
  }

  const whyThisStoryMatters = getSectionContent(content, "## Why this story matters");
  const contextAndBackground = getSectionContent(content, "## Context and background");
  const whatHappened = getSectionContent(content, "## What happened");
  const whyItMattersNow = getSectionContent(content, "## Why it matters now");
  const deeperAnalysis = getSectionContent(content, "## Deeper analysis");
  const whatHappensNext = getSectionContent(content, "## What happens next");
  const finalTakeaway = getSectionContent(content, "## Final takeaway");

  if (countWords(whyThisStoryMatters) < SECTION_MIN_WORDS["## Why this story matters"]) {
    reasons.push("weak-opening-section");
    blockingReasons.push("weak-opening-section");
    score -= 2;
  }

  if (countWords(contextAndBackground) < SECTION_MIN_WORDS["## Context and background"]) {
    reasons.push("thin-context-section");
    blockingReasons.push("thin-context-section");
    score -= 2;
  }

  if (countWords(whatHappened) < SECTION_MIN_WORDS["## What happened"]) {
    reasons.push("thin-what-happened");
    blockingReasons.push("thin-what-happened");
    score -= 2;
  }

  if (countWords(whyItMattersNow) < SECTION_MIN_WORDS["## Why it matters now"]) {
    reasons.push("thin-why-it-matters-now");
    blockingReasons.push("thin-why-it-matters-now");
    score -= 2;
  }

  if (countWords(deeperAnalysis) < SECTION_MIN_WORDS["## Deeper analysis"]) {
    reasons.push("thin-analysis");
    blockingReasons.push("thin-analysis");
    score -= 2;
  }

  if (countWords(whatHappensNext) < SECTION_MIN_WORDS["## What happens next"]) {
    reasons.push("thin-what-happens-next");
    blockingReasons.push("thin-what-happens-next");
    score -= 2;
  }

  if (countWords(finalTakeaway) < SECTION_MIN_WORDS["## Final takeaway"]) {
    reasons.push("thin-final-takeaway");
    blockingReasons.push("thin-final-takeaway");
    score -= 2;
  }

  const nigeriaMentioned = /nigeria|nigerian|lagos|abuja|naira|africa|african/i.test(content);

  if (!nigeriaMentioned) {
    reasons.push("missing-local-relevance");
    score -= 1;
  }

  const utilitySignals = /what this means|why it matters|who is affected|watch next|takeaway|practical/i.test(content);

  if (!utilitySignals) {
    reasons.push("weak-reader-utility");
    score -= 1;
  }

  if (title.length < 35) {
    reasons.push("weak-title");
    score -= 1;
  }

  if (seoTitle.length < 45) {
    reasons.push("weak-seo-title");
    score -= 1;
  }

  if (metaDescription.length < 140) {
    reasons.push("weak-meta-description");
    score -= 1;
  }

  if (excerpt.length < 110) {
    reasons.push("weak-excerpt");
    score -= 1;
  }

  if (article?.regionFocus === "nigeria" && !/nigeria|nigerian|lagos|abuja|naira/i.test(content)) {
    reasons.push("missing-nigeria-angle");
    score -= 2;
  }

  if (article?.sourceUrl && !hasVisibleSourceSection(content)) {
    reasons.push("missing-visible-sources");
    score -= 1;

    if (isSensitiveAutoCandidate(article, candidate?.category)) {
      blockingReasons.push("missing-visible-sources");
      score -= 1;
    }
  }

  if (!candidate?.mediaUrl && !candidate?._featuredImageQuery) {
    reasons.push("poor-image-match");
    score -= 0.5;
  }

  const unexpectedNumericClaims = getUnexpectedNumericClaims(article, content);
  const suspiciousUnexpectedClaims = unexpectedNumericClaims.filter((claim) =>
    /[%$£€₦]|percent|billion|million|trillion|\bbn\b|\bm\b|\bk\b/i.test(claim)
  );

  if (suspiciousUnexpectedClaims.length > 0) {
    reasons.push("unsupported-numeric-claims");
    blockingReasons.push("unsupported-numeric-claims");
    score -= 3;
  } else if (unexpectedNumericClaims.length >= 3) {
    reasons.push("too-many-new-numeric-claims");
    blockingReasons.push("too-many-new-numeric-claims");
    score -= 2;
  }

  return {
    passed: blockingReasons.length === 0 && Math.max(0, score) >= 8,
    score: Math.max(0, score),
    reasons,
    blockingReasons,
    wordCount
  };
}

async function generateAiCandidate(article, baseCandidate, { revisionNotes = [], relatedLinks = [] } = {}) {
  if (!isOpenAiRewriteEnabled()) {
    return {
      ...baseCandidate,
      _aiRewriteMeta: createAiRewriteMeta({
        attempted: false,
        status: "disabled"
      })
    };
  }

  const aiConfig = getAiRewriteConfig();
  if (!aiConfig) {
    return {
      ...baseCandidate,
      _aiRewriteMeta: createAiRewriteMeta({
        attempted: false,
        status: "unconfigured"
      })
    };
  }

  const systemPrompt = [
    "GOAL: Generate a high-quality, 100% original, AdSense-approved blog post that delivers real value, strong user experience, and meets Google content quality standards. Content must be written for humans first, SEO second.",
    "ROLE: Act as an expert SEO content writer, journalist, and subject-matter analyst. Produce engaging, authoritative, and insight-driven content suitable for publication.",
    "You must follow the user's latest master prompt in substance while returning only valid JSON for the app.",
    "Return only valid JSON with these keys: title, seoTitle, metaDescription, excerpt, content, category, author, unsplashImages.",
    "STRICT CONTENT RULES: Content must be 100% original. Do not copy or closely paraphrase existing articles. Provide unique insights, meaningful explanations, real-world relevance, and what-this-means value. Add Nigerian or local context where appropriate. Avoid generic or shallow explanations.",
    "The title must be SEO-optimised, human, and specific without clickbait.",
    "The seoTitle must be keyword-rich, clear, and suitable for search results.",
    "The metaDescription must be 150 to 160 characters, compelling, and keyword-aware.",
    "The excerpt must be concise, compelling, and suitable for homepage cards.",
    "The article must be 1250 to 1450 words, written in clear British English, professional, clear, engaging, natural, and never robotic.",
    "Write the article body in Markdown only.",
    "Use this exact article structure: ## Why this story matters, ## Context and background, ## What happened, ## Why it matters now, ## Deeper analysis, ## What happens next, ## Final takeaway.",
    "Treat the section structure as mandatory, not optional. Each section must contain meaningful original reporting or analysis, not one short paragraph.",
    "Aim for these section budgets: Why this story matters 150-210 words, Context and background 170-240 words, What happened 180-240 words, Why it matters now 150-220 words, Deeper analysis 240-320 words, What happens next 130-190 words, Final takeaway 90-130 words.",
    "When a real source URL is provided, add a final ## Sources section with at least one Markdown bullet link using the provided source name and source URL.",
    "Use short paragraphs of 2 to 4 lines max with exactly one blank line between paragraphs.",
    "Use ## for main headings and ### for subheadings where helpful.",
    "Use bold as **text**, italics as *text*, bullet points with -, numbered lists with 1. 2. 3., and never use HTML tags.",
    "Naturally include the primary keyword in the title, seoTitle, meta description, and opening paragraph. Use secondary keywords naturally without keyword stuffing.",
    "Sound like a real expert. Be specific, practical, helpful, and human. Avoid fake statistics, unverifiable claims, AI cliches, fluff, filler, plagiarism, and thin content.",
    "Do not use weak explainer title patterns such as 'what it means', 'why ...', 'everything you need to know', 'full story', or 'explained' in the title or SEO title.",
    "Do not introduce any percentage, revenue number, volume figure, price, date comparison, count, or other numeric claim unless it is clearly supported by the provided source material.",
    "Do not invent social-share counts, workshop announcements, adaptation plans, ratings, critic comparisons, business figures, public reactions, expert commentary, or named examples unless those details are explicitly supported by the provided source material.",
    "If a detail is not confirmed by the source, keep the wording cautious and general instead of filling gaps with confident specifics.",
    "Maintain reader interest throughout with relatable examples and local Nigerian relevance where appropriate.",
    "Reduce news-summary tone. The article must clearly explain context, what happened, why it matters, what this means for readers, and what readers should watch next.",
    "Allowed categories: nigeria, world, business, tech, entertainment, health, lifestyle, education, daily-gist. Prefer nigeria when the story is Nigeria-focused, otherwise choose the best fitting category.",
    "The unsplashImages value must be a JSON object with featuredImage, supportingImage1, supportingImage2, and supportingImage3. Each item must include searchQuery, altText, filename, and placement.",
    "Use short specific image search queries only, prefer realistic editorial imagery, avoid generic terms, and use broader African context when Nigerian visuals are unlikely.",
    "If revision notes are present, expand and repair the current draft instead of restarting from the raw source summary.",
    "Never leak instructions, prompt wording, or editorial notes into the title, seoTitle, metaDescription, or excerpt.",
    "Although the user's public output format is Title, Meta Description, Full Article, and [UNSPLASH_IMAGES], you must map that faithfully into the required JSON fields for the application."
  ].join(" ");

  const primaryKeyword = buildPrimaryKeyword(article);
  const secondaryKeywords = buildSecondaryKeywords(article, baseCandidate.category);

  const userPrompt = JSON.stringify({
    publication: "Century Blog",
    topic: article.title,
    targetAudience: buildTargetAudience(article),
    primaryKeyword,
    secondaryKeywords,
    tone: "Professional, clear, engaging, natural",
    regionPriority: article.regionFocus,
    suggestedCategory: baseCandidate.category,
    sourceName: article.sourceName,
    sourceUrl: article.sourceUrl,
    sourceCountry: article.sourceCountry,
    sensitiveTopic: isSensitiveAutoCandidate(article, baseCandidate.category),
    requiresSourcesSection: Boolean(article.sourceUrl),
    relatedCenturyBlogLinks: relatedLinks,
    categoryWritingRule: getCategoryWritingRule(baseCandidate.category),
    nigeriaRelevance: getNigeriaRelevance(article, baseCandidate.category),
    sourceSummary: buildSourceSummary(article),
    storyAngleQuestions: [
      "Why should readers care right now?",
      "What happened?",
      "Why does it matter now?",
      "What does it mean for readers in Nigeria or globally?",
      "What should readers watch next?"
    ],
    factGuardrails: {
      useOnlySourceBackedSpecifics: true,
      banInventedMetricsAndNamedExamples: true,
      preferCautiousWordingWhenEvidenceIsThin: true
    },
    title: article.title,
    description: article.description,
    sourceContent: article.content,
    currentDraft: baseCandidate.content,
    publishedAt: article.publishedAt,
    revisionNotes
  });

  try {
    const groqFormats =
      aiConfig.provider === "groq" && groqSupportsStructuredRewrite(aiConfig.model)
        ? ["structured", "prompt-json"]
        : aiConfig.provider === "groq"
          ? ["prompt-json"]
          : ["default"];

    let parsed = null;
    let lastGroqError = null;

    for (const formatMode of groqFormats) {
      const requestBody =
        aiConfig.provider === "groq" && formatMode === "structured"
          ? {
              model: aiConfig.model,
              instructions: systemPrompt,
              input: userPrompt,
              reasoning: {
                effort: "low"
              },
              text: {
                format: {
                  type: "json_schema",
                  name: "century_blog_rewrite",
                  strict: true,
                  schema: buildRewriteJsonSchema()
                }
              },
              max_output_tokens: 4200,
              temperature: 0.35
            }
          : aiConfig.provider === "groq"
            ? {
                model: aiConfig.model,
                instructions: `${systemPrompt} Return only a valid JSON object with the keys title, seoTitle, metaDescription, excerpt, content, category, author, and unsplashImages. Do not return markdown fences or commentary outside the JSON object.`,
                input: userPrompt,
                reasoning: {
                  effort: "low"
                },
                max_output_tokens: 4200,
                temperature: 0.35
              }
            : {
                model: aiConfig.model,
                store: false,
                input: [
                  {
                    role: "system",
                    content: [{ type: "input_text", text: systemPrompt }]
                  },
                  {
                    role: "user",
                    content: [{ type: "input_text", text: userPrompt }]
                  }
                ]
              };

      const response = await fetch(aiConfig.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${aiConfig.apiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();

        if (formatMode === "structured" && isGroqStructuredFailure(response.status, errorText)) {
          lastGroqError = new Error(`${aiConfig.provider} rewrite failed with status ${response.status}`);
          console.warn(`[auto-news] ${aiConfig.provider} structured rewrite fallback triggered for ${article.slug || article.title}.`);
          continue;
        }

        throw new Error(`${aiConfig.provider} rewrite failed with status ${response.status}`);
      }

      const payload = await response.json();
      parsed = extractJsonPayload(getResponseText(payload));
      break;
    }

    if (!parsed) {
      throw lastGroqError || new Error(`${aiConfig.provider} rewrite did not return usable content.`);
    }

    const category = isValidCategory(parsed.category) ? parsed.category : baseCandidate.category;
    const featuredImageQuery = String(
      parsed?.unsplashImages?.featuredImage?.searchQuery ||
      parsed?.unsplashImages?.featured_image?.search_query ||
      ""
    ).trim();
    const featuredImageAlt = String(
      parsed?.unsplashImages?.featuredImage?.altText ||
      parsed?.unsplashImages?.featured_image?.alt_text ||
      ""
    ).trim();

    return {
      ...baseCandidate,
      title: trimToLength(parsed.title || baseCandidate.title, 140),
      seoTitle: trimToLength(parsed.seoTitle || parsed.title || baseCandidate.seoTitle || baseCandidate.title, 160),
      metaDescription: trimToLength(parsed.metaDescription || baseCandidate.metaDescription || baseCandidate.excerpt, 160),
      excerpt: trimToLength(parsed.excerpt || parsed.metaDescription || baseCandidate.excerpt, 280),
      content: sanitizeGeneratedArticleContent(String(parsed.content || baseCandidate.content).trim()),
      category,
      author: trimToLength(parsed.author || baseCandidate.author, 80),
      imageAlt: trimToLength(featuredImageAlt || baseCandidate.imageAlt || parsed.title || baseCandidate.title, 180),
      _featuredImageQuery: featuredImageQuery,
      _aiRewriteMeta: createAiRewriteMeta({
        attempted: true,
        provider: aiConfig.provider,
        model: aiConfig.model,
        status: "success",
        succeeded: true
      })
    };
  } catch (error) {
    console.warn(`[auto-news] ${aiConfig.provider} rewrite failed:`, error?.message || error);
    return {
      ...baseCandidate,
      _aiRewriteMeta: createAiRewriteMeta({
        attempted: true,
        provider: aiConfig.provider,
        model: aiConfig.model,
        status: "failed",
        succeeded: false,
        failedAttempts: 1,
        error: String(error?.message || error || "").slice(0, 240)
      })
    };
  }
}

async function reviseCandidateWithAi(article, candidate, qualityReport) {
  if (!isOpenAiRewriteEnabled()) {
    return candidate;
  }

  return generateAiCandidate(article, candidate, {
    revisionNotes: [
      "Repair the article so it fully passes the content requirements before publication.",
      `Current quality issues: ${qualityReport.reasons.join(", ")}.`,
      "Keep the authority structure exact, expand the current draft instead of restarting, and improve originality, usefulness, sourcing visibility, and local relevance without sounding robotic."
    ],
    relatedLinks: candidate?._relatedCenturyBlogLinks || []
  });
}

async function rewriteCandidateWithAi(article, baseCandidate, relatedLinks = []) {
  const initialCandidate = await generateAiCandidate(article, baseCandidate, { relatedLinks });
  let currentCandidate = initialCandidate;
  let qualityReport = evaluateCandidateQuality(article, initialCandidate);
  const rewriteAttempts = [initialCandidate._aiRewriteMeta || createAiRewriteMeta()];

  for (let attempt = 0; attempt < MAX_REWRITE_ATTEMPTS && !qualityReport.passed; attempt += 1) {
    currentCandidate = await reviseCandidateWithAi(article, currentCandidate, qualityReport);
    qualityReport = evaluateCandidateQuality(article, currentCandidate);
    rewriteAttempts.push(currentCandidate._aiRewriteMeta || createAiRewriteMeta());
  }

  const attemptedRuns = rewriteAttempts.filter((item) => item?.attempted);
  const successfulRun = rewriteAttempts.find((item) => item?.succeeded);
  const latestAttempt = rewriteAttempts[rewriteAttempts.length - 1] || createAiRewriteMeta();
  const rewriteMeta = createAiRewriteMeta({
    attempted: attemptedRuns.length > 0,
    provider: successfulRun?.provider || latestAttempt.provider || "",
    model: successfulRun?.model || latestAttempt.model || "",
    status: successfulRun ? "success" : latestAttempt.status || "idle",
    succeeded: Boolean(successfulRun),
    failedAttempts: attemptedRuns.filter((item) => item && item.succeeded === false).length,
    error: successfulRun ? "" : latestAttempt.error || ""
  });

  if (rewriteMeta.attempted && !rewriteMeta.succeeded) {
    qualityReport = appendQualityReason(qualityReport, "rewrite-failed", { blocking: true });
  }

  return {
    ...currentCandidate,
    qualityReport,
    rewriteMeta
  };
}

async function buildCandidate(article) {
  const category = mapTopicToCategory(article);
  const relatedLinks = buildRelatedLinks(article, article._existingPosts || []);

  const baseCandidate = {
    title: article.title,
    seoTitle: article.title,
    metaDescription: createExcerpt(article),
    excerpt: createExcerpt(article),
    content: buildArticleContent(article),
    category,
    author: article.regionFocus === "nigeria" ? "Century Blog Nigeria Desk" : "Century Blog Global Desk",
    type: "auto",
    sourceName: article.sourceName,
    sourceUrl: article.sourceUrl,
    sourceCountry: article.sourceCountry,
    regionFocus: article.regionFocus,
    autoProvider: article.autoProvider,
    autoSourceId: article.autoSourceId,
    trendingScore: computeTrendingScore(article),
    mediaUrl: article.mediaUrl || "",
    imageCreditName: article.mediaUrl ? article.sourceName : "",
    imageCreditUrl: article.mediaUrl ? article.sourceUrl : "",
    mediaType: article.mediaType || "image/jpeg",
    publishedAt: article.publishedAt,
    imageAlt: article.title,
    _relatedCenturyBlogLinks: relatedLinks
  };

  const rewrittenCandidate = await rewriteCandidateWithAi(article, baseCandidate, relatedLinks);
  const imageQuery = rewrittenCandidate._featuredImageQuery || deriveImageSearchQuery(article, rewrittenCandidate);
  const image = await resolveImage(article, imageQuery);
  const qualityReport = rewrittenCandidate.qualityReport || evaluateCandidateQuality(article, rewrittenCandidate);

  return {
    ...rewrittenCandidate,
    content: sanitizeGeneratedArticleContent(rewrittenCandidate.content),
    mediaUrl: image.mediaUrl,
    imageCreditName: image.imageCreditName,
    imageCreditUrl: image.imageCreditUrl,
    qualityReport,
    rewriteMeta: rewrittenCandidate.rewriteMeta || rewrittenCandidate._aiRewriteMeta || createAiRewriteMeta()
  };
}

export async function fetchAutomatedNewsCandidates(settings = null) {
  const activeSettings = settings || await getAutomationSettings();
  const [newsApiNigeria, newsApiGlobal, gNewsNigeria, gNewsGlobal] = await Promise.all([
    fetchNewsApiStories("nigeria").catch(() => ({ articles: [], diagnostics: { provider: "newsapi", regionFocus: "nigeria", enabled: true, requests: [{ ok: false, count: 0, error: "request-failed" }] } })),
    fetchNewsApiStories("global").catch(() => ({ articles: [], diagnostics: { provider: "newsapi", regionFocus: "global", enabled: true, requests: [{ ok: false, count: 0, error: "request-failed" }] } })),
    fetchGNewsStories("nigeria").catch(() => ({ articles: [], diagnostics: { provider: "gnews", regionFocus: "nigeria", enabled: true, requests: [{ ok: false, count: 0, error: "request-failed" }] } })),
    fetchGNewsStories("global").catch(() => ({ articles: [], diagnostics: { provider: "gnews", regionFocus: "global", enabled: true, requests: [{ ok: false, count: 0, error: "request-failed" }] } }))
  ]);

  const diagnostics = [
    newsApiNigeria.diagnostics,
    newsApiGlobal.diagnostics,
    gNewsNigeria.diagnostics,
    gNewsGlobal.diagnostics
  ];

  const nigeriaArticles = dedupeArticles([...newsApiNigeria.articles, ...gNewsNigeria.articles]).sort(
    (left, right) => computeTrendingScore(right) - computeTrendingScore(left)
  );
  const globalArticles = dedupeArticles([...newsApiGlobal.articles, ...gNewsGlobal.articles]).sort(
    (left, right) => computeTrendingScore(right) - computeTrendingScore(left)
  );
  const filteredNigeriaArticles = nigeriaArticles.filter((article) => scoreSourceArticle(article).score >= MIN_SOURCE_SCORE);
  const filteredGlobalArticles = globalArticles.filter((article) => scoreSourceArticle(article).score >= MIN_SOURCE_SCORE);
  const selectedArticles = chooseArticles(
    withSourceFallback(filteredNigeriaArticles, nigeriaArticles),
    withSourceFallback(filteredGlobalArticles, globalArticles),
    activeSettings
  );
  const existingPosts = await getPosts();
  const candidates = await Promise.all(
    selectedArticles.map((article) =>
      buildCandidate({
        ...article,
        _existingPosts: existingPosts
      })
    )
  );

  return {
    candidates,
    diagnostics: {
      providers: diagnostics,
      totals: {
        nigeriaRaw: nigeriaArticles.length,
        globalRaw: globalArticles.length,
        nigeriaQualified: filteredNigeriaArticles.length,
        globalQualified: filteredGlobalArticles.length,
        selected: selectedArticles.length
      }
    }
  };
}

export async function runAutomatedNewsIngestion({ force = false } = {}) {
  const settings = await getAutomationSettings();

  if (!force && !settings.autoPostingEnabled) {
    const skipped = {
      status: "paused",
      message: "Auto posting is paused.",
      publishedCount: 0,
      createdPosts: [],
      skippedPosts: []
    };
    await markAutomationRun(skipped);
    return skipped;
  }

  const candidateResult = await fetchAutomatedNewsCandidates(settings);
  const candidates = candidateResult.candidates;
  const diagnostics = candidateResult.diagnostics;

  if (!candidates.length) {
    const providerFailures = diagnostics.providers
      .flatMap((provider) => provider.requests || [])
      .filter((request) => !request.ok)
      .length;
    const qualifiedCount = Number(diagnostics.totals?.nigeriaQualified || 0) + Number(diagnostics.totals?.globalQualified || 0);
    const empty = {
      status: "idle",
      message: providerFailures
        ? "Automation ran, but the news providers did not return usable stories."
        : qualifiedCount
          ? "Automation found stories, but none were selected for publishing."
          : "Automation ran, but no fresh qualifying articles were available from the configured providers.",
      publishedCount: 0,
      createdPosts: [],
      skippedPosts: [],
      diagnostics
    };
    await markAutomationRun(empty);
    return empty;
  }

  const createdPosts = [];
  const skippedPosts = [];
  const draftedPosts = [];

  for (const candidate of candidates) {
    if (!candidate.qualityReport?.passed) {
      const savedDraft = await saveAutoDraft({
        ...candidate,
        qualityReport: candidate.qualityReport
      });
      draftedPosts.push(savedDraft);
      skippedPosts.push({
        title: candidate.title,
        reason: "drafted-for-review",
        details: candidate.qualityReport?.reasons || []
      });
      continue;
    }

    const result = await createAutoPost(candidate);

    if (result.created) {
      createdPosts.push(result.post);
    } else {
      skippedPosts.push({
        title: candidate.title,
        reason: "duplicate"
      });
    }
  }

  const duplicateCount = skippedPosts.filter((item) => item.reason === "duplicate").length;
  const draftCount = skippedPosts.filter((item) => item.reason === "drafted-for-review").length;

  const summary = {
    status: createdPosts.length ? "success" : "idle",
    message: createdPosts.length
      ? `Published ${createdPosts.length} automated ${createdPosts.length === 1 ? "post" : "posts"}.`
      : `Automation ran, but nothing was published. Duplicates: ${duplicateCount}. Drafted for review: ${draftCount}.`,
    publishedCount: createdPosts.length,
    createdPosts,
    draftedPosts,
    skippedPosts,
    diagnostics
  };

  await markAutomationRun(summary);
  return summary;
}

export function getAutomationProviderSummary() {
  const aiConfig = getAiRewriteConfig();

  return {
    newsApiEnabled: Boolean(NEWS_API_KEY),
    gNewsEnabled: Boolean(GNEWS_API_KEY),
    pexelsEnabled: Boolean(PEXELS_API_KEY),
    unsplashEnabled: Boolean(UNSPLASH_ACCESS_KEY),
    openAiRewriteEnabled: isOpenAiRewriteEnabled(),
    cronSecretEnabled: Boolean(process.env.CRON_SECRET || process.env.AUTO_NEWS_CRON_SECRET),
    storageReady: isPersistentStorageReady(),
    rewriteProvider: aiConfig?.provider || "",
    rewriteModel: aiConfig?.model || "",
    openAiModel: OPENAI_REWRITE_MODEL
  };
}

export function getAutomationCategoryOptions() {
  return Object.entries(categoryMeta).map(([value, meta]) => ({
    value,
    label: meta.label
  }));
}


