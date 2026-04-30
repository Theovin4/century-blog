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
  return hook.length > 220 ? `${hook.slice(0, 217).trim()}...` : hook;
}

function trimToLength(value, maxLength) {
  const text = String(value || "").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 3).trim()}...` : text;
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
  const regionLine = article.regionFocus === "nigeria"
    ? "For Nigerian readers, the practical value of this story is not just the headline itself but how it could affect daily decisions, public conversation, and the wider national mood."
    : "Even when a story breaks outside Nigeria, the useful question is what it signals for readers who follow markets, politics, culture, technology, or public life from a global perspective.";
  const localRelevance = article.regionFocus === "nigeria"
    ? "That local relevance matters because readers are often looking for direct consequences: transport costs, policy changes, school decisions, business sentiment, consumer confidence, or how public institutions respond after the first headline."
    : "That wider relevance matters because international stories often influence prices, investor confidence, migration conversations, social media trends, diplomatic pressure, and the way local audiences interpret big global events.";

  return [
    `${title} is drawing attention because it sits at the point where public interest, timing, and real-world impact meet. According to reporting linked to ${sourceName}, the issue is already moving beyond a simple headline and into the wider conversation about what happens next.`,
    "",
    `${description} Rather than treating the update as background noise, it helps to look at what led to this moment, who is affected, and why the next few days could matter just as much as the first report.`,
    "",
    "## Background and context",
    "",
    `${context} In fast-moving news cycles, the first version of a story usually creates curiosity, but the background is what gives it real meaning. That is why readers look beyond the headline for context, competing viewpoints, and signs of whether the matter is likely to grow or cool down quickly.`,
    "",
    `${regionLine} ${localRelevance}`,
    "",
    "## What the update means in practice",
    "",
    `What makes this kind of story important is the chain reaction it can create. A policy issue can affect households and businesses. A business story can shape spending and confidence. A technology or cultural story can alter behaviour, opportunities, and online conversation almost immediately. Readers do not only want to know what happened; they want to know what it changes.`,
    "",
    `In this case, the strongest reader questions are likely to centre on accountability, direct impact, and whether official reactions match the seriousness of the moment. If the issue involves government, people will watch for clarity and implementation. If it involves business, they will watch for prices, confidence, and operational consequences. If it touches culture or public sentiment, they will watch how quickly the reaction spreads and whether it lasts.`,
    "",
    "## Examples and practical insight",
    "",
    `A useful way to read stories like this is to compare them with similar moments from the past. Sometimes the first wave of reaction is emotional, but the deeper impact only appears later in regulation, business behaviour, public trust, or community response. That is why follow-up reporting often matters more than the initial headline.`,
    "",
    `For everyday readers, the practical insight is simple: look for the consequence, not just the noise. Ask who gains, who loses, what changes immediately, and what still depends on confirmation. That approach separates useful reporting from empty hype and helps people make sense of trending developments with more confidence.`,
    "",
    "## Common mistakes to avoid when reading this story",
    "",
    `One common mistake is reacting to the first version of a breaking report as if every key fact is already settled. Another is focusing only on dramatic angles without checking whether the underlying issue has clear evidence, credible sourcing, or likely follow-up action. Fast headlines create momentum, but careful reading creates understanding.`,
    "",
    `It is also easy to miss the local angle. A global event may still affect Nigerian readers through fuel prices, financial markets, technology access, migration decisions, education, or public debate. In the same way, a Nigeria-focused update can have wider relevance when it reflects a broader regional or international trend.`,
    "",
    "## Expert tips for following developments",
    "",
    `The smartest way to track this story is to watch for confirmed statements, policy movement, verified numbers, and follow-up reactions from the people most directly affected. Readers should also pay attention to whether the conversation shifts from emotion to action, because that is usually the point where a trending topic becomes a genuinely important public story.`,
    "",
    `The clearest takeaway is that ${title} matters because it combines timing with consequence. It is not only a story people are talking about now; it is also one that could shape decisions, attitudes, and further reporting in the near term. That is the difference between a passing headline and a story worth following closely.`
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
    "GOAL: Generate a high-quality, 100% original, AdSense-approved blog post that delivers real value, strong user experience, and meets Google content quality standards. Content must be written for humans first, SEO second.",
    "ROLE: Act as an expert SEO content writer, journalist, and subject-matter analyst. Produce engaging, authoritative, and insight-driven content suitable for publication.",
    "Return only valid JSON with these keys: title, metaDescription, excerpt, content, category, author, unsplashImages.",
    "STRICT CONTENT RULES: Content must be 100% original, must not rewrite or paraphrase existing articles, must provide unique insights, real-world relevance, and what-this-means value, and should add Nigerian or local context where appropriate.",
    "The title must be SEO-optimised and click-worthy.",
    "The metaDescription must be 150 to 160 characters, compelling, and naturally keyword-aware.",
    "The excerpt must be concise, compelling, and suitable for homepage cards.",
    "The article must be 700 to 1000 words, written in British English, professional, clear, engaging, natural, and never robotic.",
    "Write the article body in Markdown only.",
    "Use this exact article structure: ## Introduction, ## Context / Background, ## Main Explanation / Guide, ## Practical Examples / Insights, ## Common Mistakes to Avoid, ## Expert Tips / Pro Advice, ## Conclusion.",
    "Use short paragraphs with exactly one blank line between paragraphs.",
    "Use H2 and H3 headings, use bullet points with -, use numbered lists with 1. 2. 3. when helpful, and never use HTML tags.",
    "Naturally include the primary keyword in the title, meta description, and introduction. Use secondary keywords naturally without keyword stuffing.",
    "Sound like a real expert. Be specific, practical, and helpful. Avoid fake statistics, vague claims, AI clichés, fluff, filler, plagiarism, and thin content.",
    "Allowed categories: nigeria, world, business, tech, entertainment, health, lifestyle, education, daily-gist. Prefer nigeria when the story is Nigeria-focused, otherwise choose the best fitting category.",
    "The unsplashImages value must be a JSON object with featuredImage, supportingImage1, supportingImage2, and supportingImage3. Each item must include searchQuery, altText, filename, and placement. Use short specific search queries only, prefer realistic editorial imagery, avoid generic terms, and use broader African context when Nigerian visuals are unlikely."
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
    const featuredImageQuery = String(
      parsed?.unsplashImages?.featuredImage?.searchQuery ||
      parsed?.unsplashImages?.featured_image?.search_query ||
      ""
    ).trim();

    return {
      ...baseCandidate,
      title: trimToLength(parsed.title || baseCandidate.title, 140),
      excerpt: trimToLength(parsed.metaDescription || parsed.excerpt || baseCandidate.excerpt, 280),
      content: String(parsed.content || baseCandidate.content).trim(),
      category,
      author: trimToLength(parsed.author || baseCandidate.author, 80),
      _featuredImageQuery: featuredImageQuery
    };
  } catch {
    return baseCandidate;
  }
}

async function buildCandidate(article) {
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
    mediaUrl: article.mediaUrl || "",
    imageCreditName: article.mediaUrl ? article.sourceName : "",
    imageCreditUrl: article.mediaUrl ? article.sourceUrl : "",
    mediaType: article.mediaType || "image/jpeg",
    publishedAt: article.publishedAt
  };

  const rewrittenCandidate = await rewriteCandidateWithAi(article, baseCandidate);
  const image = await resolveImage(article, rewrittenCandidate._featuredImageQuery || rewrittenCandidate.title);

  return {
    ...rewrittenCandidate,
    mediaUrl: image.mediaUrl,
    imageCreditName: image.imageCreditName,
    imageCreditUrl: image.imageCreditUrl
  };
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


