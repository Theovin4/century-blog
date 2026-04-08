export const categoryMeta = {
  lifestyle: {
    label: "Lifestyle",
    accent: "linear-gradient(135deg, #ff9966, #ff5e62)",
    description: "Culture, wellness, style, and everyday living stories."
  },
  health: {
    label: "Health",
    accent: "linear-gradient(135deg, #2af598, #009efd)",
    description: "Public health updates, wellness advice, and medical developments."
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

export const categoryOptions = Object.keys(categoryMeta);

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

export function isValidCategory(category) {
  return categoryOptions.includes(category);
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
    lifestyle: "cover-warm",
    health: "cover-cyan",
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
  return [
    "Century Blog",
    post.title,
    `${category} news`,
    `${category} blog`,
    `${category} updates`,
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

export function pickFeaturedPost(posts) {
  if (!Array.isArray(posts) || posts.length === 0) {
    return null;
  }

  const manuallyFeatured = posts.find((post) => post.featured);

  if (manuallyFeatured) {
    return manuallyFeatured;
  }

  const recentPosts = posts.slice(0, 5);
  const mediaFirstPool = recentPosts.filter(
    (post) => isImageMedia(post.mediaUrl, post.mediaType) || isVideoMedia(post.mediaUrl, post.mediaType)
  );
  const candidatePool = mediaFirstPool.length ? mediaFirstPool : recentPosts;

  if (!candidatePool.length) {
    return posts[0] || null;
  }

  const rotationWindowMs = 30 * 1000;
  const rotationIndex = Math.floor(Date.now() / rotationWindowMs) % candidatePool.length;
  return candidatePool[rotationIndex];
}

export function filterPosts(posts, filters = {}) {
  const query = String(filters.query || "").trim().toLowerCase();
  const category = String(filters.category || "").trim();

  return posts.filter((post) => {
    const matchesCategory = category ? post.category === category : true;
    const matchesQuery = query
      ? [post.title, post.excerpt, post.content, post.author]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(query))
      : true;

    return matchesCategory && matchesQuery;
  });
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

