import crypto from "node:crypto";
import path from "node:path";
import { readJsonStore, writeJsonStore } from "@/lib/json-store";

const localFilePath = path.join(process.cwd(), "data", "engagement.json");
const publicId = "century-blog/data/engagement";

function normalizeComment(comment) {
  return {
    id: String(comment?.id || crypto.randomUUID()),
    name: String(comment?.name || "Anonymous").trim() || "Anonymous",
    message: String(comment?.message || "").trim(),
    createdAt: String(comment?.createdAt || new Date().toISOString())
  };
}

function normalizeRecord(slug, record) {
  const likes = Number(record?.likes || 0);
  const likedBy = Array.isArray(record?.likedBy)
    ? record.likedBy.map((entry) => String(entry)).filter(Boolean)
    : [];
  const comments = Array.isArray(record?.comments)
    ? record.comments.map(normalizeComment).filter((comment) => comment.message)
    : [];

  return {
    slug,
    likes,
    likedBy,
    comments
  };
}

function sanitizeRecord(record) {
  return {
    slug: record.slug,
    likes: record.likes,
    likedBy: record.likedBy,
    comments: record.comments
  };
}

function hashVisitorId(visitorId) {
  return crypto.createHash("sha256").update(String(visitorId)).digest("hex");
}

async function readEngagementSource() {
  const payload = await readJsonStore(localFilePath, publicId, {});
  return payload && typeof payload === "object" ? payload : {};
}

async function writeEngagementSource(data) {
  await writeJsonStore(localFilePath, publicId, data);
}

export async function getEngagementBySlug(slug) {
  const data = await readEngagementSource();
  return sanitizeRecord(normalizeRecord(slug, data?.[slug]));
}

export async function replaceAllEngagement(data) {
  await writeEngagementSource(data);
}

export async function addLikeToPost(slug, visitorId) {
  const data = await readEngagementSource();
  const record = normalizeRecord(slug, data?.[slug]);
  const visitorHash = hashVisitorId(visitorId);

  if (record.likedBy.includes(visitorHash)) {
    return {
      liked: false,
      engagement: sanitizeRecord(record)
    };
  }

  const updatedRecord = {
    ...record,
    likes: record.likes + 1,
    likedBy: [...record.likedBy, visitorHash]
  };

  const nextData = {
    ...data,
    [slug]: sanitizeRecord(updatedRecord)
  };

  await writeEngagementSource(nextData);

  return {
    liked: true,
    engagement: sanitizeRecord(updatedRecord)
  };
}

export async function addCommentToPost(slug, input) {
  const data = await readEngagementSource();
  const record = normalizeRecord(slug, data?.[slug]);
  const comment = normalizeComment({
    id: crypto.randomUUID(),
    name: input.name,
    message: input.message,
    createdAt: new Date().toISOString()
  });

  const updatedRecord = {
    ...record,
    comments: [...record.comments, comment]
  };

  const nextData = {
    ...data,
    [slug]: sanitizeRecord(updatedRecord)
  };

  await writeEngagementSource(nextData);

  return {
    comment,
    engagement: sanitizeRecord(updatedRecord)
  };
}
