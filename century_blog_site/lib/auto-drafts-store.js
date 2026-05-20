import crypto from "node:crypto";
import path from "node:path";
import { readJsonStore, writeJsonStore } from "@/lib/json-store";
import { createPostFromRemoteMedia } from "@/lib/posts-store";
import { isValidCategory, normalizeMarkdownContent, normalizeStoredText } from "@/lib/site";

const localFilePath = path.join(process.env.INIT_CWD || process.cwd(), "data", "automation-drafts.json");
const publicId = "century-blog/data/automation-drafts";

function normalizeDraft(draft) {
  return {
    id: String(draft?.id || crypto.randomUUID()),
    title: normalizeStoredText(draft?.title || ""),
    excerpt: normalizeStoredText(draft?.excerpt || ""),
    content: normalizeMarkdownContent(draft?.content || ""),
    category: isValidCategory(draft?.category) ? draft.category : "daily-gist",
    author: normalizeStoredText(draft?.author || "Century Blog Editorial Team"),
    type: "auto-draft",
    sourceName: draft?.sourceName || "",
    sourceUrl: draft?.sourceUrl || "",
    sourceCountry: draft?.sourceCountry || "",
    regionFocus: draft?.regionFocus || "nigeria",
    autoProvider: draft?.autoProvider || "",
    autoSourceId: draft?.autoSourceId || "",
    trendingScore: Number(draft?.trendingScore || 0),
    mediaUrl: draft?.mediaUrl || "",
    mediaType: draft?.mediaType || "",
    imageCreditName: draft?.imageCreditName || "",
    imageCreditUrl: draft?.imageCreditUrl || "",
    publishedAt: draft?.publishedAt || new Date().toISOString(),
    qualityReport: draft?.qualityReport || { passed: false, reasons: ["review-needed"], blockingReasons: ["review-needed"] },
    rewriteMeta: {
      attempted: Boolean(draft?.rewriteMeta?.attempted),
      provider: draft?.rewriteMeta?.provider || "",
      model: draft?.rewriteMeta?.model || "",
      status: draft?.rewriteMeta?.status || "unknown",
      succeeded: Boolean(draft?.rewriteMeta?.succeeded),
      failedAttempts: Number(draft?.rewriteMeta?.failedAttempts || 0),
      error: draft?.rewriteMeta?.error || ""
    },
    createdAt: draft?.createdAt || new Date().toISOString(),
    updatedAt: draft?.updatedAt || draft?.createdAt || new Date().toISOString()
  };
}

function sortDrafts(drafts) {
  return [...drafts].sort((left, right) => new Date(right.updatedAt || right.createdAt || 0) - new Date(left.updatedAt || left.createdAt || 0));
}

function buildDraftKey(draft) {
  const sourceUrl = String(draft?.sourceUrl || "").trim().toLowerCase();
  const sourceId = String(draft?.autoSourceId || "").trim().toLowerCase();

  if (sourceUrl) {
    return `source:${sourceUrl}`;
  }

  if (sourceId) {
    return `source-id:${sourceId}`;
  }

  return `title:${normalizeStoredText(draft?.title || "").trim().toLowerCase()}`;
}

export async function getAutoDrafts() {
  const drafts = await readJsonStore(localFilePath, publicId, []);
  return sortDrafts((Array.isArray(drafts) ? drafts : []).map(normalizeDraft));
}

export async function saveAutoDraft(input) {
  const drafts = await getAutoDrafts();
  const nextDraft = normalizeDraft(input);
  const incomingKey = buildDraftKey(nextDraft);
  const existing = drafts.find((draft) => buildDraftKey(draft) === incomingKey);

  const mergedDraft = existing
    ? normalizeDraft({
        ...existing,
        ...nextDraft,
        id: existing.id,
        createdAt: existing.createdAt,
        updatedAt: new Date().toISOString()
      })
    : nextDraft;

  const nextDrafts = existing
    ? drafts.map((draft) => (draft.id === existing.id ? mergedDraft : draft))
    : [mergedDraft, ...drafts];

  await writeJsonStore(localFilePath, publicId, nextDrafts);
  return mergedDraft;
}

export async function deleteAutoDraft(id) {
  const drafts = await getAutoDrafts();
  const nextDrafts = drafts.filter((draft) => String(draft.id) !== String(id));

  if (nextDrafts.length === drafts.length) {
    return false;
  }

  await writeJsonStore(localFilePath, publicId, nextDrafts);
  return true;
}

export async function deleteMatchingAutoDrafts({ id = "", sourceUrl = "", autoSourceId = "", title = "" } = {}) {
  const drafts = await getAutoDrafts();
  const normalizedId = String(id || "").trim();
  const normalizedSourceUrl = String(sourceUrl || "").trim().toLowerCase();
  const normalizedAutoSourceId = String(autoSourceId || "").trim().toLowerCase();
  const normalizedTitle = normalizeStoredText(title || "").trim().toLowerCase();

  const nextDrafts = drafts.filter((draft) => {
    if (normalizedId && String(draft.id) === normalizedId) {
      return false;
    }

    if (normalizedSourceUrl && String(draft.sourceUrl || "").trim().toLowerCase() === normalizedSourceUrl) {
      return false;
    }

    if (normalizedAutoSourceId && String(draft.autoSourceId || "").trim().toLowerCase() === normalizedAutoSourceId) {
      return false;
    }

    if (normalizedTitle && normalizeStoredText(draft.title || "").trim().toLowerCase() === normalizedTitle) {
      return false;
    }

    return true;
  });

  if (nextDrafts.length === drafts.length) {
    return 0;
  }

  await writeJsonStore(localFilePath, publicId, nextDrafts);
  return drafts.length - nextDrafts.length;
}

export async function getAutoDraftById(id) {
  const drafts = await getAutoDrafts();
  return drafts.find((draft) => String(draft.id) === String(id)) || null;
}

export async function publishAutoDraft(id) {
  const draft = await getAutoDraftById(id);

  if (!draft) {
    return null;
  }

  const post = await createPostFromRemoteMedia({
    title: draft.title,
    excerpt: draft.excerpt,
    content: draft.content,
    category: draft.category,
    author: draft.author,
    sourceName: draft.sourceName,
    sourceUrl: draft.sourceUrl,
    sourceCountry: draft.sourceCountry,
    regionFocus: draft.regionFocus,
    imageCreditName: draft.imageCreditName,
    imageCreditUrl: draft.imageCreditUrl,
    mediaUrl: draft.mediaUrl,
    mediaType: draft.mediaType,
    publishedAt: draft.publishedAt,
    workflowStatus: "published",
    approvedAt: new Date().toISOString()
  });

  await deleteAutoDraft(id);
  return post;
}
