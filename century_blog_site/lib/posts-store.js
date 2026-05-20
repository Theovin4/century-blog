import crypto from "node:crypto";
import path from "node:path";
import { revalidateTag, unstable_cache } from "next/cache";
import {
  ensureCloudinaryJsonBackup,
  getLatestCloudinaryJsonBackup,
  buildCloudinaryVideoPosterUrl,
  optimizeCloudinaryMediaUrl,
  uploadMediaFile,
  uploadRemoteMedia
} from "@/lib/cloudinary";
import { readJsonStore, writeJsonStore } from "@/lib/json-store";
import {
  estimateReadTime,
  getCoverStyle,
  inferMediaType,
  isValidCategory,
  getPostTimestamp,
  normalizeMarkdownContent,
  normalizeStoredText,
  slugify
} from "@/lib/site";

const localFilePath = path.join(process.env.INIT_CWD || process.cwd(), "data", "posts.json");
const publicId = "century-blog/data/posts";
const POSTS_CACHE_TAG = "century-blog-posts";
const POSTS_BACKUP_FOLDER = "century-blog/backups";
let scheduledPublishJob = null;

async function readLocalSeedPosts() {
  return readJsonStore(localFilePath, null, []);
}

function defaultRegionFocus(category, explicitRegionFocus = "") {
  if (explicitRegionFocus) {
    return explicitRegionFocus;
  }

  return category === "world" ? "global" : "nigeria";
}

function sanitizePost(post) {
  const originalMediaUrl = post.originalMediaUrl || post.mediaUrl || "";
  const workflowStatus = post.workflowStatus || "published";

  return {
    ...post,
    title: normalizeStoredText(post.title),
    excerpt: normalizeStoredText(post.excerpt),
    content: normalizeMarkdownContent(post.content),
    author: normalizeStoredText(post.author),
    type: post.type || "manual",
    sourceName: post.sourceName || "",
    sourceUrl: post.sourceUrl || "",
    sourceLinks: Array.isArray(post.sourceLinks) ? post.sourceLinks : [],
    sourceCountry: post.sourceCountry || "",
    regionFocus: defaultRegionFocus(post.category, post.regionFocus),
    sitePublishedAt:
      workflowStatus === "published"
        ? post.sitePublishedAt || post.publishedAt || post.createdAt || post.updatedAt || ""
        : post.sitePublishedAt || "",
    autoProvider: post.autoProvider || "",
    autoSourceId: post.autoSourceId || "",
    trendingScore: Number(post.trendingScore || 0),
    mediaUrl: originalMediaUrl,
    originalMediaUrl,
    posterUrl: post.posterUrl || "",
    legacyMediaUrl: post.legacyMediaUrl || "",
    workflowStatus,
    reviewNotes: post.reviewNotes || "",
    submittedAt: post.submittedAt || "",
    submittedBy: post.submittedBy || "",
    approvedAt: post.approvedAt || "",
    approvedBy: post.approvedBy || "",
    rejectedAt: post.rejectedAt || "",
    rejectedBy: post.rejectedBy || "",
    scheduledFor: post.scheduledFor || "",
    createdBy: post.createdBy || "",
    createdByName: post.createdByName || "",
    lastEditedBy: post.lastEditedBy || "",
    lastEditedByName: post.lastEditedByName || "",
    seoTitle: post.seoTitle || "",
    metaDescription: post.metaDescription || "",
    tags: Array.isArray(post.tags) ? post.tags : [],
    imageAlt: post.imageAlt || ""
  };
}

function normalizePost(post) {
  const rawMediaUrl =
    post.originalMediaUrl ||
    post.mediaUrl ||
    post.cloudinaryUrl ||
    post.legacyMediaUrl ||
    post.blobUrl ||
    "";
  const mediaName = post.mediaName || "";
  const mediaType = post.mediaType || inferMediaType(rawMediaUrl || mediaName);
  const posterUrl = post.posterUrl || buildCloudinaryVideoPosterUrl(rawMediaUrl);
  const workflowStatus = post.workflowStatus || "published";

  return {
    ...post,
    title: normalizeStoredText(post.title),
    excerpt: normalizeStoredText(post.excerpt),
    content: normalizeMarkdownContent(post.content),
    author: normalizeStoredText(post.author),
    type: post.type || "manual",
    sourceName: post.sourceName || "",
    sourceUrl: post.sourceUrl || "",
    sourceLinks: Array.isArray(post.sourceLinks) ? post.sourceLinks : [],
    sourceCountry: post.sourceCountry || "",
    regionFocus: defaultRegionFocus(post.category, post.regionFocus),
    sitePublishedAt:
      workflowStatus === "published"
        ? post.sitePublishedAt || (
          post.type === "auto"
            ? post.publishedAt || post.createdAt || post.updatedAt || ""
            : post.publishedAt || post.createdAt || post.updatedAt || ""
        )
        : post.sitePublishedAt || "",
    autoProvider: post.autoProvider || "",
    autoSourceId: post.autoSourceId || "",
    trendingScore: Number(post.trendingScore || 0),
    mediaUrl: optimizeCloudinaryMediaUrl(rawMediaUrl, mediaType),
    originalMediaUrl: rawMediaUrl,
    legacyMediaUrl: post.legacyMediaUrl || post.blobUrl || "",
    mediaName,
    mediaType,
    posterUrl,
    workflowStatus,
    reviewNotes: post.reviewNotes || "",
    submittedAt: post.submittedAt || "",
    submittedBy: post.submittedBy || "",
    approvedAt: post.approvedAt || "",
    approvedBy: post.approvedBy || "",
    rejectedAt: post.rejectedAt || "",
    rejectedBy: post.rejectedBy || "",
    scheduledFor: post.scheduledFor || "",
    createdBy: post.createdBy || "",
    createdByName: post.createdByName || "",
    lastEditedBy: post.lastEditedBy || "",
    lastEditedByName: post.lastEditedByName || "",
    seoTitle: post.seoTitle || "",
    metaDescription: post.metaDescription || "",
    tags: Array.isArray(post.tags) ? post.tags : [],
    imageAlt: post.imageAlt || ""
  };
}

function shouldHydrateSeedMedia(post) {
  const mediaUrl = String(post?.mediaUrl || post?.legacyMediaUrl || "");

  if (!mediaUrl) {
    return true;
  }

  return mediaUrl.startsWith("/posts/");
}

function mergeSeedPost(seedPost, currentPost) {
  if (!seedPost) {
    return normalizePost(currentPost);
  }

  const merged = { ...currentPost };

  if (shouldHydrateSeedMedia(currentPost) && seedPost.mediaUrl) {
    merged.mediaUrl = seedPost.mediaUrl;
    merged.originalMediaUrl = seedPost.originalMediaUrl || seedPost.mediaUrl;
    merged.mediaType = seedPost.mediaType || inferMediaType(seedPost.mediaUrl);
    merged.mediaName = seedPost.mediaName || currentPost.mediaName;
  }

  if (!merged.imageCreditName && seedPost.imageCreditName) {
    merged.imageCreditName = seedPost.imageCreditName;
  }

  if (!merged.imageCreditUrl && seedPost.imageCreditUrl) {
    merged.imageCreditUrl = seedPost.imageCreditUrl;
  }

  if (!merged.sourceName && seedPost.sourceName) {
    merged.sourceName = seedPost.sourceName;
  }

  if (!merged.sourceUrl && seedPost.sourceUrl) {
    merged.sourceUrl = seedPost.sourceUrl;
  }

  if (typeof merged.featured !== "boolean" && typeof seedPost.featured === "boolean") {
    merged.featured = seedPost.featured;
  }

  return normalizePost(merged);
}

function hydratePostsWithSeedDefaults(posts, seedPosts) {
  const seedMap = new Map(seedPosts.map((post) => [post.slug, post]));
  return posts.map((post) => mergeSeedPost(seedMap.get(post.slug), post));
}

function buildDuplicateKey(post) {
  const sourceUrl = String(post?.sourceUrl || "").trim().toLowerCase();

  if (sourceUrl) {
    return `source:${sourceUrl}`;
  }

  const title = normalizeStoredText(post?.title || "").trim().toLowerCase();
  const excerpt = normalizeStoredText(post?.excerpt || "").trim().toLowerCase();
  const contentSnippet = normalizeMarkdownContent(post?.content || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .slice(0, 240);

  return `content:${title}|${excerpt}|${contentSnippet}`;
}

function getFeatureSortTimestamp(post) {
  const timestamp = new Date(post?.updatedAt || post?.publishedAt || "").getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function dedupePosts(posts) {
  const deduped = new Map();

  for (const post of posts || []) {
    const key = buildDuplicateKey(post);
    const current = deduped.get(key);

    if (!current) {
      deduped.set(key, post);
      continue;
    }

    if (current.featured !== post.featured) {
      deduped.set(key, post.featured ? post : current);
      continue;
    }

    deduped.set(key, getFeatureSortTimestamp(post) >= getFeatureSortTimestamp(current) ? post : current);
  }

  return [...deduped.values()];
}

function normalizeFeaturedPosts(posts) {
  const featuredPosts = posts.filter((post) => post.featured);

  if (featuredPosts.length <= 1) {
    return posts;
  }

  const canonicalFeaturedId = [...featuredPosts]
    .sort((left, right) => getFeatureSortTimestamp(right) - getFeatureSortTimestamp(left))[0]
    ?.id;

  return posts.map((post) => ({
    ...post,
    featured: canonicalFeaturedId ? String(post.id) === String(canonicalFeaturedId) : false
  }));
}

async function loadPostsSource() {
  const seedPosts = (await readLocalSeedPosts()).map(normalizePost);
  const remotePosts = await readJsonStore(localFilePath, publicId, null);

  if (Array.isArray(remotePosts) && remotePosts.length) {
    return normalizeFeaturedPosts(dedupePosts(hydratePostsWithSeedDefaults(remotePosts, seedPosts)));
  }

  return normalizeFeaturedPosts(dedupePosts(seedPosts));
}

const readCachedPostsSource = unstable_cache(
  async () => loadPostsSource(),
  ["century-blog-posts-source"],
  {
    tags: [POSTS_CACHE_TAG],
    revalidate: 120
  }
);

async function readPostsSource() {
  return readCachedPostsSource();
}

async function writePostsSource(posts) {
  await writeJsonStore(localFilePath, publicId, normalizeFeaturedPosts(posts).map(sanitizePost));
  revalidateTag(POSTS_CACHE_TAG);
}

export async function ensurePostsBackup({ maxAgeHours = 24, force = false } = {}) {
  return ensureCloudinaryJsonBackup(publicId, {
    backupFolder: POSTS_BACKUP_FOLDER,
    maxAgeHours,
    force
  });
}

export async function getPostsBackupStatus() {
  const latestBackup = await getLatestCloudinaryJsonBackup(publicId, POSTS_BACKUP_FOLDER);

  return {
    latestBackupAt: latestBackup?.createdAt || "",
    latestBackupUrl: latestBackup?.secureUrl || "",
    latestBackupBytes: Number(latestBackup?.bytes || 0),
    latestBackupPublicId: latestBackup?.publicId || ""
  };
}

function toSafeTimestamp(value) {
  const timestamp = new Date(value || "").getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function shouldPublishScheduledPost(post, nowTimestamp) {
  if (String(post?.workflowStatus || "") !== "scheduled") {
    return false;
  }

  const scheduledTimestamp = toSafeTimestamp(post?.scheduledFor);
  return scheduledTimestamp > 0 && scheduledTimestamp <= nowTimestamp;
}

export async function publishDueScheduledPosts(now = new Date()) {
  if (scheduledPublishJob) {
    return scheduledPublishJob;
  }

  scheduledPublishJob = (async () => {
    const nowIso = now.toISOString();
    const nowTimestamp = now.getTime();
    const posts = await readPostsSource();
    let publishedCount = 0;

    const updatedPosts = posts.map((post) => {
      if (!shouldPublishScheduledPost(post, nowTimestamp)) {
        return post;
      }

      publishedCount += 1;
      return normalizePost({
        ...post,
        workflowStatus: "published",
        sitePublishedAt: post.sitePublishedAt || post.scheduledFor || nowIso,
        publishedAt: post.publishedAt || post.scheduledFor || nowIso,
        approvedAt: post.approvedAt || nowIso,
        approvedBy: post.approvedBy || "system",
        updatedAt: nowIso
      });
    });

    if (publishedCount > 0) {
      await writePostsSource(updatedPosts);
    }

    return publishedCount;
  })();

  try {
    return await scheduledPublishJob;
  } finally {
    scheduledPublishJob = null;
  }
}

function tokenizeTitle(value) {
  return slugify(value)
    .split("-")
    .filter(Boolean);
}

function titleSimilarity(leftTitle, rightTitle) {
  const leftTokens = tokenizeTitle(leftTitle);
  const rightTokens = tokenizeTitle(rightTitle);

  if (!leftTokens.length || !rightTokens.length) {
    return 0;
  }

  const leftSet = new Set(leftTokens);
  const rightSet = new Set(rightTokens);
  let overlap = 0;

  for (const token of leftSet) {
    if (rightSet.has(token)) {
      overlap += 1;
    }
  }

  return overlap / Math.max(leftSet.size, rightSet.size);
}

function buildUniqueSlug(posts, title, id = "") {
  const slugBase = slugify(title);
  const duplicateCount = posts.filter(
    (post) => String(post.id) !== String(id) && post.slug.startsWith(slugBase)
  ).length;
  return duplicateCount ? `${slugBase}-${duplicateCount + 1}` : slugBase;
}

export async function replaceAllPosts(posts) {
  await writePostsSource(posts);
  return getPosts();
}

export async function getPosts() {
  await publishDueScheduledPosts();
  const posts = await readPostsSource();
  return posts
    .filter((post) => String(post.workflowStatus || "published") === "published")
    .sort((a, b) => getPostTimestamp(b) - getPostTimestamp(a));
}

export async function getAllPosts() {
  await publishDueScheduledPosts();
  const posts = await readPostsSource();
  return posts.sort((a, b) => getPostTimestamp(b) - getPostTimestamp(a));
}

export async function getPostBySlug(slug) {
  const posts = await getPosts();
  return posts.find((post) => post.slug === slug) || null;
}

export async function getPostById(id) {
  const posts = await getAllPosts();
  return posts.find((post) => String(post.id) === String(id)) || null;
}

export async function getPostsByType(type) {
  const posts = await getAllPosts();
  return posts.filter((post) => (post.type || "manual") === type);
}

export function findSimilarPost(candidate, posts) {
  const candidateTitle = String(candidate?.title || "").trim();
  const candidateSourceUrl = String(candidate?.sourceUrl || "").trim();
  const candidateSourceId = String(candidate?.autoSourceId || "").trim();
  const candidateType = String(candidate?.type || "").trim() || "manual";

  return posts.find((post) => {
    if (candidateSourceUrl && post.sourceUrl && post.sourceUrl === candidateSourceUrl) {
      return true;
    }

    if (candidateSourceId && post.autoSourceId && post.autoSourceId === candidateSourceId) {
      return true;
    }

    if (candidateType === "auto" && (candidateSourceUrl || candidateSourceId)) {
      return false;
    }

    return titleSimilarity(post.title, candidateTitle) >= 0.72;
  }) || null;
}

async function buildPostRecord(posts, input, { mediaFile = null, remoteMediaUrl = "", existing = null } = {}) {
  const title = normalizeStoredText(input.title).trim();
  const slug = buildUniqueSlug(posts, title, existing?.id || "");
  const publishedAt = input.publishedAt || existing?.publishedAt || new Date().toISOString();
  const updatedAt = new Date().toISOString();
  const workflowStatus = input.workflowStatus || existing?.workflowStatus || (input.type === "auto" ? "published" : "draft");
  const sitePublishedAt =
    workflowStatus === "published"
      ? existing?.sitePublishedAt || new Date().toISOString()
      : existing?.sitePublishedAt || "";

  let media = null;

  if (mediaFile) {
    media = await uploadMediaFile(mediaFile, slug);
  } else if (remoteMediaUrl) {
    media = await uploadRemoteMedia(remoteMediaUrl, slug, input.mediaType || existing?.mediaType || "");
  }

  const base = existing || {
    id: crypto.randomUUID(),
    featured: false
  };

  return normalizePost({
    ...base,
    slug,
    title,
    excerpt: normalizeStoredText(input.excerpt).trim(),
    content: normalizeMarkdownContent(input.content),
    category: isValidCategory(input.category) ? input.category : existing?.category || "daily-gist",
    author: normalizeStoredText(input.author).trim() || existing?.author || "Century Blog Editorial Team",
    type: input.type || existing?.type || "manual",
    sourceName: input.sourceName || existing?.sourceName || "",
    sourceUrl: input.sourceUrl || existing?.sourceUrl || "",
    sourceLinks: Array.isArray(input.sourceLinks) ? input.sourceLinks : existing?.sourceLinks || [],
    sourceCountry: input.sourceCountry || existing?.sourceCountry || "",
    regionFocus: defaultRegionFocus(input.category || existing?.category, input.regionFocus || existing?.regionFocus),
    autoProvider: input.autoProvider || existing?.autoProvider || "",
    autoSourceId: input.autoSourceId || existing?.autoSourceId || "",
    trendingScore: Number(input.trendingScore ?? existing?.trendingScore ?? 0),
    mediaUrl: media ? media.mediaUrl : existing?.mediaUrl || "",
    originalMediaUrl: media ? media.originalMediaUrl : existing?.originalMediaUrl || existing?.mediaUrl || "",
    legacyMediaUrl: media
      ? existing?.originalMediaUrl || existing?.mediaUrl || existing?.legacyMediaUrl || ""
      : existing?.legacyMediaUrl || "",
    mediaType: media ? media.mediaType : input.mediaType || existing?.mediaType || "",
    mediaName: media ? media.mediaName : existing?.mediaName || "",
    posterUrl: media ? media.posterUrl : existing?.posterUrl || "",
    imageCreditName: input.imageCreditName || existing?.imageCreditName || "",
    imageCreditUrl: input.imageCreditUrl || existing?.imageCreditUrl || "",
    publishedAt,
    sitePublishedAt,
    updatedAt,
    readTime: estimateReadTime(input.content),
    coverStyle: getCoverStyle(input.category || existing?.category),
    featured: typeof input.featured === "boolean" ? input.featured : base.featured,
    workflowStatus,
    reviewNotes: input.reviewNotes ?? existing?.reviewNotes ?? "",
    submittedAt: input.submittedAt ?? existing?.submittedAt ?? "",
    submittedBy: input.submittedBy ?? existing?.submittedBy ?? "",
    approvedAt: input.approvedAt ?? existing?.approvedAt ?? "",
    approvedBy: input.approvedBy ?? existing?.approvedBy ?? "",
    rejectedAt: input.rejectedAt ?? existing?.rejectedAt ?? "",
    rejectedBy: input.rejectedBy ?? existing?.rejectedBy ?? "",
    scheduledFor: input.scheduledFor ?? existing?.scheduledFor ?? "",
    createdBy: input.createdBy || existing?.createdBy || "",
    createdByName: input.createdByName || existing?.createdByName || "",
    lastEditedBy: input.lastEditedBy ?? existing?.lastEditedBy ?? "",
    lastEditedByName: input.lastEditedByName ?? existing?.lastEditedByName ?? "",
    seoTitle: normalizeStoredText(input.seoTitle || existing?.seoTitle || title).trim(),
    metaDescription: normalizeStoredText(input.metaDescription || existing?.metaDescription || input.excerpt || existing?.excerpt || "").trim(),
    tags: Array.isArray(input.tags) ? input.tags : existing?.tags || [],
    imageAlt: normalizeStoredText(input.imageAlt || existing?.imageAlt || title).trim()
  });
}

export async function createPost(input, mediaFile = null) {
  const posts = await getAllPosts();
  const post = await buildPostRecord(posts, { ...input, type: "manual" }, { mediaFile });
  const updatedPosts = [post, ...posts];
  await writePostsSource(updatedPosts);
  return post;
}

export async function createPostFromRemoteMedia(input) {
  const posts = await getAllPosts();
  const post = await buildPostRecord(
    posts,
    { ...input, type: "manual" },
    {
      remoteMediaUrl: input.mediaUrl || ""
    }
  );
  const updatedPosts = [post, ...posts];
  await writePostsSource(updatedPosts);
  return post;
}

export async function createAutoPost(input) {
  const posts = await getAllPosts();
  const duplicate = findSimilarPost(input, posts);

  if (duplicate) {
    return {
      created: false,
      duplicate,
      post: duplicate
    };
  }

  const post = await buildPostRecord(
    posts,
    {
      ...input,
      type: "auto",
      workflowStatus: "published"
    },
    {
      remoteMediaUrl: input.mediaUrl || ""
    }
  );

  const updatedPosts = [post, ...posts];
  await writePostsSource(updatedPosts);

  return {
    created: true,
    duplicate: null,
    post
  };
}

export async function updatePost(id, input, mediaFile = null) {
  const posts = await getAllPosts();
  const existing = posts.find((post) => String(post.id) === String(id));

  if (!existing) {
    return null;
  }

  const nextInput = {
    title: input.title?.trim() || existing.title,
    excerpt: input.excerpt?.trim() || existing.excerpt,
    content: input.content?.trim() || existing.content,
    category: input.category || existing.category,
    author: input.author?.trim() || existing.author,
    type: input.type || existing.type,
    sourceName: input.sourceName || existing.sourceName,
    sourceUrl: input.sourceUrl || existing.sourceUrl,
    sourceLinks: input.sourceLinks || existing.sourceLinks,
    sourceCountry: input.sourceCountry || existing.sourceCountry,
    regionFocus: input.regionFocus || existing.regionFocus,
    autoProvider: input.autoProvider || existing.autoProvider,
    autoSourceId: input.autoSourceId || existing.autoSourceId,
    trendingScore: input.trendingScore ?? existing.trendingScore,
    mediaType: existing.mediaType,
    imageCreditName: input.imageCreditName || existing.imageCreditName,
    imageCreditUrl: input.imageCreditUrl || existing.imageCreditUrl,
    featured: typeof input.featured === "boolean" ? input.featured : existing.featured,
    publishedAt: existing.publishedAt,
    workflowStatus: input.workflowStatus || existing.workflowStatus,
    reviewNotes: input.reviewNotes ?? existing.reviewNotes,
    submittedAt: input.submittedAt ?? existing.submittedAt,
    submittedBy: input.submittedBy ?? existing.submittedBy,
    approvedAt: input.approvedAt ?? existing.approvedAt,
    approvedBy: input.approvedBy ?? existing.approvedBy,
    rejectedAt: input.rejectedAt ?? existing.rejectedAt,
    rejectedBy: input.rejectedBy ?? existing.rejectedBy,
    scheduledFor: input.scheduledFor ?? existing.scheduledFor,
    createdBy: input.createdBy || existing.createdBy,
    createdByName: input.createdByName || existing.createdByName,
    lastEditedBy: input.lastEditedBy ?? existing.lastEditedBy,
    lastEditedByName: input.lastEditedByName ?? existing.lastEditedByName,
    seoTitle: input.seoTitle || existing.seoTitle,
    metaDescription: input.metaDescription || existing.metaDescription,
    tags: input.tags || existing.tags,
    imageAlt: input.imageAlt || existing.imageAlt
  };

  const updatedPost = await buildPostRecord(posts, nextInput, {
    mediaFile,
    existing
  });

  const updatedPosts = posts.map((post) => {
    if (String(post.id) === String(id)) {
      return updatedPost;
    }

    if (updatedPost.featured && post.featured) {
      return {
        ...post,
        featured: false
      };
    }

    return post;
  });

  await writePostsSource(updatedPosts);
  return updatedPost;
}

export async function deletePost(id) {
  const posts = await getAllPosts();
  const exists = posts.some((post) => String(post.id) === String(id));

  if (!exists) {
    return false;
  }

  const updatedPosts = posts.filter((post) => String(post.id) !== String(id));
  await writePostsSource(updatedPosts);
  return true;
}
