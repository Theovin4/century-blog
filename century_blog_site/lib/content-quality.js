import {
  extractMarkdownHeadings,
  getRenderableContent,
  isSensitivePost
} from "@/lib/site";

const MANUAL_NOINDEX_POST_SLUGS = new Set([
  "vote-for-journal-star-boys-athlete-of-the-week-may-18-23-how-nigerians-can-join-the-fun",
  "how-to-participate-in-go-fest-2026-with-a-pok-mon-go-spoofer",
  "vote-for-livingston-daily-athlete-of-the-week-may-18-23-2026-how-nigerians-can-join-the-countdown",
  "lauren-phillips-hits-afl-star-rory-lobb-with-x-rated-insult-off-air-then-gets-called-out-live-on-radio",
  "waikato-expressway-sh1-closed-southbound-from-te-kauwhata-after-serious-crash",
  "how-nascar-star-gutted-out-racing-on-broken-leg-5-things-about-dover-race"
]);

const LOW_VALUE_TITLE_PATTERNS = [
  /\bvote for\b/i,
  /\bspoofer\b/i,
  /\bfull[-\s]+story\b/i,
  /\beverything[-\s]+you[-\s]+need[-\s]+to[-\s]+know\b/i,
  /\bx-rated\b/i,
  /\bpenis size\b/i,
  /\bdeath at 40\b/i,
  /\bpay[-\s]+daily\b/i,
  /\byoutube[-\s]+automation\b/i
];

const TEMPLATE_BODY_PATTERNS = [
  /Century Blog's job in an evergreen explainer like this is to slow the subject down/i,
  /The issue stays relevant because the same pressure appears again and again/i,
  /Authority is built when readers feel a publication has helped them think more clearly/i,
  /For readers in Nigeria, the practical question is how this issue shapes daily decisions/i,
  /A stronger evergreen article should correct that by offering practical clarity/i,
  /That is where a stronger explainer becomes useful/i,
  /A stronger editorial reading of this subject begins with one discipline/i,
  /The strongest takeaway is not perfection; it is steadier judgment/i,
  /That is the goal of this Century Blog explainer/i
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
  /\b(?:experts|analysts|researchers|officials) (?:say|believe|warn|suggest|agree|note) that\b/i,
  /\b(?:interviews?|surveys?|polling|fieldwork) (?:conducted|commissioned|carried out|undertaken) by Century Blog\b/i,
  /\b(?:a|the) (?:pilot|study|survey|report|programme|program|initiative)\b[^.\n]{0,120}\b(?:found|reported|showed|recorded|reduced|increased|will launch|is set to launch)\b/i,
  /\b(?:has|have) signalled plans to launch\b/i
];

const SOURCE_LINK_REQUIRED_PATTERNS = [
  /\bwar\b/i,
  /\bmilitary\b/i,
  /\bconflict\b/i,
  /\bterror(?:ism|ist)?\b/i,
  /\battack\b/i,
  /\bcrime\b/i,
  /\bfraud\b/i,
  /\barrest\b/i,
  /\bcourt\b/i,
  /\belection\b/i,
  /\bpresident\b/i,
  /\bminister\b/i,
  /\bgovernor\b/i,
  /\bsenate\b/i,
  /\bhealth\b/i,
  /\bmedical\b/i,
  /\bdisease\b/i,
  /\bvirus\b/i,
  /\boutbreak\b/i,
  /\bnaira\b/i,
  /\bforex\b/i,
  /\binflation\b/i,
  /\bcbn\b/i,
  /\btax\b/i,
  /\bbank\b/i,
  /\boil\b/i,
  /\bfuel\b/i,
  /\binvest(?:ment|ing)?\b/i
];

function getNormalizedSlug(postOrSlug) {
  return typeof postOrSlug === "string"
    ? String(postOrSlug || "").trim()
    : String(postOrSlug?.slug || "").trim();
}

export function hasSourceAttribution(post) {
  if (typeof post?.hasSourceAttribution === "boolean") {
    return post.hasSourceAttribution;
  }

  return Boolean(
    String(post?.sourceName || "").trim() ||
    String(post?.sourceUrl || "").trim() ||
    (Array.isArray(post?.sourceLinks) && post.sourceLinks.some((item) => item?.url))
  );
}

export function hasSourceLink(post) {
  return Boolean(
    String(post?.sourceUrl || "").trim() ||
    (Array.isArray(post?.sourceLinks) && post.sourceLinks.some((item) => item?.url))
  );
}

export function getPostWordCount(post) {
  const indexedWordCount = Number(post?.indexingAssessment?.wordCount || post?.wordCount || 0);

  if (indexedWordCount > 0) {
    return indexedWordCount;
  }

  const content = getRenderableContent(post);
  return content.split(/\s+/).filter(Boolean).length;
}

function getStructureSignals(post) {
  const content = getRenderableContent(post);
  const headings = extractMarkdownHeadings(content);

  return {
    content,
    headingsCount: headings.length,
    hasExecutiveSummary: /##\s+Executive summary/im.test(content),
    hasWhyThisMatters: /##\s+Why this story matters/im.test(content),
    hasWhatNext: /##\s+(What readers should watch next|What happens next)/im.test(content),
    hasFaq: /##\s+(Frequently asked questions|FAQ)/im.test(content)
  };
}

function hasLowValueTitle(post) {
  const titleAndSlug = `${post?.title || ""} ${post?.slug || ""}`;
  return LOW_VALUE_TITLE_PATTERNS.some((pattern) => pattern.test(titleAndSlug));
}

function hasTemplateBody(post) {
  const content = getRenderableContent(post);
  return TEMPLATE_BODY_PATTERNS.some((pattern) => pattern.test(content));
}

function hasEditorialInstructionLeakage(post) {
  const content = getRenderableContent(post);
  return EDITORIAL_INSTRUCTION_PATTERNS.some((pattern) => pattern.test(content));
}

function hasMalformedContent(post) {
  const content = getRenderableContent(post);
  return MALFORMED_CONTENT_PATTERNS.some((pattern) => pattern.test(content));
}

function hasUnsupportedAuthorityClaims(post) {
  const content = getRenderableContent(post);
  return UNSUPPORTED_AUTHORITY_PATTERNS.some((pattern) => pattern.test(content));
}

function isEvergreenAuthorityPost(post) {
  return String(post?.autoProvider || "").trim().toLowerCase() === "evergreen";
}

function requiresSourceLink(post) {
  // Related-story titles should not reclassify an otherwise non-sensitive
  // article. Keep the article's own prose while excluding markdown link labels.
  const articleContent = getRenderableContent(post).replace(/\[[^\]]+]\([^)]+\)/g, "");
  const haystack = `${post?.title || ""} ${post?.excerpt || ""} ${articleContent}`;
  const category = String(post?.category || "").toLowerCase();

  return (
    category === "health" ||
    SOURCE_LINK_REQUIRED_PATTERNS.some((pattern) => pattern.test(haystack))
  );
}

export function getIndexingAssessment(postOrSlug) {
  if (postOrSlug && typeof postOrSlug === "object" && postOrSlug.indexingAssessment && !postOrSlug.content) {
    const storedAssessment = postOrSlug.indexingAssessment;

    if (typeof storedAssessment.indexable === "boolean") {
      return {
        indexable: storedAssessment.indexable,
        reason: String(storedAssessment.reason || ""),
        wordCount: Number(storedAssessment.wordCount || 0)
      };
    }
  }

  const slug = getNormalizedSlug(postOrSlug);

  if (!slug) {
    return {
      indexable: false,
      reason: "missing-slug",
      wordCount: 0
    };
  }

  if (MANUAL_NOINDEX_POST_SLUGS.has(slug)) {
    return {
      indexable: false,
      reason: "manual-noindex-list",
      wordCount: 0
    };
  }

  if (typeof postOrSlug === "string") {
    return {
      indexable: true,
      reason: "",
      wordCount: 0
    };
  }

  const post = postOrSlug;
  const wordCount = getPostWordCount(post);
  const isAutoPost = String(post?.type || "manual") === "auto";
  const isEvergreen = isEvergreenAuthorityPost(post);
  const sensitive = isSensitivePost(post);
  const hasSources = hasSourceAttribution(post);
  const hasLinkedSources = hasSourceLink(post);
  const signals = getStructureSignals(post);

  if (hasLowValueTitle(post)) {
    return {
      indexable: false,
      reason: "low-value-title-pattern",
      wordCount
    };
  }

  if (hasTemplateBody(post)) {
    return {
      indexable: false,
      reason: "template-boilerplate",
      wordCount
    };
  }

  if (hasEditorialInstructionLeakage(post)) {
    return {
      indexable: false,
      reason: "editorial-instruction-leakage",
      wordCount
    };
  }

  if (hasMalformedContent(post)) {
    return {
      indexable: false,
      reason: "malformed-or-placeholder-content",
      wordCount
    };
  }

  if (hasUnsupportedAuthorityClaims(post)) {
    return {
      indexable: false,
      reason: "unsupported-authority-attribution",
      wordCount
    };
  }

  if (wordCount < 900) {
    return {
      indexable: false,
      reason: "too-thin-for-indexing",
      wordCount
    };
  }

  if (requiresSourceLink(post) && !hasLinkedSources) {
    return {
      indexable: false,
      reason: "source-link-required",
      wordCount
    };
  }

  if (sensitive && !hasSources && !isEvergreen && wordCount < 2400) {
    return {
      indexable: false,
      reason: "sensitive-post-missing-sources",
      wordCount
    };
  }

  if (isAutoPost && wordCount < 1800) {
    return {
      indexable: false,
      reason: "auto-post-needs-authority-rewrite",
      wordCount
    };
  }

  if (wordCount < 900 && signals.headingsCount < 3) {
    return {
      indexable: false,
      reason: "thin-structure",
      wordCount
    };
  }

  if (wordCount < 1200) {
    return {
      indexable: false,
      reason: "needs-substantial-expansion",
      wordCount
    };
  }

  if (wordCount < 1600 && (!signals.hasWhyThisMatters || !signals.hasWhatNext)) {
    return {
      indexable: false,
      reason: "missing-context-sections",
      wordCount
    };
  }

  if (wordCount < 1800 && (!signals.hasExecutiveSummary || !signals.hasFaq)) {
    return {
      indexable: false,
      reason: "missing-summary-or-faq",
      wordCount
    };
  }

  return {
    indexable: true,
    reason: "",
    wordCount
  };
}

export function shouldNoIndexPost(postOrSlug) {
  return !getIndexingAssessment(postOrSlug).indexable;
}

export function filterIndexablePosts(posts = []) {
  return posts.filter((post) => post?.slug && !shouldNoIndexPost(post));
}

export function filterNewsSitemapPosts(posts = []) {
  return filterIndexablePosts(posts).filter((post) => {
    const assessment = getIndexingAssessment(post);
    return hasSourceLink(post) && assessment.wordCount >= 1600 && String(post?.autoProvider || "").trim().toLowerCase() !== "evergreen";
  });
}

export function getNoIndexPostSlugs(posts = []) {
  const manual = [...MANUAL_NOINDEX_POST_SLUGS];
  const dynamic = posts
    .filter((post) => post?.slug && shouldNoIndexPost(post))
    .map((post) => post.slug);

  return [...new Set([...manual, ...dynamic])];
}
