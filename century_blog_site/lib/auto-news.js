import { isPersistentStorageReady } from "@/lib/cloudinary";
import { createAutoPost, findSimilarPost, getAllPosts } from "@/lib/posts-store";
import { getAutomationSettings, markAutomationFailure, markAutomationRun } from "@/lib/automation-store";
import { saveAutoDraft } from "@/lib/auto-drafts-store";
import { evergreenAuthorityTopics } from "@/lib/evergreen-topics";
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
const MIN_ARTICLE_WORDS = 1800;
const MAX_ARTICLE_WORDS = 2200;
const MAX_REWRITE_ATTEMPTS = 3;
const REQUIRED_HEADINGS = [
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
const OPTIONAL_SOURCES_HEADING = "## Sources";
const SECTION_MIN_WORDS = {
  "## Introduction": 100,
  "## Executive summary": 30,
  "## Table of contents": 20,
  "## Why this story matters": 150,
  "## Context and background": 180,
  "## What happened": 180,
  "## Key facts readers should know": 120,
  "## Why this matters for Nigeria": 170,
  "## Wider African and global context": 170,
  "## Expert insight and practical implications": 240,
  "## What readers should watch next": 140,
  "## Frequently asked questions": 260,
  "## Conclusion": 100
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
  /the smartest way to track this story is to watch for confirmed statements/i,
  /Century Blog's job in an evergreen explainer like this is to slow the subject down/i,
  /The issue stays relevant because the same pressure appears again and again/i,
  /Authority is built when readers feel a publication has helped them think more clearly/i,
  /That is where a stronger explainer becomes useful/i,
  /A stronger editorial reading of this subject begins with one discipline/i
];
const EDITORIAL_INSTRUCTION_PATTERNS = [
  /^\s*(?:Explain|Cover|Discuss|Explore|Focus on|Guide readers through|Show how|Tie the piece|Keep the (?:piece|article|advice|tone)|Build a reader-first)\b[^\n]{30,}/im,
  /\b(?:do not invent|return only valid json|revision notes|current quality issues|insert (?:a|the) source|source needed before publication)\b/i,
  /^\s*#{1,3}\s*(?:Subheading|Heading|Section title)\s*$/im
];
const MALFORMED_CONTENT_PATTERNS = [
  /##\s+Subheading/i,
  /\bGa significant amounteeting\b/i,
  /\b(?:lorem ipsum|TBD|TODO|insert here)\b/i,
  /(?:##\s+Conclusion\s*){2,}/i
];
const UNSUPPORTED_AUTHORITY_PATTERNS = [
  /\*\*(?:economic analysts|policy scholars|industry analysts|financial institutions|policy advisers|experts?)\*\*\s+(?:say|note|argue|stress|suggest|believe|warn)/i,
  /\b(?:experts|analysts|researchers|officials) (?:say|believe|warn|suggest|agree|note) that\b/i
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
  /\bexplained\b/i
];
const NIGERIA_FALLBACK_QUERY = "Nigeria OR Lagos OR Abuja OR naira OR Super Eagles";
const GLOBAL_FALLBACK_QUERY = "world news OR global economy OR technology OR politics";
const EVERGREEN_PROVIDER = "evergreen";

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

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function mapSequential(items, mapper) {
  const results = [];

  for (const item of items) {
    results.push(await mapper(item));
  }

  return results;
}

function getRetryDelayFromErrorText(errorText = "", fallbackMs = 12000) {
  const waitMatch = String(errorText || "").match(/try again in\s+([\d.]+)s/i);

  if (waitMatch) {
    return Math.ceil(Number(waitMatch[1]) * 1000) + 2000;
  }

  return fallbackMs;
}

function mapTopicToCategory(article) {
  const haystack = `${article.title} ${article.description} ${article.sourceName} ${article.section}`.toLowerCase();

  if (/football|soccer|champions league|premier league|serie a|la liga|bundesliga|ucl|nba|nfl|afl|hockey|tennis|golf|boxing|ufc|athlete|transfer|match|tournament|world cup|super bowl|olympic|sports?/.test(haystack)) {
    return "sports";
  }

  if (/\bgovernor\b|\bsenate\b|\bminister\b|\bpolice\b|\barrest\b|\bcourt\b|\bcampaign\b|\bassembly\b|\bapc\b|\bpdp\b|\blabour party\b|\btinubu\b|\batiku\b|\bpeter obi\b|\binec\b/.test(haystack) && article.regionFocus === "nigeria") {
    return "nigeria";
  }

  if (/\btech\b|\bstartup\b|\bai\b|artificial intelligence|\bsoftware\b|\bcyber(?:security)?\b|\bdigital\b|\bgadget\b|\bapp\b|\bapps\b|\bdevice\b|\bfintech\b|\bopenai\b|\bgoogle\b|\bmicrosoft\b|\bmeta\b/.test(haystack)) {
    return "tech";
  }

  if (/market|stock|inflation|economy|naira|finance|business|trade|bank|crude|oil|fuel|energy|petrol|diesel|gas/.test(haystack)) {
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

  if (/\btrump\b|\biran\b|\bisrael\b|\bgaza\b|\bukraine\b|\brussia\b|\bchina\b|\beurope\b|\bdiplomac|ceasefire|foreign affairs|global conflict|white house|kremlin/.test(haystack)) {
    return "world";
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

function truncateForPrompt(value, maxLength = 1800) {
  return trimToLength(
    String(value || "")
      .replace(/\s+/g, " ")
      .trim(),
    maxLength
  );
}

function isEvergreenAuthorityArticle(article) {
  return String(article?.autoProvider || "").trim().toLowerCase() === EVERGREEN_PROVIDER;
}

function getEvergreenSourceId(topicId = "") {
  return `${EVERGREEN_PROVIDER}:${String(topicId || "").trim()}`;
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

function containsUnsupportedAttribution(article, content) {
  const sourceMaterial = `${article?.title || ""} ${article?.description || ""} ${article?.content || ""}`;

  return UNSUPPORTED_AUTHORITY_PATTERNS.some((pattern) => (
    pattern.test(content) && !pattern.test(sourceMaterial)
  ));
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
  const evergreenMode = isEvergreenAuthorityArticle(article);
  const sourceSummary = [
    article.description,
    article.content
  ];

  if (!evergreenMode && article.sourceName) {
    sourceSummary.push(`${article.sourceName} reported the story on ${new Date(article.publishedAt).toLocaleString("en-NG", {
      day: "numeric",
      month: "short",
      year: "numeric"
    })}.`);
  }

  if (article.sourceUrl) {
    sourceSummary.push(`Primary source link: ${article.sourceUrl}`);
  }

  return [
    ...sourceSummary
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
    sports: "Focus on the competitive stakes, performance context, fan relevance, and why the result or development matters beyond the headline.",
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

function getCategoryReaderAngle(category) {
  const angles = {
    business: "Business coverage becomes more useful when it explains pressure on prices, jobs, trade, confidence, and everyday financial decisions instead of stopping at the headline.",
    sports: "Sports coverage earns trust when it explains the stakes, the performance context, and why the moment matters to supporters beyond a quick result recap.",
    tech: "Technology coverage is strongest when it separates hype from practical use, shows the adoption barrier clearly, and explains what changes for ordinary users.",
    health: "Health coverage should stay calm, precise, and grounded in verified information that helps readers make safer decisions without panic.",
    nigeria: "Nigeria coverage should connect the update to daily life, public conversation, and the institutions, costs, or choices readers actually care about.",
    world: "World coverage should bring distant developments closer by explaining what changes on the ground and why the story matters to Nigerian readers too.",
    education: "Education coverage matters most when it clarifies deadlines, opportunities, pressure points, and the decisions students, parents, and schools have to make.",
    entertainment: "Entertainment coverage improves when it moves beyond noise and explains cultural significance, career momentum, audience reaction, and industry meaning.",
    lifestyle: "Lifestyle coverage should stay practical, grounded, and genuinely useful for readers trying to improve routines, judgment, or everyday wellbeing.",
    "daily-gist": "Culture and trending coverage should still offer clear context, verification, and reader value instead of drifting into empty hype."
  };

  return angles[category] || angles.nigeria;
}

function getCategoryImpactFocus(category) {
  const focus = {
    business: "costs, business confidence, and money decisions",
    sports: "fan expectations, competitive stakes, and the wider sporting conversation",
    tech: "digital behaviour, adoption, and practical use",
    health: "public understanding, safety, and daily choices",
    nigeria: "public reaction, local relevance, and real-world consequences",
    world: "global context, local relevance, and what Nigerian readers should watch",
    education: "students, families, schools, and practical decision-making",
    entertainment: "audience interest, cultural meaning, and industry implications",
    lifestyle: "daily routines, judgement, and practical life decisions",
    "daily-gist": "public conversation, verification, and cultural relevance"
  };

  return focus[category] || focus.nigeria;
}

function isLowValueSourceArticle(article) {
  const haystack = [
    article?.title,
    article?.description,
    article?.content,
    article?.sourceName,
    article?.sourceUrl
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (!haystack) {
    return false;
  }

  return /request for applications|call for applications|grant opportunity|grant programme|grant program|application deadline|deadline:|open call|call for proposals|submit your application|scholarship application|advertorial|sponsored content|partner content|press release|fundsforngos|prnewswire|businesswire|globenewswire|accesswire/.test(haystack);
}

function scoreSourceArticle(article) {
  let score = 0;
  const reasons = [];
  const description = String(article.description || "").trim();
  const content = String(article.content || "").trim();
  const title = String(article.title || "").trim();

  if (isLowValueSourceArticle(article)) {
    reasons.push("low-value-source-pattern");
    return { score: -10, reasons };
  }

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

function createMarkdownLink({ title, href }) {
  return `[${title}](${href})`;
}

function buildInternalLinkTargets(category, relatedLinks = []) {
  const links = [];
  const seen = new Set();

  function pushLink(title, href) {
    const normalizedHref = String(href || "").trim();

    if (!title || !normalizedHref || seen.has(normalizedHref)) {
      return;
    }

    seen.add(normalizedHref);
    links.push({ title, href: normalizedHref });
  }

  for (const link of relatedLinks) {
    pushLink(link.title, link.href);
  }

  pushLink(`${categoryMeta[category]?.label || "Century Blog"} category`, `/category/${category}`);
  pushLink("Century Blog homepage", "/");
  pushLink("Century Blog archive", "/blog");

  return links.slice(0, 5);
}

function joinMarkdownLinks(links) {
  const rendered = links.map(createMarkdownLink);

  if (rendered.length <= 1) {
    return rendered[0] || "";
  }

  if (rendered.length === 2) {
    return `${rendered[0]} and ${rendered[1]}`;
  }

  return `${rendered.slice(0, -1).join(", ")}, and ${rendered[rendered.length - 1]}`;
}

function cleanSourceBrief(value) {
  return String(value || "")
    .replace(/\[\+\d+\s+chars\]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getAuthorityTitleAngle(category) {
  const angles = {
    business: "Why It Matters for Readers and Businesses",
    sports: "Why It Matters for Fans",
    tech: "What It Means for Everyday Users",
    health: "What Readers Should Know",
    education: "What Students and Families Should Know",
    entertainment: "Why It Matters Now",
    lifestyle: "What Readers Can Learn",
    nigeria: "Why It Matters in Nigeria",
    world: "Why It Matters",
    "daily-gist": "Why It Matters"
  };

  return angles[category] || "Why It Matters";
}

function normalizeAuthorityTitle(title, category = "") {
  const baseTitle = String(title || "")
    .replace(/\s+/g, " ")
    .trim();

  if (!baseTitle) {
    return "";
  }

  const replacement = getAuthorityTitleAngle(category);

  return baseTitle
    .replace(/\s*[:\-]\s*everything you need to know\b/i, `: ${replacement}`)
    .replace(/\s*[:\-]\s*what it means\b/i, `: ${replacement}`)
    .replace(/\s*[:\-]\s*full story\b/i, `: ${replacement}`)
    .replace(/\s*[:\-]\s*explained\b/i, `: ${replacement}`)
    .replace(/\s+explained\b/i, `: ${replacement}`)
    .replace(/\s{2,}/g, " ")
    .trim();
}

function buildAuthoritySeoTitle(article) {
  const category = isValidCategory(article?.category) ? article.category : mapTopicToCategory(article || {});
  const title = trimToLength(normalizeAuthorityTitle(article?.title, category), 120);
  return trimToLength(title.includes("Century Blog") ? title : `${title} | Century Blog`, 160);
}

function buildAuthorityMetaDescription(article, category) {
  const description = sentenceCase(cleanSourceBrief(article?.description || article?.title));
  const impactFocus = getCategoryImpactFocus(category);
  return trimToLength(
    `${description} Century Blog explains the context, ${impactFocus}, and what readers should watch next.`,
    160
  );
}

function buildAuthorityExcerpt(article, category) {
  const description = sentenceCase(cleanSourceBrief(article?.description || article?.title));
  const categoryAngle = getCategoryReaderAngle(category);
  return trimToLength(
    `${description} This Century Blog explainer adds context, the Nigerian angle, and the practical meaning for readers. ${categoryAngle}`,
    280
  );
}

function buildEvergreenAuthorityContent(article, category, relatedLinks = []) {
  const title = article.title;
  const description = stripHtml(article.description || article.content || article.title);
  const context = stripHtml(article.content || article.description || article.title);
  const nigeriaImpactLine = article.regionFocus === "nigeria"
    ? "For readers in Nigeria, the practical question is how this issue shapes daily decisions, family planning, work, study, safety, spending, or long-term confidence."
    : "For readers in Nigeria, the useful test is whether this wider issue changes daily decisions, costs, opportunities, trust, or access in ways that are easy to miss at first glance.";
  const africaImpactLine =
    article.regionFocus === "nigeria"
      ? "The African angle matters because ideas, pressure points, and social habits often travel quickly across borders even when the original issue feels local."
      : "The African angle matters because a global issue rarely stays abstract for long once it touches trade, migration, education, media habits, work, or consumer behaviour across the continent.";
  const categoryAngle = getCategoryReaderAngle(category);
  const introFocusLine =
    "It focuses on the warning signs people miss, the habits that shape outcomes over time, and the practical checks that make better decisions easier when life gets busy.";
  const summaryLine =
    "Readers need a practical guide that moves beyond the headline version of the topic and explains what usually goes wrong, what helps, and what to do next.";
  const nigeriaSummaryLine =
    article.regionFocus === "nigeria"
      ? "For Nigerian readers, the key question is how this issue affects everyday confidence, safety, planning, work, study, or spending."
      : "For Nigerian readers, the useful angle is whether this issue changes daily choices, pressure points, or opportunities in ways that are easy to overlook.";
  const africaSummaryLine =
    article.regionFocus === "nigeria"
      ? "Across Africa, similar social pressures and information habits often mean the same issue appears in slightly different local forms."
      : "Across Africa, the broader lesson is that global shifts often become local realities through prices, attention, work patterns, and public expectations.";
  const coreIssueLine =
    "At the centre of this topic is a repeated pattern: people face a real pressure, move too quickly, and make choices before context has fully caught up with urgency.";
  const faqCoreIssueLine =
    "The core issue is how readers can recognise the pattern earlier, respond more calmly, and make decisions that still make sense after the first wave of pressure passes.";
  const faqNigeriaLine =
    article.regionFocus === "nigeria"
      ? "Readers in Nigeria should care because the issue can shape routine choices around trust, safety, spending, study, work, or household planning."
      : "Readers in Nigeria should care because global issues often become local through cost, access, opportunity, digital behaviour, or public conversation.";
  const faqAfricaLine =
    article.regionFocus === "nigeria"
      ? "Yes. Similar information pressures and behavioural patterns show up across African countries, even when the local details differ."
      : "Yes. The wider African angle matters because global patterns often reshape local realities through technology, trade, migration, and consumer behaviour.";
  const linkTargets = buildInternalLinkTargets(category, relatedLinks);
  const primaryLinks = linkTargets.slice(0, 3);
  const linkedCoverageSentence = primaryLinks.length
    ? `Readers who want a broader Century Blog reading path can continue with ${joinMarkdownLinks(primaryLinks)} for added context and related updates.`
    : "Readers should compare the issue with related coverage, category explainers, and recent reports that show how the same theme appears in daily life.";
  const tocItems = [
    "Why this story matters",
    "Context and background",
    "What happened",
    "Key facts readers should know",
    "Why this matters for Nigeria",
    "Wider African and global context",
    "Expert insight and practical implications",
    "What readers should watch next",
    "Frequently asked questions",
    "Conclusion"
  ];

  return [
    "## Introduction",
    "",
    `${title} matters because it sits at the meeting point between public conversation and practical life. ${introFocusLine} The real value for readers is not only knowing the headline version of the topic, but understanding how it affects decisions people make at home, at work, in school, online, and inside their communities.`,
    "",
    `${nigeriaImpactLine} Century Blog's job in an evergreen explainer like this is to slow the subject down, remove the noise, and give readers a clearer map of what is really going on.`,
    "",
    `That matters because readers rarely encounter issues like this in a calm setting. They often meet them in the middle of busy routines, half-read posts, forwarded messages, pressure from work, or advice from people who sound certain but have not explained the bigger picture properly. A stronger evergreen article should correct that by offering practical clarity, not just a quick reaction.`,
    "",
    "## Executive summary",
    "",
    `- ${summaryLine}`,
    `- ${nigeriaSummaryLine}`,
    `- ${africaSummaryLine}`,
    `- ${categoryAngle}`,
    "- Readers benefit most when they focus on patterns, consequences, and practical choices rather than surface-level chatter.",
    "- Long-term value comes from better judgment, clearer habits, and useful context that still holds up after the headline moment fades.",
    "",
    "## Table of contents",
    "",
    ...tocItems.map((item) => `- ${item}`),
    "",
    "## Why this story matters",
    "",
    `${title} deserves serious attention because people often underestimate how much apparently ordinary issues shape confidence, planning, and long-term outcomes. When readers only meet a topic through fragments, viral posts, or quick summaries, they may miss the pressure building underneath it.`,
    "",
    `That is where a stronger explainer becomes useful. ${summaryLine} Instead of treating the subject as background noise, readers need a fuller account of why it keeps showing up, who feels the effect first, and why the consequences often reach further than the original headline suggests.`,
    "",
    `The other reason this topic matters is trust. When readers feel confused, rushed, or overloaded, they are more likely to act on weak assumptions. That can lead to wasted money, damaged confidence, avoidable stress, poor planning, or a simple failure to notice what matters most. Clear editorial work reduces that risk by giving readers a framework they can return to even after the immediate conversation changes.`,
    "",
    "## Context and background",
    "",
    `${context} The background matters because evergreen subjects usually sit inside routines, habits, systems, and expectations that have been building for a long time. A reader who understands the pattern can respond better than a reader who only reacts to the loudest moment.`,
    "",
    `In editorial terms, this topic belongs to a wider conversation about trust, judgment, and everyday resilience. ${categoryAngle} Once that wider frame is visible, the article becomes more than a summary and starts doing the work a strong publication should do.`,
    "",
    "### Why this issue keeps returning",
    "",
    `Issues like this do not stay relevant by accident. They return because they sit inside familiar daily behaviour: the way people work, communicate, spend, study, shop, travel, compare information, or make quick decisions under pressure. Even when the surface details change, the underlying tension stays the same.`,
    "",
    "### Where readers usually feel the pressure first",
    "",
    `The first signs are often practical rather than dramatic. A person notices more confusion, more wasted effort, more uncertainty, more second-guessing, or more dependence on guesswork. By the time a bigger problem becomes visible, the weaker habits behind it may have been shaping decisions for a long time.`,
    "",
    "## What happened",
    "",
    `In an evergreen explainer, the most important development is not a single event but the underlying reality readers keep running into. ${coreIssueLine} The issue stays relevant because the same pressure appears again and again in slightly different forms.`,
    "",
    `That is why readers need more than tips without context. They need to see how the issue develops, why people misread it, what usually makes it worse, and what more careful judgment looks like in practice.`,
    "",
    `A typical pattern is easy to recognise. People begin with a real need, a real worry, or a real ambition. They then move too quickly because the environment rewards speed, imitation, or emotional reaction. At that point, weak information becomes more persuasive than careful thinking. The result is a decision that feels reasonable in the moment but becomes costly later.`,
    "",
    `That is the point of this explainer section: to make the pattern visible before the pressure peaks. Once readers can name the pattern, they can interrupt it. That is a more useful outcome than simply telling people to be careful after the damage has already started.`,
    "",
    "## Key facts readers should know",
    "",
    "- Everyday topics become costly when readers rely on urgency instead of verification.",
    "- Context usually matters more than the first emotional reaction the topic creates.",
    "- Practical habits, not dramatic one-off gestures, are what protect people over time.",
    "- Small decisions repeated often usually shape outcomes more than a single dramatic mistake.",
    "- Readers benefit when they compare claims, pause before acting, and look for process rather than hype.",
    "- A useful explainer should leave people more capable, not simply more alarmed.",
    "",
    `Those facts matter because they pull the subject away from hype and back toward real usefulness. They also help readers judge future situations with more confidence, which is one of the strongest trust signals any newsroom can offer.`,
    "",
    `They also help readers recognise the difference between noise and signal. Noise is usually loud, rushed, and emotionally loaded. Signal is calmer, more specific, and easier to test against real life. The more often readers learn to choose signal over noise, the more valuable a publication becomes to them.`,
    "",
    "## Why this matters for Nigeria",
    "",
    `${nigeriaImpactLine} In Nigeria, many decisions are made under pressure: time pressure, money pressure, family pressure, information pressure, or pressure created by uncertainty. That makes practical, clearly written explainers especially valuable.`,
    "",
    `The Nigerian angle is not an afterthought here. It is central. Readers want to know whether the issue affects transport, digital life, study plans, customer trust, safety, household peace, or confidence in institutions. When journalism answers those questions directly, it becomes genuinely useful instead of decorative.`,
    "",
    `That local relevance becomes even more important because many readers navigate several pressures at once. They may be balancing work with side income, school with family expectations, or digital opportunities with unreliable information. A strong Nigerian reading of the topic therefore needs to explain consequences in plain language, not hide them behind abstract commentary.`,
    "",
    `Good local journalism also helps readers avoid imported assumptions. Advice that sounds sensible in another country may not fit Nigerian realities around cost, infrastructure, public services, social trust, or everyday work patterns. Context turns generic information into useful information.`,
    "",
    "## Wider African and global context",
    "",
    `${africaImpactLine} That broader context helps readers avoid a narrow reading of the issue. What looks like a local habit can sometimes reflect a bigger shift in work, media, technology, family life, or consumer behaviour across multiple countries.`,
    "",
    `Global comparison also helps explain what is structural and what is temporary. Readers should ask whether the issue is being driven by technology change, economic pressure, changing expectations, or a communication problem that appears in many places at once.`,
    "",
    `Across Africa, readers often face similar trade-offs: limited time, uneven information quality, strong word-of-mouth influence, and daily pressure to act quickly. That is why patterns that appear in one country often travel well across borders, even when the details look different on the surface.`,
    "",
    `A wider lens also prevents overreaction. Some issues are genuinely expanding and deserve early attention. Others simply appear bigger because social media accelerates repetition. The job of a careful explainer is to separate those possibilities so readers can keep a balanced view.`,
    "",
    "## Expert insight and practical implications",
    "",
    `A stronger editorial reading of this subject begins with one discipline: separating the surface signal from the underlying pattern. ${title} is not only about immediate reaction. It is about the systems, habits, and incentives that shape how people respond when they feel rushed, uncertain, hopeful, or distracted.`,
    "",
    `That insight matters because people often assume a problem will be solved by more attention alone. In reality, better outcomes usually come from better process. Readers need clear checks, calmer judgment, and a habit of asking harder questions before they commit time, trust, attention, or money.`,
    "",
    `Practical implications follow from that. Readers should slow down, compare information, notice recurring warning signs, and keep simple routines that make better decisions easier. The strongest takeaway is not perfection; it is steadier judgment built through repeatable habits.`,
    "",
    "### What stronger judgment looks like in practice",
    "",
    `Stronger judgment usually looks ordinary. It means asking where a claim came from, whether the message is trying to force speed, whether the promise sounds cleaner than real life, and whether the decision can wait long enough for proper checking. People often imagine good judgment as special intelligence, but it is usually the result of repeatable habits.`,
    "",
    "### Practical steps readers can use",
    "",
    "- Slow the timeline when a decision feels emotionally loaded or artificially urgent.",
    "- Compare the claim with at least one more trustworthy source or direct channel.",
    "- Write down the practical consequence before committing time, trust, money, or attention.",
    "- Keep simple routines that reduce confusion the next time the same pattern appears.",
    "",
    `These steps matter because they convert awareness into action. That is where an authority-style article becomes genuinely useful: it helps readers change behaviour, not just nod along with a headline and move on.`,
    "",
    "## What readers should watch next",
    "",
    `Readers should watch how this issue evolves in everyday settings: online conversations, school decisions, workplace behaviour, family routines, buying habits, or public discussions. The next useful insight often comes from noticing repetition rather than waiting for drama.`,
    "",
    `They should also watch whether the people around them are becoming more careful or more reactive. Shifts in group behaviour often reveal whether a topic is being understood properly or merely repeated. When public conversation becomes noisier without becoming clearer, readers should treat that as a signal that more context is still needed.`,
    "",
    `Another useful question is what institutions, platforms, schools, employers, businesses, or communities do next. Strong responses usually involve clearer communication, more transparent expectations, and better habits that reduce avoidable confusion over time.`,
    "",
    linkedCoverageSentence,
    "",
    ...primaryLinks.map((link) => `- ${createMarkdownLink(link)}`),
    "",
    "## Frequently asked questions",
    "",
    "### What is the core issue behind this explainer?",
    "",
    `${faqCoreIssueLine}`,
    "",
    "### Why should readers in Nigeria care about it?",
    "",
    `${faqNigeriaLine}`,
    "",
    "### Does this topic affect daily life or only specialists?",
    "",
    "It affects everyday readers because decisions about trust, time, attention, safety, money, study, or work are rarely made in perfect conditions. Even when a topic sounds specialised at first, its effects usually show up through routine choices and everyday pressure.",
    "",
    "### Why do people often misunderstand issues like this?",
    "",
    "People usually meet them through fragments, quick opinions, or social pressure. That creates confidence before understanding, which is why context matters so much. A strong explainer slows that process down and gives readers a more reliable sequence for thinking through the issue.",
    "",
    "### What is the most useful habit readers can build here?",
    "",
    "Readers should learn to pause, verify, compare, and think about consequence before reacting. That single habit improves judgment across many different situations and helps people avoid being pushed into weak decisions by urgency alone.",
    "",
    "### Is there a wider African or global angle to consider?",
    "",
    `${faqAfricaLine}`,
    "",
    "### What should readers avoid when responding to this issue?",
    "",
    "They should avoid panic, blind forwarding, rushed assumptions, and decisions made only because other people sound certain. The loudest response is not always the most informed one, and confidence without context often creates avoidable mistakes.",
    "",
    "### What makes a trustworthy explainer different from empty advice?",
    "",
    "A trustworthy explainer connects the headline to real consequences, offers usable context, and respects uncertainty instead of pretending every answer is simple. It helps readers make sense of the issue after the first wave of attention has passed.",
    "",
    "### How can readers tell whether a claim deserves more caution?",
    "",
    "Claims deserve more caution when they rely on pressure, promise easy outcomes, remove important context, or make people feel they must act before thinking. Readers should treat speed and certainty as warning signs when clear evidence is missing.",
    "",
    "### Why do practical routines matter more than one-off motivation?",
    "",
    "Because most outcomes are shaped by repeated behaviour rather than rare heroic effort. A reader who has a simple process for checking claims, protecting attention, or reviewing choices is usually safer than a reader who only reacts strongly after a problem appears.",
    "",
    "### What should readers discuss with family, colleagues, or friends about this topic?",
    "",
    "They should discuss the warning signs, the easiest mistakes to make, and the practical checks everyone can use. Shared awareness strengthens individual judgment, especially in environments where information moves quickly from one person to another.",
    "",
    "## Conclusion",
    "",
    `${title} is worth understanding properly because the deeper pattern matters more than the noisy version people first encounter. When readers can see the warning signs, the local relevance, and the practical consequences clearly, they make stronger decisions.`,
    "",
    "That is the goal of this Century Blog explainer: not to overload readers with jargon, but to leave them calmer, better informed, and more capable of spotting what matters the next time the same issue appears in a new form.",
    "",
    "Authority is built when readers feel a publication has helped them think more clearly, not merely react more quickly. That is why evergreen journalism matters. It keeps paying readers back long after the first moment of attention has passed."
  ].join("\n");
}

function buildAuthorityNewsContent(article, category, relatedLinks = []) {
  const title = String(article?.title || "").trim();
  const sourceName = String(article?.sourceName || "current reports").trim();
  const description = sentenceCase(cleanSourceBrief(article?.description || article?.title));
  const context = cleanSourceBrief(article?.content || article?.description || article?.title);
  const categoryAngle = getCategoryReaderAngle(category);
  const impactFocus = getCategoryImpactFocus(category);
  const linkTargets = buildInternalLinkTargets(category, relatedLinks);
  const primaryLinks = linkTargets.slice(0, 3);
  const linkedCoverageSentence = primaryLinks.length
    ? `Readers who want a stronger Century Blog reading path can continue with ${joinMarkdownLinks(primaryLinks)} for added context, category coverage, and related reporting.`
    : "Readers should compare the story with other category coverage, broader archive pieces, and recent reports that help explain the same pressure from different angles.";
  const nigeriaReaderAngle =
    article.regionFocus === "nigeria"
      ? "For readers in Nigeria, the immediate concern is how this development could influence daily decisions, confidence, costs, safety, study, work, or public expectations."
      : "For readers in Nigeria, the practical question is whether this international development could influence costs, travel, digital behaviour, policy thinking, or wider public debate.";
  const nigeriaReaderAngleAlt =
    article.regionFocus === "nigeria"
      ? "The Nigerian angle matters because local readers often feel the effects of a story through price pressure, institutional trust, security concerns, market mood, or family planning long before the issue feels fully settled."
      : "The Nigerian angle matters because global stories often stop feeling distant once they affect prices, access, travel, business confidence, or the way institutions respond at home.";
  const africaContextLine =
    article.regionFocus === "nigeria"
      ? "Across Africa, similar developments can ripple through markets, public mood, diplomacy, migration choices, and media conversation even when the first headline appears local."
      : "Across Africa, global developments often become local realities through trade, energy pressure, public sentiment, technology dependence, and the practical choices people make every day.";
  const verificationLine = article.sourceUrl
    ? `Current public reporting from ${sourceName} suggests ${description.charAt(0).toLowerCase()}${description.slice(1)}.`
    : `${description} is the central development readers need to understand before reacting too quickly.`;
  const sourceSection = article.sourceUrl
    ? [
        "",
        OPTIONAL_SOURCES_HEADING,
        "",
        `- [${sourceName}](${article.sourceUrl})`
      ]
    : [];
  const tocItems = [
    "Why this story matters",
    "Context and background",
    "What happened",
    "Key facts readers should know",
    "Why this matters for Nigeria",
    "Wider African and global context",
    "Expert insight and practical implications",
    "What readers should watch next",
    "Frequently asked questions",
    "Conclusion"
  ];

  return [
    "## Introduction",
    "",
    `${title} matters because headline momentum rarely tells readers enough on its own. ${verificationLine} The bigger value lies in understanding what changed, which pressure point it exposes, and why that matters for people trying to make sound decisions in the middle of a fast-moving conversation.`,
    "",
    `${nigeriaReaderAngle} Strong journalism does more than repeat the first update. It explains the background, separates the confirmed point from the public reaction, and shows readers where the practical consequences are likely to surface first.`,
    "",
    `${categoryAngle} That approach helps the article feel less like a recycled summary and more like a useful briefing readers can rely on after the first burst of attention fades.`,
    "",
    "## Executive summary",
    "",
    `- ${description}`,
    `- ${nigeriaReaderAngleAlt}`,
    `- ${africaContextLine}`,
    `- The most useful reading of this story focuses on ${impactFocus} rather than noise, speculation, or social-media acceleration.`,
    "- Readers should watch what becomes confirmed, what institutions say next, and whether the early interpretation still holds after more details emerge.",
    "",
    "## Table of contents",
    "",
    ...tocItems.map((item) => `- ${item}`),
    "",
    "## Why this story matters",
    "",
    `${title} deserves attention because the public meaning of a story is rarely limited to the event itself. The real significance usually appears in the response: who reacts, what pressure builds, what confidence changes, and which practical decisions become harder or easier afterward.`,
    "",
    `That is especially true when a topic touches ${impactFocus}. Readers are not only asking what happened. They are asking whether the development changes risk, opportunity, cost, trust, or expectations in a way that could affect daily life or institutional behaviour.`,
    "",
    `Stories like this also shape public judgment. When early reactions become louder than verified context, readers can end up acting on mood instead of evidence. A useful explainer helps slow that process down and replaces reflex with clearer understanding.`,
    "",
    "## Context and background",
    "",
    `${context} That first report matters, but it becomes more useful when readers place it inside a wider frame. The background often reveals whether the update is part of a longer buildup, a predictable escalation, a policy turning point, or a warning sign that had been visible before the headline became mainstream.`,
    "",
    `Context is where weak summaries usually fail. They tell readers that an event happened, but they do not show why the event matters now, why the same issue may have been building for some time, or why some audiences feel the pressure faster than others.`,
    "",
    `This is also where source discipline matters. Early reporting can be accurate about the immediate trigger while still leaving major questions unresolved. That does not make the reporting useless. It simply means readers need to understand the difference between the first confirmed development and the deeper meaning that only becomes clearer as more evidence arrives.`,
    "",
    `${categoryAngle} Once that frame is visible, the story becomes more understandable and easier to judge on substance rather than emotion alone.`,
    "",
    "## What happened",
    "",
    `${verificationLine} That is the part of the story readers can hold onto first. The next step is to understand the sequence around it: what prompted the development, how institutions or affected groups responded, and what remains uncertain enough to require careful follow-up.`,
    "",
    `In fast-moving reporting, sequence matters more than noise. A dramatic headline can create urgency, but useful reporting asks harder questions. Did the development escalate quickly or gradually? Was there prior warning? Has an official response already begun? Are people reacting to a confirmed change, or to what they fear may happen next?`,
    "",
    `Those questions are important because they shape how seriously readers should interpret the story. A development may signal structural weakness, a temporary disruption, or a turning point with wider consequences. Good coverage does not pretend to know more than the evidence allows, but it does help readers see which possibilities deserve the closest attention.`,
    "",
    `That is why this article treats the initial report as a starting point, not the finished picture. The most responsible reading is one that stays alert to verification, context, and the difference between immediate reaction and durable consequence.`,
    "",
    "## Key facts readers should know",
    "",
    "- The headline captures the immediate development, but not the full meaning of the story.",
    "- Early reporting is most useful when readers pair it with context and follow-up confirmation.",
    "- Public reaction often moves faster than reliable interpretation.",
    "- The strongest reading of the story usually comes from consequence, not from drama alone.",
    "- Nigerian readers should look for the local effect, not only the international framing.",
    "- Source visibility matters because it helps readers check claims rather than inherit assumptions.",
    "",
    `Those facts matter because they protect readers from one of the biggest problems in modern news consumption: acting too quickly on incomplete context. A better habit is to separate the clearly reported point from the layer of opinion, fear, celebration, or speculation that forms around it.`,
    "",
    `That habit does not slow understanding down in a harmful way. It strengthens it. Readers become better at spotting signal, recognising uncertainty honestly, and deciding what deserves close attention over the next few hours or days.`,
    "",
    "## Why this matters for Nigeria",
    "",
    `${nigeriaReaderAngle} ${nigeriaReaderAngleAlt}`,
    "",
    `Even when the story appears international or sector-specific, the Nigerian effect can show up through transport costs, business planning, education decisions, investor mood, digital access, public conversation, or confidence in the ability of institutions to respond under pressure. That local relevance is what turns a distant update into a story readers should genuinely care about.`,
    "",
    `Nigerian readers also benefit from a reading that avoids imported assumptions. A solution, risk, or public reaction that makes sense in another country may land very differently in Nigeria because of cost realities, infrastructure gaps, policy history, or the way information spreads through local networks and social habits.`,
    "",
    `That is why local context is not decorative. It is editorially necessary. Without it, readers may understand the headline but still miss the actual significance for life, work, safety, planning, or trust at home.`,
    "",
    "## Wider African and global context",
    "",
    `${africaContextLine} The broader frame helps readers judge whether this story reflects a local disruption, a regional pattern, or a global pressure point with longer consequences.`,
    "",
    `A wider lens is useful because it reduces both panic and narrowness. Some stories deserve close attention because they reveal a deeper international trend. Others become overstated because the same reactions echo across platforms without adding much evidence. Comparing the local angle with the broader pattern helps readers see which kind of story they are dealing with.`,
    "",
    `This approach also improves judgment about what happens next. When readers understand how similar developments have affected other places, they become better at interpreting official statements, market responses, public mood, and the kinds of changes that may follow after the first round of headlines.`,
    "",
    "## Expert insight and practical implications",
    "",
    `The strongest editorial reading of this story begins with one question: what pressure does this development expose? In many news events, the headline is only the visible surface. The more important issue is whether the story reveals strain inside markets, institutions, diplomacy, public trust, safety planning, or everyday routines.`,
    "",
    `That matters because readers often consume updates at the speed of reaction, not the speed of understanding. A publication earns trust by helping them bridge that gap. Instead of chasing intensity, the article should show where the uncertainty sits, what consequence seems most credible, and why the next official or practical response may matter more than the initial noise.`,
    "",
    `For Nigerian readers, the practical layer is especially important. People want to know whether the story changes costs, access, confidence, work decisions, mobility, policy attention, or the behaviour of institutions that affect daily life. When reporting answers those questions clearly, it stops feeling abstract and starts feeling useful.`,
    "",
    "### Questions readers should keep in mind",
    "",
    "- What part of the story is fully reported, and what part still needs clearer confirmation?",
    "- Which group feels the effect first: consumers, institutions, markets, workers, students, or families?",
    "- Does the development point to a short-term disruption or a deeper structural pressure?",
    "- What local consequence should Nigerian readers watch most closely over the next few updates?",
    "",
    `These questions improve judgment because they shift attention from headline heat to practical meaning. That is usually the difference between weak aggregation and a stronger authority-style piece.`,
    "",
    "## What readers should watch next",
    "",
    `The next phase of the story will likely be shaped by confirmation, response, and consequence. Readers should watch for updated statements, clearer evidence, official reaction, market interpretation, policy movement, or institutional decisions that either strengthen or weaken the first reading of the story.`,
    "",
    `They should also pay attention to what changes after the initial attention spike. Strong follow-up reporting will usually show whether the story moved beyond symbolism and produced visible effects on behaviour, confidence, public debate, or operational decisions.`,
    "",
    linkedCoverageSentence,
    "",
    ...primaryLinks.map((link) => `- ${createMarkdownLink(link)}`),
    "",
    "## Frequently asked questions",
    "",
    "### What is the main issue at the centre of this story?",
    "",
    `${description}`,
    "",
    "### Why should readers in Nigeria pay attention?",
    "",
    `${nigeriaReaderAngleAlt}`,
    "",
    "### Does this story have wider African relevance?",
    "",
    `${africaContextLine}`,
    "",
    "### Are all the details fully confirmed yet?",
    "",
    "Not always. Fast-moving stories often begin with a clear trigger but incomplete context, which is why follow-up reporting and official clarification remain important.",
    "",
    "### What is the most useful question readers should ask next?",
    "",
    "They should ask what practical consequence is most likely to follow from the development, and whether later evidence supports the first public interpretation.",
    "",
    "### Could this development affect prices, jobs, policy, or public confidence?",
    "",
    `It could, especially in stories tied to ${impactFocus}. That is why consequence matters more than the first wave of commentary.`,
    "",
    "### Why do visible source links matter in coverage like this?",
    "",
    "They help readers distinguish verified reporting from recycled claims, selective summaries, and speculation that may spread faster than evidence.",
    "",
    "### What should readers watch most closely now?",
    "",
    "They should watch for updated reporting, official response, clearer evidence, and signs that the issue is either stabilising, escalating, or taking on broader local consequences.",
    "",
    "## Conclusion",
    "",
    `${title} is worth following because the lasting value of the story lies in what it changes for readers, institutions, markets, or public understanding. The headline may attract attention first, but the consequence is what determines whether the development truly matters.`,
    "",
    `Century Blog's role is to keep that consequence clear. When readers can see the context, the Nigerian angle, and the most credible next questions in one place, they are better equipped to judge the story on substance instead of noise.`,
    ...sourceSection
  ].join("\n");
}

function buildArticleContent(article) {
  const evergreenMode = isEvergreenAuthorityArticle(article);
  const category = isValidCategory(article?.category) ? article.category : mapTopicToCategory(article);
  const relatedLinks = Array.isArray(article?._relatedCenturyBlogLinks)
    ? article._relatedCenturyBlogLinks
    : Array.isArray(article?._existingPosts)
      ? buildRelatedLinks(article, article._existingPosts)
      : [];

  if (evergreenMode) {
    return buildEvergreenAuthorityContent(article, category, relatedLinks);
  }

  return buildAuthorityNewsContent(article, category, relatedLinks);
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

function createEmptyNewsCandidateResult(reason = "no-news-slots") {
  return {
    candidates: [],
    diagnostics: {
      providers: [],
      totals: {
        nigeriaRaw: 0,
        globalRaw: 0,
        nigeriaQualified: 0,
        globalQualified: 0,
        selected: 0
      },
      reason
    }
  };
}

function normalizeEvergreenTopic(topic) {
  const category = isValidCategory(topic?.category) ? topic.category : "daily-gist";
  const regionFocus = topic?.regionFocus === "global" ? "global" : "nigeria";

  return {
    title: String(topic?.title || "").trim(),
    description: String(topic?.description || "").trim(),
    content: String(topic?.content || "").trim(),
    sourceName: "",
    sourceUrl: "",
    sourceCountry: String(topic?.sourceCountry || (regionFocus === "global" ? "Global" : "Nigeria")).trim(),
    regionFocus,
    section: categoryMeta[category]?.label || "Features",
    autoProvider: EVERGREEN_PROVIDER,
    autoSourceId: getEvergreenSourceId(topic?.id),
    mediaUrl: "",
    mediaType: "image/jpeg",
    category
  };
}

function getPublishedCategorySnapshot(posts = []) {
  const counts = new Map();
  const latestTimestamps = new Map();

  for (const post of posts) {
    if (String(post?.workflowStatus || "published") !== "published") {
      continue;
    }

    const category = isValidCategory(post?.category) ? post.category : "daily-gist";
    counts.set(category, Number(counts.get(category) || 0) + 1);

    const publishedAt = new Date(
      post?.sitePublishedAt ||
      post?.publishedAt ||
      post?.updatedAt ||
      post?.createdAt ||
      ""
    ).getTime();

    if (Number.isFinite(publishedAt) && publishedAt > Number(latestTimestamps.get(category) || 0)) {
      latestTimestamps.set(category, publishedAt);
    }
  }

  return { counts, latestTimestamps };
}

function pickBalancedEvergreenTopics(topics = [], posts = [], requestedSlots = 0) {
  if (!Array.isArray(topics) || !topics.length || requestedSlots <= 0) {
    return [];
  }

  const { counts, latestTimestamps } = getPublishedCategorySnapshot(posts);
  const orderedTopics = [...topics].sort((left, right) => {
    const leftCategory = isValidCategory(left?.category) ? left.category : "daily-gist";
    const rightCategory = isValidCategory(right?.category) ? right.category : "daily-gist";
    const countDelta = Number(counts.get(leftCategory) || 0) - Number(counts.get(rightCategory) || 0);

    if (countDelta !== 0) {
      return countDelta;
    }

    const leftLatest = Number(latestTimestamps.get(leftCategory) || 0);
    const rightLatest = Number(latestTimestamps.get(rightCategory) || 0);

    if (leftLatest !== rightLatest) {
      return leftLatest - rightLatest;
    }

    if ((left?.regionFocus || "") !== (right?.regionFocus || "")) {
      return left?.regionFocus === "nigeria" ? -1 : 1;
    }

    return String(left?.title || "").localeCompare(String(right?.title || ""), "en", { sensitivity: "base" });
  });
  const selected = [];
  const usedCategories = new Set();

  for (const topic of orderedTopics) {
    if (selected.length >= requestedSlots) {
      break;
    }

    const category = isValidCategory(topic?.category) ? topic.category : "daily-gist";

    if (usedCategories.has(category)) {
      continue;
    }

    usedCategories.add(category);
    selected.push(topic);
  }

  if (selected.length >= requestedSlots) {
    return selected;
  }

  for (const topic of orderedTopics) {
    if (selected.length >= requestedSlots) {
      break;
    }

    if (selected.includes(topic)) {
      continue;
    }

    selected.push(topic);
  }

  return selected;
}

export async function fetchEvergreenAuthorityCandidates(settings = null, options = {}) {
  const activeSettings = settings || await getAutomationSettings();
  const evergreenEnabled = activeSettings.evergreenAutoPostingEnabled !== false;
  const requestedSlots = Math.max(
    0,
    Number(options.maxPostsPerRun ?? activeSettings.evergreenPostsPerRun ?? 1)
  );

  if (!evergreenEnabled || requestedSlots === 0) {
    return {
      candidates: [],
      diagnostics: {
        enabled: evergreenEnabled,
        topicBankSize: evergreenAuthorityTopics.length,
        availableTopics: evergreenAuthorityTopics.length,
        selected: 0
      }
    };
  }

  const existingPosts = Array.isArray(options.existingPosts) ? options.existingPosts : await getAllPosts();
  const availableTopics = evergreenAuthorityTopics.filter((topic) => {
    const normalizedTopic = normalizeEvergreenTopic(topic);
    return !findSimilarPost(
      {
        title: normalizedTopic.title,
        autoSourceId: normalizedTopic.autoSourceId,
        type: "auto"
      },
      existingPosts
    );
  });
  const selectedTopics = pickBalancedEvergreenTopics(availableTopics, existingPosts, requestedSlots);
  const nowIso = new Date().toISOString();
  const candidates = await mapSequential(selectedTopics, (topic) =>
    buildCandidate({
      ...normalizeEvergreenTopic(topic),
      publishedAt: nowIso,
      _existingPosts: existingPosts
    })
  );

  return {
    candidates,
    diagnostics: {
      enabled: true,
      topicBankSize: evergreenAuthorityTopics.length,
      availableTopics: availableTopics.length,
      selected: candidates.length
    }
  };
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

function countMarkdownBullets(content) {
  return String(content || "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^-\s+/.test(line)).length;
}

function countInternalLinks(content) {
  const matches = String(content || "").match(/\[[^\]]+]\((\/[^)\s]*)\)/g) || [];
  return matches.length;
}

function countFaqQuestions(content) {
  return String(content || "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^###\s+/.test(line)).length;
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
  const candidateClaims = [
    ...extractNumericClaims(
      String(candidateContent || "")
        .replace(/\[[^\]]+]\((?:https?:\/\/|\/)[^)]+\)/gi, " ")
        .replace(/https?:\/\/\S+/gi, " ")
    )
  ];
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

  if (EDITORIAL_INSTRUCTION_PATTERNS.some((pattern) => pattern.test(content))) {
    reasons.push("editorial-instruction-leakage");
    blockingReasons.push("editorial-instruction-leakage");
    score -= 4;
  }

  if (MALFORMED_CONTENT_PATTERNS.some((pattern) => pattern.test(content))) {
    reasons.push("malformed-or-placeholder-content");
    blockingReasons.push("malformed-or-placeholder-content");
    score -= 4;
  }

  if (containsUnsupportedAttribution(article, content)) {
    reasons.push("unsupported-authority-attribution");
    blockingReasons.push("unsupported-authority-attribution");
    score -= 4;
  }

  if (SOURCE_TRUNCATION_PATTERNS.some((pattern) => pattern.test(content))) {
    reasons.push("truncated-source-copy");
    blockingReasons.push("truncated-source-copy");
    score -= 3;
  }

  const introduction = getSectionContent(content, "## Introduction");
  const executiveSummary = getSectionContent(content, "## Executive summary");
  const tableOfContents = getSectionContent(content, "## Table of contents");
  const whyThisStoryMatters = getSectionContent(content, "## Why this story matters");
  const contextAndBackground = getSectionContent(content, "## Context and background");
  const whatHappened = getSectionContent(content, "## What happened");
  const keyFacts = getSectionContent(content, "## Key facts readers should know");
  const nigeriaSection = getSectionContent(content, "## Why this matters for Nigeria");
  const widerContext = getSectionContent(content, "## Wider African and global context");
  const expertInsight = getSectionContent(content, "## Expert insight and practical implications");
  const whatReadersShouldWatchNext = getSectionContent(content, "## What readers should watch next");
  const faqSection = getSectionContent(content, "## Frequently asked questions");
  const conclusion = getSectionContent(content, "## Conclusion");

  if (countWords(introduction) < SECTION_MIN_WORDS["## Introduction"]) {
    reasons.push("thin-introduction");
    blockingReasons.push("thin-introduction");
    score -= 2;
  }

  const executiveSummaryBullets = countMarkdownBullets(executiveSummary);
  if (executiveSummaryBullets < 3 || executiveSummaryBullets > 6) {
    reasons.push("weak-executive-summary");
    blockingReasons.push("weak-executive-summary");
    score -= 2;
  }

  if (countMarkdownBullets(tableOfContents) < 8) {
    reasons.push("weak-table-of-contents");
    blockingReasons.push("weak-table-of-contents");
    score -= 1.5;
  }

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

  if (countWords(keyFacts) < SECTION_MIN_WORDS["## Key facts readers should know"]) {
    reasons.push("thin-key-facts");
    blockingReasons.push("thin-key-facts");
    score -= 2;
  }

  if (countWords(nigeriaSection) < SECTION_MIN_WORDS["## Why this matters for Nigeria"]) {
    reasons.push("thin-nigeria-section");
    blockingReasons.push("thin-nigeria-section");
    score -= 2;
  }

  if (countWords(widerContext) < SECTION_MIN_WORDS["## Wider African and global context"]) {
    reasons.push("thin-wider-context");
    blockingReasons.push("thin-wider-context");
    score -= 2;
  }

  if (countWords(expertInsight) < SECTION_MIN_WORDS["## Expert insight and practical implications"]) {
    reasons.push("thin-expert-insight");
    blockingReasons.push("thin-expert-insight");
    score -= 2;
  }

  if (countWords(whatReadersShouldWatchNext) < SECTION_MIN_WORDS["## What readers should watch next"]) {
    reasons.push("thin-watch-next");
    blockingReasons.push("thin-watch-next");
    score -= 2;
  }

  if (countWords(faqSection) < SECTION_MIN_WORDS["## Frequently asked questions"]) {
    reasons.push("thin-faq-section");
    blockingReasons.push("thin-faq-section");
    score -= 2;
  }

  if (countFaqQuestions(faqSection) < 8) {
    reasons.push("faq-too-short");
    blockingReasons.push("faq-too-short");
    score -= 2;
  }

  if (countWords(conclusion) < SECTION_MIN_WORDS["## Conclusion"]) {
    reasons.push("thin-conclusion");
    blockingReasons.push("thin-conclusion");
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

  if (countInternalLinks(content) < Math.min(3, (candidate?._relatedCenturyBlogLinks || []).length || 3)) {
    reasons.push("missing-internal-links");
    blockingReasons.push("missing-internal-links");
    score -= 1.5;
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
  const evergreenMode = isEvergreenAuthorityArticle(article);
  const suspiciousUnexpectedClaims = unexpectedNumericClaims.filter((claim) =>
    /[%$£€₦]|percent|billion|million|trillion|\bbn\b|\bm\b|\bk\b/i.test(claim)
  );

  if (suspiciousUnexpectedClaims.length > 0) {
    reasons.push("unsupported-numeric-claims");
    blockingReasons.push("unsupported-numeric-claims");
    score -= 3;
  } else if (!evergreenMode && unexpectedNumericClaims.length >= 3) {
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

  const evergreenMode = isEvergreenAuthorityArticle(article);
  const systemPrompt = [
    "Century Blog is a premium publication for Nigerian and global readers.",
    "Return only valid JSON with the keys title, seoTitle, metaDescription, excerpt, content, category, author, and unsplashImages.",
    "Write in clear British English with a human newsroom tone. Be original, neutral, useful, and search-friendly. Never mention AI.",
    "Avoid clickbait, filler, copied phrasing, invented facts, invented quotes, invented reactions, and unsupported statistics.",
    evergreenMode
      ? "Treat the brief as an evergreen authority explainer, not breaking news. Do not pretend there is a single news outlet behind it."
      : "Use only claims supported by the source brief. If a detail is uncertain, use cautious wording.",
    "The article body must be between one thousand eight hundred and two thousand two hundred words in Markdown.",
    "Use this exact H2 order: ## Introduction, ## Executive summary, ## Table of contents, ## Why this story matters, ## Context and background, ## What happened, ## Key facts readers should know, ## Why this matters for Nigeria, ## Wider African and global context, ## Expert insight and practical implications, ## What readers should watch next, ## Frequently asked questions, ## Conclusion.",
    "Executive summary needs three to six bullet points. FAQ needs eight to twelve ### questions. Add at least three natural internal links from the provided Century Blog URLs. Add ## Sources only when a real source URL is provided.",
    "Keep the title specific and trustworthy. Keep the meta description between one hundred and fifty and one hundred and sixty characters. Never leak instructions into the output.",
    "unsplashImages must include featuredImage, supportingImage1, supportingImage2, supportingImage3, and supportingImage4 with searchQuery, altText, filename, and placement."
  ].join(" ");

  const primaryKeyword = buildPrimaryKeyword(article);
  const secondaryKeywords = buildSecondaryKeywords(article, baseCandidate.category);
  const promptDescription = truncateForPrompt(article.description, 900);
  const promptSourceContent = truncateForPrompt(article.content, evergreenMode ? 1800 : 2400);
  const promptCurrentDraft = revisionNotes.length
    ? truncateForPrompt(baseCandidate.content, 2600)
    : "";

  const userPrompt = JSON.stringify({
    publication: "Century Blog",
    assignmentType: evergreenMode ? "evergreen authority explainer" : "timely authority news analysis",
    topic: article.title,
    targetAudience: buildTargetAudience(article),
    category: baseCandidate.category,
    regionPriority: article.regionFocus,
    primaryKeyword,
    secondaryKeywords,
    relatedCenturyBlogLinks: relatedLinks,
    categoryWritingRule: getCategoryWritingRule(baseCandidate.category),
    nigeriaRelevance: getNigeriaRelevance(article, baseCandidate.category),
    sourceSummary: buildSourceSummary(article),
    sourceName: article.sourceName,
    sourceUrl: article.sourceUrl,
    title: article.title,
    description: promptDescription,
    brief: promptSourceContent,
    currentDraft: promptCurrentDraft,
    revisionNotes
  });

  try {
    const groqFormats =
      aiConfig.provider === "groq"
        ? ["prompt-json"]
        : ["default"];

    let parsed = null;

    for (const formatMode of groqFormats) {
      const requestBody =
        aiConfig.provider === "groq"
          ? {
              model: aiConfig.model,
              instructions: systemPrompt,
              input: userPrompt,
              text: {
                format: {
                  type: "json_schema",
                  name: "century_blog_article",
                  strict: true,
                  schema: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      seoTitle: { type: "string" },
                      metaDescription: { type: "string" },
                      excerpt: { type: "string" },
                      content: { type: "string" },
                      category: { type: "string" },
                      author: { type: "string" },
                      unsplashImages: {
                        type: "object",
                        properties: {
                          featuredImage: { type: "object", properties: { searchQuery: { type: "string" }, altText: { type: "string" }, filename: { type: "string" }, placement: { type: "string" } }, required: ["searchQuery", "altText", "filename", "placement"], additionalProperties: false },
                          supportingImage1: { type: "object", properties: { searchQuery: { type: "string" }, altText: { type: "string" }, filename: { type: "string" }, placement: { type: "string" } }, required: ["searchQuery", "altText", "filename", "placement"], additionalProperties: false },
                          supportingImage2: { type: "object", properties: { searchQuery: { type: "string" }, altText: { type: "string" }, filename: { type: "string" }, placement: { type: "string" } }, required: ["searchQuery", "altText", "filename", "placement"], additionalProperties: false },
                          supportingImage3: { type: "object", properties: { searchQuery: { type: "string" }, altText: { type: "string" }, filename: { type: "string" }, placement: { type: "string" } }, required: ["searchQuery", "altText", "filename", "placement"], additionalProperties: false },
                          supportingImage4: { type: "object", properties: { searchQuery: { type: "string" }, altText: { type: "string" }, filename: { type: "string" }, placement: { type: "string" } }, required: ["searchQuery", "altText", "filename", "placement"], additionalProperties: false }
                        },
                        required: ["featuredImage", "supportingImage1", "supportingImage2", "supportingImage3", "supportingImage4"],
                        additionalProperties: false
                      }
                    },
                    required: ["title", "seoTitle", "metaDescription", "excerpt", "content", "category", "author", "unsplashImages"],
                    additionalProperties: false
                  }
                }
              },
              reasoning: { effort: "low" },
              max_output_tokens: 3800,
              temperature: 0.25
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

      for (let requestAttempt = 0; requestAttempt < 2; requestAttempt += 1) {
        const response = await fetch(aiConfig.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${aiConfig.apiKey}`
          },
          body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
          const errorText = String(await response.text()).slice(0, 320);

          if (response.status === 429 && requestAttempt < 2) {
            const waitMs = getRetryDelayFromErrorText(errorText, (requestAttempt + 1) * 15000);
            console.warn(`[auto-news] ${aiConfig.provider} rewrite rate limited. Waiting ${waitMs}ms before retry ${requestAttempt + 2}.`);
            await sleep(waitMs);
            continue;
          }

          throw new Error(`${aiConfig.provider} rewrite failed with status ${response.status}${errorText ? `: ${errorText}` : ""}`);
        }

        const payload = await response.json();

        try {
          parsed = extractJsonPayload(getResponseText(payload));
          break;
        } catch (error) {
          if (requestAttempt >= 2) {
            throw error;
          }

          console.warn(`[auto-news] ${aiConfig.provider} rewrite returned malformed JSON. Retrying ${requestAttempt + 2}/3.`);
          await sleep((requestAttempt + 1) * 4000);
        }
      }

      if (parsed) {
        break;
      }
    }

    if (!parsed) {
      throw new Error(`${aiConfig.provider} rewrite did not return usable content.`);
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
      "Expand the current draft instead of restarting, keep the authority structure exact, and ensure the final article clears two thousand words with stronger section depth.",
      "Do not add any new number, percentage, currency figure, ranking, date, timeline, or statistic unless it is already supported by the provided source brief.",
      "Strengthen the introduction, what happened, wider context, expert insight, and what readers should watch next with cautious, useful explanation rather than filler."
    ],
    relatedLinks: candidate?._relatedCenturyBlogLinks || []
  });
}

function shouldPreferQualityReport(nextReport, currentReport) {
  if (!currentReport) {
    return true;
  }

  if (Boolean(nextReport?.passed) !== Boolean(currentReport?.passed)) {
    return Boolean(nextReport?.passed);
  }

  const nextBlockingCount = Array.isArray(nextReport?.blockingReasons) ? nextReport.blockingReasons.length : 0;
  const currentBlockingCount = Array.isArray(currentReport?.blockingReasons) ? currentReport.blockingReasons.length : 0;

  if (nextBlockingCount !== currentBlockingCount) {
    return nextBlockingCount < currentBlockingCount;
  }

  const nextScore = Number(nextReport?.score || 0);
  const currentScore = Number(currentReport?.score || 0);

  if (nextScore !== currentScore) {
    return nextScore > currentScore;
  }

  return Number(nextReport?.wordCount || 0) > Number(currentReport?.wordCount || 0);
}

async function rewriteCandidateWithAi(article, baseCandidate, relatedLinks = []) {
  const baseQualityReport = evaluateCandidateQuality(article, baseCandidate);
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
  let selectedCandidate = currentCandidate;
  let selectedQualityReport = qualityReport;
  const shouldUseLocalFallback = !qualityReport.passed && shouldPreferQualityReport(baseQualityReport, qualityReport);

  if (shouldUseLocalFallback) {
    selectedCandidate = baseCandidate;
    selectedQualityReport = baseQualityReport;
    rewriteMeta.status = rewriteMeta.attempted ? "fallback-local-authority-draft" : "local-authority-draft";
  }

  const canPublishWithoutRewrite = selectedQualityReport.passed && rewriteMeta.succeeded;

  if (!rewriteMeta.succeeded && !canPublishWithoutRewrite) {
    selectedQualityReport = appendQualityReason(selectedQualityReport, "rewrite-required", { blocking: true });
  }

  if (rewriteMeta.attempted && !rewriteMeta.succeeded && !canPublishWithoutRewrite) {
    selectedQualityReport = appendQualityReason(selectedQualityReport, "rewrite-failed", { blocking: true });
  }

  return {
    ...selectedCandidate,
    qualityReport: selectedQualityReport,
    rewriteMeta
  };
}

async function buildCandidate(article) {
  const evergreenMode = isEvergreenAuthorityArticle(article);
  const category = isValidCategory(article?.category) ? article.category : mapTopicToCategory(article);
  const normalizedTitle = normalizeAuthorityTitle(article?.title, category) || String(article?.title || "").trim();
  const relatedLinks = buildRelatedLinks(article, article._existingPosts || []);
  const authorityExcerpt = evergreenMode
    ? createExcerpt(article)
    : buildAuthorityExcerpt(article, category);
  const authorityMetaDescription = evergreenMode
    ? createExcerpt(article)
    : buildAuthorityMetaDescription(article, category);
  const authoritySeoTitle = evergreenMode
    ? normalizedTitle
    : buildAuthoritySeoTitle(article);

  const baseCandidate = {
    title: normalizedTitle,
    seoTitle: authoritySeoTitle,
    metaDescription: authorityMetaDescription,
    excerpt: authorityExcerpt,
    content: buildArticleContent(article),
    category,
    author: isEvergreenAuthorityArticle(article)
      ? "Century Blog Editorial Team"
      : article.regionFocus === "nigeria"
        ? "Century Blog Nigeria Desk"
        : "Century Blog Global Desk",
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
    imageAlt: normalizedTitle,
    _relatedCenturyBlogLinks: relatedLinks
  };

  const rewrittenCandidate = await rewriteCandidateWithAi(article, baseCandidate, relatedLinks);
  const imageQuery = rewrittenCandidate._featuredImageQuery || deriveImageSearchQuery(article, rewrittenCandidate);
  const image = await resolveImage(article, imageQuery);
  const finalCandidate = {
    ...rewrittenCandidate,
    content: sanitizeGeneratedArticleContent(rewrittenCandidate.content),
    mediaUrl: image.mediaUrl,
    imageCreditName: image.imageCreditName,
    imageCreditUrl: image.imageCreditUrl
  };
  const qualityReport = evaluateCandidateQuality(article, finalCandidate);

  return {
    ...finalCandidate,
    qualityReport,
    rewriteMeta: rewrittenCandidate.rewriteMeta || rewrittenCandidate._aiRewriteMeta || createAiRewriteMeta()
  };
}

export async function fetchAutomatedNewsCandidates(settings = null, options = {}) {
  const activeSettings = settings || await getAutomationSettings();
  const maxPostsPerRun = Math.max(
    0,
    Number(options.maxPostsPerRun ?? activeSettings.maxPostsPerRun ?? 2)
  );

  if (maxPostsPerRun === 0) {
    return createEmptyNewsCandidateResult();
  }

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
    {
      ...activeSettings,
      maxPostsPerRun
    }
  );
  const existingPosts = Array.isArray(options.existingPosts) ? options.existingPosts : await getAllPosts();
  const candidates = await mapSequential(selectedArticles, (article) =>
    buildCandidate({
      ...article,
      _existingPosts: existingPosts
    })
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
  const totalSlots = 1;
  const isEvergreenDay = new Date().getUTCDate() % 2 === 0;
  const evergreenSlots = settings.evergreenAutoPostingEnabled === false || !isEvergreenDay
    ? 0
    : 1;
  const newsSlots = Math.max(0, totalSlots - evergreenSlots);

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

  const existingPosts = await getAllPosts();
  const evergreenResult = await fetchEvergreenAuthorityCandidates(settings, {
    existingPosts,
    maxPostsPerRun: evergreenSlots
  });
  const postsAfterEvergreen = evergreenResult.candidates.length
    ? await getAllPosts()
    : existingPosts;
  const effectiveNewsSlots = newsSlots || (evergreenSlots > 0 && evergreenResult.candidates.length === 0 ? 1 : 0);
  const newsResult = await fetchAutomatedNewsCandidates(settings, {
    existingPosts: postsAfterEvergreen,
    maxPostsPerRun: effectiveNewsSlots
  });
  const candidates = [...evergreenResult.candidates, ...newsResult.candidates];
  const diagnostics = {
    evergreen: evergreenResult.diagnostics,
    news: newsResult.diagnostics
  };

  if (!candidates.length) {
    const providerFailures = (newsResult.diagnostics?.providers || [])
      .flatMap((provider) => provider.requests || [])
      .filter((request) => !request.ok)
      .length;
    const qualifiedCount =
      Number(newsResult.diagnostics?.totals?.nigeriaQualified || 0) +
      Number(newsResult.diagnostics?.totals?.globalQualified || 0);
    const evergreenAvailable = Number(evergreenResult.diagnostics?.availableTopics || 0);
    const empty = {
      status: "idle",
      message: evergreenSlots > 0 && evergreenAvailable === 0
        ? "Automation ran, but the evergreen authority topic bank is fully used and no fresh qualifying news stories were available."
        : providerFailures
          ? "Automation ran, but the news providers did not return usable stories and no evergreen topic was available to publish."
          : qualifiedCount
            ? "Automation found stories, but none were selected for publishing."
            : "Automation ran, but no fresh qualifying articles or unused evergreen authority topics were available.",
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
  let evergreenPublishedCount = 0;
  let newsPublishedCount = 0;

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
      if (String(candidate.autoProvider || "").trim().toLowerCase() === EVERGREEN_PROVIDER) {
        evergreenPublishedCount += 1;
      } else {
        newsPublishedCount += 1;
      }
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
      ? `Published ${createdPosts.length} automated ${createdPosts.length === 1 ? "post" : "posts"} (${evergreenPublishedCount} evergreen, ${newsPublishedCount} news).`
      : `Automation ran, but nothing was published. Duplicates: ${duplicateCount}. Drafted for review: ${draftCount}.`,
    publishedCount: createdPosts.length,
    createdPosts,
    draftedPosts,
    skippedPosts,
    diagnostics,
    evergreenPublishedCount,
    newsPublishedCount
  };

  await markAutomationRun(summary);
  return summary;
}

export async function runAutomatedNewsIngestionSafely(options = {}) {
  try {
    return await runAutomatedNewsIngestion(options);
  } catch (error) {
    console.error("[automation] run failed", {
      message: error?.message || "Automation run failed."
    });
    await markAutomationFailure(error, "Automation run failed.").catch(() => undefined);
    throw error;
  }
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
    openAiModel: OPENAI_REWRITE_MODEL,
    evergreenTopicCount: evergreenAuthorityTopics.length
  };
}

export function getAutomationCategoryOptions() {
  return Object.entries(categoryMeta).map(([value, meta]) => ({
    value,
    label: meta.label
  }));
}


