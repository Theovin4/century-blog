import crypto from "node:crypto";
import path from "node:path";
import {
  buildCloudinaryVideoPosterUrl,
  optimizeCloudinaryMediaUrl,
  uploadMediaFile
} from "@/lib/cloudinary";
import { readJsonStore, writeJsonStore } from "@/lib/json-store";
import { estimateReadTime, getCoverStyle, inferMediaType, slugify } from "@/lib/site";

const localFilePath = path.join(process.cwd(), "data", "posts.json");
const publicId = "century-blog/data/posts";

async function readLocalSeedPosts() {
  return readJsonStore(localFilePath, null, []);
}

function sanitizePost(post) {
  const originalMediaUrl = post.originalMediaUrl || post.mediaUrl || "";

  return {
    ...post,
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

async function readPostsSource() {
  const seedPosts = (await readLocalSeedPosts()).map(normalizePost);
  const remotePosts = await readJsonStore(localFilePath, publicId, null);

  if (Array.isArray(remotePosts) && remotePosts.length) {
    return hydratePostsWithSeedDefaults(remotePosts, seedPosts);
  }

  return seedPosts;
}

async function writePostsSource(posts) {
  await writeJsonStore(localFilePath, publicId, posts.map(sanitizePost));
}

export async function replaceAllPosts(posts) {
  await writePostsSource(posts);
  return getPosts();
}

export async function getPosts() {
  const posts = await readPostsSource();
  return posts.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
}

export async function getPostBySlug(slug) {
  const posts = await getPosts();
  return posts.find((post) => post.slug === slug) || null;
}

export async function getPostById(id) {
  const posts = await getPosts();
  return posts.find((post) => String(post.id) === String(id)) || null;
}

export async function createPost(input, mediaFile = null) {
  const posts = await getPosts();
  const slugBase = slugify(input.title);
  const duplicateCount = posts.filter((post) => post.slug.startsWith(slugBase)).length;
  const slug = duplicateCount ? `${slugBase}-${duplicateCount + 1}` : slugBase;
  const now = new Date().toISOString();
  const media = await uploadMediaFile(mediaFile, slug);

  const post = normalizePost({
    id: crypto.randomUUID(),
    slug,
    title: input.title.trim(),
    excerpt: input.excerpt.trim(),
    content: input.content.trim(),
    category: input.category,
    author: input.author?.trim() || "Century Blog Editorial Team",
    mediaUrl: media.mediaUrl,
    originalMediaUrl: media.originalMediaUrl,
    legacyMediaUrl: "",
    mediaType: media.mediaType,
    mediaName: media.mediaName,
    posterUrl: media.posterUrl,
    publishedAt: now,
    updatedAt: now,
    readTime: estimateReadTime(input.content),
    coverStyle: getCoverStyle(input.category),
    featured: false
  });

  const updatedPosts = [post, ...posts];
  await writePostsSource(updatedPosts);
  return post;
}

export async function updatePost(id, input, mediaFile = null) {
  const posts = await getPosts();
  const existing = posts.find((post) => String(post.id) === String(id));

  if (!existing) {
    return null;
  }

  const nextTitle = input.title?.trim() || existing.title;
  const slugBase = slugify(nextTitle);
  const duplicateCount = posts.filter(
    (post) => String(post.id) !== String(id) && post.slug.startsWith(slugBase)
  ).length;
  const slug = duplicateCount ? `${slugBase}-${duplicateCount + 1}` : slugBase;
  const now = new Date().toISOString();
  const media = mediaFile ? await uploadMediaFile(mediaFile, slug) : null;

  const updatedPost = normalizePost({
    ...existing,
    slug,
    title: nextTitle,
    excerpt: input.excerpt?.trim() || existing.excerpt,
    content: input.content?.trim() || existing.content,
    category: input.category || existing.category,
    author: input.author?.trim() || existing.author,
    mediaUrl: media ? media.mediaUrl : existing.mediaUrl,
    originalMediaUrl: media ? media.originalMediaUrl : existing.originalMediaUrl || existing.mediaUrl,
    legacyMediaUrl: media
      ? existing.originalMediaUrl || existing.mediaUrl || existing.legacyMediaUrl || ""
      : existing.legacyMediaUrl || "",
    mediaType: media ? media.mediaType : existing.mediaType,
    mediaName: media ? media.mediaName : existing.mediaName,
    posterUrl: media ? media.posterUrl : existing.posterUrl,
    updatedAt: now,
    readTime: estimateReadTime(input.content?.trim() || existing.content),
    coverStyle: getCoverStyle(input.category || existing.category),
    featured: typeof input.featured === "boolean" ? input.featured : existing.featured
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
