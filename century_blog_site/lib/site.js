const categoryMeta = {
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

export function getSiteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || "https://www.centurybloggs.com";
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
