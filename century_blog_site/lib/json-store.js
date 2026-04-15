import fs from "node:fs/promises";
import { readCloudinaryJson, writeCloudinaryJson, isCloudinaryConfigured } from "@/lib/cloudinary";

export async function readJsonStore(localFilePath, publicId, fallbackValue) {
  if (publicId && isCloudinaryConfigured()) {
    try {
      const remote = await readCloudinaryJson(publicId);
      if (remote !== null) {
        return remote;
      }
    } catch {
      // Fall through to local fallback.
    }
  }

  try {
    const file = await fs.readFile(localFilePath, "utf8");
    return JSON.parse(file);
  } catch {
    return fallbackValue;
  }
}

export async function writeJsonStore(localFilePath, publicId, payload) {
  try {
    await fs.writeFile(localFilePath, JSON.stringify(payload, null, 2), "utf8");
  } catch {
    // Ignore local write errors in read-only environments.
  }

  if (publicId && isCloudinaryConfigured()) {
    await writeCloudinaryJson(publicId, payload);
  }
}
