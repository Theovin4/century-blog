import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { list, put } from "@vercel/blob";

const localFilePath = path.join(process.cwd(), "data", "engagement.json");
const blobKey = "century-blog/engagement.json";

function shouldUseBlob() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

async function readLocalEngagement() {
  const file = await fs.readFile(localFilePath, "utf8");
  return JSON.parse(file);
}

async function writeLocalEngagement(data) {
  await fs.writeFile(localFilePath, JSON.stringify(data, null, 2), "utf8");
}

async function readBlobEngagement() {
  const { blobs } = await list({ prefix: blobKey, limit: 1 });
  const target = blobs.find((blob) => blob.pathname === blobKey) || blobs[0];

  if (!target) {
    return null;
  }

  const response = await fetch(target.url, { cache: "no-store" });
  return response.json();
}

async function writeBlobEngagement(data) {
  await put(blobKey, JSON.stringify(data, null, 2), {
    access: "public",
    addRandomSuffix: false,
    contentType: "application/json"
  });
}

async function readEngagementSource() {
  if (shouldUseBlob()) {
    try {
      const blobData = await readBlobEngagement();
      if (blobData) {
        return blobData;
      }
    } catch {
      return readLocalEngagement();
    }
  }

  return readLocalEngagement();
}

async function writeEngagementSource(data) {
  if (shouldUseBlob()) {
    try {
      await writeBlobEngagement(data);
      return;
    } catch {
      await writeLocalEngagement(data);
      return;
    }
  }

  await writeLocalEngagement(data);
}

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
    comments: record.comments
  };
}

function hashVisitorId(visitorId) {
  return crypto.createHash("sha256").update(String(visitorId)).digest("hex");
}

export async function getEngagementBySlug(slug) {
  const data = await readEngagementSource();
  return sanitizeRecord(normalizeRecord(slug, data?.[slug]));
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
    [slug]: updatedRecord
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
    [slug]: updatedRecord
  };

  await writeEngagementSource(nextData);

  return {
    comment,
    engagement: sanitizeRecord(updatedRecord)
  };
}
