import { isPersistentStorageReady } from "@/lib/cloudinary";
import { createAutoPost } from "@/lib/posts-store";
import { getAutomationSettings, markAutomationRun } from "@/lib/automation-store";
import { categoryMeta, isValidCategory, slugify } from "@/lib/site";

const NEWS_API_KEY = process.env.NEWS_API_KEY || "";
const GNEWS_API_KEY = process.env.GNEWS_API_KEY || "";
const PEXELS_API_KEY = process.env.PEXELS_API_KEY || "";
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY || "";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_REWRITE_MODEL = process.env.OPENAI_REWRITE_MODEL || "gpt-5-mini";

const NEWS_LOOKBACK_MS = 1000 * 60 * 60 * 36;

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
  return hook.length > 155 ? `${hook.slice(0, 152).trim()}...` : hook;
}

function trimToLength(value, maxLength) {
  const text = String(value || "").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 3).trim()}...` : text;
}

function buildArticleContent(article) {
  const title = article.title;
  const sourceName = article.sourceName || "international wires";
  const description = stripHtml(article.description || article.content || article.title);
  const context = stripHtml(article.content || article.description || article.title);
  const audienceLine = article.regionFocus === "nigeria"
    ? "For Nigerian readers, the practical question is how this development may affect daily decisions, public debate, business planning, travel, education, household spending, or trust in institutions."
    : "For readers following global affairs, the practical question is how this development may influence markets, policy, public confidence, and the wider news agenda.";
  const regionLine = article.regionFocus === "nigeria"
    ? "The Nigerian angle matters because major headlines rarely stay isolated. They often shape household choices, business expectations, public conversation, and how people judge official responses."
    : "The global angle matters because international headlines can still shape local conversations through trade, energy prices, technology, sport, migration, finance, and public policy.";

  return [
    `${title} has become a story worth following because it raises questions that go beyond the headline. Readers do not only need to know that it happened; they need to understand the context, the likely impact, and what to watch next.`,
    "",
    `The available report from ${sourceName} points to this key issue: ${description} The details may continue to develop, but the story already offers useful lessons about timing, public reaction, and real-world consequences.`,
    "",
    "## Context and background",
    "",
    `${context} The most useful way to read this story is to separate the confirmed information from the wider reaction around it. That helps readers avoid panic, rumour, and shallow interpretations.`,
    "",
    `${regionLine} Stories like this can also reveal bigger patterns: how quickly information spreads, how institutions respond, and how ordinary people make sense of fast-moving news.`,
    "",
    "## What this means for readers",
    "",
    `${audienceLine} The value of the story is not only in the headline, but in the questions it creates for the days ahead.`,
    "",
    "Readers should pay attention to:",
    "",
    "- whether official statements clarify the situation",
    "- how affected groups respond",
    "- whether the issue creates wider economic, social, or policy effects",
    "- whether new evidence changes the first public understanding of the story",
    "",
    "## Practical examples and insights",
    "",
    "A headline can affect people in different ways. A business owner may look for signs of market pressure. A student may want a simple explanation of the issue. A family may want to know whether it affects safety, cost of living, public services, or future plans.",
    "",
    "That is why useful reporting should explain the meaning of a story, not just repeat the latest update.",
    "",
    "## Common mistakes to avoid",
    "",
    "- Do not rely on headlines alone without reading the details.",
    "- Do not share unverified claims simply because they are trending.",
    "- Do not assume the first version of a developing story is the final version.",
    "- Do not ignore local impact, especially when a global story may still affect Nigerian readers.",
    "",
    "## Expert tips and what to watch next",
    "",
    "The strongest next step is to watch for verified updates from credible sources, official responses, and practical consequences. Readers should also compare how different trusted outlets frame the story, because that often reveals what is confirmed and what remains uncertain.",
    "",
    "For Century Blog readers, the main takeaway is simple: follow the story with context. The headline matters, but the impact matters more.",
    "",
    "## Image Recommendations",
    "",
    `- Featured image idea: A clear editorial photo representing ${title}, with people, location, or topic-specific visual detail rather than a generic background.`,
    "- Supporting image idea: A close-up image showing the real-world setting connected to the story.",
    "- Supporting image idea: A contextual image showing readers, commuters, workers, students, officials, or businesses affected by the issue.",
    "- Supporting image idea: A simple explainer-style visual showing the key issue, timeline, or impact."
  ].join("\n");
}

function buildAutoPostSystemPrompt() {
  return [
    "You are an expert SEO content writer, journalist, and subject-matter analyst for Century Blog.",
    "Create a high-quality, original blog post that provides real value, strong user experience, and meets Google content quality and AdSense standards.",
    "Write for humans first and SEO second. Use a professional, clear, engaging, human tone with no robotic or AI-sounding phrasing.",
    "Return only valid JSON with these keys: title, metaDescription, excerpt, content, category, author.",
    "The title must be SEO optimised, click-worthy, and under 140 characters.",
    "The metaDescription and excerpt must be 150 to 160 characters where possible, never above 280 characters.",
    "The content must be 700 to 1000 words in Markdown.",
    "Use British English.",
    "Use ## for main headings and ### for subheadings.",
    "Use short paragraphs of 2 to 4 lines maximum.",
    "Use bullet points where helpful.",
    "Do not use HTML tags.",
    "Do not copy or closely rewrite the source article. Add original explanation, context, useful analysis, and real-world impact.",
    "Include Nigerian relevance where applicable, especially for Nigeria-focused stories or topics that affect Nigerian readers.",
    "Avoid fake data, unverifiable claims, filler, vague statements, and keyword stuffing.",
    "Use this structure inside content: Introduction, ## Context and background, ## Main explanation, ## Practical examples and insights, ## Common mistakes to avoid, ## Expert tips and pro advice, ## Conclusion, ## Image Recommendations.",
    "Under Image Recommendations, include one very specific featured image idea and two or three supporting image ideas.",
    "Allowed categories: nigeria, world, business, tech, entertainment, health, lifestyle, education, daily-gist.",
    "Prefer nigeria when the story is Nigeria-focused, otherwise choose the best fitting category.",
    "Do not mention that an AI wrote the article."
  ].join(" ");
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error(`Failed request: ${response.status} ${url}`);
  }

  return response.json();
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
    return [];
  }

  const endpoint = regionFocus === "nigeria"
    ? `https://newsapi.org/v2/top-headlines?country=ng&language=en&pageSize=12&apiKey=${NEWS_API_KEY}`
    : `https://newsapi.org/v2/top-headlines?language=en&pageSize=12&apiKey=${NEWS_API_KEY}`;
  const payload = await fetchJson(endpoint);
  return (payload.articles || []).map((article) => normalizeNewsApiArticle(article, regionFocus));
}

async function fetchGNewsStories(regionFocus) {
  if (!GNEWS_API_KEY) {
    return [];
  }

  const endpoint = regionFocus === "nigeria"
    ? `https://gnews.io/api/v4/top-headlines?country=ng&lang=en&max=10&apikey=${GNEWS_API_KEY}`
    : `https://gnews.io/api/v4/top-headlines?lang=en&max=10&apikey=${GNEWS_API_KEY}`;
  const payload = await fetchJson(endpoint);
  return (payload.articles || []).map((article) => normalizeGNewsArticle(article, regionFocus));
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

async function resolveImage(article) {
  if (article.mediaUrl) {
    return {
      mediaUrl: article.mediaUrl,
      imageCreditName: article.sourceName,
      imageCreditUrl: article.sourceUrl
    };
  }

  const searchQuery = `${article.title} ${article.regionFocus === "nigeria" ? "Nigeria" : "world"}`;
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

function isOpenAiRewriteEnabled() {
  return Boolean(OPENAI_API_KEY);
}

async function rewriteCandidateWithAi(article, baseCandidate) {
  if (!isOpenAiRewriteEnabled()) {
    return baseCandidate;
  }

  const userPrompt = JSON.stringify({
    publication: "Century Blog",
    goal: "Create a high-quality, original, AdSense-ready article for humans first and SEO second.",
    targetAudience: article.regionFocus === "nigeria"
      ? "Nigerians, students, professionals, entrepreneurs, families, and general readers"
      : "General readers who want clear context and practical impact",
    tone: "Professional, clear, engaging, human",
    wordCount: "700-1000 words",
    regionPriority: article.regionFocus,
    suggestedCategory: baseCandidate.category,
    sourceName: article.sourceName,
    sourceUrl: article.sourceUrl,
    sourceCountry: article.sourceCountry,
    title: article.title,
    description: article.description,
    content: article.content,
    publishedAt: article.publishedAt
  });

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: OPENAI_REWRITE_MODEL,
        store: false,
        input: [
          {
            role: "system",
            content: [{ type: "input_text", text: buildAutoPostSystemPrompt() }]
          },
          {
            role: "user",
            content: [{ type: "input_text", text: userPrompt }]
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI rewrite failed with status ${response.status}`);
    }

    const payload = await response.json();
    const parsed = extractJsonPayload(getResponseText(payload));
    const category = isValidCategory(parsed.category) ? parsed.category : baseCandidate.category;

    return {
      ...baseCandidate,
      title: trimToLength(parsed.title || baseCandidate.title, 140),
      excerpt: trimToLength(parsed.metaDescription || parsed.excerpt || baseCandidate.excerpt, 280),
      content: String(parsed.content || baseCandidate.content).trim(),
      category,
      author: trimToLength(parsed.author || baseCandidate.author, 80)
    };
  } catch {
    return baseCandidate;
  }
}

async function buildCandidate(article) {
  const image = await resolveImage(article);
  const category = mapTopicToCategory(article);

  const baseCandidate = {
    title: article.title,
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
    mediaUrl: image.mediaUrl,
    imageCreditName: image.imageCreditName,
    imageCreditUrl: image.imageCreditUrl,
    mediaType: article.mediaType || "image/jpeg",
    publishedAt: article.publishedAt
  };

  return rewriteCandidateWithAi(article, baseCandidate);
}

export async function fetchAutomatedNewsCandidates(settings = null) {
  const activeSettings = settings || await getAutomationSettings();
  const [newsApiNigeria, newsApiGlobal, gNewsNigeria, gNewsGlobal] = await Promise.all([
    fetchNewsApiStories("nigeria").catch(() => []),
    fetchNewsApiStories("global").catch(() => []),
    fetchGNewsStories("nigeria").catch(() => []),
    fetchGNewsStories("global").catch(() => [])
  ]);

  const nigeriaArticles = dedupeArticles([...newsApiNigeria, ...gNewsNigeria]).sort(
    (left, right) => computeTrendingScore(right) - computeTrendingScore(left)
  );
  const globalArticles = dedupeArticles([...newsApiGlobal, ...gNewsGlobal]).sort(
    (left, right) => computeTrendingScore(right) - computeTrendingScore(left)
  );
  const selectedArticles = chooseArticles(nigeriaArticles, globalArticles, activeSettings);

  return Promise.all(selectedArticles.map(buildCandidate));
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

  const candidates = await fetchAutomatedNewsCandidates(settings);

  if (!candidates.length) {
    const empty = {
      status: "idle",
      message: "No fresh articles were available from the configured providers.",
      publishedCount: 0,
      createdPosts: [],
      skippedPosts: []
    };
    await markAutomationRun(empty);
    return empty;
  }

  const createdPosts = [];
  const skippedPosts = [];

  for (const candidate of candidates) {
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

  const summary = {
    status: createdPosts.length ? "success" : "idle",
    message: createdPosts.length
      ? `Published ${createdPosts.length} automated ${createdPosts.length === 1 ? "post" : "posts"}.`
      : "Every fetched article matched an existing post, so nothing new was published.",
    publishedCount: createdPosts.length,
    createdPosts,
    skippedPosts
  };

  await markAutomationRun(summary);
  return summary;
}

export function getAutomationProviderSummary() {
  return {
    newsApiEnabled: Boolean(NEWS_API_KEY),
    gNewsEnabled: Boolean(GNEWS_API_KEY),
    pexelsEnabled: Boolean(PEXELS_API_KEY),
    unsplashEnabled: Boolean(UNSPLASH_ACCESS_KEY),
    openAiRewriteEnabled: isOpenAiRewriteEnabled(),
    storageReady: isPersistentStorageReady(),
    openAiModel: OPENAI_REWRITE_MODEL
  };
}

export function getAutomationCategoryOptions() {
  return Object.entries(categoryMeta).map(([value, meta]) => ({
    value,
    label: meta.label
  }));
}


