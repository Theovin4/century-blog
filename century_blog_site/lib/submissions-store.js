import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { list, put } from "@vercel/blob";

const localFilePath = path.join(process.cwd(), "data", "submissions.json");
const blobKey = "century-blog/submissions.json";

function shouldUseBlob() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

async function readLocalSubmissions() {
  try {
    const file = await fs.readFile(localFilePath, "utf8");
    return JSON.parse(file);
  } catch {
    return [];
  }
}

async function writeLocalSubmissions(submissions) {
  await fs.writeFile(localFilePath, JSON.stringify(submissions, null, 2), "utf8");
}

async function readBlobSubmissions() {
  const { blobs } = await list({ prefix: blobKey, limit: 1 });
  const target = blobs.find((blob) => blob.pathname === blobKey) || blobs[0];

  if (!target) {
    return null;
  }

  const response = await fetch(target.url, { cache: "no-store" });
  return response.json();
}

async function writeBlobSubmissions(submissions) {
  await put(blobKey, JSON.stringify(submissions, null, 2), {
    access: "public",
    addRandomSuffix: false,
    contentType: "application/json"
  });
}

async function readSubmissionsSource() {
  if (shouldUseBlob()) {
    try {
      const blobSubmissions = await readBlobSubmissions();
      if (blobSubmissions) {
        return blobSubmissions;
      }
    } catch {
      return readLocalSubmissions();
    }
  }

  return readLocalSubmissions();
}

async function writeSubmissionsSource(submissions) {
  if (shouldUseBlob()) {
    try {
      await writeBlobSubmissions(submissions);
      return;
    } catch {
      await writeLocalSubmissions(submissions);
      return;
    }
  }

  await writeLocalSubmissions(submissions);
}

export async function createSubmission(input) {
  const submissions = await readSubmissionsSource();
  const entry = {
    id: crypto.randomUUID(),
    type: input.type,
    name: input.name || "",
    email: input.email || "",
    message: input.message || "",
    createdAt: new Date().toISOString()
  };

  const updated = [entry, ...submissions];
  await writeSubmissionsSource(updated);
  return entry;
}
