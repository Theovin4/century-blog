import crypto from "node:crypto";
import path from "node:path";
import {
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

  return {
    ...post,
    title: normalizeStoredText(post.title),
    excerpt: normalizeStoredText(post.excerpt),
    content: normalizeMarkdownContent(post.content),
    author: normalizeStoredText(post.author),
    type: post.type || "manual",
    sourceName: post.sourceName || "",
    sourceUrl: post.sourceUrl || "",
    sourceCountry: post.sourceCountry || "",
    regionFocus: defaultRegionFocus(post.category, post.regionFocus),
    autoProvider: post.autoProvider || "",
    autoSourceId: post.autoSourceId || "",
    trendingScore: Number(post.trendingScore || 0),
    mediaUrl: originalMediaUrl,
    originalMediaUrl,
    posterUrl: post.posterUrl || "",
    legacyMediaUrl: post.legacyMediaUrl || ""
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

  return {
    ...post,
    title: normalizeStoredText(post.title),
    excerpt: normalizeStoredText(post.excerpt),
    content: normalizeMarkdownContent(post.content),
    author: normalizeStoredText(post.author),
    type: post.type || "manual",
    sourceName: post.sourceName || "",
    sourceUrl: post.sourceUrl || "",
    sourceCountry: post.sourceCountry || "",
    regionFocus: defaultRegionFocus(post.category, post.regionFocus),
    autoProvider: post.autoProvider || "",
    autoSourceId: post.autoSourceId || "",
    trendingScore: Number(post.trendingScore || 0),
    mediaUrl: optimizeCloudinaryMediaUrl(rawMediaUrl, mediaType),
    originalMediaUrl: rawMediaUrl,
    legacyMediaUrl: post.legacyMediaUrl || post.blobUrl || "",
    mediaName,
    mediaType,
    posterUrl
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

function getFeatureSortTimestamp(post) {
  const timestamp = new Date(post?.updatedAt || post?.publishedAt || "").getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
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

async function readPostsSource() {
  const seedPosts = (await readLocalSeedPosts()).map(normalizePost);
  const remotePosts = await readJsonStore(localFilePath, publicId, null);

  if (Array.isArray(remotePosts) && remotePosts.length) {
    return normalizeFeaturedPosts(hydratePostsWithSeedDefaults(remotePosts, seedPosts));
  }

  return normalizeFeaturedPosts(seedPosts);
}

async function writePostsSource(posts) {
  await writeJsonStore(localFilePath, publicId, normalizeFeaturedPosts(posts).map(sanitizePost));
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
  const posts = await readPostsSource();
  return posts.sort((a, b) => getPostTimestamp(b) - getPostTimestamp(a));
}

export async function getPostBySlug(slug) {
  const posts = await getPosts();
  return posts.find((post) => post.slug === slug) || null;
}

export async function getPostById(id) {
  const posts = await getPosts();
  return posts.find((post) => String(post.id) === String(id)) || null;
}

export async function getPostsByType(type) {
  const posts = await getPosts();
  return posts.filter((post) => (post.type || "manual") === type);
}

export function findSimilarPost(candidate, posts) {
  const candidateTitle = String(candidate?.title || "").trim();
  const candidateSourceUrl = String(candidate?.sourceUrl || "").trim();
  const candidateSourceId = String(candidate?.autoSourceId || "").trim();

  return posts.find((post) => {
    if (candidateSourceUrl && post.sourceUrl && post.sourceUrl === candidateSourceUrl) {
      return true;
    }

    if (candidateSourceId && post.autoSourceId && post.autoSourceId === candidateSourceId) {
      return true;
    }

    return titleSimilarity(post.title, candidateTitle) >= 0.72;
  }) || null;
}

async function buildPostRecord(posts, input, { mediaFile = null, remoteMediaUrl = "", existing = null } = {}) {
  const title = normalizeStoredText(input.title).trim();
  const slug = buildUniqueSlug(posts, title, existing?.id || "");
  const publishedAt = input.publishedAt || existing?.publishedAt || new Date().toISOString();
  const updatedAt = new Date().toISOString();

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
    updatedAt,
    readTime: estimateReadTime(input.content),
    coverStyle: getCoverStyle(input.category || existing?.category),
    featured: typeof input.featured === "boolean" ? input.featured : base.featured
  });
}

export async function createPost(input, mediaFile = null) {
  const posts = await getPosts();
  const post = await buildPostRecord(posts, { ...input, type: "manual" }, { mediaFile });
  const updatedPosts = [post, ...posts];
  await writePostsSource(updatedPosts);
  return post;
}

export async function createAutoPost(input) {
  const posts = await getPosts();
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
      type: "auto"
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
  const posts = await getPosts();
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
    sourceCountry: input.sourceCountry || existing.sourceCountry,
    regionFocus: input.regionFocus || existing.regionFocus,
    autoProvider: input.autoProvider || existing.autoProvider,
    autoSourceId: input.autoSourceId || existing.autoSourceId,
    trendingScore: input.trendingScore ?? existing.trendingScore,
    mediaType: existing.mediaType,
    imageCreditName: input.imageCreditName || existing.imageCreditName,
    imageCreditUrl: input.imageCreditUrl || existing.imageCreditUrl,
    featured: typeof input.featured === "boolean" ? input.featured : existing.featured,
    publishedAt: existing.publishedAt
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
  const posts = await getPosts();
  const exists = posts.some((post) => String(post.id) === String(id));

  if (!exists) {
    return false;
  }

  const updatedPosts = posts.filter((post) => String(post.id) !== String(id));
  await writePostsSource(updatedPosts);
  return true;
}
