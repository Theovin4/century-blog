import crypto from "node:crypto";
import path from "node:path";
import { readJsonStore, writeJsonStore } from "@/lib/json-store";

const localFilePath = path.join(process.cwd(), "data", "submissions.json");
const publicId = "century-blog/data/submissions";

async function readSubmissionsSource() {
  const payload = await readJsonStore(localFilePath, publicId, []);
  return Array.isArray(payload) ? payload : [];
}

async function writeSubmissionsSource(submissions) {
  await writeJsonStore(localFilePath, publicId, submissions);
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
