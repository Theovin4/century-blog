export const categoryMeta = {
  nigeria: {
    label: "Nigeria",
    accent: "linear-gradient(135deg, #12c2e9, #0f8bff)",
    description: "Nigeria-first headlines, politics, economy, and stories driving daily conversation."
  },
  world: {
    label: "World",
    accent: "linear-gradient(135deg, #8e2de2, #4a00e0)",
    description: "Global trending stories, geopolitics, and major headlines beyond Nigeria."
  },
  business: {
    label: "Business",
    accent: "linear-gradient(135deg, #f7971e, #ffd200)",
    description: "Markets, money, jobs, entrepreneurship, and business developments that matter."
  },
  tech: {
    label: "Technology",
    accent: "linear-gradient(135deg, #00c6ff, #0072ff)",
    description: "Technology trends, digital products, startups, AI, and innovation updates with practical context."
  },
  entertainment: {
    label: "Entertainment & Sports",
    accent: "linear-gradient(135deg, #ff6a88, #ff99ac)",
    description: "Celebrities, music, film, sports, creators, and internet culture worth watching."
  },
  health: {
    label: "Health",
    accent: "linear-gradient(135deg, #2af598, #009efd)",
    description: "Public health updates, wellness advice, and medical developments."
  },
  lifestyle: {
    label: "Lifestyle",
    accent: "linear-gradient(135deg, #ff9966, #ff5e62)",
    description: "Culture, wellness, style, and everyday living stories."
  },
  education: {
    label: "Education",
    accent: "linear-gradient(135deg, #f7971e, #ffd200)",
    description: "School news, exams, admissions, and learning opportunities."
  },
  "daily-gist": {
    label: "Daily Gist & Culture",
    accent: "linear-gradient(135deg, #7f7fd5, #91eae4)",
    description: "Trending headlines, cultural conversations, and current buzz people in Nigeria are following closely."
  }
};

export const featuredCategoryOptions = ["nigeria", "world", "business", "tech", "entertainment", "lifestyle", "health"];
export const categoryOptions = Object.keys(categoryMeta);
export const editorCategoryOptions = categoryOptions;
export const MAX_POST_CONTENT_LENGTH = 60000;

export const postTypeMeta = {
  manual: {
    label: "Manual",
    description: "Published from the dashboard by the Century Blog team."
  },
  auto: {
    label: "Auto",
    description: "Fetched, rewritten, and published by the automation pipeline."
  }
};

export const postTypeOptions = Object.keys(postTypeMeta);
export const workflowStatusMeta = {
  draft: { label: "Draft" },
  pending_review: { label: "Pending Review" },
  approved: { label: "Approved" },
  published: { label: "Published" },
  rejected: { label: "Rejected" },
  scheduled: { label: "Scheduled" }
};
export const workflowStatusOptions = Object.keys(workflowStatusMeta);

export const socialLinks = [
  {
    label: "Facebook",
    shortLabel: "FB",
    href: "https://www.facebook.com/share/1HiQttvcY9/"
  },
  {
    label: "Instagram",
    shortLabel: "IG",
    href: "https://www.instagram.com/centuryblogg?igsh=MXVod215dXR0emh5Ng=="
  },
  {
    label: "X",
    shortLabel: "X",
    href: "https://x.com/Centuryblogg"
  },
  {
    label: "TikTok",
    shortLabel: "TT",
    href: "https://www.tiktok.com/@centuryblog?_t=ZS-8zilxELlZwO&_r=1"
  },
  {
    label: "YouTube",
    shortLabel: "YT",
    href: "https://www.youtube.com/channel/UC-sjrlVxH4rBp6967rc2QeQ"
  },
  {
    label: "Pinterest",
    shortLabel: "PT",
    href: "https://pin.it/VqLX3zjoS"
  },
  {
    label: "Telegram",
    shortLabel: "TG",
    href: "https://t.me/centuryblog"
  }
];

export const PRIMARY_SITE_URL = "https://www.centuryblog.com.ng";
export const REDIRECT_SITE_URL = "https://centuryblog.com.ng";

const INTERNAL_SITE_HOSTNAMES = new Set([
  "www.centuryblog.com.ng",
  "centuryblog.com.ng",
  "centuryblogg.vercel.app",
  "centuryblog.vercel.app"
]);

const countryNames = [
  "Nigeria",
  "Ghana",
  "Kenya",
  "South Africa",
  "Uganda",
  "Tanzania",
  "Rwanda",
  "Cameroon",
  "Egypt",
  "Morocco",
  "United States",
  "Canada",
  "United Kingdom",
  "France",
  "Germany",
  "Italy",
  "Spain",
  "Netherlands",
  "Brazil",
  "India",
  "China",
  "Japan",
  "Australia",
  "United Arab Emirates",
  "Saudi Arabia"
];

function trimTrailingSlash(value) {
  return String(value || "").trim().replace(/\/+$/g, "");
}

function getKnownSiteHostnames() {
  const hostnames = new Set(INTERNAL_SITE_HOSTNAMES);

  try {
    hostnames.add(new URL(getSiteUrl()).hostname.toLowerCase());
  } catch {
    // Ignore invalid env configuration and fall back to known hostnames.
  }

  return hostnames;
}

function normalizeInternalSiteUrl(value) {
  const raw = String(value || "").trim();

  if (!isAbsoluteUrl(raw)) {
    return raw;
  }

  try {
    const target = new URL(raw);

    if (!getKnownSiteHostnames().has(target.hostname.toLowerCase())) {
      return raw;
    }

    return `${getSiteUrl()}${target.pathname}${target.search}${target.hash}`;
  } catch {
    return raw;
  }
}

export function getSiteUrl() {
  return trimTrailingSlash(process.env.NEXT_PUBLIC_APP_URL) || PRIMARY_SITE_URL;
}

export function buildPageMetadata({
  title,
  description,
  path = "/",
  keywords = [],
  type = "website"
}) {
  const siteUrl = getSiteUrl();
  const canonical = `${siteUrl}${path === "/" ? "" : path}`;
  const defaultImage = `${siteUrl}/century-blog-logo.png`;

  return {
    title,
    description,
    keywords,
    alternates: {
      canonical
    },
    openGraph: {
      title: `${title} | Century Blog`,
      description,
      url: canonical,
      siteName: "Century Blog",
      locale: "en_NG",
      type,
      images: [
        {
          url: defaultImage,
          width: 768,
          height: 768,
          alt: "Century Blog logo"
        }
      ]
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | Century Blog`,
      description,
      images: [defaultImage]
    }
  };
}

export function getSubstackUrl() {
  return process.env.NEXT_PUBLIC_SUBSTACK_URL || "";
}

export function getSubstackSubscribeUrl() {
  return process.env.SUBSTACK_SUBSCRIBE_URL || "";
}

export function isCloudinaryUrl(value) {
  return /res\.cloudinary\.com/i.test(String(value || ""));
}

export function buildCloudinaryVideoPosterUrl(url) {
  const target = String(url || "");

  if (!isCloudinaryUrl(target) || !target.includes("/video/upload/")) {
    return "";
  }

  const poster = target.replace("/video/upload/", "/video/upload/so_0,f_jpg,q_auto/");
  return poster.replace(/\.[a-z0-9]+(\?|$)/i, ".jpg$1");
}

export function isAbsoluteUrl(value) {
  return /^https?:\/\//i.test(String(value || ""));
}

export function toAbsoluteUrl(value) {
  if (!value) {
    return "";
  }

  if (isAbsoluteUrl(value)) {
    return normalizeInternalSiteUrl(value);
  }

  return `${getSiteUrl()}${String(value).startsWith("/") ? "" : "/"}${value}`;
}

export function getProxiedImageUrl(value) {
  const target = normalizeInternalSiteUrl(String(value || "").trim());

  if (!target) {
    return "";
  }

  if (!isAbsoluteUrl(target) || isCloudinaryUrl(target) || target.startsWith(getSiteUrl())) {
    return target;
  }

  return `${getSiteUrl()}/api/image-proxy?url=${encodeURIComponent(target)}`;
}

export function formatLongDate(value) {
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date(value));
}

export function getCategoryMeta(category) {
  return categoryMeta[category] || categoryMeta["daily-gist"];
}

export function getAuthorProfile(author) {
  const name = String(author || "").trim() || "Century Blog Editorial Team";

  if (/century blog/i.test(name)) {
    return {
      name,
      bio: "Century Blog Editorial Team reports, edits, and reviews stories with an emphasis on clarity, source awareness, and everyday relevance for readers in Nigeria and beyond."
    };
  }

  if (/desk/i.test(name)) {
    return {
      name,
      bio: `${name} covers developing stories and wider context for Century Blog readers, with a focus on accuracy, readability, and useful follow-through.`
    };
  }

  return {
    name,
    bio: `${name} writes and contributes to Century Blog coverage with a focus on clear reporting, context, and reader-first storytelling.`
  };
}

export function getArticleSchemaType(post) {
  const category = String(post?.category || "");
  const hasSource = Boolean(post?.sourceName || post?.sourceUrl);
  const isNewsCategory = ["nigeria", "world", "business", "health", "education", "daily-gist"].includes(category);

  return hasSource || post?.type === "auto" || isNewsCategory ? "NewsArticle" : "BlogPosting";
}

export function getArticleDisclaimer(post) {
  const text = `${post?.title || ""} ${post?.excerpt || ""} ${post?.content || ""}`.toLowerCase();
  const category = String(post?.category || "").toLowerCase();
  const checks = [
    {
      match:
        category === "health" ||
        /\bhealth|virus|disease|hospital|medical|treatment|symptom|outbreak|hiv|aids\b/.test(text),
      title: "Health reporting note",
      body: "This article is for general information and context only. Readers should rely on qualified medical professionals, public health agencies, or official guidance for personal health decisions."
    },
    {
      match:
        category === "business" ||
        /\bnaira|inflation|economy|market|budget|interest rate|investment|oil|stocks|bank\b/.test(text),
      title: "Financial context note",
      body: "This article is for news and analysis purposes only. It should not be treated as personal financial advice, investment advice, or a substitute for professional guidance."
    },
    {
      match:
        category === "world" ||
        category === "nigeria" ||
        /\bwar|military|election|protest|conflict|attack|security|government|senate|president|minister\b/.test(text),
      title: "Developing story note",
      body: "Some details in fast-moving political, conflict, or security stories can change as official statements and on-the-ground reporting are updated. Readers should watch for newer verified developments."
    }
  ];

  return checks.find((item) => item.match) || null;
}

export function isSensitivePost(post) {
  const text = `${post?.title || ""} ${post?.excerpt || ""} ${post?.content || ""}`.toLowerCase();
  const category = String(post?.category || "").toLowerCase();

  return (
    category === "health" ||
    category === "business" ||
    category === "world" ||
    (category === "nigeria" &&
      /\bpolitic|government|security|crime|court|election|governor|senate|president|minister|attack|violence\b/.test(text)) ||
    /\bwar|military|conflict|iran|trump|senate|election|crime|fraud|arrest|court|health|virus|disease|hospital|medical|naira|inflation|forex|cbn|bank|market\b/.test(
      text
    )
  );
}

export function getSensitiveSourceNote(post) {
  if (!isSensitivePost(post)) {
    return null;
  }

  const hasSourceAttribution = Boolean(post?.sourceName || post?.sourceUrl);

  if (hasSourceAttribution) {
    return "This report should be read alongside official updates and verified source links where available.";
  }

  return "This report should be read alongside official updates and verified source links where available. Source details should be added as reporting develops.";
}

export function getActiveCategories(posts, availableCategories = categoryOptions) {
  const counts = new Map();

  for (const post of posts || []) {
    if (!isValidCategory(post?.category)) {
      continue;
    }

    counts.set(post.category, (counts.get(post.category) || 0) + 1);
  }

  return availableCategories.filter((category) => (counts.get(category) || 0) > 0);
}

export function getPostTypeMeta(type) {
  return postTypeMeta[type] || postTypeMeta.manual;
}

export function getWorkflowStatusMeta(status) {
  return workflowStatusMeta[status] || workflowStatusMeta.draft;
}

export function isValidCategory(category) {
  return categoryOptions.includes(category);
}

export function isValidPostType(type) {
  return postTypeOptions.includes(type);
}

export function slugify(input) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function estimateReadTime(content) {
  const words = normalizeMarkdownContent(content).trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.round(words / 220));
  return `${minutes} min read`;
}

export function getCoverStyle(category) {
  const styles = {
    nigeria: "cover-violet",
    world: "cover-cyan",
    business: "cover-gold",
    tech: "cover-cyan",
    entertainment: "cover-warm",
    health: "cover-cyan",
    lifestyle: "cover-warm",
    education: "cover-gold",
    "daily-gist": "cover-violet"
  };

  return styles[category] || styles["daily-gist"];
}

function replaceCloudinaryUploadTransform(target, resourceType, transform) {
  const pattern = new RegExp(`/${resourceType}/upload/(?:[^/]+/)?`);
  return target.replace(pattern, `/${resourceType}/upload/${transform}/`);
}

export function getOptimizedImageUrl(
  url,
  { width = 1200, height = 900, fit = "fill", quality = "auto:good" } = {}
) {
  const target = String(url || "");

  if (!isCloudinaryUrl(target)) {
    return target;
  }

  const crop = fit === "fit" ? "c_fit" : "c_fill,g_auto";
  const transform = `f_auto,q_${quality},dpr_auto,${crop},w_${width},h_${height},e_sharpen`;
  return replaceCloudinaryUploadTransform(target, "image", transform);
}

export function getOptimizedVideoUrl(
  url,
  { width = 1200, height = 900, quality = "auto:good" } = {}
) {
  const target = String(url || "");

  if (!isCloudinaryUrl(target)) {
    return target;
  }

  const transform = `f_auto,q_${quality},vc_auto,c_fill,g_auto,w_${width},h_${height}`;
  return replaceCloudinaryUploadTransform(target, "video", transform);
}

function splitTitleLines(title, maxLineLength = 26) {
  const words = String(title || "Century Blog").trim().split(/\s+/).filter(Boolean);

  if (!words.length) {
    return ["Century Blog"];
  }

  const lines = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;

    if (next.length <= maxLineLength || !current) {
      current = next;
      continue;
    }

    lines.push(current);
    current = word;

    if (lines.length === 2) {
      break;
    }
  }

  if (current && lines.length < 3) {
    lines.push(current);
  }

  if (lines.length > 3) {
    return lines.slice(0, 3);
  }

  if (lines.length === 3 && words.join(" ").length > lines.join(" ").length) {
    lines[2] = `${lines[2].slice(0, Math.max(0, maxLineLength - 3)).trimEnd()}...`;
  }

  return lines;
}

function getFallbackCoverPalette(category) {
  const palettes = {
    nigeria: { start: "#0b1020", end: "#155eef", glow: "#12c2e9" },
    world: { start: "#12071f", end: "#4a00e0", glow: "#8e2de2" },
    business: { start: "#2b1901", end: "#f59e0b", glow: "#ffd200" },
    tech: { start: "#062033", end: "#0072ff", glow: "#00c6ff" },
    entertainment: { start: "#3b0f1a", end: "#ff6a88", glow: "#ff99ac" },
    health: { start: "#06292d", end: "#009efd", glow: "#2af598" },
    lifestyle: { start: "#361410", end: "#ff5e62", glow: "#ff9966" },
    education: { start: "#2f1d02", end: "#f59e0b", glow: "#ffd200" },
    "daily-gist": { start: "#170d2b", end: "#7f7fd5", glow: "#91eae4" }
  };

  return palettes[category] || palettes["daily-gist"];
}

function buildFallbackCoverDataUri(post, { width = 1200, height = 900 } = {}) {
  const palette = getFallbackCoverPalette(post?.category);
  const titleLines = splitTitleLines(post?.title || "Century Blog");
  const categoryLabel = getCategoryMeta(post?.category).label.toUpperCase();
  const publishedLabel = post?.publishedAt ? formatLongDate(post.publishedAt).toUpperCase() : "CENTURY BLOG";
  const lineY = [height * 0.56, height * 0.66, height * 0.76];

  const titleMarkup = titleLines
    .map(
      (line, index) =>
        `<text x="72" y="${lineY[index]}" fill="#f8fafc" font-size="${Math.round(height * 0.078)}" font-weight="800" font-family="Georgia, 'Times New Roman', serif">${escapeHtml(line)}</text>`
    )
    .join("");

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(post?.title || "Century Blog")}">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${palette.start}" />
          <stop offset="100%" stop-color="${palette.end}" />
        </linearGradient>
        <radialGradient id="glow" cx="0.82" cy="0.12" r="0.7">
          <stop offset="0%" stop-color="${palette.glow}" stop-opacity="0.55" />
          <stop offset="100%" stop-color="${palette.glow}" stop-opacity="0" />
        </radialGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#bg)" rx="36" />
      <rect width="${width}" height="${height}" fill="url(#glow)" rx="36" />
      <circle cx="${Math.round(width * 0.84)}" cy="${Math.round(height * 0.18)}" r="${Math.round(height * 0.16)}" fill="rgba(255,255,255,0.12)" />
      <rect x="56" y="56" width="${Math.round(width * 0.34)}" height="46" rx="23" fill="rgba(6,10,18,0.38)" stroke="rgba(255,255,255,0.18)" />
      <text x="80" y="86" fill="#dff7ff" font-size="20" font-weight="700" font-family="'Segoe UI', sans-serif" letter-spacing="1.6">${escapeHtml(categoryLabel)}</text>
      <text x="72" y="${Math.round(height * 0.18)}" fill="rgba(255,255,255,0.72)" font-size="24" font-weight="600" font-family="'Segoe UI', sans-serif">CENTURY BLOG</text>
      ${titleMarkup}
      <text x="72" y="${height - 74}" fill="rgba(255,255,255,0.76)" font-size="22" font-weight="600" font-family="'Segoe UI', sans-serif">${escapeHtml(publishedLabel)}</text>
    </svg>
  `.trim();

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function getDisplayMedia(post, variant = "card") {
  const mediaUrl = post?.originalMediaUrl || post?.mediaUrl || "";
  const mediaType = post?.mediaType || inferMediaType(mediaUrl);

  const sizes = {
    feature: { width: 1440, height: 1040 },
    story: { width: 960, height: 720 },
    card: { width: 760, height: 540 },
    article: { width: 1600, height: 1100 }
  };

  const selected = sizes[variant] || sizes.card;

  if (isImageMedia(mediaUrl, mediaType)) {
    return {
      kind: "image",
      url: getOptimizedImageUrl(mediaUrl, selected),
      originalUrl: mediaUrl,
      type: mediaType
    };
  }

  if (isVideoMedia(mediaUrl, mediaType)) {
    const posterBase = post?.posterUrl || buildCloudinaryVideoPosterUrl(mediaUrl);
    return {
      kind: "video",
      url: getOptimizedVideoUrl(mediaUrl, selected),
      posterUrl: posterBase ? getOptimizedImageUrl(posterBase, selected) : "",
      originalUrl: mediaUrl,
      type: mediaType || "video/mp4"
    };
  }

  return {
    kind: "image",
    url: buildFallbackCoverDataUri(post, selected),
    originalUrl: "",
    type: "image/svg+xml",
    generated: true
  };
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function normalizeStoredText(value) {
  return String(value || "")
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, "\"")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u2022/g, "-")
    .replace(/\u00A0/g, " ")
    .replace(/\uFFFD/g, "'")
    .trimEnd();
}

function convertStandaloneImageUrlsToMarkdown(value) {
  return String(value || "")
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("![")) {
        return line;
      }

      const candidate = trimmed.replace(/^<|>$/g, "");

      if (!/^https?:\/\//i.test(candidate) || !isImageMedia(candidate)) {
        return line;
      }

      return `![](${candidate})`;
    })
    .join("\n");
}

function convertHtmlImagesToMarkdown(value) {
  return String(value || "").replace(/<img\b[^>]*src=["']([^"'<>]+)["'][^>]*alt=["']([^"'<>]*)["'][^>]*>/gi, "![$2]($1)")
    .replace(/<img\b[^>]*alt=["']([^"'<>]*)["'][^>]*src=["']([^"'<>]+)["'][^>]*>/gi, "![$1]($2)")
    .replace(/<img\b[^>]*src=["']([^"'<>]+)["'][^>]*>/gi, "![]($1)");
}

export function normalizeMarkdownContent(value) {
  return convertStandaloneImageUrlsToMarkdown(
    convertHtmlImagesToMarkdown(normalizeStoredText(value))
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<p[^>]*>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
  );
}

export function getRenderableContent(postOrContent) {
  if (postOrContent && typeof postOrContent === "object") {
    return normalizeMarkdownContent(postOrContent.content);
  }

  return normalizeMarkdownContent(postOrContent);
}

export function formatArticleContent(content) {
  return getRenderableContent(content);
}

export function extractMarkdownHeadings(content, { minDepth = 2, maxDepth = 3 } = {}) {
  const normalized = getRenderableContent(content);

  return normalized
    .split("\n")
    .map((line) => line.trim())
    .map((line) => {
      const match = /^(#{2,3})\s+(.+?)\s*$/.exec(line);

      if (!match) {
        return null;
      }

      const depth = match[1].length;

      if (depth < minDepth || depth > maxDepth) {
        return null;
      }

      const text = match[2]
        .replace(/\*\*(.+?)\*\*/g, "$1")
        .replace(/\*(.+?)\*/g, "$1")
        .replace(/`(.+?)`/g, "$1")
        .trim();

      if (!text) {
        return null;
      }

      return {
        depth,
        text,
        id: slugify(text)
      };
    })
    .filter(Boolean);
}

export function inferMediaType(value) {
  const target = String(value || "").toLowerCase();

  if (!target) {
    return "";
  }

  if (target.includes("image/") || /\.(png|jpe?g|webp|gif|svg|avif)(\?|$)/.test(target)) {
    if (target.includes("image/")) {
      return target;
    }

    if (target.includes(".svg")) {
      return "image/svg+xml";
    }

    if (target.includes(".png")) {
      return "image/png";
    }

    if (target.includes(".webp")) {
      return "image/webp";
    }

    if (target.includes(".gif")) {
      return "image/gif";
    }

    if (target.includes(".avif")) {
      return "image/avif";
    }

    return "image/jpeg";
  }

  if (target.includes("video/") || /\.(mp4|webm|mov|m4v|ogg)(\?|$)/.test(target)) {
    if (target.includes("video/")) {
      return target;
    }

    if (target.includes(".webm")) {
      return "video/webm";
    }

    if (target.includes(".ogg")) {
      return "video/ogg";
    }

    if (target.includes(".mov")) {
      return "video/quicktime";
    }

    return "video/mp4";
  }

  return "";
}

export function isImageMedia(mediaUrl, mediaType) {
  return inferMediaType(mediaType || mediaUrl).startsWith("image/");
}

export function isVideoMedia(mediaUrl, mediaType) {
  return inferMediaType(mediaType || mediaUrl).startsWith("video/");
}

export function extractMentionedCountries(input) {
  const text = String(input || "");
  return countryNames.filter((country) => new RegExp(`\\b${country.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\b`, "i").test(text));
}

export function buildPostKeywords(post) {
  const category = getCategoryMeta(post.category).label;
  const countries = extractMentionedCountries(`${post.title} ${post.excerpt} ${post.content}`);
  const regionKeywords = post.regionFocus === "nigeria"
    ? ["Nigeria news", "Nigerian blog", "Africa headlines"]
    : ["world news", "global headlines", "international news blog"];

  return [
    "Century Blog",
    post.title,
    `${category} news`,
    `${category} blog`,
    `${category} updates`,
    ...regionKeywords,
    ...countries,
    ...countries.map((country) => `${country} news`),
    ...countries.map((country) => `${country} lifestyle`),
    ...countries.map((country) => `${country} education`),
    ...countries.map((country) => `${country} health`)
  ].filter(Boolean);
}

export function buildCategoryKeywords(category) {
  const meta = getCategoryMeta(category);
  return [
    "Century Blog",
    `${meta.label} blog`,
    `${meta.label} news`,
    `${meta.label} updates`,
    `Nigeria ${meta.label.toLowerCase()}`,
    `global ${meta.label.toLowerCase()} stories`
  ];
}

export function buildBreadcrumbJsonLd(items) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url
    }))
  };
}

export function getPostTimestamp(post) {
  const timestamp = new Date(
    post?.sitePublishedAt ||
    post?.publishedAt ||
    post?.approvedAt ||
    post?.createdAt ||
    ""
  ).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function sortPostsByRecency(posts) {
  return [...(posts || [])].sort((left, right) => getPostTimestamp(right) - getPostTimestamp(left));
}

export function prioritizePosts(posts, { preferManual = false } = {}) {
  return [...(posts || [])].sort((left, right) => {
    if (left.featured !== right.featured) {
      return left.featured ? -1 : 1;
    }

    if (preferManual && (left.type || "manual") !== (right.type || "manual")) {
      return (left.type || "manual") === "manual" ? -1 : 1;
    }

    return getPostTimestamp(right) - getPostTimestamp(left);
  });
}

export function pickFeaturedPost(posts) {
  if (!Array.isArray(posts) || posts.length === 0) {
    return null;
  }

  const prioritizedPosts = prioritizePosts(posts);
  const manuallyFeatured = prioritizedPosts.find((post) => post.featured);

  if (manuallyFeatured) {
    return manuallyFeatured;
  }

  const candidatePool = sortPostsByRecency(prioritizedPosts).slice(0, 5);

  if (!candidatePool.length) {
    return prioritizedPosts[0] || null;
  }

  const rotationWindowMs = 30 * 1000;
  const rotationIndex = Math.floor(Date.now() / rotationWindowMs) % candidatePool.length;
  return candidatePool[rotationIndex];
}

export function filterPosts(posts, filters = {}) {
  const query = String(filters.query || "").trim().toLowerCase();
  const category = String(filters.category || "").trim();
  const postType = String(filters.postType || "").trim();

  return posts.filter((post) => {
    const matchesCategory = category ? post.category === category : true;
    const matchesType = postType ? (post.type || "manual") === postType : true;
    const matchesQuery = query
      ? [post.title, post.excerpt, post.content, post.author, post.sourceName]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(query))
      : true;

    return matchesCategory && matchesType && matchesQuery;
  });
}

export function getTopStories(posts, limit = 4) {
  return prioritizePosts(posts).slice(0, limit);
}

export function getMostReadPosts(posts, limit = 4) {
  return [...(posts || [])]
    .sort((left, right) => {
      const leftScore = Number(left.trendingScore || 0) + (left.featured ? 10 : 0);
      const rightScore = Number(right.trendingScore || 0) + (right.featured ? 10 : 0);

      if (leftScore !== rightScore) {
        return rightScore - leftScore;
      }

      return new Date(right.publishedAt) - new Date(left.publishedAt);
    })
    .slice(0, limit);
}

export function getPostUrl(post) {
  return `${getSiteUrl()}/news/${post.slug}`;
}

export function buildShareLinks(post) {
  const postUrl = getPostUrl(post);
  const encodedUrl = encodeURIComponent(postUrl);
  const encodedTitle = encodeURIComponent(`${post.title} | Century Blog`);
  const encodedMedia = encodeURIComponent(toAbsoluteUrl(post.mediaUrl || "/century-blog-logo.png"));

  return {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    x: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
    telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`,
    pinterest: `https://pinterest.com/pin/create/button/?url=${encodedUrl}&media=${encodedMedia}&description=${encodedTitle}`
  };
}



