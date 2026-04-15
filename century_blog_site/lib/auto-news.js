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
  return hook.length > 220 ? `${hook.slice(0, 217).trim()}...` : hook;
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
  const regionLine = article.regionFocus === "nigeria"
    ? "Because Century Blog prioritises Nigeria, this development is especially important for readers tracking how local events connect to daily life, business, and policy shifts."
    : "This story has been included in the global mix because it is part of the wider conversation shaping headlines beyond Nigeria and could still matter to readers watching international trends.";

  return [
    `${title} is one of the latest stories drawing attention right now, and the conversation is building because the issue connects directly to what readers care about: impact, urgency, and what could happen next. The report, which emerged through ${sourceName}, has quickly entered the wider news cycle and is already shaping how people are discussing the subject online and offline.`,
    "",
    `At the centre of the story is a simple question: why does this matter now? ${description} Rather than treating the headline as a passing trend, it helps to look at the context around it, the people affected, and the likely ripple effect over the next few days.`,
    "",
    "## Why this story matters",
    "",
    `${regionLine} Readers often respond strongly to stories like this because they touch public confidence, practical decision-making, and the broader mood around current affairs. In many cases, what looks like a single headline can signal a bigger pattern in governance, society, technology, business, or culture.`,
    "",
    `Another reason this update is gaining traction is timing. News attention moves quickly, but stories with real-world consequences tend to linger longer in search, social feeds, and conversations between friends, workers, students, and families. When a headline keeps showing up across multiple channels, it usually means the audience wants clarity, not just speed.`,
    "",
    "## The latest angle readers should watch",
    "",
    `${context} As more details emerge, the strongest reader interest will likely focus on accountability, practical outcomes, and whether the next official steps match the seriousness of the issue. That is where the story moves from being merely trending to being genuinely useful.`,
    "",
    `For Century Blog, the goal is not to repeat a source article word for word, but to give readers a clean, original summary that explains the stakes. That means highlighting what the headline means, why it is circulating so widely, and what kind of developments are most likely to follow.`,
    "",
    "## What happens next",
    "",
    `The next phase of this story will probably be shaped by official statements, reactions from affected groups, and how quickly new evidence or updates come into public view. Readers should watch for follow-up clarification, policy responses, and whether the conversation remains strong beyond the first wave of attention.`,
    "",
    `In the meantime, this remains a high-interest story because it sits at the intersection of relevance and momentum. It is timely enough to matter today, but broad enough to keep influencing search behaviour, social discussion, and daily news consumption in the hours ahead.`
  ].join("\n");
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

  const systemPrompt = [
    "You are rewriting a trending news item into an original Century Blog article.",
    "Return only valid JSON with these keys: title, excerpt, content, category, author.",
    "The article must be original, human-first, SEO-friendly, and not copy source phrasing.",
    "Write in polished newsroom English with a modern blog voice.",
    "Keep excerpt under 240 characters.",
    "Write article content in Markdown with 3 subheadings using ##.",
    "Keep the body around 500 to 650 words.",
    "Allowed categories: nigeria, world, business, tech, entertainment, health, lifestyle, education, daily-gist.",
    "Prefer nigeria when the story is Nigeria-focused, otherwise choose the best fitting category.",
    "Do not mention that an AI wrote the article."
  ].join(" ");

  const userPrompt = JSON.stringify({
    publication: "Century Blog",
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
            content: [{ type: "input_text", text: systemPrompt }]
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
      excerpt: trimToLength(parsed.excerpt || baseCandidate.excerpt, 280),
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
    openAiModel: OPENAI_REWRITE_MODEL
  };
}

export function getAutomationCategoryOptions() {
  return Object.entries(categoryMeta).map(([value, meta]) => ({
    value,
    label: meta.label
  }));
}
