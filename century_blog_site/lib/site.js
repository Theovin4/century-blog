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
    label: "Tech",
    accent: "linear-gradient(135deg, #00c6ff, #0072ff)",
    description: "Technology trends, digital products, startups, AI, and innovation updates."
  },
  entertainment: {
    label: "Entertainment",
    accent: "linear-gradient(135deg, #ff6a88, #ff99ac)",
    description: "Celebrities, music, film, creators, and internet culture worth watching."
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
    label: "Daily Gist",
    accent: "linear-gradient(135deg, #7f7fd5, #91eae4)",
    description: "Trending headlines, buzz, and current conversations in Nigeria."
  }
};

export const featuredCategoryOptions = ["nigeria", "world", "business", "tech", "entertainment", "health"];
export const categoryOptions = Object.keys(categoryMeta);
export const editorCategoryOptions = categoryOptions;

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

export function getSiteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || "https://centuryblogg.vercel.app";
}

export function getSubstackUrl() {
  return process.env.NEXT_PUBLIC_SUBSTACK_URL || "";
}

export function getSubstackSubscribeUrl() {
  return process.env.SUBSTACK_SUBSCRIBE_URL || "";
}

export function isAbsoluteUrl(value) {
  return /^https?:\/\//i.test(String(value || ""));
}

export function toAbsoluteUrl(value) {
  if (!value) {
    return "";
  }

  if (isAbsoluteUrl(value)) {
    return value;
  }

  return `${getSiteUrl()}${String(value).startsWith("/") ? "" : "/"}${value}`;
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

export function getPostTypeMeta(type) {
  return postTypeMeta[type] || postTypeMeta.manual;
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
  const words = content.trim().split(/\s+/).filter(Boolean).length;
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
    `${getPostTypeMeta(post.type || "manual").label.toLowerCase()} post`,
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

export function prioritizePosts(posts, { preferManual = true } = {}) {
  return [...(posts || [])].sort((left, right) => {
    if (left.featured !== right.featured) {
      return left.featured ? -1 : 1;
    }

    if (preferManual && (left.type || "manual") !== (right.type || "manual")) {
      return (left.type || "manual") === "manual" ? -1 : 1;
    }

    return new Date(right.publishedAt) - new Date(left.publishedAt);
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

  const recentPosts = prioritizedPosts.slice(0, 5);
  const mediaFirstPool = recentPosts.filter(
    (post) => isImageMedia(post.mediaUrl, post.mediaType) || isVideoMedia(post.mediaUrl, post.mediaType)
  );
  const candidatePool = mediaFirstPool.length ? mediaFirstPool : recentPosts;

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
