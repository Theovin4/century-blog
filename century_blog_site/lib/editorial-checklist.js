import { getRenderableContent, getSiteUrl, isSensitivePost, PRIMARY_SITE_URL } from "@/lib/site";

const AI_FILLER_RULES = [
  { label: "generic urgency phrase", pattern: /\bin today'?s fast-paced world\b/i },
  { label: "generic future framing", pattern: /\bas we move forward\b/i },
  { label: "editorial filler", pattern: /\bit is important to note\b/i },
  { label: "cliche transition", pattern: /\bneedless to say\b/i },
  { label: "cliche transition", pattern: /\bwithout further ado\b/i },
  { label: "formulaic conclusion", pattern: /\bin conclusion\b/i },
  { label: "formulaic summary", pattern: /\bthis article explores\b/i },
  { label: "formulaic promise", pattern: /\beverything you need to know\b/i }
];

const AUTHORITATIVE_SOURCE_PATTERNS = [
  /(^|\.)gov(\.[a-z]{2})?$/i,
  /(^|\.)edu$/i,
  /(^|\.)who\.int$/i,
  /(^|\.)worldbank\.org$/i,
  /(^|\.)imf\.org$/i,
  /(^|\.)oecd\.org$/i,
  /(^|\.)un\.org$/i,
  /(^|\.)reuters\.com$/i,
  /(^|\.)apnews\.com$/i,
  /(^|\.)bbc\.com$/i,
  /(^|\.)ft\.com$/i,
  /(^|\.)wsj\.com$/i
];

const AUTHORITY_STYLE_PATTERN =
  /\b(guide|explained|explain|how to|what is|why|vs\b|compare|comparison|complete guide|future of|truth about|ways to|habits|benefits|risks)\b/i;

export const EDITORIAL_GUARDRAILS = [
  "Avoid thin content and repetitive summaries that do not add clear reader value.",
  "Do not copy passages, captions, or images from other publishers without rights or permission.",
  "Do not publish unsupported medical claims or treatment advice.",
  "Do not publish unsupported financial advice, return promises, or investment hype.",
  "Avoid keyword stuffing, forced anchors, and overly repetitive headings.",
  "Strip out AI-sounding filler, vague transitions, and generic conclusions.",
  "Never invent citations, statistics, or unnamed expert claims.",
  "Sensitive stories should include source links when available and cautious wording when facts are still developing.",
  "Add natural internal links before publication so articles support topic clusters.",
  "Do not publish without metadata, image alt text, and a category check."
];

function stripMarkdown(value) {
  return String(value || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[>*_~]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractMarkdownLinks(value) {
  const links = [];
  const pattern = /\[([^\]]+)\]\(([^)]+)\)/g;

  for (const match of String(value || "").matchAll(pattern)) {
    links.push({
      label: String(match[1] || "").trim(),
      href: String(match[2] || "").trim()
    });
  }

  return links;
}

function isInternalHref(href) {
  const value = String(href || "").trim();

  if (!value) {
    return false;
  }

  if (value.startsWith("/")) {
    return true;
  }

  return value.startsWith(PRIMARY_SITE_URL) || value.startsWith(getSiteUrl());
}

function isAuthoritativeExternalHref(href) {
  const value = String(href || "").trim();

  if (!/^https?:\/\//i.test(value)) {
    return false;
  }

  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return AUTHORITATIVE_SOURCE_PATTERNS.some((pattern) => pattern.test(hostname));
  } catch {
    return false;
  }
}

function detectAiFiller(value) {
  return AI_FILLER_RULES.filter((rule) => rule.pattern.test(value)).map((rule) => rule.label);
}

function buildItem(key, label, status, note) {
  return { key, label, status, note };
}

export function buildEditorialChecklist({ draft, activePost, hasMedia = false }) {
  const content = getRenderableContent(draft?.content || "");
  const plainText = stripMarkdown(content);
  const wordCount = plainText ? plainText.split(/\s+/).filter(Boolean).length : 0;
  const links = extractMarkdownLinks(draft?.content || "");
  const internalLinks = links.filter((link) => isInternalHref(link.href));
  const externalLinks = links.filter((link) => /^https?:\/\//i.test(link.href) && !isInternalHref(link.href));
  const authoritativeLinks = externalLinks.filter((link) => isAuthoritativeExternalHref(link.href));
  const aiFillerMatches = detectAiFiller(`${draft?.title || ""} ${draft?.excerpt || ""} ${draft?.content || ""}`);
  const title = String(draft?.title || "").trim();
  const metaDescription = String(draft?.metaDescription || "").trim();
  const seoTitle = String(draft?.seoTitle || "").trim();
  const hasSourceField =
    Boolean(String(draft?.sourceName || "").trim()) ||
    Boolean(String(draft?.sourceUrl || "").trim()) ||
    Boolean(String(draft?.sourceLinks || "").trim());
  const sensitive = isSensitivePost(draft || {});
  const authorityStyle =
    AUTHORITY_STYLE_PATTERN.test(`${title} ${draft?.excerpt || ""}`) || wordCount >= 1200;
  const siteUrl = getSiteUrl();
  const published = String(activePost?.workflowStatus || draft?.workflowStatus || "") === "published";
  const titleLooksStrong = title.length >= 35 && title.length <= 110 && title.split(/\s+/).length >= 5;
  const hasAltText = Boolean(String(draft?.imageAlt || "").trim());
  const adSenseRisk =
    wordCount < 350 ||
    aiFillerMatches.length > 0 ||
    (!metaDescription && wordCount > 0) ||
    (sensitive && !hasSourceField);

  const items = [
    buildItem(
      "title",
      "Title is clear and accurate",
      titleLooksStrong ? "pass" : "warn",
      titleLooksStrong ? "The current headline length is workable." : "Aim for a specific headline with clearer reader value."
    ),
    buildItem(
      "authority-length",
      "Article is at least 1,500 words for evergreen/authority content",
      authorityStyle ? (wordCount >= 1500 ? "pass" : "warn") : "info",
      authorityStyle
        ? wordCount >= 1500
          ? `Current word count is ${wordCount}.`
          : `Current word count is ${wordCount}. Expand if this is meant to rank as an authority piece.`
        : `Current word count is ${wordCount}. Longer depth is mainly expected for evergreen and authority content.`
    ),
    buildItem(
      "sources",
      "Facts and statistics are sourced",
      hasSourceField ? "pass" : sensitive ? "warn" : "info",
      hasSourceField
        ? "Source details are present in the editor."
        : sensitive
          ? "Sensitive coverage should include visible source links where available."
          : "Optional for light features, but recommended for stronger trust."
    ),
    buildItem(
      "internal-links",
      "3-5 internal links added",
      internalLinks.length >= 3 && internalLinks.length <= 5 ? "pass" : internalLinks.length ? "warn" : "warn",
      internalLinks.length
        ? `${internalLinks.length} internal link(s) detected in the article body.`
        : "Add natural links to related Century Blog articles or category pages."
    ),
    buildItem(
      "external-sources",
      "External sources are authoritative",
      authoritativeLinks.length > 0 ? "pass" : hasSourceField || externalLinks.length ? "warn" : "info",
      authoritativeLinks.length > 0
        ? `${authoritativeLinks.length} authoritative external source link(s) detected.`
        : hasSourceField || externalLinks.length
          ? "External links are present, but they should point to stronger official or institutional sources where possible."
          : "Add authoritative outside sources when the topic depends on verification."
    ),
    buildItem(
      "media",
      "Hero image and alt text added",
      hasMedia && hasAltText ? "pass" : hasMedia || hasAltText ? "warn" : "info",
      hasMedia && hasAltText
        ? "Featured media and alt text are ready."
        : "Add featured media and descriptive alt text for a stronger public page."
    ),
    buildItem(
      "metadata",
      "Meta title and meta description added",
      seoTitle && metaDescription ? "pass" : "warn",
      seoTitle && metaDescription
        ? "Both metadata fields are filled."
        : "The dashboard can prefill these, but confirm they read well before publishing."
    ),
    buildItem(
      "canonical",
      "Canonical URL uses https://www.centuryblog.com.ng",
      siteUrl === PRIMARY_SITE_URL ? "pass" : "warn",
      siteUrl === PRIMARY_SITE_URL
        ? "Public canonical helpers point to the production domain."
        : `Current public site URL resolves to ${siteUrl}.`
    ),
    buildItem(
      "copied-content",
      "No copied content",
      "info",
      "Manual editorial review item: confirm wording, quotes, and images are original or properly licensed."
    ),
    buildItem(
      "ai-filler",
      "No AI-sounding filler",
      aiFillerMatches.length ? "warn" : "pass",
      aiFillerMatches.length
        ? `Possible filler detected: ${aiFillerMatches.join(", ")}.`
        : "No common filler phrases detected in the current draft."
    ),
    buildItem(
      "trust-pages",
      "Privacy/About/Contact pages reachable",
      "pass",
      "Public trust pages are already available on the site."
    ),
    buildItem(
      "adsense",
      "Article is AdSense-safe",
      adSenseRisk ? "warn" : "pass",
      adSenseRisk
        ? "Review thinness, missing metadata, filler language, or source gaps before publishing."
        : "No obvious low-value or trust-risk signal was detected from the editor fields."
    ),
    buildItem(
      "sitemap",
      "Sitemap includes published article",
      published ? "pass" : "info",
      published
        ? "Published posts are revalidated into the sitemap automatically."
        : "This will happen automatically once the article is published."
    )
  ];

  return {
    wordCount,
    internalLinkCount: internalLinks.length,
    externalLinkCount: externalLinks.length,
    authoritativeLinkCount: authoritativeLinks.length,
    aiFillerMatches,
    needsAuthorityLength: authorityStyle,
    sensitiveWithoutSource: sensitive && !hasSourceField,
    items
  };
}
