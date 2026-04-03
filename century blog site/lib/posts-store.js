import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { list, put } from "@vercel/blob";
import { estimateReadTime, getCoverStyle, slugify } from "@/lib/site";

const localFilePath = path.join(process.cwd(), "data", "posts.json");
const blobKey = "century-blog/posts.json";

async function readLocalPosts() {
  const file = await fs.readFile(localFilePath, "utf8");
  return JSON.parse(file);
}

async function writeLocalPosts(posts) {
  await fs.writeFile(localFilePath, JSON.stringify(posts, null, 2), "utf8");
}

async function readBlobPosts() {
  const { blobs } = await list({ prefix: blobKey, limit: 1 });
  const target = blobs.find((blob) => blob.pathname === blobKey) || blobs[0];

  if (!target) {
    return null;
  }

  const response = await fetch(target.url, { cache: "no-store" });
  return response.json();
}

async function writeBlobPosts(posts) {
  await put(blobKey, JSON.stringify(posts, null, 2), {
    access: "public",
    addRandomSuffix: false,
    contentType: "application/json"
  });
}

function shouldUseBlob() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

async function readPostsSource() {
  if (shouldUseBlob()) {
    try {
      const blobPosts = await readBlobPosts();
      if (blobPosts) {
        return blobPosts;
      }
    } catch {
      return readLocalPosts();
    }
  }

  return readLocalPosts();
}

async function writePostsSource(posts) {
  if (shouldUseBlob()) {
    try {
      await writeBlobPosts(posts);
      return;
    } catch {
      await writeLocalPosts(posts);
      return;
    }
  }

  await writeLocalPosts(posts);
}

export async function getPosts() {
  const posts = await readPostsSource();
  return posts.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
}

export async function getPostBySlug(slug) {
  const posts = await getPosts();
  return posts.find((post) => post.slug === slug) || null;
}

export async function createPost(input) {
  const posts = await getPosts();
  const slugBase = slugify(input.title);
  const duplicateCount = posts.filter((post) => post.slug.startsWith(slugBase)).length;
  const slug = duplicateCount ? `${slugBase}-${duplicateCount + 1}` : slugBase;
  const now = new Date().toISOString();

  const post = {
    id: crypto.randomUUID(),
    slug,
    title: input.title.trim(),
    excerpt: input.excerpt.trim(),
    content: input.content.trim(),
    category: input.category,
    author: input.author?.trim() || "Century Blog Editorial Team",
    sourceName: input.sourceName?.trim() || "",
    sourceUrl: input.sourceUrl?.trim() || "",
    publishedAt: now,
    updatedAt: now,
    readTime: estimateReadTime(input.content),
    coverStyle: getCoverStyle(input.category),
    featured: false
  };

  const updatedPosts = [post, ...posts];
  await writePostsSource(updatedPosts);
  return post;
}
