import crypto from "node:crypto";
import path from "node:path";
import { readJsonStore, writeJsonStore } from "@/lib/json-store";

const legacyFilePath = path.join(process.env.INIT_CWD || process.cwd(), "data", "engagement.json");
const legacyPublicId = "century-blog/data/engagement";

const likesFilePath = path.join(process.env.INIT_CWD || process.cwd(), "data", "engagement-likes.json");
const likesPublicId = "century-blog/data/engagement-likes";

const commentsFilePath = path.join(process.env.INIT_CWD || process.cwd(), "data", "engagement-comments.json");
const commentsPublicId = "century-blog/data/engagement-comments";

function normalizeComment(comment) {
  return {
    id: String(comment?.id || crypto.randomUUID()),
    name: String(comment?.name || "Anonymous").trim() || "Anonymous",
    message: String(comment?.message || "").trim(),
    createdAt: String(comment?.createdAt || new Date().toISOString())
  };
}

function normalizeLikesRecord(slug, record, legacyRecord) {
  const source = record ?? legacyRecord ?? {};
  const likes = Number(source?.likes || 0);
  const likedBy = Array.isArray(source?.likedBy)
    ? source.likedBy.map((entry) => String(entry)).filter(Boolean)
    : [];

  return {
    slug,
    likes,
    likedBy
  };
}

function normalizeCommentsRecord(slug, record, legacyRecord) {
  const source = record ?? legacyRecord ?? {};
  const comments = Array.isArray(source?.comments)
    ? source.comments.map(normalizeComment).filter((comment) => comment.message)
    : [];

  return {
    slug,
    comments
  };
}

function sanitizeLikesRecord(record) {
  return {
    slug: record.slug,
    likes: record.likes,
    likedBy: record.likedBy
  };
}

function sanitizeCommentsRecord(record) {
  return {
    slug: record.slug,
    comments: record.comments
  };
}

function hashVisitorId(visitorId) {
  return crypto.createHash("sha256").update(String(visitorId)).digest("hex");
}

async function readLegacySource() {
  const payload = await readJsonStore(legacyFilePath, legacyPublicId, {});
  return payload && typeof payload === "object" ? payload : {};
}

async function readLikesSource() {
  const payload = await readJsonStore(likesFilePath, likesPublicId, null);
  if (payload && typeof payload === "object") {
    return payload;
  }

  return {};
}

async function readCommentsSource() {
  const payload = await readJsonStore(commentsFilePath, commentsPublicId, null);
  if (payload && typeof payload === "object") {
    return payload;
  }

  return {};
}

async function writeLikesSource(data) {
  await writeJsonStore(likesFilePath, likesPublicId, data);
}

async function writeCommentsSource(data) {
  await writeJsonStore(commentsFilePath, commentsPublicId, data);
}

async function getLegacyRecord(slug) {
  const legacyData = await readLegacySource();
  return legacyData?.[slug] || null;
}

export async function getEngagementBySlug(slug) {
  const [likesData, commentsData, legacyRecord] = await Promise.all([
    readLikesSource(),
    readCommentsSource(),
    getLegacyRecord(slug)
  ]);

  const likesRecord = normalizeLikesRecord(slug, likesData?.[slug], legacyRecord);
  const commentsRecord = normalizeCommentsRecord(slug, commentsData?.[slug], legacyRecord);

  return {
    slug,
    likes: likesRecord.likes,
    comments: commentsRecord.comments
  };
}

export async function replaceAllEngagement(data) {
  const nextLikes = {};
  const nextComments = {};

  for (const [slug, record] of Object.entries(data || {})) {
    nextLikes[slug] = sanitizeLikesRecord(normalizeLikesRecord(slug, record, null));
    nextComments[slug] = sanitizeCommentsRecord(normalizeCommentsRecord(slug, record, null));
  }

  await Promise.all([writeLikesSource(nextLikes), writeCommentsSource(nextComments)]);
}

export async function addLikeToPost(slug, visitorId) {
  const [likesData, legacyRecord] = await Promise.all([readLikesSource(), getLegacyRecord(slug)]);
  const record = normalizeLikesRecord(slug, likesData?.[slug], legacyRecord);
  const visitorHash = hashVisitorId(visitorId);

  if (record.likedBy.includes(visitorHash)) {
    const comments = (await getEngagementBySlug(slug)).comments;

    return {
      liked: false,
      engagement: {
        slug,
        likes: record.likes,
        comments
      }
    };
  }

  const updatedRecord = {
    ...record,
    likes: record.likes + 1,
    likedBy: [...record.likedBy, visitorHash]
  };

  const nextData = {
    ...likesData,
    [slug]: sanitizeLikesRecord(updatedRecord)
  };

  await writeLikesSource(nextData);

  const comments = (await getEngagementBySlug(slug)).comments;

  return {
    liked: true,
    engagement: {
      slug,
      likes: updatedRecord.likes,
      comments
    }
  };
}

export async function addCommentToPost(slug, input) {
  const [commentsData, legacyRecord] = await Promise.all([readCommentsSource(), getLegacyRecord(slug)]);
  const record = normalizeCommentsRecord(slug, commentsData?.[slug], legacyRecord);
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
    ...commentsData,
    [slug]: sanitizeCommentsRecord(updatedRecord)
  };

  await writeCommentsSource(nextData);

  const likes = (await getEngagementBySlug(slug)).likes;

  return {
    comment,
    engagement: {
      slug,
      likes,
      comments: updatedRecord.comments
    }
  };
}
